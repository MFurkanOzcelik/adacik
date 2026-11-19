'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* ---------- icons (1.6px strokes, 24 grid) ---------- */
const ICON = {
  timer: '<path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/>',
  clip: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  note: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a1.4 1.4 0 0 1 3 3l-9 9a2 2 0 0 1-.85.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.85z"/>',
  music: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  cup: '<path d="M10 2v2M14 2v2M6 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/>',
  text: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  pick: '<path d="m2 22 1-1h3l9-9M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4z"/>',
  calc: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M8 6h8M16 14v4M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/>',
  pulse: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  cal: '<path d="M8 2v4M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="14" rx="1.5"/><rect width="7" height="7" x="3" y="14" rx="1.5"/>',
  shot: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/>',
  shelf: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  play: '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8.5 5v14M15.5 5v14" stroke-width="3"/>',
  prev: '<path d="M6 5v14" stroke-width="2.2"/><path d="M19 5l-10 7 10 7z" fill="currentColor"/>',
  next: '<path d="M18 5v14" stroke-width="2.2"/><path d="M5 5l10 7-10 7z" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.5-4.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
  lt: '<path d="M15 5l-7 7 7 7"/>', gt: '<path d="M9 5l7 7-7 7"/>',
  pencil: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  down: '<path d="M12 4v12M6 11l6 6 6-6M5 20h14"/>',
  power: '<path d="M12 3v9M6.5 6.5a7.5 7.5 0 1 0 11 0"/>',
  doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>',
  undo: '<path d="M4 4v6h6"/><path d="M4.5 10a8 8 0 1 1 1.8 7"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  tiles: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/>',
  eraser: '<path d="M7 20h13M5 16l9-11 6 5-8 10H8z"/>',
  enter: '<path d="M20 5v7a3 3 0 0 1-3 3H5M9 11l-4 4 4 4"/>',
  resize: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  vol: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  volLow: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>',
  lyrics: '<path d="M17 6H3M21 12H8M21 18H8M3 12v6"/>',
  qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3M21 21v.01M12 7v3a2 2 0 0 1-2 2H7M3 12h.01M12 3h.01M12 16v.01M16 12h1M21 12v.01M12 21v-1"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
  scanText: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8h8M7 12h10M7 16h6"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  phone: '<rect width="12" height="20" x="6" y="2" rx="2.5"/><path d="M11 18h2"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  languages: '<path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/>',
  swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82"/>',
  apple: '<path d="M12 6.5c.7-1.6 2-2.5 3.5-2.5M16.8 20c-1 .9-2 1-3 .5-1-.4-1.9-.4-2.9 0-1.1.5-2 .4-3-.5C5.5 17.8 4 14.6 4 11.9 4 8.9 6 7 8.3 7c1.2 0 2.1.6 2.9.6s1.9-.7 3.3-.6c1.6.1 2.9.9 3.6 2.2-1.6 1-2.2 2.4-2 4 .2 1.7 1.3 2.9 2.8 3.4-.5 1.3-1.2 2.4-2.1 3.4z"/>',
  android: '<path d="M5 16V11a7 7 0 0 1 14 0v5zM8 5.5 6.5 3.5M16 5.5l1.5-2M9.5 10h.01M14.5 10h.01"/>',
  upload: '<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>',
  send: '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  bksp: '<path d="M8 5h12v14H8l-6-7z"/><path d="M12 9l5 6M17 9l-5 6"/>',
};
const ic = (n, s = 20, extra = '') => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ${extra}>${ICON[n]}</svg>`;

/* ---------- state ---------- */
const shell = $('#shell'), view = $('#view'), bar = $('#bar'), stage = $('#stage');
let S = {
  settings: { hoverOpen: true, theme: 'auto', accentMode: 'windows', accent: '#f08a24', position: 'center', onTop: true, alwaysShow: true, shape: 'notch', order: null, awake: false },
  notes: [{ id: 1, text: '' }], events: {}, colors: [], shelf: [], calcHist: [], launch: null, notifs: [], notifIcons: {}, appIcons: {}, notifSeen: 0,
};
let clips = [], winAccent = '#f08a24', wallAccent = null;
const ui = { open: false, pinned: false, view: 'grid', page: 0, edit: false };

function save(k) { api.send('store:set', k, S[k]); }
function toast(t) { const el = $('#toast'); el.textContent = t; el.style.top = (shell.offsetHeight + (ui.open ? 6 : 0) + 12) + 'px'; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1700); }

/* ---------- theme ---------- */
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
function lum(hex) { const n = parseInt(hex.slice(1), 16), c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function applyTheme() {
  const st = S.settings, root = document.documentElement;
  root.dataset.theme = st.theme === 'auto' ? (darkMQ.matches ? 'dark' : 'light') : st.theme;
  const acc = st.accentMode === 'wallpaper' ? (wallAccent || winAccent) : st.accentMode === 'windows' ? winAccent : (st.accent || '#f08a24');
  root.style.setProperty('--accent', acc);
  root.style.setProperty('--on-accent', lum(acc) > .35 ? '#16120a' : '#ffffff');
  stage.className = st.position === 'left' ? 'left' : st.position === 'right' ? 'right' : '';
}
darkMQ.addEventListener('change', applyTheme);
api.on('accent', c => { winAccent = c; applyTheme(); });
api.on('accent:wall', c => { wallAccent = c; applyTheme(); });

/* ---------- shell sizing / open / close ---------- */
const SIZES = {
  grid: [700, 262], media: [600, 360], clipboard: [700, 166], notes: [700, 326], calendar: [740, 352],
  monitor: [820, 450], start: [760, 536], calc: [660, 404], text: [700, 314], shelf: [700, 256],
  settings: [700, 496], translate: [780, 66 + 300], fx: [600, 66 + 96], phone: [820, 66 + 430], timer: [680, 366], ocr: [620, 302], qr: [740, 66 + 396], launch: [700, 398], color: [700, 250], notifs: [700, 66 + 380],
};
function sizeShell(w, h) { if (ui.open) h += 6 + (document.documentElement.dataset.theme === 'dark' ? 12 : 0); const off = ui.open || S.settings.shape === 'capsule' ? 6 : 0; shell.style.width = w + 'px'; shell.style.height = h + 'px'; api.send('rect', { w, h: h + off }); }
// What the closed island shows, most important first.
const OSD = { kind: '', v: 0, muted: false, until: 0, t: 0 };
const NQ = { queue: [], cur: null, hold: false, t: 0 };
function closedMode() {
  if (OSD.until > Date.now()) return 'osd';
  if (NQ.cur) return 'notif';
  if (S.settings.timerPill !== false && (T.running || T.done || SW.running)) return 'timer';
  if (hasMini()) return 'mini';
  if (S.settings.alwaysShow !== false) return 'info';
  return 'idle';
}
function showInfo() { return closedMode() === 'info'; }
function collapsedSize() {
  const grow = ui.near && S.settings.hoverOpen === false ? 12 : 0, m = closedMode();
  if (m === 'osd') return [236, 38];
  if (m === 'notif') return [380, 64];
  if (m === 'timer') return [(T.label || (SW.running && !T.running) ? 210 : 140) + grow, 32 + (grow ? 4 : 0)];
  if (m === 'mini') return [270 + grow, 38];
  if (m === 'info') return [(battery.present ? 168 : 112) + grow, 30 + (grow ? 4 : 0)];
  return grow ? [168, 16] : [140, 8];
}
function closedState() {
  const m = ui.open ? 'open' : closedMode();
  shell.classList.toggle('has-mini', m === 'mini');
  shell.classList.toggle('has-info', m === 'info');
  ['osd', 'notif', 'timer'].forEach(k => shell.classList.toggle('mode-' + k, m === k));
  shell.classList.toggle('near', !!ui.near && !ui.open);
  shell.classList.toggle('tucked', m === 'idle' && !ui.near && S.settings.alwaysShow === false);
  shell.classList.toggle('capsule', S.settings.shape === 'capsule');
}
let lastMode = '';
function refreshClosed() { if (ui.open) return; const m = closedMode(); if (m !== lastMode) { lastMode = m; if (m === 'timer') paintTimerPill(); applyClosedSize(); } }
// ---- volume / brightness indicator ----
function showOsd(kind, v, muted) {
  if (S.settings.osd === false || ui.open) return;
  Object.assign(OSD, { kind, v, muted, until: Date.now() + 1600 });
  const pct = Math.round(v * 100);
  $('#osdIcon').innerHTML = ic(kind === 'br' ? 'sun' : muted || pct === 0 ? 'mute' : pct < 50 ? 'volLow' : 'vol', 16);
  $('#osdBar i').style.width = (muted ? 0 : pct) + '%'; $('#osdVal').textContent = muted ? '0' : pct;
  lastMode = 'osd'; applyClosedSize();
  clearTimeout(OSD.t); OSD.t = setTimeout(refreshClosed, 1650);
}
// ---- notification island ----
api.on('notif', n => { if (S.settings.notifs !== false) notify(n); });
// Every notification (Windows, phone, calendar) goes through here: kept in the history, then shown.
function notify(n) {
  const e = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: Date.now(), app: n.app || 'Bildirim', title: n.title || '', body: n.body || '', aid: n.aid || '', to: n.to || '' };
  if (n.icon) S.notifIcons[e.app] = n.icon;
  S.notifs = [e, ...(S.notifs || [])].slice(0, 150); save('notifs'); save('notifIcons');
  n = { ...n, nid: e.id };
  if (e.aid && !S.appIcons[e.aid]) api.invoke('notifs:icon', e.aid).then(b => {
    if (!b) return; S.appIcons[e.aid] = b; save('appIcons');
    if (NQ.cur && NQ.cur.aid === e.aid) paintNotifIcon(NQ.cur);
    if (ui.open && ui.view === 'notifs') paintNotifs();
  });
  if (ui.open) {
    if (ui.view === 'notifs') { S.notifSeen = Date.now(); save('notifSeen'); paintNotifs(); }
    else toast(e.app + ': ' + (e.title || e.body || 'Yeni bildirim'));
    $$('.t-nt').forEach(el => TILES.notifs.live(el, el.dataset.sz));
    return;
  }
  NQ.queue.push(n); if (NQ.queue.length > 5) NQ.queue.shift(); nextNotif();
}
function nextNotif() {
  if (NQ.cur || !NQ.queue.length) return;
  const n = NQ.cur = NQ.queue.shift();
  paintNotifIcon(n);
  $('#notifApp').textContent = n.app || 'Bildirim';
  $('#notifTitle').textContent = n.title || ''; $('#notifBody').textContent = n.body || '';
  lastMode = 'notif'; applyClosedSize();
  clearTimeout(NQ.t); NQ.t = setTimeout(endNotif, 5500);
}
// The app's icon, and its main colour for the animated outline around the island.
const ntIconOf = n => (n.aid && S.appIcons[n.aid]) || n.icon || S.notifIcons[n.app] || '';
function paintNotifIcon(n) {
  const b = ntIconOf(n), el = $('#notifIcon');
  el.classList.toggle('img', !!b);
  el.innerHTML = b ? `<img src="data:image/png;base64,${b}" alt="">` : esc(((n.app || '?').trim()[0] || '?').toLocaleUpperCase('tr-TR'));
  iconColor(b).then(c => { if (NQ.cur === n) shell.style.setProperty('--nc', c || cssVar('--accent')); });
}
const colorCache = new Map();
function iconColor(b64) {
  if (!b64) return Promise.resolve('');
  if (colorCache.has(b64)) return Promise.resolve(colorCache.get(b64));
  return new Promise(res => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(im, 0, 0, 32, 32); const d = x.getImageData(0, 0, 32, 32).data;
      // weight pixels by how colourful they are, bucket by hue, take the strongest bucket
      const bins = Array.from({ length: 24 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 140) continue;
        const r = d[i] / 255, g = d[i + 1] / 255, bl = d[i + 2] / 255, mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), s = mx ? (mx - mn) / mx : 0;
        if (s < .25 || mx < .2) continue;
        let h = mx === mn ? 0 : mx === r ? ((g - bl) / (mx - mn) + 6) % 6 : mx === g ? (bl - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4;
        const k = bins[Math.floor(h / 6 * 24) % 24], w = s * s * mx; k.w += w; k.r += d[i] * w; k.g += d[i + 1] * w; k.b += d[i + 2] * w;
      }
      const best = bins.reduce((a, k) => k.w > a.w ? k : a, { w: 0 });
      let col = '';
      if (best.w > 2) {
        let [r, g, bl] = [best.r / best.w, best.g / best.w, best.b / best.w];
        const mx = Math.max(r, g, bl); if (mx < 170) { const f = 170 / mx; r *= f; g *= f; bl *= f; }   // keep it bright enough to glow
        col = `rgb(${Math.round(Math.min(255, r))}, ${Math.round(Math.min(255, g))}, ${Math.round(Math.min(255, bl))})`;
      }
      colorCache.set(b64, col); res(col);
    };
    im.onerror = () => res('');
    im.src = 'data:image/png;base64,' + b64;
  });
}
function endNotif() { if (NQ.hold) return; clearTimeout(NQ.t); NQ.cur = null; refreshClosed(); setTimeout(nextNotif, 450); }
api.on('fullscreen', v => { if (v && ui.open && !ui.pinned) setOpen(false); });
// ---- clock + battery shown in the closed pill ----
const battery = { present: false, level: 1, charging: false };
function paintInfo() {
  const now = new Date();
  $('#infoClock').textContent = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const b = $('#infoBat'); b.style.display = battery.present ? '' : 'none';
  if (battery.present) {
    const pct = Math.round(battery.level * 100);
    b.classList.toggle('low', pct <= 20 && !battery.charging); b.classList.toggle('chg', battery.charging);
    $('#infoBat i').style.width = Math.max(4, pct) + '%'; $('#infoPct').textContent = '%' + pct;
    b.title = battery.charging ? 'Şarj oluyor' : 'Pil';
  }
}
setInterval(paintInfo, 5000);
(async () => {
  battery.present = await api.invoke('battery:present');
  try {
    const bm = await navigator.getBattery();
    const upd = () => { battery.level = bm.level; battery.charging = bm.charging; paintInfo(); };
    ['levelchange', 'chargingchange'].forEach(ev => bm.addEventListener(ev, upd)); upd();
  } catch { battery.present = false; }
  paintInfo(); if (!ui.open) applyClosedSize();
})();
function applyClosedSize() { const [w, h] = collapsedSize(); closedState(); sizeShell(w, h); }

function setOpen(v) {
  if (v === ui.open) return;
  ui.open = v;
  if (v) {
    shell.classList.remove('closed', 'tucked', 'near'); shell.classList.add('open');
    go(ui.view || 'grid', true);
  } else {
    shell.classList.remove('open'); shell.classList.add('closed');
    stopViewTimers();
    lastMode = closedMode(); if (lastMode === 'timer') paintTimerPill();
    const [w, h] = collapsedSize(); closedState();
    setTimeout(() => sizeShell(w, h), 90);
    ui.view = 'grid'; ui.page = 0; if (ui.edit) { ui.edit = false; layout(); save('settings'); } api.send('focus', false); paintGlow();
  }
}
function onHover(h) {
  ui.hovering = h; ui.near = h;
  // The window is click-through while closed; let it receive the cursor (and file drags) while it is near.
  if (h && ign) { ign = false; api.send('ignore', false); }
  if (!h && !ui.open && !ign) { ign = true; api.send('ignore', true); }
  // Hovering a notification keeps it on screen instead of opening the panel.
  if (h && !ui.open && closedMode() === 'notif') { NQ.hold = true; return; }
  if (!h && NQ.hold) { NQ.hold = false; clearTimeout(NQ.t); NQ.t = setTimeout(endNotif, 1200); }
  if (h) { if (S.settings.hoverOpen !== false) setOpen(true); else if (!ui.open) applyClosedSize(); }
  // while the colour picker is open the cursor is out on the screen: keep the panel (and the picker) alive
  else { if (!ui.pinned && !typing() && !ui.picking) setOpen(false); if (!ui.open) applyClosedSize(); }
}
api.on('hover', onHover);
// With "Open on hover" off, a click on the pill opens the panel.
shell.addEventListener('click', e => {
  if (ui.open || e.target.closest('#pinBtn')) return;
  const m = closedMode();
  if (m === 'notif') { ntFocus = NQ.cur && NQ.cur.nid; NQ.hold = false; endNotif(); ui.view = 'notifs'; }   // click opens it in the notifications page
  if (m === 'timer') ui.view = 'timer';                          // click on the countdown opens the timer page
  setOpen(true);
});
function setPinned(v, quiet) {
  ui.pinned = v; shell.classList.toggle('pinned', v);
  const b = $('#pinBtn'); b.title = v ? 'Sabitlemeyi kaldır (Ctrl+Alt+N)' : 'Açık sabitle (Ctrl+Alt+N)'; b.setAttribute('aria-pressed', v);
  if (v) setOpen(true); else if (!ui.hovering && !quiet) setOpen(false);
  if (!quiet) toast(v ? 'Açık sabitlendi' : 'Sabitleme kaldırıldı');
}
$('#pinBtn').innerHTML = ic('pin', 13);
$('#pinBtn').onclick = e => { e.stopPropagation(); setPinned(!ui.pinned); };
api.on('toggle-pin', () => setPinned(!ui.pinned));
function typing() { const a = document.activeElement; return a && /INPUT|TEXTAREA/.test(a.tagName); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (ui.view !== 'grid') go('grid'); else { setPinned(false, true); setOpen(false); } } });

// Window is click-through except over the shell.
var ign = true;
document.addEventListener('mousemove', e => { const want = !e.target.closest('#shell'); if (want !== ign) { ign = want; api.send('ignore', want); } });
document.addEventListener('mouseleave', () => { if (!ign) { ign = true; api.send('ignore', true); } });

// Files dragged onto the notch open the File shelf.
const isFileDrag = e => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
document.addEventListener('dragenter', e => {
  if (!isFileDrag(e) || ui.edit) return;
  if (!ui.open) setOpen(true);
  if (!['shelf', 'launch', 'phone'].includes(ui.view)) go('shelf');
});
document.addEventListener('dragover', e => { if (isFileDrag(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
document.addEventListener('drop', e => {
  if (!isFileDrag(e) || e.target.closest('#dz, .ql, .pmain')) return;
  e.preventDefault(); if (ui.view === 'shelf') addShelfFiles(e.dataTransfer.files);
});
function addShelfFiles(files) {
  let n = 0;
  for (const f of files) { const p = api.pathOf(f); if (p && !S.shelf.find(x => x.path === p)) { S.shelf.push({ name: f.name, path: p }); n++; } }
  save('shelf'); if (ui.view === 'shelf') go('shelf');
  if (n) toast(n === 1 ? 'Rafa eklendi' : n + ' dosya rafa eklendi');
}

/* ---------- view router ---------- */
let viewTimers = [];
function stopViewTimers() { viewTimers.forEach(clearInterval); viewTimers = []; cancelAnimationFrame(lyrRaf); lyrRaf = 0; }
function every(fn, ms) { const t = setInterval(fn, ms); viewTimers.push(t); return t; }
const TITLES = { media: 'Medya', clipboard: 'Pano', notes: 'Notlar', calendar: 'Takvim', monitor: 'Sistem izleyici', start: 'Başlat', calc: 'Hesap makinesi', text: 'Metin araçları', shelf: 'Dosya rafı', settings: 'Ayarlar', launch: 'Hızlı başlat', color: 'Renk seçici', qr: 'QR kod', timer: 'Zamanlayıcı', ocr: 'Metin yakala', calsrc: 'Bağlı takvimler', translate: 'Çeviri', fx: 'Döviz çevirici', phone: 'Telefon bağlantısı', notifs: 'Bildirimler' };
const VIEWS = { grid: vGrid, media: vMedia, clipboard: vClip, notes: vNotes, calendar: vCal, monitor: vMon, start: vStart, calc: vCalc, text: vText, shelf: vShelf, settings: vSettings, launch: vLaunch, color: vColor, qr: vQr, timer: vTimer, ocr: vOcr, calsrc: vCalSrc, translate: vTranslate, fx: vFx, phone: vPhone, notifs: vNotifs };

function go(name, first) {
  const run = () => {
    stopViewTimers();
    ui.view = name; view.className = ''; view.innerHTML = '';
    bar.classList.toggle('show', name !== 'grid');
    $('#title').textContent = TITLES[name] || '';
    $('#barActions').innerHTML = '';
    $('#back').innerHTML = ic('back', 16);
    $('#back').className = 'icon';
    $('#back').onclick = () => go({ calsrc: 'calendar' }[name] || 'grid');
    VIEWS[name](view);
    view.classList.add('enter');
    $$('#view > *').forEach((el, i) => el.style.setProperty('--i', i));
    $$('.page > .tile', view).forEach((el, i) => el.style.setProperty('--i', i));
    const [w, h] = SIZES[name]; sizeShell(w, h); paintGlow();
  };
  if (first) run();
  else { view.style.transition = 'opacity .1s'; view.style.opacity = 0; setTimeout(() => { run(); view.style.opacity = 1; }, 100); }
}
$('#back').onclick = () => go('grid');

/* ---------- tiles ---------- */
const DEFAULT_ORDER = ['timer', 'media', 'clipboard', 'text', 'launch', 'shot', 'shelf', 'coffee', 'notes', 'pick', 'calc', 'monitor', 'settings', 'calendar', 'start', 'qr', 'ocr', 'translate', 'fx', 'phonelink', 'notifs'];
const TILES = {
  timer: { s: 'big', name: 'Zamanlayıcı', icon: 'timer', draw: tTimer },
  media: { s: 'big', name: 'Medya', icon: 'music', draw: tMedia },
  clipboard: { s: 'big', name: 'Pano', icon: 'clip', draw: tClip },
  coffee: { s: 'wide', name: 'Kahve', icon: 'cup', draw: tCoffee },
  notes: { s: 'wide', name: 'Notlar', icon: 'note', draw: tNotes, act: () => go('notes') },
  calendar: { s: 'wide', name: 'Takvim', icon: 'cal', draw: el => tWide(el, 'cal', 'Takvim', calTileSub(), 'calendar') },
  start: { s: 'wide', name: 'Başlat', icon: 'grid', draw: el => tWide(el, 'grid', 'Başlat', 'Uygulamalar ve arama', 'start'), act: () => go('start') },
  text: { s: 'small', name: 'Metin araçları', icon: 'text', act: () => go('text') },
  launch: { s: 'small', name: 'Hızlı başlat', icon: 'rocket', act: () => go('launch') },
  shot: { s: 'small', name: 'Ekran görüntüsü', icon: 'shot', act: doShot },
  shelf: { s: 'small', name: 'Dosya rafı', icon: 'shelf', act: () => go('shelf') },
  pick: { s: 'small', name: 'Renk seçici', icon: 'pick', act: () => go('color') },
  calc: { s: 'small', name: 'Hesap makinesi', icon: 'calc', act: () => go('calc') },
  monitor: { s: 'small', name: 'Sistem izleyici', icon: 'pulse', act: () => go('monitor'), live: tMonitor },
  settings: { s: 'small', name: 'Ayarlar', icon: 'gear', act: () => go('settings') },
  qr: { s: 'small', name: 'QR kod', icon: 'qr', act: () => go('qr') },
  ocr: { s: 'small', name: 'Metin yakala', icon: 'scanText', act: doOcr },
  translate: { s: 'small', name: 'Çeviri', icon: 'languages', act: () => go('translate') },
  fx: { s: 'small', name: 'Döviz', icon: 'coins', act: () => go('fx') },
  phonelink: { s: 'small', name: 'Telefon', icon: 'phone', act: () => go('phone') },
  notifs: { s: 'small', name: 'Bildirimler', icon: 'bell', act: () => go('notifs'), live: tNotifs },
};
const COLS = 8, ROWS = 3, SPAN = { big: [2, 2], wide: [2, 1], small: [1, 1] };
// Sizes each tile can take; the first one is its default.
const ALLOWED = { timer: ['big', 'wide'], media: ['big', 'wide'], clipboard: ['big', 'wide'], coffee: ['wide', 'small'], notes: ['wide', 'small'], calendar: ['wide', 'small'], start: ['wide', 'small'] };
const allowed = id => ALLOWED[id] || ['small', 'wide'];
const tsize = id => { const v = (S.settings.sizes || {})[id]; return allowed(id).includes(v) ? v : allowed(id)[0]; };
function resizeTile(id) {
  const st = S.settings, a = allowed(id), cur = tsize(id), next = a[(a.indexOf(cur) + 1) % a.length];
  st.sizes = { ...(st.sizes || {}), [id]: next };
  const page = st.pages.find(p => p.includes(id));
  if (page && !fits(page)) { st.sizes[id] = cur; toast('Bu sayfada daha büyük kutuya yer yok'); return false; }
  save('settings'); return true;
}
function order() { const o = (S.settings.order || DEFAULT_ORDER).map(id => id === 'phone' ? 'launch' : id).filter((id, i, a) => TILES[id] && a.indexOf(id) === i); DEFAULT_ORDER.forEach(id => { if (!o.includes(id)) o.push(id); }); return o; }
// Packs tiles the way CSS grid "row dense" does and says whether they fit in 8×3 cells.
function rowsUsed(ids) {
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill(0)); let used = 0;
  for (const id of ids) {
    const [w, h] = SPAN[tsize(id)]; let ok = false;
    for (let r = 0; r + h <= ROWS && !ok; r++) for (let c = 0; c + w <= COLS && !ok; c++) {
      let free = true; for (let y = r; y < r + h && free; y++) for (let x = c; x < c + w; x++) if (g[y][x]) { free = false; break; }
      if (free) { for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) g[y][x] = 1; used = Math.max(used, r + h); ok = true; }
    }
  }
  return used;
}
function fits(ids) {
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  for (const id of ids) {
    const [w, h] = SPAN[tsize(id)]; let ok = false;
    for (let r = 0; r + h <= ROWS && !ok; r++) for (let c = 0; c + w <= COLS && !ok; c++) {
      let free = true; for (let y = r; y < r + h && free; y++) for (let x = c; x < c + w; x++) if (g[y][x]) { free = false; break; }
      if (free) { for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) g[y][x] = 1; ok = true; }
    }
    if (!ok) return false;
  }
  return true;
}
// Pages are stored explicitly: S.settings.pages = [[ids], [ids]], removed tiles in S.settings.hidden.
function layout() {
  const st = S.settings;
  if (!Array.isArray(st.pages)) {
    st.pages = []; let cur = [];
    for (const id of order()) { if (!fits([...cur, id])) { st.pages.push(cur); cur = []; } cur.push(id); }
    st.pages.push(cur); st.hidden = [];
  }
  st.hidden = [...new Set((st.hidden || []).filter(id => TILES[id]))];
  const seen = new Set();
  st.pages = st.pages.map(p => p.map(id => id === 'phone' ? 'launch' : id).filter(id => TILES[id] && !st.hidden.includes(id) && !seen.has(id) && seen.add(id)));
  for (const id of Object.keys(TILES)) {
    if (seen.has(id) || st.hidden.includes(id)) continue;
    const p = st.pages.find(p => fits([...p, id])); if (p) p.push(id); else st.pages.push([id]);
  }
  // Anything that no longer fits (e.g. after a size change) spills onto the next page.
  for (let i = 0; i < st.pages.length; i++) { while (st.pages[i].length > 1 && !fits(st.pages[i])) { const id = st.pages[i].pop(); if (!st.pages[i + 1]) st.pages.push([]); st.pages[i + 1].unshift(id); } }
  if (!ui.edit) st.pages = st.pages.filter((p, i) => p.length || i === 0);
  if (!st.pages.length) st.pages = [[]];
  return st.pages;
}
function moveTile(id, to, before) {
  const st = S.settings;
  const pages = st.pages.map(p => p.filter(x => x !== id));
  while (pages.length <= to) pages.push([]);
  const tgt = pages[to], i = before ? tgt.indexOf(before) : -1;
  if (i >= 0) tgt.splice(i, 0, id); else tgt.push(id);
  if (!fits(tgt)) { toast('O sayfada yer yok'); return false; }
  st.pages = pages; st.hidden = st.hidden.filter(x => x !== id); save('settings'); return true;
}
function hideTile(id) { const st = S.settings; st.pages = st.pages.map(p => p.filter(x => x !== id)); st.hidden = [...st.hidden.filter(x => x !== id), id]; save('settings'); }
function calTileSub() {
  const now = Date.now(), end = new Date(); end.setHours(23, 59, 59, 999);
  const next = CAL.events.find(e => !e.allDay && e.start > now && e.start <= end.getTime());
  return next ? 'Sonraki: ' + hm(next.start) + ' ' + next.title : todayLabel();
}
const todayLabel = () => new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'short' });
function drawTile(el, id, sz) {
  const T = TILES[id];
  if (T.live) return T.live(el, sz);
  if (T.draw && sz !== 'small' && !(sz === 'wide' && T.s === 'small')) return T.draw(el, sz);
  if (sz === 'small') {
    el.title = T.name; el.innerHTML = ic(T.icon, 20);
    if (id === 'coffee') { el.classList.toggle('on', !!S.settings.awake); el.title = 'Kahve: ' + (S.settings.awake ? 'uyanık tutuyor' : 'kapalı'); el.onclick = () => { toggleAwake(); el.classList.toggle('on', !!S.settings.awake); }; }
    else if (id === 'calendar') { const d = new Date(); el.classList.add('t-day'); el.innerHTML = `<small>${d.toLocaleDateString('tr-TR', { weekday: 'short' })}</small><b>${d.getDate()}</b>`; el.onclick = () => go('calendar'); }
    else el.onclick = T.act || (() => go(id));
    return;
  }
  // a small tool shown wide: icon + name
  el.classList.add('t-row'); el.innerHTML = `${ic(T.icon, 20)}<div class="col"><b>${T.name}</b></div>`; el.onclick = T.act;
}
// Live CPU (outer ring) and memory (inner ring) gauge.
const gauge = { cpu: 0, mem: 0 };
const ring = (r, v, cls) => { const c = 2 * Math.PI * r; return `<circle class="gbg" cx="22" cy="22" r="${r}"/><circle class="gfg ${cls}" cx="22" cy="22" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - v / 100)).toFixed(1)}" data-c="${c}"/>`; };
function tMonitor(el, sz) {
  el.classList.add('t-mon'); el.onclick = () => go('monitor'); el.title = 'İşlemci ve bellek — ayrıntılar için tıkla';
  const g = `<div class="gauge"><svg viewBox="0 0 44 44">${ring(19, gauge.cpu, 'cpu')}${ring(14, gauge.mem, 'mem')}</svg><b class="gtxt">%${Math.round(gauge.cpu)}</b></div>`;
  el.innerHTML = sz === 'wide' ? `${g}<div class="gleg"><div><i class="dot cpu"></i>İşlemci <b class="gcpu">%${Math.round(gauge.cpu)}</b></div><div><i class="dot mem"></i>Bellek <b class="gmem">%${Math.round(gauge.mem)}</b></div></div>` : g;
}
function paintGauges() {
  $$('.t-mon').forEach(el => {
    $$('.gfg', el).forEach(c => { const v = c.classList.contains('cpu') ? gauge.cpu : gauge.mem; c.style.strokeDashoffset = (c.dataset.c * (1 - v / 100)).toFixed(1); });
    $('.gtxt', el).textContent = '%' + Math.round(gauge.cpu);
    const a = $('.gcpu', el), b = $('.gmem', el); if (a) a.textContent = '%' + Math.round(gauge.cpu); if (b) b.textContent = '%' + Math.round(gauge.mem);
  });
}
async function pollGauges() { if (!$('.t-mon')) return; const s = await api.invoke('sys:stats', { net: false }); gauge.cpu = s.cpu; gauge.mem = s.mem.used / s.mem.total * 100; paintGauges(); }
function tWide(el, i, t, sub, to) { el.classList.add('t-row'); el.innerHTML = `${ic(i, 20)}<div class="col"><b>${t}</b><small>${esc(sub)}</small></div>`; el.onclick = () => go(to); }

function vGrid(root) {
  const st = S.settings, pages = layout().map(p => p.slice());
  if (ui.edit && pages[pages.length - 1].length) pages.push([]);   // a spare page to drop tiles on
  ui.page = clamp(ui.page, 0, pages.length - 1);
  // Shrink the panel when tiles were removed: 72px per unused row (64px tile + 8px gap).
  const rows = ui.edit ? ROWS : Math.max(1, ...pages.map(rowsUsed));
  SIZES.grid = [700, ui.edit ? 312 : 262 - (ROWS - rows) * 72];
  root.innerHTML = `<div class="pager"><div class="pages"></div></div>
    ${ui.edit ? `<div class="tray"><span class="lb">Kaldırılanlar</span><div class="hchips">${st.hidden.map(id => `<button class="hchip" draggable="true" data-id="${id}" title="Bu sayfaya ekle">${ic(TILES[id].icon, 14)}<span>${TILES[id].name}</span>${ic('plus', 12)}</button>`).join('') || '<span class="empty">Kaldırmak için kutudaki − işaretine dokun. Burada görünür.</span>'}</div></div>` : ''}
    <div class="foot"><button class="${ui.edit ? 'btn done' : 'icon'}" id="edit" title="${ui.edit ? 'Düzenlemeyi bitir' : 'Kutuları düzenle'}">${ui.edit ? 'Bitti' : ic('pencil', 13)}</button><div class="dots ${ui.edit ? 'edit' : ''}"></div></div>`;
  const pg = $('.pages', root); pg.style.transform = `translateX(-${ui.page * 100}%)`;
  let dragId = null;
  const onDrop = (e, page, before) => { e.preventDefault(); e.stopPropagation(); $$('.drop', root).forEach(x => x.classList.remove('drop')); const id = e.dataTransfer.getData('text/plain'); if (!id || id === before) return; if (moveTile(id, page, before)) go('grid'); };
  pages.forEach((ids, pi) => {
    const p = document.createElement('div'); p.className = 'page' + (ui.edit ? ' edit' : '');
    ids.forEach(id => {
      const T = TILES[id], el = document.createElement('div'), sz = tsize(id);
      el.className = 'tile s-' + sz; el.dataset.id = id;
      drawTile(el, id, sz);
      if (ui.edit) {
        el.draggable = true; el.onclick = null;
        const rm = document.createElement('button'); rm.className = 'rm'; rm.title = T.name + ' kaldır'; rm.innerHTML = ic('minus', 11);
        rm.onclick = e => { e.stopPropagation(); hideTile(id); go('grid'); }; el.appendChild(rm);
        if (allowed(id).length > 1) { const rs = document.createElement('button'); rs.className = 'rs'; rs.title = 'Boyutu değiştir'; rs.innerHTML = ic('resize', 11); rs.onclick = e => { e.stopPropagation(); if (resizeTile(id)) go('grid'); }; el.appendChild(rs); }
        el.ondragstart = e => { dragId = id; e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => el.classList.add('lifted'), 0); };
        el.ondragend = () => { dragId = null; el.classList.remove('lifted'); };
        el.ondragover = e => { e.preventDefault(); el.classList.add('drop'); };
        el.ondragleave = () => el.classList.remove('drop');
        el.ondrop = e => onDrop(e, pi, id);
      }
      p.appendChild(el);
    });
    if (ui.edit) {
      if (!ids.length) p.innerHTML = '<div class="emptypage">Kutuları buraya sürükle</div>';
      p.ondragover = e => { e.preventDefault(); p.classList.add('over'); }; p.ondragleave = e => { if (!p.contains(e.relatedTarget)) p.classList.remove('over'); };
      p.ondrop = e => { p.classList.remove('over'); onDrop(e, pi); };
    }
    pg.appendChild(p);
  });
  const pageEls = [...pg.children];
  const setPage = n => {
    ui.page = clamp(n, 0, pages.length - 1);
    pg.style.transition = ''; pg.style.transform = `translateX(-${ui.page * 100}%)`;
    pageEls.forEach((el, i) => el.classList.toggle('cur', i === ui.page));
    $$('.dots i', root).forEach((d, i) => d.classList.toggle('on', i === ui.page));
  };
  pageEls.forEach((el, i) => el.classList.toggle('cur', i === ui.page));
  // Drag sideways with the mouse to change page (not while editing: there tiles are dragged).
  const pager = $('.pager', root); let drag = null, swallowClick = false;
  pager.addEventListener('pointerdown', e => { if (ui.edit || e.button !== 0 || pages.length < 2) return; drag = { x: e.clientX, t: performance.now(), dx: 0, on: false }; });
  pager.addEventListener('pointermove', e => {
    if (!drag) return; const dx = e.clientX - drag.x;
    if (!drag.on && Math.abs(dx) > 8) { drag.on = true; pager.setPointerCapture(e.pointerId); pg.style.transition = 'none'; }
    if (!drag.on) return;
    const edge = (ui.page === 0 && dx > 0) || (ui.page === pages.length - 1 && dx < 0);
    drag.dx = edge ? dx * .3 : dx;
    pg.style.transform = `translateX(calc(-${ui.page * 100}% + ${drag.dx}px))`;
  });
  const endDrag = () => {
    if (!drag) return; const d = drag; drag = null; if (!d.on) return;
    swallowClick = true; setTimeout(() => swallowClick = false, 0);
    const v = d.dx / Math.max(1, performance.now() - d.t), w = pager.clientWidth;
    setPage(ui.page + (d.dx < -w * .18 || v < -.5 ? 1 : d.dx > w * .18 || v > .5 ? -1 : 0));
  };
  pager.addEventListener('pointerup', endDrag); pager.addEventListener('pointercancel', endDrag);
  pager.addEventListener('click', e => { if (swallowClick) { e.stopPropagation(); e.preventDefault(); } }, true);
  $('.dots', root).innerHTML = pages.map((p, i) => `<i class="${i === ui.page ? 'on' : ''} ${ui.edit && !p.length ? 'new' : ''}" title="${ui.edit ? (p.length ? 'Sayfa ' + (i + 1) + ' — kutuyu buraya bırak' : 'Yeni sayfa') : 'Sayfa ' + (i + 1)}"></i>`).join('');
  $$('.dots i', root).forEach((d, i) => {
    d.onclick = () => setPage(i);
    if (!ui.edit) return;
    let t; d.ondragenter = () => { d.classList.add('drop'); t = setTimeout(() => setPage(i), 380); };
    d.ondragover = e => e.preventDefault(); d.ondragleave = () => { d.classList.remove('drop'); clearTimeout(t); };
    d.ondrop = e => { clearTimeout(t); onDrop(e, i); };
  });
  $$('.hchip', root).forEach(c => {
    c.onclick = () => { if (moveTile(c.dataset.id, ui.page)) go('grid'); };
    c.ondragstart = e => e.dataTransfer.setData('text/plain', c.dataset.id);
  });
  $('#edit').onclick = () => { ui.edit = !ui.edit; if (!ui.edit) { layout(); save('settings'); } go('grid'); };
  // Mouse wheel flips one page per notch; trackpads accumulate horizontal scroll first.
  let wt = 0, acc = 0; root.addEventListener('wheel', e => { if (Date.now() - wt < 450) return; const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; acc += d; if (Math.abs(acc) < 40) return; wt = Date.now(); setPage(ui.page + (acc > 0 ? 1 : -1)); acc = 0; }, { passive: true });
  every(tileTick, 250); tileTick();
  every(pollGauges, 1500); pollGauges();
}
function tileTick() { timerTick(); mediaTileTick(); }

/* ---------- timer + stopwatch ---------- */
const T = { dur: 1500, left: 1500, running: false, end: 0, done: false, label: '', sound: true, notify: true, repeat: false };
const SW = { running: false, start: 0, acc: 0, laps: [] };
const swTime = () => SW.acc + (SW.running ? Date.now() - SW.start : 0);
const pad2 = n => String(n).padStart(2, '0');
const fmtSW = ms => { const t = Math.floor(ms / 10); return `${pad2(Math.floor(t / 6000))}:${pad2(Math.floor(t / 100) % 60)},${pad2(t % 100)}`; };
const fmtT = s => { s = Math.max(0, Math.ceil(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + pad2(m) : m) + ':' + pad2(x); };
function saveTimer() { S.settings.timer = { dur: T.dur, label: T.label, sound: T.sound, notify: T.notify, repeat: T.repeat }; save('settings'); }
// A soft three-note chime made with Web Audio (no sound files needed).
function chime() {
  try {
    const ac = new AudioContext();
    [0, .26, .52].forEach((t, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), at = ac.currentTime + t;
      o.type = 'sine'; o.frequency.value = [880, 1175, 1568][i];
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.22, at + .02); g.gain.exponentialRampToValueAtTime(.001, at + .55);
      o.connect(g).connect(ac.destination); o.start(at); o.stop(at + .6);
    });
    setTimeout(() => ac.close(), 1600);
  } catch {}
}
function timerStart() { if (T.left <= 0) T.left = T.dur; T.end = Date.now() + T.left * 1000; T.running = true; T.done = false; }
function timerPause() { T.left = Math.max(0, (T.end - Date.now()) / 1000); T.running = false; }
function timerReset() { T.running = false; T.done = false; T.left = T.dur; }
function timerSet(sec) { T.dur = clamp(Math.round(sec), 5, 24 * 3600); if (!T.running) T.left = T.dur; T.done = false; saveTimer(); }
function timerFinish() {
  const name = T.label || 'Zamanlayıcı';
  if (T.sound) chime();
  if (T.notify) { try { new Notification(name, { body: fmtT(T.dur) + ' doldu.', silent: true }); } catch {} }
  if (T.repeat) { T.end = Date.now() + T.dur * 1000; T.left = T.dur; toast(name + ': süre doldu, yeniden başladı'); return; }
  T.running = false; T.done = true; T.left = 0; toast(name + ': süre doldu');
  setTimeout(() => { if (!T.done) return; T.done = false; T.left = T.dur; timerTick(); }, 6000);
}
function timerTick() {
  if (T.running) { T.left = Math.max(0, (T.end - Date.now()) / 1000); if (T.left <= 0) timerFinish(); }
  const tile = $('.t-timer');
  if (tile) {
    $('.txt', tile).textContent = fmtT(T.left);
    const fg = $('.fg', tile); if (fg) fg.style.strokeDashoffset = 182.2 * (1 - (T.dur ? T.left / T.dur : 0));
    const bar = $('.tbar i', tile); if (bar) bar.style.width = (T.dur ? T.left / T.dur * 100 : 0) + '%';
    tile.classList.toggle('done', T.done);
    const pb = $('.play', tile), w = T.running ? 'pause' : 'play'; if (pb && pb.dataset.s !== w) { pb.dataset.s = w; pb.innerHTML = ic(w, 16); }
  }
  if (!ui.open) { refreshClosed(); if (shell.classList.contains('mode-timer')) paintTimerPill(); }
}
setInterval(timerTick, 250);
function paintTimerPill() {
  const sw = SW.running && !T.running && !T.done, c = 2 * Math.PI * 7;
  $('#tpTime').textContent = sw ? fmtSW(swTime()).slice(0, 5) : T.done ? 'Bitti' : fmtT(T.left);
  $('#tpLabel').textContent = sw ? 'Kronometre' : T.label;
  $('#tpRing').style.strokeDashoffset = sw ? 0 : c * (1 - (T.dur ? T.left / T.dur : 0));
  shell.classList.toggle('tdone', T.done);
}
function tTimer(el, sz) {
  el.classList.add('t-timer'); el.title = 'Ayrıntılar için tıkla';
  el.innerHTML = sz === 'wide' ? `<div class="trow"><div class="tleft"><div class="th">${ic('timer', 14)}<span class="txt"></span></div><div class="tbar"><i></i></div></div>
    <div class="tctl"><button data-a="-" title="−5 dk">${ic('minus', 14)}</button><button class="play" data-a="p" title="Başlat / duraklat"></button><button data-a="+" title="+5 dk">${ic('plus', 14)}</button></div></div>` : `<div class="th">${ic('timer', 16)}Zamanlayıcı</div><div class="ring"><svg viewBox="0 0 62 62"><circle class="bg" cx="31" cy="31" r="29"/><circle class="fg" cx="31" cy="31" r="29" stroke-dasharray="182.2" stroke-dashoffset="0"/></svg><div class="txt"></div></div>
  <div class="tctl"><button data-a="-" title="−5 dk">${ic('minus', 15)}</button><button class="play" data-a="p" title="Başlat / duraklat"></button><button data-a="+" title="+5 dk">${ic('plus', 15)}</button></div>`;
  el.onclick = e => {
    const a = e.target.closest('button')?.dataset.a; if (!a) return go('timer'); e.stopPropagation();
    if (a === 'p') { if (T.running) timerPause(); else timerStart(); }
    else { const d = a === '+' ? 300 : -300; if (T.running) { T.end += d * 1000; T.left = clamp(T.left + d, 1, 86400); T.dur = clamp(T.dur + d, 60, 86400); } else timerSet(T.dur + d); }
    timerTick();
  };
}
let tMode = 'timer';
function vTimer(root) {
  SIZES.timer = [680, 66 + 300];
  $('#barActions').innerHTML = `<div class="seg" id="tmode"><button data-m="timer" class="${tMode === 'timer' ? 'on' : ''}">Zamanlayıcı</button><button data-m="sw" class="${tMode === 'sw' ? 'on' : ''}">Kronometre</button></div>`;
  $$('#tmode button').forEach(b => b.onclick = () => { if (tMode !== b.dataset.m) { tMode = b.dataset.m; go('timer'); } });
  if (tMode === 'sw') return vStopwatch(root);
  const P = [1, 3, 5, 10, 15, 25, 45, 60];
  root.innerHTML = `<div class="tv">
    <div class="tvl"><div class="bigring"><svg viewBox="0 0 200 200"><circle class="bg" cx="100" cy="100" r="90"/><circle class="fg" cx="100" cy="100" r="90" stroke-dasharray="565.5"/></svg>
      <div class="bt"><input class="btime" id="btime" spellcheck="false" title="Süreyi yazmak için tıkla (ör. 25, 1:30 veya 1:00:00)"><small id="blabel"></small></div></div>
      <div class="tvc"><button class="icon" data-a="-1" title="−1 dk">${ic('minus', 18)}</button><button class="round big" data-a="p" title="Başlat / duraklat"></button><button class="icon" data-a="+1" title="+1 dk">${ic('plus', 18)}</button><button class="icon" data-a="r" title="Sıfırla">${ic('undo', 16)}</button></div></div>
    <div class="tvr"><div class="lb">Hazır süreler</div><div class="tpre">${P.map(m => `<button data-m="${m}">${m} dk</button>`).join('')}</div>
      <div class="lb">Etiket</div><input class="field" id="tlabel" placeholder="Ör. Çay demlensin" maxlength="28">
      <div class="lb">Seçenekler</div>
      <div class="sline"><span>Bitince ses çal</span><div class="sw" data-o="sound" role="switch"></div></div>
      <div class="sline"><span>Bildirim göster</span><div class="sw" data-o="notify" role="switch"></div></div>
      <div class="sline"><span>Bitince yeniden başlat</span><div class="sw" data-o="repeat" role="switch"></div></div></div></div>`;
  const bt = $('#btime', root), fg = $('.bigring .fg', root), pb = $('[data-a="p"]', root);
  const paint = () => {
    if (document.activeElement !== bt) bt.value = fmtT(T.left || (T.done ? 0 : T.dur));
    fg.style.strokeDashoffset = 565.5 * (1 - (T.dur ? T.left / T.dur : 0));
    const w = T.running ? 'pause' : 'play'; if (pb.dataset.s !== w) { pb.dataset.s = w; pb.innerHTML = ic(w, 22); }
    $('#blabel', root).textContent = T.done ? 'süre doldu' : T.label || (T.running ? 'çalışıyor' : 'hazır');
    $$('.tpre button', root).forEach(b => b.classList.toggle('on', +b.dataset.m * 60 === T.dur));
    $('.bigring', root).classList.toggle('done', T.done);
  };
  // "25" = 25 minutes, "1:30" = 1 min 30 s, "1:00:00" = one hour.
  const parse = v => { v = v.trim().replace(',', '.'); if (/^\d+(\.\d+)?$/.test(v)) return parseFloat(v) * 60; const p = v.split(':').map(Number); if (!v || p.some(isNaN)) return null; return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : null; };
  bt.onfocus = () => { api.send('focus', true); setTimeout(() => bt.select(), 0); };
  bt.onkeydown = e => { if (e.key === 'Enter') bt.blur(); else if (e.key === 'Escape') { bt.value = fmtT(T.left); bt.blur(); } };
  bt.onchange = () => { const s = parse(bt.value); if (s && s > 0) { timerReset(); timerSet(s); } else toast('Süre anlaşılamadı'); paint(); };
  $$('.tvc button', root).forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === 'p') { if (T.running) timerPause(); else timerStart(); }
    else if (a === 'r') timerReset();
    else { const d = +a * 60; if (T.running) { T.end += d * 1000; T.left = Math.max(1, T.left + d); T.dur = Math.max(5, T.dur + d); } else timerSet(T.dur + d); }
    timerTick(); paint();
  });
  $$('.tpre button', root).forEach(b => b.onclick = () => { timerReset(); timerSet(+b.dataset.m * 60); paint(); });
  const tl = $('#tlabel', root); tl.value = T.label; tl.onfocus = () => api.send('focus', true); tl.oninput = () => { T.label = tl.value.trim(); saveTimer(); paint(); };
  $$('[data-o]', root).forEach(s => { s.classList.toggle('on', !!T[s.dataset.o]); s.onclick = () => { const k = s.dataset.o; T[k] = !T[k]; s.classList.toggle('on', T[k]); saveTimer(); if (k === 'sound' && T[k]) chime(); }; });
  paint(); every(paint, 200);
}
function vStopwatch(root) {
  root.innerHTML = `<div class="tv"><div class="tvl"><div class="swtime" id="swt">00:00,00</div>
    <div class="tvc"><button class="icon" id="swr" title="Sıfırla">${ic('undo', 16)}</button><button class="round big" id="swgo" title="Başlat / durdur"></button><button class="btn" id="swlap">${ic('flag', 15)}Tur</button></div></div>
    <div class="tvr"><div class="lb">Turlar</div><div class="laps" id="laps"></div></div></div>`;
  const t = $('#swt', root), goBtn = $('#swgo', root), laps = $('#laps', root);
  const paintLaps = () => {
    laps.innerHTML = SW.laps.length ? SW.laps.map((l, i) => `<div class="lap"><span>Tur ${SW.laps.length - i}</span><span class="d">+${fmtSW(l - (SW.laps[i + 1] || 0))}</span><b>${fmtSW(l)}</b></div>`).join('') : '<div class="empty">Ara süre kaydetmek için “Tur”a bas</div>';
  };
  const paint = () => { t.textContent = fmtSW(swTime()); const w = SW.running ? 'pause' : 'play'; if (goBtn.dataset.s !== w) { goBtn.dataset.s = w; goBtn.innerHTML = ic(w, 22); } $('#swlap', root).disabled = !SW.running; };
  goBtn.onclick = () => { if (SW.running) { SW.acc += Date.now() - SW.start; SW.running = false; } else { SW.start = Date.now(); SW.running = true; } paint(); };
  $('#swlap', root).onclick = () => { if (SW.running) { SW.laps.unshift(swTime()); paintLaps(); } };
  $('#swr', root).onclick = () => { SW.running = false; SW.acc = 0; SW.laps = []; paint(); paintLaps(); };
  paint(); paintLaps(); every(paint, 50);
}

/* ---------- media (Windows media session) ---------- */
const V = { vol: -1, muted: false, hold: 0, br: -1, seen: null };
const M = { has: false, title: '', artist: '', dur: 0, pos: 0, playing: false, at: 0, img: null, key: '', lyr: [], rgb: [90, 90, 96] };
const mpos = () => M.has ? clamp(M.pos + (M.playing ? (performance.now() - M.at) / 1000 : 0), 0, M.dur > 0 ? M.dur : 1e9) : 0;
const mcmd = (c, a) => api.send('media:cmd', c, a);
function mtoggle() {
  M.pos = mpos(); M.at = performance.now(); M.playing = !M.playing;
  M.lock = { until: performance.now() + 2500, playing: M.playing };
  mcmd(M.playing ? 'play' : 'pause'); onMediaChange(false);
}
function mskip(d) { M.lock = null; mcmd(d > 0 ? 'next' : 'prev'); }
function mseek(s) { M.pos = s; M.at = performance.now(); mcmd('seek', s.toFixed(2)); }
function hasMini() { return M.has && M.playing && !ui.open && S.settings.mini !== false; }
function lyricIdx(p) { if (M.lyrPlain) return -1; let k = -1; for (let i = 0; i < M.lyr.length; i++) if (M.lyr[i][0] <= p) k = i; return k; }
function drawArt(c) {
  const x = c.getContext('2d'), s = c.width; x.clearRect(0, 0, s, s);
  if (M.img) { const iw = M.img.naturalWidth, ih = M.img.naturalHeight, m = Math.min(iw, ih); x.drawImage(M.img, (iw - m) / 2, (ih - m) / 2, m, m, 0, 0, s, s); return; }
  x.fillStyle = 'rgba(128,128,136,.35)'; x.fillRect(0, 0, s, s);
  x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = s / 20; x.lineCap = 'round'; x.beginPath(); x.moveTo(s * .4, s * .68); x.lineTo(s * .4, s * .3); x.lineTo(s * .68, s * .25); x.lineTo(s * .68, s * .62); x.stroke();
  x.beginPath(); x.arc(s * .33, s * .68, s * .07, 0, 7); x.stroke(); x.beginPath(); x.arc(s * .61, s * .62, s * .07, 0, 7); x.stroke();
}
function palette(img) {
  const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 8, 8);
  const d = x.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4; M.rgb = [r / n | 0, g / n | 0, b / n | 0];
  // bright covers wash out the frosted background, so dim it more the brighter the cover is
  const L = (.2126 * M.rgb[0] + .7152 * M.rgb[1] + .0722 * M.rgb[2]) / 255;
  shell.style.setProperty('--glow-dim', String(Math.min(.7, Math.max(.12, (L - .2) * 1.2))));
}
const mGrad = () => { const [r, g, b] = M.rgb; return `linear-gradient(115deg, rgb(${r * .32 | 0},${g * .32 | 0},${b * .32 | 0}) 0%, rgba(${r},${g},${b},.75) 100%)`; };
function refreshArt() { drawArt($('#miniArt')); $$('canvas.cover').forEach(drawArt); const t = $('.t-media'); if (t) t.dataset.art = '?'; mediaTileTick(); paintGlow(); }
function onMediaChange(changed) {
  drawArt($('#miniArt')); shell.classList.toggle('paused', !M.playing); paintGlow();
  if (!ui.open) applyClosedSize();
  mediaTileTick();
  if (changed && ui.view === 'media') go('media');
}
async function fetchLyrics() {
  M.lyr = []; if (!S.settings.lyrics || !M.has) return;
  const k = M.key; const r = await api.invoke('lyrics:get', M.title, M.artist, M.dur);
  if (k !== M.key) return;
  M.lyr = Array.isArray(r) ? r : (r && r.lines) || []; M.lyrPlain = !!(r && !Array.isArray(r) && !r.synced && M.lyr.length);
  if (ui.view === 'media') go('media');
}
function loadThumb(b64, key) { const im = new Image(); im.onload = () => { if (M.key !== key) return; M.img = im; M.url = im.src; palette(im); refreshArt(); }; im.src = 'data:image/png;base64,' + b64; }
api.on('media', st => {
  if (typeof st.vol === 'number' && st.vol >= 0) {
    const prev = V.seen; V.seen = { vol: st.vol, muted: !!st.muted };
    // A change we did not make ourselves (keyboard keys, Windows mixer...) shows the indicator.
    if (prev && performance.now() > V.hold && (Math.abs(prev.vol - st.vol) > .004 || prev.muted !== !!st.muted)) showOsd('vol', st.vol, !!st.muted);
    if (performance.now() > V.hold) { V.vol = st.vol; V.muted = !!st.muted; }
  }
  if (typeof st.br === 'number' && st.br >= 0) { if (V.br >= 0 && st.br !== V.br) showOsd('br', st.br / 100, false); V.br = st.br; }
  if (st.none) { if (M.has) { M.has = false; M.img = null; M.url = null; M.key = ''; onMediaChange(true); } return; }
  const key = st.title + '|' + st.artist, changed = !M.has || key !== M.key;
  // Right after play/pause the session can still report the old state; keep what the user asked for.
  if (M.lock && performance.now() < M.lock.until && st.playing !== M.lock.playing && !changed) {
    Object.assign(M, { has: true, title: st.title, artist: st.artist, dur: st.dur }); return;
  }
  M.lock = null;
  Object.assign(M, { has: true, title: st.title, artist: st.artist, dur: st.dur, pos: st.pos, playing: st.playing, at: performance.now() });
  if (changed) { M.key = key; M.img = null; M.url = null; M.rgb = [90, 90, 96]; M.lyr = []; fetchLyrics(); }
  if (typeof st.thumb === 'string') {
    if (st.thumb) loadThumb(st.thumb, key);
  } else if (changed) {
    // First message we see for this track carries no cover (e.g. after a reload): ask main for the last one.
    api.invoke('media:thumb').then(th => { if (th && M.key === key) loadThumb(th, key); });
  }
  onMediaChange(changed);
});
let lastMini = '';
setInterval(() => {
  if (!M.has) { lastMini = ''; return; }
  const p = mpos(), k = lyricIdx(p); const txt = k >= 0 ? M.lyr[k][1] : M.title + (M.artist ? ' · ' + M.artist : '');
  const box = $('#miniText'), inner = $('#miniInner');
  if (txt !== lastMini) {
    lastMini = txt; box.classList.add('swap');
    setTimeout(() => { inner.style.transition = 'none'; inner.style.transform = ''; inner.textContent = txt; box.classList.remove('swap'); box.classList.remove('marquee'); void inner.offsetWidth; inner.style.transition = ''; }, 160);
  } else {
    // Long lines slide along with the singing so the word being sung stays visible.
    const over = inner.scrollWidth - box.clientWidth;
    if (over > 2 && k >= 0) {
      const s0 = M.lyr[k][0], e = M.lyr[k + 1] ? M.lyr[k + 1][0] : s0 + 6;
      const prog = clamp(((p - s0) / Math.max(.5, e - s0) - .1) / .75, 0, 1);
      inner.style.transform = `translateX(${-(over + 6) * prog}px)`;
    } else if (over > 2) { box.style.setProperty('--over', -(over + 6) + 'px'); box.classList.add('marquee'); }
  }
  box.classList.toggle('fade-l', !!inner.style.transform && inner.style.transform !== 'translateX(0px)');
  refreshClosed();
}, 250);

function tMedia(el, sz) {
  el.classList.add('t-media'); if (sz === 'wide') el.classList.add('w');
  el.innerHTML = `<div class="mbg"></div><div class="mm"><div class="row1"><canvas width="96" height="96"></canvas><div class="mt"><div class="ttl"></div><div class="art"></div></div>${sz === 'wide' ? '<button class="pp" data-a="pp" title="Oynat / duraklat"></button>' : ''}</div>
    ${sz === 'wide' ? '' : `<div class="meta"><span class="tm"></span><div class="bar"><i></i></div></div>
    <div class="mctl"><button data-a="prev" title="Önceki">${ic('prev', 14)}</button><button class="pp" data-a="pp" title="Oynat / duraklat"></button><button data-a="next" title="Sonraki">${ic('next', 14)}</button></div>`}</div>
    <div class="fill none"><div class="stack">${ic('music', sz === 'wide' ? 20 : 26)}<span>Çalan bir şey yok</span></div></div>`;
  el.onclick = e => { const a = e.target.closest('button')?.dataset.a; if (!a) return go('media'); e.stopPropagation(); if (a === 'pp') mtoggle(); else mskip(a === 'next' ? 1 : -1); };
  el.dataset.art = '';
}
function mediaTileTick() {
  const el = $('.t-media'); if (!el) return;
  el.classList.toggle('nomedia', !M.has); if (!M.has) return;
  const p = mpos();
  if (el.dataset.art !== (M.url || 'none')) { el.dataset.art = M.url || 'none'; drawArt($('canvas', el)); $('.mbg', el).style.backgroundImage = M.url ? `url("${M.url}")` : ''; el.classList.toggle('hasart', !!M.url); }
  $('.ttl', el).textContent = M.title; $('.art', el).textContent = M.artist;
  const tm = $('.tm', el); if (tm) tm.textContent = fmt(p) + (M.dur > 0 ? ' / ' + fmt(M.dur) : '');
  const bar = $('.bar i', el); if (bar) bar.style.width = (M.dur > 0 ? p / M.dur * 100 : 0) + '%';
  const pp = $('.pp', el), want = M.playing ? 'pause' : 'play';
  if (pp.dataset.s !== want) { pp.dataset.s = want; pp.innerHTML = ic(want, 14); }
}

let lyrRaf = 0;
// Blurred cover behind the whole panel ("frosted glass" tinted by the album art).
function paintGlow() {
  const g = $('#glow'); if (!g) return;
  if (M.url) g.style.backgroundImage = `url("${M.url}")`;
  shell.classList.toggle('glow', !!M.url && M.has && (ui.view === 'media' && ui.open || !ui.open && closedMode() === 'mini'));
}
function vMedia(root) {
  if (!M.has) {
    SIZES.media = [560, 66 + 132];
    root.innerHTML = `<div class="card center" style="height:132px"><div style="display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--dim)">${ic('music', 28)}<span>Çalan bir şey yok. Herhangi bir uygulamada müzik başlat.</span></div></div>`;
    return;
  }
  const lyrOn = !!S.settings.lyrics;
  SIZES.media = [lyrOn ? 760 : 300, 66 + 286];
  $('#barActions').innerHTML = `<button class="icon ${lyrOn ? 'on' : ''}" id="lyrBtn" title="${lyrOn ? 'Şarkı sözlerini kapat' : 'Şarkı sözlerini aç (lrclib.net’te aranır)'}">${ic('lyrics', 16)}</button>`;
  $('#lyrBtn').onclick = () => { S.settings.lyrics = !lyrOn; save('settings'); if (S.settings.lyrics) { toast('Sözler lrclib.net’te aranıyor'); fetchLyrics(); } else M.lyr = []; go('media'); };
  root.innerHTML = `<div class="mv3 ${M.playing ? 'playing' : ''}">
    <div class="mleft"><canvas class="cover" width="264" height="264"></canvas>
      <div class="name">${esc(M.title)}</div><div class="by">${esc(M.artist)}</div>
      <div class="prog"><div class="tr"><i></i></div><div class="tm"><span class="a"></span><span class="b"></span></div></div>
      <div class="mctl"><button data-a="prev" title="Önceki">${ic('prev', 16)}</button><button class="pp" data-a="pp" title="Oynat / duraklat"></button><button data-a="next" title="Sonraki">${ic('next', 16)}</button></div>
      <div class="vol"><button class="vm" title="Sesi kapat / aç"></button><input type="range" min="0" max="100" step="1" aria-label="Ses"><b class="vv"></b></div></div>
    ${!lyrOn ? '' : `<div class="lyr">${M.lyr.length ? `<div class="in">${M.lyr.map(l => `<div class="ln">${esc(l[1])}</div>`).join('')}</div>` : '<div class="msg"><span>Bu şarkının sözleri bulunamadı</span></div>'}</div>`}</div>`;
  if (M.lyrPlain && $('.lyr', root)) { $('.lyr', root).classList.add('plain'); }
  $('.mv3', root).classList.toggle('solo', !lyrOn);
  drawArt($('.cover', root)); paintGlow();
  // Volume of the default output device (Windows sessions don't expose a per-player volume).
  const vr = $('.vol input', root), vb = $('.vol .vv', root), vm = $('.vol .vm', root);
  const paintVol = () => {
    const v = V.vol < 0 ? 0 : Math.round(V.vol * 100); vr.value = v; vr.style.setProperty('--v', (V.muted ? 0 : v) + '%');
    vb.textContent = V.vol < 0 ? '–' : V.muted ? '0' : v;
    vm.innerHTML = ic(V.muted || v === 0 ? 'mute' : v < 50 ? 'volLow' : 'vol', 16); $('.vol', root).classList.toggle('muted', V.muted);
  };
  let vt = 0;
  vr.oninput = () => { V.vol = vr.value / 100; V.muted = false; V.hold = performance.now() + 1200; paintVol(); const now = performance.now(); if (now - vt > 50) { vt = now; mcmd('vol', V.vol.toFixed(3)); } };
  vr.onchange = () => { V.hold = performance.now() + 1200; mcmd('vol', (vr.value / 100).toFixed(3)); };
  vm.onclick = () => { V.muted = !V.muted; V.hold = performance.now() + 1200; mcmd('mute', V.muted ? '1' : '0'); paintVol(); };
  root.addEventListener('wheel', e => { if (!e.target.closest('.vol')) return; e.preventDefault(); V.vol = clamp(V.vol + (e.deltaY < 0 ? .02 : -.02), 0, 1); V.muted = false; V.hold = performance.now() + 1200; paintVol(); mcmd('vol', V.vol.toFixed(3)); }, { passive: false });
  paintVol(); let lastVol = '';
  $('.mctl', root).onclick = e => { const a = e.target.closest('button')?.dataset.a; if (a === 'pp') mtoggle(); else if (a) mskip(a === 'next' ? 1 : -1); };
  $('.tr', root).onclick = e => { if (M.dur <= 0) return; const r = e.currentTarget.getBoundingClientRect(); mseek(clamp((e.clientX - r.left) / r.width, 0, 1) * M.dur); };
  const lyr = $('.lyr', root), inner = $('.in', root), lines = $$('.ln', root); let cur = -2, lastPlay = null;
  const frame = () => {
    if (ui.view !== 'media' || !$('.mv3', root)) return;
    const vk = V.vol + '|' + V.muted; if (vk !== lastVol && document.activeElement !== vr) { lastVol = vk; paintVol(); }
    const p = mpos(), k = lyricIdx(p);
    if (lastPlay !== M.playing) { lastPlay = M.playing; $('.mv3', root).classList.toggle('playing', M.playing); $('.pp', root).innerHTML = ic(M.playing ? 'pause' : 'play', 18); }
    $('.prog i', root).style.width = (M.dur > 0 ? p / M.dur * 100 : 0) + '%'; $('.a', root).textContent = fmt(p); $('.b', root).textContent = M.dur > 0 ? '-' + fmt(M.dur - p) : '';
    if (inner && k !== cur) { cur = k; lines.forEach((l, i) => { l.classList.toggle('act', i === k); l.classList.toggle('past', i < k); if (i !== k) l.style.removeProperty('--p'); }); const l = lines[k]; inner.style.transform = `translateY(${lyr.clientHeight * .42 - (l ? l.offsetTop + l.offsetHeight / 2 : 0)}px)`; }
    if (inner && k >= 0) { const s = M.lyr[k][0], e = M.lyr[k + 1] ? M.lyr[k + 1][0] : s + 6; lines[k].style.setProperty('--p', clamp((p - s) / Math.max(.5, e - s), 0, 1) * 100 + '%'); }
    lyrRaf = requestAnimationFrame(frame);
  };
  lyrRaf = requestAnimationFrame(frame);
}

/* ---------- clipboard ---------- */
const ago = at => { const s = (Date.now() - at) / 1000; return s < 8 ? 'şimdi' : s < 60 ? Math.floor(s) + ' sn' : s < 3600 ? Math.floor(s / 60) + ' dk' : s < 86400 ? Math.floor(s / 3600) + ' sa' : Math.floor(s / 86400) + ' g'; };
const textClips = () => clips.filter(c => c.type !== 'image');
let clipQuery = '';
function tClip(el) {
  const n = el.classList.contains('s-wide') ? 1 : 3;
  el.innerHTML = `<div class="th">${ic('clip', 16)}Pano<span class="sp"></span>${ic('expand', 12)}</div>` +
    (clips.length ? `<div class="clipl">${clips.slice(0, n).map(c => c.type === 'image' ? `<div class="cimg">${ic('image', 13)}Görsel · ${c.w}×${c.h}</div>` : `<div>${c.pinned ? '<i class="pdot"></i>' : ''}${esc(c.text.replace(/\s+/g, ' '))}</div>`).join('')}</div>` : '<div class="fill">Bir şey kopyala</div>');
  el.onclick = () => go('clipboard');
}
function vClip(root) {
  $('#barActions').innerHTML = `<button class="icon" id="clr" title="Sabitlenmemişleri temizle">${ic('trash', 16)}</button>`;
  $('#clr').onclick = () => { api.send('clips:clear'); toast('Sabitlenmemiş öğeler temizlendi'); };
  root.innerHTML = `<div class="csearch">${ic('search', 15)}<input id="cq" placeholder="Panoda ara" spellcheck="false"></div><div class="clist"></div>`;
  const q = $('#cq', root); q.value = clipQuery; q.onfocus = () => api.send('focus', true); q.oninput = () => { clipQuery = q.value; drawClips(); };
  drawClips(root);
}
function drawClips(root = view) {
  if (ui.view !== 'clipboard') return;
  const box = $('.clist', root); if (!box) return;
  const qq = clipQuery.trim().toLocaleLowerCase('tr-TR');
  const match = c => !qq || (c.type === 'image' ? /^(g[öo]rsel|resim|image)/.test(qq) : c.text.toLocaleLowerCase('tr-TR').includes(qq));
  const list = clips.filter(match).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).slice(0, 24);
  const rows = Math.min(3, Math.max(1, Math.ceil(list.length / 4)));
  SIZES.clipboard = [700, 66 + 44 + rows * 92 + (rows - 1) * 8]; if (ui.open) sizeShell(...SIZES.clipboard);
  box.innerHTML = list.length ? `<div class="chips">${list.map(c => `<div class="chip ${c.pinned ? 'pinned' : ''} ${c.type === 'image' ? 'img' : ''}" data-id="${c.id}" role="button" tabindex="0">
      ${c.type === 'image' ? `<img src="${c.thumb}" alt="">` : `<span>${esc(c.text)}</span>`}
      <small>${c.type === 'image' ? `Görsel · ${c.w}×${c.h}` : c.text.length + ' karakter'} · ${ago(c.at)}</small>
      <button class="cp" title="${c.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}">${ic('pin', 12)}</button><button class="cx" title="Sil">${ic('x', 11)}</button></div>`).join('')}</div>`
    : `<div class="card center" style="height:92px"><span class="empty">${qq ? 'Eşleşen öğe yok' : 'Henüz bir şey kopyalanmadı'}</span></div>`;
  $$('.chip', box).forEach((el, i) => {
    el.style.setProperty('--i', i);
    const id = el.dataset.id;
    el.onclick = async e => {
      if (e.target.closest('.cp')) { e.stopPropagation(); api.send('clips:pin', id); return; }
      if (e.target.closest('.cx')) { e.stopPropagation(); api.send('clips:remove', id); return; }
      const ok = await api.invoke('clips:copy', id); el.classList.add('flash'); toast(ok ? 'Kopyalandı' : 'Kopyalanamadı');
    };
  });
}
api.on('clips', c => { clips = c; if (ui.view === 'clipboard') drawClips(); else if (ui.view === 'grid') { const t = $('[data-id=clipboard]'); if (t && !t.classList.contains('s-small')) { const keep = [...t.querySelectorAll('.rm,.rs')]; tClip(t); keep.forEach(k => t.appendChild(k)); } } });

/* ---------- coffee / notes ---------- */
function toggleAwake() { S.settings.awake = !S.settings.awake; save('settings'); api.send('awake', S.settings.awake); }
function tCoffee(el) {
  el.classList.add('t-row');
  const paint = () => { el.innerHTML = `${ic('cup', 22)}<div class="col"><b>Kahve</b><small>${S.settings.awake ? 'Uyanık tutuyor' : 'Kapalı'}</small></div><div class="sw ${S.settings.awake ? 'on' : ''}"></div>`; };
  paint();
  el.onclick = () => { toggleAwake(); $('.sw', el).classList.toggle('on', S.settings.awake); $('small', el).textContent = S.settings.awake ? 'Uyanık tutuyor' : 'Kapalı'; };
}
function tNotes(el) {
  el.classList.add('t-notes'); const first = (S.notes[0]?.text || '').split('\n').find(l => l.trim()) || '';
  el.innerHTML = `<div class="th">${ic('note', 16)}Notlar</div><div class="first ${first ? 'has' : ''}">${esc(first || 'Bir şeyler yaz')}</div>`; el.onclick = () => go('notes');
}
let noteSel = 0;
function vNotes(root) {
  const draw = () => {
    root.innerHTML = `<div class="notes"><div class="nlist">${S.notes.map((n, i) => `<button class="nitem ${i === noteSel ? 'on' : ''}" data-i="${i}">${esc(n.text.split('\n')[0] || 'Adsız')}</button>`).join('')}</div><textarea class="nedit" placeholder="Bir şeyler yaz…"></textarea></div>`;
    const ta = $('textarea', root); ta.value = S.notes[noteSel] ? S.notes[noteSel].text : '';
    ta.onfocus = () => api.send('focus', true);
    ta.oninput = () => { S.notes[noteSel].text = ta.value; $$('.nitem', root)[noteSel].textContent = ta.value.split('\n')[0] || 'Adsız'; save('notes'); };
    $$('.nitem', root).forEach(b => b.onclick = () => { noteSel = +b.dataset.i; draw(); });
  };
  if (!S.notes.length) S.notes.push({ id: Date.now(), text: '' });
  noteSel = clamp(noteSel, 0, S.notes.length - 1);
  $('#barActions').innerHTML = `<button class="icon" id="nn" title="Yeni not">${ic('plus', 16)}</button><button class="icon" id="nd" title="Notu sil">${ic('trash', 16)}</button>`;
  $('#nn').onclick = () => { S.notes.unshift({ id: Date.now(), text: '' }); noteSel = 0; save('notes'); draw(); $('textarea', root).focus(); };
  $('#nd').onclick = () => { S.notes.splice(noteSel, 1); if (!S.notes.length) S.notes.push({ id: Date.now(), text: '' }); noteSel = 0; save('notes'); draw(); };
  draw();
}

/* ---------- screenshot / color picker ---------- */
let shooting = false;
const OCR = { text: '' };
async function doOcr() {
  if (shooting) return; shooting = true;
  const wasPinned = ui.pinned; if (wasPinned) setPinned(false, true); setOpen(false);
  await new Promise(r => setTimeout(r, 260));
  const r = await api.invoke('shot', { mode: 'ocr' }); shooting = false;
  if (!r || r.cancelled) { if (wasPinned) setPinned(true, true); return; }
  if (r.error) return toast('Yakalanamadı: ' + r.error);
  OCR.text = r.text || ''; ui.view = 'ocr'; setOpen(true); if (wasPinned) setPinned(true, true);
  toast(OCR.text ? 'Metin panoya kopyalandı' : 'Seçilen alanda metin bulunamadı');
}
function vOcr(root) {
  SIZES.ocr = [620, 66 + 236];
  root.innerHTML = `<textarea class="nedit ocrt" spellcheck="false" placeholder="Bu alanda metin bulunamadı. Daha büyük ya da daha net bir alan seçmeyi dene."></textarea>
    <div class="ocra"><span class="empty" id="ocount"></span><span class="sp"></span><button class="btn" id="oagain">${ic('scanText', 15)}Yeniden yakala</button><button class="btn pri" id="ocopy">${ic('copy', 15)}Kopyala</button></div>`;
  const ta = $('.ocrt', root), cnt = () => $('#ocount', root).textContent = ta.value ? ta.value.length + ' karakter · düzenleyebilirsin' : 'Windows metin tanıma';
  ta.value = OCR.text; cnt(); ta.oninput = () => { OCR.text = ta.value; cnt(); }; ta.onfocus = () => api.send('focus', true);
  $('#ocopy', root).onclick = () => { if (!ta.value) return; api.send('clips:write', ta.value); toast('Kopyalandı'); };
  $('#oagain', root).onclick = doOcr;
}
async function doShot() {
  if (shooting) return; shooting = true;
  const wasPinned = ui.pinned; if (wasPinned) setPinned(false, true); setOpen(false);
  await new Promise(r => setTimeout(r, 260));
  const r = await api.invoke('shot'); shooting = false;
  if (wasPinned) setPinned(true, true);
  if (!r || r.cancelled) return;
  if (r.error) return toast('Ekran görüntüsü alınamadı: ' + r.error);
  S.shelf = [{ name: r.path.split('\\').pop(), path: r.path }, ...S.shelf.filter(x => x.path !== r.path)].slice(0, 30); save('shelf');
  toast('Ekran görüntüsü kopyalandı · Dosya rafında da var');
}
async function doPick() {
  if (ui.picking) return;
  ui.picking = true;
  // Our own full-screen picker (Chromium's EyeDropper only reaches inside the app window).
  try {
    const r = await api.invoke('shot', { mode: 'pick' });
    if (r && r.color) { const hex = r.color.toLowerCase(); addColor(hex); api.send('clips:write', r.color); toast(r.color + ' kopyalandı'); if (ui.view === 'color') go('color'); }
    else if (r && r.error) toast('Renk seçilemedi: ' + r.error);
  } catch {}
  finally {
    ui.picking = false;
    // the cursor may have left the island while picking: close now unless it came back or the panel is pinned
    setTimeout(() => { if (!ui.hovering && !ui.pinned && !ui.picking && ui.open && !typing()) setOpen(false); }, 1200);
  }
}
function addColor(h) { S.colors = [h, ...S.colors.filter(c => c !== h)].slice(0, 12); save('colors'); }
function vColor(root) {
  root.innerHTML = `<div class="row"><button class="btn pri" id="pk">${ic('pick', 15)}Ekrandan seç</button><span class="empty">Herhangi bir piksele tıkla, renk kodu kopyalanır.</span></div>` +
    (S.colors.length ? `<div class="swatches">${S.colors.map(c => `<div class="swatch" style="background:${c}" data-c="${c}">${c.toUpperCase()}</div>`).join('')}</div>` : '<div class="card center" style="height:136px;margin-top:12px"><span class="empty">Seçtiğin renkler burada görünür</span></div>');
  $('#pk').onclick = doPick; $$('.swatch', root).forEach(s => s.onclick = () => { api.send('clips:write', s.dataset.c); toast('Kopyalandı'); });
}

/* ---------- calendar (weeks start Monday) ---------- */
// Synced events come from main (Windows calendar + ICS links); local ones stay in S.events.
const CAL = { events: [], status: {}, last: 0, syncing: false };
let calRedraw = null;
api.on('cal:events', r => { Object.assign(CAL, r, { syncing: false }); if (calRedraw && ui.view === 'calendar') calRedraw(); else if (ui.view === 'calsrc') go('calsrc'); });
const calCfg = () => ({ windows: true, feeds: [], remind: 10, ...(S.calsync || {}) });
const FEED_COLORS = ['#4f8cff', '#2fc7a8', '#f2a53a', '#e8597a', '#9b6bf2', '#56b3c9'];
const srcColor = src => src === 'windows' ? '#7aa7ff' : (calCfg().feeds.find(x => x.id === src) || {}).color || 'var(--accent)';
const srcName = src => src === 'windows' ? 'Windows Takvimi' : (calCfg().feeds.find(x => x.id === src) || {}).name || 'Takvim';
const hm = t => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
const syncedOn = k => { const d0 = new Date(k + 'T00:00').getTime(), d1 = d0 + 864e5; return CAL.events.filter(e => e.start < d1 && (e.end > d0 || (e.end === e.start && e.start >= d0))); };
async function calSync() { CAL.syncing = true; if (calRedraw && ui.view === 'calendar') calRedraw(); const r = await api.invoke('cal:sync'); Object.assign(CAL, r, { syncing: false }); if (calRedraw && ui.view === 'calendar') calRedraw(); return r; }
// Reminders: a few minutes before a timed event, show it on the island.
const reminded = new Set();
setInterval(() => {
  const m = calCfg().remind; if (!m) return;
  const now = Date.now(), lim = now + m * 6e4, items = [];
  for (const e of CAL.events) if (!e.allDay && e.start > now && e.start <= lim) items.push({ id: e.id, start: e.start, title: e.title, loc: e.loc, src: srcName(e.src) });
  for (const [k, list] of Object.entries(S.events)) for (const e of list) {
    if (!/^\d\d:\d\d$/.test(e.t)) continue; const t = new Date(k + 'T' + e.t + ':00').getTime();
    if (t > now && t <= lim) items.push({ id: 'local' + e.id, start: t, title: e.text, loc: '', src: 'Adacık' });
  }
  for (const it of items) {
    if (reminded.has(it.id + '@' + it.start)) continue; reminded.add(it.id + '@' + it.start);
    const mins = Math.max(1, Math.round((it.start - now) / 6e4)), body = hm(it.start) + ' · ' + mins + ' dk sonra' + (it.loc ? ' · ' + it.loc : '');
    if (ui.open) toast(it.title + ' · ' + mins + ' dk sonra');
    else notify({ app: 'Takvim · ' + it.src, title: it.title, body, icon: '', to: 'calendar' });
  }
}, 20000);

let calM = new Date(); calM.setDate(1); let calSel = new Date();
const key = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function isoWeek(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7); }
function vCal(root) {
  const draw = () => {
    $('#barActions').innerHTML = `<span class="ver" id="csync">${CAL.syncing ? 'Eşitleniyor…' : CAL.last ? hm(CAL.last) + ' eşitlendi' : ''}</span><button class="icon ${CAL.syncing ? 'spin' : ''}" id="crefresh" title="Şimdi eşitle">${ic('refresh', 15)}</button><button class="icon" id="clink" title="Bağlı takvimler">${ic('link', 16)}</button>`;
    $('#crefresh').onclick = () => calSync(); $('#clink').onclick = () => go('calsrc');
    const start = new Date(calM); start.setDate(1 - ((calM.getDay() + 6) % 7));
    const today = key(new Date()); let cells = '';
    // days in this 6-week grid that have synced events (multi-day events mark every day they cover)
    const g0 = start.getTime(), g1 = g0 + 42 * 864e5, synced = new Set();
    for (const e of CAL.events) { if (e.end < g0 || e.start > g1) continue; const d = new Date(Math.max(e.start, g0)); d.setHours(0, 0, 0, 0); for (let i = 0; i < 42 && d.getTime() < Math.max(e.end, e.start + 1) && d.getTime() <= g1; i++) { synced.add(key(d)); d.setDate(d.getDate() + 1); } }
    for (let r = 0; r < 6; r++) {
      const wd = new Date(start); wd.setDate(start.getDate() + r * 7);
      cells += `<div class="wk">${isoWeek(wd)}</div>`;
      for (let c = 0; c < 7; c++) {
        const d = new Date(start); d.setDate(start.getDate() + r * 7 + c); const k = key(d);
        cells += `<div class="d ${c > 4 ? 'we' : ''} ${d.getMonth() !== calM.getMonth() ? 'oth' : ''} ${k === today ? 'today' : ''} ${k === key(calSel) ? 'sel' : ''} ${(S.events[k] || []).length || synced.has(k) ? 'ev' : ''}" data-k="${k}">${d.getDate()}</div>`;
      }
    }
    const sk = key(calSel);
    const evs = [...(S.events[sk] || []).map(e => ({ local: true, id: e.id, sort: e.t === 'Tüm gün' ? '' : e.t, time: e.t, title: e.text, color: 'var(--accent)', from: 'Adacık' })),
      ...syncedOn(sk).map(e => ({ sort: e.allDay ? '' : hm(e.start), time: e.allDay ? 'Tüm gün' : hm(e.start) + '–' + hm(e.end), title: e.title, loc: e.loc, color: srcColor(e.src), from: srcName(e.src) }))]
      .sort((a, b) => a.sort.localeCompare(b.sort));
    const dayEnd = new Date(sk + 'T00:00').getTime() + 864e5, up = [];
    Object.keys(S.events).sort().forEach(k => { if (k > sk) S.events[k].forEach(e => up.push({ t: new Date(k + 'T' + (/^\d\d:\d\d$/.test(e.t) ? e.t : '00:00')).getTime(), day: k, label: e.t + ' ' + e.text, color: 'var(--accent)' })); });
    CAL.events.filter(e => e.start >= dayEnd).slice(0, 8).forEach(e => up.push({ t: e.start, day: key(new Date(e.start)), label: (e.allDay ? '' : hm(e.start) + ' ') + e.title, color: srcColor(e.src) }));
    up.sort((a, b) => a.t - b.t);
    root.innerHTML = `<div class="cal"><div class="month"><div class="mh">${calM.toLocaleDateString('tr-TR', { month: 'long' })} <small>${calM.getFullYear()}</small><span class="sp"></span><button class="icon" id="pm" title="Önceki ay">${ic('lt', 14)}</button><button class="icon" id="nm" title="Sonraki ay">${ic('gt', 14)}</button></div>
      <div class="cg"><div></div>${['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map((x, i) => `<div class="hd ${i > 4 ? 'we' : ''}">${x}</div>`).join('')}${cells}</div></div>
      <div class="side"><div class="wd">${calSel.toLocaleDateString('tr-TR', { weekday: 'long' })}</div><div class="big">${calSel.getDate()} ${calSel.toLocaleDateString('tr-TR', { month: 'long' })}</div><div class="sub">${key(calSel) === today ? 'Bugün · ' : ''}${isoWeek(calSel)}. hafta</div>
      <div class="evl">${evs.map(e => `<div class="e" title="${esc(e.from)}"><time>${e.time}</time><i class="cdot" style="background:${e.color}"></i><span>${esc(e.title)}${e.loc ? `<small> · ${esc(e.loc)}</small>` : ''}</span>${e.local ? `<span class="x" data-id="${e.id}" title="Kaldır">${ic('x', 12)}</span>` : ''}</div>`).join('') || '<div class="empty">Plan yok</div>'}
      ${up.length ? '<div class="lb" style="margin-top:10px">Yaklaşanlar</div>' + up.slice(0, 4).map(u => `<div class="e"><time>${new Date(u.day + 'T00:00').toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })}</time><i class="cdot" style="background:${u.color}"></i><span>${esc(u.label)}</span></div>`).join('') : ''}</div>
      <div class="add"><input class="field" id="evin" placeholder="Ekle: 14:30 Dişçi"><button class="round" id="evgo" title="Etkinlik ekle">${ic('plus', 16)}</button></div></div></div>`;
    $('#pm').onclick = () => { calM.setMonth(calM.getMonth() - 1); draw(); }; $('#nm').onclick = () => { calM.setMonth(calM.getMonth() + 1); draw(); };
    $$('.d', root).forEach(d => d.onclick = () => { calSel = new Date(d.dataset.k + 'T00:00'); if (calSel.getMonth() !== calM.getMonth()) { calM = new Date(calSel); calM.setDate(1); } draw(); });
    $$('.x', root).forEach(x => x.onclick = () => { const k = key(calSel); S.events[k] = S.events[k].filter(e => String(e.id) !== x.dataset.id); if (!S.events[k].length) delete S.events[k]; save('events'); draw(); });
    const add = () => { const v = $('#evin').value.trim(); if (!v) return; const m = v.match(/^(\d{1,2})[:.](\d{2})\s+(.+)$/); const t = m ? String(m[1]).padStart(2, '0') + ':' + m[2] : 'Tüm gün', text = m ? m[3] : v; const k = key(calSel); (S.events[k] = S.events[k] || []).push({ id: Date.now(), t, text }); save('events'); draw(); };
    $('#evgo').onclick = add; $('#evin').onkeydown = e => { if (e.key === 'Enter') add(); }; $('#evin').onfocus = () => api.send('focus', true);
  };
  calRedraw = draw; draw();
}
// ---- connected calendars ----
function vCalSrc(root) {
  const cfg = calCfg(), st = CAL.status || {};
  SIZES.calsrc = [700, 66 + 220 + cfg.feeds.length * 60];
  const stat = id => { const x = st[id]; return !x ? '<small class="cs">Henüz eşitlenmedi</small>' : x.ok ? `<small class="cs ok">${x.count} etkinlik</small>` : `<small class="cs err" title="${esc(x.error)}">${esc(x.error)}</small>`; };
  root.innerHTML = `<div class="csrc">
    <div class="srow2"><i class="cdot" style="background:#7aa7ff"></i><div class="col"><b>Windows Takvimi</b><small>Windows’a eklediğin Outlook, Microsoft ve diğer hesaplar</small></div>${cfg.windows !== false ? stat('windows') : ''}<div class="sw ${cfg.windows !== false ? 'on' : ''}" id="cwin" role="switch"></div></div>
    ${cfg.feeds.map(f => `<div class="srow2"><i class="cdot" style="background:${f.color}"></i><div class="col"><b>${esc(f.name)}</b><small>${esc(f.url.replace(/^(https?|webcal):\/\//i, '').slice(0, 48))}…</small></div>${stat(f.id)}<button class="icon" data-rm="${f.id}" title="Kaldır">${ic('trash', 15)}</button></div>`).join('')}
    <div class="lb">Takvim bağlantısı ekle</div>
    <div class="row"><input class="field" id="cfname" placeholder="Ad (ör. İş)" style="width:130px;flex:none"><input class="field" id="cfurl" placeholder="iCal / ICS bağlantısı (https:// veya webcal://)" spellcheck="false"><button class="btn pri" id="cfadd">${ic('plus', 15)}Ekle</button></div>
    <div class="chelp"><b>Google Takvim:</b> Ayarlar → takvimin → “Takvimi entegre et” → <i>iCal biçimindeki gizli adres</i>. <b>Outlook:</b> Ayarlar → Takvim → Paylaşılan takvimler → Takvim yayımla → <i>ICS</i> bağlantısı. Bağlantı yalnızca bu bilgisayarda saklanır; takvimler sadece okunur.</div>
    <div class="row"><span class="lbl">Hatırlatma</span><div class="seg" id="crem">${[[0, 'Kapalı'], [5, '5 dk'], [10, '10 dk'], [15, '15 dk'], [30, '30 dk']].map(([v, l]) => `<button data-v="${v}" class="${cfg.remind === v ? 'on' : ''}">${l}</button>`).join('')}</div><span class="sp"></span><button class="btn" id="csyncnow">${ic('refresh', 15)}Şimdi eşitle</button></div></div>`;
  const setCfg = c => { S.calsync = c; save('calsync'); };
  $('#cwin', root).onclick = () => { const c = calCfg(); c.windows = c.windows === false; setCfg(c); $('#cwin', root).classList.toggle('on', c.windows); calSync().then(() => ui.view === 'calsrc' && go('calsrc')); };
  $$('[data-rm]', root).forEach(b => b.onclick = () => { const c = calCfg(); c.feeds = c.feeds.filter(f => f.id !== b.dataset.rm); setCfg(c); go('calsrc'); calSync(); });
  const add = async () => {
    const url = $('#cfurl', root).value.trim(); if (!url) return;
    if (!/^(https?|webcal):\/\//i.test(url)) return toast('Bağlantı https:// veya webcal:// ile başlamalı');
    const c = calCfg(); if (c.feeds.some(f => f.url === url)) return toast('Bu takvim zaten bağlı');
    const id = 'f' + Date.now().toString(36);
    c.feeds.push({ id, name: $('#cfname', root).value.trim() || 'Takvim ' + (c.feeds.length + 1), url, color: FEED_COLORS[c.feeds.length % FEED_COLORS.length] }); setCfg(c);
    toast('Eşitleniyor…'); await calSync(); const r = CAL.status[id];
    toast(r && r.ok ? `${r.count} etkinlik eklendi` : 'Takvim alınamadı: ' + (r ? r.error : 'bilinmeyen hata')); if (ui.view === 'calsrc') go('calsrc');
  };
  $('#cfadd', root).onclick = add; $('#cfurl', root).onkeydown = e => { if (e.key === 'Enter') add(); };
  $$('input', root).forEach(i => i.onfocus = () => api.send('focus', true));
  $$('#crem button', root).forEach(b => b.onclick = () => { const c = calCfg(); c.remind = +b.dataset.v; setCfg(c); $$('#crem button', root).forEach(x => x.classList.toggle('on', x === b)); });
  $('#csyncnow', root).onclick = async () => { toast('Eşitleniyor…'); await calSync(); if (ui.view === 'calsrc') go('calsrc'); };
}

/* ---------- system monitor ---------- */
const hist = { cpu: Array(40).fill(0), mem: Array(40).fill(0), down: Array(40).fill(0), up: Array(40).fill(0) };
const dec = (v, n) => v.toFixed(n).replace('.', ',');
const bytes = b => b >= 1e9 ? dec(b / 1073741824, 1) + ' GB' : b >= 1e6 ? Math.round(b / 1048576) + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' KB' : b + ' B';
const rate = b => b >= 1e6 ? dec(b / 1e6, 1) + ' MB/s' : b >= 1e3 ? dec(b / 1e3, b >= 1e4 ? 0 : 1) + ' KB/s' : Math.round(b) + ' B/s';
function spark(a, max, col, a2, col2) {
  const w = 300, h = 100, id = 'g' + Math.random().toString(36).slice(2, 7);
  const path = arr => arr.map((v, i) => (i ? 'L' : 'M') + (i / (arr.length - 1) * w).toFixed(1) + ' ' + (h - clamp(v / max, 0, 1) * h * .9 - 3).toFixed(1)).join(' ');
  return `<svg class="ch" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".45"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs><path d="${path(a)} L${w} ${h} L0 ${h}Z" fill="url(#${id})"/><path d="${path(a)}" fill="none" stroke="${col}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>${a2 ? `<path d="${path(a2)}" fill="none" stroke="${col2}" stroke-width="1.3" vector-effect="non-scaling-stroke"/>` : ''}</svg>`;
}
function uptime(s) { const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return (d ? d + ' g ' : '') + (h ? h + ' sa ' : '') + m + ' dk'; }
function vMon(root) {
  let topBy = 'cpu', top = [];
  root.innerHTML = `<div class="mon"><div class="mcard" id="mc"></div><div class="mcard" id="mm"></div><div class="mcard top"><div class="lb">En çok kullananlar</div><div class="seg acc"><button data-b="cpu" class="on">İşlemci</button><button data-b="mem">Bellek</button></div><div class="apps"><div class="empty" style="padding:8px 2px">İşlemler okunuyor…</div></div></div><div class="mcard" id="mn"></div><div class="mcard" id="md"></div></div>`;
  $$('.seg button', root).forEach(b => b.onclick = () => { topBy = b.dataset.b; $$('.seg button', root).forEach(x => x.classList.toggle('on', x === b)); drawTop(); });
  const drawTop = () => {
    const l = top.slice().sort((a, b) => b[topBy] - a[topBy] || b.mem - a.mem).slice(0, 9), mx = Math.max(1e-9, ...l.map(x => x[topBy]));
    $('.apps', root).innerHTML = l.map(a => `<div class="arow"><div class="bg" style="width:${Math.max(0, a[topBy] / mx * 100) * .9}%"></div><span class="n">${esc(a.name[0].toUpperCase() + a.name.slice(1))}${a.count > 1 ? ' ×' + a.count : ''}</span><span class="a">%${dec(a.cpu, 1)}</span><span class="b">${bytes(a.mem)}</span></div>`).join('');
  };
  const poll = async () => {
    const s = await api.invoke('sys:stats'); if (ui.view !== 'monitor') return;
    const acc = cssVar('--accent'), mp = s.mem.used / s.mem.total * 100;
    if (!hist.init) { hist.init = 1; hist.cpu.fill(s.cpu); hist.mem.fill(mp); }
    hist.cpu.push(s.cpu); hist.cpu.shift(); hist.mem.push(mp); hist.mem.shift(); hist.down.push(s.net.down); hist.down.shift(); hist.up.push(s.net.up); hist.up.shift();
    $('#mc', root).innerHTML = `<div class="lb">İşlemci</div><div class="v">%${Math.round(s.cpu)}</div><div class="s">${s.threads} iş parçacığı · ${uptime(s.uptime)} açık</div>${spark(hist.cpu, 100, acc)}`;
    $('#mm', root).innerHTML = `<div class="lb">Bellek</div><div class="v">%${Math.round(mp)}</div><div class="s">${Math.round(s.mem.total / 1073741824)} GB'ın ${(s.mem.used / 1073741824).toFixed(1).replace('.', ',')} GB'ı kullanımda</div>${spark(hist.mem, 100, '#2fc7a8')}`;
    $('#mn', root).innerHTML = `<div class="lb">Ağ</div><div class="v">↓ ${rate(s.net.down)}</div><div class="s">↑ ${rate(s.net.up)} yükleme</div>${spark(hist.down, Math.max(5e4, ...hist.down, ...hist.up), acc, hist.up, '#2fc7a8')}`;
    const used = (s.disk.total - s.disk.free) / s.disk.total * 100;
    $('#md', root).innerHTML = `<div class="lb">Depolama</div><div style="margin-top:10px;display:flex;justify-content:space-between;font-size:12.5px"><b>C:</b><span class="s">${Math.round(s.disk.total / 1e9)} GB'ın ${Math.round(s.disk.free / 1e9)} GB'ı boş</span></div><div class="bar2"><i class="${used > 90 ? 'full' : ''}" style="width:${used}%"></i></div>`;
  };
  const pollTop = async () => { top = await api.invoke('sys:top'); if (ui.view === 'monitor') drawTop(); };
  poll(); pollTop(); every(poll, 1000); every(pollTop, 3000);
}

/* ---------- start menu ---------- */
function vStart(root) {
  root.innerHTML = `<div class="start"><div class="search">${ic('search', 16)}<input id="sq" placeholder="Uygulama ara"></div><div class="list"><div class="empty" style="padding:8px">Uygulamalar yükleniyor…</div></div><div class="sfoot"><div class="av"></div><span id="un"></span><span class="sp"></span>
    <button class="icon" data-f="documents" title="Belgeler">${ic('doc', 16)}</button><button class="icon" data-f="downloads" title="İndirilenler">${ic('down', 16)}</button><button class="icon" data-f="pictures" title="Resimler">${ic('folder', 16)}</button><button class="icon" id="sg" title="Ayarlar">${ic('gear', 16)}</button></div></div>`;
  api.invoke('user').then(u => { $('#un', root).textContent = u; $('.av', root).textContent = (u[0] || '?').toUpperCase(); });
  $$('[data-f]', root).forEach(b => b.onclick = () => api.send('folder', b.dataset.f)); $('#sg', root).onclick = () => go('settings');
  const sq = $('#sq', root); sq.onfocus = () => api.send('focus', true);
  let apps = [];
  const draw = () => {
    const q = sq.value.trim().toLowerCase(); const l = apps.filter(a => !q || a.name.toLowerCase().includes(q)); let h = '', last = '';
    l.forEach((a, i) => { const L = /[a-z]/i.test(a.name[0]) ? a.name[0].toUpperCase() : '#'; if (!q && L !== last) { h += `<div class="letter">${L}</div>`; last = L; } h += `<button class="sitem ${q && i === 0 ? 'first' : ''}" data-p="${esc(a.path)}">${a.icon ? `<img src="${a.icon}">` : ic('doc', 22)}<span>${esc(a.name)}</span></button>`; });
    $('.list', root).innerHTML = h || '<div class="empty" style="padding:8px">Uygulama bulunamadı</div>';
    $$('.sitem', root).forEach(b => b.onclick = () => { api.send('open', b.dataset.p); setOpen(false); });
  };
  api.invoke('apps:list').then(a => { apps = a; if (ui.view === 'start') draw(); });
  sq.oninput = draw; sq.onkeydown = e => { if (e.key === 'Enter') { const f = $('.sitem', root); if (f) f.click(); } };
  setTimeout(() => sq.focus(), 300);
}

/* ---------- calculator: natural input, units, history ---------- */
const UNITS = {
  m: ['len', 1], km: ['len', 1000], cm: ['len', .01], mm: ['len', .001], mi: ['len', 1609.344], yd: ['len', .9144], ft: ['len', .3048], in: ['len', .0254],
  kg: ['mass', 1], g: ['mass', .001], mg: ['mass', 1e-6], lb: ['mass', .45359237], lbs: ['mass', .45359237], oz: ['mass', .028349523125], t: ['mass', 1000],
  l: ['vol', 1], ml: ['vol', .001], gal: ['vol', 3.785411784], cup: ['vol', .2365882365],
  s: ['time', 1], sec: ['time', 1], min: ['time', 60], h: ['time', 3600], hr: ['time', 3600], day: ['time', 86400], days: ['time', 86400], week: ['time', 604800],
  b: ['data', 1], kb: ['data', 1024], mb: ['data', 1048576], gb: ['data', 1073741824], tb: ['data', 1099511627776],
  kmh: ['spd', 1 / 3.6], mph: ['spd', .44704], ms: ['spd', 1],
  c: ['temp'], f: ['temp'], k: ['temp'],
};
function convert(v, a, b) {
  const A = UNITS[a], B = UNITS[b]; if (!A || !B || A[0] !== B[0]) throw new Error('units');
  if (A[0] !== 'temp') return v * A[1] / B[1];
  const k = a === 'c' ? v + 273.15 : a === 'f' ? (v - 32) * 5 / 9 + 273.15 : v;
  return b === 'c' ? k - 273.15 : b === 'f' ? (k - 273.15) * 9 / 5 + 32 : k;
}
function calcEval(src, deg, ans) {
  let s = src.trim().toLowerCase().replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  if (!s) return null;
  const u = s.match(/^(.+?)\s*(°?[a-z]+)\s+(?:to|in|->|=)\s+(°?[a-z]+)$/);
  if (u) { const v = calcEval(u[1], deg, ans); const a = u[2].replace('°', ''), b = u[3].replace('°', ''); return { v: convert(v.v, a, b), unit: b === 'c' || b === 'f' ? '°' + b.toUpperCase() : u[3] }; }
  s = s.replace(/([\d.]+)\s*%\s*of\s*/g, '($1/100)*');
  // Turkish: "80'in %12'si" / "80 in %12 si"
  s = s.replace(/([\d.]+)\s*['’]?\s*(?:n?[ıiuü]n)\s*%\s*([\d.]+)\s*['’]?\s*(?:s?[ıiuü])?/g, '($1*$2/100)');
  const tk = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[\d.]/.test(c)) { let j = i; while (j < s.length && /[\d.]/.test(s[j])) j++; if (s[j] === 'e' && /[\d+-]/.test(s[j + 1] || '')) { j++; if (/[+-]/.test(s[j])) j++; while (/\d/.test(s[j] || '')) j++; } tk.push({ t: 'n', v: parseFloat(s.slice(i, j)) }); i = j; continue; }
    if (/[a-zπ√]/.test(c)) { let j = i; if (c === 'π' || c === '√') j++; else while (j < s.length && /[a-z]/.test(s[j])) j++; tk.push({ t: 'id', v: s.slice(i, j) }); i = j; continue; }
    if ('+-*/^()%!'.includes(c)) { tk.push({ t: c }); i++; continue; }
    throw new Error('char');
  }
  let p = 0; const peek = () => tk[p], eat = t => { if (tk[p] && tk[p].t === t) { p++; return true; } return false; };
  const rad = x => deg ? x * Math.PI / 180 : x, unrad = x => deg ? x * 180 / Math.PI : x;
  const FN = { sin: x => Math.sin(rad(x)), cos: x => Math.cos(rad(x)), tan: x => Math.tan(rad(x)), asin: x => unrad(Math.asin(x)), acos: x => unrad(Math.acos(x)), atan: x => unrad(Math.atan(x)), ln: Math.log, log: Math.log10, sqrt: Math.sqrt, '√': Math.sqrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil };
  const CONST = { pi: Math.PI, 'π': Math.PI, e: Math.E, ans: ans || 0 };
  const fact = n => { if (n < 0 || n % 1) throw new Error('fact'); let r = 1; for (let k = 2; k <= n; k++) r *= k; return r; };
  const startsPrimary = t => t && (t.t === 'n' || t.t === 'id' || t.t === '(');
  function expr() { let v = term(); for (;;) { if (eat('+')) v += term(); else if (eat('-')) v -= term(); else return v; } }
  function term() { let v = unary(); for (;;) { if (eat('*')) v *= unary(); else if (eat('/')) v /= unary(); else if (startsPrimary(peek())) v *= unary(); else return v; } }
  function unary() { if (eat('-')) return -unary(); if (eat('+')) return unary(); return power(); }
  function power() { const b = postfix(); if (eat('^')) return b ** unary(); return b; }
  function postfix() { let v = primary(); for (;;) { if (eat('%')) v /= 100; else if (eat('!')) v = fact(v); else return v; } }
  function primary() {
    const t = tk[p++]; if (!t) throw new Error('end');
    if (t.t === 'n') return t.v;
    if (t.t === '(') { const v = expr(); eat(')'); return v; }
    if (t.t === 'id') {
      if (FN[t.v]) { if (eat('(')) { const v = expr(); eat(')'); return FN[t.v](v); } return FN[t.v](power()); }
      if (t.v in CONST) return CONST[t.v];
    }
    throw new Error('tok');
  }
  const v = expr(); if (p < tk.length) throw new Error('trail');
  return { v };
}
const nfmt = v => { if (!Number.isFinite(v)) return 'Hata'; const r = +v.toPrecision(12); return Math.abs(r) >= 1e15 || (r && Math.abs(r) < 1e-9) ? r.toExponential(6) : r.toLocaleString('tr-TR', { maximumFractionDigits: 10 }); };
function vCalc(root) {
  const st = S.settings; let ans = S.calcHist[0]?.v || 0;
  $('#barActions').innerHTML = `<div class="seg"><button data-m="deg" class="${st.rad ? '' : 'on'}">DEG</button><button data-m="rad" class="${st.rad ? 'on' : ''}">RAD</button></div>`;
  $$('#barActions .seg button').forEach(b => b.onclick = () => { st.rad = b.dataset.m === 'rad'; save('settings'); $$('#barActions .seg button').forEach(x => x.classList.toggle('on', x === b)); live(); });
  const K = [['sin', 'f', 'sin('], ['cos', 'f', 'cos('], ['tan', 'f', 'tan('], ['(', 'f', '('], [')', 'f', ')'], ['AC', 'f ac', 'AC'],
    ['ln', 'f', 'ln('], ['7', 'n'], ['8', 'n'], ['9', 'n'], ['÷', 'o', '÷'], ['⌫', 'f', 'BS'],
    ['log', 'f', 'log('], ['4', 'n'], ['5', 'n'], ['6', 'n'], ['×', 'o', '×'], ['%', 'o', '%'],
    ['√', 'f', '√('], ['1', 'n'], ['2', 'n'], ['3', 'n'], ['−', 'o', '−'], ['xʸ', 'o', '^'],
    ['π', 'f', 'π'], ['0', 'n'], ['.', 'n'], ['ans', 'f', 'ans'], ['+', 'o', '+'], ['=', 'q', '=']];
  root.innerHTML = `<div class="calc"><div><div class="cin"><input id="cx" placeholder="Bir işlem yaz: 80'in %12'si, 5 km to mi" spellcheck="false"><div class="res">0</div></div>
    <div class="keys">${K.map(k => `<button class="${k[1]}" data-k="${esc(k[2] || k[0])}">${k[0] === '⌫' ? ic('bksp', 16, 'style="margin:auto"') : k[0] === '=' ? ic('enter', 18, 'style="margin:auto"') : k[0]}</button>`).join('')}</div></div>
    <div class="hist"><div class="lb">Geçmiş</div><div class="list2"></div></div></div>`;
  const cx = $('#cx', root), res = $('.res', root);
  const live = () => { try { const r = calcEval(cx.value, !st.rad, ans); res.textContent = r ? nfmt(r.v) + (r.unit ? ' ' + r.unit : '') : '0'; res.classList.toggle('ok', !!r); } catch { res.textContent = cx.value.trim() ? '…' : '0'; res.classList.remove('ok'); } };
  const drawHist = () => { $('.list2', root).innerHTML = S.calcHist.length ? S.calcHist.map((h, i) => `<button class="hrow" data-i="${i}"><small>${esc(h.e)}</small><b>${esc(h.r)}</b></button>`).join('') : '<div class="empty center" style="height:240px">Sonucu saklamak için Enter’a bas</div>'; $$('.hrow', root).forEach(b => b.onclick = () => { const h = S.calcHist[+b.dataset.i]; cx.value = String(h.v); live(); cx.focus(); }); };
  const commit = () => { try { const r = calcEval(cx.value, !st.rad, ans); if (!r) return; const out = nfmt(r.v) + (r.unit ? ' ' + r.unit : ''); ans = r.v; S.calcHist.unshift({ e: cx.value.trim(), r: out, v: r.v }); S.calcHist = S.calcHist.slice(0, 30); save('calcHist'); drawHist(); cx.value = ''; res.textContent = out; res.classList.add('ok'); api.send('clips:write', String(+r.v.toPrecision(12))); } catch { res.textContent = 'Hata'; res.classList.remove('ok'); } };
  const ins = t => { const a = cx.selectionStart ?? cx.value.length, b = cx.selectionEnd ?? a; cx.value = cx.value.slice(0, a) + t + cx.value.slice(b); cx.setSelectionRange(a + t.length, a + t.length); };
  $$('.keys button', root).forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    if (k === 'AC') cx.value = ''; else if (k === 'BS') { const a = cx.selectionStart ?? cx.value.length; if (a > 0) { cx.value = cx.value.slice(0, a - 1) + cx.value.slice(a); cx.setSelectionRange(a - 1, a - 1); } }
    else if (k === '=') return commit(); else ins(k);
    live(); cx.focus();
  });
  cx.oninput = live; cx.onfocus = () => api.send('focus', true);
  cx.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } };
  drawHist(); live(); setTimeout(() => cx.focus(), 300);
}

/* ---------- quick launch ---------- */
const QL_DEFAULT = [
  { name: 'Dosya Gezgini', target: 'C:\\Windows\\explorer.exe' },
  { name: 'İndirilenler', target: '%downloads%', glyph: 'down' },
  { name: 'Ayarlar', target: 'ms-settings:', icon: 'C:\\Windows\\ImmersiveControlPanel\\SystemSettings.exe' },
  { name: 'Görev Yöneticisi', target: 'C:\\Windows\\System32\\Taskmgr.exe' },
  { name: 'Terminal', target: 'wt.exe', icon: 'C:\\Windows\\System32\\cmd.exe' },
  { name: 'Not Defteri', target: 'C:\\Windows\\System32\\notepad.exe' },
];
const qlIcons = {};
function qlName(t) {
  if (/^https?:/i.test(t)) { try { return new URL(t).hostname.replace(/^www\./, ''); } catch { return t; } }
  if (/^ms-settings:/i.test(t)) return 'Ayarlar';
  const b = t.replace(/[\\/]+$/, '').split(/[\\/]/).pop(); return b.replace(/\.(exe|lnk|url|bat|cmd)$/i, '') || t;
}
function vLaunch(root) {
  if (!S.launch) S.launch = QL_DEFAULT.map(x => ({ ...x }));
  const TRN = { Explorer: 'Dosya Gezgini', Downloads: 'İndirilenler', Settings: 'Ayarlar', 'Task Manager': 'Görev Yöneticisi', Notepad: 'Not Defteri' };
  S.launch.forEach(x => { if (TRN[x.name] && QL_DEFAULT.some(q => q.target === x.target)) x.name = TRN[x.name]; });
  let editing = false;
  $('#barActions').innerHTML = `<button class="icon" id="qr" title="Varsayılanlara dön">${ic('undo', 15)}</button><button class="icon" id="qe" title="Düzenle">${ic('pencil', 15)}</button>`;
  root.innerHTML = `<div class="ql"><div class="qgrid"></div><div class="qhint">Eklemek için dosya veya klasörleri buraya bırak</div>
    <div class="qadd"><input class="field" id="qin" placeholder="Bir yol, web sitesi veya ms-settings: bağlantısı yapıştır"><button class="btn" id="qb">${ic('folder', 15)}Gözat</button><button class="btn pri" id="qa">${ic('plus', 15)}Ekle</button></div></div>`;
  const ql = $('.ql', root), grid = $('.qgrid', root), qin = $('#qin', root);
  const draw = () => {
    grid.innerHTML = S.launch.map((it, i) => `<button class="qi" data-i="${i}" title="${esc(it.target)}"><span class="rm" data-rm="${i}">${ic('x', 10)}</span><span class="gi">${ic(/^https?:/i.test(it.target) ? 'globe' : 'rocket', 18)}</span><span>${esc(it.name)}</span></button>`).join('') || '<div class="empty" style="grid-column:1/-1;padding:20px 4px">Kısayol yok. Aşağıdan ekle.</div>';
    $$('.qi', grid).forEach(b => {
      const it = S.launch[+b.dataset.i], src = it.icon || it.target;
      const put = url => { if (url && b.isConnected) { const im = document.createElement('img'); im.src = url; $('.gi', b).replaceWith(im); } };
      if (it.glyph) { const g = $('.gi', b); g.innerHTML = ic(it.glyph, 20); g.classList.add('tint'); }
      else if (qlIcons[src] !== undefined) put(qlIcons[src]); else api.invoke('icon:get', src).then(u => { qlIcons[src] = u; put(u); });
      b.onclick = e => {
        if (e.target.closest('[data-rm]')) { S.launch.splice(+b.dataset.i, 1); save('launch'); draw(); return; }
        if (editing) return; api.send('launch', it.target); setOpen(false);
      };
    });
  };
  const add = t => { t = (t || '').trim().replace(/^"(.*)"$/, '$1'); if (!t) return; if (/^www\./i.test(t)) t = 'https://' + t; if (S.launch.some(x => x.target === t)) return toast('Zaten ekli'); S.launch.push({ name: qlName(t), target: t }); save('launch'); draw(); };
  $('#qa', root).onclick = () => { add(qin.value); qin.value = ''; };
  qin.onkeydown = e => { if (e.key === 'Enter') { add(qin.value); qin.value = ''; } }; qin.onfocus = () => api.send('focus', true);
  $('#qb', root).onclick = async () => { const p = await api.invoke('browse'); if (p) add(p); };
  $('#qe').onclick = () => { editing = !editing; ql.classList.toggle('editing', editing); $('#qe').classList.toggle('on', editing); };
  $('#qr').onclick = () => { S.launch = QL_DEFAULT.map(x => ({ ...x })); save('launch'); draw(); toast('Varsayılanlara dönüldü'); };
  ql.ondragover = e => { e.preventDefault(); ql.classList.add('over'); }; ql.ondragleave = e => { if (!ql.contains(e.relatedTarget)) ql.classList.remove('over'); };
  ql.ondrop = e => { e.preventDefault(); ql.classList.remove('over'); for (const f of e.dataTransfer.files) add(api.pathOf(f)); const u = e.dataTransfer.getData('text/uri-list'); if (u && !e.dataTransfer.files.length) add(u.split('\n')[0]); };
  draw();
}

/* ---------- QR code ---------- */
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];   // Turkish characters, emoji, etc.
const QR = { text: '', logo: null };
const QR_COLORS = [['#111111', 'Siyah'], ['#e8710a', 'Turuncu'], ['#a11cbf', 'Mor'], ['#1e88e5', 'Mavi'], ['#0f9d58', 'Yeşil'], ['grad', 'Gün batımı']];
const QR_BG = { white: '#ffffff', cream: '#f6efdf', night: '#14161a', clear: 'none' };
const qrOpts = () => ({ style: 'liquid', corners: 'round', color: '#a11cbf', bg: 'white', label: '', ...(S.settings.qr || {}) });
// Rounded rectangle path with its own radius per corner: [top-left, top-right, bottom-right, bottom-left].
function rr(x, y, w, h, [a, b, c, d]) {
  return `M${x + a} ${y}H${x + w - b}${b ? `A${b} ${b} 0 0 1 ${x + w} ${y + b}` : ''}V${y + h - c}${c ? `A${c} ${c} 0 0 1 ${x + w - c} ${y + h}` : ''}H${x + d}${d ? `A${d} ${d} 0 0 1 ${x} ${y + h - d}` : ''}V${y + a}${a ? `A${a} ${a} 0 0 1 ${x + a} ${y}` : ''}Z`;
}
// Alignment pattern centres per QR version (ISO/IEC 18004 Annex E); drawn solid so scanners always find them.
const QR_ALIGN = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170]];
const circ = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
function qrSvg(o) {
  const q = qrcode(0, o.logo ? 'H' : 'M'); q.addData(o.text); q.make();
  const n = q.getModuleCount(), Z = 4, W = n + Z * 2, labelH = o.label ? 6 : 0;
  const bg = QR_BG[o.bg] || '#ffffff';
  let fg = o.color; if (o.bg === 'night' && fg === '#111111') fg = '#ffffff';
  const paint = fg === 'grad' ? 'url(#qg)' : fg;
  const dark = (r, c) => r >= 0 && c >= 0 && r < n && c < n && q.isDark(r, c);
  const finder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const L = o.logo ? (Math.round(n * .22) | 1) : 0, l0 = (n - L) / 2;
  const hole = (r, c) => L && r >= l0 - 1 && r < l0 + L + 1 && c >= l0 - 1 && c < l0 + L + 1;
  const ver = (n - 17) / 4, ap = QR_ALIGN[ver] || [], aligns = [];
  for (const ar of ap) for (const ac of ap) if (!finder(ar, ac) && !finder(ar - 2, ac - 2) && !finder(ar + 2, ac + 2) && !finder(ar - 2, ac + 2) && !finder(ar + 2, ac - 2)) aligns.push([ar, ac]);
  const inAlign = (r, c) => aligns.some(([ar, ac]) => Math.abs(r - ar) <= 2 && Math.abs(c - ac) <= 2);
  const D = (r, c) => dark(r, c) && !finder(r, c) && !hole(r, c) && !inAlign(r, c);
  let d = '';
  if (o.style === 'lines') {
    for (let c = 0; c < n; c++) for (let r = 0; r < n; r++) {
      if (!D(r, c)) continue; let e = r; while (D(e + 1, c)) e++;
      d += rr(c + Z + .1, r + Z + .04, .8, e - r + .92, [.4, .4, .4, .4]); r = e;
    }
  } else {
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!D(r, c)) continue; const x = c + Z, y = r + Z;
      if (o.style === 'square') d += `M${x} ${y}h1v1h-1z`;
      else if (o.style === 'dots') d += circ(x + .5, y + .5, .47);
      else if (o.style === 'rounded') d += rr(x + .03, y + .03, .94, .94, [.32, .32, .32, .32]);
      else { // liquid: round only the corners that have no dark neighbour on either side
        const u = D(r - 1, c), b = D(r + 1, c), l = D(r, c - 1), rt = D(r, c + 1), k = .5;
        d += rr(x, y, 1, 1, [!u && !l ? k : 0, !u && !rt ? k : 0, !b && !rt ? k : 0, !b && !l ? k : 0]);
      }
    }
  }
  let f = '';
  for (const [r0, c0] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    const x = c0 + Z, y = r0 + Z;
    if (o.corners === 'circle') f += circ(x + 3.5, y + 3.5, 3.5) + circ(x + 3.5, y + 3.5, 2.5) + circ(x + 3.5, y + 3.5, 1.5);
    else {
      const R = { square: [0, 0, 0], round: [2.2, 1.4, .9], leaf: [3.2, 2.2, 1.4] }[o.corners] || [0, 0, 0];
      const leaf = o.corners === 'leaf', k = (v, s) => leaf ? [v, s, v, s] : [v, v, v, v];
      f += rr(x, y, 7, 7, k(R[0], .5)) + rr(x + 1, y + 1, 5, 5, k(R[1], .3)) + rr(x + 2, y + 2, 3, 3, k(R[2], .2));
    }
  }
  for (const [ar, ac] of aligns) { const x = ac + Z - 2, y = ar + Z - 2, rd = o.corners === 'square' ? 0 : o.corners === 'circle' ? 2.5 : 1.2; f += o.corners === 'circle' ? circ(x + 2.5, y + 2.5, 2.5) + circ(x + 2.5, y + 2.5, 1.5) + circ(x + 2.5, y + 2.5, .55) : rr(x, y, 5, 5, [rd, rd, rd, rd]) + rr(x + 1, y + 1, 3, 3, [rd * .6, rd * .6, rd * .6, rd * .6]) + rr(x + 2, y + 2, 1, 1, [.3, .3, .3, .3]); }
  const pad = bg === 'none' ? '#ffffff' : bg;
  const logo = L ? `<path fill="${pad}" d="${rr(l0 + Z - .5, l0 + Z - .5, L + 1, L + 1, [1, 1, 1, 1])}"/><clipPath id="ql"><path d="${rr(l0 + Z, l0 + Z, L, L, [.8, .8, .8, .8])}"/></clipPath><image href="${o.logo}" x="${l0 + Z}" y="${l0 + Z}" width="${L}" height="${L}" preserveAspectRatio="xMidYMid slice" clip-path="url(#ql)"/>` : '';
  const label = o.label ? `<text x="${W / 2}" y="${n + Z + 3.6}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="600" font-size="2.6" fill="${fg === 'grad' ? '#c41e3a' : fg}">${esc(o.label)}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W + labelH}" shape-rendering="geometricPrecision">` +
    `<defs><linearGradient id="qg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2620c"/><stop offset="1" stop-color="#c41e3a"/></linearGradient></defs>` +
    (bg !== 'none' ? `<rect width="${W}" height="${W + labelH}" rx="1.6" fill="${bg}"/>` : '') +
    `<path fill="${paint}" d="${d}"/><path fill="${paint}" fill-rule="evenodd" d="${f}"/>${logo}${label}</svg>`;
}
function qrPng(svg, px = 1024) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'), k = px / img.naturalWidth; c.width = px; c.height = Math.round(img.naturalHeight * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob(b => b ? b.arrayBuffer().then(a => res(new Uint8Array(a))) : rej(new Error('png')), 'image/png'); };
    img.onerror = () => rej(new Error('svg'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
function vQr(root) {
  const o = qrOpts();
  const chips = (k, list) => `<div class="qchips" data-k="${k}">${list.map(([v, l]) => `<button class="${o[k] === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>`;
  $('#barActions').innerHTML = `<button class="icon" id="qdir" title="Kaydedilenler klasörünü aç">${ic('folder', 16)}</button>`;
  $('#qdir').onclick = () => api.send('openDir');
  root.innerHTML = `<div class="qrv"><div class="qprev"></div><div class="qside">
    <div class="qin"><input class="field" id="qtext" placeholder="Bir bağlantı yapıştır veya herhangi bir metin yaz" spellcheck="false"><button class="icon" id="qpaste" title="Panodan yapıştır">${ic('clip', 16)}</button></div>
    <div class="lb">Stil</div>${chips('style', [['dots', 'Nokta'], ['liquid', 'Akışkan'], ['lines', 'Çizgi'], ['rounded', 'Yuvarlak'], ['square', 'Kare']])}
    <div class="lb">Köşeler</div>${chips('corners', [['round', 'Yuvarlak'], ['circle', 'Daire'], ['leaf', 'Yaprak'], ['square', 'Kare']])}
    <div class="lb">Renk</div><div class="qcolors">${QR_COLORS.map(([v, l]) => `<button class="${o.color === v ? 'on' : ''}" data-v="${v}" title="${l}" style="--c:${v === 'grad' ? 'linear-gradient(135deg,#e2620c,#c41e3a)' : v}"></button>`).join('')}</div>
    <div class="lb">Arka plan</div>${chips('bg', [['white', 'Beyaz'], ['cream', 'Krem'], ['night', 'Gece'], ['clear', 'Şeffaf']])}
    <div class="lb">Logo ve etiket</div><div class="qlogo"><button class="btn" id="qlogo"></button><input type="file" accept="image/*" class="hidden-input" id="qfile"><input class="field" id="qlabel" placeholder="Etiket, ör. Ziyaret için okut" maxlength="40"></div>
    <div class="qact"><button class="btn pri" id="qcopy">${ic('copy', 15)}Kopyala</button><button class="btn" id="qpng">${ic('down', 15)}PNG</button><button class="btn" id="qsvg">${ic('down', 15)}SVG</button></div>
  </div></div>`;
  const prev = $('.qprev', root), txt = $('#qtext', root), lab = $('#qlabel', root), lb = $('#qlogo', root);
  txt.value = QR.text; lab.value = o.label || '';
  const persist = () => { S.settings.qr = { style: o.style, corners: o.corners, color: o.color, bg: o.bg, label: o.label }; save('settings'); };
  let svg = '';
  const paintLogoBtn = () => { lb.innerHTML = QR.logo ? `${ic('x', 14)}Logoyu kaldır` : `${ic('image', 14)}Logo ekle`; };
  const render = () => {
    const has = QR.text.trim().length > 0;
    $$('.qact button', root).forEach(b => b.disabled = !has);
    if (!has) { svg = ''; prev.classList.remove('has'); prev.innerHTML = `<div class="qempty">${ic('qr', 26)}<span>Başlamak için bir bağlantı yapıştır</span></div>`; return; }
    try { svg = qrSvg({ ...o, text: QR.text, logo: QR.logo }); prev.classList.add('has'); prev.classList.toggle('dark', o.bg === 'night'); prev.innerHTML = svg; }
    catch { svg = ''; prev.classList.remove('has'); prev.innerHTML = `<div class="qempty">${ic('x', 22)}<span>Metin bir QR kod için çok uzun</span></div>`; $$('.qact button', root).forEach(b => b.disabled = true); }
  };
  let t; txt.oninput = () => { QR.text = txt.value; clearTimeout(t); t = setTimeout(render, 90); };
  lab.oninput = () => { o.label = lab.value.trim(); persist(); clearTimeout(t); t = setTimeout(render, 90); };
  [txt, lab].forEach(i => i.onfocus = () => api.send('focus', true));
  $('#qpaste', root).onclick = async () => { const v = await api.invoke('clip:text'); if (v) { QR.text = txt.value = v.trim(); render(); } else toast('Panoda metin yok'); };
  $$('.qchips', root).forEach(g => $$('button', g).forEach(b => b.onclick = () => { o[g.dataset.k] = b.dataset.v; $$('button', g).forEach(x => x.classList.toggle('on', x === b)); persist(); render(); }));
  $$('.qcolors button', root).forEach(b => b.onclick = () => { o.color = b.dataset.v; $$('.qcolors button', root).forEach(x => x.classList.toggle('on', x === b)); persist(); render(); });
  lb.onclick = () => { if (QR.logo) { QR.logo = null; paintLogoBtn(); render(); } else $('#qfile', root).click(); };
  $('#qfile', root).onchange = e => {
    const file = e.target.files[0]; if (!file) return; const fr = new FileReader();
    fr.onload = () => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'), s = 256, k = Math.min(1, s / Math.max(im.width, im.height)); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); QR.logo = c.toDataURL('image/png'); paintLogoBtn(); render(); }; im.src = fr.result; };
    fr.readAsDataURL(file); e.target.value = '';
  };
  $('#qcopy', root).onclick = async () => { if (!svg) return; try { const ok = await api.invoke('clip:png', await qrPng(svg)); toast(ok ? 'QR kod panoya kopyalandı' : 'Kopyalanamadı'); } catch { toast('Kopyalanamadı'); } };
  $('#qpng', root).onclick = async () => { if (!svg) return; const f = await api.invoke('save:file', { ext: 'png', data: await qrPng(svg), base: 'QR' }); toast('PNG kaydedildi: Resimler\\Adacık'); QR.last = f; };
  $('#qsvg', root).onclick = async () => { if (!svg) return; const f = await api.invoke('save:file', { ext: 'svg', data: '<?xml version="1.0" encoding="UTF-8"?>\n' + svg, base: 'QR' }); toast('SVG kaydedildi: Resimler\\Adacık'); QR.last = f; };
  paintLogoBtn(); render(); setTimeout(() => txt.focus(), 300);
}

/* ---------- translate ---------- */
const LANGS = [['auto', 'Algıla'], ['tr', 'Türkçe'], ['en', 'İngilizce'], ['de', 'Almanca'], ['fr', 'Fransızca'], ['es', 'İspanyolca'], ['it', 'İtalyanca'],
  ['pt', 'Portekizce'], ['nl', 'Felemenkçe'], ['ru', 'Rusça'], ['uk', 'Ukraynaca'], ['pl', 'Lehçe'], ['el', 'Yunanca'], ['bg', 'Bulgarca'], ['ro', 'Romence'],
  ['sv', 'İsveççe'], ['ar', 'Arapça'], ['fa', 'Farsça'], ['az', 'Azerbaycanca'], ['ka', 'Gürcüce'], ['ku', 'Kürtçe'], ['hi', 'Hintçe'],
  ['ja', 'Japonca'], ['ko', 'Korece'], ['zh-CN', 'Çince'], ['id', 'Endonezce']];
const langName = c => (LANGS.find(l => l[0] === c || l[0].split('-')[0] === String(c).split('-')[0]) || [c, c])[1];
const TR = { text: '', out: '', detected: '', via: 'Google Çeviri', hist: [''], hi: 0, seq: 0, busy: false, err: '' };
function vTranslate(root) {
  const cfg = () => ({ from: 'auto', to: 'en', ...(S.settings.tr || {}) });
  const setCfg = c => { S.settings.tr = c; save('settings'); };
  $('#barActions').innerHTML = `<span class="trbadge" title="Çeviri">文A</span>`;
  root.innerHTML = `<div class="trv">
    <div class="trbar"><div class="lsel" id="lsrc"><button data-d="-1" title="Önceki dil">${ic('lt', 14)}</button><span class="lname"></span><button data-d="1" title="Sonraki dil">${ic('gt', 14)}</button></div>
      <button class="icon tswap" id="tswap" title="Dilleri değiştir">${ic('swap', 16)}</button>
      <div class="lsel dst" id="ldst"><button data-d="-1" title="Önceki dil">${ic('lt', 14)}</button><span class="lname"></span><button data-d="1" title="Sonraki dil">${ic('gt', 14)}</button></div></div>
    <div class="trpanes"><div class="tp"><textarea id="tin" maxlength="800" spellcheck="false" placeholder="Çevrilecek metni yaz veya yapıştır"></textarea><small id="tcount"></small></div>
      <div class="tp tpo"><div id="tout"></div><button class="btn" id="tcopy">Kopyala</button></div></div>
    <div class="trfoot" id="tfoot"></div>
    <div class="lmenu" id="lmenu" hidden></div></div>`;
  const tin = $('#tin', root), tout = $('#tout', root);
  const paintLangs = () => {
    const c = cfg();
    $('#lsrc .lname', root).innerHTML = c.from === 'auto' ? `<span class="dimw">Algıla</span>${TR.detected ? ' · ' + esc(langName(TR.detected)) : ''}` : esc(langName(c.from));
    $('#ldst .lname', root).textContent = langName(c.to);
  };
  const paintOut = () => {
    tout.classList.toggle('busy', TR.busy); tout.classList.toggle('err', !!TR.err);
    tout.textContent = TR.err || TR.out || (TR.text.trim() ? '' : 'Çeviri burada görünür');
    tout.classList.toggle('ph', !TR.err && !TR.out);
    $('#tcopy', root).style.visibility = TR.out && !TR.err ? '' : 'hidden';
    $('#tcount', root).textContent = TR.text.length + '/800';
    $('#tfoot', root).textContent = `${TR.via} ile çevrildi · Ctrl+Z geri al · Ctrl+Shift+Z yinele`;
  };
  let tt;
  const run = async () => {
    const c = cfg(), text = TR.text, my = ++TR.seq;
    if (!text.trim()) { TR.out = ''; TR.err = ''; TR.detected = ''; TR.busy = false; paintOut(); paintLangs(); return; }
    TR.busy = true; paintOut();
    const r = await api.invoke('translate', { text, from: c.from, to: c.to });
    if (my !== TR.seq || ui.view !== 'translate') return;   // a newer request superseded this one
    TR.busy = false;
    if (r.error) { TR.err = r.error; TR.out = ''; } else { TR.err = ''; TR.out = r.text; TR.detected = c.from === 'auto' ? r.detected : ''; TR.via = r.via || TR.via; }
    paintOut(); paintLangs();
  };
  const schedule = (ms = 450) => { clearTimeout(tt); tt = setTimeout(run, ms); };
  // own undo history so swaps and pastes can be undone too
  let ht;
  const remember = () => { if (TR.hist[TR.hi] === TR.text) return; TR.hist = TR.hist.slice(0, TR.hi + 1); TR.hist.push(TR.text); if (TR.hist.length > 100) TR.hist.shift(); TR.hi = TR.hist.length - 1; };
  const setText = v => { TR.text = v; tin.value = v; paintOut(); schedule(150); };
  tin.value = TR.text; tin.onfocus = () => api.send('focus', true);
  tin.oninput = () => { TR.text = tin.value; paintOut(); schedule(); clearTimeout(ht); ht = setTimeout(remember, 600); };
  tin.onkeydown = e => {
    if (!e.ctrlKey) return; const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); remember(); if (TR.hi > 0) { TR.hi--; setText(TR.hist[TR.hi]); } }
    else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); if (TR.hi < TR.hist.length - 1) { TR.hi++; setText(TR.hist[TR.hi]); } }
  };
  const cycle = (id, dir) => {
    const c = cfg(), list = LANGS.filter(l => id === 'lsrc' || l[0] !== 'auto').map(l => l[0]), key2 = id === 'lsrc' ? 'from' : 'to';
    let i = list.indexOf(c[key2]) + dir; i = (i + list.length) % list.length;
    if (list[i] === (key2 === 'from' ? c.to : c.from)) i = (i + dir + list.length) % list.length;   // never the same on both sides
    c[key2] = list[i]; setCfg(c); TR.detected = ''; paintLangs(); schedule(100);
  };
  $$('.lsel button', root).forEach(b => b.onclick = e => { e.stopPropagation(); cycle(b.closest('.lsel').id, +b.dataset.d); });
  // clicking a language name opens the full list
  const menu = $('#lmenu', root);
  $$('.lsel .lname', root).forEach(n => n.onclick = e => {
    e.stopPropagation(); const id = n.closest('.lsel').id, k2 = id === 'lsrc' ? 'from' : 'to', c = cfg();
    if (!menu.hidden && menu.dataset.for === id) { menu.hidden = true; return; }
    menu.dataset.for = id; menu.className = 'lmenu ' + (id === 'lsrc' ? 'left' : 'right');
    menu.innerHTML = LANGS.filter(l => k2 === 'from' || l[0] !== 'auto').map(([code, name]) => `<button data-c="${code}" class="${c[k2] === code ? 'on' : ''}">${name}</button>`).join('');
    menu.hidden = false;
    $$('button', menu).forEach(b => b.onclick = () => { const cc = cfg(); cc[k2] = b.dataset.c; if (k2 === 'to' && cc.from === cc.to) cc.from = 'auto'; if (k2 === 'from' && cc.from === cc.to) cc.to = cc.from === 'en' ? 'tr' : 'en'; setCfg(cc); TR.detected = ''; menu.hidden = true; paintLangs(); schedule(100); });
  });
  root.addEventListener('click', e => { if (!e.target.closest('#lmenu')) menu.hidden = true; });
  $('#tswap', root).onclick = () => {
    const c = cfg(), newTo = c.from === 'auto' ? (TR.detected || (c.to === 'tr' ? 'en' : 'tr')) : c.from;
    remember(); const prevOut = TR.out;
    setCfg({ from: c.to, to: newTo }); TR.detected = '';
    if (prevOut) { TR.text = prevOut; tin.value = prevOut; remember(); }
    paintLangs(); paintOut(); schedule(50);
  };
  $('#tcopy', root).onclick = () => { if (!TR.out) return; api.send('clips:write', TR.out); const b = $('#tcopy', root); b.textContent = 'Kopyalandı'; setTimeout(() => { if (b.isConnected) b.textContent = 'Kopyala'; }, 1200); };
  paintLangs(); paintOut(); if (TR.text && !TR.out) schedule(50);
  setTimeout(() => tin.focus(), 300);
}

/* ---------- currency converter ---------- */
// Type "100 usd to try", "50 euro kaç tl", "100usd to idr=" — or plain maths like "1.500.000 × 12%".
const FX_ALIAS = { dolar: 'USD', '$': 'USD', usd: 'USD', euro: 'EUR', avro: 'EUR', eur: 'EUR', '€': 'EUR', tl: 'TRY', lira: 'TRY', try: 'TRY', '₺': 'TRY',
  sterlin: 'GBP', pound: 'GBP', gbp: 'GBP', '£': 'GBP', yen: 'JPY', jpy: 'JPY', '¥': 'JPY', ruble: 'RUB', rub: 'RUB', frank: 'CHF', chf: 'CHF', yuan: 'CNY', cny: 'CNY',
  rupiah: 'IDR', idr: 'IDR', riyal: 'SAR', sar: 'SAR', dirhem: 'AED', aed: 'AED', manat: 'AZN', azn: 'AZN', lari: 'GEL', gel: 'GEL', won: 'KRW', krw: 'KRW', rupi: 'INR', inr: 'INR' };
const FX = { rates: null, updated: 0, stale: false, err: '', last: null, q: '' };
function fxCode(t) { t = String(t || '').trim().toLowerCase(); if (FX_ALIAS[t]) return FX_ALIAS[t]; const u = t.toUpperCase(); return FX.rates && FX.rates[u] ? u : null; }
// Turkish number style: 1.500.000,25 → 1500000.25 (a lone comma is a decimal point)
const trNum = s => s.replace(/\d{1,3}(?:\.\d{3})+(?:,\d+)?/g, x => x.replace(/\./g, '').replace(',', '.')).replace(/(\d),(\d)/g, '$1.$2');
function fxMoney(v, cur) {
  const big = Math.abs(v) >= 1000;
  try { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol', minimumFractionDigits: big ? 0 : 2, maximumFractionDigits: big ? 0 : (Math.abs(v) < 1 ? 4 : 2) }).format(v); }
  catch { return nfmt(v) + ' ' + cur; }
}
function fxEval(src) {
  const q = src.trim().replace(/=+\s*$/, '').trim(); if (!q) return null;
  const sym = '[$€₺£¥]';
  const m = q.match(new RegExp(`^(.+?)\\s*(${sym}|[a-zA-ZçğıöşüÇĞİÖŞÜ]{2,})\\s*(?:to|in|=|->|→|kaç|ne kadar|karşılığı)?\\s*(${sym}|[a-zA-ZçğıöşüÇĞİÖŞÜ]{2,})?\\s*(?:eder|yapar)?\\??$`, 'i'));
  if (m && fxCode(m[2])) {
    if (!FX.rates) return { pending: true };
    const from = fxCode(m[2]), to = m[3] ? fxCode(m[3]) : (from === 'TRY' ? 'USD' : 'TRY');
    if (!to) return { error: 'Bilinmeyen para birimi: ' + m[3] };
    let amt = null; try { amt = calcEval(trNum(m[1]), true, 0); } catch {} if (!amt) return null;
    const v = amt.v * FX.rates[to] / FX.rates[from];
    return { text: fxMoney(v, to), raw: v, fx: true, from, to, rate: FX.rates[to] / FX.rates[from] };
  }
  let r = null; try { r = calcEval(trNum(q), true, 0); } catch { return null; }
  return r ? { text: nfmt(r.v) + (r.unit ? ' ' + r.unit : ''), raw: r.v } : null;
}
function vFx(root) {
  const POP = [['USD', 'TRY'], ['EUR', 'TRY'], ['GBP', 'TRY'], ['EUR', 'USD'], ['TRY', 'USD']];
  root.innerHTML = `<div class="fxv">
    <div class="fxbar"><input id="fxin" spellcheck="false" placeholder="100 usd to try"><span class="fxeq">=</span><b id="fxout"></b><button class="icon fxcopy" id="fxcopy" title="Sonucu kopyala">${ic('copy', 15)}</button><small id="fxsrc"></small></div>
    <div class="fxpop" id="fxpop"></div></div>`;
  const inp = $('#fxin', root), out = $('#fxout', root), src = $('#fxsrc', root), eq = $('.fxeq', root);
  const caption = () => {
    if (FX.err) return FX.err;
    if (!FX.updated) return 'Kurlar yükleniyor…';
    const d = new Date(FX.updated), today = key(d) === key(new Date());
    return 'ExchangeRate-API · ' + (today ? 'bugün' : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })) + (FX.stale ? ' (çevrimdışı)' : '');
  };
  const paint = () => {
    const r = fxEval(inp.value); FX.last = r && !r.error && !r.pending ? r : null;
    out.textContent = !r ? '' : r.error ? r.error : r.pending ? '…' : r.text;
    out.classList.toggle('err', !!(r && r.error)); eq.style.opacity = FX.last ? 1 : 0;
    $('#fxcopy', root).style.visibility = FX.last ? '' : 'hidden';
    src.textContent = r && r.fx ? caption() : !inp.value.trim() ? caption() : '';
    src.title = r && r.fx ? `1 ${r.from} = ${nfmt(r.rate)} ${r.to}` : '';
  };
  const pop = () => {
    $('#fxpop', root).innerHTML = FX.rates ? POP.map(([a, b]) => `<button data-q="1 ${a.toLowerCase()} to ${b.toLowerCase()}"><span>1 ${a}</span><b>${fxMoney(FX.rates[b] / FX.rates[a], b)}</b></button>`).join('') : '';
    $$('#fxpop button', root).forEach(b => b.onclick = () => { inp.value = b.dataset.q; FX.q = inp.value; paint(); inp.focus(); });
  };
  inp.value = FX.q; inp.oninput = () => { FX.q = inp.value; paint(); }; inp.onfocus = () => api.send('focus', true);
  inp.onkeydown = e => { if (e.key === 'Enter' && FX.last) { api.send('clips:write', String(+FX.last.raw.toFixed(2))); toast('Kopyalandı'); } };
  $('#fxcopy', root).onclick = () => { if (!FX.last) return; api.send('clips:write', FX.last.text); toast('Kopyalandı'); };
  paint(); pop(); setTimeout(() => inp.focus(), 300);
  api.invoke('fx:rates').then(r => {
    if (r.error) { FX.err = r.error; } else { FX.err = ''; FX.rates = r.rates; FX.updated = r.updated; FX.stale = !!r.stale; }
    if (ui.view === 'fx') { paint(); pop(); }
  });
}

/* ---------- phone link ---------- */
let PH = null;
let phSel = '';   // the phone the panel is showing
api.on('phone:state', st => {
  const had = new Set(((PH && PH.devices) || []).map(d => d.id)), fresh = PH ? st.devices.find(d => !had.has(d.id)) : null;
  PH = st;
  if (fresh) { phSel = fresh.id; phView = ''; if (ui.view === 'phone') toast(fresh.name + ' bağlandı'); }
  if (ui.view === 'phone') paintPhone();
});
api.on('phone:incoming', d => {
  const text = d.type === 'file' ? d.name + ' alındı · ' + bytes(d.size) : d.text;
  if (ui.open && ui.view === 'phone') return;
  notify({ app: d.from || 'Telefon', title: d.type === 'file' ? 'Dosya alındı' : 'Yeni mesaj', body: text, icon: '', to: 'phone' });
});
const phAgo = t => { if (!t) return ''; const s = (Date.now() - t) / 1000; return s < 60 ? 'az önce' : s < 3600 ? Math.floor(s / 60) + ' dk önce' : s < 86400 ? Math.floor(s / 3600) + ' sa önce' : new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }); };
let phView = '';   // '' = automatic, 'qr' = show the pairing code
function vPhone(root) {
  root.innerHTML = '<div class="phv"></div>';
  api.invoke('phone:state').then(st => { PH = st; paintPhone(); });
  every(() => { const d = phDev(); if (d && !d.online) { const el = $('.pstat span'); if (el) el.textContent = 'Uzakta · ' + phAgo(d.lastSeen); } }, 30000);
}
const phDev = () => { const l = (PH && PH.devices) || []; return l.find(d => d.id === phSel) || l[0] || null; };
function paintPhone() {
  const box = $('.phv'); if (!box || !PH) return;
  const st = PH;
  $('#barActions').innerHTML = st.paired ? `<button class="icon" id="pdir" title="Gelen dosyalar klasörü">${ic('folder', 16)}</button>` : '';
  const pd = $('#pdir'); if (pd) pd.onclick = () => api.send('phone:dir');
  if (!st.paired && !st.running) {   // ---- not connected yet ----
    phView = '';
    box.innerHTML = `<div class="pidle"><button class="pconnect" id="pgo">${ic('qr', 30)}<span>Bağlan</span></button>
      <b>iPhone veya Android telefonunu bağla</b><p>Telefonun kamerasıyla bir QR kodu okut. Uygulama ya da hesap gerekmez; bağlantı Wi-Fi ağında kalır.</p>
      <div class="pchecks"><span class="${st.ip ? 'ok' : 'bad'}">${ic(st.ip ? 'check' : 'x', 12)}Ağ ${st.ip ? '· ' + st.ip : 'bulunamadı'}</span><span class="ok">${ic('check', 12)}Dosya gönderme</span><span class="ok">${ic('check', 12)}Dosya alma</span><span class="ok">${ic('check', 12)}Mesaj ve bağlantılar</span></div></div>`;
    $('#pgo').onclick = async () => { const r = await api.invoke('phone:start'); if (r && r.error) return toast(r.error); PH = r; phView = 'qr'; paintPhone(); };
    return;
  }
  if (!st.paired || phView === 'qr') {   // ---- pairing QR ----
    box.innerHTML = `<div class="pqr"><div class="qcard">${qrSvg({ style: 'square', corners: 'square', color: '#111111', bg: 'white', label: '', text: st.url, logo: null })}</div>
      <b>Telefonunun kamerasıyla okut</b><p>iPhone: Kamera uygulamasını aç. Android: Kamera ya da Google Lens. Çıkan bağlantıya dokun, telefon kendiliğinden bağlanır.</p>
      <small>Telefon aynı Wi-Fi ağında olmalı · ${esc(st.url.split('?')[0])} · Windows güvenlik duvarı sorarsa yalnızca “Özel ağlar”a izin ver</small>
      <div class="pqbtns"><button class="btn" id="pcancel">${st.paired ? 'Geri' : 'İptal'}</button><button class="btn" id="pcopy">${ic('link', 14)}Bağlantıyı kopyala</button></div></div>`;
    $('#pcancel').onclick = () => { if (st.paired) { phView = ''; paintPhone(); } else api.send('phone:stop'); };
    $('#pcopy').onclick = () => { api.send('clips:write', st.url); toast('Bağlantı kopyalandı'); };
    return;
  }
  // ---- connected: one phone at a time, each with its own files and messages ----
  const dv = phDev(); phSel = dv.id;
  const items = st.items.filter(i => i.dev === dv.id).map(i => {
    const isIn = i.dir === 'in', meta = (isIn ? 'Telefondan' : 'Telefona') + (i.type === 'file' ? ' · ' + bytes(i.size) : '') + ' · ' + phAgo(i.at);
    const acts = i.type === 'file'
      ? (isIn ? `<button class="btn sm" data-open="${i.id}">Aç</button><button class="icon" data-rev="${i.id}" title="Klasörde göster">${ic('folder', 14)}</button>` : `<span class="pwait">Telefonda indirilebilir</span>`)
      : `<button class="icon" data-copy="${i.id}" title="Kopyala">${ic('copy', 14)}</button>`;
    return `<div class="pit ${isIn ? 'pin-in' : 'pin-out'}"><span class="pic">${ic(i.type === 'file' ? (isIn ? 'down' : 'upload') : 'send', 15)}</span>
      <div class="ptx">${i.type === 'file' ? `<b>${esc(i.name)}</b>` : `<span class="pmsg">${esc(i.text)}</span>`}<small>${meta}</small></div>${acts}<button class="icon px" data-rm="${i.id}" title="Listeden kaldır">${ic('x', 12)}</button></div>`;
  }).join('');
  const chips = st.devices.length > 1 ? `<div class="pdevs">${st.devices.map(d => `<button class="pchip ${d.id === dv.id ? 'sel' : ''}" data-dev="${d.id}"><i class="${d.online ? 'on' : ''}"></i>${esc(d.name)}</button>`).join('')}</div>` : '';
  box.innerHTML = `<div class="pcon">
    <div class="pside">${chips}<div class="pdev"><span class="pnotch"></span>${ic(dv.kind === 'iphone' ? 'apple' : 'android', 28)}</div>
      <b class="pname">${esc(dv.name)}</b><div class="pstat ${dv.online ? 'on' : ''}"><i></i><span>${dv.online ? 'Bağlı' : 'Uzakta · ' + phAgo(dv.lastSeen)}</span></div>
      <p>Telefonda Adacık sayfasını aç (ya da ana ekrana eklediğin simgeyi). Kendiliğinden yeniden bağlanır.</p>
      <div class="pside-btns"><button class="btn" id="pshowqr">${ic('qr', 14)}Telefon ekle</button><button class="btn warn" id="punpair">Bu telefonu kaldır</button></div></div>
    <div class="pmain"><div class="pdrop" id="pdrop"><span class="pup">${ic('upload', 20)}</span><div class="col"><b>Dosyaları buraya bırak</b><small>${esc(dv.name)} üzerindeki Adacık sayfasından indirilebilir</small></div>
        <button class="btn" id="ppick">${ic('doc', 14)}Dosya seç</button><button class="btn" id="pclip">${ic('clip', 14)}Panoyu gönder</button></div>
      <div class="pmsgrow"><input class="field" id="pmsg" placeholder="${esc(dv.name)} cihazına mesaj veya bağlantı yaz"><button class="btn pri" id="psend">${ic('send', 14)}Gönder</button></div>
      <div class="plist">${items || '<div class="pempty">Dosyalar ve mesajlar burada görünür. Telefondan gelen dosyalar İndirilenler\\Adacık klasörüne kaydedilir.</div>'}</div></div></div>`;
  $$('[data-dev]', box).forEach(b => b.onclick = () => { phSel = b.dataset.dev; paintPhone(); });
  const send = async () => { const i = $('#pmsg'); if (await api.invoke('phone:sendText', i.value, dv.id)) { i.value = ''; toast(dv.name + ' cihazına gönderildi'); } };
  $('#psend').onclick = send; $('#pmsg').onkeydown = e => { if (e.key === 'Enter') send(); }; $('#pmsg').onfocus = () => api.send('focus', true);
  $('#ppick').onclick = async () => { const n = await api.invoke('phone:browse', dv.id); if (n) toast(n + ' dosya telefona hazır'); };
  $('#pclip').onclick = async () => { const t = await api.invoke('clip:text'); if (t && await api.invoke('phone:sendText', t, dv.id)) toast('Pano telefona gönderildi'); else toast('Panoda metin yok'); };
  $('#pshowqr').onclick = () => { phView = 'qr'; paintPhone(); };
  $('#punpair').onclick = () => { if ($('#punpair').dataset.sure) { api.send('phone:unpair', dv.id); phSel = ''; toast(dv.name + ' kaldırıldı'); } else { $('#punpair').dataset.sure = 1; $('#punpair').textContent = 'Emin misin? Tekrar tıkla'; } };
  const dz = $('#pdrop');
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over');
  $('.pmain').ondragover = e => e.preventDefault();
  $('.pmain').ondrop = async e => { e.preventDefault(); e.stopPropagation(); dz.classList.remove('over'); const paths = [...e.dataTransfer.files].map(f => api.pathOf(f)).filter(Boolean); const n = await api.invoke('phone:sendFiles', paths, dv.id); if (n) toast(n + ' dosya telefona hazır'); };
  $$('[data-open]', box).forEach(b => b.onclick = () => api.send('phone:open', b.dataset.open));
  $$('[data-rev]', box).forEach(b => b.onclick = () => api.send('phone:reveal', b.dataset.rev));
  $$('[data-rm]', box).forEach(b => b.onclick = () => api.send('phone:remove', b.dataset.rm));
  $$('[data-copy]', box).forEach(b => b.onclick = () => { const it = st.items.find(x => x.id === b.dataset.copy); if (it) { api.send('clips:write', it.text); toast('Kopyalandı'); } });
}

/* ---------- notifications ---------- */
let ntFocus = null, ntApp = '';
const ntAsked = new Set();
const ntUnread = () => (S.notifs || []).filter(n => n.at > (S.notifSeen || 0)).length;
const ntIcon = (n, s = 34) => { const i = ntIconOf(n); return `<span class="nic" style="width:${s}px;height:${s}px">${i ? `<img src="data:image/png;base64,${i}" alt="">` : esc((n.app.trim()[0] || '?').toLocaleUpperCase('tr-TR'))}</span>`; };
const ntTime = t => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
function ntDay(t) {
  const d = new Date(t), today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
  return diff === 0 ? 'Bugün' : diff === 1 ? 'Dün' : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
}
function tNotifs(el, sz) {
  el.classList.add('t-nt'); el.dataset.sz = sz; el.onclick = () => go('notifs');
  const n = ntUnread(), last = (S.notifs || [])[0], badge = n ? `<span class="nbadge">${n > 99 ? '99+' : n}</span>` : '';
  if (sz === 'wide') { el.classList.add('t-row'); el.innerHTML = `<span class="nbell">${ic('bell', 20)}${badge}</span><div class="col"><b>Bildirimler</b><small>${last ? esc(last.app + ' · ' + (last.title || last.body)) : 'Bildirim yok'}</small></div>`; }
  else { el.title = 'Bildirimler' + (n ? ' · ' + n + ' yeni' : ''); el.innerHTML = `<span class="nbell">${ic('bell', 20)}${badge}</span>`; }
}
function vNotifs(root) {
  root.innerHTML = '<div class="ntv"><div class="ntapps"></div><div class="ntlist"></div></div>';
  paintNotifs();
  S.notifSeen = Date.now(); save('notifSeen');
  every(() => $$('.ntlist .ntw').forEach(e => { const n = S.notifs.find(x => x.id === e.dataset.id); if (n) e.textContent = ntAgo(n.at); }), 30000);
}
const ntAgo = t => { const s = (Date.now() - t) / 1000; return s < 60 ? 'şimdi' : s < 3600 ? Math.floor(s / 60) + ' dk' : ntTime(t); };
function paintNotifs() {
  const box = $('.ntv'); if (!box) return;
  const all = S.notifs || [];
  $('#barActions').innerHTML = all.length ? `<button class="icon" id="ntclear" title="Tümünü temizle">${ic('trash', 16)}</button>` : '';
  const cb = $('#ntclear');
  if (cb) cb.onclick = () => { if (!cb.dataset.sure) { cb.dataset.sure = 1; cb.classList.add('sure'); cb.title = 'Emin misin? Tekrar tıkla'; toast('Silmek için tekrar tıkla'); return; } S.notifs = ntApp ? all.filter(n => n.app !== ntApp) : []; ntApp = ''; save('notifs'); paintNotifs(); };
  // apps: who sent what, newest first
  const apps = []; all.forEach(n => { let a = apps.find(x => x.app === n.app); if (!a) apps.push(a = { app: n.app, c: 0, n }); a.c++; });
  if (ntApp && !apps.some(a => a.app === ntApp)) ntApp = '';
  $('.ntapps', box).innerHTML = apps.length > 1 ? `<button class="ntchip ${ntApp ? '' : 'sel'}" data-app="">Tümü<i>${all.length}</i></button>` + apps.map(a => `<button class="ntchip ${ntApp === a.app ? 'sel' : ''}" data-app="${esc(a.app)}">${ntIcon(a.n, 16)}${esc(a.app)}<i>${a.c}</i></button>`).join('') : '';
  $('.ntapps', box).style.display = apps.length > 1 ? '' : 'none';
  $$('.ntchip', box).forEach(b => b.onclick = () => { ntApp = b.dataset.app; paintNotifs(); });
  // older entries whose app icon isn't fetched yet
  const miss = [...new Set(all.filter(n => n.aid && !S.appIcons[n.aid] && !ntAsked.has(n.aid)).map(n => n.aid))];
  if (miss.length) { miss.forEach(a => ntAsked.add(a)); Promise.all(miss.map(a => api.invoke('notifs:icon', a).then(b => { if (b) S.appIcons[a] = b; return b; }))).then(r => { if (r.some(Boolean)) { save('appIcons'); paintNotifs(); } }); }
  const list = all.filter(n => !ntApp || n.app === ntApp);
  let html = '', day = '';
  for (const n of list) {
    const d = ntDay(n.at); if (d !== day) { day = d; html += `<div class="ntday">${esc(d)}</div>`; }
    const open = n.to ? `<button class="btn sm" data-go="${n.to}">Aç</button>` : n.aid ? `<button class="btn sm" data-aid="${n.id}">Uygulamayı aç</button>` : '';
    html += `<div class="ntc ${n.at > (S.notifSeen || 0) ? 'new' : ''} ${ntFocus === n.id ? 'focus' : ''}" data-id="${n.id}">${ntIcon(n)}
      <div class="ntx"><div class="nth"><span>${esc(n.app)}</span><span class="ntw" data-id="${n.id}">${ntAgo(n.at)}</span></div>
      ${n.title ? `<b>${esc(n.title)}</b>` : ''}${n.body ? `<p>${esc(n.body)}</p>` : ''}</div>
      <div class="nta">${open}<button class="icon" data-copy="${n.id}" title="Kopyala">${ic('copy', 14)}</button><button class="icon" data-rm="${n.id}" title="Kaldır">${ic('x', 12)}</button></div></div>`;
  }
  const L = $('.ntlist', box);
  L.innerHTML = html || `<div class="ntempty">${ic('bell', 28)}<b>Bildirim yok</b><small>${S.settings.notifs === false ? 'Windows bildirimleri kapalı · Ayarlar’dan açabilirsin' : 'Gelen bildirimler burada saklanır'}</small></div>`;
  $$('.ntc', L).forEach(c => c.onclick = e => { if (!e.target.closest('button')) c.classList.toggle('exp'); });
  $$('[data-rm]', L).forEach(b => b.onclick = () => { const c = b.closest('.ntc'); c.classList.add('gone'); setTimeout(() => { S.notifs = S.notifs.filter(n => n.id !== b.dataset.rm); save('notifs'); paintNotifs(); }, 200); });
  $$('[data-copy]', L).forEach(b => b.onclick = () => { const n = S.notifs.find(x => x.id === b.dataset.copy); api.send('clips:write', [n.title, n.body].filter(Boolean).join('\n')); toast('Kopyalandı'); });
  $$('[data-go]', L).forEach(b => b.onclick = () => go(b.dataset.go));
  $$('[data-aid]', L).forEach(b => b.onclick = async () => { const n = S.notifs.find(x => x.id === b.dataset.aid); if (!(await api.invoke('notifs:openApp', n.aid))) toast(n.app + ' açılamadı'); });
  if (ntFocus) { const f = $(`.ntc[data-id="${ntFocus}"]`, L); if (f) { f.classList.add('exp'); requestAnimationFrame(() => { L.scrollTop += f.getBoundingClientRect().top - L.getBoundingClientRect().top - (L.clientHeight - f.offsetHeight) / 2; }); } ntFocus = null; }   // (scrollIntoView would also shift the panel itself)
}

/* ---------- text tools ---------- */
function vText(root) {
  root.innerHTML = `<div class="out" id="tin">${esc((textClips()[0] || {}).text || 'Önce bir metin kopyala.')}</div><div class="tt">${['BÜYÜK HARF', 'küçük harf', 'Baş Harfler', 'Satırları kırp', 'Satırları sırala', 'Ters çevir', 'Tekrarları sil', 'Say'].map((n, i) => `<button class="btn" data-t="${i}">${n}</button>`).join('')}</div><div class="out" id="tout" style="color:var(--dim)">Sonuç burada görünür. Kopyalamak için tıkla.</div>`;
  const src = () => (textClips()[0] || {}).text || '';
  const F = [s => s.toLocaleUpperCase('tr-TR'), s => s.toLocaleLowerCase('tr-TR'), s => s.toLocaleLowerCase('tr-TR').replace(/(^|\s)\p{L}/gu, c => c.toLocaleUpperCase('tr-TR')), s => s.split('\n').map(l => l.trim()).join('\n'), s => s.split('\n').sort((a, b) => a.localeCompare(b, 'tr')).join('\n'), s => [...s].reverse().join(''), s => [...new Set(s.split('\n'))].join('\n'), s => `${s.length} karakter\n${(s.match(/\S+/g) || []).length} kelime\n${s.split('\n').length} satır`];
  $$('.btn', root).forEach(b => b.onclick = () => { const o = $('#tout', root); o.textContent = F[+b.dataset.t](src()); o.style.color = ''; o.dataset.ok = 1; });
  $('#tout', root).onclick = e => { if (e.currentTarget.dataset.ok) { api.send('clips:write', e.currentTarget.textContent); toast('Kopyalandı'); } };
}

/* ---------- shelf ---------- */
function vShelf(root) {
  root.innerHTML = `<div class="drop" id="dz"></div>`;
  const dz = $('#dz', root);
  const draw = () => {
    dz.innerHTML = S.shelf.map((f, i) => `<div class="file" draggable="true" data-i="${i}"><span class="x icon" style="width:20px;height:20px" data-x="${i}" title="Raftan kaldır">${ic('x', 11)}</span><span class="sh icon" style="width:20px;height:20px" data-sh="${i}" title="Telefona gönder">${ic('phone', 12)}</span>${ic('doc', 30)}<div title="${esc(f.path)}">${esc(f.name)}</div></div>`).join('') || '<div class="empty" style="margin:auto">Dosyaları el altında tutmak için buraya bırak</div>';
    $$('.file', dz).forEach(el => { el.ondblclick = () => api.send('open', S.shelf[+el.dataset.i].path); el.ondragstart = e => { e.preventDefault(); api.send('drag', S.shelf[+el.dataset.i].path); }; });
    $$('[data-x]', dz).forEach(x => x.onclick = e => { e.stopPropagation(); S.shelf.splice(+x.dataset.x, 1); save('shelf'); draw(); });
    $$('[data-sh]', dz).forEach(x => x.onclick = e => { e.stopPropagation(); startShare(S.shelf[+x.dataset.sh]); });
  };
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over');
  dz.ondrop = e => { e.preventDefault(); e.stopPropagation(); dz.classList.remove('over'); addShelfFiles(e.dataTransfer.files); };
  draw(); if (SHARE.url) paintShare();
}
// Sharing keeps running when the panel closes (you'll be looking at your phone) until stopped or 10 minutes pass.
const SHARE = { url: '', name: '', size: 0, hits: 0 };
async function startShare(f) {
  if (!f) return;
  const r = await api.invoke('share:start', f.path);
  if (r.error) return toast(r.error);
  Object.assign(SHARE, { url: r.url, name: r.name, size: r.size, hits: 0 }); paintShare();
}
function stopShare() { api.send('share:stop'); SHARE.url = ''; const m = $('.smodal'); if (m) m.remove(); }
function paintShare() {
  if (ui.view !== 'shelf' || !SHARE.url) return;
  let m = $('.smodal'); if (!m) { m = document.createElement('div'); m.className = 'smodal'; view.appendChild(m); }
  m.innerHTML = `<div class="sq">${qrSvg({ style: 'rounded', corners: 'round', color: '#111111', bg: 'white', label: '', text: SHARE.url, logo: null })}</div>
    <div class="si"><b>Telefona gönder</b><span class="sn">${esc(SHARE.name)} · ${bytes(SHARE.size)}</span>
      <p>Telefon aynı Wi-Fi ağındayken kamerayla kodu okut, dosya iner. Bağlantı 10 dakika açık kalır.</p>
      <small class="shits">${SHARE.hits ? SHARE.hits + ' kez indirildi' : 'Henüz indirilmedi'}</small>
      <small class="sfw">Windows güvenlik duvarı sorarsa yalnızca “Özel ağlar”a izin ver.</small>
      <div class="row"><button class="btn" id="scopy">${ic('copy', 14)}Bağlantıyı kopyala</button><button class="btn pri" id="sstop">Durdur</button></div></div>`;
  $('#sstop', m).onclick = stopShare;
  $('#scopy', m).onclick = () => { api.send('clips:write', SHARE.url); toast('Bağlantı kopyalandı'); };
}
api.on('share:hit', n => { SHARE.hits = n; const el = $('.shits'); if (el) el.textContent = n + ' kez indirildi'; });
api.on('share:stopped', () => { SHARE.url = ''; const m = $('.smodal'); if (m) m.remove(); toast('Paylaşım süresi doldu'); });

/* ---------- settings ---------- */
function vSettings(root) {
  const st = S.settings;
  const seg = (k, opts, cls = '') => `<div class="seg ${cls}" data-seg="${k}">${opts.map(([v, l]) => `<button data-v="${v}" class="${(st[k] ?? opts[0][0]) === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const sw = (k, on) => `<div class="sw ${on ? 'on' : ''}" data-sw="${k}" role="switch"></div>`;
  api.invoke('version').then(v => { const el = $('#barActions'); if (el && ui.view === 'settings') el.innerHTML = `<span class="ver">Adacık ${esc(v)}</span>`; });
  root.innerHTML = `<div class="set2">
    <div class="sbox"><div class="lb">Görünüm</div>
      <div class="sline"><span>Tema</span>${seg('theme', [['auto', 'Otomatik'], ['dark', 'Koyu'], ['light', 'Açık']])}</div>
      <div class="sline"><span>Vurgu rengi</span><div class="seg" data-seg="accentMode"><button data-v="windows" class="${!['custom', 'wallpaper'].includes(st.accentMode) ? 'on' : ''}">Windows</button><button data-v="wallpaper" class="${st.accentMode === 'wallpaper' ? 'on' : ''}" title="Masaüstü arka planının baskın rengi">Duvar kağıdı</button><button data-v="custom" class="${st.accentMode === 'custom' ? 'on' : ''}">Özel</button></div><input type="color" class="hidden-input" id="acc" value="${st.accent || '#f08a24'}"></div>
      <div class="sline"><span>Görünüm şekli</span>${seg('shape', [['notch', 'Çentik'], ['capsule', 'Kapsül']])}</div>
      <div class="sline"><span>Konum</span>${seg('position', [['left', 'Sol'], ['center', 'Orta'], ['right', 'Sağ']])}</div>
      <div class="sline"><span>Üzerine gelince aç</span>${sw('hoverOpen', st.hoverOpen !== false)}</div>
      <div class="sline" title="Açıkken saat ve pil görünür. Kapalıyken imleç üst kenara gelene kadar gizlenir."><span>Her zaman göster</span>${sw('alwaysShow', st.alwaysShow !== false)}</div></div>
    <div class="sbox"><div class="lb">Davranış</div>
      <div class="sline"><span>Her zaman üstte</span>${sw('onTop', st.onTop !== false)}</div>
      <div class="sline"><span>Çalan şarkıyı göster</span>${sw('mini', st.mini !== false)}</div>
      <div class="sline" title="Şarkı adı ve sanatçı lrclib.net'e gönderilir"><span>Senkron şarkı sözleri</span>${sw('lyrics', !!st.lyrics)}</div>
      <div class="sline"><span>Başlangıçta aç</span>${sw('login', !!st.login)}</div>
      <div class="sline" title="Oyun veya video tam ekrandayken adayı gizler"><span>Tam ekranda gizle</span>${sw('hideFullscreen', st.hideFullscreen !== false)}</div>
      <div class="sline" title="Windows bildirimlerini adada gösterir (içerik bilgisayardan çıkmaz)"><span>Bildirimleri göster</span>${sw('notifs', st.notifs !== false)}</div>
      <div class="sline"><span>Ses / parlaklık göstergesi</span>${sw('osd', st.osd !== false)}</div>
      <div class="sline"><span>Zamanlayıcıyı adada göster</span>${sw('timerPill', st.timerPill !== false)}</div></div></div>
    <div class="sbtns"><button class="sbtn" id="se">${ic('tiles', 18)}Kutuları düzenle</button><button class="sbtn" id="sr">${ic('undo', 18)}Düzeni sıfırla</button><button class="sbtn" id="sc">${ic('eraser', 18)}Panoyu temizle</button><button class="sbtn warn" id="sq">${ic('power', 18)}Çıkış</button></div>`;
  $$('[data-seg]', root).forEach(g => $$('button', g).forEach(b => b.onclick = () => {
    const k = g.dataset.seg, v = b.dataset.v;
    if (k === 'accentMode' && v === 'custom') { $('#acc', root).click(); }
    if (k === 'accentMode' && v === 'wallpaper') api.invoke('accent:wall').then(c => { wallAccent = c; applyTheme(); if (!c) toast('Duvar kağıdında belirgin bir renk yok, Windows rengi kullanılıyor'); });
    st[k] = v; $$('button', g).forEach(x => x.classList.toggle('on', x === b)); save('settings'); applyTheme(); closedState();
  }));
  $('#acc', root).oninput = e => { st.accent = e.target.value; st.accentMode = 'custom'; save('settings'); applyTheme(); };
  $$('[data-sw]', root).forEach(s => s.onclick = () => {
    const k = s.dataset.sw, def = k === 'lyrics' || k === 'login' ? false : true, v = !(st[k] ?? def);
    st[k] = v; s.classList.toggle('on', v); save('settings');
    if (k === 'login') api.send('login', v); if (['mini', 'alwaysShow', 'hoverOpen', 'timerPill'].includes(k)) applyClosedSize(); if (k === 'lyrics') fetchLyrics();
  });
  $('#se', root).onclick = () => { ui.edit = true; ui.page = 0; go('grid'); };
  $('#sr', root).onclick = () => { st.order = null; st.pages = null; st.hidden = []; st.sizes = {}; layout(); save('settings'); toast('Düzen sıfırlandı'); };
  $('#sc', root).onclick = () => { api.send('clips:clear'); toast('Pano geçmişi temizlendi'); };
  $('#sq', root).onclick = () => api.send('quit');
}

/* ---------- boot ---------- */
(async () => {
  const st = await api.invoke('store:get');
  S = { ...S, ...st, settings: { ...S.settings, ...(st.settings || {}) } };
  if (!st.settings || !st.settings.accentMode) S.settings.accentMode = 'windows';
  S.notes = S.notes && S.notes.length ? S.notes : [{ id: 1, text: '' }];
  S.calcHist = S.calcHist || [];
  clips = st.clips || [];
  Object.assign(T, S.settings.timer || {}); T.left = T.dur;
  winAccent = await api.invoke('accent:get');
  wallAccent = await api.invoke('accent:wall');
  Object.assign(CAL, await api.invoke('cal:get'));
  applyTheme();
  if (S.settings.awake) api.send('awake', true);
  drawArt($('#miniArt')); applyClosedSize();
})();
