// Tiny JSON-file persistence. Good enough for an MVP / single-instance deploy.
// Swap for SQLite/Postgres later without touching the rest of the app.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const FILE = process.env.DB_FILE || './data/db.json';
let db = { users: {} };

function ensureDir() {
  const d = dirname(FILE);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

export function load() {
  try {
    if (existsSync(FILE)) db = JSON.parse(readFileSync(FILE, 'utf8'));
  } catch (e) {
    console.error('[store] failed to load db, starting empty:', e.message);
    db = { users: {} };
  }
  if (!db.users) db.users = {};
  return db;
}

export function save() {
  ensureDir();
  writeFileSync(FILE, JSON.stringify(db, null, 2));
}

export function findByProvider(provider, sub) {
  return Object.values(db.users).find((u) => u.provider === provider && u.sub === sub);
}

export function getUser(id) {
  return db.users[id] || null;
}

export function upsertUser(user) {
  db.users[user.id] = user;
  save();
  return user;
}
