import webpush from 'web-push';
import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import { config } from '../config.js';

// Configure Web Push with persistent VAPID credentials
try {
  webpush.setVapidDetails(
    config.VAPID_SUBJECT,
    config.VAPID_PUBLIC_KEY,
    config.VAPID_PRIVATE_KEY
  );
  console.log('✅ Web Push initialized with VAPID credentials.');
} catch (err) {
  console.warn('⚠️ Web Push initialization warning:', err);
}

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface ClientPushSubscription {
  endpoint: string;
  keys: PushSubscriptionKeys;
  userAgent?: string;
  deviceType?: string;
  apnsToken?: string;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  data?: Record<string, any>;
}

export class NotificationService {
  public getVapidPublicKey(): string {
    return config.VAPID_PUBLIC_KEY;
  }

  // Save or update a device's push subscription
  public async subscribe(userId: string, sub: ClientPushSubscription): Promise<boolean> {
    if (!userId || !sub || !sub.endpoint) return false;

    const id = randomUUID();
    const now = new Date().toISOString();
    const p256dh = sub.keys?.p256dh || '';
    const auth = sub.keys?.auth || '';
    const deviceType = sub.deviceType || (sub.userAgent?.toLowerCase().includes('iphone') ? 'ios-pwa' : 'web-pwa');
    const userAgent = sub.userAgent || '';
    const apnsToken = sub.apnsToken || null;

    try {
      await db.execute({
        sql: `INSERT INTO push_subscriptions (
                id, user_id, endpoint, p256dh, auth, apns_token, device_type, user_agent, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(endpoint) DO UPDATE SET
                user_id = excluded.user_id,
                p256dh = excluded.p256dh,
                auth = excluded.auth,
                apns_token = excluded.apns_token,
                device_type = excluded.device_type,
                user_agent = excluded.user_agent,
                updated_at = excluded.updated_at`,
        args: [id, userId, sub.endpoint, p256dh, auth, apnsToken, deviceType, userAgent, now, now],
      });
      return true;
    } catch (err) {
      console.error('Failed to save push subscription:', err);
      return false;
    }
  }

  // Unsubscribe an endpoint
  public async unsubscribe(endpoint: string): Promise<boolean> {
    if (!endpoint) return false;
    try {
      await db.execute({
        sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?',
        args: [endpoint],
      });
      return true;
    } catch {
      return false;
    }
  }

  // Store in-app notification & send system push notification
  public async sendNotification(
    userId: string,
    payload: PushPayload,
    options?: { actorId?: string; type?: string; taskId?: string }
  ): Promise<{ inAppId: string; pushSentCount: number }> {
    const inAppId = randomUUID();
    const now = new Date().toISOString();
    const notifType = options?.type || 'task_assigned';
    const actorId = options?.actorId || null;
    const notificationData = JSON.stringify({
      ...payload.data,
      url: payload.url || '/?view=tasks',
      taskId: options?.taskId,
    });

    // 1. Persist notification to database for in-app bell & history
    try {
      await db.execute({
        sql: `INSERT INTO notifications (
                id, user_id, actor_id, type, title, body, data, is_read, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        args: [inAppId, userId, actorId, notifType, payload.title, payload.body, notificationData, now],
      });
    } catch (err) {
      console.error('Failed to save in-app notification to DB:', err);
    }

    // 2. Fetch all registered device subscriptions for this user
    let subscriptions: any[] = [];
    try {
      const res = await db.execute({
        sql: 'SELECT endpoint, p256dh, auth, device_type FROM push_subscriptions WHERE user_id = ?',
        args: [userId],
      });
      subscriptions = res.rows;
    } catch (err) {
      console.error('Failed to retrieve push subscriptions:', err);
    }

    let pushSentCount = 0;
    const pushData = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/apple-touch-icon.png',
      badge: payload.badge || '/icons/icon-192.png',
      tag: payload.tag || `synvy-${notifType}-${Date.now()}`,
      data: {
        url: payload.url || '/?view=tasks',
        notificationId: inAppId,
        taskId: options?.taskId,
      },
    });

    // 3. Dispatch Web Push to user's phone / devices (Screen off or on)
    const deadEndpoints: string[] = [];
    for (const sub of subscriptions) {
      if (!sub.endpoint || !sub.p256dh || !sub.auth) continue;

      const pushSub = {
        endpoint: String(sub.endpoint),
        keys: {
          p256dh: String(sub.p256dh),
          auth: String(sub.auth),
        },
      };

      try {
        await Promise.race([
          webpush.sendNotification(pushSub, pushData, {
            TTL: 86400, // 24 hours delivery guarantee
            urgency: 'high',
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Push dispatch timeout')), 2500))
        ]);
        pushSentCount++;
      } catch (err: any) {
        // HTTP 404 or 410 means the subscription has expired or user removed the app
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          deadEndpoints.push(String(sub.endpoint));
        } else {
          console.warn(`Push dispatch failed for endpoint [${sub.endpoint.slice(0, 30)}...]:`, err?.message || err);
        }
      }
    }

    // Clean up expired device subscriptions
    if (deadEndpoints.length > 0) {
      for (const endpoint of deadEndpoints) {
        try {
          await db.execute({
            sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?',
            args: [endpoint],
          });
        } catch {}
      }
    }

    return { inAppId, pushSentCount };
  }

  // Triggered when a user is assigned a task by another user
  public async notifyTaskAssignment(task: {
    id: string;
    title: string;
    assigned_to_user_id: string;
    assigned_by_user_id?: string | null;
  }): Promise<boolean> {
    const assigneeId = task.assigned_to_user_id;
    const assignerId = task.assigned_by_user_id;

    // Do not notify if assigned to nobody or assigned to self
    if (!assigneeId || assigneeId === assignerId) {
      return false;
    }

    // Look up assigner name
    let assignerName = 'A teammate';
    let assignerUsername = '';
    if (assignerId) {
      try {
        const uRes = await db.execute({
          sql: 'SELECT name, username, email FROM users WHERE id = ? LIMIT 1',
          args: [assignerId],
        });
        if (uRes.rows.length > 0) {
          const row = uRes.rows[0];
          assignerName = String(row.name || row.username || 'A teammate');
          assignerUsername = String(row.username || '');
        }
      } catch (e) {
        console.warn('Error fetching assigner info:', e);
      }
    }

    const title = '📋 New Task Assigned';
    const body = assignerUsername
      ? `@${assignerUsername} assigned you: "${task.title}"`
      : `${assignerName} assigned you: "${task.title}"`;

    await this.sendNotification(
      assigneeId,
      {
        title,
        body,
        icon: '/icons/apple-touch-icon.png',
        badge: '/icons/icon-192.png',
        tag: `task-assign-${task.id}`,
        url: `/?view=tasks&taskId=${encodeURIComponent(task.id)}`,
        data: {
          taskId: task.id,
          taskTitle: task.title,
          assignerName,
          assignerUsername,
          assignedAt: new Date().toISOString(),
        },
      },
      {
        actorId: assignerId || undefined,
        type: 'task_assigned',
        taskId: task.id,
      }
    );

    return true;
  }

  // Fetch in-app notifications
  public async getUserNotifications(userId: string, limit: number = 50) {
    try {
      const res = await db.execute({
        sql: `SELECT n.*,
                     u.name AS actor_name,
                     u.username AS actor_username
              FROM notifications n
              LEFT JOIN users u ON n.actor_id = u.id
              WHERE n.user_id = ?
              ORDER BY n.created_at DESC
              LIMIT ?`,
        args: [userId, limit],
      });

      const countRes = await db.execute({
        sql: 'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = 0',
        args: [userId],
      });

      const unreadCount = Number(countRes.rows[0]?.unread_count || 0);

      const notifications = res.rows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        actor_id: row.actor_id,
        actor_name: row.actor_name,
        actor_username: row.actor_username,
        type: row.type,
        title: row.title,
        body: row.body,
        data: row.data ? JSON.parse(String(row.data)) : null,
        is_read: Boolean(row.is_read),
        created_at: row.created_at,
      }));

      return {
        notifications,
        unreadCount,
      };
    } catch (err: any) {
      console.error('Error fetching user notifications:', err);
      return { notifications: [], unreadCount: 0 };
    }
  }

  // Mark notifications as read
  public async markAsRead(userId: string, ids?: string[]): Promise<boolean> {
    try {
      if (ids && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        await db.execute({
          sql: `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN (${placeholders})`,
          args: [userId, ...ids],
        });
      } else {
        await db.execute({
          sql: 'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
          args: [userId],
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  // Clear all notifications
  public async clearAll(userId: string): Promise<boolean> {
    try {
      await db.execute({
        sql: 'DELETE FROM notifications WHERE user_id = ?',
        args: [userId],
      });
      return true;
    } catch {
      return false;
    }
  }
}

export const notificationService = new NotificationService();
