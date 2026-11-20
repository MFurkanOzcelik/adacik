// Runs in the phone's browser (served by phone.js). Pairs with the PC through the one-time secret in
// the QR link's #fragment and then seals every request, message and file chunk with its own key.
'use strict';
(function () {
  const $ = s => document.querySelector(s), list = $('#list'); let items = [];
  const te = new TextEncoder(), td = new TextDecoder();
  const b64u = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = s => { s = String(s || '').replace(/-/g, '+').replace(/_/g, '/'); const b = atob(s + '==='.slice((s.length + 3) % 4)); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const sealBytes = (k, bytes) => { const n = nacl.randomBytes(24), box = nacl.secretbox(bytes, n, k), o = new Uint8Array(24 + box.length); o.set(n); o.set(box, 24); return o; };
  const openBytes = (k, d) => d && d.length >= 40 ? nacl.secretbox.open(d.subarray(24), d.subarray(0, 24), k) : null;
  const seal = (k, obj) => b64u(sealBytes(k, te.encode(JSON.stringify(obj))));
  const open = (k, s) => { const b = openBytes(k, unb64u(s)); if (!b) return null; try { return JSON.parse(td.decode(b)); } catch (e) { return null; } };

  // the pairing secret lives in the #fragment, which the browser never sends; drop it from the address bar
  const P = (location.hash.match(/[#&]p=([\w-]+)/) || [])[1] || '';
  if (location.hash || location.search) history.replaceState(null, '', '/');
  let dev = null, key = null, off = 0;   // off: PC clock minus phone clock
  try { const s = JSON.parse(localStorage.getItem('adacik.dev') || 'null'); if (s && s.id && s.key) { dev = s.id; key = unb64u(s.key); } } catch (e) {}
  const now = () => Date.now() + off;
  // a single-use token for one request: only this phone can make it, and it works once
  const tok = (p, extra) => '?i=' + encodeURIComponent(dev) + '&a=' + seal(key, Object.assign({ p, t: now(), n: b64u(nacl.randomBytes(12)) }, extra || {}));

  const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('show'), 2000); };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const size = b => b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' KB' : b + ' B';
  const ago = t => { const s = (now() - t) / 1000; if (s < 60) return 'şimdi'; if (s < 3600) return Math.floor(s / 60) + ' dk önce'; const d = new Date(t), hm = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); return new Date(now()).toDateString() === d.toDateString() ? hm : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + ' ' + hm; };
  const linkify = t => esc(t).replace(/https?:\/\/[^\s<]+/g, u => '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + '</a>');
  const status = (on, text) => { $('#st').classList.toggle('on', on); $('#st span').textContent = text; };
  function gone() { document.body.classList.add('off'); status(false, 'Bağlı değil'); }

  const IC = {
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 16-4.5-4.5L7 19.5"/>',
    play: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="m10 9.2 5 2.8-5 2.8z"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    down: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    inbox: '<path d="M4 13.5 6.5 5h11l2.5 8.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 13.5h4.5l1 2h5l1-2H20"/>'
  };
  const ic = n => '<svg viewBox="0 0 24 24">' + IC[n] + '</svg>';
  const kind = n => /\.(jpe?g|png|gif|webp|heic|heif|bmp|svg)$/i.test(n) ? 'image' : /\.(mp4|mov|mkv|webm|avi|3gp)$/i.test(n) ? 'play' : /\.(mp3|m4a|wav|flac|ogg|opus|aac)$/i.test(n) ? 'music' : 'file';
  const saved = new Set();   // files downloaded in this visit

  // A chat: what the PC sent on the left, what this phone sent on the right, the newest at the bottom.
  const shown = new Set();   // bubbles already on screen: only new ones animate in
  function bubble(i, idx, arr) {
    const pc = i.dir === 'out', side = pc ? 'pc' : 'me', nx = arr[idx + 1];
    // one time stamp under a run of bubbles from the same side sent within 5 minutes
    const time = !nx || nx.dir !== i.dir || nx.at - i.at > 300000;
    const anim = shown.size && !shown.has(i.id) ? ' new' : ''; shown.add(i.id);
    let inner;
    if (i.type === 'file') {
      const btn = !pc ? '' : saved.has(i.id) ? '<button class="dl done" data-dl="' + i.id + '" aria-label="Yeniden indir">' + ic('check') + '</button>' : '<button class="dl" data-dl="' + i.id + '" aria-label="İndir">' + ic('down') + '</button>';
      inner = '<div class="file"><div class="fi">' + ic(kind(i.name)) + '</div><div class="fx"><div class="fn">' + esc(i.name) + '</div><div class="fs">' + size(i.size) + '</div></div>' + btn + '</div>';
    } else {
      inner = '<div class="msg">' + linkify(i.text) + '</div>' + (pc ? '<div class="acts"><button class="chip" data-copy="' + i.id + '">' + ic('copy') + 'Kopyala</button></div>' : '');
    }
    return '<div class="b ' + side + anim + (time ? '' : ' run') + '">' + inner + '</div>' + (time ? '<div class="t ' + side + '">' + ago(i.at) + '</div>' : '');
  }
  function draw() {
    const atEnd = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    const pending = [...list.querySelectorAll('.up')];   // uploads in progress survive a redraw
    if (!shown.size) items.forEach(i => shown.add(i.id));   // the first paint doesn't animate either
    list.innerHTML = '<div class="note">' + ic('lock') + 'Uçtan uca şifreli</div>' + (items.length ? items.slice().reverse().map(bubble).join('')
      : '<div class="empty"><div class="ei">' + ic('inbox') + '</div><b>Henüz bir şey yok</b><p>Bilgisayardan gönderilenler burada görünür. Alttan dosya ya da mesaj gönderebilirsin.</p></div>');
    pending.forEach(p => list.appendChild(p));
    list.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => { const it = items.find(x => x.id === b.dataset.copy); try { await navigator.clipboard.writeText(it.text); b.innerHTML = ic('check') + 'Kopyalandı'; toast('Panoya kopyalandı'); setTimeout(() => { b.innerHTML = ic('copy') + 'Kopyala'; }, 1800); } catch (e) { toast('Kopyalanamadı'); } });
    list.querySelectorAll('[data-dl]').forEach(b => b.onclick = () => download(items.find(x => x.id === b.dataset.dl), b));
    if (atEnd || draw.jump) { draw.jump = false; list.scrollTop = list.scrollHeight; }
    paintAll();
  }

  async function pair() {
    const k = nacl.randomBytes(32);
    const r = await fetch('/pair', { method: 'POST', body: seal(unb64u(P), { key: b64u(k), t: now() }) });
    if (!r.ok) return false;
    const j = open(k, await r.text()); if (!j) return false;
    dev = j.id; key = k;
    try { localStorage.setItem('adacik.dev', JSON.stringify({ id: dev, key: b64u(key) })); } catch (e) {}
    return true;
  }
  async function valid() { if (!dev) return false; const r = await fetch('/items' + tok('/items')); if (r.status === 403) return false; return true; }

  let es = null;
  function connect() {
    if (es) es.close();
    es = new EventSource('/events' + tok('/events'));
    const on = (ev, f) => es.addEventListener(ev, e => { const d = open(key, e.data); if (d !== null) f(d); });
    on('hello', d => { document.body.classList.remove('off'); items = d.items; draw.jump = true; draw(); status(true, d.pc); });
    on('item', it => {
      const seen = list.scrollHeight - list.scrollTop - list.clientHeight < 80 && !document.hidden;   // the new bubble will be in view
      items.unshift(it); draw.jump = it.dir === 'in'; draw();
      if (it.dir === 'out') { if (navigator.vibrate) navigator.vibrate(40); if (!seen) toast(it.type === 'file' ? 'Yeni dosya: ' + it.name : 'Yeni mesaj'); }
    });
    on('remove', id => { items = items.filter(i => i.id !== id); draw(); });
    on('clear', () => { items = []; draw(); });
    // every connection needs a fresh single-use token, so reconnect by hand
    es.onerror = () => {
      es.close(); es = null; status(false, 'Bağlantı bekleniyor…');
      setTimeout(async () => { try { if (await valid()) connect(); else { try { localStorage.removeItem('adacik.dev'); } catch (e) {} gone(); } } catch (e) { es || connect(); } }, 2500);
    };
  }

  const CHUNK = 256 * 1024;
  // Several files at once: every one gets its bubble right away ("Sırada"), then they go one after another.
  const queue = []; let sending = false;
  function addUploads(files) {
    if (!files.length) return;
    list.querySelector('.empty') && list.querySelector('.empty').remove();
    for (const f of files) {
      const row = document.createElement('div'); row.className = 'b me up';
      row.innerHTML = '<div class="file"><div class="fi">' + ic(kind(f.name)) + '</div><div class="fx"><div class="fn">' + esc(f.name) + '</div><div class="fs">Sırada · ' + size(f.size) + '</div><div class="bar"><i></i></div></div></div>';
      list.appendChild(row); queue.push({ f, row });
    }
    list.scrollTop = list.scrollHeight;
    if (files.length > 1) toast(files.length + ' dosya gönderiliyor');
    pump();
  }
  async function pump() {
    if (sending) return; sending = true; let fail = 0;
    while (queue.length) { const q = queue.shift(); if (!(await upload(q.f, q.row))) fail++; }
    sending = false; if (fail) toast(fail === 1 ? 'Bir dosya gönderilemedi' : fail + ' dosya gönderilemedi');
  }
  async function upload(f, row) {
    const up = b64u(nacl.randomBytes(9)), total = Math.max(1, Math.ceil(f.size / CHUNK)), fs = row.querySelector('.fs');
    let ok = false;
    try {
      for (let seq = 0; seq < total; seq++) {
        const buf = new Uint8Array(await f.slice(seq * CHUNK, (seq + 1) * CHUNK).arrayBuffer());
        const r = await fetch('/up' + tok('/up', { up, seq, last: seq === total - 1, name: f.name }), { method: 'POST', body: sealBytes(key, buf) });
        if (!r.ok) throw new Error(r.status);
        const p = Math.round((seq + 1) / total * 100); row.querySelector('.bar i').style.width = p + '%'; fs.textContent = '%' + p + ' · ' + size(f.size);
      }
      ok = true;
    } catch (e) {}
    row.remove();   // the PC echoes the finished file back as a regular bubble
    return ok;
  }
  // PC files this visit hasn't saved yet; with two or more a "Tümünü indir" chip appears
  const waiting = () => items.filter(i => i.dir === 'out' && i.type === 'file' && !saved.has(i.id));
  function paintAll() { const b = $('#dlall'), n = waiting().length; b.hidden = n < 2 || downloadingAll; b.lastChild.textContent = 'Tümünü indir (' + n + ')'; }
  let downloadingAll = false;
  async function downloadAll() {
    const todo = waiting().slice().reverse(); if (!todo.length) return;   // oldest first, like they were sent
    downloadingAll = true; paintAll(); toast(todo.length + ' dosya indiriliyor');
    for (const it of todo) { const btn = list.querySelector('[data-dl="' + it.id + '"]'); if (btn) await download(it, btn); }
    downloadingAll = false; paintAll();
  }
  async function download(it, btn) {
    if (btn.disabled) return;
    btn.disabled = true; btn.classList.remove('done'); btn.classList.add('run'); btn.style.setProperty('--p', 0); btn.innerHTML = ic('down');
    let ok = false;
    try {
      const r = await fetch('/file/' + it.id + tok('/file/' + it.id)); if (!r.ok) throw new Error(r.status);
      const rd = r.body.getReader(), parts = []; let buf = new Uint8Array(0), got = 0;
      for (;;) {
        const { value, done } = await rd.read();
        if (value) { const nb = new Uint8Array(buf.length + value.length); nb.set(buf); nb.set(value, buf.length); buf = nb; }
        while (buf.length >= 4) {   // [4-byte length][sealed chunk]
          const n = (buf[0] << 24 | buf[1] << 16 | buf[2] << 8 | buf[3]) >>> 0; if (buf.length < 4 + n) break;
          const plain = openBytes(key, buf.subarray(4, 4 + n)); if (!plain) throw new Error('bozuk');
          parts.push(plain); got += plain.length; buf = buf.slice(4 + n);
          btn.style.setProperty('--p', Math.round(got / Math.max(1, it.size) * 100));
        }
        if (done) break;
      }
      const url = URL.createObjectURL(new Blob(parts));
      const a = document.createElement('a'); a.href = url; a.download = it.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      ok = true; saved.add(it.id); paintAll();
    } catch (e) { toast('İndirilemedi'); }
    btn.disabled = false; btn.classList.remove('run'); btn.classList.toggle('done', ok); btn.innerHTML = ic(ok ? 'check' : 'down');
  }
  // the sent message shows up as a bubble (the PC echoes it back), so success needs no toast
  async function sendText(t, fromBox) {
    t = t.trim(); if (!t) return false;
    let ok = false; try { ok = (await fetch('/msg' + tok('/msg'), { method: 'POST', body: seal(key, { text: t }) })).ok; } catch (e) {}
    if (!ok) toast('Gönderilemedi'); else if (fromBox) { txt.value = ''; grow(); }
    return ok;
  }
  const txt = $('#txt'), sendBtn = $('#send');
  // the box grows with the text (up to ~5 lines); the send button wakes up when there is something to send
  function grow() { txt.style.height = '42px'; txt.style.height = Math.min(132, txt.scrollHeight) + 'px'; sendBtn.disabled = !txt.value.trim(); }
  txt.addEventListener('input', grow);
  // on a phone Enter makes a new line; with a hardware keyboard Ctrl/⌘+Enter sends
  txt.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendText(txt.value, true); } });
  $('#pick').onclick = () => $('#file').click();
  $('#file').onchange = e => { addUploads([...e.target.files]); e.target.value = ''; };
  $('#dlall').onclick = downloadAll;
  sendBtn.onclick = () => { sendText(txt.value, true); txt.focus(); };
  $('#clip').onclick = async () => { try { const t = await navigator.clipboard.readText(); if (t && t.trim()) sendText(t); else toast('Pano boş'); } catch (e) { toast('Panoya erişilemedi, metni kutuya yapıştır'); } };
  setInterval(draw, 60000);

  (async () => {
    try { const r = await fetch('/time'); off = (+(await r.text()) || Date.now()) - Date.now(); } catch (e) {}
    try {
      // a phone that is already paired ignores the QR code; otherwise the QR code pairs it
      if (await valid()) return connect();
      try { localStorage.removeItem('adacik.dev'); } catch (e) {} dev = null; key = null;
      if (P && await pair()) return connect();
    } catch (e) {}
    gone();
  })();
})();
