// Job fetching + hybrid matching engine
// Sources: Remotive, Arbeitnow, Himalayas — all free, CORS-friendly, no API key needed

function normTags(arr) {
  return (arr || []).filter(Boolean).map(t => String(t).toLowerCase().trim());
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchRemotive(query) {
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query || 'developer')}&limit=80`;
  const r = await fetch(url, { signal: AbortSignal.timeout(9_000) });
  if (!r.ok) throw new Error(`Remotive ${r.status}`);
  const d = await r.json();
  return (d.jobs || []).map(j => ({
    id:          'rmtv-' + j.id,
    title:       j.title || '',
    company:     j.company_name || '',
    location:    j.candidate_required_location || 'Remote',
    remote:      true,
    type:        j.job_type || '',
    salary:      j.salary || '',
    posted:      j.publication_date || null,
    url:         j.url,
    tags:        normTags(j.tags).concat(j.category ? [j.category.toLowerCase()] : []),
    description: stripHtml(j.description || ''),
    source:      'Remotive'
  }));
}

async function fetchArbeitnow() {
  const r = await fetch('https://www.arbeitnow.com/api/job-board-api', { signal: AbortSignal.timeout(9_000) });
  if (!r.ok) throw new Error(`Arbeitnow ${r.status}`);
  const d = await r.json();
  return (d.data || []).map(j => ({
    id:          'arbn-' + (j.slug || encodeURIComponent(j.title || '') + j.created_at),
    title:       j.title || '',
    company:     j.company_name || '',
    location:    j.location || '',
    remote:      !!j.remote,
    type:        (j.job_types || []).join(', '),
    salary:      '',
    posted:      j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
    url:         j.url,
    tags:        normTags(j.tags).concat(normTags(j.job_types)),
    description: stripHtml(j.description || ''),
    source:      'Arbeitnow'
  }));
}

async function fetchHimalayas(query) {
  const url = `https://himalayas.app/jobs/api?q=${encodeURIComponent(query || 'developer')}&limit=20`;
  const r = await fetch(url, { signal: AbortSignal.timeout(9_000) });
  if (!r.ok) throw new Error(`Himalayas ${r.status}`);
  const d = await r.json();
  return (d.jobs || []).map(j => ({
    id:          'hml-' + (j.id || j.slug),
    title:       j.title || '',
    company:     j.companyName || '',
    location:    (j.regions || ['Remote']).join(', '),
    remote:      true,
    type:        j.jobType || '',
    salary:      j.annualSalaryMin ? `$${j.annualSalaryMin.toLocaleString()}–$${(j.annualSalaryMax || j.annualSalaryMin).toLocaleString()}` : '',
    posted:      j.createdAt || null,
    url:         j.applicationLink || j.url || '',
    tags:        normTags(j.categories),
    description: stripHtml(j.description || ''),
    source:      'Himalayas'
  }));
}

// JSearch (RapidAPI) — aggregates Google for Jobs: Bayt, Indeed, LinkedIn, GulfTalent…
// Best source for UAE / Gulf on-site jobs. Requires RAPIDAPI_KEY, runs server-side only.
async function fetchJSearch(query, location) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return [];
  const q = location ? `${query || 'jobs'} in ${location}` : (query || 'jobs');
  const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(q)}&page=1&num_pages=1`;
  const r = await fetch(url, {
    headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' },
    signal: AbortSignal.timeout(9_000)
  });
  if (!r.ok) throw new Error(`JSearch ${r.status}`);
  const d = await r.json();
  return (d.data || []).map(j => ({
    id:          'jsr-' + j.job_id,
    title:       j.job_title || '',
    company:     j.employer_name || '',
    location:    [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', ') || 'Unspecified',
    remote:      !!j.job_is_remote,
    type:        j.job_employment_type || '',
    salary:      j.job_min_salary ? `${j.job_salary_currency || ''} ${j.job_min_salary.toLocaleString()}–${(j.job_max_salary || j.job_min_salary).toLocaleString()}`.trim() : '',
    posted:      j.job_posted_at_datetime_utc || null,
    url:         j.job_apply_link || '',
    tags:        normTags(j.job_required_skills).concat(j.job_job_title ? [] : []),
    description: stripHtml(j.job_description || ''),
    source:      'JSearch'
  }));
}

export async function fetchAll(query, location) {
  const sources = [
    ['Remotive',  fetchRemotive(query)],
    ['Arbeitnow', fetchArbeitnow()],
    ['Himalayas', fetchHimalayas(query)],
    ['JSearch',   fetchJSearch(query, location)]
  ];
  const results = await Promise.allSettled(sources.map(s => s[1]));

  results.forEach((r, i) => {
    if (r.status === 'rejected') console.warn(sources[i][0], r.reason?.message);
  });

  const all = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  // De-dupe by normalised title+company
  const seen = new Set();
  return all.filter(j => {
    const k = `${j.title}|${j.company}`.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* -------------------------------------------------------
   Hybrid matching engine (based on production patterns):
   - Role/title word match (highest weight)
   - Skill overlap: title > tags > description
   - Seniority alignment
   - Location / remote preference
   - Recency bonus
   All normalized to 0-100.
------------------------------------------------------- */
function tokens(str) {
  return (str || '').toLowerCase().match(/[a-z0-9.+#]+/g) || [];
}

export function score(job, user) {
  const title   = (job.title || '').toLowerCase();
  const tagText = job.tags.join(' ');
  const desc    = (job.description || '').toLowerCase();
  const hay     = `${title} ${tagText} ${desc}`;

  let raw = 0, max = 0;
  const reasons = [];

  // Role words
  const roleWords = [...new Set(
    (user.prefs?.roles || []).flatMap(r => tokens(r)).filter(w => w.length > 2)
  )];
  roleWords.forEach(w => {
    max += 22;
    if (title.includes(w))   raw += 22;
    else if (tagText.includes(w)) raw += 10;
    else if (desc.includes(w))    raw += 5;
  });
  const titleHits = roleWords.filter(w => title.includes(w)).length;
  if (titleHits) reasons.push(`Role match (${titleHits}/${roleWords.length} in title)`);

  // Skills (explicit + semantic weight)
  const skillHits = [];
  (user.skills || []).forEach(s => {
    const w = s.toLowerCase(); max += 12;
    if (title.includes(w))    { raw += 12; skillHits.push(s); }
    else if (tagText.includes(w)) { raw += 8;  skillHits.push(s); }
    else if (desc.includes(w))    { raw += 4;  skillHits.push(s); }
  });
  if (skillHits.length) reasons.push(`Skills: ${[...new Set(skillHits)].slice(0, 5).join(', ')}`);

  // Seniority
  const level = user.prefs?.level;
  if (level) {
    max += 8;
    const lvl = {
      intern: ['intern', 'internship'],
      junior: ['junior', 'entry', 'graduate'],
      mid:    ['mid', 'intermediate'],
      senior: ['senior', 'sr.', 'sr '],
      lead:   ['lead', 'principal', 'staff', 'head of']
    };
    if ((lvl[level] || []).some(t => hay.includes(t))) {
      raw += 8; reasons.push(`Seniority: ${level}`);
    }
  }

  // Normalize to 0-100
  let pct = max > 0 ? Math.round(100 * raw / max) : 0;

  // Remote bonus
  if (user.prefs?.remote && job.remote) pct += 6;

  // Location bonus/penalty
  (user.prefs?.locations || []).forEach(loc => {
    if ((job.location || '').toLowerCase().includes(loc.toLowerCase()) || job.remote) {
      pct += 4; reasons.push('Location fits');
    } else {
      pct -= 4;
    }
  });

  // Recency
  if (job.posted) {
    const days = (Date.now() - new Date(job.posted).getTime()) / 864e5;
    if (days <= 7)  { pct += 6; reasons.push('Posted this week'); }
    else if (days <= 30) pct += 2;
  }

  return { score: Math.max(0, Math.min(100, pct)), reasons };
}
