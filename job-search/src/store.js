import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '../data/jobscout.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL DEFAULT '',
    email       TEXT NOT NULL DEFAULT '',
    photo       TEXT NOT NULL DEFAULT '',
    headline    TEXT NOT NULL DEFAULT '',
    skills      TEXT NOT NULL DEFAULT '[]',
    prefs       TEXT NOT NULL DEFAULT '{}',
    last_visit  TEXT,
    updated_at  TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS saved_jobs (
    user_id   TEXT NOT NULL,
    job_id    TEXT NOT NULL,
    data      TEXT NOT NULL,
    status    TEXT NOT NULL DEFAULT 'saved',
    saved_at  TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, job_id)
  );
`);

function toUser(row) {
  if (!row) return null;
  return {
    id:        row.id,
    name:      row.name,
    email:     row.email,
    photo:     row.photo,
    headline:  row.headline,
    skills:    JSON.parse(row.skills),
    prefs:     JSON.parse(row.prefs),
    lastVisit: row.last_visit
  };
}

export function getUser(id) {
  return toUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
}

export function upsertUser(u) {
  db.prepare(`
    INSERT INTO users (id, name, email, photo, headline, skills, prefs, last_visit, updated_at)
    VALUES (@id, @name, @email, @photo, @headline, @skills, @prefs, @lastVisit, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, email = excluded.email, photo = excluded.photo,
      headline = excluded.headline, skills = excluded.skills, prefs = excluded.prefs,
      last_visit = excluded.last_visit, updated_at = excluded.updated_at
  `).run({
    id:        u.id,
    name:      u.name || '',
    email:     u.email || '',
    photo:     u.photo || '',
    headline:  u.headline || '',
    skills:    JSON.stringify(u.skills || []),
    prefs:     JSON.stringify(u.prefs || {}),
    lastVisit: u.lastVisit || null
  });
  return getUser(u.id);
}

export function getSaved(userId) {
  return db.prepare('SELECT data, status FROM saved_jobs WHERE user_id = ? ORDER BY saved_at DESC')
    .all(userId)
    .map(r => ({ ...JSON.parse(r.data), savedStatus: r.status }));
}

export function saveJob(userId, job) {
  db.prepare(`
    INSERT OR REPLACE INTO saved_jobs (user_id, job_id, data, status, saved_at)
    VALUES (?, ?, ?, 'saved', datetime('now'))
  `).run(userId, job.id, JSON.stringify(job));
}

export function unsaveJob(userId, jobId) {
  db.prepare('DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?').run(userId, jobId);
}

export function updateSavedJob(userId, jobId, updates) {
  if (updates.status) {
    db.prepare('UPDATE saved_jobs SET status = ? WHERE user_id = ? AND job_id = ?')
      .run(updates.status, userId, jobId);
  }
}

export function deleteUser(userId) {
  db.prepare('DELETE FROM saved_jobs WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}
