# What is VO₂max? A motion graphic reel

A 59-second vertical (1080×1920, 30 fps) Instagram reel explaining VO₂max. It opens with A.V. Hill and the 1923 Douglas-bag experiments and ends in a modern sports-science lab at Winchester. It is built on the **University of Winchester design system** in Claude Design: tokens, bespoke motifs, logo and Asset Bank photography, with Figtree throughout.

**Output:** `out/vo2max_reel.mp4` (H.264 + AAC, faststart; `out/vo2max_reel_preview.mp4` is a smaller copy for messaging), with a cover frame at `out/cover.png`.

## Live motion master (`motion/`): the source of truth

`motion/index.html` is v4, a showreel-grade version rendered live on the GPU with WebGL2. It uses no libraries. The published version is at https://claude.ai/artifact/1bHyA2g5ZT3QWuynA4TSpY.

The concept is oxygen as light, and one idea runs throughout: VO₂max is a ceiling. The ceiling is a beam of lime light.

- **Renderer:** a background shader draws a nebula, the ceiling beam and the heart orb (fbm veins with a Fresnel rim). Up to 6,000 instanced particles are drawn as motion-streaked light. Type is drawn to a canvas and uploaded as a texture. The frame then goes through a four-level HDR bloom and a composite pass: shockwave distortion, chromatic aberration, a highlight shoulder, desaturation for the time-stop, vignette and grain.
- **Determinism:** every element is a pure function of time. `reel.seek(t)` renders any frame exactly, and `index.html#render` gives a bare 1080×1920 stage for export.
- **Type:** Figtree's variable weight is animated live (300→900 on slams, pulsing on heartbeats).

| Time | Beat | What happens |
|---|---|---|
| 0–4 s | **Hook** | A photon of oxygen launches with a comet trail and hits a descending beam. Shockwave and sparks. "YOUR BODY HAS A *ceiling.*" |
| 4–10 s | **The curve** | The camera rides a river of particles that widens as effort rises and presses flat under the beam. "*until you can't.*" Time stops (desaturation, the particles freeze). "THAT LIMIT HAS A NAME" |
| 10–15 s | **The name** | On the drop, the frozen river explodes and re-forms as V̇O₂max, and the beam becomes its underline. It decodes as volume per minute, of oxygen, at maximum effort. |
| 15–21 s | **The heart** | The camera dives through the O into a living orb that pumps light down six vessels, with a pressure wave on every beat. "How much it can pump *usually sets the limit.*" |
| 21–26 s | **The test** | The heart implodes into a point of light. "MEASURED *breath by breath.*" Breaths land as pulses, the trend is drawn in light, and the beam slams onto the plateau as V̇O₂max. |
| 26–30 s | **The payoff** | "FIND YOUR CEILING." The photon returns and pushes the beam up as oxygen erupts past it. "*Then raise it.*" Logo, then fade to black, which is also the opening frame, so it loops. |

The soundtrack is `motion/tools/soundtrack.py`, fully synthesised and scored to the picture's cues at 120 bpm. It moves from A minor to C major at the payoff. Each visual event has its own sound: photon charge and laser launch, beam hum, impacts with reverse-reverb pre-swells, a tape-stop and frozen glass cluster for the time-stop, a granular particle swarm, heartbeats with a blood rush on every pump, and an implosion. During the test, every breath is a note whose pitch follows its V̇O₂ value, so you can hear the plateau. Running it also writes `motion/out/spectrogram.png` with the cues marked, and prints loudness and spectral balance for each section. Earlier versions are in `motion/archive/`: v2 (55 s, illustrated), and v3 (30 s, strict brand system).

## First-draft storyboard (`reel/`)

| Time | Scene | Look | Key content |
|---|---|---|---|
| 0–3.8 s | **The origin story** | Sepia newsreel: grain, gate weave, scratches, sprockets | A.V. Hill (1886–1977), Nobel Prize 1922; a “1923 · Hill & Lupton” stamp |
| 3.8–8 s | **Measuring every breath** | Archival illustration | A runner with a Douglas bag, mouthpiece and nose clip; expired air is analysed for O₂ and CO₂ |
| 8–14.5 s | **What the bags revealed** | Hand-inked graph on graph paper | O₂ uptake rises with speed and then plateaus. Hill measured ≈ 4 L·min⁻¹ for himself, and the authors named it the “maximum oxygen intake”. A film burn then cuts to colour |
| 14.5–21 s | **01 The name** | Deep Purple, kinetic type, CopyFrame | V̇ = volume per minute, O₂ = oxygen, max = maximum, followed by the definition |
| 21–31 s | **02 The oxygen journey** | Light theme, Key-icon tiles, pill chips | Lungs → heart → muscle mitochondria, then the Fick principle: V̇O₂max = HR × SV × a–v̄O₂ diff. Cardiac output is usually the main limit |
| 31–38.5 s | **03 The numbers** | Deep Purple; chart on a white panel | mL·kg⁻¹·min⁻¹; typical ranges from inactive adults up to the highest values reported |
| 38.5–47 s | **04 The modern test** | Asset Bank photo of the Winchester lab; live chart | Incremental treadmill test with breath-by-breath V̇O₂. Covers the plateau, RER ≥ 1.10, HR near max, and when to call it V̇O₂peak instead |
| 47–54 s | **05 Why it matters** | CopyFrame, KeyStatistic tile, Bright Green panel | Performance; 13% lower all-cause mortality per 1-MET increase; trainability varies between people |
| 54–59 s | **Outro** | Deep Purple | Quatrefoil PhotoFrame, “your aerobic ceiling”, a 1923 → today timeline, the white banner logo and the MotifStrip |

Every scene cut lands on a beat of the 120 bpm soundtrack. The archival piano plays the same Am–F–C–G progression that the modern track later picks up.

## Scientific sources

- Hill AV, Lupton H (1923). Muscular exercise, lactic acid, and the supply and utilization of oxygen. *Q J Med* 16:135–171.
- Bassett DR, Howley ET (2000). Limiting factors for maximum oxygen uptake and determinants of endurance performance. *Med Sci Sports Exerc* 32:70–84.
- Kodama S et al. (2009). Cardiorespiratory fitness as a quantitative predictor of all-cause mortality and cardiovascular events. *JAMA* 301:2024–2035.
- Douglas CG (1911). The Douglas bag method for collecting expired air.

The value bars (≈35, ≈50, 70–85+, ≈96 mL·kg⁻¹·min⁻¹) are approximate illustrative ranges, and the reel labels them that way on screen.

## Brand

Source: the **University of Winchester** design system in Claude Design (built from *Corporate Brand Guidelines: the essentials*, V1, April 2026).

| Token | Hex | How the reel uses it |
|---|---|---|
| Deep Purple `deep-purple` | `#291647` | Dark-theme ground; text on the light theme |
| Bright Purple `bright-purple` | `#C68EFD` | Labels and accents on Deep Purple; CopyFrame panels; large italic emphasis on white |
| Bright Green `bright-green` | `#D4EF70` | Titles on Deep Purple, key figures, panels, the PhotoFrame shadow |
| `deep-purple-90` / `light-grey` | `#3E2D5A` / `#E6EBEB` | Motif background patterns (tints only) |
| Deep Grey | `#706E6C` | Chart captions on white |

The reel follows these brand rules:

- It uses only the approved text pairings, and never puts Bright Purple or Bright Green text on white.
- Charts sit on white panels.
- Motifs are single-colour and used as patterns, a CopyFrame, a quatrefoil PhotoFrame and a closing MotifStrip.
- The white logo sits on Deep Purple with clear space and no strapline beside it.
- Bullets and arrows are solid triangles, and there is no emoji.

The motif paths, logo and photos (`reel/assets/`: Asset Bank images UoW_Sport_1218 and UoW_Sport_1232) come from that design system. The brand's headline face is Ivy Presto Display (Playfair Display as a stand-in). This reel uses **Figtree** throughout, as requested.

## Adding a real archival photo

Put a public-domain portrait of A.V. Hill at `reel/assets/av-hill.jpg`, for example the 1922 Nobel portrait from Wikimedia Commons. The oval frame then uses the photo, with a sepia treatment, in place of the silhouette. After that, re-render the reel.

## Rebuild

```bash
pip install numpy scipy imageio-ffmpeg        # soundtrack synth + ffmpeg binary
npm i -g playwright                           # or use an existing install
python3 audio.py                              # -> out/soundtrack.wav
NODE_PATH=$(npm root -g) FFMPEG=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())") \
  node render.cjs video 4                     # -> out/vo2max_reel.mp4
node render.cjs stills 5 17 27                # single frames for review
```

To preview in a browser in real time, serve the folder (for example `npx serve reel`) and open `index.html?preview`. Photos need http rather than `file://`.

The soundtrack is fully synthesised in code, so it contains no samples or licensed music.
