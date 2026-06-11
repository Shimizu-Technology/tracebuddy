# Uploaded image cleanup

TraceBuddy includes beta cleanup tools for uploaded images. The goal is to make a child's own photo or drawing easier to trace without uploading it anywhere.

## Current cleanup modes

### Original

Uses the uploaded image as-is.

Use this when the picture is already clear enough or when cleanup removes details you want to keep.

### Cut background

Removes pixels that look similar to the image corners and exports a transparent PNG for the overlay.

Best when:

- The subject is on a plain or mostly uniform background.
- The corners of the image are background, not the subject.
- The subject color is different from the background.

The **Background sensitivity** slider controls how aggressively the corner color is removed.

### Line art

Converts the uploaded image into transparent tracing lines using local grayscale/edge detection.

Best when:

- The photo has a busy background.
- The child mainly needs outlines rather than the full photo.
- The original image blocks too much of the camera view.

The **Line detail** slider controls how many weaker edges are kept.

## Privacy

All cleanup runs in the browser with a local canvas. TraceBuddy does not upload images, camera frames, or processed results to a server.

## Limitations

This is not AI segmentation. It will not perfectly cut out complex hair, fuzzy edges, or subjects that blend into the background.

Expected failure cases:

- Background is multicolor or patterned.
- The subject touches all image corners.
- The subject and background have similar colors.
- Low-light or blurry photos.
- Very detailed photos that create noisy line art.

When cleanup struggles, use Original mode, lower the detail/sensitivity, or choose a clearer image.

## Future improvements

Possible next steps:

- Better foreground/background sampling.
- Brush or tap-to-keep/remove refinement.
- More robust local segmentation if a small on-device model is acceptable.
- A preview screen before entering trace mode.
