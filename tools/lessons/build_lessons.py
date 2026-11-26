"""Build offline lesson data from curated art and ordered Method A specs."""

import argparse
from bisect import bisect_left
import hashlib
import json
import math
from pathlib import Path
import re

from svgpathtools import Arc, Path as SvgPath, parse_path

from extract_strokes import WORK, process, smooth_path

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "shared" / "art"
LESSONS = ROOT / "shared" / "lessons"
GEOMETRY = LESSONS / "geometry"


def orient(pts, closed):
    """Kid drawing order: open lines go top-to-bottom / left-to-right; loops start at
    the top and go counterclockwise (the way a "c" is taught)."""
    if closed:
        i = min(range(len(pts)), key=lambda k: (pts[k][1], pts[k][0]))
        pts = pts[i:] + pts[:i]
        area = sum(pts[k][0] * pts[(k + 1) % len(pts)][1] - pts[(k + 1) % len(pts)][0] * pts[k][1] for k in range(len(pts)))
        if area > 0:  # clockwise on screen
            pts = [pts[0]] + pts[1:][::-1]
        return pts
    score = lambda p: p[1] + 0.6 * p[0]
    return pts if score(pts[0]) <= score(pts[-1]) else pts[::-1]


def nearest(pts, x, y):
    return min(range(len(pts)), key=lambda k: math.dist(pts[k], (x, y)))


def stroke_signature(data):
    """Keep ordered lengths and starts for diagnostics, and hash the full map."""
    canonical = json.dumps(data, sort_keys=True, separators=(",", ":")).encode()
    return {
        "mapSha256": hashlib.sha256(canonical).hexdigest(),
        "strokes": [[s["len"], *s["pts"][0]] for s in data["strokes"]],
    }


def check_signature(picture, expected, actual):
    if expected is None:
        raise ValueError(f"{picture}: no stroke lock. Review the numbered map and record it.")
    old, new = expected["strokes"], actual["strokes"]
    if len(old) != len(new):
        raise ValueError(f"{picture}: stroke count changed from {len(old)} to {len(new)}")
    for i, (before, after) in enumerate(zip(old, new)):
        if before != after:
            raise ValueError(f"{picture}: stroke {i} [length, start x, start y] changed from {before} to {after}")
    if expected["mapSha256"] != actual["mapSha256"]:
        raise ValueError(f"{picture}: stroke geometry or dots changed. Review the numbered stroke map.")


def apply_ops(strokes, ops):
    for sid, x, y in ops.get("split", []):
        sid = str(sid)
        s = strokes.pop(sid)
        pts = s["pts"]
        k = nearest(pts, x, y)
        if s["closed"]:
            strokes[sid] = {"pts": pts[k:] + pts[: k + 1], "closed": False}
        else:
            strokes[sid + "a"] = {"pts": pts[: k + 1], "closed": False}
            strokes[sid + "b"] = {"pts": pts[k:], "closed": False}
    for group in ops.get("join", []):
        group = [str(g) for g in group]
        pts = list(strokes[group[0]]["pts"])
        for g in group[1:]:
            nxt = strokes[g]["pts"]
            if len(group) == 2 and math.dist(pts[0], nxt[0]) < min(math.dist(pts[-1], nxt[0]), math.dist(pts[-1], nxt[-1])):
                pts = pts[::-1]
            if math.dist(pts[-1], nxt[-1]) < math.dist(pts[-1], nxt[0]):
                nxt = nxt[::-1]
            pts += nxt
        for g in group:
            strokes.pop(g)
        strokes["+".join(group)] = {"pts": pts, "closed": False}
    for sid in strokes:
        strokes[sid]["pts"] = orient(strokes[sid]["pts"], strokes[sid]["closed"])
    for sid in ops.get("reverse", []):
        s = strokes[str(sid)]
        s["pts"] = s["pts"][::-1] if not s["closed"] else [s["pts"][0]] + s["pts"][1:][::-1]
    out = {sid: smooth_path(s["pts"], s["closed"]) for sid, s in strokes.items()}
    for name, d in ops.get("add", {}).items():
        out[name] = d
    return out


def sample_stroke(d):
    """Resample at equal distances so the pencil tracks Skia's normalized trim."""
    path = parse_path(d)
    if not path or not path.iscontinuous():
        raise ValueError(f"Expected one continuous stroke: {d}")
    # Emit absolute M/L/Q/C geometry so the runtime check can verify every coordinate.
    path = SvgPath(*(curve for segment in path for curve in (
        list(segment.as_cubic_curves(curves=math.ceil(abs(segment.delta) / 90))) if isinstance(segment, Arc) else [segment]
    )))
    points = [path[0].start]
    for segment in path:
        samples = max(1, math.ceil(segment.length() / 4))
        points.extend(segment.point(i / samples) for i in range(1, samples + 1))
    distances = [0.0]
    for a, b in zip(points, points[1:]):
        distances.append(distances[-1] + abs(b - a))
    length = distances[-1]
    if length <= 0:
        raise ValueError(f"Expected a nonempty stroke: {d}")
    count = max(1, math.ceil(length / 10))
    pen = []
    for i in range(count + 1):
        target = length * i / count
        right = min(len(distances) - 1, max(1, bisect_left(distances, target)))
        a, b = distances[right - 1:right + 1]
        t = (target - a) / (b - a) if b > a else 0
        point = points[right - 1] + (points[right] - points[right - 1]) * t
        pen.append([round(point.real, 1), round(point.imag, 1)])
    compact = re.sub(r"\.0(?=[,\s]|$)", "", path.d())
    compact = re.sub(r"\s*([MLQCZ])\s*", r"\1", compact)
    return {"d": compact, "len": round(length, 2), "pen": pen}


def build_lesson(spec, data):
    picture = spec["picture"]
    strokes = {str(s["id"]): {"pts": [tuple(p) for p in s["pts"]], "closed": s["closed"]} for s in data["strokes"]}
    paths = apply_ops(strokes, spec.get("ops", {}))
    steps = [{
        "say": step["say"],
        "strokes": [sample_stroke(paths[str(stroke_id)]) for stroke_id in step.get("strokes", [])],
        "dots": [data["dots"][i] for i in step.get("dots", [])],
    } for step in spec["steps"]]
    return {"id": picture, "strokeWidth": data["strokeWidth"], "steps": steps}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="compare freshly built lessons with the committed JSON")
    options = parser.add_mutually_exclusive_group()
    options.add_argument("--import-stroke-maps", type=Path, help="verify approved prototype work/<id>/strokes.json files and create the lock")
    options.add_argument("--lock-picture", metavar="LEVEL/ID", help="record the current stroke map for one reviewed new or revised spec")
    args = parser.parse_args()
    if args.check and (args.import_stroke_maps or args.lock_picture):
        parser.error("--check requires an existing lock")
    lock_file = LESSONS / "strokes.lock.json"
    locked = json.loads(lock_file.read_text()) if lock_file.exists() else {}
    signatures = {}
    metadata = []
    artifacts = {}
    loaders = []
    for path in sorted((LESSONS / "specs").glob("*.json")):
        try:
            spec_bytes = path.read_bytes()
            spec = json.loads(spec_bytes)
            if spec["method"] != "A":
                raise ValueError("Expected a Method A lesson")
            picture = spec["picture"]
            level, picture_id = picture.split("/")
            line = ART / picture / "line.svg"
            if level not in ("simple", "detailed") or not line.is_file():
                raise ValueError(f"Unknown curated picture: {picture}")
            if picture in signatures:
                raise ValueError(f"Duplicate lesson for {picture}")
            process(ART, picture)
            data = json.loads((WORK / picture / "strokes.json").read_text())
            signature = stroke_signature(data)
            if args.import_stroke_maps:
                reference_path = args.import_stroke_maps / picture / "strokes.json"
                if not reference_path.exists():
                    reference_path = args.import_stroke_maps / picture_id / "strokes.json"
                reference = json.loads(reference_path.read_text())
                if reference.get("source") != picture:
                    raise ValueError(f"The reference map is for {reference.get('source')}, expected {picture}")
                check_signature(picture, stroke_signature(reference), signature)
            elif args.lock_picture != picture:
                check_signature(picture, locked.get(picture), signature)
            line_hash = hashlib.sha256(line.read_bytes()).hexdigest()
            if not args.import_stroke_maps and args.lock_picture != picture and locked[picture]["lineSha256"] != line_hash:
                raise ValueError(f"{picture}: line.svg changed. Review the numbered stroke map and re-lock the picture.")
            signatures[picture] = {
                **signature, "lineSha256": line_hash, "specSha256": hashlib.sha256(spec_bytes).hexdigest(),
            }
            geometry = build_lesson(spec, data)
            metadata.append({
                "id": picture, "pictureId": picture_id, "level": level, "title": spec["title"],
                "stepCount": len(geometry["steps"]),
            })
            artifacts[GEOMETRY / level / f"{picture_id}.json"] = json.dumps(geometry, separators=(",", ":")) + "\n"
            loaders.append(f'  "{picture}": () => require("./geometry/{picture}.json"),')
        except (KeyError, IndexError, ValueError, OSError) as error:
            parser.exit(1, f"{path.name}: {error}\n")
    if args.lock_picture and args.lock_picture not in signatures:
        parser.error(f"No spec for {args.lock_picture}")
    if not (args.import_stroke_maps or args.lock_picture) and signatures.keys() != locked.keys():
        parser.error("The stroke lock and specs list different pictures. Remove retired pictures from the lock.")

    extra = set(GEOMETRY.glob("*/*.json")) - artifacts.keys()
    if extra:
        parser.error(f"Remove retired lesson geometry: {', '.join(str(path.relative_to(ROOT)) for path in sorted(extra))}")
    entries = (f"  {json.dumps(k)}: {json.dumps(v, separators=(',', ':'))}" for k, v in sorted(signatures.items()))
    artifacts[lock_file] = "{\n" + ",\n".join(entries) + "\n}\n"
    artifacts[LESSONS / "lesson-index.generated.json"] = json.dumps(metadata, ensure_ascii=False, indent=2) + "\n"
    artifacts[LESSONS / "lesson-geometry.generated.ts"] = "\n".join([
        "// Generated by tools/lessons/build_lessons.py.", 'import type { LessonGeometry } from "./drawingLessons"',
        "", "/* eslint-disable @typescript-eslint/no-require-imports -- Metro needs literal requires for lazy bundled geometry. */",
        "export const lessonGeometryLoaders: Readonly<Partial<Record<string, () => LessonGeometry>>> = {",
        *loaders, "}", "",
    ])
    for destination, content in artifacts.items():
        if args.check:
            if not destination.exists() or destination.read_text() != content:
                parser.exit(1, f"{destination.relative_to(ROOT)} is stale. Regenerate from the committed specs.\n")
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(content)



if __name__ == "__main__":
    main()
