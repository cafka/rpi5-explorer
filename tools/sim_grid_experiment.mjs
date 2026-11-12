/**
 * sim_grid_experiment.mjs — corre el localizer.js real sobre los cuadros de
 * sim_grid_experiment.py con distintos puntos ORB por fotograma, y mide:
 * matches, inliers, error de la proyección del GPIO respecto de la verdad conocida,
 * ncc por tramo y tiempo. app/localizer.js no se modifica.
 *
 * Uso: node tools/sim_grid_experiment.mjs <carpeta> [800,1500,2500]
 * Categoría: SIMULADA (desarrollo). No es evaluación independiente.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [dir, list = "800,1500,2500"] = process.argv.slice(2);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const zones = JSON.parse(readFileSync(path.join(ROOT, "app/data/zones.json"), "utf8"));
const cases = JSON.parse(readFileSync(path.join(dir, "cases.json"), "utf8"));

const { cv } = await new Promise(res => {
  let mod = null;
  global.Module = { onRuntimeInitialized() { setImmediate(() => res({ cv: global.cv || mod })); } };
  mod = require(path.join(ROOT, "app/vendor/opencv-4.9.0.js"));
});

const RW = zones.image.width, RH = zones.image.height;
const ref = { width: RW, height: RH, data: new Uint8ClampedArray(readFileSync(path.join(ROOT, "tests/fixtures", zones.image.test_fixture))) };
const gpio = zones.zones[0].polygon_px;
const applyH = (h, [x, y]) => { const w = h[6] * x + h[7] * y + h[8]; return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w]; };

const { Localizer } = await import(pathToFileURL(path.join(ROOT, "app/localizer.js")).href);
for (const n of list.split(",").map(Number)) {
  Localizer.configure({ frameFeatures: n });
  await Localizer.init(cv, ref, zones);
  console.log(`\n== ${n} puntos por fotograma ==`);
  for (const c of cases) {
    const frame = { width: c.w, height: c.h, data: new Uint8ClampedArray(readFileSync(path.join(dir, c.name + ".rgba"))) };
    Localizer.setDebug(true);
    const t0 = performance.now();
    const r = Localizer.locate(frame);
    const ms = performance.now() - t0;
    const g = r.zones[0];
    const poly = g.polygon || g.polygonDebug;
    const truth = gpio.map(p => applyH(c.H, p));
    const err = poly ? Math.max(...poly.map((p, i) => Math.hypot(p[0] - truth[i][0], p[1] - truth[i][1]))) : null;
    const e = g.evidence || {};
    console.log(`${c.name.padEnd(9)} found=${String(r.found).padEnd(5)} visible=${String(g.visible).padEnd(5)} ` +
      `matches=${String(r.diagMetrics.matchesUsed).padStart(4)} inliers=${String(r.diagMetrics.inliers).padStart(4)} ` +
      `errorGPIO=${err === null ? "  -  " : err.toFixed(0).padStart(4) + "px"} nccTramos=${JSON.stringify(e.nccSeg || e.reason || null)} ${ms.toFixed(0)}ms`);
  }
  Localizer.dispose();
}
Localizer.configure();
process.exit(0);
