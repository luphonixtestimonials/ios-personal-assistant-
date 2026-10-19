import { Hono } from 'hono';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';
import { AppEnv } from '../types/index.js';
import { notificationService } from '../services/notificationService.js';

const tasksApp = new Hono<AppEnv>();
tasksApp.use('*', authMiddleware);

const taskInputSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().nullable().optional(),
  due_at: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  category: z.enum(['personal', 'work', 'study', 'health', 'other']).default('other'),
  is_completed: z.boolean().default(false),
  recurrence_rule: z.string().nullable().optional(),
  assigned_to_user_id: z.string().nullable().optional(),
  assigned_to_username: z.string().nullable().optional(),
});

// GET /api/tasks
tasksApp.get('/', async (c) => {
  const userId = c.get('userId');
  const filter = c.req.query('filter'); // 'today', 'upcoming', 'completed', 'overdue', 'assigned', 'all'
  const search = c.req.query('q');
  const sortBy = c.req.query('sortBy') || 'due_at'; // 'due_at', 'priority', 'created_at'
  const order = c.req.query('order')?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  const now = new Date().toISOString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  let query = `
    SELECT t.*,
           u_by.name AS assigner_name,
           u_by.username AS assigner_username,
           u_to.name AS assignee_name,
           u_to.username AS assignee_username
    FROM tasks t
    LEFT JOIN users u_by ON t.assigned_by_user_id = u_by.id
    LEFT JOIN users u_to ON t.assigned_to_user_id = u_to.id
    WHERE (t.user_id = ? OR t.assigned_to_user_id = ? OR (t.user_id = 'user_siri_default' AND t.assigned_to_user_id IS NULL))
  `;
  const args: any[] = [userId, userId];

  if (filter === 'completed') {
    query += ' AND t.is_completed = 1';
  } else if (filter === 'overdue') {
    query += ' AND t.is_completed = 0 AND t.due_at IS NOT NULL AND t.due_at < ?';
    args.push(now);
  } else if (filter === 'today') {
    // Uncompleted tasks for today: includes tasks with no due date, or due today, or overdue
    query += ' AND t.is_completed = 0 AND (t.due_at IS NULL OR t.due_at <= ?)';
    args.push(todayEnd.toISOString());
  } else if (filter === 'upcoming') {
    query += ' AND t.is_completed = 0 AND t.due_at > ?';
    args.push(todayEnd.toISOString());
  } else if (filter === 'assigned') {
    query += ' AND (t.assigned_to_user_id IS NOT NULL AND t.assigned_to_user_id != t.user_id)';
  } else if (filter === 'assigned_to_me') {
    query += ' AND (t.assigned_to_user_id = ? AND t.user_id != ?)';
    args.push(userId, userId);
  } else if (filter === 'assigned_by_me') {
    query += ' AND (t.user_id = ? AND t.assigned_to_user_id IS NOT NULL AND t.assigned_to_user_id != ?)';
    args.push(userId, userId);
  } else if (filter === 'all') {
    // Return all tasks without completion filter
  } else {
    // Default: return uncompleted tasks
    query += ' AND t.is_completed = 0';
  }

  if (search && search.trim().length > 0) {
    query += ' AND (title LIKE ? OR description LIKE ?)';
    const term = `%${search.trim()}%`;
    args.push(term, term);
  }

  // Sorting
  if (sortBy === 'priority') {
    query += ` ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END ${order}`;
  } else if (sortBy === 'created_at') {
    query += ` ORDER BY created_at ${order}`;
  } else {
    // Default: due_at (NULLs last)
    query += ` ORDER BY CASE WHEN due_at IS NULL THEN 1 ELSE 0 END, due_at ${order}, created_at DESC`;
  }

  let tasks: any[] = [];
  try {
    const result = await db.execute({ sql: query, args });
    tasks = result.rows.map((row) => ({
      ...row,
      is_completed: Boolean(row.is_completed),
      assigned_to_username: row.assignee_username || null,
      assigned_by_username: row.assigner_username || null,
    }));
  } catch (err) {
    console.error('Error fetching tasks from database:', err);
    return c.json({
      success: true,
      count: 0,
      data: [],
      summary: 'You have no remaining tasks for today in Luphonix!',
      message: 'You have no remaining tasks for today in Luphonix!',
      speech: 'You have no remaining tasks for today in Luphonix!',
    });
  }

  let summary = '';
  if (tasks.length === 0) {
    summary = (filter === 'today' || !filter)
      ? 'You have no remaining tasks for today in Luphonix!'
      : 'You have no tasks in Luphonix.';
  } else {
    const titles = tasks.slice(0, 3).map((t: any) => t.title).join(', ');
    const more = tasks.length > 3 ? ` and ${tasks.length - 3} more` : '';
    summary = `You have ${tasks.length} task${tasks.length === 1 ? '' : 's'}: ${titles}${more}.`;
  }

  const format = c.req.query('format')?.toLowerCase();
  const accept = c.req.header('accept')?.toLowerCase() || '';
  const userAgent = c.req.header('user-agent')?.toLowerCase() || '';

  const isExplicitJson = format === 'json' || accept.includes('application/json');
  const isExplicitText = format === 'text' || c.req.query('text') === '1' || accept.includes('text/plain');
  const isShortcut = userAgent.includes('shortcut') || userAgent.includes('cfnetwork') || userAgent.includes('darwin');

  if (isExplicitText || (!isExplicitJson && isShortcut)) {
    return c.text(summary);
  }

  return c.json({
    success: true,
    count: tasks.length,
    data: tasks,
    summary,
    message: summary,
    speech: summary,
  });
});

// GET /api/tasks/complete (Hands-free task completion for Siri Shortcuts)
tasksApp.get('/complete', async (c) => {
  const userId = c.get('userId');
  const queryParam =
    c.req.query('title') ||
    c.req.query('task') ||
    c.req.query('text') ||
    c.req.query('q') ||
    c.req.query('id');

  const format = c.req.query('format')?.toLowerCase();
  const accept = c.req.header('accept')?.toLowerCase() || '';
  const isExplicitJson = format === 'json' || accept.includes('application/json');

  if (!queryParam || !queryParam.trim()) {
    const errorMsg = 'Please provide the task title to mark as completed in Luphonix.';
    if (isExplicitJson) {
      return c.json({ success: false, error: errorMsg }, 400);
    }
    return c.text(errorMsg, 400);
  }

  const cleanQuery = queryParam.trim();
  const now = new Date().toISOString();

  // Search for an uncompleted task matching ID or title (case-insensitive substring)
  const findResult = await db.execute({
    sql: `SELECT * FROM tasks
          WHERE (user_id = ? OR user_id = 'user_siri_default')
            AND is_completed = 0
            AND (id = ? OR LOWER(title) LIKE ?)
          ORDER BY CASE WHEN id = ? THEN 1 WHEN LOWER(title) = ? THEN 2 ELSE 3 END, created_at DESC
          LIMIT 1`,
    args: [userId, cleanQuery, `%${cleanQuery.toLowerCase()}%`, cleanQuery, cleanQuery.toLowerCase()],
  });

  if (findResult.rows.length === 0) {
    const notFoundMsg = `Could not find an uncompleted task matching '${cleanQuery}' in Luphonix.`;
    if (isExplicitJson) {
      return c.json({ success: false, message: notFoundMsg, error: 'Task not found' }, 404);
    }
    return c.text(notFoundMsg, 404);
  }

  const matchedTask = findResult.rows[0];
  const taskId = matchedTask.id;
  const matchedTitle = String(matchedTask.title);

  // Mark task completed
  await db.execute({
    sql: 'UPDATE tasks SET is_completed = 1, updated_at = ? WHERE id = ?',
    args: [now, taskId],
  });

  const successMsg = `Marked '${matchedTitle}' as completed in Luphonix. Good job!`;

  if (isExplicitJson) {
    return c.json({
      success: true,
      message: successMsg,
      data: {
        ...matchedTask,
        is_completed: true,
        updated_at: now,
      },
    });
  }

  return c.text(successMsg);
});

// GET /api/tasks/toggle?id=<ID> or ?title=<title> (Instant completion toggle for Siri and Web UI)
tasksApp.get('/toggle', async (c) => {
  const userId = c.get('userId');
  const queryParam = c.req.query('id') || c.req.query('title') || c.req.query('q');

  if (!queryParam || !queryParam.trim()) {
    return c.json({ success: false, error: 'Task ID or title required' }, 400);
  }

  const cleanQuery = queryParam.trim();
  const findResult = await db.execute({
    sql: `SELECT * FROM tasks
          WHERE (user_id = ? OR user_id = 'user_siri_default')
            AND (id = ? OR LOWER(title) LIKE ?)
          ORDER BY CASE WHEN id = ? THEN 1 WHEN LOWER(title) = ? THEN 2 ELSE 3 END, created_at DESC
          LIMIT 1`,
    args: [userId, cleanQuery, `%${cleanQuery.toLowerCase()}%`, cleanQuery, cleanQuery.toLowerCase()],
  });

  if (findResult.rows.length === 0) {
    return c.json({ success: false, error: 'Task not found' }, 404);
  }

  const row = findResult.rows[0];
  const nextVal = row.is_completed ? 0 : 1;
  const now = new Date().toISOString();

  await db.execute({
    sql: 'UPDATE tasks SET is_completed = ?, updated_at = ? WHERE id = ?',
    args: [nextVal, now, row.id],
  });

  return c.json({
    success: true,
    data: {
      ...row,
      is_completed: Boolean(nextVal),
      updated_at: now,
    },
  });
});

// GET /api/tasks/add (Hands-free task creation for Siri Shortcuts)
tasksApp.get('/add', async (c) => {
  const userId = c.get('userId');
  const title = c.req.query('title') || c.req.query('text') || c.req.query('q');

  if (!title || !title.trim()) {
    return c.text('Please provide a task title to add.');
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const taskTitle = title.trim();

  // Smart category detection if not explicitly passed
  let category = (c.req.query('category') || '').toLowerCase();
  if (!['personal', 'work', 'study', 'health', 'other'].includes(category)) {
    const lower = taskTitle.toLowerCase();
    if (
      lower.includes('study') ||
      lower.includes('read') ||
      lower.includes('physics') ||
      lower.includes('chemistry') ||
      lower.includes('math') ||
      lower.includes('exam') ||
      lower.includes('homework') ||
      lower.includes('quiz')
    ) {
      category = 'study';
    } else if (
      lower.includes('water') ||
      lower.includes('drink') ||
      lower.includes('gym') ||
      lower.includes('workout') ||
      lower.includes('walk') ||
      lower.includes('meditat') ||
      lower.includes('sleep') ||
      lower.includes('health')
    ) {
      category = 'health';
    } else if (
      lower.includes('call') ||
      lower.includes('buy') ||
      lower.includes('grocer') ||
      lower.includes('mom') ||
      lower.includes('dad') ||
      lower.includes('family') ||
      lower.includes('clean') ||
      lower.includes('car')
    ) {
      category = 'personal';
    } else {
      category = 'work';
    }
  }

  const priorityParam = (c.req.query('priority') || '').toLowerCase();
  const priority = ['low', 'medium', 'high'].includes(priorityParam) ? priorityParam : 'medium';

  await db.execute({
    sql: `INSERT INTO tasks (
      id, user_id, title, description, due_at, priority, category,
      is_completed, recurrence_rule, created_at, updated_at
    ) VALUES (?, ?, ?, NULL, ?, ?, ?, 0, NULL, ?, ?)`,
    args: [id, userId, taskTitle, now, priority, category, now, now],
  });

  const msg = `Added "${taskTitle}" to your Luphonix tasks.`;
  const format = c.req.query('format')?.toLowerCase();
  const accept = c.req.header('accept')?.toLowerCase() || '';
  if (format === 'json' || accept.includes('application/json')) {
    return c.json({
      success: true,
      message: msg,
      data: {
        id,
        user_id: userId,
        title: taskTitle,
        priority,
        category,
        is_completed: false,
        created_at: now,
      },
    }, 201);
  }
  return c.text(msg);
});

// POST /api/tasks (Create or Upsert)
tasksApp.post('/', async (c) => {
  const userId = c.get('userId');
  let body: any = {};
  try {
    body = await c.req.json();
  } catch {
    try {
      body = await c.req.parseBody();
    } catch {
      body = {};
    }
  }

  if (!body || Object.keys(body).length === 0) {
    body = {
      id: c.req.query('id'),
      title: c.req.query('title') || c.req.query('text'),
      priority: c.req.query('priority') || 'medium',
      category: c.req.query('category') || 'work',
      is_completed: c.req.query('is_completed') === 'true' || c.req.query('is_completed') === '1',
    };
  }

  const parsed = taskInputSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation failed', details: parsed.error.errors }, 400);
  }

  const {
    id = randomUUID(),
    title,
    description = null,
    due_at = null,
    priority,
    category,
    is_completed,
    recurrence_rule = null,
    assigned_to_user_id = null,
    assigned_to_username = null,
  } = parsed.data;

  const now = new Date().toISOString();

  // Resolve assignment
  let resolvedAssigneeId: string | null = assigned_to_user_id || null;
  let resolvedAssigneeUsername: string | null = null;
  if (!resolvedAssigneeId && assigned_to_username) {
    let cleanHandle = assigned_to_username.trim();
    if (cleanHandle.startsWith('@')) cleanHandle = cleanHandle.substring(1);
    const uRes = await db.execute({
      sql: 'SELECT id, username FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1',
      args: [cleanHandle, cleanHandle],
    });
    if (uRes.rows.length > 0) {
      resolvedAssigneeId = String(uRes.rows[0].id);
      resolvedAssigneeUsername = String(uRes.rows[0].username || cleanHandle);
    } else {
      if (['keval', 'alex', 'sarah'].includes(cleanHandle.toLowerCase())) {
        const demoId = `user_${cleanHandle.toLowerCase()}_demo`;
        const demoEmail = `${cleanHandle.toLowerCase()}@luphonix.local`;
        const demoName = cleanHandle.charAt(0).toUpperCase() + cleanHandle.slice(1);
        const demoNow = new Date().toISOString();
        try {
          await db.execute({
            sql: `INSERT OR IGNORE INTO users (id, name, username, email, password_hash, timezone, created_at)
                  VALUES (?, ?, ?, ?, 'demo-hashed-pw', 'UTC', ?)`,
            args: [demoId, demoName, cleanHandle.toLowerCase(), demoEmail, demoNow],
          });
        } catch {}
        resolvedAssigneeId = demoId;
        resolvedAssigneeUsername = cleanHandle.toLowerCase();
      }
    }
  } else if (resolvedAssigneeId) {
    const uRes = await db.execute({
      sql: 'SELECT username FROM users WHERE id = ? LIMIT 1',
      args: [resolvedAssigneeId],
    });
    if (uRes.rows.length > 0) {
      resolvedAssigneeUsername = String(uRes.rows[0].username);
    }
  }

  const assignedByUserId = userId;

  // Insert or Replace (idempotent for offline sync)
  await db.execute({
    sql: `INSERT INTO tasks (
      id, user_id, title, description, due_at, priority, category,
      is_completed, recurrence_rule, assigned_to_user_id, assigned_by_user_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      due_at = excluded.due_at,
      priority = excluded.priority,
      category = excluded.category,
      is_completed = excluded.is_completed,
      recurrence_rule = excluded.recurrence_rule,
      assigned_to_user_id = excluded.assigned_to_user_id,
      assigned_by_user_id = excluded.assigned_by_user_id,
      updated_at = excluded.updated_at
    WHERE tasks.user_id = excluded.user_id OR tasks.assigned_to_user_id = ? OR tasks.user_id = 'user_siri_default' OR excluded.user_id = 'user_siri_default'`,
    args: [
      id,
      userId,
      title,
      description,
      due_at,
      priority,
      category,
      is_completed ? 1 : 0,
      recurrence_rule,
      resolvedAssigneeId,
      assignedByUserId,
      now,
      now,
      userId,
    ],
  });

  // Notify assigned user if task assigned to someone else
  if (resolvedAssigneeId && resolvedAssigneeId !== assignedByUserId) {
    try {
      await notificationService.notifyTaskAssignment({
        id,
        title,
        assigned_to_user_id: resolvedAssigneeId,
        assigned_by_user_id: assignedByUserId,
      });
    } catch (err) {
      console.error('Task assignment notification failed:', err);
    }
  }

  return c.json(
    {
      success: true,
      data: {
        id,
        user_id: userId,
        title,
        description,
        due_at,
        priority,
        category,
        is_completed,
        recurrence_rule,
        assigned_to_user_id: resolvedAssigneeId,
        assigned_by_user_id: assignedByUserId,
        assigned_to_username: resolvedAssigneeUsername,
        assignee_username: resolvedAssigneeUsername,
        created_at: now,
        updated_at: now,
      },
    },
    201
  );
});

// GET /api/tasks/:id
tasksApp.get('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const result = await db.execute({
    sql: `SELECT t.*,
                 u_by.name AS assigner_name,
                 u_by.username AS assigner_username,
                 u_to.name AS assignee_name,
                 u_to.username AS assignee_username
          FROM tasks t
          LEFT JOIN users u_by ON t.assigned_by_user_id = u_by.id
          LEFT JOIN users u_to ON t.assigned_to_user_id = u_to.id
          WHERE t.id = ? AND (t.user_id = ? OR t.assigned_to_user_id = ? OR t.user_id = 'user_siri_default')`,
    args: [id, userId, userId],
  });

  if (result.rows.length === 0) {
    return c.json({ success: false, error: 'Task not found' }, 404);
  }

  const task = {
    ...result.rows[0],
    is_completed: Boolean(result.rows[0].is_completed),
  };

  return c.json({ success: true, data: task });
});

// PATCH /api/tasks/:id
tasksApp.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  let body: any = {};
  try {
    body = await c.req.json();
  } catch {
    try {
      body = await c.req.parseBody();
    } catch {
      body = {};
    }
  }

  // Fallback to query params if body was empty or not parseable
  if (!body || Object.keys(body).length === 0) {
    body = {};
    if (c.req.query('is_completed') !== undefined) {
      body.is_completed = c.req.query('is_completed') === 'true' || c.req.query('is_completed') === '1';
    }
    if (c.req.query('title')) {
      body.title = c.req.query('title');
    }
    if (c.req.query('priority')) {
      body.priority = c.req.query('priority');
    }
    if (c.req.query('category')) {
      body.category = c.req.query('category');
    }
  }

  const updateSchema = taskInputSchema.partial();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation failed', details: parsed.error.errors }, 400);
  }

  // Creator OR assigned user can edit/complete
  const existing = await db.execute({
    sql: 'SELECT * FROM tasks WHERE id = ? AND (user_id = ? OR assigned_to_user_id = ? OR user_id = \'user_siri_default\')',
    args: [id, userId, userId],
  });

  if (existing.rows.length === 0) {
    return c.json({ success: false, error: 'Task not found' }, 404);
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
  if (updates.due_at !== undefined) {
    fields.push('due_at = ?');
    args.push(updates.due_at);
  }
  if (updates.priority !== undefined) {
    fields.push('priority = ?');
    args.push(updates.priority);
  }
  if (updates.category !== undefined) {
    fields.push('category = ?');
    args.push(updates.category);
  }
  if (updates.is_completed !== undefined) {
    fields.push('is_completed = ?');
    args.push(updates.is_completed ? 1 : 0);
  }
  if (updates.recurrence_rule !== undefined) {
    fields.push('recurrence_rule = ?');
    args.push(updates.recurrence_rule);
  }
  if (updates.assigned_to_user_id !== undefined) {
    fields.push('assigned_to_user_id = ?');
    args.push(updates.assigned_to_user_id);
  } else if (updates.assigned_to_username !== undefined) {
    let cleanHandle = updates.assigned_to_username?.trim() || '';
    if (cleanHandle.startsWith('@')) cleanHandle = cleanHandle.substring(1);
    if (cleanHandle) {
      const uRes = await db.execute({
        sql: 'SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1',
        args: [cleanHandle, cleanHandle],
      });
      fields.push('assigned_to_user_id = ?');
      args.push(uRes.rows[0] ? String(uRes.rows[0].id) : null);
    } else {
      fields.push('assigned_to_user_id = NULL');
    }
  }

  args.push(id, userId, userId);

  await db.execute({
    sql: `UPDATE tasks SET ${fields.join(', ')} WHERE id = ? AND (user_id = ? OR assigned_to_user_id = ? OR user_id = 'user_siri_default')`,
    args,
  });

  const updatedResult = await db.execute({
    sql: `SELECT t.*,
                 u_by.name AS assigner_name,
                 u_by.username AS assigner_username,
                 u_to.name AS assignee_name,
                 u_to.username AS assignee_username
          FROM tasks t
          LEFT JOIN users u_by ON t.assigned_by_user_id = u_by.id
          LEFT JOIN users u_to ON t.assigned_to_user_id = u_to.id
          WHERE t.id = ?`,
    args: [id],
  });

  const updatedTask = updatedResult.rows[0];
  const oldAssignee = existing.rows[0]?.assigned_to_user_id;
  const newAssignee = updatedTask?.assigned_to_user_id;
  if (newAssignee && newAssignee !== oldAssignee && newAssignee !== userId) {
    try {
      await notificationService.notifyTaskAssignment({
        id,
        title: String(updatedTask.title),
        assigned_to_user_id: String(newAssignee),
        assigned_by_user_id: userId,
      });
    } catch (err) {
      console.error('Task reassignment notification failed:', err);
    }
  }

  return c.json({
    success: true,
    data: {
      ...updatedResult.rows[0],
      is_completed: Boolean(updatedResult.rows[0].is_completed),
    },
  });
});

// DELETE /api/tasks (Delete all tasks for logged in user)
tasksApp.delete('/', async (c) => {
  const userId = c.get('userId');
  const result = await db.execute({
    sql: 'DELETE FROM tasks WHERE user_id = ? OR user_id = \'user_siri_default\'',
    args: [userId],
  });

  return c.json({
    success: true,
    message: `All tasks deleted (${result.rowsAffected} removed)`,
    deletedCount: result.rowsAffected,
  });
});

// DELETE /api/tasks/:id
tasksApp.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const result = await db.execute({
    sql: 'DELETE FROM tasks WHERE id = ? AND (user_id = ? OR assigned_to_user_id = ? OR user_id = \'user_siri_default\')',
    args: [id, userId, userId],
  });

  if (result.rowsAffected === 0) {
    return c.json({ success: false, error: 'Task not found' }, 404);
  }

  return c.json({ success: true, message: 'Task deleted successfully', id });
});

export default tasksApp;
