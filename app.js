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

import { Localizer } from "./localizer.js?v=t2-diag-4";
import { Overlay }   from "./overlay.js?v=t2-diag-4";
import { scaleResult, coverMapping, procSize } from "./coords.js?v=t2-diag-4";

/**
 * Versión de la app. Se muestra en la línea DIAGNÓSTICO y se usa como ?v= en las
 * importaciones e index.html para que la caché de GitHub Pages (max-age=600) no sirva
 * una mezcla de versiones. Debe coincidir en index.html y aquí (lo comprueba una prueba).
 */
const BUILD = "t2-diag-4";

const canvasLive    = document.getElementById("canvas-live");
const canvasOverlay = document.getElementById("canvas-overlay");
const diagLine      = document.getElementById("diag-line");

/** Ancho máximo del fotograma usado para localizar (reduce costo de ORB). */
const PROC_MAX_W = 640;

/**
 * Modo diagnóstico: solo con ?debug=1 en la URL. Muestra la proyección de zonas
 * rechazadas (gris, punteada, rotulada DEBUG) y, al congelar, los parches comparados.
 * No cambia qué se etiqueta.
 */
const DEBUG = new URLSearchParams(location.search).get("debug") === "1";

/** Copia del resultado sin parches de diagnóstico (para congelar sin clonar arrays grandes). */
function withoutPatches(r) {
  if (!r) return r;
  return { ...r, zones: r.zones.map(({ debugPatch, ...z }) => z) };
}

/** Cadena de coordenadas medida ahora: referencia → procesado → canvas → pantalla. */
function coordChain() {
  const view = document.getElementById("viewer");
  const cw = view.clientWidth, ch = view.clientHeight;
  const cov = coverMapping(canvasLive.width || 1, canvasLive.height || 1, cw, ch);
  const ref = window.referenceLoaded || {};
  return {
    reference: { file: ref.file, width: ref.width, height: ref.height, sha256: ref.sha256 },
    processed: { width: _work.width, height: _work.height },
    canvas:    { width: canvasLive.width, height: canvasLive.height },
    kX: canvasLive.width / (_work.width || 1), kY: canvasLive.height / (_work.height || 1),
    screen:    { cssWidth: cw, cssHeight: ch, devicePixelRatio: window.devicePixelRatio },
    cover:     { scale: cov.scale, offsetX: cov.offsetX, offsetY: cov.offsetY, visibleCanvas: cov.visible },
  };
}

const f2 = v => (Math.round(v * 1000) / 1000).toString();

let _debugPanel = null;
function showDebugPanel(result, raw) {
  hideDebugPanel();
  const g = result && result.zones && result.zones[0];
  const ref = Localizer.getRefPatch && Localizer.getRefPatch(g ? g.id : "gpio");
  _debugPanel = document.createElement("div");
  _debugPanel.id = "debug-panel";
  _debugPanel.style.cssText = "position:absolute;left:6px;right:6px;top:44px;padding:6px;border-radius:6px;" +
    "background:rgba(0,0,0,0.85);color:#dfe;font:11px/1.35 monospace;pointer-events:none;z-index:5;" +
    "max-height:70%;overflow:auto";
  const line = t => { const d = document.createElement("div"); d.textContent = t; _debugPanel.appendChild(d); return d; };
  const patch = (label, img, segValues) => {
    line(label);
    if (!img) { line("(sin recorte: la placa no se localizó o la zona cayó fuera de geometría)"); return; }
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    c.style.cssText = "width:100%;image-rendering:pixelated;border:1px solid #888;margin:2px 0 2px";
    const cx = c.getContext("2d");
    cx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
    // Divisiones de tramo (las mismas que usa el cálculo: 3 tramos sobre el eje mayor)
    const horiz = img.width >= img.height, L = horiz ? img.width : img.height, seg = Math.floor(L / 3);
    cx.strokeStyle = "rgba(255,60,60,0.9)"; cx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      cx.beginPath();
      if (horiz) { cx.moveTo(i * seg + 0.5, 0); cx.lineTo(i * seg + 0.5, img.height); }
      else       { cx.moveTo(0, i * seg + 0.5); cx.lineTo(img.width, i * seg + 0.5); }
      cx.stroke();
    }
    _debugPanel.appendChild(c);
    if (segValues) line(segValues);
  };

  const e = g && g.evidence;
  line(`DEBUG ${BUILD} · ${!result || !result.found ? "placa NO localizada en este cuadro"
        : g.visible ? "GPIO ACEPTADA" : "GPIO RECHAZADA"} · inliers ${result ? result.diagMetrics.inliers : "-"}`);
  patch("DEBUG · recorte GPIO de la REFERENCIA (lo que se espera ver)", ref, null);
  patch("DEBUG · recorte GPIO de ESTE cuadro, rectificado con la homografía (lo que se compara)",
        g && g.debugPatch,
        e && e.nccSeg ? `ncc por tramo [${e.nccSeg.join(" | ")}] — umbral 0,5 en CADA tramo — ncc total ${e.ncc} · contraste ${e.std}` : null);
  if (e && e.lowSeg) line(`baja frecuencia (1/4) por tramo [${e.lowSeg.join(" | ")}] — candidata, NO decide`);
  if (e && e.reason) line(`motivo: ${e.reason}`);

  const c = coordChain();
  line(`coords: ref ${c.reference.width}x${c.reference.height} —H→ procesado ${c.processed.width}x${c.processed.height}` +
       ` —×${f2(c.kX)}/${f2(c.kY)}→ canvas ${c.canvas.width}x${c.canvas.height}` +
       ` —cover ×${f2(c.cover.scale)} (${Math.round(c.cover.offsetX)},${Math.round(c.cover.offsetY)})→` +
       ` pantalla ${c.screen.cssWidth}x${c.screen.cssHeight} CSS px`);
  line(`parte visible del canvas: x ${Math.round(c.cover.visibleCanvas.x)} y ${Math.round(c.cover.visibleCanvas.y)}` +
       ` · ${Math.round(c.cover.visibleCanvas.w)}x${Math.round(c.cover.visibleCanvas.h)}`);
  if (raw && raw.debug) line(`H (ref→procesado): [${raw.debug.H.map(v => f2(v)).join(", ")}]`);
  const gp = raw && raw.zones && raw.zones[0];
  const poly = gp && (gp.polygon || gp.polygonDebug);
  if (poly) line(`GPIO proyectado en procesado: ${poly.map(p => `(${p[0]},${p[1]})`).join(" ")}`);

  const btn = document.createElement("button");
  btn.textContent = "Guardar diagnóstico (archivo local)";
  btn.style.cssText = "pointer-events:auto;margin-top:6px;padding:8px 10px;border-radius:6px;border:1px solid #9cf;" +
    "background:#123;color:#dfe;font:12px monospace";
  btn.addEventListener("click", () => downloadDiagnostic());
  _debugPanel.appendChild(btn);
  line("Guarda el cuadro procesado y el resultado en Descargas. No se sube a ningún servidor.");
  document.getElementById("viewer").appendChild(_debugPanel);
}
function hideDebugPanel() { if (_debugPanel) { _debugPanel.remove(); _debugPanel = null; } }

/**
 * Diagnóstico exportable (solo modo debug, acción explícita). Contiene el cuadro EXACTO
 * que procesó locate() (PNG del canvas de trabajo), el resultado sin reescalar y la cadena
 * de coordenadas, para reproducir el cálculo en la computadora con tools/replay_diag.
 */
function buildDiagnostic() {
  if (!_frozenRaw) return null;
  const { zones, ...rest } = _frozenRaw;
  return {
    kind: "rpi5-explorer-diagnostico", build: BUILD, createdAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    chain: coordChain(),
    result: { ...rest, zones: zones.map(({ debugPatch, ...z }) => z) },
    processedFramePng: _work.toDataURL("image/png"),
  };
}
window.buildDiagnostic = buildDiagnostic;

function downloadDiagnostic() {
  const d = buildDiagnostic();
  if (!d) return;
  const blob = new Blob([JSON.stringify(d)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `rpi5_diag_${d.createdAt.replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

let _locReady   = false;
let _locStatus  = "cargando OpenCV.js…";
let _refLabel   = "";
let _lastResult = null;
let _lastRaw    = null;   // resultado de locate() en coordenadas del fotograma PROCESADO
let _frozenRaw  = null;   // _lastRaw al congelar (para el diagnóstico exportable)
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
  if (_firstDone === null) _firstDone = tDone;
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

let _firstDone = null;   // primera localización desde el último inicio/reanudación

function getPerfStats() {
  const now = performance.now();
  const recent = _doneTimes.filter(t => now - t <= WINDOW_MS);
  // Ventana real: no subestimar durante los primeros segundos
  const spanMs = _firstDone === null ? WINDOW_MS : Math.min(WINDOW_MS, Math.max(1000, now - _firstDone));
  return {
    locPerSec: Math.round((recent.length / (spanMs / 1000)) * 10) / 10,
    // Tiempo desde que el fotograma quedó dibujado hasta su resultado dibujado.
    // NO incluye latencia de captura de la cámara ni espera de rAF/pintado.
    procP95Ms: Math.round(p95(_ages)),
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
  let text = `${DEBUG ? "MODO DEBUG · " : ""}DIAGNÓSTICO ${BUILD} · localizador: ${_locStatus}`;
  if (_locReady) {
    const s = getPerfStats();
    const r = _lastResult && _lastResult.diagMetrics;
    text += ` · ${s.locPerSec} loc/s · proceso p95 ${s.procP95Ms} ms · video ${s.videoSize} → ${s.procSize}`;
    if (r) text += ` · kp ${r.frameKeypoints ?? "?"} · matches ${r.matchesUsed} · inliers ${r.inliers}`;
    const g = _lastResult && _lastResult.zones && _lastResult.zones[0];
    if (g) {
      text += ` · ${g.id.toUpperCase()}: ${g.visible ? "ETIQUETADA" : "sin evidencia"}`;
      if (g.evidence && g.evidence.ncc !== undefined) {
        text += ` (ncc ${g.evidence.ncc}, mín. tramo ${g.evidence.nccMin}, inl zona ${g.evidence.zoneInliers})`;
        if (DEBUG && g.evidence.lowSeg) text += ` · DEBUG tramos [${g.evidence.nccSeg.join(",")}] baja frec. [${g.evidence.lowSeg.join(",")}]`;
      }
    }
    if (_refLabel) text += ` · ref: ${_refLabel}`;
  }
  text += DEBUG ? " · [tocá aquí para salir del modo diagnóstico]" : " · [tocá aquí para modo diagnóstico]";
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

// scaleResult (procesado → canvas) vive en coords.js; escala también lo de diagnóstico.

// ── Hooks de cámara ───────────────────────────────────────────────────────────

function onFrame(canvas) {
  if (!_locReady || _frozen) return;
  const W = canvas.width, H = canvas.height;
  if (!W || !H) return;

  // Instante en que este fotograma quedó dibujado (onFrame se llama tras drawImage)
  const tFrame = performance.now();
  syncOverlaySize();

  let result;
  try {
    // Reducir para localizar
    const { k, pw, ph } = procSize(W, H, PROC_MAX_W);
    if (_work.width !== pw || _work.height !== ph) { _work.width = pw; _work.height = ph; }
    _workCtx.drawImage(canvas, 0, 0, pw, ph);
    const imageData = _workCtx.getImageData(0, 0, pw, ph);
    const raw = Localizer.locate(imageData);
    _lastRaw = DEBUG ? raw : null;
    result = scaleResult(raw, k);
  } catch (e) {
    // Ante cualquier error se retira la etiqueta: no se reutiliza el resultado anterior
    console.warn("[app] onFrame:", e);
    _lastResult = null;
    Overlay.showSearching();
    return;
  }
  _lastResult  = result;

  // Solo se dibuja la zona si el localizador dio evidencia en ESTE fotograma
  const anyVisible = result.found && result.zones.some(z => z.visible);
  if (anyVisible) Overlay.drawResult(result);
  else            Overlay.showSearching();
  if (DEBUG) Overlay.drawDebug(result);

  const tDone = performance.now();
  recordLocate(tDone, tDone - tFrame);
  updateDiag();
}

function onFreeze() {
  // Las etiquetas congeladas son las del último fotograma procesado,
  // que es el mismo que queda fijo en el canvas (locate es síncrono por fotograma).
  _frozen = true;
  const frozen = withoutPatches(_lastResult && _lastResult.found ? _lastResult : null);
  Overlay.freezeResult(frozen);
  Overlay.drawFrozen();
  if (DEBUG) {
    _frozenRaw = _lastRaw;
    // Lo de diagnóstico se dibuja con el resultado completo (incluye proyección rechazada)
    Overlay.drawDebug(_lastResult);
    showDebugPanel(_lastResult, _lastRaw);
  }
}

function onResume() {
  hideDebugPanel();
  _frozenRaw  = null;
  _lastRaw    = null;
  _frozen     = false;
  _lastResult = null;
  _firstDone  = null;
  _doneTimes.length = 0;
  _ages.length = 0;
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

/**
 * Descarga la referencia, calcula el SHA-256 de los bytes REALMENTE recibidos y la
 * decodifica. Si zones.json declara un sha256 o dimensiones y no coinciden, falla:
 * las coordenadas de la zona solo valen para ese archivo exacto.
 */
async function loadReference(zones) {
  const file = zones.image.file;
  const url  = "data/reference/" + file;
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const bytes = await r.arrayBuffer();

  let sha = "no disponible";
  if (window.crypto && crypto.subtle) {
    const d = await crypto.subtle.digest("SHA-256", bytes);
    sha = [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  if (zones.image.sha256 && sha !== "no disponible" && sha !== zones.image.sha256.toLowerCase()) {
    throw new Error(`referencia ${file}: SHA-256 ${sha.slice(0, 12)} no coincide con zones.json ${zones.image.sha256.slice(0, 12)}`);
  }

  const bmp = await createImageBitmap(new Blob([bytes]));
  if (bmp.width !== zones.image.width || bmp.height !== zones.image.height) {
    throw new Error(`referencia ${file}: ${bmp.width}x${bmp.height}, zones.json espera ${zones.image.width}x${zones.image.height}`);
  }
  return { bmp, file, sha, bytes: bytes.byteLength };
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
    const ref   = await loadReference(zones);
    await Localizer.init(cv, ref.bmp, zones);
    const info  = Localizer.getRefInfo && Localizer.getRefInfo();
    // Identifica el archivo realmente cargado: nombre, tamaño decodificado y hash de sus bytes
    _refLabel = `${ref.file} ${ref.bmp.width}x${ref.bmp.height} sha256:${ref.sha.slice(0, 12)}` +
                (info ? ` · ${info.keypoints} kp${info.boardMask ? " con máscara de placa" : ""}` : "") +
                (zones.image.kind ? ` · ${zones.image.kind}` : "");
    window.referenceLoaded = { file: ref.file, sha256: ref.sha, bytes: ref.bytes,
                               width: ref.bmp.width, height: ref.bmp.height, info };
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

  if (Localizer.setDebug) Localizer.setDebug(DEBUG);
  _locReady  = true;
  _locStatus = "activo";
  updateDiag(true);
})();

// Tocar la línea DIAGNÓSTICO activa o desactiva el modo diagnóstico (recarga con/sin ?debug=1).
// Evita depender de escribir la URL a mano en el teléfono.
diagLine.addEventListener("click", () => {
  const u = new URL(location.href);
  if (DEBUG) u.searchParams.delete("debug"); else u.searchParams.set("debug", "1");
  location.href = u.toString();
});

window.addEventListener("pagehide", () => { Localizer.dispose(); Overlay.clear(); });
// Si el navegador restaura la página desde su caché (bfcache), el localizador ya
// fue liberado: se recarga para empezar de cero con cámara y localizador nuevos.
window.addEventListener("pageshow", ev => { if (ev.persisted) location.reload(); });
