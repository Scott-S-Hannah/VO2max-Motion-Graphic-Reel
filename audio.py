#!/usr/bin/env python3
"""Synthesises the reel soundtrack (out/soundtrack.wav) so every hit lines up with reel/reel.js.

Act 1 (0-14.5 s): 1920s newsreel: projector whirr, crackle, wobbly gramophone piano, typewriter, footsteps.
Act 2 (14.5-58 s): modern 120 bpm groove (Am-F-C-G), every scene cut lands on a beat.
Everything is generated from code: no samples or third-party audio, so it is copyright-free.
"""
import math
import os
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
DUR = 58.0
N = int(SR * DUR)
rng = np.random.default_rng(1923)

# Scene start times (keep in sync with T in reel/reel.js)
T = dict(open=0, graph=8, name=14.5, path=21, units=31, test=38.5, why=47, outro=54, end=58)
BEAT = 0.5  # 120 bpm


def buf():
    return np.zeros((N, 2))


dry, verb = buf(), buf()


def tt(d):
    return np.arange(int(d * SR)) / SR


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def filt(x, kind, f, order=2):
    sos = butter(order, f, btype=kind, fs=SR, output='sos')
    return sosfilt(sos, x, axis=0)


def add(bus, sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N or len(sig) == 0:
        return
    if sig.ndim == 1:
        l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
        sig = np.stack([sig * l, sig * r], axis=1) * math.sqrt(2)
    j = min(N, i + len(sig))
    if i < 0:
        sig, i = sig[-i:], 0
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


# ------------------------------------------------------------------ instruments
def kick(g=1.0):
    t = tt(0.45)
    f = 45 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 7.5)
    s[:120] += rng.normal(0, 0.35, 120) * np.linspace(1, 0, 120)
    return s * g


def heartbeat():
    t = tt(0.3)
    f = 38 + 45 * np.exp(-t * 20)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14)
    s += filt(rng.normal(0, 1, len(t)), 'band', [150, 900]) * np.exp(-t * 60) * 0.35
    return filt(s, 'low', 900)


def clap():
    n = int(0.25 * SR)
    s = rng.normal(0, 1, n)
    e = np.zeros(n)
    for k, off in enumerate([0, 0.011, 0.022, 0.034]):
        i = int(off * SR)
        e[i:] += np.exp(-np.arange(n - i) / SR / (0.012 if k < 3 else 0.09))
    return filt(s * e, 'band', [900, 3500]) * 0.8


def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    s = filt(rng.normal(0, 1, n), 'high', 7000)
    return s * np.exp(-np.arange(n) / SR / (0.05 if open_ else 0.012))


def saw(f, d, det=0.0):
    t = tt(d)
    return 2 * ((t * f * (1 + det)) % 1) - 1


def pad_note(m, d):
    s = sum(saw(hz(m), d, dt) for dt in (-0.004, 0.0, 0.0045)) / 3
    s = filt(s, 'low', 1100, 2)
    return s * env(len(s), a=0.35, r=0.6)


def pluck(m, d=0.45, bright=1.0):
    t = tt(d)
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * bright * np.sin(4 * np.pi * f * t) + 0.12 * bright * np.sin(6 * np.pi * f * t)
    return s * np.exp(-t / 0.16) * env(len(t), a=0.002)


def bass_note(m, d):
    t = tt(d)
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t) + 0.3 * filt(saw(f, d), 'low', 400)
    return s * env(len(t), a=0.01, r=0.05) * (0.6 + 0.4 * np.exp(-t / 0.2))


def piano(m, d=1.6):
    t = tt(d)
    f = hz(m) * (1 + 0.004 * np.sin(2 * np.pi * 0.9 * t))  # gramophone wow
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = sum(a * np.sin(k * ph) * np.exp(-t * (1.6 + k * 0.9)) for k, a in enumerate([1, 0.5, 0.28, 0.14, 0.07], 1))
    s[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    return s


def chime(m, d=1.8):
    t = tt(d)
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 4) + 0.2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 8)
    return s * np.exp(-t * 2.2) * env(len(t), a=0.003)


def blip(m, d=0.12):
    t = tt(d)
    return np.sin(2 * np.pi * hz(m) * t) * np.exp(-t / 0.04) * env(len(t), a=0.002)


def whoosh(d=0.8, up=True, lo=300, hi=5000):
    n = int(d * SR)
    s = rng.normal(0, 1, n)
    out = np.zeros(n)
    seg = 512
    for i in range(0, n, seg):
        p = i / n
        fc = lo * (hi / lo) ** (p if up else 1 - p)
        out[i:i + seg] = filt(s[max(0, i - 2048):i + seg], 'band', [fc * 0.7, min(fc * 1.4, SR / 2 - 100)], 1)[-len(out[i:i + seg]):]
    e = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    return out * e


def tick(g=1.0):
    n = int(0.03 * SR)
    s = filt(rng.normal(0, 1, n), 'band', [2000, 6000]) * np.exp(-np.arange(n) / SR / 0.004)
    t = tt(0.03)
    return (s + 0.3 * np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.01)) * g


def typekey():
    n = int(0.05 * SR)
    s = filt(rng.normal(0, 1, n), 'band', [1500, 5500]) * np.exp(-np.arange(n) / SR / 0.006)
    t = tt(0.05)
    return s + 0.5 * np.sin(2 * np.pi * (140 + rng.uniform(-20, 20)) * t) * np.exp(-t / 0.012)


def footstep():
    n = int(0.12 * SR)
    s = filt(rng.normal(0, 1, n), 'low', 900) * np.exp(-np.arange(n) / SR / 0.025)
    t = tt(0.12)
    return s + 0.8 * np.sin(2 * np.pi * 70 * t) * np.exp(-t / 0.03)


def thud():
    t = tt(0.6)
    s = np.sin(2 * np.pi * (50 + 60 * np.exp(-t * 20)) * t) * np.exp(-t * 6)
    s += filt(rng.normal(0, 1, len(t)), 'low', 600) * np.exp(-t * 25) * 0.6
    return s


def impact():
    t = tt(2.2)
    f = 32 + 90 * np.exp(-t * 6)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    s += filt(rng.normal(0, 1, len(t)), 'low', 2500) * np.exp(-t * 5) * 0.5
    return s


# --------------------------------------------------------------- ACT 1: archive
act1 = int(14.6 * SR)
# projector whirr: noise with 24 fps shutter flutter
t = np.arange(act1) / SR
proj = filt(rng.normal(0, 1, act1), 'band', [700, 3200]) * (0.55 + 0.45 * (np.sin(2 * np.pi * 24 * t) > 0.3))
proj += 0.4 * np.sin(2 * np.pi * 48 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 24 * t))
fade = np.clip(t / 0.8, 0, 1) * np.clip((14.5 - t) / 0.4, 0, 1)
add(dry, proj * fade * 0.028, 0)
# vinyl/film crackle
cr = np.zeros(act1)
idx = rng.integers(0, act1, 420)
cr[idx] = rng.normal(0, 1, 420) * rng.uniform(0.2, 1, 420)
cr = filt(cr, 'high', 1500)
add(dry, cr * fade * 0.35, 0)
# drone swelling to the burn
drone = sum(np.sin(2 * np.pi * hz(m) * t) * a for m, a in [(45, 0.5), (52, 0.3), (57, 0.15)])
drone *= np.clip(t / 3, 0, 1) * (0.5 + 0.5 * np.clip((t - 8) / 5, 0, 1)) * np.clip((14.5 - t) / 0.3, 0, 1)
add(dry, filt(drone, 'low', 600) * 0.05, 0)
# gramophone piano: Am F C G arpeggios aligned to the later 120 bpm bar grid (bars start at 0.5 s)
CH = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]]
ROOT = [45, 41, 48, 43]
pno = buf()
for b in range(6):
    t0 = 0.5 + b * 2
    c = CH[b % 4]
    add(pno, piano(ROOT[b % 4] - 12 + 24, 2.2), t0, 0.35)
    for k, m in enumerate([c[0] + 12, c[1] + 12, c[2] + 12, c[1] + 12]):
        add(pno, piano(m), t0 + k * 0.5, 0.22 if k else 0.3, pan=(-0.3 + 0.2 * k))
pno = filt(pno, 'band', [220, 3000])
dry += pno * 0.9
verb += pno * 0.35
# stamp, cuts, typewriter, footsteps, pen ticks, ceiling ding
add(dry, thud(), 2.53, 0.55)
for c in (3.8, 8.0):
    add(dry, tick(1.5), c - 0.02, 0.6)
    add(dry, thud(), c - 0.02, 0.25)
typing = [(0.95, 21, 24), (5.0, 105, 44), (9.3, 31, 26), (10.7, 34, 26)]
for st, nch, cps in typing:
    for k in range(nch):
        add(dry, typekey(), st + k / cps + rng.uniform(-0.008, 0.008), 0.16, pan=rng.uniform(-0.3, 0.3))
for k in range(40):  # foot strikes at |sin(ph)| = 0, ph = v*2*pi*1.55 + 0.4
    v = (k * math.pi - 0.4) / (2 * math.pi * 1.55)
    if 0 <= v <= 4.2:
        add(dry, footstep(), 3.8 + v, 0.35, pan=0.1)
for v in (0.9, 1.6):
    add(dry, tick(), 3.8 + v, 0.35)
for i in range(9):
    add(dry, tick(0.8), 8 + 1.0 + i * 0.29, 0.3, pan=-0.5 + i * 0.12)
add(verb, chime(81), 8 + 3.75, 0.12)
add(dry, chime(81), 8 + 3.75, 0.1)
# burn: riser + crackle into the impact
rs = whoosh(1.45, True, 200, 8000)
add(dry, rs, 13.05, 0.35)
rt = tt(1.45)
add(dry, np.sin(2 * np.pi * (220 * 2 ** (rt / 1.45 * 1.5)) * rt) * (rt / 1.45) ** 2 * 0.12, 13.05)
burn = np.zeros(int(1.45 * SR))
bi = rng.integers(0, len(burn), 700)
burn[bi] = rng.normal(0, 1, 700) * np.linspace(0.2, 1, len(burn))[bi]
add(dry, filt(burn, 'band', [800, 6000]), 13.05, 0.5)

# --------------------------------------------------------------- ACT 2: modern
add(dry, impact(), T['name'], 0.55)
add(verb, impact(), T['name'], 0.25)
drums, music = buf(), buf()
duck = np.ones(N)


def sidechain(t0):
    i = int(t0 * SR)
    n = int(0.28 * SR)
    j = min(N, i + n)
    duck[i:j] = np.minimum(duck[i:j], 1 - 0.55 * np.exp(-np.arange(j - i) / SR / 0.09))


end_music = T['end'] - 0.2
nbars = int((T['end'] - T['name']) / 2)
for b in range(nbars):
    t0 = T['name'] + b * 2
    c = CH[b % 4]
    last = t0 >= T['outro']
    d = 2.2 if not last else (T['end'] - t0)
    for m in c:
        add(music, pad_note(m, d), t0, 0.14 if t0 < T['path'] else 0.17)
    # bass
    if t0 >= T['path'] and not last:
        for k in range(8):
            add(music, bass_note(ROOT[b % 4] - 12 + (12 if k % 2 else 0), 0.24), t0 + k * 0.25, 0.14)
    elif not last:
        add(music, bass_note(ROOT[b % 4] - 12, 1.9), t0, 0.13)
    # plucked arpeggio
    if T['path'] <= t0 < T['outro']:
        seq = [c[0] + 12, c[1] + 12, c[2] + 12, c[1] + 24, c[2] + 12, c[1] + 12, c[0] + 24, c[2] + 12]
        for k, m in enumerate(seq):
            add(music, pluck(m), t0 + k * 0.25, 0.12, pan=0.35 if k % 2 else -0.35)
# drums
t = T['name']
while t < T['outro'] - 1e-6:
    bi = round((t - T['name']) / BEAT)
    in_path_intro = T['path'] <= t < T['path'] + 5.5
    if t < T['path']:
        if bi % 2 == 0:
            add(drums, kick(0.4), t)
            sidechain(t)
    elif in_path_intro:
        add(drums, heartbeat(), t, 0.5)
        add(drums, heartbeat(), t + 0.18, 0.3)
        sidechain(t)
    else:
        add(drums, kick(0.55), t)
        sidechain(t)
        if t >= T['units'] and bi % 2 == 1:
            add(drums, clap(), t, 0.45)
    if t >= T['name'] + 3.0:
        add(drums, hat(), t + 0.25, 0.2, pan=0.25)
        if t >= T['path']:
            add(drums, hat(), t, 0.1, pan=-0.2)
    t += BEAT
music *= duck[:, None]
dry += drums * 0.9 + music
verb += music * 0.5

# --------------------------------------------------------------- UI sound design
for i, m in enumerate([69, 72, 76, 81]):  # VO2max letters land
    add(dry, pluck(m + 12, 0.5), T['name'] + 0.45 + i * 0.12 + 0.3, 0.12)
add(verb, chime(93), T['name'] + 1.25, 0.1)
add(dry, chime(93), T['name'] + 1.25, 0.08)
for i in range(3):
    add(dry, blip(81 + i * 3), T['name'] + 2.3 + i * 0.3, 0.12)
add(dry, whoosh(0.5, True, 400, 3000), T['name'] + 3.85, 0.12)
for tb in (T['path'], T['test'], T['why']):
    add(dry, whoosh(0.8, True, 250, 6000), tb - 0.4, 0.4)
for tb in (T['units'], T['outro']):
    add(dry, whoosh(0.7, False, 300, 5000), tb - 0.35, 0.3)
    add(verb, chime(88), tb, 0.08)
for i in range(3):  # journey steps
    add(dry, blip(76 + i * 2), T['path'] + 0.6 + i * 1.3, 0.14)
for i in range(3):  # equation chips
    add(dry, blip(84 + i * 2, 0.15), T['path'] + 6.05 + i * 0.3, 0.14)
add(dry, whoosh(0.5, True, 300, 2500), T['path'] + 7.65, 0.12)
for i in range(3):  # unit pieces
    add(dry, blip(79 + i * 3, 0.15), T['units'] + 0.4 + i * 0.38, 0.15)
for i in range(4):  # bars grow: rising glide
    st = T['units'] + 2.4 + i * 0.55
    gt = tt(0.9)
    f = hz(60 + i * 3) * 2 ** (gt / 0.9 * (0.6 + i * 0.25))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * gt / 0.9) ** 2
    add(dry, s, st, 0.035)
    add(dry, blip(84 + i * 2), st + 0.9, 0.1)
for k in range(1, 10):  # treadmill stage beeps
    x = math.acos(1 - 2 * k / 10) / math.pi
    add(dry, blip(93, 0.08), T['test'] + 0.6 + 4.6 * x, 0.08, pan=0.4)
add(dry, chime(84), T['test'] + 5.0, 0.1)
for i in range(4):  # criteria ticks
    st = T['test'] + 5.5 + i * 0.45
    add(dry, blip(88 if i < 3 else 81), st, 0.12)
    add(dry, blip(95 if i < 3 else 84), st + 0.07, 0.1)
for i, st in enumerate((0.3, 1.3, 2.5)):  # why cards slide in
    add(dry, whoosh(0.45, True, 300, 3000), T['why'] + st - 0.05, 0.14, pan=0.5)
for k in range(13):
    add(dry, tick(0.6), T['why'] + 1.7 + 0.9 * (1 - (1 - (k + 1) / 13) ** (1 / 3)), 0.12)
# outro: resolve on Am add9 swell + chime
for m, a in [(45, 0.25), (57, 0.12), (64, 0.1), (71, 0.08), (76, 0.07)]:
    s = pad_note(m, 3.9)
    add(dry, s, T['outro'], a)
    add(verb, s, T['outro'], a * 0.6)
add(dry, chime(81), T['outro'] + 0.05, 0.12)
add(verb, chime(81), T['outro'] + 0.05, 0.2)
add(dry, chime(88), T['outro'] + 2.05, 0.08)
add(verb, chime(88), T['outro'] + 2.05, 0.15)

# --------------------------------------------------------------- reverb + master
irl = int(2.0 * SR)
ir_t = np.arange(irl) / SR
ir = np.stack([rng.normal(0, 1, irl), rng.normal(0, 1, irl)], axis=1) * np.exp(-ir_t / 0.45)[:, None]
ir = filt(ir, 'low', 5000)
ir /= np.sqrt((ir ** 2).sum(axis=0))
wet = np.stack([fftconvolve(verb[:, c], ir[:, c])[:N] for c in range(2)], axis=1)
mix = dry + wet * 0.5
mix = filt(mix, 'high', 28)
t = np.arange(N) / SR
mix *= np.clip((T['end'] - t) / 0.45, 0, 1)[:, None]
mix = np.tanh(mix * 1.6) / np.tanh(1.6)
mix *= 0.89 / np.max(np.abs(mix))

os.makedirs('out', exist_ok=True)
pcm = (mix * 32767).astype('<i2')
import wave
with wave.open('out/soundtrack.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote out/soundtrack.wav', DUR, 's')
