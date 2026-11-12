/**
 * overlay.js — T2: dibujo de etiquetas y polígonos sobre el canvas
 *
 * API pública:
 *   Overlay.init(canvasElement)
 *   Overlay.drawResult(locateResult)   — dibuja zonas visibles
 *   Overlay.clear()                    — borra todo el overlay
 *   Overlay.showSearching()            — muestra indicador de búsqueda
 *   Overlay.freezeResult(locateResult) — fija etiquetas para estado congelado
 *   Overlay.drawFrozen()               — redibuja las etiquetas congeladas
 *
 * El overlay usa un <canvas> separado superpuesto al canvas de video,
 * para no mezclar el frame de cámara con las anotaciones.
 */

"use strict";

export const Overlay = (() => {

  let _canvas  = null;
  let _ctx     = null;
  let _frozen  = null;    // resultado congelado (LocateResult o null)

  // ── Estilo ─────────────────────────────────────────────────────────────────

  const STYLE = {
    polygon:      { stroke: "rgba(255,165,0,0.85)",  lineWidth: 2.5 },
    label: {
      bg:         "rgba(0,0,0,0.70)",
      text:       "#FFE08A",
      font:       "bold 14px system-ui, sans-serif",
      padding:    [5, 10],
    },
    searching: {
      text:       "Buscando placa…",
      color:      "rgba(255,255,255,0.65)",
      font:       "14px system-ui, sans-serif",
    },
    diag: {
      font:       "11px monospace",
      color:      "rgba(180,255,180,0.80)",
    },
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function drawPolygon(ctx, polygon) {
    if (!polygon || polygon.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(polygon[0][0], polygon[0][1]);
    for (let i = 1; i < polygon.length; i++) {
      ctx.lineTo(polygon[i][0], polygon[i][1]);
    }
    ctx.closePath();
    ctx.strokeStyle = STYLE.polygon.stroke;
    ctx.lineWidth   = STYLE.polygon.lineWidth;
    ctx.stroke();
    // Relleno muy tenue
    ctx.fillStyle = "rgba(255,165,0,0.08)";
    ctx.fill();
  }

  function drawLabel(ctx, text, x, y) {
    ctx.font = STYLE.label.font;
    const measured = ctx.measureText(text);
    const tw       = measured.width;
    const th       = 16;
    const [py, px] = STYLE.label.padding;
    const bx = x - tw / 2 - px;
    const by = y - th - py;
    const bw = tw + px * 2;
    const bh = th + py * 2;

    // Fondo
    ctx.fillStyle = STYLE.label.bg;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 6);
    ctx.fill();

    // Texto
    ctx.fillStyle   = STYLE.label.text;
    ctx.textAlign   = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, by + bh / 2);
  }

  function drawDiag(ctx, metrics, canvasW) {
    if (!metrics) return;
    const { inliers, matchesUsed, processingMs } = metrics;
    const lines = [
      `inliers:${inliers} matches:${matchesUsed} ${processingMs}ms`,
    ];
    ctx.font      = STYLE.diag.font;
    ctx.fillStyle = STYLE.diag.color;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    lines.forEach((line, i) => {
      ctx.fillText(line, canvasW - 6, 6 + i * 14);
    });
  }

  function renderResult(ctx, result, W, H) {
    ctx.clearRect(0, 0, W, H);

    if (!result || !result.found) {
      // Indicador de búsqueda (solo cuando no encontró nada)
      ctx.font      = STYLE.searching.font;
      ctx.fillStyle = STYLE.searching.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(STYLE.searching.text, W / 2, H - 36);
      return;
    }

    for (const zone of result.zones) {
      if (!zone.visible || !zone.polygon) continue;
      drawPolygon(ctx, zone.polygon);
      if (zone.labelPt) {
        drawLabel(ctx, zone.name, zone.labelPt[0], zone.labelPt[1]);
      }
    }

    // Info de diagnóstico (esquina superior derecha, discreta)
    if (result.diagMetrics) {
      drawDiag(ctx, result.diagMetrics, W);
    }
  }

  // ── API pública ──────────────────────────────────────────────────────────────

  function init(canvasElement) {
    _canvas = canvasElement;
    _ctx    = canvasElement.getContext("2d");
  }

  function drawResult(result) {
    if (!_canvas) return;
    renderResult(_ctx, result, _canvas.width, _canvas.height);
  }

  function clear() {
    if (!_canvas) return;
    _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
    _frozen = null;
  }

  function showSearching() {
    drawResult(null);
  }

  /**
   * Congela el resultado actual para mostrarlo junto al cuadro fijo.
   * Las etiquetas congeladas corresponden exactamente al fotograma congelado.
   */
  function freezeResult(result) {
    _frozen = result ? JSON.parse(JSON.stringify(result)) : null;
  }

  /**
   * Redibuja las etiquetas del resultado congelado.
   * Usar cuando el canvas de video ya muestra el cuadro congelado.
   */
  function drawFrozen() {
    if (!_canvas) return;
    if (_frozen) {
      renderResult(_ctx, _frozen, _canvas.width, _canvas.height);
    } else {
      _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
    }
  }

  /**
   * SOLO MODO DIAGNÓSTICO (?debug=1). Dibuja, sin borrar lo anterior:
   *   - puntos inliers de la homografía (cuadraditos cian),
   *   - contorno de la placa proyectado (cian punteado si la homografía se aceptó;
   *     rojo punteado y rotulado «RECHAZADA» si no),
   *   - proyección de zonas RECHAZADAS (gris, punteado corto, rótulo «DEBUG … SIN evidencia»).
   * Nada de esto es naranja ni sólido: no se confunde con una etiqueta aceptada.
   * No se llama en el modo normal.
   */
  function drawDebug(result) {
    if (!_canvas || !result || !result.zones) return;
    const ctx = _ctx;
    const d = result.debug;
    if (d) {
      // Puntos inliers (donde la placa coincide con la referencia): cian, pequeños
      ctx.save();
      ctx.fillStyle = "rgba(0,230,255,0.85)";
      for (const [x, y] of d.inlierPts || []) ctx.fillRect(x - 2, y - 2, 4, 4);
      // Contorno de la placa proyectado: cian punteado si la homografía fue ACEPTADA;
      // rojo punteado y rotulado si fue RECHAZADA (pocos inliers): no es una localización.
      const b = d.board;
      if (b && b.length >= 3) {
        const ok = !!result.found;
        ctx.setLineDash([14, 8]);
        ctx.strokeStyle = ok ? "rgba(0,230,255,0.9)" : "rgba(255,60,60,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(b[0][0], b[0][1]);
        for (let i = 1; i < b.length; i++) ctx.lineTo(b[i][0], b[i][1]);
        ctx.closePath();
        ctx.stroke();
        if (!ok) {
          ctx.setLineDash([]);
          const inl = result.diagMetrics ? result.diagMetrics.inliers : "?";
          const t = `DEBUG placa: homografía RECHAZADA (${inl} inliers < 10)`;
          ctx.font = "13px monospace";
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          // Debajo de la barra de variantes (que ocupa la franja superior)
          const ty = Math.round(_canvas.height * 0.2);
          ctx.fillRect(8, ty, ctx.measureText(t).width + 10, 18);
          ctx.fillStyle = "#ff8080";
          ctx.textAlign = "left"; ctx.textBaseline = "top";
          ctx.fillText(t, 13, ty + 2);
        }
      }
      ctx.restore();
    }
    for (const z of result.zones) {
      const p = z.polygonDebug;
      if (z.visible || !p || p.length < 3) continue;
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = "rgba(200,200,200,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      const x = Math.min(...p.map(q => q[0])), y = Math.min(...p.map(q => q[1]));
      ctx.font = "12px monospace";
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      const t = `DEBUG ${z.id}: proyección SIN evidencia`;
      ctx.fillRect(x, Math.max(0, y - 18), ctx.measureText(t).width + 8, 16);
      ctx.fillStyle = "#ddd";
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(t, x + 4, Math.max(0, y - 17));
      ctx.restore();
    }
  }

  return { init, drawResult, clear, showSearching, freezeResult, drawFrozen, drawDebug };
})();
