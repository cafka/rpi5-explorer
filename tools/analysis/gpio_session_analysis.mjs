/**
 * gpio_session_analysis.mjs — análisis de una sesión real (fuera de la app; no la modifica).
 *
 * Uso: node tools/analysis/gpio_session_analysis.mjs <sesion.json> <carpeta_salida>
 *
 * Escribe en la carpeta de salida:
 *   f<i>.png / f<i>.rgba     cuadros procesados de la sesión (tal como los analizó el teléfono)
 *   variants.json            por variante y cuadro: found, inliers, contorno de placa, GPIO proyectado, tramos NCC
 *   akaze_patch_f<i>.raw     recorte GPIO rectificado con AKAZE (gris en RGBA, 517x65)
 *   ref_patch.raw            recorte GPIO de la referencia
 *   akaze_meta.json          homografías AKAZE y tamaños
 * Ejecuta el app/localizer.js real con Localizer.configure().
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const [sessionPath, outDir] = process.argv.slice(2);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);
mkdirSync(outDir, { recursive: true });

// Decodificar los PNG de la sesión con Python/Pillow (ya usado en el proyecto)
execFileSync("python", ["-c", `
import base64, io, json, sys
from PIL import Image
s = json.load(open(sys.argv[1], encoding="utf-8"))
out = []
for i, f in enumerate(s["frames"]):
    im = Image.open(io.BytesIO(base64.b64decode(f["processedFramePng"].split(",", 1)[1]))).convert("RGBA")
    open(sys.argv[2] + f"/f{i}.rgba", "wb").write(im.tobytes())
    im.convert("RGB").save(sys.argv[2] + f"/f{i}.png")
    out.append({"i": i, "w": im.width, "h": im.height, "t": f.get("t")})
json.dump(out, open(sys.argv[2] + "/frames.json", "w"))
`, sessionPath, outDir]);

const frames = JSON.parse(readFileSync(path.join(outDir, "frames.json"), "utf8"));
const zones = JSON.parse(readFileSync(path.join(ROOT, "app/data/zones.json"), "utf8"));
const { cv } = await new Promise(res => {
  let mod = null;
  global.Module = { onRuntimeInitialized() { setImmediate(() => res({ cv: global.cv || mod })); } };
  mod = require(path.join(ROOT, "app/vendor/opencv-4.9.0.js"));
});
const { Localizer } = await import(pathToFileURL(path.join(ROOT, "app/localizer.js")).href);
const RW = zones.image.width, RH = zones.image.height;
const ref = new Uint8ClampedArray(readFileSync(path.join(ROOT, "tests/fixtures", zones.image.test_fixture)));
const load = f => ({ width: f.w, height: f.h, data: new Uint8ClampedArray(readFileSync(path.join(outDir, `f${f.i}.rgba`))) });

const V = { orb800: {}, orb2500: { frameFeatures: 2500, refFeatures: 2500 }, ratio08: { ratio: 0.8 }, akaze: { detector: "akaze" } };
const variants = {};
const akazeMeta = { frames: [] };
for (const [v, cfg] of Object.entries(V)) {
  Localizer.configure(cfg);
  await Localizer.init(cv, { width: RW, height: RH, data: ref }, zones);
  Localizer.setDebug(true);
  if (v === "akaze") {
    const rp = Localizer.getRefPatch("gpio");
    writeFileSync(path.join(outDir, "ref_patch.raw"), Buffer.from(rp.data.buffer));
    akazeMeta.ref = [rp.width, rp.height];
  }
  variants[v] = frames.map(f => {
    const r = Localizer.locate(load(f));
    const z = r.zones[0];
    if (v === "akaze" && z.debugPatch) {
      writeFileSync(path.join(outDir, `akaze_patch_f${f.i}.raw`), Buffer.from(z.debugPatch.data.buffer));
      akazeMeta.frames.push({ i: f.i, w: z.debugPatch.width, h: z.debugPatch.height, H: r.debug.H });
    }
    return { found: r.found, inliers: r.diagMetrics.inliers, matches: r.diagMetrics.matchesUsed,
             board: r.debug ? r.debug.board : null, gpio: z.polygon || z.polygonDebug || null,
             seg: z.evidence && z.evidence.nccSeg };
  });
}
Localizer.configure();
writeFileSync(path.join(outDir, "variants.json"), JSON.stringify(variants, null, 1));
writeFileSync(path.join(outDir, "akaze_meta.json"), JSON.stringify(akazeMeta, null, 1));
console.log(`análisis listo en ${outDir}: ${frames.length} cuadros, ${Object.keys(V).length} variantes`);
process.exit(0);
