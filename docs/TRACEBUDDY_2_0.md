# TraceBuddy 2.0

The plan and design spec for the TraceBuddy 2.0 redesign. This is the source of truth for 2.0 work. A PR that builds or changes a 2.0 screen keeps that screen and this document in agreement. Legacy screens are out of scope until their 2.0 replacement lands (see Phases).

Status: approved direction, 24 November 2026. The review behind it is at https://claude.ai/artifact/BUhKdDJVfcb6VNKEYdMqum (private to Leon).

## Decisions

| Question | Decision |
|---|---|
| Platform | The iPhone/iPad app leads. Web comes second and gets 2.0 after native ships. |
| 1.3 | Not released. The App Store goes from 1.2 to 2.0. `main` already includes the 1.3 safety work, and 2.0 keeps it. |
| Art | A new picture set in one style, made by image generation, converted to vector outlines, and reviewed one by one. We start with a style test, and Leon picks the style. |
| Cuts | Use the "Cut, fold, or gate" table below. |
| Read-aloud | Yes. On-device speech (`expo-speech`), off by default and switched on in Grown-ups. Offline and private. |
| Audience | From toddlers who can hold a phone through to adults. A child who can't read must be able to draw. An adult should get a serious tracing tool without hunting for it. |
| Store name | Rename. Pick at release from: **TraceBuddy: Trace & Draw** (preferred), TraceBuddy – Trace and Color, TraceBuddy Tracing. Check availability in App Store Connect. |

## Who it's for

- **A young child (2–8)** who can't read. Picks a picture by how it looks, draws, finishes, and finds it again tomorrow. Must never get stuck or delete the family's work.
- **A parent or grandparent** who isn't comfortable with tech. Sets up paper tracing in under a minute without reading instructions or knowing words like opacity or overlay.
- **An older kid or adult** tracing their own photo or art onto paper. Wants direct, precise control and nothing childish in the way.

## Design rules

Every 2.0 screen follows these. A PR that breaks one needs a written reason.

1. **Pictures first.** The first screen shows things to draw. Mode choices come after a picture is picked.
2. **Touch the picture, not buttons about it.** Drag moves, pinch resizes, twist rotates. Fade is one slider that stays on screen. Arrow-button nudges and +/- steppers are only fine-tuning extras.
3. **Never cover the work.** A panel never hides the guide or canvas the user is adjusting. Panels are short (40% of the screen at most on phones), swipe down to close, and leave the subject visible. If something needs more room, the subject moves up, not under.
4. **Works without reading.** Every child-facing control is recognizable from its icon. Text labels help adults but never carry the meaning alone. When read-aloud is on, prompts have a speaker button.
5. **One main action per screen,** visibly larger and in the brand color. Everything else stays quiet.
6. **Grown-up actions behind a gate.** Deleting, clearing, settings, printing, and the handwriting setup in Grown-ups (letter style, guide lines, practice sheets) need a parent gate. Typing a quick name or word, using a photo, and tracing do not, so children and adults are never blocked from drawing.
7. **Feel native.** Native stack transitions, swipe back, native sheets with detents, spring motion, haptics on lock, unlock, undo, and done. Respect Reduce Motion and Dynamic Type.

## Visual system

- **Type:** Nunito (open source, rounded, very legible) for everything, from `@expo-google-fonts/nunito`. Display 800, titles 700, body 600, small 600. Scale: 34 / 28 / 22 / 17 / 15 / 13. Body never below 15. Supports Dynamic Type up to accessibility sizes without clipping.
- **Color:** ink `#172033`, background `#FFFDF8`, surface `#FFFFFF`, action coral `#FF7A5C` with ink text (never white text on coral), muted `#5B6475`, hairline `#ECE7DC`. Category tiles use soft pastels (peach `#FFE3D6`, sky `#DFF0FF`, lilac `#F3E5FF`, butter `#FFF2C2`, mint `#DDF5E6`, rose `#FFE0EC`). Color comes from the art and the one main action. All text pairs meet WCAG AA.
- **Shape:** tiles have a 24 radius, sheets 28, buttons are fully rounded. Resting surfaces have no borders. Use one soft shadow (`0 4 16 rgba(23,32,51,.08)`) for floating things only. No cards inside cards.
- **Targets:** child controls are at least 64 pt, adult controls at least 48 pt, and nothing interactive is under 44 pt.
- **Icons:** one rounded icon family (Phosphor, duotone or fill weight) through a single `Icon` component. No emoji in the UI.
- **Motion:** Reanimated springs (damping about 18, stiffness about 180) for sheets and tiles, and 120–160 ms for press feedback (scale to 0.96). No entrance animations on frequent screens. One celebration moment on Done.
- **Tokens** live in one `theme` module. Components never use raw colors or sizes.

## Screens

### Home: "What do you want to draw?"

- Header: TraceBuddy wordmark, My drawings button (icon plus count badge), and a quiet Grown-ups button.
- **Keep going** card when there's recent work: a big thumbnail and one play button that reopens the last drawing exactly where it was.
- Category chips in one swipeable row, each with an icon: All, Animals, Ocean, Magic, Things that go, Guam, Letters and numbers, Shapes.
- A grid of picture tiles, two columns on phones and three to four on iPad. Each tile is the **color art** on a pastel background with the name under it. No per-tile Print, PDF, SVG, level, or "On paper" labels.
- Special tiles at the start of the grid: **My photo** (pick from Photos) and **My name** (type a name or word in a keyboard sheet). Both are ungated. Handwriting setup options live in Grown-ups.
- Rows below the grid: **Learn to draw** (lessons) and **Play together** (best 4–6 activities).
- Search is a magnifier in the header, mostly for adults.
- Favorites: long-press a tile to favorite it. A Favorites chip appears once there's at least one.

### Picture

Opens as a native sheet over Home.

- A large color preview, the name, and an **Easy / More detail** switch when both versions exist.
- Two large illustrated choices: **On paper** (camera over paper) and **On the screen** (draw with a finger).
- The last choice is remembered. A returning user sees it highlighted and can tap straight through.
- On AR-capable iPhones and iPads, On paper uses Paper Lock automatically when it's ready, with plain camera tracing as the fallback. There's no third mode to explain.

### On paper (camera trace)

- Full-screen camera. The guide is the only thing in the middle and starts sized to a sheet of paper.
- Gestures on the guide: one-finger drag, pinch to resize, twist to rotate. Snap to 0°/90° near those angles, with a light haptic.
- **Fade slider** fixed on the right edge, always visible, with a live preview.
- Bottom bar with three buttons: **Page** (flip portrait/landscape), **Lock** (the main action), and **Done**.
- Top: Close (✕) at left, More (•••) at right.
- **More** opens a small, undimmed native sheet that never covers the guide (the guide moves up while it's open) and swipes down to close. It holds:
  - fine-tune nudge
  - line color (dark or light, for dark paper)
  - mirror
  - stick to paper (Paper Lock) status
  - setup tips
  - print this picture (gated)
- **Lock** hides all controls except a small lock badge, keeps the screen awake, and turns on child mode. Unlocking takes a 1.5-second hold on the badge, with a progress ring. Lock and child mode are one concept.
- **First time only:** three illustrated tips (steady stand, whole page in view, even light), each one picture and one short line, with a speaker button when read-aloud is on. Swipeable and skippable. Not a checklist gate. The camera permission explanation is one sentence before the system prompt.
- If permission is denied, show a clear Open Settings action and a "Draw on the screen instead" option.
- **Done:** a gentle well-done moment, with an option to snap a photo of the paper drawing. The photo is taken by the user, saved locally to My drawings, and only goes to Photos if they choose. Privacy copy gets updated to match.

### On the screen (draw)

- An edge-to-edge square document. The guide shows faintly under the ink, and its outlines are also drawn above the ink so coloring never hides them. This is today's "lines on top" behavior, now always on.
- One finger draws. Two fingers pan and zoom (zoom range 1–5×). No Draw/Move toggle.
- **Color rail:** a crayon box of 12 colors always on screen (side rail on iPad and landscape, bottom strip on phone portrait). The current color shows as a raised crayon.
- **Tools:** three size dots, the brush style (crayon, marker, paint, pencil) as a single button that cycles or opens a small sheet, an eraser, Undo (large), and **Done** (main action). Picking a color while erasing switches back to the last brush.
- Grown-up extras in More (•••): guide strength, stickers and shapes (dragged and pinched directly, not moved with arrow buttons), clear all (gated), save to Photos.
- Lessons run inside this screen. A small step strip at the top holds the step picture, Back, Next, and Listen. You never leave the canvas.

### Done (keepsake)

- A short celebration: a confetti-lite burst or stamp drop, with a single success haptic. Reduce Motion gets a still version.
- The finished picture shown big, with optional stamps (star, heart, sun, flower, smile).
- Buttons: **Save to Photos**, **Keep drawing**, **New picture**. The work is already saved automatically before this opens.

### My drawings

- A big-thumbnail grid, newest first. Tap to keep drawing.
- Long-press opens a gated menu: Copy, Start fresh, Save to Photos, Delete.
- The empty state shows a friendly picture and a button to pick a picture.

### Grown-ups (gated)

- **Gate:** press and hold a button for two seconds, or answer a simple number question. It's accessible with VoiceOver.
- Contents:
  - read-aloud on/off
  - sounds and haptics
  - words and names (handwriting) setup
  - print worksheets
  - photo cleanup defaults
  - setup tips
  - help
  - privacy
  - clear all data (double confirm)
  - about/version

### Learn and Play together

- **Learn:** the 8 lessons as a row of picture cards. Each opens On the screen with the step strip.
- **Play together:** the best 4–6 activities as picture cards. Each opens its canvas with the invitation in the step strip and a "next turn" button that switches between two colors. No timers, scores, or winners.

## Cut, fold, or gate

| Today | 2.0 |
|---|---|
| Paper / Screen choice on Home and Pictures | Moved to the Picture sheet, and remembered |
| Three trace modes (Paper Lock, Camera, Screen) | Two choices. Paper Lock is an automatic upgrade inside On paper |
| Opacity, Size, Rotate, Nudge button rows | Gestures plus the fade slider. Nudge moves into More |
| Save / Resume alignment | Automatic: remember the last setup per orientation |
| Parent setup checklist gate | Three skippable illustrated tips, first time only |
| Draw / Move toggle, zoom +/- buttons | Two-finger gestures |
| "Lines on top" toggle | Always on |
| Level dropdown and badges | Easy / More detail switch on the Picture sheet |
| Per-card Print / PDF / SVG / heart | Print in Grown-ups and More. Favorite by long-press. No SVG |
| Sticker arrow buttons | Direct drag, pinch, and twist |
| 12 Together activities | Best 4–6 |
| Words, photo upload, lessons, Together as separate destinations | My name and My photo tiles, plus Learn and Play rows on Home |
| Clear local work, Delete | Gated |
| Web paper detection (experimental) | Dropped from 2.0 web |

## Art

**Requirements for every picture:**
- one consistent illustration style
- a clean line-art guide (closed outlines, even rounded strokes, safe margins, traceable detail)
- a color version for tiles and previews
- Easy and More detail versions for most subjects

Each picture is stored as `line.svg` (the guide, normalized `viewBox="0 0 1000 1000"`) plus `color.webp` (or `color.svg`) and metadata in `shared/`.

**Pipeline:**
1. Lock a style guide with a reference sheet.
2. Generate line art and color.
3. Vectorize the line art (potrace or vtracer).
4. Normalize stroke weight and margins.
5. Run the automatic checks (closed shapes, margins, minimum gap between lines, stroke weight).
6. Render a contact sheet.
7. Review each picture one by one.
8. Leon approves.

**Starting set:** 40–60 subjects. Keep the subjects families use (animals, ocean, magic, vehicles, nature, letters and numbers, shapes). The Guam set is the signature: carabao, ko'ko' bird, latte stone, proa, coconut crab, bougainvillea, and the island outline. Check culturally specific subjects with Leon before release. Old drawing IDs stay resolvable so saved work still opens.

**Style test (do this first):** six subjects (crab, sea turtle, unicorn, rocket, latte stone, cat) in three candidate styles, next to today's versions.

## Architecture

- **Navigation:** `expo-router` with a native stack (swipe back) and native sheets (`presentation: 'formSheet'` with detents) where they fit. Deep links stay on the `tracebuddy://` scheme.
- **Gestures and motion:** `react-native-gesture-handler` and `react-native-reanimated`.
- **Canvas:** evaluate `@shopify/react-native-skia` for drawing (smooth ink, textured crayon and paint) against the current `react-native-svg` renderer in the foundation spike. Either way, it must read and write the existing saved-stroke format.
- **Speech:** `expo-speech`. **Images:** `expo-image`. **Fonts:** `expo-font` with Nunito.
- **Structure:**
  - `mobile/app/` holds routes.
  - `mobile/src/features/<feature>/` holds screens and feature logic.
  - `mobile/src/ui/` holds the theme and shared components (Button, IconButton, Tile, Sheet, Icon, Text).
  - `mobile/src/data/` holds storage and models.
  - No file over about 600 lines.
- **Data compatibility (hard requirement):** every existing AsyncStorage key and format keeps working (`tracebuddy.previousWork.v1.*`, `tracebuddy.practice.v1.*`, `drawingPreferences`, `learningProgress`, `parentSetupSeen`, `resumeContext`, `familyActivity`, `savedAlignment`, the mode preference). A 1.2 user who updates to 2.0 keeps every drawing. Migrations are versioned, tested, and never destructive.
- **Keep the safety work from #37–#43:**
  - ink and guide in one document coordinate system
  - single-pointer ownership
  - save-before-leave
  - operation generations so clear can't be undone by late saves
  - Photos permission recovery
  - full-square capture
  - Paper Lock tracking honesty
- The Paper Lock native module (`mobile/modules/tracebuddy-ar`) is reused as is.

## Phases

Each phase ships as one or more reviewed PRs into `main` through the normal Shimizu PR workflow. `main` must keep building and launching after every merge. While 2.0 is in progress, the old screens stay reachable until their replacements land.

0. **Plan, prototype, art test.** This document, a clickable prototype of the core loop for Leon to try on his phone, and the art style test. Gate: Leon approves the look and picks a style.
1. **Foundation.** Router shell, gesture, animation, and sheet libraries, the theme and base components, data and logic pulled out of `mobile/App.tsx` into tested modules, and the canvas spike. No visible behavior changes yet.
2. **Core loop.** Home, Picture, On paper, On the screen, Done, and My drawings, to this spec.
3. **Art.** The full set, color previews, Easy/More detail, and the Guam set.
4. **Everything else.** Learn in the canvas, Play together, My name, My photo with cleanup, Grown-ups and the gate, and read-aloud.
5. **Prove and ship.** Real iPhone and iPad testing over real paper (including the Paper Lock accuracy gate), a family playtest with a young child and an older adult, accessibility (VoiceOver, Dynamic Type, Reduce Motion), new App Store screenshots and name, and release 2.0.
6. **Web.** Bring 2.0 to the web. Preferred: the same code through Expo web, replacing `src/`, with camera tracing via `getUserMedia`.

## Acceptance for 2.0

- A pre-reader can pick a picture, draw on the screen, finish, and find the drawing again without help or reading.
- An older adult can set up paper tracing (picture, On paper, position, fade, lock) in under a minute on their first try, without reading instructions.
- No panel ever hides the guide or canvas being adjusted, and every panel closes with a swipe down.
- Every saved drawing from 1.2 and 1.3 opens in 2.0.
- iPhone (small and large) and iPad, portrait and landscape, at default and large text sizes.
