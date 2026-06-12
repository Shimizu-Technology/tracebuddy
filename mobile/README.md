# TraceBuddy Mobile

Expo Go MVP for TraceBuddy's native mobile tracing workflow.

## Run locally

```bash
cd mobile
npm install
npm run start
```

Scan the Expo QR code with Expo Go on a real phone. Camera tracing should be tested on a physical device, not only a simulator.

If the phone camera or iOS Code Scanner says "No usable data found," open the Expo Go app directly and use Expo Go's scanner. You can also type the Metro URL shown in the terminal, such as `exp://192.168.x.x:8081`, into Expo Go manually.

If Expo Go opens but cannot connect, make sure the phone and laptop are on the same Wi-Fi network. If local network discovery is flaky, run:

```bash
npm run start -- --tunnel
```

Then scan the new tunnel QR code from Expo Go.

## Scope

This app intentionally uses Expo Go-supported modules only:

- `expo-camera` for the live camera preview
- `expo-image-picker` for local image selection
- `expo-keep-awake` for tracing sessions
- `react-native-svg` for built-in SVG templates

AR, paper tracking, and uploaded-image cleanup are deferred until after the native tracing loop is validated.

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
