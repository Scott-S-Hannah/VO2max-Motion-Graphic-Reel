'use strict';
/* =====================================================================
   What is VO2max? — motion graphic reel (1080x1920, 30 fps, 58 s)
   Deterministic canvas timeline: renderFrame(t) draws the frame at time t.
   Brand: University of Winchester palette (Plum / Manhattan peach / Lochinvar teal), Figtree.
   ===================================================================== */
const W = 1080, H = 1920, FPS = 30;
const REEL = { DURATION: 58, FPS };
window.REEL = REEL;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');

const C = {
  plum: '#702A69', plumMid: '#8E3F86', plumDeep: '#3E1339', plumInk: '#1E0A1C',
  peach: '#F2BF94', peachDeep: '#C97A45', teal: '#257478', tealLight: '#6BBAB6', tealDeep: '#123F42',
  cream: '#FBF4EC',
  paper: '#E9DBBF', paperLight: '#F3E9D6', paperDark: '#BFA27A', ink: '#3A2716', inkSoft: '#6E5537',
  lab: '#170915', stamp: '#7A2A55',
};

// Scene start times (s). Music is 120 bpm from T.name, every cut lands on a beat.
const T = { open: 0, graph: 8, name: 14.5, path: 21, units: 31, test: 38.5, why: 47, outro: 54, end: 58 };

/* ---------------------------------------------------------------- utils */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const P = (u, a, b) => clamp((u - a) / (b - a));
const E = {
  lin: t => t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuint: t => 1 - Math.pow(1 - t, 5),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
};
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash = n => mulberry32(n * 9973 + 12345)();
const jit = (f, k) => hash(f * 31 + k) * 2 - 1;
const smin = (a, b, k) => -Math.log(Math.exp(-k * a) + Math.exp(-k * b)) / k;
let FRAME = 0;

function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); }
function withAlpha(a, fn) { ctx.save(); ctx.globalAlpha *= a; fn(); ctx.restore(); }

/* ------------------------------------------------------------ rich text
   Markup:  _{..} subscript   ^{..} superscript   *..* accent colour
            V̇ = V with rate dot     v̄ = v with bar (mixed venous)
   Glyphs missing from Figtree (≈ ≥ → ✓) are drawn as vectors.            */
const CUSTOM = { '≈': 0.62, '≥': 0.6, '→': 0.92, '✓': 0.72 };
function parseRich(str) {
  const toks = []; let hl = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '*') { hl = !hl; continue; }
    if ((c === '_' || c === '^') && str[i + 1] === '{') {
      const j = str.indexOf('}', i), mode = c === '_' ? 'sub' : 'sup';
      for (const ch of str.slice(i + 2, j)) toks.push({ ch, mode, hl });
      i = j; continue;
    }
    if (c === '̇' || c === '̄') { if (toks.length) toks[toks.length - 1].mark = c === '̇' ? 'dot' : 'bar'; continue; }
    toks.push({ ch: c, mode: 'n', hl });
  }
  return toks;
}
const fontFor = (o, mode) => `${o.italic ? 'italic ' : ''}${o.weight || 500} ${mode === 'n' ? o.size : o.size * 0.62}px Figtree`;
const layoutCache = new Map();
function layout(str, o) {
  const key = [str, o.size, o.weight || 500, o.italic ? 1 : 0, o.maxW || 0, o.ls || 0, o.lh || 0].join('|');
  if (layoutCache.has(key)) return layoutCache.get(key);
  const toks = parseRich(str);
  const words = []; let cur = [];
  const flush = br => { if (cur.length) { words.push({ toks: cur }); cur = []; } if (br) words.push({ br: true }); };
  for (const t of toks) {
    if (t.ch === ' ' && t.mode === 'n') flush(false);
    else if (t.ch === '\n') flush(true);
    else cur.push(t);
  }
  flush(false);
  ctx.save();
  ctx.letterSpacing = (o.ls || 0) + 'px';
  ctx.font = fontFor(o, 'n');
  const spaceW = ctx.measureText(' ').width;
  const built = [];
  for (const w of words) {
    if (w.br) { built.push({ br: true }); continue; }
    const runs = []; let r = null;
    for (const t of w.toks) {
      const custom = CUSTOM[t.ch] !== undefined, solo = custom || !!t.mark;
      if (!r || solo || r.solo || r.mode !== t.mode || r.hl !== t.hl) { r = { text: '', mode: t.mode, hl: t.hl, solo, mark: t.mark, custom }; runs.push(r); }
      r.text += t.ch;
    }
    let x = 0;
    for (const r of runs) {
      const s = r.mode === 'n' ? o.size : o.size * 0.62;
      if (r.custom) r.w = CUSTOM[r.text] * s + (o.ls || 0);
      else { ctx.font = fontFor(o, r.mode); r.w = ctx.measureText(r.text).width; }
      r.x = x; x += r.w;
    }
    built.push({ runs, w: x, n: runs.reduce((a, r) => a + r.text.length, 0) });
  }
  ctx.restore();
  const lines = []; let ln = { words: [], w: 0 }; const maxW = o.maxW || 1e9;
  let idx = 0, cidx = 0;
  for (const w of built) {
    if (w.br) { lines.push(ln); ln = { words: [], w: 0 }; continue; }
    if (ln.words.length && ln.w + spaceW + w.w > maxW) { lines.push(ln); ln = { words: [], w: 0 }; }
    const x0 = ln.words.length ? ln.w + spaceW : 0;
    ln.words.push({ ...w, x: x0, idx: idx++, c0: cidx });
    cidx += w.n + 1; ln.w = x0 + w.w;
  }
  lines.push(ln);
  const res = { lines, nWords: idx, nChars: cidx, lh: (o.lh || 1.22) * o.size, w: Math.max(...lines.map(l => l.w)) };
  layoutCache.set(key, res);
  return res;
}
function drawGlyph(g, x, y, s, wt) {
  ctx.save();
  ctx.lineWidth = s * 0.055 * (wt / 500) + 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const m = y - s * 0.33;
  ctx.beginPath();
  if (g === '≈') {
    for (const off of [-0.09, 0.09]) {
      const yy = m + off * s, x0 = x + 0.08 * s;
      ctx.moveTo(x0, yy + 0.02 * s);
      ctx.bezierCurveTo(x0 + 0.1 * s, yy - 0.08 * s, x0 + 0.18 * s, yy - 0.06 * s, x0 + 0.23 * s, yy);
      ctx.bezierCurveTo(x0 + 0.28 * s, yy + 0.06 * s, x0 + 0.36 * s, yy + 0.08 * s, x0 + 0.46 * s, yy - 0.02 * s);
    }
  } else if (g === '≥') {
    ctx.moveTo(x + 0.1 * s, m - 0.2 * s); ctx.lineTo(x + 0.48 * s, m - 0.04 * s); ctx.lineTo(x + 0.1 * s, m + 0.12 * s);
    ctx.moveTo(x + 0.1 * s, m + 0.28 * s); ctx.lineTo(x + 0.48 * s, m + 0.12 * s);
  } else if (g === '→') {
    ctx.moveTo(x + 0.08 * s, m); ctx.lineTo(x + 0.8 * s, m);
    ctx.moveTo(x + 0.58 * s, m - 0.2 * s); ctx.lineTo(x + 0.8 * s, m); ctx.lineTo(x + 0.58 * s, m + 0.2 * s);
  } else if (g === '✓') {
    ctx.lineWidth *= 1.4;
    ctx.moveTo(x + 0.1 * s, m); ctx.lineTo(x + 0.28 * s, m + 0.18 * s); ctx.lineTo(x + 0.62 * s, m - 0.25 * s);
  }
  ctx.stroke();
  ctx.restore();
}
function drawMark(mark, ch, x, y, w, s, o) {
  const upper = ch === ch.toUpperCase();
  const sl = o.italic ? s * 0.1 : 0;
  if (mark === 'dot') {
    circle(x + w / 2 + sl, y - s * (upper ? 0.9 : 0.68), s * 0.075 * Math.sqrt((o.weight || 500) / 500)); ctx.fill();
  } else {
    ctx.save(); ctx.lineWidth = s * 0.065; ctx.lineCap = 'round';
    const yy = y - s * (upper ? 0.86 : 0.64);
    line(x + w * 0.14 + sl, yy, x + w * 0.86 + sl, yy); ctx.restore();
  }
}
/* text(str, x, y, opts)
   opts: size weight italic ls lh maxW align color hl alpha
         rt  (seconds since reveal start -> staggered word rise)  gap dur
         tw  (typewriter: number of visible characters)           */
function text(str, x, y, o) {
  const L = layout(str, o);
  const align = o.align || 'left';
  const col = o.color || C.cream, hlc = o.hl || C.peach;
  const gap = o.gap ?? 0.055, dur = o.dur ?? 0.55;
  const baseA = ctx.globalAlpha;
  ctx.save();
  ctx.letterSpacing = (o.ls || 0) + 'px';
  ctx.textBaseline = 'alphabetic';
  L.lines.forEach((ln, li) => {
    const lx = align === 'center' ? x - ln.w / 2 : align === 'right' ? x - ln.w : x;
    const ly = y + li * L.lh;
    for (const w of ln.words) {
      let a = 1, dy = 0;
      if (o.rt !== undefined) {
        const p = clamp((o.rt - w.idx * gap) / dur);
        if (p <= 0) continue;
        const e = E.outCubic(p); a = clamp(p * 1.8); dy = (1 - e) * o.size * 0.55;
      }
      let cc = w.c0;
      for (const r of w.runs) {
        let txt = r.text;
        if (o.tw !== undefined) {
          const vis = Math.floor(o.tw - cc);
          if (vis <= 0) break;
          if (vis < txt.length) txt = txt.slice(0, vis);
        }
        cc += r.text.length;
        const s = r.mode === 'n' ? o.size : o.size * 0.62;
        const by = ly + dy + (r.mode === 'sub' ? o.size * 0.2 : r.mode === 'sup' ? -o.size * 0.4 : 0);
        const rx = lx + w.x + r.x;
        ctx.fillStyle = ctx.strokeStyle = r.hl ? hlc : col;
        ctx.globalAlpha = baseA * (o.alpha ?? 1) * a;
        if (r.custom) drawGlyph(r.text, rx, by, s, o.weight || 500);
        else { ctx.font = fontFor(o, r.mode); ctx.fillText(txt, rx, by); }
        if (r.mark) drawMark(r.mark, r.text, rx, by, r.w - (o.ls || 0), s, o);
      }
    }
  });
  ctx.restore();
  return L;
}
const textW = (str, o) => layout(str, o).w;

/* -------------------------------------------------------------- assets */
const IMG = {};
function loadImg(name, src) {
  return new Promise(res => { const im = new Image(); im.onload = () => { IMG[name] = im; res(); }; im.onerror = () => res(); im.src = src; });
}
let GRAIN = [], STAIN = null, VIGNETTE = null, VIGNETTE_SOFT = null;
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function initTextures() {
  const rnd = mulberry32(7);
  for (let k = 0; k < 8; k++) {
    const c = makeCanvas(360, 640), g = c.getContext('2d'), id = g.createImageData(360, 640);
    for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (rnd() - 0.5) * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    g.putImageData(id, 0, 0); GRAIN.push(c);
  }
  { // aged-paper blotches
    const s = makeCanvas(18, 32), g = s.getContext('2d'), id = g.createImageData(18, 32);
    for (let i = 0; i < id.data.length; i += 4) { const v = 150 + rnd() * 105; id.data[i] = v; id.data[i + 1] = v * 0.93; id.data[i + 2] = v * 0.8; id.data[i + 3] = 255; }
    g.putImageData(id, 0, 0);
    STAIN = makeCanvas(W, H); const g2 = STAIN.getContext('2d'); g2.imageSmoothingQuality = 'high'; g2.drawImage(s, 0, 0, W, H);
  }
  const vig = (inner, a) => {
    const c = makeCanvas(W, H), g = c.getContext('2d');
    const gr = g.createRadialGradient(W / 2, H * 0.46, H * inner, W / 2, H * 0.46, H * 0.75);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${a})`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H); return c;
  };
  VIGNETTE = vig(0.22, 0.75); VIGNETTE_SOFT = vig(0.3, 0.45);
}
window.reelReady = (async () => {
  await Promise.all([300, 400, 500, 600, 700, 800, 900].flatMap(w => [document.fonts.load(`${w} 40px Figtree`), document.fonts.load(`italic ${w} 40px Figtree`)]));
  await document.fonts.ready;
  // Optional real archival photo: drop a public-domain portrait at reel/assets/av-hill.jpg
  await loadImg('hill', 'assets/av-hill.jpg');
  initTextures();
  return true;
})();

/* --------------------------------------------------------- backgrounds */
function grain(a, comp = 'overlay') {
  ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = comp;
  ctx.drawImage(GRAIN[FRAME % GRAIN.length], 0, 0, W, H); ctx.restore();
}
function bgPaper() {
  const g = ctx.createRadialGradient(W / 2, H * 0.42, 100, W / 2, H * 0.5, H * 0.8);
  g.addColorStop(0, C.paperLight); g.addColorStop(0.55, C.paper); g.addColorStop(1, C.paperDark);
  ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.35; ctx.drawImage(STAIN, 0, 0); ctx.restore();
}
function contours(t, col, alpha, n = 16) {
  ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = alpha; ctx.lineWidth = 2;
  for (let i = 0; i < n; i++) {
    const base = -120 + i * (H + 240) / (n - 1);
    ctx.beginPath();
    for (let x = -24; x <= W + 24; x += 24) {
      const y = base + 40 * Math.sin(x * 0.0045 + t * 0.35 + i * 0.7) + 22 * Math.sin(x * 0.011 - t * 0.22 + i * 1.3);
      x === -24 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
function blob(x, y, r, col, a) {
  ctx.save(); const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
function bgPlum(t) {
  const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
  g.addColorStop(0, C.plumInk); g.addColorStop(0.55, C.plumDeep); g.addColorStop(1, C.plum);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  blob(540 + 220 * Math.sin(t * 0.4), 700 + 120 * Math.cos(t * 0.3), 700, C.plumMid, 0.55);
  blob(200 + 120 * Math.cos(t * 0.5), 1650, 650, C.teal, 0.35);
  contours(t, C.peach, 0.07);
}
function bgCream(t) {
  ctx.fillStyle = C.cream; ctx.fillRect(0, 0, W, H);
  blob(900, 300 + 60 * Math.sin(t * 0.5), 650, C.peach, 0.35);
  blob(150, 1700, 700, C.tealLight, 0.14);
  ctx.save(); ctx.fillStyle = C.plum; ctx.globalAlpha = 0.07;
  const off = (t * 12) % 48;
  for (let y = -48 + off; y < H + 48; y += 48) for (let x = 24; x < W; x += 48) { circle(x, y, 2.2); ctx.fill(); }
  ctx.restore();
}
function bgLab(t) {
  ctx.fillStyle = C.lab; ctx.fillRect(0, 0, W, H);
  blob(540, 1050, 900, C.tealDeep, 0.9);
  blob(900, 420, 500, C.plumDeep, 0.8);
  ctx.save(); ctx.strokeStyle = C.tealLight; ctx.globalAlpha = 0.06; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 60) line(x, 0, x, H);
  for (let y = (t * 20) % 60; y <= H; y += 60) line(0, y, W, y);
  ctx.restore();
}
function hud(ch, onLight, a = 1) {
  const col = onLight ? C.plum : C.cream, acc = onLight ? C.teal : C.peach;
  withAlpha(a, () => {
    text('V̇O_{2}max  EXPLAINED', 80, 232, { size: 24, weight: 800, ls: 3, color: col, alpha: 0.85 });
    text(`0${ch} / 05`, 1000, 232, { size: 24, weight: 700, ls: 2, color: col, align: 'right', alpha: 0.85 });
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < ch ? acc : col; ctx.globalAlpha = a * (i < ch ? 1 : 0.2);
      rrect(1000 - (5 - i) * 30 + 4, 250, 22, 5, 3); ctx.fill();
    }
  });
}

/* ---------------------------------------------------- archival film FX */
function filmFX(u, strength = 1) {
  const f = FRAME;
  ctx.save();
  ctx.fillStyle = `rgba(45,28,12,${0.05 + 0.07 * hash(f * 3 + 1)})`; ctx.fillRect(0, 0, W, H); // flicker
  const r = mulberry32(f * 77 + 5);
  const n = r() < 0.55 ? 1 : r() < 0.75 ? 2 : 0; // scratches
  for (let i = 0; i < n; i++) {
    const x = 90 + r() * (W - 180), dark = r() < 0.6;
    ctx.strokeStyle = dark ? 'rgba(40,24,10,0.35)' : 'rgba(255,248,230,0.45)'; ctx.lineWidth = 1 + r() * 1.5;
    ctx.beginPath(); const y0 = r() * H * 0.4, y1 = y0 + H * (0.3 + r() * 0.7);
    ctx.moveTo(x, y0); ctx.quadraticCurveTo(x + (r() - 0.5) * 20, (y0 + y1) / 2, x + (r() - 0.5) * 10, y1); ctx.stroke();
  }
  const d = Math.floor(r() * 5); // dust
  for (let i = 0; i < d; i++) { ctx.fillStyle = 'rgba(35,20,8,0.55)'; ctx.beginPath(); ctx.ellipse(r() * W, r() * H, 1 + r() * 4, 1 + r() * 2.5, r() * 3, 0, 7); ctx.fill(); }
  if (r() < 0.12) { ctx.strokeStyle = 'rgba(35,20,8,0.45)'; ctx.lineWidth = 1.5; ctx.beginPath(); const x = r() * W, y = r() * H; ctx.moveTo(x, y); ctx.bezierCurveTo(x + 20, y + 10, x - 10, y + 30, x + 15, y + 45); ctx.stroke(); } // hair
  ctx.restore();
  grain(0.22 * strength);
  ctx.drawImage(VIGNETTE, 0, 0);
  // sprocket strips
  ctx.save();
  const wv = jit(f, 9) * 1.5;
  for (const sx of [0, W - 46]) {
    ctx.fillStyle = 'rgba(28,17,8,0.93)'; ctx.fillRect(sx, 0, 46, H);
    ctx.fillStyle = 'rgba(236,222,196,0.85)';
    for (let y = -40 + wv; y < H; y += 76) { rrect(sx + 12, y, 22, 34, 5); ctx.fill(); }
  }
  ctx.restore();
}
function flash(u, at, a = 0.85) {
  const k = Math.abs(u - at);
  if (k < 0.1) { ctx.fillStyle = `rgba(255,250,235,${a * (1 - k / 0.1)})`; ctx.fillRect(0, 0, W, H); }
}

/* ------------------------------------------------------------- runner */
function drawRunner(x, y, sc, ph, st) {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  const bob = -13 * Math.abs(Math.sin(ph));
  ctx.translate(0, bob);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const lean = 0.2, TL = 150;
  const up = [Math.sin(lean), -Math.cos(lean)];
  const neck = [up[0] * TL, up[1] * TL], sh = [up[0] * TL * 0.84, up[1] * TL * 0.84];
  const head = [neck[0] + up[0] * 40 + 8, neck[1] + up[1] * 40];
  const leg = (a, col) => {
    const hip = 0.62 * Math.sin(a) + 0.08;
    const knee = 0.3 + 1.5 * Math.pow(Math.max(0, Math.cos(a + 0.35)), 1.3);
    const k = [Math.sin(hip) * 108, Math.cos(hip) * 108];
    const sa = hip - knee;
    const an = [k[0] + Math.sin(sa) * 112, k[1] + Math.cos(sa) * 112];
    const fa = sa + Math.PI / 2 - 0.35 * Math.max(0, Math.cos(a + 0.35));
    const ft = [an[0] + Math.sin(fa) * 36, an[1] + Math.cos(fa) * 36];
    ctx.strokeStyle = col;
    ctx.lineWidth = 31; line(0, 0, k[0], k[1]);
    ctx.lineWidth = 24; line(k[0], k[1], an[0], an[1]);
    ctx.strokeStyle = st.shoe || col; ctx.lineWidth = 17; line(an[0], an[1], ft[0], ft[1]);
    if (st.shorts) { ctx.strokeStyle = st.shorts; ctx.lineWidth = 38; line(0, 0, k[0] * 0.45, k[1] * 0.45); }
  };
  const arm = (a, col) => {
    const ua = 0.8 * Math.sin(a) - 0.05, el = 1.5 + 0.25 * Math.sin(a);
    const e = [sh[0] + Math.sin(ua) * 78, sh[1] + Math.cos(ua) * 78];
    const fa = ua + el, hd = [e[0] + Math.sin(fa) * 70, e[1] + Math.cos(fa) * 70];
    ctx.strokeStyle = col; ctx.lineWidth = 21; line(sh[0], sh[1], e[0], e[1]);
    ctx.lineWidth = 18; line(e[0], e[1], hd[0], hd[1]);
  };
  arm(ph, st.far); leg(ph + Math.PI, st.far);
  // Douglas bag on the back
  let bagTop = null;
  if (st.bag) {
    const bx = sh[0] - 64, by = sh[1] + 62;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(lean);
    ctx.fillStyle = st.bag; ctx.strokeStyle = st.skin; ctx.lineWidth = 5;
    rrect(-40, -64, 80, 128, 20); ctx.fill(); ctx.stroke();
    ctx.setLineDash([7, 7]); ctx.lineWidth = 2.5; rrect(-30, -54, 60, 108, 14); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = st.skin; rrect(-12, -78, 24, 18, 5); ctx.fill(); // valve
    ctx.restore();
    bagTop = [bx + Math.sin(lean) * 70, by - 70];
  }
  // torso (vest with outline)
  ctx.strokeStyle = st.skin; ctx.lineWidth = 76; line(0, -6, neck[0] * 0.9, neck[1] * 0.9);
  ctx.strokeStyle = st.vest || st.skin; ctx.lineWidth = 64; line(up[0] * 10, up[1] * 10, neck[0] * 0.84, neck[1] * 0.84);
  if (st.bag) { // harness strap
    ctx.strokeStyle = st.skin; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(sh[0] - 40, sh[1] - 4); ctx.quadraticCurveTo(sh[0] + 10, sh[1] + 20, sh[0] + 26, sh[1] + 70); ctx.stroke();
  }
  ctx.strokeStyle = st.skin; ctx.lineWidth = 22; line(neck[0] * 0.9, neck[1] * 0.9, neck[0] + up[0] * 12, neck[1] + up[1] * 12);
  // head
  ctx.fillStyle = st.skin; circle(head[0], head[1], 31); ctx.fill();
  ctx.fillStyle = st.hair || st.skin; ctx.beginPath(); ctx.arc(head[0] - 2, head[1] - 3, 31, Math.PI * 1.0, Math.PI * 1.72); ctx.fill();
  const mouth = [head[0] + 30, head[1] + 12];
  if (st.bag) { // mouthpiece, nose clip and breathing tube to the bag
    ctx.fillStyle = st.tube; rrect(mouth[0] - 4, mouth[1] - 8, 18, 16, 4); ctx.fill();
    ctx.strokeStyle = st.tube; ctx.lineWidth = 5; line(head[0] + 22, head[1] - 10, head[0] + 36, head[1] - 4);
    ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(mouth[0] + 10, mouth[1]);
    ctx.bezierCurveTo(mouth[0] + 48, mouth[1] + 40, sh[0] - 10, sh[1] - 80, bagTop[0], bagTop[1]); ctx.stroke();
    ctx.strokeStyle = st.bag; ctx.lineWidth = 2.5; ctx.setLineDash([2, 7]); ctx.stroke(); ctx.setLineDash([]);
  }
  if (st.mask) { ctx.fillStyle = st.mask; rrect(mouth[0] - 10, mouth[1] - 18, 30, 34, 12); ctx.fill(); }
  leg(ph, st.skin); arm(ph + Math.PI, st.skin);
  ctx.restore();
  return { mouth: [x + sc * (mouth[0] + 16), y + sc * (mouth[1] + bob)] };
}

/* ------------------------------------------------------------- icons */
function lungs(cx, cy, s, breath) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s / 300 * (1 + 0.035 * breath), s / 300 * (1 + 0.05 * breath));
  const lobe = sgn => {
    ctx.beginPath();
    ctx.moveTo(sgn * 22, -70);
    ctx.bezierCurveTo(sgn * 40, -150, sgn * 130, -120, sgn * 140, -10);
    ctx.bezierCurveTo(sgn * 150, 90, sgn * 120, 130, sgn * 60, 120);
    ctx.bezierCurveTo(sgn * 30, 115, sgn * 22, 90, sgn * 22, 60);
    ctx.closePath();
  };
  for (const sgn of [-1, 1]) {
    const g = ctx.createLinearGradient(0, -130, 0, 130); g.addColorStop(0, C.plumMid); g.addColorStop(1, C.plum);
    ctx.fillStyle = g; lobe(sgn); ctx.fill();
  }
  ctx.strokeStyle = C.peach; ctx.lineCap = 'round'; ctx.lineWidth = 16;
  line(0, -170, 0, -60);
  ctx.lineWidth = 9;
  for (const sgn of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(0, -60); ctx.quadraticCurveTo(sgn * 30, -40, sgn * 60, -20); ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(sgn * 60, -20); ctx.lineTo(sgn * 95, -55); ctx.moveTo(sgn * 60, -20); ctx.lineTo(sgn * 100, 20);
    ctx.moveTo(sgn * 60, -20); ctx.lineTo(sgn * 70, 70); ctx.moveTo(sgn * 85, 5); ctx.lineTo(sgn * 110, 60); ctx.stroke();
    ctx.lineWidth = 9;
  }
  ctx.restore();
}
function heart(cx, cy, s, pulse) {
  ctx.save(); ctx.translate(cx, cy); const k = s / 2 * (1 + 0.1 * pulse); ctx.scale(k, k);
  blob(0, 0, 0.9, C.peach, 0.5 * pulse);
  ctx.beginPath();
  ctx.moveTo(0, 0.42);
  ctx.bezierCurveTo(-0.55, 0.05, -0.62, -0.42, -0.28, -0.46);
  ctx.bezierCurveTo(-0.12, -0.47, -0.02, -0.36, 0, -0.26);
  ctx.bezierCurveTo(0.02, -0.36, 0.12, -0.47, 0.28, -0.46);
  ctx.bezierCurveTo(0.62, -0.42, 0.55, 0.05, 0, 0.42);
  const g = ctx.createLinearGradient(0, -0.5, 0, 0.45); g.addColorStop(0, '#B23A5E'); g.addColorStop(1, C.plum);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = C.cream; ctx.globalAlpha = 0.6; ctx.lineWidth = 0.035; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-0.24, -0.24, 0.13, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  ctx.restore();
}
function muscle(cx, cy, s, t) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s / 300, s / 300);
  ctx.strokeStyle = C.peach; ctx.lineWidth = 10; ctx.lineCap = 'round';
  line(-150, 0, -110, 0); line(110, 0, 150, 0);
  ctx.beginPath(); ctx.moveTo(-115, 0);
  ctx.bezierCurveTo(-60, -95, 60, -95, 115, 0); ctx.bezierCurveTo(60, 95, -60, 95, -115, 0);
  const g = ctx.createLinearGradient(0, -80, 0, 80); g.addColorStop(0, '#B23A5E'); g.addColorStop(1, C.plum);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(251,244,236,0.28)'; ctx.lineWidth = 3;
  for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(-120, i * 16); ctx.bezierCurveTo(-40, i * 22, 40, i * 22, 120, i * 16); ctx.stroke(); }
  ctx.restore();
  // mitochondria
  [[-45, -18, 0.2], [30, 22, -0.25], [55, -30, 0.35]].forEach(([mx, my, rot], i) => {
    ctx.save(); ctx.translate(mx, my); ctx.rotate(rot);
    const glow = 0.5 + 0.5 * Math.sin(t * 6 + i * 2);
    blob(0, 0, 55, C.peach, 0.35 * glow);
    ctx.fillStyle = C.peach; ctx.beginPath(); ctx.ellipse(0, 0, 30, 15, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = C.plum; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-22, 0);
    for (let k = 0; k < 6; k++) ctx.lineTo(-18 + k * 7.5, k % 2 ? -8 : 8);
    ctx.stroke(); ctx.restore();
  });
  ctx.restore();
}
function iconStopwatch(x, y, r, col, t) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.lineCap = 'round';
  circle(x, y + 4, r); ctx.stroke(); line(x, y + 4 - r, x, y - r - 8); line(x - 12, y - r - 10, x + 12, y - r - 10);
  const a = t * 4; line(x, y + 4, x + Math.sin(a) * r * 0.7, y + 4 - Math.cos(a) * r * 0.7);
  ctx.restore();
}
function iconArrowUp(x, y, r, col, fg) {
  ctx.save(); ctx.fillStyle = col; circle(x, y, r); ctx.fill();
  ctx.strokeStyle = fg; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - r * 0.45, y + r * 0.3); ctx.lineTo(x - r * 0.1, y - r * 0.05); ctx.lineTo(x + r * 0.12, y + r * 0.15); ctx.lineTo(x + r * 0.45, y - r * 0.3);
  ctx.moveTo(x + r * 0.2, y - r * 0.32); ctx.lineTo(x + r * 0.45, y - r * 0.3); ctx.lineTo(x + r * 0.45, y - r * 0.05); ctx.stroke();
  ctx.restore();
}
function iconHeartbeat(x, y, r, col, fg) {
  ctx.save(); ctx.fillStyle = col; circle(x, y, r); ctx.fill();
  ctx.strokeStyle = fg; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - r * 0.6, y); ctx.lineTo(x - r * 0.25, y); ctx.lineTo(x - r * 0.1, y - r * 0.4); ctx.lineTo(x + r * 0.1, y + r * 0.4); ctx.lineTo(x + r * 0.25, y); ctx.lineTo(x + r * 0.6, y); ctx.stroke();
  ctx.restore();
}

/* ===================================================== SCENE 1: ORIGIN */
function silhouetteBust(cx, cy, S) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(S, S);
  ctx.beginPath();
  ctx.moveTo(-0.2, 0.3);
  ctx.bezierCurveTo(-0.22, 0.18, -0.32, 0.08, -0.3, -0.05);
  ctx.bezierCurveTo(-0.3, -0.28, -0.15, -0.42, 0.02, -0.42);
  ctx.bezierCurveTo(0.14, -0.42, 0.2, -0.32, 0.2, -0.2);
  ctx.lineTo(0.21, -0.12);
  ctx.bezierCurveTo(0.23, -0.08, 0.28, -0.03, 0.29, 0.0);
  ctx.bezierCurveTo(0.29, 0.03, 0.25, 0.04, 0.22, 0.04);
  ctx.lineTo(0.235, 0.08); ctx.lineTo(0.22, 0.1); ctx.lineTo(0.23, 0.13);
  ctx.bezierCurveTo(0.23, 0.19, 0.2, 0.22, 0.16, 0.22);
  ctx.bezierCurveTo(0.12, 0.23, 0.1, 0.26, 0.1, 0.3);
  ctx.lineTo(0.12, 0.4);
  ctx.bezierCurveTo(0.3, 0.44, 0.5, 0.5, 0.58, 0.64);
  ctx.lineTo(0.66, 0.95); ctx.lineTo(-0.66, 0.95); ctx.lineTo(-0.58, 0.62);
  ctx.bezierCurveTo(-0.45, 0.45, -0.25, 0.42, -0.2, 0.3);
  ctx.closePath();
  ctx.fillStyle = C.ink; ctx.fill();
  // collar & tie
  ctx.fillStyle = C.paperLight; ctx.beginPath(); ctx.moveTo(0.1, 0.33); ctx.lineTo(0.24, 0.43); ctx.lineTo(0.13, 0.52); ctx.lineTo(0.02, 0.4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.stamp; ctx.beginPath(); ctx.moveTo(0.14, 0.44); ctx.lineTo(0.2, 0.47); ctx.lineTo(0.2, 0.7); ctx.lineTo(0.12, 0.66); ctx.closePath(); ctx.fill();
  // lapel line, ear, hair parting
  ctx.strokeStyle = 'rgba(233,219,191,0.25)'; ctx.lineWidth = 0.008;
  ctx.beginPath(); ctx.moveTo(0.26, 0.47); ctx.lineTo(0.34, 0.95); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-0.06, -0.02, 0.035, 0.06, 0.2, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-0.02, -0.41); ctx.quadraticCurveTo(-0.08, -0.3, -0.24, -0.26); ctx.stroke();
  ctx.restore();
}
function portrait(cx, cy, rx, ry, a) {
  ctx.save(); ctx.globalAlpha = a;
  ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.clip();
  const g = ctx.createRadialGradient(cx - 60, cy - 80, 20, cx, cy, ry * 1.1);
  g.addColorStop(0, '#E2CFAA'); g.addColorStop(1, '#9C7F58'); ctx.fillStyle = g; ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  if (IMG.hill) {
    const im = IMG.hill, sc = Math.max(rx * 2 / im.width, ry * 2 / im.height);
    ctx.filter = 'grayscale(1) sepia(0.85) contrast(1.1) brightness(0.95)';
    ctx.drawImage(im, cx - im.width * sc / 2, cy - im.height * sc / 2, im.width * sc, im.height * sc);
    ctx.filter = 'none';
  } else silhouetteBust(cx - 10, cy + 10, ry * 1.25);
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = a * 0.5; ctx.drawImage(STAIN, 0, 0);
  ctx.restore();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, rx + 16, ry + 16, 0, 0, 7); ctx.stroke();
  ctx.fillStyle = C.ink;
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const x = cx + dx * (rx + 16), y = cy + dy * (ry + 16);
    ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x + 10, y); ctx.lineTo(x, y + 14); ctx.lineTo(x - 10, y); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function sceneOpen(u) {
  bgPaper();
  ctx.save(); ctx.translate(jit(FRAME, 1) * 2.5, jit(FRAME, 2) * 2.5);
  if (u < 3.8) openPortrait(u); else openRunner(u - 3.8);
  ctx.restore();
  filmFX(u);
  flash(u, 3.8);
  if (u < 0.9) { ctx.fillStyle = `rgba(10,5,2,${1 - E.inOutSine(P(u, 0, 0.9))})`; ctx.fillRect(0, 0, W, H); }
}
function openPortrait(u) {
  text('THE ORIGIN STORY', 540, 300, { size: 26, weight: 800, ls: 10, color: C.inkSoft, align: 'center', rt: u - 0.3, gap: 0.12 });
  const pa = E.outCubic(P(u, 0.2, 1.3));
  ctx.save(); ctx.translate(540, 700); ctx.scale(0.92 + 0.08 * pa + u * 0.006, 0.92 + 0.08 * pa + u * 0.006); ctx.translate(-540, -700);
  portrait(540, 700, 235, 295, pa);
  ctx.restore();
  text('Archibald Vivian Hill', 540, 1110, { size: 66, weight: 800, color: C.ink, align: 'center', tw: (u - 0.95) * 24 });
  text('1886 – 1977', 540, 1172, { size: 34, weight: 500, color: C.inkSoft, align: 'center', ls: 4, rt: u - 1.9 });
  text('Nobel Prize in Physiology or Medicine, 1922', 540, 1228, { size: 34, weight: 600, italic: true, color: C.ink, align: 'center', rt: u - 2.1, gap: 0.04 });
  // 1923 rubber stamp
  const sp = P(u, 2.45, 2.65);
  if (sp > 0) {
    const s = lerp(1.7, 1, E.outCubic(sp)), shake = u < 2.9 ? jit(FRAME, 4) * 4 * (1 - P(u, 2.65, 2.9)) : 0;
    ctx.save(); ctx.translate(540 + shake, 1400); ctx.rotate(-0.07); ctx.scale(s, s);
    ctx.globalAlpha = 0.88 * E.outCubic(sp);
    ctx.strokeStyle = C.stamp; ctx.lineWidth = 7; rrect(-300, -125, 600, 250, 18); ctx.stroke();
    ctx.lineWidth = 2.5; rrect(-284, -109, 568, 218, 12); ctx.stroke();
    text('HILL & LUPTON', 0, -60, { size: 30, weight: 800, ls: 12, color: C.stamp, align: 'center' });
    text('1923', 0, 88, { size: 170, weight: 900, ls: 6, color: C.stamp, align: 'center' });
    ctx.restore();
  }
}
function openRunner(v) {
  text('HILL & LUPTON · 1923', 540, 300, { size: 26, weight: 800, ls: 8, color: C.inkSoft, align: 'center', rt: v - 0.05, gap: 0.1 });
  text('Measuring every breath', 540, 392, { size: 76, weight: 800, color: C.ink, align: 'center', rt: v - 0.15, gap: 0.08 });
  const hy = 1120;
  // distant trees
  ctx.save(); ctx.fillStyle = C.inkSoft; ctx.globalAlpha = 0.28;
  for (let i = 0; i < 16; i++) {
    const x = ((i * 157 - v * 45) % 1400 + 1400) % 1400 - 160, r = 34 + hash(i) * 34;
    circle(x, hy - r * 0.6, r); ctx.fill(); circle(x + r * 0.7, hy - r * 0.35, r * 0.7); ctx.fill(); circle(x - r * 0.6, hy - r * 0.3, r * 0.6); ctx.fill();
  }
  ctx.restore();
  // ground band + track lines
  const gg = ctx.createLinearGradient(0, hy, 0, 1360); gg.addColorStop(0, 'rgba(110,85,55,0.35)'); gg.addColorStop(1, 'rgba(110,85,55,0.1)');
  ctx.fillStyle = gg; ctx.fillRect(0, hy, W, 240);
  ctx.strokeStyle = C.inkSoft; ctx.globalAlpha = 0.45; ctx.lineWidth = 3; line(0, hy, W, hy);
  ctx.lineWidth = 2; ctx.globalAlpha = 0.25; line(0, 1215, W, 1215); line(0, 1290, W, 1290);
  // fence
  ctx.globalAlpha = 0.5; ctx.strokeStyle = C.ink; ctx.lineWidth = 5; line(0, hy - 38, W, hy - 38);
  for (let i = 0; i < 14; i++) { const x = ((i * 110 - v * 380) % 1540 + 1540) % 1540 - 120; ctx.lineWidth = 7; line(x, hy - 55, x, hy); }
  ctx.globalAlpha = 1;
  // speed streaks
  ctx.strokeStyle = C.inkSoft; ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const y = 820 + i * 55, x = ((- v * 900 + i * 377) % 900 + 900) % 900 - 100;
    ctx.globalAlpha = 0.18; ctx.lineWidth = 3; line(x, y, x + 120 + hash(i + 3) * 90, y);
  }
  ctx.globalAlpha = 1;
  // shadow + runner
  ctx.fillStyle = 'rgba(50,30,12,0.25)'; ctx.beginPath(); ctx.ellipse(515, 1222, 120, 12, 0, 0, 7); ctx.fill();
  const ph = v * Math.PI * 2 * 1.55 + 0.4;
  const rr = drawRunner(500, 985, 1.05, ph, { skin: C.ink, far: '#5A4128', vest: C.paperLight, shorts: '#2A1B0E', bag: '#CDB48A', tube: '#2A1B0E', hair: '#22150A' });
  // grass tufts (foreground)
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.globalAlpha = 0.55;
  for (let i = 0; i < 22; i++) {
    const x = ((i * 83 - v * 1100) % 1800 + 1800) % 1800 - 150, y = 1320 + hash(i + 40) * 30;
    for (let k = -1; k <= 1; k++) line(x, y, x + k * 9 + 4, y - 20 - hash(i + k) * 12);
  }
  ctx.globalAlpha = 1;
  // callouts
  callout(v - 0.9, [440, 865], [300, 772], [88, 772], 'DOUGLAS BAG', 'canvas bag that\ncollects every\nbreath out', 'left');
  callout(v - 1.6, [rr.mouth[0] - 4, rr.mouth[1]], [700, 700], [992, 700], 'MOUTHPIECE', '+ nose clip, so no\nbreath escapes', 'right');
  text('Runners ran faster and faster while every exhaled breath was captured, then analysed for O_{2} and CO_{2}.',
    540, 1420, { size: 40, weight: 600, color: C.ink, align: 'center', maxW: 860, tw: (v - 1.2) * 44 });
}
function callout(p, anchor, elbow, end, title, body, side) {
  if (p <= 0) return;
  const a = E.outCubic(clamp(p / 0.6));
  ctx.save(); ctx.strokeStyle = C.ink; ctx.fillStyle = C.ink; ctx.lineWidth = 3;
  circle(anchor[0], anchor[1], 9 * a); ctx.fill();
  circle(anchor[0], anchor[1], 9 + 26 * P(p, 0, 0.6)); ctx.globalAlpha = 1 - P(p, 0, 0.6); ctx.stroke(); ctx.globalAlpha = 1;
  const l1 = clamp(a * 2), l2 = clamp(a * 2 - 1);
  line(anchor[0], anchor[1], lerp(anchor[0], elbow[0], l1), lerp(anchor[1], elbow[1], l1));
  if (l2 > 0) line(elbow[0], elbow[1], lerp(elbow[0], end[0], l2), elbow[1]);
  ctx.restore();
  const x = side === 'left' ? end[0] : end[0];
  const al = side === 'left' ? 'left' : 'right';
  const lines = body.split('\n');
  text(title, x, elbow[1] - 16 - lines.length * 36, { size: 28, weight: 900, ls: 4, color: C.ink, align: al, rt: p - 0.3 });
  lines.forEach((l, i) => text(l, x, elbow[1] - 16 - (lines.length - 1 - i) * 36, { size: 29, weight: 500, color: C.ink, align: al, rt: p - 0.4 - i * 0.08 }));
}

/* ==================================================== SCENE 2: GRAPH */
const G = { ox: 170, oy: 1120, w: 770, h: 610, cap: 0.72 };
const gx = nx => G.ox + nx * G.w, gy = ny => G.oy - ny * G.h;
const gf = nx => smin(0.1 + 1.0 * nx, G.cap, 30);
function sceneGraph(u) {
  bgPaper();
  ctx.save(); ctx.translate(jit(FRAME, 1) * 2.5, jit(FRAME, 2) * 2.5);
  text('THE DISCOVERY', 540, 300, { size: 26, weight: 800, ls: 10, color: C.inkSoft, align: 'center', rt: u - 0.05, gap: 0.12 });
  text('What the bags revealed', 540, 392, { size: 76, weight: 800, color: C.ink, align: 'center', rt: u - 0.15, gap: 0.08 });
  // graph paper
  ctx.save(); ctx.strokeStyle = C.inkSoft; ctx.lineWidth = 1;
  const gp = E.outCubic(P(u, 0.1, 0.8));
  ctx.globalAlpha = 0.14 * gp;
  for (let x = 110; x <= 980; x += 29) line(x, 460, x, 1170);
  for (let y = 460; y <= 1170; y += 29) line(110, y, 980, y);
  ctx.restore();
  // axes
  const ap = E.outCubic(P(u, 0.2, 0.9));
  ctx.save(); ctx.strokeStyle = C.ink; ctx.fillStyle = C.ink; ctx.lineWidth = 5; ctx.lineCap = 'round';
  line(G.ox, G.oy, G.ox + (G.w + 20) * ap, G.oy); line(G.ox, G.oy, G.ox, G.oy - (G.h + 30) * ap);
  if (ap > 0.95) {
    ctx.beginPath(); ctx.moveTo(G.ox + G.w + 34, G.oy); ctx.lineTo(G.ox + G.w + 14, G.oy - 11); ctx.lineTo(G.ox + G.w + 14, G.oy + 11); ctx.fill();
    ctx.beginPath(); ctx.moveTo(G.ox, G.oy - G.h - 44); ctx.lineTo(G.ox - 11, G.oy - G.h - 24); ctx.lineTo(G.ox + 11, G.oy - G.h - 24); ctx.fill();
  }
  ctx.restore();
  text('Running speed →', G.ox + G.w + 20, G.oy + 52, { size: 32, weight: 700, italic: true, color: C.ink, align: 'right', rt: u - 0.7 });
  ctx.save(); ctx.translate(G.ox - 26, G.oy - G.h - 20); ctx.rotate(-Math.PI / 2);
  text('Oxygen uptake →', 0, 0, { size: 32, weight: 700, italic: true, color: C.ink, align: 'right', rt: u - 0.8 });
  ctx.restore();
  // hand-drawn curve
  const cp = E.inOutSine(P(u, 1.0, 3.6));
  if (cp > 0) {
    ctx.save(); ctx.strokeStyle = C.ink; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    const x1 = lerp(0.04, 0.95, cp);
    for (let nx = 0.04; nx <= x1; nx += 0.005) {
      const y = gy(gf(nx)) + Math.sin(nx * 80) * 1.6;
      nx === 0.04 ? ctx.moveTo(gx(nx), y) : ctx.lineTo(gx(nx), y);
    }
    ctx.stroke(); ctx.restore();
  }
  // data points (ink blots)
  for (let i = 0; i < 9; i++) {
    const nx = 0.1 + i * 0.1, ny = gf(nx) + (hash(i + 50) - 0.5) * 0.035;
    const p = P(u, 1.0 + i * 0.29, 1.25 + i * 0.29);
    if (p <= 0) continue;
    const s = E.outBack(p);
    ctx.fillStyle = C.ink; circle(gx(nx), gy(ny), 12 * s); ctx.fill();
    ctx.fillStyle = C.paperLight; circle(gx(nx) - 3, gy(ny) - 3, 3 * s); ctx.fill();
    ctx.fillStyle = C.ink; circle(gx(nx) + 15 * s, gy(ny) - 9 * s, 2.5 * s); ctx.fill();
  }
  // ceiling
  const dp = E.outCubic(P(u, 3.7, 4.3));
  const glow = P(u, 4.7, 5.2);
  if (dp > 0) {
    ctx.save();
    ctx.strokeStyle = glow > 0 ? C.peachDeep : C.stamp; ctx.lineWidth = 4 + 3 * glow; ctx.setLineDash([18, 12]);
    if (glow > 0) { ctx.shadowColor = C.peach; ctx.shadowBlur = 40 * glow; }
    line(gx(0.02), gy(G.cap) - 14, gx(0.02 + 0.96 * dp), gy(G.cap) - 14);
    ctx.restore();
    text('CEILING', gx(0.98), gy(G.cap) - 36, { size: 30, weight: 900, ls: 8, color: C.stamp, align: 'right', rt: u - 4.0 });
    text('Hill’s own max: ≈ 4 L of O_{2} per minute', gx(0.02), gy(G.cap) - 88, { size: 29, weight: 600, italic: true, color: C.ink, rt: u - 4.3, gap: 0.04 });
  }
  text('Oxygen uptake rose with speed…', 540, 1245, { size: 50, weight: 800, color: C.ink, align: 'center', tw: (u - 1.3) * 26 });
  text('…then refused to rise any further.', 540, 1310, { size: 50, weight: 800, color: C.ink, align: 'center', tw: (u - 2.7) * 26 });
  text('Hill & Lupton called it the', 540, 1395, { size: 38, weight: 500, color: C.inkSoft, align: 'center', rt: u - 4.0 });
  text('“maximum oxygen intake”', 540, 1460, { size: 56, weight: 900, italic: true, color: C.stamp, align: 'center', rt: u - 4.25, gap: 0.12 });
  ctx.restore();
  filmFX(u);
  flash(u, 0);
  // film-burn into colour
  const bp = P(u, 5.1, 6.35);
  if (bp > 0) filmBurn(gx(0.85), gy(G.cap) - 14, E.inCubic(bp) * 2400 + 4, u);
}
function filmBurn(cx, cy, r, u) {
  // scorch halo on the paper
  ctx.save();
  const sg = ctx.createRadialGradient(cx, cy, r, cx, cy, r + 160);
  sg.addColorStop(0, 'rgba(40,18,6,0.9)'); sg.addColorStop(0.35, 'rgba(90,45,15,0.45)'); sg.addColorStop(1, 'rgba(90,45,15,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, r + 160, 0, 7); ctx.arc(cx, cy, r, 0, 7, true); ctx.fill('evenodd');
  ctx.restore();
  // colour world inside
  ctx.save(); ctx.beginPath();
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.05) {
    const rr = r * (1 + 0.06 * Math.sin(a * 7 + u * 3) + 0.04 * Math.sin(a * 13 - u * 5));
    a === 0 ? ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.clip();
  sceneName(u - 6.5);
  // glowing rim
  const rg = ctx.createRadialGradient(cx, cy, Math.max(0, r * 0.85 - 30), cx, cy, r * 1.1);
  rg.addColorStop(0, 'rgba(242,191,148,0)'); rg.addColorStop(0.8, 'rgba(242,160,100,0.55)'); rg.addColorStop(1, 'rgba(255,230,190,0.95)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // embers
  const rnd = mulberry32(99);
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2, d = r * (1.02 + rnd() * 0.15) + (u - 5) * 60 * rnd();
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d - (u - 5) * 90 * rnd();
    ctx.fillStyle = `rgba(255,${180 + rnd() * 60},120,${0.8 * rnd()})`; circle(x, y, 2 + rnd() * 3); ctx.fill();
  }
}

/* ===================================================== SCENE 3: NAME */
function vo2Title(cx, baseY, big, u, t0, spread, colV = C.cream, colO = C.peach, colMax = C.cream) {
  const sub = big * 0.5;
  const fV = `800 ${big}px Figtree`, fS = `800 ${sub}px Figtree`, fM = `600 ${sub}px Figtree`;
  ctx.save();
  ctx.font = fV; const wV = ctx.measureText('V').width, wO = ctx.measureText('O').width;
  ctx.font = fS; const w2 = ctx.measureText('2').width;
  ctx.font = fM; const wM = ctx.measureText('max').width;
  const g = 28 * spread;
  const total = wV + wO + w2 + wM + 6 + g * 2;
  let x = cx - total / 2;
  const pieces = [
    { s: 'V', f: fV, x, w: wV, dy: 0, col: colV, grp: 0 },
    { s: 'O', f: fV, x: x += wV + g, w: wO, dy: 0, col: colO, grp: 1 },
    { s: '2', f: fS, x: x += wO, w: w2, dy: big * 0.16, col: colO, grp: 1 },
    { s: 'max', f: fM, x: x += w2 + 6 + g, w: wM, dy: big * 0.16, col: colMax, grp: 2 },
  ];
  pieces.forEach((pc, i) => {
    const p = P(u, t0 + i * 0.12, t0 + i * 0.12 + 0.6);
    if (p <= 0) return;
    ctx.globalAlpha = clamp(p * 3); ctx.fillStyle = pc.col; ctx.font = pc.f;
    ctx.fillText(pc.s, pc.x, baseY + pc.dy - (1 - E.outBack(p)) * 180);
  });
  // rate dot above V
  const dp = P(u, t0 + 0.75, t0 + 1.05);
  if (dp > 0) {
    ctx.globalAlpha = 1; ctx.fillStyle = C.peach;
    circle(pieces[0].x + wV / 2, baseY - big * 0.83, big * 0.062 * E.outBack(dp)); ctx.fill();
    const rp = P(u, t0 + 0.8, t0 + 1.4);
    ctx.strokeStyle = C.peach; ctx.lineWidth = 3; ctx.globalAlpha = 1 - rp;
    circle(pieces[0].x + wV / 2, baseY - big * 0.83, big * 0.07 + rp * 60); ctx.stroke();
  }
  ctx.restore();
  return [
    pieces[0].x + wV / 2,
    (pieces[1].x + pieces[2].x + w2) / 2,
    pieces[3].x + wM / 2,
  ];
}
function sceneName(u) {
  const t = T.name + u;
  bgPlum(t);
  hud(1, false, E.outCubic(P(u, 0.2, 0.8)));
  text('A century later, we call it', 540, 560, { size: 46, weight: 500, color: C.cream, alpha: 0.8, align: 'center', rt: u - 0.1 });
  const spread = E.inOutCubic(P(u, 2.0, 2.6));
  const cols = vo2Title(540, 880, 290, u, 0.45, spread);
  const labels = [['Volume', 'per minute (the dot)'], ['of Oxygen', 'taken up & used'], ['Maximum', 'at all-out effort']];
  const lc = [C.cream, C.peach, C.cream];
  labels.forEach(([a, b], i) => {
    const p = P(u, 2.3 + i * 0.3, 2.8 + i * 0.3);
    if (p <= 0) return;
    const e = E.outCubic(p), x = cols[i];
    ctx.save(); ctx.strokeStyle = C.peach; ctx.lineWidth = 3; line(x, 930, x, 930 + 70 * e);
    ctx.fillStyle = C.peach; circle(x, 1000, 7 * e); ctx.fill(); ctx.restore();
    text(a, x, 1060, { size: 40, weight: 800, color: lc[i], align: 'center', rt: u - 2.45 - i * 0.3 });
    text(b, x, 1102, { size: 26, weight: 500, color: C.cream, alpha: 0.72, align: 'center', rt: u - 2.55 - i * 0.3 });
  });
  const cp = E.outCubic(P(u, 3.9, 4.5));
  if (cp > 0) {
    ctx.save(); ctx.globalAlpha = cp; ctx.translate(0, (1 - cp) * 60);
    ctx.fillStyle = 'rgba(251,244,236,0.07)'; ctx.strokeStyle = 'rgba(242,191,148,0.45)'; ctx.lineWidth = 2;
    rrect(80, 1185, 920, 305, 30); ctx.fill(); ctx.stroke();
    ctx.restore();
    text('DEFINITION', 124, 1245, { size: 24, weight: 900, ls: 8, color: C.peach, rt: u - 4.1 });
    text('The highest rate at which your body can *take in*, *transport* and *use* oxygen during exercise.', 124, 1318,
      { size: 48, weight: 700, color: C.cream, maxW: 800, lh: 1.2, rt: u - 4.25, gap: 0.075 });
  }
  grain(0.07);
  ctx.drawImage(VIGNETTE_SOFT, 0, 0);
}

/* ===================================================== SCENE 4: PATH */
const PATH_PTS = (() => {
  const pts = [];
  for (let i = 0; i <= 200; i++) { const s = i / 200; pts.push([300 + 34 * Math.sin(s * Math.PI * 3), 470 + s * 800]); }
  return pts;
})();
const pathAt = s => { const f = clamp(s) * 200, i = Math.min(199, Math.floor(f)), k = f - i; return [lerp(PATH_PTS[i][0], PATH_PTS[i + 1][0], k), lerp(PATH_PTS[i][1], PATH_PTS[i + 1][1], k)]; };
function beatPulse(tt) { const m = ((tt % 0.5) + 0.5) % 0.5; return Math.exp(-Math.pow(m / 0.06, 2)) + 0.6 * Math.exp(-Math.pow((m - 0.18) / 0.05, 2)); }
function scenePath(u) {
  const t = T.path + u;
  bgCream(t);
  hud(2, true);
  // title swap
  const sw = E.inOutCubic(P(u, 5.3, 5.9));
  ctx.save(); ctx.beginPath(); ctx.rect(0, 270, W, 170); ctx.clip();
  ctx.save(); ctx.translate(0, -sw * 170);
  text('FROM AIR TO MUSCLE', 80, 322, { size: 26, weight: 900, ls: 7, color: C.teal, rt: u - 0.05 });
  text('The oxygen journey', 80, 410, { size: 80, weight: 800, color: C.plum, rt: u - 0.15, gap: 0.08 });
  ctx.translate(0, 170);
  text('THE FICK PRINCIPLE', 80, 322, { size: 26, weight: 900, ls: 7, color: C.teal });
  text('One simple equation', 80, 410, { size: 80, weight: 800, color: C.plum });
  ctx.restore(); ctx.restore();
  // Phase A: journey
  const aA = 1 - E.inCubic(P(u, 5.2, 5.75));
  if (aA > 0) {
    ctx.save(); ctx.globalAlpha = aA; ctx.translate(0, -(1 - aA) * 100);
    const vp = E.inOutSine(P(u, 0.2, 3.6));
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = C.tealLight; ctx.globalAlpha = 0.25 * aA; ctx.lineWidth = 30;
    ctx.beginPath(); PATH_PTS.slice(0, Math.max(2, Math.floor(vp * 200))).forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.stroke();
    ctx.globalAlpha = 0.6 * aA; ctx.lineWidth = 3; ctx.setLineDash([4, 14]); ctx.lineDashOffset = -u * 40; ctx.strokeStyle = C.teal; ctx.stroke();
    ctx.restore();
    const ls = E.outBack(P(u, 0.35, 0.9)), hs = E.outBack(P(u, 1.65, 2.2)), ms = E.outBack(P(u, 2.95, 3.5));
    if (ls > 0) { ctx.save(); ctx.translate(300, 590); ctx.scale(ls, ls); lungs(0, 0, 300, Math.sin(u * Math.PI)); ctx.restore(); }
    if (hs > 0) { ctx.save(); ctx.translate(300, 920); ctx.scale(hs, hs); heart(0, 0, 260, beatPulse(u)); ctx.restore(); }
    if (ms > 0) { ctx.save(); ctx.translate(300, 1235); ctx.scale(ms, ms); muscle(0, 0, 330, u); ctx.restore(); }
    // O2 particles
    if (u > 0.8) {
      for (let i = 0; i < 22; i++) {
        const s = ((u - 0.8) * 0.24 + i / 22) % 1;
        const k = (u - 0.8) * 0.24;
        if (!(s <= k || k + i / 22 >= 1) || s > vp) continue;
        const [px, py] = pathAt(s);
        const off = Math.sin(i * 7.3 + u * 3) * 22;
        const fade = s > 0.9 ? 1 - (s - 0.9) / 0.1 : s < 0.04 ? s / 0.04 : 1;
        const r = 7 + (i % 3) * 2.5;
        blob(px + off, py, r * 3, C.peach, 0.4 * fade);
        ctx.fillStyle = s < 0.5 ? C.peachDeep : '#D2553F'; ctx.globalAlpha = aA * fade; circle(px + off, py, r); ctx.fill(); ctx.globalAlpha = aA;
        if (i % 7 === 3) text('O_{2}', px + off + r + 6, py + 9, { size: 26, weight: 800, color: C.plum, alpha: fade });
      }
    }
    const steps = [
      [560, 'TAKE IN', 'Your lungs load O_{2} into the blood'],
      [890, 'TRANSPORT', 'Your heart pumps O_{2}-rich blood to working muscle'],
      [1200, 'USE', 'Mitochondria use O_{2} to make energy (ATP)'],
    ];
    steps.forEach(([y, tag, desc], i) => {
      const st = 0.6 + i * 1.3, p = E.outBack(P(u, st, st + 0.45));
      if (p <= 0) return;
      ctx.fillStyle = C.teal; circle(545, y - 10, 27 * p); ctx.fill();
      text(String(i + 1), 545, y + 1, { size: 30, weight: 900, color: C.cream, align: 'center', alpha: clamp(p) });
      text(tag, 590, y + 1, { size: 30, weight: 900, ls: 5, color: C.teal, rt: u - st - 0.1 });
      text(desc, 520, y + 66, { size: 38, weight: 700, color: C.plum, maxW: 420, lh: 1.18, rt: u - st - 0.2, gap: 0.05 });
    });
    ctx.restore();
  }
  // Phase B: Fick equation
  if (u > 5.5) {
    text('V̇O_{2}max =', 540, 690, { size: 120, weight: 900, color: C.plum, align: 'center', rt: u - 5.65, gap: 0.12, dur: 0.6 });
    const chips = [
      { t: 'HR', lab: 'heart rate', bg: C.teal, fg: C.cream },
      { t: 'SV', lab: 'stroke volume', bg: C.teal, fg: C.cream },
      { t: 'a–v̄O_{2} diff', lab: 'O_{2} extracted by muscle', bg: C.peach, fg: C.plum },
    ];
    const cs = { size: 62, weight: 800 };
    const widths = chips.map(c => textW(c.t, cs) + 70);
    const xw = 70, total = widths.reduce((a, b) => a + b, 0) + xw * 2;
    let x = 540 - total / 2; const cy = 860, chh = 130;
    const xs = [];
    chips.forEach((c, i) => {
      const st = 6.05 + i * 0.3, p = P(u, st, st + 0.5);
      xs.push([x, widths[i]]);
      if (p > 0) {
        const e = E.outBack(p);
        ctx.save(); ctx.translate(x + widths[i] / 2, cy); ctx.scale(e, e);
        ctx.fillStyle = c.bg; rrect(-widths[i] / 2, -chh / 2, widths[i], chh, 30); ctx.fill();
        ctx.restore();
        withAlpha(clamp(p * 2), () => text(c.t, x + widths[i] / 2, cy + 22, { ...cs, color: c.fg, align: 'center' }));
        text(c.lab, x + widths[i] / 2, cy + chh / 2 + 44, { size: 27, weight: 600, color: C.plum, alpha: 0.85, align: 'center', rt: u - st - 0.25 });
        if (i < 2) text('×', x + widths[i] + xw / 2, cy + 22, { size: 64, weight: 700, color: C.plum, align: 'center', alpha: clamp(p * 2) });
      }
      x += widths[i] + xw;
    });
    const bp = E.outCubic(P(u, 7.1, 7.6));
    if (bp > 0) {
      const x0 = xs[0][0] + 10, x1 = xs[1][0] + xs[1][1] - 10, yb = 990;
      ctx.save(); ctx.strokeStyle = C.teal; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const xm = (x0 + x1) / 2, hw = (x1 - x0) / 2 * bp;
      ctx.beginPath(); ctx.moveTo(xm - hw, yb - 12); ctx.lineTo(xm - hw, yb); ctx.lineTo(xm + hw, yb); ctx.lineTo(xm + hw, yb - 12);
      ctx.moveTo(xm, yb); ctx.lineTo(xm, yb + 14 * bp); ctx.stroke(); ctx.restore();
      text('= cardiac output (O_{2} delivery)', xm, yb + 58, { size: 30, weight: 800, color: C.teal, align: 'center', rt: u - 7.3 });
    }
    const np = E.outCubic(P(u, 7.7, 8.2));
    if (np > 0) {
      ctx.save(); ctx.globalAlpha = np; ctx.translate(0, (1 - np) * 50);
      ctx.fillStyle = C.plum; rrect(80, 1160, 920, 290, 30); ctx.fill();
      ctx.restore();
      text('In healthy people, *how much blood the heart can pump* is usually the main limit on V̇O_{2}max.', 124, 1238,
        { size: 42, weight: 700, color: C.cream, maxW: 800, lh: 1.2, rt: u - 7.9, gap: 0.05 });
      text('Bassett & Howley, 2000', 124, 1414, { size: 24, weight: 600, color: C.peach, alpha: 0.9, rt: u - 8.6 });
    }
  }
  grain(0.05);
}

/* ==================================================== SCENE 5: UNITS */
function sceneUnits(u) {
  const t = T.units + u;
  bgPlum(t);
  hud(3, false);
  text('THE NUMBERS', 80, 322, { size: 26, weight: 900, ls: 7, color: C.peach, rt: u - 0.05 });
  text('How V̇O_{2}max is measured', 80, 410, { size: 70, weight: 800, color: C.cream, rt: u - 0.15, gap: 0.08 });
  const pcs = [['mL', 'of oxygen', C.peach], ['·kg^{−1}', 'per kg body mass', C.cream], ['·min^{−1}', 'per minute', C.cream]];
  const o = { size: 104, weight: 800 };
  const ws = pcs.map(p => textW(p[0], o) + 12), tot = ws.reduce((a, b) => a + b, 0);
  let x = 540 - tot / 2;
  pcs.forEach(([s, lab, col], i) => {
    const st = 0.4 + i * 0.38, p = P(u, st, st + 0.5);
    if (p > 0) {
      const e = E.outBack(p);
      ctx.save(); ctx.translate(x + ws[i] / 2, 580); ctx.scale(e, e); ctx.translate(-(x + ws[i] / 2), -580);
      text(s, x, 610, { ...o, color: col, alpha: clamp(p * 2) });
      ctx.restore();
      text(lab, x + ws[i] / 2 - 6, 672, { size: 26, weight: 600, color: C.cream, alpha: 0.75, align: 'center', rt: u - st - 0.2 });
    }
    x += ws[i];
  });
  text('Scaling to body mass means people of different sizes can be compared fairly.', 540, 770,
    { size: 34, weight: 500, color: C.cream, alpha: 0.85, align: 'center', maxW: 860, rt: u - 1.7, gap: 0.04 });
  const rows = [
    ['Typical inactive adult', 35, '≈ 35', 'rgba(251,244,236,0.55)'],
    ['Recreational runner', 50, '≈ 50', C.tealLight],
    ['Elite endurance athlete', 80, '70–85+', C.peach],
    ['Highest ever reported', 96, '≈ 96', '#FFE3C8'],
  ];
  const bx = 80, bw = 640;
  // axis ticks
  const ax = E.outCubic(P(u, 2.1, 2.6));
  ctx.save(); ctx.globalAlpha = 0.25 * ax; ctx.strokeStyle = C.cream; ctx.lineWidth = 1.5; ctx.setLineDash([4, 8]);
  for (let v = 20; v <= 100; v += 20) line(bx + v / 100 * bw, 880, bx + v / 100 * bw, 1440);
  ctx.restore();
  for (let v = 0; v <= 100; v += 20) text(String(v), bx + v / 100 * bw, 1475, { size: 22, weight: 600, color: C.cream, alpha: 0.55 * ax, align: 'center' });
  rows.forEach(([lab, val, txt, col], i) => {
    const y = 912 + i * 140, st = 2.3 + i * 0.55;
    text(lab, bx, y, { size: 32, weight: 700, color: C.cream, rt: u - st });
    const p = E.outCubic(P(u, st + 0.1, st + 1.0));
    if (p > 0) {
      const w = Math.max(24, val / 100 * bw * p);
      if (i === 3) { ctx.save(); ctx.shadowColor = C.peach; ctx.shadowBlur = 30; }
      ctx.fillStyle = col; rrect(bx, y + 22, w, 50, 25); ctx.fill();
      if (i === 3) ctx.restore();
      const shown = p < 1 ? String(Math.round(val * p)) : txt;
      text(shown, bx + w + 18, y + 64, { size: 42, weight: 900, color: i >= 2 ? C.peach : C.cream });
    }
  });
  text('Approximate values in mL·kg^{−1}·min^{−1}; they vary with age, sex, genetics and training.', 80, 1535,
    { size: 23, weight: 500, color: C.cream, alpha: 0.65, maxW: 860, rt: u - 4.8, gap: 0.02 });
  grain(0.07);
  ctx.drawImage(VIGNETTE_SOFT, 0, 0);
}

/* ===================================================== SCENE 6: TEST */
const TEST_DATA = (() => {
  const r = mulberry32(21), d = [];
  for (let i = 0; i < 150; i++) { const tau = i / 149; d.push([tau, smin(0.1 + 0.95 * tau, 0.8, 22) + (r() + r() + r() - 1.5) * 0.04]); }
  return d;
})();
function sceneTest(u) {
  const t = T.test + u;
  bgLab(t);
  hud(4, false);
  text('IN THE LAB TODAY', 80, 322, { size: 26, weight: 900, ls: 7, color: C.tealLight, rt: u - 0.05 });
  text('The modern V̇O_{2}max test', 80, 410, { size: 70, weight: 800, color: C.cream, rt: u - 0.15, gap: 0.08 });
  const head = E.inOutSine(P(u, 0.6, 5.2));
  const stage = Math.min(10, Math.floor(head * 10) + 1), kmh = 7 + stage;
  // treadmill
  const tp = E.outCubic(P(u, 0.2, 0.8));
  ctx.save(); ctx.globalAlpha = tp; ctx.translate(0, (1 - tp) * 40);
  ctx.fillStyle = '#2B1C29'; rrect(190, 772, 430, 34, 17); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.rect(205, 776, 400, 10); ctx.clip();
  ctx.fillStyle = 'rgba(107,186,182,0.5)';
  const sp = (u * (160 + stage * 25)) % 60;
  for (let x = 205 - sp + 60; x < 610; x += 60) ctx.fillRect(x, 777, 26, 6);
  ctx.restore();
  ctx.strokeStyle = '#4A3348'; ctx.lineWidth = 14; ctx.lineCap = 'round';
  line(600, 790, 575, 600); line(575, 610, 470, 640);
  ctx.fillStyle = '#4A3348'; rrect(535, 568, 92, 44, 10); ctx.fill();
  ctx.fillStyle = C.tealLight; ctx.globalAlpha = tp * (0.6 + 0.4 * Math.sin(u * 8));
  rrect(548, 580, 66, 20, 5); ctx.fill();
  ctx.restore();
  // runner (cadence rises with stage)
  const ph = 2 * Math.PI * (1.25 * u + 0.045 * u * u);
  const r = drawRunner(390, 634, 0.62, ph, { skin: C.peach, far: '#C9906A', vest: C.plumMid, shorts: C.plumDeep, shoe: C.cream, mask: C.teal, hair: '#6E3C2B' });
  // metabolic cart + hose
  ctx.save(); ctx.globalAlpha = tp;
  ctx.strokeStyle = C.teal; ctx.lineWidth = 10; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(r.mouth[0], r.mouth[1]); ctx.bezierCurveTo(r.mouth[0] + 90, r.mouth[1] + 200, 700, 740, 770, 690); ctx.stroke();
  ctx.fillStyle = '#2A1628'; ctx.strokeStyle = 'rgba(107,186,182,0.6)'; ctx.lineWidth = 3;
  rrect(770, 560, 170, 232, 18); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#0D2B2D'; rrect(788, 580, 134, 78, 8); ctx.fill();
  ctx.strokeStyle = C.tealLight; ctx.lineWidth = 3; ctx.beginPath();
  for (let i = 0; i <= 60; i++) { const xx = 794 + i * 2.05, yy = 620 + Math.sin(i * 0.35 - u * 9) * 18 * (0.5 + 0.5 * Math.sin(i * 0.1)); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
  ctx.stroke();
  for (let i = 0; i < 3; i++) { ctx.fillStyle = [C.peach, C.tealLight, C.cream][i]; circle(810 + i * 36, 700, 9); ctx.fill(); }
  ctx.restore();
  text('gas analyser', 855, 830, { size: 22, weight: 600, color: C.cream, alpha: 0.6 * tp, align: 'center' });
  text(`STAGE ${stage}`, 855, 490, { size: 24, weight: 900, ls: 4, color: C.tealLight, align: 'center', alpha: tp });
  text(`${kmh} km/h`, 855, 540, { size: 44, weight: 900, color: C.cream, align: 'center', alpha: tp });
  // live graph
  const gpA = E.outCubic(P(u, 0.4, 0.9));
  const L = 150, R = 950, B = 1250, Tp = 905;
  const X = tau => lerp(L, R, tau), Y = v => lerp(B, Tp, v / 0.95);
  ctx.save(); ctx.globalAlpha = gpA;
  ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.strokeStyle = 'rgba(107,186,182,0.35)'; ctx.lineWidth = 2;
  rrect(80, 855, 920, 450, 26); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(251,244,236,0.5)'; ctx.lineWidth = 3; line(L, B, R, B); line(L, B, L, Tp - 10);
  ctx.strokeStyle = 'rgba(251,244,236,0.08)'; ctx.lineWidth = 1;
  for (let k = 1; k < 10; k++) line(X(k / 10), Tp, X(k / 10), B);
  ctx.restore();
  text('V̇O_{2}', L - 16, Tp + 12, { size: 30, weight: 800, color: C.cream, align: 'right', alpha: gpA });
  text('time  →  workload increases every stage', R, B + 38, { size: 22, weight: 600, color: C.cream, alpha: 0.6 * gpA, align: 'right' });
  // plateau band
  const pb = E.outCubic(P(u, 5.0, 5.5));
  if (pb > 0) {
    ctx.save(); ctx.fillStyle = 'rgba(242,191,148,0.14)'; ctx.strokeStyle = C.peach; ctx.setLineDash([10, 8]); ctx.lineWidth = 2;
    const x0 = X(0.72), yy = Y(0.8);
    rrect(x0, yy - 45, (R - x0) * pb, 90, 14); ctx.fill(); ctx.stroke(); ctx.restore();
    text('PLATEAU = V̇O_{2}max', R - 10, yy - 62, { size: 26, weight: 900, ls: 3, color: C.peach, align: 'right', rt: u - 5.2 });
  }
  // breath-by-breath dots + rolling mean
  if (head > 0) {
    ctx.save();
    ctx.fillStyle = C.tealLight;
    for (const [tau, v] of TEST_DATA) { if (tau > head) break; ctx.globalAlpha = 0.75; circle(X(tau), Y(v), 4.5); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.strokeStyle = C.peach; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); let first = true, last = null;
    for (let tau = 0; tau <= head; tau += 0.005) { const p = [X(tau), Y(smin(0.1 + 0.95 * tau, 0.8, 22))]; first ? ctx.moveTo(...p) : ctx.lineTo(...p); first = false; last = p; }
    ctx.stroke();
    if (last && head < 1) { blob(last[0], last[1], 40, C.peach, 0.7); ctx.fillStyle = C.cream; circle(last[0], last[1], 8); ctx.fill(); }
    ctx.restore();
  }
  // criteria
  text('COMMON CHECKS FOR A TRUE MAXIMUM', 80, 1362, { size: 22, weight: 900, ls: 4, color: C.tealLight, rt: u - 5.3 });
  const crit = [['V̇O_{2} plateaus', true], ['RER ≥ 1.10', true], ['HR near predicted max', true], ['No plateau? → V̇O_{2}peak', false]];
  crit.forEach(([s, ok], i) => {
    const st = 5.5 + i * 0.45, p = P(u, st, st + 0.45);
    if (p <= 0) return;
    const e = E.outBack(p), cx = i % 2 ? 525 : 80, cyy = 1386 + Math.floor(i / 2) * 82, w = 425;
    ctx.save(); ctx.translate(cx + w / 2, cyy + 33); ctx.scale(e, e); ctx.translate(-(cx + w / 2), -(cyy + 33));
    ctx.fillStyle = ok ? 'rgba(107,186,182,0.16)' : 'rgba(242,191,148,0.12)';
    ctx.strokeStyle = ok ? 'rgba(107,186,182,0.55)' : C.peach; ctx.lineWidth = 2;
    if (!ok) ctx.setLineDash([8, 6]);
    rrect(cx, cyy, w, 66, 33); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = ok ? C.tealLight : C.peach; circle(cx + 34, cyy + 33, 20); ctx.fill();
    ctx.restore();
    if (ok) { ctx.strokeStyle = C.lab; drawGlyph('✓', cx + 34 - 12, cyy + 33 + 11, 34, 700); }
    else text('i', cx + 34, cyy + 44, { size: 30, weight: 900, color: C.lab, align: 'center' });
    text(s, cx + 66, cyy + 43, { size: 27, weight: 700, color: C.cream, alpha: clamp(p * 2) });
  });
  grain(0.06);
  ctx.drawImage(VIGNETTE_SOFT, 0, 0);
}

/* ====================================================== SCENE 7: WHY */
function card(u, st, y, h, bg) {
  const p = E.outQuint(P(u, st, st + 0.7));
  if (p <= 0) return false;
  ctx.save(); ctx.translate((1 - p) * 700, 0);
  ctx.fillStyle = bg; ctx.shadowColor = 'rgba(62,19,57,0.25)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
  rrect(80, y, 920, h, 34); ctx.fill(); ctx.restore();
  return (1 - p) * 700;
}
function sceneWhy(u) {
  const t = T.why + u;
  bgCream(t);
  hud(5, true);
  text('WHY IT MATTERS', 80, 322, { size: 26, weight: 900, ls: 7, color: C.teal, rt: u - 0.05 });
  text('More than a number', 80, 410, { size: 80, weight: 800, color: C.plum, rt: u - 0.15, gap: 0.08 });
  let dx = card(u, 0.3, 465, 285, C.plum);
  if (dx !== false) {
    ctx.save(); ctx.translate(dx, 0);
    iconStopwatch(160, 548, 36, C.peach, u);
    text('Performance', 222, 568, { size: 48, weight: 800, color: C.peach });
    text('A key determinant of endurance performance, alongside lactate threshold and running economy.', 124, 648,
      { size: 33, weight: 500, color: C.cream, maxW: 800, lh: 1.25, rt: u - 0.7, gap: 0.035 });
    ctx.restore();
  }
  dx = card(u, 1.3, 780, 330, C.teal);
  if (dx !== false) {
    ctx.save(); ctx.translate(dx, 0);
    text('HEALTH', 124, 842, { size: 26, weight: 900, ls: 7, color: C.peach });
    const n = Math.round(13 * E.outCubic(P(u, 1.7, 2.6)));
    text(`${n}%`, 118, 1000, { size: 150, weight: 900, color: C.cream });
    text('lower risk of death from any cause for each 1-MET higher fitness level', 470, 900,
      { size: 32, weight: 700, color: C.cream, maxW: 440, lh: 1.22, rt: u - 1.9, gap: 0.04 });
    text('1 MET = 3.5 mL·kg^{−1}·min^{−1}  ·  Kodama et al., JAMA 2009', 124, 1076, { size: 23, weight: 600, color: C.cream, alpha: 0.8, rt: u - 2.6, gap: 0.03 });
    ctx.restore();
  }
  dx = card(u, 2.5, 1140, 300, C.peach);
  if (dx !== false) {
    ctx.save(); ctx.translate(dx, 0);
    iconArrowUp(160, 1222, 38, C.plum, C.peach);
    text('Trainable', 222, 1240, { size: 48, weight: 800, color: C.plum });
    text('Endurance training raises V̇O_{2}max, but how much varies a lot between people (genetics play a part).', 124, 1320,
      { size: 33, weight: 600, color: C.plum, maxW: 800, lh: 1.25, rt: u - 2.9, gap: 0.035 });
    ctx.restore();
  }
  grain(0.05);
}

/* ==================================================== SCENE 8: OUTRO */
function sceneOutro(u) {
  const t = T.outro + u;
  bgPlum(t);
  blob(540, 760, 520, C.peach, 0.18 * E.outCubic(P(u, 0, 1)));
  vo2Title(540, 740, 170, u, 0.05, 0.4, C.peach, C.peach, C.peach);
  text('= your aerobic ceiling.', 540, 860, { size: 66, weight: 800, color: C.cream, align: 'center', rt: u - 0.55, gap: 0.09 });
  const lp = E.inOutCubic(P(u, 1.0, 2.1));
  const x0 = 170, x1 = 910, y = 1010;
  ctx.save(); ctx.strokeStyle = 'rgba(251,244,236,0.35)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  if (lp > 0) line(x0, y, lerp(x0, x1, lp), y);
  ctx.fillStyle = C.peach;
  if (u > 0.9) { circle(x0, y, 12 * E.outBack(P(u, 0.9, 1.2))); ctx.fill(); }
  if (lp > 0.98) { circle(x1, y, 12 * E.outBack(P(u, 2.05, 2.35))); ctx.fill(); }
  if (lp > 0 && lp < 1) { blob(lerp(x0, x1, lp), y, 50, C.peach, 0.8); }
  ctx.restore();
  text('1923', x0, y + 58, { size: 34, weight: 900, color: C.peach, align: 'center', rt: u - 1.0 });
  text('Hill & Lupton', x0, y + 94, { size: 24, weight: 600, color: C.cream, alpha: 0.75, align: 'center', rt: u - 1.1 });
  text('TODAY', x1, y + 58, { size: 34, weight: 900, color: C.peach, align: 'right', ls: 2, rt: u - 2.1 });
  text('sports labs worldwide', x1, y + 94, { size: 24, weight: 600, color: C.cream, alpha: 0.75, align: 'right', rt: u - 2.2 });
  text('SPORT & EXERCISE SCIENCE', 540, 1215, { size: 26, weight: 900, ls: 7, color: C.peach, align: 'center', rt: u - 1.6, gap: 0.08 });
  text('University of Winchester', 540, 1278, { size: 50, weight: 800, color: C.cream, align: 'center', rt: u - 1.8, gap: 0.1 });
  text('Hill & Lupton (1923) Q J Med 16:135–171 · Bassett & Howley (2000) Med Sci Sports Exerc 32:70–84 · Kodama et al. (2009) JAMA 301:2024–2035',
    540, 1390, { size: 20, weight: 500, color: C.cream, alpha: 0.55, align: 'center', maxW: 860, rt: u - 2.2, gap: 0.01 });
  grain(0.07);
  ctx.drawImage(VIGNETTE_SOFT, 0, 0);
  if (u > 3.55) { ctx.fillStyle = `rgba(10,5,2,${E.inOutSine(P(u, 3.55, 4))})`; ctx.fillRect(0, 0, W, H); }
}

/* ======================================================= transitions */
function swipeBands(t, tb, cols, dur = 0.8) {
  const t0 = tb - 0.38 * dur, p = (t - t0) / dur;
  if (p <= 0 || p >= 1) return;
  const Hb = H * 2.2, D = H + Hb + 600;
  for (let i = cols.length - 1; i >= 0; i--) {
    const pi = E.inOutCubic(clamp((p - i * 0.12) / 0.76));
    if (pi <= 0 || pi >= 1) continue;
    const y0 = H + 300 - pi * D;
    ctx.fillStyle = cols[i];
    ctx.beginPath(); ctx.moveTo(0, y0 + 300); ctx.lineTo(W, y0); ctx.lineTo(W, y0 + Hb); ctx.lineTo(0, y0 + Hb + 300); ctx.closePath(); ctx.fill();
  }
}
function circleWipe(t, tb, dur, cx, cy, drawB, ring) {
  const p = E.inOutCubic(P(t, tb - dur / 2, tb + dur / 2));
  if (p <= 0) return false;
  const r = p * 2300;
  ctx.save(); circle(cx, cy, r); ctx.clip(); drawB(); ctx.restore();
  if (p < 1) { ctx.save(); ctx.strokeStyle = ring; ctx.lineWidth = 26 * (1 - p) + 4; circle(cx, cy, r); ctx.stroke(); ctx.restore(); }
  return true;
}

/* ============================================================ render */
function render(t) {
  FRAME = Math.round(t * FPS);
  ctx.save();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  if (t < T.graph) sceneOpen(t - T.open);
  else if (t < T.name) sceneGraph(t - T.graph);
  else if (t < T.path) sceneName(t - T.name);
  else if (t < T.units - 0.35) scenePath(t - T.path);
  else if (t < T.units + 0.35) { scenePath(t - T.path); circleWipe(t, T.units, 0.7, 540, 900, () => sceneUnits(t - T.units), C.peach); }
  else if (t < T.test) sceneUnits(t - T.units);
  else if (t < T.why) sceneTest(t - T.test);
  else if (t < T.outro - 0.35) sceneWhy(t - T.why);
  else if (t < T.outro + 0.35) { sceneWhy(t - T.why); circleWipe(t, T.outro, 0.7, 540, 760, () => sceneOutro(t - T.outro), C.peach); }
  else sceneOutro(t - T.outro);
  swipeBands(t, T.path, [C.peach, C.plum]);
  swipeBands(t, T.test, [C.peach, C.teal]);
  swipeBands(t, T.why, [C.tealLight, C.peach]);
  ctx.restore();
}
window.renderFrame = t => { render(clamp(t, 0, REEL.DURATION - 1e-6)); };
