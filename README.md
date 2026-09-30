# What is VO₂max? A motion graphic reel

A 58-second vertical (1080×1920, 30 fps) Instagram reel explaining VO₂max. It opens with A.V. Hill and the 1923 Douglas-bag experiments and ends in a modern sports-science lab. The reel uses the University of Winchester palette and the Figtree typeface.

**Output:** `out/vo2max_reel.mp4` (H.264 + AAC, faststart), with a cover frame at `out/cover.png`.

## Storyboard

| Time | Scene | Look | Key content |
|---|---|---|---|
| 0–3.8 s | **The origin story** | Sepia newsreel: grain, gate weave, scratches, sprockets | A.V. Hill (1886–1977), Nobel Prize 1922; a “1923 · Hill & Lupton” stamp |
| 3.8–8 s | **Measuring every breath** | Archival illustration | A runner with a Douglas bag, mouthpiece and nose clip; expired air is analysed for O₂ and CO₂ |
| 8–14.5 s | **What the bags revealed** | Hand-inked graph on graph paper | O₂ uptake rises with speed and then plateaus. Hill measured ≈ 4 L·min⁻¹ for himself, and the authors named it the “maximum oxygen intake”. A film burn then cuts to colour |
| 14.5–21 s | **01 The name** | Plum, kinetic type | V̇ = volume per minute, O₂ = oxygen, max = maximum, followed by the definition |
| 21–31 s | **02 The oxygen journey** | Cream, iconography | Lungs → heart → muscle mitochondria, then the Fick principle: V̇O₂max = HR × SV × a–v̄O₂ diff. Cardiac output is usually the main limit |
| 31–38.5 s | **03 The numbers** | Plum, bar chart | mL·kg⁻¹·min⁻¹; typical ranges from inactive adults up to the highest values reported |
| 38.5–47 s | **04 The modern test** | Dark lab HUD | Incremental treadmill test with breath-by-breath V̇O₂. Covers the plateau, RER ≥ 1.10, HR near max, and when to call it V̇O₂peak instead |
| 47–54 s | **05 Why it matters** | Cream cards | Performance; 13% lower all-cause mortality per 1-MET increase; trainability varies between people |
| 54–58 s | **Outro** | Plum | “Your aerobic ceiling”, a 1923 → today timeline and references |

Every scene cut lands on a beat of the 120 bpm soundtrack. The archival piano plays the same Am–F–C–G progression that the modern track later picks up.

## Scientific sources

- Hill AV, Lupton H (1923). Muscular exercise, lactic acid, and the supply and utilization of oxygen. *Q J Med* 16:135–171.
- Bassett DR, Howley ET (2000). Limiting factors for maximum oxygen uptake and determinants of endurance performance. *Med Sci Sports Exerc* 32:70–84.
- Kodama S et al. (2009). Cardiorespiratory fitness as a quantitative predictor of all-cause mortality and cardiovascular events. *JAMA* 301:2024–2035.
- Douglas CG (1911). The Douglas bag method for collecting expired air.

The value bars (≈35, ≈50, 70–85+, ≈96 mL·kg⁻¹·min⁻¹) are approximate illustrative ranges, and the reel labels them that way on screen.

## Brand

| Token | Hex | Use |
|---|---|---|
| Plum | `#702A69` | Primary colour and backgrounds |
| Manhattan (peach) | `#F2BF94` | Accent and highlights |
| Lochinvar (teal) | `#257478` | Secondary accent |
| Cream | `#FBF4EC` | Light backgrounds |

Typeface: Figtree (SIL Open Font License), bundled in `reel/fonts/`. All colours live in the `C` object at the top of `reel/reel.js`, so you can swap them in one place.

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

To preview in a browser in real time, open `reel/index.html?preview` (serve the folder, e.g. `npx serve reel`).

The soundtrack is fully synthesised in code, so it contains no samples or licensed music.
