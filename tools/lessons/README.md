# Build TraceBuddy drawing lessons

Tools for turning curated line art into offline drawing tutorials. Home reads the generated lesson index. The app loads each lesson’s bundled geometry when it opens. Authors need Python and librsvg to regenerate it.

## Set up

From the repository root, use Python 3.13 and `rsvg-convert` from librsvg (`brew install librsvg` on macOS).

```sh
python3.13 -m venv tools/lessons/.venv
tools/lessons/.venv/bin/pip install -r tools/lessons/requirements.txt
```

## Author a lesson

1. Pick a `level/id` from `shared/art` and extract its centerlines.

   ```sh
   tools/lessons/.venv/bin/python tools/lessons/extract_strokes.py shared/art simple/cat
   ```

2. Open `tools/lessons/work/simple/cat/strokes-labeled.png` to see the numbered strokes. Group them in drawing order in `shared/lessons/specs/`. Use the prototype's Method A format, as in [cat-a.json](../../shared/lessons/specs/cat-a.json). Keep each `say` to ten words or fewer. A step can use stroke IDs, dot indices, or both. The spec’s `picture` value is the ID used by saved drawings and progress, so Simple and Detailed lessons for a subject can coexist.
3. After reviewing the numbered map, record the picture’s stroke lock and run the schema check. Use the builder without flags for spec-only edits. Commit the spec, stroke lock, and generated JSON together.

   ```sh
   tools/lessons/.venv/bin/python tools/lessons/build_lessons.py --lock-picture simple/cat
   npm run check:drawing-lessons
   ```

The builder extracts from the current `line.svg` at 1× for Simple and 2× for Detailed. Specs may split a numbered stroke at the nearest point, join IDs end to end, add a fix-up path, or reverse the automatic direction. See the approved specs for examples. The builder emits absolute SVG paths, lengths, and evenly spaced pencil samples in the picture's 1000×1000 coordinate space.

Every build re-extracts the art and compares each stroke’s count, length, start point, and full map with `shared/lessons/strokes.lock.json`. A mismatch stops the build before it can apply the spec to different strokes. After revising line art, review the numbered map, update the spec’s references, and explicitly record the new lock with `--lock-picture LEVEL/ID`. To verify an approved batch against prototype maps, run `build_lessons.py --import-stroke-maps /path/to/work`. It accepts both the current `work/<level>/<id>` and prototype `work/<id>` layouts.

Run `build_lessons.py --check` to verify the stroke locks and compare fresh output with the committed index, geometry and loaders. Use a stable librsvg version for reproducible extraction. The Node check in `npm run check` compares the spec and line-art hashes with the lock and verifies that the index and geometry match their specs.
