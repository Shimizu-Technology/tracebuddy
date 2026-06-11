# TraceBuddy Product Brief

## Summary

TraceBuddy is a mobile-first camera overlay tracing helper for kids and parents. A phone or iPad camera shows real paper on the table, and the app places a semi-transparent line-art drawing over the live camera view so the child can trace on paper.

It is intentionally simple: no account, no backend, no uploads, no analytics, and no true AR anchoring. The MVP is a practical fixed-device tracing tool, not a native AR product.

## Why we built it

The original Brain-Dump prompt was:

> Look into building a tracing app with phone camera so that way Stassie can trace and draw whatever she wants

Source: `/Users/leonshimizu/Desktop/ShimizuTechnology/Brain-Dump/_inbox.md:523`

The product goal is to answer that idea quickly and safely: can a child use an existing phone or iPad, plus a stand, to trace drawings on real paper without printing, a lightbox, an account, or a native app?

## Primary user

- A parent setting up the device and choosing/uploading a picture.
- A child tracing the visible overlay on paper.

## Core job to be done

When a child wants to practice drawing, the parent can open TraceBuddy, pick or upload a simple picture, prop the device above paper, adjust the overlay, lock it, and let the child trace confidently.

## MVP flow

1. Open TraceBuddy on a phone or tablet.
2. Pick a built-in line drawing or upload a local image.
3. Allow camera access.
4. Place the device above real paper with a stand or stable prop.
5. Adjust opacity, size, rotation, and position.
6. Lock the overlay.
7. Trace on paper.

## Success criteria

The MVP is successful if:

- It loads quickly on phone and tablet browsers.
- Camera access works on real devices over HTTPS.
- The overlay is easy to move, size, fade, rotate, and lock.
- The child can trace without accidental overlay movement once locked.
- Parents understand that images and camera video stay local.
- The physical setup is stable enough for a real drawing session.

## Non-goals for the MVP

- True AR plane detection or anchoring.
- Native iOS/Android app code.
- Account creation.
- Cloud storage.
- Uploading photos or camera video.
- AI image processing.
- Multi-user sharing.

## Key product decisions

### Web-first instead of native-first

A mobile web MVP is faster to test and easier to share. Camera access is available through `getUserMedia`, and HTTPS deployment is enough for real-device validation.

### Fixed-device overlay instead of AR anchoring

The app assumes the device is physically stable above the paper. If the device moves, the overlay moves with the screen. This is acceptable for the MVP because the main question is whether a stand-based setup is good enough.

### Local-first privacy

TraceBuddy does not upload photos, video, or drawings. Uploaded images are held in browser memory for the current session. Camera frames are shown locally by the browser.

### Built-in SVG drawings

Built-in drawings are inline SVG line art. They are lightweight, crisp at any size, cache well, and work offline after the app shell is cached.

## Current implementation

- React + Vite + TypeScript frontend.
- CSS-only visual design.
- Built-in SVG drawing pack.
- Local image upload.
- Camera access with graceful demo fallback.
- Overlay transform controls.
- PWA manifest and service worker app-shell caching.
- Automated lint, build, viewport, and screenshot checks.

## Open questions

- Is a fixed stand setup stable enough for a real child tracing session?
- Should uploaded photos be converted to outlines client-side before tracing?
- Which drawing packs are most useful for Stassie-style practice?
- Does the app need a fullscreen/low-distraction mode after real-device testing?
- Is a native AR version ever worth the added complexity?
