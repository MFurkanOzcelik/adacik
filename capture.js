'use strict';
const bg = document.getElementById('bg'), sel = document.getElementById('sel'), size = document.getElementById('size');
let start = null, rect = null, sent = false;
if (location.search.includes('mode=ocr')) document.getElementById('hint').innerHTML = 'Metni okumak için alanı <b>sürükle</b> · Tüm ekran için <b>tıkla</b> · İptal için <b>Esc</b>';
const done = r => { if (sent) return; sent = true; api.send('cap:done', r); };
const MODE = new URLSearchParams(location.search).get('mode');

// ---- colour picker: magnifier over the frozen screen, click to pick a pixel ----
if (MODE === 'pick') {
  document.body.classList.add('picking');
  document.getElementById('hint').innerHTML = 'Renk seçmek için <b>tıkla</b> · İnce ayar için <b>ok tuşları</b> · İptal için <b>Esc</b>';
  const loupe = document.createElement('div'); loupe.id = 'loupe';
  loupe.innerHTML = '<canvas width="154" height="154"></canvas><div class="lhex"><i></i><span></span></div>';
  document.body.appendChild(loupe);
  const lc = loupe.querySelector('canvas').getContext('2d'), sw = loupe.querySelector('.lhex i'), hx = loupe.querySelector('.lhex span');
  const src = document.createElement('canvas'), sc = src.getContext('2d', { willReadFrequently: true });
  let px = innerWidth / 2, py = innerHeight / 2, ready = false, color = '#000000';
  bg.addEventListener('load', () => { src.width = bg.naturalWidth; src.height = bg.naturalHeight; sc.drawImage(bg, 0, 0); ready = true; paint(); });
  const toHex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  function paint() {
    if (!ready) return;
    const k = src.width / innerWidth, sx = Math.min(src.width - 1, Math.max(0, Math.round(px * k))), sy = Math.min(src.height - 1, Math.max(0, Math.round(py * k)));
    const N = 11, Z = 14;   // 11×11 pixels, 14× zoom
    lc.imageSmoothingEnabled = false; lc.fillStyle = '#000'; lc.fillRect(0, 0, 154, 154);
    lc.drawImage(src, sx - 5, sy - 5, N, N, 0, 0, N * Z, N * Z);
    lc.strokeStyle = 'rgba(255,255,255,.12)'; lc.lineWidth = 1;
    for (let i = 1; i < N; i++) { lc.beginPath(); lc.moveTo(i * Z + .5, 0); lc.lineTo(i * Z + .5, 154); lc.moveTo(0, i * Z + .5); lc.lineTo(154, i * Z + .5); lc.stroke(); }
    lc.lineWidth = 2; lc.strokeStyle = '#fff'; lc.strokeRect(5 * Z + 1, 5 * Z + 1, Z - 2, Z - 2);
    lc.strokeStyle = 'rgba(0,0,0,.6)'; lc.lineWidth = 1; lc.strokeRect(5 * Z - .5, 5 * Z - .5, Z + 1, Z + 1);
    const p = sc.getImageData(sx, sy, 1, 1).data; color = toHex(p[0], p[1], p[2]);
    sw.style.background = color; hx.textContent = color;
    // keep the loupe on screen near the edges
    const w = 154, h = 186, ox = px + 22 + w > innerWidth ? px - 22 - w : px + 22, oy = py + 22 + h > innerHeight ? py - 22 - h : py + 22;
    loupe.style.transform = `translate(${ox}px, ${oy}px)`;
  }
  addEventListener('mousemove', e => { px = e.clientX; py = e.clientY; paint(); }, true);
  addEventListener('mousedown', e => { e.stopImmediatePropagation(); if (e.button !== 0) return done(null); px = e.clientX; py = e.clientY; paint(); done({ color }); }, true);
  addEventListener('mouseup', e => e.stopImmediatePropagation(), true);
  addEventListener('keydown', e => {
    e.stopImmediatePropagation();
    const step = e.shiftKey ? 10 : 1, k = innerWidth / (src.width || innerWidth);
    if (e.key === 'Escape') return done(null);
    if (e.key === 'Enter' || e.key === ' ') return done({ color });
    if (e.key === 'ArrowLeft') px -= step * k; else if (e.key === 'ArrowRight') px += step * k; else if (e.key === 'ArrowUp') py -= step * k; else if (e.key === 'ArrowDown') py += step * k; else return;
    e.preventDefault(); paint();
  }, true);
}


api.invoke('cap:img').then(u => { if (u) bg.src = u; else done(null); });

function draw(e) {
  const x = Math.min(start.x, e.clientX), y = Math.min(start.y, e.clientY);
  const w = Math.abs(e.clientX - start.x), h = Math.abs(e.clientY - start.y);
  rect = { x, y, w, h };
  Object.assign(sel.style, { display: 'block', left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  size.textContent = Math.round(w * devicePixelRatio) + ' × ' + Math.round(h * devicePixelRatio);
  Object.assign(size.style, { display: 'block', left: x + 'px', top: Math.max(4, y - 26) + 'px' });
}
addEventListener('mousedown', e => { if (e.button !== 0) return done(null); start = { x: e.clientX, y: e.clientY }; rect = null; });
addEventListener('mousemove', e => { if (!start) return; if (!rect && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 4) return; document.body.classList.add('dragging'); draw(e); });
addEventListener('mouseup', e => {
  if (!start || e.button !== 0) return;
  // a plain click (no drag) captures the whole screen
  done(rect && rect.w >= 4 && rect.h >= 4 ? rect : { x: 0, y: 0, w: 0, h: 0 });
});
addEventListener('keydown', e => {
  if (e.key === 'Escape') done(null);
  if (e.key === 'Enter') done(rect || { x: 0, y: 0, w: 0, h: 0 });
});
addEventListener('contextmenu', e => { e.preventDefault(); done(null); });
