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

// Variantes sobre el MISMO cuadro (solo diagnóstico), con Localizer.configure() — las mismas
// que ofrece la barra de variantes de la app en modo diagnóstico.
const VARIANT_CFG = {
  orb800: {}, orb1500: { frameFeatures: 1500 }, orb2500: { frameFeatures: 2500, refFeatures: 2500 },
  ratio08: { ratio: 0.8 }, ratio085: { ratio: 0.85 },
  akaze: { detector: "akaze" }, akaze08: { detector: "akaze", ratio: 0.8 },
};
const VARIANTS = (featureList || Object.keys(VARIANT_CFG).join(",")).split(",");
for (const v of VARIANTS) {
  if (!VARIANT_CFG[v]) throw new Error(`variante desconocida: ${v}`);
  Localizer.configure(VARIANT_CFG[v]);
  await Localizer.init(cv, { width: RW, height: RH, data: new Uint8ClampedArray(ref) }, zones);
  Localizer.setDebug(true);
  const t0 = performance.now();
  const r = Localizer.locate(frame);
  const ms = Math.round(performance.now() - t0);
  const z = r.zones[0];
  console.log(`variante ${v.padEnd(9)} found=${String(r.found).padEnd(5)} visible=${String(z.visible).padEnd(5)} ` +
    `kp=${r.diagMetrics.frameKeypoints} matches=${r.diagMetrics.matchesUsed} inliers=${r.diagMetrics.inliers} ${ms}ms ` +
    `gpio=${JSON.stringify(z.polygon || z.polygonDebug || null)} tramos=${JSON.stringify((z.evidence || {}).nccSeg || (z.evidence || {}).reason || null)}`);
}
Localizer.configure();
process.exit(0);
