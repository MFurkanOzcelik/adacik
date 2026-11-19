// Phone link: a small HTTP server on the local network. A phone opens it by scanning a QR code
// (no app, no account). Each phone registers once and gets its own device key, so every phone only
// sees its own files and messages, and a single phone can be removed without affecting the others.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');

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
const same = (a, b) => !!a && !!b && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const newKey = () => crypto.randomBytes(18).toString('base64url');

class Phone {
  constructor({ store, save, emit, downloads, test }) {
    this.store = store; this.save = save; this.emit = emit; this.test = test;
    this.dir = path.join(downloads, 'Adacık');
    this.srv = null; this.clients = new Set();   // { res, dev }
    const p = store.phone || {};
    // older versions had one shared device without a key: those phones simply scan the QR code again
    store.phone = { token: p.token || newKey(), port: p.port || 0, devices: p.devices || {}, items: (p.items || []).filter(i => i.dev) };
    if (Object.keys(this.P.devices).length) this.start().catch(() => {});   // phones already paired: be reachable again
  }
  get P() { return this.store.phone; }
  url() { return this.srv ? `http://${this.ip}:${this.srv.address().port}/?k=${this.P.token}` : ''; }
  onlineIds() { return new Set([...this.clients].map(c => c.dev)); }
  state() {
    const on = this.onlineIds();
    const devices = Object.entries(this.P.devices).map(([id, d]) => ({ id, name: d.name, kind: d.kind, added: d.added, lastSeen: d.lastSeen, online: on.has(id) }))
      .sort((a, b) => (b.online - a.online) || (b.lastSeen - a.lastSeen));
    return { running: !!this.srv, url: this.url(), ip: this.ip || lanIp(), paired: devices.length > 0, devices, items: this.P.items };
  }
  push() { this.emit('phone:state', this.state()); }
  addItem(it) {
    it = { id: crypto.randomBytes(6).toString('hex'), at: Date.now(), ...it };
    this.P.items = [it, ...this.P.items].slice(0, 200); this.save(); this.push();
    this.broadcast(it.dev, 'item', this.pub(it)); return it;
  }
  pub(it) { const { path: _p, dev: _d, ...rest } = it; return rest; }   // never hand local paths or other phones' ids out
  broadcast(dev, ev, data) { const s = `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`; for (const c of this.clients) if (c.dev === dev) { try { c.res.write(s); } catch {} } }

  async start() {
    if (this.srv) return this.state();
    this.ip = this.test ? '127.0.0.1' : lanIp();
    if (!this.ip) throw new Error('Yerel ağ bağlantısı bulunamadı');
    const srv = http.createServer((q, r) => this.handle(q, r).catch(() => { try { r.writeHead(500); r.end(); } catch {} }));
    const listen = port => new Promise((res, rej) => { srv.once('error', rej); srv.listen(port, this.ip, () => { srv.removeListener('error', rej); res(); }); });
    try { await listen(this.P.port || 0); } catch { await listen(0); }   // keep the same port so a saved page keeps working
    this.srv = srv; this.P.port = srv.address().port; this.save();
    this.ping = setInterval(() => { for (const c of this.clients) { try { c.res.write('event: ping\ndata: 1\n\n'); } catch {} } }, 20000);
    this.push(); return this.state();
  }
  stop() { clearInterval(this.ping); for (const c of this.clients) { try { c.res.end(); } catch {} } this.clients.clear(); if (this.srv) { try { this.srv.closeAllConnections(); this.srv.close(); } catch {} } this.srv = null; this.push(); }
  // remove one phone: its key stops working and its items go away
  removeDevice(id) {
    delete this.P.devices[id];
    for (const c of [...this.clients]) if (c.dev === id) { try { c.res.end(); } catch {} this.clients.delete(c); }
    this.P.items = this.P.items.filter(i => i.dev !== id);
    if (!Object.keys(this.P.devices).length) { this.P.token = newKey(); this.save(); this.stop(); return; }
    this.save(); this.push();
  }
  newPairingCode() { this.P.token = newKey(); this.save(); this.push(); }

  // who is asking: a registered phone (device key) and/or someone holding the pairing code from the QR
  who(q) {
    const u = new URL(q.url, 'http://x'), ck = q.headers.cookie || '';
    const dk = u.searchParams.get('d') || q.headers['x-d'] || (ck.match(/(?:^|;\s*)kd=([^;]+)/) || [])[1];
    const pk = u.searchParams.get('k');
    let dev = null;
    if (dk) for (const [id, d] of Object.entries(this.P.devices)) if (same(dk, d.key)) { dev = id; break; }
    return { dev, pair: same(pk, this.P.token), u };
  }
  async handle(q, r) {
    const { dev, pair, u } = this.who(q), route = u.pathname;
    const json = (code, obj) => { r.writeHead(code, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(obj)); };
    if (route === '/favicon.ico') { r.writeHead(204); return r.end(); }
    if (route === '/manifest.json') { r.writeHead(200, { 'Content-Type': 'application/manifest+json' }); return r.end(JSON.stringify({ name: 'Adacık', short_name: 'Adacık', start_url: '/', display: 'standalone', background_color: '#000000', theme_color: '#000000' })); }
    if (route === '/') {
      if (!dev && !pair) { r.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' }); return r.end(PAGE_DENIED); }
      r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return r.end(PAGE);
    }
    if (route === '/register' && q.method === 'POST') {   // first visit from the QR code
      if (!pair) return json(403, { error: 'pair' });
      const ua = String(q.headers['user-agent'] || ''), ip = q.socket.remoteAddress;
      // the same phone scanning again (its saved key was lost, or it opened in another browser) keeps
      // its identity and history instead of starting an empty list
      let id = dev || Object.keys(this.P.devices).find(i => { const x = this.P.devices[i]; return x.ua === ua && x.ip === ip; });
      const d = deviceOf(ua);
      if (id) { const x = this.P.devices[id]; x.ua = ua; x.ip = ip; x.lastSeen = Date.now(); this.save(); this.push();
        r.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': `kd=${x.key}; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax` });
        return r.end(JSON.stringify({ key: x.key, name: x.name })); }
      id = crypto.randomBytes(5).toString('hex'); const key = newKey();
      this.P.devices[id] = { key, kind: d.kind, name: d.name, ua, ip, added: Date.now(), lastSeen: Date.now() }; this.save(); this.push();
      this.emit('phone:paired', { id, name: d.name, kind: d.kind });
      r.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': `kd=${key}; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax` });
      return r.end(JSON.stringify({ key, name: d.name }));
    }
    if (!dev) return json(403, { error: 'device' });
    const D = this.P.devices[dev];
    if (route === '/events') return this.sse(q, r, dev);
    if (route === '/items') return json(200, this.P.items.filter(i => i.dev === dev).map(i => this.pub(i)));
    if (route === '/msg' && q.method === 'POST') {
      let body = ''; for await (const c of q) { body += c; if (body.length > 20000) break; }
      let text = ''; try { text = String(JSON.parse(body).text || '').slice(0, 10000); } catch {}
      if (!text.trim()) return json(400, { error: 'empty' });
      this.addItem({ dev, dir: 'in', type: 'text', text }); this.emit('phone:incoming', { type: 'text', text, from: D.name });
      return json(200, { ok: true });
    }
    if (route === '/upload' && q.method === 'POST') {
      fs.mkdirSync(this.dir, { recursive: true });
      const dest = uniquePath(this.dir, safeName(u.searchParams.get('name'))), tmp = dest + '.part';
      let size = 0; const ws = fs.createWriteStream(tmp);
      try { for await (const c of q) { size += c.length; if (!ws.write(c)) await new Promise(res => ws.once('drain', res)); } await new Promise((res, rej) => ws.end(e => e ? rej(e) : res())); fs.renameSync(tmp, dest); }
      catch { try { ws.destroy(); fs.unlinkSync(tmp); } catch {} return json(500, { error: 'write' }); }
      const it = this.addItem({ dev, dir: 'in', type: 'file', name: path.basename(dest), size, path: dest });
      this.emit('phone:incoming', { type: 'file', name: it.name, size, from: D.name });
      return json(200, { ok: true, name: it.name });
    }
    const fm = route.match(/^\/file\/([0-9a-f]{12})$/);
    if (fm) {
      const it = this.P.items.find(i => i.id === fm[1] && i.type === 'file' && i.dev === dev);
      if (!it || !it.path || !fs.existsSync(it.path)) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': fs.statSync(it.path).size, 'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(it.name) });
      return fs.createReadStream(it.path).pipe(r);
    }
    r.writeHead(404); r.end();
  }
  sse(q, r, dev) {
    r.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    const D = this.P.devices[dev];
    r.write(`event: hello\ndata: ${JSON.stringify({ pc: os.hostname(), name: D.name, items: this.P.items.filter(i => i.dev === dev).map(i => this.pub(i)) })}\n\n`);
    const c = { res: r, dev }; this.clients.add(c);
    D.lastSeen = Date.now(); D.ip = q.socket.remoteAddress; this.save(); this.push();
    q.on('close', () => { this.clients.delete(c); if (this.P.devices[dev]) this.P.devices[dev].lastSeen = Date.now(); this.save(); this.push(); });
  }
  sendFiles(paths, dev) {
    if (!this.P.devices[dev]) return 0; let n = 0;
    for (const p of paths) { try { const st = fs.statSync(p); if (st.isFile()) { this.addItem({ dev, dir: 'out', type: 'file', name: path.basename(p), size: st.size, path: p }); n++; } } catch {} }
    return n;
  }
  sendText(text, dev) { text = String(text || '').trim(); if (!text || !this.P.devices[dev]) return false; this.addItem({ dev, dir: 'out', type: 'text', text: text.slice(0, 10000) }); return true; }
  remove(id) { const it = this.P.items.find(i => i.id === id); this.P.items = this.P.items.filter(i => i.id !== id); this.save(); this.push(); if (it) this.broadcast(it.dev, 'remove', id); }
  clear(dev) { this.P.items = this.P.items.filter(i => i.dev !== dev); this.save(); this.push(); this.broadcast(dev, 'clear', 1); }
  pathOf(id) { const it = this.P.items.find(i => i.id === id); return it && it.path; }
}

const PAGE_DENIED = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="background:#000;color:#ddd;font:16px system-ui;display:grid;place-items:center;height:90vh;text-align:center;padding:24px">
<div><h2 style="margin:0 0 8px">Bağlantı geçersiz</h2><p style="color:#999">Bilgisayarda Adacık → Telefon sayfasındaki QR kodunu yeniden okut.</p></div>
<script>try{var d=localStorage.getItem('kd');if(d&&location.search.indexOf('d=')<0)location.replace('/?d='+encodeURIComponent(d))}catch(e){}</script></body>`;

const PAGE = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#000000"><meta name="apple-mobile-web-app-capable" content="yes"><link rel="manifest" href="/manifest.json">
<title>Adacık</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
body{background:#000;color:#f2f2f2;font:15px/1.4 -apple-system,system-ui,"Segoe UI",Roboto,sans-serif;padding:16px 16px calc(24px + env(safe-area-inset-bottom));min-height:100vh}
header{display:flex;align-items:center;gap:10px;margin:6px 2px 18px}
.eyes{display:flex;gap:5px}.eyes i{width:9px;height:15px;border-radius:50%;background:#fff;box-shadow:0 0 10px rgba(160,200,255,.8)}
h1{font-size:18px;font-weight:650;flex:1}
.st{font-size:12.5px;color:#9a9a9a;display:flex;align-items:center;gap:6px}.st b{width:8px;height:8px;border-radius:50%;background:#555}.st.on b{background:#34c759}
.card{background:#141414;border-radius:20px;padding:16px;margin-bottom:12px}
.big{display:flex;gap:10px}
.btn{flex:1;height:52px;border:0;border-radius:16px;background:#f08a24;color:#1b1206;font:inherit;font-weight:650;display:flex;align-items:center;justify-content:center;gap:8px}
.btn.alt{background:#262626;color:#f2f2f2}
.btn:active{transform:scale(.97)}
textarea{width:100%;min-height:70px;resize:vertical;background:#0c0c0c;color:#fff;border:1px solid #2a2a2a;border-radius:14px;padding:12px;font:inherit;outline:none}
textarea:focus{border-color:#f08a24}
.row{display:flex;gap:10px;margin-top:10px}
.lb{color:#8a8a8a;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;margin:18px 4px 8px}
.it{background:#141414;border-radius:16px;padding:12px 14px;margin-bottom:8px;display:flex;gap:12px;align-items:center;animation:in .3s ease}
@keyframes in{from{opacity:0;transform:translateY(-4px)}}
.it .ic{width:38px;height:38px;border-radius:11px;background:#222;display:grid;place-items:center;flex:none;font-size:18px}
.it.from-pc .ic{background:rgba(240,138,36,.18)}
.it .tx{flex:1;min-width:0}.it .nm{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.it .msg{white-space:pre-wrap;word-break:break-word}
.it small{color:#888;font-size:12px}
.it a,.it button{color:#f08a24;font-weight:600;text-decoration:none;background:none;border:0;font:inherit;padding:6px 4px}
.prog{height:4px;background:#2a2a2a;border-radius:2px;overflow:hidden;margin-top:6px}.prog i{display:block;height:100%;width:0;background:#f08a24;transition:width .2s}
.empty{color:#777;text-align:center;padding:24px 8px;font-size:13.5px}
.gone{display:none;text-align:center;padding:60px 16px;color:#aaa}.gone h2{color:#fff;margin-bottom:8px}
.toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%) translateY(20px);background:#222;color:#fff;padding:10px 16px;border-radius:14px;opacity:0;transition:.3s;font-size:14px}
.toast.show{opacity:1;transform:translateX(-50%)}
</style></head><body>
<header><div class="eyes"><i></i><i></i></div><h1>Adacık</h1><div class="st" id="st"><b></b><span>Bağlanıyor…</span></div></header>
<main id="app">
<div class="card"><div class="big"><button class="btn" id="pick">⬆ Dosya gönder</button></div>
  <input type="file" id="file" multiple hidden>
  <div class="row" style="margin-top:12px"><textarea id="txt" placeholder="Bilgisayara mesaj veya bağlantı gönder"></textarea></div>
  <div class="row"><button class="btn alt" id="send">Gönder</button><button class="btn alt" id="clip">Panodakini gönder</button></div></div>
<div class="lb">Bu telefonla paylaşılanlar</div><div id="list"></div>
</main>
<div class="gone" id="gone"><h2>Bağlantı kaldırıldı</h2><p>Yeniden bağlanmak için bilgisayardaki QR kodunu okut.</p></div>
<div class="toast" id="toast"></div>
<script>
const $=s=>document.querySelector(s), list=$('#list'); let items=[];
const K=new URLSearchParams(location.search).get('k')||'';
let DK=new URLSearchParams(location.search).get('d')||'';
try{DK=DK||localStorage.getItem('kd')||''}catch(e){}
if(location.search)history.replaceState(null,'','/');
const q=p=>DK?p+(p.indexOf('?')<0?'?':'&')+'d='+encodeURIComponent(DK):p;
const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),1800)};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const size=b=>b>=1048576?(b/1048576).toFixed(1).replace('.',',')+' MB':b>=1024?Math.round(b/1024)+' KB':b+' B';
const ago=t=>{const s=(Date.now()-t)/1000;return s<60?'şimdi':s<3600?Math.floor(s/60)+' dk önce':new Date(t).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})};
const linkify=t=>esc(t).replace(/https?:\\/\\/[^\\s<]+/g,u=>'<a href="'+u+'" target="_blank" rel="noopener">'+u+'</a>');
function gone(){$('#app').style.display='none';$('#gone').style.display='block';$('#st').classList.remove('on');$('#st span').textContent='Bağlı değil';try{localStorage.removeItem('kd')}catch(e){}}
function draw(){
  list.innerHTML=items.length?items.map(i=>{
    const pc=i.dir==='out', from=pc?'Bilgisayardan':'Bu telefondan', cls=pc?'from-pc':'from-me';
    if(i.type==='file')return '<div class="it '+cls+'"><div class="ic">'+(pc?'⬇':'⬆')+'</div><div class="tx"><div class="nm">'+esc(i.name)+'</div><small>'+from+' · '+size(i.size)+' · '+ago(i.at)+'</small></div>'+(pc?'<a href="'+q('/file/'+i.id)+'" download>İndir</a>':'')+'</div>';
    return '<div class="it '+cls+'"><div class="ic">💬</div><div class="tx"><div class="msg">'+linkify(i.text)+'</div><small>'+from+' · '+ago(i.at)+'</small></div>'+(pc?'<button data-copy="'+i.id+'">Kopyala</button>':'')+'</div>';
  }).join(''):'<div class="empty">Henüz bir şey yok. Bilgisayardan gönderilenler burada görünür.</div>';
  list.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{const it=items.find(x=>x.id===b.dataset.copy);try{await navigator.clipboard.writeText(it.text);toast('Kopyalandı')}catch(e){toast('Kopyalanamadı')}});
}
// a phone registers once with the code from the QR; after that it only uses its own device key
async function register(){
  if(DK){const r=await fetch(q('/items'));if(r.ok)return true;if(r.status!==403)return true;DK='';try{localStorage.removeItem('kd')}catch(e){}}
  if(!K){const r=await fetch('/items');return r.ok}
  const r=await fetch('/register?k='+encodeURIComponent(K),{method:'POST'});if(!r.ok)return false;
  const j=await r.json();DK=j.key;try{localStorage.setItem('kd',DK)}catch(e){}return true;
}
let es;
function connect(){
  es=new EventSource(q('/events'));
  es.addEventListener('hello',e=>{const d=JSON.parse(e.data);items=d.items;draw();$('#st').classList.add('on');$('#st span').textContent=d.pc+' bağlı'});
  es.addEventListener('item',e=>{const it=JSON.parse(e.data);items.unshift(it);draw();if(it.dir==='out'){toast(it.type==='file'?'Yeni dosya: '+it.name:'Yeni mesaj');if(navigator.vibrate)navigator.vibrate(40)}});
  es.addEventListener('remove',e=>{const id=JSON.parse(e.data);items=items.filter(i=>i.id!==id);draw()});
  es.addEventListener('clear',()=>{items=[];draw()});
  es.onerror=async()=>{$('#st').classList.remove('on');$('#st span').textContent='Bağlantı bekleniyor…';try{const r=await fetch(q('/items'));if(r.status===403){es.close();gone()}}catch(e){}};
}
function upload(f){
  const row=document.createElement('div');row.className='it';row.innerHTML='<div class="ic">⬆</div><div class="tx"><div class="nm">'+esc(f.name)+'</div><div class="prog"><i></i></div></div>';list.prepend(row);
  const x=new XMLHttpRequest();x.open('POST',q('/upload?name='+encodeURIComponent(f.name)));
  x.upload.onprogress=e=>{if(e.lengthComputable)row.querySelector('.prog i').style.width=(e.loaded/e.total*100)+'%'};
  x.onload=()=>{row.remove();if(x.status===200)toast('Gönderildi: '+f.name);else toast('Gönderilemedi')};
  x.onerror=()=>{row.remove();toast('Gönderilemedi')};x.send(f);
}
$('#pick').onclick=()=>$('#file').click();
$('#file').onchange=e=>{[...e.target.files].forEach(upload);e.target.value=''};
async function sendText(t){t=t.trim();if(!t)return;const r=await fetch(q('/msg'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:t})});if(r.ok){$('#txt').value='';toast('Gönderildi')}else toast('Gönderilemedi')}
$('#send').onclick=()=>sendText($('#txt').value);
$('#clip').onclick=async()=>{try{const t=await navigator.clipboard.readText();if(t)sendText(t);else toast('Pano boş')}catch(e){toast('Panoya erişilemedi; metni kutuya yapıştır')}};
setInterval(draw,60000);
register().then(ok=>ok?connect():gone()).catch(()=>gone());
</script></body></html>`;

module.exports = { Phone, lanIp };
