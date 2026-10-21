process.env.NODE_ENV = 'test';
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import app from '../src/index.js';
import { runMigrations } from '../src/db/migrate.js';

describe('Luphonix Backend API Test Suite', async () => {
  before(async () => {
    await runMigrations();
  });
  let authToken = '';
  let createdTaskId = '';
  let createdReminderId = '';
  const testEmail = `test_${Date.now()}@luphonix.app`;

  it('1. GET /health should return 200 OK', async () => {
    const res = await app.request('/health');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'healthy');
    assert.strictEqual(body.database, 'Turso (libSQL)');
  });

  it('2. POST /api/auth/register should create user and return JWT', async () => {
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alex Mercer',
        email: testEmail,
        password: 'Password123!',
        timezone: 'America/New_York',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.token);
    assert.strictEqual(body.data.user.email, testEmail);
    authToken = body.data.token;
  });

  it('3. POST /api/auth/login should return valid JWT', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Password123!',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.token);
  });

  it('4. POST /api/tasks should create a new task', async () => {
    const dueTime = new Date(Date.now() + 3600000).toISOString();
    const res = await app.request('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        title: 'Review Luphonix Architecture Specs',
        description: 'Verify App Intents and Turso libSQL schema',
        due_at: dueTime,
        priority: 'high',
        category: 'work',
        is_completed: false,
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.title, 'Review Luphonix Architecture Specs');
    assert.strictEqual(body.data.priority, 'high');
    createdTaskId = body.data.id;
  });

  it('5. GET /api/tasks should list tasks with filtering', async () => {
    const res = await app.request('/api/tasks?filter=today', {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.count >= 1);
  });

  it('6. PATCH /api/tasks/:id should update task status', async () => {
    const res = await app.request(`/api/tasks/${createdTaskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        is_completed: true,
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.is_completed, true);
  });

  it('7. POST /api/reminders should create a recurring reminder', async () => {
    const scheduledTime = new Date(Date.now() + 7200000).toISOString();
    const res = await app.request('/api/reminders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        title: 'Drink 250ml of Water',
        description: 'Hourly hydration check',
        scheduled_at: scheduledTime,
        recurrence_rule: 'daily',
        category: 'health',
        is_enabled: true,
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.title, 'Drink 250ml of Water');
    createdReminderId = body.data.id;
  });

  it('8. POST /api/reminders/:id/snooze should snooze reminder', async () => {
    const res = await app.request(`/api/reminders/${createdReminderId}/snooze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ minutes: 20 }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.scheduled_at);
  });

  it('9. POST /api/hydration should log water intake', async () => {
    const res = await app.request('/api/hydration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        amount_ml: 350,
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.amount_ml, 350);
  });

  it('10. GET /api/hydration/today should calculate progress and goal', async () => {
    const res = await app.request('/api/hydration/today', {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.total_ml, 350);
    assert.strictEqual(body.data.daily_goal_ml, 2000);
    assert.strictEqual(body.data.remaining_ml, 1650);
  });

  it('11. PUT /api/preferences should update user preferences', async () => {
    const res = await app.request('/api/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        daily_water_goal_ml: 2500,
        water_reminder_interval_minutes: 45,
        waking_time: '06:30',
        sleeping_time: '23:00',
        quiet_hours_enabled: true,
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.daily_water_goal_ml, 2500);
    assert.strictEqual(body.data.water_reminder_interval_minutes, 45);
  });

  it('12. GET /api/auth/export should export all user records', async () => {
    const res = await app.request('/api/auth/export', {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.tasks.length >= 1);
    assert.ok(body.data.reminders.length >= 1);
    assert.ok(body.data.hydration_logs.length >= 1);
  });

  it('13. POST /api/sync should perform delta cloud synchronization', async () => {
    const res = await app.request('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        last_synced_at: new Date(Date.now() - 86400000).toISOString(),
        tasks: [],
        reminders: [],
        hydration_logs: [],
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.sync_timestamp);
    assert.ok(body.data.tasks.length >= 1);
    assert.ok(body.data.reminders.length >= 1);
  });

  it('14. GET /api/auth/webhook-key should return valid long-lived API key', async () => {
    const res = await app.request('/api/auth/webhook-key');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.apiKey);
  });

  it('15. GET /api/tasks with apiKey query param should authenticate without headers', async () => {
    const keyRes = await app.request('/api/auth/webhook-key');
    const { apiKey } = await keyRes.json();

    const res = await app.request(`/api/tasks?filter=today&apiKey=${encodeURIComponent(apiKey)}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.summary);
    assert.ok(body.speech);
  });

  it('16. GET /api/hydration with apiKey and amount query param should log water intake', async () => {
    const keyRes = await app.request('/api/auth/webhook-key');
    const { apiKey } = await keyRes.json();

    const res = await app.request(`/api/hydration?amount=250&apiKey=${encodeURIComponent(apiKey)}`);
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.speech.includes('250 ml'));
  });

  it('17. Requests without token or apiKey should return 401 with helpful instructions', async () => {
    const res = await app.request('/api/tasks?filter=today');
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('apiKey'));
  });

  it('18. GET /api/tasks/complete should mark task completed via Siri voice shortcut', async () => {
    const keyRes = await app.request('/api/auth/webhook-key');
    const { apiKey } = await keyRes.json();

    const uniqueTitle = `Study Swift Intents ${Date.now()}`;
    // 1. Create a task for Siri
    const addRes = await app.request(`/api/tasks/add?title=${encodeURIComponent(uniqueTitle)}&apiKey=${encodeURIComponent(apiKey)}`);
    assert.strictEqual(addRes.status, 200);

    // 2. Complete the task using Siri phrase
    const compRes = await app.request(`/api/tasks/complete?title=${encodeURIComponent(uniqueTitle)}&apiKey=${encodeURIComponent(apiKey)}`);
    assert.strictEqual(compRes.status, 200);
    const text = await compRes.text();
    assert.ok(text.includes('Marked'));
    assert.ok(text.includes('completed in Luphonix'));

    // 3. Siri queries remaining today tasks: completed task must NOT appear!
    const siriQueryRes = await app.request(`/api/tasks?filter=today&format=text&apiKey=${encodeURIComponent(apiKey)}`);
    assert.strictEqual(siriQueryRes.status, 200);
    const remainingText = await siriQueryRes.text();
    assert.ok(!remainingText.includes(uniqueTitle), 'Completed task should not appear in Siri today tasks');
  });

  it('19. GET /api/devices should list connected devices and requests feed', async () => {
    const devRes = await app.request('/api/devices');
    assert.strictEqual(devRes.status, 200);
    const devBody = await devRes.json();
    assert.strictEqual(devBody.success, true);
    assert.ok(Array.isArray(devBody.devices));

    const reqRes = await app.request('/api/devices/requests');
    assert.strictEqual(reqRes.status, 200);
    const reqBody = await reqRes.json();
    assert.strictEqual(reqBody.success, true);
    assert.ok(Array.isArray(reqBody.requests));
  });

  it('20. POST /api/friends/add should add friend by unique username and GET /api/friends should list them', async () => {
    // Add friend @keval
    const addFriendRes = await app.request('/api/friends/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ username: 'keval' }),
    });

    assert.strictEqual(addFriendRes.status, 201);
    const addFriendBody = await addFriendRes.json();
    assert.strictEqual(addFriendBody.success, true);
    assert.strictEqual(addFriendBody.data.username, 'keval');
    const friendUserId = addFriendBody.data.id;

    // List friends
    const listFriendsRes = await app.request('/api/friends', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.strictEqual(listFriendsRes.status, 200);
    const listFriendsBody = await listFriendsRes.json();
    assert.strictEqual(listFriendsBody.success, true);
    assert.ok(Array.isArray(listFriendsBody.data));
    const foundKeval = listFriendsBody.data.some((f: any) => f.username === 'keval');
    assert.strictEqual(foundKeval, true, 'Connected friend @keval must appear in friends list');
  });

  it('21. POST /api/tasks should allow assigning tasks to a friend by unique username and query via filter=assigned', async () => {
    const assignedTaskRes = await app.request('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        title: 'Review Siri Collaboration Feature with Keval',
        priority: 'high',
        category: 'work',
        assigned_to_username: 'keval',
      }),
    });

    assert.strictEqual(assignedTaskRes.status, 201);
    const taskBody = await assignedTaskRes.json();
    assert.strictEqual(taskBody.success, true);
    assert.strictEqual(taskBody.data.assigned_to_username, 'keval');
    assert.ok(taskBody.data.assigned_by_user_id);

    // Query assigned tasks
    const queryRes = await app.request('/api/tasks?filter=assigned', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.strictEqual(queryRes.status, 200);
    const queryBody = await queryRes.json();
    assert.strictEqual(queryBody.success, true);
    const foundAssignedTask = queryBody.data.some((t: any) => t.title === 'Review Siri Collaboration Feature with Keval');
    assert.strictEqual(foundAssignedTask, true, 'Task assigned to @keval must be returned with filter=assigned');
  });

  it('22. DELETE /api/friends/:id should unfriend user', async () => {
    // Get list of friends first
    const listRes = await app.request('/api/friends', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const listBody = await listRes.json();
    const kevalFriend = listBody.data.find((f: any) => f.username === 'keval');
    assert.ok(kevalFriend, 'Keval friend should exist before delete');

    // Delete friend
    const delRes = await app.request(`/api/friends/${kevalFriend.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.strictEqual(delRes.status, 200);
    const delBody = await delRes.json();
    assert.strictEqual(delBody.success, true);
  });

  it('23. GET /api/tasks/assign should assign task by number or title to a person via Siri webhook', async () => {
    const keyRes = await app.request('/api/auth/webhook-key');
    const { apiKey } = await keyRes.json();

    const titleToAssign = `Collaborative Siri Task ${Date.now()}`;
    // Create the task first
    const addRes = await app.request(`/api/tasks/add?title=${encodeURIComponent(titleToAssign)}&apiKey=${encodeURIComponent(apiKey)}`);
    assert.strictEqual(addRes.status, 200);

    // Assign the task to Alex by title
    const assignRes = await app.request(`/api/tasks/assign?task=${encodeURIComponent(titleToAssign)}&to=alex&format=text&apiKey=${encodeURIComponent(apiKey)}`);
    assert.strictEqual(assignRes.status, 200);
    const assignText = await assignRes.text();
    assert.ok(assignText.includes('Assigned'));
    assert.ok(assignText.includes('@alex'));

    // Verify task assignment in tasks list
    const listRes = await app.request(`/api/tasks?filter=assigned_by_me&apiKey=${encodeURIComponent(apiKey)}`);
    assert.strictEqual(listRes.status, 200);
    const listBody = await listRes.json();
    const assignedTask = listBody.data.find((t: any) => t.title === titleToAssign);
    assert.ok(assignedTask, 'Task must be listed in assigned_by_me');
    assert.strictEqual(assignedTask.assigned_to_username, 'alex');
  });

  it('24. GET /api/tasks/complete should complete task by number (e.g. task 1)', async () => {
    const keyRes = await app.request('/api/auth/webhook-key');
    const { apiKey } = await keyRes.json();

    // Query today tasks to get the current list
    const todayRes = await app.request(`/api/tasks?filter=today&apiKey=${encodeURIComponent(apiKey)}`);
    const todayBody = await todayRes.json();
    assert.ok(todayBody.data.length >= 1, 'Should have at least 1 today task');
    const firstTaskTitle = todayBody.data[0].title;

    // Complete task #1 by number
    const compRes = await app.request(`/api/tasks/complete?task=1&format=text&apiKey=${encodeURIComponent(apiKey)}`);
    assert.strictEqual(compRes.status, 200);
    const compText = await compRes.text();
    assert.ok(compText.includes('Marked task #1'));
    assert.ok(compText.includes(firstTaskTitle));
  });

  it('25. GET /api/hydration/today with format=text should return spoken Siri summary', async () => {
    const keyRes = await app.request('/api/auth/webhook-key');
    const { apiKey } = await keyRes.json();

    const res = await app.request(`/api/hydration/today?format=text&apiKey=${encodeURIComponent(apiKey)}`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('You have drunk'));
    assert.ok(text.includes('goal'));
  });

  it('26. GET /api/reminders/quick should create a quick reminder with Siri text confirmation', async () => {
    const keyRes = await app.request('/api/auth/webhook-key');
    const { apiKey } = await keyRes.json();

    const title = `Drink electrolytes ${Date.now()}`;
    const res = await app.request(`/api/reminders/quick?title=${encodeURIComponent(title)}&minutes=45&format=text&apiKey=${encodeURIComponent(apiKey)}`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Set reminder for'));
    assert.ok(text.includes('45 minutes from now'));
  });
});


