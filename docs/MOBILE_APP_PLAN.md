# TraceBuddy Expo mobile app plan

TraceBuddy is already usable as a mobile-first PWA, but tracing is a physical activity where the phone is mounted above paper and the camera view must stay stable for a long session. A native Expo app is the next practical step before deeper AR work.

## Why build the native mobile app now?

- **Primary use is mobile.** The real workflow is phone/tablet camera over paper, with an on-screen practice fallback when a stand or paper setup is not available.
- **Native camera lifecycle is more predictable.** Expo gives us a first-class camera preview, permission prompts, and screen-awake behavior instead of relying on browser differences.
- **Expo Go was enough for the first proof.** The first native milestone used Expo-supported modules only: camera, image picker, SVG rendering, keep awake, and React Native controls.
- **It keeps the product local-first.** The mobile MVP should still have no accounts, backend, uploads, analytics, or remote image processing.
- **It gives us a clean bridge to AR.** Once the native tracing loop feels good, we can move from Expo Go to an Expo development build for AR experiments.

## Research notes

### Expo Go vs development builds

Expo documentation positions Expo Go as a fast playground with a fixed set of bundled native modules. That is ideal for a focused MVP, but it is not the right runtime for production-only native changes or custom native libraries.

For TraceBuddy, Expo Go is appropriate for:

- native camera preview through `expo-camera`
- local image selection through `expo-image-picker`
- screen-awake behavior through `expo-keep-awake`
- SVG drawing overlays through `react-native-svg`
- touch controls, bottom sheets, and local-only state

Expo Go is not appropriate for:

- custom native AR modules
- ViroReact AR
- app-store parity checks around icons, splash screens, and native config
- custom native image/frame processing beyond what Expo Go bundles

### AR research

The preferred AR path is now a focused iOS ARKit mode implemented with a small custom native view/module. The goal is paper anchoring, not novelty 3D effects.

Important limitation: ARKit is not available in Expo Go. It requires EAS/TestFlight builds with native iOS code.

Best AR direction for TraceBuddy:

1. Submit and validate the non-AR App Store MVP first.
2. Add an experimental iOS-only AR Trace entry point.
3. Start with a printable TraceBuddy marker/reference image with a known physical width.
4. Use ARKit image anchoring to place selected line art relative to that marker or worksheet.
5. Measure drift, setup friction, battery, device compatibility, and child/parent usability.

Plain-paper AR should remain a later experiment. A marker-based ARKit approach is more likely to be stable than asking ARKit to infer a blank sheet of paper.

## Patterns from other Shimizu Expo apps

### Håfa Recipes (`recipe-extractor/recipe-mobile`)

- Uses Expo + TypeScript with a clear `app.json` permissions story.
- Uses `expo-image-picker` for camera/library flows with explicit permission checks.
- Uses `expo-keep-awake` in cook mode for a long-running hands-free session.
- Uses bottom-sheet-style modals and safe-area-aware controls.
- Good pattern to reuse: explicit runtime permission handling and keeping long sessions awake.

### Håfa Homes (`hafa-homes/mobile`)

- Uses a simple `index.ts` + `App.tsx` entrypoint instead of Expo Router.
- Keeps the mobile shell straightforward for a focused app experience.
- Uses `app.json` for app identity, bundle/package identifiers, and native config.
- Good pattern to reuse: a simple app shell for MVP speed when routing is unnecessary.

## Expo Go MVP scope

The first mobile app should be intentionally small and reliable:

- Native Expo app under `mobile/`.
- Reuse the shared built-in drawing library.
- Two-column template picker with category filters.
- Upload/select a local image from the device photo library.
- Native camera trace mode.
- On-screen coloring/practice mode for finger/stylus tracing over the selected guide.
- Custom word/name/phrase tracing using the same local guide pipeline.
- Expanded color palette plus pencil/marker/crayon/paint brush styles and eraser support.
- Locked-by-default practice canvas with optional pan/zoom for detailed coloring.
- Lines-on-top option so tracing outlines remain visible while coloring.
- Local autosave for practice/coloring sessions on the device.
- Clear-all confirmation before deleting a child's work.
- Manual overlay controls:
  - move by dragging when unlocked
  - nudge controls
  - size controls
  - rotation controls
  - opacity controls
  - lock/unlock
  - reset
- Floating bottom-sheet controls for mobile tracing.
- Keep the screen awake during trace mode.
- Local-only privacy model.

## Next mobile practice improvement: Previous Work

A local Previous Work section should be the next larger practice-mode improvement after the current coloring tools land.

- Keep saves device-local with `AsyncStorage` and no backend.
- Move beyond one autosave slot per template by storing multiple named sessions.
- Add thumbnails/previews so a child can recognize prior work visually.
- Provide actions for Resume/Edit, Duplicate, Start fresh, and Delete.
- Preserve the original template as a clean starting point even when previous work exists.
- For uploaded images, copy the selected image into app-local storage before saving long-lived sessions.
- Mirror the concept on web with `localStorage`/IndexedDB if the PWA needs the same gallery.

## Deferred from the Expo Go MVP

- Browser uploaded-image cleanup parity.
- Browser paper rectangle detection/tracking parity.
- ARKit/ARCore AR tracking.
- Printable marker generation.
- Accounts, backend sync, cloud storage, analytics, or remote image processing.

## Implementation notes

- Keep shared drawing metadata in one shared module so web and mobile use the same template library.
- Avoid custom native modules while targeting Expo Go.
- Keep controls large enough for one-handed setup while the phone is mounted.
- Preserve the PWA as the production-ready path until the native app is real-device tested.
- Document AR as the next research milestone after the native MVP, not as part of the Expo Go MVP.

## Validation plan

- Root web checks must continue to pass:
  - `npm run lint`
  - `npm run build`
  - `npm audit --audit-level=moderate`
- Mobile checks:
  - `npm --prefix mobile run typecheck`
  - `npm --prefix mobile run doctor`
- Manual Expo Go smoke test on a real phone:
  - open picker
  - filter categories
  - select built-in drawing
  - try on-screen practice with finger or stylus
  - grant camera permission
  - drag/nudge/resize/rotate/change opacity
  - lock/unlock overlay
  - select a local image from photo library
