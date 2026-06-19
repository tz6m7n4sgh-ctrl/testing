'use strict';
/* JobScout — real frontend wired to the backend.
   Flow: login (LinkedIn) or guest name → understand → profile → search → dashboard. */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC_MAP[c]);
// Only allow http(s) links (blocks javascript:/data: from external feeds)
const safeUrl = u => { try { const x = new URL(u, location.origin); return (x.protocol === 'http:' || x.protocol === 'https:') ? x.href : '#'; } catch { return '#'; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const initials = n => (n || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

const ROLE_CHIPS = ['Frontend Developer','Backend Engineer','Full Stack','Data Analyst','Product Manager','UX Designer','DevOps','Accountant'];
const LOC_CHIPS  = ['Dubai','Abu Dhabi','Sharjah','United Arab Emirates','Remote'];
const SKILL_SUGGESTIONS = ['React','TypeScript','JavaScript','Node.js','Python','SQL','AWS','Figma','Vue','CSS','Docker','Next.js'];

/* ── State ── */
let me = null;                 // /api/me (null until session)
let understood = null;         // /api/understand result
let target = { role: 'Frontend Developer', location: 'Dubai, UAE', remote: true };
let _skills = [];              // working skills (editable)
let edu = [], phone = '';      // from CV
let jobsCache = [], savedCache = [];
const state = { understood: false, extracted: false, cvParsed: false, searched: false };
const filters = { sort: 'match', remote: false, fresh: false, salary: false };

/* ── API helper ── */
async function api(path, method = 'GET', body) {
  const opts = { method, headers: {} };
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const r = await fetch(path, opts);
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
}

/* ── Views ── */
function showView(id) { $$('.view').forEach(v => v.classList.toggle('active', v.id === id)); window.scrollTo(0, 0); }

/* ── Init ── */
async function init() {
  const params = new URLSearchParams(location.search);
  if (params.get('auth')) history.replaceState({}, '', '/');

  me = await api('/api/me').catch(() => null);
  if (me) {
    target = {
      role: me.prefs?.roles?.[0] || target.role,
      location: me.prefs?.locations?.[0] || target.location,
      remote: me.prefs?.remote ?? true
    };
    _skills = me.skills || [];
    if (_skills.length || me.prefs?.roles?.length) { state.understood = true; await runSearch(); }
    else { await doUnderstand(); }
  } else {
    showView('v-login');
  }
  wireStatic();
}

function wireStatic() {
  $('#skipBtn').onclick = showGuest;
  $('#logoutBtn').onclick = async () => { await fetch('/auth/logout', { method: 'POST' }); location.href = '/'; };
  $('#modalBackdrop').onclick = closeModal;
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

/* ── Guest ── */
function showGuest() {
  showView('v-guest');
  $('#guestSearch').onclick = () => {
    const name = $('#guestName').value.trim();
    if (!name) { $('#guestName').focus(); return; }
    doUnderstand(name);
  };
  $('#guestManual').onclick = () => { showSetup(); };
}

/* ── Agent screen (animates while real work runs) ── */
async function runAgent(title, sub, tasks, work) {
  showView('v-agent');
  $('#agentTitle').textContent = title;
  $('#agentSub').textContent = sub;
  const box = $('#agentTasks'); box.innerHTML = '';
  const els = tasks.map(t => {
    const e = document.createElement('div');
    e.className = 'agent-task';
    e.innerHTML = `<span class="tick">✓</span><span>${esc(t)}</span>`;
    box.appendChild(e); return e;
  });
  const workP = Promise.resolve().then(work).catch(e => { console.error(e); return null; });
  for (let i = 0; i < els.length; i++) { await sleep(420); els[i].classList.add('done'); }
  const result = await workP;
  $('#agentTitle').textContent = 'Done!'; await sleep(300);
  return result;
}

/* ── Stage 1: understand ── */
async function doUnderstand(guestName) {
  const tasks = [];
  if (!guestName) tasks.push('Reading your account');
  tasks.push(`Searching the web${guestName ? ` for “${guestName}”` : ''}`, 'Scanning GitHub & social', 'Gathering references', 'Assessing your profile health');

  understood = await runAgent('Understanding your profile…', 'Reading what the web publicly shows about you',
    tasks, () => api('/api/understand', 'POST', guestName ? { name: guestName } : {}));

  if (!understood) understood = { sources: [], skills: [], headline: '', location: '', experience: [], assessment: { presence: 0, summary: 'We couldn’t analyze your profile right now.', suggestions: [] } };

  me = await api('/api/me').catch(() => me);
  _skills = [...new Set([...(understood.skills || [])])];
  if (understood.location) target.location = understood.location;
  state.understood = true; state.extracted = false;
  showProfile();
}

/* ── Profile page ── */
function srcTag(src) {
  const map = { linkedin: ['linkedin','LinkedIn'], web: ['web','Web'], github: ['github','GitHub'], cv: ['cv','CV'], missing: ['missing','Add via CV'] };
  const [cls, label] = map[src] || ['web', src || 'Web'];
  return `<span class="src-tag ${cls}">${esc(label)}</span>`;
}
function ringGrad(s) { const c = s >= 70 ? '#15c39a' : s >= 50 ? '#2f6df6' : '#f5a623'; return `conic-gradient(${c} ${s * 3.6}deg, var(--soft) 0deg)`; }
function completeness() {
  const checks = [understood?.headline, target.location, _skills.length, (understood?.experience || []).length, edu.length, phone];
  return Math.round(100 * checks.filter(Boolean).length / checks.length);
}

function showProfile() {
  showView('v-assess');
  const name = me?.name || 'You';
  $('#asInitials').textContent = initials(name);
  $('#asName').textContent = name;
  $('#asMail').textContent = me?.email || '';
  $('#assessHeading').textContent = state.extracted ? 'Your profile' : 'We found these references';
  $('#assessSubhead').textContent = state.extracted
    ? 'Built from your online presence' + (state.cvParsed ? ' + your CV' : '') + ' · public info only'
    : 'Confirm which are you — we’ll use them to build your profile';

  $('#assessBody').innerHTML = state.extracted ? profileHTML() : sourcesHTML();

  if (!state.extracted) {
    $$('#assessBody .src-check').forEach(el => el.onclick = () => el.classList.toggle('on'));
    $('#confirmSources').onclick = () => { state.extracted = true; showProfile(); };
  } else {
    skillInput('#asSkill', '#asSkillTags', '#asSkillSuggest');
    const cvBtn = $('#cvUploadBtn'), cvInput = $('#cvInput'), sample = $('#cvSample');
    if (cvBtn)   cvBtn.onclick = () => cvInput.click();
    if (cvInput) cvInput.onchange = () => { const f = cvInput.files[0]; if (f) readCV(f); };
    if (sample)  sample.onclick = e => { e.preventDefault(); parseCV(SAMPLE_CV); };
  }

  $('#assessBack').classList.toggle('hide', !state.searched);
  $('#assessCta').classList.toggle('hide', state.searched || !state.extracted);
  $('#assessBack').onclick = () => { saveEdits(); showDashboard(); };
  $('#assessFind').onclick = () => finishProfile();
}

function sourcesHTML() {
  const srcs = understood?.sources || [];
  const list = srcs.length ? srcs.map(s => `
    <div class="src-item">
      <span class="src-check ${s.confirmed !== false ? 'on' : ''}" data-id="${esc(s.id)}">✓</span>
      <span class="fp-ic">${s.ic || '🌐'}</span>
      <div class="src-main"><div class="src-name">${esc(s.name)}</div><div class="src-extract">${esc(s.extract || '')}</div></div>
    </div>`).join('')
    : `<div class="pending-note">No strong public references found — that's fine. You can add skills and a CV next.</div>`;
  return `
    <div class="acard">
      <h3>🔗 Is this you?</h3>
      <p class="fp-desc" style="margin-bottom:8px">We searched the web for “${esc(me?.name || 'you')}”. Tick the references that are you.</p>
      ${list}
    </div>
    <button class="btn btn-primary full" id="confirmSources">Confirm &amp; build my profile →</button>`;
}

function profileHTML() {
  const a = understood?.assessment || { presence: 0, summary: '', suggestions: [] };
  const c = completeness();
  const exp = understood?.experience || [];
  const expRows = exp.length
    ? exp.map(e => `<div class="exp-item"><span class="exp-dot"></span><div class="exp-main"><div class="exp-role">${esc(e.title)}</div><div class="exp-co">${esc(e.company || '')}</div></div>${srcTag(e.src || 'web')}</div>`).join('')
    : `<div class="pending-note">No experience parsed yet — upload your CV to add it.</div>`;
  const eduRows = edu.length
    ? edu.map(e => `<div class="exp-item"><span class="exp-dot" style="background:var(--accent)"></span><div class="exp-main"><div class="exp-role">${esc(e.degree)}</div></div>${srcTag('cv')}</div>`).join('')
    : `<div class="pending-note">No education found — upload your CV to add it.</div>`;
  return `
    <div class="complete-card">
      <div class="complete-top"><b>Profile completeness</b><span>${c}%</span></div>
      <div class="complete-track"><div class="complete-fill" style="width:${c}%"></div></div>
    </div>

    ${state.cvParsed
      ? `<div class="cv-done">✓ CV parsed — gaps below were filled (tagged CV)</div>`
      : `<div class="cv-card">
          <h3>📄 Add your CV to complete your profile</h3>
          <p>We'll parse it and fill anything we couldn't find online. (.txt works best in this build)</p>
          <button class="cv-upload-btn" id="cvUploadBtn">⬆ Upload CV</button>
          <input type="file" id="cvInput" accept=".txt,.pdf,.doc,.docx" hidden/>
          <div style="margin-top:10px"><a href="#" id="cvSample" style="color:#aec4ee;font-size:12.5px;font-weight:700">or try a sample CV</a></div>
        </div>`}

    <div class="acard">
      <h3>🧾 Details</h3>
      <div class="field-line"><div class="field-main"><div class="field-lbl">Headline</div><div class="field-val ${understood?.headline ? '' : 'empty'}">${esc(understood?.headline || 'Not found')}</div></div>${srcTag(understood?.headline ? 'web' : 'missing')}</div>
      <div class="field-line"><div class="field-main"><div class="field-lbl">Location</div><div class="field-val">${esc(target.location || 'UAE')}</div></div>${srcTag(understood?.location ? 'web' : 'missing')}</div>
      <div class="field-line"><div class="field-main"><div class="field-lbl">Phone</div><div class="field-val ${phone ? '' : 'empty'}">${esc(phone || 'Not found — add via CV')}</div></div>${srcTag(phone ? 'cv' : 'missing')}</div>
    </div>

    <div class="acard"><h3>💼 Experience</h3>${expRows}</div>
    <div class="acard"><h3>🎓 Education</h3>${eduRows}</div>

    <div class="acard">
      <h3>⚡ Skills <span class="fp-desc" style="font-weight:600">· auto-detected, add any we missed</span></h3>
      <div class="onb-chips" id="asSkillTags"></div>
      <input type="text" id="asSkill" class="onb-input" placeholder="+ Add a skill, press Enter" autocomplete="off" style="margin-top:10px"/>
      <div class="onb-chips" id="asSkillSuggest"></div>
    </div>

    <div class="acard">
      <h3>🎯 Your job target</h3>
      <label class="onb-label">Role</label>
      <input type="text" id="asRole" class="onb-input" value="${esc(target.role)}" autocomplete="off"/>
      <label class="onb-label">Location in the UAE</label>
      <input type="text" id="asLoc" class="onb-input" value="${esc(target.location)}" autocomplete="off"/>
    </div>

    <div class="score-row">
      <div class="score-card">
        <div class="big-ring" style="background:${ringGrad(a.presence)}"><div class="big-ring" style="width:64px;height:64px;background:var(--card)"><span class="rv">${a.presence}</span></div></div>
        <div class="cl">Profile health</div>
      </div>
      <div class="score-card" style="display:flex;flex-direction:column;justify-content:center">
        <div style="font-size:13px;color:var(--muted);font-weight:700">Detected skills</div>
        <div style="font-size:28px;font-weight:900;color:var(--brand-d)">${_skills.length}</div>
      </div>
    </div>

    <div class="acard"><h3>🪞 How you look</h3><p class="summary-txt">${esc(a.summary)}</p></div>
    ${a.suggestions?.length ? `<div class="acard"><h3>💡 Suggestions</h3>${a.suggestions.map(t => `<div class="sg-item"><span class="sgi">→</span><span>${esc(t)}</span></div>`).join('')}</div>` : ''}`;
}

function saveEdits() {
  if ($('#asRole')) target.role = $('#asRole').value.trim() || target.role;
  if ($('#asLoc'))  target.location = $('#asLoc').value.trim() || target.location;
}

async function finishProfile() {
  saveEdits();
  if (me) await api('/api/me', 'PATCH', {
    skills: _skills,
    prefs: { roles: [target.role], locations: [target.location], level: me.prefs?.level || '', remote: target.remote }
  }).catch(() => {});
  runSearch();
}

/* ── CV ── */
const SAMPLE_CV = 'Ahmed Al Mansoori\nEmail: ahmed@example.com  Phone: +971 50 123 4567\nBSc Computer Science, American University of Sharjah, 2019\nFrontend Developer skilled in React, TypeScript, Node.js, Docker and GraphQL.';
function readCV(file) {
  const reader = new FileReader();
  reader.onload = () => parseCV(String(reader.result || ''));
  reader.readAsText(file);
}
async function parseCV(text) {
  const res = await runAgent('Parsing your CV…', 'Extracting details and filling the gaps',
    ['Reading your CV', 'Extracting education & contact', 'Detecting skills', 'Merging with your profile'],
    () => api('/api/cv', 'POST', { text }));
  if (res) {
    if (res.phone) phone = res.phone;
    if (res.education?.length) edu = res.education;
    if (res.skills?.length) _skills = [...new Set([..._skills, ...res.skills])];
    state.cvParsed = true;
  }
  showProfile();
}

/* ── tag input ── */
function skillInput(inputSel, tagsSel, sugSel) {
  const input = $(inputSel), tags = $(tagsSel);
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
    const box = $(sugSel); box.innerHTML = '';
    SKILL_SUGGESTIONS.filter(s => !_skills.some(x => x.toLowerCase() === s.toLowerCase())).slice(0, 8).forEach(s => {
      const el = document.createElement('span');
      el.className = 'onb-tag suggest'; el.textContent = '+ ' + s;
      el.onclick = () => { _skills.push(s); renderTags(); renderSug(); };
      box.appendChild(el);
    });
  };
  input.onkeydown = e => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault(); const v = input.value.trim();
      if (!_skills.some(x => x.toLowerCase() === v.toLowerCase())) _skills.push(v);
      input.value = ''; renderTags(); renderSug();
    }
  };
  renderTags(); renderSug();
}

/* ── Quick setup (manual / guest-skip) ── */
function showSetup() {
  showView('v-setup');
  $('#setInitials').textContent = initials(me?.name || 'You');
  chips('#setRoleChips', ROLE_CHIPS, '#setRole');
  chips('#setLocChips', LOC_CHIPS, '#setLoc');
  _skills = [...(_skills || [])];
  skillInput('#setSkill', '#setSkillTags', '#setSkillSuggest');
  $('#setGo').onclick = async () => {
    if (!me) me = await api('/api/session/guest', 'POST').catch(() => null);
    target.role = $('#setRole').value.trim() || target.role;
    target.location = $('#setLoc').value.trim() || target.location;
    target.remote = $('#setRemote').checked;
    finishProfile();
  };
}
function chips(boxSel, list, inputSel) {
  const box = $(boxSel), input = $(inputSel); box.innerHTML = '';
  list.forEach(c => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'onb-chip' + (input.value === c ? ' on' : '');
    el.textContent = c;
    el.onclick = () => { input.value = c; [...box.children].forEach(x => x.classList.remove('on')); el.classList.add('on'); };
    box.appendChild(el);
  });
}

/* ── Stage 2: search ── */
async function runSearch() {
  const data = await runAgent('Searching the UAE job market…', 'Matching live listings to your profile',
    ['Searching Bayt, Indeed, LinkedIn & GulfTalent', 'Matching jobs to your skills'],
    () => api(`/api/jobs?q=${encodeURIComponent(target.role)}&loc=${encodeURIComponent(target.location)}`));
  jobsCache = data?.jobs || [];
  state.searched = true;
  await loadSaved();
  showDashboard();
}

/* ── Dashboard ── */
function scoreGrad(s) {
  if (s >= 75) return 'linear-gradient(135deg,#15c39a,#0fa07c)';
  if (s >= 50) return 'linear-gradient(135deg,#2f6df6,#1b4fd6)';
  if (s >= 30) return 'linear-gradient(135deg,#f5a623,#d4851a)';
  return 'linear-gradient(135deg,#8a98ad,#6c7a90)';
}
function avgSalary(list) {
  const nums = list.map(j => { const m = (j.salary || '').match(/[\d,]+/g); return m ? m.map(x => +x.replace(/,/g, '')).reduce((a, b) => a + b, 0) / m.length : null; }).filter(Boolean);
  if (!nums.length) return '—';
  return 'AED ' + Math.round(nums.reduce((a, b) => a + b, 0) / nums.length / 1000) + 'k';
}
function timeAgo(ds) { if (!ds) return ''; const s = (Date.now() - new Date(ds)) / 1000; if (s < 86400) return Math.max(1, Math.round(s / 3600)) + 'h ago'; const d = Math.round(s / 86400); return d < 30 ? d + 'd ago' : Math.round(d / 30) + 'mo ago'; }

function showDashboard() {
  showView('v-dash');
  $('#dashInitials').textContent = initials(me?.name || 'You');
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  $('#dashGreet').textContent = `${greet}${me?.name ? ', ' + me.name.split(' ')[0] : ''} 👋`;
  $('#dashSub').textContent = `${jobsCache.length} ${target.role} jobs in ${target.location}`;
  renderStats(); renderHealth(); renderTop(); renderInsights(); bindNav();
}

function renderStats() {
  const newCount = jobsCache.filter(j => j.isNew).length;
  const top = jobsCache[0]?.score || 0;
  const stats = [
    { v: jobsCache.length, l: 'Matches', c: 'brand' },
    { v: newCount, l: 'New', c: 'accent' },
    { v: top + '%', l: 'Top match', c: 'brand' },
    { v: avgSalary(jobsCache), l: 'Avg salary', c: 'warn' }
  ];
  $('#statRow').innerHTML = stats.map(s => `<div class="stat ${s.c}"><div class="v">${esc(String(s.v))}</div><div class="l">${esc(s.l)}</div></div>`).join('');
}

function renderHealth() {
  const box = $('#profileHealth');
  if (state.understood && understood?.assessment) {
    const s = understood.assessment.presence;
    box.innerHTML = `<div class="ph-card" id="phCard"><div class="ph-ring" style="background:${ringGrad(s)}"><div class="inner">${s}</div></div><div class="ph-main"><div class="ph-title">Profile health: ${s}/100</div><div class="ph-desc">${(understood.assessment.suggestions || []).length} ways to stand out →</div></div><span class="ph-arrow">›</span></div>`;
    $('#phCard').onclick = () => showProfile();
  } else {
    const signedIn = !!me;
    box.innerHTML = `<div class="ph-card" id="phCard"><div class="ph-ring" style="background:var(--soft)"><div class="inner">${signedIn ? '🔎' : '🔒'}</div></div><div class="ph-main"><div class="ph-title">Profile health check</div><div class="ph-desc">${signedIn ? 'Analyze your public profile →' : 'Sign in or add your name to build your profile →'}</div></div><span class="ph-arrow">›</span></div>`;
    $('#phCard').onclick = () => signedIn ? doUnderstand() : showView('v-login');
  }
}

function jobCard(j) {
  const isSaved = savedCache.some(s => s.id === j.id);
  const el = document.createElement('article');
  el.className = 'job';
  el.innerHTML = `
    ${j.isNew ? '<span class="new-pill">NEW</span>' : ''}
    <div class="j-top">
      <div class="score-ring" style="background:${scoreGrad(j.score)}">${j.score}<small>MATCH</small></div>
      <div class="j-meta"><div class="j-title">${esc(j.title)}</div><div class="j-company">${esc(j.company || '—')}</div></div>
    </div>
    <div class="j-chips">
      ${j.remote ? '<span class="chip remote">🌐 Remote</span>' : ''}
      ${j.location ? `<span class="chip">📍 ${esc(j.location)}</span>` : ''}
      ${j.salary ? `<span class="chip sal">💰 ${esc(j.salary)}</span>` : ''}
      ${j.posted ? `<span class="chip">${esc(timeAgo(j.posted))}</span>` : ''}
      <span class="chip src">${esc(j.source)}</span>
    </div>
    ${j.reasons?.length ? `<div class="j-why"><b>Why this fits:</b> ${j.reasons.map(esc).join(' · ')}</div>` : ''}
    <div class="j-actions">
      <a class="j-apply" href="${esc(safeUrl(j.url))}" target="_blank" rel="noopener">Apply →</a>
      <button class="j-save ${isSaved ? 'saved' : ''}">${isSaved ? '★' : '☆'}</button>
    </div>`;
  el.querySelector('.j-save').onclick = e => toggleSave(j, e.currentTarget);
  el.style.cursor = 'pointer';
  el.addEventListener('click', e => { if (e.target.closest('.j-apply') || e.target.closest('.j-save')) return; openJobDetail(j); });
  return el;
}

/* ── Job detail modal ── */
function openJobDetail(j) {
  const isSaved = savedCache.some(s => s.id === j.id);
  const desc = (j.description || '').trim();
  $('#modalPanel').innerHTML = `
    <div class="md-grip"></div>
    <button class="md-close" id="mdClose">✕</button>
    <div class="md-title">${esc(j.title)}</div>
    <div class="md-company">${esc(j.company || '—')}</div>
    <div class="j-chips" style="margin-top:10px">
      ${j.remote ? '<span class="chip remote">🌐 Remote</span>' : ''}
      ${j.location ? `<span class="chip">📍 ${esc(j.location)}</span>` : ''}
      ${j.type ? `<span class="chip">🕒 ${esc(j.type)}</span>` : ''}
      ${j.salary ? `<span class="chip sal">💰 ${esc(j.salary)}</span>` : ''}
      ${j.posted ? `<span class="chip">${esc(timeAgo(j.posted))}</span>` : ''}
      <span class="chip src">${esc(j.source)}</span>
    </div>
    <div class="md-score">
      <div class="score-ring" style="background:${scoreGrad(j.score)}">${j.score}<small>MATCH</small></div>
      <div class="md-why">${j.reasons?.length ? `<b>Why this fits:</b> ${j.reasons.map(esc).join(' · ')}` : 'Ranked by your skills, role and location.'}</div>
    </div>
    ${j.tags?.length ? `<div class="md-sec-t">Skills / tags</div><div class="j-chips">${j.tags.slice(0, 14).map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="md-sec-t">Description</div>
    <div class="md-desc">${desc ? esc(desc) : 'No description provided by the source — open the posting to read more.'}</div>
    <div class="md-actions">
      <a class="j-apply" href="${esc(safeUrl(j.url))}" target="_blank" rel="noopener" style="flex:1">Apply / view posting →</a>
      <button class="j-save ${isSaved ? 'saved' : ''}" id="mdSave">${isSaved ? '★' : '☆'}</button>
    </div>`;
  $('#mdClose').onclick = closeModal;
  $('#mdSave').onclick = e => { toggleSave(j, e.currentTarget); };
  $('#jobModal').classList.remove('hide');
}
function closeModal() { $('#jobModal').classList.add('hide'); }

function renderTop() {
  const box = $('#topMatches'); box.innerHTML = '';
  if (!jobsCache.length) { box.innerHTML = '<div class="pending-note">No matches yet — try a broader role on the Profile page.</div>'; return; }
  jobsCache.slice(0, 3).forEach(j => box.appendChild(jobCard(j)));
}

function renderInsights() {
  const freq = {};
  jobsCache.forEach(j => (j.tags || []).forEach(t => freq[t] = (freq[t] || 0) + 1));
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxF = top[0]?.[1] || 1;
  const remoteCount = jobsCache.filter(j => j.remote).length;
  const onsite = jobsCache.length - remoteCount;
  const cos = [...new Set(jobsCache.map(j => j.company).filter(Boolean))].slice(0, 5);
  $('#insights').innerHTML = `
    ${top.length ? `<div class="ins-block"><div class="ins-title">🔥 Most in-demand skills</div>
      ${top.map(([s, n]) => `<div class="bar-row"><span class="bl">${esc(s)}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.round(100 * n / maxF)}%"></span></span><span class="bn">${n}</span></div>`).join('')}</div>` : ''}
    ${cos.length ? `<div class="ins-block"><div class="ins-title">🏢 Companies hiring now</div><div class="co-list">${cos.map(c => `<div class="co"><span class="logo">${esc(initials(c))}</span><span class="cn">${esc(c)}</span></div>`).join('')}</div></div>` : ''}
    <div class="ins-block"><div class="ins-title">📍 Remote vs on-site</div><div class="split">
      <div class="sp"><div class="v" style="color:var(--accent-d)">${remoteCount}</div><div class="l">Remote-friendly</div></div>
      <div class="sp"><div class="v" style="color:var(--brand-d)">${onsite}</div><div class="l">On-site</div></div></div></div>`;
}

function salaryMax(j) { const m = (j.salary || '').match(/[\d,]+/g); return m ? Math.max(...m.map(x => +x.replace(/,/g, ''))) : 0; }
function isFresh(j) { return j.posted && (Date.now() - new Date(j.posted)) / 864e5 <= 7; }

function visibleJobs() {
  let list = jobsCache.filter(j =>
    (!filters.remote || j.remote) &&
    (!filters.fresh || isFresh(j)) &&
    (!filters.salary || salaryMax(j) > 0)
  );
  const by = {
    match:  (a, b) => b.score - a.score,
    newest: (a, b) => new Date(b.posted || 0) - new Date(a.posted || 0),
    salary: (a, b) => salaryMax(b) - salaryMax(a)
  }[filters.sort];
  return list.sort(by);
}

function renderJobList() {
  const list = visibleJobs();
  $('#jobsCount').textContent = `${list.length}${list.length !== jobsCache.length ? ' of ' + jobsCache.length : ''} jobs`;
  const box = $('#jobList'); box.innerHTML = '';
  if (!jobsCache.length) { box.innerHTML = '<div class="empty" style="padding:40px;text-align:center;color:var(--muted)">No matches found.</div>'; return; }
  if (!list.length) { box.innerHTML = '<div class="empty" style="padding:40px;text-align:center;color:var(--muted)">No jobs match these filters.</div>'; return; }
  list.forEach(j => box.appendChild(jobCard(j)));
}

function bindFilters() {
  $('#fSort').onchange = e => { filters.sort = e.target.value; renderJobList(); };
  const toggle = (id, key) => $(id).onclick = () => { filters[key] = !filters[key]; $(id).classList.toggle('on', filters[key]); renderJobList(); };
  toggle('#fRemote', 'remote'); toggle('#fFresh', 'fresh'); toggle('#fSalary', 'salary');
}

/* ── Saved ── */
async function loadSaved() { savedCache = await api('/api/saved').catch(() => []); }
async function toggleSave(job, btn) {
  const isSaved = savedCache.some(s => s.id === job.id);
  try {
    if (isSaved) { await api('/api/saved/' + encodeURIComponent(job.id), 'DELETE'); savedCache = savedCache.filter(s => s.id !== job.id); }
    else { await api('/api/saved', 'POST', job); savedCache.push({ ...job, savedStatus: 'saved' }); }
    btn.classList.toggle('saved'); btn.textContent = isSaved ? '☆' : '★';
  } catch (e) { console.error(e); }
}
const STATUS = { saved: 'Saved', applied: 'Applied', interviewing: 'Interviewing', offer: 'Offer!', rejected: 'Rejected' };
function renderSaved() {
  $('#savedCount').textContent = savedCache.length ? savedCache.length + ' jobs' : '';
  const box = $('#savedList'); box.innerHTML = '';
  if (!savedCache.length) { box.innerHTML = '<div class="empty" style="padding:40px;text-align:center;color:var(--muted)">★<br/>No saved jobs yet. Tap ☆ on any match.</div>'; return; }
  savedCache.forEach(j => {
    const el = document.createElement('div'); el.className = 'job';
    el.innerHTML = `
      <div class="j-top"><div class="j-meta"><div class="j-title">${esc(j.title)}</div><div class="j-company">${esc(j.company || '')}</div></div></div>
      <div class="j-actions" style="align-items:center">
        <select class="status-sel">${Object.entries(STATUS).map(([v, l]) => `<option value="${v}" ${j.savedStatus === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <a class="j-apply" href="${esc(safeUrl(j.url))}" target="_blank" rel="noopener">Apply →</a>
        <button class="j-save saved">★</button>
      </div>`;
    el.querySelector('.status-sel').onchange = e => api('/api/saved/' + encodeURIComponent(j.id), 'PATCH', { status: e.target.value }).catch(() => {});
    el.querySelector('.j-save').onclick = async () => { await api('/api/saved/' + encodeURIComponent(j.id), 'DELETE').catch(() => {}); savedCache = savedCache.filter(s => s.id !== j.id); renderSaved(); };
    box.appendChild(el);
  });
}

/* ── Nav ── */
function bindNav() {
  const goTab = name => {
    $$('.bn-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $$('.tab-view').forEach(v => v.classList.toggle('active', v.id === 'tab-' + name));
    if (name === 'jobs') renderJobList();
    if (name === 'saved') renderSaved();
    $('#scrollArea').scrollTo({ top: 0, behavior: 'smooth' });
  };
  $$('.bn-tab').forEach(b => b.onclick = () => goTab(b.dataset.tab));
  $('#viewAllBtn').onclick = () => goTab('jobs');
  $('#qaSearch').onclick = () => goTab('jobs');
  $('#qaSaved').onclick = () => goTab('saved');
  $('#qaProfile').onclick = () => { state.understood ? showProfile() : showView('v-login'); };
  bindFilters();
}

/* ── PWA ── */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

init();
