# TraceBuddy Product Brief

## Summary

TraceBuddy is a mobile-first tracing helper for kids and parents. A phone or iPad camera can show real paper on the table with a semi-transparent line-art overlay, and an on-screen coloring/practice mode lets a child trace or color directly with a finger or stylus when a paper setup is not available.

It is intentionally simple: no account, no backend, no uploads, and no analytics. The current product is a practical camera overlay and on-screen coloring tool. A future iOS ARKit mode is planned specifically to anchor the tracing guide to real paper, not to add novelty 3D features.

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
3. Choose camera tracing over paper or on-screen practice.
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

- Production native AR anchoring in the first App Store release.
- Blank-paper AR detection without a stable marker or calibration strategy.
- Account creation.
- Cloud storage.
- Uploading photos or camera video.
- AI image processing.
- Multi-user sharing.

## Key product decisions

### Web-first, then Expo Go

A mobile web MVP was faster to test and easier to share. Camera access is available through `getUserMedia`, and HTTPS deployment is enough for browser real-device validation.

The next step is an Expo Go mobile MVP using only Expo Go-supported modules. This gives us a native camera preview, local image picker, keep-awake behavior, and React Native controls without committing to custom native AR work yet.

### Camera tracing now, focused AR later

The app starts with a lightweight camera tracing workflow and browser paper detector instead of native AR. It can find a bright sheet in the camera view and align/track the drawing locally. This is useful for small camera shifts, but physical stability still matters and manual controls remain available when detection fails.

The planned AR direction is full iOS ARKit with a printed TraceBuddy marker/reference image. The goal is to make the selected tracing guide stay attached to the physical worksheet when the device moves. This should be built as an experimental iOS-only AR Trace mode after the first App Store MVP is submitted.

### Local-first privacy

TraceBuddy does not upload photos, video, or drawings. Uploaded images are held in browser memory for the current session. Camera frames are shown locally by the browser.

### Built-in SVG drawings

Built-in drawings are inline SVG line art. They are lightweight, crisp at any size, cache well, and work offline after the app shell is cached.

## Current implementation

- React + Vite + TypeScript web frontend.
- Expo Go + React Native + TypeScript mobile MVP under `mobile/`.
- CSS-only visual design.
- Shared built-in SVG drawing library with compact mobile picker and category filters.
- Local image upload with optional browser-only cleanup.
- Browser camera access with graceful demo fallback.
- Native Expo camera trace mode in the mobile MVP.
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
- Overlay transform controls.
- Mobile floating controls for trace mode.
- Experimental paper rectangle detection and tracking.
- Uploaded image background cleanup and line-art conversion.
- PWA manifest and service worker app-shell caching.
- Automated lint, build, viewport, and screenshot checks.

## Open questions

- Does the Expo Go native camera experience feel better than the PWA during a real tracing session?
- Is browser paper tracking stable enough on real iPhone/iPad setups?
- Would printable marker-based tracking be more reliable than plain paper detection?
- Are the beta uploaded-image cleanup modes good enough on real family photos?
- Which premade drawing/template categories does Stassie use most?
- Does the larger library need favorites/recent templates?
- Does the app need a fullscreen/low-distraction mode after real-device testing?
- Does the planned ARKit marker-anchored mode improve real tracing enough to justify the native complexity?
