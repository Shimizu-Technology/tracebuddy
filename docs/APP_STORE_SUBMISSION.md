# TraceBuddy App Store Submission Notes

This document collects the App Store Connect copy, decisions, and release checklist for the first public iOS release.

## Important release note

App Store Connect currently shows an iOS app version of **1.0**, while the current TestFlight build is **0.1.0 (6)**.

Before submitting for App Review, confirm the selected build is eligible for the App Store version page. If App Store Connect does not allow build `0.1.0 (6)` to be selected for version `1.0`, do one of the following:

1. Change the App Store version page to `0.1.0`, or
2. Bump `mobile/app.json` `expo.version` to `1.0` or `1.0.0`, make a new EAS build, and submit that build.

Recommended public release path: use a clean public version such as **1.0** and ship a matching production build.

## Public app name

The App Store listing currently shows `TraceBuddy (84e443)`, which should not be used publicly.

Recommended App Store name options, all under 30 characters:

- `TraceBuddy Kids Tracing`
- `TraceBuddy Drawing Helper`
- `TraceBuddy Trace & Color`

Recommended choice: **TraceBuddy Kids Tracing**

The in-app display name can remain **TraceBuddy**.

## Subtitle

Recommended subtitle:

```text
Camera tracing for kids
```

Length: 23 characters, max 30.

## Promotional text

Recommended promotional text:

```text
Turn a phone or iPad into a kid-friendly tracing helper with camera-over-paper tracing, on-screen coloring, custom words, colors, and brushes.
```

Length: 142 characters, max 170.

## Description

Recommended description:

```text
TraceBuddy helps kids practice drawing, tracing, coloring, and early writing with a phone or iPad.

Pick a simple line-art picture, type a custom name or phrase, or choose a local image from the device. TraceBuddy can show the guide over real paper using the camera, or open a locked on-screen coloring canvas for finger and stylus practice.

Features:

• Camera-over-paper tracing with adjustable guide opacity, scale, rotation, and position
• On-screen coloring and tracing mode for times when paper setup is not available
• Locked canvas by default so little hands can draw without accidentally moving the page
• Optional pan and zoom for tracing small details
• Built-in kid-friendly tracing templates
• Custom word, name, and phrase tracing
• Marker colors, brush sizes, and pencil, marker, crayon, and paint styles
• Local photo selection for tracing personal references
• No account, no ads, no analytics, and no cloud uploads

TraceBuddy is designed for parents and children to use together. A parent can pick or upload a guide, set up the camera or practice screen, and let the child trace at their own pace.

Privacy is simple: camera video, selected images, custom words, and drawings stay on the device. TraceBuddy does not upload photos or camera frames to a server.
```

Note: If Apple rejects bullet characters, replace each bullet with a hyphen.

## Keywords

Recommended keywords, max 100 characters:

```text
tracing,drawing,coloring,kids,practice,handwriting,letters,sketch,art,worksheet,camera
```

Length: 86 characters.

## Support URL

Recommended support URL:

```text
https://tracebuddy-gu.netlify.app/support.html
```

## Marketing URL

Optional. Recommended for now:

```text
https://tracebuddy-gu.netlify.app
```

## Copyright

Recommended copyright:

```text
© 2026 Shimizu Technology
```

If Apple requires the seller's legal name, use:

```text
© 2026 Leon Ambrosio Shimizu
```

## Category

Recommended primary category:

```text
Education
```

Recommended secondary category:

```text
Graphics & Design
```

Alternative secondary category: `Kids`, only if intentionally opting into the Kids category requirements. For the first release, prefer Education + Graphics & Design.

## Age rating

Expected rating: **4+**.

Suggested questionnaire answers:

- Cartoon or fantasy violence: None
- Realistic violence: None
- Sexual content or nudity: None
- Profanity or crude humor: None
- Alcohol, tobacco, drug references: None
- Medical or treatment information: None
- Gambling: None
- Horror/fear themes: None
- Mature/suggestive themes: None
- Unrestricted web access: No
- User-generated content: No public user-generated content
- Allows users to interact with each other: No
- Shares location: No

The app lets a user choose a local image from their own device, but it does not publish or share user-generated content.

## App Privacy

Recommended privacy policy URL:

```text
https://tracebuddy-gu.netlify.app/privacy.html
```

Recommended App Privacy declaration:

```text
Data Not Collected
```

Rationale:

- No accounts.
- No analytics.
- No ads.
- No backend.
- No tracking.
- No uploaded photos, camera frames, practice drawings, or custom words.
- Camera and photo-library access are used locally on the device and are not collected by Shimizu Technology.

Tracking:

```text
No, this app does not track users.
```

Advertising identifier / IDFA:

```text
No, this app does not use the advertising identifier.
```

## Content rights

Recommended answer:

```text
Yes, we have the rights to use the content in the app.
```

Review note if needed:

```text
TraceBuddy includes original app artwork and built-in tracing templates from original, public-domain, or CC0-compatible sources documented in the repository. The app does not stream or download third-party media.
```

## Export compliance

Recommended answer:

```text
No, the app does not use non-exempt encryption.
```

The iOS config includes:

```json
"ITSAppUsesNonExemptEncryption": false
```

## App Review information

Sign-in required:

```text
No
```

Contact information:

- First name: Leon
- Last name: Shimizu
- Phone: use the developer account phone number
- Email: use the developer account email address

Recommended notes for reviewer:

```text
No login is required.

To test TraceBuddy:
1. Open the app.
2. Choose any built-in drawing from the picker.
3. Tap Practice to test the on-screen tracing and coloring canvas.
4. Tap Camera to test the camera-over-paper tracing workflow.
5. Camera permission is used only to show the live camera preview behind the tracing guide.
6. Photo-library permission is optional and only used if selecting a local image to trace.

TraceBuddy has no accounts, ads, analytics, backend, cloud uploads, or remote image processing. Camera frames, selected images, custom words, and practice drawings stay on the device.
```

## Screenshot requirements

Because the app supports iPhone and iPad, App Store Connect may require screenshots for both iPhone and iPad.

Current iPhone screenshot buckets shown by App Store Connect:

- iPhone 6.9-inch Display
  - Portrait size: `1320 x 2868`
- iPhone 6.5-inch Display
  - Accepted portrait sizes include `1242 x 2688` and `1284 x 2778`

Likely iPad screenshot bucket:

- iPad Pro 12.9-inch Display
- Common portrait size: `2048 x 2732`

Recommended screenshot set:

1. Picture picker with built-in tracing templates.
2. Camera trace mode with overlay controls.
3. On-screen coloring/practice mode with colors and brushes.
4. Custom word/name tracing.
5. Local-first privacy/setup message or curated templates.

Screenshot captions can be added visually if desired, but keep them honest and readable.

## Build selection

Current latest TestFlight build at time of writing:

- Version/build: `0.1.0 (6)`
- Commit: `407d041`

Before review submission, select the latest processed build in App Store Connect under **TestFlight → Builds**. Do not rely on the version above — always pick the newest eligible build from the App Store Connect build list. If no compatible build appears under version `1.0`, create a matching `1.0` build first.

## Pre-submit checklist

- App Store name no longer includes generated suffix.
- Subtitle, promotional text, description, keywords, support URL, copyright, and categories are filled.
- iPhone screenshots uploaded.
- iPad screenshots uploaded or iPad support intentionally disabled before build.
- App Privacy set to Data Not Collected.
- Age rating completed.
- Content rights completed.
- Export compliance completed.
- Pricing and availability completed.
- Latest compatible build selected.
- App Review notes filled.
- TestFlight build tested on real device.
