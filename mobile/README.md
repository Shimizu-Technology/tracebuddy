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
