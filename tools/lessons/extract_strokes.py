"""Method A step 1: turn a TraceBuddy line.svg (filled potrace outlines) into centerline strokes.

Usage:
  tools/lessons/.venv/bin/python tools/lessons/extract_strokes.py <art-root> <level/id> [<level/id> ...]

For each picture it writes work/<level>/<id>/strokes.json and work/<level>/<id>/strokes-labeled.png
(every stroke in its own color with its number at the start point, so a person can
group strokes into steps in specs/<id>.json).

Pipeline: rasterize at 1000 px (1 px = 1 viewBox unit) -> binarize -> pull out solid
blobs (pupils, nostrils) as dots -> skeletonize the rest -> build a pixel graph ->
prune short spurs -> chain edges straight through junctions -> simplify (RDP) ->
smooth to cubic Beziers.
"""
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage.morphology import skeletonize, remove_small_objects, remove_small_holes

ROOT = Path(__file__).resolve().parent
WORK = ROOT / "work"
SIZE = 1000

NB = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def rasterize(svg: Path, png: Path, size: int):
    subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), "-b", "white", str(svg), "-o", str(png)], check=True)
    img = np.asarray(Image.open(png).convert("L"))
    return img < 128


def find_dots(ink, half_w):
    """Solid filled areas much thicker than a line (pupils) become dots."""
    dt = ndi.distance_transform_edt(ink)
    core = dt > half_w * 2.1
    core = remove_small_objects(core, max_size=12)
    lab, n = ndi.label(core)
    dots, mask = [], np.zeros_like(ink)
    for i in range(1, n + 1):
        region = lab == i
        # grow back to the blob's real edge, but only within the ink
        grown = ndi.binary_dilation(region, iterations=int(half_w * 2.1) + 2) & ink
        ys, xs = np.nonzero(grown)
        r = math.sqrt(len(xs) / math.pi)
        dots.append({"cx": round(float(xs.mean()), 1), "cy": round(float(ys.mean()), 1), "r": round(r, 1)})
        mask |= grown
    return dots, mask


def neighbors(sk, y, x):
    h, w = sk.shape
    for dy, dx in NB:
        yy, xx = y + dy, x + dx
        if 0 <= yy < h and 0 <= xx < w and sk[yy, xx]:
            yield yy, xx


def build_graph(sk):
    deg = ndi.convolve(sk.astype(int), np.ones((3, 3), int), mode="constant") - 1
    deg[~sk] = 0
    node_px = sk & ((deg == 1) | (deg >= 3))
    lab, n = ndi.label(node_px, structure=np.ones((3, 3)))
    node_of = {}
    nodes = []
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        nodes.append((float(xs.mean()), float(ys.mean())))
        for y, x in zip(ys, xs):
            node_of[(y, x)] = i - 1
    edges = []  # (a, b, [(x,y),...])
    visited = set()
    for (y, x), ni in list(node_of.items()):
        for yy, xx in neighbors(sk, y, x):
            if (yy, xx) in node_of or (yy, xx) in visited:
                continue
            path = [(x, y), (xx, yy)]
            visited.add((yy, xx))
            prev, cur = (y, x), (yy, xx)
            end = None
            while True:
                nxt = None
                for p in neighbors(sk, *cur):
                    if p == prev:
                        continue
                    if p in node_of:
                        if node_of[p] == ni and len(path) <= 3:
                            continue  # still next to the cluster we started from
                        end = node_of[p]
                        path.append((p[1], p[0]))
                        break
                    if p not in visited and p not in node_of:
                        nxt = p
                        break
                if end is not None or nxt is None:
                    break
                visited.add(nxt)
                path.append((nxt[1], nxt[0]))
                prev, cur = cur, nxt
            if end is None:
                end = -1
            edges.append([ni, end, path])
    # direct node-to-node adjacency (two node clusters touching) is ignored: tiny
    # isolated loops (every pixel degree 2)
    rest = sk.copy()
    for (y, x) in node_of:
        rest[y, x] = False
    for (y, x) in visited:
        rest[y, x] = False
    lab2, n2 = ndi.label(rest, structure=np.ones((3, 3)))
    for i in range(1, n2 + 1):
        ys, xs = np.nonzero(lab2 == i)
        if len(xs) < 8:
            continue
        pts = set(zip(ys, xs))
        start = next(iter(pts))
        path, cur, prev = [start], start, None
        seen = {start}
        while True:
            nxt = None
            for p in neighbors(sk, *cur):
                if p in pts and p not in seen:
                    nxt = p
                    break
            if nxt is None:
                break
            seen.add(nxt)
            path.append(nxt)
            cur = nxt
        path.append(start)
        edges.append([-2, -2, [(x, y) for y, x in path]])
    return nodes, edges


def plen(pts):
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def prune(nodes, edges, spur):
    """Drop short dangling edges (skeleton hairs at corners and junctions)."""
    for _ in range(3):
        deg = {}
        for a, b, _ in edges:
            deg[a] = deg.get(a, 0) + 1
            deg[b] = deg.get(b, 0) + 1
        keep = []
        for e in edges:
            a, b, pts = e
            if a >= 0 and b >= 0 and a != b and plen(pts) < spur and (deg[a] == 1) != (deg[b] == 1):
                continue
            keep.append(e)
        edges = keep
    return edges


def direction_out(pts, at_start, reach=18):
    """Unit vector pointing away from the node along the edge."""
    seq = pts if at_start else pts[::-1]
    p0 = seq[0]
    acc = 0
    q = seq[-1]
    for i in range(1, len(seq)):
        acc += math.dist(seq[i - 1], seq[i])
        if acc >= reach:
            q = seq[i]
            break
    dx, dy = q[0] - p0[0], q[1] - p0[1]
    d = math.hypot(dx, dy) or 1
    return dx / d, dy / d


def chain(nodes, edges, max_turn_deg=65):
    """At every junction pair up the edges that continue most straight through it."""
    ends = {}  # node -> list of (edge index, at_start)
    for i, (a, b, pts) in enumerate(edges):
        if a >= 0:
            ends.setdefault(a, []).append((i, True))
        if b >= 0:
            ends.setdefault(b, []).append((i, False))
    link = {}  # (edge, at_start) -> (edge, at_start)
    cos_lim = -math.cos(math.radians(max_turn_deg))
    for n, lst in ends.items():
        if len(lst) < 2:
            continue
        cands = []
        for i in range(len(lst)):
            for j in range(i + 1, len(lst)):
                (ei, si), (ej, sj) = lst[i], lst[j]
                if ei == ej:
                    continue
                di = direction_out(edges[ei][2], si)
                dj = direction_out(edges[ej][2], sj)
                dot = di[0] * dj[0] + di[1] * dj[1]  # -1 is perfectly straight
                if dot < cos_lim:
                    cands.append((dot, lst[i], lst[j]))
        cands.sort()
        used = set()
        for dot, u, v in cands:
            if u in used or v in used:
                continue
            used |= {u, v}
            link[u] = v
            link[v] = u
    strokes, done = [], set()

    def walk(ei, from_start):
        pts = []
        cur, start_side = ei, from_start
        closed = False
        while True:
            done.add(cur)
            seg = edges[cur][2] if start_side else edges[cur][2][::-1]
            pts.extend(seg if not pts else seg[1:])
            out = (cur, not start_side)
            nxt = link.get(out)
            if nxt is None:
                break
            if nxt[0] in done:
                closed = nxt[0] == ei
                break
            cur, start_side = nxt[0], nxt[1]
        return pts, closed

    # start from edge ends that have no partner, then whatever loops remain
    for i in range(len(edges)):
        if i in done:
            continue
        if (i, True) not in link:
            pts, c = walk(i, True)
            strokes.append((pts, c))
        elif (i, False) not in link:
            pts, c = walk(i, False)
            strokes.append((pts, c))
    for i in range(len(edges)):
        if i not in done:
            pts, c = walk(i, True)
            strokes.append((pts, True))
    for i, (a, b, pts) in enumerate(edges):
        if a == -2:
            pass
    return strokes


def gauss_smooth(pts, closed, sigma, step=3.0):
    """Resample at even spacing and blur positions along the line. Irons out the kinks
    the skeleton leaves at junctions without moving the ends of open lines."""
    arr = np.array(pts, float)
    if closed and math.dist(pts[0], pts[-1]) > 0:
        arr = np.vstack([arr, arr[:1]])
    seg = np.hypot(*np.diff(arr, axis=0).T)
    t = np.concatenate([[0], np.cumsum(seg)])
    if t[-1] < step * 4:
        return pts
    n = int(t[-1] / step) + 1
    u = np.linspace(0, t[-1], n)
    res = np.stack([np.interp(u, t, arr[:, 0]), np.interp(u, t, arr[:, 1])], axis=1)
    s = sigma / step
    if closed:
        res = res[:-1]
        sm = np.stack([ndi.gaussian_filter1d(res[:, i], s, mode="wrap") for i in range(2)], axis=1)
    else:
        sm = np.stack([ndi.gaussian_filter1d(res[:, i], s, mode="nearest") for i in range(2)], axis=1)
        # keep the true end points; fade the blur in over ~2 sigma
        w = np.clip(np.minimum(u, t[-1] - u) / (2 * sigma), 0, 1)[:, None]
        sm = res * (1 - w) + sm * w
    return [tuple(p) for p in sm]


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = np.array(pts[0], float), np.array(pts[-1], float)
    ab = b - a
    L = np.hypot(*ab)
    arr = np.array(pts, float)
    if L == 0:
        d = np.hypot(*(arr - a).T)
    else:
        v = arr - a
        d = np.abs(ab[0] * v[:, 1] - ab[1] * v[:, 0]) / L
    i = int(d.argmax())
    if d[i] > eps:
        return rdp(pts[: i + 1], eps)[:-1] + rdp(pts[i:], eps)
    return [pts[0], pts[-1]]


def smooth_path(pts, closed):
    """Catmull-Rom through the simplified points, written as cubic Beziers."""
    if closed and pts[0] != pts[-1]:
        pts = pts + [pts[0]]
    n = len(pts)
    if n < 2:
        return ""
    f = lambda v: f"{v:.0f}"
    d = [f"M{f(pts[0][0])} {f(pts[0][1])}"]
    if n == 2:
        d.append(f"L{f(pts[1][0])} {f(pts[1][1])}")
        return "".join(d)
    for i in range(n - 1):
        p0 = pts[i - 1] if i > 0 else (pts[-2] if closed else pts[0])
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < n else (pts[1] if closed else pts[-1])
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d.append(f"C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}")
    if closed:
        d.append("Z")
    return "".join(d)


def process(art_root: Path, key: str):
    level, pid = key.split("/")
    out = WORK / level / pid
    out.mkdir(parents=True, exist_ok=True)
    # Detailed art has thin, close lines: trace it at 2x so gaps between lines survive
    scale = 2 if level == "detailed" else 1
    ink = rasterize(art_root / level / pid / "line.svg", out / "raster.png", SIZE * scale)
    ink = remove_small_holes(ink, max_size=30 * scale * scale)
    ink = remove_small_objects(ink, max_size=30 * scale * scale)
    # typical half line width = median distance-to-edge on the skeleton
    sk0 = skeletonize(ink)
    dt = ndi.distance_transform_edt(ink)
    half_w = float(np.median(dt[sk0]))
    dots, dot_mask = find_dots(ink, half_w)
    lines = ink & ~ndi.binary_dilation(dot_mask, iterations=2)
    lines = remove_small_objects(lines, max_size=int(half_w * half_w * 6))
    sk = skeletonize(lines)
    nodes, edges = build_graph(sk)
    edges = prune(nodes, edges, spur=half_w * 2.2)
    raw = chain(nodes, edges)
    strokes = []
    min_len = half_w * 2.5
    for pts, closed in raw:
        if plen(pts) < min_len:
            continue
        # smooth, then simplify; a chain whose ends meet becomes a loop
        loop = len(pts) > 8 and math.dist(pts[0], pts[-1]) < half_w * (2 if closed else 1.5)
        sm = gauss_smooth([(float(x), float(y)) for x, y in pts], loop, sigma=half_w * 0.9)
        simp = rdp(sm, eps=1.2 * scale)
        if loop:
            simp = simp[:-1] if math.dist(simp[0], simp[-1]) < 1e-6 else simp
            closed = True
        else:
            closed = False
        strokes.append({"len": round(plen(pts) / scale), "closed": closed, "pts": [[round(x / scale, 1), round(y / scale, 1)] for x, y in simp]})
    strokes.sort(key=lambda s: -s["len"])
    for i, s in enumerate(strokes):
        s["id"] = i
        s["d"] = smooth_path([tuple(p) for p in s["pts"]], s["closed"])
    dots = [{k: round(v / scale, 1) for k, v in d.items()} for d in dots]
    data = {"source": key, "strokeWidth": round(half_w * 2 / scale, 1), "dots": dots, "strokes": strokes}
    (out / "strokes.json").write_text(json.dumps(data))
    labeled_svg(data, out / "strokes-labeled.svg")
    subprocess.run(["rsvg-convert", "-w", "1000", "-h", "1000", "-b", "white", str(out / "strokes-labeled.svg"), "-o", str(out / "strokes-labeled.png")], check=True)
    print(f"{key}: half width {half_w:.1f}px, {len(strokes)} strokes, {len(dots)} dots")


PALETTE = ["#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4", "#46a0b0", "#f032e6", "#9a9d10", "#008080", "#9a6324", "#800000", "#2a6f2a", "#808000", "#000075", "#d4a017"]


def labeled_svg(data, path):
    sw = data["strokeWidth"]
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">',
             f'<image href="raster.png" width="1000" height="1000" opacity="0.12"/>']
    for s in data["strokes"]:
        c = PALETTE[s["id"] % len(PALETTE)]
        parts.append(f'<path d="{s["d"]}" fill="none" stroke="{c}" stroke-width="{max(4, sw * 0.45):.0f}" stroke-linecap="round" stroke-linejoin="round"/>')
    for d in data["dots"]:
        parts.append(f'<circle cx="{d["cx"]}" cy="{d["cy"]}" r="{d["r"]}" fill="#888"/>')
    for s in data["strokes"]:
        c = PALETTE[s["id"] % len(PALETTE)]
        x, y = s["pts"][0]
        parts.append(f'<circle cx="{x}" cy="{y}" r="9" fill="{c}"/>')
        mx, my = s["pts"][len(s["pts"]) // 2]
        parts.append(f'<text x="{mx + 8}" y="{my - 8}" font-family="Helvetica" font-weight="bold" font-size="26" fill="{c}" stroke="white" stroke-width="5" paint-order="stroke">{s["id"]}</text>')
    parts.append("</svg>")
    path.write_text("".join(parts))


if __name__ == "__main__":
    art = Path(sys.argv[1])
    for k in sys.argv[2:]:
        process(art, k)
