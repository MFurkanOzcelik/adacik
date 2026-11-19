// Calendar sync: Windows calendar store + iCalendar (.ics / webcal) links such as Google's
// "secret address in iCal format" or an Outlook published calendar. Read-only.
'use strict';
const path = require('path');
const { execFile } = require('child_process');

const DAY = 864e5;
const WIN_TZ = { // Outlook writes Windows zone names into TZID
  'Turkey Standard Time': 'Europe/Istanbul', 'GTB Standard Time': 'Europe/Bucharest', 'E. Europe Standard Time': 'Europe/Chisinau',
  'W. Europe Standard Time': 'Europe/Berlin', 'Central Europe Standard Time': 'Europe/Budapest', 'Central European Standard Time': 'Europe/Warsaw',
  'Romance Standard Time': 'Europe/Paris', 'GMT Standard Time': 'Europe/London', 'Greenwich Standard Time': 'Atlantic/Reykjavik',
  'FLE Standard Time': 'Europe/Kiev', 'Russian Standard Time': 'Europe/Moscow', 'Arabian Standard Time': 'Asia/Dubai', 'Arab Standard Time': 'Asia/Riyadh',
  'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago', 'Mountain Standard Time': 'America/Denver',
  'Pacific Standard Time': 'America/Los_Angeles', 'India Standard Time': 'Asia/Kolkata', 'China Standard Time': 'Asia/Shanghai',
  'Tokyo Standard Time': 'Asia/Tokyo', 'AUS Eastern Standard Time': 'Australia/Sydney', UTC: 'UTC', 'Coordinated Universal Time': 'UTC',
};
const zoneOk = tz => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } };
// Wall-clock time in a named zone -> epoch ms.
function zoned(y, mo, d, h, mi, s, tz) {
  tz = zoneOk(tz) ? tz : WIN_TZ[tz]; if (!tz) return new Date(y, mo - 1, d, h, mi, s).getTime();
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const off = t => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(t)).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
  };
  let t = guess - off(guess); t = guess - off(t); return t;
}
function icsDate(val, P = {}) {
  const v = val.trim();
  let m = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m || P.VALUE === 'DATE') { m = m || v.match(/^(\d{4})(\d{2})(\d{2})/); return { t: new Date(+m[1], m[2] - 1, +m[3]).getTime(), allDay: true }; }
  m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/); if (!m) return null;
  const a = m.slice(1, 7).map(Number);
  if (m[7]) return { t: Date.UTC(a[0], a[1] - 1, a[2], a[3], a[4], a[5]), allDay: false };
  if (P.TZID) return { t: zoned(...a, P.TZID), allDay: false };
  return { t: new Date(a[0], a[1] - 1, a[2], a[3], a[4], a[5]).getTime(), allDay: false };
}
function icsDur(v) { const m = v.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/); if (!m) return 0; return (m[1] === '-' ? -1 : 1) * (((+m[2] || 0) * 7 + (+m[3] || 0)) * DAY + (+m[4] || 0) * 36e5 + (+m[5] || 0) * 6e4 + (+m[6] || 0) * 1e3); }
const unesc = s => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

function parseIcs(text) {
  const lines = String(text).replace(/\r?\n[ \t]/g, '').split(/\r?\n/);   // unfold continuation lines
  const evs = []; let cur = null;
  for (const raw of lines) {
    if (raw === 'BEGIN:VEVENT') { cur = { ex: [] }; continue; }
    if (raw === 'END:VEVENT') { if (cur && cur.start) evs.push(cur); cur = null; continue; }
    if (!cur) continue;
    const m = raw.match(/^([A-Za-z-]+)((?:;[^:]*)?):(.*)$/); if (!m) continue;
    const name = m[1].toUpperCase(), P = {};
    m[2].split(';').slice(1).forEach(p => { const i = p.indexOf('='); if (i > 0) P[p.slice(0, i).toUpperCase()] = p.slice(i + 1).replace(/^"|"$/g, ''); });
    const val = m[3];
    if (name === 'SUMMARY') cur.title = unesc(val);
    else if (name === 'LOCATION') cur.loc = unesc(val);
    else if (name === 'UID') cur.uid = val;
    else if (name === 'DTSTART') cur.start = icsDate(val, P);
    else if (name === 'DTEND') cur.end = icsDate(val, P);
    else if (name === 'DURATION') cur.dur = icsDur(val);
    else if (name === 'RRULE') cur.rrule = val;
    else if (name === 'EXDATE') val.split(',').forEach(x => { const d = icsDate(x, P); if (d) cur.ex.push(d.t); });
    else if (name === 'STATUS') cur.status = val.toUpperCase();
    else if (name === 'RECURRENCE-ID') { const d = icsDate(val, P); if (d) cur.recId = d.t; }
  }
  return evs;
}
// Occurrence start times of one VEVENT inside [from, to]. Supports DAILY/WEEKLY(BYDAY)/MONTHLY(by date or BYDAY like 2TU, -1FR)/YEARLY
// with INTERVAL, COUNT, UNTIL and EXDATE.
function occurrences(ev, from, to) {
  const s0 = ev.start.t, len = eventLength(ev), out = [], ex = new Set(ev.ex);
  const keep = t => { if (!ex.has(t) && t + Math.max(len, 1) > from && t <= to) out.push(t); };
  if (!ev.rrule) { keep(s0); return out; }
  const R = Object.fromEntries(ev.rrule.split(';').map(x => { const i = x.indexOf('='); return [x.slice(0, i).toUpperCase(), x.slice(i + 1)]; }));
  const iv = Math.max(1, +(R.INTERVAL || 1)), count = R.COUNT ? +R.COUNT : Infinity;
  const until = R.UNTIL ? (icsDate(R.UNTIL) || { t: Infinity }).t : Infinity;
  const DOW = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const byday = R.BYDAY ? R.BYDAY.split(',').map(x => { const m = x.match(/^([+-]?\d+)?([A-Z]{2})$/); return m ? { n: m[1] ? +m[1] : 0, d: DOW.indexOf(m[2]) } : null; }).filter(Boolean) : null;
  const s = new Date(s0), H = [s.getHours(), s.getMinutes(), s.getSeconds()];
  const at = (y, mo, d) => new Date(y, mo, d, ...H).getTime();
  let n = 0;
  for (let i = 0; i < 5000; i++) {
    let c = [];
    if (R.FREQ === 'DAILY') c = [at(s.getFullYear(), s.getMonth(), s.getDate() + i * iv)];
    else if (R.FREQ === 'WEEKLY') {
      const mon = s.getDate() - ((s.getDay() + 6) % 7) + i * 7 * iv;
      c = (byday ? byday.map(b => b.d) : [s.getDay()]).map(d => at(s.getFullYear(), s.getMonth(), mon + ((d + 6) % 7))).sort((a, b) => a - b);
    } else if (R.FREQ === 'MONTHLY') {
      const y = s.getFullYear(), mo = s.getMonth() + i * iv;
      if (byday) {
        for (const b of byday) {
          const days = []; const last = new Date(y, mo + 1, 0).getDate();
          for (let d = 1; d <= last; d++) if (new Date(y, mo, d).getDay() === b.d) days.push(d);
          const pick = b.n > 0 ? [days[b.n - 1]] : b.n < 0 ? [days[days.length + b.n]] : days;
          pick.filter(Boolean).forEach(d => c.push(at(y, mo, d)));
        }
        c.sort((a, b) => a - b);
      } else { const d = R.BYMONTHDAY ? +R.BYMONTHDAY : s.getDate(), t = new Date(y, mo, d, ...H); if (t.getMonth() === ((mo % 12) + 12) % 12) c = [t.getTime()]; }
    } else if (R.FREQ === 'YEARLY') { const t = new Date(s.getFullYear() + i * iv, s.getMonth(), s.getDate(), ...H); if (t.getMonth() === s.getMonth()) c = [t.getTime()]; }
    else { keep(s0); return out; }
    for (const t of c) { if (t < s0) continue; if (t > until || n >= count) return out; n++; keep(t); }
    if (c.length && c[0] > to) break;
  }
  return out;
}
function eventLength(ev) {
  if (ev.end) return Math.max(0, ev.end.t - ev.start.t);
  if (ev.dur) return ev.dur;
  return ev.start.allDay ? DAY : 0;
}
function expandIcs(text, from, to, src) {
  const evs = parseIcs(text).filter(e => e.status !== 'CANCELLED');
  const moved = new Set(evs.filter(e => e.recId).map(e => e.uid + '|' + e.recId));   // instances edited separately
  const out = [];
  for (const ev of evs) {
    const len = eventLength(ev);
    for (const t of occurrences(ev, from, to)) {
      if (!ev.recId && moved.has(ev.uid + '|' + t)) continue;
      out.push({ id: (ev.uid || ev.title) + '@' + t, title: ev.title || '(Başlıksız)', start: t, end: t + len, allDay: !!ev.start.allDay, loc: ev.loc || '', src });
      if (out.length > 3000) return out;
    }
  }
  return out;
}
function readWindows(dir) {
  return new Promise(res => execFile('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(dir, 'calendar.ps1')],
    { windowsHide: true, encoding: 'utf8', maxBuffer: 2e7, timeout: 45000 }, (e, out) => {
      if (e) return res({ error: 'Windows Takvimi okunamadı' });
      try {
        let a = JSON.parse(String(out).trim() || '[]'); if (!Array.isArray(a)) a = [a];
        res({ events: a.filter(x => x && x.start).map(x => { const t = Date.parse(x.start); return { id: 'win@' + t + '@' + x.title, title: x.title || '(Başlıksız)', start: t, end: t + (x.min || 0) * 6e4, allDay: !!x.allDay, loc: x.loc || '', src: 'windows', cal: x.cal }; }) });
      } catch { res({ error: 'Windows Takvimi okunamadı' }); }
    }));
}
async function fetchIcs(url) {
  url = url.trim().replace(/^webcal:\/\//i, 'https://');
  if (/^[a-z]:\\|^\\\\/i.test(url)) return require('fs').promises.readFile(url, 'utf8');   // a local .ics file
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { 'User-Agent': 'KlonNotch-Calendar/1.0', Accept: 'text/calendar, text/plain, */*' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const text = await r.text(); if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('Bu bağlantı bir takvim (ICS) dosyası döndürmedi');
    return text;
  } finally { clearTimeout(t); }
}
// cfg = { windows: bool, feeds: [{ id, name, url }] }
async function syncAll(cfg, dir) {
  const now = Date.now(), from = now - 31 * DAY, to = now + 120 * DAY;
  const status = {}; let events = [];
  if (cfg.windows !== false) {
    const w = await readWindows(dir);
    status.windows = w.error ? { ok: false, error: w.error } : { ok: true, count: w.events.length };
    if (!w.error) events = events.concat(w.events.filter(e => e.end >= from && e.start <= to));
  }
  await Promise.all((cfg.feeds || []).map(async f => {
    try { const ev = expandIcs(await fetchIcs(f.url), from, to, f.id); status[f.id] = { ok: true, count: ev.length }; events = events.concat(ev); }
    catch (e) { status[f.id] = { ok: false, error: e.name === 'AbortError' ? 'Zaman aşımı' : (e.message || 'Alınamadı') }; }
  }));
  events.sort((a, b) => a.start - b.start);
  return { events, status, last: now };
}
module.exports = { syncAll, expandIcs, parseIcs };
