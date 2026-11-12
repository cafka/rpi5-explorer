/**
 * t2_debug_mode.test.mjs — el modo diagnóstico no cambia qué se etiqueta.
 * Categoría: AUTOMÁTICA, análisis estático del código real (escritorio).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(path.join(ROOT, "app", "app.js"), "utf8");
const loc = readFileSync(path.join(ROOT, "app", "localizer.js"), "utf8");
const ovl = readFileSync(path.join(ROOT, "app", "overlay.js"), "utf8");

describe("modo diagnóstico (?debug=1)", () => {
  it("solo se activa con debug=1 en la URL", () => {
    assert.match(app, /const DEBUG = new URLSearchParams\(location\.search\)\.get\("debug"\) === "1"/);
  });

  it("tocar la línea DIAGNÓSTICO alterna el modo (recarga con o sin ?debug=1)", () => {
    assert.match(app, /diagLine\.addEventListener\("click"/);
    assert.match(app, /searchParams\.set\("debug", "1"\)/);
    assert.match(app, /searchParams\.delete\("debug"\)/);
    const html = readFileSync(path.join(ROOT, "app", "index.html"), "utf8");
    const tag = html.match(/<div id="diag-line"[^>]*>/s)[0];
    assert.match(tag, /pointer-events:auto/, "la línea debe recibir toques");
  });

  it("toda llamada a drawDebug / showDebugPanel está condicionada a DEBUG", () => {
    // Cada llamada debe estar en la misma línea que `if (DEBUG)` o dentro de un bloque
    // `if (DEBUG) {` abierto antes y no cerrado (conteo de llaves entre ambos puntos).
    const calls = [...app.matchAll(/(Overlay\.drawDebug|showDebugPanel)\(/g)]
      .filter(m => !/function showDebugPanel\($/.test(app.slice(Math.max(0, m.index - 9), m.index + 15)))
      .filter(m => !app.slice(Math.max(0, m.index - 9), m.index).includes("function "));
    assert.ok(calls.length >= 2);
    for (const m of calls) {
      const before = app.slice(0, m.index);
      const lineStart = before.lastIndexOf("\n") + 1;
      if (/if \(DEBUG\)/.test(app.slice(lineStart, m.index))) continue;
      const open = before.lastIndexOf("if (DEBUG) {");
      assert.ok(open >= 0, `sin guardia en índice ${m.index}`);
      const between = app.slice(open + "if (DEBUG) ".length, m.index);
      const depth = [...between].reduce((d, c) => d + (c === "{") - (c === "}"), 0);
      assert.ok(depth > 0, `la llamada en índice ${m.index} está fuera del bloque if (DEBUG)`);
    }
  });

  it("la decisión de aceptar la zona no depende de _debug ni de la métrica candidata", () => {
    const gate = loc.match(/if \(sim\.std < MIN_PATCH_STD \|\| sim\.nccMin < MIN_ZONE_NCC\)/);
    assert.ok(gate, "la condición de rechazo cambió");
    assert.ok(!/lowMin\s*<|low\s*</.test(loc), "la métrica candidata no debe decidir");
  });

  it("la proyección rechazada se informa como polygonDebug, nunca como polygon", () => {
    assert.match(loc, /polygonDebug: rp/);
    assert.match(loc, /\.\.\.\(_debug \? \{ polygonDebug/);
  });

  it("overlay dibuja polygonDebug solo para zonas no visibles y rotuladas DEBUG", () => {
    assert.match(ovl, /if \(z\.visible \|\| !p \|\| p\.length < 3\) continue;/);
    assert.match(ovl, /DEBUG \$\{z\.id\}: proyección SIN evidencia/);
  });
});
