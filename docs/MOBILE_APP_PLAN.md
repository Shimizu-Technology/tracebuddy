# TraceBuddy Expo mobile app plan

TraceBuddy is already usable as a mobile-first PWA, but tracing is a physical activity where the phone is mounted above paper and the camera view must stay stable for a long session. A native Expo app is the next practical step before deeper AR work.

## Why build the native mobile app now?

- **Primary use is mobile.** The real workflow is phone/tablet camera over paper, not desktop.
- **Native camera lifecycle is more predictable.** Expo gives us a first-class camera preview, permission prompts, and screen-awake behavior instead of relying on browser differences.
- **Expo Go is enough for the next proof.** The first native milestone can use Expo Go-supported modules only: camera, image picker, SVG rendering, keep awake, and React Native controls.
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

The most realistic React Native AR path is ViroReact via `@reactvision/react-viro`. It is actively maintained and supports ARKit on iOS, ARCore on Android, plane detection, anchors, and image-marker tracking.

Important limitation: ViroReact explicitly does **not** work in Expo Go. It requires an Expo development client or prebuild.

Best AR direction for TraceBuddy:

1. Prove the native non-AR tracing workflow first.
2. Move to an Expo development build.
3. Start with a printable TraceBuddy marker/page target with a known physical width.
4. Anchor selected line art to that marker or paper target.
5. Measure drift, setup friction, battery, device compatibility, and child/parent usability.

Plain-paper AR should remain a later experiment. A marker-based approach is more likely to be stable than asking ARKit/ARCore to infer a blank sheet of paper.

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

## Deferred from the Expo Go MVP

- Browser uploaded-image cleanup parity.
- Browser paper rectangle detection/tracking parity.
- ARKit/ARCore AR tracking.
- Printable marker generation.
- App-store distribution and TestFlight.
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
  - grant camera permission
  - drag/nudge/resize/rotate/change opacity
  - lock/unlock overlay
  - select a local image from photo library
