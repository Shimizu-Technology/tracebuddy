# Privacy Notes

TraceBuddy is designed as a local-first tracing helper. The web MVP and Expo Go mobile MVP do not include accounts, a backend, analytics, ads, or cloud uploads.

## What the app accesses

### Camera

Trace mode asks the browser for camera access using `getUserMedia`. The Expo mobile MVP asks the operating system for camera access through `expo-camera`. The camera feed is shown directly as the tracing background. On-screen practice mode does not require camera access.

TraceBuddy does not record, upload, or transmit camera video. Practice strokes drawn on the screen stay in local app/browser state for the current session.

### Uploaded images

Parents can upload or select a local image from the device. The image is read by the browser or Expo app and stored in app state for the current session.

Optional cleanup modes in the web app also run locally in the browser using canvas processing. TraceBuddy can create a temporary transparent background or line-art version for the overlay, but it does not upload the image, save it to a server, or send it to an AI service. The first Expo Go MVP does not port cleanup yet; selected images remain local app state.

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

## Permissions

Camera and photo-library permissions are controlled by the browser and operating system. A parent can revoke access in browser, app, or system settings.

## Network behavior

The web app needs network access to load the deployed site the first time. After the service worker caches the shell, the interface may load offline, but real camera behavior still depends on the browser and permission state.

The Expo Go mobile app needs network access during development to load the JavaScript bundle from the local Expo server. It does not send camera video or selected images to TraceBuddy servers.

## Future changes

If future versions add accounts, uploads, analytics, remote AI processing, or cloud storage, this privacy document must be updated before release.

Until then, the intended boundary is simple: camera and selected images stay on the device.
