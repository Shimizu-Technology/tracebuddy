# Paper Tracking Notes

TraceBuddy now includes experimental paper rectangle detection. This is a local browser feature that looks at the live camera frame, finds the largest bright sheet-like area, and aligns the drawing overlay to it.

## Current approach: paper rectangle detection

The current implementation:

- Runs only in the browser.
- Uses the existing camera video element.
- Downsamples a video frame to a small hidden canvas.
- Finds bright, low-saturation pixels that look like white paper.
- Chooses the largest connected paper-like region.
- Estimates the sheet center, size, and rotation.
- Maps that detection back onto the visible camera stage.
- Can either align once with **Find paper** or continue tracking with **Track paper**.

This is intentionally lightweight and private. No frames are uploaded, stored, or sent to an AI service.

## When it works best

Paper detection works best when:

- The paper is bright or white.
- The table/background is darker than the paper.
- The full paper is visible in the camera view.
- Lighting is even and not too shadowy.
- The paper is not glossy.
- The device movement is small.

## Known limitations

This is not true AR anchoring. It is computer-vision-assisted alignment.

Detection can fail or jitter when:

- The table is also white or very bright.
- The paper edges blend into the background.
- A hand covers a large part of the page.
- Shadows or glare split the page into multiple regions.
- The paper is only partially visible.
- The device moves quickly.

If detection fails, use manual drag/nudge controls or improve lighting/background contrast.

## Future option: printable marker tracking

A more reliable next step is marker-based tracking.

Possible design:

- Provide a printable TraceBuddy page or mat.
- Put small high-contrast markers in the paper corners.
- Detect those markers instead of guessing the paper edges.
- Use the marker positions to compute a more stable paper transform.

Advantages:

- Much more reliable than plain paper detection.
- Works better on white tables.
- Handles shadows and partial edge visibility better.
- Still local and browser-based.

Tradeoffs:

- Requires printing or using a special page/mat.
- Adds setup friction.
- Needs marker design and calibration work.

## Future option: native AR

Native ARKit/ARCore could anchor drawings to a detected surface or paper plane more robustly.

Advantages:

- Better tracking when the device moves.
- More accurate camera/scene understanding.
- Potentially smoother anchored overlays.

Tradeoffs:

- Requires native iOS/Android app work.
- Adds App Store/TestFlight complexity.
- Slower iteration than web.
- More device compatibility concerns.

Recommendation: validate browser paper detection first, then prototype printable marker tracking before considering native AR.
