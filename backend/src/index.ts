import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { serveStatic } from '@hono/node-server/serve-static';

import authApp from './routes/auth.js';
import tasksApp from './routes/tasks.js';
import remindersApp from './routes/reminders.js';
import hydrationApp from './routes/hydration.js';
import preferencesApp from './routes/preferences.js';
import syncApp from './routes/sync.js';
import devicesApp from './routes/devices.js';
import friendsApp from './routes/friends.js';
import notificationsApp from './routes/notifications.js';
import notesApp from './routes/notes.js';
import { requestTrackerMiddleware } from './middleware/requestTracker.js';

const app = new Hono();

// Global Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: config.ALLOWED_ORIGIN === '*' ? '*' : config.ALLOWED_ORIGIN.split(','),
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use('*', requestTrackerMiddleware);

// Health check endpoint with database diagnostics
app.get('/health', async (c) => {
  let dbStatus = 'ok';
  let dbError: string | null = null;
  try {
    const { db } = await import('./db/client.js');
    const res = await db.execute('SELECT 1 as test');
    dbStatus = 'Turso (libSQL)';
  } catch (err: any) {
    dbStatus = 'error';
    dbError = err.message;
  }
  return c.json({
    status: 'healthy',
    service: 'Luphonix Backend API',
    database: dbStatus,
    dbError,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Mount Routes
app.route('/api/auth', authApp);
app.route('/api/tasks', tasksApp);
app.route('/api/reminders', remindersApp);
app.route('/api/hydration', hydrationApp);
app.route('/api/preferences', preferencesApp);
app.route('/api/sync', syncApp);
app.route('/api/devices', devicesApp);
app.route('/api/friends', friendsApp);
app.route('/api/notifications', notificationsApp);
app.route('/api/notes', notesApp);

// Central Error Handler
app.onError(errorHandler);

import { getPwaHtml } from './pwaHtml.js';

// Root fallback to PWA HTML directly
app.get('/', (c) => c.html(getPwaHtml()));
app.get('/index.html', (c) => c.html(getPwaHtml()));
app.get('/login', (c) => c.html(getPwaHtml()));
app.get('/signup', (c) => c.html(getPwaHtml()));
app.get('/auth', (c) => c.html(getPwaHtml()));
app.get('/setup', (c) => c.html(getPwaHtml()));
app.get('/devices', (c) => c.html(getPwaHtml()));
app.get('/notes', (c) => c.html(getPwaHtml()));
app.get('/siri', (c) => c.html(getPwaHtml()));

// Serve PWA Static Frontend
app.use('/*', serveStatic({ root: './public' }));

// 404 Route for unmatched API calls
app.notFound((c) => {
  return c.json({ success: false, error: 'Endpoint not found' }, 404);
});

// Export app for server and test usage
export default app;
