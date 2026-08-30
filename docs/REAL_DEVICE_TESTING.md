# Real-Device Testing Checklist

Automated viewport checks are useful, but TraceBuddy needs real camera testing on actual phones/tablets because camera permissions, HTTPS, development/TestFlight build behavior, stands, lighting, and browser/native camera differences are the core product risks.

## Preflight

- Deploy to an HTTPS URL, such as Netlify or Vercel.
- Open the HTTPS URL directly on the test device.
- Have blank paper, a pencil, and a stable stand ready.
- Test with enough light and without strong glare.

## Device matrix

Minimum recommended matrix:

| Device | Browser | Required? | Notes |
|---|---|---:|---|
| iPhone | Safari | Yes | Primary iOS phone path |
| iPad | Safari | Yes | Best expected tracing device |
| Android phone | Chrome | Nice to have | Confirms non-iOS behavior |
| Desktop/laptop | Chrome | Nice to have | Development sanity check |

## Automated checks before real-device testing

Run locally:

```bash
npm run check
npm audit --audit-level=high
npm --prefix mobile audit --audit-level=high
```

After `npm run build`, with the production preview running (`npm run preview`):

```bash
npm run check:viewports
npm run check:storage
npm run check:offline
npm run screenshots
```

## Web manual scenarios

### 1. First load

- Open the deployed HTTPS URL.
- Confirm the welcome screen appears quickly.
- Confirm the page has no horizontal scrolling.
- Confirm nav buttons are tappable.

Pass if the app feels usable without zooming or layout glitches.

### 2. Template picker library

- Tap Pick a picture.
- Confirm the picker shows two compact template cards per row on a phone.
- Scroll through the larger template library.
- Try category filters such as Animals, Ocean, Magic, Vehicles, Letters, Island, and Seasonal.
- Confirm Upload your own remains easy to find.
- Type a custom name/word/phrase and confirm it opens in the selected camera or screen mode.

Pass if browsing feels quick and templates are easy to scan without zooming.

### 3. Built-in drawing tracing

- Choose Island Turtle, Happy Flower, or another built-in template.
- Allow camera access.
- Confirm the live camera appears.
- Align the overlay over paper.
- Adjust opacity, size, and rotation.
- Lock the overlay.
- Try tracing for 3-5 minutes.

Pass if the overlay stays aligned when the device and paper remain still.

### 4. Uploaded image tracing

- Upload a simple local image.
- Confirm the trace header uses the uploaded file name.
- Confirm the image stays local in browser storage and remains available through Previous Work after a reload.
- Adjust and lock the overlay.

Pass if upload works and the UI no longer labels the uploaded image as a built-in drawing.

### 5. Uploaded image cleanup

- Upload a photo with a visible background.
- Open Adjust drawing.
- Try Original, Cut background, and Line art.
- Adjust Background sensitivity and Line detail.
- Confirm cleanup updates the overlay without uploading the image.
- Confirm Original restores the unprocessed upload.

Pass if at least one cleanup mode makes a real family photo easier to trace without confusing the child or parent.

### 6. On-screen practice

- In the picker, choose On-screen practice.
- Open a built-in drawing.
- Trace over the light guide with a finger, stylus, or mouse.
- Switch marker colors and brush sizes, then color inside the guide.
- Use Undo and Clear.
- Switch back to Camera trace.

Pass if practice mode feels usable without a paper/camera setup and does not ask for camera permission.

### 7. Camera fallback

- Block camera permission.
- Confirm demo mode appears.
- Confirm controls still work.
- Tap Retry camera after changing browser permission.

Pass if blocked/unsupported states are understandable and recoverable.

### 8. Paper detection and tracking

- Put bright paper on a darker table.
- Tap Find paper.
- Confirm the paper guide appears around the sheet.
- Tap Track paper.
- Move the device slightly or shift the paper a small amount.
- Confirm the overlay follows the detected sheet without excessive jitter.
- Try again on a white/light table to document failure behavior.

Pass if tracking helps with small shifts under good lighting and fails gracefully when contrast is poor.

### 9. Mobile controls

- Open trace mode on a phone.
- Tap Adjust drawing.
- Confirm controls open as a bottom sheet over the camera.
- Test quick size, rotate, opacity, lock, paper detection, and nudge controls.
- Tap Hide controls.
- Drag the overlay after changing size/rotation and confirm the adjusted size/rotation persists.

Pass if setup controls are usable without scrolling away from the camera view.

### 10. Lock and nudge controls

- Drag the overlay.
- Tap Lock.
- Try dragging again.
- Use nudge controls while locked and unlocked.
- Tap Reset overlay.

Pass if lock prevents accidental drag movement and controls remain clear.

### 11. Screen sleep behavior

- Enter trace mode.
- Leave the app open during a tracing session.
- Watch whether the screen dims or sleeps.

Pass if supported browsers keep the screen awake. Note browsers that ignore Wake Lock.

### 12. Offline shell behavior

- Load the deployed app once while online.
- Turn off network.
- Reopen the app.
- While online, visit Privacy or Support, then repeat the offline root-app load.

Pass if the complete cached app shell loads and a static page never replaces the offline root app. Camera still depends on device/browser permissions and HTTPS context.

## Native mobile app scenarios

### 1. Development or TestFlight launch

- Install an Expo SDK 56 development build or the latest TraceBuddy TestFlight build. The public App Store version of Expo Go is not compatible with this pinned runtime.
- For a development build, run Metro from `mobile/` with `npm run start` and open the project from the installed TraceBuddy build.
- Confirm the picker loads without redbox errors.
- Confirm category filters and template counts render.

Pass if the app opens quickly and the picker is usable in the installed build.

### 2. Native built-in tracing

- Choose a built-in template.
- Grant camera permission.
- Confirm the native camera preview appears.
- Drag the overlay while unlocked.
- Adjust opacity, size, rotation, and nudge controls.
- Lock the overlay and try dragging again.
- Tap Reset.

Pass if the native overlay controls feel at least as usable as the PWA controls.

### 3. Native local image tracing

- Tap Upload your own.
- Grant photo library permission.
- Choose a local image.
- Confirm trace mode opens with the selected image overlay.
- Adjust and lock the overlay.

Pass if local images stay on device and tracing still works without browser file input behavior.

### 4. Native on-screen practice

- Choose On-screen practice in the picker.
- Pick a built-in template.
- Trace with a finger or stylus.
- Switch marker colors and brush sizes, then color inside the guide.
- Use Undo and Clear.
- Switch to camera tracing for the same picture.

Pass if on-screen practice works smoothly and remains separate from the camera permission flow.

### 5. Native Previous Work and background saves

- Draw a stroke and background the app while the finger or Pencil is still down.
- Return to TraceBuddy, open Previous Work, and confirm the visible partial stroke was saved once.
- Resume it, add strokes and image stickers, background through both iOS `inactive` and `background` transitions, and confirm there is still one session card.
- Remove a sticker while autosave is active, leave Practice immediately, and confirm reopening never shows a missing-image placeholder.
- Use Clear in Practice, then Clear local work in the picker; relaunch and confirm sessions and app-owned images are gone.
- Simulate low storage if practical and confirm the visible status changes to Not saved with a working Retry action.

Pass if saves never duplicate, resurrect cleared work, silently fail, or lose the stroke under the finger.

### 6. Native export and permissions

- Add a local image sticker and save the finished canvas to Photos.
- Verify both photo selection and Add to Photos permission explanations are accurate.
- Deny each permission once and confirm the app remains usable with built-in templates.

Pass if export succeeds when allowed and denial has a clear recovery path.

### 7. Rotation and native session behavior

- Leave trace mode open for 5-10 minutes.
- Confirm the screen stays awake when supported.
- Watch battery/heat and camera stability.
- Compare against the PWA on the same stand and lighting.
- On iPhone and iPad, test portrait and landscape in Picker, Camera, and Practice.
- Rotate while a stroke is active, while autosave is showing Saving, and while the camera overlay is locked.
- On iPad, resize the app if multitasking is supported by the build and confirm controls remain reachable.

Pass if the app remains stable, saves correctly, and keeps essential controls reachable through every supported orientation.

## Browser-specific notes

### iOS Safari

- Camera requires HTTPS.
- Wake Lock support may be limited or unavailable depending on iOS version.
- Add-to-home-screen behavior may differ from Android.

### Android Chrome

- Camera and Wake Lock support are generally stronger.
- Add-to-home-screen should use the manifest metadata.

## Bug report template

When logging real-device issues, capture:

- Device model.
- OS version.
- Browser and version.
- Deployed URL.
- Whether the page is installed or opened in browser.
- Camera permission state.
- Screenshot or screen recording if possible.
- Stand/setup description.
- Steps to reproduce.
- Expected result.
- Actual result.
