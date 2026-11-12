"""
export_rgba.py — exporta una imagen a píxeles RGBA crudos para las pruebas en Node.

Uso: python tools/export_rgba.py <imagen> <salida.rgba>
Imprime "ancho alto" para registrar las dimensiones.
"""
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
img = Image.open(src).convert("RGBA")
with open(dst, "wb") as f:
    f.write(img.tobytes())
print(img.width, img.height)
