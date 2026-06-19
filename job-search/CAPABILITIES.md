# Capabilities: Free vs Premium, Approach & Recommendation

Each capability the app needs, whether it's free or costs money, the technical approach, and the recommended choice. Costs assume **personal use first** (you), scaling notes where relevant.

Legend: 🟢 Free · 🟡 Freemium (free tier, paid above limits) · 🔴 Paid

---

## Identity & hosting
| Capability | Cost | Approach | Recommendation |
|---|---|---|---|
| **LinkedIn login (OIDC)** | 🟢 Free | "Sign in with LinkedIn (OpenID Connect)" — returns name, email, photo only | ✅ Use it for identity + basics |
| **Backend hosting** | 🟡 Freemium | Railway / Render / Fly.io free tier | ✅ Railway free tier to start |
| **Database** | 🟢→🟡 | SQLite (free, file) now; Postgres free tier (Supabase/Neon) if many users | ✅ SQLite now, migrate later if needed |
| **HTTPS / subdomain** | 🟢 Free | Railway gives free `*.up.railway.app` + TLS | ✅ Free subdomain; custom domain ~$10/yr optional |
| **Sessions / auth** | 🟢 Free | express-session + secure cookies | ✅ Already built |

## Job data (UAE focus)
| Capability | Cost | Approach | Recommendation |
|---|---|---|---|
| **Remotive / Arbeitnow / Himalayas** | 🟢 Free | Public APIs, no key | ✅ Always on (remote roles) |
| **HN "Who's Hiring" (Algolia)** | 🟢 Free | Algolia public API | ✅ Add for tech roles |
| **JSearch (Google for Jobs: Bayt, Indeed, LinkedIn, GulfTalent)** | 🟡 ~200 free/mo | RapidAPI key, server-side | ✅ **Best for UAE** — use free tier + cache hard |
| **Adzuna** | 🟡 Free w/ key | No UAE coverage | ⏭️ Skip for UAE |
| **LinkedIn job scraping** | 🔴 / against ToS | — | ❌ Don't — use JSearch instead |

## AI features (the "agent" brain)
| Capability | Cost | Approach | Recommendation |
|---|---|---|---|
| **Match scoring** | 🟢 Free | Rules-based (already built) | ✅ Free baseline, works well |
| **Semantic matching** | 🔴 cheap | Embeddings (Claude/OpenAI) or local model | 🟡 Add later only if rules feel weak |
| **Profile sentiment / "how you look" summary** | 🔴 cheap | Claude (Haiku) summarizes web findings | ✅ Claude Haiku — pennies per run |
| **Cover-letter / CV tailoring** | 🔴 cheap | Claude per job | ✅ Claude Haiku, on-demand only |
| **Resume PDF → skills** | 🟢+🔴 | Free text extract + Claude to structure | ✅ Hybrid |

## Profile assessment (public presence)
| Capability | Cost | Approach | Recommendation |
|---|---|---|---|
| **Web search about your name** | 🟡 Free tier | Brave Search API (~2k/mo free) or Tavily (free tier) | ✅ Brave/Tavily free tier |
| **GitHub presence** | 🟢 Free | GitHub REST API | ✅ Use it (great dev signal) |
| **Email presence lookup** | 🟡/🔴 | Hunter.io / EmailRep — privacy-sensitive | ⚠️ Optional, low priority |
| **Photo "professional?" scoring** | 🔴 cheap | Claude vision on the LinkedIn photo | 🟡 Nice-to-have, add later |
| **Reverse image search** | 🔴 | TinEye API (paid); no good free option | ❌ Skip |

## Notifications & extras
| Capability | Cost | Approach | Recommendation |
|---|---|---|---|
| **New-match push notifications** | 🟢 Free | Web Push (VAPID) + cron on Railway | 🟡 Add after core works |
| **Email alerts** | 🟡 Free tier | Resend / Brevo free tier | 🟡 Alternative to push |
| **PWA install on phone** | 🟢 Free | manifest + service worker (built) | ✅ Done |

---

## Recommended approach — tiered

**Tier 0 — Free MVP (start here):** LinkedIn login + free job feeds + JSearch free tier (UAE) + rules-based matching + SQLite + Railway free. Cost: **$0/mo**. The profile assessment uses templated output (no AI) at this tier.

**Tier 1 — Free + a few $ of AI (recommended sweet spot):** Tier 0 **+ Claude Haiku** for the profile sentiment summary, cover letters, and resume parsing **+ Brave/Tavily free search** for public-presence findings. For personal use this is **~a few dollars/month or less** (pennies per AI call; cache results).

**Tier 2 — Scale (only if it grows / multi-user):** paid search volume, semantic embeddings, Claude vision for photos, Postgres, push notifications, custom domain.

### Bottom line
- Almost everything except the **LLM calls** and **high-volume search/job APIs** is **free**.
- The only meaningful spend is **Claude (Haiku)** — and for one user it's tiny. Caching keeps it near-zero.
- Recommended path: **build Tier 0 free, then turn on Tier 1 AI features one at a time** as we convert the demo into the app.
