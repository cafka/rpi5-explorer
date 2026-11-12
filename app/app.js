/**
 * app.js — T2: coordinador cámara + localizador + overlay
 *
 * Flujo:
 *   1. camera.js (script clásico) ya arrancó la cámara y expone window.cameraHooks.
 *   2. Se registran onFrame / onFreeze / onResume.
 *   3. Se espera a OpenCV.js (o a su error de carga) y se informa en pantalla.
 *   4. Se cargan zones.json y la imagen de referencia indicada en zones.json.
 *   5. En cada fotograma: se reduce a ≤ PROC_MAX_W px, se localiza, se reescala
 *      el resultado a coordenadas del canvas y se dibuja.
 *
 * Métricas (medidas, no estimadas):
 *   - loc/s: cantidad de llamadas a locate() completadas en los últimos 5 s / 5.
 *   - antigüedad: desde que el fotograma se dibujó en el canvas hasta que su
 *     resultado quedó dibujado en el overlay. No incluye la latencia interna
 *     de la cámara del teléfono (no medible desde esta API).
 */

"use strict";

import { Localizer } from "./localizer.js";
import { Overlay }   from "./overlay.js";

const canvasLive    = document.getElementById("canvas-live");
const canvasOverlay = document.getElementById("canvas-overlay");
const diagLine      = document.getElementById("diag-line");

/** Ancho máximo del fotograma usado para localizar (reduce costo de ORB). */
const PROC_MAX_W = 640;

let _locReady   = false;
let _locStatus  = "cargando OpenCV.js…";
let _refLabel   = "";
let _lastResult = null;
let _frozen     = false;

// Canvas de trabajo reutilizado para reducir el fotograma
const _work    = document.createElement("canvas");
const _workCtx = _work.getContext("2d", { willReadFrequently: true });

// ── Métricas medidas ──────────────────────────────────────────────────────────

const WINDOW_MS   = 5000;
const _doneTimes  = [];   // instantes (ms) en que terminó cada locate()
const _ages       = [];   // antigüedad (ms) de cada resultado presentado
const AGE_SAMPLES = 100;

function recordLocate(tDone, ageMs) {
  _doneTimes.push(tDone);
  while (_doneTimes.length && tDone - _doneTimes[0] > WINDOW_MS) _doneTimes.shift();
  _ages.push(ageMs);
  if (_ages.length > AGE_SAMPLES) _ages.shift();
}

function p95(values) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)];
}

function getPerfStats() {
  const now = performance.now();
  const recent = _doneTimes.filter(t => now - t <= WINDOW_MS);
  return {
    locPerSec: Math.round((recent.length / (WINDOW_MS / 1000)) * 10) / 10,
    ageP95Ms:  Math.round(p95(_ages)),
    samples:   _ages.length,
    procSize:  `${_work.width}x${_work.height}`,
    videoSize: `${canvasLive.width}x${canvasLive.height}`,
  };
}
window.getPerfStats = getPerfStats;

// ── Línea de diagnóstico en pantalla ─────────────────────────────────────────

let _lastDiagUpdate = 0;
function updateDiag(force = false) {
  const now = performance.now();
  if (!force && now - _lastDiagUpdate < 500) return;
  _lastDiagUpdate = now;
  let text = `DIAGNÓSTICO · localizador: ${_locStatus}`;
  if (_locReady) {
    const s = getPerfStats();
    const r = _lastResult && _lastResult.diagMetrics;
    text += ` · ${s.locPerSec} loc/s · p95 ${s.ageP95Ms} ms · video ${s.videoSize} → ${s.procSize}`;
    if (r) text += ` · kp ${r.frameKeypoints ?? "?"} · matches ${r.matchesUsed} · inliers ${r.inliers}`;
    const g = _lastResult && _lastResult.zones && _lastResult.zones[0];
    if (g) {
      text += ` · ${g.id.toUpperCase()}: ${g.visible ? "ETIQUETADA" : "sin evidencia"}`;
      if (g.evidence && g.evidence.ncc !== undefined) text += ` (zona inl ${g.evidence.zoneInliers}, ncc ${g.evidence.ncc})`;
    }
    if (_refLabel) text += ` · ref: ${_refLabel}`;
  }
  diagLine.textContent = text;
}

// ── Overlay ───────────────────────────────────────────────────────────────────

Overlay.init(canvasOverlay);

function syncOverlaySize() {
  if (canvasOverlay.width !== canvasLive.width || canvasOverlay.height !== canvasLive.height) {
    canvasOverlay.width  = canvasLive.width;
    canvasOverlay.height = canvasLive.height;
  }
}

/** Reescala un resultado de coordenadas de trabajo a coordenadas del canvas. */
function scaleResult(result, k) {
  if (!result || k === 1) return result;
  const sp = p => [Math.round(p[0] * k), Math.round(p[1] * k)];
  return {
    ...result,
    zones: result.zones.map(z => ({
      ...z,
      polygon: z.polygon ? z.polygon.map(sp) : null,
      labelPt: z.labelPt ? sp(z.labelPt) : null,
    })),
  };
}

// ── Hooks de cámara ───────────────────────────────────────────────────────────

function onFrame(canvas) {
  if (!_locReady || _frozen) return;
  const W = canvas.width, H = canvas.height;
  if (!W || !H) return;

  // Instante en que este fotograma quedó dibujado (onFrame se llama tras drawImage)
  const tFrame = performance.now();
  syncOverlaySize();

  // Reducir para localizar
  const k  = W > PROC_MAX_W ? W / PROC_MAX_W : 1;
  const pw = Math.round(W / k), ph = Math.round(H / k);
  if (_work.width !== pw || _work.height !== ph) { _work.width = pw; _work.height = ph; }
  _workCtx.drawImage(canvas, 0, 0, pw, ph);
  const imageData = _workCtx.getImageData(0, 0, pw, ph);

  const result = scaleResult(Localizer.locate(imageData), k);
  _lastResult  = result;

  // Solo se dibuja la zona si el localizador dio evidencia en ESTE fotograma
  const anyVisible = result.found && result.zones.some(z => z.visible);
  if (anyVisible) Overlay.drawResult(result);
  else            Overlay.showSearching();

  const tDone = performance.now();
  recordLocate(tDone, tDone - tFrame);
  updateDiag();
}

function onFreeze() {
  // Las etiquetas congeladas son las del último fotograma procesado,
  // que es el mismo que queda fijo en el canvas (locate es síncrono por fotograma).
  _frozen = true;
  Overlay.freezeResult(_lastResult && _lastResult.found ? _lastResult : null);
  Overlay.drawFrozen();
}

function onResume() {
  _frozen     = false;
  _lastResult = null;
  Overlay.clear();
}

if (window.cameraHooks) {
  window.cameraHooks.onFrame  = onFrame;
  window.cameraHooks.onFreeze = onFreeze;
  window.cameraHooks.onResume = onResume;
} else {
  _locStatus = "ERROR: camera.js no expuso cameraHooks";
  updateDiag(true);
}

// ── Carga de OpenCV.js ────────────────────────────────────────────────────────

function cvLooksReady(cv) {
  return !!(cv && typeof cv.Mat === "function" && typeof cv.ORB === "function");
}

/**
 * Espera a OpenCV.js y resuelve { cv } (envuelto).
 *
 * IMPORTANTE: el objeto de OpenCV.js 4.9.0 tiene un método .then (Emscripten).
 * Pasarlo directamente a resolve() hace que la Promise intente adoptarlo y
 * no termine nunca. Por eso siempre se resuelve un objeto contenedor.
 * Verificado en Node con app/vendor/opencv-4.9.0.js.
 */
function waitForOpenCV(timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    if (window._cvLoadError) return reject(new Error(window._cvLoadError));

    let done = false, poll = null, to = null;
    const finish = (ok, v) => {
      if (done) return;
      done = true; clearInterval(poll); clearTimeout(to);
      ok ? resolve({ cv: v }) : reject(v);
    };

    if (window._cvReady && cvLooksReady(window.cv)) return finish(true, window.cv);

    window.addEventListener("opencv-ready", () => {
      if (cvLooksReady(window.cv)) finish(true, window.cv);
    }, { once: true });
    window.addEventListener("opencv-error", () => finish(false, new Error(window._cvLoadError)), { once: true });

    // Respaldo: algunas compilaciones no llaman Module.onRuntimeInitialized en el navegador
    poll = setInterval(() => { if (cvLooksReady(window.cv)) finish(true, window.cv); }, 250);
    to = setTimeout(() => finish(false, new Error(`OpenCV.js no inicializó en ${timeoutMs / 1000} s`)), timeoutMs);
  });
}

async function loadJson(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
    img.src = url;
  });
}

(async () => {
  updateDiag(true);
  let cv;
  try {
    ({ cv } = await waitForOpenCV());
  } catch (e) {
    _locStatus = "ERROR: " + e.message;
    updateDiag(true);
    console.error("[app]", e);
    return;
  }

  _locStatus = "OpenCV listo; cargando referencia…";
  updateDiag(true);

  try {
    const zones = await loadJson("data/zones.json");
    const img   = await loadImage("data/reference/" + zones.image.file);
    _refLabel   = zones.image.kind || zones.image.file;
    await Localizer.init(cv, img, zones);
  } catch (e) {
    _locStatus = "ERROR: " + e.message;
    updateDiag(true);
    console.error("[app]", e);
    return;
  }

  if (!Localizer.isReady()) {
    _locStatus = "ERROR: " + (Localizer.getError() || "init falló");
    updateDiag(true);
    return;
  }

  _locReady  = true;
  _locStatus = "activo";
  updateDiag(true);
})();

window.addEventListener("pagehide", () => { Localizer.dispose(); Overlay.clear(); });
