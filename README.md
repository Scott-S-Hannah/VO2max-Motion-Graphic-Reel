# What is VO₂max? A motion graphic reel

A 59-second vertical (1080×1920, 30 fps) Instagram reel explaining VO₂max. It opens with A.V. Hill and the 1923 Douglas-bag experiments and ends in a modern sports-science lab at Winchester. It is built on the **University of Winchester design system** in Claude Design: tokens, bespoke motifs, logo and Asset Bank photography, with Figtree throughout.

**Output (v5, current):** `out/vo2max_reel_v5.mp4`. It is 30 s, 1080×1920, 30 fps, H.264 at about 12 Mbps with faststart, AAC 256 kbps at −14 LUFS, and every frame is motion-blurred. The cover frame is `out/cover_v5.png`. The first draft, which is 59 s long, is kept at `out/vo2max_reel.mp4`, with `out/vo2max_reel_preview.mp4` and `out/cover.png`.

## Live motion master (`motion/`): the source of truth

`motion/index.html` is v5, a showreel-grade version rendered live on the GPU with WebGL2. It uses no libraries. The published version is at https://claude.ai/artifact/1bHyA2g5ZT3QWuynA4TSpY.

The concept is oxygen as light, and one idea runs throughout: VO₂max is a ceiling. The ceiling is a beam of lime light.

- **Camera:** a real perspective camera that orbits, dollies and tracks around the story plane. Particles live in a 3D volume, so parallax is real and depth of field turns out-of-focus light into bokeh. The dive through the O flies the camera through the dust.
- **Lit type:** type is drawn to two layers: world type sits on the story plane and is warped by the 3D camera, and screen type is flat. A type pass builds a bevel height map from the letters. The beam, the photon and the heart light them: diffuse, specular glints that bloom, cast shadows and glassy refraction at the edges.
- **Colour script:** each act has its own grade. The hook is violet. The curve is cool blue. The name returns to violet and lime. The heart is warm red. The test is clinical cyan. The payoff is gold.
- **Rendering:** a background shader draws the nebula, the beam and the heart, which squeezes into a heart shape on every beat. Up to 7,000 instanced particles are drawn as motion-streaked light. The frame then goes through a four-level HDR bloom with an anamorphic streak, and a composite pass: shockwaves, chromatic aberration, a highlight shoulder, desaturation for the time-stop, vignette and grain.
- **Determinism and export:** every element is a pure function of time. `reel.seek(t)` renders any frame exactly. `reel.renderBlur(t, K)` averages K sub-frames over a 180° shutter for true motion blur. `index.html#render` gives a bare 1080×1920 stage.
- **Live playback:** quality adapts. If a device cannot hold the frame rate, the page renders fewer pixels and restores them when it can.

| Time | Beat | What happens |
|---|---|---|
| 0–4 s | **Hook** | From the first frame, a photon of oxygen is already in flight towards a descending beam. Shockwave and sparks. "YOUR BODY HAS A *ceiling.*" |
| 4–10 s | **The curve** | The camera rides a river of particles that climbs with effort and presses flat under the beam. "*until you can't.*" Time stops: colour drains and the camera orbits the frozen river. "THAT LIMIT HAS A NAME" |
| 10–15 s | **The name** | On the drop, the frozen river swoops through depth and re-forms as V̇O₂max, and the beam becomes its underline. It decodes as volume per minute, of oxygen, at maximum effort. |
| 15–21 s | **The heart** | The camera dives through the O into a warm, living heart that squeezes and pumps light down six 3D vessels. "How much it can pump *usually sets the limit.*" |
| 21–26 s | **The test** | The heart implodes into a point of light that unfolds into the lab's lattice. The camera tracks each breath as it drops onto the plane, then whips back square as the beam slams onto the plateau: V̇O₂max. |
| 26–30 s | **The payoff** | "FIND YOUR CEILING." The photon returns and pushes the beam up as oxygen erupts past it towards the camera. "*Then raise it.*" Logo, then fade to black. |

Every caption sits inside Instagram's safe zones (the "Safe zones" toggle shows them). The first frame is already in motion, so the reel works as a loop and as a thumbnail.

The soundtrack is `motion/tools/soundtrack.py`, fully synthesised and scored to the picture's cues at 120 bpm. It moves from A minor to C major at the payoff. Each visual event has its own sound: the laser launch from frame 0, beam hum, impacts with reverse-reverb pre-swells, a tape-stop and frozen glass cluster for the time-stop, an air sweep that follows the orbit, a granular particle swarm, heartbeats with a blood rush on every pump, the implosion and the unfold, and the whip into the slam. During the test, every breath is a note whose pitch follows its V̇O₂ value, so you can hear the plateau. Moving sources are panned to where they are on screen. The master is normalised to −14 LUFS integrated (ITU-R BS.1770) with a 4× oversampled true-peak limiter at −1 dBTP. Running the script also writes `motion/out/spectrogram.png` with the cues marked, and prints loudness and spectral balance for each section.

**Export:** `FFMPEG=… node motion/tools/preview.cjs video 8` renders every frame from 8 motion-blur sub-frames and muxes the track into `motion/out/vo2max_reel.mp4`. The finished file is copied to `out/vo2max_reel_v5.mp4`.

Earlier versions are in `motion/archive/`: v2 (55 s, illustrated), v3 (30 s, strict brand system) and v4 (the first WebGL cut, flat camera).

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
