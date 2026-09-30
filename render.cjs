#!/usr/bin/env node
/*
 * Renders reel/index.html frame-by-frame with Playwright's Chromium and encodes with ffmpeg.
 *
 *   node render.cjs stills 1.5 4 9.2        -> out/stills/t_1.50.png ...
 *   node render.cjs video [workers]          -> out/vo2max_reel.mp4 (with soundtrack if out/soundtrack.wav exists)
 *
 * Needs: playwright (global install ok: NODE_PATH=$(npm root -g)), ffmpeg on PATH or FFMPEG env var.
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'out');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const URL = 'file://' + path.join(ROOT, 'reel', 'index.html');
const W = 1080, H = 1920;

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(URL);
  await page.evaluate(() => window.reelReady);
  return page;
}
async function grab(page, t, type = 'jpeg') {
  const data = await page.evaluate(([t, type]) => {
    window.renderFrame(t);
    return document.getElementById('c').toDataURL(type === 'png' ? 'image/png' : 'image/jpeg', 0.95);
  }, [t, type]);
  return Buffer.from(data.split(',')[1], 'base64');
}
function run(cmd, args, opts = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: opts.stdin ? ['pipe', 'inherit', 'inherit'] : 'inherit' });
    p.on('error', rej);
    p.on('close', c => (c === 0 ? res() : rej(new Error(`${cmd} exited ${c}`))));
    if (opts.stdin) opts.stdin(p);
  });
}

async function stills(times) {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const page = await openPage(browser);
  const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
  for (const t of times) {
    const f = path.join(dir, `t_${Number(t).toFixed(2).padStart(5, '0')}.png`);
    fs.writeFileSync(f, await grab(page, Number(t), 'png'));
    console.log(f);
  }
  await browser.close();
}

async function video(workers = 4) {
  const browser = await chromium.launch();
  const probe = await openPage(browser);
  const { DURATION, FPS } = await probe.evaluate(() => window.REEL);
  await probe.close();
  const N = Math.round(DURATION * FPS);
  const segDir = path.join(OUT, 'segments'); fs.mkdirSync(segDir, { recursive: true });
  const per = Math.ceil(N / workers);
  const t0 = Date.now();
  let done = 0;
  const jobs = [...Array(workers).keys()].map(async w => {
    const a = w * per, b = Math.min(N, a + per);
    const page = await openPage(browser);
    const seg = path.join(segDir, `seg_${w}.mp4`);
    await run(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', seg], {
      stdin: async p => {
        for (let f = a; f < b; f++) {
          const buf = await grab(page, f / FPS);
          if (!p.stdin.write(buf)) await new Promise(r => p.stdin.once('drain', r));
          if (++done % 60 === 0) console.log(`frames ${done}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
        }
        p.stdin.end();
      },
    });
    await page.close();
    return seg;
  });
  const segs = await Promise.all(jobs);
  await browser.close();
  const list = path.join(segDir, 'list.txt');
  fs.writeFileSync(list, segs.map(s => `file '${s}'`).join('\n'));
  const silent = path.join(OUT, 'video_silent.mp4');
  await run(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);
  const wav = path.join(OUT, 'soundtrack.wav');
  const final = path.join(OUT, 'vo2max_reel.mp4');
  if (fs.existsSync(wav)) {
    await run(FFMPEG, ['-y', '-loglevel', 'error', '-i', silent, '-i', wav, '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', '-shortest', final]);
  } else fs.copyFileSync(silent, final);
  console.log('wrote', final, `in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

const [mode, ...rest] = process.argv.slice(2);
(mode === 'stills' ? stills(rest) : video(Number(rest[0]) || 4)).catch(e => { console.error(e); process.exit(1); });
