#!/usr/bin/env node
/*
 * Local harness for motion/index.html.
 *   node motion/tools/preview.cjs stills 1.2 15 30          -> motion/out/stills/*.png  (1080×1920 frames)
 *   node motion/tools/preview.cjs strip 11.0 12.4 8          -> filmstrip of 8 frames between two times
 *   node motion/tools/preview.cjs workspace                  -> screenshot of the full editing page
 *   node motion/tools/preview.cjs video [K] [shutter] [a] [b] -> motion/out/vo2max_reel.mp4: every frame averaged from
 *        K sub-frames over a 180° shutter (true motion blur), muxed with out/track.wav (needs FFMPEG or ffmpeg on PATH)
 * Serves the page wrapped in the same skeleton the Artifact viewer adds, and routes the cdnjs GSAP
 * script to a local copy (GSAP_DIR) when the sandbox cannot reach cdnjs.
 */
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'out');
const GSAP_DIR = process.env.GSAP_DIR;
const MIME = { '.woff2': 'font/woff2', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.html': 'text/html' };
const SKELETON = b => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${b}</body></html>`;
function serve() {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    if (u === '/' || u === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(SKELETON(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'))); }
    const f = u.startsWith('/_fonts/') ? path.join(ROOT, '..', 'reel', 'fonts', path.basename(u)) : path.join(ROOT, u);
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r(`http://127.0.0.1:${srv.address().port}`); }));
}
async function open(base, hash, viewport) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('[console]', m.text()); });
  if (GSAP_DIR) await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/gsap\/[^/]+\/(.+)$/, (route, req) => {
    const file = req.url().split('/').pop(); route.fulfill({ path: path.join(GSAP_DIR, file), contentType: 'text/javascript' });
  });
  // Sandbox Chromium cannot verify Google Fonts through the proxy: serve the same Figtree faces locally.
  await page.route(/fonts\.googleapis\.com\/css2/, route => route.fulfill({ contentType: 'text/css', body:
    `@font-face{font-family:'Figtree';font-style:normal;font-weight:300 900;src:url(${base}/_fonts/Figtree-latin.woff2) format('woff2')}` +
    `@font-face{font-family:'Figtree';font-style:italic;font-weight:300 900;src:url(${base}/_fonts/Figtree-Italic-latin.woff2) format('woff2')}` }));
  await page.goto(base + '/index.html' + hash);
  await page.waitForFunction(() => window.reel);
  await page.evaluate(() => window.reel.ready);
  return { browser, page };
}
async function video(base, K = 8, shutter = .5, a = 0, b = 30) {
  const { spawn } = require('child_process');
  const FF = process.env.FFMPEG || 'ffmpeg', FPS = 30;
  const { browser, page } = await open(base, '#render', { width: 1080, height: 1920 });
  const silent = path.join(OUT, 'video_silent.mp4');
  const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
  const f0 = Math.round(a * FPS), f1 = Math.round(b * FPS), t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const url = await page.evaluate(([t, K, s]) => { window.reel.renderBlur(t, K, s); return document.getElementById('gl').toDataURL('image/jpeg', .96); }, [f / FPS, K, shutter]);
    if (!ff.stdin.write(Buffer.from(url.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - f0) % 30 === 29) console.log(`frame ${f + 1}/${f1}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await browser.close();
  const wav = path.join(OUT, 'track.wav'), final = path.join(OUT, 'vo2max_reel.mp4');
  await new Promise((res, rej) => spawn(FF, ['-y', '-loglevel', 'error', '-i', silent, '-ss', String(a), '-t', String(b - a), '-i', wav, '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', '-shortest', final], { stdio: 'inherit' }).on('close', c => (c ? rej(new Error('mux failed')) : res())));
  console.log('wrote', final, `in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
(async () => {
  const [mode, ...args] = process.argv.slice(2);
  const base = await serve();
  fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
  if (mode === 'workspace') {
    const { browser, page } = await open(base, '', { width: 1440, height: 1000 });
    await page.screenshot({ path: path.join(OUT, 'workspace.png') }); console.log('out/workspace.png');
    await page.setViewportSize({ width: 400, height: 860 }); await page.screenshot({ path: path.join(OUT, 'workspace-phone.png'), fullPage: true }); console.log('out/workspace-phone.png');
    return browser.close();
  }
  if (mode === 'video') return video(base, ...args.map(Number));
  const { browser, page } = await open(base, '#render', { width: 1080, height: 1920 });
  const stage = page.locator('#stage');
  const shot = async (t, file) => { await page.evaluate(t => window.reel.seek(t), t); await stage.screenshot({ path: file }); };
  let times = args.map(Number);
  if (mode === 'strip') { const [a, b, n] = times; times = [...Array(n).keys()].map(i => +(a + (b - a) * i / (n - 1)).toFixed(3)); }
  for (const t of times) { const f = path.join(OUT, 'stills', `t_${t.toFixed(2).padStart(5, '0')}.png`); await shot(t, f); console.log(f); }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
