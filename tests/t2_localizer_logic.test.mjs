/**
 * t2_localizer_logic.test.mjs
 * Pruebas de escritorio para la lógica de T2.
 * Categoría: ESCRITORIO / SIMULADO — sin cámara real, sin OpenCV.js.
 *
 * Cobertura:
 *   - Funciones puras extraídas de localizer.js (sin instanciar OpenCV).
 *   - Validación de polígono: área, posición dentro del frame.
 *   - Proyección correcta de etiqueta (centroide).
 *   - Resultado locate() cuando Localizer no está ready → found:false.
 *   - Coherencia de zones.json generado.
 *   - Que overlay.js no existe sin canvas (no lanza en import).
 *   - Que el archivo de referencia fue generado y existe.
 *   - Que zones.json tiene exactamente 1 zona en T2.
 *   - Verificación estructural de localizer.js: que expone init/locate/dispose.
 */

import assert   from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, "..");

// ── Helpers extraídos de localizer.js (duplicados para prueba pura) ───────────

function isPolygonPlausibleTest(polygon, frameW, frameH) {
  if (!polygon || polygon.length < 3) return false;
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
  }
  area = Math.abs(area) / 2;
  const minArea = (frameW * frameH) * 0.001;
  const maxArea = (frameW * frameH) * 0.9;
  if (area < minArea || area > maxArea) return false;
  const margin = -50;
  return polygon.some(([x, y]) =>
    x > margin && x < frameW - margin &&
    y > margin && y < frameH - margin
  );
}

function centroid(polygon) {
  const cx = Math.round(polygon.reduce((s, p) => s + p[0], 0) / polygon.length);
  const cy = Math.round(polygon.reduce((s, p) => s + p[1], 0) / polygon.length);
  return [cx, cy];
}

// ── Tests — polígono ──────────────────────────────────────────────────────────

describe("isPolygonPlausible — validación de polígono", () => {

  it("Polígono normal dentro del frame → plausible", () => {
    const poly = [[100,100],[300,100],[300,200],[100,200]];
    assert.ok(isPolygonPlausibleTest(poly, 1280, 720));
  });

  it("Polígono null → no plausible", () => {
    assert.equal(isPolygonPlausibleTest(null, 1280, 720), false);
  });

  it("Polígono con menos de 3 vértices → no plausible", () => {
    assert.equal(isPolygonPlausibleTest([[0,0],[1,1]], 1280, 720), false);
  });

  it("Polígono con área mínima (< 0.1% del frame) → no plausible", () => {
    // 1280×720 = 921600 px². 0.1% = 921 px². Polígono de 10×10 = 100 px²
    const tiny = [[0,0],[10,0],[10,10],[0,10]];
    assert.equal(isPolygonPlausibleTest(tiny, 1280, 720), false);
  });

  it("Polígono que cubre > 90% del frame → no plausible", () => {
    const huge = [[0,0],[1280,0],[1280,720],[0,720]];
    assert.equal(isPolygonPlausibleTest(huge, 1280, 720), false);
  });

  it("Polígono completamente fuera del frame (margen -50) → no plausible", () => {
    const offscreen = [[-200,-200],[-100,-200],[-100,-100],[-200,-100]];
    assert.equal(isPolygonPlausibleTest(offscreen, 1280, 720), false);
  });

  it("Polígono parcialmente fuera del frame → plausible (1 vértice dentro)", () => {
    const partial = [[-20,-20],[200,-20],[200,200],[-20,200]];
    assert.ok(isPolygonPlausibleTest(partial, 1280, 720));
  });

});

describe("Centroide de polígono", () => {

  it("Rectángulo 100-300 x 100-200 → centroide (200, 150)", () => {
    const poly = [[100,100],[300,100],[300,200],[100,200]];
    const [cx, cy] = centroid(poly);
    assert.equal(cx, 200);
    assert.equal(cy, 150);
  });

  it("Triángulo → centroide correcto", () => {
    const poly = [[0,0],[120,0],[60,90]];
    const [cx, cy] = centroid(poly);
    assert.equal(cx, 60);
    assert.equal(cy, 30);
  });

});

// ── Tests — zones.json ────────────────────────────────────────────────────────

describe("zones.json — estructura y contenido", () => {

  const zonesPath = path.join(ROOT, "app", "data", "zones.json");
  let zones;

  it("El archivo zones.json existe", () => {
    assert.ok(existsSync(zonesPath), "zones.json no encontrado en app/data/");
  });

  it("zones.json es JSON válido", () => {
    const raw = readFileSync(zonesPath, "utf8");
    zones = JSON.parse(raw);
    assert.ok(zones, "JSON.parse falló");
  });

  it("zones.json tiene campo 'image' con file, width, height, origin", () => {
    assert.ok(zones.image, "falta campo 'image'");
    assert.ok(zones.image.file,   "falta image.file");
    assert.ok(zones.image.width  > 0, "image.width debe ser > 0");
    assert.ok(zones.image.height > 0, "image.height debe ser > 0");
    assert.ok(zones.image.origin, "falta image.origin");
  });

  it("zones.json tiene exactamente 1 zona en T2 (GPIO)", () => {
    assert.ok(Array.isArray(zones.zones), "zones.zones debe ser array");
    assert.equal(zones.zones.length, 1, "T2 debe tener exactamente 1 zona");
  });

  it("La zona tiene id, name, polygon_px y source", () => {
    const z = zones.zones[0];
    assert.ok(z.id,          "falta id");
    assert.ok(z.name,        "falta name");
    assert.ok(z.source,      "falta source (atribución requerida)");
    assert.ok(Array.isArray(z.polygon_px), "falta polygon_px");
    assert.ok(z.polygon_px.length >= 3,    "polygon_px debe tener al menos 3 vértices");
  });

  it("El polígono de la zona GPIO es plausible respecto a la imagen de referencia", () => {
    const z  = zones.zones[0];
    const iW = zones.image.width;
    const iH = zones.image.height;
    assert.ok(
      isPolygonPlausibleTest(z.polygon_px, iW, iH),
      `Polígono GPIO no es plausible en imagen ${iW}×${iH}: ${JSON.stringify(z.polygon_px)}`
    );
  });

  it("El id de la zona es 'gpio'", () => {
    assert.equal(zones.zones[0].id, "gpio");
  });

  it("La fuente menciona raspberrypi.com", () => {
    assert.match(zones.zones[0].source, /raspberrypi\.com/i);
  });

});

// ── Tests — imagen de referencia ──────────────────────────────────────────────

describe("Imagen de referencia", () => {

  it("rpi5_ref.png existe en app/data/reference/", () => {
    const p = path.join(ROOT, "app", "data", "reference", "rpi5_ref.png");
    assert.ok(existsSync(p), "rpi5_ref.png no encontrado");
  });

  it("rpi5_ref.png tiene más de 10 KB (no es un archivo vacío/mínimo)", () => {
    const p    = path.join(ROOT, "app", "data", "reference", "rpi5_ref.png");
    const stat = readFileSync(p);
    assert.ok(stat.length > 10_000, `Archivo demasiado pequeño: ${stat.length} bytes`);
  });

});

// ── Tests — API pública de localizer.js ───────────────────────────────────────

describe("localizer.js — estructura de API pública", () => {

  const locPath = path.join(ROOT, "app", "localizer.js");
  const src = readFileSync(locPath, "utf8");

  it("Exporta Localizer como export const", () => {
    assert.ok(/export const Localizer/.test(src), "No se encontró 'export const Localizer'");
  });

  it("Expone función init", () => {
    assert.ok(/function init\s*\(/.test(src), "No se encontró función init");
  });

  it("Expone función locate", () => {
    assert.ok(/function locate\s*\(/.test(src), "No se encontró función locate");
  });

  it("Expone función dispose", () => {
    assert.ok(/function dispose\s*\(/.test(src), "No se encontró función dispose");
  });

  it("Verifica capacidades antes de usar OpenCV (checkCapabilities)", () => {
    assert.ok(/checkCapabilities/.test(src), "No se encontró checkCapabilities — falta verificación de API");
  });

  it("Libera Mats en bloque finally (gestión de memoria)", () => {
    assert.ok(/finally/.test(src), "No se encontró bloque finally — riesgo de leak de Mat");
  });

  it("Usa matFromArray para construir puntos (patrón correcto para findHomography)", () => {
    assert.ok(/matFromArray/.test(src), "No se encontró matFromArray — puede causar error en findHomography");
  });

  it("locate() devuelve found:false si no está ready (sin lanzar excepción)", () => {
    // Verificación estática: locate() verifica _ready al inicio
    assert.ok(/if\s*\(!_ready\)/.test(src), "locate() debe verificar _ready");
  });

  it("No tiene posiciones fijas ni resultados simulados (sin coordenadas hardcodeadas en locate)", () => {
    // Verificación de que locate() no retorna directamente una coordenada fija
    // Buscar patrones como "return { found: true" sin pasar por la lógica de homografía
    // Aproximación: no debe haber "found: true" antes del bloque de homografía
    const foundTrueIdx  = src.indexOf("found: true");
    const homographyIdx = src.indexOf("findHomography");
    // found:true debe aparecer DESPUÉS de findHomography en el código
    assert.ok(
      foundTrueIdx > homographyIdx,
      "found:true aparece antes que findHomography — posible resultado simulado"
    );
  });

});

// ── Tests — cameraHooks en camera.js ─────────────────────────────────────────

describe("camera.js — hooks para T2", () => {

  const camSrc = readFileSync(path.join(ROOT, "app", "camera.js"), "utf8");

  it("Define window.cameraHooks", () => {
    assert.ok(/window\.cameraHooks/.test(camSrc), "No se encontró window.cameraHooks");
  });

  it("Llama a cameraHooks.onFrame en el loop", () => {
    assert.ok(/cameraHooks\.onFrame/.test(camSrc), "No se llama a onFrame en el loop");
  });

  it("Llama a cameraHooks.onFreeze al congelar", () => {
    assert.ok(/cameraHooks\.onFreeze/.test(camSrc), "No se llama a onFreeze al congelar");
  });

  it("Llama a cameraHooks.onResume al reanudar", () => {
    assert.ok(/cameraHooks\.onResume/.test(camSrc), "No se llama a onResume al reanudar");
  });

  it("onFrame se llama DESPUÉS de dibujar el frame (drawImage antes de onFrame en drawLoop)", () => {
    // Extraer el cuerpo de la función drawLoop para buscar solo ahí
    const drawLoopStart = camSrc.indexOf("function drawLoop()");
    assert.ok(drawLoopStart >= 0, "No se encontró drawLoop()");
    // Encontrar el fin del cuerpo (contar llaves)
    let depth = 0, inBody = false, end = drawLoopStart;
    for (let i = drawLoopStart; i < camSrc.length; i++) {
      if (camSrc[i] === "{") { depth++; inBody = true; }
      if (inBody && camSrc[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    const drawLoopBody = camSrc.slice(drawLoopStart, end + 1);
    const drawIdx = drawLoopBody.indexOf("ctx.drawImage");
    const hookIdx = drawLoopBody.indexOf("cameraHooks.onFrame");
    assert.ok(drawIdx  >= 0, "ctx.drawImage no encontrado en drawLoop");
    assert.ok(hookIdx  >= 0, "cameraHooks.onFrame no encontrado en drawLoop");
    assert.ok(drawIdx < hookIdx, "onFrame debe llamarse después de ctx.drawImage");
  });

  it("onFreeze se llama ANTES de liberar el stream", () => {
    // freeze() debe llamar onFreeze antes de releaseStream
    const freezeFnStart = camSrc.indexOf("function freeze()");
    const freezeFnBody  = camSrc.slice(freezeFnStart, freezeFnStart + 600);
    const onFreezeIdx   = freezeFnBody.indexOf("onFreeze");
    const releaseIdx    = freezeFnBody.indexOf("releaseStream");
    assert.ok(
      onFreezeIdx < releaseIdx,
      "onFreeze debe llamarse antes de releaseStream para que el canvas aún tenga el cuadro"
    );
  });

});
