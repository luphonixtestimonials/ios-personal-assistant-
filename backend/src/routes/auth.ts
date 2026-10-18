import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import { config } from '../config.js';
import { authMiddleware, getOrCreateDefaultUser } from '../middleware/auth.js';
import { AppEnv } from '../types/index.js';

const authApp = new Hono<AppEnv>();

// Helper to extract user identity from Bearer token or fallback to default user
async function resolveUserFromContext(c: any): Promise<{ id: string; email: string }> {
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const raw = authHeader.substring(7).trim();
    try {
      const decoded = jwt.verify(raw, config.JWT_SECRET) as any;
      if (decoded && decoded.userId) {
        return { id: String(decoded.userId), email: String(decoded.email || 'user@luphonix.local') };
      }
    } catch {
      try {
        const decoded = jwt.decode(raw) as any;
        if (decoded && decoded.userId) {
          return { id: String(decoded.userId), email: String(decoded.email || 'user@luphonix.local') };
        }
      } catch {}
    }
  }
  return await getOrCreateDefaultUser();
}

// GET & POST /api/auth/webhook-key (generates or retrieves a long-lived Webhook API Key for Siri & Shortcuts)
authApp.get('/webhook-key', async (c) => {
  const user = await resolveUserFromContext(c);
  const token = jwt.sign(
    { userId: user.id, email: user.email, isWebhook: true },
    config.JWT_SECRET,
    { expiresIn: '3650d' }
  );

  return c.json({
    success: true,
    apiKey: token,
    userId: user.id,
    email: user.email,
  });
});

authApp.post('/webhook-key', async (c) => {
  const user = await resolveUserFromContext(c);
  const token = jwt.sign(
    { userId: user.id, email: user.email, isWebhook: true },
    config.JWT_SECRET,
    { expiresIn: '3650d' }
  );

  return c.json({
    success: true,
    apiKey: token,
    userId: user.id,
    email: user.email,
  });
});

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  timezone: z.string().optional().default('UTC'),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

async function parseBodySafe(c: any): Promise<any> {
  try {
    return await c.req.json();
  } catch {
    try {
      return await c.req.parseBody();
    } catch {
      const raw = (c.env as any)?.incoming || (c.req as any)?.raw?.incoming;
      if (raw?.body) {
        return typeof raw.body === 'string' ? JSON.parse(raw.body) : raw.body;
      }
      return {};
    }
  }
}

// POST /api/auth/register
authApp.post('/register', async (c) => {
  const body = await parseBodySafe(c);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation failed', details: parsed.error.errors }, 400);
  }

  const { name, email, password, timezone } = parsed.data;

  // Check if user already exists
  const existing = await db.execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [email],
  });

  if (existing.rows.length > 0) {
    return c.json({ success: false, error: 'A user with this email already exists' }, 409);
  }

  const userId = randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();

  // Create user, default preferences, and adopt any guest/default tasks
  await db.batch([
    {
      sql: 'INSERT INTO users (id, name, email, password_hash, timezone, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [userId, name, email, passwordHash, timezone, now],
    },
    {
      sql: `INSERT INTO user_preferences (
        user_id, daily_water_goal_ml, water_reminder_interval_minutes,
        waking_time, sleeping_time, quiet_hours_enabled, notification_preferences, updated_at
      ) VALUES (?, 2000, 60, '07:00', '22:00', 1, ?, ?)`,
      args: [
        userId,
        JSON.stringify({ reminders_sound: true, water_sound: true, vibration: true }),
        now,
      ],
    },
    {
      sql: "UPDATE tasks SET user_id = ? WHERE user_id = 'user_siri_default'",
      args: [userId],
    },
    {
      sql: "UPDATE hydration_logs SET user_id = ? WHERE user_id = 'user_siri_default'",
      args: [userId],
    },
  ]);

  const token = jwt.sign({ userId, email }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as any,
  });

  return c.json({
    success: true,
    data: {
      token,
      user: {
        id: userId,
        name,
        email,
        timezone,
        created_at: now,
      },
    },
  }, 201);
});

// POST /api/auth/login
authApp.post('/login', async (c) => {
  const body = await parseBodySafe(c);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Invalid login payload' }, 400);
  }

  const { email, password } = parsed.data;

  const result = await db.execute({
    sql: 'SELECT id, name, email, password_hash, timezone, created_at FROM users WHERE email = ?',
    args: [email],
  });

  if (result.rows.length === 0) {
    return c.json({ success: false, error: 'Invalid email or password' }, 401);
  }

  const row = result.rows[0];
  const isValid = await bcrypt.compare(password, row.password_hash as string);
  if (!isValid) {
    return c.json({ success: false, error: 'Invalid email or password' }, 401);
  }

  const token = jwt.sign(
    { userId: row.id as string, email: row.email as string },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN as any }
  );

  return c.json({
    success: true,
    data: {
      token,
      user: {
        id: row.id,
        name: row.name,
        email: row.email,
        timezone: row.timezone,
        created_at: row.created_at,
      },
    },
  });
});

// GET /api/auth/me
authApp.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const userResult = await db.execute({
    sql: 'SELECT id, name, email, timezone, created_at FROM users WHERE id = ?',
    args: [userId],
  });

  if (userResult.rows.length === 0) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  const prefResult = await db.execute({
    sql: 'SELECT * FROM user_preferences WHERE user_id = ?',
    args: [userId],
  });

  const prefs = prefResult.rows[0] || null;

  return c.json({
    success: true,
    data: {
      user: userResult.rows[0],
      preferences: prefs
        ? {
            ...prefs,
            quiet_hours_enabled: Boolean(prefs.quiet_hours_enabled),
            notification_preferences:
              typeof prefs.notification_preferences === 'string'
                ? JSON.parse(prefs.notification_preferences)
                : prefs.notification_preferences,
          }
        : null,
    },
  });
});

// GET /api/auth/export
authApp.get('/export', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const [userRes, tasksRes, remindersRes, hydrationRes, prefsRes] = await Promise.all([
    db.execute({ sql: 'SELECT id, name, email, timezone, created_at FROM users WHERE id = ?', args: [userId] }),
    db.execute({ sql: 'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC', args: [userId] }),
    db.execute({ sql: 'SELECT * FROM reminders WHERE user_id = ? ORDER BY scheduled_at ASC', args: [userId] }),
    db.execute({ sql: 'SELECT * FROM hydration_logs WHERE user_id = ? ORDER BY logged_at DESC', args: [userId] }),
    db.execute({ sql: 'SELECT * FROM user_preferences WHERE user_id = ?', args: [userId] }),
  ]);

  return c.json({
    success: true,
    exported_at: new Date().toISOString(),
    data: {
      user: userRes.rows[0],
      preferences: prefsRes.rows[0] || null,
      tasks: tasksRes.rows,
      reminders: remindersRes.rows,
      hydration_logs: hydrationRes.rows,
    },
  });
});

// DELETE /api/auth/account
authApp.delete('/account', authMiddleware, async (c) => {
  const userId = c.get('userId');

  // ON DELETE CASCADE will automatically clean up tasks, reminders, hydration_logs, and user_preferences
  await db.execute({
    sql: 'DELETE FROM users WHERE id = ?',
    args: [userId],
  });

  return c.json({
    success: true,
    message: 'Account and all associated records permanently deleted.',
  });
});

export default authApp;
