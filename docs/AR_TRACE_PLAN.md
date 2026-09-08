# TraceBuddy AR Trace Plan

## Implementation status

Version 1.3 implements this plan as **Paper Lock** on iOS. The architecture uses a local Expo module with Swift, ARKit world tracking, and a RealityKit `ARView`. It provides two placement paths: markerless horizontal-surface raycasting and continuously updated tracking of a printable 50 mm TraceBuddy marker. Both render the selected built-in drawing, custom word, or local image as a transparent unlit page texture.

The React Native flow includes camera permission and parent safety gates, Letter/A4 portrait and landscape sizes, opacity, scale, rotation, 5 mm nudges, explicit lock/reset controls, tracking recovery, accessible control alternatives, child mode, and regular Camera Trace/Screen Practice fallbacks. AR data remains on-device, and spatial maps are not persisted. Physical-device precision and ergonomics remain TestFlight release gates; simulator compilation is not evidence of spatial accuracy.

## Purpose

The purpose of AR in TraceBuddy is not to add a novelty 3D experience. It is to make the tracing guide feel attached to the real worksheet.

Current camera tracing is a screen overlay: if the phone or iPad moves, the guide moves with the screen. AR Trace should instead anchor the guide to the physical paper so the device can move while the drawing stays aligned.

Primary user benefit:

> Pick a drawing, point the camera at a worksheet, lock the guide to the paper, and trace with more stable alignment.

## Product experience

Implemented user flow:

1. A parent or child picks a drawing.
2. They choose **Paper Lock**.
3. The app opens an iOS AR camera view and guides the parent through safe setup.
4. The user either finds a horizontal table surface or prints and shows the Paper Lock marker.
5. RealityKit previews the physical page placement.
6. The status changes to **Locked to paper**.
7. The selected tracing guide appears on the worksheet and stays attached as the device moves.
8. If tracking weakens, the app shows **Lost paper — point at the marker again**.
9. The user can tap **Recalibrate** or fall back to regular camera trace.

The child still traces by looking through the device screen. The app does not project onto the physical paper; it displays a camera view with a paper-anchored guide.

## Functionality AR should add

MVP functionality:

- iOS-only AR Trace mode.
- Full ARKit camera view.
- Printed TraceBuddy marker/reference image detection.
- Paper-anchored guide plane.
- Selected drawing rendered as a transparent guide texture.
- Opacity control.
- Recalibrate control.
- Tracking states: searching, locked, limited, lost, unsupported.
- Fallback to the current camera trace mode.
- Local-only operation with no uploads, accounts, analytics, or remote image processing.

Later functionality:

- Printable TraceBuddy worksheets with the marker already placed.
- Multiple paper sizes and guide placement presets.
- Manual four-corner calibration.
- Plain paper corner detection after marker-based tracking is proven.
- Freeze the last good alignment when tracking confidence drops.
- Save AR screenshots locally.
- Android ARCore exploration after iOS proves the workflow.

## Anchor strategy

TraceBuddy should use full ARKit, but it should start with an image anchor rather than trying to detect blank paper.

Recommended first anchor:

- A small high-contrast TraceBuddy marker printed on the page.
- The marker is bundled in the app as an `ARReferenceImage`.
- The app knows the real-world marker size.
- ARKit reports the marker transform in world space.
- TraceBuddy places the guide plane at a known offset from the marker.

Why this is the right first approach:

- ARKit needs a stable real-world reference to know where the worksheet is.
- Blank white paper detection is more sensitive to lighting, shadows, table color, and camera angle.
- A marker makes setup explainable: print the worksheet, point at the marker, wait for lock.
- It gives the highest chance of a reliable first TestFlight experience.

## Technical architecture

Expo managed does not expose ARKit directly. A production AR Trace mode requires custom native iOS code.

Implemented architecture:

- Keep the existing Expo/React Native app.
- Add a local native Expo module or native view for iOS.
- Build with EAS/TestFlight, not Expo Go.
- Implement a RealityKit `ARView` in Swift.
- Configure ARKit with image tracking/world tracking and bundled reference images.
- Pass selected drawing data from React Native to the native AR view.
- Rasterize the selected SVG into a transparent image texture for the AR plane.
- Place the texture on a transparent plane aligned to the worksheet.
- Send tracking events from native to React Native.

Potential native interface:

```ts
type ARTraceStatus = 'unsupported' | 'searching' | 'locked' | 'limited' | 'lost'

type ARTraceProps = {
  guideImageUri: string
  guideOpacity: number
  markerPhysicalWidthMeters: number
  paperWidthMeters: number
  paperHeightMeters: number
  guideInsetMeters: number
  onStatusChange: (status: ARTraceStatus) => void
}
```

## Implementation phases

### Phase 1: ARKit proof of concept

Goal: prove stable marker locking on a real device.

- Add an experimental **AR Trace** entry point in the mobile app.
- Add a native iOS AR view.
- Bundle one TraceBuddy marker as an AR reference image.
- Detect the marker in ARKit.
- Place a debug rectangle/plane relative to the marker.
- Show tracking status in React Native.
- Ship to TestFlight for real-device testing.

Exit criteria:

- Marker is detected reliably in normal room lighting.
- The debug plane stays visually attached to the paper while the device moves.
- Tracking loss and reacquisition are understandable.

### Phase 2: Real tracing overlay

Goal: replace the debug plane with the selected drawing.

- Convert the selected SVG drawing into a transparent image texture.
- Render that texture on the AR plane.
- Add opacity and recalibrate controls.
- Confirm scale and placement match the printable worksheet.
- Keep manual camera trace as a fallback.

Exit criteria:

- A child can trace a selected drawing from the AR camera view.
- The overlay remains aligned better than the current screen overlay when the device shifts.

### Phase 3: Printable worksheet flow

Goal: make the AR setup understandable and repeatable.

- Add a printable TraceBuddy marker/worksheet PDF.
- Add setup copy: print at 100%, use good lighting, keep the marker visible.
- Decide where the marker lives on the page.
- Add a simple in-app instruction screen.

Exit criteria:

- A parent can print a worksheet and successfully lock AR without developer help.

### Phase 4: Polish and release decision

Goal: decide whether AR Trace should graduate from experimental to primary.

- Test on multiple iPhones and iPads.
- Test with different lighting and desk surfaces.
- Tune smoothing and tracking confidence.
- Document unsupported-device behavior.
- Decide whether to keep AR as a separate mode or merge it into camera trace.

## Risks and mitigations

### Risk: AR adds setup complexity

Mitigation: keep regular Camera Trace and Practice modes. AR Trace should be optional and clearly labeled until it is proven.

### Risk: blank paper detection is unreliable

Mitigation: start with a printed marker/reference image, then explore paper corners later.

### Risk: native code slows iteration

Mitigation: isolate the ARKit code in one native module/view and keep the rest of the app in React Native.

### Risk: Android parity

Mitigation: ship iOS AR first. Android continues to use Camera Trace and Practice until ARCore work is justified.

### Risk: App Review confusion

Mitigation: AR Trace should have clear permission copy, no data collection, no uploads, and a fallback path. App Review notes should explain that AR processing is on-device.

## Privacy boundary

AR Trace must preserve TraceBuddy's local-first promise:

- Camera frames are processed on-device by ARKit.
- No camera video is recorded or uploaded.
- No user images are uploaded.
- No accounts, ads, analytics, or tracking are required.
- Printable markers and built-in drawings are bundled with the app.

## Current recommendation

Distribute version 1.3 through TestFlight and judge Paper Lock by measured placement accuracy, jitter, drift, recovery, heat, and whether a parent can complete setup without developer help. Keep regular Camera Trace as the production fallback while those physical-device results are gathered.
