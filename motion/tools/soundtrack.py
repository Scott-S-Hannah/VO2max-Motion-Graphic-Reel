#!/usr/bin/env python3
"""Soundtrack for the 30 s VO2max reel (motion/index.html). Written first; the picture is cut to it.

120 bpm (a beat every 0.5 s), A minor lifting to C major at the payoff. Every cue below is a time in
the picture's timeline. Fully synthesised, no samples, so it is free to use.

    python3 motion/tools/soundtrack.py   -> motion/out/track.wav and motion/assets/track.mp3
"""
import math
import os
import subprocess
import wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(30)
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# ---- cue sheet (seconds), shared with the picture
CUE = dict(
    launch=0.33, impact=0.95, slam=2.0, textOut=3.45,
    fall=4.0, land=4.45, curve=4.95, slide=7.9, cant=8.4, name_in=9.3,
    drop=10.0, dot=10.85, decode=(11.4, 12.3, 13.2), allOn=14.1,
    zoom=14.75, green=15.3, heart0=16.0, pump=20.85, test=21.0,
    breaths=(22.3, 24.7), barSlam=25.0, payoff=26.0, lift=27.0, logo=28.0, end=30.0,
)


def buf():
    return np.zeros((N, 2))


def tt(d):
    return np.arange(int(d * SR)) / SR


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), x, axis=0)


def add(bus, sig, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N or len(sig) == 0:
        return
    if sig.ndim == 1:
        l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
        sig = np.stack([sig * l, sig * r], axis=1) * math.sqrt(2)
    if i < 0:
        sig, i = sig[-i:], 0
    j = min(N, i + len(sig))
    bus[i:j] += sig[: j - i] * gain


def env(n, a=0.005, r=None, d=None):
    e = np.ones(n)
    na = max(1, int(a * SR))
    e[:na] = np.linspace(0, 1, na)
    if d is not None:
        e *= np.exp(-np.arange(n) / SR / d)
    if r is not None:
        nr = min(n, int(r * SR))
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


# ---------------------------------------------------------------- instruments
def kick(g=1.0):
    t = tt(0.45)
    f = 45 + 120 * np.exp(-t * 30)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    s[:100] += rng.normal(0, .4, 100) * np.linspace(1, 0, 100)
    s += filt(rng.normal(0, 1, len(t)), 'band', [1800, 5000]) * np.exp(-t * 90) * .25
    return s * g


def heartbeat():
    t = tt(0.3)
    s = np.sin(2 * np.pi * np.cumsum(38 + 50 * np.exp(-t * 20)) / SR) * np.exp(-t * 14)
    s += filt(rng.normal(0, 1, len(t)), 'band', [150, 900]) * np.exp(-t * 60) * .35
    return filt(s, 'low', 900)


def clap():
    n = int(0.3 * SR)
    s = rng.normal(0, 1, n)
    e = np.zeros(n)
    for k, off in enumerate([0, .011, .022, .034]):
        i = int(off * SR)
        e[i:] += np.exp(-np.arange(n - i) / SR / (.012 if k < 3 else .11))
    return filt(s * e, 'band', [900, 4000]) * .8


def hat(open_=False):
    n = int((.2 if open_ else .05) * SR)
    return filt(rng.normal(0, 1, n), 'high', 7000) * np.exp(-np.arange(n) / SR / (.06 if open_ else .012))


def saw(f, d, det=0.0):
    t = tt(d)
    return 2 * ((t * f * (1 + det)) % 1) - 1


def pad_note(m, d, cut=1200):
    s = sum(saw(hz(m), d, dt) for dt in (-.004, 0, .0045)) / 3
    return filt(s, 'low', cut) * env(len(s), a=.3, r=.5)


def pluck(m, d=.45, bright=1.0, dec=.16):
    t = tt(d)
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + .35 * bright * np.sin(4 * np.pi * f * t) + .12 * bright * np.sin(6 * np.pi * f * t)
    return s * np.exp(-t / dec) * env(len(t), a=.002)


def bass(m, d):
    t = tt(d)
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + .3 * np.sin(4 * np.pi * f * t) + .3 * filt(saw(f, d), 'low', 500)
    return s * env(len(t), a=.008, r=.04) * (.6 + .4 * np.exp(-t / .18))


def chime(m, d=2.0):
    t = tt(d)
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + .4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 4) + .2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 8)
    return s * np.exp(-t * 2) * env(len(t), a=.003)


def blip(m, d=.12):
    t = tt(d)
    return np.sin(2 * np.pi * hz(m) * t) * np.exp(-t / .04) * env(len(t), a=.002)


def sweep(d, lo, hi, up=True, q=1.4):
    n = int(d * SR)
    src = rng.normal(0, 1, n + 4096)
    out = np.zeros(n)
    seg = 512
    for i in range(0, n, seg):
        p = i / n
        fc = lo * (hi / lo) ** (p if up else 1 - p)
        chunk = filt(src[i:i + seg + 2048], 'band', [fc / q, min(fc * q, SR / 2 - 200)], 1)
        out[i:i + seg] = chunk[2048:2048 + len(out[i:i + seg])] if len(chunk) > 2048 else 0
    return out


def riser(d):
    s = sweep(d, 200, 9000) * np.linspace(0, 1, int(d * SR)) ** 2
    t = tt(d)
    s += np.sin(2 * np.pi * np.cumsum(180 * 2 ** (t / d * 2)) / SR) * (t / d) ** 2 * .3
    return s


def whoosh(d=.6, up=True):
    s = sweep(d, 300, 6000, up)
    return s * np.sin(np.pi * np.linspace(0, 1, len(s))) ** 2


def impact(g=1.0, d=2.0):
    t = tt(d)
    s = np.sin(2 * np.pi * np.cumsum(32 + 110 * np.exp(-t * 7)) / SR) * np.exp(-t * 1.8)
    s += filt(rng.normal(0, 1, len(t)), 'low', 3000) * np.exp(-t * 6) * .5
    return s * g


def crash(d=1.6):
    t = tt(d)
    return filt(rng.normal(0, 1, len(t)), 'high', 4000) * np.exp(-t * 2.4) * env(len(t), a=.002)


def thud(g=1.0):
    t = tt(.35)
    return np.sin(2 * np.pi * (60 + 90 * np.exp(-t * 25)) * t) * np.exp(-t * 10) * g


def scrape(d):
    s = filt(rng.normal(0, 1, int(d * SR)), 'band', [2500, 8000])
    m = .5 + .5 * np.sin(2 * np.pi * 23 * tt(d))
    return s * m * np.sin(np.pi * np.linspace(0, 1, len(s)))


# ---------------------------------------------------------------- arrangement
dry, verb, music, drums = buf(), buf(), buf(), buf()
duck = np.ones(N)


def sidechain(t0, depth=.55):
    i = int(t0 * SR)
    n = int(.28 * SR)
    j = min(N, i + n)
    if i < N:
        duck[i:j] = np.minimum(duck[i:j], 1 - depth * np.exp(-np.arange(j - i) / SR / .09))


CH = {'Am': [57, 60, 64], 'F': [53, 57, 60], 'C': [55, 60, 64], 'G': [55, 59, 62], 'Fmaj7': [53, 57, 64], 'Cadd9': [55, 60, 62, 64]}
ROOT_N = {'Am': 45, 'F': 41, 'C': 48, 'G': 43, 'Fmaj7': 41, 'Cadd9': 48}
PROG = ['Am', 'F', 'C', 'G'] * 3 + ['Am', 'Fmaj7', 'Cadd9']   # 15 two-second bars
for b, name in enumerate(PROG):
    t0 = b * 2.0
    c, r = CH[name], ROOT_N[name]
    if t0 < 1.0:
        continue
    silent = 8.0 <= t0 < 10.0                    # the drop-out before the name
    last = t0 >= 26.0
    d = 2.2 if not last else 4.0
    cut = 900 if t0 < 10 else (1600 if t0 < 15 or t0 >= 21 else 1100)
    if not silent:
        for m in c:
            add(music, pad_note(m, d, cut), t0, .13 if not last else .17)
    # bass
    if silent:
        pass
    elif 15.3 <= t0 < 21.0:
        add(music, bass(r - 12, .9), t0, .14); add(music, bass(r - 12, .9), t0 + 1.0, .12)
    elif not last:
        for k in range(8):
            add(music, bass(r - 12 + (12 if k % 2 else 0), .23), t0 + k * .25, .13)
    # arpeggio (16ths building through the curve, 8ths elsewhere)
    if 4.0 <= t0 < 8.0 or 10.0 <= t0 < 15.0 or 21.0 <= t0 < 26.0:
        seq = [c[0] + 12, c[1] + 12, c[2] + 12, c[1] + 24, c[2] + 12, c[1] + 12, c[0] + 24, c[2] + 12]
        step = .125 if 6.0 <= t0 < 8.0 else .25
        for k in range(int(2.0 / step)):
            m = seq[k % len(seq)]
            add(music, pluck(m, bright=1.2 if t0 >= 10 else .8), t0 + k * step, .1 if step == .25 else .07, pan=.35 if k % 2 else -.35)

# drums
t = 1.0
while t < 26.0 - 1e-6:
    beat = round(t / .5)
    heart = 15.3 <= t < 21.0
    silent = 8.0 <= t < 10.0
    if silent:
        pass
    elif heart:
        if t >= CUE['heart0'] - 1e-6:
            add(drums, heartbeat(), t, .55); add(drums, heartbeat(), t + .18, .32); sidechain(t, .35)
    else:
        add(drums, kick(.55), t); sidechain(t)
        if beat % 2 == 1 and (t >= 10.0):
            add(drums, clap(), t, .38)
    if not silent and t >= 1.0:
        add(drums, hat(), t + .25, .16, pan=.25)
        if t >= 10.0 and not heart:
            add(drums, hat(), t, .07, pan=-.2)
    t += .5
# snare roll into the plateau
for k in range(16):
    add(drums, clap(), 7.0 + k * .0625 * (1 - k / 40), .05 + .012 * k)
music *= duck[:, None]
dry += music + drums * .9
verb += music * .45

# ---------------------------------------------------------------- picture cues
add(dry, riser(.95), 0.0, .28)
add(dry, whoosh(.55, True), CUE['launch'], .25)
for bus, g in ((dry, .5), (verb, .25)):
    add(bus, impact(), CUE['impact'], g)
add(dry, crash(), CUE['impact'], .2)
add(dry, kick(.9), CUE['impact'])
add(dry, thud(.6), CUE['slam']); add(dry, clap(), CUE['slam'], .35); add(verb, clap(), CUE['slam'], .25)
add(dry, whoosh(.45, True), CUE['textOut'], .18)
# dot falls, lands, runs the curve, scrapes under the ceiling
tf = tt(.45)
add(dry, np.sin(2 * np.pi * np.cumsum(900 * 2 ** (-tf / .45 * 2)) / SR) * np.exp(-tf * 3) * .5, CUE['fall'], .25)
add(dry, thud(.7), CUE['land'])
tc = tt(3.0)
glide = np.sin(2 * np.pi * np.cumsum(220 * 2 ** ((tc / 3.0) ** 2 * 2)) / SR) * np.sin(np.pi * np.clip(tc / 3.0, 0, 1)) ** .5
add(dry, filt(glide, 'low', 2500), CUE['curve'], .05)
add(dry, scrape(.9), CUE['slide'], .1)
add(dry, impact(.7, 2.0), CUE['cant'], .22); add(verb, impact(.7, 2.0), CUE['cant'], .22)
add(dry, filt(sum(np.sin(2 * np.pi * hz(m) * tt(1.6)) for m in (33, 45)) * env(int(1.6 * SR), a=.3, r=.6), 'low', 300), 8.4, .08)
add(dry, blip(88, .15), CUE['name_in'], .1)
add(dry, riser(.9), 9.1, .22)
# the name
for bus, g in ((dry, .55), (verb, .3)):
    add(bus, impact(1, 2.4), CUE['drop'], g)
add(dry, crash(2.0), CUE['drop'], .25)
for i, m in enumerate([69, 72, 76, 81]):
    add(dry, pluck(m + 12, .5), 10.3 + i * .07 + .45, .14)
add(dry, chime(93), CUE['dot'], .1); add(verb, chime(93), CUE['dot'], .12)
for i, tt0 in enumerate(CUE['decode']):
    add(dry, blip(81 + i * 3, .16), tt0, .16)
add(dry, pluck(76, .8, dec=.3), CUE['allOn'], .12)
# into the heart
add(dry, riser(.55), CUE['zoom'], .3)
add(dry, impact(.6, 1.4), CUE['green'], .45)
for k in range(10):
    b = CUE['heart0'] + k * .5
    add(dry, blip(93 + (k % 2) * 2, .06), b + .05, .035, pan=(-.5 if k % 2 else .5))
add(dry, impact(.9, 1.6), CUE['pump'], .35)
add(dry, whoosh(.5, True), CUE['test'] - .05, .3)
# breath by breath
b0, b1 = CUE['breaths']
for k in range(40):
    add(dry, blip(86 + (k % 3), .05), b0 + (b1 - b0) * k / 40, .03, pan=(k % 5 - 2) / 3)
add(dry, impact(.9, 1.8), CUE['barSlam'], .5); add(dry, crash(1.4), CUE['barSlam'], .18)
add(dry, whoosh(.5, False), CUE['payoff'], .2)
add(dry, pluck(76, .6, dec=.25), 26.3, .12)
add(dry, riser(.45), CUE['lift'] - .45, .22)
for bus, g in ((dry, .5), (verb, .35)):
    add(bus, impact(.7, 2.0), CUE['lift'], g)
for m in (72, 76, 79, 84):
    add(verb, chime(m, 2.5), CUE['logo'], .07); add(dry, chime(m, 2.5), CUE['logo'], .05)

# ---------------------------------------------------------------- master
irl = int(1.8 * SR)
ir = np.stack([rng.normal(0, 1, irl), rng.normal(0, 1, irl)], 1) * np.exp(-np.arange(irl) / SR / .45)[:, None]
ir = filt(ir, 'low', 5000)
ir /= np.sqrt((ir ** 2).sum(0))
wet = np.stack([fftconvolve(verb[:, c], ir[:, c])[:N] for c in range(2)], 1)
mix = filt(dry + wet * .5, 'high', 30)
tl = np.arange(N) / SR
mix *= np.clip((DUR - tl) / .7, 0, 1)[:, None]
mix = np.tanh(mix * 1.5) / np.tanh(1.5)
mix *= .89 / np.max(np.abs(mix))

os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
wav = os.path.join(ROOT, 'out', 'track.wav')
with wave.open(wav, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
ff = os.environ.get('FFMPEG', 'ffmpeg')
subprocess.run([ff, '-v', 'error', '-y', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '192k', os.path.join(ROOT, 'assets', 'track.mp3')], check=True)
# quick balance report
for a, b in [(0, 4), (4, 8), (8, 10), (10, 15), (15, 21), (21, 26), (26, 30)]:
    s = mix[int(a * SR):int(b * SR)].mean(1)
    F = np.abs(np.fft.rfft(s)) ** 2; f = np.fft.rfftfreq(len(s), 1 / SR)
    print(f'{a:>4}-{b:<4} rms {10*np.log10((s**2).mean()+1e-12):6.1f} dB   <120Hz {100*F[f<120].sum()/F.sum():4.1f}%')
print('wrote', wav, 'and assets/track.mp3')
