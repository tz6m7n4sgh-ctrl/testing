# JobAgent 🎯

A **multi-user job-search agent** as an installable web app (PWA). Sign in (LinkedIn or guest), build a profile that's **seeded from your login and enriched by your resume**, then search live job feeds and get results **ranked to you**. Saved jobs and profile sync per account, so it works across devices and multiple people can each have their own login.

> Built after researching how real job/candidate agents work (AIHawk, career-ops, resume-screening agents). Like them, matching is driven by a **profile + resume**, not raw keywords — and the matching/extraction steps are isolated so an LLM (Claude) can be dropped in later.

## Features
- **Accounts**: "Sign in with LinkedIn" (OpenID Connect) **+** a built-in guest login so you can use it before registering a LinkedIn app.
- **Profile seeded from LinkedIn**: name, email, photo (that's all LinkedIn gives normal apps — see *LinkedIn note* below).
- **Resume enrichment**: paste resume text or upload a file → skills + seniority auto-extracted.
- **Live job search**: aggregates free feeds (Remotive, Arbeitnow) server-side (no browser CORS issues; ready for API-key sources).
- **Ranked matches** with a transparent score + "why this fits", plus a **NEW** badge for jobs posted since your last visit.
- **Saved jobs** per account; **installable PWA** (add to home screen on your phone).

## Run locally
```bash
cd job-agent
npm install
cp .env.example .env        # edit values (works out-of-the-box for guest login)
npm start                   # http://localhost:3000
```
Open `http://localhost:3000`, click **Continue as guest**, add a role/skills, and **Search**. No LinkedIn setup needed to try it.

## Enable "Sign in with LinkedIn"
1. Create an app at https://www.linkedin.com/developers/apps
2. Add the **"Sign In with LinkedIn using OpenID Connect"** product.
3. Set **Authorized redirect URL** to `‹BASE_URL›/auth/linkedin/callback`
   (e.g. `http://localhost:3000/auth/linkedin/callback`).
4. Put the Client ID/Secret and your `BASE_URL` in `.env`, restart. The LinkedIn button appears automatically.

### LinkedIn note (important)
LinkedIn's public OIDC scopes return **only name, email, and profile picture** — *not* work history or skills. Full-profile access requires LinkedIn's **Partner Program** (approval-gated, not open to general apps), and scraping violates their terms. That's why JobAgent seeds identity from LinkedIn and gets the rich stuff (skills, seniority) from your **resume**.

## Deploy it to your phone
It needs to be served from a URL to install as a PWA. Any Node host works:
- **Render / Railway / Fly.io**: deploy this folder, set the env vars from `.env.example`, set `BASE_URL` to the public URL, and update the LinkedIn redirect URL to match.
- Then open the URL on your phone → browser menu → **Add to Home Screen**.

## Architecture
```
server.js            Express app: auth, profile, jobs, saved, static PWA
src/auth.js          Signed-cookie sessions + LinkedIn OIDC flow
src/store.js         JSON-file persistence (swap for SQLite/Postgres later)
src/jobs.js          Feed aggregation + transparent rules-based scoring
src/resume.js        Resume → skills/seniority extraction (+ optional PDF)
public/              PWA: index.html, app.js, styles.css, sw.js, manifest
```

## Adding Claude (optional, later)
Two natural seams, both server-side so your API key stays secret:
- **`src/jobs.js` → fit reasoning**: replace/augment `scoreJob` with a call to Claude that reasons about the resume vs. each job description and returns a score + rationale (this is how career-ops/AIHawk get better-than-keyword matching).
- **`src/resume.js` → extraction**: have Claude extract skills, seniority, and a headline from the resume far more accurately than the dictionary heuristic.

Add `@anthropic-ai/sdk`, read `ANTHROPIC_API_KEY` from env, and call from the server. Never call the model from the browser.

## Roadmap
- More sources (Hacker News "Who is hiring" via Algolia, The Muse, Adzuna/USAJobs with keys).
- **Background match alerts** (push notifications) via a scheduled server job + Web Push.
- **Recruiter mode**: candidate profiles + search (the two-sided design the research covered).
- Application tracking (applied / interviewing / offer) and cover-letter drafting.

## Notes / limitations
- The JSON store is single-instance; use a real DB for multi-instance hosting.
- Free feeds skew remote/tech/EU. Add keyed sources for broader coverage.
