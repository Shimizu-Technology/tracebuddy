# Real-Device Testing Checklist

Automated viewport checks are useful, but TraceBuddy needs real camera testing on actual phones/tablets because camera permissions, HTTPS, stands, lighting, and browser behavior are the core product risks.

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
npm run lint
npm run build
```

With the dev server running:

```bash
npm run check:viewports
npm run screenshots
```

## Manual scenarios

### 1. First load

- Open the deployed HTTPS URL.
- Confirm the welcome screen appears quickly.
- Confirm the page has no horizontal scrolling.
- Confirm nav buttons are tappable.

Pass if the app feels usable without zooming or layout glitches.

### 2. Built-in drawing tracing

- Tap Pick a picture.
- Choose Island Turtle or Happy Flower.
- Allow camera access.
- Confirm the live camera appears.
- Align the overlay over paper.
- Adjust opacity, size, and rotation.
- Lock the overlay.
- Try tracing for 3-5 minutes.

Pass if the overlay stays aligned when the device and paper remain still.

### 3. Uploaded image tracing

- Upload a simple local image.
- Confirm the trace header says Uploaded picture.
- Confirm the image stays local in the browser session.
- Adjust and lock the overlay.

Pass if upload works and the UI no longer labels the uploaded image as a built-in drawing.

### 4. Camera fallback

- Block camera permission.
- Confirm demo mode appears.
- Confirm controls still work.
- Tap Retry camera after changing browser permission.

Pass if blocked/unsupported states are understandable and recoverable.

### 5. Lock and nudge controls

- Drag the overlay.
- Tap Lock.
- Try dragging again.
- Use nudge controls while locked and unlocked.
- Tap Reset overlay.

Pass if lock prevents accidental drag movement and controls remain clear.

### 6. Screen sleep behavior

- Enter trace mode.
- Leave the app open during a tracing session.
- Watch whether the screen dims or sleeps.

Pass if supported browsers keep the screen awake. Note browsers that ignore Wake Lock.

### 7. Offline shell behavior

- Load the deployed app once while online.
- Turn off network.
- Reopen the app.

Pass if the cached app shell loads. Camera still depends on device/browser permissions and HTTPS context.

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
