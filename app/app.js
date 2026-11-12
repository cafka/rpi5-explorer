/**
 * app.js — T2: coordinador principal
 *
 * Integra camera.js (T1), localizer.js y overlay.js (T2).
 * El módulo de cámara ya maneja getUserMedia y el loop de fotogramas.
 * Este módulo se engancha al loop mediante un callback de fotograma.
 *
 * Flujo:
 *   1. Esperar a que OpenCV.js esté listo.
 *   2. Cargar zones.json e imagen de referencia.
 *   3. Inicializar Localizer.
 *   4. Registrar onFrame en camera.js: en cada fotograma, llamar a locate()
 *      y pasar el resultado a Overlay.
 *   5. Al congelar: capturar el resultado actual y dibujarlo fijo.
 *   6. Al reanudar: limpiar overlay y relocalizar desde cero.
 *
 * Métricas de rendimiento:
 *   Se lleva un registro de los últimos N tiempos de procesamiento
 *   para calcular fps y p95 de antigüedad, visibles en consola y en overlay.
 */

"use strict";

import { Localizer } from "./localizer.js";
import { Overlay }   from "./overlay.js";

// ── Elementos del DOM ─────────────────────────────────────────────────────────

const canvasLive    = document.getElementById("canvas-live");
const canvasOverlay = document.getElementById("canvas-overlay");

// ── Estado del localizador ────────────────────────────────────────────────────

let _locReady   = false;
let _lastResult = null;

// ── Métricas de rendimiento ───────────────────────────────────────────────────

const PERF_WINDOW = 30;       // últimos 30 frames para calcular estadísticas
const _perfTimes  = [];       // tiempos de procesamiento en ms

function recordPerf(ms) {
  _perfTimes.push(ms);
  if (_perfTimes.length > PERF_WINDOW) _perfTimes.shift();
}

function getPerfStats() {
  if (_perfTimes.length === 0) return { fps: 0, p95Ms: 0 };
  const sorted = [..._perfTimes].sort((a, b) => a - b);
  const p95    = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
  // fps estimado: 1000 / media de los últimos frames
  const avg    = _perfTimes.reduce((s, t) => s + t, 0) / _perfTimes.length;
  return { fps: avg > 0 ? Math.round(1000 / avg * 10) / 10 : 0, p95Ms: Math.round(p95) };
}

// Exponer métricas globalmente para pruebas manuales en consola
window.getPerfStats = getPerfStats;

// ── Inicializar overlay ───────────────────────────────────────────────────────

Overlay.init(canvasOverlay);

// Sincronizar tamaño del canvas de overlay con el de video cuando cambie
function syncOverlaySize() {
  if (canvasOverlay.width  !== canvasLive.width ||
      canvasOverlay.height !== canvasLive.height) {
    canvasOverlay.width  = canvasLive.width;
    canvasOverlay.height = canvasLive.height;
  }
}

// ── Callback de fotograma (inyectado en camera.js) ────────────────────────────

/**
 * Se llama en cada fotograma del loop de cámara (desde camera.js).
 * El parámetro canvas es el canvas-live con el fotograma dibujado.
 */
function onFrame(canvas) {
  if (!_locReady) return;

  syncOverlaySize();

  const t0 = performance.now();
  const W  = canvas.width;
  const H  = canvas.height;
  if (W === 0 || H === 0) return;

  // Leer el fotograma actual
  const ctx       = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, W, H);

  // Localizar
  const result = Localizer.locate(imageData);
  _lastResult  = result;
  recordPerf(performance.now() - t0);

  // Dibujar overlay
  if (result.found) {
    // Comprobar si alguna zona tiene evidencia
    const anyVisible = result.zones.some(z => z.visible);
    if (anyVisible) {
      Overlay.drawResult(result);
    } else {
      Overlay.showSearching();
    }
  } else {
    Overlay.showSearching();
  }
}

/**
 * Se llama cuando el usuario congela la imagen.
 * Fija el resultado actual en el overlay.
 */
function onFreeze() {
  Overlay.freezeResult(_lastResult);
  Overlay.drawFrozen();
}

/**
 * Se llama cuando el usuario reanuda la cámara.
 * Descarta el resultado congelado.
 */
function onResume() {
  _lastResult = null;
  Overlay.clear();
}

// ── Cargar recursos y arrancar ────────────────────────────────────────────────

async function loadZones() {
  const resp = await fetch("data/zones.json");
  if (!resp.ok) throw new Error(`zones.json: HTTP ${resp.status}`);
  return resp.json();
}

async function loadRefImage(path) {
  return new Promise((resolve, reject) => {
    const img  = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar la imagen de referencia: ${path}`));
    img.src = path;
  });
}

async function initLocalizer() {
  try {
    const [zonesJson, refImg] = await Promise.all([
      loadZones(),
      loadRefImage("data/reference/rpi5_ref.png"),
    ]);

    await Localizer.init(window.cv, refImg, zonesJson);

    if (!Localizer.isReady()) {
      console.warn("[app] Localizer no disponible:", Localizer.getError());
      return;
    }

    _locReady = true;
    console.log("[app] Localizer inicializado. T2 activo.");
  } catch (e) {
    console.error("[app] Error al inicializar localizer:", e.message);
  }
}

// ── Esperar a OpenCV.js antes de inicializar ──────────────────────────────────

function waitForOpenCV() {
  return new Promise(resolve => {
    if (window._cvReady && window.cv) {
      resolve();
    } else {
      window.addEventListener("opencv-ready", resolve, { once: true });
    }
  });
}

// ── Punto de entrada ─────────────────────────────────────────────────────────

(async () => {
  // Registrar callbacks en camera.js antes de que inicie el loop
  // camera.js expone window.cameraHooks para que otros módulos se enganchen
  if (window.cameraHooks) {
    window.cameraHooks.onFrame  = onFrame;
    window.cameraHooks.onFreeze = onFreeze;
    window.cameraHooks.onResume = onResume;
  }

  // Esperar a OpenCV.js (carga asíncrona)
  console.log("[app] Esperando OpenCV.js…");
  await waitForOpenCV();
  console.log("[app] OpenCV.js listo. Inicializando localizer…");

  await initLocalizer();
})();

// ── Liberar recursos al cerrar ────────────────────────────────────────────────

window.addEventListener("pagehide",     () => { Localizer.dispose(); Overlay.clear(); });
window.addEventListener("beforeunload", () => { Localizer.dispose(); Overlay.clear(); });
