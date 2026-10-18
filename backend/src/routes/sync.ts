import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';
import { AppEnv } from '../types/index.js';

const syncApp = new Hono<AppEnv>();
syncApp.use('*', authMiddleware);

const syncPayloadSchema = z.object({
  last_synced_at: z.string().datetime().nullable().optional(),
  tasks: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        description: z.string().nullable().optional(),
        due_at: z.string().datetime().nullable().optional(),
        priority: z.enum(['low', 'medium', 'high']),
        category: z.enum(['personal', 'work', 'study', 'health', 'other']),
        is_completed: z.boolean(),
        recurrence_rule: z.string().nullable().optional(),
        assigned_to_user_id: z.string().nullable().optional(),
        assigned_by_user_id: z.string().nullable().optional(),
        updated_at: z.string().datetime(),
      })
    )
    .optional()
    .default([]),
  reminders: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        description: z.string().nullable().optional(),
        scheduled_at: z.string().datetime(),
        recurrence_rule: z.string().nullable().optional(),
        category: z.enum(['personal', 'work', 'study', 'health', 'other']),
        is_enabled: z.boolean(),
        updated_at: z.string().datetime(),
      })
    )
    .optional()
    .default([]),
  hydration_logs: z
    .array(
      z.object({
        id: z.string().min(1),
        amount_ml: z.number().int().positive(),
        logged_at: z.string().datetime(),
      })
    )
    .optional()
    .default([]),
});

// POST /api/sync (Bi-directional delta sync with conflict prevention)
syncApp.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = syncPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation failed', details: parsed.error.errors }, 400);
  }

  const { last_synced_at, tasks, reminders, hydration_logs } = parsed.data;
  const now = new Date().toISOString();

  // 1. Upsert uploaded tasks
  for (const t of tasks) {
    await db.execute({
      sql: `INSERT INTO tasks (
        id, user_id, title, description, due_at, priority, category,
        is_completed, recurrence_rule, assigned_to_user_id, assigned_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        due_at = excluded.due_at,
        priority = excluded.priority,
        category = excluded.category,
        is_completed = excluded.is_completed,
        recurrence_rule = excluded.recurrence_rule,
        assigned_to_user_id = COALESCE(excluded.assigned_to_user_id, tasks.assigned_to_user_id),
        assigned_by_user_id = COALESCE(excluded.assigned_by_user_id, tasks.assigned_by_user_id),
        updated_at = excluded.updated_at
      WHERE (tasks.user_id = excluded.user_id OR tasks.assigned_to_user_id = excluded.user_id) AND tasks.updated_at <= excluded.updated_at`,
      args: [
        t.id,
        userId,
        t.title,
        t.description ?? null,
        t.due_at ?? null,
        t.priority,
        t.category,
        t.is_completed ? 1 : 0,
        t.recurrence_rule ?? null,
        t.assigned_to_user_id ?? null,
        t.assigned_by_user_id ?? userId,
        t.updated_at,
        t.updated_at,
      ],
    });
  }

  // 2. Upsert uploaded reminders
  for (const r of reminders) {
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
      WHERE reminders.user_id = excluded.user_id AND reminders.updated_at <= excluded.updated_at`,
      args: [
        r.id,
        userId,
        r.title,
        r.description ?? null,
        r.scheduled_at,
        r.recurrence_rule ?? null,
        r.category,
        r.is_enabled ? 1 : 0,
        r.updated_at,
        r.updated_at,
      ],
    });
  }

  // 3. Insert hydration logs (ignore if duplicate ID)
  for (const h of hydration_logs) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO hydration_logs (id, user_id, amount_ml, logged_at) VALUES (?, ?, ?, ?)`,
      args: [h.id, userId, h.amount_ml, h.logged_at],
    });
  }

  // 4. Fetch delta changes updated since last_synced_at
  const cutoff = last_synced_at || '1970-01-01T00:00:00.000Z';

  const [dbTasks, dbReminders, dbHydration, dbPrefs] = await Promise.all([
    db.execute({
      sql: `SELECT t.*,
                   u_by.name AS assigner_name,
                   u_by.username AS assigner_username,
                   u_to.name AS assignee_name,
                   u_to.username AS assignee_username
            FROM tasks t
            LEFT JOIN users u_by ON t.assigned_by_user_id = u_by.id
            LEFT JOIN users u_to ON t.assigned_to_user_id = u_to.id
            WHERE (t.user_id = ? OR t.assigned_to_user_id = ?) AND t.updated_at > ?`,
      args: [userId, userId, cutoff],
    }),
    db.execute({
      sql: 'SELECT * FROM reminders WHERE user_id = ? AND updated_at > ?',
      args: [userId, cutoff],
    }),
    db.execute({
      sql: 'SELECT * FROM hydration_logs WHERE user_id = ? AND logged_at > ?',
      args: [userId, cutoff],
    }),
    db.execute({
      sql: 'SELECT * FROM user_preferences WHERE user_id = ?',
      args: [userId],
    }),
  ]);

  return c.json({
    success: true,
    sync_timestamp: now,
    data: {
      tasks: dbTasks.rows.map((row) => ({ ...row, is_completed: Boolean(row.is_completed) })),
      reminders: dbReminders.rows.map((row) => ({ ...row, is_enabled: Boolean(row.is_enabled) })),
      hydration_logs: dbHydration.rows,
      preferences: dbPrefs.rows[0]
        ? {
            ...dbPrefs.rows[0],
            quiet_hours_enabled: Boolean(dbPrefs.rows[0].quiet_hours_enabled),
            notification_preferences:
              typeof dbPrefs.rows[0].notification_preferences === 'string'
                ? JSON.parse(dbPrefs.rows[0].notification_preferences as string)
                : dbPrefs.rows[0].notification_preferences,
          }
        : null,
    },
  });
});

export default syncApp;
