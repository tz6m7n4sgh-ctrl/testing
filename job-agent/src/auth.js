// Sessions (signed cookie, no DB session table needed) + LinkedIn OIDC flow.
import crypto from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { findByProvider, getUser, upsertUser } from './store.js';

const SECRET = process.env.SESSION_SECRET || 'dev-insecure-secret-change-me';
const COOKIE = 'sid';

/* ---------- signed token helpers (HMAC, no external deps) ---------- */
export function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}
export function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    return null;
  }
}

/* ---------- cookie parsing / setting ---------- */
export function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function setCookie(res, name, value, { maxAge, httpOnly = true } = {}) {
  const secure = (process.env.BASE_URL || '').startsWith('https');
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  if (maxAge != null) parts.push(`Max-Age=${maxAge}`);
  res.append('Set-Cookie', parts.join('; '));
}
export function startSession(res, userId) {
  setCookie(res, COOKIE, sign({ uid: userId, t: Date.now() }), { maxAge: 60 * 60 * 24 * 30 });
}
export function clearSession(res) {
  setCookie(res, COOKIE, '', { maxAge: 0 });
}

/* ---------- express middleware: attaches req.user ---------- */
export function attachUser(req, res, next) {
  const tok = parseCookies(req)[COOKIE];
  const data = verify(tok);
  req.user = data ? getUser(data.uid) : null;
  next();
}
export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'not_authenticated' });
  next();
}

/* ---------- user creation helper ---------- */
export function ensureUser({ provider, sub, name, email, picture, headline }) {
  let u = findByProvider(provider, sub);
  if (!u) {
    u = {
      id: randomUUID(),
      provider, sub,
      name: name || 'Job Seeker',
      email: email || '',
      picture: picture || '',
      headline: headline || '',
      location: '',
      role: '',                 // desired role/title
      skills: [],
      keywords: [],
      level: '',
      remoteOnly: false,
      resumeText: '',
      savedJobs: {},            // id -> job snapshot
      lastSeenAt: 0,            // for "new since last visit"
      createdAt: Date.now(),
    };
    upsertUser(u);
  } else {
    // refresh identity fields from provider on each login
    u.name = name || u.name;
    u.email = email || u.email;
    u.picture = picture || u.picture;
    if (headline && !u.headline) u.headline = headline;
    upsertUser(u);
  }
  return u;
}

/* ============================================================
   LinkedIn "Sign in with LinkedIn using OpenID Connect"
   Docs: https://learn.microsoft.com/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
   ============================================================ */
export const linkedinConfigured = () =>
  !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);

function redirectUri() {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/auth/linkedin/callback`;
}

export function linkedinAuthUrl(res) {
  const state = randomUUID();
  setCookie(res, 'li_state', state, { maxAge: 600 });
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: redirectUri(),
    state,
    scope: 'openid profile email',
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${p}`;
}

export async function linkedinCallback(req, res) {
  const cookies = parseCookies(req);
  const { code, state } = req.query;
  if (!code || !state || state !== cookies.li_state) {
    throw new Error('Invalid OAuth state or missing code');
  }
  // 1) exchange code for tokens
  const tokRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    }),
  });
  if (!tokRes.ok) throw new Error('Token exchange failed: ' + (await tokRes.text()));
  const tokens = await tokRes.json();

  // 2) fetch the OIDC userinfo (name, email, picture — the lite profile)
  const uiRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!uiRes.ok) throw new Error('userinfo failed: ' + (await uiRes.text()));
  const info = await uiRes.json();

  const user = ensureUser({
    provider: 'linkedin',
    sub: info.sub,
    name: info.name,
    email: info.email,
    picture: info.picture,
  });
  startSession(res, user.id);
}
