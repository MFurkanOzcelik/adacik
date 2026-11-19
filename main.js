const { app, BrowserWindow, screen, globalShortcut, ipcMain, clipboard, powerSaveBlocker, shell, desktopCapturer, systemPreferences, dialog, nativeImage, ClipboardItem } = require('electron');
// PowerShell can't read files inside app.asar, so the .ps1 helpers ship unpacked next to it
const RES = __dirname.replace(/app\.asar$/, 'app.asar.unpacked');
// keep settings, notes and clipboard in the same folder for the installed app and `npm start` (the folder kept its first name)
app.setPath('userData', require('path').join(app.getPath('appData'), 'klon-notch'));
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');
const crypto = require('crypto');
const http = require('http');
const calsync = require('./calsync');
const { Phone } = require('./phone');

// Test mode (KLON_TEST=1): side-effect channels are recorded instead of executed.
if (process.env.KLON_TEST) {
  const blocked = ['launch', 'open', 'quit', 'folder', 'login', 'clips:clear', 'clips:write', 'awake', 'openDir'];
  const sent = []; const on = ipcMain.on.bind(ipcMain);
  ipcMain.on = (ch, fn) => on(ch, (e, ...a) => { if (blocked.includes(ch)) { sent.push([ch, ...a]); return; } fn(e, ...a); });
  ipcMain.handle('test:sent', () => sent);
}

const W = 1000, H = 640;
let win, blocker = null;
let rect = { w: 140, h: 8 };
let hovering = false, leaveSince = 0, enterSince = 0;
let hoverEnabled = true;
let position = 'center';
const EDGE = 12;

// ---------- persistent store ----------
const storeFile = () => path.join(app.getPath('userData'), 'state.json');
let store = {};
function loadStore() { try { store = JSON.parse(fs.readFileSync(storeFile(), 'utf8')); } catch { store = {}; } }
let saveT;
function saveStore() { clearTimeout(saveT); saveT = setTimeout(() => { try { fs.writeFileSync(storeFile(), JSON.stringify(store)); } catch {} }, 300); }

// ---------- window ----------
function winPos() {
  const { bounds } = screen.getPrimaryDisplay();
  const dx = +process.env.KLON_DX || 0;
  if (position === 'left') return { x: bounds.x + dx };
  if (position === 'right') return { x: bounds.x + bounds.width - W + dx };
  return { x: Math.round(bounds.x + bounds.width / 2 - W / 2) + dx };
}
function shellCenter() {
  if (position === 'left') return EDGE + Math.max(rect.w, 140) / 2;
  if (position === 'right') return W - EDGE - Math.max(rect.w, 140) / 2;
  return W / 2;
}
function create() {
  const { bounds } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    width: W, height: H,
    ...winPos(), y: bounds.y,
    frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true,
    resizable: false, hasShadow: false, show: false, backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, backgroundThrottling: false }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.webContents.on('console-message', (_e, ...a) => console.log('[renderer]', ...a.map(x => (x && x.message) || x)));
  win.webContents.on('render-process-gone', (_e, d) => console.log('GONE', d));
  win.loadFile('index.html');
  win.once('ready-to-show', () => win.showInactive());
  setInterval(tick, 33);
}

// Hover detection runs here because the window is click-through while collapsed.
function tick() {
  if (!win || win.isDestroyed()) return;
  const p = screen.getCursorScreenPoint();
  const b = win.getBounds();
  const x = p.x - b.x, y = p.y - b.y;
  const hw = Math.max(rect.w, 170) / 2 + 14;
  const hh = Math.max(rect.h, 14) + 18;
  const cx = shellCenter();
  const inside = !capWin && !fsHidden && x > cx - hw && x < cx + hw && y >= -2 && y < hh;
  const now = Date.now();
  if (inside) {
    leaveSince = 0;
    if (!hovering) {
      if (!enterSince) enterSince = now;
      if (now - enterSince > 90) { hovering = true; win.webContents.send('hover', true); }
    }
  } else {
    enterSince = 0;
    if (hovering) {
      if (!leaveSince) leaveSince = now;
      if (now - leaveSince > 320) { hovering = false; win.webContents.send('hover', false); }
    }
  }
}

// ---------- clipboard history: text and images, pinning ----------
let clips = [];
const clipDir = () => { const d = path.join(app.getPath('userData'), 'clips'); fs.mkdirSync(d, { recursive: true }); return d; };
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function sendClips() { store.clips = clips; saveStore(); if (win && !win.isDestroyed()) win.webContents.send('clips', JSON.parse(JSON.stringify(clips))); }
function dropFile(x) {
  if (x.type === 'image' && !clips.some(y => y !== x && y.hash === x.hash)) { try { fs.unlinkSync(path.join(clipDir(), x.hash + '.png')); } catch {} }
  return false;
}
function addClip(c) {
  const old = clips.find(x => c.type === 'image' ? x.hash === c.hash : x.type !== 'image' && x.text === c.text);
  if (old && clips[0] === old) return;
  const item = { ...c, id: old ? old.id : newId(), at: Date.now(), pinned: old ? !!old.pinned : false };
  clips = [item, ...clips.filter(x => x !== old)];
  // Pinned items always stay; otherwise keep 40 entries, at most 15 of them images.
  let n = 0, im = 0;
  clips = clips.filter(x => x.pinned || (x.type === 'image' && ++im > 15 ? dropFile(x) : ++n <= 40 || dropFile(x)));
  sendClips();
}
let reading = false;
async function checkClipboard() {
  if (reading) return; reading = true;
  try {
    const items = await clipboard.read(); const it = items && items[0]; if (!it) return;
    if (it.types.includes('text/plain')) { const t = await clipboard.readText(); if (t && t.trim()) addClip({ type: 'text', text: t }); }
    else if (it.types.includes('image/png')) {
      const buf = Buffer.from(await (await it.getType('image/png')).arrayBuffer()); if (!buf.length) return;
      const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
      const f = path.join(clipDir(), hash + '.png'); if (!fs.existsSync(f)) fs.writeFileSync(f, buf);
      const img = nativeImage.createFromBuffer(buf), { width: w, height: h } = img.getSize();
      const thumb = img.resize(w >= h ? { width: Math.min(w, 240) } : { height: Math.min(h, 180) }).toDataURL();
      addClip({ type: 'image', hash, w, h, thumb });
    }
  } catch {} finally { reading = false; }
}
// The helper reports Windows' clipboard sequence number, so the clipboard is read only when it changed.
let lastSeq = null, seqAt = 0;
function onClipSeq(seq) { seqAt = Date.now(); if (seq !== lastSeq) { lastSeq = seq; checkClipboard(); } }
// Fallback while the helper is not running: cheap text-only polling.
let lastText = '';
async function pollClipText() { if (Date.now() - seqAt < 3000) return; try { const t = await clipboard.readText(); if (typeof t === 'string' && t && t !== lastText) { lastText = t; addClip({ type: 'text', text: t }); } } catch {} }

// ---------- system stats ----------
let prevCpu = null, prevNet = null;
function cpuNow() {
  const c = os.cpus(); let idle = 0, total = 0;
  for (const x of c) { for (const k in x.times) total += x.times[k]; idle += x.times.idle; }
  return { idle, total };
}
function netBytes() {
  return new Promise(res => {
    execFile('netstat', ['-e'], { windowsHide: true }, (e, out) => {
      if (e) return res(null);
      for (const l of out.split(/\r?\n/)) {
        const m = l.match(/^\s*\S+\s+(\d{4,})\s+(\d{4,})\s*$/);
        if (m) return res({ rx: +m[1], tx: +m[2], at: Date.now() });
      }
      res(null);
    });
  });
}
ipcMain.handle('sys:stats', async (_, opts) => {
  const c = cpuNow(); let cpu = 0;
  if (prevCpu) { const dt = c.total - prevCpu.total, di = c.idle - prevCpu.idle; cpu = dt > 0 ? (1 - di / dt) * 100 : 0; }
  prevCpu = c;
  const total = os.totalmem(), free = os.freemem();
  let disk = { total: 0, free: 0 };
  try { const s = fs.statfsSync(process.env.SystemDrive ? process.env.SystemDrive + '\\' : 'C:\\'); disk = { total: s.blocks * s.bsize, free: s.bavail * s.bsize }; } catch {}
  let net = { down: 0, up: 0 };
  const n = opts && opts.net === false ? null : await netBytes();
  if (n && prevNet) { const s = (n.at - prevNet.at) / 1000; if (s > 0) net = { down: Math.max(0, (n.rx - prevNet.rx) / s), up: Math.max(0, (n.tx - prevNet.tx) / s) }; }
  if (n) prevNet = n;
  return { cpu, threads: os.cpus().length, uptime: os.uptime(), mem: { used: total - free, total }, disk, net };
});

let prevProc = null;
ipcMain.handle('sys:top', () => new Promise(res => {
  const ps = "Get-Process | Group-Object ProcessName | ForEach-Object { [pscustomobject]@{n=$_.Name;c=$_.Count;m=[int64](($_.Group|Measure-Object WorkingSet64 -Sum).Sum);t=[double](($_.Group|Measure-Object CPU -Sum).Sum)} } | ConvertTo-Json -Compress";
  execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, maxBuffer: 1e7 }, (e, out) => {
    if (e) return res([]);
    let arr; try { arr = JSON.parse(out); } catch { return res([]); }
    if (!Array.isArray(arr)) arr = [arr];
    const now = Date.now(); const cores = os.cpus().length;
    const list = arr.map(p => {
      let cpu = 0;
      if (prevProc) { const o = prevProc.map[p.n]; const dt = (now - prevProc.at) / 1000; if (o != null && dt > 0) cpu = Math.max(0, (p.t - o) / dt / cores * 100); }
      return { name: p.n, count: p.c, mem: p.m, cpu };
    });
    prevProc = { at: now, map: Object.fromEntries(arr.map(p => [p.n, p.t])) };
    res(list);
  });
}));

// ---------- start menu apps ----------
let appsCache = null;
function walk(dir, depth, out) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const f = path.join(dir, e.name);
    if (e.isDirectory() && depth < 3) walk(f, depth + 1, out);
    else if (e.isFile() && e.name.toLowerCase().endsWith('.lnk')) out.push(f);
  }
}
let appsPromise = null;
ipcMain.handle('apps:list', () => loadApps());
function loadApps() { if (!appsPromise) appsPromise = buildApps(); return appsPromise; }
async function buildApps() {
  if (appsCache) return appsCache;
  const files = [];
  walk(path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft\\Windows\\Start Menu\\Programs'), 0, files);
  walk(path.join(process.env.APPDATA || '', 'Microsoft\\Windows\\Start Menu\\Programs'), 0, files);
  const seen = new Set(); const items = [];
  for (const f of files) {
    const name = path.basename(f, '.lnk');
    if (/uninstall|readme|documentation|help$/i.test(name) || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase()); items.push({ name, path: f });
  }
  items.sort((a, b) => a.name.localeCompare(b.name));
  await Promise.all(items.map(async it => {
    let src = it.path;
    try { const l = shell.readShortcutLink(it.path); const ic = l.icon && fs.existsSync(l.icon) ? l.icon : l.target; if (ic && fs.existsSync(ic)) src = ic; } catch {}
    try { it.icon = (await app.getFileIcon(src, { size: 'normal' })).toDataURL(); } catch { it.icon = ''; }
  }));
  appsCache = items; return items;
}

// ---------- misc ipc ----------
ipcMain.on('rect', (_, r) => { rect = r; });
ipcMain.on('ignore', (_, v) => { if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(v, { forward: true }); });
ipcMain.on('focus', (_, v) => { if (!win) return; if (v) win.focus(); else win.blur(); });
ipcMain.handle('store:get', () => ({ ...store }));
ipcMain.on('store:set', (_, k, v) => {
  store[k] = v; saveStore();
  if (k !== 'settings') return;
  hoverEnabled = v.hoverOpen !== false;
  if (win && (v.position || 'center') !== position) { position = v.position || 'center'; win.setPosition(winPos().x, screen.getPrimaryDisplay().bounds.y); }
  if (win) win.setAlwaysOnTop(v.onTop !== false, 'screen-saver');
});
ipcMain.handle('accent:get', () => { try { return '#' + systemPreferences.getAccentColor().slice(0, 6); } catch { return '#f08a24'; } });
ipcMain.handle('version', () => app.getVersion());

// ---------- accent color from the desktop wallpaper ----------
// Windows keeps a copy of the current wallpaper (also for slideshows / Spotlight) in TranscodedWallpaper.
function wallpaperFile() {
  const t = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Themes', 'TranscodedWallpaper');
  return fs.existsSync(t) ? t : null;
}
// Dominant vivid colour: hue histogram weighted by saturation, ignoring near-greys, very dark and very light pixels.
function accentFromImage(file) {
  let img; try { img = nativeImage.createFromBuffer(fs.readFileSync(file)); } catch { return null; }
  if (img.isEmpty()) return null;
  const { width: w0, height: h0 } = img.getSize(); img = img.resize({ width: 96, height: Math.max(1, Math.round(96 * h0 / w0)) });
  const bm = img.toBitmap(), bins = Array.from({ length: 36 }, () => ({ w: 0, r: 0, g: 0, b: 0 })); let px = 0;
  for (let i = 0; i < bm.length; i += 4) {
    const b = bm[i] / 255, g = bm[i + 1] / 255, r = bm[i + 2] / 255; px++;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
    if (dd < .06) continue; const sat = dd / (1 - Math.abs(2 * l - 1));
    if (sat < .22 || l < .12 || l > .9) continue;
    let h = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; h = (h * 60 + 360) % 360;
    const wgt = sat * (1 - Math.abs(l - .5) * 1.2), k = bins[Math.floor(h / 10)];
    k.w += wgt; k.r += r * wgt; k.g += g * wgt; k.b += b * wgt;
  }
  // merge each bin with its neighbours so a hue split across two bins still wins
  let best = null, bw = 0;
  bins.forEach((_, i) => { const s3 = [bins[(i + 35) % 36], bins[i], bins[(i + 1) % 36]]; const w = s3.reduce((a, x) => a + x.w, 0); if (w > bw) { bw = w; best = s3; } });
  if (!best || bw < px * .03) return null;   // basically a black-and-white / grey wallpaper
  const W = best.reduce((a, x) => a + x.w, 0), r = best.reduce((a, x) => a + x.r, 0) / W, g = best.reduce((a, x) => a + x.g, 0) / W, b = best.reduce((a, x) => a + x.b, 0) / W;
  // make it usable as an accent: enough saturation, mid lightness
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let l = (mx + mn) / 2, dd = mx - mn, sat = dd / (1 - Math.abs(2 * l - 1) || 1);
  let h = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; h = (h * 60 + 360) % 360;
  sat = Math.min(1, Math.max(sat, .58)); l = Math.min(.62, Math.max(l, .48));
  const c = (1 - Math.abs(2 * l - 1)) * sat, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [R, G, B] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [R, G, B].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
ipcMain.handle('accent:wall', (_, file) => {
  const f = (process.env.KLON_TEST && file) || wallpaperFile();
  return f ? accentFromImage(f) : null;
});
let wallStamp = 0;
setInterval(() => {   // notice wallpaper changes (incl. slideshows) within ~20 s
  const f = wallpaperFile(); if (!f || !win || win.isDestroyed()) return;
  let t = 0; try { t = fs.statSync(f).mtimeMs; } catch {}
  if (wallStamp && t !== wallStamp) win.webContents.send('accent:wall', accentFromImage(f));
  wallStamp = t;
}, 20000);

// ---------- phone link ----------
let phone = null;
const phoneEmit = (ch, d) => { if (win && !win.isDestroyed()) win.webContents.send(ch, JSON.parse(JSON.stringify(d === undefined ? null : d))); };
// open the app a Windows notification came from (only apps Windows lists in its Apps folder)
const appIds = new Map(), appIcons = new Map();
// real app icon (Store and desktop apps) for a notification, by its AppUserModelId
ipcMain.handle('notifs:icon', (_, aid) => {
  if (!aid || !/^[\w.!\-{}\\ ]+$/.test(aid)) return '';
  if (!appIcons.has(aid)) appIcons.set(aid, new Promise(res => execFile('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(RES, 'appicon.ps1'), '-Aid', aid, '-Size', '64'],
    { windowsHide: true, timeout: 20000, maxBuffer: 4e6 }, (e, out) => { const b = !e && String(out).trim(); res(b && /^[A-Za-z0-9+/=]+$/.test(b) ? b : ''); })));
  return appIcons.get(aid);
});
ipcMain.handle('notifs:openApp', async (_, aid) => {
  if (!aid || !/^[\w.!\-{}\\ ]+$/.test(aid)) return false;
  if (!appIds.has(aid)) appIds.set(aid, await new Promise(res => execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command',   // aid has no quotes (checked above)
    `[bool]((New-Object -ComObject Shell.Application).NameSpace('shell:AppsFolder').Items() | Where-Object { $_.Path -eq '${aid}' } | Select-Object -First 1)`],
    { windowsHide: true, timeout: 15000 }, (e, out) => res(!e && /True/.test(out)))));
  if (!appIds.get(aid)) return false;
  if (!process.env.KLON_TEST) spawn('explorer.exe', ['shell:AppsFolder\\' + aid], { detached: true, stdio: 'ignore' }).unref();
  return true;
});
ipcMain.handle('phone:state', () => phone ? phone.state() : null);
ipcMain.handle('phone:start', async () => { try { return await phone.start(); } catch (e) { return { error: e.message }; } });
ipcMain.on('phone:stop', () => phone && phone.stop());
ipcMain.on('phone:unpair', (_, dev) => phone && phone.removeDevice(dev));
ipcMain.on('phone:newCode', () => phone && phone.newPairingCode());
ipcMain.handle('phone:sendFiles', (_, paths, dev) => phone ? phone.sendFiles(paths || [], dev) : 0);
ipcMain.handle('phone:browse', async (_, dev) => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'] });
  return r.canceled ? 0 : phone.sendFiles(r.filePaths, dev);
});
ipcMain.handle('phone:sendText', (_, t, dev) => phone ? phone.sendText(t, dev) : false);
ipcMain.on('phone:remove', (_, id) => phone && phone.remove(id));
ipcMain.on('phone:clear', (_, dev) => phone && phone.clear(dev));
ipcMain.on('phone:open', (_, id) => { const f = phone && phone.pathOf(id); if (f && !process.env.KLON_TEST) shell.openPath(f); });
ipcMain.on('phone:reveal', (_, id) => { const f = phone && phone.pathOf(id); if (f && !process.env.KLON_TEST) shell.showItemInFolder(f); });
ipcMain.on('phone:dir', () => { const dd = path.join(app.getPath('downloads'), 'Adacık'); fs.mkdirSync(dd, { recursive: true }); if (!process.env.KLON_TEST) shell.openPath(dd); });

// ---------- calendar sync ----------
let calState = (store && store.calCache) || { events: [], status: {}, last: 0 }, calBusy = null;
async function syncCalendars() {
  if (calBusy) return calBusy;
  calBusy = (async () => {
    const cfg = store.calsync || { windows: true, feeds: [] };
    try { calState = await calsync.syncAll(cfg, RES); store.calCache = calState; saveStore(); } catch {}
    if (win && !win.isDestroyed()) win.webContents.send('cal:events', calState);
    calBusy = null; return calState;
  })();
  return calBusy;
}
ipcMain.handle('cal:get', () => calState);

// ---------- exchange rates (ExchangeRate-API open endpoint, daily rates, no key) ----------
let fxBusy = null;
ipcMain.handle('fx:rates', (_, force) => {
  const c = store.fxCache;
  if (!force && c && Date.now() - c.fetchedAt < 6 * 36e5) return c;
  if (fxBusy) return fxBusy;
  fxBusy = (async () => {
    try {
      const j = await getJson('https://open.er-api.com/v6/latest/USD', 12000);
      if (j.result !== 'success') throw new Error('api');
      store.fxCache = { base: 'USD', rates: j.rates, updated: j.time_last_update_unix * 1000, fetchedAt: Date.now() }; saveStore();
      return store.fxCache;
    } catch { return c ? { ...c, stale: true } : { error: 'Kurlar alınamadı. İnternet bağlantını kontrol et.' }; }
    finally { fxBusy = null; }
  })();
  return fxBusy;
});

// ---------- translation ----------
// Google Translate's public web endpoint (auto-detects the language); MyMemory's free API as a fallback.
async function getJson(url, ms = 10000) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(url, { signal: ac.signal, headers: { 'User-Agent': 'Mozilla/5.0 Adacik' } }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
ipcMain.handle('translate', async (_, { text, from, to }) => {
  text = String(text || '').slice(0, 800); if (!text.trim()) return { text: '' };
  try {
    const u = new URL('https://translate.googleapis.com/translate_a/single');
    u.search = new URLSearchParams({ client: 'gtx', sl: from || 'auto', tl: to, dt: 't', dj: '1', q: text }).toString();
    const j = await getJson(u);
    return { text: (j.sentences || []).map(s => s.trans || '').join(''), detected: j.src || '', via: 'Google Çeviri' };
  } catch (e1) {
    try {
      const src = !from || from === 'auto' ? 'autodetect' : from;
      const u = new URL('https://api.mymemory.translated.net/get');
      u.search = new URLSearchParams({ q: text, langpair: src + '|' + to }).toString();
      const j = await getJson(u);
      if (j.responseStatus && +j.responseStatus !== 200) throw new Error(j.responseDetails || 'hata');
      return { text: j.responseData.translatedText || '', detected: (j.responseData.detectedLanguage || '').split('-')[0], via: 'MyMemory' };
    } catch (e2) { return { error: 'Çeviri yapılamadı. İnternet bağlantını kontrol et.' }; }
  }
});
ipcMain.handle('cal:sync', () => syncCalendars());
let batteryPresent = null;
ipcMain.handle('battery:present', () => batteryPresent !== null ? batteryPresent : new Promise(res => {
  execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', '@(Get-CimInstance Win32_Battery).Count'], { windowsHide: true }, (e, out) => { batteryPresent = !e && parseInt(out, 10) > 0; res(batteryPresent); });
}));

// ---------- quick launch ----------
const tok = t => String(t || '').replace(/^%(\w+)%$/, (m, n) => { try { return app.getPath(n); } catch { return m; } });
ipcMain.on('launch', (_, t) => {
  t = tok(t);
  if (/^[a-z]:[\\/]/i.test(t) || t.startsWith('\\\\')) { if (fs.existsSync(t)) { shell.openPath(t); return; } }
  if (/^[a-z][\w+.-]*:/i.test(t) && !/^[a-z]:[\\/]/i.test(t)) { shell.openExternal(t).catch(() => {}); return; }
  if (fs.existsSync(t)) { shell.openPath(t); return; }
  spawn('cmd', ['/c', 'start', '', t], { detached: true, windowsHide: true }).unref();
});
ipcMain.handle('icon:get', async (_, p) => {
  p = tok(p);
  try { if (!fs.existsSync(p)) return ''; return (await app.getFileIcon(p, { size: 'large' })).toDataURL(); } catch { return ''; }
});
ipcMain.handle('browse', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('clips:get', () => JSON.parse(JSON.stringify(clips)));
ipcMain.on('clips:write', (_, t) => { clipboard.writeText(t); });
ipcMain.handle('clips:copy', async (_, id) => {
  const c = clips.find(x => x.id === id); if (!c) return false;
  try {
    if (c.type === 'image') { const buf = fs.readFileSync(path.join(clipDir(), c.hash + '.png')); await clipboard.write([new ClipboardItem({ 'image/png': new Blob([buf], { type: 'image/png' }) })]); }
    else clipboard.writeText(c.text);
    return true;
  } catch { return false; }
});
ipcMain.on('clips:pin', (_, id) => { const c = clips.find(x => x.id === id); if (c) { c.pinned = !c.pinned; sendClips(); } });
ipcMain.on('clips:remove', (_, id) => { const c = clips.find(x => x.id === id); if (c) { clips = clips.filter(x => x !== c); dropFile(c); sendClips(); } });
ipcMain.on('clips:clear', () => { const gone = clips.filter(x => !x.pinned); clips = clips.filter(x => x.pinned); gone.forEach(dropFile); sendClips(); });
ipcMain.on('awake', (_, on) => {
  if (on && blocker == null) blocker = powerSaveBlocker.start('prevent-display-sleep');
  if (!on && blocker != null) { powerSaveBlocker.stop(blocker); blocker = null; }
});
ipcMain.on('open', (_, p) => shell.openPath(p));
ipcMain.on('folder', (_, n) => { try { shell.openPath(app.getPath(n)); } catch {} });
ipcMain.on('login', (_, on) => { try { app.setLoginItemSettings({ openAtLogin: !!on }); } catch {} });
ipcMain.on('quit', () => app.quit());
ipcMain.handle('ips', () => {
  const o = []; for (const l of Object.values(os.networkInterfaces())) for (const a of l) if (a.family === 'IPv4' && !a.internal) o.push(a.address);
  return o;
});
ipcMain.handle('user', () => os.userInfo().username);
ipcMain.on('drag', async (e, p) => {
  try { const icon = await app.getFileIcon(p); e.sender.startDrag({ file: p, icon }); } catch {}
});
// ---------- screenshot: freeze the screen, let the user drag a region ----------
let capWin = null, capImg = null, capDisplay = null;
async function writeImageToClipboard(img) {
  const png = img.toPNG();
  await clipboard.write([new ClipboardItem({ 'image/png': new Blob([png], { type: 'image/png' }) })]);
}
ipcMain.handle('cap:img', () => capImg ? capImg.toDataURL() : null);
function runOcr(file) {
  return new Promise(res => execFile('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(RES, 'ocr.ps1'), '-Img', file],
    { windowsHide: true, encoding: 'utf8', maxBuffer: 1e7, timeout: 30000 }, (e, out) => res(e ? null : String(out).replace(/\r/g, '').trim())));
}
ipcMain.handle('ocr:file', (_, f) => runOcr(f));
ipcMain.handle('shot', async (_, opts) => {
  if (capWin) return null;
  const ocr = !!(opts && opts.mode === 'ocr'), pick = !!(opts && opts.mode === 'pick');
  const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()); capDisplay = d;
  win.setOpacity(0); await new Promise(r => setTimeout(r, 180));
  try {
    const srcs = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round(d.bounds.width * d.scaleFactor), height: Math.round(d.bounds.height * d.scaleFactor) } });
    const src = srcs.find(x => String(x.display_id) === String(d.id)) || srcs[0];
    capImg = src && src.thumbnail;
  } catch (e) { capImg = null; }
  win.setOpacity(1);
  if (!capImg || capImg.isEmpty()) return { error: 'Ekran yakalanamadı' };
  return new Promise(resolve => {
    let done = false;
    const finish = async r => {
      if (done) return; done = true;
      ipcMain.removeListener('cap:done', onDone);
      const w = capWin; capWin = null; if (w && !w.isDestroyed()) w.close();
      if (!r) return resolve({ cancelled: true });
      if (pick) return resolve(r.color ? { color: r.color } : { cancelled: true });
      try {
        const sx = capImg.getSize().width / d.bounds.width;
        let img = capImg;
        if (r.w >= 4 && r.h >= 4) img = capImg.crop({ x: Math.round(r.x * sx), y: Math.round(r.y * sx), width: Math.round(r.w * sx), height: Math.round(r.h * sx) });
        if (ocr) {
          const tmp = path.join(os.tmpdir(), 'klon-ocr-' + Date.now() + '.png'); fs.writeFileSync(tmp, img.toPNG());
          const text = await runOcr(tmp); try { fs.unlinkSync(tmp); } catch {}
          if (text && !process.env.KLON_TEST) clipboard.writeText(text);
          return resolve({ text: text || '' });
        }
        await writeImageToClipboard(img);
        const dir = path.join(app.getPath('pictures'), 'Adacık'); fs.mkdirSync(dir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
        const f = path.join(dir, 'Screenshot ' + stamp + '.png'); fs.writeFileSync(f, img.toPNG());
        resolve({ path: f });
      } catch (e) { resolve({ error: e.message }); }
    };
    const onDone = (_, r) => finish(r);
    ipcMain.on('cap:done', onDone);
    capWin = new BrowserWindow({
      x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height,
      frame: false, skipTaskbar: true, resizable: false, movable: false, minimizable: false, maximizable: false,
      fullscreenable: false, hasShadow: false, show: false, backgroundColor: '#000000', alwaysOnTop: true,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
    });
    capWin.setAlwaysOnTop(true, 'screen-saver', 1);
    capWin.loadFile('capture.html', { query: { mode: pick ? 'pick' : ocr ? 'ocr' : 'shot' } });
    capWin.once('ready-to-show', () => { capWin.show(); capWin.focus(); });
    capWin.on('closed', () => finish(null));
  });
});
ipcMain.on('reveal', (_, f) => { try { shell.showItemInFolder(f); } catch {} });
// QR page: copy a PNG, read clipboard text, save files next to the screenshots.
ipcMain.handle('clip:png', async (_, u8) => { try { await clipboard.write([new ClipboardItem({ 'image/png': new Blob([Buffer.from(u8)], { type: 'image/png' }) })]); return true; } catch { return false; } });
ipcMain.handle('clip:text', async () => { try { return await clipboard.readText(); } catch { return ''; } });
const saveDir = () => { const dir = path.join(app.getPath('pictures'), 'Adacık'); fs.mkdirSync(dir, { recursive: true }); return dir; };
ipcMain.handle('save:file', (_, { ext, data, base }) => {
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const f = path.join(saveDir(), `${base || 'Dosya'} ${stamp}.${ext}`);
  fs.writeFileSync(f, typeof data === 'string' ? data : Buffer.from(data)); return f;
});
ipcMain.on('openDir', () => shell.openPath(saveDir()));

// ---------- send a file to a phone on the same Wi-Fi ----------
// A one-file HTTP server on the LAN address with a random path; it stops after 10 minutes or when closed.
let share = null;
function lanIp() {
  for (const l of Object.values(os.networkInterfaces())) for (const a of l)
    if (a.family === 'IPv4' && !a.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)) return a.address;
  return null;
}
function stopShare() { if (!share) return; clearTimeout(share.timer); try { share.srv.closeAllConnections(); share.srv.close(); } catch {} share = null; }
ipcMain.handle('share:start', async (_, file) => {
  stopShare();
  let st; try { st = fs.statSync(file); } catch { return { error: 'Dosya bulunamadı' }; }
  if (st.isDirectory()) return { error: 'Klasörler gönderilemez, bir dosya seç' };
  const ip = process.env.KLON_TEST ? '127.0.0.1' : lanIp(); if (!ip) return { error: 'Yerel ağ bağlantısı bulunamadı' };
  const token = crypto.randomBytes(9).toString('base64url'), name = path.basename(file);
  const srv = http.createServer((q, r) => {
    let u = ''; try { u = decodeURIComponent((q.url || '').split('?')[0]); } catch {}
    if (u !== '/' + token + '/' + name || !fs.existsSync(file)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': fs.statSync(file).size, 'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(name) });
    fs.createReadStream(file).pipe(r);
    r.on('finish', () => { if (share && share.srv === srv) { share.hits++; win && win.webContents.send('share:hit', share.hits); } });
  });
  try { await new Promise((res, rej) => { srv.once('error', rej); srv.listen(0, ip, res); }); } catch (e) { return { error: 'Sunucu açılamadı: ' + e.message }; }
  const url = `http://${ip}:${srv.address().port}/${token}/${encodeURIComponent(name)}`;
  share = { srv, url, hits: 0, timer: setTimeout(() => { stopShare(); win && win.webContents.send('share:stopped'); }, 10 * 60 * 1000) };
  return { url, name, size: st.size };
});
ipcMain.on('share:stop', stopShare);

// ---------- media session (PowerShell helper) ----------
let mediaProc, lastThumb = '';
ipcMain.handle('media:thumb', () => lastThumb);
function helperLine(m) {
  if (!win || win.isDestroyed()) return;
  if (m.notif) { win.webContents.send('notif', m.notif); return; }
  if (typeof m.cb === 'number') onClipSeq(m.cb);
  if (typeof m.fs === 'boolean') onFullscreen(m.fs);
  if (m.thumb !== undefined || m.none) lastThumb = m.none ? '' : m.thumb;
  win.webContents.send('media', m);
}
// Hide the island while a game or video runs fullscreen.
let fsHidden = false;
function onFullscreen(full) {
  const want = full && !(store.settings && store.settings.hideFullscreen === false) && !capWin;
  if (want === fsHidden) return;
  fsHidden = want;
  if (want) win.hide(); else win.showInactive();
  win.webContents.send('fullscreen', want);
}
function startMedia() {
  mediaProc = spawn('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(RES, 'media.ps1'), '-OwnPid', String(process.pid)], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
  mediaProc.on('exit', () => { mediaProc = null; setTimeout(startMedia, 2000); });
  let buf = ''; mediaProc.stdout.setEncoding('utf8');
  mediaProc.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (l[0] === '{') { try { helperLine(JSON.parse(l)); } catch {} } }
  });
}
ipcMain.on('media:cmd', (_, c, a) => { try { mediaProc && mediaProc.stdin.write((a != null ? c + ' ' + a : c) + '\n'); } catch {} });
// ---------- lyrics (lrclib.net) ----------
// The exact-match endpoint misses many songs (artist written "A ve B" vs "A, B", "(feat. X)" in the title,
// slightly different durations), so fall back to lrclib's search and pick the closest match.
const lyricCache = new Map();
const normTxt = s => String(s || '').toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const cleanTitle = t => String(t || '').replace(/\s*[\(\[][^\)\]]*(feat|ft\.|with|remaster|official|video|audio|lyric|live|version|edit|prod)[^\)\]]*[\)\]]/gi, '')
  .replace(/\s+-\s+(.*remaster.*|official.*|.*version|single|radio edit)$/i, '').replace(/\s+(feat|ft)\.?\s.+$/i, '').trim();
const splitArtists = a => String(a || '').split(/\s*(?:,|&|\+|\/|;|\bve\b|\band\b|\bx\b|\bfeat\.?|\bft\.?|\bwith\b)\s*/i).map(s => s.trim()).filter(Boolean);
function parseLrc(text) {
  const out = [];
  for (const l of String(text || '').split('\n')) {
    const tags = [...l.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)], words = l.replace(/\[[^\]]*\]/g, '').trim();
    for (const t of tags) if (words) out.push([+t[1] * 60 + +t[2], words]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}
async function lrclib(path, params) {
  const u = new URL('https://lrclib.net/api/' + path); for (const [k, v] of Object.entries(params)) if (v !== '' && v != null) u.searchParams.set(k, v);
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 9000);
  try { const r = await fetch(u, { signal: ac.signal, headers: { 'User-Agent': 'Adacik/1.1 (desktop lyrics)' } }); return r.ok ? await r.json() : null; } catch { return null; } finally { clearTimeout(t); }
}
async function findLyrics(title, artist, dur) {
  const ct = cleanTitle(title), arts = splitArtists(artist), main = arts[0] || artist;
  const exact = await lrclib('get', { track_name: title, artist_name: artist, duration: dur > 0 ? Math.round(dur) : '' });
  if (exact && (exact.syncedLyrics || exact.plainLyrics)) return exact;
  const seen = new Map();
  for (const params of [{ track_name: ct, artist_name: main }, { q: ct + ' ' + arts.join(' ') }, { track_name: ct }]) {
    const list = await lrclib('search', params); if (Array.isArray(list)) list.forEach(x => seen.set(x.id, x));
    if ([...seen.values()].some(x => x.syncedLyrics && normTxt(cleanTitle(x.trackName)) === normTxt(ct))) break;
  }
  const nt = normTxt(ct), na = arts.map(normTxt);
  let best = null, bs = -Infinity;
  for (const x of seen.values()) {
    if (x.instrumental) continue;
    const xt = normTxt(cleanTitle(x.trackName)), xa = normTxt(x.artistName);
    let sc = 0;
    if (xt === nt) sc += 50; else if (xt.includes(nt) || nt.includes(xt)) sc += 25; else continue;   // title must match
    const hits = na.filter(a => a && xa.includes(a)).length; if (!hits) sc -= 40; sc += hits * 15;
    if (dur > 0 && x.duration) { const dd = Math.abs(x.duration - dur); sc += dd <= 2 ? 20 : dd <= 6 ? 10 : dd <= 15 ? 0 : -30; }
    sc += x.syncedLyrics ? 30 : x.plainLyrics ? 5 : -100;
    if (sc > bs) { bs = sc; best = x; }
  }
  return best && bs > 0 ? best : null;
}
ipcMain.handle('lyrics:get', async (_, title, artist, dur) => {
  const k = title + '|' + artist; if (lyricCache.has(k)) return lyricCache.get(k);
  let res = { lines: [], synced: false };
  try {
    const x = await findLyrics(title, artist, dur);
    if (x && x.syncedLyrics) res = { lines: parseLrc(x.syncedLyrics), synced: true };
    else if (x && x.plainLyrics) res = { lines: x.plainLyrics.split('\n').map(s => s.trim()).filter(Boolean).map(s => [-1, s]), synced: false };
  } catch {}
  if (res.lines.length) lyricCache.set(k, res);
  return res;
});

// ---------- lifecycle ----------
const lock = process.env.KLON_TEST ? true : app.requestSingleInstanceLock();
if (!lock) app.quit();
app.whenReady().then(() => {
  loadStore();
  clips = (store.clips || []).filter(c => c && (typeof c.text === 'string' || c.type === 'image')).map(c => ({ ...c, type: c.type || 'text', id: c.id || newId() }));
  lastText = (clips.find(c => c.type === 'text') || {}).text || '';
  hoverEnabled = !(store.settings && store.settings.hoverOpen === false);
  position = (store.settings && store.settings.position) || 'center';
  prevCpu = cpuNow();
  setTimeout(loadApps, 2500);
  calState = store.calCache || calState;
  phone = new Phone({ store, save: saveStore, emit: phoneEmit, downloads: app.getPath('downloads'), test: !!process.env.KLON_TEST });
  setTimeout(syncCalendars, 6000); setInterval(syncCalendars, 15 * 60 * 1000);
  create();
  setInterval(pollClipText, 1500);
  startMedia();
  if (store.settings && store.settings.onTop === false) win.setAlwaysOnTop(false);
  systemPreferences.on('accent-color-changed', (_e, c) => win && win.webContents.send('accent', '#' + String(c).slice(0, 6)));
  globalShortcut.register('Control+Alt+N', () => win.webContents.send('toggle-pin'));
});
app.on('will-quit', () => { globalShortcut.unregisterAll(); stopShare(); try { phone && phone.stop(); } catch {} try { const m = mediaProc; mediaProc = null; m && m.removeAllListeners('exit'); m && m.kill(); } catch {} });
app.on('window-all-closed', () => app.quit());
