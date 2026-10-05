/* 1% Better — app logic.
   IndexedDB (db.js) is the source of truth; S mirrors it in memory for fast rendering. */

/* ---------- constants & helpers ---------- */
const MN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const QUOTES = ['Get 1% better every day.', 'Small daily wins compound into big results.', 'Discipline is choosing what you want most over what you want now.', 'Don’t break the chain.', 'Progress, not perfection.', 'Systems beat goals.', 'Start where you are. Use what you have.', 'Consistency beats intensity.', 'Show up, even on the hard days.', 'Done is better than perfect.', 'Every check mark is a vote for who you’re becoming.', 'Motivation starts you. Habits keep you going.'];
const STORES = ['habits', 'checks', 'sleep', 'notes', 'prefs'];
const PCT = { y: { beginAtZero: true, max: 100 } };
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const ds = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;   // local YYYY-MM-DD
const today = () => ds(new Date());
const dim = (y, m) => new Date(y, m + 1, 0).getDate();
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const deb = (f, ms = 400) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const sleepMins = (bed, wake) => { const d = mins(wake) - mins(bed); return d > 0 ? d : d + 1440; };
const fmtDur = m => `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
let tt; const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 1200); };

/* ---------- state ---------- */
const S = { habits: [], checks: {}, sleep: {}, notes: {}, prefs: { key: 'main', theme: 'light', target: 80, remind: false, time: '20:00' } };
const now = new Date(), V = { y: now.getFullYear(), m: now.getMonth() };   // V = month being viewed
const savePrefs = deb(() => DB.put('prefs', S.prefs), 200);
const saveNote = async (date, patch) => { const r = { ...(S.notes[date] || { date }), ...patch }; S.notes[date] = r; await DB.put('notes', r); };

function applyTheme() {
  const t = S.prefs.theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.bsTheme = t;
  try { localStorage.setItem('opb-theme', t); } catch (e) {}
  Chart.defaults.color = t === 'dark' ? '#94a3b8' : '#6b7280';
  Chart.defaults.borderColor = t === 'dark' ? '#243044' : '#e5e7eb';
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
}

/* ---------- calculations ---------- */
function dayStats(date) {
  let n = 0, p = 0;
  S.habits.forEach(h => { if (S.checks[date + '|' + h.id]) { n++; p += h.pts; } });
  const total = S.habits.length;
  return { n, p, total, pct: total ? n / total * 100 : 0 };
}
const monthDays = (y, m) => Array.from({ length: dim(y, m) }, (_, i) => ds(new Date(y, m, i + 1)));
const rangeDays = (end, count) => Array.from({ length: count }, (_, i) => { const d = new Date(end); d.setDate(d.getDate() - (count - 1 - i)); return ds(d); });
// days of a month that have started (0 for future months)
const elapsed = (y, m) => { const c = new Date(), cur = c.getFullYear() * 12 + c.getMonth(), v = y * 12 + m; return v < cur ? dim(y, m) : v === cur ? c.getDate() : 0; };
function monthStats(y, m) {
  const days = monthDays(y, m).slice(0, elapsed(y, m));
  let n = 0, p = 0;
  days.forEach(d => { const s = dayStats(d); n += s.n; p += s.p; });
  const denom = S.habits.length * days.length;
  return { pct: denom ? n / denom * 100 : 0, pts: p };
}
function streaks() {
  const keys = Object.keys(S.checks).map(k => k.slice(0, 10)).sort(), t = today();
  if (!keys.length || !S.habits.length) return { cur: 0, best: 0 };
  let run = 0, best = 0;
  for (const d = new Date(keys[0] + 'T00:00'); ds(d) <= t; d.setDate(d.getDate() + 1)) {
    const s = ds(d);
    if (dayStats(s).pct >= S.prefs.target) run++;
    else if (s !== t) run = 0;          // today is never penalised before it ends
    best = Math.max(best, run);
  }
  return { cur: run, best };
}

/* ---------- charts ---------- */
const charts = {};
function draw(id, type, labels, data, label, extra = {}) {
  const el = $('#' + id); if (!el) return;
  charts[id]?.destroy();
  charts[id] = new Chart(el, {
    type,
    data: { labels, datasets: [{ label, data, backgroundColor: type === 'line' ? 'rgba(37,99,235,.12)' : '#2563eb', borderColor: '#2563eb', borderRadius: 6, fill: true, tension: .35, pointRadius: 2, spanGaps: true }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: extra.scales || { y: { beginAtZero: true } }, ...(extra.opts || {}) },
  });
}

/* ---------- router ---------- */
const PAGES = { home: renderHome, habits: renderHabits, sleep: renderSleep, analytics: renderAnalytics, journal: renderJournal, settings: renderSettings };
function route() {
  const h = location.hash.slice(2), p = h in PAGES ? h : 'home';
  $$('.page').forEach(s => s.classList.toggle('on', s.id === p));
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.p === p));
  PAGES[p]();
}
const mbar = () => `<div class="d-flex gap-2"><select class="form-select w-auto msel" aria-label="Month">${MN.map((n, i) => `<option value="${i}"${i === V.m ? ' selected' : ''}>${n}</option>`).join('')}</select><input type="number" class="form-control yin" style="width:6rem" aria-label="Year" value="${V.y}"></div>`;

/* ---------- Home ---------- */
function renderHome() {
  const d = new Date(), t = ds(d), s = dayStats(t), st = streaks(), hr = d.getHours();
  $('#hello').textContent = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  $('#today').textContent = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  $('#quote').textContent = QUOTES[Math.floor(d / 864e5) % QUOTES.length];
  $('#ringtxt').textContent = Math.round(s.pct) + '%';
  requestAnimationFrame(() => { $('#ringfg').style.strokeDashoffset = 326.7 * (1 - s.pct / 100); });
  const week = rangeDays(d, 7).reduce((a, x) => a + dayStats(x).p, 0), ms = monthStats(d.getFullYear(), d.getMonth());
  const last = S.sleep[Object.keys(S.sleep).sort().pop()];
  const tiles = [['Done today', `${s.n}/${s.total}`], ['Score today', s.p + ' pts'], ['This week', week + ' pts'], ['This month', ms.pts + ' pts'], ['Current streak', st.cur + ' days'], ['Longest streak', st.best + ' days'], ['Last sleep', last ? fmtDur(last.dur) : '—'], ['Month completion', Math.round(ms.pct) + '%']];
  $('#stats').innerHTML = tiles.map(([k, v]) => `<div class="col-6 col-lg-3"><div class="card tile"><small>${k}</small><b>${v}</b></div></div>`).join('');
  $('#todayList').innerHTML = S.habits.length
    ? S.habits.map(h => `<label class="d-flex align-items-center gap-2 py-1"><input type="checkbox" class="form-check-input ck m-0" data-k="${t}|${h.id}" ${S.checks[t + '|' + h.id] ? 'checked' : ''}> ${esc(h.name)}<span class="ms-auto small">${h.pts} pts</span></label>`).join('')
    : '<a href="#/habits">Add your first habit</a>';
  $('#goal').value = S.notes[t]?.goal || '';
  const days = monthDays(d.getFullYear(), d.getMonth());
  draw('cHome', 'line', days.map(x => +x.slice(8)), days.map((x, i) => i < d.getDate() ? Math.round(dayStats(x).pct) : null), 'Completion %', { scales: PCT });
}

/* ---------- Habits ---------- */
function renderHabits() {
  const wrap = $('#gridWrap'), sc = wrap.scrollLeft, days = monthDays(V.y, V.m), t = today(), hs = S.habits;
  $('#hbar').innerHTML = mbar();
  let h = `<thead><tr><th class="sticky-col">Habit</th><th>Pts</th>${days.map(d => `<th class="${d === t ? 'today' : ''}">${+d.slice(8)}</th>`).join('')}</tr></thead><tbody>`;
  hs.forEach(x => {
    h += `<tr><td class="sticky-col"><a href="#" class="hedit text-reset text-decoration-none" data-id="${x.id}">${esc(x.name)}</a></td><td>${x.pts}</td>`
      + days.map(d => `<td><input type="checkbox" class="form-check-input ck" data-k="${d}|${x.id}" aria-label="${esc(x.name)} ${d}" ${S.checks[d + '|' + x.id] ? 'checked' : ''}></td>`).join('') + '</tr>';
  });
  const st = days.map(d => dayStats(d));
  h += `</tbody><tfoot><tr><th class="sticky-col">Points</th><th></th>${st.map(s => `<th>${s.p}</th>`).join('')}</tr><tr><th class="sticky-col">Done</th><th></th>${st.map(s => `<th>${Math.round(s.pct)}%</th>`).join('')}</tr></tfoot>`;
  $('#grid').innerHTML = hs.length ? h : '<tbody><tr><td class="p-4 small">No habits yet. Tap “Habit” to add one.</td></tr></tbody>';
  wrap.scrollLeft = sc;
  const ms = monthStats(V.y, V.m);
  $('#mPct').textContent = `${Math.round(ms.pct)}% · ${ms.pts} pts`;
  $('#addHabit').disabled = hs.length >= 12;
}

let editing = null;
const hm = () => bootstrap.Modal.getOrCreateInstance($('#hm'));
function openHabit(id) {
  if (!id && S.habits.length >= 12) return;
  editing = id ? S.habits.find(h => h.id === id) : null;
  $('#hmT').textContent = editing ? 'Edit habit' : 'New habit';
  $('#hName').value = editing?.name || ''; $('#hPts').value = editing?.pts || 1;
  $('#hExtra').style.visibility = editing ? 'visible' : 'hidden';
  hm().show();
}
async function persistHabits() {
  S.habits.forEach((h, i) => h.order = i);
  await Promise.all(S.habits.map(h => DB.put('habits', h)));
  route();
}
async function moveHabit(dir) {
  const i = S.habits.indexOf(editing), j = i + dir;
  if (j < 0 || j >= S.habits.length) return;
  [S.habits[i], S.habits[j]] = [S.habits[j], S.habits[i]];
  await persistHabits();
}

/* ---------- Sleep ---------- */
function renderSleep() {
  $('#sbar').innerHTML = mbar();
  const dt = $('#sDate').value = $('#sDate').value || today(), r = S.sleep[dt];
  $('#sBed').value = r?.bed || '23:00'; $('#sWake').value = r?.wake || '07:00'; $('#sQ').value = r?.q || 3;
  $('#sDur').textContent = r ? `Slept ${fmtDur(r.dur)}` : 'Not logged yet';
  const recs = Object.values(S.sleep).sort((a, b) => a.date.localeCompare(b.date)).slice(-14), n = recs.length || 1;
  const bt = recs.map(x => { const v = mins(x.bed); return v < 720 ? v + 1440 : v; });   // after-midnight bedtimes count as late, not early
  const mean = bt.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(bt.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  $('#sAvg').textContent = recs.length ? fmtDur(Math.round(recs.reduce((a, x) => a + x.dur, 0) / n)) : '—';
  $('#sCons').textContent = recs.length > 1 ? Math.max(0, Math.round(100 - sd / 1.2)) + '%' : '—';
  const range = +$('#sRange').value, days = rangeDays(new Date(), range);
  draw('cSleep', range > 7 ? 'line' : 'bar', days.map(d => d.slice(5)), days.map(d => S.sleep[d] ? +(S.sleep[d].dur / 60).toFixed(1) : null), 'Hours');
  $('#cal').innerHTML = monthDays(V.y, V.m).map(d => {
    const x = S.sleep[d], a = x ? Math.min(1, x.dur / 540) : 0;
    return `<div data-d="${d}"${x ? ` style="background:rgba(37,99,235,${(.15 + a * .85).toFixed(2)});color:${a > .5 ? '#fff' : 'inherit'}" title="Quality ${x.q}/5"` : ''}>${+d.slice(8)}${x ? `<br>${(x.dur / 60).toFixed(1)}` : ''}</div>`;
  }).join('');
}
async function saveSleep() {
  const date = $('#sDate').value, bed = $('#sBed').value, wake = $('#sWake').value;
  if (!date || !bed || !wake) return;
  const rec = { date, bed, wake, q: +$('#sQ').value, dur: sleepMins(bed, wake) };
  S.sleep[date] = rec; await DB.put('sleep', rec); toast('Sleep saved'); renderSleep();
}

/* ---------- Analytics ---------- */
function renderAnalytics() {
  $('#abar').innerHTML = mbar();
  $('#agrid').innerHTML = [['cDaily', 'Daily completion (%)'], ['cWeek', 'Weekly performance (last 8 weeks)'], ['cMonth', 'Monthly performance (last 6 months)'], ['cSleepA', 'Sleep history (hours, last 30 days)'], ['cHabit', 'Habit consistency (%)'], ['cPts', 'Points earned per day']]
    .map(([id, t]) => `<div class="col-12 col-lg-6"><div class="card p-3"><b class="mb-2">${t}</b><div class="box"><canvas id="${id}"></canvas></div></div></div>`).join('');
  const days = monthDays(V.y, V.m), st = days.map(d => dayStats(d));
  draw('cDaily', 'bar', days.map(d => +d.slice(8)), st.map(s => Math.round(s.pct)), 'Completion %', { scales: PCT });
  const wk = Array.from({ length: 8 }, (_, i) => { const end = new Date(); end.setDate(end.getDate() - 7 * (7 - i)); const w = rangeDays(end, 7); return [w[6].slice(5), Math.round(w.reduce((a, d) => a + dayStats(d).pct, 0) / 7)]; });
  draw('cWeek', 'line', wk.map(x => x[0]), wk.map(x => x[1]), 'Average %', { scales: PCT });
  const mo = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); return [MN[d.getMonth()].slice(0, 3), Math.round(monthStats(d.getFullYear(), d.getMonth()).pct)]; });
  draw('cMonth', 'bar', mo.map(x => x[0]), mo.map(x => x[1]), 'Average %', { scales: PCT });
  const sd = rangeDays(new Date(), 30);
  draw('cSleepA', 'line', sd.map(d => d.slice(5)), sd.map(d => S.sleep[d] ? +(S.sleep[d].dur / 60).toFixed(1) : null), 'Hours');
  const n = Math.max(1, elapsed(V.y, V.m));
  draw('cHabit', 'bar', S.habits.map(h => h.name), S.habits.map(h => Math.round(days.slice(0, n).filter(d => S.checks[d + '|' + h.id]).length / n * 100)), 'Consistency %', { opts: { indexAxis: 'y' }, scales: { x: { beginAtZero: true, max: 100 } } });
  draw('cPts', 'bar', days.map(d => +d.slice(8)), st.map(s => s.p), 'Points');
}

/* ---------- Journal ---------- */
const JF = ['ach', 'chal', 'mot', 'imp'];
function renderJournal() {
  const d = $('#jDate').value = $('#jDate').value || today(), n = S.notes[d] || {};
  JF.forEach(k => { $('#j-' + k).value = n[k] || ''; });
}
const journalSave = deb(async () => {
  const p = {}; JF.forEach(k => { p[k] = $('#j-' + k).value; });
  await saveNote($('#jDate').value, p); toast('Saved');
});

/* ---------- Settings, backup, reports ---------- */
function renderSettings() {
  $('#stbar').innerHTML = mbar();
  $('#stDark').checked = S.prefs.theme === 'dark';
  $('#stTarget').value = S.prefs.target; $('#tv').textContent = S.prefs.target;
  $('#stRem').checked = S.prefs.remind; $('#stTime').value = S.prefs.time;
}
const download = (name, text, type) => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
const snapshot = () => ({ app: '1-percent-better', version: 1, exported: new Date().toISOString(), habits: S.habits, checks: Object.keys(S.checks), sleep: Object.values(S.sleep), notes: Object.values(S.notes), prefs: S.prefs });
function validBackup(d) {
  const date = /^\d{4}-\d{2}-\d{2}$/, hhmm = /^\d\d:\d\d$/;
  return !!(d && d.app === '1-percent-better' && Array.isArray(d.habits) && Array.isArray(d.checks) && Array.isArray(d.sleep) && Array.isArray(d.notes)
    && d.habits.length <= 12 && d.habits.every(h => h && /^[\w-]+$/.test(h.id) && typeof h.name === 'string' && Number.isFinite(h.pts))
    && d.checks.every(k => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}\|[\w-]+$/.test(k))
    && d.sleep.every(r => r && date.test(r.date) && hhmm.test(r.bed) && hhmm.test(r.wake) && Number.isFinite(r.dur))
    && d.notes.every(r => r && date.test(r.date)));
}
async function importBackup(file) {
  let d; try { d = JSON.parse(await file.text()); } catch (e) { return alert('That file is not valid JSON. Nothing was changed.'); }
  if (!validBackup(d)) return alert('That file is not a valid 1% Better backup. Nothing was changed.');
  if (!confirm(`Replace ALL current data (${S.habits.length} habits, ${Object.keys(S.checks).length} check-ins) with this backup (${d.habits.length} habits, ${d.checks.length} check-ins)?\n\nExport a backup first if you are unsure.`)) return;
  const p = d.prefs || {};
  const prefs = { key: 'main', theme: p.theme === 'dark' ? 'dark' : 'light', target: Math.min(100, Math.max(10, +p.target || 80)), remind: false, time: /^\d\d:\d\d$/.test(p.time) ? p.time : '20:00' };
  await Promise.all(STORES.map(s => DB.clear(s)));
  await Promise.all([
    ...d.habits.map((h, i) => DB.put('habits', { id: h.id, name: String(h.name).slice(0, 40), pts: Math.min(100, Math.max(1, h.pts)), order: i })),
    ...d.checks.map(k => DB.put('checks', { k })),
    ...d.sleep.map(r => DB.put('sleep', r)),
    ...d.notes.map(r => DB.put('notes', r)),
    DB.put('prefs', prefs),
  ]);
  location.reload();
}
function exportCsv() {
  const days = monthDays(V.y, V.m), q = s => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [['Habit', 'Points', ...days.map(d => +d.slice(8))],
    ...S.habits.map(h => [h.name, h.pts, ...days.map(d => S.checks[d + '|' + h.id] ? 1 : 0)]),
    ['Daily points', '', ...days.map(d => dayStats(d).p)],
    ['Completion %', '', ...days.map(d => Math.round(dayStats(d).pct))]];
  download(`habits-${V.y}-${pad(V.m + 1)}.csv`, rows.map(r => r.map(q).join(',')).join('\n'), 'text/csv');
}
function printReport() {
  const ms = monthStats(V.y, V.m), st = streaks(), n = Math.max(1, elapsed(V.y, V.m)), days = monthDays(V.y, V.m).slice(0, n);
  const sl = days.map(d => S.sleep[d]).filter(Boolean), avg = sl.length ? fmtDur(Math.round(sl.reduce((a, x) => a + x.dur, 0) / sl.length)) : '—';
  const rows = S.habits.map(h => { const c = days.filter(d => S.checks[d + '|' + h.id]).length; return `<tr><td>${esc(h.name)}</td><td>${h.pts}</td><td>${c}/${n}</td><td>${Math.round(c / n * 100)}%</td></tr>`; }).join('');
  $('#report').innerHTML = `<h1>1% Better — ${MN[V.m]} ${V.y}</h1><p>Completion <b>${Math.round(ms.pct)}%</b> · Points <b>${ms.pts}</b> · Current streak <b>${st.cur}</b> · Longest streak <b>${st.best}</b> · Average sleep <b>${avg}</b></p><table class="table table-sm"><tr><th>Habit</th><th>Points</th><th>Days done</th><th>Consistency</th></tr>${rows}</table>`;
  window.print();
}

/* ---------- reminders (fire while the app is open) ---------- */
let lastRemind = '';
function checkReminder() {
  const d = new Date(), hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`, key = today() + hhmm;
  if (!S.prefs.remind || !window.Notification || Notification.permission !== 'granted' || hhmm !== S.prefs.time || key === lastRemind) return;
  lastRemind = key;
  const s = dayStats(today()), body = `${s.n}/${s.total} habits done today. Get 1% better!`;
  if (navigator.serviceWorker) navigator.serviceWorker.ready.then(r => r.showNotification('1% Better', { body, icon: 'icons/icon-192.png' })).catch(() => new Notification('1% Better', { body }));
  else new Notification('1% Better', { body });
}

/* ---------- event wiring ---------- */
function wire() {
  window.onhashchange = () => { route(); scrollTo(0, 0); };
  document.addEventListener('change', async e => {
    const el = e.target;
    if (el.matches('.ck')) {
      const k = el.dataset.k;
      if (el.checked) { S.checks[k] = true; await DB.put('checks', { k }); } else { delete S.checks[k]; await DB.del('checks', k); }
      route();
    } else if (el.matches('.msel')) { V.m = +el.value; route(); }
    else if (el.matches('.yin')) { V.y = +el.value || V.y; route(); }
  });
  document.addEventListener('click', e => {
    const a = e.target.closest('.hedit'); if (a) { e.preventDefault(); openHabit(a.dataset.id); }
    const c = e.target.closest('#cal [data-d]'); if (c) { $('#sDate').value = c.dataset.d; renderSleep(); }
  });
  // habits
  $('#addHabit').onclick = () => openHabit();
  $('#hUp').onclick = () => moveHabit(-1); $('#hDn').onclick = () => moveHabit(1);
  $('#hSave').onclick = async () => {
    const name = $('#hName').value.trim(), pts = Math.min(100, Math.max(1, +$('#hPts').value || 1));
    if (!name) return $('#hName').focus();
    if (editing) Object.assign(editing, { name, pts });
    else if (S.habits.length < 12) S.habits.push({ id: 'h' + Date.now().toString(36), name, pts, order: S.habits.length });
    hm().hide(); await persistHabits();
  };
  $('#hDel').onclick = async () => {
    if (!confirm(`Delete “${editing.name}” and all of its history?`)) return;
    const id = editing.id;
    S.habits = S.habits.filter(h => h.id !== id); await DB.del('habits', id);
    for (const k of Object.keys(S.checks)) if (k.endsWith('|' + id)) { delete S.checks[k]; await DB.del('checks', k); }
    hm().hide(); await persistHabits();
  };
  // home, sleep, journal
  $('#goal').oninput = deb(e => saveNote(today(), { goal: e.target.value }));
  $$('.sf').forEach(el => { el.onchange = saveSleep; });
  $('#sSave').onclick = saveSleep; $('#sDate').onchange = renderSleep; $('#sRange').onchange = renderSleep;
  $('#jDate').onchange = renderJournal; $('#jForm').oninput = journalSave;
  // settings
  $('#stDark').onchange = e => { S.prefs.theme = e.target.checked ? 'dark' : 'light'; applyTheme(); savePrefs(); route(); };
  $('#stTarget').oninput = e => { S.prefs.target = +e.target.value; $('#tv').textContent = e.target.value; savePrefs(); };
  $('#stTime').onchange = e => { S.prefs.time = e.target.value || '20:00'; savePrefs(); };
  $('#stRem').onchange = async e => {
    if (e.target.checked) {
      const ok = !!window.Notification && (Notification.permission === 'granted' || await Notification.requestPermission() === 'granted');
      if (!ok) { e.target.checked = false; return toast('Notifications unavailable'); }
    }
    S.prefs.remind = e.target.checked; savePrefs();
  };
  $('#bExp').onclick = () => download(`1percent-backup-${today()}.json`, JSON.stringify(snapshot(), null, 2), 'application/json');
  $('#bImp').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importBackup(f); };
  $('#bCsv').onclick = exportCsv; $('#bPdf').onclick = printReport;
  $('#bReset').onclick = async () => {
    if (!confirm('Erase ALL data on this device? This cannot be undone.') || !confirm('Really erase everything?')) return;
    await Promise.all(STORES.map(s => DB.clear(s))); location.reload();
  };
}

/* ---------- start ---------- */
async function init() {
  await DB.open();
  const [hs, cs, sl, nt, pr] = await Promise.all(STORES.map(s => DB.all(s)));
  S.habits = hs.sort((a, b) => a.order - b.order);
  cs.forEach(c => { S.checks[c.k] = true; });
  sl.forEach(r => { S.sleep[r.date] = r; });
  nt.forEach(r => { S.notes[r.date] = r; });
  if (pr[0]) Object.assign(S.prefs, pr[0]);
  applyTheme(); wire(); route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  setInterval(checkReminder, 30000);
}
init();
