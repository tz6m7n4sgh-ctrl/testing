# JobScout — Features & User Flows (living reference)

> Single source of truth for what exists, how the app flows, and what's planned.
> **We update this on every change.** Last updated: 2026-06-19.

**Status legend:** ✅ done (in demo) · 🔵 in real backend · 🟡 planned · 💤 idea
**Surfaces:** `demo/` = static mock PWA (GitHub Pages) · `job-search/` = real Node+SQLite backend

---

## 🧭 User flows

### Flow A — Signed-in (LinkedIn / Google / Email)
1. **Login** — pick a provider (or "continue without signing in"). ✅
2. **Stage 1 · Understand** — agent screen "Understanding your profile…" (reads provider basics, searches the web, scans GitHub, gathers references). ✅
3. **Profile page — confirm sources** — "We found these references"; user ticks which are them → **Confirm & extract**. ✅
4. **Profile page — extracted** — skills, experience, location, headline shown with **per-field source tags** (LinkedIn / Web / GitHub) + **completeness bar** + **profile health**. ✅
5. **CV upload (optional)** — agent "Parsing your CV…" fills gaps (education, phone, extra skills) tagged **CV**. ✅
6. **Stage 2 · Search** — "Find my matching jobs" → agent searches boards → **Dashboard**. ✅

### Flow B — Guest (no sign-in, name-based)
1. Login → "continue without signing in". ✅
2. **Enter your name** → "Search the web for me". ✅
3. Same **understand → confirm references → extract** profile flow as signed-in. ✅
4. **Find jobs** → Dashboard (profile-health card now works for guests too). ✅
   - Secondary: "skip — set up a search manually" → quick setup → search. ✅

### Flow C — Returning to profile
- Dashboard **profile-health card** or **Profile** quick action → opens the profile page with a **← Dashboard** back button. ✅

---

## 🎛️ Features

### Authentication
- Multi-provider login: LinkedIn / Google / Email. ✅ (demo) · 🔵 LinkedIn OIDC real; Google/Email 🟡
- Guest mode. ✅

### Profile
- Agent "understand profile" screen. ✅ demo · 🟡 backend (web search + GitHub)
- Public-reference confirmation ("is this you?"). ✅
- Auto-extract **skills / experience / location / headline** from confirmed sources. ✅ demo · 🟡 backend
- **Per-field source tags** (online vs CV). ✅
- **CV upload → parse → fill gaps**. ✅ demo · 🟡 backend (PDF parse + Claude)
- Profile **completeness bar**. ✅
- **Profile health** (score, positive mentions, "how you look", suggestions). ✅ demo · 🟡 backend (Claude)
- Editable job target (role + location) and add-skills. ✅

### Job search & matching
- Multi-source search (Bayt/Indeed/LinkedIn/GulfTalent via JSearch + free feeds). 🔵 backend wired · ✅ demo mock
- Hybrid match score (role + skills + seniority + location + recency). ✅ demo · 🔵 backend
- "Why this fits" reasons per job. ✅
- Dashboard: greeting, **stat cards**, **top matches**, **UAE market insights**, profile-health card. ✅
- All-jobs list + sort. ✅ (sort partial)
- Save jobs (★). ✅ basic

### Platform
- Installable PWA (manifest + service worker). 🔵 backend · ✅ demo
- Responsive: mobile + web (centered shell, multi-column grids). ✅
- **Ocean** theme selected (navy/blue/mint). ✅
- Security mandate (CSP, Helmet, rate-limit, no client secrets). 🔵 — see `job-search/SECURITY.md`

---

## 🟡 Planned backlog (prioritized)

1. **Saved + application tracker** — Saved tab with pipeline: Saved → Applied → Interview → Offer → Rejected, status badges & counts.
2. **Job detail view** — tap card → full description, requirements, match breakdown, apply/save.
3. **Filters & sort** — type, salary, remote, posted-date; sort match/newest.
4. **Cover letter generator** — tailored per job (mock → Claude later), editable, copy/download.
5. **Empty/low-presence state** — graceful profile assessment for new grads with little web footprint.
6. **New-match alerts** — "new since last visit" badges; later push/email.
7. **Resume/skills sync** — keep profile skills in sync with CV + GitHub.

## 💤 Later / scale
- Recruiter side (search candidate profiles).
- Semantic matching (embeddings).
- Photo "professional?" scoring (Claude vision).
- Multi-user accounts + cross-device sync.

---

## 🔌 Backend wiring status (`job-search/`)
- ✅ LinkedIn OIDC login, sessions, SQLite store
- ✅ Job feeds: Remotive, Arbeitnow, Himalayas, JSearch (UAE, key-gated)
- ✅ Rules-based matching, saved jobs + status API
- ✅ Onboarding wizard, security hardening, Dependabot
- 🟡 Stage-1 "understand profile" endpoint (web search + GitHub + Claude)
- 🟡 CV parsing endpoint, cover-letter endpoint
- 🟡 Wire the demo's two-stage flow into the real frontend

> See also: `job-search/ROADMAP.md` (phased plan) · `job-search/CAPABILITIES.md` (free vs paid).
