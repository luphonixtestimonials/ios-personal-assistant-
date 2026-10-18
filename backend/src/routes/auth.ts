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
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores').optional(),
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  timezone: z.string().optional().default('UTC'),
});

const loginSchema = z.object({
  email: z.string().min(1, 'Email or username required').toLowerCase(),
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

  // Check if email already exists
  const existing = await db.execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [email],
  });

  if (existing.rows.length > 0) {
    return c.json({ success: false, error: 'A user with this email already exists' }, 409);
  }

  // Derive unique username
  let username = (parsed.data.username || email.split('@')[0])
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  if (!username || username.length < 3) {
    username = `user_${Math.floor(1000 + Math.random() * 9000)}`;
  }

  // Check username collision
  const checkUser = await db.execute({
    sql: 'SELECT id FROM users WHERE LOWER(username) = LOWER(?)',
    args: [username],
  });
  if (checkUser.rows.length > 0) {
    if (parsed.data.username) {
      return c.json({ success: false, error: 'This unique username is already taken. Please choose another.' }, 409);
    } else {
      username = `${username}_${Math.floor(100 + Math.random() * 900)}`;
    }
  }

  const userId = randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();

  // Create user, default preferences, and adopt any guest/default tasks
  await db.batch([
    {
      sql: 'INSERT INTO users (id, name, username, email, password_hash, timezone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [userId, name, username, email, passwordHash, timezone, now],
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
        username,
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

  // Allow login with either email OR unique username
  const cleanIdentifier = email.startsWith('@') ? email.substring(1) : email;
  const result = await db.execute({
    sql: 'SELECT id, name, username, email, password_hash, timezone, created_at FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)',
    args: [cleanIdentifier, cleanIdentifier],
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
        username: row.username || String(row.email).split('@')[0],
        email: row.email,
        timezone: row.timezone,
        created_at: row.created_at,
      },
    },
  });
});

const resetPasswordSchema = z.object({
  email: z.string().min(1, 'Email or username is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

// POST /api/auth/reset-password (Public - resets password by email/handle)
authApp.post('/reset-password', async (c) => {
  const body = await parseBodySafe(c);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation failed', details: parsed.error.errors }, 400);
  }

  const { email, newPassword } = parsed.data;
  const cleanIdentifier = email.startsWith('@') ? email.substring(1).trim() : email.trim();

  const userResult = await db.execute({
    sql: 'SELECT id, name, username, email FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?) LIMIT 1',
    args: [cleanIdentifier, cleanIdentifier],
  });

  if (userResult.rows.length === 0) {
    return c.json({ success: false, error: 'No account found with this email or username' }, 404);
  }

  const userRow = userResult.rows[0];
  const newHash = await bcrypt.hash(newPassword, 10);

  await db.execute({
    sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
    args: [newHash, userRow.id],
  });

  return c.json({
    success: true,
    message: `Password has been reset successfully for ${userRow.email}. You can now log in.`,
    user: {
      id: userRow.id,
      name: userRow.name,
      username: userRow.username,
      email: userRow.email,
    },
  });
});

// POST /api/auth/change-password (Authenticated user)
authApp.post('/change-password', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await parseBodySafe(c);
  const { currentPassword, newPassword } = body;

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return c.json({ success: false, error: 'New password must be at least 6 characters' }, 400);
  }

  const userResult = await db.execute({
    sql: 'SELECT password_hash FROM users WHERE id = ?',
    args: [userId],
  });

  if (userResult.rows.length === 0) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  if (currentPassword) {
    const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash as string);
    if (!isValid) {
      return c.json({ success: false, error: 'Current password is incorrect' }, 401);
    }
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await db.execute({
    sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
    args: [newHash, userId],
  });

  return c.json({ success: true, message: 'Password updated successfully' });
});

// GET /api/auth/me
authApp.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const userResult = await db.execute({
    sql: 'SELECT id, name, username, email, timezone, created_at FROM users WHERE id = ?',
    args: [userId],
  });

  if (userResult.rows.length === 0) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  const userRow = userResult.rows[0];
  const user = {
    ...userRow,
    username: userRow.username || String(userRow.email).split('@')[0],
  };

  const prefResult = await db.execute({
    sql: 'SELECT * FROM user_preferences WHERE user_id = ?',
    args: [userId],
  });

  const prefs = prefResult.rows[0] || null;

  return c.json({
    success: true,
    data: {
      user,
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

// PUT /api/auth/profile - Update name or unique username
authApp.put('/profile', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await parseBodySafe(c);
  const { name, username } = body;

  const updates: string[] = [];
  const args: any[] = [];

  if (name && typeof name === 'string' && name.trim()) {
    updates.push('name = ?');
    args.push(name.trim());
  }

  if (username && typeof username === 'string' && username.trim()) {
    let cleanHandle = username.trim().toLowerCase();
    if (cleanHandle.startsWith('@')) cleanHandle = cleanHandle.substring(1);
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanHandle)) {
      return c.json({ success: false, error: 'Username must be 3-30 alphanumeric characters or underscores.' }, 400);
    }

    const checkTaken = await db.execute({
      sql: 'SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?',
      args: [cleanHandle, userId],
    });

    if (checkTaken.rows.length > 0) {
      return c.json({ success: false, error: 'This unique username is already taken.' }, 409);
    }

    updates.push('username = ?');
    args.push(cleanHandle);
  }

  if (updates.length === 0) {
    return c.json({ success: false, error: 'No valid fields to update.' }, 400);
  }

  args.push(userId);
  await db.execute({
    sql: `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
    args,
  });

  const refreshed = await db.execute({
    sql: 'SELECT id, name, username, email, timezone, created_at FROM users WHERE id = ?',
    args: [userId],
  });

  return c.json({
    success: true,
    message: 'Profile updated successfully!',
    user: refreshed.rows[0],
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
