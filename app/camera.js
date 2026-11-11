/**
 * camera.js — T1: cámara en vivo, congelado y reanudación
 *
 * Responsabilidades de este archivo:
 *   - Solicitar acceso a la cámara trasera (getUserMedia).
 *   - Dibujar fotogramas en el <canvas> mediante requestAnimationFrame.
 *   - Congelar: copiar el cuadro actual; pausar el loop.
 *   - Reanudar: descartar el cuadro congelado; reiniciar el loop.
 *   - Manejar permiso denegado y otros errores con mensajes claros.
 *   - Liberar el stream al congelar para conservar recursos (lo reobtiene al reanudar).
 *
 * Lo que NO hace este archivo (corresponde a T2):
 *   - Ninguna localización, homografía ni detección.
 *   - Ninguna etiqueta ni resultado simulado.
 */

"use strict";

// ── Elementos del DOM ─────────────────────────────────────────────────────────

const canvas      = document.getElementById("canvas-live");
const ctx         = canvas.getContext("2d");
const statusBadge = document.getElementById("status-badge");
const errorScreen = document.getElementById("error-screen");
const errorTitle  = document.getElementById("error-title");
const errorMsg    = document.getElementById("error-msg");
const btnRetry    = document.getElementById("btn-retry");
const btnFreeze   = document.getElementById("btn-freeze");
const btnResume   = document.getElementById("btn-resume");

// ── Estado interno ────────────────────────────────────────────────────────────

/**
 * @type {"idle"|"live"|"frozen"|"error"}
 *
 * idle   → antes de solicitar cámara (inicio)
 * live   → stream activo, loop corriendo
 * frozen → cuadro congelado; stream liberado; loop detenido
 * error  → error irrecuperable hasta que el usuario reintente
 */
let appState = "idle";

/** Referencia al MediaStream activo (null si está liberado). */
let mediaStream = null;

/** Referencia al <video> interno usado para leer fotogramas. */
let videoEl = null;

/** ID devuelto por requestAnimationFrame, para cancelarlo. */
let rafId = null;

/** Cuadro congelado almacenado como ImageData (null si está en vivo). */
let frozenFrame = null;

// ── Configuración de getUserMedia ─────────────────────────────────────────────

/**
 * Preferencia por cámara trasera.
 * Se intenta primero con facingMode "environment"; si falla, se reintenta
 * sin esa restricción (compatibilidad con cámaras de computadora).
 */
const CAMERA_CONSTRAINTS_REAR = {
  video: {
    facingMode: { ideal: "environment" },
    width:  { ideal: 1280 },
    height: { ideal: 720 },
  },
  audio: false,
};

const CAMERA_CONSTRAINTS_ANY = {
  video: { width: { ideal: 1280 }, height: { ideal: 720 } },
  audio: false,
};

// ── Mensajes de error legibles ────────────────────────────────────────────────

const ERROR_MESSAGES = {
  NotAllowedError: {
    icon:  "🔒",
    title: "Permiso de cámara denegado",
    msg:   "Para usar la app, otorgá permiso de cámara en la configuración "
         + "del navegador y volvé a intentarlo.",
  },
  NotFoundError: {
    icon:  "📷",
    title: "No se encontró cámara",
    msg:   "El dispositivo no tiene cámara disponible o no pudo detectarse.",
  },
  NotReadableError: {
    icon:  "⚠️",
    title: "Cámara ocupada",
    msg:   "Otra aplicación está usando la cámara. Cerrala e intentá de nuevo.",
  },
  OverconstrainedError: {
    icon:  "📷",
    title: "Cámara no compatible",
    msg:   "La cámara no soporta la configuración solicitada. Intentando con "
         + "configuración básica…",
  },
  default: {
    icon:  "⚠️",
    title: "Error de cámara",
    msg:   "No se pudo acceder a la cámara. Revisá los permisos e intentá de nuevo.",
  },
};

// ── Funciones de UI ───────────────────────────────────────────────────────────

function setLiveUI() {
  statusBadge.textContent = "EN VIVO";
  statusBadge.className   = "live";
  btnFreeze.disabled  = false;
  btnFreeze.style.display  = "";
  btnResume.style.display  = "none";
  errorScreen.classList.remove("visible");
}

function setFrozenUI() {
  statusBadge.textContent = "CONGELADO";
  statusBadge.className   = "frozen";
  btnFreeze.style.display  = "none";
  btnResume.style.display  = "";
  btnResume.disabled  = false;
}

function setErrorUI(name) {
  const def  = ERROR_MESSAGES.default;
  const info = ERROR_MESSAGES[name] || def;
  document.getElementById("error-icon").textContent = info.icon;
  errorTitle.textContent = info.title;
  errorMsg.textContent   = info.msg;
  errorScreen.classList.add("visible");
  statusBadge.textContent = "ERROR";
  statusBadge.className   = "";
  btnFreeze.disabled  = true;
  btnResume.style.display  = "none";
}

// ── Core: acceso a cámara ─────────────────────────────────────────────────────

/**
 * Solicita el stream de cámara.
 * Intenta primero con la cámara trasera; si falla por OverconstrainedError,
 * reintenta sin la preferencia de facingMode.
 * @returns {Promise<MediaStream>}
 */
async function requestCamera() {
  try {
    return await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS_REAR);
  } catch (err) {
    if (err.name === "OverconstrainedError") {
      return await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS_ANY);
    }
    throw err;
  }
}

/**
 * Libera el stream activo y descarta el elemento <video>.
 * Debe llamarse antes de congelar y antes de reiniciar desde error.
 */
function releaseStream() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  if (videoEl) {
    videoEl.srcObject = null;
    videoEl = null;
  }
}

// ── Core: loop de captura ─────────────────────────────────────────────────────

/**
 * Ajusta las dimensiones del canvas al fotograma del video.
 * Solo cambia si difiere, para evitar re-renderizados innecesarios.
 */
function syncCanvasSize(video) {
  if (canvas.width  !== video.videoWidth  ||
      canvas.height !== video.videoHeight) {
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
  }
}

/**
 * Loop principal: dibuja el fotograma actual del video en el canvas.
 * Se detiene cuando appState deja de ser "live".
 */
function drawLoop() {
  if (appState !== "live" || !videoEl) return;

  syncCanvasSize(videoEl);
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  rafId = requestAnimationFrame(drawLoop);
}

// ── Core: iniciar cámara ──────────────────────────────────────────────────────

/**
 * Solicita la cámara, crea el elemento <video> interno y arranca el loop.
 * Si ya hay un stream activo (inesperado), lo libera primero.
 */
async function startCamera() {
  releaseStream();
  errorScreen.classList.remove("visible");

  try {
    mediaStream = await requestCamera();
  } catch (err) {
    console.error("[camera] Error al acceder a la cámara:", err.name, err.message);
    appState = "error";
    setErrorUI(err.name);
    return;
  }

  // Crear elemento <video> fuera del DOM para leer fotogramas
  videoEl = document.createElement("video");
  videoEl.srcObject  = mediaStream;
  videoEl.muted      = true;
  videoEl.playsInline = true;
  videoEl.setAttribute("playsinline", "");   // compatibilidad iOS Safari

  try {
    await videoEl.play();
  } catch (err) {
    console.error("[camera] Error al reproducir video:", err.name, err.message);
    releaseStream();
    appState = "error";
    setErrorUI(err.name);
    return;
  }

  appState  = "live";
  frozenFrame = null;
  setLiveUI();
  rafId = requestAnimationFrame(drawLoop);
}

// ── Acciones de usuario ───────────────────────────────────────────────────────

/**
 * CONGELAR:
 *   1. Detener el loop.
 *   2. Copiar el cuadro actual en frozenFrame (para uso futuro en T4).
 *   3. Liberar el stream (cámara libre mientras está congelado).
 *   4. El canvas conserva el último cuadro pintado (no se borra).
 */
function freeze() {
  if (appState !== "live") return;

  // Capturar antes de liberar
  if (canvas.width > 0 && canvas.height > 0) {
    frozenFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  releaseStream();     // cancela rafId, detiene tracks, descarta videoEl
  appState = "frozen";
  setFrozenUI();
}

/**
 * REANUDAR:
 *   1. Descartar el cuadro congelado.
 *   2. Limpiar el canvas.
 *   3. Reiniciar la cámara desde cero (relocalizar en T2).
 *
 * No copia frozenFrame ni etiquetas al nuevo estado en vivo.
 */
async function resume() {
  if (appState !== "frozen") return;

  frozenFrame = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  await startCamera();
}

// ── getFrozenFrame (API para T4) ──────────────────────────────────────────────

/**
 * Devuelve el ImageData del cuadro congelado actual, o null si no hay ninguno.
 * Se usará en T4 para ampliar la imagen y mostrar detalles.
 * No exportar ni subir este dato a ningún servidor.
 *
 * @returns {ImageData|null}
 */
function getFrozenFrame() {
  return frozenFrame;
}

// ── Listeners ─────────────────────────────────────────────────────────────────

btnFreeze.addEventListener("click", () => freeze());
btnResume.addEventListener("click", () => resume());
btnRetry.addEventListener("click",  () => startCamera());

// Limpiar al salir de la página
window.addEventListener("pagehide",   () => releaseStream());
window.addEventListener("beforeunload", () => releaseStream());

// ── Inicio ────────────────────────────────────────────────────────────────────

// Verificar que getUserMedia está disponible (requiere origen seguro)
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  appState = "error";
  setErrorUI("_noAPI");
  ERROR_MESSAGES["_noAPI"] = {
    icon:  "🌐",
    title: "Función no disponible",
    msg:   "Tu navegador no soporta acceso a cámara, o la página no está en "
         + "un origen seguro (HTTPS o localhost). "
         + "Intentá abrir la URL con https:// o desde localhost.",
  };
  setErrorUI("_noAPI");
} else {
  startCamera();
}
