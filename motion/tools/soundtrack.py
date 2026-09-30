#!/usr/bin/env python3
"""Soundtrack v2 for the 30 s VO2max reel (motion/index.html, the WebGL "oxygen as light" cut).

Scored to the picture: 120 bpm grid, A minor lifting to C major at the payoff, with sound design on every
visual event (photon charge and launch, beam hum, impacts, time-stop, particle swarm, heartbeat, implosion,
sonified breaths). Fully synthesised: no samples, free to use.

    python3 motion/tools/soundtrack.py   -> motion/out/track.wav, motion/assets/track.mp3, motion/out/spectrogram.png
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
rng = np.random.default_rng(2030)
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# ---- picture cues (seconds): keep in sync with motion/index.html
CUE = dict(
    charge=0.05, launch=0.33, beamIn=0.45, impact=0.95, lettersIn=1.12, slam=2.0, textOut=3.45,
    fall=4.0, land=4.45, river=4.95, scrape=7.9, stop=8.4, nameIn=9.25, drop=10.0, dot=10.85,
    decode=(11.4, 12.3, 13.2), dive=14.75, flash=15.3, heart0=16.0, pump=20.85, implode=(20.95, 21.25),
    breaths=(22.3, 24.7), testSlam=25.0, payoff=26.0, relaunch=26.72, lift=27.0, logo=28.0, fade=(29.3, 30.0),
)
BR = []   # breath data, identical formula to the picture
h = lambda i, k: (lambda s: s - math.floor(s))(math.sin(i * 127.1 + k * 311.7) * 43758.5453)
smin = lambda a, b, k: -math.log(math.exp(-k * a) + math.exp(-k * b)) / k
for i in range(96):
    u = i / 95
    BR.append((u, smin(.1 + .95 * u, .8, 22) + ((h(i, 61) + h(i, 62) + h(i, 63)) - 1.5) * .05))


# ---------------------------------------------------------------- helpers
def buf():
    return np.zeros((N, 2))


def tt(d):
    return np.arange(int(d * SR)) / SR


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), x, axis=0)


def st(x, pan=0.0):
    if x.ndim == 2:
        return x
    l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
    return np.stack([x * l, x * r], 1) * math.sqrt(2)


def add(bus, sig, t, g=1.0, pan=0.0):
    sig = st(sig, pan)
    i = int(round(t * SR))
    if i < 0:
        sig, i = sig[-i:], 0
    if i >= N:
        return
    j = min(N, i + len(sig))
    bus[i:j] += sig[: j - i] * g


def env(n, a=.005, r=None, d=None, curve=1.0):
    e = np.ones(n)
    na = max(1, int(a * SR))
    e[:na] = np.linspace(0, 1, na) ** curve
    if d is not None:
        e *= np.exp(-np.arange(n) / SR / d)
    if r is not None:
        nr = min(n, int(r * SR))
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def expsweep(f0, f1, d, curve=1.0):
    t = tt(d)
    return f0 * (f1 / f0) ** ((t / d) ** curve)


def osc(freqs, kind='sin'):
    ph = 2 * np.pi * np.cumsum(freqs) / SR
    if kind == 'sin':
        return np.sin(ph)
    return 2 * ((ph / (2 * np.pi)) % 1) - 1


IRL = int(2.6 * SR)
IR = np.stack([rng.normal(0, 1, IRL), rng.normal(0, 1, IRL)], 1) * np.exp(-np.arange(IRL) / SR / .7)[:, None]
IR = filt(IR, 'low', 6500)
IR /= np.sqrt((IR ** 2).sum(0))


def reverse_swell(sig, d):
    """Reverb tail of a sound, reversed, trimmed to d seconds: the classic pre-hit suck."""
    s = st(sig)
    wet = np.stack([fftconvolve(s[:, c], IR[:, c]) for c in range(2)], 1)[::-1]
    n = int(d * SR)
    out = wet[-n:] if len(wet) >= n else wet
    return out / (np.max(np.abs(out)) + 1e-9) * np.linspace(0, 1, len(out))[:, None] ** 2


# ---------------------------------------------------------------- instruments
def supersaw(m, d, voices=7, det=.013, spread=.9, cut=2500, a=.35, r=.7):
    t = tt(d)
    out = np.zeros((len(t), 2))
    for v in range(voices):
        k = v / (voices - 1) * 2 - 1
        f = hz(m) * (1 + det * k)
        s = 2 * ((t * f + rng.random()) % 1) - 1
        out += st(s, spread * k)
    out = filt(out / voices, 'low', cut)
    return out * env(len(t), a=a, r=r)[:, None]


def pad(ch, d, cut=2200, g=1.0, low=True):
    s = sum(supersaw(m, d, cut=cut) for m in ch)
    if low:
        s += supersaw(ch[0] - 12, d, voices=3, cut=cut * .6) * .7
    return s * g


def kick(g=1.0, dec=7.0):
    t = tt(.5)
    body = osc(48 + 150 * np.exp(-t * 32)) * np.exp(-t * dec)
    click = filt(rng.normal(0, 1, len(t)), 'band', [2500, 7000]) * np.exp(-t * 180) * .5
    return filt(body, 'low', 3000) * .8 + click * 1.3, g


def kick_s(g=1.0, dec=7.0):
    s, _ = kick(g, dec)
    return s * g


def snare(g=1.0):
    t = tt(.35)
    tone = osc(np.full(len(t), 190.0)) * np.exp(-t * 28) * .5
    noise = filt(rng.normal(0, 1, len(t)), 'band', [1200, 9000]) * np.exp(-t * 16)
    return (tone + noise) * g


def clap(g=1.0):
    n = int(.3 * SR)
    s = rng.normal(0, 1, n)
    e = np.zeros(n)
    for k, off in enumerate([0, .011, .022, .034]):
        i = int(off * SR)
        e[i:] += np.exp(-np.arange(n - i) / SR / (.011 if k < 3 else .12))
    return filt(s * e, 'band', [900, 5000]) * g


def hat(g=1.0, open_=False):
    n = int((.22 if open_ else .05) * SR)
    return filt(rng.normal(0, 1, n), 'high', 7500) * np.exp(-np.arange(n) / SR / (.07 if open_ else .012)) * g


def bass(m, d):
    t = tt(d)
    f = hz(m)
    s = osc(np.full(len(t), f)) + .45 * filt(osc(np.full(len(t), f), 'saw'), 'low', 700)
    return s * env(len(t), a=.006, r=.04) * (.65 + .35 * np.exp(-t / .15))


def pluck(m, d=.4, bright=1.0, dec=.14):
    t = tt(d)
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + .4 * bright * np.sin(4 * np.pi * f * t) + .15 * bright * np.sin(6 * np.pi * f * t)
    return s * np.exp(-t / dec) * env(len(t), a=.002)


def chime(m, d=2.2, g=1.0):
    t = tt(d)
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + .45 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 4) + .2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 7)
    return s * np.exp(-t * 1.8) * env(len(t), a=.003) * g


def fm_blip(m, d=.18, idx=3.0, ratio=2.01):
    t = tt(d)
    f = hz(m)
    mod = np.sin(2 * np.pi * f * ratio * t) * idx * np.exp(-t * 30)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t / .05) * env(len(t), a=.002)


def noise_sweep(d, lo, hi, q=1.5, curve=1.0):
    n = int(d * SR)
    src = rng.normal(0, 1, n + 4096)
    out = np.zeros(n)
    seg = 512
    for i in range(0, n, seg):
        fc = lo * (hi / lo) ** ((i / n) ** curve)
        ch = filt(src[i:i + seg + 2048], 'band', [max(20, fc / q), min(fc * q, SR / 2 - 200)], 1)
        m = len(out[i:i + seg])
        out[i:i + m] = ch[2048:2048 + m] if len(ch) >= 2048 + m else 0
    return out


def riser(d, lo=200, hi=9000):
    s = noise_sweep(d, lo, hi, curve=1.4) * np.linspace(0, 1, int(d * SR)) ** 2
    s += osc(expsweep(110, 880, d, 1.6)) * np.linspace(0, 1, int(d * SR)) ** 3 * .25
    s += osc(expsweep(165, 1320, d, 1.6)) * np.linspace(0, 1, int(d * SR)) ** 3 * .15
    return s


def whoosh(d=.6, up=True, lo=250, hi=7000):
    s = noise_sweep(d, lo, hi) if up else noise_sweep(d, hi, lo)
    return s * np.sin(np.pi * np.linspace(0, 1, len(s))) ** 2


def laser_zip(d, f0, f1):
    t = tt(d)
    f = expsweep(f0, f1, d, 2.2)
    mod = np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * 2.5 * (1 - t / d)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR + mod)
    return s * env(len(t), a=.01) * (t / d) ** .5


def beam_hum(d):
    t = tt(d)
    s = filt(osc(np.full(len(t), 55.0), 'saw'), 'low', 900) * .6 + osc(np.full(len(t), 110.0)) * .3
    s += osc(np.full(len(t), 1760.0)) * .06 * (.5 + .5 * np.sin(2 * np.pi * 9 * t))
    return s * env(len(t), a=.25, r=.1)


def impact(g=1.0, sub=60, ring=180, d=2.6, low=.7):
    t = tt(d)
    s = osc(sub * .5 + sub * 1.6 * np.exp(-t * 9)) * np.exp(-t * 2.2) * low
    s += filt(osc(sub * 3 + sub * 6 * np.exp(-t * 14), 'saw'), 'band', [180, 1400]) * np.exp(-t * 7) * .35
    s += filt(rng.normal(0, 1, len(t)), 'high', 3000) * np.exp(-t * 60) * .6
    s += filt(rng.normal(0, 1, len(t)), 'low', 900) * np.exp(-t * 8) * .6
    for r_, a_ in [(1, .25), (2.76, .16), (5.4, .09), (8.93, .05)]:
        s += np.sin(2 * np.pi * ring * r_ * t) * np.exp(-t * (2.2 + r_ * .6)) * a_
    return s * g


def crackle(d, density=380):
    n = int(d * SR)
    s = np.zeros(n)
    k = int(density * d)
    idx = rng.integers(0, n, k)
    s[idx] = rng.normal(0, 1, k) * np.exp(-idx / SR / (d * .35))
    return filt(s, 'high', 2500)


def glitter(d, rate, f_lo=2000, f_hi=9000, grain=(.02, .06)):
    """Granular swarm of tiny sine grains; rate(t) grains per second."""
    out = np.zeros((int(d * SR), 2))
    t = 0.0
    while t < d:
        r = max(1.0, rate(t))
        t += rng.exponential(1 / r)
        if t >= d:
            break
        gd = rng.uniform(*grain)
        n = int(gd * SR)
        f = math.exp(rng.uniform(math.log(f_lo), math.log(f_hi)))
        g_ = np.sin(2 * np.pi * f * np.arange(n) / SR) * np.hanning(n) * rng.uniform(.3, 1)
        i = int(t * SR)
        j = min(len(out), i + n)
        out[i:j] += st(g_[: j - i], rng.uniform(-.9, .9))
    return out


def heartbeat(g=1.0):
    t = tt(.4)
    s = osc(36 + 60 * np.exp(-t * 22)) * np.exp(-t * 11)
    s += filt(rng.normal(0, 1, len(t)), 'band', [120, 700]) * np.exp(-t * 45) * .4
    return filt(s, 'low', 1000) * g


def whum(d=.45):
    t = tt(d)
    s = filt(rng.normal(0, 1, len(t)), 'band', [90, 420]) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    return s + osc(expsweep(70, 45, d)) * np.sin(np.pi * t / d) * .5


def tape_stop(bus, t0, d, until):
    i0, n = int(t0 * SR), int(d * SR)
    seg = bus[i0:i0 + n * 2].copy()
    rate = (1 - np.arange(n) / n) ** 1.6
    pos = np.cumsum(rate)
    pos = np.clip(pos, 0, len(seg) - 2)
    i = pos.astype(int)
    f = (pos - i)[:, None]
    out = seg[i] * (1 - f) + seg[i + 1] * f
    bus[i0:i0 + n] = out * np.linspace(1, 0, n)[:, None] ** .7
    bus[i0 + n:int(until * SR)] *= 0   # silence only through the freeze; the drop brings everything back


# ---------------------------------------------------------------- buses
music, drums, fx, verb = buf(), buf(), buf(), buf()
duck = np.ones(N)


def side(t0, depth=.6, rel=.1):
    i = int(t0 * SR)
    n = int(.3 * SR)
    j = min(N, i + n)
    if i < N:
        duck[i:j] = np.minimum(duck[i:j], 1 - depth * np.exp(-np.arange(j - i) / SR / rel))


CH = {'Am': [57, 60, 64], 'F': [53, 57, 60], 'C': [55, 60, 64], 'G': [55, 59, 62], 'Cadd9': [55, 60, 62, 64, 67], 'Fmaj7': [53, 57, 60, 64]}
RT = {'Am': 45, 'F': 41, 'C': 48, 'G': 43, 'Cadd9': 48, 'Fmaj7': 41}
BARS = ['Am', 'Am', 'Am', 'F', 'Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'Fmaj7', 'Cadd9']

# ---- 0-2 s: the void — a low drone and air
t = tt(8.4)
drone = osc(np.full(len(t), hz(33))) * .5 + osc(np.full(len(t), hz(40))) * .25 + filt(rng.normal(0, 1, len(t)), 'band', [300, 1800]) * .08
drone *= np.clip(t / .4, 0, 1)[None].T[:, 0] * (1 - .5 * np.clip((t - 4) / 2, 0, 1))
add(music, filt(filt(drone, 'low', 1200), 'high', 45), 0, .15)

# ---- harmony + groove
for b, name in enumerate(BARS):
    t0 = b * 2.0
    c, r = CH[name], RT[name]
    frozen = 8.4 <= t0 < 10.0
    heart = 15.3 <= t0 + 1 < 21.3
    if t0 < 2.0 or frozen:
        continue
    if t0 == 26.0:   # the lift lands on 27.0
        add(music, pad(CH['Fmaj7'], 1.2, cut=1800, g=.10), 26.0)
        add(music, pad(CH['Cadd9'], 3.4, cut=5200, g=.21), 27.0)
        add(music, bass(36, 1.6) * env(int(1.6 * SR), r=.8)[:, None][:, 0], 27.0, .2)
        add(music, pad([72, 76, 79], 3.2, cut=7000, low=False, g=.07), 27.0)
        continue
    if t0 == 28.0:
        continue
    cut = 1400 if t0 < 10 else (2000 if heart else 3800)
    add(music, pad(c, 2.25, cut=cut, g=.085 if t0 < 10 else (.13 if heart or t0 >= 21 else .1)), t0)
    # bass
    if heart:
        add(music, bass(r - 12, .95), t0, .14); add(music, bass(r - 12, .95), t0 + 1, .13)
    else:
        for k in range(8):
            add(music, bass(r - 12 + (12 if k % 2 else 0), .22), t0 + k * .25, .2 if t0 >= 4 else .16)
    # arps
    if t0 >= 4 and not heart and t0 < 26:
        seq = [c[0] + 12, c[1] + 12, c[2] + 12, c[1] + 24, c[2] + 12, c[1] + 12, c[0] + 24, c[2] + 24]
        step = .125 if (6 <= t0 < 8.4 or 10 <= t0 < 15) else .25
        for k in range(int(2 / step)):
            tk = t0 + k * step
            if 8.4 <= tk < 10.0:
                continue
            add(music, pluck(seq[k % 8], bright=1.3), tk, .085 if step == .125 else .11, pan=.4 if k % 2 else -.4)

# drums
tb = 2.0
while tb < 26.0 - 1e-6:
    beat = round(tb / .5)
    frozen = 8.4 <= tb < 10.0
    heart = 15.3 <= tb < 21.3
    test = 21.3 <= tb < 26.0
    if not frozen:
        if heart:
            if tb >= CUE['heart0'] - 1e-6:
                add(drums, heartbeat(), tb, .55); add(drums, heartbeat(.6), tb + .18, .4); side(tb, .45)
        elif test and tb < 22.3:
            pass
        else:
            add(drums, kick_s(), tb, .75); side(tb)
            if beat % 2 == 1 and tb >= 4.0:
                add(drums, snare() if tb >= 10 else clap(), tb, .32 if tb >= 10 else .26)
        if not heart:
            add(drums, hat(), tb + .25, .15, pan=.3)
            if tb >= 10 or test:
                add(drums, hat(.7), tb, .07, pan=-.25); add(drums, hat(.5), tb + .125, .05, pan=.1); add(drums, hat(.5), tb + .375, .05, pan=-.1)
    tb += .5
# snare roll into the stop and into the lift
for k in range(24):
    add(drums, snare(), 7.4 + k * (1.0 / 24) ** 1 * (1 - k / 60), .05 + .012 * k)
for k in range(16):
    add(drums, snare(), 26.0 + k * .0625, .04 + .014 * k)
music *= duck[:, None]
drums_music = music + drums * .95

# time stop: tape-stop the whole bed at "until you can't"
tape_stop(drums_music, CUE['stop'], .45, CUE['drop'] - .02)
# frozen air: a glassy held cluster while time stands still
t = tt(1.6)
glass = sum(np.sin(2 * np.pi * hz(m) * t) * a_ for m, a_ in [(81, .3), (84, .22), (88, .18), (93, .1)])
glass *= (.6 + .4 * np.sin(2 * np.pi * 5 * t)) * env(len(t), a=.2, r=.5)
add(fx, glass, 8.45, .09); add(verb, glass, 8.45, .1)

# ---------------------------------------------------------------- sound design on picture cues
# photon charge + launch + beam
add(fx, osc(expsweep(180, 520, .3)) * np.linspace(0, 1, int(.3 * SR)) ** 2 * .6, CUE['charge'], .12)
add(fx, laser_zip(.62, 220, 3200), CUE['launch'], .13); add(verb, laser_zip(.62, 220, 3200), CUE['launch'], .06)
add(fx, whoosh(.6, True), CUE['launch'], .18)
add(fx, beam_hum(.55) * np.linspace(.4, 1, int(.55 * SR)), CUE['beamIn'], .14)
add(fx, reverse_swell(impact(), .6), CUE['impact'] - .6, .16)
for bus, g in ((fx, .62), (verb, .3)):
    add(bus, impact(sub=62, ring=220), CUE['impact'], g)
add(fx, crackle(.9), CUE['impact'], .22)
add(fx, glitter(.7, lambda x: 400 * math.exp(-x * 5), 3000, 11000), CUE['impact'], .08)
# letters + slam
add(fx, glitter(.8, lambda x: 60, 4000, 9000, (.01, .03)), CUE['lettersIn'], .05)
add(fx, reverse_swell(snare(), .35), CUE['slam'] - .35, .14)
add(fx, impact(.7, sub=50, ring=150, d=1.8), CUE['slam'], .38); add(fx, snare(), CUE['slam'], .3); add(verb, snare(), CUE['slam'], .25)
add(fx, whoosh(.45, True), CUE['textOut'], .12)
# fall, land, river
add(fx, osc(expsweep(1400, 160, .45, .7)) * np.exp(-tt(.45) * 2) * .5, CUE['fall'], .12)
add(fx, kick_s(1, 12), CUE['land'], .45)
rise_t = tt(3.0)
add(fx, glitter(3.0, lambda x: 40 + 500 * (x / 3) ** 2, 1800, 7000), CUE['river'], .06)
add(fx, noise_sweep(3.0, 300, 3000, curve=2) * (rise_t / 3) ** 2, CUE['river'], .05)
add(fx, filt(rng.normal(0, 1, int(.55 * SR)), 'band', [2500, 9000]) * np.sin(np.pi * np.linspace(0, 1, int(.55 * SR))) * (.5 + .5 * np.sin(2 * np.pi * 23 * tt(.55))), CUE['scrape'], .12)
add(fx, riser(1.4), CUE['stop'] - 1.4, .14)
for bus, g in ((fx, .55), (verb, .35)):
    add(bus, impact(.8, sub=48, ring=130, d=1.1, low=.4), CUE['stop'], g * .8)
add(fx, fm_blip(88, .2), CUE['nameIn'], .08)
# the drop: the river explodes and re-forms as the word
add(fx, reverse_swell(impact(), .9), CUE['drop'] - .9, .22)
for bus, g in ((fx, .7), (verb, .35)):
    add(bus, impact(sub=58, ring=200, d=3), CUE['drop'], g)
add(fx, whoosh(.9, False, 300, 9000), CUE['drop'], .2)
add(fx, glitter(1.3, lambda x: 900 * math.exp(-x * 2.2) + 50, 2500, 12000), CUE['drop'], .09)
add(fx, chime(93, 1.5), CUE['dot'] + .2, .07); add(verb, chime(93, 1.5), CUE['dot'] + .2, .08)
for i, tk in enumerate(CUE['decode']):
    add(fx, fm_blip(79 + i * 3, .22, idx=4), tk, .14, pan=(-.4, 0, .4)[i])
# the dive through the O
add(fx, riser(.55, 400, 12000), CUE['dive'], .26)
for bus, g in ((fx, .55), (verb, .4)):
    add(bus, impact(.9, sub=44, ring=120, d=2.4), CUE['flash'], g)
add(fx, filt(glitter(5.5, lambda x: 45, 900, 3500, (.04, .12)), 'low', 4000), 15.5, .1)   # vessel flow shimmer
for k in range(10):
    add(fx, whum(), CUE['heart0'] + k * .5 + .02, .17, pan=(-.3 if k % 2 else .3))
    rush = filt(rng.normal(0, 1, int(.4 * SR)), 'band', [1200, 5000]) * np.sin(np.pi * np.linspace(0, 1, int(.4 * SR))) ** 2
    add(fx, rush, CUE['heart0'] + k * .5 + .06, .05 + .004 * k, pan=(.5 if k % 2 else -.5))
# the implosion: a reverse suck, then a point of light
add(fx, reverse_swell(impact(), .32), CUE['implode'][0], .35)
add(fx, osc(expsweep(90, 900, .3, 2)) * np.linspace(0, 1, int(.3 * SR)) ** 2, CUE['implode'][0], .09)
add(fx, chime(96, 1.6), CUE['implode'][1], .08); add(verb, chime(96, 1.6), CUE['implode'][1], .12)
add(fx, impact(.6, sub=40, ring=260, d=1.5), CUE['implode'][1], .3)
# breath by breath: every breath is a note whose pitch follows its oxygen value
b0, b1 = CUE['breaths']
for i, (u, v) in enumerate(BR):
    m = 64 + 17 * min(1.1, v / .8)
    add(fx, pluck(m, .22, bright=1.1, dec=.07), b0 + (b1 - b0) * u, .1, pan=(u - .5) * .8)
    add(verb, pluck(m, .22, bright=1.1, dec=.07), b0 + (b1 - b0) * u, .05)
add(fx, reverse_swell(snare(), .3), CUE['testSlam'] - .3, .14)
for bus, g in ((fx, .6), (verb, .3)):
    add(bus, impact(sub=56, ring=240), CUE['testSlam'], g)
add(fx, crackle(.7), CUE['testSlam'], .16)
# payoff: relaunch, the lift, the eruption, the sign-off
add(fx, whoosh(.5, False), CUE['payoff'], .15)
add(fx, laser_zip(.3, 300, 3600), CUE['relaunch'], .12)
add(fx, riser(1.0), CUE['lift'] - 1.0, .16)
for bus, g in ((fx, .6), (verb, .4)):
    add(bus, impact(sub=52, ring=262), CUE['lift'], g)
add(fx, glitter(2.2, lambda x: 1100 * math.exp(-x * 1.4) + 30, 2500, 12000), CUE['lift'], .09)
for m in (72, 76, 79, 84):
    add(fx, chime(m, 2.4), CUE['logo'], .045); add(verb, chime(m, 2.4), CUE['logo'], .07)

# ---------------------------------------------------------------- mix + master
verb += drums_music * .22 + fx * .25
wet = np.stack([fftconvolve(verb[:, c], IR[:, c])[:N] for c in range(2)], 1)
mix = drums_music + fx + wet * .42
mix = filt(mix, 'high', 28)
mix += filt(mix, 'band', [2000, 5000]) * .12            # a little presence for phone speakers
tl = np.arange(N) / SR
mix *= np.clip((DUR - tl) / .7, 0, 1)[:, None] * np.clip(tl / .08, 0, 1)[:, None]
# gentle bus compression (RMS follower) then soft clip
rms = np.sqrt(np.maximum(filt((mix ** 2).mean(1), 'low', 8), 0) + 1e-9)
gain = np.minimum(1, (.35 / (rms + 1e-9)) ** .45)
mix *= gain[:, None]
# section automation (dB): the drop is the biggest moment, the heart and test sit forward, the curve builds
AUTO = [(0, 0), (9.9, 0), (10.0, 1.5), (14.7, 1.5), (15.3, -.5), (21.2, -.5), (21.3, 0), (25.9, 0), (26.9, 2.5), (30, 2.5)]
mix *= (10 ** (np.interp(tl, *zip(*AUTO)) / 20))[:, None]
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
mix *= .89 / np.max(np.abs(mix))

os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
wav = os.path.join(ROOT, 'out', 'track.wav')
with wave.open(wav, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
ff = os.environ.get('FFMPEG', 'ffmpeg')
subprocess.run([ff, '-v', 'error', '-y', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '224k', os.path.join(ROOT, 'assets', 'track.mp3')], check=True)

# report: loudness + low-end share per beat, and a spectrogram with the picture cues marked
for a, b in [(0, 1), (1, 4), (4, 8.4), (8.4, 10), (10, 15), (15, 21), (21, 26), (26, 30)]:
    s = mix[int(a * SR):int(b * SR)].mean(1)
    F = np.abs(np.fft.rfft(s)) ** 2; f = np.fft.rfftfreq(len(s), 1 / SR)
    print(f'{a:>5}-{b:<5} rms {10*np.log10((s**2).mean()+1e-12):6.1f} dB   <120Hz {100*F[f<120].sum()/F.sum():4.1f}%   2-6kHz {100*F[(f>2000)&(f<6000)].sum()/F.sum():4.1f}%')
try:
    from PIL import Image, ImageDraw
    mono = mix.mean(1)
    hop, win = 441, 2048
    frames = [np.abs(np.fft.rfft(mono[i:i + win] * np.hanning(win)))[:900] for i in range(0, len(mono) - win, hop)]
    S = 20 * np.log10(np.array(frames).T + 1e-6)
    S = np.clip((S - S.max() + 80) / 80, 0, 1)[::-1]
    img = Image.fromarray((S * 255).astype('uint8')).resize((1500, 450)).convert('RGB')
    d = ImageDraw.Draw(img)
    for k, v in CUE.items():
        for x in (v if isinstance(v, tuple) else (v,)):
            X = int(x / DUR * 1500); d.line([(X, 0), (X, 450)], fill=(212, 239, 112), width=1); d.text((X + 2, 2), k[:6], fill=(255, 255, 255))
    img.save(os.path.join(ROOT, 'out', 'spectrogram.png'))
except Exception as e:  # noqa
    print('spectrogram skipped:', e)
print('wrote', wav, 'and assets/track.mp3')
