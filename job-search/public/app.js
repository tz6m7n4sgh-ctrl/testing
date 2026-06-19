'use strict';
/* JobScout PWA — frontend app.js */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };

/* ── State ─────────────────────────────────────────── */
let user        = null;
let jobsCache   = [];
let savedCache  = [];
let currentView = 'match';

const ROLE_PRESETS = [
  'Frontend Developer','Backend Engineer','Full Stack','Data Analyst',
  'Product Manager','UX Designer','DevOps','Data Scientist','Marketing','Customer Success'
];
const SKILL_SUGGESTIONS = [
  'JavaScript','TypeScript','React','Node.js','Python','SQL','AWS','Docker',
  'Go','Java','CSS','Vue','Figma','Product','Kubernetes','Rust','C#','Swift'
];

/* ── Init ──────────────────────────────────────────── */
async function init() {
  registerSW();
  handleInstallPrompt();

  const params = new URLSearchParams(location.search);
  if (params.get('auth') === 'error') {
    showLoginErr('LinkedIn sign-in failed. Please try again.');
  }
  if (params.get('auth')) history.replaceState({}, '', '/');

  try {
    const me = await api('/api/me');
    user = me;
    showApp();
  } catch {
    showLogin();
  }
}

/* ── Views ─────────────────────────────────────────── */
function showLogin() {
  $('#loginView').classList.remove('hide');
  $('#appView').classList.add('hide');
}

function showApp() {
  $('#loginView').classList.add('hide');
  $('#appView').classList.remove('hide');
  fillUserUI();
  setupTabs();
  setupSearch();
  setupProfile();
  loadSaved();
}

function showLoginErr(msg) {
  const el = $('#loginErr');
  el.textContent = msg;
  el.classList.remove('hide');
}

/* ── User UI ───────────────────────────────────────── */
function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function fillUserUI() {
  const i = initials(user.name);
  ['top','pm','prof'].forEach(p => {
    const el = document.getElementById(p + 'Initials');
    if (el) el.textContent = i;
    const ph = document.getElementById(p + 'Photo');
    if (ph && user.photo) {
      ph.src = user.photo;
      ph.classList.remove('hide');
      ph.previousElementSibling?.classList.add('hide');
    }
  });
  if ($('#topName'))     $('#topName').textContent = user.name.split(' ')[0];
  if ($('#pmName'))      $('#pmName').textContent  = user.name;
  if ($('#pmEmail'))     $('#pmEmail').textContent = user.email;
  if ($('#profName'))    $('#profName').textContent = user.name;
  if ($('#profEmail'))   $('#profEmail').textContent = user.email;

  // Sign out
  $('#signOutBtn').onclick = async () => {
    await api('/auth/logout', 'POST');
    location.reload();
  };

  // Avatar menu toggle
  $('#avatarBtn').onclick = e => {
    e.stopPropagation();
    $('#profileMenu').classList.toggle('hide');
  };
  document.addEventListener('click', () => $('#profileMenu').classList.add('hide'), { capture: true });
}

/* ── Tabs ──────────────────────────────────────────── */
function setupTabs() {
  $$('.bn-tab').forEach(btn => {
    btn.onclick = () => goTab(btn.dataset.tab);
  });
}

function goTab(name) {
  $$('.bn-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab-view').forEach(v => v.classList.toggle('active', v.id === 'tab-' + name));
  $('#profileMenu').classList.add('hide');
  $('#scrollArea').scrollTo({ top: 0, behavior: 'smooth' });
  if (name === 'saved') renderSaved();
}

/* ── Search ────────────────────────────────────────── */
function setupSearch() {
  renderPresets();
  $('#searchBtn').onclick  = runSearch;
  $('#sortSel').onchange   = () => renderJobs();
  $('#searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } });

  if (user.prefs?.roles?.length) {
    $('#searchInput').value = user.prefs.roles[0];
    $('#searchHeading').textContent = `Hello ${user.name.split(' ')[0]} 👋`;
    runSearch();
  }
}

function renderPresets() {
  const box = $('#presets'); box.innerHTML = '';
  ROLE_PRESETS.forEach(r => {
    const b = document.createElement('button');
    b.className = 'preset'; b.textContent = r;
    b.onclick = () => { $('#searchInput').value = r; runSearch(); };
    box.appendChild(b);
  });
}

async function runSearch() {
  const q = $('#searchInput').value.trim();
  const btn = $('#searchBtn');
  btn.disabled = true; btn.textContent = '⏳ Searching…';
  $('#banner').innerHTML = '';
  $('#jobList').innerHTML = [1,2,3].map(() => '<div class="skel"></div>').join('') +
    '<div class="empty" style="padding-top:12px"><div class="spinner"></div></div>';

  try {
    const data = await api('/api/jobs?q=' + encodeURIComponent(q));
    jobsCache = data.jobs || [];

    const newCount = jobsCache.filter(j => j.isNew).length;
    const newBadge = $('#topNewBadge');
    if (newCount > 0) { newBadge.textContent = newCount + ' new'; newBadge.classList.remove('hide'); }
    else newBadge.classList.add('hide');

    if (data.sources?.length) {
      showBanner('info', `Loaded from ${data.sources.join(' + ')}`);
    }
    renderJobs();
  } catch (e) {
    $('#jobList').innerHTML = '<div class="empty"><div class="big">📡</div><p>Failed to load jobs.<br/>Check your connection and try again.</p></div>';
  } finally {
    btn.disabled = false; btn.textContent = '🔎 Search';
  }
}

function renderJobs() {
  const sort = $('#sortSel').value;
  let list = jobsCache.slice();
  list.sort(sort === 'date'
    ? (a, b) => new Date(b.posted || 0) - new Date(a.posted || 0)
    : (a, b) => b.score - a.score || (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)
  );

  $('#resultsCount').textContent = list.length ? list.length + ' jobs' : '';
  $('#resultsTitle').textContent = list.length ? 'Matches' : 'Matches';

  const root = $('#jobList');
  if (!list.length) {
    root.innerHTML = '<div class="empty"><div class="big">🔍</div><p>No matches found — try a different search.</p></div>';
    return;
  }
  root.innerHTML = '';
  list.forEach(j => root.appendChild(buildJobCard(j)));
}

function scoreGrad(s) {
  if (s >= 75) return 'linear-gradient(135deg,#00c78b,#009468)';
  if (s >= 50) return 'linear-gradient(135deg,#2355f5,#1640d1)';
  if (s >= 30) return 'linear-gradient(135deg,#f5a623,#d4851a)';
  return 'linear-gradient(135deg,#8a98ad,#6c7a90)';
}

function timeAgo(ds) {
  if (!ds) return '';
  const d = new Date(ds), s = (Date.now() - d) / 1000;
  if (s < 3600)  return Math.max(1, Math.round(s / 60)) + 'm ago';
  if (s < 86400) return Math.round(s / 3600) + 'h ago';
  const days = Math.round(s / 86400);
  return days < 30 ? days + 'd ago' : Math.round(days / 30) + 'mo ago';
}

function buildJobCard(j) {
  const isSaved = savedCache.some(s => s.id === j.id);
  const el = document.createElement('article');
  el.className = 'job';
  el.innerHTML = `
    ${j.isNew ? '<span class="new-pill">NEW</span>' : ''}
    <div class="j-top">
      <div class="score-ring" style="background:${scoreGrad(j.score)}">${j.score}<small>MATCH</small></div>
      <div class="j-meta">
        <div class="j-title">${esc(j.title)}</div>
        <div class="j-company">${esc(j.company || '—')}</div>
      </div>
    </div>
    <div class="j-chips">
      ${j.remote ? '<span class="chip remote">🌐 Remote</span>' : ''}
      ${j.location ? `<span class="chip">📍 ${esc(j.location)}</span>` : ''}
      ${j.type ? `<span class="chip">🕒 ${esc(j.type)}</span>` : ''}
      ${j.salary ? `<span class="chip sal">💰 ${esc(j.salary)}</span>` : ''}
      ${j.posted ? `<span class="chip">${esc(timeAgo(j.posted))}</span>` : ''}
      <span class="chip src">${esc(j.source)}</span>
    </div>
    ${j.reasons?.length ? `<div class="j-why"><b>Why this fits:</b> ${j.reasons.map(esc).join(' · ')}</div>` : ''}
    <div class="j-actions">
      <a class="j-apply" href="${esc(j.url)}" target="_blank" rel="noopener">Apply →</a>
      <button class="j-save ${isSaved ? 'saved' : ''}" data-id="${esc(j.id)}" title="${isSaved ? 'Saved' : 'Save'}">${isSaved ? '★' : '☆'}</button>
    </div>`;
  el.querySelector('.j-save').onclick = () => toggleSave(j, el);
  return el;
}

/* ── Saved jobs ─────────────────────────────────────── */
async function loadSaved() {
  try { savedCache = await api('/api/saved'); } catch { savedCache = []; }
  updateSavedBadge();
}

function updateSavedBadge() {
  const badge = $('#savedBadge');
  if (savedCache.length) { badge.textContent = savedCache.length; badge.classList.remove('hide'); }
  else badge.classList.add('hide');
}

async function toggleSave(job, cardEl) {
  const isSaved = savedCache.some(s => s.id === job.id);
  if (isSaved) {
    await api('/api/saved/' + encodeURIComponent(job.id), 'DELETE');
    savedCache = savedCache.filter(s => s.id !== job.id);
  } else {
    await api('/api/saved', 'POST', job);
    savedCache.push({ ...job, savedStatus: 'saved' });
  }
  updateSavedBadge();
  const btn = cardEl.querySelector('.j-save');
  btn.classList.toggle('saved');
  btn.textContent = isSaved ? '☆' : '★';
}

function renderSaved() {
  const root = $('#savedList');
  if (!savedCache.length) {
    root.innerHTML = '<div class="empty" style="padding-top:36px"><div class="big">★</div><p>No saved jobs yet.<br/>Tap ☆ on any match to save it here.</p></div>';
    return;
  }
  root.innerHTML = '';
  savedCache.forEach(j => root.appendChild(buildSavedCard(j)));
}

const STATUS_LABELS = { saved: 'Saved', applied: 'Applied', interviewing: 'Interviewing', offer: 'Offer!', rejected: 'Rejected' };

function buildSavedCard(j) {
  const el = document.createElement('div');
  el.className = 'saved-job';
  el.innerHTML = `
    <div class="sj-top">
      <div class="sj-info">
        <div class="sj-title">${esc(j.title)}</div>
        <div class="sj-company">${esc(j.company || '—')}</div>
        <div class="j-chips" style="margin-top:6px">
          ${j.remote ? '<span class="chip remote">🌐 Remote</span>' : ''}
          ${j.location ? `<span class="chip">📍 ${esc(j.location)}</span>` : ''}
          ${j.salary ? `<span class="chip sal">💰 ${esc(j.salary)}</span>` : ''}
        </div>
      </div>
    </div>
    <div class="sj-actions">
      <span class="status-dot ${esc(j.savedStatus || 'saved')}"></span>
      <select class="status-sel" data-id="${esc(j.id)}">
        ${Object.entries(STATUS_LABELS).map(([v,l]) => `<option value="${v}" ${j.savedStatus===v?'selected':''}>${l}</option>`).join('')}
      </select>
      <a class="sj-apply" href="${esc(j.url)}" target="_blank" rel="noopener">Apply →</a>
      <button class="sj-unsave" data-id="${esc(j.id)}" title="Remove">🗑</button>
    </div>`;
  el.querySelector('.status-sel').onchange = async e => {
    const status = e.target.value;
    await api('/api/saved/' + encodeURIComponent(j.id), 'PATCH', { status });
    j.savedStatus = status;
    el.querySelector('.status-dot').className = 'status-dot ' + status;
  };
  el.querySelector('.sj-unsave').onclick = async () => {
    await api('/api/saved/' + encodeURIComponent(j.id), 'DELETE');
    savedCache = savedCache.filter(s => s.id !== j.id);
    updateSavedBadge();
    el.remove();
    if (!savedCache.length) renderSaved();
  };
  return el;
}

/* ── Profile ────────────────────────────────────────── */
function setupProfile() {
  $('#profHeadline').value = user.headline || '';
  $('#levelSel').value     = user.prefs?.level || '';
  $('#remoteChk').checked  = !!user.prefs?.remote;

  renderTagInput('skillInput', 'skillTags', user.skills || [], onSkillsChange);
  renderTagInput('roleInput',  'roleTags',  user.prefs?.roles || [], onRolesChange);
  renderTagInput('locInput',   'locTags',   user.prefs?.locations || [], onLocsChange);
  renderSkillSuggestions();

  $('#saveProfileBtn').onclick = saveProfile;
}

let _skills = [], _roles = [], _locs = [];

function onSkillsChange(v) { _skills = v; renderSkillSuggestions(); }
function onRolesChange(v)  { _roles  = v; }
function onLocsChange(v)   { _locs   = v; }

function renderTagInput(inputId, tagsId, initial, onChange) {
  let vals = [...initial];
  const input = document.getElementById(inputId);
  const box   = document.getElementById(tagsId);
  if (inputId === 'skillInput') _skills = vals;
  if (inputId === 'roleInput')  _roles  = vals;
  if (inputId === 'locInput')   _locs   = vals;

  function render() {
    box.innerHTML = '';
    vals.forEach((t, i) => {
      const el = document.createElement('span');
      el.className = 'tag';
      el.innerHTML = `<b></b><button>×</button>`;
      el.querySelector('b').textContent = t;
      el.querySelector('button').onclick = () => { vals.splice(i, 1); onChange(vals); render(); };
      box.appendChild(el);
    });
  }
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();
      const v = input.value.trim();
      if (!vals.some(x => x.toLowerCase() === v.toLowerCase())) vals.push(v);
      input.value = ''; onChange(vals); render();
    }
  });
  render();
}

function renderSkillSuggestions() {
  const box = $('#skillSuggest'); box.innerHTML = '';
  SKILL_SUGGESTIONS.filter(s => !_skills.some(x => x.toLowerCase() === s.toLowerCase()))
    .slice(0, 10).forEach(s => {
      const el = document.createElement('span');
      el.className = 'tag suggest'; el.textContent = '+ ' + s;
      el.onclick = () => {
        _skills.push(s);
        renderTagInput('skillInput', 'skillTags', _skills, onSkillsChange);
        renderSkillSuggestions();
      };
      box.appendChild(el);
    });
}

async function saveProfile() {
  const btn = $('#saveProfileBtn');
  btn.disabled = true; btn.textContent = '⏳ Saving…';
  try {
    user = await api('/api/me', 'PATCH', {
      headline: $('#profHeadline').value.trim(),
      skills:   _skills,
      prefs:    { roles: _roles, locations: _locs, level: $('#levelSel').value, remote: $('#remoteChk').checked }
    });
    const ok = $('#saveOk');
    ok.classList.remove('hide');
    setTimeout(() => ok.classList.add('hide'), 2500);
  } finally {
    btn.disabled = false; btn.textContent = '💾 Save profile';
  }
}

/* ── Banner ─────────────────────────────────────────── */
function showBanner(type, msg) {
  $('#banner').innerHTML = `<div class="banner ${type}">${esc(msg)}</div>`;
}

/* ── API helper ─────────────────────────────────────── */
async function api(path, method = 'GET', body) {
  const opts = { method, headers: {} };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const r = await fetch(path, opts);
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

/* ── PWA: install prompt ───────────────────────────── */
let deferredPrompt = null;
function handleInstallPrompt() {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
}

/* ── PWA: service worker ───────────────────────────── */
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.warn);
  }
}

init();
