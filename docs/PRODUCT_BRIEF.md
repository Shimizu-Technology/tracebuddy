# TraceBuddy Product Brief

## Summary

TraceBuddy is a mobile-first tracing helper for kids and parents. A phone or iPad camera can show real paper on the table with a semi-transparent line-art overlay, and an on-screen coloring/practice mode lets a child trace or color directly with a finger or stylus when a paper setup is not available.

It is intentionally simple: no account, no backend, no uploads, and no analytics. The current product combines a practical camera overlay, on-screen coloring, and an iOS ARKit Paper Lock mode that anchors the tracing guide to real paper without adding novelty 3D features.

## Why we built it

The original Brain-Dump prompt was:

> Look into building a tracing app with phone camera so that way Stassie can trace and draw whatever she wants

Source: `/Users/leonshimizu/Desktop/ShimizuTechnology/Brain-Dump/_inbox.md:523`

The product goal is to answer that idea quickly and safely: can a child use an existing phone or iPad, plus a stand, to trace drawings on real paper without printing, a lightbox, an account, or remote processing?

## Primary user

- A parent setting up the device and choosing/uploading a picture.
- A child tracing the visible overlay on paper.

## Core job to be done

When a child wants to practice drawing, the parent can open TraceBuddy, pick or upload a simple picture, prop the device above paper, adjust the overlay, lock it, and let the child trace confidently.

## MVP flow

1. Open TraceBuddy on a phone or tablet.
2. Pick a built-in line drawing, type custom words/names/phrases, or upload a local image.
3. On iOS, choose Paper Lock to anchor the guide in the room; otherwise choose camera tracing over paper or on-screen practice.
4. Allow camera access when using the paper workflow.
5. Place the device above real paper with a stand or stable prop.
6. Use Find paper/Track paper for automatic alignment, or adjust opacity, size, rotation, and position manually.
7. Lock the overlay and trace on paper, or use the locked digital canvas to trace/color directly on the device.
8. Unlock the digital canvas only when the child needs to pan or zoom into details.

## Success criteria

The MVP is successful if:

- It loads quickly on phone and tablet browsers.
- Camera access works on real devices over HTTPS.
- The overlay is easy to move, size, fade, rotate, and lock.
- Mobile controls are usable while the camera remains visible.
- Paper detection can align to a clear sheet in normal lighting.
- The child can trace without accidental overlay movement once locked.
- Parents understand that images and camera video stay local.
- The physical setup is stable enough for a real drawing session.

## Non-goals for the MVP

- Native AR anchoring on Android or the web.
- Blank-paper AR detection without a stable marker or calibration strategy.
- Account creation.
- Cloud storage.
- Uploading photos or camera video.
- AI image processing.
- Multi-user sharing.

## Key product decisions

### Web-first, then native development and TestFlight builds

A mobile web MVP was faster to test and easier to share. Camera access is available through `getUserMedia`, and HTTPS deployment is enough for browser real-device validation.

The native Expo app gives us a camera preview, local image picker, keep-awake behavior, and React Native controls without committing to custom AR work yet. The pinned Expo SDK requires a development build for local native testing; release candidates are distributed through TestFlight.

### Camera tracing plus focused iOS AR

The app started with a lightweight camera tracing workflow and browser paper detector. It can find a bright sheet in the camera view and align/track the drawing locally. This is useful for small camera shifts, but physical stability still matters and manual controls remain available when detection fails.

Version 1.3 adds full iOS ARKit/RealityKit Paper Lock with horizontal-surface placement and an optional printed TraceBuddy reference marker. The selected guide is rendered at a physical Letter or A4 size and stays attached to its world or marker anchor while the device moves. Regular Camera Trace remains the fallback on unsupported devices and while real-device accuracy is being validated.

### Local-first privacy

TraceBuddy does not upload photos, video, or drawings. Camera frames are shown locally and are not recorded. Previous Work, practice strokes, custom words, selected images, favorites, recent picks, and guided-lesson progress may persist in private browser or app storage until the user clears local work, clears site/app data, or removes the app.

### Built-in SVG drawings

Built-in drawings are inline SVG line art. They are lightweight, crisp at any size, cache well, and work offline after the app shell is cached.

## Current implementation

- React + Vite + TypeScript web frontend.
- Expo + React Native + TypeScript mobile app under `mobile/`, tested with development and TestFlight builds.
- CSS-only visual design.
- Shared 54-drawing SVG library with search, category and difficulty filters, favorites, and recent picks.
- Eight step-by-step lessons that introduce one highlighted stroke group at a time, remember the current step locally, and avoid scores or failure states.
- Handwriting practice for names, words, numbers, and short family messages.
- Twelve short Together activities that turn tracing into collaborative drawing, stories, gifts, and family memories.
- Worksheet print/export for every built-in drawing and activity; PNG/Photos keepsakes for completed screen work.
- Local image upload with optional browser-only cleanup.
- Browser camera access with graceful demo fallback.
- Native Expo camera trace mode in the mobile MVP.
- Native iOS Paper Lock mode with ARKit/RealityKit surface and printable-marker anchoring.
- On-screen coloring/practice mode in web and mobile for finger/stylus tracing.
- Custom word/name/phrase guides for early writing practice.
- Expanded colors including pinks, brush sizes, pencil/marker/crayon/paint styles, and eraser support for on-screen coloring.
- Locked-by-default digital canvas with optional pan/zoom for detail work.
- Lines-on-top option so template outlines stay visible while coloring.
- Mobile Add tools for built-in shapes and local photo/image stickers.
- Save finished mobile practice drawings to the device Photos library.
- Local autosave for on-screen coloring sessions.
- Previous Work gallery for resuming, duplicating, deleting, or starting fresh from saved coloring.
- Clear-all confirmation to prevent accidental work loss.
- A 30-second parent setup coach covering stand stability, full-page framing, and even lighting.
- Overlay transform controls, portrait/landscape presets, and one locally saved alignment.
- A locked low-distraction child trace view with optional browser fullscreen.
- Mobile floating controls for trace mode.
- Experimental paper rectangle detection and tracking.
- Uploaded image background cleanup and line-art conversion.
- PWA manifest and service worker app-shell caching.
- Automated lint, build, viewport, and screenshot checks.

## Open questions

- Does the native camera experience feel better than the PWA during a real tracing session?
- Is browser paper tracking stable enough on real iPhone/iPad setups?
- Is Surface Lock or printable Marker Lock more reliable across real family setups?
- Are the beta uploaded-image cleanup modes good enough on real family photos?
- Which premade drawing/template categories does Stassie use most?
- Which discovery shortcuts do families use most: search, favorites, recent picks, category, or difficulty?
- Does the child trace view remove enough setup distraction on real phones and tablets?
- Does Paper Lock improve real tracing enough to justify keeping and expanding the native AR path?
