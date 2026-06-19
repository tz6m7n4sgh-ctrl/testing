# Security Policy & Mandate

Security is a hard requirement for JobScout across **three layers**: frontend, backend, and the GitHub repository. Every change must uphold this checklist.

---

## 1. Frontend security

- **No secrets in client code.** API keys, client secrets, tokens never appear in frontend JS/HTML. (LinkedIn `client_secret` and `RAPIDAPI_KEY` live only on the server.)
- **XSS prevention.** All dynamic content (user profile, job titles, descriptions from external feeds) is HTML-escaped before rendering (`esc()` helper). No `innerHTML` with raw untrusted strings.
- **Content Security Policy.** Strict CSP — `script-src 'self'`, no inline scripts, no `eval`. Images limited to `'self'`, `data:`, and LinkedIn's CDN.
- **HTTPS only.** App is served over TLS in production; cookies are `Secure`.
- **No third-party trackers / analytics** that leak user data.
- **Input limits** enforced client-side for UX, re-validated server-side for safety.

## 2. Backend security

- **Secrets via environment variables only.** Never committed. `.env` is git-ignored; only `.env.example` (placeholders) is tracked.
- **Session hardening.** Cookies are `httpOnly`, `Secure` (prod), `SameSite=Lax`; signed with a strong random `SESSION_SECRET`.
- **OAuth CSRF protection.** `state` parameter generated per-login and verified on callback.
- **Security headers** via Helmet: CSP, HSTS, X-Content-Type-Options, X-Frame-Options (`DENY`), Referrer-Policy.
- **Rate limiting** on all API/auth routes to prevent abuse and brute force.
- **Auth enforced** on every protected route (`requireAuth`); users can only read/write their own data (queries scoped by `userId`).
- **SQL injection safe.** All queries use parameterized prepared statements (better-sqlite3).
- **Input validation & size caps** on every endpoint (skills/roles/locations length-limited; strings truncated).
- **External data sanitized.** Job feed HTML is stripped before storage/render. All outbound fetches have timeouts.
- **Errors don't leak internals.** Generic error messages to the client; details logged server-side only.

## 3. GitHub / repository security

- **No secrets in history.** `.gitignore` blocks `.env`, `*.db`, logs. Pre-commit review for accidental secrets.
- **Secret scanning** enabled (GitHub → Settings → Code security → Secret scanning + push protection).
- **Dependabot** enabled for dependency and security updates (`.github/dependabot.yml`).
- **`npm audit`** run before releases; no known high/critical vulnerabilities in deps.
- **Branch protection** on `main`: require PR review, no force-push.
- **Least-privilege tokens** for any CI/automation.

---

## Reporting

Found a vulnerability? Open a private security advisory on GitHub or email the maintainer. Do not file public issues for security bugs.

## Review cadence

This checklist is reviewed on every feature PR. New external inputs, new endpoints, or new third-party scripts require an explicit security review note in the PR description.
