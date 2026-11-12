/**
 * akaze_360_compare.mjs — compara AKAZE a 640 px y a 360 px sobre cuadros reales (fuera de la app).
 *
 * Uso: node tools/analysis/akaze_360_compare.mjs <carpeta_trabajo>
 * Requiere <carpeta>/cases.json escrito por akaze_360_compare.py:
 *   [{ id, w640, h640, rgba640, w360, h360, rgba360 }]
 * Escribe <carpeta>/akaze_360.json con, por cuadro y ancho: found, inliers, matches, ms,
 * contorno de placa y GPIO (en coordenadas de SU cuadro) y homografía.
 * Tiempos de computadora: no sustituyen la medición en el teléfono.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [dir] = process.argv.slice(2);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);
const zones = JSON.parse(readFileSync(path.join(ROOT, "app/data/zones.json"), "utf8"));
const cases = JSON.parse(readFileSync(path.join(dir, "cases.json"), "utf8"));
const { cv } = await new Promise(res => {
  let mod = null;
  global.Module = { onRuntimeInitialized() { setImmediate(() => res({ cv: global.cv || mod })); } };
  mod = require(path.join(ROOT, "app/vendor/opencv-4.9.0.js"));
});
const { Localizer } = await import(pathToFileURL(path.join(ROOT, "app/localizer.js")).href);
const RW = zones.image.width, RH = zones.image.height;
const ref = new Uint8ClampedArray(readFileSync(path.join(ROOT, "tests/fixtures", zones.image.test_fixture)));

Localizer.configure({ detector: "akaze" });                  // mismos parámetros que la variante
await Localizer.init(cv, { width: RW, height: RH, data: ref }, zones);
Localizer.setDebug(true);
const out = [];
for (const c of cases) {
  const row = { id: c.id };
  for (const [tag, w, h, f] of [["w640", c.w640, c.h640, c.rgba640], ["w360", c.w360, c.h360, c.rgba360]]) {
    const frame = { width: w, height: h, data: new Uint8ClampedArray(readFileSync(f)) };
    Localizer.locate(frame);                                  // calentamiento (no se mide)
    const t0 = performance.now();
    const r = Localizer.locate(frame);
    const ms = Math.round(performance.now() - t0);
    const z = r.zones[0];
    row[tag] = { w, h, found: r.found, inliers: r.diagMetrics.inliers, matches: r.diagMetrics.matchesUsed,
                 kp: r.diagMetrics.frameKeypoints, ms,
                 board: r.debug ? r.debug.board : null, gpio: z.polygon || z.polygonDebug || null,
                 H: r.debug ? r.debug.H : null };
  }
  out.push(row);
}
Localizer.configure();
writeFileSync(path.join(dir, "akaze_360.json"), JSON.stringify(out, null, 1));
console.log(`comparación lista: ${out.length} cuadros`);
process.exit(0);
