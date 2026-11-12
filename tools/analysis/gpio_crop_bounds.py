"""
gpio_crop_bounds.py — superpone los límites del recorte GPIO sobre la referencia y los cuadros.
Fuera de la app. Requiere la salida de gpio_session_analysis.mjs (akaze_meta.json, f<i>.png).

Uso: python tools/analysis/gpio_crop_bounds.py <carpeta_salida> [margen_px_ref]

Para cada imagen rectifica una zona AMPLIADA (caja del GPIO + margen, en coordenadas de la
referencia) con la misma homografía que usa el cálculo, y dibuja dentro:
  - rojo:     límites del recorte actual (caja de zones.json, floor/ceil)
  - amarillo: divisiones de los 3 tercios
Así se ve, en la misma geometría para todas, qué queda fuera y qué entra en el recorte.
Escribe: limites_referencia.png, limites_cuadros.png
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
out = sys.argv[1]
M = int(sys.argv[2]) if len(sys.argv) > 2 else 40
z = json.load(open(os.path.join(ROOT, "app/data/zones.json"), encoding="utf-8"))
poly = z["zones"][0]["polygon_px"]
xs, ys = [p[0] for p in poly], [p[1] for p in poly]
BX, BY = int(np.floor(min(xs))), int(np.floor(min(ys)))
BW, BH = int(np.ceil(max(xs))) - BX, int(np.ceil(max(ys))) - BY
meta = json.load(open(os.path.join(out, "akaze_meta.json")))
S = 2

def rect_view(img, H):
    """Rectifica la caja ampliada [BX-M, BY-M, BW+2M, BH+2M] (coords ref) a través de H (ref→img)."""
    Hm = np.array(H, float).reshape(3, 3) if H is not None else np.eye(3)
    T = np.array([[1, 0, BX - M], [0, 1, BY - M], [0, 0, 1]], float)
    A = Hm @ T; A = A / A[2, 2]
    c = (A[0, 0], A[0, 1], A[0, 2], A[1, 0], A[1, 1], A[1, 2], A[2, 0], A[2, 1])
    W, Hh = BW + 2 * M, BH + 2 * M
    v = img.transform((W, Hh), Image.PERSPECTIVE, c, Image.BILINEAR).resize((W * S, Hh * S), Image.LANCZOS)
    d = ImageDraw.Draw(v)
    d.rectangle([M * S, M * S, (M + BW) * S, (M + BH) * S], outline=(255, 40, 40), width=2)
    seg = BW // 3
    for k in (1, 2):
        x = (M + k * seg) * S
        d.line([(x, M * S), (x, (M + BH) * S)], fill=(255, 230, 0), width=2)
    return v

def sheet(items, path):
    W = max(im.width for _, im in items) + 20
    Hh = sum(im.height + 22 for _, im in items) + 10
    sh = Image.new("RGB", (W, Hh), (22, 22, 22)); d = ImageDraw.Draw(sh); y = 6
    for label, im in items:
        d.text((10, y), label, fill=(220, 240, 220)); y += 14
        sh.paste(im, (10, y)); y += im.height + 8
    sh.save(path)

ref = Image.open(os.path.join(ROOT, "app/data/reference", z["image"]["file"])).convert("RGB")
sheet([(f"REFERENCIA · caja {BX},{BY} {BW}x{BH} px · margen {M} px · rojo = recorte · amarillo = tercios", rect_view(ref, None))],
      os.path.join(out, "limites_referencia.png"))
items = []
for f in meta["frames"]:
    fr = Image.open(os.path.join(out, f"f{f['i']}.png")).convert("RGB")
    items.append((f"cuadro f{f['i']} · misma zona ampliada, rectificada con la homografía AKAZE", rect_view(fr, f["H"])))
sheet(items, os.path.join(out, "limites_cuadros.png"))
print(f"caja GPIO en la referencia: x {BX}–{BX + BW}, y {BY}–{BY + BH} ({BW}x{BH}); margen {M} px")
