import { Hono } from 'hono';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';
import { AppEnv } from '../types/index.js';

const remindersApp = new Hono<AppEnv>();
remindersApp.use('*', authMiddleware);

const reminderInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().nullable().optional(),
  scheduled_at: z.string().datetime(),
  recurrence_rule: z.string().nullable().optional(),
  category: z.enum(['personal', 'work', 'study', 'health', 'other']).default('other'),
  is_enabled: z.boolean().default(true),
});

// GET /api/reminders
remindersApp.get('/', async (c) => {
  const userId = c.get('userId');
  const filter = c.req.query('filter'); // 'today', 'upcoming', 'all'
  const category = c.req.query('category');

  let query = 'SELECT * FROM reminders WHERE user_id = ?';
  const args: any[] = [userId];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  if (filter === 'today') {
    query += ' AND scheduled_at >= ? AND scheduled_at <= ?';
    args.push(todayStart.toISOString(), todayEnd.toISOString());
  } else if (filter === 'upcoming') {
    query += ' AND scheduled_at > ?';
    args.push(todayEnd.toISOString());
  }

  if (category) {
    query += ' AND category = ?';
    args.push(category);
  }

  query += ' ORDER BY scheduled_at ASC';

  const result = await db.execute({ sql: query, args });

  const reminders = result.rows.map((row) => ({
    ...row,
    is_enabled: Boolean(row.is_enabled),
  }));

  return c.json({ success: true, count: reminders.length, data: reminders });
});

// GET & POST /api/reminders/quick (Hands-free quick reminder creation for Siri Shortcuts)
async function handleQuickReminder(c: any) {
  const userId = c.get('userId');
  let title = c.req.query('title') || c.req.query('text') || c.req.query('q');
  let minutesParam = parseInt(c.req.query('minutes') || '30', 10);

  if (!title) {
    try {
      const body = await c.req.json();
      if (body) {
        if (body.title) title = body.title;
        if (typeof body.minutes === 'number') minutesParam = body.minutes;
      }
    } catch {}
  }

  if (!title || !title.trim()) {
    return c.text('Please provide a reminder title in Luphonix.');
  }

  const minutes = isNaN(minutesParam) || minutesParam <= 0 ? 30 : minutesParam;
  const scheduledAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  const id = randomUUID();
  const now = new Date().toISOString();
  const reminderTitle = title.trim();

  await db.execute({
    sql: `INSERT INTO reminders (
      id, user_id, title, description, scheduled_at, recurrence_rule, category, is_enabled, created_at, updated_at
    ) VALUES (?, ?, ?, NULL, ?, NULL, 'personal', 1, ?, ?)`,
    args: [id, userId, reminderTitle, scheduledAt, now, now],
  });

  const msg = `Set reminder for '${reminderTitle}' in Luphonix for ${minutes} minutes from now.`;
  const format = c.req.query('format')?.toLowerCase();
  const accept = c.req.header('accept')?.toLowerCase() || '';
  const userAgent = c.req.header('user-agent')?.toLowerCase() || '';

  const isExplicitJson = format === 'json' || accept.includes('application/json');
  const isExplicitText = format === 'text' || c.req.query('text') === '1' || accept.includes('text/plain');
  const isShortcut = userAgent.includes('shortcut') || userAgent.includes('cfnetwork') || userAgent.includes('darwin');

  if (isExplicitText || (!isExplicitJson && isShortcut)) {
    return c.text(msg);
  }

  return c.json(
    {
      success: true,
      message: msg,
      speech: msg,
      data: {
        id,
        user_id: userId,
        title: reminderTitle,
        scheduled_at: scheduledAt,
        is_enabled: true,
        created_at: now,
      },
    },
    201
  );
}

remindersApp.get('/quick', handleQuickReminder);
remindersApp.post('/quick', handleQuickReminder);

// POST /api/reminders (Create or Upsert)
remindersApp.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = reminderInputSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation failed', details: parsed.error.errors }, 400);
  }

  const {
    id = randomUUID(),
    title,
    description = null,
    scheduled_at,
    recurrence_rule = null,
    category,
    is_enabled,
  } = parsed.data;

  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO reminders (
      id, user_id, title, description, scheduled_at, recurrence_rule, category, is_enabled, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      scheduled_at = excluded.scheduled_at,
      recurrence_rule = excluded.recurrence_rule,
      category = excluded.category,
      is_enabled = excluded.is_enabled,
      updated_at = excluded.updated_at
    WHERE reminders.user_id = excluded.user_id`,
    args: [
      id,
      userId,
      title,
      description,
      scheduled_at,
      recurrence_rule,
      category,
      is_enabled ? 1 : 0,
      now,
      now,
    ],
  });

  return c.json(
    {
      success: true,
      data: {
        id,
        user_id: userId,
        title,
        description,
        scheduled_at,
        recurrence_rule,
        category,
        is_enabled,
        created_at: now,
        updated_at: now,
      },
    },
    201
  );
});

// PATCH /api/reminders/:id
remindersApp.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = await c.req.json();

  const updateSchema = reminderInputSchema.partial();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation failed', details: parsed.error.errors }, 400);
  }

  const existing = await db.execute({
    sql: 'SELECT * FROM reminders WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });

  if (existing.rows.length === 0) {
    return c.json({ success: false, error: 'Reminder not found' }, 404);
  }

  const updates = parsed.data;
  const now = new Date().toISOString();

  const fields: string[] = ['updated_at = ?'];
  const args: any[] = [now];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    args.push(updates.title);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    args.push(updates.description);
  }
  if (updates.scheduled_at !== undefined) {
    fields.push('scheduled_at = ?');
    args.push(updates.scheduled_at);
  }
  if (updates.recurrence_rule !== undefined) {
    fields.push('recurrence_rule = ?');
    args.push(updates.recurrence_rule);
  }
  if (updates.category !== undefined) {
    fields.push('category = ?');
    args.push(updates.category);
  }
  if (updates.is_enabled !== undefined) {
    fields.push('is_enabled = ?');
    args.push(updates.is_enabled ? 1 : 0);
  }

  args.push(id, userId);

  await db.execute({
    sql: `UPDATE reminders SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
    args,
  });

  const updatedResult = await db.execute({
    sql: 'SELECT * FROM reminders WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });

  return c.json({
    success: true,
    data: {
      ...updatedResult.rows[0],
      is_enabled: Boolean(updatedResult.rows[0].is_enabled),
    },
  });
});

// POST /api/reminders/:id/snooze (Snooze by X minutes)
remindersApp.post('/:id/snooze', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({ minutes: 15 }));
  const minutes = typeof body.minutes === 'number' && body.minutes > 0 ? body.minutes : 15;

  const existing = await db.execute({
    sql: 'SELECT * FROM reminders WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });

  if (existing.rows.length === 0) {
    return c.json({ success: false, error: 'Reminder not found' }, 404);
  }

  const snoozedDate = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  await db.execute({
    sql: 'UPDATE reminders SET scheduled_at = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    args: [snoozedDate, now, id, userId],
  });

  return c.json({
    success: true,
    message: `Reminder snoozed for ${minutes} minutes`,
    scheduled_at: snoozedDate,
  });
});

// POST /api/reminders/:id/advance (Advance recurring reminder to next cycle)
remindersApp.post('/:id/advance', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const existing = await db.execute({
    sql: 'SELECT * FROM reminders WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });

  if (existing.rows.length === 0) {
    return c.json({ success: false, error: 'Reminder not found' }, 404);
  }

  const reminder = existing.rows[0];
  const rule = reminder.recurrence_rule as string | null;
  const currentScheduled = new Date(reminder.scheduled_at as string);

  let nextScheduled = new Date(currentScheduled);

  if (rule === 'daily') {
    nextScheduled.setDate(nextScheduled.getDate() + 1);
  } else if (rule === 'weekly') {
    nextScheduled.setDate(nextScheduled.getDate() + 7);
  } else {
    // If not recurring, we can disable it
    await db.execute({
      sql: 'UPDATE reminders SET is_enabled = 0, updated_at = ? WHERE id = ? AND user_id = ?',
      args: [new Date().toISOString(), id, userId],
    });
    return c.json({
      success: true,
      message: 'One-time reminder marked completed and disabled',
      is_enabled: false,
    });
  }

  // Ensure nextScheduled is in the future
  while (nextScheduled.getTime() < Date.now()) {
    if (rule === 'daily') nextScheduled.setDate(nextScheduled.getDate() + 1);
    else if (rule === 'weekly') nextScheduled.setDate(nextScheduled.getDate() + 7);
  }

  const now = new Date().toISOString();
  await db.execute({
    sql: 'UPDATE reminders SET scheduled_at = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    args: [nextScheduled.toISOString(), now, id, userId],
  });

  return c.json({
    success: true,
    message: 'Recurring reminder rescheduled to next occurrence',
    scheduled_at: nextScheduled.toISOString(),
  });
});

// DELETE /api/reminders/:id
remindersApp.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const result = await db.execute({
    sql: 'DELETE FROM reminders WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });

  if (result.rowsAffected === 0) {
    return c.json({ success: false, error: 'Reminder not found' }, 404);
  }

  return c.json({ success: true, message: 'Reminder deleted successfully', id });
});

export default remindersApp;
