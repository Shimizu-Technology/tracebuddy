# TraceBuddy Mobile

Expo Go MVP for TraceBuddy's native mobile tracing workflow.

## Run locally

```bash
cd mobile
npm install
npm run start
```

Scan the Expo QR code with Expo Go on a real phone. Camera tracing should be tested on a physical device, not only a simulator.

## Scope

This app intentionally uses Expo Go-supported modules only:

- `expo-camera` for the live camera preview
- `expo-image-picker` for local image selection
- `expo-keep-awake` for tracing sessions
- `react-native-svg` for built-in SVG templates

AR, paper tracking, and uploaded-image cleanup are deferred until after the native tracing loop is validated.
