"""
akaze_360_compare.py — prepara los cuadros reales, corre la comparación AKAZE 640 vs 360 px y
genera las imágenes para revisión visual. Fuera de la app.

Uso: python tools/analysis/akaze_360_compare.py <carpeta_salida> <sesion1.json> [<sesion2.json> ...]

Aproximación declarada: el teléfono reduciría su canvas (720x1280) directamente a 360x640;
aquí se parte del cuadro procesado a 640x1138 guardado en la sesión y se reduce a 360x640
(bilineal, como el navegador). La proporción se conserva con < 0,5 px de diferencia.

Salida: cases.json, akaze_360.json (por akaze_360_compare.mjs),
        comparacion_640_360.png (cuadros completos: cian/naranja = 640 px, magenta/amarillo = 360 px),
        gpio_360_ampliado.png (zona GPIO ampliada, rectificada con la homografía de 360 px),
        resumen_640_360.json
"""
import base64, io, json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
out, sessions = sys.argv[1], sys.argv[2:]
os.makedirs(out, exist_ok=True)
cases = []
for sp in sessions:
    s = json.load(open(sp, encoding="utf-8"))
    tag = os.path.splitext(os.path.basename(sp))[0].split("-")[0][-6:]   # hora HHMMSS del id
    for i, f in enumerate(s["frames"]):
        im = Image.open(io.BytesIO(base64.b64decode(f["processedFramePng"].split(",", 1)[1]))).convert("RGBA")
        cid = f"{tag}_f{i}"
        p640 = os.path.join(out, f"{cid}_640.rgba"); open(p640, "wb").write(im.tobytes())
        im.convert("RGB").save(os.path.join(out, f"{cid}_640.png"))
        h360 = round(im.height * 360 / im.width)
        sm = im.resize((360, h360), Image.BILINEAR)
        p360 = os.path.join(out, f"{cid}_360.rgba"); open(p360, "wb").write(sm.tobytes())
        cases.append({"id": cid, "w640": im.width, "h640": im.height, "rgba640": p640,
                      "w360": 360, "h360": h360, "rgba360": p360})
json.dump(cases, open(os.path.join(out, "cases.json"), "w"), indent=1)
subprocess.run(["node", os.path.join(ROOT, "tools", "analysis", "akaze_360_compare.mjs"), out], check=True, cwd=ROOT)
R = json.load(open(os.path.join(out, "akaze_360.json")))
for c in cases:
    os.remove(c["rgba640"]); os.remove(c["rgba360"])

def up(poly, sx, sy): return [[p[0] * sx, p[1] * sy] for p in poly] if poly else None
def maxdist(a, b): return max(float(np.hypot(p[0] - q[0], p[1] - q[1])) for p, q in zip(a, b)) if a and b else None

summary = []
for c, r in zip(cases, R):
    sx, sy = c["w640"] / c["w360"], c["h640"] / c["h360"]
    g360 = up(r["w360"]["gpio"], sx, sy); b360 = up(r["w360"]["board"], sx, sy)
    summary.append({"id": c["id"],
                    "found640": r["w640"]["found"], "found360": r["w360"]["found"],
                    "inl640": r["w640"]["inliers"], "inl360": r["w360"]["inliers"],
                    "ms640": r["w640"]["ms"], "ms360": r["w360"]["ms"],
                    "dGPIO_px640": None if not (r["w640"]["found"] and r["w360"]["found"]) else round(maxdist(r["w640"]["gpio"], g360), 1),
                    "dPlaca_px640": None if not (r["w640"]["found"] and r["w360"]["found"]) else round(maxdist(r["w640"]["board"], b360), 1)})
json.dump(summary, open(os.path.join(out, "resumen_640_360.json"), "w"), indent=1)

# ── Hoja de cuadros completos ─────────────────────────────────────────────────
S = 0.25; W, H = int(640 * S), int(1138 * S); cols = 6
rows = (len(cases) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (W + 6) + 6, rows * (H + 36) + 8), (25, 25, 25)); d = ImageDraw.Draw(sheet)
for k, (c, r, sm) in enumerate(zip(cases, R, summary)):
    im = Image.open(os.path.join(out, f"{c['id']}_640.png")).convert("RGB"); dd = ImageDraw.Draw(im)
    sx, sy = c["w640"] / c["w360"], c["h640"] / c["h360"]
    for res, cb, cg, wd, scale in ((r["w640"], (0, 230, 255), (255, 140, 0), 9, (1, 1)), (r["w360"], (255, 0, 255), (255, 255, 0), 4, (sx, sy))):
        if res["found"] and res["board"]:
            b = [tuple(p) for p in up(res["board"], *scale)]; dd.line(b + [b[0]], fill=cb, width=wd)
        if res["found"] and res["gpio"]:
            g = [tuple(p) for p in up(res["gpio"], *scale)]; dd.line(g + [g[0]], fill=cg, width=wd)
    im = im.resize((W, H)); x, y = 6 + (k % cols) * (W + 6), 6 + (k // cols) * (H + 36); sheet.paste(im, (x, y))
    d.text((x + 2, y + H + 2), f"{c['id']} 640:{'OK' if sm['found640'] else 'NO'} 360:{'OK' if sm['found360'] else 'NO'}", fill=(230, 240, 230))
    d.text((x + 2, y + H + 16), f"inl {sm['inl640']}/{sm['inl360']} dGPIO {sm['dGPIO_px640']}", fill=(255, 210, 120))
sheet.save(os.path.join(out, "comparacion_640_360.png"))

# ── Zona GPIO ampliada con la homografía de 360 px ────────────────────────────
z = json.load(open(os.path.join(ROOT, "app/data/zones.json"), encoding="utf-8"))
poly = z["zones"][0]["polygon_px"]
BX, BY = int(np.floor(min(p[0] for p in poly))), int(np.floor(min(p[1] for p in poly)))
BW, BH = int(np.ceil(max(p[0] for p in poly))) - BX, int(np.ceil(max(p[1] for p in poly))) - BY
M, Z = 30, 1.5
items = []
for c, r in zip(cases, R):
    if not (r["w360"]["found"] and r["w360"]["H"]):
        items.append((f"{c['id']} · 360 px: placa NO aceptada", None)); continue
    sx, sy = c["w640"] / c["w360"], c["h640"] / c["h360"]
    Hm = np.diag([sx, sy, 1.0]) @ np.array(r["w360"]["H"], float).reshape(3, 3)   # ref → cuadro de 640
    T = np.array([[1, 0, BX - M], [0, 1, BY - M], [0, 0, 1]], float); A = Hm @ T; A = A / A[2, 2]
    cf = (A[0, 0], A[0, 1], A[0, 2], A[1, 0], A[1, 1], A[1, 2], A[2, 0], A[2, 1])
    im = Image.open(os.path.join(out, f"{c['id']}_640.png")).convert("RGB")
    v = im.transform((BW + 2 * M, BH + 2 * M), Image.PERSPECTIVE, cf, Image.BILINEAR).resize((int((BW + 2 * M) * Z), int((BH + 2 * M) * Z)))
    dv = ImageDraw.Draw(v); dv.rectangle([M * Z, M * Z, (M + BW) * Z, (M + BH) * Z], outline=(255, 40, 40), width=2)
    items.append((f"{c['id']} · GPIO con homografía de 360 px (rojo = recorte)", v))
wmax = max(v.width for _, v in items if v) + 20
sh = Image.new("RGB", (wmax, sum((v.height if v else 0) + 22 for _, v in items) + 10), (22, 22, 22)); ds = ImageDraw.Draw(sh); y = 6
for label, v in items:
    ds.text((10, y), label, fill=(220, 240, 220)); y += 14
    if v: sh.paste(v, (10, y)); y += v.height + 8
    else: y += 8
sh.save(os.path.join(out, "gpio_360_ampliado.png"))

print(f"{'cuadro':10s} {'640':>4s} {'360':>4s} {'inl640':>6s} {'inl360':>6s} {'ms640':>6s} {'ms360':>6s} {'dGPIO':>6s} {'dPlaca':>6s}  (d en px del cuadro de 640)")
for s in summary:
    print(f"{s['id']:10s} {('OK' if s['found640'] else 'NO'):>4s} {('OK' if s['found360'] else 'NO'):>4s} {s['inl640']:>6} {s['inl360']:>6} {s['ms640']:>6} {s['ms360']:>6} {str(s['dGPIO_px640']):>6s} {str(s['dPlaca_px640']):>6s}")
