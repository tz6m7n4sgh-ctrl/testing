// Stage 1 — understand a person's public profile.
// Free mode (no keys): GitHub skill extraction + templated assessment.
// Upgrades automatically when BRAVE_API_KEY / ANTHROPIC_API_KEY are set.

const GH = 'https://api.github.com';

async function ghJson(path) {
  const headers = { 'User-Agent': 'JobScout', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const r = await fetch(GH + path, { headers, signal: AbortSignal.timeout(9_000) });
  if (!r.ok) throw new Error('GitHub ' + r.status);
  return r.json();
}

// Topic/keyword → display skill normalisation (small, extend over time)
const SKILL_MAP = {
  js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', typescript: 'TypeScript',
  nodejs: 'Node.js', node: 'Node.js', reactjs: 'React', react: 'React', vue: 'Vue',
  python: 'Python', go: 'Go', golang: 'Go', java: 'Java', csharp: 'C#', php: 'PHP',
  docker: 'Docker', kubernetes: 'Kubernetes', aws: 'AWS', sql: 'SQL', graphql: 'GraphQL',
  'next.js': 'Next.js', nextjs: 'Next.js', css: 'CSS', html: 'HTML', rust: 'Rust'
};
const norm = s => SKILL_MAP[String(s).toLowerCase()] || (s ? s[0].toUpperCase() + s.slice(1) : s);

// Real, free: find a GitHub user by name and derive skills from repos.
export async function extractFromGitHub(name) {
  const search = await ghJson(`/search/users?q=${encodeURIComponent(name)}+type:user&per_page=1`).catch(() => null);
  const login = search?.items?.[0]?.login;
  if (!login) return null;

  const [user, repos] = await Promise.all([
    ghJson(`/users/${login}`).catch(() => ({})),
    ghJson(`/users/${login}/repos?sort=pushed&per_page=30`).catch(() => [])
  ]);

  const langs = {}, topics = new Set();
  (repos || []).forEach(r => {
    if (r.language) langs[r.language] = (langs[r.language] || 0) + 1;
    (r.topics || []).forEach(t => topics.add(t));
  });
  const skills = [...new Set([...Object.keys(langs), ...topics].map(norm))].slice(0, 20);

  return {
    login,
    url: user.html_url || `https://github.com/${login}`,
    bio: user.bio || '',
    location: user.location || '',
    repoCount: user.public_repos || 0,
    followers: user.followers || 0,
    skills,
    source: { id: 'gh', ic: '🐙', name: 'GitHub', confirmed: true,
              extract: `${user.public_repos || 0} repos · ${skills.slice(0, 4).join(', ') || 'activity'}` }
  };
}

// Web references — Brave Search if key present, else none (free mode).
export async function findWebReferences(name) {
  const key = process.env.BRAVE_API_KEY;
  if (!key) return [];
  try {
    const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(name)}&count=5`,
      { headers: { 'X-Subscription-Token': key, Accept: 'application/json' }, signal: AbortSignal.timeout(9_000) });
    if (!r.ok) throw new Error('Brave ' + r.status);
    const d = await r.json();
    return (d.web?.results || []).slice(0, 5).map(x => ({
      id: 'web-' + Buffer.from(x.url).toString('base64').slice(0, 8),
      ic: '🌐', name: new URL(x.url).hostname.replace('www.', ''),
      extract: (x.description || '').slice(0, 90), url: x.url, confirmed: false
    }));
  } catch { return []; }
}

// Templated, signal-based assessment (Claude upgrade is a TODO when key present).
export function buildAssessment({ name, skills, gh }) {
  let presence = 30;
  if (gh) presence += Math.min(35, (gh.repoCount || 0) * 2 + (gh.followers || 0));
  if (skills.length >= 5) presence += 10;
  if (gh?.bio) presence += 8;
  presence = Math.max(0, Math.min(100, presence));

  const suggestions = [];
  if (!gh) suggestions.push('Create a GitHub profile to showcase your work');
  if (gh && !gh.bio) suggestions.push('Add a bio to your GitHub profile');
  if (skills.length < 5) suggestions.push('Add more projects so we can detect more skills');
  suggestions.push('Keep your LinkedIn headline aligned with your target role');

  const summary = gh
    ? `We found a public GitHub presence for "${name}" with ${gh.repoCount} repositories. Your work signals strengths in ${skills.slice(0, 3).join(', ') || 'software'}.`
    : `We couldn't find much public technical footprint for "${name}" yet. Adding a GitHub profile or uploading your CV will strengthen your profile.`;

  return { presence, summary, suggestions: suggestions.slice(0, 4) };
}

// Orchestrator used by /api/understand.
export async function understand({ name }) {
  const gh = await extractFromGitHub(name).catch(() => null);
  const web = await findWebReferences(name);

  const sources = [];
  if (gh) sources.push(gh.source);
  sources.push(...web);

  const skills = gh?.skills || [];
  return {
    sources,
    skills,
    headline: gh?.bio || '',
    location: gh?.location || '',
    experience: [],
    assessment: buildAssessment({ name, skills, gh }),
    upgraded: { webSearch: !!process.env.BRAVE_API_KEY, ai: !!process.env.ANTHROPIC_API_KEY }
  };
}

// Free-mode CV parsing from extracted text (regex). Claude upgrade is a TODO with key.
export function parseCVText(text) {
  const t = String(text || '').slice(0, 20_000);
  const email = (t.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0] || '';
  const phone = (t.match(/(\+?\d[\d\s().-]{7,}\d)/) || [])[0] || '';
  const eduMatch = t.match(/\b(B\.?Sc|BSc|Bachelor|M\.?Sc|MSc|Master|PhD|Diploma)[^\n,.;]{0,60}/i);
  const education = eduMatch ? [{ degree: eduMatch[0].trim(), src: 'cv' }] : [];
  const skills = Object.values(SKILL_MAP)
    .filter((v, i, a) => a.indexOf(v) === i)
    .filter(s => new RegExp(`\\b${s.replace(/[.+]/g, '\\$&')}\\b`, 'i').test(t));
  return {
    phone: phone.trim(),
    email,
    education,
    skills: [...new Set(skills)].slice(0, 20)
  };
}
