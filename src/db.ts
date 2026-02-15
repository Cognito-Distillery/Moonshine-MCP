import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import { logger } from './logger.js';

let db: Database.Database | null = null;

function getDefaultDbPath(): string {
  const home = homedir();
  // Linux XDG data dir
  return join(
    process.env.XDG_DATA_HOME || join(home, '.local', 'share'),
    'com.moonshine.app',
    'moonshine.db',
  );
}

function resolveDbPath(): string {
  if (process.env.MOONSHINE_DB_PATH) {
    return process.env.MOONSHINE_DB_PATH;
  }
  return getDefaultDbPath();
}

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = resolveDbPath();
  logger.info('Opening database at:', dbPath);

  if (!existsSync(dbPath)) {
    throw new Error(`Database not found at: ${dbPath}. Set MOONSHINE_DB_PATH to override.`);
  }

  const readOnly = process.env.MOONSHINE_READ_ONLY === 'true';

  db = new Database(dbPath, { readonly: readOnly });
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  logger.info(`Database opened (readonly=${readOnly})`);
  return db;
}

export function isReadOnly(): boolean {
  return process.env.MOONSHINE_READ_ONLY === 'true';
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('Database closed');
  }
}
