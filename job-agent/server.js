import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { load, upsertUser } from './src/store.js';
import {
  attachUser, requireUser, startSession, clearSession, ensureUser,
  linkedinConfigured, linkedinAuthUrl, linkedinCallback,
} from './src/auth.js';
import { searchJobs, scoreJob } from './src/jobs.js';
import { parseResume, pdfToText } from './src/resume.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
load();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(attachUser);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

/* ============================================================
   AUTH
   ============================================================ */
app.get('/auth/config', (req, res) => res.json({ linkedin: linkedinConfigured() }));

app.get('/auth/linkedin', (req, res) => {
  if (!linkedinConfigured()) return res.status(400).send('LinkedIn not configured');
  res.redirect(linkedinAuthUrl(res));
});

app.get('/auth/linkedin/callback', async (req, res) => {
  try {
    await linkedinCallback(req, res);
    res.redirect('/');
  } catch (e) {
    console.error('[auth] linkedin callback:', e.message);
    res.redirect('/?error=linkedin');
  }
});

// Demo login so the app is usable before a LinkedIn app is registered.
app.post('/auth/demo', (req, res) => {
  const name = (req.body?.name || '').trim() || 'Demo User';
  const email = (req.body?.email || '').trim().toLowerCase();
  const sub = email || ('demo-' + randomUUID());
  const user = ensureUser({ provider: 'demo', sub, name, email });
  startSession(res, user.id);
  res.json({ ok: true });
});

app.post('/auth/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

/* ============================================================
   PROFILE
   ============================================================ */
const publicUser = (u) => ({
  id: u.id, provider: u.provider, name: u.name, email: u.email, picture: u.picture,
  headline: u.headline, location: u.location, role: u.role, skills: u.skills,
  keywords: u.keywords, level: u.level, remoteOnly: u.remoteOnly,
  hasResume: !!u.resumeText, savedIds: Object.keys(u.savedJobs || {}),
  lastSeenAt: u.lastSeenAt,
});

app.get('/api/me', requireUser, (req, res) => res.json({ user: publicUser(req.user) }));

app.put('/api/profile', requireUser, (req, res) => {
  const u = req.user;
  const b = req.body || {};
  const fields = ['headline', 'location', 'role', 'level'];
  fields.forEach((f) => { if (typeof b[f] === 'string') u[f] = b[f]; });
  if (Array.isArray(b.skills)) u.skills = [...new Set(b.skills.map(String))].slice(0, 60);
  if (Array.isArray(b.keywords)) u.keywords = [...new Set(b.keywords.map(String))].slice(0, 30);
  if (typeof b.remoteOnly === 'boolean') u.remoteOnly = b.remoteOnly;
  upsertUser(u);
  res.json({ user: publicUser(u) });
});

// Resume enrichment: accepts pasted text (JSON) or an uploaded file (multipart).
app.post('/api/profile/resume', requireUser, upload.single('file'), async (req, res) => {
  const u = req.user;
  let text = '';
  if (req.file) {
    if (req.file.mimetype === 'application/pdf') {
      const parsed = await pdfToText(req.file.buffer);
      if (parsed == null)
        return res.status(415).json({ error: 'pdf_unsupported', message: 'PDF parsing unavailable on this server — paste the text instead.' });
      text = parsed;
    } else {
      text = req.file.buffer.toString('utf8');
    }
  } else if (typeof req.body?.text === 'string') {
    text = req.body.text;
  }
  if (!text.trim()) return res.status(400).json({ error: 'empty' });

  u.resumeText = text.slice(0, 40000);
  const ex = parseResume(text);
  u.skills = [...new Set([...(u.skills || []), ...ex.skills])].slice(0, 60);
  if (!u.level && ex.level) u.level = ex.level;
  if (!u.headline && ex.headline) u.headline = ex.headline;
  upsertUser(u);
  res.json({ user: publicUser(u), extracted: ex });
});

/* ============================================================
   JOBS
   ============================================================ */
app.get('/api/jobs', requireUser, async (req, res) => {
  try {
    const { jobs, sources } = await searchJobs(req.user);
    // mark "last seen" so subsequent searches can flag what's new
    req.user.lastSeenAt = Date.now();
    upsertUser(req.user);
    res.json({ jobs: jobs.slice(0, 120), sources });
  } catch (e) {
    console.error('[jobs]', e.message);
    res.status(502).json({ error: 'fetch_failed' });
  }
});

/* ============================================================
   SAVED JOBS
   ============================================================ */
app.get('/api/saved', requireUser, (req, res) => {
  const list = Object.values(req.user.savedJobs || {}).map((j) => ({
    ...j, ...scoreJob(j, req.user),
  })).sort((a, b) => b.score - a.score);
  res.json({ jobs: list });
});

app.post('/api/saved', requireUser, (req, res) => {
  const u = req.user;
  const job = req.body?.job;
  if (!job?.id) return res.status(400).json({ error: 'bad_job' });
  u.savedJobs = u.savedJobs || {};
  if (u.savedJobs[job.id]) delete u.savedJobs[job.id];
  else u.savedJobs[job.id] = job;
  upsertUser(u);
  res.json({ saved: !!u.savedJobs[job.id], savedCount: Object.keys(u.savedJobs).length });
});

/* ============================================================
   STATIC PWA
   ============================================================ */
app.use(express.static(join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`JobAgent running on ${process.env.BASE_URL || 'http://localhost:' + PORT}`);
  console.log(`LinkedIn login: ${linkedinConfigured() ? 'enabled' : 'NOT configured (demo login available)'}`);
});
