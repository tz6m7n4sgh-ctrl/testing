# JobScout 🎯

A multi-user job-search agent: LinkedIn login auto-fills your profile, three live job feeds are searched in parallel, and every result is ranked 0–100 against your skills and preferences. Installable as a PWA on your phone.

## Architecture

```
Browser PWA  ←→  Express (Node.js)  ←→  LinkedIn OIDC
                      ↕                      ↕
                   SQLite              Remotive + Arbeitnow + Himalayas
```

- **No frontend framework** — vanilla JS, fast, installable
- **LinkedIn OIDC** — `openid profile email` scopes (modern, not deprecated)
- **3 free job feeds** — Remotive, Arbeitnow, Himalayas (all CORS-enabled, no API key)
- **Hybrid matching** — title words × skills overlap × seniority × location × recency
- **SQLite** — local user profiles + saved jobs with status tracking

## Quick start (local)

```bash
git clone https://github.com/your-user/job-search.git
cd job-search
cp .env.example .env   # fill in LinkedIn credentials (see below)
npm install
npm run dev            # starts on http://localhost:3000
```

Open http://localhost:3000 in your browser.

## LinkedIn app setup (required for login)

1. Go to [developer.linkedin.com](https://developer.linkedin.com/apps) → **Create app**
2. Products → request **Sign In with LinkedIn using OpenID Connect**
3. Auth tab → Authorized redirect URLs → add:
   - `http://localhost:3000/auth/callback` (local)
   - `https://your-app.up.railway.app/auth/callback` (production)
4. Copy **Client ID** and **Client Secret** into your `.env`

## Deploy to Railway (free tier, installable on phone)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New project → Deploy from GitHub repo
3. Add these environment variables in Railway:
   ```
   LINKEDIN_CLIENT_ID=...
   LINKEDIN_CLIENT_SECRET=...
   REDIRECT_URI=https://your-app.up.railway.app/auth/callback
   SESSION_SECRET=<random 32-char string>
   NODE_ENV=production
   ```
4. Railway auto-deploys on every push. Your URL will be `https://your-app.up.railway.app`
5. Open that URL on your phone → browser menu → **Add to Home Screen** → installed!

## Profile data model

```js
{
  id:        "linkedin_sub_id",
  name:      "Jane Doe",
  email:     "jane@example.com",
  photo:     "https://media.licdn.com/...",
  headline:  "Senior Frontend Developer",
  skills:    ["React", "TypeScript", "Node.js"],
  prefs: {
    roles:     ["Frontend Developer", "React Developer"],
    locations: ["Remote", "London"],
    level:     "senior",
    remote:    true
  },
  lastVisit: "2025-06-19T10:00:00Z"   // used for 'new since last visit' badges
}
```

## Matching algorithm (`src/jobs.js → score()`)

| Signal | Points |
|---|---|
| Role word in job **title** | 22 per word |
| Role word in job **tags** | 10 per word |
| Role word in job **description** | 5 per word |
| Skill in title | 12 per skill |
| Skill in tags | 8 per skill |
| Skill in description | 4 per skill |
| Seniority match | 8 |
| Location match / remote | +4 bonus |
| Location miss | −4 penalty |
| Posted ≤ 7 days | +6 |
| Posted ≤ 30 days | +2 |
| Remote (when pref is remote-only) | +6 |

Raw score is normalized to 0–100, then bonuses/penalties are applied and clamped.

## Adding more job sources

Add a `fetchXxx()` function in `src/jobs.js` following the same interface, then include it in `fetchAll()`. Sources that don't have CORS headers need to be called from the server (which we already do — all fetching is backend-side).

## Roadmap ideas

- Cover letter draft (Claude API — add `ANTHROPIC_API_KEY` + `/api/cover-letter` endpoint)
- Email / push notifications for new matches (cron job via Railway + web push)
- Resume PDF upload → parse skills automatically
- More job sources (Adzuna, The Muse, HN Who's Hiring via Algolia)
