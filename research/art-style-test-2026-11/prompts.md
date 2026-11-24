# TraceBuddy 2.0 Art Style Test — Prompts, Tooling & Terms Notes

## Image Generation Tool & Model

- **Tool used:** Antigravity `image-generator` subagent (`generate_image` tool, supporting text-to-image generation for line art and image-to-image editing for colorization and targeted outline fixes).
- **Underlying model:** **Unknown / not exposed.** Neither the `generate_image` tool schema nor its output metadata exposes the underlying image model identifier or version. Output files are saved as 1024×1024 sRGB JPEGs and converted losslessly to PNG in `raw/`.

## Commercial Use & Terms-of-Use Notes

Based on Google's published Terms of Service, Google Antigravity Additional Terms of Service, and Google Generative AI Prohibited Use Policy (checked Nov 2026):

- **Ownership & commercial use:** Under Google's standard Terms of Service ("Your Content"), Google does not claim ownership of outputs you generate and generally permits commercial use without requiring attribution to Google, subject to the Generative AI Prohibited Use Policy (no third-party IP infringement, trademarks, deceptive likenesses, etc.).
- **Important unknowns & caveats to verify before shipping to the App Store:**
  1. **Unexposed model / tier status:** Because the exact model and release tier behind Antigravity's `generate_image` tool are not exposed in tool metadata, we cannot confirm from the session alone whether the backend is covered by General Availability (GA) commercial terms or a Pre-GA / Preview / evaluation-only term. **Leon should confirm the active Google Antigravity / Google AI Ultra terms covering `generate_image` before shipping generated assets commercially.**
  2. **Copyright enforceability:** Under current US Copyright Office guidance, purely AI-generated imagery generally lacks copyright protection without substantial human authorship. That does not stop TraceBuddy from shipping the art, though it limits exclusive copyright claims over raw outputs.
  3. **Cultural review:** Culturally specific Guam / CHamoru subjects (such as the latte stone and the planned Guam set) must be reviewed by Leon before release.

---

## Verbatim Style Prompts

Each style used one verbatim line-art prompt across all 6 subjects, followed by one verbatim colorization image-edit prompt applied directly to the approved line-art image so outlines, shapes, and placement match identically.

### S1 — Storybook Soft (ages 2–6)

**Line art (verbatim):**
> Children's coloring-book tracing illustration in a "Storybook soft" style for toddlers and young children ages 2 to 6. Thick, bold, uniform-weight rounded black outlines with smooth soft curves and rounded line caps. Chubby, plump, huggable, friendly proportions with oversized simple shapes and very few interior detail lines. Wide, clear white spacing between all lines so little hands can easily trace every shape. Every shape has clean, fully closed outlines. Pure solid black ink (#000000) lines on a pure solid flat white (#FFFFFF) background. Strictly no shading, no gray tones, no hatching, no stippling, no texture, no shadows, no background elements, no border, no text, no letters, no numbers, no watermark. Single centered subject, square 1:1 aspect ratio, generous pure white margin (at least 14% empty white space) on all four sides, nothing cropped.

**Color (verbatim image-edit prompt on approved line-art image):**
> Colorize this exact black-and-white line-art illustration in a "Storybook soft" picture-book style. Preserve every single black outline, shape, proportion, and placement identically without moving, adding, or removing any lines. Fill inside the existing thick rounded black outlines with flat, warm, soft pastel-bright children's storybook colors. Pure solid flat white (#FFFFFF) background outside the subject. Strictly flat cel-color fills only: no gradients, no shading, no highlights, no drop shadows, no paper texture, no brush grain, no outlines changed, no text, no watermark. Square 1:1 composition matching the source image exactly.

---

### S2 — Picture-Book Ink (ages 4–10 & adults)

**Line art (verbatim):**
> Classic children's picture-book ink tracing illustration in a "Picture-book ink" style for ages 4 to 10 and adults who enjoy charming illustration. Confident, graceful hand-inked black lines with subtle natural pen-weight variation (medium-bold outer contours with slightly lighter, crisp interior detail lines). Expressive, charming, balanced proportions with thoughtful storybook character details while keeping every region clean, open, and clearly traceable. All shapes use crisp closed black outlines with clean white breathing room between parallel lines—no cramped micro-details or muddy clusters. Pure solid black ink (#000000) on a pure solid flat white (#FFFFFF) background. Strictly no gray tones, no shading, no cross-hatching, no stippling, no sketchy double lines, no texture, no shadows, no background scene, no border, no text, no letters, no numbers, no watermark. Single centered subject, square 1:1 aspect ratio, generous pure white margin (at least 14% empty white space) on all four sides, nothing cropped.

**Color (verbatim image-edit prompt on approved line-art image):**
> Colorize this exact black-and-white ink illustration in a warm "Picture-book ink" storybook style. Preserve every single black ink outline, shape, detail, and placement identically without moving, adding, or removing any lines. Fill inside the existing black outlines with rich yet soft, harmonious flat picture-book colors (muted coral, teal, ochre, warm cream, sage, terracotta tones). Pure solid flat white (#FFFFFF) background outside the subject. Strictly flat solid color fills only: no gradients, no watercolor washes, no shading, no highlights, no paper texture, no shadows, no text, no watermark. Square 1:1 composition matching the source image exactly.

---

### S3 — Modern Geometric (premium kids' app branding)

**Line art (verbatim):**
> Minimalist "Modern geometric" vector-inspired tracing illustration designed for premium kids' app branding. Constructed deliberately from clean, bold rounded geometric primitives—circles, semicircles, capsules, rounded triangles, and smooth arcs—fitted together playfully with crisp symmetry and deliberate graphic simplicity. Clean, bold, uniform-weight rounded black outlines with generous geometric clarity and minimal interior detail. Every shape is a crisp, closed geometric outline with wide, unmistakable white gaps between lines. Pure solid black (#000000) lines on a pure solid flat white (#FFFFFF) background. Strictly no shading, no gray tones, no hatching, no hand-drawn wobble, no organic clutter, no texture, no shadows, no background elements, no border, no text, no letters, no numbers, no watermark. Single centered subject, square 1:1 aspect ratio, generous pure white margin (at least 14% empty white space) on all four sides, nothing cropped.

**Color (verbatim image-edit prompt on approved line-art image):**
> Colorize this exact black-and-white geometric line-art illustration in a "Modern geometric" premium kids' app style. Preserve every single black outline, geometric shape, and placement identically without moving, adding, or removing any lines. Fill inside the existing clean black outlines with crisp, cheerful, balanced flat modern-pastel-and-bold brand colors (soft coral, sky blue, sunny yellow, mint green, warm lilac, clean cream). Pure solid flat white (#FFFFFF) background outside the subject. Strictly flat solid vector-like fills only: no gradients, no shading, no shadows, no highlights, no texture, no noise, no text, no watermark. Square 1:1 composition matching the source image exactly.

---

## Subject Descriptions Used

1. **Happy Crab (`happy-crab`)**
   - Base subject across styles: forward-facing smiling crab with two raised pincer claws, two eyes on short eye stalks, and three clearly separated walking legs per side (six legs + two claws).
   - **S1 Easy (`s1-happy-crab-easy`):** ultra-simple toddler version — single smooth oval body, two big eyes sitting directly on the shell (no stalks), simple curved smile, two smooth mitten-like claws on short arms, and strictly four stubby rounded legs (two per side).
   - **S1 More detail (`s1-happy-crab-detail`):** same S1 Storybook soft character with eye stalks, jointed arms and six jointed legs, curved belly band, rounded upper shell spots, cheek ovals, open happy smile, and three floating bubbles.
2. **Sea Turtle (`island-turtle`):** top-down swimming sea turtle with rounded/faceted shell scutes, smiling head, two larger front flippers, two smaller back flippers, and tiny tail; flippers meet the outer shell rim cleanly with no overlapping lines crossing through the shell.
3. **Unicorn (`dream-unicorn`):** right-facing full side profile with single horn, pointed/rounded ears, friendly face, wavy/layered/scalloped mane, four cleanly separated legs with hooves, and curved tail.
4. **Rocket (`rocket-ship`):** vertical space rocket with rounded/vintage/geometric nose cone, circular center porthole window, two symmetric side fins, bottom thruster, and symmetrical flame below.
5. **Latte Stone (`latte-stone`):** straight-on Guam / CHamoru megalithic stone monument — explicitly prompted as **NOT** a coffee cup, flower pot, or birdbath and with **NO** cartoon face/eyes: tapered trapezoidal stone pillar (`haligi`) topped by a wide, rimless semicircular flat-topped capstone (`tasa`) resting on a simple ground line with grass (plus one five-petal plumeria flower in S2).
6. **Sleepy Cat (`sleepy-cat`):** cozy curled-up sleeping cat with ears, closed curved sleeping eyes, small nose, whiskers, tucked paws (S1/S2), and tail curled around the front; explicitly prompted for **no floating "Zzz" text**.

---

## Rejections & Regenerations

- **`s1-latte-stone-line` (v1 rejected → regenerated v2):** First generation added a protruding rectangular lip around the top of the `tasa` bowl and a flared collar at the top of the `haligi` pillar, making it resemble a birdbath or flowerpot rather than a CHamoru latte stone. Regenerated with explicit geometry ("ONLY TWO simple smooth stone shapes... NO rim lip, NO collar, smooth semicircle/D-shape flat-side-up"), which produced an accurate silhouette. A zoomed-out v2 variant was also discarded for shrinking the stone to ~30% of canvas height.
- **`s2-latte-stone-line` (v1 rejected → edited v2):** First generation had strong carved-stone contour lines, grass blades, and a five-petal plumeria, but added the same protruding rim lip along the top of the `tasa`. Fixed via targeted image-to-image edit removing the overhanging lip while keeping the `haligi`, grass, and plumeria intact.
- **Framing / margin notes:** The generator occasionally produced tighter side margins (~6–11% instead of 14%) on wide subjects like crabs and vertical subjects like rockets; none were cropped, and the `magick` + `potrace` pipeline normalizes every vectorized SVG to an exact 8% margin on `viewBox="0 0 1000 1000"`.

---

## Vectorization Pipeline

Every approved line-art PNG (`raw/*-line.png`) was converted to a normalized black-fill SVG (`vector/*-line.svg`) with exact 8% margins:

1. **Threshold & normalize bounds (`magick`):**
   ```bash
   magick <input.png> -colorspace Gray -resize 200% -threshold 58% \
     -trim +repage -resize 1680x1680 -threshold 50% \
     -background white -gravity center -extent 2000x2000 <out.pbm>
   ```
2. **Vectorize (`/opt/homebrew/bin/potrace`):**
   ```bash
   /opt/homebrew/bin/potrace <out.pbm> -s --turdsize 6 --alphamax 1.0 --opttolerance 0.2 -o <raw.svg>
   ```
3. **Normalize SVG coordinate space:** Rewrote root `<svg>` to `viewBox="0 0 1000 1000" width="1000" height="1000"` and group transform to `translate(0,1000) scale(0.05,-0.05)` with `fill="#000000" stroke="none"`.
4. **Verify round-trip raster (`rsvg-convert`):**
   ```bash
   rsvg-convert -w 1024 -h 1024 -b white <vector.svg> -o <check.png>
   ```
   All 20 vectorized SVGs were re-rendered and checked visually (including fine S2 details such as rocket rivets, unicorn mane strands, and plumeria petals) with no blobs or dropped lines.
