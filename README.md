# TraceBuddy

Kid-friendly camera overlay tracing helper built as a mobile-first React/Vite MVP.

## What it does

TraceBuddy lets a child or parent:

1. Pick a simple line-art drawing.
2. Open trace mode.
3. Use the device camera as the background.
4. Place a semi-transparent drawing over real paper.
5. Adjust opacity, size, rotation, and position.
6. Lock the overlay and trace on paper.

The MVP is designed for Stassie-style drawing practice: simple, friendly, private, and usable on a phone or iPad with a stand.

## Current features

- Mobile-first responsive interface
- Clean, modern, kid-friendly visual design
- Built-in traceable SVG drawings
- Local image upload
- Camera access with `getUserMedia`
- Demo camera surface when camera is unavailable/blocked
- Drag-to-position overlay
- Opacity, scale, rotation, nudge, lock, reset controls
- Outline/high-contrast mode
- PWA manifest metadata
- No account, backend, ads, analytics, or uploads

## Important boundaries

This is a frontend MVP only.

- No real AR anchoring
- No native app code
- No backend
- No image/video upload
- No AI image processing
- Camera and uploaded images stay local in the browser session

For real tracing, use a phone/iPad stand or prop the device above the paper.

## Run locally

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:5173
```

Camera access on mobile requires HTTPS. Localhost works on desktop for development, but real phone/iPad testing should use an HTTPS deployment such as Netlify or Vercel.

## Verify

```bash
npm run lint
npm run build
```

With the dev server running, viewport checks can be run with:

```bash
node scripts/viewport-check.mjs
```

Or against another local port:

```bash
CHECK_URL=http://127.0.0.1:5174 node scripts/viewport-check.mjs
```

## Capture screenshots

With the dev server running:

```bash
node scripts/capture-screenshots.mjs
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
- Add a few more Stassie-friendly drawing packs
- Add client-side photo-to-outline processing
- Add optional service worker/offline caching
- Consider native ARKit/ARCore only if fixed-device tracing is not good enough
