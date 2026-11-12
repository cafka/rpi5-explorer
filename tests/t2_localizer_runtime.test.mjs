/**
 * t2_localizer_runtime.test.mjs
 * Ejecuta el app/localizer.js REAL con el OpenCV.js 4.9.0 alojado en app/vendor/.
 *
 * Categoría: AUTOMÁTICA / SIMULADA (escritorio, Node).
 *   - Las escenas positivas son la propia referencia transformada con una homografía
 *     conocida. Eso verifica que el código funciona de punta a punta; NO es una
 *     evaluación independiente ni dice nada de la placa real ni del teléfono.
 *   - El caso negativo es ruido aleatorio.
 *   - La oclusión se simula pintando de negro la zona GPIO.
 *
 * Detecta, entre otros, el fallo de un ReferenceError en el finally de locate()
 * (que hacía que locate() nunca devolviera resultado).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, it, before, after } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, "..");
const require   = createRequire(import.meta.url);

const zones = JSON.parse(readFileSync(path.join(ROOT, "app", "data", "zones.json"), "utf8"));

// La prueba usa la referencia que zones.json declara como activa.
const fixtureName = zones.image.test_fixture;
const FIXTURE = path.join(ROOT, "tests", "fixtures", fixtureName);

let cv, Localizer;

/**
 * Carga OpenCV.js y resuelve { cv } envuelto: el objeto tiene .then y pasarlo
 * directo a resolve() deja la Promise colgada (mismo problema que en app.js).
 */
function loadCv() {
  return new Promise((resolve, reject) => {
    let mod = null;
    const to = setTimeout(() => reject(new Error("OpenCV.js no inicializó en 120 s")), 120000);
    global.Module = {
      onRuntimeInitialized() {
        clearTimeout(to);
        setImmediate(() => resolve({ cv: global.cv || mod }));
      },
    };
    mod = require(path.join(ROOT, "app", "vendor", "opencv-4.9.0.js"));
  });
}

/** ImageData mínimo compatible con cv.matFromImageData. */
function imageDataFromMat(mat) {
  const rgba = new cv.Mat();
  if (mat.channels() === 4) mat.copyTo(rgba);
  else cv.cvtColor(mat, rgba, mat.channels() === 1 ? cv.COLOR_GRAY2RGBA : cv.COLOR_RGB2RGBA);
  const out = { width: rgba.cols, height: rgba.rows, data: new Uint8ClampedArray(rgba.data) };
  rgba.delete();
  return out;
}

function refMat() {
  const buf = readFileSync(FIXTURE);
  const W = zones.image.width, H = zones.image.height;
  assert.equal(buf.length, W * H * 4, "fixture RGBA con tamaño inesperado");
  const m = new cv.Mat(H, W, cv.CV_8UC4);
  m.data.set(buf);
  return m;
}

/** Aplica una homografía conocida a la referencia y devuelve [ImageData, H(3x3 array)]. */
function warped(Harr, outW = 800, outH = 600) {
  const src = refMat();
  const Hm  = cv.matFromArray(3, 3, cv.CV_64F, Harr);
  const dst = new cv.Mat();
  cv.warpPerspective(src, dst, Hm, new cv.Size(outW, outH), cv.INTER_LINEAR,
                     cv.BORDER_CONSTANT, new cv.Scalar(30, 30, 30, 255));
  const id = imageDataFromMat(dst);
  src.delete(); Hm.delete(); dst.delete();
  return id;
}

function applyH(H, [x, y]) {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

function maxCornerError(polygon, expected) {
  return Math.max(...polygon.map((p, i) => Math.hypot(p[0] - expected[i][0], p[1] - expected[i][1])));
}

const gpioRef = zones.zones.find(z => z.id === "gpio").polygon_px;

before(async () => {
  ({ cv } = await loadCv());
  ({ Localizer } = await import(path.join(ROOT, "app", "localizer.js").replace(/\\/g, "/").replace(/^([A-Za-z]):/, "file:///$1:")));
  const ref = refMat();
  await Localizer.init(cv, imageDataFromMat(ref), zones);
  ref.delete();
});

// El runtime de Emscripten mantiene vivo el proceso; se cierra al terminar
// respetando process.exitCode (node:test lo pone en 1 si algo falló).
after(() => { Localizer && Localizer.dispose(); setTimeout(() => process.exit(), 200); });

describe("localizer.js real + OpenCV.js 4.9.0 (simulado, escritorio)", () => {

  it("init() deja el localizador listo con la referencia activa", () => {
    assert.equal(Localizer.getError(), null);
    assert.equal(Localizer.isReady(), true);
  });

  it("locate() sobre la referencia sin transformar localiza GPIO (error de esquinas < 8 px)", () => {
    const id = warped([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const r  = Localizer.locate(id);
    assert.equal(r.found, true, JSON.stringify(r.diagMetrics));
    const g = r.zones.find(z => z.id === "gpio");
    assert.equal(g.visible, true, "GPIO debería tener evidencia local");
    assert.ok(maxCornerError(g.polygon, gpioRef) < 8, `polígono ${JSON.stringify(g.polygon)}`);
  });

  for (const [name, H] of [
    ["traslación + escala 0,9", [0.9, 0, 40, 0, 0.9, 30, 0, 0, 1]],
    ["rotación ~8°",            [0.99, -0.14, 60, 0.14, 0.99, -20, 0, 0, 1]],
    ["perspectiva moderada",    [0.95, 0.05, 20, -0.03, 0.97, 25, 0.00008, 0.00005, 1]],
  ]) {
    it(`Transformación conocida (${name}): polígono proyectado cerca del esperado (< 12 px)`, () => {
      const r = Localizer.locate(warped(H));
      assert.equal(r.found, true, JSON.stringify(r.diagMetrics));
      const g = r.zones.find(z => z.id === "gpio");
      const expected = gpioRef.map(p => applyH(H, p));
      assert.equal(g.visible, true);
      assert.ok(maxCornerError(g.polygon, expected) < 12,
        `error ${maxCornerError(g.polygon, expected).toFixed(1)} px`);
    });
  }

  it("Oclusión simulada (GPIO pintado de negro): no se acepta la zona GPIO", () => {
    const m = refMat();
    const xs = gpioRef.map(p => p[0]), ys = gpioRef.map(p => p[1]);
    cv.rectangle(m, new cv.Point(Math.min(...xs), Math.min(...ys)),
                    new cv.Point(Math.max(...xs), Math.max(...ys)),
                 new cv.Scalar(0, 0, 0, 255), -1);
    const r = Localizer.locate(imageDataFromMat(m));
    m.delete();
    const g = r.zones.find(z => z.id === "gpio");
    assert.equal(g.visible, false, "La zona tapada no debe etiquetarse");
  });

  it("Oclusión simulada con objeto texturado (ruido sobre GPIO): no se acepta la zona", () => {
    const m = refMat();
    const xs = gpioRef.map(p => p[0]), ys = gpioRef.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    let s = 99;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const v = 60 + (s & 127), o = (y * m.cols + x) * 4;
      m.data[o] = v; m.data[o + 1] = v * 0.8; m.data[o + 2] = v * 0.6;
    }
    const r = Localizer.locate(imageDataFromMat(m));
    m.delete();
    const g = r.zones.find(z => z.id === "gpio");
    assert.equal(g.visible, false, `evidencia: ${JSON.stringify(g.evidence)}`);
  });

  it("Zona fuera del encuadre (placa desplazada hacia abajo-derecha): no se acepta", () => {
    // Desplaza la referencia de modo que el GPIO quede por encima/izquierda del cuadro
    const r = Localizer.locate(warped([1, 0, 250, 0, 1, -110, 0, 0, 1]));
    const g = r.zones.find(z => z.id === "gpio");
    assert.equal(g.visible, false, `evidencia: ${JSON.stringify(g.evidence)}`);
  });

  it("Escena negativa (ruido aleatorio): sin etiqueta GPIO", () => {
    const W = 800, H = 600, data = new Uint8ClampedArray(W * H * 4);
    let s = 7;
    for (let i = 0; i < data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const v = s & 255; data[i] = v; data[i + 1] = (v * 7) & 255; data[i + 2] = (v * 13) & 255; data[i + 3] = 255;
    }
    const r = Localizer.locate({ width: W, height: H, data });
    const g = r.zones.find(z => z.id === "gpio");
    assert.equal(g.visible, false);
  });

  it("Escena negativa uniforme (sin textura): found=false", () => {
    const W = 640, H = 480, data = new Uint8ClampedArray(W * H * 4).fill(128);
    const r = Localizer.locate({ width: W, height: H, data });
    assert.equal(r.found, false);
  });

  it("100 llamadas seguidas a locate() no lanzan excepciones", () => {
    const id = warped([0.9, 0, 40, 0, 0.9, 30, 0, 0, 1]);
    for (let i = 0; i < 100; i++) Localizer.locate(id);
  });

  it("Tiempo de locate() en escritorio a 640x480 (solo referencia; no es medición móvil)", () => {
    const id = warped([0.8, 0, 20, 0, 0.8, 20, 0, 0, 1], 640, 480);
    const t0 = performance.now();
    const N = 20;
    for (let i = 0; i < N; i++) Localizer.locate(id);
    const ms = (performance.now() - t0) / N;
    console.log(`    [escritorio] locate() medio a 640x480: ${ms.toFixed(1)} ms`);
    assert.ok(ms > 0);
  });
});
