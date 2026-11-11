/**
 * t1_camera_logic.test.mjs
 * Pruebas de escritorio para la lógica de T1.
 * Entorno: Node.js (sin DOM, sin cámara real).
 *
 * Categoría: SIMULADO / ESCRITORIO
 * Estas pruebas no reemplazan la verificación en teléfono real.
 * No prueban getUserMedia ni la reproducción de video.
 *
 * Cobertura:
 *   - Mensajes de error asignados a cada nombre de DOMException.
 *   - Comportamiento de frozenFrame al congelar y reanudar.
 *   - Que congelar no deja rafId activo.
 *   - Que reanudar descarta el frozenFrame.
 *   - Transiciones de estado válidas e inválidas.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// ── Re-implementación mínima de la lógica de estado (sin DOM) ─────────────────
// Se extrae la lógica pura de camera.js para probarla sin navegador.

const ERROR_MESSAGES = {
  NotAllowedError: {
    icon: "🔒", title: "Permiso de cámara denegado",
    msg: "Para usar la app, otorgá permiso de cámara en la configuración del navegador y volvé a intentarlo.",
  },
  NotFoundError: {
    icon: "📷", title: "No se encontró cámara",
    msg: "El dispositivo no tiene cámara disponible o no pudo detectarse.",
  },
  NotReadableError: {
    icon: "⚠️", title: "Cámara ocupada",
    msg: "Otra aplicación está usando la cámara. Cerrala e intentá de nuevo.",
  },
  OverconstrainedError: {
    icon: "📷", title: "Cámara no compatible",
    msg: "La cámara no soporta la configuración solicitada. Intentando con configuración básica…",
  },
  default: {
    icon: "⚠️", title: "Error de cámara",
    msg: "No se pudo acceder a la cámara. Revisá los permisos e intentá de nuevo.",
  },
};

function getErrorInfo(name) {
  return ERROR_MESSAGES[name] || ERROR_MESSAGES.default;
}

/**
 * Simulación mínima del ciclo de vida de estado.
 * Refleja la lógica de freeze() / resume() de camera.js sin DOM.
 */
function createController() {
  let state       = "idle";
  let frozenFrame = null;
  let rafActive   = false;

  return {
    startCamera() {
      state       = "live";
      frozenFrame = null;
      rafActive   = true;
    },
    freeze(fakeImageData) {
      if (state !== "live") return false;
      frozenFrame = fakeImageData ?? { width: 640, height: 480, data: new Uint8ClampedArray(4) };
      rafActive   = false;   // cancelAnimationFrame
      state       = "frozen";
      return true;
    },
    resume() {
      if (state !== "frozen") return false;
      frozenFrame = null;
      state       = "live";
      rafActive   = true;
      return true;
    },
    setError() {
      rafActive   = false;
      state       = "error";
    },
    getState()       { return state; },
    getFrozenFrame() { return frozenFrame; },
    isRafActive()    { return rafActive; },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Mensajes de error", () => {
  it("NotAllowedError muestra título de permiso denegado", () => {
    const info = getErrorInfo("NotAllowedError");
    assert.match(info.title, /permiso/i);
    assert.equal(info.icon, "🔒");
  });

  it("NotFoundError muestra título de cámara no encontrada", () => {
    const info = getErrorInfo("NotFoundError");
    assert.match(info.title, /encontr/i);
  });

  it("NotReadableError muestra título de cámara ocupada", () => {
    const info = getErrorInfo("NotReadableError");
    assert.match(info.title, /ocupada/i);
  });

  it("Nombre desconocido devuelve mensaje genérico", () => {
    const info = getErrorInfo("SomeRandomError");
    assert.equal(info.title, ERROR_MESSAGES.default.title);
  });

  it("Todos los mensajes tienen icon, title y msg no vacíos", () => {
    for (const [key, val] of Object.entries(ERROR_MESSAGES)) {
      assert.ok(val.icon.length  > 0, `${key}: icon vacío`);
      assert.ok(val.title.length > 0, `${key}: title vacío`);
      assert.ok(val.msg.length   > 0, `${key}: msg vacío`);
    }
  });
});

describe("Estado: live → frozen", () => {
  it("freeze() en estado live cambia a frozen", () => {
    const ctrl = createController();
    ctrl.startCamera();
    ctrl.freeze();
    assert.equal(ctrl.getState(), "frozen");
  });

  it("freeze() cancela el loop (rafActive=false)", () => {
    const ctrl = createController();
    ctrl.startCamera();
    assert.equal(ctrl.isRafActive(), true);
    ctrl.freeze();
    assert.equal(ctrl.isRafActive(), false);
  });

  it("freeze() guarda frozenFrame no nulo", () => {
    const ctrl = createController();
    ctrl.startCamera();
    ctrl.freeze();
    assert.notEqual(ctrl.getFrozenFrame(), null);
  });

  it("freeze() en estado frozen no hace nada (retorna false)", () => {
    const ctrl = createController();
    ctrl.startCamera();
    ctrl.freeze();
    const result = ctrl.freeze();
    assert.equal(result, false);
    assert.equal(ctrl.getState(), "frozen");
  });

  it("freeze() en estado idle no hace nada", () => {
    const ctrl = createController();
    const result = ctrl.freeze();
    assert.equal(result, false);
    assert.equal(ctrl.getState(), "idle");
  });
});

describe("Estado: frozen → live (resume)", () => {
  it("resume() en estado frozen cambia a live", () => {
    const ctrl = createController();
    ctrl.startCamera();
    ctrl.freeze();
    ctrl.resume();
    assert.equal(ctrl.getState(), "live");
  });

  it("resume() descarta frozenFrame (null)", () => {
    const ctrl = createController();
    ctrl.startCamera();
    ctrl.freeze();
    assert.notEqual(ctrl.getFrozenFrame(), null);
    ctrl.resume();
    assert.equal(ctrl.getFrozenFrame(), null);
  });

  it("resume() reactiva el loop (rafActive=true)", () => {
    const ctrl = createController();
    ctrl.startCamera();
    ctrl.freeze();
    ctrl.resume();
    assert.equal(ctrl.isRafActive(), true);
  });

  it("resume() en estado live no hace nada (retorna false)", () => {
    const ctrl = createController();
    ctrl.startCamera();
    const result = ctrl.resume();
    assert.equal(result, false);
    assert.equal(ctrl.getState(), "live");
  });
});

describe("Estado: error", () => {
  it("setError() cancela el loop", () => {
    const ctrl = createController();
    ctrl.startCamera();
    ctrl.setError();
    assert.equal(ctrl.isRafActive(), false);
    assert.equal(ctrl.getState(), "error");
  });

  it("getFrozenFrame() devuelve null en estado live", () => {
    const ctrl = createController();
    ctrl.startCamera();
    assert.equal(ctrl.getFrozenFrame(), null);
  });
});

describe("getFrozenFrame conserva datos entre llamadas", () => {
  it("el mismo ImageData está disponible antes de resume()", () => {
    const ctrl = createController();
    ctrl.startCamera();
    const fakeData = { width: 1280, height: 720, data: new Uint8ClampedArray(8) };
    ctrl.freeze(fakeData);
    assert.equal(ctrl.getFrozenFrame(), fakeData);
    assert.equal(ctrl.getFrozenFrame(), fakeData);  // idempotente
  });
});
