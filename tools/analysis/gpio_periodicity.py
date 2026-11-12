"""
gpio_periodicity.py — hoja comparativa, recortes y comprobación de periodicidad por tramo.
Fuera de la app (no la modifica). Requiere la salida de gpio_session_analysis.mjs.

Uso: python tools/analysis/gpio_periodicity.py <carpeta_salida>

Métrica: autocorrelación normalizada del perfil de columnas del recorte GPIO rectificado,
máximo en lag 0,8P–1,2P (P = largo/20 pines), por tercio. 1 = muy periódico.
  v1  tendencia (promedio móvil de 2P) restada sobre TODO el perfil  ← la usada en el análisis anterior
  v2  tendencia restada DENTRO de cada tercio (relleno por reflexión en sus bordes)
  v3  v2 + recorte de valores extremos a ±3·MAD dentro del tercio
Las oclusiones son SINTÉTICAS (bloques pintados sobre el recorte real); no son oclusiones reales.
Paralaje y reflejos siguen siendo hipótesis sobre la causa del fallo del NCC.

Escribe: hoja_variantes.png, recortes_akaze.png, oclusiones_sinteticas.png, periodicidad.json
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw

out = sys.argv[1]
V = json.load(open(os.path.join(out, "variants.json")))
meta = json.load(open(os.path.join(out, "akaze_meta.json")))
frames = json.load(open(os.path.join(out, "frames.json")))
PW, PH = meta["ref"]
BX, BY = 423, 610                 # caja del GPIO en la referencia (zones.json, floor/ceil)
P = PW / 20.0

def gray_raw(name, w, h):
    a = np.frombuffer(open(os.path.join(out, name), "rb").read(), dtype=np.uint8).reshape(h, w, 4)
    return a[:, :, 0].astype(float)

def acf_peak(v):
    v = v - v.mean()
    den = (v * v).sum() or 1.0
    return max(float((v[:-L] * v[L:]).sum() / den) for L in range(int(0.8 * P), int(1.2 * P) + 1))

def smooth(x, k, mode):
    k = max(3, int(round(k)) | 1)
    if mode == "reflect":
        xp = np.pad(x, k // 2, mode="reflect")
        return np.convolve(xp, np.ones(k) / k, mode="valid")
    return np.convolve(x, np.ones(k) / k, mode="same")

def scores(patch, version):
    prof = patch.mean(axis=0)
    seg = len(prof) // 3
    res = []
    if version == "v1":
        x = prof - smooth(prof, 2 * P, "same")
        for s in range(3):
            res.append(acf_peak(x[s * seg:(s + 1) * seg]))
    else:
        for s in range(3):
            p = prof[s * seg:(s + 1) * seg]
            x = p - smooth(p, 2 * P, "reflect")
            if version == "v3":
                med = np.median(x); mad = np.median(np.abs(x - med)) or 1.0
                x = np.clip(x, med - 3 * 1.4826 * mad, med + 3 * 1.4826 * mad)
            res.append(acf_peak(x))
    return [round(r, 2) for r in res]

def warp(frame, H, dy):
    Hm = np.array(H, float).reshape(3, 3)
    T = np.array([[1, 0, BX], [0, 1, BY + dy], [0, 0, 1]], float)
    M = Hm @ T; M = M / M[2, 2]
    c = (M[0, 0], M[0, 1], M[0, 2], M[1, 0], M[1, 1], M[1, 2], M[2, 0], M[2, 1])
    return np.asarray(frame.transform((PW, PH), Image.PERSPECTIVE, c, Image.BILINEAR).convert("L"), float)

def occlude(patch, x0, x1, seed):
    """Oclusión SINTÉTICA: bloque claro con gradiente y ruido, tipo dedo."""
    o = patch.copy()
    yy = np.linspace(0, 1, PH)[:, None]
    o[:, x0:x1] = 175 + 25 * yy + np.random.default_rng(seed).normal(0, 6, (PH, x1 - x0))
    return o

seg = PW // 3
OCC = {
    "tercio 1 tapado (sintético)": (0, seg),
    "tercio 2 tapado (sintético)": (seg, 2 * seg),
    "tercio 3 tapado (sintético)": (2 * seg, PW),
    "media zona tapada (sintético)": (0, PW // 2),
    "un tercio de tercio 2 tapado (sintético)": (seg + seg // 3, seg + 2 * seg // 3),
}
CONTROLS = {"control RAM/«Raspberry Pi 5»": -120, "control CPU": -250, "control HDMI/USB-C": -420}

report = {"P": P, "nota": "oclusiones SINTÉTICAS; paralaje/reflejos = hipótesis", "ref": {}, "frames": []}
ref = gray_raw("ref_patch.raw", PW, PH)
for ver in ("v1", "v2", "v3"):
    report["ref"][ver] = scores(ref, ver)
occ_images = []
for f in meta["frames"]:
    i = f["i"]
    patch = gray_raw(f"akaze_patch_f{i}.raw", f["w"], f["h"])
    fr = Image.open(os.path.join(out, f"f{i}.png")).convert("RGB")
    row = {"i": i, "gpio": {}, "occ": {}, "ctrl": {}}
    for ver in ("v1", "v2", "v3"):
        row["gpio"][ver] = scores(patch, ver)
        for name, (a, b) in OCC.items():
            row["occ"].setdefault(name, {})[ver] = scores(occlude(patch, a, b, i), ver)
        for name, dy in CONTROLS.items():
            row["ctrl"].setdefault(name, {})[ver] = scores(warp(fr, f["H"], dy), ver)
    if i == 2:
        occ_images = [("GPIO f2 (sin tapar)", patch)] + [(n, occlude(patch, a, b, i)) for n, (a, b) in OCC.items()]
    report["frames"].append(row)
json.dump(report, open(os.path.join(out, "periodicidad.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# ── Imágenes para revisar ─────────────────────────────────────────────────────
def to_img(a): return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).convert("RGB")
def strip_sheet(items, path, S=2):
    sh = Image.new("RGB", (PW * S + 20, len(items) * (PH * S + 26) + 10), (22, 22, 22))
    d = ImageDraw.Draw(sh); y = 6
    for label, a in items:
        d.text((10, y), label, fill=(220, 240, 220)); y += 14
        im = to_img(a).resize((PW * S, PH * S), Image.NEAREST); di = ImageDraw.Draw(im)
        for k in (1, 2): di.line([(k * seg * S, 0), (k * seg * S, PH * S)], fill=(255, 50, 50), width=2)
        sh.paste(im, (10, y)); y += PH * S + 12
    sh.save(path)

strip_sheet([("REFERENCIA", ref)] + [(f"cuadro f{f['i']} rectificado con AKAZE", gray_raw(f"akaze_patch_f{f['i']}.raw", PW, PH))
             for f in meta["frames"]], os.path.join(out, "recortes_akaze.png"))
strip_sheet(occ_images, os.path.join(out, "oclusiones_sinteticas.png"))

names = list(V.keys()); n = len(V[names[0]]); Sc = 0.28
W, H = int(frames[0]["w"] * Sc), int(frames[0]["h"] * Sc)
sheet = Image.new("RGB", (len(names) * (W + 6) + 6, n * (H + 34) + 30), (25, 25, 25)); d = ImageDraw.Draw(sheet)
for c, v in enumerate(names): d.text((6 + c * (W + 6) + 4, 8), v, fill=(255, 255, 160))
for r in range(n):
    base = Image.open(os.path.join(out, f"f{r}.png")).convert("RGB")
    for c, v in enumerate(names):
        e = V[v][r]; im = base.copy(); dd = ImageDraw.Draw(im)
        if e["board"]:
            pts = [tuple(p) for p in e["board"]]; dd.line(pts + [pts[0]], fill=(0, 230, 255) if e["found"] else (255, 60, 60), width=6)
        if e["gpio"]:
            pts = [tuple(p) for p in e["gpio"]]; dd.line(pts + [pts[0]], fill=(255, 140, 0), width=8)
        im = im.resize((W, H)); x, y = 6 + c * (W + 6), 26 + r * (H + 34); sheet.paste(im, (x, y))
        d.text((x + 2, y + H + 2), f"f{r} {'OK' if e['found'] else 'NO'} inl {e['inliers']}", fill=(220, 240, 220))
        d.text((x + 2, y + H + 15), f"tramos {e['seg']}" if e["seg"] else "sin placa", fill=(255, 210, 120))
sheet.save(os.path.join(out, "hoja_variantes.png"))

# ── Resumen en consola ────────────────────────────────────────────────────────
def rng(vals):
    lo = [min(v[k] for v in vals) for k in range(3)]; hi = [max(v[k] for v in vals) for k in range(3)]
    return " | ".join(f"{a:+.2f}…{b:+.2f}" for a, b in zip(lo, hi))
F = report["frames"]
print(f"P = {P:.1f} px · rangos en los 6 cuadros por tercio [1 | 2 | 3]")
for ver in ("v1", "v2", "v3"):
    print(f"\n== {ver} ==  referencia {report['ref'][ver]}")
    print(f"  {'GPIO sin tapar':44s} {rng([r['gpio'][ver] for r in F])}")
    for name in OCC: print(f"  {name:44s} {rng([r['occ'][name][ver] for r in F])}")
    for name in CONTROLS: print(f"  {name:44s} {rng([r['ctrl'][name][ver] for r in F])}")
