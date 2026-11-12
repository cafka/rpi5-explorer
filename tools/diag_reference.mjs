/**
 * diag_reference.mjs — diagnóstico de desarrollo: ejecuta el localizer.js real sobre la
 * referencia activa transformada con homografías conocidas e imprime la evidencia.
 * Uso: node tools/diag_reference.mjs
 * Categoría: SIMULADA (escritorio). No es evaluación independiente.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const zones = JSON.parse(readFileSync(path.join(ROOT, "app/data/zones.json"), "utf8"));

// Se resuelve { cv } envuelto: el objeto de OpenCV.js tiene .then y colgaría la Promise.
const { cv } = await new Promise(res => {
  let mod = null;
  global.Module = { onRuntimeInitialized() { setImmediate(() => res({ cv: global.cv || mod })); } };
  mod = require(path.join(ROOT, "app/vendor/opencv-4.9.0.js"));
});
const { Localizer } = await import(pathToFileURL(path.join(ROOT, "app/localizer.js")).href);

const W = zones.image.width, H = zones.image.height;
const buf = readFileSync(path.join(ROOT, "tests/fixtures", zones.image.test_fixture));
const ref = new cv.Mat(H, W, cv.CV_8UC4); ref.data.set(buf);
const toId = m => ({ width: m.cols, height: m.rows, data: new Uint8ClampedArray(m.data) });
await Localizer.init(cv, toId(ref), zones);
console.log("refInfo", JSON.stringify(Localizer.getRefInfo()), "error", Localizer.getError());

const cases = {
  identidad: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  "escala 0,9": [0.9, 0, 40, 0, 0.9, 30, 0, 0, 1],
  "rotación 8°": [0.99, -0.14, 60, 0.14, 0.99, -20, 0, 0, 1],
  perspectiva: [0.95, 0.05, 20, -0.03, 0.97, 25, 0.00008, 0.00005, 1],
  "escala 0,6 (placa más lejos)": [0.6, 0, 150, 0, 0.6, 120, 0, 0, 1],
};
for (const [name, h] of Object.entries(cases)) {
  const Hm = cv.matFromArray(3, 3, cv.CV_64F, h), dst = new cv.Mat();
  cv.warpPerspective(ref, dst, Hm, new cv.Size(W, H), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(30, 30, 30, 255));
  const r = Localizer.locate(toId(dst));
  const g = r.zones[0];
  console.log(name.padEnd(30), "found", r.found, "visible", g.visible,
    JSON.stringify(r.diagMetrics), "evidencia", JSON.stringify(g.evidence));
  Hm.delete(); dst.delete();
}
process.exit(0);
