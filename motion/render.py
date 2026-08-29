#!/usr/bin/env python3
"""
Re-typesets the four "100 premiers jours" clips with the brand type system.

The source clips arrive with placeholder typography burnt into the pixels, so
each frame is first patched (the burnt text is reconstructed away from the
surrounding plate) and then re-lettered in Switzer + the script face.

Usage:
    python3 motion/render.py            # render every clip
    python3 motion/render.py clip1      # render one
    python3 motion/render.py --stills   # contact sheets only, no encode
"""

import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
SPEC = json.load(open(os.path.join(ROOT, "spec.json")))
SYS = SPEC["system"]
FPS = SYS["fps"]
W, H = SYS["width"], SYS["height"]
PALETTE = {k: tuple(v) for k, v in SYS["palette"].items()}
ANIM = SYS["animation"]
COMP = SYS["composition"]

OUT = os.path.join(ROOT, "out")


# ---------------------------------------------------------------- easing ----

def out_cubic(t):
    t = clamp01(t)
    return 1.0 - (1.0 - t) ** 3


def clamp01(t):
    return 0.0 if t < 0 else (1.0 if t > 1 else t)


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    return tuple(int(round(lerp(a, b, t))) for a, b in zip(c1, c2))


# ------------------------------------------------------------- type setting -

_FONT_CACHE = {}


def font(key, size):
    path = os.path.join(ROOT, SYS["fonts"][key])
    ck = (path, size)
    if ck not in _FONT_CACHE:
        _FONT_CACHE[ck] = ImageFont.truetype(path, size)
    return _FONT_CACHE[ck]


def draw_tracked(draw, xy, text, fnt, fill, tracking=0.0):
    """Draw text letter by letter so we can apply letter-spacing."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking


def tracked_width(draw, text, fnt, tracking=0.0):
    if not text:
        return 0.0
    w = sum(draw.textlength(ch, font=fnt) for ch in text)
    return w + tracking * (len(text) - 1)


def render_text_layer(text, fnt, color, tracking=0.0, pad=40):
    """Render text on its own RGBA layer; returns (layer, ink_box)."""
    probe = ImageDraw.Draw(Image.new("L", (1, 1)))
    tw = tracked_width(probe, text, fnt, tracking)
    asc, desc = fnt.getmetrics()
    lw, lh = int(tw) + pad * 2, asc + desc + pad * 2

    layer = Image.new("RGBA", (lw, lh), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    draw_tracked(d, (pad, pad), text, fnt, color + (255,), tracking)

    box = layer.getbbox() or (pad, pad, pad + int(tw), pad + asc)
    return layer, box


def ink_height(text, fnt, tracking=0.0):
    _, box = render_text_layer(text, fnt, (255, 255, 255), tracking)
    return box[3] - box[1]


def fit_script_size(text, target_h, lo=10, hi=400):
    """
    Point size is a poor handle on the script face: a short all-lowercase word
    like "tes" renders far smaller than "on te nomme" at the same size. Solve
    for the size whose rendered ink height matches the target instead.
    """
    for _ in range(24):
        mid = (lo + hi) // 2
        if mid <= lo:
            break
        if ink_height(text, font("script", mid)) < target_h:
            lo = mid
        else:
            hi = mid
    return max(12, lo)


def wipe_alpha(layer, ink_box, progress, feather):
    """Left-to-right reveal: a soft-edged mask sweeping across the ink."""
    if progress >= 1.0:
        return layer
    lw, lh = layer.size
    x0, x1 = ink_box[0], ink_box[2]
    edge = x0 - feather + out_cubic(progress) * (x1 - x0 + 2 * feather)

    xs = np.arange(lw, dtype=np.float32)
    ramp = np.clip((edge - xs) / max(feather, 1), 0.0, 1.0)

    a = np.array(layer.getchannel("A"), dtype=np.float32)
    a *= ramp[None, :]
    out = layer.copy()
    out.putalpha(Image.fromarray(a.astype(np.uint8), "L"))
    return out


def composite(base, layer, pos, alpha=1.0):
    if alpha <= 0.001:
        return
    if alpha < 0.999:
        a = np.array(layer.getchannel("A"), dtype=np.float32) * alpha
        layer = layer.copy()
        layer.putalpha(Image.fromarray(a.astype(np.uint8), "L"))
    base.alpha_composite(layer, (int(pos[0]), int(pos[1])))


# ------------------------------------------------------------- plate repair -

def repair(frame, box, mode=None, feather=None):
    """
    Rebuild a rectangle of plate over burnt-in placeholder text.

    Solves a discrete Laplace equation inside the box with the untouched ring
    of pixels around it as the boundary condition, so the repair inherits the
    plate's gradient from all four sides -- a radial vignette stays radial
    instead of flattening into a band. Relaxation runs on a quarter-scale grid
    (the plates are smooth, so the detail isn't there to lose) and is then
    resampled up, grained to match, and feathered in.
    """
    x0, y0, x1, y1 = (int(v) for v in box)
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(W, x1), min(H, y1)
    if x1 - x0 < 8 or y1 - y0 < 8:
        return

    m = 10                                   # boundary ring thickness
    ox0, oy0 = max(0, x0 - m), max(0, y0 - m)
    ox1, oy1 = min(W, x1 + m), min(H, y1 + m)

    outer = frame[oy0:oy1, ox0:ox1, :3].astype(np.float32)
    oh, ow = outer.shape[:2]

    s = 4                                    # relaxation downscale
    sh, sw = max(4, oh // s), max(4, ow // s)
    small = np.array(
        Image.fromarray(outer.astype(np.uint8)).resize((sw, sh), Image.BOX),
        dtype=np.float32)

    # unknown region = the box itself, mapped into the small grid
    ix0 = max(1, int(round((x0 - ox0) / ow * sw)))
    iy0 = max(1, int(round((y0 - oy0) / oh * sh)))
    ix1 = min(sw - 1, int(round((x1 - ox0) / ow * sw)))
    iy1 = min(sh - 1, int(round((y1 - oy0) / oh * sh)))
    if ix1 <= ix0 or iy1 <= iy0:
        return

    known = np.ones((sh, sw), dtype=bool)
    known[iy0:iy1, ix0:ix1] = False

    grid = small.copy()
    ring = small[known]
    # median, not mean: a thin frame rule crossing the ring is a minority of
    # pixels and must not drag the fill toward its colour
    seed = np.median(ring, axis=0)
    grid[~known] = seed

    if mode == "flat":
        # a flat plate needs no relaxation -- the robust seed *is* the answer
        filled_small = grid
    else:
        filled_small = None

    for _ in range(0 if mode == "flat" else 400):
        nb = np.zeros_like(grid)
        nb[1:-1, 1:-1] = (grid[:-2, 1:-1] + grid[2:, 1:-1] +
                          grid[1:-1, :-2] + grid[1:-1, 2:]) * 0.25
        grid = np.where(known[:, :, None], small, nb)

    filled = np.array(
        Image.fromarray(np.clip(filled_small if filled_small is not None else grid,
                                0, 255).astype(np.uint8))
             .resize((ow, oh), Image.BICUBIC),
        dtype=np.float32)

    patch = filled[y0 - oy0:y1 - oy0, x0 - ox0:x1 - ox0]
    region = frame[y0:y1, x0:x1, :3].astype(np.float32)
    hgt, wid = patch.shape[:2]

    # match the plate's grain so the repair doesn't read as a clean card
    grain = 0.0
    if len(ring) > 8:
        dev = np.abs(ring - seed).sum(axis=1)
        clean = ring[dev <= np.quantile(dev, 0.75)]
        if len(clean) > 4:
            grain = float(np.std(clean - np.median(clean, axis=0))) * 0.8
    if grain > 0.2:
        rng = np.random.default_rng(x0 * 7919 + y0 * 104729)
        patch = patch + rng.normal(0.0, min(grain, 2.5), patch.shape).astype(np.float32)

    # feathered edge so the seam disappears
    # a flat fill matches the plate exactly, so it needs no feathered seam --
    # and a feather there would only let the old ink bleed back through
    default_f = 0 if mode == "flat" else 26
    f = min(default_f if feather is None else feather, hgt // 3, wid // 3)
    fy = np.ones(hgt, dtype=np.float32)
    fx = np.ones(wid, dtype=np.float32)
    if f > 1:
        ramp = np.linspace(0.0, 1.0, f, dtype=np.float32)
        fy[:f], fy[-f:] = ramp, ramp[::-1]
        fx[:f], fx[-f:] = ramp, ramp[::-1]
    a = (fy[:, None] * fx[None, :])[:, :, None]

    frame[y0:y1, x0:x1, :3] = np.clip(
        region * (1 - a) + patch * a, 0, 255).astype(np.uint8)


# --------------------------------------------------------------- animation --

def entry_state(t, start, dur, rise):
    """Fade + rise for the Switzer layers."""
    if t < start:
        return 0.0, rise
    e = out_cubic((t - start) / dur)
    return e, rise * (1.0 - e)


def exit_alpha(t, duration):
    ex = ANIM["exit"]
    s = duration - ex["before_end"]
    if t < s:
        return 1.0
    return 1.0 - clamp01((t - s) / ex["dur"])


def gold_mix(t, gold_at):
    if gold_at is None:
        return 0.0
    return clamp01((t - gold_at) / ANIM["gold_shift"]["dur"])


# ------------------------------------------------------------------ lockup --

def draw_lockup(base, t, lk, duration):
    """Script word above, smaller, offset, overlapping the Switzer title."""
    si, sc = ANIM["switzer_in"], ANIM["script_in"]
    start = lk["start"]
    out_a = exit_alpha(t, duration)
    if out_a <= 0.0 and t > start:
        return

    title, script = lk["title"], lk["script"]

    # --- Switzer title -----------------------------------------------------
    tf = font("title", title["size"])
    t_color = PALETTE[title["color"]]
    if "gold_from" in title:
        t_color = mix(PALETTE[title["gold_from"]], PALETTE[title["color"]],
                      gold_mix(t, lk.get("gold_at")))
    t_layer, t_box = render_text_layer(title["text"], tf, t_color,
                                       title.get("tracking", 0))
    t_w = t_box[2] - t_box[0]
    t_x = lk["center_x"] - t_w / 2 - t_box[0]
    t_y = lk["title_top"] - t_box[1]

    a_t, dy_t = entry_state(t, start, si["dur"], si["rise"])
    composite(base, t_layer, (t_x, t_y + dy_t), a_t * out_a)

    # --- script word -------------------------------------------------------
    t_ink_h = t_box[3] - t_box[1]
    s_size = fit_script_size(script["text"],
                             t_ink_h * lk.get("script_ratio",
                                              COMP["script_ratio"]))
    sf = font("script", s_size)
    s_color = PALETTE[script["color"]]
    if "gold_from" in script:
        s_color = mix(PALETTE[script["gold_from"]], PALETTE[script["color"]],
                      gold_mix(t, lk.get("gold_at")))
    s_layer, s_box = render_text_layer(script["text"], sf, s_color)
    s_h = s_box[3] - s_box[1]

    # sits above the title and dips into it by `script_overlap` of its height
    s_x = t_x + t_box[0] + lk.get("script_offset_x",
                                  COMP["script_offset_x"]) - s_box[0]
    overlap = lk.get("script_overlap", COMP["script_overlap"])
    s_y = lk["title_top"] - s_h + s_h * overlap - s_box[1]

    s_start = start - sc["lead"]
    s_prog = clamp01((t - s_start) / sc["dur"]) if t >= s_start else 0.0
    if s_prog > 0:
        composite(base, wipe_alpha(s_layer, s_box, s_prog, sc["feather"]),
                  (s_x, s_y), out_a)

    # --- optional rule -----------------------------------------------------
    rule = lk.get("rule")
    if rule and a_t > 0:
        rl = Image.new("RGBA", (rule["half_width"] * 2, rule["thickness"]),
                       tuple(PALETTE[rule["color"]]) + (255,))
        rw = out_cubic(clamp01((t - start) / sc["dur"]))
        if rw > 0:
            cut = max(1, int(rl.width * rw))
            composite(base, rl.crop((0, 0, cut, rl.height)),
                      (lk["center_x"] - rule["half_width"], rule["y"] + dy_t),
                      out_a)


# ------------------------------------------------------- card-tracked labels -

def find_cards(frame, row, expect=3):
    """Locate the bright card panels on a probe row (they push in over time)."""
    lum = frame[row, :, :3].astype(np.float32).mean(axis=1)
    on = lum > 170
    runs, s = [], None
    for x, b in enumerate(on):
        if b and s is None:
            s = x
        elif not b and s is not None:
            if x - s > 60:
                runs.append((s, x - 1))
            s = None
    if s is not None and len(on) - s > 60:
        runs.append((s, len(on) - 1))
    return runs if len(runs) == expect else None


def card_geometry(frame, cfg, last):
    """Per-frame card boxes; the shot slowly pushes in so these move."""
    runs = find_cards(frame, cfg["probe_row"]) or last
    if not runs:
        return None
    geo = []
    for x0, x1 in runs:
        cw = x1 - x0
        scale = cw / cfg["ref_width"]
        cx = (x0 + x1) / 2
        # the push-in scales about the frame centre
        cy = cfg["label_y"] * scale + (H / 2) * (1 - scale)
        geo.append((x0, x1, cx, cy, scale))
    return geo


def patch_cards(frame, cfg, geo):
    for x0, x1, cx, cy, scale in geo:
        ph = int(cfg["patch_h"] * scale)
        inset = int((x1 - x0) * 0.06)
        repair(frame, [int(x0 + inset), int(cy - ph / 2),
                       int(x1 - inset), int(cy + ph / 2)], "light")


def label_cards(base, t, cfg, duration, geo):
    out_a = exit_alpha(t, duration)
    si = ANIM["switzer_in"]
    for i, (x0, x1, cx, cy, scale) in enumerate(geo):
        start = cfg["start"] + i * cfg["stagger"]
        a, dy = entry_state(t, start, si["dur"], si["rise"])
        if a * out_a <= 0.001:
            continue
        f = font("label", max(10, int(round(cfg["size"] * scale))))
        layer, box = render_text_layer(cfg["labels"][i], f,
                                       PALETTE[cfg["color"]],
                                       cfg["tracking"] * scale)
        lw, lh = box[2] - box[0], box[3] - box[1]
        composite(base, layer,
                  (cx - lw / 2 - box[0], cy - lh / 2 - box[1] + dy),
                  a * out_a)


# ------------------------------------------------------------------ driving -

def probe_frames(path):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-count_frames", "-show_entries", "stream=nb_read_frames",
         "-of", "default=nw=1:nk=1", path],
        capture_output=True, text=True, check=True)
    return int(r.stdout.strip())


def render_clip(clip, stills_only=False):
    src = os.path.join(ROOT, clip["src"])
    dst = os.path.join(OUT, clip["id"] + ".mp4")
    os.makedirs(OUT, exist_ok=True)

    n_frames = probe_frames(src)
    duration = n_frames / FPS
    print(f"  {clip['id']}: {n_frames} frames / {duration:.2f}s")

    dec = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", src, "-f", "rawvideo",
         "-pix_fmt", "rgb24", "pipe:1"], stdout=subprocess.PIPE)

    enc = None
    if not stills_only:
        enc = subprocess.Popen(
            ["ffmpeg", "-v", "error", "-y",
             "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
             "-r", str(FPS), "-i", "pipe:0",
             "-i", src,
             "-map", "0:v:0", "-map", "1:a:0?",
             "-c:v", "libx264", "-preset", "slow", "-crf", "17",
             "-pix_fmt", "yuv420p", "-movflags", "+faststart",
             "-c:a", "aac", "-b:a", "160k", dst],
            stdin=subprocess.PIPE)

    stills, want = [], {int(n_frames * f) for f in (0.15, 0.35, 0.6, 0.85, 0.98)}
    last_cards, n = None, 0
    fsize = W * H * 3

    while True:
        buf = dec.stdout.read(fsize)
        if len(buf) < fsize:
            break
        frame = np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()
        t = n / FPS

        # 1. repair the plate where placeholder type was burnt in
        for p in clip.get("patches", []):
            repair(frame, p["box"], p["mode"], p.get("feather"))

        geo = None
        if "cards" in clip:
            geo = card_geometry(frame, clip["cards"], last_cards)
            if geo:
                last_cards = [(g[0], g[1]) for g in geo]
                patch_cards(frame, clip["cards"], geo)

        # 2. re-letter on the repaired plate
        base = Image.fromarray(frame).convert("RGBA")
        if "lockup" in clip:
            draw_lockup(base, t, clip["lockup"], duration)
        if geo:
            label_cards(base, t, clip["cards"], duration, geo)

        rgb = base.convert("RGB")
        if n in want:
            stills.append(rgb.copy())
        if enc:
            enc.stdin.write(np.array(rgb).tobytes())
        n += 1

    dec.stdout.close()
    dec.wait()
    if enc:
        enc.stdin.close()
        enc.wait()

    if stills:
        sheet = Image.new("RGB", (len(stills) * 240, 427))
        for i, s in enumerate(stills):
            sheet.paste(s.resize((240, 427)), (i * 240, 0))
        sheet.save(os.path.join(OUT, clip["id"] + "_sheet.png"))

    print(f"    -> {dst if enc else '(stills only)'}")


def stitch():
    """Join the four finished plans into one preview reel."""
    listing = os.path.join(OUT, "reel.txt")
    with open(listing, "w") as fh:
        for c in SPEC["clips"]:
            fh.write(f"file '{os.path.join(OUT, c['id'] + '.mp4')}'\n")
    dst = os.path.join(OUT, "reel.mp4")
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
         "-i", listing, "-c:v", "libx264", "-preset", "slow", "-crf", "17",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart",
         "-c:a", "aac", "-b:a", "160k", dst], check=True)
    os.remove(listing)
    print(f"  reel -> {dst}")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    stills_only = "--stills" in sys.argv
    clips = [c for c in SPEC["clips"] if not args or c["id"] in args]
    print(f"rendering {len(clips)} clip(s)")
    for c in clips:
        render_clip(c, stills_only)
    if not stills_only and len(clips) == len(SPEC["clips"]):
        stitch()


if __name__ == "__main__":
    main()
