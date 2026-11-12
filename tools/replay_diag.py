"""
replay_diag.py — reproduce en la computadora un diagnóstico guardado en el teléfono.

Uso:
  python tools/replay_diag.py diagnosticos/rpi5_diag_....json

Hace:
  1. Extrae el cuadro EXACTO que procesó el teléfono (PNG del canvas de trabajo).
  2. Ejecuta el app/localizer.js real (modo diagnóstico) sobre ese cuadro con la
     referencia activa, vía tools/replay_diag.mjs.
  3. Compara con el resultado que calculó el teléfono (inliers, proyección, tramos).
  4. Escribe en diagnosticos/<nombre>_frame.png y <nombre>_patches.png:
       - el cuadro con el GPIO proyectado (teléfono: blanco; reproducción: naranja si
         aceptada, gris si rechazada), el contorno de placa (cian) y los inliers (cian);
       - el recorte de referencia, el del cuadro y su diferencia, ampliados, con las
         divisiones de tramo y los valores de cada tramo.
Categoría: herramienta de desarrollo. Las capturas usadas para ajustar no sirven
después como evaluación independiente.
"""
import base64
import io
import json
import os
import subprocess
import sys

from PIL import Image, ImageChops, ImageDraw, ImageOps

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def rgba_img(p):
    return Image.frombytes("RGBA", (p["width"], p["height"]), base64.b64decode(p["rgba"]))


def poly_line(d, poly, color, width, dash=None):
    pts = [tuple(p) for p in poly] + [tuple(poly[0])]
    if not dash:
        d.line(pts, fill=color, width=width)
        return
    on, off = dash
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        L = max(1.0, ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5)
        t = 0.0
        while t < L:
            t1 = min(L, t + on)
            d.line([(x0 + (x1 - x0) * t / L, y0 + (y1 - y0) * t / L),
                    (x0 + (x1 - x0) * t1 / L, y0 + (y1 - y0) * t1 / L)], fill=color, width=width)
            t += on + off


def seg_lines(d, w, h, scale, color=(255, 50, 50)):
    horiz = w >= h
    L = w if horiz else h
    seg = L // 3
    for i in (1, 2):
        if horiz:
            d.line([(i * seg * scale, 0), (i * seg * scale, h * scale)], fill=color, width=2)
        else:
            d.line([(0, i * seg * scale), (w * scale, i * seg * scale)], fill=color, width=2)


def main():
    # La consola de Windows usa cp1252 por defecto y falla con «─», «·», etc.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    src = sys.argv[1]
    name = os.path.splitext(os.path.basename(src))[0]
    data = json.load(open(src, encoding="utf-8"))
    variants = sys.argv[2] if len(sys.argv) > 2 else None
    if data.get("kind") == "rpi5-explorer-sesion":
        # Sesión enviada por la app: varios cuadros con su resultado. Se reproduce cada uno.
        print(f"SESIÓN {data.get('sessionId')} · build {data.get('build')} · {len(data['frames'])} cuadros · "
              f"variante teléfono {json.dumps(data.get('variant'))}")
        print(f"referencia teléfono: {data.get('reference')}")
        for i, f in enumerate(data["frames"]):
            print(f"\n──── cuadro {i} (t = {f.get('t')} ms) ────")
            one = {"build": data.get("build"), "userAgent": data.get("userAgent"), "chain": data.get("chain"),
                   "result": f["result"], "processedFramePng": f["processedFramePng"]}
            replay_one(one, f"{name}_f{i}", variants)
    else:
        replay_one(data, name, variants)


def replay_one(diag, name, variants):
    out_dir = os.path.join(ROOT, "diagnosticos")
    os.makedirs(out_dir, exist_ok=True)

    png = base64.b64decode(diag["processedFramePng"].split(",", 1)[1])
    frame = Image.open(io.BytesIO(png)).convert("RGBA")
    W, H = frame.size
    rgba_path = os.path.join(out_dir, name + "_frame.rgba")
    open(rgba_path, "wb").write(frame.tobytes())

    rep_path = os.path.join(out_dir, name + "_replay.json")
    cmd = ["node", os.path.join(ROOT, "tools", "replay_diag.mjs"), rgba_path, str(W), str(H), rep_path]
    if variants:                   # variantes, p. ej. orb800,orb1500,akaze (por defecto: un juego estándar)
        cmd.append(variants)
    subprocess.run(cmd, check=True, cwd=ROOT)
    os.remove(rgba_path)
    rep = json.load(open(rep_path, encoding="utf-8"))

    phone, rr = diag["result"], rep["result"]
    pz, rz = phone["zones"][0], rr["zones"][0]
    chain = diag.get("chain", {})
    print(f"build teléfono: {diag.get('build')}  ·  {diag.get('userAgent', '')[:90]}")
    print(f"referencia teléfono: {chain.get('reference')}")
    print(f"referencia reproducción: {rep['reference']['file']} sha256 {rep['reference']['sha256'][:12]}")
    print(f"cuadro procesado: {W}x{H}  ·  cadena: {json.dumps({k: chain.get(k) for k in ('processed', 'canvas', 'kX', 'kY', 'screen', 'cover')})}")
    for lab, r, z in (("TELÉFONO", phone, pz), ("REPRODUCCIÓN", rr, rz)):
        dm = r.get("diagMetrics", {})
        print(f"{lab:13s} found={r['found']} visible={z['visible']} kp={dm.get('frameKeypoints')} "
              f"matches={dm.get('matchesUsed')} inliers={dm.get('inliers')} evidencia={json.dumps(z.get('evidence'))}")
        print(f"{'':13s} GPIO proyectado (procesado): {z.get('polygon') or z.get('polygonDebug')}")

    # ── Cuadro con proyecciones ────────────────────────────────────────────────
    vis = frame.convert("RGB")
    d = ImageDraw.Draw(vis)
    dbg = rr.get("debug") or {}
    for x, y in dbg.get("inlierPts", []):
        d.rectangle([x - 2, y - 2, x + 2, y + 2], fill=(0, 230, 255))
    if dbg.get("board"):
        poly_line(d, dbg["board"], (0, 230, 255), 2, dash=(14, 8))
    ppoly = pz.get("polygon") or pz.get("polygonDebug")
    if ppoly:
        poly_line(d, ppoly, (255, 255, 255), 4, dash=(6, 6))
    rpoly = rz.get("polygon") or rz.get("polygonDebug")
    if rpoly:
        poly_line(d, rpoly, (255, 140, 0) if rz["visible"] else (170, 170, 170), 2,
                  dash=None if rz["visible"] else (10, 6))
    vis.save(os.path.join(out_dir, name + "_frame.png"))

    # ── Recortes comparados ────────────────────────────────────────────────────
    refp = rgba_img(rep["refPatch"]).convert("L")
    frp = rgba_img(rz["debugPatch"]).convert("L") if rz.get("debugPatch") else None
    S = 2
    rows = [("REFERENCIA (lo que se espera)", refp)]
    if frp:
        rows.append(("CUADRO rectificado (lo que se compara)", frp))
        rows.append(("|diferencia| (claro = distinto)", ImageOps.autocontrast(ImageChops.difference(refp, frp))))
    pw, ph = refp.size
    sheet = Image.new("RGB", (pw * S + 20, len(rows) * (ph * S + 34) + 60), (20, 20, 20))
    sd = ImageDraw.Draw(sheet)
    y = 10
    for label, im in rows:
        sd.text((10, y), label, fill=(220, 240, 220))
        y += 16
        big = im.resize((pw * S, ph * S), Image.NEAREST).convert("RGB")
        bd = ImageDraw.Draw(big)
        seg_lines(bd, pw, ph, S)
        sheet.paste(big, (10, y))
        y += ph * S + 18
    ev = rz.get("evidence") or {}
    sd.text((10, y), f"ncc por tramo {ev.get('nccSeg')}  (umbral 0,5 c/u)  total {ev.get('ncc')}  contraste {ev.get('std')}", fill=(255, 220, 120))
    sd.text((10, y + 16), f"baja frecuencia por tramo {ev.get('lowSeg')}  (candidata, no decide)", fill=(180, 200, 255))
    sheet.save(os.path.join(out_dir, name + "_patches.png"))
    print(f"Imágenes: diagnosticos/{name}_frame.png  diagnosticos/{name}_patches.png")


if __name__ == "__main__":
    main()
