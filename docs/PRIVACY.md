# Privacy Notes

TraceBuddy is designed as a local-first tracing helper. The web and native mobile apps do not include accounts, a backend, analytics, ads, or cloud uploads.

## What the app accesses

### Camera

Trace mode asks the browser for camera access using `getUserMedia`. The Expo mobile MVP asks the operating system for camera access through `expo-camera`. The camera feed is shown directly as the tracing background. On-screen practice mode does not require camera access.

TraceBuddy does not record, upload, or transmit camera video. Custom words/phrases and practice strokes drawn on the screen may be saved in private local app/browser storage for Previous Work, but are never sent to TraceBuddy servers.

### Uploaded images

Parents can upload or select a local image from the device to trace or add as a practice sticker. The image is read by the browser or Expo app and stays on the device. Web saved-work image data is stored locally in IndexedDB; mobile saved-work images are copied into app-local file storage so Previous Work sessions do not depend on temporary picker URLs.

Optional cleanup modes in the web app also run locally in the browser using canvas processing. TraceBuddy can create a temporary transparent background or line-art version for the overlay, but it does not upload the image, save it to a server, or send it to an AI service. Mobile selected images remain local app files.

### Paper detection

Paper detection samples the live camera frame into a small hidden canvas in the browser. It estimates where the sheet of paper is so the overlay can be aligned locally.

TraceBuddy does not upload, save, or transmit these sampled frames.

## What may be stored locally

Saved-work metadata, strokes, tool settings, custom text, and local image references persist on the device until the work is deleted, site data is cleared, or the mobile app is removed. The web app uses `localStorage` and IndexedDB. The native app uses AsyncStorage and app-private files.

The apps clean uploaded-image files that are no longer referenced by Previous Work. This cleanup is best-effort because browsers and operating systems can interrupt storage operations.

### Browser app shell

The service worker caches the app shell so TraceBuddy can load more reliably after the first visit. Cached files can include:

- HTML/CSS/JavaScript app assets.
- The manifest file.
- The favicon.
- Built-in drawing assets bundled with the app.

The service worker does not cache camera video or uploaded image files.

### Saved drawings

When a parent or child taps Save image in mobile practice mode, TraceBuddy asks the operating system for permission to add the finished drawing image to the device Photos library. This happens only after the user chooses Save image.

Deleting work inside TraceBuddy removes its saved session and attempts to remove any private uploaded-image file that no other saved work uses. If the browser or operating system interrupts image cleanup, the app reports the incomplete cleanup and Clear local work can be used again to retry. Clearing TraceBuddy's browser data or deleting the mobile app removes remaining private app data. Images already saved to the Photos library must be deleted from Photos separately.

## Permissions

Camera and photo-library permissions are controlled by the browser and operating system. A parent can revoke access in browser, app, or system settings.

## Network behavior

The web app needs network access to load the deployed site the first time. After the service worker caches the shell, the interface may load offline, but real camera behavior still depends on the browser and permission state.

An installed development build needs network access during local development to load the JavaScript bundle from the local Expo server. Production and TestFlight builds bundle the app code. None of these builds send camera video or selected images to TraceBuddy servers.

## Future AR Trace mode

A planned iOS ARKit mode would use on-device ARKit processing to recognize a printed TraceBuddy marker and anchor the tracing guide to real paper. The intended privacy boundary remains the same:

- AR camera frames are processed on the device.
- Camera video is not recorded or uploaded.
- Selected images and tracing guides stay on the device.
- No accounts, analytics, ads, or tracking are required.

## Future changes

If future versions add accounts, uploads, analytics, remote AI processing, cloud storage, or any off-device AR/image processing, this privacy document must be updated before release.

Until then, the intended boundary is simple: camera and selected images stay on the device.
