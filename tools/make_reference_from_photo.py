"""
make_reference_from_photo.py — convierte una foto real de la Raspberry Pi 5 en la
referencia activa del localizador.

Uso:
  python tools/make_reference_from_photo.py FOTO \
      --gpio "x1,y1;x2,y2;x3,y3;x4,y4" \
      --board "x1,y1;x2,y2;...;xn,yn" \
      --origin "Foto propia de Claudia, ..." \
      [--out rpi5_claudia_ref.jpg] [--max-width 1024]

Las coordenadas se expresan en píxeles de la FOTO ORIGINAL ya orientada según EXIF
(como se ve en un visor de imágenes).

Hace:
  1. Aplica la orientación EXIF y guarda sin metadatos (se descarta EXIF/GPS).
  2. Reduce a --max-width conservando proporción y escala las coordenadas.
  3. Escribe app/data/reference/<out>, app/data/zones.json (con sha256 y dimensiones),
     tests/fixtures/<out>.rgba (para las pruebas en Node) y
     tests/fixtures/<out>.preview.png (vista previa con el marcado, para revisión visual).
  4. No borra la referencia sintética anterior: queda como antecedente.
"""
import argparse
import hashlib
import json
import os
from datetime import date

from PIL import Image, ImageDraw, ImageOps

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def parse_poly(text):
    pts = []
    for pair in text.split(";"):
        x, y = pair.split(",")
        pts.append((float(x), float(y)))
    if len(pts) < 3:
        raise SystemExit(f"Polígono con menos de 3 puntos: {text}")
    return pts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("photo")
    ap.add_argument("--gpio", required=True)
    ap.add_argument("--board", required=True)
    ap.add_argument("--origin", required=True)
    ap.add_argument("--out", default="rpi5_claudia_ref.jpg")
    ap.add_argument("--max-width", type=int, default=1024)
    a = ap.parse_args()

    src = Image.open(a.photo)
    orig_size = src.size
    img = ImageOps.exif_transpose(src).convert("RGB")
    ow, oh = img.size

    k = min(1.0, a.max_width / ow)
    W, H = round(ow * k), round(oh * k)
    if k < 1.0:
        img = img.resize((W, H), Image.LANCZOS)

    def scale(poly):
        return [[round(x * k, 1), round(y * k, 1)] for x, y in poly]

    gpio = scale(parse_poly(a.gpio))
    board = scale(parse_poly(a.board))
    for x, y in gpio + board:
        if not (0 <= x <= W and 0 <= y <= H):
            raise SystemExit(f"Punto fuera de la imagen: ({x},{y}) en {W}x{H}")

    ref_dir = os.path.join(ROOT, "app", "data", "reference")
    os.makedirs(ref_dir, exist_ok=True)
    out_path = os.path.join(ref_dir, a.out)
    img.save(out_path, "JPEG", quality=92, optimize=True)   # sin exif=: no se guardan metadatos
    with open(out_path, "rb") as f:
        sha = hashlib.sha256(f.read()).hexdigest()

    # El fixture se genera desde el JPEG guardado (lo mismo que decodifica el navegador)
    saved = Image.open(out_path).convert("RGBA")
    fx_dir = os.path.join(ROOT, "tests", "fixtures")
    os.makedirs(fx_dir, exist_ok=True)
    fixture = a.out + ".rgba"
    with open(os.path.join(fx_dir, fixture), "wb") as f:
        f.write(saved.tobytes())

    prev = saved.convert("RGB")
    d = ImageDraw.Draw(prev)
    d.line([tuple(p) for p in board] + [tuple(board[0])], fill=(0, 200, 255), width=2)
    d.line([tuple(p) for p in gpio] + [tuple(gpio[0])], fill=(255, 140, 0), width=3)
    prev.save(os.path.join(fx_dir, a.out + ".preview.png"))

    zones = {
        "image": {
            "file": a.out,
            "width": W,
            "height": H,
            "sha256": sha,
            "kind": "foto real",
            "test_fixture": fixture,
            "origin": a.origin,
            "source_photo_size": list(orig_size),
            "scale_from_source": round(k, 6),
            "metadata": "EXIF aplicado a la orientación y descartado al guardar (sin GPS ni datos del equipo)",
            "created": date.today().isoformat(),
            "note": "Material de ajuste/desarrollo. Las pruebas derivadas de esta foto no son evaluación independiente.",
        },
        "board_polygon_px": board,
        "zones": [
            {
                "id": "gpio",
                "name": "GPIO 40-pin header",
                "description": "Conector de 2×20 pines (bloque GPIO) de la Raspberry Pi 5",
                "polygon_px": gpio,
                "source": "Raspberry Pi — documentación de hardware y GPIO: https://www.raspberrypi.com/documentation/computers/raspberry-pi.html",
                "consulted": "2026-11-11",
            }
        ],
        "previous_reference": "rpi5_ref.png (esquema sintético, reemplazado; se conserva como antecedente)",
    }
    with open(os.path.join(ROOT, "app", "data", "zones.json"), "w", encoding="utf-8") as f:
        json.dump(zones, f, ensure_ascii=False, indent=2)

    print(f"Foto original {orig_size[0]}x{orig_size[1]} → orientada {ow}x{oh} → referencia {W}x{H} (k={k:.4f})")
    print(f"Referencia: app/data/reference/{a.out}  sha256={sha}")
    print(f"Fixture:    tests/fixtures/{fixture}")
    print(f"Vista previa: tests/fixtures/{a.out}.preview.png")
    print(f"GPIO (ref px): {gpio}")


if __name__ == "__main__":
    main()
