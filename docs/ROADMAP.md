# TraceBuddy Roadmap

TraceBuddy should stay simple until real-device testing proves a more complex feature is needed.

## Product principles

- Keep capture and tracing local to the device.
- Prefer simple controls over clever automation.
- Optimize for a parent setting up quickly and a child tracing safely.
- Do not add accounts, uploads, or analytics unless there is a clear reason.
- Use Expo Go for native camera validation before committing to native AR.
- Treat native AR as a last resort, not the default path.

## Completed in the current MVP

- Mobile-first React/Vite frontend.
- Expo Go native mobile MVP.
- On-screen coloring/practice mode for tracing without a paper/camera setup.
- Custom word/name/phrase tracing, expanded colors, brush styles, and locked pan/zoom controls.
- Shared SVG line-art drawing library with category filters.
- Local image upload.
- Camera preview with demo fallback.
- Overlay drag, opacity, scale, rotation, nudge, lock, and reset.
- Mobile-friendly floating trace controls.
- Experimental paper rectangle detection and tracking.
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

- Continue adding simple drawing packs and premade templates based on what Stassie uses most.
- Keep template categories such as animals, ocean, magic/fairy, vehicles, letters, seasonal, and Guam/island themes.
- Keep difficulty labels: starter, medium, detailed.
- Add a favorites/recent drawings section stored locally if the larger library needs shortcuts.
- Expand dynamic word/name tracing with handwriting-style letter guides and saved favorite names.
- Add a clearer parent setup mode vs child tracing mode.
- Continue tuning the mobile controls based on live phone/tablet use.
- Add a fullscreen/trace-only mode if real testing shows controls distract.
- Improve print/export options for built-in line art if useful.

## Phase 3: Expo mobile validation

Goal: compare the native camera tracing loop against the PWA before adding AR complexity.

Current Expo Go MVP:

- Native camera trace mode.
- On-screen coloring/practice mode for finger/stylus tracing, brush switching, and detail zoom.
- Shared built-in template library.
- Two-column mobile template picker with category filters.
- Local photo library selection.
- Manual overlay drag, nudge, opacity, scale, rotation, lock, and reset controls.
- Screen keep-awake behavior during trace and practice mode.
- No backend, accounts, uploads, analytics, or remote image processing.

Next improvements:

- Test on real iPhone and Android devices using Expo Go.
- Compare native camera stability against Safari/Chrome PWA behavior.
- Decide whether uploaded-image cleanup should be ported to native.
- Decide whether paper tracking should remain web-only, be reimplemented natively, or be replaced by marker-based AR.
- Move to an Expo development build only when AR or custom native modules are needed.

## Phase 4: Uploaded image cleanup and outline processing

Goal: better support the original idea of tracing whatever she wants.

Current beta:

- Optional client-side background cleanup for uploaded images.
- Client-side line-art conversion using local edge detection.
- Sensitivity/detail controls in trace mode.
- All processing stays local in the browser.

Next improvements:

- Add threshold/contrast controls if real photos need more tuning.
- Add invert/black-and-white controls if dark/light images need it.
- Add a simple cleanup preview before entering trace mode.
- Explore better local foreground/background sampling.

## Phase 5: Printable marker tracking

Goal: make paper tracking more reliable if plain paper rectangle detection is too sensitive to lighting, shadows, or white tables.

Possible marker features:

- Printable TraceBuddy page or mat.
- Small high-contrast corner markers.
- Marker-based paper transform calculation.
- More stable tracking when the device shifts slightly.

Tradeoffs:

- Requires printing or using a special page.
- Adds setup friction.
- Needs marker design and calibration work.

## Phase 6: Native AR only if needed

Only consider native ARKit/ARCore after the Expo Go mobile MVP is validated and browser-based paper tracking or printable marker tracking are not good enough.

Possible native/AR features:

- Paper plane detection.
- Anchored overlay that stays attached to the paper when the device moves.
- Better camera calibration.
- Native fullscreen and wake behavior.

Tradeoffs:

- More development time.
- Requires leaving Expo Go for an Expo development build or prebuild.
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
