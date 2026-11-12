"""
make_reference.py — genera la imagen de referencia sintética de Raspberry Pi 5
y el archivo zones.json con la zona GPIO anotada.

Uso: python tools/make_reference.py

Salida:
  app/data/reference/rpi5_ref.png   — imagen de referencia (800×600 px)
  app/data/zones.json               — coordenadas de la zona GPIO en la referencia

La imagen es una representación esquemática del PCB de la Raspberry Pi 5,
con proporciones aproximadas a las reales (85 × 56 mm). Es material de ajuste
del localizador; NO forma parte del conjunto de evaluación independiente.

Atribución de proporciones y posición de componentes:
  Raspberry Pi 5 Product Brief (raspberrypi.com/products/raspberry-pi-5/)
  Datasheet consultado: 11 de noviembre de 2026
"""

import json
import os
from PIL import Image, ImageDraw, ImageFont

# ── Dimensiones del canvas ────────────────────────────────────────────────────
# La imagen tiene 800×600 px. El PCB ocupa la mayor parte centrado.
# Proporciones reales del PCB: 85 × 56 mm → escala ≈ 8.5 px/mm

W, H = 800, 600
SCALE = 8.0  # px por mm

# Margen para centrar el PCB (85mm × 56mm → 680×448 px)
PCB_W = int(85 * SCALE)   # 680
PCB_H = int(56 * SCALE)   # 448
OX = (W - PCB_W) // 2     # offset X: 60
OY = (H - PCB_H) // 2     # offset Y: 76

def mm(x, y):
    """Convierte coordenadas en mm (desde esquina superior-izquierda del PCB) a píxeles."""
    return (OX + int(x * SCALE), OY + int(y * SCALE))

# ── Colores ───────────────────────────────────────────────────────────────────
C_PCB        = (34,  85, 34)      # verde PCB
C_PCB_EDGE   = (20,  60, 20)
C_GOLD       = (220, 180, 50)     # pads / pines dorados
C_SILVER     = (180, 180, 190)    # conectores metálicos
C_BLACK      = (20,  20,  20)
C_WHITE      = (240, 240, 240)
C_RED        = (200, 50,  50)
C_ZONE_GPIO  = (255, 100,   0, 180)   # naranja semitransparente — solo para visualización

# ── Crear imagen ──────────────────────────────────────────────────────────────
img  = Image.new("RGB", (W, H), (40, 40, 40))
draw = ImageDraw.Draw(img, "RGBA")

# Fondo oscuro (mesa o suelo)
draw.rectangle([0, 0, W, H], fill=(30, 30, 30))

# PCB principal
draw.rectangle([OX, OY, OX + PCB_W, OY + PCB_H], fill=C_PCB, outline=C_PCB_EDGE, width=3)

# ── Componentes principales (posiciones aproximadas en mm desde esquina sup-izq) ──

# --- Chip BCM2712 (centro, 20×20 mm aprox)
chip_x, chip_y = mm(30, 18)
chip_w, chip_h = int(20*SCALE), int(20*SCALE)
draw.rectangle([chip_x, chip_y, chip_x+chip_w, chip_y+chip_h], fill=(40,40,50), outline=C_GOLD, width=2)
draw.text((chip_x+5, chip_y+8), "BCM2712", fill=C_GOLD)

# --- RAM (encima del chip, aprox)
ram_x, ram_y = mm(32, 10)
draw.rectangle([ram_x, ram_y, ram_x+int(16*SCALE), ram_y+int(6*SCALE)], fill=(50,50,60), outline=C_GOLD, width=1)
draw.text((ram_x+2, ram_y+2), "RAM", fill=C_GOLD)

# --- USB-C power (borde izquierdo, 10–13 mm desde arriba)
usbcpwr_x, usbcpwr_y = mm(0, 8)
draw.rectangle([usbcpwr_x, usbcpwr_y, usbcpwr_x+int(3.5*SCALE), usbcpwr_y+int(5*SCALE)], fill=C_SILVER, outline=C_BLACK, width=1)
draw.text((OX+2, usbcpwr_y+2), "PWR", fill=C_WHITE)

# --- HDMI0 y HDMI1 (borde izquierdo, más abajo)
for i, y_mm in enumerate([16, 23]):
    hx, hy = mm(0, y_mm)
    draw.rectangle([hx, hy, hx+int(4*SCALE), hy+int(5.5*SCALE)], fill=C_BLACK, outline=C_SILVER, width=1)
    draw.text((OX+2, hy+2), f"H{i}", fill=C_WHITE)

# --- USB-A x2 (borde derecho, parte inferior)
for i, y_mm in enumerate([10, 20]):
    ux, uy = mm(79, y_mm)
    draw.rectangle([ux, uy, OX+PCB_W, uy+int(8*SCALE)], fill=C_SILVER, outline=C_BLACK, width=1)
    draw.text((ux+2, uy+3), "USB", fill=C_BLACK)

# --- Ethernet (borde derecho, zona inferior)
eth_x, eth_y = mm(73, 32)
draw.rectangle([eth_x, eth_y, OX+PCB_W, eth_y+int(14*SCALE)], fill=C_SILVER, outline=C_BLACK, width=2)
draw.text((eth_x+3, eth_y+5), "ETH", fill=C_BLACK)

# --- MicroSD slot (borde inferior izquierdo)
sd_x, sd_y = mm(10, 53)
draw.rectangle([sd_x, sd_y, sd_x+int(12*SCALE), OY+PCB_H], fill=(180,180,180), outline=C_BLACK, width=1)
draw.text((sd_x+3, sd_y+2), "SD", fill=C_BLACK)

# --- CSI / DSI connectors
for i, x_mm in enumerate([45, 55]):
    cx, cy = mm(x_mm, 0)
    draw.rectangle([cx, cy, cx+int(6*SCALE), cy+int(3*SCALE)], fill=(100,100,120), outline=C_SILVER, width=1)
    draw.text((cx+2, cy+1), "CSI" if i==0 else "DSI", fill=C_WHITE)

# ── GPIO header (zona principal de T2) ───────────────────────────────────────
# Posición real: borde superior izquierdo del PCB, aprox x=0–5mm, y=0–26mm
# 2×20 pines, espaciado 2.54 mm, header de 51 mm × 5 mm aprox

GPIO_X_MM   = 0.5    # desde borde izquierdo del PCB
GPIO_Y_MM   = 0.5    # desde borde superior
GPIO_W_MM   = 51.0   # 20 pines × 2.54 mm
GPIO_H_MM   = 5.0    # 2 filas × 2.54 mm ≈ 5 mm

gx, gy = mm(GPIO_X_MM, GPIO_Y_MM)
gw     = int(GPIO_W_MM * SCALE)
gh     = int(GPIO_H_MM * SCALE)

# Base plástica del header (negro)
draw.rectangle([gx, gy, gx+gw, gy+gh], fill=(30, 30, 30), outline=C_GOLD, width=2)

# Pines (2 filas × 20 columnas)
PIN_SPACING = int(2.54 * SCALE)
PIN_R       = max(2, int(1.0 * SCALE))
for col in range(20):
    for row in range(2):
        px = gx + int(1.27 * SCALE) + col * PIN_SPACING
        py = gy + int(1.27 * SCALE) + row * int(2.54 * SCALE)
        draw.ellipse([px-PIN_R, py-PIN_R, px+PIN_R, py+PIN_R], fill=C_GOLD)

# Pin 1 marker (cuadrado en vez de círculo)
p1x = gx + int(1.27 * SCALE)
p1y = gy + int(1.27 * SCALE)
draw.rectangle([p1x-PIN_R, p1y-PIN_R, p1x+PIN_R, p1y+PIN_R], fill=C_RED)

draw.text((gx+2, gy+gh+2), "GPIO 40-pin", fill=(255, 165, 0))

# Superposición de zona (naranja transparente) — solo referencia visual
draw.rectangle([gx-2, gy-2, gx+gw+2, gy+gh+2], fill=C_ZONE_GPIO, outline=(255, 100, 0, 255), width=2)

# ── Texto de atribución ───────────────────────────────────────────────────────
draw.text((5, H-20), "Esquema sintético RPi5 — proporciones aproximadas — uso interno proyecto", fill=(120,120,120))

# ── Guardar imagen ────────────────────────────────────────────────────────────
out_dir = os.path.join(os.path.dirname(__file__), "..", "app", "data", "reference")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "rpi5_ref.png")
img.save(out_path, "PNG")
print(f"Imagen guardada: {out_path} ({W}×{H} px)")

# ── Generar zones.json ────────────────────────────────────────────────────────
# Coordenadas en píxeles en la imagen de referencia (800×600)
zones = {
  "image": {
    "file":    "rpi5_ref.png",
    "width":   W,
    "height":  H,
    "origin":  "Esquema sintético generado por make_reference.py. Proporciones basadas en Raspberry Pi 5 Product Brief. Material de ajuste; no usar como conjunto de evaluación.",
    "created": "2026-11-11"
  },
  "zones": [
    {
      "id":          "gpio",
      "name":        "GPIO 40-pin header",
      "description": "Conector de 2×20 pines en el borde superior izquierdo de la placa",
      "polygon_px":  [
        [gx-2,    gy-2  ],
        [gx+gw+2, gy-2  ],
        [gx+gw+2, gy+gh+2],
        [gx-2,    gy+gh+2]
      ],
      "label_offset_px": [gw//2, gh+16],
      "source":      "Raspberry Pi 5 Product Brief — raspberrypi.com/products/raspberry-pi-5/",
      "consulted":   "2026-11-11"
    }
  ]
}

zones_path = os.path.join(os.path.dirname(__file__), "..", "app", "data", "zones.json")
with open(zones_path, "w", encoding="utf-8") as f:
    json.dump(zones, f, ensure_ascii=False, indent=2)
print(f"zones.json guardado: {zones_path}")
print(f"Zona GPIO — polígono en píxeles: {zones['zones'][0]['polygon_px']}")
