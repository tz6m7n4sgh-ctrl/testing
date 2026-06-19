'use strict';
/* JobScout — static PREVIEW (mock data, no backend). Demonstrates the full flow:
   login → onboarding → agent search → dashboard. CSP-strict: no inline handlers. */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };

/* ── Profile (seeded; editable in onboarding) ── */
const profile = {
  name: 'Ahmed Al Mansoori', email: 'ahmed@example.com',
  role: 'Frontend Developer', location: 'Dubai', remote: true,
  skills: ['React', 'TypeScript', 'JavaScript'], level: 'mid'
};

const ROLE_CHIPS = ['Frontend Developer','Backend Engineer','Full Stack','Data Analyst','Product Manager','UX Designer','DevOps','Accountant'];
const LOC_CHIPS  = ['Dubai','Abu Dhabi','Sharjah','United Arab Emirates','Remote'];
const SKILL_SUGGESTIONS = ['React','TypeScript','JavaScript','Node.js','Python','SQL','AWS','Figma','Vue','CSS','Docker','Next.js'];

/* ── Mock UAE jobs ── */
const JOBS = [
  { id:'1', title:'Senior Frontend Developer', company:'Careem', location:'Dubai, UAE', remote:false, type:'Full-time', salary:'AED 28,000–36,000', days:1,  tags:['react','typescript','javascript','next.js','css'] },
  { id:'2', title:'Frontend Engineer (React)', company:'Noon', location:'Dubai, UAE', remote:true, type:'Full-time', salary:'AED 22,000–30,000', days:2,  tags:['react','javascript','redux','css'] },
  { id:'3', title:'Full Stack Developer', company:'Emirates NBD', location:'Dubai, UAE', remote:false, type:'Full-time', salary:'AED 25,000–32,000', days:3,  tags:['react','node.js','typescript','sql'] },
  { id:'4', title:'React Developer', company:'Talabat', location:'Dubai, UAE', remote:true, type:'Full-time', salary:'AED 20,000–27,000', days:1,  tags:['react','typescript','graphql'] },
  { id:'5', title:'UI Engineer', company:'Property Finder', location:'Dubai, UAE', remote:false, type:'Full-time', salary:'AED 24,000–30,000', days:5,  tags:['javascript','vue','css','figma'] },
  { id:'6', title:'Senior Software Engineer', company:'e& (Etisalat)', location:'Abu Dhabi, UAE', remote:false, type:'Full-time', salary:'AED 30,000–40,000', days:4,  tags:['java','spring','sql','aws'] },
  { id:'7', title:'Frontend Developer', company:'Bayut', location:'Dubai, UAE', remote:true, type:'Full-time', salary:'AED 18,000–24,000', days:2,  tags:['react','javascript','css'] },
  { id:'8', title:'Mobile Developer (React Native)', company:'Tabby', location:'Dubai, UAE', remote:true, type:'Full-time', salary:'AED 23,000–31,000', days:6,  tags:['react','typescript','react native'] },
  { id:'9', title:'Backend Engineer', company:'Kitopi', location:'Dubai, UAE', remote:false, type:'Full-time', salary:'AED 22,000–29,000', days:8,  tags:['node.js','python','aws','docker'] },
  { id:'10', title:'Lead Frontend Engineer', company:'Chalhoub Group', location:'Dubai, UAE', remote:false, type:'Full-time', salary:'AED 35,000–45,000', days:9,  tags:['react','typescript','next.js','team lead'] },
  { id:'11', title:'Web Developer', company:'Dubizzle', location:'Dubai, UAE', remote:true, type:'Full-time', salary:'AED 16,000–22,000', days:3,  tags:['javascript','php','css'] },
  { id:'12', title:'Software Engineer - Frontend', company:'ADNOC', location:'Abu Dhabi, UAE', remote:false, type:'Full-time', salary:'AED 26,000–34,000', days:12, tags:['react','typescript','aws'] },
  { id:'13', title:'Product Designer', company:'Aramex', location:'Dubai, UAE', remote:false, type:'Full-time', salary:'AED 20,000–26,000', days:7,  tags:['figma','ui','ux'] },
  { id:'14', title:'Senior React Developer', company:'Mashreq', location:'Dubai, UAE', remote:true, type:'Full-time', salary:'AED 27,000–35,000', days:2,  tags:['react','typescript','redux','node.js'] }
];

const saved = new Set();

/* ── Flow ── */
function showView(id) {
  $$('.view').forEach(v => v.classList.toggle('active', v.id === id));
  window.scrollTo(0, 0);
}

function initials(name) { return (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

$('#loginBtn').onclick = () => runAgentScreen(
  'Assessing your public profile…',
  'Searching what the web publicly shows about you',
  [`Searching "${profile.name}" on the web`, 'Checking email & username presence',
   'Analyzing your profile photo', 'Scanning LinkedIn, GitHub & social', 'Computing presence & sentiment'],
  showAssessment
);

/* ── Onboarding ── */
let _skills = [];
function setupOnboarding() {
  $('#onbInitials').textContent = initials(profile.name);
  $('#onbName').textContent     = profile.name.split(' ')[0];
  $('#onbCName').textContent    = profile.name;
  $('#onbCEmail').textContent   = profile.email;

  let step = 1;
  const go = n => {
    step = n;
    $$('#v-onboarding .onb-step').forEach(s => s.classList.toggle('active', +s.dataset.step === n));
    $$('#v-onboarding .onb-dot').forEach((d, i) => d.classList.toggle('active', i < n));
  };
  $$('#v-onboarding [data-next]').forEach(b => b.onclick = () => go(Math.min(3, step + 1)));
  $$('#v-onboarding [data-back]').forEach(b => b.onclick = () => go(Math.max(1, step - 1)));

  chips('#onbRoleChips', ROLE_CHIPS, '#onbRole');
  chips('#onbLocChips',  LOC_CHIPS,  '#onbLoc');

  _skills = [...profile.skills];
  skillInput();

  $('#onbFinish').onclick = () => {
    profile.role     = $('#onbRole').value.trim() || profile.role;
    profile.location = $('#onbLoc').value.trim() || profile.location;
    profile.remote   = $('#onbRemote').checked;
    profile.skills   = _skills;
    profile.level    = $('#onbLevel').value;
    runAgent();
  };
}

function chips(boxSel, list, inputSel) {
  const box = $(boxSel), input = $(inputSel);
  box.innerHTML = '';
  list.forEach(c => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'onb-chip' + (input.value === c ? ' on' : '');
    el.textContent = c;
    el.onclick = () => { input.value = c; [...box.children].forEach(x => x.classList.remove('on')); el.classList.add('on'); };
    box.appendChild(el);
  });
}

function skillInput() {
  const input = $('#onbSkill'), tags = $('#onbSkillTags');
  const renderTags = () => {
    tags.innerHTML = '';
    _skills.forEach((s, i) => {
      const el = document.createElement('span');
      el.className = 'onb-tag'; el.innerHTML = '<b></b><button>×</button>';
      el.querySelector('b').textContent = s;
      el.querySelector('button').onclick = () => { _skills.splice(i, 1); renderTags(); renderSug(); };
      tags.appendChild(el);
    });
  };
  const renderSug = () => {
    const box = $('#onbSkillSuggest'); box.innerHTML = '';
    SKILL_SUGGESTIONS.filter(s => !_skills.some(x => x.toLowerCase() === s.toLowerCase()))
      .slice(0, 8).forEach(s => {
        const el = document.createElement('span');
        el.className = 'onb-tag suggest'; el.textContent = '+ ' + s;
        el.onclick = () => { _skills.push(s); renderTags(); renderSug(); };
        box.appendChild(el);
      });
  };
  input.onkeydown = e => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();
      const v = input.value.trim();
      if (!_skills.some(x => x.toLowerCase() === v.toLowerCase())) _skills.push(v);
      input.value = ''; renderTags(); renderSug();
    }
  };
  renderTags(); renderSug();
}

/* ── Generic agent screen (reused for assessment + job search) ── */
function runAgentScreen(title, sub, tasks, onDone) {
  showView('v-agent');
  $('#agentTitle').textContent = title;
  $('#agentSub').textContent = sub;
  const box = $('#agentTasks'); box.innerHTML = '';
  const els = tasks.map(t => {
    const el = document.createElement('div');
    el.className = 'agent-task';
    el.innerHTML = `<span class="tick">✓</span><span>${esc(t)}</span>`;
    box.appendChild(el);
    return el;
  });
  let i = 0;
  const tick = () => {
    if (i < els.length) { els[i].classList.add('done'); i++; setTimeout(tick, 460); }
    else { $('#agentTitle').textContent = 'Done!'; $('#agentSub').textContent = 'One moment…'; setTimeout(onDone, 600); }
  };
  setTimeout(tick, 400);
}

function runAgent() {
  runAgentScreen('Scanning the UAE job market…', 'Searching live listings matched to your profile',
    ['Searching Bayt', 'Searching Indeed', 'Searching LinkedIn', 'Searching GulfTalent',
     `Matching ${JOBS.length} jobs to your profile`], showDashboard);
}

/* ── Profile assessment (mock public-presence analysis) ── */
const ASSESS = {
  presence: 78,
  sentiment: { pos: 82, neu: 15, neg: 3 },
  summary: 'Your professional presence is strong and consistent across platforms. You come across as an experienced frontend developer who is active in the Dubai tech community. Your name and photo are consistent everywhere, which builds trust with recruiters.',
  footprint: [
    { ic: '💼', name: 'LinkedIn', desc: 'Complete profile · 850+ connections', tag: 'pos' },
    { ic: '🐙', name: 'GitHub', desc: '24 public repos · active contributor', tag: 'pos' },
    { ic: '✍️', name: 'Medium', desc: '2 articles on React performance', tag: 'pos' },
    { ic: '🎤', name: 'GITEX Tech', desc: 'Listed as a speaker (2024)', tag: 'pos' },
    { ic: '🐦', name: 'X / Twitter', desc: 'Occasional posts · low activity', tag: 'neu' }
  ],
  photo: { score: '9/10', note: 'Professional headshot detected — clear, good lighting, professional attire. Great first impression.' },
  strengths: ['Consistent name across platforms', 'Active open-source presence', 'Thought leadership (articles)', 'Professional photo'],
  suggestions: ['Add a profile summary & pinned repos on GitHub', 'Post more regularly on LinkedIn', 'Add your GITEX talk to LinkedIn featured']
};

function ringGrad(s) {
  const color = s >= 70 ? '#00c78b' : s >= 50 ? '#2355f5' : '#f5a623';
  return `conic-gradient(${color} ${s * 3.6}deg, var(--soft) 0deg)`;
}

function showAssessment() {
  showView('v-assess');
  $('#asInitials').textContent = initials(profile.name);
  $('#asName').textContent = profile.name;
  $('#asMail').textContent = profile.email;

  const s = ASSESS;
  $('#assessBody').innerHTML = `
    <div class="score-row">
      <div class="score-card">
        <div class="big-ring" style="background:${ringGrad(s.presence)}">
          <div class="big-ring" style="width:64px;height:64px;background:var(--card)">
            <span class="rv">${s.presence}</span>
          </div>
        </div>
        <div class="cl">Presence score</div>
      </div>
      <div class="score-card">
        <div style="font-size:25px;font-weight:900;color:var(--accent-d);margin:8px 0 6px">${s.sentiment.pos}%</div>
        <div class="sent-bar">
          <i style="width:${s.sentiment.pos}%;background:var(--accent)"></i>
          <i style="width:${s.sentiment.neu}%;background:var(--warn)"></i>
          <i style="width:${s.sentiment.neg}%;background:var(--bad)"></i>
        </div>
        <div class="cl">Positive sentiment</div>
      </div>
    </div>

    <div class="acard">
      <h3>🪞 How you look</h3>
      <p class="summary-txt">${esc(s.summary)}</p>
    </div>

    <div class="acard">
      <h3>🌐 Public footprint</h3>
      ${s.footprint.map(f => `
        <div class="fp-item">
          <span class="fp-ic">${f.ic}</span>
          <div class="fp-main"><div class="fp-name">${esc(f.name)}</div><div class="fp-desc">${esc(f.desc)}</div></div>
          <span class="fp-tag ${f.tag}">${f.tag === 'pos' ? 'Positive' : 'Neutral'}</span>
        </div>`).join('')}
    </div>

    <div class="acard">
      <h3>📸 Profile photo</h3>
      <div class="photo-row">
        <div class="photo-thumb">${esc(initials(profile.name))}</div>
        <div class="photo-meta">
          <div class="photo-score">Score: ${esc(s.photo.score)}</div>
          <div class="fp-desc" style="margin-top:3px">${esc(s.photo.note)}</div>
        </div>
      </div>
    </div>

    <div class="acard">
      <h3>✅ Strengths</h3>
      <div class="tagwrap">${s.strengths.map(t => `<span class="gtag">${esc(t)}</span>`).join('')}</div>
    </div>

    <div class="acard">
      <h3>💡 Suggestions to stand out</h3>
      ${s.suggestions.map(t => `<div class="sg-item"><span class="sgi">→</span><span>${esc(t)}</span></div>`).join('')}
    </div>`;

  $('#assessContinue').onclick = () => { showView('v-onboarding'); setupOnboarding(); };
}

/* ── Matching (mirrors backend score()) ── */
function scoreJob(job) {
  const title = job.title.toLowerCase();
  const tagText = job.tags.join(' ');
  let raw = 0, max = 0; const reasons = [];

  const roleWords = [...new Set(profile.role.toLowerCase().split(/\s+/))].filter(w => w.length > 2);
  roleWords.forEach(w => { max += 22; if (title.includes(w)) raw += 22; else if (tagText.includes(w)) raw += 10; });
  const th = roleWords.filter(w => title.includes(w)).length;
  if (th) reasons.push(`Role match (${th}/${roleWords.length} in title)`);

  const hits = [];
  profile.skills.forEach(s => {
    const w = s.toLowerCase(); max += 12;
    if (title.includes(w)) { raw += 12; hits.push(s); }
    else if (tagText.includes(w)) { raw += 8; hits.push(s); }
  });
  if (hits.length) reasons.push(`Skills: ${[...new Set(hits)].slice(0, 4).join(', ')}`);

  if (profile.level) {
    max += 8;
    const map = { junior:['junior'], mid:['developer','engineer'], senior:['senior','sr'], lead:['lead','principal'] };
    if ((map[profile.level] || []).some(t => title.includes(t))) { raw += 8; reasons.push(`Seniority: ${profile.level}`); }
  }

  let pct = max > 0 ? Math.round(100 * raw / max) : 0;
  if (profile.remote && job.remote) pct += 6;
  if (profile.location && job.location.toLowerCase().includes(profile.location.toLowerCase())) { pct += 5; reasons.push('Location fits'); }
  if (job.days <= 7) { pct += 6; reasons.push('Posted this week'); }
  return { score: Math.max(0, Math.min(100, pct)), reasons, isNew: job.days <= 3 };
}

let scored = [];
function computeMatches() {
  scored = JOBS.map(j => ({ ...j, ...scoreJob(j) })).sort((a, b) => b.score - a.score);
}

/* ── Dashboard ── */
function showDashboard() {
  computeMatches();
  showView('v-dash');
  $('#dashInitials').textContent = initials(profile.name);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  $('#dashGreet').textContent = `${greet}, ${profile.name.split(' ')[0]} 👋`;
  $('#dashSub').textContent = `${scored.length} ${profile.role} jobs in ${profile.location}`;

  renderStats();
  renderTop();
  renderInsights();
  bindNav();
}

function renderStats() {
  const newCount = scored.filter(j => j.isNew).length;
  const top = scored[0]?.score || 0;
  const avg = avgSalary(scored);
  const stats = [
    { v: scored.length, l: 'Matches found', c: 'brand' },
    { v: newCount, l: 'New this week', c: 'accent' },
    { v: top + '%', l: 'Top match', c: 'brand' },
    { v: avg, l: 'Avg salary', c: 'warn' }
  ];
  $('#statRow').innerHTML = stats.map(s =>
    `<div class="stat ${s.c}"><div class="v">${esc(String(s.v))}</div><div class="l">${esc(s.l)}</div></div>`
  ).join('');
}

function avgSalary(list) {
  const nums = list.map(j => {
    const m = j.salary.match(/[\d,]+/g);
    if (!m) return null;
    return m.map(x => +x.replace(/,/g, '')).reduce((a, b) => a + b, 0) / m.length;
  }).filter(Boolean);
  if (!nums.length) return '—';
  return 'AED ' + Math.round(nums.reduce((a, b) => a + b, 0) / nums.length / 1000) + 'k';
}

function scoreGrad(s) {
  if (s >= 75) return 'linear-gradient(135deg,#00c78b,#009468)';
  if (s >= 50) return 'linear-gradient(135deg,#2355f5,#1640d1)';
  if (s >= 30) return 'linear-gradient(135deg,#f5a623,#d4851a)';
  return 'linear-gradient(135deg,#8a98ad,#6c7a90)';
}

function jobCard(j) {
  const isSaved = saved.has(j.id);
  const el = document.createElement('article');
  el.className = 'job';
  el.innerHTML = `
    ${j.isNew ? '<span class="new-pill">NEW</span>' : ''}
    <div class="j-top">
      <div class="score-ring" style="background:${scoreGrad(j.score)}">${j.score}<small>MATCH</small></div>
      <div class="j-meta">
        <div class="j-title">${esc(j.title)}</div>
        <div class="j-company">${esc(j.company)}</div>
      </div>
    </div>
    <div class="j-chips">
      ${j.remote ? '<span class="chip remote">🌐 Remote</span>' : ''}
      <span class="chip">📍 ${esc(j.location)}</span>
      <span class="chip sal">💰 ${esc(j.salary)}</span>
      <span class="chip">${j.days}d ago</span>
    </div>
    ${j.reasons.length ? `<div class="j-why"><b>Why this fits:</b> ${j.reasons.map(esc).join(' · ')}</div>` : ''}
    <div class="j-actions">
      <button class="j-apply">Apply →</button>
      <button class="j-save ${isSaved ? 'saved' : ''}">${isSaved ? '★' : '☆'}</button>
    </div>`;
  el.querySelector('.j-save').onclick = e => {
    if (saved.has(j.id)) saved.delete(j.id); else saved.add(j.id);
    const b = e.currentTarget;
    b.classList.toggle('saved'); b.textContent = saved.has(j.id) ? '★' : '☆';
  };
  return el;
}

function renderTop() {
  const box = $('#topMatches'); box.innerHTML = '';
  scored.slice(0, 3).forEach(j => box.appendChild(jobCard(j)));
}

function renderInsights() {
  // top skills in demand (tag frequency)
  const freq = {};
  JOBS.forEach(j => j.tags.forEach(t => freq[t] = (freq[t] || 0) + 1));
  const topSkills = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxF = topSkills[0]?.[1] || 1;

  // top hiring companies
  const cos = JOBS.slice(0, 5);

  const remoteCount = JOBS.filter(j => j.remote).length;
  const onsite = JOBS.length - remoteCount;

  $('#insights').innerHTML = `
    <div class="ins-block">
      <div class="ins-title">🔥 Most in-demand skills</div>
      ${topSkills.map(([s, n]) => `
        <div class="bar-row">
          <span class="bl">${esc(s)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${Math.round(100*n/maxF)}%"></span></span>
          <span class="bn">${n}</span>
        </div>`).join('')}
    </div>
    <div class="ins-block">
      <div class="ins-title">🏢 Companies hiring now</div>
      <div class="co-list">
        ${cos.map(c => `<div class="co"><span class="logo">${esc(initials(c.company))}</span><span class="cn">${esc(c.company)}</span><span class="cc">${esc(c.location.split(',')[0])}</span></div>`).join('')}
      </div>
    </div>
    <div class="ins-block">
      <div class="ins-title">📍 Remote vs on-site</div>
      <div class="split">
        <div class="sp"><div class="v" style="color:var(--accent-d)">${remoteCount}</div><div class="l">Remote-friendly</div></div>
        <div class="sp"><div class="v" style="color:var(--brand-d)">${onsite}</div><div class="l">On-site (UAE)</div></div>
      </div>
    </div>`;
}

function renderJobList() {
  $('#jobsCount').textContent = scored.length + ' jobs';
  const box = $('#jobList'); box.innerHTML = '';
  scored.forEach(j => box.appendChild(jobCard(j)));
}

/* ── Nav ── */
function bindNav() {
  const goTab = name => {
    if (name === 'dash2') { location.reload(); return; }
    $$('.bn-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $$('.tab-view').forEach(v => v.classList.toggle('active', v.id === 'tab-' + name));
    if (name === 'jobs') renderJobList();
    $('#scrollArea').scrollTo({ top: 0, behavior: 'smooth' });
  };
  $$('.bn-tab').forEach(b => b.onclick = () => goTab(b.dataset.tab));
  $('#viewAllBtn').onclick = () => goTab('jobs');
  $('#qaSearch').onclick = () => goTab('jobs');
  $('#qaSaved').onclick  = () => goTab('jobs');
  $('#qaProfile').onclick = () => { showView('v-onboarding'); setupOnboarding(); };
}
