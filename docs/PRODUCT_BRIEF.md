# TraceBuddy Product Brief

## Summary

TraceBuddy is a mobile-first tracing helper for kids and parents. A phone or iPad camera can show real paper on the table with a semi-transparent line-art overlay, and an on-screen coloring/practice mode lets a child trace or color directly with a finger or stylus when a paper setup is not available.

It is intentionally simple: no account, no backend, no uploads, no analytics, and no native AR anchoring. The product is a practical camera overlay tracing tool with a production-oriented web MVP and an Expo Go mobile MVP for native camera validation.

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

- True AR plane detection or anchoring.
- Production native AR anchoring.
- Account creation.
- Cloud storage.
- Uploading photos or camera video.
- AI image processing.
- Multi-user sharing.

## Key product decisions

### Web-first, then Expo Go

A mobile web MVP was faster to test and easier to share. Camera access is available through `getUserMedia`, and HTTPS deployment is enough for browser real-device validation.

The next step is an Expo Go mobile MVP using only Expo Go-supported modules. This gives us a native camera preview, local image picker, keep-awake behavior, and React Native controls without committing to custom native AR work yet.

### Browser paper tracking before native AR

The app starts with a lightweight browser paper detector instead of native AR. It can find a bright sheet in the camera view and align/track the drawing locally. This is useful for small camera shifts, but physical stability still matters and manual controls remain available when detection fails.

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
- Expanded colors, brush sizes, and pencil/marker/crayon/paint styles for on-screen coloring.
- Locked-by-default digital canvas with optional pan/zoom for detail work.
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
- Is a native AR version ever worth the added complexity?
