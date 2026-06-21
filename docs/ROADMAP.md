# TraceBuddy Roadmap

TraceBuddy should stay simple until real-device testing proves a more complex feature is needed.

## Product principles

- Keep capture and tracing local to the device.
- Prefer simple controls over clever automation.
- Optimize for a parent setting up quickly and a child tracing safely.
- Do not add accounts, uploads, or analytics unless there is a clear reason.
- Use the current Expo/TestFlight app for native camera validation before committing AR to the primary workflow.
- Treat native AR as a focused paper-anchoring feature, not a novelty 3D feature.

## Completed in the current MVP

- Mobile-first React/Vite frontend.
- Expo Go native mobile MVP.
- On-screen coloring/practice mode for tracing without a paper/camera setup.
- Custom word/name/phrase tracing, expanded colors including pinks, brush styles, and locked pan/zoom controls.
- Shared SVG line-art drawing library with category filters.
- Local image upload.
- Mobile practice add-ons for built-in shapes and local photo/image stickers.
- Save finished mobile practice drawings to the device Photos library.
- Previous Work gallery for saved on-screen coloring sessions.
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
- Continue polishing the local Previous Work gallery as real saved sessions accumulate.
- Expand dynamic word/name tracing with handwriting-style letter guides and saved favorite names.
- Add a clearer parent setup mode vs child tracing mode.
- Continue tuning the mobile controls based on live phone/tablet use.
- Add a fullscreen/trace-only mode if real testing shows controls distract.
- Improve print/export options for built-in line art if useful.

## Previous Work gallery

Goal: let kids revisit finished or in-progress coloring without overwriting the original template.

Implemented scope:

- Local-only Previous Work section from the picker.
- Multiple saved practice sessions per template/custom word/uploaded image.
- Visual previews, title, stroke count, added stickers, and last-edited date.
- Resume/Edit, Duplicate/Copy, Start fresh, Save image, and Delete actions.
- Original templates remain clean starting points even when previous work exists.
- Privacy preserved: no accounts, backend sync, uploads, analytics, or remote image processing.
- Mobile uploaded images are copied into app-local storage before being referenced by long-lived saved sessions.

Future polish:

- Better thumbnail generation for very large or complex drawings.
- Optional rename/favorite controls if the saved-work list grows.
- Migration/import for older single-slot autosaves if real users need it.

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
- Decide whether paper tracking should remain web-only, be reimplemented natively, or be replaced by ARKit marker anchoring.
- Move to a custom native iOS module only when ARKit work begins.

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

## Phase 5: iOS ARKit Trace spike

Goal: prove that the tracing guide can stay attached to real paper when the device moves.

See `docs/AR_TRACE_PLAN.md` for the full plan.

Recommended first AR scope:

- Add an experimental iOS-only AR Trace mode.
- Use full ARKit with a printed TraceBuddy reference marker.
- Detect the marker and place a transparent guide plane relative to it.
- Render the selected tracing guide on the plane.
- Show tracking states: searching, locked, limited, lost, unsupported.
- Keep regular Camera Trace and Practice as fallback modes.

Why marker-based ARKit first:

- ARKit needs a stable real-world anchor.
- Blank paper detection is more sensitive to lighting, shadows, and table color.
- A printed marker makes setup explainable and repeatable.
- This preserves the core value: the guide sticks to the worksheet while the phone or iPad moves.

Tradeoffs:

- Requires custom native iOS code, not Expo Go.
- Requires EAS/TestFlight builds for testing.
- Requires a printable marker or worksheet.
- Android ARCore would be a separate later project.

## Phase 6: AR polish and printable workflow

If the ARKit spike works well on real devices, polish it into a reliable workflow.

Possible follow-up features:

- Printable TraceBuddy worksheet PDFs.
- Multiple paper sizes and guide-placement presets.
- Manual four-corner calibration.
- Freeze-on-lost-tracking behavior.
- Save AR screenshots locally.
- Plain paper corner detection after marker anchoring is proven.
- Android ARCore exploration only after iOS proves the value.

## Explicitly deferred

- Accounts.
- Cloud uploads.
- Sharing/social features.
- AI-generated images.
- Server-side photo processing.
- Paid subscriptions.
- Analytics/tracking.
