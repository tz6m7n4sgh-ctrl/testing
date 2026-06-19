# QA Practice (standing)

We run a **deep QA pass on every major milestone** — and especially after the real application is built — across three lenses: **code, security, design/UX**. This file is the checklist; findings get logged per pass.

## When to run
- After building the actual application (first full pass).
- After each significant feature merge.
- Before any production deploy.

## 1. Code quality
- [ ] No dead code, no unused vars/functions; consistent naming & style with surrounding code
- [ ] Functions are small and single-purpose; no copy-paste duplication
- [ ] Error handling on every async/IO path; user-facing errors are generic, internals logged
- [ ] Inputs validated and bounded (lengths, types) on both client and server
- [ ] No blocking/synchronous work on request paths; external calls have timeouts
- [ ] Tests or a manual test plan for each feature; `node --check`/lint clean
- [ ] `FEATURES.md` updated to match reality

## 2. Security (see also `job-search/SECURITY.md`)
- [ ] No secrets in client code or git history; `.env` ignored
- [ ] All output escaped (XSS); no `innerHTML` with raw untrusted data
- [ ] Strict CSP; no inline scripts; HTTPS + secure cookies in prod
- [ ] OAuth `state` (CSRF) verified; sessions httpOnly/secure/sameSite
- [ ] AuthN/AuthZ on every protected route; data scoped to the owning user
- [ ] Parameterized SQL only; rate limiting on API/auth; security headers (Helmet)
- [ ] External/user data sanitized; dependency `npm audit` clean
- [ ] Privacy: profile/web-search features use public data only; "is this you?" confirmation

## 3. Design / UX
- [ ] Responsive on mobile and web (no overflow, tap targets ≥ 44px)
- [ ] Consistent Ocean theme, spacing, radii, typography
- [ ] Clear loading, empty, and error states for every screen
- [ ] Flows match `FEATURES.md`; back/nav always available; no dead ends
- [ ] Accessibility: color contrast, focus states, labels/alt text
- [ ] Fast perceived performance (skeletons/spinners, no layout jank)

## Log
Each pass appends a dated entry: scope, findings (severity), and fixes.

- _2026-06-19_ — practice established.
- _2026-06-19_ — **Pass #1 (after actual application built).** Scope: `job-search/` backend + wired frontend.
  - 🔴 **Security/XSS (fixed):** `esc()` didn't escape quotes; external job `url`s went into `href` unescaped with no scheme check. → `esc()` now escapes `& < > " '`; added `safeUrl()` allowing only http(s). Verified `"><img onerror>` is neutralized.
  - 🟠 **Functional (fixed):** guest "manual setup" path had no session → `/api/jobs` 401. → added `POST /api/session/guest`; verified jobs endpoint returns 200 with guest cookie.
  - 🟡 **UX (fixed):** signed-in returning users saw a "sign in" health prompt → now offers "Analyze your public profile"; agent orbit recolored to Ocean.
  - ✅ Verified: server boots; security headers (CSP/HSTS/XFO/nosniff) present; `/api/me` 401 unauth; `/api/cv` parses; `/api/understand` hits GitHub; graceful empty state when feeds unreachable.
  - 📋 Backlog (low): cookie-less calls create a guest row each time (bounded by rate limiter) — add periodic cleanup of stale guest rows; add Google/Email login; Claude/Brave upgrades.
