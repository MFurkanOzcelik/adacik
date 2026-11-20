// Phone link: a small HTTP server on the local network. A phone opens it by scanning a QR code
// (no app, no account). Everything after pairing is end-to-end encrypted, so someone else on the
// same Wi-Fi who records the traffic sees neither messages, files, file names nor keys.
//
// Pairing: the QR code carries a one-time pairing secret in the URL fragment (#p=…), which browsers
// never send over the network. The phone makes its own random device key, seals it with the pairing
// secret and sends it; only a phone that saw the QR code can do that. The secret then changes.
// After that: every request carries a sealed, single-use token (path + time + random), every body and
// every answer is sealed with the device key (XSalsa20-Poly1305, tweetnacl), files go in sealed chunks.
//
// Limit: the page itself is plain HTTP. Someone who can actively tamper with the Wi-Fi traffic (not
// just listen) could serve a modified page; that would need HTTPS with a trusted certificate.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');
const nacl = require('tweetnacl');

function lanIp() {
  for (const l of Object.values(os.networkInterfaces())) for (const a of l)
    if (a.family === 'IPv4' && !a.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)) return a.address;
  return null;
}
const safeName = n => String(n || 'dosya').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+/, '').slice(0, 180) || 'dosya';
function uniquePath(dir, name) {
  let p = path.join(dir, name); const ext = path.extname(name), base = name.slice(0, name.length - ext.length);
  for (let i = 1; fs.existsSync(p); i++) p = path.join(dir, `${base} (${i})${ext}`);
  return p;
}
function deviceOf(ua) {
  ua = String(ua || '');
  if (/iPhone/i.test(ua)) return { kind: 'iphone', name: 'iPhone' };
  if (/iPad/i.test(ua)) return { kind: 'iphone', name: 'iPad' };
  if (/Android/i.test(ua)) { const m = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|\))/); return { kind: 'android', name: m && !/^K$/.test(m[1].trim()) ? m[1].trim() : 'Android telefon' }; }
  return { kind: 'other', name: 'Telefon' };
}

// ---- sealing (same format on the phone: base64url(nonce ‖ box)) ----
const b64 = u => Buffer.from(u).toString('base64url');
const unb64 = s => new Uint8Array(Buffer.from(String(s || ''), 'base64url'));
function sealBytes(key, bytes) { const n = nacl.randomBytes(24); const box = nacl.secretbox(bytes, n, key); const o = new Uint8Array(24 + box.length); o.set(n); o.set(box, 24); return o; }
function openBytes(key, data) { if (!data || data.length < 40) return null; return nacl.secretbox.open(data.subarray(24), data.subarray(0, 24), key); }
const seal = (key, obj) => b64(sealBytes(key, new TextEncoder().encode(JSON.stringify(obj))));
function open(key, s) { const b = openBytes(key, unb64(s)); if (!b) return null; try { return JSON.parse(new TextDecoder().decode(b)); } catch { return null; } }
const newSecret = () => b64(nacl.randomBytes(32));
const CHUNK = 256 * 1024;   // file chunks on the wire (sealed one by one)

class Phone {
  constructor({ store, save, emit, downloads, test }) {
    this.store = store; this.save = save; this.emit = emit; this.test = test;
    this.dir = path.join(downloads, 'Adacık');
    this.srv = null; this.clients = new Set();   // { res, dev }
    this.nonces = new Map();                     // single-use request tokens seen in the last minutes
    this.uploads = new Map();                    // upload id → { dev, tmp, dest, ws, next, size, name, at }
    const p = store.phone || {};
    const devices = {};
    // phones paired before encryption keep their entry (and history) but have to scan once more;
    // that scan is offered as "same phone?" so nothing is lost
    for (const [id, d] of Object.entries(p.devices || {})) devices[id] = d.v === 2 ? d : { ...d, key: null, legacy: true };
    store.phone = { pair: p.pair || newSecret(), port: p.port || 0, devices, items: (p.items || []).filter(i => i.dev), merge: p.merge || null };
    delete store.phone.token;
    if (Object.keys(this.P.devices).length) this.start().catch(() => {});   // phones already paired: be reachable again
  }
  get P() { return this.store.phone; }
  url() { return this.srv ? `http://${this.ip}:${this.srv.address().port}/#p=${this.P.pair}` : ''; }
  onlineIds() { return new Set([...this.clients].map(c => c.dev)); }
  state() {
    const on = this.onlineIds();
    const devices = Object.entries(this.P.devices).map(([id, d]) => ({ id, name: d.name, kind: d.kind, added: d.added, lastSeen: d.lastSeen, online: on.has(id), legacy: !!d.legacy }))
      .sort((a, b) => (b.online - a.online) || (b.lastSeen - a.lastSeen));
    let merge = null;
    const m = this.P.merge;
    if (m && this.P.devices[m.nu] && this.P.devices[m.old]) merge = { nu: m.nu, old: m.old, oldName: this.P.devices[m.old].name, newName: this.P.devices[m.nu].name };
    return { running: !!this.srv, url: this.url(), ip: this.ip || lanIp(), paired: devices.length > 0, devices, items: this.P.items, merge, secure: true };
  }
  push() { this.emit('phone:state', this.state()); }
  key(dev) { const d = this.P.devices[dev]; return d && d.key ? unb64(d.key) : null; }
  addItem(it) {
    it = { id: crypto.randomBytes(6).toString('hex'), at: Date.now(), ...it };
    this.P.items = [it, ...this.P.items].slice(0, 200); this.save(); this.push();
    this.broadcast(it.dev, 'item', this.pub(it)); return it;
  }
  pub(it) { const { path: _p, dev: _d, ...rest } = it; return rest; }   // never hand local paths or other phones' ids out
  broadcast(dev, ev, data) {
    const k = this.key(dev); if (!k) return;
    for (const c of this.clients) if (c.dev === dev) { try { c.res.write(`event: ${ev}\ndata: ${seal(k, data)}\n\n`); } catch {} }
  }

  async start() {
    if (this.srv) return this.state();
    this.ip = this.test ? '127.0.0.1' : lanIp();
    if (!this.ip) throw new Error('Yerel ağ bağlantısı bulunamadı');
    const srv = http.createServer((q, r) => this.handle(q, r).catch(() => { try { r.writeHead(500); r.end(); } catch {} }));
    const listen = port => new Promise((res, rej) => { srv.once('error', rej); srv.listen(port, this.ip, () => { srv.removeListener('error', rej); res(); }); });
    try { await listen(this.P.port || 0); } catch { await listen(0); }   // keep the same port so a saved page keeps working
    this.srv = srv; this.P.port = srv.address().port; this.save();
    this.ping = setInterval(() => {
      for (const c of this.clients) { try { c.res.write('event: ping\ndata: 1\n\n'); } catch {} }
      const old = Date.now() - 5 * 60e3; for (const [n, t] of this.nonces) if (t < old) this.nonces.delete(n);
      for (const [id, u] of this.uploads) if (u.at < Date.now() - 10 * 60e3) { try { u.ws.destroy(); fs.unlinkSync(u.tmp); } catch {} this.uploads.delete(id); }
    }, 20000);
    this.push(); return this.state();
  }
  stop() { clearInterval(this.ping); for (const c of this.clients) { try { c.res.end(); } catch {} } this.clients.clear(); if (this.srv) { try { this.srv.closeAllConnections(); this.srv.close(); } catch {} } this.srv = null; this.push(); }
  // a name the user gave the phone ("Annemin telefonu"); empty puts back the model name it paired with
  renameDevice(id, name) {
    const d = this.P.devices[id]; if (!d) return false;
    name = String(name || '').replace(/[\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!d.model) d.model = d.name;   // the detected name, kept for "reset"
    d.name = name || d.model; this.save(); this.push(); return d.name;
  }
  // remove one phone: its key stops working and its items go away
  removeDevice(id) {
    delete this.P.devices[id];
    for (const c of [...this.clients]) if (c.dev === id) { try { c.res.end(); } catch {} this.clients.delete(c); }
    this.P.items = this.P.items.filter(i => i.dev !== id);
    if (this.P.merge && (this.P.merge.nu === id || this.P.merge.old === id)) this.P.merge = null;
    if (!Object.keys(this.P.devices).length) { this.P.pair = newSecret(); this.save(); this.stop(); return; }
    this.save(); this.push();
  }
  newPairingCode() { this.P.pair = newSecret(); this.save(); this.push(); }
  // "is the phone that just paired the same one as before?" — yes moves the history over
  resolveMerge(yes) {
    const m = this.P.merge; this.P.merge = null;
    if (yes && m && this.P.devices[m.nu] && this.P.devices[m.old]) {
      const nu = this.P.devices[m.nu], old = this.P.devices[m.old];
      nu.name = old.name; nu.added = old.added;
      this.P.items = this.P.items.map(i => i.dev === m.old ? { ...i, dev: m.nu } : i);
      delete this.P.devices[m.old];
      this.broadcast(m.nu, 'hello', this.hello(m.nu));
    }
    this.save(); this.push();
  }
  hello(dev) { return { pc: os.hostname(), name: this.P.devices[dev].name, items: this.P.items.filter(i => i.dev === dev).map(i => this.pub(i)) }; }

  // A request from a paired phone: ?i=<device id>&a=<sealed {p: path, t: time, n: random, …}>.
  // Each token works once, for that path, within 2 minutes.
  auth(u, route) {
    const dev = u.searchParams.get('i'), k = dev && this.key(dev);
    if (!k) return null;
    const a = open(k, u.searchParams.get('a'));
    if (!a || a.p !== route || typeof a.n !== 'string' || Math.abs(Date.now() - a.t) > 120000 || this.nonces.has(a.n)) return null;
    this.nonces.set(a.n, Date.now());
    return { dev, k, a };
  }
  async body(q, max) { const parts = []; let n = 0; for await (const c of q) { n += c.length; if (n > max) throw new Error('too big'); parts.push(c); } return new Uint8Array(Buffer.concat(parts)); }

  async handle(q, r) {
    const u = new URL(q.url, 'http://x'), route = u.pathname;
    // every answer: no caching, no MIME sniffing, no referrer, not embeddable; the page also gets a strict CSP
    const SEC = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' };
    const send = (code, type, data, extra) => { r.writeHead(code, { 'Content-Type': type, ...SEC, ...(extra || {}) }); r.end(data); };
    if (route === '/favicon.ico') { r.writeHead(204); return r.end(); }
    if (route === '/manifest.json') return send(200, 'application/manifest+json', JSON.stringify({ name: 'Adacık', short_name: 'Adacık', start_url: '/', display: 'standalone', background_color: '#000000', theme_color: '#000000' }));
    // the page and its scripts hold no data: anyone may load them
    if (route === '/') return send(200, 'text/html; charset=utf-8', PAGE, { 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" });
    if (route === '/time') return send(200, 'text/plain', String(Date.now()));   // lets the phone allow for a wrong clock
    if (route === '/p.js') return send(200, 'text/javascript; charset=utf-8', fs.readFileSync(path.join(__dirname, 'phone-page.js')));
    if (route === '/nacl.js') return send(200, 'text/javascript; charset=utf-8', fs.readFileSync(require.resolve('tweetnacl/nacl-fast.min.js')));

    if (route === '/pair' && q.method === 'POST') {   // first visit from the QR code
      let req = null; try { req = open(unb64(this.P.pair), new TextDecoder().decode(await this.body(q, 4096))); } catch {}
      const dkey = req && unb64(req.key);
      if (!dkey || dkey.length !== 32 || Math.abs(Date.now() - req.t) > 300000) return send(403, 'text/plain', 'pair');
      const ua = String(q.headers['user-agent'] || ''), d = deviceOf(ua), id = crypto.randomBytes(5).toString('hex');
      this.P.devices[id] = { v: 2, key: b64(dkey), kind: d.kind, name: d.name, ua, added: Date.now(), lastSeen: Date.now() };
      this.P.pair = newSecret();   // a QR code pairs one phone; the panel shows the next one
      // A phone whose saved key got lost (other browser, the PC's address changed…) pairs as new.
      // If an earlier phone of the same model is around, ask on the PC whether it's the same one.
      const on = this.onlineIds();
      const twin = Object.entries(this.P.devices).filter(([x, o]) => x !== id && !on.has(x) && (o.ua ? o.ua === ua : (o.kind === d.kind && (o.model || o.name) === d.name)))
        .sort((a, b) => b[1].lastSeen - a[1].lastSeen)[0];
      this.P.merge = twin ? { nu: id, old: twin[0] } : null;
      this.save(); this.push();
      this.emit('phone:paired', { id, name: d.name, kind: d.kind });
      return send(200, 'text/plain', seal(dkey, { id, name: d.name, pc: os.hostname() }));
    }

    const A = this.auth(u, route);
    if (!A) return send(403, 'text/plain', 'device');
    const { dev, k, a } = A, D = this.P.devices[dev];
    if (route === '/events') return this.sse(q, r, dev);
    if (route === '/items') return send(200, 'text/plain', seal(k, this.hello(dev).items));
    if (route === '/msg' && q.method === 'POST') {
      const m = open(k, new TextDecoder().decode(await this.body(q, 64000)));
      const text = m && String(m.text || '').slice(0, 10000);
      if (!text || !text.trim()) return send(400, 'text/plain', 'empty');
      this.addItem({ dev, dir: 'in', type: 'text', text }); this.emit('phone:incoming', { type: 'text', text, from: D.name });
      return send(200, 'text/plain', 'ok');
    }
    if (route === '/up' && q.method === 'POST') {   // one sealed chunk of a file; a.up/a.seq/a.last/a.name
      const chunk = openBytes(k, await this.body(q, CHUNK * 2 + 64));
      if (!chunk || typeof a.up !== 'string') return send(400, 'text/plain', 'bad');
      let up = this.uploads.get(a.up);
      if (!up) {
        if (a.seq !== 0) return send(409, 'text/plain', 'order');
        fs.mkdirSync(this.dir, { recursive: true });
        const dest = uniquePath(this.dir, safeName(a.name)), tmp = dest + '.part';
        up = { dev, dest, tmp, ws: fs.createWriteStream(tmp), next: 0, size: 0, at: Date.now() }; this.uploads.set(a.up, up);
      }
      if (up.dev !== dev || a.seq !== up.next) return send(409, 'text/plain', 'order');
      up.at = Date.now(); up.next++; up.size += chunk.length;
      if (!up.ws.write(Buffer.from(chunk))) await new Promise(res => up.ws.once('drain', res));
      if (!a.last) return send(200, 'text/plain', 'ok');
      this.uploads.delete(a.up);
      try { await new Promise((res, rej) => up.ws.end(e => e ? rej(e) : res())); fs.renameSync(up.tmp, up.dest); }
      catch { try { fs.unlinkSync(up.tmp); } catch {} return send(500, 'text/plain', 'write'); }
      const it = this.addItem({ dev, dir: 'in', type: 'file', name: path.basename(up.dest), size: up.size, path: up.dest });
      this.emit('phone:incoming', { type: 'file', name: it.name, size: up.size, from: D.name });
      return send(200, 'text/plain', seal(k, { name: it.name }));
    }
    const fm = route.match(/^\/file\/([0-9a-f]{12})$/);
    if (fm) {   // sealed chunks: [4-byte length][nonce ‖ box] …
      const it = this.P.items.find(i => i.id === fm[1] && i.type === 'file' && i.dev === dev);
      if (!it || !it.path || !fs.existsSync(it.path)) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' });
      const rs = fs.createReadStream(it.path, { highWaterMark: CHUNK });
      for await (const c of rs) {
        const box = sealBytes(k, new Uint8Array(c)), head = Buffer.alloc(4); head.writeUInt32BE(box.length);
        if (!r.write(Buffer.concat([head, Buffer.from(box)]))) await new Promise(res => r.once('drain', res));
      }
      return r.end();
    }
    r.writeHead(404); r.end();
  }
  sse(q, r, dev) {
    r.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    const D = this.P.devices[dev];
    r.write(`event: hello\ndata: ${seal(this.key(dev), this.hello(dev))}\n\n`);
    const c = { res: r, dev }; this.clients.add(c);
    D.lastSeen = Date.now(); this.save(); this.push();
    q.on('close', () => { this.clients.delete(c); if (this.P.devices[dev]) this.P.devices[dev].lastSeen = Date.now(); this.save(); this.push(); });
  }
  // Several files at once; a folder sends the files directly inside it (not its subfolders), up to 200 files.
  // Returns how many went and how many were left out.
  sendFiles(paths, dev) {
    if (!this.P.devices[dev]) return { n: 0, skipped: 0 };
    const files = []; let skipped = 0;
    for (const p of paths) {
      try {
        const st = fs.statSync(p);
        if (st.isFile()) files.push([p, st.size]);
        else if (st.isDirectory()) for (const e of fs.readdirSync(p, { withFileTypes: true })) {
          if (e.isFile() && !e.name.startsWith('.') && !/^(desktop\.ini|thumbs\.db)$/i.test(e.name)) { const f = path.join(p, e.name); files.push([f, fs.statSync(f).size]); } else if (e.isDirectory()) skipped++;
        }
      } catch { skipped++; }
    }
    if (files.length > 200) { skipped += files.length - 200; files.length = 200; }
    for (const [p, size] of files) this.addItem({ dev, dir: 'out', type: 'file', name: path.basename(p), size, path: p });
    return { n: files.length, skipped };
  }
  sendText(text, dev) { text = String(text || '').trim(); if (!text || !this.P.devices[dev]) return false; this.addItem({ dev, dir: 'out', type: 'text', text: text.slice(0, 10000) }); return true; }
  remove(id) { const it = this.P.items.find(i => i.id === id); this.P.items = this.P.items.filter(i => i.id !== id); this.save(); this.push(); if (it) this.broadcast(it.dev, 'remove', id); }
  clear(dev) { this.P.items = this.P.items.filter(i => i.dev !== dev); this.save(); this.push(); this.broadcast(dev, 'clear', 1); }
  pathOf(id) { const it = this.P.items.find(i => i.id === id); return it && it.path; }
}

const PAGE = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,interactive-widget=resizes-content">
<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)"><meta name="theme-color" content="#f2f2f5" media="(prefers-color-scheme: light)">
<meta name="apple-mobile-web-app-capable" content="yes"><link rel="manifest" href="/manifest.json">
<meta name="referrer" content="no-referrer">
<title>Adacık</title>
<style>
:root{--bg:#000;--card:#17171a;--card2:#242428;--line:rgba(255,255,255,.08);--txt:#f5f5f7;--sub:#a1a1a6;--dim:#6e6e73;--acc:#f08a24;--on:#1d1206;--ok:#30d158;color-scheme:dark}
@media (prefers-color-scheme:light){:root{--bg:#f2f2f5;--card:#fff;--card2:#ebebef;--line:rgba(0,0,0,.07);--txt:#111113;--sub:#6e6e73;--dim:#9a9aa0;--ok:#28b44c;color-scheme:light}}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body{height:100%}
body{background:var(--bg);color:var(--txt);font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column;height:100dvh;overflow:hidden}
svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
button{font:inherit;color:inherit;border:0;background:none;cursor:pointer}
button:active{transform:scale(.95)}

header{flex:none;display:flex;align-items:center;gap:10px;padding:calc(12px + env(safe-area-inset-top)) 16px 10px}
.brand{display:flex;align-items:center;gap:10px;flex:1;min-width:0;font-weight:700;font-size:18px;letter-spacing:-.2px}
.logo{width:34px;height:14px;border-radius:9px;background:#000;box-shadow:inset 0 0 0 1px rgba(255,255,255,.16),0 2px 8px rgba(0,0,0,.25);position:relative}
.logo::after{content:"";position:absolute;right:4px;top:4px;width:6px;height:6px;border-radius:50%;background:var(--acc)}
.st{display:flex;align-items:center;gap:7px;height:30px;padding:0 12px;border-radius:15px;background:var(--card);color:var(--sub);font-size:12.5px;font-weight:600;max-width:58vw}
.st b{width:7px;height:7px;border-radius:50%;background:var(--dim);flex:none;transition:.3s}
.st.on b{background:var(--ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--ok) 22%,transparent)}
.st span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

#list{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:6px 14px 14px;display:flex;flex-direction:column}
.note{align-self:center;display:flex;align-items:center;gap:5px;margin:2px 0 14px;font-size:11.5px;color:var(--dim)}
.note svg{width:12px;height:12px}
.b{max-width:84%;padding:10px 14px;border-radius:20px;background:var(--card)}
.b.new{animation:in .35s cubic-bezier(.2,.9,.3,1.2)}
.b.pc{align-self:flex-start;border-bottom-left-radius:6px}
.b.me{align-self:flex-end;background:var(--acc);color:var(--on);border-bottom-right-radius:6px}
.b.run{margin-bottom:4px;border-radius:20px}
@keyframes in{from{opacity:0;transform:translateY(8px) scale(.97)}}
.msg{white-space:pre-wrap;word-break:break-word}
.msg a{color:inherit;text-decoration:underline;text-underline-offset:2px}
.b.pc .msg a{color:var(--acc)}
.t{font-size:11px;color:var(--dim);margin:3px 8px 10px}
.t.me{align-self:flex-end}
.acts{display:flex;gap:6px;margin-top:9px}
.chip{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 13px;border-radius:16px;background:var(--card2);font-size:13px;font-weight:600}
.chip svg{width:15px;height:15px}
.file{display:flex;align-items:center;gap:12px;min-width:min(230px,70vw)}
.fi{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;flex:none;background:color-mix(in srgb,var(--acc) 16%,transparent);color:var(--acc)}
.me .fi{background:rgba(0,0,0,.12);color:var(--on)}
.fx{flex:1;min-width:0}
.fn{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fs{font-size:12px;opacity:.65;margin-top:1px}
.dl{width:38px;height:38px;border-radius:50%;flex:none;display:grid;place-items:center;background:var(--acc);color:var(--on);position:relative}
.dl.run{background:conic-gradient(var(--acc) calc(var(--p,0)*1%),var(--card2) 0);color:var(--txt)}
.dl.run::before{content:"";position:absolute;inset:3px;border-radius:50%;background:var(--card)}
.dl.run svg{position:relative;width:16px;height:16px}
.dl.done{background:color-mix(in srgb,var(--ok) 18%,transparent);color:var(--ok)}
.bar{height:4px;border-radius:2px;background:rgba(0,0,0,.15);overflow:hidden;margin-top:7px}
.bar i{display:block;height:100%;width:0;background:currentColor;transition:width .25s}

.empty{margin:auto;text-align:center;color:var(--sub);padding:20px 26px;max-width:320px}
.ei{width:64px;height:64px;border-radius:22px;margin:0 auto 14px;display:grid;place-items:center;background:var(--card);color:var(--acc)}
.ei svg{width:28px;height:28px}
.empty b,.gone h2{display:block;color:var(--txt);font-size:17px;font-weight:700;margin-bottom:6px}
.empty p{font-size:13.5px}

footer{flex:none;padding:6px 10px calc(10px + env(safe-area-inset-bottom))}
.quick{display:flex;gap:8px;padding:0 4px 8px}
.quick .chip{background:var(--card);color:var(--sub)}
.quick #dlall{color:var(--acc)}
.chip[hidden]{display:none}
.b.up .fs{margin-top:1px}
.composer{display:flex;align-items:flex-end;gap:6px;padding:5px;border-radius:26px;background:var(--card);box-shadow:inset 0 0 0 1px var(--line)}
.ib{width:42px;height:42px;border-radius:50%;flex:none;display:grid;place-items:center;background:var(--card2)}
#send{background:var(--acc);color:var(--on);transition:opacity .2s,transform .2s}
#send:disabled{opacity:.3;transform:none}
textarea{flex:1;min-width:0;height:42px;max-height:132px;resize:none;border:0;outline:none;background:none;color:inherit;font-family:inherit;font-size:16px;line-height:22px;padding:10px 6px}
textarea::placeholder{color:var(--dim)}

.gone{display:none;flex:1;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px 28px 60px;color:var(--sub)}
.gone ol{list-style:none;text-align:left;margin-top:18px;display:flex;flex-direction:column;gap:10px;font-size:14px}
.gone li{display:flex;gap:12px;align-items:center}
.gone li i{width:26px;height:26px;border-radius:50%;flex:none;display:grid;place-items:center;background:var(--card);color:var(--txt);font-size:12.5px;font-weight:700;font-style:normal}
body.off #list,body.off footer{display:none}
body.off .gone{display:flex}

.toast{position:fixed;left:50%;top:calc(8px + env(safe-area-inset-top));z-index:9;max-width:86vw;padding:10px 18px;border-radius:22px;background:#000;color:#fff;font-size:13.5px;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.35),inset 0 0 0 1px rgba(255,255,255,.1);transform:translate(-50%,-160%) scale(.8);transition:transform .45s cubic-bezier(.3,1.35,.5,1);pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.toast.show{transform:translate(-50%,0) scale(1)}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style></head><body>
<header><div class="brand"><span class="logo"></span>Adacık</div><div class="st" id="st"><b></b><span>Bağlanıyor…</span></div></header>
<div id="list"></div>
<footer>
  <div class="quick"><button class="chip" id="clip"><svg viewBox="0 0 24 24"><rect x="6" y="4" width="12" height="17" rx="2.5"/><path d="M9.5 4h5v3h-5z"/></svg>Panodakini gönder</button><button class="chip" id="dlall" hidden><svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg><span>Tümünü indir</span></button></div>
  <div class="composer">
    <button class="ib" id="pick" aria-label="Dosya gönder"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
    <textarea id="txt" rows="1" placeholder="Bilgisayara mesaj yaz"></textarea>
    <button class="ib" id="send" aria-label="Gönder" disabled><svg viewBox="0 0 24 24"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg></button>
  </div>
  <input type="file" id="file" multiple hidden>
</footer>
<div class="gone" id="gone"><div class="ei"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1.2"/><rect x="14" y="4" width="6" height="6" rx="1.2"/><rect x="4" y="14" width="6" height="6" rx="1.2"/><path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 20h1M20 14v1"/></svg></div>
  <h2>Bağlı değil</h2><p>Telefonu bilgisayara bağlamak için:</p>
  <ol><li><i>1</i>Bilgisayarda imleci adaya götür</li><li><i>2</i>Telefon sayfasını aç</li><li><i>3</i>QR kodu telefon kamerasıyla okut</li></ol></div>
<div class="toast" id="toast"></div>
<script src="/nacl.js"></script><script src="/p.js"></script>
</body></html>`;

module.exports = { Phone, lanIp };
