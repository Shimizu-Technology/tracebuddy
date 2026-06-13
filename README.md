# TraceBuddy

Kid-friendly camera overlay tracing helper built as a mobile-first React/Vite PWA with an Expo Go native mobile MVP.

## Why we built it

TraceBuddy came from a simple family use case: build a tracing app with a phone camera so Stassie can trace and draw whatever she wants.

The MVP tests whether a fixed phone/iPad plus camera overlay is good enough before considering heavier native AR work. The Expo app now lets us compare the same idea against a native camera experience in Expo Go.

## What it does

TraceBuddy lets a child or parent:

1. Pick a simple line-art drawing.
2. Open trace mode.
3. Choose camera tracing over paper or on-screen practice.
4. Place a semi-transparent drawing over real paper, or trace directly with a finger/stylus on the device.
5. Use paper detection for automatic alignment or adjust opacity, size, rotation, and position manually.
6. Lock the overlay and trace on paper, or clear/undo digital practice strokes.

The MVP is designed for Stassie-style drawing practice: simple, friendly, private, and usable on a phone or iPad with a stand.

## Current features

- Mobile-first responsive interface
- Clean, modern, kid-friendly visual design
- Built-in traceable SVG drawing library with category filters
- Local image upload with optional cleanup modes
- Camera access with `getUserMedia`
- On-screen practice mode for finger, stylus, or mouse tracing
- Demo camera surface when camera is unavailable/blocked
- Drag-to-position overlay
- Mobile-friendly floating trace controls
- Opacity, scale, rotation, nudge, lock, reset controls
- Experimental paper rectangle detection and tracking
- Uploaded image background cleanup and line-art conversion
- Outline/high-contrast display mode
- Screen Wake Lock request where supported
- PWA manifest metadata
- Service worker app-shell caching
- No account, backend, ads, analytics, or uploads

## Important boundaries

This is a frontend MVP only.

- No true/native AR anchoring
- No production native AR code
- No backend
- No image/video upload
- No remote or server-side image processing
- Camera and uploaded images stay local in the browser session or Expo app state

For real tracing, use a phone/iPad stand or prop the device above the paper. Experimental paper tracking can follow small camera shifts when the page is clearly visible, but manual realignment may still be needed.

## Documentation

- [Product brief](docs/PRODUCT_BRIEF.md)
- [Physical setup guide](docs/PHYSICAL_SETUP.md)
- [Paper tracking notes](docs/PAPER_TRACKING.md)
- [Uploaded image cleanup](docs/UPLOAD_CLEANUP.md)
- [Expo mobile app plan](docs/MOBILE_APP_PLAN.md)
- [Real-device testing checklist](docs/REAL_DEVICE_TESTING.md)
- [Roadmap](docs/ROADMAP.md)
- [Privacy notes](docs/PRIVACY.md)

## Run the web app locally

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:5173
```

Camera access on mobile requires HTTPS. Localhost works on desktop for development, but real phone/iPad testing should use an HTTPS deployment such as Netlify or Vercel.

## Run the Expo mobile app

```bash
npm install
npm --prefix mobile install
npm run mobile:start
```

Scan the QR code with Expo Go on a real phone. If the built-in phone camera says "No usable data found," open Expo Go directly and use its scanner or enter the `exp://...` Metro URL manually. If the phone cannot connect to the local server, run `cd mobile && npm run start -- --tunnel`.

The mobile MVP uses native camera, local image picker, keep-awake, shared built-in templates, and manual overlay controls. AR is not part of the Expo Go MVP.

## Verify

```bash
npm run lint
npm run build
npm run mobile:typecheck
npm run mobile:doctor
```

With the dev server running, viewport checks can be run with:

```bash
npm run check:viewports
```

Or against another local port:

```bash
CHECK_URL=http://127.0.0.1:5174 npm run check:viewports
```

## Capture screenshots

With the dev server running:

```bash
npm run screenshots
```

Generated files:

- `/tmp/tracebuddy-01-home-desktop.png`
- `/tmp/tracebuddy-02-picker-desktop.png`
- `/tmp/tracebuddy-03-trace-desktop.png`
- `/tmp/tracebuddy-04-home-mobile.png`
- `/tmp/tracebuddy-05-trace-mobile.png`

## Suggested next steps

- Deploy to HTTPS for real iPad/phone camera testing
- Test with a physical stand and real paper
- Capture real-device notes in `docs/REAL_DEVICE_TESTING.md`
- Test the Expo Go mobile MVP on a real phone over paper and in on-screen practice mode
- Improve uploaded image cleanup after real-device testing
- Add favorites/recent templates if the larger library needs shortcuts
- Prototype printable marker-based tracking if plain paper detection is not stable enough
- Move to an Expo development build only when AR or custom native modules are needed
