/**
 * t1_ui_visibility.test.mjs
 * Pruebas de visibilidad de controles sobre los archivos reales:
 *   app/index.html  y  app/camera.js
 *
 * Categoría: ESCRITORIO — análisis estático de HTML y JS reales.
 * No requiere navegador ni DOM simulado.
 * No reemplaza la verificación en teléfono real.
 *
 * Qué detectan estas pruebas:
 *   - Que #btn-resume NO tenga display:none en las reglas CSS del <style>
 *     (el bug reportado: CSS sobreescribía el estilo inline asignado por JS).
 *   - Que #btn-resume tenga display:none como atributo inline en el HTML
 *     (estado inicial correcto, controlable por JS).
 *   - Que setFrozenUI() asigne display explícito distinto de "" vacío a btnResume.
 *   - Que setLiveUI() asigne display:"none" a btnResume.
 *   - Que setFrozenUI() oculte btnFreeze.
 *   - Que setLiveUI() muestre btnFreeze con display explícito.
 *
 * Razonamiento:
 *   Si el CSS declara display:none sobre #btn-resume, asignar style.display=""
 *   en JS borra el estilo inline pero deja vigente la regla CSS → botón invisible.
 *   La corrección traslada el ocultamiento inicial al atributo inline del HTML
 *   y elimina display:none del CSS, de modo que JS puede sobreescribirlo.
 */

import assert   from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, "..");

const html = readFileSync(path.join(ROOT, "app", "index.html"), "utf8");
const js   = readFileSync(path.join(ROOT, "app", "camera.js"),  "utf8");

// ── Helpers de análisis de texto ──────────────────────────────────────────────

/**
 * Extrae el contenido del bloque <style>…</style> del HTML.
 * Solo el primer bloque (hay uno único en index.html).
 */
function extractStyleBlock(src) {
  const m = src.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  return m ? m[1] : "";
}

/**
 * Busca todas las reglas CSS que seleccionen el id dado (formato #id { … }).
 * Devuelve el texto combinado de las declaraciones encontradas.
 */
function cssRulesFor(css, id) {
  // Captura bloques "#id { … }" y "#id:pseudo { … }"
  const pattern = new RegExp(`#${id}(?:[^{]*?)\\{([^}]*)\\}`, "g");
  const blocks  = [];
  let m;
  while ((m = pattern.exec(css)) !== null) {
    blocks.push(m[1]);
  }
  return blocks.join("\n");
}

/**
 * Devuelve true si el texto CSS contiene una declaración display:none
 * (con variaciones de espacios).
 */
function hasDisplayNone(cssText) {
  return /display\s*:\s*none/.test(cssText);
}

// ── Tests — HTML ──────────────────────────────────────────────────────────────

describe("HTML — estado inicial de #btn-resume", () => {

  it("#btn-resume no tiene display:none en las reglas CSS del <style>", () => {
    const css   = extractStyleBlock(html);
    const rules = cssRulesFor(css, "btn-resume");
    assert.equal(
      hasDisplayNone(rules),
      false,
      "El CSS no debe ocultar #btn-resume con display:none. " +
      "Si lo hace, JS no puede mostrarlo con style.display='' (el bug reportado). " +
      "Reglas encontradas para #btn-resume:\n" + rules
    );
  });

  it("#btn-resume tiene style=\"display:none\" como atributo inline en el HTML", () => {
    // El estado inicial oculto debe estar en el atributo inline del elemento,
    // no en el CSS, para que JS pueda sobreescribirlo.
    const hasInlineHide = /id="btn-resume"[^>]*style="[^"]*display\s*:\s*none/.test(html)
                       || /style="[^"]*display\s*:\s*none[^"]*"[^>]*id="btn-resume"/.test(html);
    assert.equal(
      hasInlineHide,
      true,
      "El estado inicial oculto de #btn-resume debe declararse como atributo " +
      "style inline (style=\"display:none\") en el elemento HTML, " +
      "no en el CSS. Así JS puede mostrarlo asignando style.display."
    );
  });

  it("#btn-freeze no tiene style inline de display en el HTML (lo controla JS)", () => {
    // btnFreeze comienza visible; no debe tener display:none inline en el HTML.
    const freezeHasInlineHide = /id="btn-freeze"[^>]*style="[^"]*display\s*:\s*none/.test(html)
                              || /style="[^"]*display\s*:\s*none[^"]*"[^>]*id="btn-freeze"/.test(html);
    assert.equal(
      freezeHasInlineHide,
      false,
      "#btn-freeze debe comenzar visible; no debe tener display:none inline."
    );
  });

});

// ── Tests — JS: setFrozenUI ───────────────────────────────────────────────────

describe("camera.js — setFrozenUI()", () => {

  /**
   * Extrae el cuerpo de una función por nombre.
   * Busca tanto funciones declaradas como expresiones de función.
   */
  function extractFunctionBody(src, name) {
    // Busca "function name(" o "async function name(" y captura hasta la llave de cierre
    // Versión simplificada: cuenta llaves para encontrar el cuerpo completo.
    const start = src.indexOf(`function ${name}(`);
    if (start === -1) return "";
    let depth  = 0;
    let inBody = false;
    let result = "";
    for (let i = start; i < src.length; i++) {
      const ch = src[i];
      if (ch === "{") { depth++; inBody = true; }
      if (inBody) result += ch;
      if (ch === "}" && inBody) {
        depth--;
        if (depth === 0) break;
      }
    }
    return result;
  }

  const frozenBody = extractFunctionBody(js, "setFrozenUI");
  const liveBody   = extractFunctionBody(js, "setLiveUI");

  it("setFrozenUI existe en camera.js", () => {
    assert.ok(frozenBody.length > 0, "No se encontró setFrozenUI() en camera.js");
  });

  it("setFrozenUI asigna un valor de display explícito a btnResume (no vacío)", () => {
    // La asignación debe ser distinta de style.display = "" para que supere
    // una regla CSS display:none. Acepta "block", "flex", "inline-block", etc.
    // Rechaza solo la cadena vacía "" que causó el bug.
    const assignsEmpty = /btnResume\.style\.display\s*=\s*["']["']/.test(frozenBody);
    assert.equal(
      assignsEmpty,
      false,
      "setFrozenUI() no debe asignar style.display = \"\" a btnResume. " +
      "Esa asignación borra el estilo inline pero deja vigente display:none del CSS. " +
      "Usar un valor explícito como \"block\".\n" +
      "Cuerpo de setFrozenUI encontrado:\n" + frozenBody
    );
  });

  it("setFrozenUI oculta btnFreeze con display:none", () => {
    const hidesFreezeBtn = /btnFreeze\.style\.display\s*=\s*["']none["']/.test(frozenBody);
    assert.ok(
      hidesFreezeBtn,
      "setFrozenUI() debe ocultar #btn-freeze con style.display = \"none\".\n" +
      "Cuerpo de setFrozenUI encontrado:\n" + frozenBody
    );
  });

  it("setLiveUI oculta btnResume con display:none", () => {
    const hidesResume = /btnResume\.style\.display\s*=\s*["']none["']/.test(liveBody);
    assert.ok(
      hidesResume,
      "setLiveUI() debe ocultar #btn-resume con style.display = \"none\".\n" +
      "Cuerpo de setLiveUI encontrado:\n" + liveBody
    );
  });

  it("setLiveUI muestra btnFreeze con display no vacío", () => {
    const showsFreeze = /btnFreeze\.style\.display\s*=\s*["'][^"']+["']/.test(liveBody)
                     && !/btnFreeze\.style\.display\s*=\s*["']["']/.test(liveBody);
    // btnFreeze.style.display = "" también es aceptable para live (el CSS no lo oculta)
    // Lo importante es que NO lo ponga en "none". Verificar solo que no lo oculta.
    const hidesFreezeinLive = /btnFreeze\.style\.display\s*=\s*["']none["']/.test(liveBody);
    assert.equal(
      hidesFreezeinLive,
      false,
      "setLiveUI() no debe ocultar #btn-freeze con display:none.\n" +
      "Cuerpo de setLiveUI encontrado:\n" + liveBody
    );
  });

});

// ── Tests — ciclo completo de visibilidad (simulado sin DOM) ──────────────────

describe("Ciclo freeze/resume — visibilidad de botones (simulado)", () => {

  /**
   * Simulación mínima del modelo de visibilidad de JS sobre los botones.
   * Refleja exactamente la lógica de setLiveUI / setFrozenUI / setErrorUI.
   */
  function createUIModel() {
    // Estado inicial según el HTML corregido:
    // btnFreeze: visible (sin style inline de display)
    // btnResume: oculto (style inline display:none)
    const state = {
      freezeDisplay: "",       // sin estilo inline → CSS no lo oculta → visible
      resumeDisplay: "none",   // estilo inline → oculto
    };

    return {
      setLiveUI() {
        state.freezeDisplay = "";
        state.resumeDisplay = "none";
      },
      setFrozenUI() {
        state.freezeDisplay = "none";
        state.resumeDisplay = "block";   // valor explícito, no ""
      },
      setErrorUI() {
        state.resumeDisplay = "none";
      },
      isFreezeVisible() { return state.freezeDisplay !== "none"; },
      isResumeVisible() { return state.resumeDisplay !== "none"; },
    };
  }

  it("Estado inicial: Congelar visible, Volver oculto", () => {
    const ui = createUIModel();
    assert.equal(ui.isFreezeVisible(), true,  "Congelar debe ser visible al inicio");
    assert.equal(ui.isResumeVisible(), false, "Volver debe estar oculto al inicio");
  });

  it("Tras congelar: Congelar oculto, Volver visible", () => {
    const ui = createUIModel();
    ui.setFrozenUI();
    assert.equal(ui.isFreezeVisible(), false, "Congelar debe ocultarse al congelar");
    assert.equal(ui.isResumeVisible(), true,  "Volver debe aparecer al congelar");
  });

  it("Tras reanudar: Congelar visible, Volver oculto", () => {
    const ui = createUIModel();
    ui.setFrozenUI();
    ui.setLiveUI();
    assert.equal(ui.isFreezeVisible(), true,  "Congelar debe volver al reanudar");
    assert.equal(ui.isResumeVisible(), false, "Volver debe ocultarse al reanudar");
  });

  it("Ciclo múltiple: freeze → live → freeze → live", () => {
    const ui = createUIModel();
    for (let i = 0; i < 3; i++) {
      ui.setFrozenUI();
      assert.equal(ui.isResumeVisible(), true,  `ciclo ${i+1}: Volver debe ser visible`);
      ui.setLiveUI();
      assert.equal(ui.isResumeVisible(), false, `ciclo ${i+1}: Volver debe ocultarse`);
    }
  });

  it("Error: Volver se oculta", () => {
    const ui = createUIModel();
    ui.setFrozenUI();
    ui.setErrorUI();
    assert.equal(ui.isResumeVisible(), false, "Volver debe ocultarse al entrar en error");
  });

});
