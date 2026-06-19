'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const api = async (url, opts = {}) => {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (r.status === 401) { showLogin(); throw new Error('unauthorized'); }
  return r;
};

let me = null;          // current user/profile
let jobs = [];          // last search results
let view = 'all';

const SKILL_SUGGESTIONS = ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'SQL', 'AWS',
  'Docker', 'Go', 'Product', 'Figma', 'Marketing', 'Data', 'DevOps', 'Kubernetes'];
const ROLE_PRESETS = ['Frontend Developer', 'Backend Engineer', 'Full Stack', 'Data Analyst',
  'Product Manager', 'UX Designer', 'DevOps Engineer', 'Marketing', 'Project Manager'];

/* ============ boot ============ */
init();
async function init() {
  // login provider availability
  try {
    const cfg = await (await fetch('/auth/config')).json();
    if (cfg.linkedin) { $('#liBtn').classList.remove('hide'); $('#liHint').classList.remove('hide'); }
  } catch {}
  $('#liBtn').onclick = () => (location.href = '/auth/linkedin');
  $('#demoForm').onsubmit = async (e) => {
    e.preventDefault();
    await fetch('/auth/demo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: $('#demoName').value, email: $('#demoEmail').value }),
    });
    loadMe();
  };
  wireApp();
  loadMe();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}

async function loadMe() {
  try {
    const r = await fetch('/api/me');
    if (!r.ok) return showLogin();
    me = (await r.json()).user;
    showApp();
  } catch { showLogin(); }
}
function showLogin() { $('#login').classList.remove('hide'); $('#app').classList.add('hide'); }
function showApp() {
  $('#login').classList.add('hide'); $('#app').classList.remove('hide');
  hydrateProfile();
  renderPresets(); renderSkillSuggest();
}

/* ============ profile ============ */
function hydrateProfile() {
  me.savedSet = new Set(me.savedIds || []);
  $('#acctName').textContent = me.name?.split(' ')[0] || 'You';
  $('#mName').textContent = me.name || '';
  $('#mEmail').textContent = me.email || me.provider;
  $('#acctPic').src = me.picture || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E`;
  $('#greet').textContent = `Hi ${me.name?.split(' ')[0] || 'there'} — find your next role`;
  $('#role').value = me.role || '';
  $('#headline').value = me.headline || '';
  $('#location').value = me.location || '';
  $('#level').value = me.level || '';
  $('#remoteOnly').checked = !!me.remoteOnly;
  renderTags('skills'); renderTags('keywords');
  updateProfSummary();
}
function updateProfSummary() {
  const bits = [];
  if (me.skills?.length) bits.push(`${me.skills.length} skills`);
  if (me.level) bits.push(me.level);
  if (me.remoteOnly) bits.push('remote');
  $('#profSummary').textContent = bits.length ? '· ' + bits.join(' · ') : '· tap to set up';
}

function renderTags(key) {
  const box = $(`#${key === 'skills' ? 'skillTags' : 'kwTags'}`);
  box.innerHTML = '';
  (me[key] || []).forEach((t, i) => {
    const el = document.createElement('span');
    el.className = 'tag';
    el.innerHTML = '<b></b><button>×</button>';
    el.querySelector('b').textContent = t;
    el.querySelector('button').onclick = () => { me[key].splice(i, 1); renderTags(key); if (key === 'skills') renderSkillSuggest(); };
    box.appendChild(el);
  });
}
function renderSkillSuggest() {
  const box = $('#skillSuggest'); box.innerHTML = '';
  SKILL_SUGGESTIONS.filter((s) => !(me.skills || []).some((x) => x.toLowerCase() === s.toLowerCase()))
    .slice(0, 10).forEach((s) => {
      const el = document.createElement('span');
      el.className = 'tag suggest'; el.textContent = '+ ' + s;
      el.onclick = () => { me.skills = me.skills || []; me.skills.push(s); renderTags('skills'); renderSkillSuggest(); };
      box.appendChild(el);
    });
}
function renderPresets() {
  const box = $('#presets'); box.innerHTML = '';
  ROLE_PRESETS.forEach((r) => {
    const b = document.createElement('button');
    b.className = 'preset'; b.textContent = r;
    b.onclick = () => { me.role = r; $('#role').value = r; runSearch(); };
    box.appendChild(b);
  });
}
function tagInput(inputId, key) {
  $(inputId).addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      e.preventDefault();
      const v = e.target.value.trim();
      me[key] = me[key] || [];
      if (!me[key].some((x) => x.toLowerCase() === v.toLowerCase())) me[key].push(v);
      e.target.value = ''; renderTags(key); if (key === 'skills') renderSkillSuggest();
    }
  });
}

async function saveProfile() {
  me.role = $('#role').value;
  me.headline = $('#headline').value;
  me.location = $('#location').value;
  me.level = $('#level').value;
  me.remoteOnly = $('#remoteOnly').checked;
  const r = await api('/api/profile', { method: 'PUT', body: JSON.stringify(me) });
  me = (await r.json()).user;
  updateProfSummary();
  flash('Profile saved');
}

/* ============ resume ============ */
async function extractResumeText() {
  const text = $('#resumeText').value.trim();
  if (!text) return flash('Paste your resume text first', true);
  $('#resumeMsg').textContent = 'Extracting…';
  const r = await api('/api/profile/resume', { method: 'POST', body: JSON.stringify({ text }) });
  const data = await r.json();
  me = data.user; renderTags('skills'); renderSkillSuggest(); updateProfSummary();
  $('#resumeMsg').textContent = `Added ${data.extracted.skills.length} skills` + (data.extracted.level ? `, seniority: ${data.extracted.level}` : '');
}
async function uploadResume(file) {
  const fd = new FormData(); fd.append('file', file);
  $('#resumeMsg').textContent = 'Reading file…';
  const r = await fetch('/api/profile/resume', { method: 'POST', body: fd });
  if (!r.ok) { const e = await r.json().catch(() => ({})); return ($('#resumeMsg').textContent = e.message || 'Upload failed'); }
  const data = await r.json();
  me = data.user; renderTags('skills'); renderSkillSuggest(); updateProfSummary();
  $('#resumeMsg').textContent = `Added ${data.extracted.skills.length} skills`;
}

/* ============ search ============ */
async function runSearch() {
  me.role = $('#role').value;
  if (!me.role && !(me.skills && me.skills.length)) { flash('Add a role or skill first', true); return; }
  await saveSilently();
  setBusy(true); $('#banners').innerHTML = '';
  $('#results').innerHTML = `<div class="empty"><div class="spinner"></div><p>Searching live listings…</p></div><div class="skel"></div><div class="skel"></div>`;
  try {
    const r = await api('/api/jobs');
    const data = await r.json();
    jobs = data.jobs;
    if (data.sources.failed.length)
      banner('info', `Loaded from ${data.sources.ok.join(' + ') || 'cache'}. ${data.sources.failed.join(', ')} unavailable.`);
    $('#lastFetch').textContent = 'updated ' + new Date().toLocaleTimeString();
    view = 'all'; setView('all');
    render();
    $('.results-head').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    if (e.message !== 'unauthorized') $('#results').innerHTML = `<div class="empty"><div class="big">📡</div><p><b>Couldn't load listings.</b><br/>Try again in a moment.</p></div>`;
  } finally { setBusy(false); }
}
async function saveSilently() {
  try { const r = await api('/api/profile', { method: 'PUT', body: JSON.stringify(me) }); me = (await r.json()).user; } catch {}
}
function setBusy(b) {
  $('#searchBtn').disabled = b; $('#searchBtnFab').disabled = b;
  $('#searchBtn').textContent = b ? '…' : 'Search';
  $('#searchBtnFab').textContent = b ? '⏳ Searching…' : '🔎 Find matching jobs';
}

/* ============ render results ============ */
async function loadSaved() {
  const r = await api('/api/saved'); jobs = (await r.json()).jobs; render();
}
function setView(v) { view = v; $$('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.view === v)); }
function scoreColor(s) {
  if (s >= 70) return 'linear-gradient(135deg,#15c39a,#0fa07c)';
  if (s >= 45) return 'linear-gradient(135deg,#2f6df6,#1f4fd1)';
  if (s >= 25) return 'linear-gradient(135deg,#e8a23b,#cf871f)';
  return 'linear-gradient(135deg,#8a98ad,#6c7a90)';
}
const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
function timeAgo(ms) {
  const s = (Date.now() - ms) / 1000;
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm ago';
  if (s < 86400) return Math.round(s / 3600) + 'h ago';
  const d = Math.round(s / 86400);
  return d < 30 ? d + 'd ago' : Math.round(d / 30) + 'mo ago';
}
function render() {
  const sort = $('#sortSel').value;
  let list = jobs.slice();
  list.sort(sort === 'date' ? (a, b) => (b.posted || 0) - (a.posted || 0) : (a, b) => b.score - a.score);
  $('#resTitle').textContent = view === 'saved' ? '★ Saved jobs' : 'Matches';
  $('#resCount').textContent = list.length ? `${list.length} ${list.length === 1 ? 'job' : 'jobs'}` : '';
  const root = $('#results');
  if (!list.length) {
    root.innerHTML = view === 'saved'
      ? `<div class="empty"><div class="big">★</div><p>No saved jobs yet. Tap the star on any match.</p></div>`
      : `<div class="empty"><div class="big">🔍</div><p>No matches — run a search.</p></div>`;
    return;
  }
  root.innerHTML = '';
  list.forEach((j) => {
    const isSaved = view === 'saved' ? true : (me.savedSet && me.savedSet.has(j.id));
    const el = document.createElement('article');
    el.className = 'job';
    el.innerHTML = `
      <div class="top">
        <div class="score" style="background:${scoreColor(j.score)}">${j.score}<small>MATCH</small></div>
        <div class="meta">
          <div class="title">${esc(j.title)}${j.isNew ? '<span class="new">NEW</span>' : ''}</div>
          <div class="company">${esc(j.company || '—')}</div>
          <div class="facts">
            ${j.remote ? '<span class="chip remote">🌐 Remote</span>' : ''}
            ${j.location ? `<span class="chip">📍 ${esc(j.location)}</span>` : ''}
            ${j.posted ? `<span class="chip">${esc(timeAgo(j.posted))}</span>` : ''}
            <span class="chip src">${esc(j.source)}</span>
          </div>
        </div>
      </div>
      ${j.reasons?.length ? `<div class="why"><b>Why this fits:</b> ${j.reasons.map(esc).join(' · ')}</div>` : ''}
      <div class="actions">
        <a class="apply" href="${esc(j.url)}" target="_blank" rel="noopener">Apply / view →</a>
        <button class="iconbtn" data-id="${esc(j.id)}">☆</button>
      </div>`;
    const star = el.querySelector('.iconbtn');
    if (isSaved) { star.classList.add('saved'); star.textContent = '★'; }
    star.onclick = () => toggleSave(j, star);
    root.appendChild(el);
  });
}
async function toggleSave(job, btn) {
  const r = await api('/api/saved', { method: 'POST', body: JSON.stringify({ job }) });
  const d = await r.json();
  btn.classList.toggle('saved', d.saved);
  btn.textContent = d.saved ? '★' : '☆';
  if (me.savedSet) { d.saved ? me.savedSet.add(job.id) : me.savedSet.delete(job.id); }
  if (view === 'saved' && !d.saved) loadSaved();
}

/* ============ ui plumbing ============ */
function banner(type, msg) { const b = document.createElement('div'); b.className = 'banner ' + type; b.textContent = msg; $('#banners').appendChild(b); }
function flash(msg, bad) { const m = $('#resumeMsg'); if (m) m.textContent = msg; }
function wireApp() {
  tagInput('#skillInput', 'skills'); tagInput('#kwInput', 'keywords');
  $('#searchBtn').onclick = runSearch; $('#searchBtnFab').onclick = runSearch;
  $('#role').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } });
  $('#saveProfile').onclick = saveProfile;
  $('#resumeBtn').onclick = extractResumeText;
  $('#resumeFile').onchange = (e) => e.target.files[0] && uploadResume(e.target.files[0]);
  $('#sortSel').onchange = render;
  $('#profToggle').onclick = () => { $('#profBody').classList.toggle('open'); $('#profToggle').classList.toggle('open'); };
  $$('.seg button').forEach((b) => b.onclick = () => { setView(b.dataset.view); b.dataset.view === 'saved' ? loadSaved() : render(); });
  // account menu
  $('#acctBtn').onclick = (e) => { e.stopPropagation(); $('#acctMenu').classList.toggle('hide'); };
  document.addEventListener('click', () => $('#acctMenu').classList.add('hide'));
  $('#acctMenu').onclick = (e) => e.stopPropagation();
  $$('#acctMenu [data-tab]').forEach((b) => b.onclick = () => {
    $('#acctMenu').classList.add('hide');
    if (b.dataset.tab === 'profile') { $('#profBody').classList.add('open'); $('#profToggle').classList.add('open'); $('#profileCard').scrollIntoView({ behavior: 'smooth' }); }
    if (b.dataset.tab === 'saved') { setView('saved'); loadSaved(); $('.results-head').scrollIntoView({ behavior: 'smooth' }); }
  });
  $('#logoutBtn').onclick = async () => { await fetch('/auth/logout', { method: 'POST' }); me = null; showLogin(); };
}
