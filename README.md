# What is VO₂max? A motion graphic reel

A 59-second vertical (1080×1920, 30 fps) Instagram reel explaining VO₂max. It opens with A.V. Hill and the 1923 Douglas-bag experiments and ends in a modern sports-science lab at Winchester. It is built on the **University of Winchester design system** in Claude Design: tokens, bespoke motifs, logo and Asset Bank photography, with Figtree throughout.

**Output:** `out/vo2max_reel.mp4` (H.264 + AAC, faststart; `out/vo2max_reel_preview.mp4` is a smaller copy for messaging), with a cover frame at `out/cover.png`.

## Live motion master (`motion/`): the source of truth

`motion/index.html` is the reel as a live, scrubbable motion graphic built on GSAP and SVG. It uses shapes and words only, with no photos, motifs or history. It is cut to its own soundtrack, `motion/tools/soundtrack.py` (120 bpm), which was written first. The published version is at https://claude.ai/artifact/1bHyA2g5ZT3QWuynA4TSpY. Video is exported from this timeline once the motion is signed off.

The reel runs 30 s and follows one idea: VO₂max is a ceiling. The Bright Green bar is the ceiling throughout.

| Time | Beat | On screen |
|---|---|---|
| 0–4 s | **Hook** | A white line of oxygen shoots up and hits the ceiling. "Your body has a *ceiling.*" |
| 4–10 s | **The curve** | The camera follows the dot up an effort/oxygen curve. "Push harder, use more oxygen… *until you can't.*" The music drops out. "That limit has a name:" |
| 10–15 s | **The name** | V̇O₂max rises from behind the bar on the drop, then decodes as: volume per minute · of oxygen used by your body · at maximum effort. |
| 15–21 s | **The heart** | The camera zooms through the O into a green field, where a heart pulses on the beat and pumps O₂ outward. "Your heart pumps oxygen to your muscles. How much it can pump *usually sets the limit.*" |
| 21–26 s | **The test** | "Measured *breath by breath.*" Breath dots build the curve, and the ceiling slams onto the plateau, labelled V̇O₂max. |
| 26–30 s | **The payoff** | "Find your ceiling." The oxygen line pushes the bar up. "*Then raise it.*" Logo, then the end fades back to the opening frame so the reel loops. |

The page offers play with sound, scrubbing, frame stepping, beat markers and Instagram safe-zone guides. There is also a bare 1080×1920 render mode, `index.html#render`, and `window.reel.seek(t)` for frame-accurate export. The previous 55 s version is kept in `motion/archive/`.

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
