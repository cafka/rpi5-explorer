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

  it("toda llamada a drawDebug / showDebugPanel está condicionada a DEBUG", () => {
    const calls = [...app.matchAll(/^(.*)(Overlay\.drawDebug|showDebugPanel)\(/gm)]
      .filter(m => !/function showDebugPanel/.test(m[0]));
    assert.ok(calls.length >= 2);
    for (const m of calls) assert.match(m[1], /if \(DEBUG\)/, `sin guardia: ${m[0].trim()}`);
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
