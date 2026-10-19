import test from 'node:test';
import assert from 'node:assert';
import app from '../src/index.js';

test('Luphonix Notification & Task Assignment Alert Test', async (t) => {
  const time = Date.now();

  // 1. Check VAPID public key endpoint
  await t.test('1. GET /api/notifications/vapid-public-key should return valid VAPID key', async () => {
    const res = await app.request('/api/notifications/vapid-public-key');
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.publicKey && data.publicKey.length > 20);
  });

  // 2. Register two test users: User A (Alex) and User B (Dhyey)
  let tokenA = '';
  let userA: any = null;
  let tokenB = '';
  let userB: any = null;

  await t.test('2. Register User A and User B', async () => {
    const resA = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alex Rivera',
        email: `alex_${time}@example.com`,
        username: `alex_${time}`,
        password: 'password123',
      }),
    });
    assert.strictEqual(resA.status, 201);
    const dataA = await resA.json();
    tokenA = dataA.data.token;
    userA = dataA.data.user;

    const resB = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dhyey Patel',
        email: `dhyey_${time}@example.com`,
        username: `dhyey_${time}`,
        password: 'password123',
      }),
    });
    assert.strictEqual(resB.status, 201);
    const dataB = await resB.json();
    tokenB = dataB.data.token;
    userB = dataB.data.user;

    assert.ok(tokenA && tokenB);
  });

  // 3. User B subscribes to push notifications (mock push endpoint)
  await t.test('3. POST /api/notifications/subscribe should register device push endpoint', async () => {
    const res = await app.request('/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        endpoint: `https://web.push.apple.com/mock-endpoint-${time}`,
        keys: {
          p256dh: 'BAFoeAVyMzGkmHkYJAt1H1RggTlNSTeWPOLIN0wauzi39k9-OmGr9Gn8vAFaarGgzokJwdSCwaLPtrbFvFJaMB8',
          auth: 'sZekpXPo8C9pBMS2oUOR1g',
        },
        deviceType: 'iphone-pwa',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
  });

  // 4. User A assigns a task to User B
  await t.test('4. User A creates task and assigns to User B', async () => {
    const res = await app.request('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Prepare Project Roadmap',
        priority: 'high',
        category: 'work',
        assigned_to_user_id: userB.id,
      }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.data.assigned_to_user_id, userB.id);
  });

  // 5. User B checks notifications - should have 1 unread notification from User A
  await t.test('5. User B should receive task assignment notification', async () => {
    const res = await app.request('/api/notifications', {
      headers: {
        'Authorization': `Bearer ${tokenB}`,
      },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.unreadCount, 1);
    assert.strictEqual(data.notifications.length, 1);
    assert.ok(data.notifications[0].body.includes('Prepare Project Roadmap'));
    assert.strictEqual(data.notifications[0].type, 'task_assigned');
  });

  // 6. User B marks notification as read
  await t.test('6. POST /api/notifications/mark-read should clear unread count', async () => {
    const res = await app.request('/api/notifications/mark-read', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenB}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 200);

    const checkRes = await app.request('/api/notifications', {
      headers: {
        'Authorization': `Bearer ${tokenB}`,
      },
    });
    const checkData = await checkRes.json();
    assert.strictEqual(checkData.unreadCount, 0);
  });
});
