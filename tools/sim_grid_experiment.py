"""
sim_grid_experiment.py — genera cuadros SIMULADOS parecidos a las capturas del teléfono:
papel cuadriculado de fondo, cuadro vertical 640x1138 (tamaño procesado real), placa girada
90° y ocupando distintas fracciones del ancho. Escribe RGBA + la homografía exacta usada.

Solo para probar hipótesis (desarrollo). No es evaluación: la placa es la propia referencia.
Uso: python tools/sim_grid_experiment.py <carpeta_salida>
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
zones = json.load(open(os.path.join(ROOT, "app/data/zones.json"), encoding="utf-8"))
ref = Image.open(os.path.join(ROOT, "app/data/reference", zones["image"]["file"])).convert("RGB")
RW, RH = ref.size
W, H = 640, 1138

def paper(grid):
    bg = Image.new("RGB", (W, H), (205, 205, 200))
    if grid:
        d = ImageDraw.Draw(bg)
        for x in range(0, W, 22):
            d.line([(x, 0), (x, H)], fill=(150, 150, 150), width=1)
        for y in range(0, H, 22):
            d.line([(0, y), (W, y)], fill=(150, 150, 150), width=1)
    return bg

cases = []
for grid in (False, True):
    for frac in (0.95, 0.75, 0.60, 0.50):
        # Giro horario de la referencia: (x, y) → (RH − y, x); luego escala s y traslación
        s = frac * W / RH
        tx = (W - s * RH) / 2
        ty = (H - s * RW) / 2
        Hm = [0, -s, s * RH + tx, s, 0, ty, 0, 0, 1]
        # PIL transform usa el mapeo inverso (destino → origen)
        # destino (u, v) → origen: x = (v − ty)/s,  y = RH − (u − tx)/s
        inv = (0, 1 / s, -ty / s, -1 / s, 0, RH + tx / s, 0, 0)
        board = ref.transform((W, H), Image.PERSPECTIVE, inv, Image.BILINEAR, fillcolor=(0, 0, 0))
        # Máscara GEOMÉTRICA (no por brillo: el header es negro y se volvería transparente)
        white = Image.new("L", ref.size, 255)
        mask = white.transform((W, H), Image.PERSPECTIVE, inv, Image.BILINEAR, fillcolor=0)
        frame = paper(grid)
        frame.paste(board, (0, 0), mask)
        frame = frame.filter(ImageFilter.GaussianBlur(0.7))
        name = f"{'grid' if grid else 'liso'}_{int(frac * 100)}"
        frame.convert("RGBA").save(os.path.join(out, name + ".png"))
        with open(os.path.join(out, name + ".rgba"), "wb") as f:
            f.write(frame.convert("RGBA").tobytes())
        cases.append({"name": name, "grid": grid, "frac": frac, "H": Hm, "w": W, "h": H})
json.dump(cases, open(os.path.join(out, "cases.json"), "w"), indent=1)
print(f"{len(cases)} cuadros en {out}")
