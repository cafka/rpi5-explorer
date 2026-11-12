"""
gpio_crop_test.py — prueba, SOLO en el análisis, una corrección del borde derecho del marcado.
Uso: python tools/analysis/gpio_crop_test.py <carpeta_salida> <x_derecho_corregido>

Compara la periodicidad v2 (tendencia por tercio) con la caja original de zones.json y con la
caja corregida, en la referencia, los 6 cuadros (homografía AKAZE) y las franjas de control
(misma caja desplazada en y). No modifica zones.json ni la app.
Escribe: prueba_borde_derecho.json y prueba_borde_derecho.png
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
out, X1 = sys.argv[1], int(sys.argv[2])
z = json.load(open(os.path.join(ROOT, "app/data/zones.json"), encoding="utf-8"))
poly = z["zones"][0]["polygon_px"]
BX, BY = int(np.floor(min(p[0] for p in poly))), int(np.floor(min(p[1] for p in poly)))
X0, BH = int(np.ceil(max(p[0] for p in poly))), int(np.ceil(max(p[1] for p in poly))) - BY
meta = json.load(open(os.path.join(out, "akaze_meta.json")))
ref_img = Image.open(os.path.join(ROOT, "app/data/reference", z["image"]["file"])).convert("RGB")
CONTROLS = {"control RAM/«Raspberry Pi 5»": -120, "control CPU": -250, "control HDMI/USB-C": -420}

def warp(img, H, x0, x1, dy=0):
    W = x1 - x0
    Hm = np.array(H, float).reshape(3, 3) if H is not None else np.eye(3)
    T = np.array([[1, 0, x0], [0, 1, BY + dy], [0, 0, 1]], float)
    A = Hm @ T; A = A / A[2, 2]
    c = (A[0, 0], A[0, 1], A[0, 2], A[1, 0], A[1, 1], A[1, 2], A[2, 0], A[2, 1])
    return np.asarray(img.transform((W, BH), Image.PERSPECTIVE, c, Image.BILINEAR).convert("L"), float)

def v2(patch):
    W = patch.shape[1]; P = W / 20.0; seg = W // 3; res = []
    prof = patch.mean(axis=0)
    for s in range(3):
        p = prof[s * seg:(s + 1) * seg]
        k = max(3, int(round(2 * P)) | 1)
        tr = np.convolve(np.pad(p, k // 2, mode="reflect"), np.ones(k) / k, mode="valid")
        x = p - tr; x = x - x.mean(); den = (x * x).sum() or 1.0
        res.append(round(max(float((x[:-L] * x[L:]).sum() / den) for L in range(int(0.8 * P), int(1.2 * P) + 1)), 2))
    return res

boxes = {f"original x {BX}–{X0}": X0, f"corregida x {BX}–{X1}": X1}
rep = {"nota": "corrección probada solo en el análisis; zones.json sin cambios", "boxes": {}}
for name, x1 in boxes.items():
    r = {"ref": v2(warp(ref_img, None, BX, x1)), "frames": [], "ctrl": {}}
    for f in meta["frames"]:
        fr = Image.open(os.path.join(out, f"f{f['i']}.png")).convert("RGB")
        r["frames"].append(v2(warp(fr, f["H"], BX, x1)))
        for c, dy in CONTROLS.items():
            r["ctrl"].setdefault(c, []).append(v2(warp(fr, f["H"], BX, x1, dy)))
    rep["boxes"][name] = r
json.dump(rep, open(os.path.join(out, "prueba_borde_derecho.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# Imagen: extremo derecho de la referencia y de f2 con ambos bordes
items = []
for label, img, H in (("referencia", ref_img, None),) + tuple(
        (f"f{f['i']}", Image.open(os.path.join(out, f"f{f['i']}.png")).convert("RGB"), f["H"]) for f in meta["frames"]):
    a = warp(img, H, X0 - 200, X0 + 30)
    im = Image.fromarray(a.astype(np.uint8)).convert("RGB").resize((230 * 3, BH * 3), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    d.line([((200) * 3, 0), (200 * 3, BH * 3)], fill=(255, 40, 40), width=2)          # borde original
    d.line([((X1 - (X0 - 200)) * 3, 0), ((X1 - (X0 - 200)) * 3, BH * 3)], fill=(0, 220, 255), width=2)  # corregido
    items.append((label, im))
sh = Image.new("RGB", (items[0][1].width + 20, len(items) * (BH * 3 + 22) + 10), (22, 22, 22)); dd = ImageDraw.Draw(sh); y = 6
for label, im in items:
    dd.text((10, y), f"{label} · extremo derecho · rojo = borde original x {X0} · cian = corregido x {X1}", fill=(220, 240, 220)); y += 14
    sh.paste(im, (10, y)); y += im.height + 8
sh.save(os.path.join(out, "prueba_borde_derecho.png"))

def rng(rows, k): return f"{min(r[k] for r in rows):+.2f}…{max(r[k] for r in rows):+.2f}"
for name, r in rep["boxes"].items():
    print(f"\n== caja {name} ==  referencia {r['ref']}")
    print(f"  GPIO (6 cuadros)        t1 {rng(r['frames'], 0)}  t2 {rng(r['frames'], 1)}  t3 {rng(r['frames'], 2)}")
    for c, rows in r["ctrl"].items():
        print(f"  {c:24s}t1 {rng(rows, 0)}  t2 {rng(rows, 1)}  t3 {rng(rows, 2)}")
    print(f"  tercio 3 por cuadro: {[fr[2] for fr in r['frames']]}")
