# TraceBuddy Mobile

Expo native app for TraceBuddy's RealityKit Paper Lock, camera-over-paper tracing, custom word tracing, and on-screen practice workflows.

## Run locally

```bash
cd mobile
npm install
eas build --platform ios --profile development
```

Install the resulting development build on a registered device. Camera tracing should be tested on a physical device, not only a simulator. The public App Store version of Expo Go supports the latest Expo SDK, not this app's pinned Expo SDK 56 runtime.

After installing the development build, start Metro with:

```bash
npm run start
```

Open the TraceBuddy development build and connect to the project it discovers. If it cannot connect, make sure the phone and laptop are on the same Wi-Fi network. If local network discovery is flaky, run:

```bash
npm run start -- --tunnel
```

Then open the tunnel URL from the installed development build.

## Simulator release smoke

After installing the development build in a simulator and starting Metro, run the checked-in Maestro flow with that simulator's UDID:

```bash
MAESTRO_DRIVER_STARTUP_TIMEOUT=180000 maestro --device <SIMULATOR_UDID> test .maestro/release-smoke.yaml
```

The flow covers the picture picker, a Together activity, on-screen practice, the Photos export control, and guided lessons. Open and cancel one worksheet print sheet manually as well; Apple's print UI is outside the app process and is intentionally kept out of the reusable flow.

## 2.0 foundation

Open `tracebuddy://dev/kit` in a development build to review the tokens and components. Release builds include the kit only when built with `EXPO_PUBLIC_DEV_KIT=1`; App Store builds should not set it. The app has no navigation link to this route. Every other incoming link returns to the index route.

Use the native stack for sheets. The [example options](src/ui/Sheet.ts) set `presentation: 'formSheet'`, a single short detent, a native grabber, and an undimmed backdrop. Keep phone adjustment sheets at or below 40%. Give sheet content room to scroll with large text, and move any guide or canvas that the user is adjusting above the sheet before opening it. The kit example supports downward dismissal and an accessible close button. [Expo Router modals](https://docs.expo.dev/router/advanced/modals/)

Set `EXPO_PUBLIC_TB2=1` when bundling the app to open the 2.0 draw loop. Both builds read and write the same Previous Work v2 records. The existing app remains the default.

Run `npm run art:generate` from the repo root after changing a level manifest or its art. The generator indexes WebP files as Metro assets and keeps SVG XML in per-picture accessors. A line-art preview parses only its own SVG, and a saved session can store the exact guide alongside its ink. The check command rejects a stale index. With no manifests, both artist choices show the legacy line-art catalog.

The 2.0 canvas uses React Native Skia for ink and React Native SVG for vector guides. Skia replays the saved paths in a transparent layer using destination-out for erasing. Guides and existing stickers sit outside that layer. Photos export renders the same ink into a fresh, unzoomed document before capture.

The standalone `bench/RendererSpike.tsx` entry compares Skia with the legacy SVG mask approach. On the 11-inch iPad Air M4 simulator running iOS 26.5, the Release bundle replayed 243 saved paths, including 13 erasers, while changing an active eraser for 180 measured samples.

| Measurement | Skia p50 / p95 | SVG p50 / p95 |
| --- | --- | --- |
| UI frame interval | 16.67 / 16.67 ms | 83.18 / 326.29 ms |
| Path update to next UI frame | 16.67 / 16.93 ms | 83.33 / 321.60 ms |
| Frame intervals over 25 ms | 0 / 180 | 180 / 180 |

The path-update metric estimates latency from a synthetic update to the next UI frame. Both screenshots showed the guide through the erased ink and the later stroke over the cleared area. With 49 erasers, Skia still had a 16.67 ms p95 frame interval and the SVG trial exceeded the 45-second observation window.

To reproduce, build a Release simulator app and copy its `.app` directory. From `mobile/`, write the benchmark bundle to the copy's `main.jsbundle` and install the copy on a simulator you own.

```sh
npx expo export:embed --entry-file bench/RendererSpike.tsx --platform ios --dev false --bytecode --bundle-output /path/to/copied/TraceBuddy.app/main.jsbundle
```

## Scope

This app uses Expo SDK modules that are included in its development and production builds:

- `expo-camera` for the live camera preview
- a local `tracebuddy-ar` Expo module using ARKit and RealityKit for Paper Lock
- `expo-image-picker` for local image selection
- `expo-keep-awake` for tracing sessions
- `expo-print` and `expo-sharing` for user-initiated worksheet print/PDF export
- `react-native-svg` for built-in SVG templates, custom word guides, and legacy practice strokes
- `@shopify/react-native-skia` for 2.0 drawing and erasing

Paper Lock is implemented on iOS with markerless horizontal-surface placement and an optional printable 50 mm reference marker. It supports Letter/A4 sizing, opacity, scale, rotation, precise nudges, lock/relock, tracking recovery, a low-distraction child mode, and one-tap Camera Trace fallback. The iOS Simulator proves compilation and UI fallback only; spatial accuracy must be tested on physical hardware.

## TestFlight / EAS build

This app is configured for EAS Build with `eas.json` and linked to the Shimizu Technology EAS project in `app.json`:

```text
@shimizutechnology/tracebuddy-mobile
projectId: 32bf20c8-1faf-4333-966a-f046461e7f48
ASC App ID: 6779658138
```

Build iOS for TestFlight:

```bash
cd mobile
eas build -p ios --profile production
```

After the build finishes, submit to App Store Connect. The production submit profile is pinned to ASC App ID `6779658138`, so EAS will use the existing TraceBuddy App Store Connect record instead of trying to create a new app:

```bash
eas submit -p ios --id <exact-build-id> --profile production --wait
```

If `npx eas ...` fails with a `libsimdjson` / Homebrew `node` dynamic library error, the local Homebrew Node install is broken. Fix it with:

```bash
brew reinstall node
rehash
```

Then prefer one of these commands:

```bash
eas build -p ios --profile production
# or
npx eas-cli build -p ios --profile production
```
