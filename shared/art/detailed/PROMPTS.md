# TraceBuddy 2.0 — Detailed Picture Set (S2 Bold Traceable) Prompts & QA Log

> **Status:** Work in progress — paused on Antigravity `generate_image` HTTP 429 quota limit (`reset in ~3h42m`, ~02:40 ChST / 16:40 UTC, 2026-11-24).
> **Completed:** 4/51 complete subjects (`line.svg` + `color.webp`: `crab`, `unicorn`, `latte-stone`, `guam-island`), plus 2/51 approved line-only subjects (`line.svg`: `koko-bird`, `carabao`).
> **Remaining:** 45 line-art subjects, 47 colorization subjects (92 image calls before QA regens).

---

## Style Revision — Making S2 Traceable Through Paper

In the PR #47 style test (`origin/gemini/art-style-test`), S2 ("Picture-book ink") had high storybook charm but interior detail lines (~2–4 px at 1024 px) were too thin to see through paper when tracing with a phone camera.

### Before (PR #47 S2 Line-Art Prompt)
> Classic children's picture-book ink tracing illustration in a "Picture-book ink" style for ages 4 to 10 and adults who enjoy charming illustration. Confident, graceful hand-inked black lines with subtle natural pen-weight variation (medium-bold outer contours with slightly lighter, crisp interior detail lines). Expressive, charming, balanced proportions with thoughtful storybook character details while keeping every region clean, open, and clearly traceable. All shapes use crisp closed black outlines with clean white breathing room between parallel lines—no cramped micro-details or muddy clusters. Pure solid black ink (#000000) on a pure solid flat white (#FFFFFF) background. Strictly no gray tones, no shading, no cross-hatching, no stippling, no sketchy double lines, no texture, no shadows, no background scene, no border, no text, no letters, no numbers, no watermark. Single centered subject, square 1:1 aspect ratio, generous pure white margin (at least 14% empty white space) on all four sides, nothing cropped.

### After — Locked Revised S2 Line-Art Prompt
> Classic children's picture-book ink tracing illustration in a bold, traceable "Picture-book ink" style for older kids and adults. Drawn with a bold black ink pen (medium-bold confident outer contours and sturdy, clearly visible interior lines that stay nearly as thick—at least 70% the weight of the outer outline—with zero hairline, wispy, or delicate thin strokes anywhere). Expressive, charming, graceful storybook proportions with thoughtful character detail—distinct from toddler-simple shapes—while cutting tiny clogging micro-details like fine hair strands, tiny scales, or thin grass blades in favor of clean, bold, sculpted shapes. Every region uses crisp closed black outlines with wide, clear white breathing room between all parallel lines so every stroke remains clearly visible through paper on a phone screen. Pure solid black ink (#000000) on a pure solid flat white (#FFFFFF) background. Strictly no thin hairlines, no tapered needle tips, no gray tones, no shading, no cross-hatching, no stippling, no sketchy double lines, no texture, no shadows, no background scene, no border, no text, no letters, no numbers, no watermark. Single centered subject, square 1:1 aspect ratio, generous pure white margin (at least 14% empty white space) on all four sides, nothing cropped.

*(Note for next run on botanical/vehicle/architectural subjects like `bougainvillea`, `coconut-tree`, `proa`, `castle`, `fire-truck`, `train`: reinforce "thick bold marker-weight strokes (~12–15 px outer, ~10–12 px interior) with zero thin veins, plank seams, or rigging lines" inside the subject description so they clear the `Disk:4` erosion gate on the first try.)*

### Verbatim S2 Colorization Prompt (Image-to-Image on Approved Line Art)
> Colorize this exact black-and-white ink illustration in a warm "Picture-book ink" storybook style. Preserve every single black ink outline, shape, detail, and placement identically without moving, adding, or removing any lines. Fill inside the existing black outlines with rich yet soft, harmonious flat picture-book colors (muted coral, teal, ochre, warm cream, sage, terracotta tones). Pure solid flat white (#FFFFFF) background outside the subject. Strictly flat solid color fills only: no gradients, no watercolor washes, no shading, no highlights, no paper texture, no shadows, no text, no watermark. Square 1:1 composition matching the source image exactly.

---

## Line-Weight Calibration & Per-Subject Erosion Metrics

Measured on 1024×1024 thresholded (`58%`) masters using ImageMagick `-morphology Erode Disk:4` (~9 px diameter). Contact sheet: `/Users/leonshimizu/Desktop/ShimizuTechnology/output/tracebuddy-art-v2/detailed/lineweight.png`.

| Subject | PR #47 S2 `Disk:4` (9 px) | Revised S2 `Disk:4` (9 px) | `Disk:3` (7 px) | Ink % | SVG Size / Paths | WebP Size | Status |
|---|---:|---:|---:|---:|---|---:|---|
| `crab` | 4.0% | **35.9%** | 51.4% | 11.75% | 40.1 KB / 9 | 22.9 KB | Complete (line + color) |
| `unicorn` | 0.5% | **30.1%** | 46.8% | 10.58% | 37.4 KB / 4 | 19.3 KB | Complete (line + color) |
| `latte-stone` | 1.4% | **29.8%** | 46.2% | 7.14% | 24.9 KB / 1 | 15.3 KB | Complete (line + color) |
| `guam-island` | — | **44.9%** | 58.2% | 3.42% | 10.6 KB / 2 | 6.1 KB | Complete (Census TIGER) |
| `koko-bird` | — | **39.6%** | 53.2% | 11.14% | 36.8 KB / 5 | — | Line approved; color pending |
| `carabao` | — | **35.4%** | 50.4% | 9.34% | 32.1 KB / 4 | — | Line approved; color pending |

---

## Approved Subject Descriptions (Completed So Far)

- **`crab` (Crab — ocean):** Forward-facing ocean crab with sculpted scalloped carapace, two bold rounded shell markings, warm smile, two expressive eyes on short eye stalks, two large raised jointed pincer claws, and 6 clearly separated jointed walking legs (3 per side).
- **`unicorn` (Unicorn — magic):** Graceful right-facing storybook unicorn in full side profile with single spiral-banded horn, two pointed ears, gentle eye and smile, broad ribbon-like mane locks, 4 cleanly separated legs with hooves, and flowing curved ribbon tail.
- **`latte-stone` (Latte Stone — guam):** Straight-on Guam CHamoru latte stone built strictly from two stacked limestone shapes—tapered trapezoidal `haligi` pillar with bold carved notches topped directly by a smooth, rimless hemispherical `tasa` capstone (flat side up, no rim lip or collar, no cartoon face)—on a bold ground line with one bold five-petal plumeria and broad tropical leaves.
- **`guam-island` (Guam — guam):** Geographic coastline extracted from U.S. Census Bureau Cartographic Boundary File `cb_2023_us_state_500k` (STUSPS=GU; main island 571 → 159 pts via RDP `eps=2.2px` preserving Apra Harbor, Orote Peninsula, Tumon Bay, Ritidian Point, and Pago Bay; Cocos Island 11 → 7 pts gently expanded to remain open/traceable). Soft sage green `#8BB88E` fill on white for color version.
- **`koko-bird` (Ko'ko' Bird — guam):** Right-facing standing Guam rail (flightless) with slender longish slightly curved bill, bold face-stripe contour, folded wing, plump chest/belly divided into bold horizontal barring bands, short upright tail, and two sturdy rail legs with spreading toes on a clean ground line.
- **`carabao` (Carabao — guam):** Right-facing three-quarter standing Guam water buffalo with broad sturdy body, gentle smiling muzzle, large swept-back curved crescent horns with bold widely spaced ridges, rounded ears, 4 sturdy legs with cloven hooves, and tufted tail.

---

## Geographic Data Sources

- **`guam-island`:** U.S. Census Bureau, *Cartographic Boundary Files — States (1:500,000)*, `cb_2023_us_state_500k.zip` (`https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_500k.zip`), 2023 release. **License:** Public Domain (work of the U.S. federal government under 17 U.S.C. § 105).

---

## Rejection Log

| Subject | Attempt | Stage | Reason |
|---|---|---|---|
| `coconut-crab` | v1 | Line art | Obscured right walking legs (only 1–2 partial stubs visible behind coconut instead of clear 6 legs + 2 claws); wispy coconut husk fibers pulled `Disk:4` survival down to 20.0%. |
| `coconut-crab` | v2 | Line art | Stray detached extra pincer curve floating above right claw; coconut still overlapped the 3rd right walking leg. |
| `proa` | v1 | Line art | Too thin (`Disk:4` = 12.6% — hull planks, sail seams, and waves vanished under erosion); awkward double-grid of floating curved bars crossing vertical sail seams. |
| `coconut-tree` | v1 | Line art | Too thin (`Disk:4` = 12.0% — trunk rings, frond center ribs, coconuts, and pebbles vanished under 4 px erosion). |
| `bougainvillea` | v1 | Line art | Accurate 3-bract geometry, but strokes too thin overall (`Disk:4` = 9.4% — interior bract/leaf veins, flower centers, and thin outer edges vanished under 4 px erosion). |

*(Note: 3 additional calls — `proa` #1, `coconut-tree` #1, `bougainvillea` #1 — failed with transient `HTTP 503 UNAVAILABLE` before generating an image; `koko-bird` color hit `HTTP 429 RESOURCE_EXHAUSTED` and halted the run.)*

---

## Exact Remaining Queue (for Next Quota Window)

### Colorization Only (2 subjects — line art already approved & vectorized)
1. `koko-bird` (guam) — *Note: verify brown back + black-and-white barred belly + gray-brown face stripe.*
2. `carabao` (guam) — *Note: verify gentle slate-gray water buffalo + dark horns.*

### Both Line Art + Colorization Remaining (45 subjects)
- **guam (4):** `coconut-crab` (chunky, 6 legs + 2 claws clearly unobstructed, beside smooth coconut; medium purple-blue or warm orange, never near-black), `proa` (slim double-ended hull, ONE outrigger float on two booms, triangular crab-claw sail, bold strokes), `coconut-tree` (ringed trunk, coconuts, small sand mound, thicker strokes), `bougainvillea` (clusters of exactly 3 papery bracts with tiny white centers, a few leaves, thicker strokes)
- **ocean (7):** `sea-turtle`, `octopus` (exact 8 arms), `fish`, `whale`, `dolphin`, `seahorse`, `jellyfish`
- **animals (10):** `cat` (Sleepy Cat, curled up, eyes closed, no Zzz), `puppy`, `bunny`, `elephant`, `lion`, `giraffe`, `owl`, `duck`, `butterfly` (symmetric), `snail`
- **dinosaurs (3):** `t-rex`, `long-neck`, `triceratops` (3 horns + frill)
- **magic (5):** `dragon` (Baby Dragon, friendly), `castle`, `crown`, `rainbow` (arcs + clouds), `mermaid` (modest, child-friendly)
- **go (6):** `rocket`, `race-car`, `airplane`, `sailboat`, `train` (engine), `fire-truck`
- **nature (6):** `sun` (smiling), `flower`, `apple-tree`, `house`, `mushroom`, `moon-stars`
- **fun (4):** `ice-cream`, `cupcake`, `birthday-cake` (candles, no text), `balloons` (3, with strings)
