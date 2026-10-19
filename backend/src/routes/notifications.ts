import { Hono } from 'hono';
import { z } from 'zod';
import { notificationService } from '../services/notificationService.js';
import { authMiddleware } from '../middleware/auth.js';
import { AppEnv } from '../types/index.js';

const notificationsApp = new Hono<AppEnv>();

// GET /api/notifications/vapid-public-key - Public endpoint to retrieve VAPID key for Web Push
notificationsApp.get('/vapid-public-key', (c) => {
  return c.json({
    success: true,
    publicKey: notificationService.getVapidPublicKey(),
  });
});

// Protect all subsequent notification operations with auth
notificationsApp.use('*', authMiddleware);

const subscribeSchema = z.object({
  endpoint: z.string().url('Invalid push endpoint URL'),
  keys: z.object({
    p256dh: z.string().min(1, 'p256dh key required'),
    auth: z.string().min(1, 'auth secret required'),
  }),
  deviceType: z.string().optional(),
  apnsToken: z.string().optional(),
});

// POST /api/notifications/subscribe - Register phone push subscription
notificationsApp.post('/subscribe', async (c) => {
  const userId = c.get('userId');
  let body: any = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON payload' }, 400);
  }

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation failed', details: parsed.error.errors }, 400);
  }

  const userAgent = c.req.header('user-agent') || '';
  const success = await notificationService.subscribe(userId, {
    ...parsed.data,
    userAgent,
  });

  return c.json({
    success,
    message: success ? 'Push notifications registered for your phone!' : 'Failed to register push subscription',
  });
});

// DELETE /api/notifications/subscribe - Unsubscribe device
notificationsApp.delete('/subscribe', async (c) => {
  const endpoint = c.req.query('endpoint');
  if (!endpoint) {
    return c.json({ success: false, error: 'Endpoint required' }, 400);
  }
  const success = await notificationService.unsubscribe(endpoint);
  return c.json({ success });
});

// GET /api/notifications - Get in-app notifications & unread count
notificationsApp.get('/', async (c) => {
  const userId = c.get('userId');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const result = await notificationService.getUserNotifications(userId, limit);

  return c.json({
    success: true,
    unreadCount: result.unreadCount,
    count: result.notifications.length,
    data: result.notifications,
    notifications: result.notifications,
  });
});

// POST /api/notifications/mark-read - Mark notification(s) as read
notificationsApp.post('/mark-read', async (c) => {
  const userId = c.get('userId');
  let body: any = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const ids: string[] | undefined = Array.isArray(body?.ids) ? body.ids : undefined;
  const success = await notificationService.markAsRead(userId, ids);

  return c.json({
    success,
    message: 'Notifications updated.',
  });
});

// DELETE /api/notifications - Clear all notifications
notificationsApp.delete('/', async (c) => {
  const userId = c.get('userId');
  const success = await notificationService.clearAll(userId);
  return c.json({
    success,
    message: 'Notifications cleared.',
  });
});

// POST /api/notifications/test - Trigger an immediate test notification to phone
notificationsApp.post('/test', async (c) => {
  const userId = c.get('userId');
  const res = await notificationService.sendNotification(
    userId,
    {
      title: '🔔 Luphonix Phone Notification',
      body: 'Your phone notification system is active! You will be alerted when someone assigns you a task.',
      url: '/?view=tasks',
      tag: 'test-notification',
    },
    {
      type: 'test_notification',
    }
  );

  return c.json({
    success: true,
    message: `Test alert created (Delivered to ${res.pushSentCount} registered phone/device push endpoint${res.pushSentCount === 1 ? '' : 's'}).`,
    pushSentCount: res.pushSentCount,
    inAppId: res.inAppId,
  });
});

export default notificationsApp;
