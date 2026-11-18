import { Hono } from 'hono';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';
import { AppEnv } from '../types/index.js';

const notesApp = new Hono<AppEnv>();
notesApp.use('*', authMiddleware);

const noteInputSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1, 'Title is required').max(300),
  content: z.string().default(''),
  category: z.string().default('Personal'),
  tags: z.union([z.array(z.string()), z.string()]).default([]),
  is_pinned: z.boolean().default(false),
  color: z.string().nullable().optional(),
});

function formatTags(tags: string[] | string): string {
  if (Array.isArray(tags)) {
    return JSON.stringify(tags);
  }
  if (typeof tags === 'string') {
    if (tags.startsWith('[')) return tags;
    const split = tags.split(',').map((t) => t.trim()).filter(Boolean);
    return JSON.stringify(split);
  }
  return '[]';
}

function parseNoteRow(row: any) {
  let tags: string[] = [];
  try {
    tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []);
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    content: row.content || '',
    category: row.category || 'Personal',
    tags,
    is_pinned: Boolean(row.is_pinned),
    color: row.color || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// GET /api/notes - List notes with filtering & search
notesApp.get('/', async (c) => {
  const userId = c.get('userId');
  const category = c.req.query('category')?.toLowerCase();
  const search = c.req.query('q')?.toLowerCase();
  const pinnedOnly = c.req.query('pinned') === 'true';

  let sql = `SELECT * FROM notes WHERE (user_id = ? OR user_id = 'user_siri_default')`;
  const args: any[] = [userId];

  if (pinnedOnly || category === 'pinned') {
    sql += ' AND is_pinned = 1';
  } else if (category && category !== 'all') {
    sql += ' AND LOWER(category) = ?';
    args.push(category);
  }

  if (search) {
    sql += ' AND (LOWER(title) LIKE ? OR LOWER(content) LIKE ? OR LOWER(tags) LIKE ?)';
    const term = `%${search}%`;
    args.push(term, term, term);
  }

  sql += ' ORDER BY is_pinned DESC, updated_at DESC';

  const result = await db.execute({ sql, args });
  const notes = (result.rows || []).map(parseNoteRow);

  return c.json({
    success: true,
    data: notes,
    count: notes.length,
  });
});

// POST /api/notes - Create a new note
notesApp.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = noteInputSchema.parse(body);

  const id = parsed.id || `note_${randomUUID()}`;
  const now = new Date().toISOString();
  const tagsJson = formatTags(parsed.tags);
  const isPinned = parsed.is_pinned ? 1 : 0;

  await db.execute({
    sql: `
      INSERT INTO notes (id, user_id, title, content, category, tags, is_pinned, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      userId,
      parsed.title.trim(),
      parsed.content || '',
      parsed.category || 'Personal',
      tagsJson,
      isPinned,
      parsed.color || null,
      now,
      now,
    ],
  });

  const created = parseNoteRow({
    id,
    user_id: userId,
    title: parsed.title.trim(),
    content: parsed.content || '',
    category: parsed.category || 'Personal',
    tags: tagsJson,
    is_pinned: isPinned,
    color: parsed.color || null,
    created_at: now,
    updated_at: now,
  });

  return c.json(
    {
      success: true,
      message: 'Note created successfully',
      data: created,
    },
    201
  );
});

// GET /api/notes/:id - Get a single note
notesApp.get('/:id', async (c) => {
  const userId = c.get('userId');
  const noteId = c.req.param('id');

  const res = await db.execute({
    sql: `SELECT * FROM notes WHERE id = ? AND (user_id = ? OR user_id = 'user_siri_default')`,
    args: [noteId, userId],
  });

  if (!res.rows || res.rows.length === 0) {
    return c.json({ success: false, error: 'Note not found' }, 404);
  }

  return c.json({
    success: true,
    data: parseNoteRow(res.rows[0]),
  });
});

// PUT /api/notes/:id - Update note
notesApp.put('/:id', async (c) => {
  const userId = c.get('userId');
  const noteId = c.req.param('id');
  const body = await c.req.json();

  const existingRes = await db.execute({
    sql: `SELECT * FROM notes WHERE id = ? AND (user_id = ? OR user_id = 'user_siri_default')`,
    args: [noteId, userId],
  });

  if (!existingRes.rows || existingRes.rows.length === 0) {
    return c.json({ success: false, error: 'Note not found' }, 404);
  }

  const existing = existingRes.rows[0];
  const title = body.title !== undefined ? String(body.title).trim() : existing.title;
  const content = body.content !== undefined ? String(body.content) : existing.content;
  const category = body.category !== undefined ? String(body.category) : existing.category;
  const tagsJson = body.tags !== undefined ? formatTags(body.tags) : existing.tags;
  const isPinned = body.is_pinned !== undefined ? (body.is_pinned ? 1 : 0) : existing.is_pinned;
  const color = body.color !== undefined ? body.color : existing.color;
  const now = new Date().toISOString();

  await db.execute({
    sql: `
      UPDATE notes
      SET title = ?, content = ?, category = ?, tags = ?, is_pinned = ?, color = ?, updated_at = ?
      WHERE id = ? AND (user_id = ? OR user_id = 'user_siri_default')
    `,
    args: [title, content, category, tagsJson, isPinned, color, now, noteId, userId],
  });

  return c.json({
    success: true,
    message: 'Note updated successfully',
    data: parseNoteRow({
      id: noteId,
      user_id: existing.user_id,
      title,
      content,
      category,
      tags: tagsJson,
      is_pinned: isPinned,
      color,
      created_at: existing.created_at,
      updated_at: now,
    }),
  });
});

// PATCH /api/notes/:id/pin - Toggle pin
notesApp.patch('/:id/pin', async (c) => {
  const userId = c.get('userId');
  const noteId = c.req.param('id');

  const existingRes = await db.execute({
    sql: `SELECT is_pinned FROM notes WHERE id = ? AND (user_id = ? OR user_id = 'user_siri_default')`,
    args: [noteId, userId],
  });

  if (!existingRes.rows || existingRes.rows.length === 0) {
    return c.json({ success: false, error: 'Note not found' }, 404);
  }

  const currentPinned = Boolean(existingRes.rows[0].is_pinned);
  const newPinned = currentPinned ? 0 : 1;
  const now = new Date().toISOString();

  await db.execute({
    sql: 'UPDATE notes SET is_pinned = ?, updated_at = ? WHERE id = ?',
    args: [newPinned, now, noteId],
  });

  return c.json({
    success: true,
    message: newPinned ? 'Note pinned' : 'Note unpinned',
    is_pinned: Boolean(newPinned),
  });
});

// DELETE /api/notes/:id - Delete note
notesApp.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const noteId = c.req.param('id');

  const res = await db.execute({
    sql: `DELETE FROM notes WHERE id = ? AND (user_id = ? OR user_id = 'user_siri_default')`,
    args: [noteId, userId],
  });

  return c.json({
    success: true,
    message: 'Note deleted successfully',
  });
});

export default notesApp;
