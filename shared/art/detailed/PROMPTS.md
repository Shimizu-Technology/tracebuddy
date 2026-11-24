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
