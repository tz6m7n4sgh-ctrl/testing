import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import path from 'path';
import * as auth from './src/auth.js';
import * as store from './src/store.js';
import * as jobs from './src/jobs.js';
import * as profileSvc from './src/profile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

const app = express();
if (isProd) app.set('trust proxy', 1); // behind Railway/Heroku TLS proxy → secure cookies

// ── Security headers (CSP, HSTS, X-Frame-Options DENY, etc.) ────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],  // dynamic inline colors; scripts stay strict
      imgSrc:      ["'self'", 'data:', 'https://media.licdn.com', 'https://*.licdn.com'],
      connectSrc:  ["'self'"],
      formAction:  ["'self'", 'https://www.linkedin.com'],
      frameAncestors: ["'none'"],
      objectSrc:   ["'none'"],
      baseUri:     ["'self'"],
      upgradeInsecureRequests: isProd ? [] : null
    }
  },
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
  referrerPolicy: { policy: 'same-origin' }
}));

app.use(express.json({ limit: '64kb' }));
app.use(session({
  name: 'js.sid',
  secret: process.env.SESSION_SECRET || 'jobscout-dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: isProd, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' }
}));
app.use(express.static(path.join(__dirname, 'public')));

// ── Rate limiting ───────────────────────────────────────────────────────────
const apiLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30,  standardHeaders: true, legacyHeaders: false });
app.use('/api',  apiLimiter);
app.use('/auth', authLimiter);

const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'unauthenticated' });
  next();
};

// ── LinkedIn OAuth ─────────────────────────────────────────────────────────
app.get('/auth/linkedin', (req, res) => {
  if (!process.env.LINKEDIN_CLIENT_ID) {
    return res.status(503).send('LinkedIn credentials not configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env');
  }
  const state = Math.random().toString(36).slice(2) + Date.now();
  req.session.oauthState = state;
  try { res.redirect(auth.buildUrl(state)); }
  catch (e) { res.status(500).send(e.message); }
});

app.get('/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error || !code || state !== req.session.oauthState) {
    return res.redirect('/?auth=error&reason=' + encodeURIComponent(error || 'state_mismatch'));
  }
  try {
    const tokens  = await auth.exchangeCode(code);
    const profile = await auth.getProfile(tokens.access_token);
    const user    = store.upsertUser({
      id:       profile.sub,
      name:     profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(' ') || 'User',
      email:    profile.email || '',
      photo:    profile.picture || '',
      headline: '',
      skills:   [],
      prefs:    { roles: [], locations: [], level: '', remote: false }
    });
    req.session.userId = user.id;
    req.session.oauthState = null;
    res.redirect('/?auth=ok');
  } catch (e) {
    console.error('OAuth callback error:', e);
    res.redirect('/?auth=error&reason=server');
  }
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ── User profile ───────────────────────────────────────────────────────────
app.get('/api/me', requireAuth, (req, res) => {
  res.json(store.getUser(req.session.userId));
});

app.patch('/api/me', requireAuth, (req, res) => {
  const user = store.getUser(req.session.userId);
  if (!user) return res.status(404).json({ error: 'not_found' });

  const updates = {};
  if (typeof req.body.headline === 'string')   updates.headline = req.body.headline.slice(0, 200);
  if (Array.isArray(req.body.skills))          updates.skills   = req.body.skills.slice(0, 60).map(String);
  if (req.body.prefs && typeof req.body.prefs === 'object') {
    updates.prefs = {
      roles:     Array.isArray(req.body.prefs.roles)     ? req.body.prefs.roles.slice(0, 10).map(String)    : user.prefs.roles,
      locations: Array.isArray(req.body.prefs.locations) ? req.body.prefs.locations.slice(0, 5).map(String) : user.prefs.locations,
      level:     typeof req.body.prefs.level === 'string' ? req.body.prefs.level : user.prefs.level,
      remote:    typeof req.body.prefs.remote === 'boolean' ? req.body.prefs.remote : user.prefs.remote
    };
  }
  res.json(store.upsertUser({ ...user, ...updates }));
});

// ── Stage 1: understand profile (signed-in uses session name; guest passes name) ──
app.post('/api/understand', async (req, res) => {
  let name = '';
  if (req.session.userId) {
    name = store.getUser(req.session.userId)?.name || '';
  } else {
    name = String(req.body?.name || '').trim().slice(0, 80);
    if (name) {
      // Anonymous guest account so jobs/saved/profile work without OAuth
      const id = 'guest-' + Math.random().toString(36).slice(2, 12);
      store.upsertUser({ id, name, email: '', photo: '', headline: '', skills: [],
        prefs: { roles: [], locations: [], level: '', remote: false } });
      req.session.userId = id;
    }
  }
  if (!name) return res.status(400).json({ error: 'name_required' });

  try {
    const data = await profileSvc.understand({ name });
    // Persist extracted skills onto the user when signed in
    if (req.session.userId) {
      const u = store.getUser(req.session.userId);
      if (u && data.skills.length) store.upsertUser({ ...u, skills: [...new Set([...(u.skills || []), ...data.skills])].slice(0, 60) });
    }
    res.json(data);
  } catch (e) {
    console.error('understand error:', e);
    res.status(500).json({ error: 'understand_failed' });
  }
});

// ── Anonymous guest session (manual-setup path, no understand) ──
app.post('/api/session/guest', (req, res) => {
  if (!req.session.userId) {
    const id = 'guest-' + Math.random().toString(36).slice(2, 12);
    store.upsertUser({ id, name: 'Guest', email: '', photo: '', headline: '', skills: [],
      prefs: { roles: [], locations: [], level: '', remote: false } });
    req.session.userId = id;
  }
  res.json(store.getUser(req.session.userId));
});

// ── CV parse (free: text in → structured fields out) ──
app.post('/api/cv', (req, res) => {
  const text = req.body?.text;
  if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'text_required' });
  try {
    res.json(profileSvc.parseCVText(text));
  } catch (e) {
    console.error('cv parse error:', e);
    res.status(500).json({ error: 'cv_failed' });
  }
});

// ── Jobs ───────────────────────────────────────────────────────────────────
app.get('/api/jobs', requireAuth, async (req, res) => {
  const user  = store.getUser(req.session.userId);
  const query = req.query.q?.trim() || user.prefs?.roles?.[0] || user.skills?.[0] || '';
  // Location for geo-aware sources (JSearch): query param > first preferred location
  const location = req.query.loc?.trim() || user.prefs?.locations?.[0] || '';

  try {
    const raw       = await jobs.fetchAll(query, location);
    const lastVisit = user.lastVisit ? new Date(user.lastVisit) : null;

    const scored = raw
      .map(j => {
        const m  = jobs.score(j, user);
        const isNew = lastVisit && j.posted ? new Date(j.posted) > lastVisit : false;
        return { ...j, score: m.score, reasons: m.reasons, isNew };
      })
      .filter(j => !query || j.score > 0)
      .sort((a, b) => b.score - a.score || (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));

    store.upsertUser({ ...user, lastVisit: new Date().toISOString() });
    res.json({ jobs: scored, newCount: scored.filter(j => j.isNew).length, sources: [...new Set(raw.map(j => j.source))] });
  } catch (e) {
    console.error('Jobs error:', e);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

// ── Saved jobs ─────────────────────────────────────────────────────────────
app.get('/api/saved',       requireAuth, (req, res) => res.json(store.getSaved(req.session.userId)));
app.post('/api/saved',      requireAuth, (req, res) => { store.saveJob(req.session.userId, req.body); res.json({ ok: true }); });
app.delete('/api/saved/:id',requireAuth, (req, res) => { store.unsaveJob(req.session.userId, req.params.id); res.json({ ok: true }); });
app.patch('/api/saved/:id', requireAuth, (req, res) => { store.updateSavedJob(req.session.userId, req.params.id, req.body); res.json({ ok: true }); });

app.listen(PORT, () => console.log(`JobScout → http://localhost:${PORT}`));
