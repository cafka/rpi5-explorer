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
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP  = path.join(ROOT, "app");
const html = readFileSync(path.join(APP, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script\b([^>]*)>/gi)].map(m => m[1]);
// src sin el parámetro de versión (?v=...): es el nombre de archivo real
const srcOf = attrs => ((attrs.match(/\bsrc="([^"]+)"/) || [])[1] || "").split("?")[0] || undefined;

describe("index.html — carga de scripts", () => {
  it("carga camera.js exactamente una vez", () => {
    assert.equal(scripts.filter(a => srcOf(a) === "camera.js").length, 1);
  });

  it("carga app.js como módulo", () => {
    assert.ok(scripts.some(a => srcOf(a) === "app.js" && /type="module"/.test(a)));
  });

  it("camera.js se declara antes que app.js (los hooks deben existir al registrar)", () => {
    const cam = html.indexOf('src="camera.js'), app = html.indexOf('src="app.js');
    assert.ok(cam >= 0 && app >= 0, "faltan camera.js o app.js");
    assert.ok(cam < app);
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

  it("zones.json declara el SHA-256 exacto del archivo de referencia", () => {
    const z = JSON.parse(readFileSync(path.join(APP, "data", "zones.json"), "utf8"));
    assert.match(z.image.sha256 || "", /^[0-9a-f]{64}$/, "falta image.sha256");
    const bytes = readFileSync(path.join(APP, "data", "reference", z.image.file));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), z.image.sha256);
  });

  it("el fixture de pruebas corresponde a las dimensiones declaradas", () => {
    const z = JSON.parse(readFileSync(path.join(APP, "data", "zones.json"), "utf8"));
    const fx = readFileSync(path.join(ROOT, "tests", "fixtures", z.image.test_fixture));
    assert.equal(fx.length, z.image.width * z.image.height * 4);
  });

  it("app.js identifica la referencia por los bytes cargados (SHA-256), no solo por el rótulo", () => {
    const appJs = readFileSync(path.join(APP, "app.js"), "utf8");
    assert.match(appJs, /crypto\.subtle\.digest\("SHA-256"/);
    assert.match(appJs, /sha256:\$\{ref\.sha\.slice/);
  });
});

describe("versión publicada (evita mezclar archivos por la caché de GitHub Pages)", () => {
  const appJs = readFileSync(path.join(APP, "app.js"), "utf8");
  const build = (appJs.match(/const BUILD = "([^"]+)"/) || [])[1];

  it("app.js declara BUILD y lo muestra en la línea DIAGNÓSTICO", () => {
    assert.ok(build, "falta const BUILD");
    assert.match(appJs, /DIAGNÓSTICO \$\{BUILD\}/);
  });

  it("index.html carga camera.js y app.js con ?v=BUILD", () => {
    assert.ok(html.includes(`src="camera.js?v=${build}"`));
    assert.ok(html.includes(`src="app.js?v=${build}"`));
  });

  it("app.js importa localizer, overlay y coords con ?v=BUILD", () => {
    for (const m of ["localizer", "overlay", "coords"]) {
      assert.ok(appJs.includes(`"./${m}.js?v=${build}"`), `import de ${m} sin ?v=${build}`);
    }
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
