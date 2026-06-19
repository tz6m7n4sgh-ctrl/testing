# JobScout — Feature Roadmap

Status legend: ⬜ todo · 🔄 in progress · ✅ done

We tackle these **one at a time**, top to bottom. Each is sized: 🟢 quick (~1 session) · 🟡 medium · 🔴 large.

---

## Phase 1 — Quick wins (simple version, no backend)
High impact, low effort. Improves the version you're already using on your phone.

- ⬜ 🟢 **More job sources** — add Himalayas, The Muse, HN "Who's Hiring" (Algolia) for many more listings
- ⬜ 🟢 **Result filters** — filter by job type, date posted, salary, remote, and free-text within results
- ⬜ 🟢 **Job detail view** — tap a card to expand full description instead of leaving the app
- ⬜ 🟢 **"New since last visit" badges** — highlight jobs posted since you last opened it
- ⬜ 🟢 **Dark mode** — auto + manual toggle (nice on phone at night)
- ⬜ 🟢 **Share a job** — native share sheet via Web Share API
- ⬜ 🟢 **Pull-to-refresh & retry** — smoother mobile feel, graceful errors

## Phase 2 — Smarter matching
Make the ranking genuinely useful.

- ⬜ 🟡 **Must-have vs nice-to-have skills** — weight required skills harder, filter out hard misses
- ⬜ 🟡 **Exclude filters** — hide certain keywords, companies, or seniority levels
- ⬜ 🟡 **Score breakdown** — tap the match % to see exactly why it scored that
- ⬜ 🔴 **Semantic matching (AI)** — embeddings so "React" matches "frontend" etc. (needs backend + AI key)

## Phase 3 — Full version (LinkedIn + profiles + tracking)
Requires the `job-search/` backend deployed (Railway). This is the "real product".

- ⬜ 🟡 **Deploy the full version** — get LinkedIn login + saved jobs + profiles live on your phone
- ⬜ 🟡 **Application tracker upgrades** — notes, applied-date, follow-up reminders per job
- ⬜ 🟡 **Saved searches** — name a search and re-run it in one tap
- ⬜ 🔴 **Resume upload → auto-skills** — drop a PDF, auto-extract skills into your profile
- ⬜ 🔴 **Cover letter generator** — Claude drafts a tailored letter per job
- ⬜ 🔴 **New-match notifications** — email or push when fresh matches appear (cron + web push)

## Phase 4 — Polish & growth
- ⬜ 🟢 **Real PNG app icons** — crisper home-screen install on iOS/Android
- ⬜ 🟡 **Job-search stats** — dashboard: applications sent, response rate, pipeline funnel
- ⬜ 🟡 **Email magic-link login** — alternative to LinkedIn for people without it
- ⬜ 🔴 **Recruiter / candidate-search side** — two-sided: recruiters search candidate profiles

---

## Suggested starting order
1. More job sources (immediately more useful)
2. Result filters
3. Job detail view
4. Dark mode
5. Must-have skills weighting

_Pick any item and we'll build it next._
