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
function warped(Harr, outW = zones.image.width, outH = zones.image.height) {
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

  it("Placa girada 90° en cuadro vertical (como en el teléfono): polígono cerca del esperado", () => {
    // Giro horario: (x, y) → (Href − y, x), luego escala 0,8 y desplazamiento; salida vertical
    const Hr = zones.image.height, s = 0.8, tx = 60, ty = 90;
    const H = [0, -s, s * Hr + tx, s, 0, ty, 0, 0, 1];
    const outW = Math.round(zones.image.height * 1.0), outH = Math.round(zones.image.width * 1.0);
    const r = Localizer.locate(warped(H, outW, outH));
    assert.equal(r.found, true, JSON.stringify(r.diagMetrics));
    const g = r.zones.find(z => z.id === "gpio");
    assert.equal(g.visible, true, `evidencia: ${JSON.stringify(g.evidence)}`);
    const expected = gpioRef.map(p => applyH(H, p));
    assert.ok(maxCornerError(g.polygon, expected) < 12, `error ${maxCornerError(g.polygon, expected).toFixed(1)} px`);
  });

  it("Diagnóstico: contorno de placa e inliers coherentes con la homografía conocida", () => {
    const H = [0.9, 0, 40, 0, 0.9, 30, 0, 0, 1];
    Localizer.setDebug(true);
    const r = Localizer.locate(warped(H));
    Localizer.setDebug(false);
    assert.ok(r.debug && Array.isArray(r.debug.board) && r.debug.inlierPts.length > 50);
    const expectedBoard = zones.board_polygon_px.map(p => applyH(H, p));
    assert.ok(maxCornerError(r.debug.board, expectedBoard) < 12, "contorno de placa desplazado");
    assert.equal(r.debug.procW, zones.image.width);
    for (const [x, y] of r.debug.inlierPts) {
      assert.ok(x >= 0 && x < zones.image.width && y >= 0 && y < zones.image.height);
    }
  });

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
    // Enteros: con coordenadas decimales, m.data[o] con índice fraccionario no pinta nada
    const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs));
    const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
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

  it("Oclusión parcial (un tercio del GPIO tapado con un tono de piel): no se acepta", () => {
    const m = refMat();
    const xs = gpioRef.map(p => p[0]), ys = gpioRef.map(p => p[1]);
    const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs));
    const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    const xm = Math.round(x0 + (x1 - x0) / 3);
    cv.rectangle(m, new cv.Point(x0, y0 - 4), new cv.Point(xm, y1 + 4), new cv.Scalar(205, 160, 130, 255), -1);
    const r = Localizer.locate(imageDataFromMat(m));
    m.delete();
    const g = r.zones.find(z => z.id === "gpio");
    assert.equal(g.visible, false, `evidencia: ${JSON.stringify(g.evidence)}`);
  });

  it("Zona fuera del encuadre (resto de la placa visible): no se acepta", () => {
    // Desplaza verticalmente lo justo para sacar el GPIO del cuadro, hacia el borde
    // más cercano, dejando el resto de la placa dentro.
    const ys = gpioRef.map(p => p[1]), H = zones.image.height;
    const dy = (Math.min(...ys) + Math.max(...ys)) / 2 > H / 2
      ? H - Math.min(...ys) + 4          // GPIO abajo → empujar hacia abajo
      : -(Math.max(...ys) + 4);          // GPIO arriba → empujar hacia arriba
    const r = Localizer.locate(warped([1, 0, 0, 0, 1, dy, 0, 0, 1]));
    const g = r.zones.find(z => z.id === "gpio");
    assert.equal(g.visible, false, `evidencia: ${JSON.stringify(g.evidence)}`);
  });

  it("Escena negativa (ruido aleatorio): sin etiqueta GPIO", () => {
    const W = zones.image.width, H = zones.image.height, data = new Uint8ClampedArray(W * H * 4);
    let s = 7;
    for (let i = 0; i < data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const v = s & 255; data[i] = v; data[i + 1] = (v * 7) & 255; data[i + 2] = (v * 13) & 255; data[i + 3] = 255;
    }
    const r = Localizer.locate({ width: W, height: H, data });
    const g = r.zones.find(z => z.id === "gpio");
    assert.equal(g.visible, false);
  });

  it("Modo diagnóstico: la oclusión sigue rechazada, se informa polygonDebug y parche; sin debug no", () => {
    const m = refMat();
    const xs = gpioRef.map(p => p[0]), ys = gpioRef.map(p => p[1]);
    cv.rectangle(m, new cv.Point(Math.min(...xs), Math.min(...ys)), new cv.Point(Math.max(...xs), Math.max(...ys)),
                 new cv.Scalar(205, 160, 130, 255), -1);
    const id = imageDataFromMat(m); m.delete();
    Localizer.setDebug(true);
    const d = Localizer.locate(id).zones.find(z => z.id === "gpio");
    Localizer.setDebug(false);
    const n = Localizer.locate(id).zones.find(z => z.id === "gpio");
    assert.equal(d.visible, false);
    assert.equal(d.polygon, null, "una zona rechazada nunca lleva polygon");
    assert.ok(Array.isArray(d.polygonDebug) && d.polygonDebug.length === 4);
    assert.ok(d.debugPatch && d.debugPatch.data.length === d.debugPatch.width * d.debugPatch.height * 4);
    assert.equal(n.visible, false);
    assert.equal(n.polygonDebug, undefined, "sin modo diagnóstico no se informa la proyección");
    // Parche uniforme (sin contraste): se rechaza antes de calcular tramos → lowSeg vacío
    assert.deepEqual(n.evidence.lowSeg, []);
    // En un cuadro con la zona visible se informan los 3 tramos de ambas métricas
    const v = Localizer.locate(warped([1, 0, 0, 0, 1, 0, 0, 0, 1])).zones.find(z => z.id === "gpio");
    assert.equal(v.visible, true);
    assert.equal(v.evidence.nccSeg.length, 3);
    assert.equal(v.evidence.lowSeg.length, 3);
  });

  it("configure(): valores por defecto del modo normal sin cambios", () => {
    assert.deepEqual(Localizer.getConfig(), { detector: "orb", refFeatures: 1500, frameFeatures: 800, ratio: 0.75 });
  });

  // maxErr: error máximo de la proyección del GPIO. mustLabel: si debe superar el criterio.
  // Medido (12/11/2026): ratio 0,85 suma coincidencias pero la homografía queda ~5 px menos
  // precisa y el GPIO (patrón repetitivo de ~10 px) cae bajo el umbral → mustLabel=false.
  for (const [name, cfg, maxErr, mustLabel] of [
    ["ORB 1500", { frameFeatures: 1500 }, 4, true],
    ["ratio 0,8", { ratio: 0.8 }, 4, true],
    ["ratio 0,85", { ratio: 0.85 }, 8, false],
    ["AKAZE", { detector: "akaze" }, 4, true],
  ]) {
    it(`Variante de diagnóstico ${name}: localiza la placa (error GPIO < ${maxErr} px) y rechaza la oclusión`, async () => {
      Localizer.configure(cfg);
      const ref = refMat();
      await Localizer.init(cv, imageDataFromMat(ref), zones);
      ref.delete();
      try {
        const H = [0.9, 0, 40, 0, 0.9, 30, 0, 0, 1];
        Localizer.setDebug(true);
        const r = Localizer.locate(warped(H));
        Localizer.setDebug(false);
        const g = r.zones.find(z => z.id === "gpio");
        assert.equal(r.found, true, JSON.stringify(r.diagMetrics));
        const err = maxCornerError(g.polygon || g.polygonDebug, gpioRef.map(p => applyH(H, p)));
        assert.ok(err < maxErr, `error ${err.toFixed(1)} px`);
        if (mustLabel) assert.equal(g.visible, true, `evidencia: ${JSON.stringify(g.evidence)}`);
        const m = refMat();
        const xs = gpioRef.map(p => p[0]), ys = gpioRef.map(p => p[1]);
        cv.rectangle(m, new cv.Point(Math.min(...xs), Math.min(...ys)), new cv.Point(Math.max(...xs), Math.max(...ys)),
                     new cv.Scalar(205, 160, 130, 255), -1);
        const o = Localizer.locate(imageDataFromMat(m)).zones.find(z => z.id === "gpio");
        m.delete();
        assert.equal(o.visible, false);
      } finally {
        // Volver a la configuración normal para el resto de las pruebas
        Localizer.configure();
        const r2 = refMat();
        await Localizer.init(cv, imageDataFromMat(r2), zones);
        r2.delete();
      }
    });
  }

  it("AKAZE en cuadro de 360 px de ancho (placa pequeña): ubica placa y GPIO cerca del esperado", async () => {
    Localizer.configure({ detector: "akaze" });
    const ref = refMat();
    await Localizer.init(cv, imageDataFromMat(ref), zones);
    ref.delete();
    try {
      // Placa girada 90° y reducida a ~0,4 en un cuadro vertical de 360x640
      const Hr = zones.image.height, s = 0.42, tx = 20, ty = 110;
      const H = [0, -s, s * Hr + tx, s, 0, ty, 0, 0, 1];
      Localizer.setDebug(true);
      const r = Localizer.locate(warped(H, 360, 640));
      Localizer.setDebug(false);
      assert.equal(r.found, true, JSON.stringify(r.diagMetrics));
      const g = r.zones.find(z => z.id === "gpio");
      const err = maxCornerError(g.polygon || g.polygonDebug, gpioRef.map(p => applyH(H, p)));
      assert.ok(err < 4, `error ${err.toFixed(1)} px (en el cuadro de 360 px)`);
      // Dimensiones del cuadro realmente analizado (informadas en modo diagnóstico)
      assert.equal(r.debug.procW, 360);
      assert.equal(r.debug.procH, 640);
    } finally {
      Localizer.configure();
      const r2 = refMat();
      await Localizer.init(cv, imageDataFromMat(r2), zones);
      r2.delete();
    }
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
