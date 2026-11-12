"""
make_y4m.py — crea un video .y4m estático para usar como cámara falsa de Chrome
(--use-file-for-fake-video-capture). Solo para pruebas simuladas de escritorio.

Uso:
  python tools/make_y4m.py <imagen> <salida.y4m> [--size 1280x720] [--rotate 90]
                           [--scale 0.95] [--offset 0,0] [--blur 0] [--gain 1.0]
  python tools/make_y4m.py --negative <salida.y4m> [--size 1280x720]

--rotate gira la imagen (grados, antihorario como PIL); --offset desplaza el centro
en píxeles; --blur y --gain degradan la imagen para que no sea idéntica a la referencia.
"""
import argparse
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument("src", nargs="?")
ap.add_argument("dst")
ap.add_argument("--negative", action="store_true")
ap.add_argument("--size", default="1280x720")
ap.add_argument("--rotate", type=float, default=0)
ap.add_argument("--scale", type=float, default=0.95)
ap.add_argument("--offset", default="0,0")
ap.add_argument("--blur", type=float, default=0)
ap.add_argument("--gain", type=float, default=1.0)
a = ap.parse_args()
if a.negative and a.src and not a.dst.endswith(".y4m"):
    a.dst = a.src
W, H = (int(v) for v in a.size.lower().split("x"))
ox, oy = (int(v) for v in a.offset.split(","))

canvas = Image.new("RGB", (W, H), (35, 35, 35))
if a.negative:
    d = ImageDraw.Draw(canvas)
    for i in range(0, W, 64):          # escena sin placa: líneas y bloques genéricos
        d.rectangle([i, H // 3, i + 30, H // 3 + 90], fill=(120 + i % 100, 90, 60))
    d.ellipse([W // 2 - 150, H // 2, W // 2 + 150, H // 2 + 200], fill=(180, 170, 160))
else:
    img = Image.open(a.src).convert("RGB")
    if a.rotate:
        img = img.rotate(a.rotate, expand=True, fillcolor=(35, 35, 35))
    k = min(W / img.width, H / img.height) * a.scale
    img = img.resize((int(img.width * k), int(img.height * k)), Image.LANCZOS)
    canvas.paste(img, ((W - img.width) // 2 + ox, (H - img.height) // 2 + oy))
    if a.blur:
        canvas = canvas.filter(ImageFilter.GaussianBlur(a.blur))
    if a.gain != 1.0:
        canvas = ImageEnhance.Brightness(canvas).enhance(a.gain)

ycc = canvas.convert("YCbCr")
y, cb, cr = ycc.split()
cb = cb.resize((W // 2, H // 2))
cr = cr.resize((W // 2, H // 2))
frame = y.tobytes() + cb.tobytes() + cr.tobytes()
with open(a.dst, "wb") as f:
    f.write(f"YUV4MPEG2 W{W} H{H} F10:1 Ip A1:1 C420jpeg\n".encode())
    for _ in range(30):
        f.write(b"FRAME\n")
        f.write(frame)
print(f"{a.dst}: {W}x{H}, 30 cuadros")
