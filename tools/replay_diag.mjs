/**
 * replay_diag.mjs — ejecuta el app/localizer.js REAL (modo diagnóstico) sobre un cuadro
 * RGBA crudo y escribe el resultado completo, con los recortes, en JSON.
 * Lo usa tools/replay_diag.py; no hace falta llamarlo a mano.
 *
 * Uso: node tools/replay_diag.mjs <frame.rgba> <ancho> <alto> <salida.json>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [rgbaPath, w, h, outPath, featureList] = process.argv.slice(2);
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

const RW = zones.image.width, RH = zones.image.height;
const ref = readFileSync(path.join(ROOT, "tests/fixtures", zones.image.test_fixture));
await Localizer.init(cv, { width: RW, height: RH, data: new Uint8ClampedArray(ref) }, zones);
if (!Localizer.isReady()) { console.error("init:", Localizer.getError()); process.exit(2); }

const frame = { width: +w, height: +h, data: new Uint8ClampedArray(readFileSync(rgbaPath)) };
Localizer.setDebug(true);
const r = Localizer.locate(frame);
const b64 = img => img ? { width: img.width, height: img.height, rgba: Buffer.from(img.data.buffer).toString("base64") } : null;
const out = {
  reference: { file: zones.image.file, sha256: zones.image.sha256, width: RW, height: RH },
  refInfo: Localizer.getRefInfo(),
  refPatch: b64(Localizer.getRefPatch("gpio")),
  refGpioPolygon: zones.zones[0].polygon_px,
  result: { ...r, zones: r.zones.map(({ debugPatch, ...z }) => ({ ...z, debugPatch: b64(debugPatch) })) },
};
writeFileSync(outPath, JSON.stringify(out));
console.log("replay OK");

// Variantes sobre el MISMO cuadro (solo diagnóstico). Cada una carga una copia en memoria
// del módulo con un cambio; app/localizer.js no se modifica.
//   orbN     → N puntos ORB por fotograma
//   ratioR   → umbral del ratio test (0,75 actual)
//   akaze    → detector AKAZE en referencia y fotograma (descriptor binario, NORM_HAMMING)
const VARIANTS = (featureList || "orb800,orb1500,orb2500,ratio0.8,ratio0.85,akaze").split(",");
const src = readFileSync(path.join(ROOT, "app/localizer.js"), "utf8");
function patch(v) {
  let s = src;
  const m = v.match(/^(orb|ratio)([\d.]+)$/);
  if (m && m[1] === "orb")   s = s.replace(/const ORB_FRAME_FEATURES = \d+;/, `const ORB_FRAME_FEATURES = ${m[2]};`);
  if (m && m[1] === "ratio") s = s.replace(/const RATIO_THRESH\s*=\s*[\d.]+;/, `const RATIO_THRESH = ${m[2]};`);
  if (v === "akaze") s = s.replace("new cv.ORB(ORB_FEATURES)", "new cv.AKAZE()").replace("new cv.ORB(ORB_FRAME_FEATURES)", "new cv.AKAZE()");
  if (s === src && v !== "orb800" && v !== "ratio0.75") throw new Error(`variante sin efecto: ${v}`);
  return s;
}
const gpioRef = zones.zones[0].polygon_px;
for (const v of VARIANTS) {
  const mod = await import("data:text/javascript;base64," + Buffer.from(patch(v) + `\n//${v}`).toString("base64"));
  await mod.Localizer.init(cv, { width: RW, height: RH, data: new Uint8ClampedArray(ref) }, zones);
  mod.Localizer.setDebug(true);
  const t0 = performance.now();
  const r = mod.Localizer.locate(frame);
  const ms = Math.round(performance.now() - t0);
  const z = r.zones[0];
  console.log(`variante ${v.padEnd(10)} found=${String(r.found).padEnd(5)} visible=${String(z.visible).padEnd(5)} ` +
    `kp=${r.diagMetrics.frameKeypoints} matches=${r.diagMetrics.matchesUsed} inliers=${r.diagMetrics.inliers} ${ms}ms ` +
    `gpio=${JSON.stringify(z.polygon || z.polygonDebug || null)} tramos=${JSON.stringify((z.evidence || {}).nccSeg || (z.evidence || {}).reason || null)}`);
  mod.Localizer.dispose();
}
process.exit(0);
