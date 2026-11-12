"""
make_y4m.py — crea un video .y4m estático para usar como cámara falsa de Chrome
(--use-file-for-fake-video-capture). Solo para pruebas simuladas de escritorio.

Uso:
  python tools/make_y4m.py <imagen> <salida.y4m> [ancho alto]
  python tools/make_y4m.py --negative <salida.y4m> [ancho alto]
"""
import sys
from PIL import Image, ImageDraw

args = sys.argv[1:]
negative = args and args[0] == "--negative"
if negative:
    args = args[1:]
    src, dst = None, args[0]
else:
    src, dst = args[0], args[1]
    args = args[1:]
W, H = (int(args[1]), int(args[2])) if len(args) >= 3 else (1280, 720)

canvas = Image.new("RGB", (W, H), (35, 35, 35))
if negative:
    d = ImageDraw.Draw(canvas)
    for i in range(0, W, 64):          # escena sin placa: líneas y bloques genéricos
        d.rectangle([i, H // 3, i + 30, H // 3 + 90], fill=(120 + i % 100, 90, 60))
    d.ellipse([W // 2 - 150, H // 2, W // 2 + 150, H // 2 + 200], fill=(180, 170, 160))
else:
    img = Image.open(src).convert("RGB")
    k = min(W / img.width, H / img.height) * 0.95
    img = img.resize((int(img.width * k), int(img.height * k)))
    canvas.paste(img, ((W - img.width) // 2, (H - img.height) // 2))

ycc = canvas.convert("YCbCr")
y, cb, cr = ycc.split()
cb = cb.resize((W // 2, H // 2))
cr = cr.resize((W // 2, H // 2))
frame = y.tobytes() + cb.tobytes() + cr.tobytes()
with open(dst, "wb") as f:
    f.write(f"YUV4MPEG2 W{W} H{H} F10:1 Ip A1:1 C420jpeg\n".encode())
    for _ in range(30):
        f.write(b"FRAME\n")
        f.write(frame)
print(f"{dst}: {W}x{H}, 30 cuadros")
