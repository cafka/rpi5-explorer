/**
 * t2_page_wiring.test.mjs — verifica cómo index.html carga la app real.
 * Categoría: AUTOMÁTICA, análisis estático de app/index.html (escritorio).
 *
 * Detecta los fallos que impidieron que T2 corriera en el teléfono:
 *   - index.html sin camera.js
 *   - OpenCV.js desde una URL externa inexistente (404)
 *   - canvas de overlay sin el mismo object-fit que el video (desalineación)
 *   - archivos referenciados que no existen en app/
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP  = path.join(ROOT, "app");
const html = readFileSync(path.join(APP, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script\b([^>]*)>/gi)].map(m => m[1]);
const srcOf = attrs => (attrs.match(/\bsrc="([^"]+)"/) || [])[1];

describe("index.html — carga de scripts", () => {
  it("carga camera.js exactamente una vez", () => {
    assert.equal(scripts.filter(a => srcOf(a) === "camera.js").length, 1);
  });

  it("carga app.js como módulo", () => {
    assert.ok(scripts.some(a => srcOf(a) === "app.js" && /type="module"/.test(a)));
  });

  it("camera.js se declara antes que app.js (los hooks deben existir al registrar)", () => {
    assert.ok(html.indexOf('src="camera.js"') < html.indexOf('src="app.js"'));
  });

  it("OpenCV.js se carga desde vendor/ local, no desde una URL externa", () => {
    const cv = scripts.map(srcOf).filter(s => s && /opencv/i.test(s));
    assert.equal(cv.length, 1, `scripts opencv: ${cv}`);
    assert.ok(!/^https?:/i.test(cv[0]), `URL externa: ${cv[0]}`);
  });

  it("el script de OpenCV.js tiene manejador onerror (el fallo se ve en pantalla)", () => {
    assert.ok(scripts.some(a => /opencv/i.test(srcOf(a) || "") && /onerror=/.test(a)));
  });

  it("todos los src locales existen en app/", () => {
    for (const s of scripts.map(srcOf).filter(s => s && !/^https?:/i.test(s))) {
      assert.ok(existsSync(path.join(APP, s)), `falta app/${s}`);
    }
  });

  it("la referencia declarada en zones.json existe", () => {
    const z = JSON.parse(readFileSync(path.join(APP, "data", "zones.json"), "utf8"));
    assert.ok(existsSync(path.join(APP, "data", "reference", z.image.file)), z.image.file);
  });
});

describe("index.html — alineación de canvases", () => {
  it("canvas-overlay usa object-fit:cover igual que canvas-live", () => {
    const tag = html.match(/<canvas id="canvas-overlay"[^>]*>/)[0];
    assert.match(tag, /object-fit\s*:\s*cover/);
    assert.match(html, /#canvas-live\s*\{[^}]*object-fit:\s*cover/);
  });

  it("existe la línea de diagnóstico visible en pantalla", () => {
    assert.match(html, /id="diag-line"/);
  });
});
