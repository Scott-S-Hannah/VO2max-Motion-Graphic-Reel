'use strict';
/* =====================================================================
   What is VO2max? — motion graphic reel (1080x1920, 30 fps, 58 s)
   Deterministic canvas timeline: renderFrame(t) draws the frame at time t.
   Brand: University of Winchester design system (Deep Purple / Bright Purple / Bright Green,
   bespoke motifs, logo, Asset Bank photography). Type: Figtree throughout.
   ===================================================================== */
const W = 1080, H = 1920, FPS = 30;
const REEL = { DURATION: 59, FPS };
window.REEL = REEL;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');

const C = {
  // University of Winchester tokens (Claude Design system "University of Winchester")
  deep: '#291647', deep90: '#3e2d5a', deep75: '#5f5075', deep60: '#7e7391',
  bp: '#c68efd', bp60: '#ddbbfe', bg: '#d4ef70', bg60: '#e5f5a9',
  grey: '#706e6c', grey60: '#a9a8a7', light: '#e6ebeb', white: '#ffffff', tableHead: '#efecf6',
  // archival (1923) treatment
  paper: '#E9DBBF', paperLight: '#F3E9D6', paperDark: '#BFA27A', ink: '#3A2716', inkSoft: '#6E5537',
  stamp: '#291647',
};

// Scene start times (s). Music is 120 bpm from T.name, every cut lands on a beat.
const T = { open: 0, graph: 8, name: 14.5, path: 21, units: 31, test: 38.5, why: 47, outro: 54, end: 59 };

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
const fontFor = (o, mode, hl) => {
  const it = o.italic || (hl && o.hlItalic), wt = hl && o.hlWeight ? o.hlWeight : o.weight || 500;
  return `${it ? 'italic ' : ''}${wt} ${mode === 'n' ? o.size : o.size * 0.62}px Figtree`;
};
const layoutCache = new Map();
function layout(str, o) {
  const key = [str, o.size, o.weight || 500, o.italic ? 1 : 0, o.maxW || 0, o.ls || 0, o.lh || 0, o.hlItalic ? 1 : 0, o.hlWeight || 0].join('|');
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
      else { ctx.font = fontFor(o, r.mode, r.hl); r.w = ctx.measureText(r.text).width; }
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
  const col = o.color || C.white, hlc = o.hl || C.bg;
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
        else { ctx.font = fontFor(o, r.mode, r.hl); ctx.fillText(txt, rx, by); }
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
  // Brand assets from the University of Winchester design system
  await Promise.all([
    loadImg('lab', 'assets/lab-treadmill.jpg'),
    loadImg('mask', 'assets/mask-portrait.jpg'),
    loadImg('logo', 'assets/uow-logo-banner-white.png'),
  ]);
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
function blob(x, y, r, col, a) {
  ctx.save(); const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}

/* ------------------------------------------------ brand motifs (UoW)
   The eight bespoke motifs, in their fixed order, as single-colour shapes
   (paths copied from the University of Winchester design system, 80.94 unit box). */
const MOTIF_D = [
  'M74.36 34.58C70.41 32.24 66.69 31.65 64.63 31.48C64.43 28.77 64.32 24.07 60.7 20.63C55.94 16.09 50.6 17.04 49.72 17.05C49.85 14.89 49.78 12.97 49.27 11.24C48.4 8.3 46.9 6.39 44.69 4.01C42.97 2.17 40.47 0 40.47 0C40.47 0 37.97 2.17 36.25 4.01C34.04 6.39 32.54 8.3 31.67 11.24C31.15 12.97 31.09 14.89 31.22 17.05C30.34 17.04 25 16.09 20.24 20.63C16.62 24.07 16.51 28.77 16.31 31.48C14.25 31.65 10.53 32.24 6.58 34.58C3.3 36.53 1.19 38.9 0 40.47C1.19 42.04 3.3 44.41 6.58 46.36C10.53 48.7 14.25 49.29 16.31 49.46C16.51 52.16 16.62 56.86 20.24 60.31C25 64.85 30.34 63.9 31.22 63.89C31.09 66.04 31.15 67.97 31.67 69.7C32.54 72.64 34.04 74.54 36.25 76.92C37.97 78.77 40.47 80.94 40.47 80.94C40.47 80.94 42.97 78.77 44.69 76.92C46.9 74.54 48.4 72.64 49.27 69.7C49.78 67.97 49.85 66.04 49.72 63.89C50.6 63.9 55.94 64.85 60.7 60.31C64.32 56.86 64.43 52.16 64.63 49.46C66.69 49.29 70.41 48.7 74.36 46.36C77.64 44.41 79.75 42.04 80.94 40.47C79.75 38.9 77.64 36.53 74.36 34.58Z',
  'M63.99 0L63.99 17.11L16.95 17.11L16.95 0L0 0L0 80.94L16.95 80.94L16.95 41.94C20.69 37.48 27.89 31.54 40.73 29.3L40.74 29.3C53 31.44 60.12 36.96 63.99 41.34L63.99 80.94L80.94 80.94L80.94 0L63.99 0Z',
  'M67.14 39.77C57.19 39.77 41.17 23.75 41.17 13.8C41.17 13.41 40.86 13.09 40.47 13.09C40.08 13.09 39.77 13.41 39.77 13.8C39.77 23.75 23.75 39.77 13.8 39.77C13.41 39.77 13.09 40.08 13.09 40.47C13.09 40.86 13.41 41.17 13.8 41.17C23.75 41.17 39.77 57.19 39.77 67.14C39.77 67.53 40.08 67.84 40.47 67.84C40.86 67.84 41.17 67.53 41.17 67.14C41.17 57.19 57.19 41.17 67.14 41.17C67.53 41.17 67.84 40.86 67.84 40.47C67.84 40.08 67.53 39.77 67.14 39.77ZM9.27 40.47C9.27 43.03 7.2 45.1 4.64 45.1C2.08 45.1 0 43.03 0 40.47C0 37.91 2.08 35.83 4.64 35.83C7.2 35.83 9.27 37.91 9.27 40.47ZM80.94 40.47C80.94 43.03 78.86 45.1 76.3 45.1C73.74 45.1 71.67 43.03 71.67 40.47C71.67 37.91 73.74 35.83 76.3 35.83C78.86 35.83 80.94 37.91 80.94 40.47ZM45.1 4.54C45.1 7.05 43.07 9.09 40.56 9.09C38.05 9.09 36.02 7.05 36.02 4.54C36.02 2.03 38.05 0 40.56 0C43.07 0 45.1 2.03 45.1 4.54ZM45.1 76.3C45.1 78.86 43.03 80.94 40.47 80.94C37.91 80.94 35.83 78.86 35.83 76.3C35.83 73.74 37.91 71.67 40.47 71.67C43.03 71.67 45.1 73.74 45.1 76.3Z',
  'M20.5 80.91L46.8 80.91L52.7 73.63L20.5 80.9L20.5 80.91ZM80.97 35.63L73.2 0L46.35 0L43.29 0L80.97 49.81L80.97 35.63ZM10.88 0L0 0L0 43.05L17.36 80.94L21.29 80.94L21.36 80.92L12.39 2.61L53.57 73.65L52.24 64.16L76.63 64.16L80.97 59.86L80.97 56.61L52.16 63.59L43.29 0L12.09 0L10.88 0Z',
  'M36.17 56.91C41.86 42.65 42.15 22.9 21.8 0C-23.56 40.57 15.45 78.17 18.19 80.71L18.3 80.79C19.48 79.88 26.87 73.94 32.6 64.18C29.68 72.17 29.82 79.45 29.86 80.56L29.87 80.67C29.87 80.69 29.87 80.7 29.87 80.7C32.48 81.04 69.94 85 72.5 41.57C52.46 40.46 41.82 48.09 36.17 56.91Z',
  'M31.36 0V47.51H39.63V0ZM28.41 47.51V80.94H31.31V47.51ZM39.63 47.51V80.94H42.54V47.51ZM47 47.51V80.94H49.91V47.51ZM68.22 47.51V80.94H71.12V47.51ZM2.4 47.51V80.94H5.31V47.51ZM22.51 0V47.51H25.42V0ZM11.25 0V47.51H14.15V0ZM44.1 0V47.51H47V0ZM51.47 0V47.51H54.38V0ZM62.74 0V47.51H65.65V0ZM71.12 0V47.51H74.03V0ZM0 0V47.51H2.91V0ZM14.15 47.51V80.94H22.51V47.51ZM54.38 47.51V80.94H62.74V47.51Z',
  'M74.34 53.43C74.23 47.78 71 42.92 66.32 40.47C71.18 37.92 74.45 32.78 74.34 26.92C74.17 18.65 67.35 12.09 59.08 12.25C56.55 12.3 54.18 12.98 52.11 14.13C51.67 6.12 44.96 -0.16 36.87 0C28.99 0.16 22.65 6.38 22.23 14.13C20 12.89 17.41 12.2 14.67 12.25C6.4 12.42 -0.16 19.25 0 27.51C0.11 33.16 3.35 38.01 8.02 40.47C3.16 43.02 -0.11 48.16 0 54.02C0.17 62.28 7 68.84 15.26 68.68C17.79 68.63 20.16 67.95 22.23 66.8C22.67 74.81 29.38 81.09 37.47 80.93C45.35 80.78 51.69 74.55 52.11 66.8C54.35 68.04 56.93 68.73 59.68 68.68C67.94 68.52 74.5 61.69 74.34 53.43M37.47 55.42C29.2 55.59 22.38 49.02 22.21 40.76C22.05 32.5 28.61 25.67 36.87 25.51C45.14 25.35 51.96 31.91 52.13 40.17C52.29 48.43 45.73 55.26 37.47 55.42Z',
  'M80.94 0L80.94 31.44L15.43 0L80.94 0ZM0 80.94L0 15.43L31.44 80.94L0 80.94ZM42.96 80.94L80.94 80.94L80.94 42.97L7.91 7.91L42.96 80.94M50.69 69.75L32.54 31.94L70.34 50.09L70.34 69.75L50.69 69.75Z',
];
const MOTIF = MOTIF_D.map(d => new Path2D(d));
const MQ = 80.94;
// draw motif i centred at (x,y), size px, rotation rad
function motif(i, x, y, size, col, rot = 0, a = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); const k = size / MQ; ctx.scale(k, k); ctx.translate(-MQ / 2, -MQ / 2);
  ctx.globalAlpha *= a; ctx.fillStyle = col; ctx.fill(MOTIF[i]); ctx.restore();
}
// MotifStrip: all eight in fixed order, one colour, gap 17% of height; revealed left to right by p
function motifStrip(cx, y, h, col, p = 1) {
  const gap = h * 0.17, total = 8 * h + 7 * gap;
  for (let i = 0; i < 8; i++) {
    const q = E.outBack(clamp(p * 8 - i));
    if (q <= 0) continue;
    const x = cx - total / 2 + i * (h + gap) + h / 2;
    ctx.save(); ctx.translate(x, y + h / 2); ctx.scale(q, q); motif(i, 0, 0, h, col); ctx.restore();
  }
}
// PatternPanel-style background: a motif enlarged across the ground in the ground's tint
function motifPattern(i, t, col, a = 1, cfg = {}) {
  const { x = 760, y = 1180, size = 1500, drift = 1 } = cfg;
  motif(i, x + 40 * Math.sin(t * 0.25 * drift), y + 30 * Math.cos(t * 0.2 * drift), size, col, 0.04 * Math.sin(t * 0.15), a);
}

/* ------------------------------------------------------------- grounds */
function bgDeep(t, mi, cfg) {
  ctx.fillStyle = C.deep; ctx.fillRect(0, 0, W, H);
  motifPattern(mi, t, C.deep90, 1, cfg);
}
function bgWhite(t, mi, cfg) {
  ctx.fillStyle = C.white; ctx.fillRect(0, 0, W, H);
  motifPattern(mi, t, C.light, 0.7, cfg);
}
function hud(ch, onLight, a = 1) {
  const col = onLight ? C.deep : C.white, acc = onLight ? C.deep : C.bg;
  withAlpha(a, () => {
    text('V̇O_{2}max  EXPLAINED', 80, 232, { size: 24, weight: 800, ls: 3, color: col });
    text(`0${ch} / 05`, 1000, 232, { size: 24, weight: 800, ls: 2, color: col, align: 'right' });
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < ch ? acc : col; ctx.globalAlpha = a * (i < ch ? 1 : 0.25);
      ctx.fillRect(1000 - (5 - i) * 30 + 4, 250, 22, 5);
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
  ctx.fillStyle = C.deep; lobe(-1); ctx.fill(); lobe(1); ctx.fill();
  ctx.strokeStyle = C.deep; ctx.lineCap = 'round'; ctx.lineWidth = 16;
  line(0, -170, 0, -60);
  ctx.strokeStyle = C.bg; ctx.lineWidth = 9;
  for (const sgn of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sgn * 22, -50); ctx.quadraticCurveTo(sgn * 40, -35, sgn * 60, -20); ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(sgn * 60, -20); ctx.lineTo(sgn * 95, -55); ctx.moveTo(sgn * 60, -20); ctx.lineTo(sgn * 100, 20);
    ctx.moveTo(sgn * 60, -20); ctx.lineTo(sgn * 70, 70); ctx.moveTo(sgn * 85, 5); ctx.lineTo(sgn * 110, 60); ctx.stroke();
    ctx.lineWidth = 9;
  }
  ctx.restore();
}
function heart(cx, cy, s, pulse) {
  ctx.save(); ctx.translate(cx, cy); const k = s / 2 * (1 + 0.1 * pulse); ctx.scale(k, k);
  blob(0, 0, 0.9, C.bp, 0.55 * pulse);
  ctx.beginPath();
  ctx.moveTo(0, 0.42);
  ctx.bezierCurveTo(-0.55, 0.05, -0.62, -0.42, -0.28, -0.46);
  ctx.bezierCurveTo(-0.12, -0.47, -0.02, -0.36, 0, -0.26);
  ctx.bezierCurveTo(0.02, -0.36, 0.12, -0.47, 0.28, -0.46);
  ctx.bezierCurveTo(0.62, -0.42, 0.55, 0.05, 0, 0.42);
  ctx.fillStyle = C.deep; ctx.fill();
  ctx.strokeStyle = C.bp; ctx.lineWidth = 0.045; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-0.24, -0.24, 0.13, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  ctx.restore();
}
function muscle(cx, cy, s, t) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s / 300, s / 300);
  ctx.strokeStyle = C.deep; ctx.lineWidth = 10; ctx.lineCap = 'round';
  line(-150, 0, -110, 0); line(110, 0, 150, 0);
  ctx.beginPath(); ctx.moveTo(-115, 0);
  ctx.bezierCurveTo(-60, -95, 60, -95, 115, 0); ctx.bezierCurveTo(60, 95, -60, 95, -115, 0);
  ctx.fillStyle = C.deep; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = C.deep75; ctx.lineWidth = 3;
  for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(-120, i * 16); ctx.bezierCurveTo(-40, i * 22, 40, i * 22, 120, i * 16); ctx.stroke(); }
  ctx.restore();
  [[-45, -18, 0.2], [30, 22, -0.25], [55, -30, 0.35]].forEach(([mx, my, rot], i) => {
    ctx.save(); ctx.translate(mx, my); ctx.rotate(rot);
    const glow = 0.5 + 0.5 * Math.sin(t * 6 + i * 2);
    blob(0, 0, 55, C.bg, 0.3 * glow);
    ctx.fillStyle = C.bg; ctx.beginPath(); ctx.ellipse(0, 0, 30, 15, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = C.deep; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-22, 0);
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
// KeyIcon-style tile: rounded square in a primary colour with a Deep Purple line icon
function keyTile(x, y, s, bgc) { ctx.fillStyle = bgc; rrect(x - s / 2, y - s / 2, s, s, s * 0.22); ctx.fill(); }
function iconArrowUp(x, y, r, fg) {
  ctx.save(); ctx.strokeStyle = fg; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - r * 0.5, y + r * 0.3); ctx.lineTo(x - r * 0.12, y - r * 0.05); ctx.lineTo(x + r * 0.12, y + r * 0.15); ctx.lineTo(x + r * 0.5, y - r * 0.3);
  ctx.moveTo(x + r * 0.22, y - r * 0.32); ctx.lineTo(x + r * 0.5, y - r * 0.3); ctx.lineTo(x + r * 0.5, y - r * 0.02); ctx.stroke();
  ctx.restore();
}
function iconHeartbeat(x, y, r, fg) {
  ctx.save(); ctx.strokeStyle = fg; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - r * 0.6, y); ctx.lineTo(x - r * 0.25, y); ctx.lineTo(x - r * 0.1, y - r * 0.4); ctx.lineTo(x + r * 0.1, y + r * 0.4); ctx.lineTo(x + r * 0.25, y); ctx.lineTo(x + r * 0.6, y); ctx.stroke();
  ctx.restore();
}
// brand bullet / arrow: solid triangle
function triangle(x, y, s, col, dir = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(dir); ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(s * 0.6, 0); ctx.lineTo(-s * 0.4, -s * 0.55); ctx.lineTo(-s * 0.4, s * 0.55); ctx.closePath(); ctx.fill(); ctx.restore();
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
    ctx.strokeStyle = glow > 0 ? '#9DB83A' : C.stamp; ctx.lineWidth = 4 + 3 * glow; ctx.setLineDash([18, 12]);
    if (glow > 0) { ctx.shadowColor = C.bg; ctx.shadowBlur = 40 * glow; }
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
  rg.addColorStop(0, 'rgba(212,239,112,0)'); rg.addColorStop(0.8, 'rgba(198,142,253,0.45)'); rg.addColorStop(1, 'rgba(212,239,112,0.95)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // embers
  const rnd = mulberry32(99);
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2, d = r * (1.02 + rnd() * 0.15) + (u - 5) * 60 * rnd();
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d - (u - 5) * 90 * rnd();
    ctx.fillStyle = rnd() < 0.5 ? `rgba(212,239,112,${0.9 * rnd()})` : `rgba(198,142,253,${0.9 * rnd()})`; circle(x, y, 2 + rnd() * 3); ctx.fill();
  }
}

/* ===================================================== SCENE 3: NAME */
function vo2Title(cx, baseY, big, u, t0, spread, cols = {}) {
  const { v = C.bg, o = C.bg, max = C.white, dot = C.bp } = cols;
  const sub = big * 0.5;
  const fV = `800 ${big}px Figtree`, fS = `800 ${sub}px Figtree`, fM = `italic 600 ${sub}px Figtree`;
  ctx.save();
  ctx.font = fV; const wV = ctx.measureText('V').width, wO = ctx.measureText('O').width;
  ctx.font = fS; const w2 = ctx.measureText('2').width;
  ctx.font = fM; const wM = ctx.measureText('max').width;
  const g = 28 * spread;
  const total = wV + wO + w2 + wM + 6 + g * 2;
  let x = cx - total / 2;
  const pieces = [
    { s: 'V', f: fV, x, dy: 0, col: v },
    { s: 'O', f: fV, x: x += wV + g, dy: 0, col: o },
    { s: '2', f: fS, x: x += wO, dy: big * 0.16, col: o },
    { s: 'max', f: fM, x: x += w2 + 6 + g, dy: big * 0.16, col: max },
  ];
  pieces.forEach((pc, i) => {
    const p = P(u, t0 + i * 0.12, t0 + i * 0.12 + 0.6);
    if (p <= 0) return;
    ctx.globalAlpha = clamp(p * 3); ctx.fillStyle = pc.col; ctx.font = pc.f;
    ctx.fillText(pc.s, pc.x, baseY + pc.dy - (1 - E.outBack(p)) * 180);
  });
  const dp = P(u, t0 + 0.75, t0 + 1.05);
  if (dp > 0) {
    ctx.globalAlpha = 1; ctx.fillStyle = dot;
    circle(pieces[0].x + wV / 2, baseY - big * 0.83, big * 0.062 * E.outBack(dp)); ctx.fill();
    const rp = P(u, t0 + 0.8, t0 + 1.4);
    ctx.strokeStyle = dot; ctx.lineWidth = 3; ctx.globalAlpha = 1 - rp;
    circle(pieces[0].x + wV / 2, baseY - big * 0.83, big * 0.07 + rp * 60); ctx.stroke();
  }
  ctx.restore();
  return [pieces[0].x + wV / 2, (pieces[1].x + pieces[2].x + w2) / 2, pieces[3].x + wM / 2];
}
// CopyFrame: Bright Purple panel with a Deep Purple motif (the leaves) cropped into its foot
function copyFrame(x, y, w, h, motifSize = 250) {
  ctx.save(); ctx.fillStyle = C.bp; rrect(x, y, w, h, 12); ctx.fill(); ctx.clip();
  motif(4, x + w - motifSize * 0.12, y + h + motifSize * 0.14, motifSize, C.deep);
  ctx.restore();
}
function sceneName(u) {
  const t = T.name + u;
  bgDeep(t, 0, { x: 860, y: 1560, size: 1300 });
  hud(1, false, E.outCubic(P(u, 0.2, 0.8)));
  text('A century later, we call it', 540, 560, { size: 46, weight: 500, color: C.white, align: 'center', rt: u - 0.1 });
  const spread = E.inOutCubic(P(u, 2.0, 2.6));
  const cols = vo2Title(540, 880, 290, u, 0.45, spread);
  const labels = [['Volume', 'per minute (the dot)'], ['of oxygen', 'taken up and used'], ['Maximum', 'at all-out effort']];
  labels.forEach(([a, b], i) => {
    const p = P(u, 2.3 + i * 0.3, 2.8 + i * 0.3);
    if (p <= 0) return;
    const e = E.outCubic(p), x = cols[i];
    ctx.save(); ctx.strokeStyle = C.bp; ctx.lineWidth = 3; line(x, 930, x, 930 + 64 * e);
    triangle(x, 1000, 18 * e, C.bp, Math.PI / 2); ctx.restore();
    text(a, x, 1062, { size: 40, weight: 800, color: C.bp, align: 'center', rt: u - 2.45 - i * 0.3 });
    text(b, x, 1104, { size: 26, weight: 500, color: C.white, align: 'center', rt: u - 2.55 - i * 0.3 });
  });
  const cp = E.outCubic(P(u, 3.9, 4.5));
  if (cp > 0) {
    ctx.save(); ctx.globalAlpha = cp; ctx.translate(0, (1 - cp) * 60);
    copyFrame(80, 1160, 920, 340, 400);
    ctx.restore();
    text('DEFINITION', 124, 1222, { size: 24, weight: 900, ls: 7, color: C.deep, rt: u - 4.1 });
    text('The highest rate at which your body can *take in*, *transport* and *use* oxygen during exercise.', 124, 1292,
      { size: 44, weight: 700, color: C.deep, hl: C.deep, hlItalic: true, hlWeight: 900, maxW: 610, lh: 1.2, rt: u - 4.25, gap: 0.075 });
  }
  grain(0.035);
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
  bgWhite(t, 1, { x: 900, y: 1560, size: 1150 });
  hud(2, true);
  const sw = E.inOutCubic(P(u, 5.3, 5.9));
  ctx.save(); ctx.beginPath(); ctx.rect(0, 270, W, 170); ctx.clip();
  ctx.save(); ctx.translate(0, -sw * 170);
  text('FROM AIR TO MUSCLE', 80, 322, { size: 26, weight: 900, ls: 7, color: C.deep, rt: u - 0.05 });
  text('The oxygen *journey*', 80, 410, { size: 80, weight: 800, color: C.deep, hl: C.bp, hlItalic: true, rt: u - 0.15, gap: 0.08 });
  ctx.translate(0, 170);
  text('THE FICK PRINCIPLE', 80, 322, { size: 26, weight: 900, ls: 7, color: C.deep });
  text('One simple *equation*', 80, 410, { size: 80, weight: 800, color: C.deep, hl: C.bp, hlItalic: true });
  ctx.restore(); ctx.restore();
  const aA = 1 - E.inCubic(P(u, 5.2, 5.75));
  if (aA > 0) {
    ctx.save(); ctx.globalAlpha = aA; ctx.translate(0, -(1 - aA) * 100);
    const vp = E.inOutSine(P(u, 0.2, 3.6));
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = C.light; ctx.lineWidth = 34;
    ctx.beginPath(); PATH_PTS.slice(0, Math.max(2, Math.floor(vp * 200))).forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.stroke();
    ctx.lineWidth = 3; ctx.setLineDash([4, 14]); ctx.lineDashOffset = -u * 40; ctx.strokeStyle = C.deep60; ctx.stroke();
    ctx.restore();
    const ls = E.outBack(P(u, 0.35, 0.9)), hs = E.outBack(P(u, 1.65, 2.2)), ms = E.outBack(P(u, 2.95, 3.5));
    if (ls > 0) { ctx.save(); ctx.translate(300, 590); ctx.scale(ls, ls); lungs(0, 0, 300, Math.sin(u * Math.PI)); ctx.restore(); }
    if (hs > 0) { ctx.save(); ctx.translate(300, 920); ctx.scale(hs, hs); heart(0, 0, 260, beatPulse(u)); ctx.restore(); }
    if (ms > 0) { ctx.save(); ctx.translate(300, 1235); ctx.scale(ms, ms); muscle(0, 0, 330, u); ctx.restore(); }
    if (u > 0.8) {
      const k = (u - 0.8) * 0.24;
      for (let i = 0; i < 22; i++) {
        const s = (k + i / 22) % 1;
        if (!(s <= k || k + i / 22 >= 1) || s > vp) continue;
        const [px, py] = pathAt(s);
        const off = Math.sin(i * 7.3 + u * 3) * 22;
        const fade = s > 0.9 ? 1 - (s - 0.9) / 0.1 : s < 0.04 ? s / 0.04 : 1;
        const r = 7 + (i % 3) * 2.5;
        blob(px + off, py, r * 3, C.bp, 0.5 * fade);
        ctx.fillStyle = C.bp; ctx.globalAlpha = aA * fade; circle(px + off, py, r); ctx.fill(); ctx.globalAlpha = aA;
        if (i % 7 === 3) text('O_{2}', px + off + r + 6, py + 9, { size: 26, weight: 800, color: C.deep, alpha: fade });
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
      ctx.save(); ctx.translate(545, y - 10); ctx.scale(p, p); keyTile(0, 0, 54, C.bg); ctx.restore();
      text(String(i + 1), 545, y + 1, { size: 30, weight: 900, color: C.deep, align: 'center', alpha: clamp(p) });
      text(tag, 590, y + 1, { size: 30, weight: 900, ls: 5, color: C.deep, rt: u - st - 0.1 });
      text(desc, 520, y + 66, { size: 38, weight: 700, color: C.deep, maxW: 420, lh: 1.18, rt: u - st - 0.2, gap: 0.05 });
    });
    ctx.restore();
  }
  if (u > 5.5) {
    text('V̇O_{2}max =', 540, 690, { size: 120, weight: 900, color: C.deep, align: 'center', rt: u - 5.65, gap: 0.12, dur: 0.6 });
    const chips = [
      { t: 'HR', lab: 'heart rate', bg: C.deep, fg: C.bg },
      { t: 'SV', lab: 'stroke volume', bg: C.deep, fg: C.bg },
      { t: 'a–v̄O_{2} diff', lab: 'O_{2} extracted by muscle', bg: C.bp, fg: C.deep },
    ];
    const cs = { size: 62, weight: 800 };
    const widths = chips.map(c => textW(c.t, cs) + 80);
    const xw = 64, total = widths.reduce((a, b) => a + b, 0) + xw * 2;
    let x = 540 - total / 2; const cy = 860, chh = 124;
    const xs = [];
    chips.forEach((c, i) => {
      const st = 6.05 + i * 0.3, p = P(u, st, st + 0.5);
      xs.push([x, widths[i]]);
      if (p > 0) {
        const e = E.outBack(p);
        ctx.save(); ctx.translate(x + widths[i] / 2, cy); ctx.scale(e, e);
        ctx.fillStyle = c.bg; rrect(-widths[i] / 2, -chh / 2, widths[i], chh, chh / 2); ctx.fill();
        ctx.restore();
        withAlpha(clamp(p * 2), () => text(c.t, x + widths[i] / 2, cy + 22, { ...cs, color: c.fg, align: 'center' }));
        text(c.lab, x + widths[i] / 2, cy + chh / 2 + 44, { size: 27, weight: 600, color: C.deep, align: 'center', rt: u - st - 0.25 });
        if (i < 2) text('×', x + widths[i] + xw / 2, cy + 22, { size: 64, weight: 700, color: C.deep, align: 'center', alpha: clamp(p * 2) });
      }
      x += widths[i] + xw;
    });
    const bp = E.outCubic(P(u, 7.1, 7.6));
    if (bp > 0) {
      const x0 = xs[0][0] + 10, x1 = xs[1][0] + xs[1][1] - 10, yb = 990;
      ctx.save(); ctx.strokeStyle = C.deep; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const xm = (x0 + x1) / 2, hw = (x1 - x0) / 2 * bp;
      ctx.beginPath(); ctx.moveTo(xm - hw, yb - 12); ctx.lineTo(xm - hw, yb); ctx.lineTo(xm + hw, yb); ctx.lineTo(xm + hw, yb - 12);
      ctx.moveTo(xm, yb); ctx.lineTo(xm, yb + 14 * bp); ctx.stroke(); ctx.restore();
      text('= cardiac output (O_{2} delivery)', xm, yb + 58, { size: 30, weight: 800, color: C.deep, align: 'center', rt: u - 7.3 });
    }
    const np = E.outCubic(P(u, 7.7, 8.2));
    if (np > 0) {
      ctx.save(); ctx.globalAlpha = np; ctx.translate(0, (1 - np) * 50);
      ctx.fillStyle = C.deep; rrect(80, 1160, 920, 290, 12); ctx.fill(); ctx.clip();
      motif(6, 960, 1440, 240, C.deep90);
      ctx.restore();
      text('In healthy people, *how much blood the heart can pump* is usually the main limit on V̇O_{2}max.', 124, 1238,
        { size: 42, weight: 700, color: C.white, hl: C.bg, maxW: 780, lh: 1.2, rt: u - 7.9, gap: 0.05 });
      text('Bassett & Howley, 2000', 124, 1414, { size: 24, weight: 700, color: C.bp, rt: u - 8.6 });
    }
  }
  grain(0.03);
}

/* ==================================================== SCENE 5: UNITS */
function whitePanel(x, y, w, h, p = 1) {
  ctx.save(); ctx.globalAlpha *= p; ctx.translate(0, (1 - p) * 50); ctx.fillStyle = C.white; rrect(x, y, w, h, 12); ctx.fill(); ctx.restore();
}
function sceneUnits(u) {
  const t = T.units + u;
  bgDeep(t, 6, { x: 250, y: 1650, size: 1300 });
  hud(3, false);
  text('THE NUMBERS', 80, 322, { size: 26, weight: 900, ls: 7, color: C.bp, rt: u - 0.05 });
  text('How it’s *measured*', 80, 410, { size: 80, weight: 800, color: C.bg, hl: C.white, hlItalic: true, rt: u - 0.15, gap: 0.08 });
  const pcs = [['mL', 'of oxygen', C.bg], ['·kg^{−1}', 'per kg body mass', C.white], ['·min^{−1}', 'per minute', C.white]];
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
      text(lab, x + ws[i] / 2 - 6, 672, { size: 26, weight: 600, color: C.bp, align: 'center', rt: u - st - 0.2 });
    }
    x += ws[i];
  });
  text('Scaling to body mass means people of different sizes can be compared fairly.', 540, 770,
    { size: 34, weight: 500, color: C.white, align: 'center', maxW: 860, rt: u - 1.7, gap: 0.04 });
  // chart on a white panel (brand rule: charts always sit on white)
  const pp = E.outCubic(P(u, 2.0, 2.5));
  if (pp > 0) {
    whitePanel(80, 860, 920, 640, pp);
    ctx.save(); ctx.globalAlpha = pp; ctx.translate(0, (1 - pp) * 50);
    text('Typical V̇O_{2}max values', 124, 925, { size: 32, weight: 800, color: C.deep });
    text('mL·kg^{−1}·min^{−1}, approximate', 124, 962, { size: 22, weight: 400, color: C.grey });
    const bx = 124, bw = 600;
    ctx.strokeStyle = C.light; ctx.lineWidth = 1;
    for (let v = 0; v <= 100; v += 20) line(bx + v / 100 * bw, 1000, bx + v / 100 * bw, 1395);
    for (let v = 0; v <= 100; v += 20) text(String(v), bx + v / 100 * bw, 1428, { size: 20, weight: 600, color: C.grey, align: 'center' });
    const rows = [
      ['Typical inactive adult', 35, null, '≈ 35'],
      ['Recreational runner', 50, null, '≈ 50'],
      ['Elite endurance athlete', 70, 85, '70–85+'],
      ['Highest ever reported', 96, null, '≈ 96'],
    ];
    rows.forEach(([lab, val, hi, txt], i) => {
      const y = 1018 + i * 98, st = 2.4 + i * 0.5;
      text(lab, bx, y + 8, { size: 27, weight: 700, color: C.deep, rt: u - st });
      const p = E.outCubic(P(u, st + 0.1, st + 0.9));
      if (p <= 0) return;
      const w1 = val / 100 * bw * p;
      ctx.fillStyle = C.deep; ctx.fillRect(bx, y + 22, Math.max(4, w1), 42);
      let end = bx + w1;
      if (hi) {
        const p2 = E.outCubic(P(u, st + 0.8, st + 1.3));
        const w2 = (hi - val) / 100 * bw * p2;
        ctx.fillStyle = C.bp; ctx.fillRect(bx + w1, y + 22, w2, 42);
        ctx.fillStyle = C.white; ctx.fillRect(bx + w1, y + 22, 2, 42); // thin white divider
        end += w2;
      }
      const shown = p < 1 ? String(Math.round(val * p)) : txt;
      text(shown, end + 16, y + 56, { size: 36, weight: 900, color: C.deep });
    });
    text('Values vary with age, sex, genetics and training.', 124, 1472, { size: 22, weight: 400, italic: true, color: C.grey, rt: u - 4.6, gap: 0.02 });
    ctx.restore();
  }
  grain(0.035);
}

/* ===================================================== SCENE 6: TEST */
const TEST_DATA = (() => {
  const r = mulberry32(21), d = [];
  for (let i = 0; i < 150; i++) { const tau = i / 149; d.push([tau, smin(0.1 + 0.95 * tau, 0.8, 22) + (r() + r() + r() - 1.5) * 0.04]); }
  return d;
})();
// draw an image into (x,y,w,h), cropping around focus (fx,fy in 0..1) at zoom z (1 = cover)
function photo(im, x, y, w, h, fx, fy, z) {
  if (!im) { ctx.fillStyle = C.deep75; ctx.fillRect(x, y, w, h); return; }
  const sc = Math.max(w / im.width, h / im.height) * z;
  const sw = w / sc, sh = h / sc;
  const sx = clamp(fx * im.width - sw / 2, 0, im.width - sw), sy = clamp(fy * im.height - sh / 2, 0, im.height - sh);
  ctx.drawImage(im, sx, sy, sw, sh, x, y, w, h);
}
function sceneTest(u) {
  const t = T.test + u;
  bgDeep(t, 5, { x: 860, y: 1650, size: 1250 });
  hud(4, false);
  text('IN THE LAB TODAY', 80, 322, { size: 26, weight: 900, ls: 7, color: C.bp, rt: u - 0.05 });
  text('The modern *test*', 80, 410, { size: 80, weight: 800, color: C.bg, hl: C.white, hlItalic: true, rt: u - 0.15, gap: 0.08 });
  const head = E.inOutSine(P(u, 0.6, 5.2));
  const stage = Math.min(10, Math.floor(head * 10) + 1), kmh = 7 + stage;
  // Asset Bank photograph, bevelled corners, slow push-in
  const rp = E.outQuint(P(u, 0.15, 0.9));
  if (rp > 0) {
    const ph = 390, py = 450, hw = 460 * rp;
    ctx.save(); rrect(540 - hw, py, hw * 2, ph, 12); ctx.clip();
    photo(IMG.lab, 80, py, 920, ph, lerp(0.42, 0.45, u / 8.5), 0.36, lerp(1.0, 1.14, u / 8.5));
    ctx.restore();
    // live readout chip (Button style: Deep Purple pill, Bright Green label)
    const cp = E.outBack(P(u, 0.7, 1.1));
    if (cp > 0) {
      const label = `STAGE ${stage}  ·  ${kmh} km/h`, lo = { size: 26, weight: 800, ls: 2 };
      const cw = textW(label, lo) + 76;
      ctx.save(); ctx.translate(104, 474); ctx.scale(cp, cp);
      ctx.fillStyle = C.deep; rrect(0, 0, cw, 54, 27); ctx.fill();
      ctx.fillStyle = C.bg; ctx.globalAlpha = 0.55 + 0.45 * Math.sin(u * 8); circle(28, 27, 8); ctx.fill(); ctx.globalAlpha = 1;
      text(label, 50, 36, { ...lo, color: C.bg });
      ctx.restore();
    }
  }
  // live graph on a white panel
  const gpA = E.outCubic(P(u, 0.4, 0.9));
  const L = 150, R = 955, B = 1228, Tp = 935;
  const X = tau => lerp(L, R, tau), Y = v => lerp(B, Tp, v / 0.95);
  if (gpA > 0) {
    whitePanel(80, 865, 920, 420, gpA);
    ctx.save(); ctx.globalAlpha = gpA;
    ctx.strokeStyle = C.light; ctx.lineWidth = 1;
    for (let k = 1; k < 10; k++) line(X(k / 10), Tp, X(k / 10), B);
    ctx.strokeStyle = C.deep; ctx.lineWidth = 2; line(L, B, R, B); line(L, B, L, Tp - 10);
    ctx.restore();
    text('V̇O_{2}', L - 14, Tp + 10, { size: 28, weight: 800, color: C.deep, align: 'right', alpha: gpA });
    text('time  →  workload rises every stage', R, B + 38, { size: 21, weight: 600, color: C.grey, align: 'right', alpha: gpA });
  }
  const pb = E.outCubic(P(u, 5.0, 5.5));
  if (pb > 0) {
    const x0 = X(0.72), yy = Y(0.8);
    ctx.fillStyle = C.bg60; ctx.fillRect(x0, yy - 42, (R - x0) * pb, 84);
    text('PLATEAU = V̇O_{2}max', R - 6, yy - 56, { size: 24, weight: 900, ls: 2, color: C.deep, align: 'right', rt: u - 5.2 });
  }
  if (head > 0) {
    ctx.save();
    ctx.fillStyle = C.bp;
    for (const [tau, v] of TEST_DATA) { if (tau > head) break; circle(X(tau), Y(v), 4.5); ctx.fill(); }
    ctx.strokeStyle = C.deep; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); let first = true, last = null;
    for (let tau = 0; tau <= head; tau += 0.005) { const p = [X(tau), Y(smin(0.1 + 0.95 * tau, 0.8, 22))]; first ? ctx.moveTo(...p) : ctx.lineTo(...p); first = false; last = p; }
    ctx.stroke();
    if (last && head < 1) { ctx.fillStyle = C.bg; circle(last[0], last[1], 11); ctx.fill(); ctx.lineWidth = 3; ctx.stroke(); }
    ctx.restore();
  }
  text('COMMON CHECKS FOR A TRUE MAXIMUM', 80, 1338, { size: 22, weight: 900, ls: 4, color: C.bp, rt: u - 5.3 });
  const crit = [['V̇O_{2} plateaus', true], ['RER ≥ 1.10', true], ['HR near predicted max', true], ['No plateau? → V̇O_{2}peak', false]];
  crit.forEach(([s, ok], i) => {
    const st = 5.5 + i * 0.45, p = P(u, st, st + 0.45);
    if (p <= 0) return;
    const e = E.outBack(p), cx = i % 2 ? 525 : 80, cyy = 1360 + Math.floor(i / 2) * 80, w = 425;
    ctx.save(); ctx.translate(cx + w / 2, cyy + 33); ctx.scale(e, e); ctx.translate(-(cx + w / 2), -(cyy + 33));
    ctx.strokeStyle = ok ? C.white : C.bp; ctx.lineWidth = ok ? 1.5 : 2;
    if (!ok) ctx.setLineDash([8, 6]);
    rrect(cx, cyy, w, 66, 33); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = ok ? C.bg : C.bp; circle(cx + 34, cyy + 33, 21); ctx.fill();
    ctx.restore();
    if (ok) { ctx.strokeStyle = C.deep; drawGlyph('✓', cx + 34 - 12, cyy + 33 + 11, 34, 700); }
    else text('i', cx + 34, cyy + 44, { size: 30, weight: 900, color: C.deep, align: 'center' });
    text(s, cx + 66, cyy + 43, { size: 27, weight: 700, color: C.white, alpha: clamp(p * 2) });
  });
  grain(0.035);
}

/* ====================================================== SCENE 7: WHY */
function slideIn(u, st) { const p = E.outQuint(P(u, st, st + 0.7)); return p <= 0 ? null : (1 - p) * 700; }
function sceneWhy(u) {
  const t = T.why + u;
  bgWhite(t, 7, { x: 230, y: 1620, size: 1050 });
  hud(5, true);
  text('WHY IT MATTERS', 80, 322, { size: 26, weight: 900, ls: 7, color: C.deep, rt: u - 0.05 });
  text('More than a *number*', 80, 410, { size: 80, weight: 800, color: C.deep, hl: C.bp, hlItalic: true, rt: u - 0.15, gap: 0.08 });
  let dx = slideIn(u, 0.3);
  if (dx !== null) { // CopyFrame
    ctx.save(); ctx.translate(dx, 0);
    copyFrame(80, 465, 920, 285, 230);
    iconStopwatch(160, 548, 34, C.deep, u);
    text('Performance', 222, 568, { size: 48, weight: 800, color: C.deep });
    text('A key determinant of endurance performance, alongside lactate threshold and running economy.', 124, 648,
      { size: 33, weight: 600, color: C.deep, maxW: 700, lh: 1.25, rt: u - 0.7, gap: 0.035 });
    ctx.restore();
  }
  dx = slideIn(u, 1.3);
  if (dx !== null) { // KeyStatistic, tile variant
    ctx.save(); ctx.translate(dx, 0);
    ctx.fillStyle = C.deep; rrect(80, 780, 920, 330, 12); ctx.fill();
    text('HEALTH', 124, 842, { size: 24, weight: 900, ls: 7, color: C.white });
    const n = Math.round(13 * E.outCubic(P(u, 1.7, 2.6)));
    text(`${n}%`, 118, 1000, { size: 150, weight: 900, color: C.bg });
    text('lower risk of death from any cause for each 1-MET higher fitness level', 470, 900,
      { size: 32, weight: 700, color: C.white, maxW: 440, lh: 1.22, rt: u - 1.9, gap: 0.04 });
    text('1 MET = 3.5 mL·kg^{−1}·min^{−1}  ·  Kodama et al., JAMA 2009', 124, 1076, { size: 23, weight: 600, color: C.bp, rt: u - 2.6, gap: 0.03 });
    ctx.restore();
  }
  dx = slideIn(u, 2.5);
  if (dx !== null) {
    ctx.save(); ctx.translate(dx, 0);
    ctx.fillStyle = C.bg; rrect(80, 1140, 920, 300, 12); ctx.fill();
    keyTile(160, 1222, 72, C.deep); iconArrowUp(160, 1222, 36, C.bg);
    text('Trainable', 222, 1240, { size: 48, weight: 800, color: C.deep });
    text('Endurance training raises V̇O_{2}max, but how much varies a lot between people (genetics play a part).', 124, 1320,
      { size: 33, weight: 600, color: C.deep, maxW: 800, lh: 1.25, rt: u - 2.9, gap: 0.035 });
    ctx.restore();
  }
  grain(0.03);
}

/* ==================================================== SCENE 8: OUTRO */
// PhotoFrame: photograph clipped to the quatrefoil with an offset Bright Green shadow (3.4% down-left)
function photoFrame(im, cx, cy, size, sp, zoom) {
  const off = size * 0.034 * sp;
  motif(0, cx - off, cy + off, size, C.bg);
  ctx.save(); ctx.translate(cx - size / 2, cy - size / 2); ctx.scale(size / MQ, size / MQ); ctx.clip(MOTIF[0]);
  ctx.scale(MQ / size, MQ / size); ctx.translate(-(cx - size / 2), -(cy - size / 2));
  photo(im, cx - size / 2, cy - size / 2, size, size, 0.5, 0.5, zoom);
  ctx.restore();
}
function sceneOutro(u) {
  const t = T.outro + u;
  bgDeep(t, 2, { x: 540, y: 760, size: 1700, drift: 0.6 });
  text('SPORT & EXERCISE SCIENCE', 540, 300, { size: 26, weight: 900, ls: 7, color: C.bp, align: 'center', rt: u - 0.2, gap: 0.08 });
  const fp = E.outBack(P(u, 0.1, 0.8));
  if (fp > 0) {
    ctx.save(); ctx.translate(540, 620); ctx.scale(fp, fp); ctx.translate(-540, -620);
    photoFrame(IMG.mask, 540, 620, 470, E.outCubic(P(u, 0.5, 1.1)), 1.04 + u * 0.012);
    ctx.restore();
  }
  text('V̇O_{2}max', 540, 1000, { size: 116, weight: 800, color: C.bg, align: 'center', rt: u - 0.6, gap: 0.1 });
  text('your aerobic *ceiling*', 540, 1076, { size: 54, weight: 600, color: C.white, hl: C.white, hlItalic: true, hlWeight: 800, align: 'center', rt: u - 0.9, gap: 0.09 });
  const lp = E.inOutCubic(P(u, 1.2, 2.3));
  const x0 = 170, x1 = 910, y = 1150;
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  if (lp > 0) line(x0, y, lerp(x0, x1, lp), y);
  ctx.fillStyle = C.bg;
  if (u > 1.1) { circle(x0, y, 10 * E.outBack(P(u, 1.1, 1.4))); ctx.fill(); }
  if (lp > 0.98) { circle(x1, y, 10 * E.outBack(P(u, 2.25, 2.55))); ctx.fill(); }
  if (lp > 0 && lp < 1) triangle(lerp(x0, x1, lp), y, 22, C.bg);
  ctx.restore();
  text('1923 · Hill & Lupton', x0 - 10, y + 44, { size: 24, weight: 700, color: C.white, rt: u - 1.2 });
  text('Today · labs worldwide', x1 + 10, y + 44, { size: 24, weight: 700, color: C.white, align: 'right', rt: u - 2.3 });
  // University logo (white on Deep Purple), clear space kept around it
  const lg = E.outCubic(P(u, 2.4, 3.0));
  if (lg > 0 && IMG.logo) {
    const lw = 430, lh = lw * IMG.logo.height / IMG.logo.width;
    ctx.save(); ctx.globalAlpha = lg; ctx.drawImage(IMG.logo, 540 - lw / 2, 1300 + (1 - lg) * 20, lw, lh); ctx.restore();
  }
  motifStrip(540, 1560, 44, C.bg, P(u, 2.7, 3.7));
  grain(0.03);
  if (u > 4.5) { ctx.fillStyle = `rgba(0,0,0,${E.inOutSine(P(u, 4.5, 5))})`; ctx.fillRect(0, 0, W, H); }
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
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  if (t < T.graph) sceneOpen(t - T.open);
  else if (t < T.name) sceneGraph(t - T.graph);
  else if (t < T.path) sceneName(t - T.name);
  else if (t < T.units - 0.35) scenePath(t - T.path);
  else if (t < T.units + 0.35) { scenePath(t - T.path); circleWipe(t, T.units, 0.7, 540, 900, () => sceneUnits(t - T.units), C.bg); }
  else if (t < T.test) sceneUnits(t - T.units);
  else if (t < T.why) sceneTest(t - T.test);
  else if (t < T.outro - 0.35) sceneWhy(t - T.why);
  else if (t < T.outro + 0.35) { sceneWhy(t - T.why); circleWipe(t, T.outro, 0.7, 540, 620, () => sceneOutro(t - T.outro), C.bp); }
  else sceneOutro(t - T.outro);
  swipeBands(t, T.path, [C.bp, C.bg]);
  swipeBands(t, T.test, [C.bg, C.bp]);
  swipeBands(t, T.why, [C.bp, C.bg]);
  ctx.restore();
}
window.renderFrame = t => { render(clamp(t, 0, REEL.DURATION - 1e-6)); };
