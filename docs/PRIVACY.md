# Privacy Notes

TraceBuddy is designed as a local-first tracing helper. The MVP does not include accounts, a backend, analytics, ads, or cloud uploads.

## What the app accesses

### Camera

Trace mode asks the browser for camera access using `getUserMedia`. The camera feed is shown directly in the page as the tracing background.

TraceBuddy does not record, upload, or transmit camera video.

### Uploaded images

Parents can upload a local image from the device. The image is read by the browser and stored in app state for the current session.

TraceBuddy does not upload the image, save it to a server, or send it to an AI service.

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

Camera permission is controlled by the browser and operating system. A parent can revoke camera access in browser or system settings.

## Network behavior

The app needs network access to load the deployed site the first time. After the service worker caches the shell, the interface may load offline, but real camera behavior still depends on the browser and permission state.

## Future changes

If future versions add accounts, uploads, analytics, AI processing, or cloud storage, this privacy document must be updated before release.

Until then, the intended boundary is simple: camera and uploaded images stay on the device.
