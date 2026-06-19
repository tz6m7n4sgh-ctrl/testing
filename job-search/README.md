# JobScout 🎯

A personal, AI-assisted **job-search agent** focused on the UAE market. Sign in, let it build your profile from your public presence (and/or your CV), then get live job listings ranked by how well they fit you — with saved-job tracking, an application funnel, and tailored cover letters.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A518-339933)
![PWA](https://img.shields.io/badge/PWA-installable-5a2be2)

> **Runs free with zero API keys.** Optional keys (LinkedIn, Brave, RapidAPI, Anthropic) progressively upgrade features — see [Configuration](#configuration).

---

## ✨ Features

- **Flexible onboarding** — sign in with LinkedIn, search by name as a guest, or start from your CV.
- **"Understand" agent** — extracts skills from your public GitHub (free) and the web (optional), builds a profile with per-field source tags.
- **CV parsing** — upload a CV to fill the gaps (education, phone, extra skills).
- **Live job matching** — aggregates free feeds (Remotive, Arbeitnow, Himalayas) plus optional UAE coverage (Bayt/Indeed/LinkedIn/GulfTalent via JSearch); ranks with a transparent, rules-based engine.
- **Discovery** — filters & sort, in-app job detail view, dismiss "not interested".
- **Tracking** — save jobs, move them through an application funnel (Saved → Applied → Interviewing → Offer → Rejected), see your interview rate.
- **Cover letters** — generate a tailored draft per job (templated free; Claude-written when a key is set).
- **Profile health** — a presence score, "how you look", and suggestions to stand out.
- **Privacy** — export your data (CSV/JSON) or delete it entirely. Public info only.
- **Installable PWA** — add to home screen on your phone; Ocean theme, responsive on mobile and web.

A static, mock-data **preview of the whole flow** lives in [`demo/`](demo/) — open `demo/index.html` in a browser, no backend needed.

---

## 🚀 Quick start (local)

Requires **Node ≥ 18**.

```bash
git clone <your-repo-url> jobscout
cd jobscout
cp .env.example .env      # optional: add keys (see Configuration)
npm install
npm run dev               # http://localhost:3000
```

The app works immediately with no keys (GitHub-based skill extraction + templated assessment + rules-based matching + free job feeds).

## ☁️ Deploy (Railway free tier → installable on your phone)

1. Push this repo to GitHub.
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub repo.
3. Set the env vars you want (at minimum `SESSION_SECRET`; add LinkedIn for sign-in).
4. Open the Railway URL on your phone → **Add to Home Screen**.

---

## ⚙️ Configuration

All optional — the app degrades gracefully without each.

| Variable | Unlocks | Get it |
|---|---|---|
| `SESSION_SECRET` | Secure signed sessions (set in prod) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` / `REDIRECT_URI` | "Sign in with LinkedIn" (OpenID Connect) | [developer.linkedin.com](https://developer.linkedin.com/apps) |
| `RAPIDAPI_KEY` | UAE/Gulf on-site jobs via JSearch (Google for Jobs) | [JSearch on RapidAPI](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) (free tier) |
| `GITHUB_TOKEN` | Higher GitHub API limits for skill extraction | A read-only Personal Access Token |
| `BRAVE_API_KEY` | Web-reference search in the profile assessment | [Brave Search API](https://brave.com/search/api/) (free tier) |
| `ANTHROPIC_API_KEY` | Claude-written cover letters (and future AI features) | [console.anthropic.com](https://console.anthropic.com) |
| `ANTHROPIC_MODEL` | Model override (default `claude-opus-4-8`; `claude-haiku-4-5` for lowest cost) | — |

See [`.env.example`](.env.example).

---

## 🏗️ Architecture

```
Browser PWA  ←→  Express (Node)  ←→  LinkedIn OIDC
                      ↕                    ↕
                   SQLite          Job feeds + GitHub + (optional) Brave / JSearch / Claude
```

- **Backend** — `server.js` (Express, Helmet, rate limiting, sessions), `src/` (`auth`, `store`, `jobs`, `profile`, `ai`).
- **Frontend** — vanilla JS PWA in `public/` (no framework), Ocean theme, service worker.
- **Data** — `better-sqlite3`, file-based, zero-config.

## 🔐 Security

Security is a first-class requirement — see [SECURITY.md](SECURITY.md). Highlights: secrets only in env (never client-side), strict CSP + Helmet headers, rate limiting, parameterized SQL, output escaping, OAuth `state`/CSRF, and a QA practice log ([QA.md](QA.md)).

## 📋 Project docs

- [FEATURES.md](FEATURES.md) — living reference of features & user flows
- [ROADMAP.md](ROADMAP.md) — phased plan
- [CAPABILITIES.md](CAPABILITIES.md) — what's free vs paid, and recommended approach

---

## 🤝 Contributing

Issues and PRs welcome. Please keep changes aligned with `SECURITY.md` and update `FEATURES.md` when behavior changes.

## 📄 License

Licensed under the **Apache License 2.0** — see [LICENSE](LICENSE).
