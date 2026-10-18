import { Hono } from 'hono';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';
import { AppEnv } from '../types/index.js';

const friendsApp = new Hono<AppEnv>();
friendsApp.use('*', authMiddleware);

const addFriendSchema = z.object({
  username: z.string().min(1, 'Username or unique name is required'),
});

// GET /api/friends - List all connected friends
friendsApp.get('/', async (c) => {
  const userId = c.get('userId');

  try {
    const result = await db.execute({
      sql: `SELECT f.id AS friendship_id, f.created_at AS connected_at,
                   u.id AS friend_id, u.name, u.username, u.email
            FROM friends f
            JOIN users u ON f.friend_id = u.id
            WHERE f.user_id = ? AND f.status = 'accepted'
            ORDER BY u.name ASC`,
      args: [userId],
    });

    const friends = result.rows.map((row) => ({
      friendship_id: row.friendship_id,
      id: row.friend_id,
      name: row.name,
      username: row.username || String(row.email).split('@')[0],
      email: row.email,
      connected_at: row.connected_at,
    }));

    return c.json({
      success: true,
      count: friends.length,
      data: friends,
      friends,
    });
  } catch (err: any) {
    console.error('Error fetching friends:', err);
    return c.json({ success: false, error: 'Failed to fetch friends' }, 500);
  }
});

// POST /api/friends/add - Connect with a user by unique name/handle
friendsApp.post('/add', async (c) => {
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

  const parsed = addFriendSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Please provide a valid unique username' }, 400);
  }

  let targetHandle = parsed.data.username.trim();
  if (targetHandle.startsWith('@')) {
    targetHandle = targetHandle.substring(1).trim();
  }

  try {
    // 1. Find user by unique username or email
    const findResult = await db.execute({
      sql: `SELECT id, name, username, email FROM users
            WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)
            LIMIT 1`,
      args: [targetHandle, targetHandle],
    });

    let friendUser: any = findResult.rows[0];

    // Auto-create sample friend if testing with demo handles (@alex or @keval)
    if (!friendUser && (targetHandle.toLowerCase() === 'alex' || targetHandle.toLowerCase() === 'keval' || targetHandle.toLowerCase() === 'sarah')) {
      const demoId = `user_${targetHandle.toLowerCase()}_demo`;
      const demoEmail = `${targetHandle.toLowerCase()}@luphonix.local`;
      const demoName = targetHandle.charAt(0).toUpperCase() + targetHandle.slice(1);
      const now = new Date().toISOString();

      try {
        await db.execute({
          sql: `INSERT OR IGNORE INTO users (id, name, username, email, password_hash, timezone, created_at)
                VALUES (?, ?, ?, ?, 'demo-hashed-pw', 'UTC', ?)`,
          args: [demoId, demoName, targetHandle.toLowerCase(), demoEmail, now],
        });
        friendUser = { id: demoId, name: demoName, username: targetHandle.toLowerCase(), email: demoEmail };
      } catch {}
    }

    if (!friendUser) {
      return c.json({
        success: false,
        error: `User "@${targetHandle}" not found. Verify the unique username and try again.`,
      }, 404);
    }

    const friendId = String(friendUser.id);
    const friendUsername = String(friendUser.username || targetHandle);

    if (friendId === userId) {
      return c.json({ success: false, error: 'You cannot add yourself as a friend.' }, 400);
    }

    const now = new Date().toISOString();

    // 2. Insert mutual friendship so both users can assign tasks to each other immediately
    await db.batch([
      {
        sql: `INSERT OR IGNORE INTO friends (id, user_id, friend_id, status, created_at)
              VALUES (?, ?, ?, 'accepted', ?)`,
        args: [randomUUID(), userId, friendId, now],
      },
      {
        sql: `INSERT OR IGNORE INTO friends (id, user_id, friend_id, status, created_at)
              VALUES (?, ?, ?, 'accepted', ?)`,
        args: [randomUUID(), friendId, userId, now],
      },
    ]);

    const friendData = {
      id: friendId,
      name: friendUser.name,
      username: friendUsername,
      email: friendUser.email,
    };

    return c.json({
      success: true,
      message: `Successfully connected with @${friendUsername}! You can now assign tasks to each other.`,
      data: friendData,
      friend: friendData,
    }, 201);
  } catch (err: any) {
    console.error('Error adding friend:', err);
    return c.json({ success: false, error: 'Failed to connect with friend.' }, 500);
  }
});

// DELETE /api/friends/:friendId - Remove friendship
friendsApp.delete('/:friendId', async (c) => {
  const userId = c.get('userId');
  const friendId = c.req.param('friendId');

  try {
    await db.execute({
      sql: `DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
      args: [userId, friendId, friendId, userId],
    });

    return c.json({ success: true, message: 'Friend removed successfully.' });
  } catch (err: any) {
    console.error('Error removing friend:', err);
    return c.json({ success: false, error: 'Failed to remove friend.' }, 500);
  }
});

// GET /api/friends/search?q=... - Search registered users by handle or name
friendsApp.get('/search', async (c) => {
  const userId = c.get('userId');
  const query = c.req.query('q')?.trim() || '';

  if (!query) {
    return c.json({ success: true, users: [] });
  }

  const cleanQuery = query.startsWith('@') ? query.substring(1) : query;
  const term = `%${cleanQuery.toLowerCase()}%`;

  try {
    const result = await db.execute({
      sql: `SELECT id, name, username, email FROM users
            WHERE id != ? AND (LOWER(username) LIKE ? OR LOWER(name) LIKE ?)
            LIMIT 10`,
      args: [userId, term, term],
    });

    const users = result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      username: r.username || String(r.email).split('@')[0],
      email: r.email,
    }));

    return c.json({ success: true, users });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to search users.' }, 500);
  }
});

export default friendsApp;
