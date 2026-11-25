# TraceBuddy 2.0 — Detailed Picture Set Prompts & Production Record

This document records the locked prompts, line-weight calibration (vs. PR #47), vectorization and transparency pipeline, per-subject traceability metrics, full rejection log, and geographic data attribution for all **51 subjects** in `shared/art/detailed/`.

## 1. Line-Weight Calibration (Before vs. After PR #47)

The PR #47 S2 (`Picture-book ink`) pilot used fine-nib ink outlines (~5–8 px at 1024 px), which measured **5.9%–16.0%** survival under a `Disk:4` (~9 px diameter) morphological erosion test—too delicate to trace cleanly through copy paper over a backlit phone screen.

For the production Detailed set, we revised the S2 line prompt to a **heavier, bold traceable picture-book ink** weight (confident medium-bold outer contours with sturdy interior lines at ≥70% outer weight, zero hairlines, and generous white breathing room between parallel lines) while preserving the graceful, storybook proportions and richer detail that distinguish Detailed from Simple.

### Pilot Calibration Comparison (`lineweight.png`)

| Subject | PR #47 S2 `Disk:4` | Revised S2 `Disk:4` | Gain |
|---|---:|---:|---:|
| `crab` | 5.9% | **35.9%** | +30.0 pp |
| `unicorn` | 8.2% | **30.1%** | +21.9 pp |
| `latte-stone` | 16.0% | **29.8%** | +13.8 pp |

Across all 51 finalized subjects: **`Disk:4` min = 18.3%, median = 37.8%, max = 63.3%** (all 51 verified ≥18% and free of hairlines; median SVG size 34.8 KB, median WebP size 21.6 KB).

## 2. Locked Prompts

### Line-Art Prompt (Revised Bold S2 — Locked)

> Classic children's picture-book ink tracing illustration in a bold, traceable "Picture-book ink" style for older kids and adults. Drawn with a bold black ink pen (medium-bold confident outer contours and sturdy, clearly visible interior lines that stay nearly as thick—at least 70% the weight of the outer outline—with zero hairline, wispy, or delicate thin strokes anywhere). Expressive, charming, graceful storybook proportions with thoughtful character detail—distinct from toddler-simple shapes—while cutting tiny clogging micro-details like fine hair strands, tiny scales, or thin grass blades in favor of clean, bold, sculpted shapes. Every region uses crisp closed black outlines with wide, clear white breathing room between all parallel lines so every stroke remains clearly visible through paper on a phone screen. Pure solid black ink (#000000) on a pure solid flat white (#FFFFFF) background. Strictly no thin hairlines, no tapered needle tips, no gray tones, no shading, no cross-hatching, no stippling, no sketchy double lines, no texture, no shadows, no background scene, no border, no text, no letters, no numbers, no watermark. Single centered subject, square 1:1 aspect ratio, generous pure white margin (at least 14% empty white space) on all four sides, nothing cropped.

For architectural, botanical, and vehicle subjects that naturally tend toward fine technical lines (`proa`, `coconut-tree`, `bougainvillea`, `castle`, `race-car`, `fire-truck`, etc.), a stroke-weight reinforcement sentence was appended instructing bold uniform felt-tip/marker outlines (~13–15 px outer, ~11–12 px interior) with hollow interior shapes and no solid black fill blocks.

### Colorization Prompt (Verbatim S2 — Image-to-Image on Approved Line Art)

> Colorize this exact black-and-white ink illustration in a warm "Picture-book ink" storybook style. Preserve every single black ink outline, shape, detail, and placement identically without moving, adding, or removing any lines. Fill inside the existing black outlines with rich yet soft, harmonious flat picture-book colors (muted coral, teal, ochre, warm cream, sage, terracotta tones). Pure solid flat white (#FFFFFF) background outside the subject. Strictly flat solid color fills only: no gradients, no watercolor washes, no shading, no highlights, no paper texture, no shadows, no text, no watermark. Square 1:1 composition matching the source image exactly.

Where species or subject colors matter factually (especially Guam fauna/flora such as `koko-bird`, `carabao`, `coconut-crab`, `bougainvillea`, `proa`, and natural animals/treats), a concise one-sentence factual color note was appended immediately after the verbatim S2 prompt to keep the muted storybook palette faithful to real-world appearances.

## 3. Vectorization & Transparency Pipeline

1. **Line SVG (`line.svg`):** Raw 1024×1024 PNG master -> ImageMagick 2× upscale, 58% threshold, trim & center into 2000×2000 PBM with exact 8% margin (1680×1680 inner box) -> Potrace (`--turdsize 6 --alphamax 1.0 --opttolerance 0.2`) -> normalized `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">` with `fill="#172033"`, no `width`/`height` attributes, no `<metadata>` -> round-trip raster verification via `rsvg-convert`.

2. **Color WebP (`color.webp`):** Raw 1024×1024 color PNG cropped to the exact aligned line-art bounding box -> resized to 430×430 centered inside 512×512 (matching 8% margin) -> transparent exterior background via 4-corner floodfill (`-alpha set -fuzz 8% -fill none`) -> encoded as WebP (`-define webp:alpha-quality=90 -quality 82`). Matching the Simple set convention, enclosed exterior open-air pockets (`coconut-crab` leg gaps + ground slab cleanup, `koko-bird` inter-leg gap, `proa` outrigger-boom gaps, `sailboat` mast/boom gaps, `fire-truck` ladder-rung gaps, `balloons` inter-string gaps) were additionally floodfilled transparent so every illustration floats cleanly on pastel home tiles.

## 4. Geographic Data Attribution (`guam-island`)

- **Dataset:** U.S. Census Bureau Cartographic Boundary File `cb_2023_us_state_500k` (2023)

- **URL:** `https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_500k.zip`

- **License:** Public Domain (U.S. federal government work, 17 U.S.C. 105)

- **Processing:** Extracted feature `STUSPS=GU` (Guam main island simplified from 571 to 159 vertices via Ramer-Douglas-Peucker `eps=2.2px` + Cocos Island simplified from 11 to 7 vertices), stroked at uniform bold traceable weight matching revised S2 (`Disk:4 = 44.9%`), and flat-filled in soft sage green (`#8BB88E`) on a transparent background.

## 5. Per-Subject Catalog & Traceability Metrics (51 Subjects)

| # | ID | Name | Category | `Disk:2` | `Disk:3` | `Disk:4` | `Disk:5` | SVG (KB) | WebP (KB) | Description |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | `crab` | Crab | `ocean` | 69.4% | 51.4% | **35.9%** | 17.6% | 40.1 | 26.9 | Smiling tropical crab viewed from above-front with two raised pincers, six jointed walking legs, and stalk eyes |
| 2 | `sea-turtle` | Sea Turtle | `ocean` | 71.0% | 53.8% | **39.0%** | 20.3% | 38.8 | 22.6 | Graceful sea turtle swimming upward-right with a patterned geometric shell, long curved front flippers, and serene smile |
| 3 | `octopus` | Octopus | `ocean` | 59.3% | 37.6% | **25.7%** | 11.5% | 71.6 | 34.5 | Friendly storybook octopus with a rounded spotted mantle and strictly eight curled, countable arms with bold suction cups |
| 4 | `fish` | Fish | `ocean` | 73.4% | 58.2% | **45.8%** | 31.6% | 34.8 | 20.0 | Cheerful striped reef fish in side profile with expressive eye, flowing dorsal and tail fins, and bold vertical color bands |
| 5 | `whale` | Whale | `ocean` | 68.8% | 50.0% | **34.5%** | 17.6% | 23.2 | 15.1 | Gentle baleen whale swimming left with curved belly pleats, sweeping tail flukes, and a stylized twin-curl water spout |
| 6 | `dolphin` | Dolphin | `ocean` | 74.8% | 60.3% | **47.7%** | 32.2% | 16.6 | 12.0 | Playful bottlenose dolphin leaping in a graceful arc to the right with clean dorsal fin, curved pectoral flippers, and smile |
| 7 | `seahorse` | Seahorse | `ocean` | 66.2% | 46.7% | **31.3%** | 15.4% | 21.7 | 15.4 | Charming seahorse in right-facing profile with scalloped dorsal crest, segmented ribbed belly, and tightly curled prehensile tail |
| 8 | `jellyfish` | Jellyfish | `ocean` | 69.9% | 52.8% | **37.6%** | 20.2% | 39.4 | 26.2 | Translucent-style storybook jellyfish with a spotted domed bell, scalloped frill rim, and six wavy flowing tentacles |
| 9 | `cat` | Sleepy Cat | `animals` | 75.7% | 62.0% | **49.7%** | 34.6% | 38.4 | 25.2 | Cozy tabby cat curled asleep in a ball with tucked paws, closed peaceful eyes, and ringed tail wrapped around its body (no Zzz text) |
| 10 | `puppy` | Puppy | `animals` | 67.8% | 49.7% | **35.4%** | 18.7% | 30.1 | 19.3 | Friendly seated puppy in three-quarter view with floppy ears, collar tag, warm spots, and upturned wagging tail |
| 11 | `bunny` | Bunny | `animals` | 73.7% | 58.4% | **45.4%** | 29.1% | 26.5 | 17.6 | Gentle sitting rabbit in right-facing profile with long upright ears, fluffy cotton tail, and soft storybook cheek contours |
| 12 | `elephant` | Elephant | `animals` | 72.6% | 57.3% | **43.6%** | 28.2% | 24.5 | 14.2 | Cheerful baby elephant walking right with large rounded ears, curved raised trunk, short tusks, and tufted tail |
| 13 | `lion` | Lion | `animals` | 69.6% | 52.2% | **37.5%** | 20.0% | 39.4 | 26.9 | Friendly seated lion facing forward-right with a lush scalloped mane, broad paws, and tufted curving tail |
| 14 | `giraffe` | Giraffe | `animals` | 66.6% | 47.7% | **30.9%** | 15.1% | 34.8 | 19.5 | Graceful standing giraffe in three-quarter right view with long neck, ossicones, bold geometric coat patches, and tufted tail |
| 15 | `owl` | Owl | `animals` | 72.8% | 57.3% | **43.5%** | 26.8% | 38.7 | 24.1 | Wide-eyed storybook owl perched on a leafy twig with ear tufts, scalloped chest feathers, and rounded folded wings |
| 16 | `duck` | Duck | `animals` | 66.8% | 49.2% | **34.2%** | 17.4% | 22.6 | 15.4 | Classic mallard-style pond duck standing in right-facing profile with rounded bill, layered wing feathers, and webbed feet |
| 17 | `butterfly` | Butterfly | `animals` | 74.8% | 60.0% | **47.2%** | 30.3% | 49.7 | 28.4 | Symmetric monarch-style butterfly viewed from above with bold geometric wing panels, border dots, and curled antennae |
| 18 | `snail` | Snail | `animals` | 70.6% | 53.7% | **39.7%** | 24.6% | 28.0 | 20.2 | Friendly garden snail gliding right with a large spiral banded shell and two upturned eye stalks |
| 19 | `t-rex` | T. rex | `dinosaurs` | 72.5% | 56.7% | **42.9%** | 26.5% | 27.9 | 16.0 | Playful smiling Tyrannosaurus rex walking right with chunky jaw, small forearms, ridged back, and balanced tail |
| 20 | `long-neck` | Long-neck Dinosaur | `dinosaurs` | 64.9% | 46.2% | **31.0%** | 17.2% | 31.0 | 17.4 | Gentle sauropod dinosaur in right-facing profile with arching long neck, spotted flanks, pillar legs, and sweeping tail |
| 21 | `triceratops` | Triceratops | `dinosaurs` | 67.0% | 49.0% | **35.6%** | 21.1% | 41.0 | 23.5 | Friendly Triceratops walking right with scalloped neck frill, strictly three horns (two brow horns + one nose horn), and patterned hide |
| 22 | `unicorn` | Unicorn | `magic` | 65.9% | 46.8% | **30.1%** | 12.3% | 37.4 | 22.0 | Graceful standing unicorn in right-facing profile with spiraled horn, flowing banded mane and tail, and slender hooves |
| 23 | `dragon` | Baby Dragon | `magic` | 67.0% | 48.2% | **32.1%** | 15.9% | 33.2 | 22.5 | Adorable seated baby dragon with small curved horns, folded scalloped wings, belly scales, and spade-tipped tail |
| 24 | `castle` | Castle | `magic` | 61.4% | 41.2% | **25.3%** | 13.4% | 40.3 | 23.1 | Fairytale storybook stone castle with central arched timber gate, flanked by three crenellated turrets flying pennants |
| 25 | `crown` | Crown | `magic` | 76.4% | 62.9% | **50.8%** | 36.2% | 36.8 | 22.0 | Ornate royal crown with five flared points topped with round finials and a jeweled band set with faceted gems |
| 26 | `rainbow` | Rainbow | `magic` | 75.5% | 61.1% | **48.8%** | 32.3% | 27.6 | 17.7 | Five-band curved rainbow arch bridging two fluffy storybook clouds beneath three twinkling five-point stars |
| 27 | `mermaid` | Mermaid | `magic` | 64.9% | 44.0% | **27.4%** | 10.8% | 48.3 | 26.0 | Cheerful waving mermaid with flowing hair, modest scalloped short-sleeve tunic, five-fingered hands, and patterned fish tail |
| 28 | `rocket` | Rocket | `go` | 73.9% | 59.3% | **46.2%** | 30.4% | 20.4 | 12.8 | Classic retro storybook space rocket pointing straight up with round porthole window, three curved fins, and stylized exhaust flame |
| 29 | `race-car` | Race Car | `go` | 57.7% | 35.5% | **21.8%** | 10.9% | 37.1 | 18.2 | Vintage open-cockpit storybook race car facing right with curved fenders, rear spoiler, windshield, and spoked wheels |
| 30 | `airplane` | Airplane | `go` | 74.3% | 59.8% | **47.3%** | 33.6% | 37.2 | 23.0 | Friendly propeller monoplane angled forward-left with spinning prop blur lines, cockpit windshield, cabin windows, and landing gear |
| 31 | `sailboat` | Sailboat | `go` | 62.9% | 44.2% | **28.5%** | 12.8% | 42.1 | 22.7 | Classic wooden sloop sailboat gliding right on gentle waves with striped mainsail, jib, wooden mast, and pennant flag |
| 32 | `train` | Train | `go` | 71.3% | 55.7% | **41.1%** | 24.5% | 35.2 | 22.5 | Vintage steam locomotive facing right with tall smokestack, cowcatcher, cab window, three coupled drive wheels, and two steam puffs |
| 33 | `fire-truck` | Fire Truck | `go` | 67.6% | 50.3% | **34.3%** | 20.6% | 33.6 | 19.1 | Classic storybook fire engine facing left with cab window, rooftop warning beacon, side equipment compartments, and angled ladder |
| 34 | `sun` | Sun | `nature` | 76.8% | 63.5% | **51.9%** | 37.1% | 37.9 | 26.6 | Smiling storybook sun with twelve alternating closed triangular and wavy rays and gentle rosy cheek ovals |
| 35 | `flower` | Flower | `nature` | 76.7% | 63.1% | **51.3%** | 35.9% | 32.3 | 21.6 | Cheerful tall sunflower-style blossom with double layered petals, textured seed center, sturdy stem, and two broad leaves |
| 36 | `apple-tree` | Apple Tree | `nature` | 69.5% | 52.3% | **37.8%** | 20.3% | 34.2 | 18.4 | Full storybook orchard tree with sturdy gnarled trunk, lobed leafy canopy, seven round apples, and low grassy mound |
| 37 | `house` | House | `nature` | 72.8% | 57.0% | **43.4%** | 28.2% | 30.2 | 24.4 | Cozy storybook cottage with pitched shingled roof, smoking chimney, paneled front door, multipane windows, and garden shrubs |
| 38 | `mushroom` | Mushroom | `nature` | 78.9% | 66.7% | **56.1%** | 42.4% | 34.1 | 22.4 | Classic spotted woodland toadstool with wide domed cap, ringed stalk, small companion mushroom, and leafy base tufts |
| 39 | `moon-stars` | Moon and Stars | `nature` | 79.6% | 67.6% | **57.4%** | 44.0% | 26.3 | 19.8 | Smiling sleepy crescent moon nestled in a small fluffy cloud surrounded by four five-point stars |
| 40 | `latte-stone` | Latte Stone | `guam` | 65.3% | 46.2% | **29.8%** | 13.0% | 24.9 | 17.1 | Iconic Chamorro latte stone pillar (tapered haligi shaft topped by hemispherical tasa capstone) flanked by plumeria blossom and tropical leaves |
| 41 | `coconut-crab` | Coconut Crab | `guam` | 58.6% | 35.3% | **18.3%** | 3.5% | 62.9 | 29.5 | Guam ayuyu (coconut crab) with two heavy pincers, strictly six clearly separated walking legs, periwinkle/coral shell, and a smooth husked coconut beside it |
| 42 | `koko-bird` | Ko'ko' Bird | `guam` | 70.1% | 53.2% | **39.6%** | 24.8% | 36.8 | 21.4 | Endemic Guam rail (Ko'ko' bird) in right-facing profile with long sturdy bill, chestnut-brown back and wings, gray-brown face stripe, and black-and-white barred belly |
| 43 | `carabao` | Carabao | `guam` | 68.2% | 50.4% | **35.4%** | 18.9% | 32.1 | 17.4 | Guam water buffalo (carabao) standing in right-facing profile with broad dove-gray body, wide sweeping crescent horns, and tufted tail |
| 44 | `proa` | Proa | `guam` | 67.3% | 49.4% | **33.1%** | 15.4% | 48.2 | 24.3 | Traditional Chamorro flying proa (sakman) with single outrigger float attached by two wooden booms and a triangular lateen crab-claw sail over a gentle wave |
| 45 | `coconut-tree` | Coconut Tree | `guam` | 61.6% | 39.8% | **23.4%** | 7.2% | 45.5 | 25.8 | Graceful leaning tropical coconut palm with curved ringed trunk, lush arched palm fronds, cluster of three coconuts, and sandy island mound |
| 46 | `bougainvillea` | Bougainvillea | `guam` | 69.9% | 52.3% | **37.5%** | 19.0% | 43.0 | 25.1 | Branch of Guam's territorial flower featuring three distinct clusters of strictly three rose-magenta papery bracts around tiny white center flowers with oval green leaves |
| 47 | `guam-island` | Guam | `guam` | 73.5% | 58.2% | **44.9%** | 27.7% | 10.6 | 7.5 | Accurate geographic silhouette of Guam and Cocos Island derived from U.S. Census Bureau Cartographic Boundary data (cb_2023_us_state_500k) |
| 48 | `ice-cream` | Ice Cream | `fun` | 69.3% | 50.7% | **35.2%** | 17.6% | 22.1 | 13.2 | Double-scoop waffle ice cream cone with dripping caramel glaze, cherry on top, and striped rolled wafer cookie |
| 49 | `cupcake` | Cupcake | `fun` | 75.7% | 62.3% | **49.9%** | 35.1% | 33.6 | 18.6 | Swirled frosted cupcake in a fluted wrapper decorated with scattered sprinkles and topped with a stemmed cherry and leaf |
| 50 | `birthday-cake` | Birthday Cake | `fun` | 72.6% | 56.7% | **43.1%** | 27.4% | 47.0 | 30.7 | Festive two-tier birthday cake on a scalloped plate with dripping frosting, piped swags, and three striped lit candles (no text) |
| 51 | `balloons` | Balloons | `fun` | 82.6% | 72.2% | **63.3%** | 51.3% | 26.5 | 18.9 | Bunch of three celebratory party balloons (diagonal stripes, polka dots, and glossy highlight) on curved strings tied with a ribbon bow |

## 6. Rejection Log (11 Rejections)

Every rejected generation was discarded and regenerated until both visual quality and `Disk:4` traceability passed:

1. **`coconut-crab` line v1:** Right walking legs obscured behind the coconut; wispy coconut husk lines reduced stroke stability (`Disk:4 = 20.0%`).
2. **`coconut-crab` line v2:** Stray detached claw blade floating above the right pincer; coconut still overlapped the third right leg. Resolved in v3 (6 clearly countable legs + 2 big pincers + smooth 3-dimple coconut, `Disk:4 = 18.3%`).
3. **`proa` line v1:** Too thin overall (`Disk:4 = 12.6%`) with cluttered crossing sail battens and vertical seams. Resolved in v2 (`Disk:4 = 33.1%`, clean lateen crab-claw sail, single outrigger float on 2 booms).
4. **`coconut-tree` line v1:** Too thin (`Disk:4 = 12.0%`); trunk rings, frond ribs, and coconut outlines broke up under erosion. Resolved in v2 (`Disk:4 = 23.4%`).
5. **`bougainvillea` line v1:** Correct 3-bract botanical structure but too thin overall (`Disk:4 = 9.4%`). Resolved in v2 (`Disk:4 = 37.5%`, 3 clusters of strictly 3 bracts).
6. **`koko-bird` color v1:** Verbatim S2 color prompt without a species cue painted the back teal and belly coral-striped instead of brown back + black-and-white barred belly. Resolved in v2 with factual species color note.
7. **`carabao` color v1:** Defaulted to coral-orange coat instead of dove/slate-gray water buffalo. Resolved in v2 with factual color note (warm dove-gray coat, ivory-ochre horns).
8. **`castle` line v1:** Thin architectural stonework lines failed erosion check (`Disk:4 = 8.5%`). Resolved in v2 (`Disk:4 = 25.3%`, heavy marker outlines).
9. **`race-car` line v1:** Generated as solid black silhouette fills instead of hollow traceable coloring-book outlines. Resolved in v2 (`Disk:4 = 21.8%`, clean hollow outlines).
10. **`fire-truck` line v1:** Uniformly thin ~7.5 px mechanical outlines (`Disk:4 = 12.3%`). Resolved in v2 (`Disk:4 = 34.3%`).
11. **`sun` line v1:** Wavy rays were drawn as open-ended unclosed strokes and cheeks were solid black filled ovals. Resolved in v2 (`Disk:4 = 51.9%`, 12 fully closed alternating rays + hollow outlined cheeks).

### Notes for Reviewer

- **Guam cultural accuracy:** Please review `guam.png` closely (especially `coconut-crab`, `koko-bird`, `carabao`, `proa`, `bougainvillea`, `latte-stone`, `coconut-tree`, and `guam-island`).

- **`fire-truck` orientation:** Faces left (the other wheeled vehicles `race-car` and `train` face right, while `airplane` faces front-left); clean and symmetric on the tile, easy to flip horizontally later if desired.

- **`coconut-crab` line weight:** Lowest `Disk:4` in the set at `18.3%` due to the fine carapace and leg detail, still comfortably above PR #47's 5.9%–16.0% range and crisp in `rsvg-convert` round-trip rendering.


## Post-generation fixes

- `latte-stone` color: the shaft came out terracotta. Real latte stones are gray-beige limestone, so the shaft fill was recolored to `#C4B8A4` (flat replace inside the shaft only; the plumeria and leaves are unchanged).

---

## Batch 1 (expansion)

Added **24 new subjects** across 5 categories (`animals`, `dinosaurs`, `space`, `food`, `holidays`) using the locked revised bold S2 prompts (with the felt-tip marker-weight reinforcement sentence applied to geometric/botanical/vehicle-like subjects including `ufo`, `christmas-tree`, `present`, `ringed-planet`, `strawberry`, `snowman`, `gingerbread`, and the `ankylosaurus` / `christmas-tree` v2 regenerations), bringing the Detailed set from 51 to **75 subjects**.

- **Raw 1024px PNG masters:** stored outside git at `/Users/leonshimizu/Desktop/ShimizuTechnology/output/tracebuddy-art-v3/batch1/raw/detailed/`.
- **Contact sheets:** `/Users/leonshimizu/Desktop/ShimizuTechnology/output/tracebuddy-art-v3/batch1/detailed-sheet.png` and `combined-simple-vs-detailed.png`.
- **Batch 1 `Disk:4` range:** **min = 17.7% (`horse`), median = 29.3%, max = 47.3% (`ankylosaurus`)** (23/24 ≥ 18.9%; `horse` v1 kept at 17.7% after v2 regeneration came out thinner at 13.8%).
- **Enclosed exterior pockets cleared transparent:** `pig` (tiny tail-curl loop), `ringed-planet` (both open-space ring gaps), `donut` (center hole), and `strawberry` (two open gaps between stem, leaves, and blossom).

### Per-Subject Catalog & Traceability Metrics (Batch 1 — 24 Subjects)

| # | ID | Name | Category | `Disk:2` | `Disk:3` | `Disk:4` | `Disk:5` | SVG (KB) | WebP (KB) | Description |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 52 | `hamster` | Hamster | `animals` | 65.1% | 45.4% | **30.5%** | 14.8% | 29.0 | 20.5 | Golden storybook hamster sitting three-quarter right with sculpted cheeks, scalloped belly patch, and paws holding a striped sunflower seed |
| 53 | `horse` | Horse | `animals` | 55.0% | 33.9% | **17.7%** | 2.6% | 34.1 | 19.5 | Graceful chestnut storybook horse standing in right-facing profile with flowing sculpted mane, muzzle blaze, fetlock tufts, hooves, and sweeping tail |
| 54 | `pig` | Pig | `animals` | 63.4% | 42.9% | **27.2%** | 10.9% | 25.2 | 17.7 | Friendly spotted farm pig standing right-facing with upturned oval snout, folded ears, terracotta spots, cloven hooves, and curly tail |
| 55 | `sheep` | Sheep | `animals` | 65.7% | 46.4% | **29.7%** | 11.5% | 26.2 | 18.9 | Wooly storybook sheep standing right-facing with sculpted cloud fleece contours, droopy ears, warm biscuit face/legs, and cloven hooves |
| 56 | `monkey` | Monkey | `animals` | 72.4% | 56.3% | **42.7%** | 26.0% | 34.6 | 24.8 | Playful seated storybook monkey facing right holding a curved banana, with head tuft, fur wrist/ankle cuffs, and open S-curved tail |
| 57 | `panda` | Panda | `animals` | 62.2% | 40.8% | **24.8%** | 10.1% | 36.8 | 20.8 | Seated giant panda facing right holding a leafy segmented bamboo stalk, with all dark coat markings drawn as hollow traceable regions and paw pads |
| 58 | `penguin` | Penguin | `animals` | 65.7% | 46.1% | **30.4%** | 15.0% | 22.6 | 13.8 | Upright storybook emperor penguin facing three-quarter right with hollow traceable dark plumage, golden cheek patch, outstretched flippers, and webbed feet |
| 59 | `tiger` | Tiger | `animals` | 56.1% | 32.0% | **19.0%** | 6.5% | 49.0 | 25.6 | Friendly right-facing storybook tiger with cheek ruffs, broad paws, long curved tail, and all stripes drawn as hollow colorable outlined wedges |
| 60 | `stegosaurus` | Stegosaurus | `dinosaurs` | 61.4% | 40.0% | **23.3%** | 7.0% | 30.1 | 17.8 | Walking right-facing storybook Stegosaurus with staggered kite-shaped dorsal plates, hide spots, sturdy legs, and four tail spikes |
| 61 | `pterodactyl` | Pterodactyl | `dinosaurs` | 59.4% | 36.1% | **19.3%** | 3.0% | 21.9 | 14.2 | Graceful gliding storybook pterodactyl soaring right with swept-back head crest, smiling beak, wide paneled wings with wing claws, and trailing feet |
| 62 | `ankylosaurus` | Ankylosaurus | `dinosaurs` | 74.5% | 60.0% | **47.3%** | 32.2% | 34.9 | 21.5 | Standing right-facing armored Ankylosaurus with 4 bold banded carapace sections, blunt conical ridge spikes, horned smiling head, and heavy tail club |
| 63 | `dino-egg` | Dino Egg | `dinosaurs` | 71.9% | 55.6% | **41.4%** | 26.7% | 28.8 | 18.3 | Expressive baby dinosaur hatching from a speckled cracked dinosaur egg, gripping the zigzag rim with clawed paws and wearing the upper shell cap on its head |
| 64 | `astronaut` | Astronaut | `space` | 61.3% | 39.5% | **23.8%** | 8.0% | 40.1 | 23.8 | Floating friendly kid astronaut waving hello with a clear open helmet visor showing their smiling face, star-emblem chest pack (no text/brands), backpack, and treaded boots |
| 65 | `ringed-planet` | Ringed Planet | `space` | 66.9% | 46.7% | **30.8%** | 14.2% | 35.1 | 26.6 | Diagonally tilted gas-giant Saturn planet with swirling cloud belts, oval storm swirl, and wide double-banded ring system with transparent open ring gaps |
| 66 | `alien` | Friendly Alien | `space` | 64.1% | 44.4% | **28.9%** | 11.8% | 27.2 | 18.0 | Cheerful original storybook space alien waving hello with two curved bulb-tipped antennae, ringed collar space tunic, star belt buckle, and cuffed boots |
| 67 | `ufo` | Flying Saucer | `space` | 69.6% | 52.3% | **37.5%** | 20.7% | 32.5 | 22.1 | Gently tilted retro storybook flying saucer with glass cockpit dome, ball-tipped antenna, segmented hull with 5 porthole lights, belly thruster, and 3 landing struts |
| 68 | `donut` | Donut | `food` | 66.3% | 45.8% | **28.9%** | 16.1% | 39.1 | 31.0 | Three-quarter top-view frosted sprinkle donut with dripping scalloped strawberry-coral glaze, vanilla drizzle ribbons, sprinkles, and transparent center hole |
| 69 | `pizza` | Pizza Slice | `food` | 54.1% | 33.7% | **18.9%** | 5.7% | 39.4 | 28.0 | Angled gourmet storybook pizza slice with plump baked crust, dripping melted cheese, 4 pepperoni slices, 2 mushrooms, 2 olive rings, and 2 basil leaves |
| 70 | `strawberry` | Strawberry | `food` | 68.9% | 50.6% | **35.1%** | 16.0% | 34.9 | 24.0 | Hanging ripe botanical-storybook strawberry on a short stem with layered calyx crown, two veined scalloped leaves, 5-petal blossom, and 11 hollow teardrop seeds |
| 71 | `watermelon` | Watermelon Slice | `food` | 66.3% | 48.2% | **33.8%** | 19.1% | 27.2 | 17.6 | Thick three-quarter wedge slice of ripe watermelon showing cut flesh with 9 hollow teardrop seeds, cream inner rind, and wavy striped green outer rind |
| 72 | `christmas-tree` | Christmas Tree | `holidays` | 68.8% | 50.7% | **34.4%** | 14.9% | 31.8 | 18.1 | Festive 4-tier evergreen Christmas tree in a round terracotta planter pot, topped with a 5-point star and decorated with ribbon garlands, striped baubles, and candy canes |
| 73 | `snowman` | Snowman | `holidays` | 60.7% | 38.9% | **22.5%** | 5.9% | 36.0 | 20.2 | Cheerful 3-tier storybook snowman wearing a holly-sprig top hat, carrot nose, fluttering striped scarf, mittened forked twig arms, and 3 hollow buttons |
| 74 | `present` | Present | `holidays` | 69.1% | 51.1% | **35.1%** | 17.5% | 44.7 | 28.1 | Three-quarter wrapped holiday present box with diagonal striped paper, crossed satin ribbons, lush 4-loop bow with curling ribbon tail, and blank star-icon gift tag |
| 75 | `gingerbread` | Gingerbread Friend | `holidays` | 63.1% | 41.3% | **27.2%** | 15.2% | 34.2 | 24.7 | Waving storybook gingerbread cookie friend with piped icing outline border, wavy wrist/ankle cuffs, head icing swirl, striped bowtie, and 3 candy buttons (center heart) |

### Batch 1 Rejection & Regeneration Log (Detailed — 3 Rejections)

1. **`horse` line v2 (REJECTED; v1 retained):** `horse` line v1 measured `Disk:4 = 17.7%` (borderline ~18%), so a single marker-weight regeneration (v2) was attempted; v2 came out thinner at `Disk:4 = 13.8%`, so v2 was rejected and the bolder, cleaner v1 (`17.7%`) was retained as the approved master.
2. **`ankylosaurus` line v1 (REJECTED → v2 approved):** v1 carapace armor plates and spots rendered too thin (`Disk:4 = 11.9%`, `r5 = 1.1%`). Regenerated once in v2 with bold felt-tip marker weight and 4 wide carapace bands (`Disk:4 = 47.3%`).
3. **`christmas-tree` line v1 (REJECTED → v2 approved):** v1 contained 13 small patterned ornaments and thin double-line garlands (`Disk:4 = 8.6%`). Regenerated once in v2 with heavy uniform marker weight, simpler round planter pot, and larger bold ornaments (`Disk:4 = 34.4%`).

### Batch 1 Lead Review Fix (Stroke Thickening)

At phone size, `horse` (17.7%), `tiger` (19.0%) and `pterodactyl` (19.3%) read noticeably thinner than the rest of the Detailed set. Instead of spending more image quota, their lines were re-vectorized from the same raw masters with one extra step: after the 1680×1680 threshold, `-morphology Erode Disk:3` (grows the black ink about 3 px per side at 2000 px) before potrace. Same potrace settings and normalization. New `Disk:4` survival measured on a 1024 px render: `horse` 35.4%, `tiger` 32.0%, `pterodactyl` 37.7%. Tiger stripes and the horse mane stay separated. The color previews were left as generated.

---

## Batch 2 (expansion)

Added **24 new subjects** across 8 categories (`bugs`, `ocean`, `magic`, `go`, `nature`, `fun`, `people`, plus 2 Detailed-only `patterns` mandalas), bringing the Detailed set from 75 to **99 subjects**. All subjects used the locked revised bold S2 prompts, with the felt-tip marker-weight reinforcement sentence appended for architectural/vehicle/botanical/geometric/pattern subjects (`sea-star` v2, `knight`, `fairy`, `school-bus`, `helicopter`, `tractor`, `sunflower`, `cactus`, `soccer-ball`, `guitar`, `kite`, `superhero`, `firefighter`, `flower-mandala`, `butterfly-mandala`).

- **Raw 1024px PNG masters:** stored outside git at `/Users/leonshimizu/Desktop/ShimizuTechnology/output/tracebuddy-art-v3/batch2/raw/detailed/`.
- **Contact sheets:** `/Users/leonshimizu/Desktop/ShimizuTechnology/output/tracebuddy-art-v3/batch2/detailed-sheet.png` and `combined-simple-vs-detailed.png`.
- **Batch 2 final `Disk:4` range:** **min = `20.0%` (`firefighter`), median = `29.6%`, max = `42.6%` (`sea-star`)** — all 24/24 verified `≥ 20.0%` with zero hairlines and zero merged parallel lines.
- **Stroke thickening applied (`-morphology Erode Disk:3` after 1680×1680 threshold, measured on 1024 px SVG render — 12 subjects):**
  - `caterpillar`: raw `18.7%` → thickened **`37.1%`** (stripes, spots, and leaf veins stayed cleanly separated)
  - `shark`: raw `19.5%` → thickened **`30.4%`** (gill slits and fins stayed crisp)
  - `princess`: raw `5.0%` → thickened **`21.1%`** (hair waves, bodice trim, waist bow, and hem scallops stayed cleanly separated)
  - `knight`: raw `8.1%` → thickened **`27.3%`** (helmet visor slots, sun-emblem rays, and armor joints stayed separated)
  - `school-bus`: raw `12.3%` → thickened **`20.2%`** (window frames, accordion door, rub-rails, and wheel lugs stayed separated)
  - `cactus`: raw `14.9%` → thickened **`29.9%`** (vertical ribs, blossoms, and pot zigzag stayed crisp)
  - `volcano`: raw `15.9%` → thickened **`35.9%`** (lava ribbons and slope contours stayed separated)
  - `guitar`: raw `8.5%` → thickened **`25.7%`** (3 spaced strings, frets, and double-ring rosette stayed cleanly separated)
  - `superhero`: raw `14.4%` → thickened **`30.9%`** (cape folds and tunic seams stayed crisp)
  - `firefighter`: raw `5.2%` → thickened **`20.0%`** (reflective coat stripes and coiled hose rings stayed separated)
  - `flower-mandala`: raw `18.1%` → thickened **`38.5%`** (all concentric petal/bud/arch regions stayed spacious and cleanly separated)
  - `butterfly-mandala`: raw `5.5%` → thickened **`23.0%`** (butterfly wing stained-glass panels, leaf veins, and scalloped border stayed separated)
- **Enclosed exterior pockets cleared transparent:** `ladybug` (front leg-leaf gap), `caterpillar` (belly arch above twig + left leaf-twig gap), `ant` (leaf-thorax gap), `princess` (4 arm/skirt gaps), `school-bus` (side-mirror bracket gap), `helicopter` (3 landing-skid strut gaps), `tractor` (bottom ladder-rung gap), `teddy-bear` (right arm-foot gap), and `superhero` (right arm-hip gap).
- **Post-generation master fixes (0 extra quota spent):**
  - `caterpillar` line and `helicopter` line: generated facing left; horizontally mirrored (`-flop`) before colorization so all side-profile subjects face right consistently.
  - `sunflower` line: stem originally touched the bottom edge (`y=1023`); trimmed cleanly at `y=974` and closed with a matching rounded black bottom cap before colorization.
  - `flower-mandala` color: raw color master rendered ~5% larger (`990×989`) than its line master (`939×939`), so `color.webp` was cropped to its own trimmed bounding box (`994×993+15+16`) before normalizing to the 8% margin (`430×430` in `512×512`) to prevent clipping the outer scalloped arches.

### Per-Subject Catalog & Traceability Metrics (Batch 2 — 24 Subjects)

For thickened subjects, `Disk:2`–`Disk:5` reflect the final vectorized 1024 px SVG render; raw pre-thickening `Disk:4` is noted in the Description column.

| # | ID | Name | Category | `Disk:2` | `Disk:3` | `Disk:4` | `Disk:5` | SVG (KB) | WebP (KB) | Description |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 76 | `ladybug` | Ladybug | `bugs` | 72.2% | 56.0% | **42.0%** | 24.4% | 28.9 | 19.7 | Smiling storybook ladybug perched right-facing on a curved green leaf with domed shell, hollow spots, and 6 jointed legs |
| 77 | `bee` | Bumblebee | `bugs` | 72.2% | 55.7% | **41.5%** | 25.8% | 33.8 | 22.8 | Hovering storybook bumblebee facing right with fuzzy scalloped collar, hollow abdomen stripes, veined wings, curved antennae, and tucked legs |
| 78 | `caterpillar` | Caterpillar | `bugs` | 69.9% | 52.3% | **37.1%** | 19.8% | 32.0 | 27.2 | Arched storybook caterpillar inching right (mirrored) along a leafy branch with hollow stripes and spots *(thickened from raw 18.7%)* |
| 79 | `ant` | Ant | `bugs` | 68.2% | 50.1% | **34.1%** | 15.3% | 37.6 | 27.0 | Cheerful storybook worker ant marching right carrying a large veined leaf over its back, with 6 hollow jointed legs and banded abdomen |
| 80 | `shark` | Friendly Shark | `ocean` | 65.2% | 45.1% | **30.4%** | 14.8% | 16.5 | 11.4 | Friendly smiling storybook shark swimming gracefully right with 3 gill slits, counter-shaded belly seam, and sweeping fins *(thickened from raw 19.5%)* |
| 81 | `clownfish` | Clownfish | `ocean` | 65.9% | 46.0% | **33.1%** | 18.4% | 33.0 | 21.4 | Graceful reef clownfish swimming right in side profile with three curved body bands and bold ribbed dorsal, pectoral, ventral, and tail fins |
| 82 | `sea-star` | Sea Star | `ocean` | 73.0% | 56.6% | **42.6%** | 23.5% | 34.2 | 24.7 | Naturalistic five-armed storybook sea star (v2) with central 5-point ridge star, 3 hollow circles per arm, and scalloped edge ridges |
| 83 | `princess` | Princess | `magic` | 60.8% | 37.9% | **21.1%** | 6.0% | 43.6 | 24.6 | Original generic fairytale storybook princess holding out her scalloped ballgown skirt, with 3-peak tiara, wavy hair, and waist bow *(thickened from raw 5.0%)* |
| 84 | `knight` | Knight | `magic` | 65.1% | 45.0% | **27.3%** | 10.7% | 37.6 | 21.9 | Smiling medieval storybook knight in plumed open-visor helmet and plate armor holding a sun-emblem shield and storybook sword *(thickened from raw 8.1%)* |
| 85 | `fairy` | Fairy | `magic` | 59.3% | 35.5% | **20.8%** | 6.0% | 61.8 | 37.1 | Original woodland storybook fairy hovering facing right in flower-wreath headband, leaf-petal dress, scalloped butterfly wings, and star wand |
| 86 | `school-bus` | School Bus | `go` | 59.8% | 38.5% | **20.2%** | 10.5% | 23.6 | 16.0 | Classic conventional-hood school bus facing right with 4 passenger windows, folding door, mirror, rub-rails, and wheels; no text *(thickened from raw 12.3%)* |
| 87 | `helicopter` | Helicopter | `go` | 63.6% | 44.3% | **27.1%** | 12.5% | 30.9 | 18.6 | Classic utility helicopter flying right (mirrored) with bubble cockpit, cabin doors/windows, main and circular tail rotors, and landing skids; no text |
| 88 | `tractor` | Tractor | `go` | 63.2% | 43.0% | **29.3%** | 19.4% | 40.3 | 24.7 | Classic farm tractor facing right with enclosed cab and steering wheel, huge lugged rear wheel, smaller front wheel, exhaust stack, and step ladder; no text |
| 89 | `sunflower` | Sunflower | `nature` | 62.3% | 40.5% | **24.5%** | 7.2% | 55.0 | 35.0 | Tall botanical sunflower with wide crisscross diamond seed center, double petal rings, side bud, two large veined leaves, and cleanly capped stem |
| 90 | `cactus` | Cactus | `nature` | 66.2% | 47.4% | **29.9%** | 14.6% | 29.1 | 18.9 | Fluted saguaro cactus with two upward arms, sparse blunt spines, and two blooming flowers in a zigzag-banded terracotta pot *(thickened from raw 14.9%)* |
| 91 | `volcano` | Volcano | `nature` | 69.1% | 51.3% | **35.9%** | 16.7% | 25.2 | 19.0 | Friendly volcanic mountain with sculpted ridges, flowing lava ribbons, billowing smoke cloud with two small puffs, and base bushes *(thickened from raw 15.9%)* |
| 92 | `soccer-ball` | Soccer Ball | `fun` | 64.1% | 46.6% | **32.0%** | 13.7% | 30.8 | 18.7 | Classic stitched spherical soccer ball with hollow pentagon and hexagon panels and bold dashed seam stitching; no logos |
| 93 | `teddy-bear` | Teddy Bear | `fun` | 58.0% | 35.5% | **21.9%** | 8.4% | 38.3 | 25.8 | Heirloom storybook teddy bear seated facing slightly right with neck ribbon bow, stitched snout seam, heart belly patch, and oval paw pads |
| 94 | `guitar` | Guitar | `fun` | 66.6% | 42.3% | **25.7%** | 10.3% | 30.9 | 20.5 | Classic wooden acoustic guitar tilted diagonally with double-ring rosette, teardrop pickguard, bridge, fretted neck, 3 spaced strings, and 6 tuning pegs *(thickened from raw 8.5%)* |
| 95 | `kite` | Kite | `fun` | 63.3% | 42.0% | **25.5%** | 7.5% | 49.1 | 28.6 | Storybook diamond kite tilted right with double-bordered frame, 4 star/stripe/dot panels, wooden spar tips, and S-curved ribbon tail with 4 bows |
| 96 | `superhero` | Superhero Kid | `people` | 66.8% | 46.7% | **30.9%** | 13.2% | 29.4 | 20.0 | Original storybook superhero kid in windblown hair, domino eye mask, flowing cape, plain paneled tunic (no logo/emblem), belt, and cuffed boots *(thickened from raw 14.4%)* |
| 97 | `firefighter` | Firefighter | `people` | 59.7% | 37.3% | **20.0%** | 6.9% | 35.9 | 19.3 | Friendly storybook firefighter in blank-shield helmet (no text), buckled turnout jacket and pants with reflective bands, boots, and coiled fire hose *(thickened from raw 5.2%)* |
| 98 | `flower-mandala` | Flower Mandala | `patterns` | 71.2% | 53.8% | **38.5%** | 19.7% | 68.9 | 49.7 | Detailed-only 8-fold radially symmetrical botanical flower mandala with spacious medium-sized petals, lotus buds, leaves, and outer circles *(thickened from raw 18.1%)* |
| 99 | `butterfly-mandala` | Butterfly Mandala | `patterns` | 63.7% | 41.9% | **23.0%** | 6.8% | 93.3 | 54.0 | Detailed-only 4-fold radially symmetrical butterfly mandala with central flower medallion, 4 ornate stained-glass butterflies, leafy sprigs, and scalloped border *(thickened from raw 5.5%)* |

### Batch 2 Rejection & Regeneration Log (Detailed — 1 Rejection)

1. **`sea-star` line v1 (REJECTED → v2 approved):** v1 rendered an eerie mouth with no eyes inside the center star and filled every arm bead with fine stipple-shading dots (`Disk:4 = 16.4%`). Regenerated once in v2 as a clean naturalistic five-armed sea star with bold marker-weight outlines, zero stippling, central 5-point star, 3 hollow circles per arm, and scalloped edge ridges (`Disk:4 = 42.6%`).

### Batch 2 Lead Review Fix

At phone size the Detailed `teddy-bear` (21.9%) and `fairy` (20.8%) interior lines still read thin next to the rest of the set. Both were re-vectorized from the same raw masters with a gentler thickening step (`-morphology Erode Disk:2` after the 1680×1680 threshold, before potrace). New `Disk:4` survival on a 1024 px render: `teddy-bear` 30.1%, `fairy` 31.4%. Faces, the bow and the flower crown stay separated.

---

## Batch 3 (expansion)

Added **24 new subjects** across 8 categories (`animals`, `ocean`, `magic`, `go`, `food`, `holidays`, `fun`, plus 2 Detailed-only `patterns` designs `star-mandala` and `owl-doodle`), bringing the Detailed set from 99 to **123 subjects**. All subjects used the locked revised bold S2 prompts, with the felt-tip marker-weight reinforcement sentence appended for vehicle, architectural, object, character-accessory, and pattern subjects (`flamingo`, `wizard`, `treasure-chest`, `hot-air-balloon`, `submarine`, `jack-o-lantern`, `umbrella`, `drum`, `star-mandala`, `owl-doodle`).

- **Raw 1024px PNG masters:** stored outside git at `/Users/leonshimizu/Desktop/ShimizuTechnology/output/tracebuddy-art-v3/batch3/raw/detailed/`.
- **Contact sheets:** `/Users/leonshimizu/Desktop/ShimizuTechnology/output/tracebuddy-art-v3/batch3/detailed-sheet.png` and `combined-simple-vs-detailed.png`.
- **Batch 3 final `Disk:4` range:** **min = `22.1%` (`treasure-chest`), median = `30.5%` (after the lead review fix below; `29.2%` before it), max = `36.8%` (`chicken`)** — all 24/24 verified `≥ 22.1%` with zero hairlines, zero merged parallel lines, and every Simple counterpart visibly thicker than Detailed.
- **Stroke thickening applied (re-vectorized from the same raw master after the 1680×1680 threshold, measured on 1024 px SVG render — 12 subjects):**
  - `Disk:3` (8 subjects under 20% raw `Disk:4`):
    - `cow`: raw `11.5%` → thickened **`28.7%`** (collar strap, bell, spots, and cloven hooves stayed cleanly separated)
    - `koala`: raw `16.2%` → thickened **`35.4%`** (branch bark lines, leaf veins, and toes stayed crisp)
    - `fox`: raw `18.8%` → thickened **`35.3%`** (ear tufts, cheek fur, and hollow paw bands stayed separated)
    - `narwhal`: raw `16.0%` → thickened **`29.4%`** (spiraled tusk grooves and back spots stayed separated)
    - `wizard`: raw `12.2%` → thickened **`31.8%`** (hat/robe stars, moons, buckle, and floating wand stars stayed separated)
    - `submarine`: raw `17.3%` → thickened **`32.1%`** (bolted porthole rivets and hull rivets stayed crisp and hollow)
    - `star-mandala`: raw `7.7%` (post-hollowing) → thickened **`23.5%`** (compass-star rays, faceted diamonds, 5-point stars, and scalloped border stayed spacious and separated)
    - `owl-doodle`: raw `17.9%` → thickened **`30.2%`** (wing spirals, eye petals, belly teardrops, and tail veins stayed cleanly separated)
  - `Disk:2` (4 subjects for balanced phone-size readability and clean spacing):
    - `toucan`: raw `20.5%` (visibly thin at 420 px) → thickened **`33.9%`** (leaf veins, wing scallops, and beak band stayed crisp)
    - `pegasus`: raw `19.6%` → thickened **`29.1%`** (`Disk:2` preserved airy wing-feather spacing and clear Simple-vs-Detailed hierarchy vs. Simple `39.8%`)
    - `treasure-chest`: raw `14.4%` (post-hollowing) → thickened **`22.1%`** (`Disk:2` kept dense star-coin/gem interiors clean and stayed below Simple `26.6%`)
    - `pancakes`: raw `17.0%` → thickened **`22.9%`** (`Disk:2` kept strawberry seeds hollow and unmerged)
- **Enclosed exterior pockets cleared transparent:** `kitten` (small loop inside loose yarn strand), `sloth` (3 limb-branch gaps), `flamingo` (triangle between bent and standing legs), `toucan` (3 gaps between tail, feet, branch, and leaves), `hot-air-balloon` (3 open-air suspension-rope gaps), and `jack-o-lantern` (3 gaps inside curling vine tendrils and leaf-stem junction).
- **Deterministic post-generation master fixes (0 extra quota spent):**
  - `treasure-chest` line: raw master filled the dark cavity under the open lid solid black (`24.84%` ink); hollowed deterministically via morphological erosion/dilation (`Disk:14` → `Disk:6`), turning the cavity clean hollow white with uniform crisp outlines around the crown tips, gems, and lid rim before colorization (true raw `Disk:4 = 14.4%`).
  - `star-mandala` line: raw master filled alternating halves of the central 8-point compass star solid black; hollowed deterministically (`Disk:7` → `Disk:1`) with a clean centered hub ring before colorization (true raw `Disk:4 = 7.7%`).

### Per-Subject Catalog & Traceability Metrics (Batch 3 — 24 Subjects)

For thickened subjects, `Disk:2`–`Disk:5` reflect the final vectorized 1024 px SVG render; raw pre-thickening `Disk:4` and disk radius are noted in the Description column. SVG sizes reflect post-`art:optimize` SVGO output.

| # | ID | Name | Category | `Disk:2` | `Disk:3` | `Disk:4` | `Disk:5` | SVG (KB) | WebP (KB) | Description |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 100 | `cow` | Cow | `animals` | 65.3% | 45.9% | **28.7%** | 12.7% | 31.8 | 21.7 | Friendly storybook dairy cow standing right-facing with hollow coat spots, collar bell, cloven hooves, and tufted tail *(Disk:3 from raw 11.5%)* |
| 101 | `chicken` | Chicken | `animals` | 69.6% | 51.8% | **36.8%** | 19.9% | 28.9 | 20.7 | Charming storybook farm hen standing right-facing with scalloped comb and collar, layered wing feathers, and curved tail plumes |
| 102 | `kitten` | Kitten with Yarn | `animals` | 69.4% | 51.7% | **36.2%** (lead Disk:2; Disk:4 was 24.7%) | 18.9% | 47.3 | 34.5 | Playful storybook tabby kitten in bell collar sitting right-facing and batting a round yarn ball with looping trailing strand |
| 103 | `koala` | Koala | `animals` | 69.0% | 50.4% | **35.4%** | 18.2% | 42.3 | 30.5 | Smiling storybook koala facing right clinging to a sloped leafy eucalyptus branch *(Disk:3 from raw 16.2%)* |
| 104 | `sloth` | Sloth | `animals` | 66.8% | 48.2% | **32.9%** (lead Disk:2; Disk:4 was 25.3%) | 16.8% | 46.5 | 26.6 | Smiling three-toed storybook sloth hanging upside-down by four three-clawed limbs from a leafy horizontal rainforest branch |
| 105 | `fox` | Fox | `animals` | 69.0% | 51.0% | **35.3%** | 18.3% | 30.2 | 22.7 | Alert storybook red fox (v2) sitting right-facing with fluffy ruff, bushy wavy-tipped tail, and hollow outlined ear tips and paw socks *(Disk:3 from raw 18.8%)* |
| 106 | `frog` | Frog | `animals` | 64.4% | 44.0% | **28.3%** | 12.6% | 33.3 | 20.2 | Friendly spotted storybook pond frog sitting three-quarter right on a notched lily pad beside a water-lily blossom |
| 107 | `flamingo` | Flamingo | `animals` | 66.4% | 46.8% | **30.6%** (lead Disk:2; Disk:4 was 24.1%) | 12.1% | 22.3 | 16.6 | Graceful storybook flamingo standing right-facing on one sturdy hollow leg with the other tucked up, S-curved neck, and scalloped folded wing |
| 108 | `toucan` | Toucan | `animals` | 67.8% | 49.2% | **33.9%** | 16.7% | 35.8 | 28.1 | Storybook toco toucan perched right-facing on a leafy tropical branch with bold hollow-outlined plumage and banded beak *(Disk:2 from raw 20.5%)* |
| 109 | `seal` | Seal | `ocean` | 65.2% | 45.5% | **29.6%** (lead Disk:2; Disk:4 was 25.4%) | 16.8% | 26.1 | 15.1 | Smiling storybook harbor seal resting right-facing on its front flippers with hollow back spots, whiskers, and fanned tail flukes |
| 110 | `narwhal` | Narwhal | `ocean` | 66.4% | 46.2% | **29.4%** | 12.9% | 13.6 | 9.8 | Graceful storybook Arctic narwhal swimming right with spiraled ivory tusk, mottled hollow back spots, and forked tail flukes *(Disk:3 from raw 16.0%)* |
| 111 | `pufferfish` | Pufferfish | `ocean` | 65.9% | 45.6% | **30.3%** | 16.1% | 34.6 | 23.2 | Friendly puffed storybook pufferfish swimming right with blunt conical spines, hollow flank spots, puckered smile, and ribbed fins |
| 112 | `wizard` | Wizard | `magic` | 67.3% | 48.5% | **31.8%** | 14.1% | 42.9 | 22.8 | Original friendly storybook kid wizard in star-and-moon buckled hat, flowing cloak, and belted robe raising a star-tipped wand; no licensed-character traits *(Disk:3 from raw 12.2%)* |
| 113 | `pegasus` | Flying Horse | `magic` | 66.3% | 46.0% | **29.1%** | 10.9% | 40.7 | 28.1 | Graceful storybook winged horse (no horn) soaring right with spread layered feathered wings and flowing mane and tail *(Disk:2 from raw 19.6%)* |
| 114 | `treasure-chest` | Treasure Chest | `magic` | 60.2% | 38.0% | **22.1%** | 8.7% | 112.2 | 44.4 | Open riveted wooden treasure chest (lid cavity deterministically hollowed) overflowing with star coins, faceted gems, crown, and pearl necklace *(Disk:2 from raw 14.4%)* |
| 115 | `hot-air-balloon` | Hot-Air Balloon | `go` | 67.4% | 48.1% | **31.3%** | 12.8% | 34.4 | 21.6 | Vintage storybook hot-air balloon with curved gores, scalloped diamond-and-star belt, four suspension ropes, woven wicker basket, and sandbags |
| 116 | `submarine` | Submarine | `go` | 67.2% | 49.1% | **32.1%** | 15.3% | 30.4 | 19.9 | Retro storybook exploration submarine cruising right with riveted hull bands, three bolted portholes, dome hatch, periscope, and propeller; no text *(Disk:3 from raw 17.3%)* |
| 117 | `pancakes` | Pancakes | `food` | 60.2% | 38.7% | **22.9%** | 9.6% | 67.0 | 35.6 | Storybook 4-stack of golden pancakes on a rimmed plate with melting butter pat, dripping maple syrup, two strawberries, and five blueberries *(Disk:2 from raw 17.0%)* |
| 118 | `cookie` | Cookie | `food` | 66.9% | 48.4% | **33.7%** | 18.2% | 39.4 | 26.0 | Bakery-style pair of chunky homemade chocolate chip cookies (front one with scalloped bite) with hollow chocolate chunks, cracks, and crumbs |
| 119 | `jack-o-lantern` | Jack-o'-Lantern | `holidays` | 64.5% | 44.4% | **28.3%** | 11.2% | 41.8 | 31.0 | Cheerful friendly storybook jack-o'-lantern pumpkin with grooved stem, veined leaf, curling vine tendrils, and hollow beveled smiling carved face |
| 120 | `umbrella` | Umbrella | `fun` | 66.7% | 46.6% | **30.1%** | 13.7% | 35.5 | 23.3 | Tilted vintage storybook open umbrella with polka-dot scalloped canopy, hem band, rib tips, ferrule, runner collar, and curved J-hook wooden handle |
| 121 | `drum` | Drum | `fun` | 67.9% | 50.5% | **34.1%** (lead Disk:2; Disk:4 was 24.9%) | 15.0% | 59.6 | 31.9 | Vintage storybook parade marching drum with crossed wooden drumsticks on top, tension studs, hollow V-lacing cords, and diamond/star shell motifs |
| 122 | `star-mandala` | Star Mandala | `patterns` | 63.6% | 41.8% | **23.5%** | 6.3% | 80.1 | 44.4 | Detailed-only 8-fold radially symmetrical celestial star mandala (central compass star deterministically hollowed) with diamonds, petals, stars, ovals, and scalloped rim *(Disk:3 from raw 7.7%)* |
| 123 | `owl-doodle` | Doodle Owl | `patterns` | 66.9% | 46.8% | **30.2%** | 15.9% | 77.9 | 44.1 | Detailed-only decorative doodle owl perched on a leafy branch filled with spacious phone-size petals, chevrons, swirls, diamonds, and scalloped teardrop feathers *(Disk:3 from raw 17.9%)* |

### Batch 3 Rejection & Regeneration Log (Detailed — 1 Rejection)

1. **`fox` line v1 (REJECTED → v2 approved):** v1 filled all four lower legs/paws solid black instead of leaving hollow colorable paw socks. Regenerated once in **v2** with crisp hollow wavy paw/ankle bands and ear tips (`raw Disk:4 = 18.8%` → `35.3%` via `Disk:3`). All 24 colorizations were approved on first attempt.

### Batch 3 Lead Review Fix

At 420 px the Detailed `flamingo` (24.1%), `kitten` (24.7%), `seal` (25.4%), `sloth` (25.3%) and `drum` (24.9%) still read thinner than the rest of the set. Each was re-vectorized from its raw master with `-morphology Erode Disk:2` after the 1680×1680 threshold, before potrace. New `Disk:4` survival on a 1024 px render: `flamingo` 30.6%, `kitten` 36.2%, `seal` 29.6%, `sloth` 32.9%, `drum` 34.1%. Whiskers, yarn strands and drum cords stay separated.


---

## Batch 4 (expansion)

Added **24 new subjects** across 7 categories (`go`, `people`, `holidays`, `fun`, `nature`, `animals`, plus 2 Detailed-only `patterns` designs `heart-pattern` and `cherry-blossom`), bringing the Detailed set from 123 to **147 subjects**. All 23 AI-generated subjects used the locked revised bold S2 prompts with the felt-tip marker-weight reinforcement sentence appended; `hawaii-islands` was generated deterministically from U.S. Census Bureau cartographic boundary data.

- **Raw 1024px PNG masters:** stored outside git at `/Users/leonshimizu/Desktop/ShimizuTechnology/output/tracebuddy-art-v3/batch4/raw/detailed/`.
- **Contact sheets:** `/Users/leonshimizu/Desktop/ShimizuTechnology/output/tracebuddy-art-v3/batch4/detailed-sheet.png`, `combined-simple-vs-detailed.png`, and `hawaii.png` (Hawaii & Pacific cultural review).
- **Batch 4 final `Disk:4` range:** **min = `23.0%` (`police-officer`), median = `29.4%`, max = `41.1%` (`heart-pattern`)** — all 24/24 verified `≥ 23.0%` with zero hairlines, zero merged parallel lines, and every Simple counterpart visibly thicker than Detailed.
- **Stroke thickening applied (re-vectorized from the same raw master after the 1680×1680 threshold, measured on 1024 px SVG render — 16 subjects):**
  - `Disk:4` (1 subject with ultra-fine raw weight and wide open spacing):
    - `ballerina`: raw `0.9%` → thickened **`24.5%`** (eyes, smile, hair ribbon, layered tutu scallops, and ballet slippers stayed cleanly separated; well below Simple `40.8%`)
  - `Disk:3` (7 subjects under 20% raw `Disk:4`):
    - `police-car`: raw `16.0%` → thickened **`25.4%`** (rooftop lightbar, window frames, door handles, and hubcaps stayed crisp and separated)
    - `police-officer`: raw `4.0%` → thickened **`23.0%`** (cap shield, chest star, buttons, pocket flaps, and shoe laces stayed separated)
    - `turkey`: raw `18.9%` → thickened **`36.9%`** (banded tail feathers, layered wing plumes, and chest scallops stayed separated)
    - `reindeer`: raw `11.2%` → thickened **`30.6%`** (branched antlers, collar bell, and cloven hooves stayed crisp)
    - `surfboard`: raw `12.0%` (post-hollowing) → thickened **`31.5%`** (center stringer, hollowed diagonal stripes, hibiscus stamen, and wave crest stayed cleanly separated)
    - `polar-bear`: raw `14.8%` → thickened **`32.8%`** (paw toes, fur tufts, and ice floe rim stayed crisp)
    - `pirate`: raw `7.0%` → thickened **`24.8%`** (hat anchor, shirt stripes, spyglass bands, and dotted map trail with compass star stayed cleanly separated)
  - `Disk:2` (8 subjects in the 20–26% band or with fine parallel lines requiring gentler thickening):
    - `ambulance`: raw `25.3%` → thickened **`31.8%`** (cab mirror, lightbar dividers, door trim, and wheels stayed crisp)
    - `santa`: raw `20.8%` → thickened **`31.0%`** (eyes, mustache curls, fur trim scallops, and buckle stayed crisp)
    - `ukulele`: raw `17.5%` → thickened **`30.5%`** (`Disk:2` kept all 4 strings, frets, and geometric rosette triangles cleanly separated)
    - `hibiscus`: raw `21.9%` → thickened **`31.0%`** (staminal column anthers, petal veins, and leaf veins stayed separated)
    - `lei`: raw `12.5%` → thickened **`23.7%`** (`Disk:2` preserved airy plumeria petal spacing and stayed clearly thinner than Simple `30.4%`)
    - `kitty-bow`: raw `23.2%` → thickened **`34.5%`** (tabby stripes, collar bow folds, and paw toes stayed cleanly separated)
    - `pony`: raw `19.7%` → thickened **`26.9%`** (`Disk:2` kept mane waves and geometric saddle-blanket border triangles cleanly separated)
    - `cherry-blossom`: raw `12.3%` → thickened **`26.0%`** (`Disk:2` kept blossom stamens, branch bark curves, and leaf veins crisp and unmerged)
  - *(Note: `canoe` at raw `25.0%` was left unthickened (`Disk:0`) so the double gunwale rim lines stayed airy and visibly thinner than Simple `32.1%`.)*
- **Enclosed exterior pockets cleared transparent:** `police-officer` (triangle between right arm and torso), `wreath` (center ring opening), `stocking` (hanging-loop opening), `lei` (center ring opening), `polar-bear` (3 open-air leg-to-ice-floe gaps), and `ballerina` (triangle between bent and standing legs).
- **Deterministic post-generation master fixes (0 extra quota spent):**
  - `candy-cane` line: raw master filled alternating diagonal peppermint stripes solid black; hollowed deterministically via `-morphology Erode Disk:10` + gentle `-blur 0x1.2` smoothing so every stripe became a crisp hollow colorable band (`Disk:4 = 40.3%`, post-SVGO `41.0 KB`).
  - `surfboard` line: raw master filled two diagonal stripes solid black; hollowed deterministically via `-morphology Erode Disk:7` + `-blur 0x0.8` before colorization (true raw `Disk:4 = 12.0%` → `31.5%` via `Disk:3`).
  - `polar-bear` color: raw color master extended flat charcoal-slate across the muzzle around the eye/mouth; floodfilled cleanly with the bear's sampled cream-ivory fur (`#F6E7C8`) while preserving the dark nose oval and black outlines.

### Public-Domain Geographic Data Source (`hawaii-islands`)

- **Dataset:** U.S. Census Bureau Cartographic Boundary File `cb_2023_us_state_500k` (2023)
- **URL:** `https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_500k.zip`
- **License:** Public Domain (U.S. federal government work, 17 U.S.C. § 105)
- **Processing:** Extracted feature `STUSPS=HI` (`STATEFP=15`, `GEOID=15`), taking the 8 main Hawaiian islands (Hawaiʻi, Maui, Oʻahu, Kauaʻi, Molokaʻi, Lānaʻi, Niʻihau, Kahoʻolawe), projected with `cos(mean_lat = 20.82°)` equirectangular scaling, simplified with closed-ring Ramer-Douglas-Peucker (`eps = 1.8 px`; `0.55×` gentler on Niʻihau, Kahoʻolawe, and Lānaʻi) and 1 pass of Chaikin smoothing, stroked at uniform `9.8 px` bold traceable weight (`Disk:4 = 26.6%`), and flat-filled in soft sage green (`#8BB88E`) matching `guam-island` (no AI image generation used).

### Per-Subject Catalog & Traceability Metrics (Batch 4 — 24 Subjects)

For thickened subjects, `Disk:2`–`Disk:5` reflect the final vectorized 1024 px SVG render; raw pre-thickening `Disk:4` and disk radius are noted in the Description column. SVG sizes reflect post-`art:optimize` SVGO output.

| # | ID | Name | Category | `Disk:2` | `Disk:3` | `Disk:4` | `Disk:5` | SVG (KB) | WebP (KB) | Description |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 124 | `police-car` | Police Car | `go` | 64.0% | 43.7% | **25.4%** | 12.3% | 18.2 | 12.3 | Classic storybook police sedan facing right with rooftop lightbar, hollow side stripe and plain star, and hollow wheels; no text or department insignia *(Disk:3 from raw 16.0%)* |
| 125 | `police-officer` | Police Officer | `people` | 62.5% | 41.4% | **23.0%** | 6.3% | 28.1 | 14.9 | Friendly smiling waving police officer in peaked cap with blank shield, buttoned uniform with hollow star pin, and buckled belt; no text or weapons *(Disk:3 from raw 4.0%)* |
| 126 | `ambulance` | Ambulance | `go` | 66.7% | 48.9% | **31.8%** | 18.3% | 16.6 | 12.3 | Classic storybook box ambulance truck facing right with rooftop lightbar, bold hollow plus emblem, side stripe, and hollow wheels; no text *(Disk:2 from raw 25.3%)* |
| 127 | `canoe` | Canoe | `go` | 60.2% | 39.0% | **25.0%** | 10.8% | 28.8 | 17.8 | Graceful three-quarter wooden paddling canoe facing right with upturned ends, bench thwarts, geometric hull band, diagonal paddle, and wave lines |
| 128 | `santa` | Santa | `holidays` | 66.7% | 47.6% | **31.0%** | 12.6% | 38.3 | 22.8 | Original jolly storybook Santa Claus waving hello with a tied toy sack over one shoulder, sculpted beard, fur-trimmed coat, and hollow buckled belt *(Disk:2 from raw 20.8%)* |
| 129 | `turkey` | Turkey | `holidays` | 70.4% | 52.3% | **36.9%** | 17.0% | 43.3 | 31.2 | Friendly smiling storybook Thanksgiving turkey facing right with fanned 9-feather banded tail, layered wing plumes, scalloped chest, and three-toed feet *(Disk:3 from raw 18.9%)* |
| 130 | `wreath` | Christmas Wreath | `holidays` | 64.5% | 43.9% | **27.4%** | 9.7% | 75.7 | 38.7 | Festive holiday wreath ring with transparent center hole, bold overlapping holly leaves, berry clusters, 6 striped/dotted baubles, and top bow |
| 131 | `reindeer` | Reindeer | `holidays` | 66.6% | 47.5% | **30.6%** | 11.2% | 27.2 | 19.3 | Graceful plain friendly storybook reindeer standing right-facing with branched antlers, natural dark brown nose (not Rudolph), jingle-bell collar, and hollow hooves *(Disk:3 from raw 11.2%)* |
| 132 | `candy-cane` | Candy Cane | `holidays` | 71.5% | 54.9% | **40.3%** | 21.3% | 41.0 | 27.4 | Pair of crossed storybook peppermint candy canes (stripes deterministically hollowed) tied with a golden ribbon bow, two holly leaves, and three berries |
| 133 | `stocking` | Christmas Stocking | `holidays` | 63.4% | 42.8% | **28.2%** | 13.0% | 37.0 | 20.2 | Festive storybook Christmas stocking with transparent hanging loop, holly-trimmed cuff, candy cane and wrapped gift peeking out, and snowflake/stripe bands; no text |
| 134 | `surfboard` | Surfboard | `fun` | 67.5% | 48.0% | **31.5%** | 13.9% | 22.0 | 13.7 | Upright Hawaiian longboard surfboard with vertical stringer, deterministically hollowed diagonal stripes, 5-petal hibiscus with leaves, and curling wave crest *(Disk:3 from raw 12.0%)* |
| 135 | `ukulele` | Ukulele | `fun` | 70.1% | 47.3% | **30.5%** | 13.0% | 29.1 | 19.4 | Diagonally tilted Hawaiian koa soprano ukulele with geometric rosette, strictly 4 strings and 4 tuning pegs, and a 5-petal plumeria blossom tucked at the base *(Disk:2 from raw 17.5%)* |
| 136 | `hawaii-islands` | Hawaiian Islands | `nature` | 64.8% | 44.2% | **26.6%** | 3.6% | 8.3 | 5.7 | Accurate geographic silhouette of the 8 main Hawaiian islands derived from U.S. Census Bureau Cartographic Boundary data (`cb_2023_us_state_500k`) |
| 137 | `hibiscus` | Hibiscus | `nature` | 66.2% | 46.6% | **31.0%** | 16.0% | 39.5 | 28.4 | Botanical storybook Hawaiian hibiscus with 5 ruffled overlapping petals, curved staminal column with pollen anthers, closed side bud, and two serrated leaves *(Disk:2 from raw 21.9%)* |
| 138 | `lei` | Flower Lei | `nature` | 62.3% | 39.6% | **23.7%** | 7.7% | 65.4 | 38.9 | Lush circular Hawaiian plumeria flower lei ring with transparent center hole, 11 overlapping 5-petal blossoms, tropical leaves, and outer buds *(Disk:2 from raw 12.5%)* |
| 139 | `snowflake` | Snowflake | `nature` | 63.6% | 43.4% | **30.7%** | 14.3% | 62.9 | 33.9 | Ornate symmetric 6-pointed winter snowflake crystal built from bold hollow geometric facets, beveled chevron branches, diamond tips, and floating teardrops |
| 140 | `kitty-bow` | Kitty with a Bow | `animals` | 68.3% | 50.1% | **34.5%** | 17.6% | 43.7 | 25.2 | Original sitting silver-gray striped tabby kitten facing right with bare ears, visible smiling mouth, hollow tabby stripes, and sculpted neck-collar ribbon bow *(Disk:2 from raw 23.2%)* |
| 141 | `pony` | Pony | `animals` | 62.3% | 41.0% | **26.9%** | 12.6% | 46.1 | 28.1 | Compact palomino storybook Shetland pony trotting right with feathered legs, hollow hooves, lush wavy mane and tail, and geometric-trimmed saddle blanket *(Disk:2 from raw 19.7%)* |
| 142 | `polar-bear` | Polar Bear | `animals` | 67.2% | 49.2% | **32.8%** | 14.6% | 20.9 | 15.2 | Friendly storybook polar bear striding right atop an Arctic ice floe with transparent leg gaps and clean cream-ivory muzzle fix *(Disk:3 from raw 14.8%)* |
| 143 | `hedgehog` | Hedgehog | `animals` | 64.3% | 43.5% | **26.1%** | 6.6% | 38.9 | 24.7 | Charming woodland storybook hedgehog walking right with bold layered leaf-like quill tufts, tucked oak leaf and little mushroom, and four neat paws |
| 144 | `ballerina` | Ballerina | `people` | 64.1% | 42.9% | **24.5%** | 6.3% | 24.8 | 16.3 | Graceful smiling storybook ballerina girl (v2 with hollow-outlined hair bun) dancing in a flutter-sleeve leotard, layered scalloped tutu, and ballet slippers *(Disk:4 from raw 0.9%)* |
| 145 | `pirate` | Pirate | `people` | 63.8% | 42.6% | **24.8%** | 8.6% | 45.7 | 25.4 | Cheerful weapon-free storybook kid pirate in hollow anchor-emblem tricorn hat holding a brass spyglass telescope and dotted-trail treasure map *(Disk:3 from raw 7.0%)* |
| 146 | `heart-pattern` | Heart Pattern | `patterns` | 72.2% | 55.4% | **41.1%** | 22.0% | 51.7 | 34.9 | Detailed-only folk-art decorative heart filled with spacious phone-traceable mini-hearts, flower petals, teardrops, paisley swirls, diamond, and scalloped ribbons |
| 147 | `cherry-blossom` | Cherry Blossom | `patterns` | 64.3% | 43.0% | **26.0%** | 7.8% | 74.9 | 45.1 | Detailed-only decorative sakura cherry blossom branch curving diagonally with 6 notched 5-petal blossoms, closed buds, veined sage leaves, and drifting petals *(Disk:2 from raw 12.3%)* |

### Batch 4 Rejection & Regeneration Log (Detailed — 1 Rejection)

1. **`ballerina` line v1 (REJECTED → v2 approved):** v1 rendered the ballerina's hair and bun as solid black silhouette fills with white highlight streaks instead of hollow white colorable hair. Regenerated once in **v2** with crisp hollow-outlined hair and bun (`raw Disk:4 = 0.9%` → `24.5%` via `Disk:4`, all details cleanly separated).
2. **Transient API errors (retried once each, no art rejected):** `lei` color, `ballerina` color, and `pirate` color each hit a transient `HTTP 503 UNAVAILABLE` capacity error on first attempt and succeeded cleanly on retry.
