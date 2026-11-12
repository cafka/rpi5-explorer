"""
akaze_360_overlay.py — superpone, en la vista GPIO rectificada con la homografía de 640 px,
la proyección GPIO de 640 px (cian) y la de 360 px (amarillo). Fuera de la app.
Requiere la salida de akaze_360_compare.py.

Uso: python tools/analysis/akaze_360_overlay.py <carpeta_salida>
Escribe: gpio_640_vs_360.png
Nota: la vista se rectifica con la homografía de 640 px; si ésta tuviera error (p. ej. 145556_f3,
desplazada en el análisis previo), el conector no quedará alineado con el recuadro cian.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
out = sys.argv[1]
cases = json.load(open(os.path.join(out, "cases.json")))
R = json.load(open(os.path.join(out, "akaze_360.json")))
z = json.load(open(os.path.join(ROOT, "app/data/zones.json"), encoding="utf-8"))
poly = z["zones"][0]["polygon_px"]
BX, BY = int(np.floor(min(p[0] for p in poly))), int(np.floor(min(p[1] for p in poly)))
BW, BH = int(np.ceil(max(p[0] for p in poly))) - BX, int(np.ceil(max(p[1] for p in poly))) - BY
M, Zm = 40, 1.6
items = []
for c, r in zip(cases, R):
    a, b = r["w640"], r["w360"]
    if not (a["found"] and a["H"]):
        items.append((f"{c['id']} · 640 px sin placa", None)); continue
    H640 = np.array(a["H"], float).reshape(3, 3)
    T = np.array([[1, 0, BX - M], [0, 1, BY - M], [0, 0, 1]], float); A = H640 @ T; A = A / A[2, 2]
    cf = (A[0, 0], A[0, 1], A[0, 2], A[1, 0], A[1, 1], A[1, 2], A[2, 0], A[2, 1])
    im = Image.open(os.path.join(out, f"{c['id']}_640.png")).convert("RGB")
    v = im.transform((BW + 2 * M, BH + 2 * M), Image.PERSPECTIVE, cf, Image.BILINEAR)
    v = v.resize((int(v.width * Zm), int(v.height * Zm)), Image.LANCZOS); d = ImageDraw.Draw(v)
    toV = lambda X, Y: ((X - (BX - M)) * Zm, (Y - (BY - M)) * Zm)
    d.rectangle([*toV(BX, BY), *toV(BX + BW, BY + BH)], outline=(0, 230, 255), width=2)   # 640 px
    label = f"{c['id']} · cian = GPIO 640 px · "
    if b["found"] and b["gpio"]:
        sx, sy = c["w640"] / c["w360"], c["h640"] / c["h360"]
        inv = np.linalg.inv(H640)
        pts = []
        for x, y in b["gpio"]:
            p = inv @ np.array([x * sx, y * sy, 1.0]); p = p / p[2]
            pts.append(toV(p[0], p[1]))
        d.line(pts + [pts[0]], fill=(255, 230, 0), width=2)
        label += "amarillo = GPIO 360 px"
    else:
        label += "360 px: placa NO aceptada"
    items.append((label, v))
wmax = max(v.width for _, v in items if v) + 20
sh = Image.new("RGB", (wmax, sum((v.height if v else 0) + 22 for _, v in items) + 10), (22, 22, 22)); ds = ImageDraw.Draw(sh); y = 6
for label, v in items:
    ds.text((10, y), label, fill=(220, 240, 220)); y += 14
    if v: sh.paste(v, (10, y)); y += v.height + 8
    else: y += 8
sh.save(os.path.join(out, "gpio_640_vs_360.png"))
print("gpio_640_vs_360.png", sh.size)
