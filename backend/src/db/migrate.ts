import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  const db = getDb();
  console.log('🔄 Running Turso database migrations...');

  let schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
  }
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.resolve(__dirname, '../../src/db/schema.sql');
  }
  let schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  // Strip line comments (-- ...)
  schemaSql = schemaSql.replace(/--.*$/gm, '');

  // Split SQL commands by semicolon, ignoring empty whitespace
  const statements = schemaSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // 1. Safe idempotent column additions for existing databases before creating indexes
  try { await db.execute('ALTER TABLE users ADD COLUMN username TEXT;'); } catch {}
  try { await db.execute('ALTER TABLE tasks ADD COLUMN assigned_to_user_id TEXT;'); } catch {}
  try { await db.execute('ALTER TABLE tasks ADD COLUMN assigned_by_user_id TEXT;'); } catch {}
  try { await db.execute('ALTER TABLE push_subscriptions ADD COLUMN apns_token TEXT;'); } catch {}
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'Personal',
        tags TEXT NOT NULL DEFAULT '[]',
        is_pinned INTEGER NOT NULL DEFAULT 0 CHECK(is_pinned IN (0, 1)),
        color TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  } catch {}

  for (const statement of statements) {
    try {
      await db.execute(statement);
    } catch (err: any) {
      if (
        err?.message?.includes('duplicate column') ||
        err?.message?.includes('already exists') ||
        err?.message?.includes('no such column')
      ) {
        continue;
      }
      console.error(`❌ Migration error on statement: "${statement.slice(0, 80)}..."`, err);
      throw err;
    }
  }

  // 2. Safe index and backfill operations
  try { await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);'); } catch {}
  try { await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to_user_id);'); } catch {}
  try { await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON tasks(assigned_by_user_id);'); } catch {}
  try {
    await db.execute(`
      UPDATE users
      SET username = LOWER(REPLACE(SUBSTR(email, 1, INSTR(email || '@', '@') - 1), '.', '_'))
      WHERE username IS NULL OR username = ''
    `);
  } catch {}

  console.log(`✅ Successfully executed migrations and column updates on Turso/libSQL.`);
}

// If run directly via CLI
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
