import { Hono } from 'hono';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';
import { AppEnv } from '../types/index.js';

const hydrationApp = new Hono<AppEnv>();
hydrationApp.use('*', authMiddleware);

const logSchema = z.object({
  id: z.string().uuid().optional(),
  amount_ml: z.number().int().positive('Amount must be greater than 0').max(5000),
  logged_at: z.string().datetime().optional(),
});

// GET /api/hydration/today (Summary for today)
hydrationApp.get('/today', async (c) => {
  const userId = c.get('userId');

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Fetch preferences for daily goal
  const prefResult = await db.execute({
    sql: 'SELECT daily_water_goal_ml FROM user_preferences WHERE user_id = ?',
    args: [userId],
  });
  const dailyGoal = Number(prefResult.rows[0]?.daily_water_goal_ml || 2000);

  // Fetch logs for today
  const logsResult = await db.execute({
    sql: 'SELECT * FROM hydration_logs WHERE user_id = ? AND logged_at >= ? AND logged_at <= ? ORDER BY logged_at DESC',
    args: [userId, todayStart.toISOString(), todayEnd.toISOString()],
  });

  const totalDrunk = logsResult.rows.reduce(
    (sum, row) => sum + Number(row.amount_ml),
    0
  );
  const remaining = Math.max(0, dailyGoal - totalDrunk);
  const progressPercentage = Math.min(100, Math.round((totalDrunk / dailyGoal) * 100));

  const msg = `You have drunk ${totalDrunk} ml of water today, which is ${progressPercentage}% of your ${dailyGoal} ml goal (${remaining} ml remaining).`;
  const format = c.req.query('format')?.toLowerCase();
  const accept = c.req.header('accept')?.toLowerCase() || '';
  const userAgent = c.req.header('user-agent')?.toLowerCase() || '';

  const isExplicitJson = format === 'json' || accept.includes('application/json');
  const isExplicitText = format === 'text' || c.req.query('text') === '1' || accept.includes('text/plain');
  const isShortcut = userAgent.includes('shortcut') || userAgent.includes('cfnetwork') || userAgent.includes('darwin');

  if (isExplicitText || (!isExplicitJson && isShortcut)) {
    return c.text(msg);
  }

  return c.json({
    success: true,
    message: msg,
    speech: msg,
    summary: msg,
    data: {
      daily_goal_ml: dailyGoal,
      total_ml: totalDrunk,
      remaining_ml: remaining,
      percentage: progressPercentage,
      logs_count: logsResult.rows.length,
      logs: logsResult.rows,
    },
  });
});

// GET /api/hydration/history (Last 7 days daily totals)
hydrationApp.get('/history', async (c) => {
  const userId = c.get('userId');

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const logsResult = await db.execute({
    sql: 'SELECT amount_ml, logged_at FROM hydration_logs WHERE user_id = ? AND logged_at >= ? ORDER BY logged_at ASC',
    args: [userId, sevenDaysAgo.toISOString()],
  });

  // Group by YYYY-MM-DD
  const daysMap: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split('T')[0];
    daysMap[key] = 0;
  }

  for (const row of logsResult.rows) {
    const dateStr = (row.logged_at as string).split('T')[0];
    if (daysMap[dateStr] !== undefined) {
      daysMap[dateStr] += Number(row.amount_ml);
    }
  }

  const history = Object.entries(daysMap).map(([date, total_ml]) => ({
    date,
    total_ml,
  }));

  return c.json({
    success: true,
    data: history,
  });
});

// Helper for logging water
async function handleWaterLog(c: any) {
  const userId = c.get('userId');

  let amount_ml = 250;
  let customId: string | undefined;
  let logged_at = new Date().toISOString();

  // Try parsing JSON body if present
  try {
    const body = await c.req.json();
    if (body) {
      if (typeof body.amount_ml === 'number') amount_ml = body.amount_ml;
      else if (typeof body.amount === 'number') amount_ml = body.amount;
      if (body.id) customId = body.id;
      if (body.logged_at) logged_at = body.logged_at;
    }
  } catch {
    // No body or invalid json; fallback to query params
  }

  // Check query params if body didn't specify amount
  const qAmt = c.req.query('amount') || c.req.query('amount_ml');
  if (qAmt) {
    const parsed = parseInt(qAmt, 10);
    if (!isNaN(parsed) && parsed > 0) amount_ml = parsed;
  }

  const id = customId || randomUUID();

  await db.execute({
    sql: 'INSERT INTO hydration_logs (id, user_id, amount_ml, logged_at) VALUES (?, ?, ?, ?)',
    args: [id, userId, amount_ml, logged_at],
  });

  // Recalculate today's summary
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [sumRes, prefRes] = await Promise.all([
    db.execute({
      sql: 'SELECT COALESCE(SUM(amount_ml), 0) as total FROM hydration_logs WHERE user_id = ? AND logged_at >= ? AND logged_at <= ?',
      args: [userId, todayStart.toISOString(), todayEnd.toISOString()],
    }),
    db.execute({
      sql: 'SELECT daily_water_goal_ml FROM user_preferences WHERE user_id = ?',
      args: [userId],
    }),
  ]);

  const totalDrunk = Number(sumRes.rows[0]?.total || 0);
  const dailyGoal = Number(prefRes.rows[0]?.daily_water_goal_ml || 2000);
  const remaining = Math.max(0, dailyGoal - totalDrunk);
  const msg = `Logged ${amount_ml} ml in Synvy. Total today: ${totalDrunk} ml of ${dailyGoal} ml goal.`;

  const format = c.req.query('format')?.toLowerCase();
  const accept = c.req.header('accept')?.toLowerCase() || '';
  const userAgent = c.req.header('user-agent')?.toLowerCase() || '';
  const hasQueryAuth = Boolean(c.req.query('apiKey') || c.req.query('token') || c.req.query('key'));

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
      summary: msg,
      data: {
        id,
        user_id: userId,
        amount_ml,
        logged_at,
        today_total_ml: totalDrunk,
        daily_goal_ml: dailyGoal,
        remaining_ml: remaining,
      },
    },
    201
  );
}

// POST /api/hydration (Log water intake)
hydrationApp.post('/', handleWaterLog);
hydrationApp.post('/log', handleWaterLog);

// GET & POST /api/hydration and /api/hydration/log (Allows simple URL triggers from Siri without setting POST body)
hydrationApp.get('/', handleWaterLog);
hydrationApp.get('/log', handleWaterLog);


// DELETE /api/hydration/:id
hydrationApp.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const result = await db.execute({
    sql: 'DELETE FROM hydration_logs WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });

  if (result.rowsAffected === 0) {
    return c.json({ success: false, error: 'Log entry not found' }, 404);
  }

  return c.json({ success: true, message: 'Hydration log deleted', id });
});

export default hydrationApp;
