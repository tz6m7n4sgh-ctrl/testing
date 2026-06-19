// Extract a usable profile from raw resume text. Deliberately simple and
// transparent (a curated skill dictionary + light heuristics). This is the
// other natural seam for an LLM: a model could extract skills, seniority,
// and a headline far better — see README "Adding Claude".

const SKILL_DICTIONARY = [
  // languages
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'golang', 'rust', 'ruby',
  'php', 'swift', 'kotlin', 'scala', 'r', 'sql', 'bash', 'dart',
  // web / frontend
  'react', 'next.js', 'nextjs', 'vue', 'angular', 'svelte', 'html', 'css', 'tailwind',
  'redux', 'graphql', 'rest', 'node.js', 'nodejs', 'express', 'django', 'flask', 'spring',
  'rails', 'laravel', '.net', 'fastapi',
  // data / ml
  'pandas', 'numpy', 'pytorch', 'tensorflow', 'scikit-learn', 'spark', 'hadoop', 'airflow',
  'tableau', 'power bi', 'looker', 'dbt', 'snowflake', 'bigquery',
  // cloud / devops
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ansible', 'jenkins',
  'ci/cd', 'linux', 'git', 'kafka', 'redis', 'postgresql', 'postgres', 'mysql', 'mongodb',
  // design / product
  'figma', 'sketch', 'product management', 'agile', 'scrum', 'jira', 'ux', 'ui',
  // business
  'sales', 'marketing', 'seo', 'salesforce', 'hubspot', 'excel', 'accounting',
];

const LEVELS = [
  ['lead', ['lead', 'principal', 'staff', 'head of', 'director', 'vp ']],
  ['senior', ['senior', 'sr.', 'sr ']],
  ['mid', ['mid-level', 'mid level']],
  ['junior', ['junior', 'jr.', 'entry level', 'graduate']],
  ['intern', ['intern', 'internship']],
];

export function parseResume(text = '') {
  const lower = text.toLowerCase();

  const skills = [];
  for (const s of SKILL_DICTIONARY) {
    // word-ish boundary match
    // leading boundary keeps "." attached (so node.js isn't split); trailing
    // boundary treats "." as an end (so "Docker." / "GraphQL." still match).
    const re = new RegExp(`(^|[^a-z0-9.+#])${escapeRe(s)}([^a-z0-9+#]|$)`, 'i');
    if (re.test(lower)) skills.push(prettySkill(s));
  }

  let level = '';
  for (const [name, words] of LEVELS) {
    if (words.some((w) => lower.includes(w))) { level = name; break; }
  }

  // headline guess: first non-empty line that looks like a title
  const headline =
    (text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 3 && l.length < 90) || '');

  return { skills: [...new Set(skills)], level, headline };
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function prettySkill(s) {
  const map = {
    javascript: 'JavaScript', typescript: 'TypeScript', nodejs: 'Node.js', 'node.js': 'Node.js',
    nextjs: 'Next.js', 'next.js': 'Next.js', aws: 'AWS', gcp: 'GCP', sql: 'SQL', 'ci/cd': 'CI/CD',
    css: 'CSS', html: 'HTML', ux: 'UX', ui: 'UI', seo: 'SEO', golang: 'Go',
    graphql: 'GraphQL', 'power bi': 'Power BI',
  };
  return map[s] || s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Best-effort PDF -> text. Uses optional dependency; returns null if unavailable.
export async function pdfToText(buffer) {
  try {
    const mod = await import('pdf-parse');
    const pdf = mod.default || mod;
    const out = await pdf(buffer);
    return out.text || '';
  } catch (e) {
    console.warn('[resume] pdf-parse unavailable:', e.message);
    return null;
  }
}
