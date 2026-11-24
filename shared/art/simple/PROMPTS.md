# TraceBuddy 2.0 — Simple Picture Set (S1 "Storybook Soft") Prompts & Log

> **Status: Paused / Blocked on `generate_image` quota (`HTTP 429 RESOURCE_EXHAUSTED`, resets ~21:40 ChST / 11:40 UTC on 2026-11-24).**
> Per brief instructions, no hand-drawn or code-drawn substitutes were used for the remaining AI-generated subjects.
> Completed so far: **7/51 full subjects** (`line.svg` + `color.webp`) and **13 additional approved line-art subjects** (`line.svg` + 1024px raw PNG master, awaiting colorization). **31 line-art subjects + 44 colorizations remain.**

---

## Verbatim Style Prompts (S1 — Storybook Soft, ages 2–6)

### Line art (verbatim)
> Children's coloring-book tracing illustration in a "Storybook soft" style for toddlers and young children ages 2 to 6. Thick, bold, uniform-weight rounded black outlines with smooth soft curves and rounded line caps. Chubby, plump, huggable, friendly proportions with oversized simple shapes and very few interior detail lines. Wide, clear white spacing between all lines so little hands can easily trace every shape. Every shape has clean, fully closed outlines. Pure solid black ink (#000000) lines on a pure solid flat white (#FFFFFF) background. Strictly no shading, no gray tones, no hatching, no stippling, no texture, no shadows, no background elements, no border, no text, no letters, no numbers, no watermark. Single centered subject, square 1:1 aspect ratio, generous pure white margin (at least 14% empty white space) on all four sides, nothing cropped.

### Colorization (verbatim image-edit prompt on approved line-art image)
> Colorize this exact black-and-white line-art illustration in a "Storybook soft" picture-book style. Preserve every single black outline, shape, proportion, and placement identically without moving, adding, or removing any lines. Fill inside the existing thick rounded black outlines with flat, warm, soft pastel-bright children's storybook colors. Pure solid flat white (#FFFFFF) background outside the subject. Strictly flat cel-color fills only: no gradients, no shading, no highlights, no drop shadows, no paper texture, no brush grain, no outlines changed, no text, no watermark. Square 1:1 composition matching the source image exactly.

---

## Public-Domain Geographic Data Source (`guam-island`)

- **Subject:** `guam-island` ("Guam")
- **Source:** U.S. Census Bureau, 2023 Cartographic Boundary Files — State/Territory (`cb_2023_us_state_500k.zip`, `STUSPS=GU`, `STATEFP=66`, `GEOID=66`), downloaded from `https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_500k.zip`.
- **License:** Public Domain (work of the U.S. Federal Government under 17 U.S.C. § 105; U.S. Census Bureau TIGER/Line & Cartographic Boundary Files are free of copyright restrictions).
- **Processing:** Extracted the main Guam island polygon (571 vertices), projected with equirectangular scaling adjusted by `cos(mean_lat = 13.44°)` to preserve true north-south/east-west proportions, simplified with Ramer-Douglas-Peucker (`eps = 6.5` in 1000×1000 canvas units -> 66 vertices) and 3 iterations of closed Chaikin curve smoothing to match S1's smooth rounded tracing aesthetic while preserving Ritidian Point, Tumon Bay, Apra Harbor / Orote Peninsula, Pago Bay, and the southern coast. Rendered at 20px rounded stroke weight (`#000000`) for line art and filled with soft storybook green (`#8BD68F`) on pure `#FFFFFF` for color, then passed through the standard `potrace` + WebP pipeline.

---

## Reused Approved Masters from Draft PR #47 (`origin/gemini/art-style-test`)

Six subjects were already generated with the exact verbatim S1 prompts and approved by Leon in PR #47 (`research/art-style-test-2026-11/raw/s1-*-{line,color}.png`):

1. **`crab` ("Crab")** — from `s1-happy-crab-{line,color}.png` (6 walking legs + 2 raised pincer claws, 2 eyes on short eye stalks, friendly smile).
2. **`sea-turtle` ("Sea Turtle")** — from `s1-island-turtle-{line,color}.png` (top-down swimming sea turtle, scutes, 4 flippers, tiny tail).
3. **`cat` ("Sleepy Cat")** — from `s1-sleepy-cat-{line,color}.png` (curled up sleeping cat, closed curved eyes, tucked paws, curled tail, no "Zzz").
4. **`unicorn` ("Unicorn")** — from `s1-dream-unicorn-{line,color}.png` (right-facing side profile, 4 legs with hooves, single horn, wavy mane, curved tail).
5. **`rocket` ("Rocket")** — from `s1-rocket-ship-{line,color}.png` (vertical rounded rocket, circular porthole, 2 side fins, thruster + flame).
6. **`latte-stone` ("Latte Stone")** — from `s1-latte-stone-{line,color}.png` (approved v2 geometry: rimless hemispherical `tasa` capstone flat-side-up on tapered trapezoidal `haligi` pillar, minimal grass line, no collar/lip/face).

---

## Per-Subject Descriptions (Newly Generated & Approved Line Art)

7. **`octopus` ("Octopus")** — `A cute friendly chubby smiling cartoon octopus facing forward, with a big round dome head, two big happy eyes, a sweet small curved smile, and EXACTLY EIGHT (8) plump curling arms arranged cleanly four on the left and four on the right, clearly separated with generous white space between every arm so a toddler can count all eight arms easily. No tiny suckers or cluttered dots; keep arms smooth and simple.` (Approved: 8 arms verified, 4 left + 4 right.)
8. **`fish` ("Fish")** — `A cute chubby smiling tropical fish in full side profile facing right, with a plump oval body, one big cheerful round eye and friendly curved smile, a simple rounded dorsal fin on top, a small belly fin, one curved side fin, a smooth rounded heart-like tail fin, and just two simple curved vertical stripes on its body. No scales and no floating bubbles.` (Approved.)
9. **`whale` ("Whale")** — `A cute chubby smiling baby whale in full side profile facing right, with a big plump rounded body, a friendly round eye and big curved smile, a simple smooth belly line along the underside, one small rounded side flipper, a smooth curved forked tail fluke, and a simple cute two-droplet water spout curving gently above its head. No ocean waves or background.` (Approved.)
10. **`seahorse` ("Seahorse")** — `A cute chubby smiling baby seahorse in full side profile facing right, with a plump rounded head, short tubular snout, big happy eye and tiny smile, a simple scalloped crest on top of its head, a smooth segmented curved belly stripe with 3 or 4 wide segments, one small rounded back fin, and a plump smoothly curled tail spiral with wide white space inside the curl.` (Approved.)
11. **`jellyfish` ("Jellyfish")** — `A cute chubby smiling baby jellyfish facing forward, with a smooth plump rounded bell dome, a simple scalloped lower rim, two big friendly eyes and a tiny curved smile on the dome, and five simple smoothly wavy ribbon-like tentacles hanging down below with generous white gaps between each tentacle so none cross or overlap.` (Approved.)
12. **`puppy` ("Puppy")** — `A cute chubby smiling puppy sitting happily facing slightly right, with a big round head, two floppy rounded ears, two cheerful round eyes, a cute rounded nose and sweet smile, a simple collar with one tiny round tag, plump sitting body with two front paws and tucked back paws, and a cute wagging curled tail.` (Approved.)
13. **`bunny` ("Bunny")** — `A cute chubby smiling baby bunny sitting in three-quarter side view facing right, with two tall smooth rounded ears (inner ear ovals simple and open), round friendly eyes, a tiny heart/triangle nose and sweet smile, plump round sitting body, simple front paws, big rounded hind foot, and a puffy cloud-like cotton tail.` (Approved.)
14. **`elephant` ("Elephant")** — `A cute chubby smiling baby elephant in full side profile facing right, with a big plump rounded body, one big rounded floppy ear, a friendly round eye and happy smile, a short upturned curling trunk, four sturdy clearly separated plump legs with simple rounded toenail arcs, and a tiny curved tail with a simple tuft.` (Approved.)
15. **`lion` ("Lion")** — `A cute chubby smiling baby lion sitting happily facing forward, with a big round friendly face framed by a simple fluffy scalloped flower-like mane with large smooth scallops, two small round ears peeking out, cheerful round eyes, cute rounded nose and sweet smile, plump sitting body with front paws together, tucked back legs, and a curving tail ending in a teardrop tuft.` (Approved.)
16. **`giraffe` ("Giraffe")** — `A cute chubby smiling baby giraffe in full side profile facing right, with a long friendly neck, cute round head with two little round-tipped ossicones (horns) and two small ears, happy eye and sweet smile, plump rounded body with just 4 or 5 large smooth simple spots (generous white space around them), four clearly separated legs with simple hooves, and a small tufted tail.` (Approved.)
17. **`butterfly` ("Butterfly")** — `A cute chubby smiling butterfly viewed straight-on and perfectly symmetric left-to-right, with a plump capsule-shaped body, a cute round smiling head with two happy eyes and two smoothly curled antennae ending in little round tips, two large rounded upper wings and two slightly smaller rounded lower wings, with just one large simple circle inside each upper wing and one smaller circle inside each lower wing.` (Approved: symmetric left-to-right verified.)
18. **`crown` ("Crown")** — `A cute chubby storybook royal crown viewed straight-on and symmetric, with a smooth curved band along the bottom, three rounded pointed peaks topped with three cute round pearl balls, and three large simple gem shapes (one oval in the center, two circles on the sides) inside the crown band. Clean open shapes with no tiny filigree.` (Approved.)
19. **`mermaid` ("Mermaid")** — `A cute friendly child-appropriate cartoon little mermaid girl swimming happily, smiling warmly with big cheerful eyes, smooth wavy shoulder-length hair with one small simple starfish hair clip, wearing a modest cute short-sleeved or scalloped tank-style swim top (child-friendly and fully covered chest), arms gently outstretched, and a plump curved mermaid tail with a simple smooth scalloped waist band and a big rounded two-lobed tail fin. No tiny fish scales on the tail.` (Approved: child-friendly and modestly dressed verified.)

---

## Rejection Log

1. **`dolphin` (v1 line art — REJECTED):** The curved belly line became noticeably thinner than the outer contour and crossed over/protruded past the lower tail-base outline. Queued for regeneration once `generate_image` quota resets.
2. **`owl` (v1 line art — REJECTED):** The three scalloped belly feather arcs were arranged two-over-one in a way that reads like a second sleeping face on the owl's belly. Queued for regeneration (use a clean plain belly oval or horizontal row of feathers) once `generate_image` quota resets.

---

## Remaining Queue (Blocked by `generate_image` 429 Quota)

- **Line art still needed (31 subjects):**
  - Ocean (1): `dolphin` (regen)
  - Animals (3): `owl` (regen), `duck`, `snail`
  - Dinosaurs (3): `t-rex`, `long-neck`, `triceratops`
  - Magic (3): `dragon`, `castle`, `rainbow`
  - Go (5): `race-car`, `airplane`, `sailboat`, `train`, `fire-truck`
  - Nature (6): `sun`, `flower`, `apple-tree`, `house`, `mushroom`, `moon-stars`
  - Guam (6): `coconut-crab`, `koko-bird`, `carabao`, `proa`, `coconut-tree`, `bougainvillea`
  - Fun (4): `ice-cream`, `cupcake`, `birthday-cake`, `balloons`
- **Colorization still needed (44 subjects):**
  - All 13 already-approved new line-art subjects + the 31 remaining subjects above.
- **Note for resume:** Instruct `image-generator` to call `generate_image` **once** per subject and skip margin-adjustment edit retries (since `process_art.py` normalizes margins to 8% downstream as long as nothing is cropped). That reduces quota consumption by ~3×.
