/**
 * localizer.js — T2: localización de zona GPIO con OpenCV.js
 *
 * Implementa homografía ORB+BFMatcher+ratio-test+RANSAC sobre el fotograma
 * actual respecto de la imagen de referencia sintética.
 *
 * API pública:
 *   Localizer.init(cvInstance, referenceImageElement, zonesJson) → Promise<void>
 *   Localizer.locate(imageData) → LocateResult
 *   Localizer.dispose()
 *
 * LocateResult:
 *   {
 *     found:      boolean,          // si se encontró la placa con homografía válida
 *     zones: [{
 *       id:       string,
 *       name:     string,
 *       visible:  boolean,          // evidencia local confirma que la zona está visible
 *       polygon:  [[x,y], ...],     // polígono proyectado en coordenadas del fotograma
 *       labelPt:  [x, y],           // punto sugerido para la etiqueta
 *     }],
 *     diagMetrics: {
 *       inliers:        number,
 *       matchesUsed:    number,
 *       reprojError:    number|null,
 *       frameW:         number,
 *       frameH:         number,
 *       processingMs:   number,
 *     }
 *   }
 *
 * Notas de implementación:
 *   - findHomography con RANSAC en opencv.js requiere que los puntos se
 *     construyan como cv.matFromArray(n, 2, cv.CV_32F, flatArray).
 *   - Se verifica disponibilidad de ORB y findHomography en tiempo de init.
 *   - Si OpenCV no expone esas funciones, se registra el error y locate()
 *     devuelve found:false en lugar de lanzar una excepción.
 *   - La validación de visibilidad de zona comprueba gradiente local (Laplacian
 *     variance) en la región proyectada. Es una señal candidata; los umbrales
 *     se ajustan en T2 con evidencia real. No garantiza que el componente esté
 *     visible si está tapado por un objeto con textura similar.
 */

"use strict";

export const Localizer = (() => {

  // ── Estado interno ──────────────────────────────────────────────────────────

  let _cv           = null;    // instancia de OpenCV.js
  let _ready        = false;   // init completado con éxito
  let _error        = null;    // mensaje de error si init falló

  let _refDescriptors = null;  // cv.Mat descriptores de la referencia
  let _refKeypoints   = null;  // cv.KeyPointVector keypoints de la referencia
  let _orbDetector    = null;  // detector ORB
  let _matcher        = null;  // BFMatcher

  let _refW = 0;               // dimensiones de la imagen de referencia
  let _refH = 0;

  let _zones = [];             // zonas cargadas desde zones.json

  // ── Parámetros de localización ──────────────────────────────────────────────

  const ORB_FEATURES       = 1500;   // máximo de keypoints
  const MIN_GOOD_MATCHES   = 12;     // mínimo para intentar homografía
  const RATIO_THRESH       = 0.75;   // ratio test de Lowe
  const RANSAC_THRESH      = 5.0;    // error de reproyección máximo (px)
  const MIN_INLIERS        = 10;     // mínimo de inliers para aceptar
  const INLIER_RATIO_MIN   = 0.20;   // fracción mínima de inliers/buenos matches
  const VISIBILITY_LAP_MIN = 15;     // varianza mínima de Laplacian para considerar zona visible

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function log(msg) {
    console.log("[localizer]", msg);
  }

  function warn(msg) {
    console.warn("[localizer]", msg);
  }

  /**
   * Verifica que las funciones necesarias estén disponibles en la compilación.
   * Devuelve null si todo está bien, o un string describiendo lo que falta.
   */
  function checkCapabilities(cv) {
    const needed = ["ORB", "BFMatcher", "findHomography", "perspectiveTransform",
                    "matFromArray", "NORM_HAMMING", "RANSAC", "cvtColor",
                    "COLOR_RGBA2GRAY", "KeyPointVector", "DMatchVectorVector"];
    const missing = needed.filter(fn => !(fn in cv));
    return missing.length === 0 ? null : `Funciones no disponibles en esta compilación: ${missing.join(", ")}`;
  }

  /**
   * Aplica ratio test de Lowe y devuelve los buenos matches.
   * @param {cv.DMatchVectorVector} knnMatches
   * @returns {Array<{queryIdx, trainIdx}>}
   */
  function ratioTest(knnMatches) {
    const good = [];
    for (let i = 0; i < knnMatches.size(); i++) {
      const pair = knnMatches.get(i);
      if (pair.size() < 2) continue;
      const m = pair.get(0);
      const n = pair.get(1);
      if (m.distance < RATIO_THRESH * n.distance) {
        good.push({ queryIdx: m.queryIdx, trainIdx: m.trainIdx });
      }
    }
    return good;
  }

  /**
   * Construye un cv.Mat de puntos 2D desde un array de {x,y} usando
   * la firma que funciona con findHomography en opencv.js:
   *   cv.matFromArray(nPoints, 2, cv.CV_32F, flatArray)
   */
  function buildPointsMat(cv, points) {
    const flat = [];
    for (const p of points) {
      flat.push(p.x, p.y);
    }
    return cv.matFromArray(points.length, 2, cv.CV_32F, flat);
  }

  /**
   * Proyecta los vértices de un polígono mediante la homografía H.
   * @param {cv.Mat} H  — 3×3
   * @param {Array<[x,y]>} polygon  — polígono en coordenadas de la referencia
   * @returns {Array<[x,y]>}
   */
  function projectPolygon(cv, H, polygon) {
    // Construir matriz de puntos de entrada
    const flat = polygon.flatMap(([x, y]) => [x, y]);
    const srcPts = cv.matFromArray(polygon.length, 1, cv.CV_32FC2, flat);
    const dstPts = new cv.Mat();
    try {
      cv.perspectiveTransform(srcPts, dstPts, H);
      const result = [];
      for (let i = 0; i < polygon.length; i++) {
        result.push([
          Math.round(dstPts.floatAt(i, 0)),
          Math.round(dstPts.floatAt(i, 1)),
        ]);
      }
      return result;
    } finally {
      srcPts.delete();
      dstPts.delete();
    }
  }

  /**
   * Comprueba si un polígono proyectado está razonablemente dentro del frame
   * y tiene área plausible (no degenerado).
   */
  function isPolygonPlausible(polygon, frameW, frameH) {
    if (!polygon || polygon.length < 3) return false;

    // Calcular área con fórmula del shoelace
    let area = 0;
    const n = polygon.length;
    for (let i = 0; i < n; i++) {
      const [x1, y1] = polygon[i];
      const [x2, y2] = polygon[(i + 1) % n];
      area += x1 * y2 - x2 * y1;
    }
    area = Math.abs(area) / 2;

    const minArea = (frameW * frameH) * 0.001;  // al menos 0.1% del frame
    const maxArea = (frameW * frameH) * 0.9;    // no más del 90%
    if (area < minArea || area > maxArea) return false;

    // Al menos un vértice dentro del frame
    const margin = -50;
    const inFrame = polygon.some(([x, y]) =>
      x > margin && x < frameW - margin &&
      y > margin && y < frameH - margin
    );
    return inFrame;
  }

  /**
   * Valida evidencia visual local en la región proyectada.
   * Calcula la varianza del Laplacian (proxy de nitidez/textura).
   * Una zona tapada o borrosa tendrá varianza muy baja.
   *
   * Esta es una señal candidata, no una prueba definitiva.
   * Se ajusta con evidencia real en T2.
   *
   * @param {cv.Mat} grayFrame  — frame en escala de grises
   * @param {Array<[x,y]>} polygon  — polígono proyectado en coords del frame
   * @returns {boolean}
   */
  function checkLocalEvidence(cv, grayFrame, polygon) {
    if (!polygon || polygon.length < 3) return false;

    // Bounding box del polígono, recortada al frame
    const xs = polygon.map(p => p[0]);
    const ys = polygon.map(p => p[1]);
    let x0 = Math.max(0, Math.min(...xs));
    let y0 = Math.max(0, Math.min(...ys));
    let x1 = Math.min(grayFrame.cols - 1, Math.max(...xs));
    let y1 = Math.min(grayFrame.rows - 1, Math.max(...ys));

    if (x1 - x0 < 5 || y1 - y0 < 5) return false;

    let lap = null;
    let roi = null;
    try {
      const rect = new cv.Rect(x0, y0, x1 - x0, y1 - y0);
      roi = grayFrame.roi(rect);
      lap = new cv.Mat();
      cv.Laplacian(roi, lap, cv.CV_64F);

      // Varianza del Laplacian = medida de nitidez/textura
      const mean = new cv.Mat();
      const std  = new cv.Mat();
      cv.meanStdDev(lap, mean, std);
      const stdVal  = std.doubleAt(0, 0);
      const variance = stdVal * stdVal;
      mean.delete();
      std.delete();

      return variance > VISIBILITY_LAP_MIN;
    } catch (e) {
      warn("checkLocalEvidence error: " + e.message);
      return true;  // ante error, no retirar la etiqueta
    } finally {
      if (roi)  roi.delete();
      if (lap)  lap.delete();
    }
  }

  // ── API pública ─────────────────────────────────────────────────────────────

  /**
   * Inicializa el localizador.
   * @param {object}      cvInstance    — instancia de OpenCV.js (window.cv o similar)
   * @param {ImageBitmap|HTMLImageElement|HTMLCanvasElement} refImage — imagen de referencia
   * @param {object}      zonesJson     — contenido de zones.json
   */
  async function init(cvInstance, refImage, zonesJson) {
    _cv    = cvInstance;
    _error = null;
    _ready = false;

    // 1. Verificar capacidades
    const missing = checkCapabilities(_cv);
    if (missing) {
      _error = missing;
      warn("init fallido: " + missing);
      return;
    }

    // 2. Cargar zonas
    _zones = zonesJson.zones || [];
    _refW  = zonesJson.image.width;
    _refH  = zonesJson.image.height;

    // 3. Convertir imagen de referencia a Mat en escala de grises
    let refMat  = null;
    let refGray = null;
    try {
      // Crear canvas temporal para leer los píxeles
      const tmpCanvas  = document.createElement("canvas");
      tmpCanvas.width  = _refW;
      tmpCanvas.height = _refH;
      const tmpCtx = tmpCanvas.getContext("2d");
      tmpCtx.drawImage(refImage, 0, 0, _refW, _refH);
      const imgData = tmpCtx.getImageData(0, 0, _refW, _refH);

      refMat  = _cv.matFromImageData(imgData);
      refGray = new _cv.Mat();
      _cv.cvtColor(refMat, refGray, _cv.COLOR_RGBA2GRAY);
    } catch (e) {
      _error = "Error al procesar imagen de referencia: " + e.message;
      warn(_error);
      if (refMat)  refMat.delete();
      if (refGray) refGray.delete();
      return;
    }

    // 4. Crear detector ORB y extraer descriptores de la referencia
    try {
      _orbDetector    = new _cv.ORB(ORB_FEATURES);
      _refKeypoints   = new _cv.KeyPointVector();
      _refDescriptors = new _cv.Mat();
      _orbDetector.detectAndCompute(refGray, new _cv.Mat(), _refKeypoints, _refDescriptors);

      if (_refKeypoints.size() < MIN_GOOD_MATCHES) {
        _error = `Referencia tiene muy pocos keypoints (${_refKeypoints.size()}). Imagen inadecuada.`;
        warn(_error);
        cleanup();
        refGray.delete();
        refMat.delete();
        return;
      }
      log(`Referencia: ${_refKeypoints.size()} keypoints extraídos.`);
    } catch (e) {
      _error = "Error al extraer descriptores de referencia: " + e.message;
      warn(_error);
      refGray.delete();
      refMat.delete();
      return;
    }

    // 5. Crear matcher (BFMatcher con NORM_HAMMING para descriptores binarios ORB)
    try {
      _matcher = new _cv.BFMatcher(_cv.NORM_HAMMING, false);
    } catch (e) {
      _error = "Error al crear BFMatcher: " + e.message;
      warn(_error);
      refGray.delete();
      refMat.delete();
      return;
    }

    refGray.delete();
    refMat.delete();
    _ready = true;
    log("Localizer listo.");
  }

  /**
   * Localiza la zona GPIO en el fotograma dado.
   * @param {ImageData} imageData — fotograma actual del canvas
   * @returns {LocateResult}
   */
  function locate(imageData) {
    const t0 = performance.now();

    const nullResult = (diagMetrics = {}) => ({
      found: false,
      zones: _zones.map(z => ({ id: z.id, name: z.name, visible: false, polygon: null, labelPt: null })),
      diagMetrics: { inliers: 0, matchesUsed: 0, reprojError: null,
                     frameW: imageData.width, frameH: imageData.height,
                     processingMs: Math.round(performance.now() - t0), ...diagMetrics },
    });

    if (!_ready) return nullResult();

    const cv  = _cv;
    const W   = imageData.width;
    const H   = imageData.height;

    let frameMat  = null;
    let frameGray = null;
    let frameKps  = null;
    let frameDesc = null;
    let knnMatches = null;
    let H_mat      = null;
    let mask       = null;

    try {
      // 1. Frame a escala de grises
      frameMat  = cv.matFromImageData(imageData);
      frameGray = new cv.Mat();
      cv.cvtColor(frameMat, frameGray, cv.COLOR_RGBA2GRAY);

      // 2. Detectar y computar descriptores en el frame
      frameKps  = new cv.KeyPointVector();
      frameDesc = new cv.Mat();
      _orbDetector.detectAndCompute(frameGray, new cv.Mat(), frameKps, frameDesc);

      if (frameKps.size() < MIN_GOOD_MATCHES || frameDesc.empty()) {
        return nullResult({ inliers: 0, matchesUsed: 0 });
      }

      // 3. kNN matching (k=2) + ratio test
      knnMatches = new cv.DMatchVectorVector();
      _matcher.knnMatch(_refDescriptors, frameDesc, knnMatches, 2);
      const good = ratioTest(knnMatches);

      if (good.length < MIN_GOOD_MATCHES) {
        return nullResult({ matchesUsed: good.length });
      }

      // 4. Construir matrices de puntos para findHomography
      const srcPts = good.map(m => _refKeypoints.get(m.queryIdx).pt);
      const dstPts = good.map(m => frameKps.get(m.trainIdx).pt);

      const mat1 = buildPointsMat(cv, srcPts);
      const mat2 = buildPointsMat(cv, dstPts);
      mask  = new cv.Mat();

      // 5. findHomography con RANSAC
      H_mat = cv.findHomography(mat1, mat2, cv.RANSAC, RANSAC_THRESH, mask);
      mat1.delete();
      mat2.delete();

      if (!H_mat || H_mat.empty()) {
        return nullResult({ matchesUsed: good.length });
      }

      // 6. Contar inliers
      let inliers = 0;
      for (let i = 0; i < mask.rows; i++) {
        if (mask.ucharAt(i, 0)) inliers++;
      }

      if (inliers < MIN_INLIERS || inliers / good.length < INLIER_RATIO_MIN) {
        return nullResult({ inliers, matchesUsed: good.length });
      }

      // 7. Proyectar zonas y validar evidencia local
      const zoneResults = _zones.map(zone => {
        const projPolygon = projectPolygon(cv, H_mat, zone.polygon_px);

        if (!isPolygonPlausible(projPolygon, W, H)) {
          return { id: zone.id, name: zone.name, visible: false, polygon: null, labelPt: null };
        }

        // Validar evidencia local en la región proyectada
        const hasEvidence = checkLocalEvidence(cv, frameGray, projPolygon);

        // Calcular punto de etiqueta (centroide del polígono)
        const cx = Math.round(projPolygon.reduce((s, p) => s + p[0], 0) / projPolygon.length);
        const cy = Math.round(projPolygon.reduce((s, p) => s + p[1], 0) / projPolygon.length);

        return {
          id:      zone.id,
          name:    zone.name,
          visible: hasEvidence,
          polygon: projPolygon,
          labelPt: hasEvidence ? [cx, cy - 20] : null,
        };
      });

      const processingMs = Math.round(performance.now() - t0);

      return {
        found: true,
        zones: zoneResults,
        diagMetrics: {
          inliers,
          matchesUsed: good.length,
          reprojError:  null,  // se puede calcular si se necesita
          frameW: W,
          frameH: H,
          processingMs,
        },
      };

    } catch (e) {
      warn("locate() excepción: " + e.message);
      return nullResult();
    } finally {
      // Liberar todos los Mat creados en este frame
      if (frameMat)   frameMat.delete();
      if (frameGray)  frameGray.delete();
      if (frameKps)   frameKps.delete();
      if (frameDesc)  frameDesc.delete();
      if (knnMatches) knnMatches.delete();
      if (H_mat)      H_mat.delete();
      if (mask)       mask.delete();
    }
  }

  /**
   * Libera recursos de OpenCV. Llamar al descargar la página.
   */
  function dispose() {
    if (_refDescriptors) { _refDescriptors.delete(); _refDescriptors = null; }
    if (_refKeypoints)   { _refKeypoints.delete();   _refKeypoints   = null; }
    if (_orbDetector)    { _orbDetector.delete();     _orbDetector    = null; }
    if (_matcher)        { _matcher.delete();         _matcher        = null; }
    _ready = false;
    log("Localizer liberado.");
  }

  function isReady() { return _ready; }
  function getError() { return _error; }

  return { init, locate, dispose, isReady, getError };
})();
