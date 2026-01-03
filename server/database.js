import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = path.join(__dirname, 'quiz.db');
let db = null;

// Database methods (better-sqlite3 is synchronous)
const dbRun = (db, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return { lastID: result.lastInsertRowid, changes: result.changes };
  } catch (err) {
    throw err;
  }
};

const dbGet = (db, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    return stmt.get(...params);
  } catch (err) {
    throw err;
  }
};

const dbAll = (db, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  } catch (err) {
    throw err;
  }
};

const dbExec = (db, sql) => {
  try {
    db.exec(sql);
    return undefined;
  } catch (err) {
    throw err;
  }
};

export const initDatabase = async () => {
  try {
    db = new Database(dbPath);

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        is_admin INTEGER DEFAULT 0,
        is_blocked INTEGER DEFAULT 0,
        warning_count INTEGER DEFAULT 0,
        quiz_restart_count INTEGER DEFAULT 0,
        blocked_reason TEXT,
        blocked_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Create quiz_results table
    db.exec(`
      CREATE TABLE IF NOT EXISTS quiz_results (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        user_name TEXT,
        quiz_type TEXT NOT NULL CHECK(quiz_type IN ('plugin', 'theme')),
        difficulty TEXT NOT NULL CHECK(difficulty IN ('beginner', 'intermediate', 'advanced')),
        score INTEGER NOT NULL,
        total_questions INTEGER NOT NULL,
        correct_answers INTEGER NOT NULL,
        wrong_answers INTEGER NOT NULL,
        time_taken_seconds INTEGER NOT NULL,
        detailed_answers TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('selected', 'pending')),
        completed_at TEXT DEFAULT (datetime('now')),
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_quiz_results_user_id ON quiz_results(user_id);
      CREATE INDEX IF NOT EXISTS idx_quiz_results_quiz_type ON quiz_results(quiz_type);
      CREATE INDEX IF NOT EXISTS idx_quiz_results_status ON quiz_results(status);
      CREATE INDEX IF NOT EXISTS idx_quiz_results_completed_at ON quiz_results(completed_at);
    `);

    console.log('✅ Database initialized successfully');
    return Promise.resolve(undefined);
  } catch (err) {
    console.error('Error initializing database:', err);
    return Promise.reject(err);
  }
};

export { db, dbRun, dbGet, dbAll, dbExec };

