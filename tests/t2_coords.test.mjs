/**
 * t2_coords.test.mjs — cadena de coordenadas real (app/coords.js).
 * Categoría: AUTOMÁTICA (escritorio). Ejecuta el módulo que usa la app.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scaleResult, coverMapping, procSize } from "../app/coords.js";

describe("procSize — fotograma procesado", () => {
  it("teléfono vertical 720x1280 → 640x1138, k = 1,125", () => {
    const { k, pw, ph } = procSize(720, 1280, 640);
    assert.equal(pw, 640); assert.equal(ph, 1138); assert.equal(k, 1.125);
  });
  it("el redondeo vertical introduce < 0,5 px de error en el canvas", () => {
    for (const [W, H] of [[720, 1280], [1280, 720], [1080, 1920], [480, 640]]) {
      const { k, ph } = procSize(W, H, 640);
      assert.ok(Math.abs(ph * k - H) < 0.6, `${W}x${H}: ${ph}*${k}=${ph * k}`);
    }
  });
  it("variante 360 px: teléfono 720x1280 → 360x640, k = 2 (proporción conservada)", () => {
    const { k, pw, ph } = procSize(720, 1280, 360);
    assert.equal(pw, 360); assert.equal(ph, 640); assert.equal(k, 2);
    assert.ok(Math.abs(pw / ph - 720 / 1280) < 1e-9);
  });
  it("variante 360 px: otras cámaras conservan la proporción con < 0,6 px de error", () => {
    for (const [W, H] of [[1080, 1920], [1280, 720], [480, 640], [1440, 2560]]) {
      const { k, pw, ph } = procSize(W, H, 360);
      assert.equal(pw, 360);
      assert.ok(Math.abs(ph * k - H) < 0.6 * k, `${W}x${H}`);
    }
  });
  it("variante 360 px: punto procesado → canvas → pantalla coincide con el cálculo directo", () => {
    const { k } = procSize(720, 1280, 360);
    const raw = { found: true, zones: [{ id: "gpio", visible: true, polygon: [[100, 200], [140, 200], [140, 400], [100, 400]], labelPt: [120, 190] }] };
    const s = scaleResult(raw, k);
    assert.deepEqual(s.zones[0].polygon, [[200, 400], [280, 400], [280, 800], [200, 800]]);
    const m = coverMapping(720, 1280, 369, 640);
    const [x, y] = m.toScreen(s.zones[0].polygon[0]);
    assert.ok(Math.abs(x - (200 * m.scale + m.offsetX)) < 1e-9 && Math.abs(y - (400 * m.scale + m.offsetY)) < 1e-9);
  });
  it("sin reducción cuando el ancho ya es ≤ 640", () => {
    assert.deepEqual(procSize(480, 640, 640), { k: 1, pw: 480, ph: 640 });
  });
});

describe("scaleResult — procesado → canvas", () => {
  const raw = {
    found: true,
    zones: [
      { id: "gpio", visible: false, polygon: null, labelPt: null, polygonDebug: [[10, 20], [110, 20], [110, 30], [10, 30]] },
      { id: "otra", visible: true, polygon: [[0, 0], [8, 0], [8, 8]], labelPt: [4, 2] },
    ],
    debug: { board: [[1, 1], [2, 2], [3, 1]], inlierPts: [[100, 200]], H: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
  };
  const s = scaleResult(raw, 1.125);

  it("escala el polígono aceptado y la etiqueta", () => {
    assert.deepEqual(s.zones[1].polygon, [[0, 0], [9, 0], [9, 9]]);
    assert.deepEqual(s.zones[1].labelPt, [5, 2]);
  });
  it("escala también la proyección DEBUG rechazada (antes no se escalaba)", () => {
    assert.deepEqual(s.zones[0].polygonDebug, [[11, 23], [124, 23], [124, 34], [11, 34]]);
    assert.equal(s.zones[0].polygon, null, "una zona rechazada sigue sin polygon");
  });
  it("escala el contorno de placa y los inliers de diagnóstico", () => {
    assert.deepEqual(s.debug.inlierPts, [[113, 225]]);
    assert.deepEqual(s.debug.board, [[1, 1], [2, 2], [3, 1]].map(([x, y]) => [Math.round(x * 1.125), Math.round(y * 1.125)]));
    assert.equal(s.debug.scaleK, 1.125);
  });
  it("k = 1 no modifica el resultado", () => {
    assert.equal(scaleResult(raw, 1), raw);
  });
});

describe("coverMapping — canvas → pantalla (object-fit: cover)", () => {
  it("canvas horizontal en caja vertical: recorta los costados", () => {
    const m = coverMapping(1280, 720, 400, 800);
    assert.ok(Math.abs(m.scale - 800 / 720) < 1e-9);
    assert.ok(Math.abs(m.visible.h - 720) < 1e-6, "se ve toda la altura");
    assert.ok(Math.abs(m.visible.w - 360) < 1e-6);
    assert.ok(Math.abs(m.visible.x - 460) < 1e-6, "se recorta lo mismo a cada lado");
  });
  it("el centro del canvas cae en el centro de la caja", () => {
    const m = coverMapping(720, 1280, 463, 760);
    const [x, y] = m.toScreen([360, 640]);
    assert.ok(Math.abs(x - 231.5) < 1e-6 && Math.abs(y - 380) < 1e-6);
  });
  it("misma relación de aspecto: sin recorte", () => {
    const m = coverMapping(720, 1280, 360, 640);
    assert.equal(m.offsetX, 0); assert.equal(m.offsetY, 0);
  });
});
