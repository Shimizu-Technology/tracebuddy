# TraceBuddy 2.0

The plan and design spec for the TraceBuddy 2.0 redesign. This is the source of truth for 2.0 work. A PR that builds or changes a 2.0 screen keeps that screen and this document in agreement. Legacy screens are out of scope until their 2.0 replacement lands (see Phases).

Status: approved direction, 24 November 2026. The review behind it is at https://claude.ai/artifact/BUhKdDJVfcb6VNKEYdMqum (private to Leon).

## Decisions

| Question | Decision |
|---|---|
| Platform | The iPhone/iPad app leads. Web comes second and gets 2.0 after native ships. |
| 1.3 | Not released. The App Store goes from 1.2 to 2.0. `main` already includes the 1.3 safety work, and 2.0 keeps it. |
| Art | A new picture set made by image generation, converted to vector outlines, and reviewed one by one. After the style test (PR #47), Leon chose **two styles**: every picture comes in **Simple** (Storybook soft, for little kids) and **Detailed** (picture-book ink with heavier, traceable lines, for older kids and adults). |
| Cuts | Use the "Cut, fold, or gate" table below. |
| Read-aloud | Yes. On-device speech (`expo-speech`), on by default in Learn and off by default elsewhere. Offline and private. |
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
3. **Keep the work visible.** Adjustment panels are short (40% of the screen at most on phones), swipe down to close, and leave the subject visible. Move the subject up when an adjustment panel needs room. The brush tray and shade fan are temporary pickers next to the tools. They keep the canvas framing fixed and close on an outside tap.
4. **Works without reading.** Every child-facing control is recognizable from its icon. Text labels help adults but never carry the meaning alone. When read-aloud is on, prompts have a speaker button.
5. **One main action per screen,** visibly larger and in the brand color. Everything else stays quiet.
6. **Grown-up actions behind a gate.** Deleting, clearing, settings, printing, and the handwriting setup in Grown-ups (letter style, guide lines, practice sheets) need a parent gate. Typing a quick name or word, using a photo, and tracing do not, so children and adults are never blocked from drawing.
7. **Feel native.** Native stack transitions, swipe back, native sheets with detents, spring motion, haptics on lock, unlock, undo, and done. Respect Reduce Motion and Dynamic Type.

## Visual system

- **Type:** Nunito (open source, rounded, very legible) for everything, from `@expo-google-fonts/nunito`. Display 800, titles 700, body 600, small 600. Scale: 34 / 28 / 22 / 17 / 15 / 13. Body never below 15. Supports Dynamic Type up to accessibility sizes without clipping.
- **Color:** ink `#172033`, background `#FFFDF8`, surface `#FFFFFF`, action coral `#FF7A5C` with ink text (never white text on coral), muted `#5B6475`, hairline `#ECE7DC`. Category tiles use soft pastels (peach `#FFE3D6`, sky `#DFF0FF`, lilac `#F3E5FF`, butter `#FFF2C2`, mint `#DDF5E6`, rose `#FFE0EC`). Color comes from the art and the one main action. All text pairs meet WCAG AA.
- **Shape:** tiles have a 24 radius, sheets 28, buttons are fully rounded. Resting surfaces have no borders. Use one soft shadow (`0 4 16 rgba(23,32,51,.08)`) for floating things only. No cards inside cards.
- **Targets:** child controls are at least 64 pt, adult controls at least 48 pt, and nothing interactive is under 44 pt.
- **Icons:** one rounded icon family (Phosphor, bold or fill weight; not duotone, which paints a tinted background shape) through a single `Icon` component. No emoji in the UI.
- **Motion:** Reanimated springs (damping about 18, stiffness about 180) for sheets and tiles, and 120–160 ms for press feedback (scale to 0.96). No entrance animations on frequent screens. One celebration moment on Done.
- **Tokens** live in one `theme` module. Components never use raw colors or sizes.

## Screens

### Home: "What do you want to draw?"

- Header: TraceBuddy wordmark, My drawings button (icon plus count badge), and a quiet Grown-ups button.
- **Who's drawing?** asked once on first launch with two big picture choices: **Little artist** (Home shows Simple pictures) and **Big artist** (Home shows Detailed pictures). The grid always shows one style so it stays consistent. The choice can be changed in Grown-ups.
- **Keep going** card when there's recent work: a big thumbnail and one play button that reopens the last drawing exactly where it was.
- **My photo** (pick from Photos) and **My words** (type a name or phrase, then preview Bubble or Practice letters) share one row. Both are ungated. Handwriting setup options live in Grown-ups.
- My words opens before drawing begins. It uses a taller detent so the input, both style choices, live preview, and main action have room on a phone.
- A horizontal **Favorites** shelf appears below that row when there are favorites in the current library. Long-press a picture tile to add or remove a favorite.
- A grid of picture groups, two columns on phones and three to four on iPad. Each tile has a large cover picture on its category pastel with the group name below. Only groups available at the current level appear.
- Opening a group shows its pictures in the same responsive grid. Picture tiles use **color art** on a pastel background with the name below. Animals and Holidays have named sections. Letters and numbers has ABC and 123 sections, with uppercase and lowercase pairs for A–Z. Pictures without a section go at the end under **More**.
- The **Learn to draw** shelf sits above the picture groups. **Play together** is planned below the groups.
- The search magnifier opens a field. A typed query shows matching pictures across the current library in place of the groups.

### Picture

Opens as a native sheet over Home or the current picture group.

- A large color preview, the name, and a **Simple / Detailed** switch. It starts on the household choice, or the style picked in My words, and only changes this picture. For letters and numbers, Simple uses rounded Fredoka Bubble outlines. Detailed uses Andika Practice outlines with top, middle and baseline guides.
- Two large illustrated choices: **On paper** (camera over paper) and **On the screen** (draw with a finger).
- The last choice is remembered. A returning user sees it highlighted and can tap straight through.
- Paper Lock ("Stick to paper") is **off in 2.0** until it passes the physical accuracy test (see "Paper Lock before enabling" below). When it is turned on (`EXPO_PUBLIC_PAPER_LOCK=1`), it is a manual option inside On paper's More menu on AR-capable iPhones and iPads, not a third mode and not automatic. Choosing it automatically will be revisited after that test.
- Choosing On paper closes the sheet and opens On paper full screen (Close returns to the screen the picture was picked from).

### On paper (camera trace)

- Full-screen camera. The guide is the only thing in the middle and starts sized to a sheet of paper: a dashed, page-shaped frame (Letter proportions) with the picture inside it, so lining the frame up with the real paper's edges is the whole setup.
- Gestures on the guide: one-finger drag, pinch to resize, twist to rotate, all at once. Each frame is one transform around the fingers' midpoint, so the picture stays under the fingers. Dragging a corner handle resizes and turns for one-handed use. Snap to 0°/90°/180°/270°: it settles within about 4° and lets go past about 7°, with one light haptic. The guide's center always stays on screen. VoiceOver gets Make bigger, Make smaller, Turn left and Turn right actions.
- **Fade slider** fixed on the right edge, always visible while unlocked, with a live preview. It is an adjustable control for VoiceOver.
- Bottom bar with three buttons: **Page** (flip portrait/landscape), **Lock** (the main action), and **Done**.
- Top: Close (✕) at left, More (•••) at right.
- **More** opens a small, undimmed native sheet (40% detent) on a phone held upright, and a bottom card with the same contents on iPad and on a phone held sideways (iOS floats form sheets mid-screen on iPad). Neither covers the guide: the camera and guide move together, live, so the whole frame stays between the top buttons and the panel while nudging or resizing. Both swipe down to close, and turning the device closes More (it opens again in the form that fits). While a finger is on the guide with More open, the guide is kept inside the visible area above it. It holds:
  - fine-tune nudge
  - light lines (for dark paper)
  - mirror
  - center the picture (keeps its size, turn and page)
  - stick to paper (Paper Lock), on AR-capable devices, only when Paper Lock is turned on (off in 2.0)
  - setup tips
  - print this picture (gated) — later, with the grown-up gate
- **Lock** works once the camera shows the paper. It hides all controls except a small lock badge, keeps the screen awake, hides the status bar, and blocks every way out (swipe back, back, and any navigation) until unlock. Child mode is armed in the Lock handler before the locked screen shows: from then on in-app navigation (any `router` call or link) is refused before it reaches the navigator, system links are ignored, and swipe back is off. If the camera stops while locked, the screen stays locked and shows nothing that leads away. If the device turns while locked, the guide hides with a "Turn the device back" note and returns, unchanged, when it turns back. Unlocking takes a 1.5-second hold on the badge, with a progress ring and a haptic. A tap only shows "Hold to unlock". With VoiceOver, activating the badge asks for confirmation instead. Lock and child mode are one concept.
- **Remember the setup:** position, size, turn, fade and page are saved automatically for each screen orientation in `tracebuddy.savedAlignment.v1`, right away when the screen closes, the app goes to the background or the device turns. Each save reads, merges and writes in one queued step. The top-level fields keep the 1.x format (and hold the latest setup); 2.0 adds `page` and `byOrientation`. A 1.x saved setup is converted from the 1.x overlay's size and position and used until 2.0 saves its own.
- **First time only:** three illustrated tips (steady stand, whole page in view, even light), each one picture and one short line, with a speaker button when read-aloud is on (later, with read-aloud). Swipeable and skippable. Not a checklist gate. The "seen" flag reuses `parentSetupSeen`. The camera permission explanation is one sentence before the system prompt.
- If permission is denied, show a clear Open Settings action and a "Draw on the screen instead" option. Draw takes On paper's place (Home, then Draw, as from the Picture sheet), with the same picture and its photo kept. If On paper was opened from Draw's More ("Trace on paper instead"), it goes back to that same Draw instead of opening a second one. Permission is checked again when the app comes back to the front.
- **Stick to paper** (Paper Lock) is **off in 2.0**: with `EXPO_PUBLIC_PAPER_LOCK` unset (the default, TB2 builds included) its More row, its route and the hand-off to it are not shown or reachable, and its address leads to On paper. When turned on, it is a manual choice in More, on AR-capable devices only, never chosen automatically. It opens as `/paper/stick/[id]` after the camera screen lets go of the camera. From Lock on, the guide's pose is fixed in meters on the paper, so turning the device can't move it, and every placement request has its own attempt number so a late answer to an older one is ignored. It has the same gestures (without corner handles, because the guide lives in the AR scene and has no on-screen frame), fade slider, bar and VoiceOver actions, plus an always-visible tracking status. Lock places the guide on the paper first and turns on child mode only when tracking says the guide is held; child mode ends by itself if tracking slips. Placing, child mode and Done are separate states, so Done, a reset, leaving the screen, tracking loss, or the paper not being found ("Couldn't find the paper. Try again.") cancels a pending lock and gives Lock back. It uses Surface Lock and Letter pages; Marker Lock and A4 stay in the 1.x Paper Lock screen for now.
- **Done:** a gentle well-done moment ("Great tracing!", confetti-lite, one success haptic, a still version under Reduce Motion), then Keep tracing or New picture. Snapping a photo of the paper drawing comes later: the photo is taken by the user, saved locally to My drawings, and only goes to Photos if they choose. Privacy copy gets updated to match.
- In the iOS Simulator (no camera) a table-and-paper stand-in replaces the camera so the screen and gestures can be tried.

### On the screen (draw)

- An edge-to-edge square document. The guide shows faintly under the ink, and its outlines are also drawn above the ink so coloring never hides them. This is today's "lines on top" behavior, now always on.
- One finger draws. Two fingers pan and zoom (zoom range 1–5×). No Draw/Move toggle.
- **Color rail:** 15 crayons, including White, Gray, and Skin (side rail on iPad and landscape, bottom strip on phone portrait). Tap a crayon to choose it. Tap the raised crayon again or hold any crayon to see five shades. The rail keeps the chosen shade and the drawing saves its exact color.
- **Tools:** four size dots (Fine, Round, Big, Huge), a button showing the current brush, a separate eraser, Undo, and **Done**. The brush button opens a tray with icons and stroke samples for Marker, Crayon, Watercolor, Pencil, and Fill. The tray and shade fan float next to the tools and keep the picture at its current size and position. Pick a tool, tap outside, or swipe down to close the tray. While erasing, tapping any crayon restores the last brush, even if its color was already selected.
- **Watercolor:** new strokes multiply with the ink underneath them. Marker covers earlier ink. Saved Paint strokes keep their original appearance. A saved Paint brush selection opens as Watercolor.
- **Fill:** tap a closed region or the background of a line-art picture. The guide defines the boundaries, including the outlines of generated Bubble and Practice letters. Faint handwriting rules and drawn ink leave the regions open. A tap on a guide line leaves the drawing unchanged. Each fill is one undoable shape, and the eraser works on fills too. Photos and older word guides that rely on SVG text show an unavailable Fill button with a hint.
- Fill caches up to six guide masks at 500 × 500 pixels. It extends one mask pixel under the outline, simplifies and rounds the contour, and saves it in the 1,000-unit document space. Guides over 500,000 characters are ineligible. The search and contour tracing stop at 150 ms or 24,000 corners. If they hit either limit, the drawing stays intact and the app suggests using a brush.
- Grown-up extras in More (•••): guide strength, stickers and shapes (dragged and pinched directly, not moved with arrow buttons), clear all (gated), save to Photos.
- Lessons run inside this screen. The step strip shows the picture, step number, instruction, and Listen. The controls below the canvas switch between watching and drawing.

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
  - who's drawing (Little artist / Big artist)
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

- **Learn:** a row of picture cards on Home and a “Learn to draw this” choice in the picture sheet when the selected level has a lesson. Each opens On the screen. Watch the pencil draw, then Trace or Copy with the same drawing canvas. The app saves progress and one drawing per lesson. Color it opens that drawing with the full guide and crayons.
- Learn reads each step aloud by default when its pencil starts drawing. The player remembers the sound setting and always offers Listen. With Reduce Motion enabled, Watch shows the full step and its start dots.
- **TODO:** Add lessons to On paper, including Stick to paper and camera trace. Decide which step controls remain available while the picture is locked.
- **Play together:** the best 4–6 activities as picture cards. Each opens its canvas with the invitation in the step strip and a "next turn" button that switches between two colors. No timers, scores, or winners.

## Cut, fold, or gate

| Today | 2.0 |
|---|---|
| Paper / Screen choice on Home and Pictures | Moved to the Picture sheet, and remembered |
| Three trace modes (Paper Lock, Camera, Screen) | Two choices. Paper Lock is off in 2.0; once it passes the accuracy test it returns as a manual "Stick to paper" option inside On paper |
| Opacity, Size, Rotate, Nudge button rows | Gestures plus the fade slider. Nudge moves into More |
| Save / Resume alignment | Automatic: remember the last setup per orientation |
| Parent setup checklist gate | Three skippable illustrated tips, first time only |
| Draw / Move toggle, zoom +/- buttons | Two-finger gestures |
| "Lines on top" toggle | Always on |
| Level dropdown and badges | Who's drawing? default plus a Simple / Detailed switch on the Picture sheet |
| Per-card Print / PDF / SVG / heart | Print in Grown-ups and More. Favorite by long-press. No SVG |
| Sticker arrow buttons | Direct drag, pinch, and twist |
| 12 Together activities | Best 4–6 |
| Words, photo upload, lessons, Together as separate destinations | My words and My photo tiles, plus Learn and Play rows on Home |
| Clear local work, Delete | Gated |
| Web paper detection (experimental) | Dropped from 2.0 web |

## Art

**Requirements for every picture:**
- two versions of every subject, each consistent within its style:
  - **Simple:** Storybook soft. Thick even rounded outlines, chubby shapes, few interior lines (ages 2–6).
  - **Detailed:** Picture-book ink with medium-bold lines. Interior lines at least about 60% of the outer contour and no closer than about 14 px at 1024 px, so they stay visible through paper.
- a clean line-art guide (closed outlines, safe margins, traceable detail)
- a color version for tiles and previews

Each version is stored as `shared/art/<simple|detailed>/<id>/line.svg` (the guide, normalized `viewBox="0 0 1000 1000"`, filled ink shapes) plus `color.webp` (512 px), listed in `shared/art/<level>/manifest.json`. New pictures get new IDs. Old drawing IDs keep their old art so saved drawings still line up with their guide.

Run `npm run art:optimize` after adding or replacing line art. It compresses the Potrace paths and regenerates the Metro asset index. Check new optimizer settings by rasterizing the original and optimized guides at 1024 × 1024. Home and the Picture sheet display the color WebP. Drawing and paper tracing read the SVG on demand, and saved drawings retain a snapshot of their guide.

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

**Style test:** done in PR #47 (six subjects, three styles). Simple and Detailed were chosen, and the latte stone design was approved.

**Lessons:** vectorized art is filled shapes, not ordered strokes, so lesson step-by-step reveal needs its own step images (generated cumulatively) or hand-built stroke guides for the simple shape lessons. Decide in phase 4.

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

0. **Plan, prototype, art test.** This document, a clickable prototype of the core loop for Leon to try on his phone, and the art style test. Done: Leon chose Simple + Detailed.
1. **Foundation.** Router shell, gesture, animation, and sheet libraries, the theme and base components, data and logic pulled out of `mobile/App.tsx` into tested modules, and the canvas spike. No visible behavior changes yet.
2. **Core loop.** Home, Picture, On paper, On the screen, Done, and My drawings, to this spec.
3. **Art.** The full set in Simple and Detailed (51 subjects, including the Guam set), color previews, and wiring the art manifests into the app.
4. **Everything else.** Learn in the canvas, Play together, My words, My photo with cleanup, Grown-ups and the gate, and read-aloud.
5. **Prove and ship.** Real iPhone and iPad testing over real paper (including the Paper Lock accuracy gate), a family playtest with a young child and an older adult, accessibility (VoiceOver, Dynamic Type, Reduce Motion), new App Store screenshots and name, and release 2.0.
6. **Web.** Bring 2.0 to the web. Preferred: the same code through Expo web, replacing `src/`, with camera tracing via `getUserMedia`.

### Paper Lock before enabling

Paper Lock ("Stick to paper") stays behind `EXPO_PUBLIC_PAPER_LOCK` until all of this passes on a real iPhone and iPad over real paper:

- [ ] **Placement attempts and the anchor.** `TraceBuddyARView.placeIfNeeded` keeps an anchor once placed, and unlocking doesn't clear it (re-locking after unlock reuses it on purpose). But an anchor placed by an attempt that JS then cancelled (timeout, Done, leaving the screen) is reported to the next attempt as already locked, under the new attempt number. Track the attempt that created the anchor, and when that attempt was cancelled, drop the anchor and require a fresh raycast. This needs a native prop or event for "attempt cancelled", so it was left for device testing.
- [ ] Accuracy: the placed guide stays on the paper's lines within the agreed tolerance while tracing, for Letter portrait and landscape.
- [ ] The frozen pose: turning the device, and rotations across ±180°, don't move a placed guide.
- [ ] Lock with no paper in view gives "Couldn't find the paper. Try again." and Lock works on the retry; a late native answer to an older attempt is ignored.
- [ ] Camera → AR hand-off from On paper (the camera screen lets go first), and back to a working camera.
- [ ] A photo picture with Stick to paper, and the photo file cleaned up afterwards only when unused.
- [ ] Child mode in Stick to paper: tracking loss ends it, VoiceOver focus and announcements, unlock hold.
- [ ] Haptics on lock and snap.

## Acceptance for 2.0

- A pre-reader can pick a picture, draw on the screen, finish, and find the drawing again without help or reading.
- An older adult can set up paper tracing (picture, On paper, position, fade, lock) in under a minute on their first try, without reading instructions.
- Adjustment panels leave the subject visible and close with a swipe down. The brush tray and shade fan keep the canvas framing fixed while open.
- Every saved drawing from 1.2 and 1.3 opens in 2.0.
- iPhone (small and large) and iPad, portrait and landscape, at default and large text sizes.
