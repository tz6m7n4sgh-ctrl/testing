// Server-side job aggregation + matching. Runs on the server so we avoid
// browser CORS limits and can add API-key sources later without exposing keys.

function stripHtml(html = '') {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const normTags = (arr) => (arr || []).filter(Boolean).map((t) => String(t).toLowerCase());

/* ---------------- sources (free, no key) ---------------- */
async function fetchRemotive(query) {
  const url =
    'https://remotive.com/api/remote-jobs' +
    (query ? `?search=${encodeURIComponent(query)}&limit=100` : '?limit=100');
  const r = await fetch(url);
  if (!r.ok) throw new Error('Remotive ' + r.status);
  const data = await r.json();
  return (data.jobs || []).map((j) => ({
    id: 'rmtv-' + j.id,
    title: j.title || '',
    company: j.company_name || '',
    location: j.candidate_required_location || 'Remote',
    remote: true,
    type: j.job_type || '',
    posted: j.publication_date ? new Date(j.publication_date).getTime() : null,
    url: j.url,
    tags: normTags(j.tags).concat(j.category ? [String(j.category).toLowerCase()] : []),
    description: stripHtml(j.description || ''),
    source: 'Remotive',
  }));
}

async function fetchArbeitnow() {
  const r = await fetch('https://www.arbeitnow.com/api/job-board-api');
  if (!r.ok) throw new Error('Arbeitnow ' + r.status);
  const data = await r.json();
  return (data.data || []).map((j) => ({
    id: 'arbn-' + (j.slug || j.url),
    title: j.title || '',
    company: j.company_name || '',
    location: j.location || '',
    remote: !!j.remote,
    type: (j.job_types || []).join(', '),
    posted: j.created_at ? j.created_at * 1000 : null,
    url: j.url,
    tags: normTags(j.tags).concat(normTags(j.job_types)),
    description: stripHtml(j.description || ''),
    source: 'Arbeitnow',
  }));
}

/* ---------------- matching (transparent, rules-based) ----------------
   Profiles carry role + skills + keywords + level + resumeText. The resume
   text feeds the haystack so experience signals count even when not listed
   as explicit skills. This is the seam where an LLM "fit reasoner" can plug
   in later (see rankWithAI stub in the README). */
const tok = (s) => (s || '').toLowerCase().match(/[a-z0-9.+#]+/g) || [];

export function scoreJob(job, p) {
  const title = (job.title || '').toLowerCase();
  const tagText = job.tags.join(' ');
  const desc = (job.description || '').toLowerCase();
  const hay = `${title} ${tagText} ${desc}`;
  let raw = 0,
    max = 0;
  const reasons = [];

  const roleWords = [...new Set(tok(p.role))].filter((w) => w.length > 2);
  roleWords.forEach((w) => {
    max += 22;
    if (title.includes(w)) raw += 22;
    else if (tagText.includes(w)) raw += 10;
    else if (desc.includes(w)) raw += 5;
  });
  if (roleWords.length) {
    const hit = roleWords.filter((w) => title.includes(w)).length;
    if (hit) reasons.push(`Title matches your role (${hit}/${roleWords.length})`);
  }

  const skillHits = [];
  (p.skills || []).forEach((s) => {
    const w = s.toLowerCase();
    max += 12;
    if (title.includes(w)) { raw += 12; skillHits.push(s); }
    else if (tagText.includes(w)) { raw += 8; skillHits.push(s); }
    else if (desc.includes(w)) { raw += 4; skillHits.push(s); }
  });
  if (skillHits.length) reasons.push(`Skills: ${[...new Set(skillHits)].slice(0, 6).join(', ')}`);

  let kwMissing = 0;
  (p.keywords || []).forEach((k) => {
    const w = k.toLowerCase();
    max += 8;
    if (hay.includes(w)) raw += 8;
    else kwMissing++;
  });

  if (p.level) {
    max += 8;
    const map = {
      intern: ['intern', 'internship'],
      junior: ['junior', 'entry', 'graduate'],
      mid: ['mid', 'intermediate'],
      senior: ['senior', 'sr.', 'sr '],
      lead: ['lead', 'principal', 'staff', 'head'],
    };
    if ((map[p.level] || []).some((t) => hay.includes(t))) {
      raw += 8;
      reasons.push(`Seniority: ${p.level}`);
    }
  }

  let pct = max > 0 ? Math.round((100 * raw) / max) : 0;

  if (p.remoteOnly && job.remote) pct += 6;
  if (p.location) {
    const lw = p.location.toLowerCase();
    if ((job.location || '').toLowerCase().includes(lw) || job.remote) {
      pct += 4;
      reasons.push('Location fits');
    } else pct -= 8;
  }
  if (job.posted) {
    const days = (Date.now() - job.posted) / 864e5;
    if (days <= 7) { pct += 6; reasons.push('Posted this week'); }
    else if (days <= 30) pct += 2;
  }
  if (kwMissing > 0) reasons.push(`Missing keyword(s): ${kwMissing}`);

  pct = Math.max(0, Math.min(100, pct));
  return { score: pct, reasons };
}

/* ---------------- orchestration ---------------- */
export async function searchJobs(profile) {
  const query = profile.role || (profile.skills && profile.skills[0]) || '';
  const settled = await Promise.allSettled([fetchRemotive(query), fetchArbeitnow()]);
  let all = [];
  const ok = [], failed = [];
  settled.forEach((res, i) => {
    const name = ['Remotive', 'Arbeitnow'][i];
    if (res.status === 'fulfilled') { all = all.concat(res.value); ok.push(name); }
    else { failed.push(name); console.warn('[jobs]', name, res.reason?.message); }
  });

  // de-dupe
  const seen = new Set();
  all = all.filter((j) => {
    const k = (j.title + '|' + j.company).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (profile.remoteOnly) all = all.filter((j) => j.remote);

  const since = profile.lastSeenAt || 0;
  const scored = all
    .map((j) => {
      const m = scoreJob(j, profile);
      return { ...j, ...m, isNew: j.posted ? j.posted > since : false };
    })
    .filter((j) => j.score > 0)
    .sort((a, b) => b.score - a.score);

  return { jobs: scored, sources: { ok, failed } };
}
