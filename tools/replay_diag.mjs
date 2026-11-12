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

// Comparación opcional sobre el MISMO cuadro con otras cantidades de puntos por fotograma.
// Usa una copia en memoria del módulo; app/localizer.js no se modifica. Solo diagnóstico.
if (featureList) {
  const src = readFileSync(path.join(ROOT, "app/localizer.js"), "utf8");
  for (const n of featureList.split(",").map(Number)) {
    const patched = src.replace(/const ORB_FRAME_FEATURES = \d+;/, `const ORB_FRAME_FEATURES = ${n};`);
    const mod = await import("data:text/javascript;base64," + Buffer.from(patched + `\n//${n}`).toString("base64"));
    await mod.Localizer.init(cv, { width: RW, height: RH, data: new Uint8ClampedArray(ref) }, zones);
    mod.Localizer.setDebug(true);
    const v = mod.Localizer.locate(frame);
    const z = v.zones[0];
    console.log(`variante ${String(n).padStart(4)} puntos: found=${v.found} visible=${z.visible} ` +
      `matches=${v.diagMetrics.matchesUsed} inliers=${v.diagMetrics.inliers} ` +
      `gpio=${JSON.stringify(z.polygon || z.polygonDebug || null)} tramos=${JSON.stringify((z.evidence || {}).nccSeg || (z.evidence || {}).reason || null)}`);
    mod.Localizer.dispose();
  }
}
process.exit(0);
