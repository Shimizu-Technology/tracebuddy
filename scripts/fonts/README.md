These fonts are inputs for `npm run glyphs:generate`. Keeping them here lets `npm run glyphs:check` run offline. The app bundles only the generated SVG paths. The SIL Open Font License for each source font is in `mobile/src/data/font-licenses/`.

Both files are modified copies with overlapping contours merged. Outlining a glyph strokes every contour, so overlaps in the original fonts showed up as stray lines inside letters (an extra A inside A, marks inside a, e and s).

- `Fredoka-SemiBold-Flat.ttf` is [Fredoka](https://github.com/google/fonts/tree/a60a77e14f28abd4ef243a1b5dfc48df0cec5205/ofl/fredoka) (no Reserved Font Name), instanced at weight 600 and width 100:
  `fonttools varLib.instancer Fredoka.ttf wght=600 wdth=100 --remove-overlaps -o Fredoka-SemiBold-Flat.ttf`
- `TraceBuddyPractice-Bold.ttf` is [Andika Bold](https://github.com/google/fonts/tree/fffdadf0f0c9cc1ec8b407063424a8bfbee05611/ofl/andika) with `fontTools.ttLib.removeOverlaps.removeOverlaps` applied. "Andika" is a Reserved Font Name under its OFL, so the modified copy is renamed "TraceBuddy Practice".

Both need `fonttools` and `skia-pathops` (`pip install fonttools skia-pathops`).
