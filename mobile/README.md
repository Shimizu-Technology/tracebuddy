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

Open `tracebuddy://dev/kit` in a development build to review the tokens and components. Release builds include the kit only when built with `EXPO_PUBLIC_DEV_KIT=1`; App Store builds should not set it. The app has no navigation link to this route. Every other incoming link returns to the index route, which opens the existing picker and drawing flows.

Use the native stack for sheets. The [example options](src/ui/Sheet.ts) set `presentation: 'formSheet'`, a single short detent, a native grabber, and an undimmed backdrop. Keep phone detents at or below 40%. Give sheet content room to scroll with large text, and move any guide or canvas that the user is adjusting above the sheet before opening it. The kit example supports downward dismissal and an accessible close button. [Expo Router modals](https://docs.expo.dev/router/advanced/modals/)

The canvas still uses `react-native-svg`. A CanvasKit 0.42.0 spike replayed the 1.2 fixture's SVG stroke paths in 1000 × 1000 document coordinates. It verified that ordered clearing on an isolated ink surface allows later ink to draw over the erased area, and that Skia accepts the saved crayon dash pattern. A React Native Skia implementation would still need on-device comparison for textured brushes, guide and sticker compositing, full-square photo export, and input latency. [Shopify's React Native Skia path examples](https://shopify.engineering/getting-started-with-react-native-skia)

## Scope

This app uses Expo SDK modules that are included in its development and production builds:

- `expo-camera` for the live camera preview
- a local `tracebuddy-ar` Expo module using ARKit and RealityKit for Paper Lock
- `expo-image-picker` for local image selection
- `expo-keep-awake` for tracing sessions
- `expo-print` and `expo-sharing` for user-initiated worksheet print/PDF export
- `react-native-svg` for built-in SVG templates, custom word guides, and finger/stylus practice strokes

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
