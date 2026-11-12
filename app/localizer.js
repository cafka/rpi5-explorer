/**
 * localizer.js — T2: localización de una zona (GPIO) con OpenCV.js 4.9.0
 *
 * Pipeline por fotograma:
 *   ORB → BFMatcher.knnMatch(k=2) → ratio test → findHomography(RANSAC)
 *   → proyección del polígono de la zona → evidencia específica de la zona.
 *
 * Evidencia de la zona (debe cumplirse en ESTE fotograma):
 *   - El parche de la zona en el fotograma, rectificado con la homografía, se compara con
 *     el parche de la referencia (TM_CCOEFF_NORMED) en ZONE_SEGMENTS tramos a lo largo
 *     del eje mayor; TODOS deben superar MIN_ZONE_NCC, y el parche debe tener contraste
 *     mínimo (MIN_PATCH_STD). Una oclusión parcial o total baja al menos un tramo.
 *   - zoneInliers (inliers RANSAC cuyo punto de referencia cae en la zona) se informa
 *     como diagnóstico: en el header GPIO, patrón repetitivo, casi no sobreviven al ratio test.
 *   Localizar la placa no basta: si la zona está tapada, fuera de cuadro o no se
 *   parece a la referencia, visible=false. Los umbrales son hipótesis iniciales;
 *   se validan con capturas reales en el teléfono.
 *
 * API:
 *   Localizer.init(cv, refImage | ImageData, zonesJson) → Promise<void>
 *   Localizer.locate(imageData) → { found, zones:[{id,name,visible,polygon,labelPt,evidence}], diagMetrics }
 *   Localizer.dispose(), isReady(), getError()
 *
 * No hay posiciones fijas ni resultados simulados: found:true solo se devuelve
 * tras una homografía aceptada en el fotograma recibido.
 */

"use strict";

export const Localizer = (() => {

  let _cv = null, _ready = false, _error = null;
  let _refKeypoints = null, _refDescriptors = null, _orb = null, _orbFrame = null, _matcher = null;
  let _refW = 0, _refH = 0;
  let _refInfo = null;           // { width, height, keypoints, boardMask }
  let _zones = [];               // [{ id, name, polygon_px, bbox:{x,y,w,h}, patch: cv.Mat }]

  // ── Parámetros (hipótesis iniciales) ────────────────────────────────────────
  const ORB_FEATURES      = 1500;  // referencia: cobertura de toda la placa
  const ORB_FRAME_FEATURES = 800;  // fotograma: menos puntos = matching más rápido (medido)
  const MIN_GOOD_MATCHES  = 12;
  const RATIO_THRESH      = 0.75;
  const RANSAC_THRESH     = 5.0;
  const MIN_INLIERS       = 10;
  const INLIER_RATIO_MIN  = 0.20;
  // Evidencia de zona. zoneInliers queda solo como diagnóstico: el header GPIO es un patrón
  // repetitivo y el ratio test descarta sus correspondencias (medido con la foto real:
  // 0–1 inliers en zona aunque la placa se localice con cientos de inliers).
  const MIN_ZONE_NCC      = 0.5;   // en CADA segmento de la zona
  const ZONE_SEGMENTS     = 3;
  const MIN_PATCH_STD     = 8;

  const REQUIRED = ["Mat", "MatVector", "fillPoly", "ORB", "BFMatcher", "KeyPointVector", "DMatchVectorVector",
    "findHomography", "perspectiveTransform", "matFromArray", "matFromImageData",
    "cvtColor", "COLOR_RGBA2GRAY", "NORM_HAMMING", "RANSAC", "warpPerspective",
    "WARP_INVERSE_MAP", "INTER_LINEAR", "BORDER_CONSTANT", "matchTemplate",
    "TM_CCOEFF_NORMED", "meanStdDev", "Rect", "Size", "Scalar"];

  const log  = m => console.log("[localizer]", m);
  const warn = m => console.warn("[localizer]", m);

  function checkCapabilities(cv) {
    const missing = REQUIRED.filter(n => !(n in cv));
    return missing.length ? `Funciones no disponibles en esta compilación: ${missing.join(", ")}` : null;
  }

  function pointInPolygon(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function polygonArea(poly) {
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
      a += x1 * y2 - x2 * y1;
    }
    return Math.abs(a) / 2;
  }

  /** Plausibilidad geométrica del polígono proyectado (no degenerado, convexo, en cuadro). */
  function isPolygonPlausible(poly, W, H) {
    if (!poly || poly.length < 3) return false;
    if (poly.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) return false;
    const area = polygonArea(poly);
    if (area < W * H * 0.001 || area > W * H * 0.9) return false;
    // Convexidad: todos los productos cruzados con el mismo signo
    let sign = 0;
    for (let i = 0; i < poly.length; i++) {
      const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length], [cx, cy] = poly[(i + 2) % poly.length];
      const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
      if (cross !== 0) { if (sign === 0) sign = Math.sign(cross); else if (Math.sign(cross) !== sign) return false; }
    }
    // Al menos el 60 % del área de la zona dentro del cuadro (aprox. por vértices)
    const inside = poly.filter(([x, y]) => x >= 0 && x < W && y >= 0 && y < H).length;
    return inside >= Math.ceil(poly.length * 0.6);
  }

  function projectPolygon(cv, Hm, poly) {
    const src = cv.matFromArray(poly.length, 1, cv.CV_32FC2, poly.flat());
    const dst = new cv.Mat();
    try {
      cv.perspectiveTransform(src, dst, Hm);
      const out = [];
      for (let i = 0; i < poly.length; i++) out.push([dst.data32F[i * 2], dst.data32F[i * 2 + 1]]);
      return out;
    } finally { src.delete(); dst.delete(); }
  }

  /**
   * Rectifica la zona del fotograma a la geometría de la referencia y la compara
   * con el parche de referencia. Devuelve { ncc, std }.
   * M = H · T(bx,by): mapea coordenadas del parche → fotograma (WARP_INVERSE_MAP).
   */
  /** NCC (TM_CCOEFF_NORMED) entre dos Mat del mismo tamaño; 0 si no es finito. */
  function nccOf(cv, a, b) {
    const res = new cv.Mat();
    try {
      cv.matchTemplate(a, b, res, cv.TM_CCOEFF_NORMED);
      const v = res.data32F[0];
      return Number.isFinite(v) ? v : 0;
    } finally { res.delete(); }
  }

  function zoneSimilarity(cv, frameGray, h, zone) {
    const { x: bx, y: by, w, h: hh } = zone.bbox;
    const M = cv.matFromArray(3, 3, cv.CV_64F, [
      h[0], h[1], h[0] * bx + h[1] * by + h[2],
      h[3], h[4], h[3] * bx + h[4] * by + h[5],
      h[6], h[7], h[6] * bx + h[7] * by + h[8],
    ]);
    const warped = new cv.Mat(), mean = new cv.Mat(), std = new cv.Mat();
    try {
      cv.warpPerspective(frameGray, warped, M, new cv.Size(w, hh),
        cv.INTER_LINEAR | cv.WARP_INVERSE_MAP, cv.BORDER_CONSTANT, new cv.Scalar(0));
      cv.meanStdDev(warped, mean, std);
      const s = std.data64F[0];
      if (s < MIN_PATCH_STD) return { ncc: 0, nccMin: 0, std: s };
      const ncc = nccOf(cv, warped, zone.patch);

      // Por segmentos a lo largo del eje mayor: una oclusión parcial baja al menos un tramo
      const horiz = w >= hh, L = horiz ? w : hh, seg = Math.floor(L / ZONE_SEGMENTS);
      let nccMin = 1;
      for (let i = 0; i < ZONE_SEGMENTS; i++) {
        const r = horiz ? new cv.Rect(i * seg, 0, seg, hh) : new cv.Rect(0, i * seg, w, seg);
        const a = warped.roi(r), b = zone.patch.roi(r);
        try { nccMin = Math.min(nccMin, nccOf(cv, a, b)); } finally { a.delete(); b.delete(); }
      }
      return { ncc, nccMin, std: s };
    } finally { M.delete(); warped.delete(); mean.delete(); std.delete(); }
  }

  function freeZones() {
    for (const z of _zones) if (z.patch) z.patch.delete();
    _zones = [];
  }

  // ── API ─────────────────────────────────────────────────────────────────────

  async function init(cv, refImage, zonesJson) {
    dispose();
    _cv = cv; _error = null;

    const missing = checkCapabilities(cv);
    if (missing) { _error = missing; warn(missing); return; }

    let imgData;
    if (refImage && refImage.data && refImage.width && refImage.height) {
      imgData = refImage;
    } else {
      const c = document.createElement("canvas");
      c.width = zonesJson.image.width; c.height = zonesJson.image.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(refImage, 0, 0, c.width, c.height);
      imgData = ctx.getImageData(0, 0, c.width, c.height);
    }
    _refW = imgData.width; _refH = imgData.height;

    let rgba = null, gray = null, noMask = null;
    try {
      rgba = cv.matFromImageData(imgData);
      gray = new cv.Mat();
      cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);

      _orb = new cv.ORB(ORB_FEATURES);
      _orbFrame = new cv.ORB(ORB_FRAME_FEATURES);
      _refKeypoints = new cv.KeyPointVector();
      _refDescriptors = new cv.Mat();
      // Máscara de placa (opcional): solo se extraen puntos dentro del contorno de la
      // placa, para que el fondo, la cuadrícula o una marca de agua de la foto no aporten
      // correspondencias falsas.
      const board = zonesJson.board_polygon_px;
      if (Array.isArray(board) && board.length >= 3) {
        noMask = cv.Mat.zeros(gray.rows, gray.cols, cv.CV_8UC1);
        const pts = cv.matFromArray(board.length, 1, cv.CV_32SC2, board.flat().map(Math.round));
        const vec = new cv.MatVector();
        vec.push_back(pts);
        cv.fillPoly(noMask, vec, new cv.Scalar(255));
        vec.delete(); pts.delete();
      } else {
        noMask = new cv.Mat();
      }
      _orb.detectAndCompute(gray, noMask, _refKeypoints, _refDescriptors);
      if (_refKeypoints.size() < MIN_GOOD_MATCHES) {
        throw new Error(`Referencia con pocos keypoints (${_refKeypoints.size()})`);
      }
      _matcher = new cv.BFMatcher(cv.NORM_HAMMING, false);

      for (const z of zonesJson.zones || []) {
        const xs = z.polygon_px.map(p => p[0]), ys = z.polygon_px.map(p => p[1]);
        const x = Math.max(0, Math.floor(Math.min(...xs))), y = Math.max(0, Math.floor(Math.min(...ys)));
        const w = Math.min(_refW, Math.ceil(Math.max(...xs))) - x;
        const h = Math.min(_refH, Math.ceil(Math.max(...ys))) - y;
        const roi = gray.roi(new cv.Rect(x, y, w, h));
        const patch = roi.clone(); roi.delete();
        let nKp = 0;
        for (let i = 0; i < _refKeypoints.size(); i++) {
          const p = _refKeypoints.get(i).pt;
          if (pointInPolygon(p.x, p.y, z.polygon_px)) nKp++;
        }
        _zones.push({ id: z.id, name: z.name, polygon_px: z.polygon_px,
                      bbox: { x, y, w, h }, patch, refArea: polygonArea(z.polygon_px), refKeypoints: nKp });
        log(`Zona ${z.id}: ${nKp} keypoints de referencia dentro del polígono.`);
      }
      _refInfo = { width: _refW, height: _refH, keypoints: _refKeypoints.size(),
                   boardMask: Array.isArray(board) && board.length >= 3 };
      _ready = true;
      log(`Referencia ${_refW}x${_refH}: ${_refKeypoints.size()} keypoints` +
          (_refInfo.boardMask ? " (con máscara de placa)" : "") + ". Listo.");
    } catch (e) {
      _error = "init: " + e.message;
      warn(_error);
      dispose();
    } finally {
      if (rgba) rgba.delete();
      if (gray) gray.delete();
      if (noMask) noMask.delete();
    }
  }

  function locate(imageData) {
    const t0 = performance.now();
    const W = imageData.width, H = imageData.height;
    const base = { frameKeypoints: 0, matchesUsed: 0, inliers: 0, frameW: W, frameH: H };
    const empty = extra => ({
      found: false,
      zones: _zones.map(z => ({ id: z.id, name: z.name, visible: false, polygon: null, labelPt: null, evidence: null })),
      diagMetrics: { ...base, ...extra, processingMs: Math.round(performance.now() - t0) },
    });
    if (!_ready) return empty();

    const cv = _cv;
    let rgba = null, gray = null, kps = null, desc = null, noMask = null,
        knn = null, m1 = null, m2 = null, mask = null, Hm = null;
    try {
      rgba = cv.matFromImageData(imageData);
      gray = new cv.Mat();
      cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);

      kps = new cv.KeyPointVector(); desc = new cv.Mat(); noMask = new cv.Mat();
      _orbFrame.detectAndCompute(gray, noMask, kps, desc);
      const nKp = kps.size();
      if (nKp < MIN_GOOD_MATCHES || desc.empty()) return empty({ frameKeypoints: nKp });

      knn = new cv.DMatchVectorVector();
      _matcher.knnMatch(_refDescriptors, desc, knn, 2);
      const good = [];
      for (let i = 0; i < knn.size(); i++) {
        const pair = knn.get(i);           // objeto embind: se libera explícitamente
        try {
          if (pair.size() < 2) continue;
          const a = pair.get(0), b = pair.get(1);
          if (a.distance < RATIO_THRESH * b.distance) good.push([a.queryIdx, a.trainIdx]);
        } finally {
          pair.delete();
        }
      }
      if (good.length < MIN_GOOD_MATCHES) return empty({ frameKeypoints: nKp, matchesUsed: good.length });

      const src = [], dst = [], refPts = [];
      for (const [q, t] of good) {
        const p = _refKeypoints.get(q).pt, f = kps.get(t).pt;
        src.push(p.x, p.y); dst.push(f.x, f.y); refPts.push([p.x, p.y]);
      }
      m1 = cv.matFromArray(good.length, 2, cv.CV_32F, src);
      m2 = cv.matFromArray(good.length, 2, cv.CV_32F, dst);
      mask = new cv.Mat();
      Hm = cv.findHomography(m1, m2, cv.RANSAC, RANSAC_THRESH, mask);
      if (!Hm || Hm.empty()) return empty({ frameKeypoints: nKp, matchesUsed: good.length });

      const inl = [];
      for (let i = 0; i < mask.rows; i++) if (mask.data[i]) inl.push(i);
      const diag = { frameKeypoints: nKp, matchesUsed: good.length, inliers: inl.length };
      if (inl.length < MIN_INLIERS || inl.length / good.length < INLIER_RATIO_MIN) return empty(diag);

      const h = Array.from(Hm.data64F);
      const zones = _zones.map(z => {
        const poly = projectPolygon(cv, Hm, z.polygon_px);
        const none = { id: z.id, name: z.name, visible: false, polygon: null, labelPt: null };
        if (!isPolygonPlausible(poly, W, H)) return { ...none, evidence: { reason: "geometría" } };

        const zoneInliers = inl.filter(i => pointInPolygon(refPts[i][0], refPts[i][1], z.polygon_px)).length;
        const { ncc, nccMin, std } = zoneSimilarity(cv, gray, h, z);
        const evidence = { zoneInliers, ncc: Math.round(ncc * 100) / 100,
                           nccMin: Math.round(nccMin * 100) / 100, std: Math.round(std) };
        if (std < MIN_PATCH_STD || nccMin < MIN_ZONE_NCC) return { ...none, evidence };

        const rp = poly.map(([x, y]) => [Math.round(x), Math.round(y)]);
        const cx = Math.round(rp.reduce((s, p) => s + p[0], 0) / rp.length);
        const top = Math.min(...rp.map(p => p[1]));
        return { id: z.id, name: z.name, visible: true, polygon: rp, labelPt: [cx, Math.max(24, top - 8)], evidence };
      });

      return { found: true, zones, diagMetrics: { ...diag, processingMs: Math.round(performance.now() - t0) } };
    } catch (e) {
      warn("locate: " + (e && e.message ? e.message : e));
      return empty();
    } finally {
      for (const m of [rgba, gray, kps, desc, noMask, knn, m1, m2, mask, Hm]) if (m) m.delete();
    }
  }

  function dispose() {
    for (const m of [_refKeypoints, _refDescriptors, _orb, _orbFrame, _matcher]) if (m) m.delete();
    _refKeypoints = _refDescriptors = _orb = _orbFrame = _matcher = null;
    freeZones();
    _ready = false;
  }

  return { init, locate, dispose, isReady: () => _ready, getError: () => _error,
           getRefInfo: () => _refInfo };
})();
