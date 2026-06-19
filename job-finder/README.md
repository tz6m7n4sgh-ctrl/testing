# JobScout 🎯

A zero-backend web app that **finds live job listings and ranks them by how well they match your profile**. Built as a single static page — open it and go.

## What it does
- You enter a **desired role, skills, keywords, location, seniority** and an optional *remote-only* toggle.
- It pulls live listings from **free, CORS-friendly public job feeds**:
  - [Remotive](https://remotive.com/api-documentation) — remote tech/non-tech jobs
  - [Arbeitnow](https://www.arbeitnow.com/api) — EU + remote job board
- A transparent, **rules-based matching engine** scores every job 0–100 and shows *why* it matched.
- **Save** jobs (★) and they persist on your device. Sort by best match or newest.
- Everything is stored in your browser's `localStorage` — no account, no server, no tracking.

## Run it
It's fully static. Any of these work:

```bash
# from this folder
python3 -m http.server 8080
# then open http://localhost:8080
```

Or just open `index.html` directly in a browser. (A local server is recommended so the PWA manifest loads.)

## How matching works
See `scoreJob()` in `index.html`. Weights, briefly:
- **Role title words** are weighted highest (a match in the job *title* counts most).
- **Skills** match in title > tags > description.
- **Must-have keywords** add points; missing ones are flagged.
- **Seniority, location, and recency** apply bonuses/penalties.
- The raw score is normalized to 0–100 so it's comparable across profiles.

It's intentionally readable so you can tune the weights to your taste.

## Roadmap / ideas
- More sources (Hacker News "Who is hiring" via Algolia, The Muse, USAJobs).
- **Claude-powered matching & resume tips** — see the `rankWithAI()` stub. This needs a tiny backend proxy that holds your `ANTHROPIC_API_KEY` (never put an API key in client-side code). Ask and I'll wire it up.
- Application tracking, cover-letter drafting, interview prep.

## Notes / limitations
- Big boards like LinkedIn/Indeed don't offer free public APIs, so they're not included. The included feeds skew toward **remote and tech/EU** roles.
- If a feed is down or blocked by your network's CORS policy, JobScout degrades gracefully and tells you which source loaded.
