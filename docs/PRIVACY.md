# Privacy Notes

TraceBuddy is designed as a local-first tracing helper. The web MVP and Expo Go mobile MVP do not include accounts, a backend, analytics, ads, or cloud uploads.

## What the app accesses

### Camera

Trace mode asks the browser for camera access using `getUserMedia`. The Expo mobile MVP asks the operating system for camera access through `expo-camera`. The camera feed is shown directly as the tracing background. On-screen practice mode does not require camera access.

TraceBuddy does not record, upload, or transmit camera video. Custom words/phrases and practice strokes drawn on the screen stay in local app/browser state for the current session.

### Uploaded images

Parents can upload or select a local image from the device. The image is read by the browser or Expo app and stays on the device. Web saved-work image data is stored locally in IndexedDB; mobile saved-work images are copied into app-local file storage so Previous Work sessions do not depend on temporary picker URLs.

Optional cleanup modes in the web app also run locally in the browser using canvas processing. TraceBuddy can create a temporary transparent background or line-art version for the overlay, but it does not upload the image, save it to a server, or send it to an AI service. Mobile selected images remain local app files.

### Paper detection

Paper detection samples the live camera frame into a small hidden canvas in the browser. It estimates where the sheet of paper is so the overlay can be aligned locally.

TraceBuddy does not upload, save, or transmit these sampled frames.

## What may be stored by the browser

The service worker caches the app shell so TraceBuddy can load more reliably after the first visit. Cached files can include:

- HTML/CSS/JavaScript app assets.
- The manifest file.
- The favicon.
- Built-in drawing assets bundled with the app.

The service worker does not cache camera video or uploaded image files.

### Saved drawings

When a parent or child taps Save image in mobile practice mode, TraceBuddy asks the operating system for permission to add the finished drawing image to the device Photos library. This happens only after the user chooses Save image.

## Permissions

Camera and photo-library permissions are controlled by the browser and operating system. A parent can revoke access in browser, app, or system settings.

## Network behavior

The web app needs network access to load the deployed site the first time. After the service worker caches the shell, the interface may load offline, but real camera behavior still depends on the browser and permission state.

The Expo Go mobile app needs network access during development to load the JavaScript bundle from the local Expo server. It does not send camera video or selected images to TraceBuddy servers.

## Future AR Trace mode

A planned iOS ARKit mode would use on-device ARKit processing to recognize a printed TraceBuddy marker and anchor the tracing guide to real paper. The intended privacy boundary remains the same:

- AR camera frames are processed on the device.
- Camera video is not recorded or uploaded.
- Selected images and tracing guides stay on the device.
- No accounts, analytics, ads, or tracking are required.

## Future changes

If future versions add accounts, uploads, analytics, remote AI processing, cloud storage, or any off-device AR/image processing, this privacy document must be updated before release.

Until then, the intended boundary is simple: camera and selected images stay on the device.
