# TraceBuddy Mobile

Expo native app for TraceBuddy's camera-over-paper tracing workflow, including custom word tracing and on-screen practice with marker colors.

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

## Scope

This app uses Expo SDK modules that are included in its development and production builds:

- `expo-camera` for the live camera preview
- `expo-image-picker` for local image selection
- `expo-keep-awake` for tracing sessions
- `expo-print` and `expo-sharing` for user-initiated worksheet print/PDF export
- `react-native-svg` for built-in SVG templates, custom word guides, and finger/stylus practice strokes

Native AR anchoring and automatic paper tracking remain deferred. The parent setup coach, portrait/landscape presets, saved alignment, low-distraction child trace view, eight guided lessons, twelve Together activities, worksheet print/PDF sharing, resumable local lesson progress, dynamic word/name guides, private Previous Work, orphaned local-image cleanup, on-screen practice, stickers, and Photos export are implemented locally on the device.

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
eas submit -p ios --latest --profile production --wait
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
