/**
 * coords.js — cadena de coordenadas de T2, en un solo lugar y probable en Node.
 *
 *   referencia (zones.json, px de la foto 1024x768)
 *     ──H (homografía de locate)──▶  fotograma PROCESADO (≤ 640 px de ancho)
 *     ──× k (k = canvasW / procW)──▶  canvas de video (= resolución de la cámara)
 *     ──object-fit: cover──────────▶  pantalla (CSS px; se recorta lo que sobra)
 *
 * La orientación la resuelve el navegador: el canvas recibe el video ya orientado
 * (videoWidth/videoHeight reales, p. ej. 720x1280 en vertical). No hay rotación manual.
 */

/** Escala TODAS las coordenadas de un resultado (procesado → canvas). */
export function scaleResult(result, k) {
  if (!result || k === 1) return result;
  const sp  = p => [Math.round(p[0] * k), Math.round(p[1] * k)];
  const spl = a => (Array.isArray(a) ? a.map(sp) : a);
  return {
    ...result,
    zones: result.zones.map(z => ({
      ...z,
      polygon:      z.polygon ? z.polygon.map(sp) : null,
      labelPt:      z.labelPt ? sp(z.labelPt) : null,
      ...(z.polygonDebug ? { polygonDebug: spl(z.polygonDebug) } : {}),
    })),
    ...(result.debug ? {
      debug: {
        ...result.debug,
        board:     spl(result.debug.board),
        inlierPts: spl(result.debug.inlierPts),
        scaleK:    k,
      },
    } : {}),
  };
}

/**
 * Correspondencia canvas → pantalla con object-fit: cover.
 * Devuelve escala, desplazamiento y la parte del canvas que queda visible.
 */
export function coverMapping(srcW, srcH, boxW, boxH) {
  const s = Math.max(boxW / srcW, boxH / srcH);
  const offsetX = (boxW - srcW * s) / 2, offsetY = (boxH - srcH * s) / 2;
  return {
    scale: s, offsetX, offsetY,
    visible: { x: -offsetX / s, y: -offsetY / s, w: boxW / s, h: boxH / s },
    toScreen: ([x, y]) => [x * s + offsetX, y * s + offsetY],
  };
}

/** Tamaño de procesamiento y factor k para un canvas de W×H. */
export function procSize(W, H, maxW) {
  const k = W > maxW ? W / maxW : 1;
  return { k, pw: Math.round(W / k), ph: Math.round(H / k) };
}
