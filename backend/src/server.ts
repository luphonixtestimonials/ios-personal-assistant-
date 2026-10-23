import { serve } from '@hono/node-server';
import app from './index.js';
import { config } from './config.js';
import { runMigrations } from './db/migrate.js';

async function startServer() {
  try {
    // Automatically execute schema migrations on boot
    await runMigrations();

    console.log(`🚀 Synvy API Server listening on:`);
    console.log(`   - Local:   http://localhost:${config.PORT}`);
    console.log(`   - Network: http://172.20.10.2:${config.PORT} (for iPhone Safari)`);
    serve({
      fetch: app.fetch,
      port: config.PORT,
      hostname: '0.0.0.0',
    });
  } catch (err) {
    console.error('Failed to start Synvy API Server:', err);
    process.exit(1);
  }
}

startServer();
