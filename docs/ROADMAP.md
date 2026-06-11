# TraceBuddy Roadmap

TraceBuddy should stay simple until real-device testing proves a more complex feature is needed.

## Product principles

- Keep capture and tracing local to the device.
- Prefer simple controls over clever automation.
- Optimize for a parent setting up quickly and a child tracing safely.
- Do not add accounts, uploads, or analytics unless there is a clear reason.
- Treat native AR as a last resort, not the default path.

## Completed in the current MVP

- Mobile-first React/Vite frontend.
- Built-in SVG line-art drawings.
- Local image upload.
- Camera preview with demo fallback.
- Overlay drag, opacity, scale, rotation, nudge, lock, and reset.
- High-contrast outline display mode.
- Safer camera cleanup and retry behavior.
- Uploaded-image header labeling.
- Accessible toggle/nudge controls.
- SVG icon UI instead of emoji UI.
- Reduced-motion handling.
- PWA manifest metadata.
- Service worker app-shell caching.
- Product, privacy, physical setup, roadmap, and real-device testing docs.

## Phase 1: Real-device validation

Goal: prove the fixed-device tracing setup works in a real drawing session.

- Deploy to HTTPS.
- Test on iPhone Safari.
- Test on iPad Safari.
- Test with a physical stand and real paper.
- Document the best stand/lighting setup.
- Confirm whether Wake Lock works on target devices.
- Decide whether fullscreen/low-distraction mode is necessary.

## Phase 2: Better drawing experience

Goal: make the app more useful for everyday Stassie-style drawing practice.

- Add more simple drawing packs.
- Add difficulty levels: starter, medium, detailed.
- Add a favorites/recent drawings section stored locally.
- Add a clearer parent setup mode vs child tracing mode.
- Add a fullscreen/trace-only mode if real testing shows controls distract.
- Improve print/export options for built-in line art if useful.

## Phase 3: Upload-to-outline processing

Goal: better support the original idea of tracing whatever she wants.

- Add client-side edge detection.
- Add threshold/contrast controls.
- Add invert/black-and-white controls.
- Add a simple outline preview before entering trace mode.
- Keep all processing local in the browser.

## Phase 4: Native AR only if needed

Only consider native ARKit/ARCore if real-device testing proves that fixed-device tracing is not good enough.

Possible native/AR features:

- Paper plane detection.
- Anchored overlay that stays attached to the paper when the device moves.
- Better camera calibration.
- Native fullscreen and wake behavior.

Tradeoffs:

- More development time.
- App Store/TestFlight complexity.
- Device compatibility constraints.
- Harder sharing and iteration.

## Explicitly deferred

- Accounts.
- Cloud uploads.
- Sharing/social features.
- AI-generated images.
- Server-side photo processing.
- Paid subscriptions.
- Analytics/tracking.
