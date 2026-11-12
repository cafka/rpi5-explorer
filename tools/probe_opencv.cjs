/**
 * probe_opencv.cjs — verifica qué expone realmente una compilación de OpenCV.js
 * y si el pipeline ORB → knnMatch → findHomography(RANSAC) funciona.
 *
 * Uso: node tools/probe_opencv.cjs <ruta/opencv.js>
 *
 * Prueba con datos sintéticos generados aquí mismo (una textura aleatoria y
 * su versión trasladada). Solo verifica que la API funciona; NO mide la
 * calidad del reconocimiento sobre una Raspberry Pi real.
 */
"use strict";
const path = require("path");

const cvPath = process.argv[2];
if (!cvPath) { console.error("Uso: node tools/probe_opencv.cjs <opencv.js>"); process.exit(2); }

function report(cv) {
  const names = ["ORB", "AKAZE", "SIFT", "BFMatcher", "findHomography", "perspectiveTransform",
    "matFromArray", "matFromImageData", "NORM_HAMMING", "RANSAC", "cvtColor",
    "COLOR_RGBA2GRAY", "KeyPointVector", "DMatchVectorVector", "Laplacian", "meanStdDev", "Rect"];
  const out = {};
  for (const n of names) out[n] = n in cv ? typeof cv[n] : "AUSENTE";
  console.log("Símbolos:", JSON.stringify(out, null, 1));

  // Textura aleatoria 320x240 y copia trasladada (+12,+7)
  const W = 320, H = 240, dx = 12, dy = 7;
  const a = new cv.Mat(H, W, cv.CV_8UC1);
  let s = 12345;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 60; i++) {
    cv.rectangle(a, new cv.Point(rnd()*W, rnd()*H), new cv.Point(rnd()*W, rnd()*H),
      new cv.Scalar(rnd()*255), rnd() < 0.5 ? -1 : 2);
  }
  const b = new cv.Mat();
  const M = cv.matFromArray(2, 3, cv.CV_64F, [1, 0, dx, 0, 1, dy]);
  cv.warpAffine(a, b, M, new cv.Size(W, H));

  const orb = new cv.ORB(1000);
  const k1 = new cv.KeyPointVector(), k2 = new cv.KeyPointVector();
  const d1 = new cv.Mat(), d2 = new cv.Mat(), none = new cv.Mat();
  orb.detectAndCompute(a, none, k1, d1);
  orb.detectAndCompute(b, none, k2, d2);
  console.log("ORB keypoints:", k1.size(), k2.size());

  const bf = new cv.BFMatcher(cv.NORM_HAMMING, false);
  const knn = new cv.DMatchVectorVector();
  bf.knnMatch(d1, d2, knn, 2);
  const p1 = [], p2 = [];
  for (let i = 0; i < knn.size(); i++) {
    const pr = knn.get(i);
    if (pr.size() < 2) continue;
    const m = pr.get(0), n = pr.get(1);
    if (m.distance < 0.75 * n.distance) {
      const q = k1.get(m.queryIdx).pt, t = k2.get(m.trainIdx).pt;
      p1.push(q.x, q.y); p2.push(t.x, t.y);
    }
  }
  console.log("Buenos matches:", p1.length / 2);
  const m1 = cv.matFromArray(p1.length / 2, 2, cv.CV_32F, p1);
  const m2 = cv.matFromArray(p2.length / 2, 2, cv.CV_32F, p2);
  const mask = new cv.Mat();
  const Hm = cv.findHomography(m1, m2, cv.RANSAC, 5.0, mask);
  if (Hm.empty()) { console.log("RESULTADO: findHomography devolvió matriz vacía"); process.exit(1); }
  const h = Array.from(Hm.data64F).map(v => v.toFixed(2));
  console.log("H =", h.join(" "));
  const ok = Math.abs(Hm.data64F[2] - dx) < 1.5 && Math.abs(Hm.data64F[5] - dy) < 1.5;
  console.log(ok ? "RESULTADO: pipeline OK (traslación recuperada)" : "RESULTADO: homografía incorrecta");
  process.exit(ok ? 0 : 1);
}

global.Module = {
  onRuntimeInitialized() { report(global.cv || cvMod); }
};
let cvMod = require(path.resolve(cvPath));
// Algunas compilaciones exportan una promesa / factory en lugar del objeto final
if (cvMod && typeof cvMod.then === "function") {
  cvMod.then(cv => report(cv));
} else if (cvMod && cvMod.ORB) {
  report(cvMod);
} else if (cvMod && typeof cvMod.onRuntimeInitialized !== "undefined") {
  cvMod.onRuntimeInitialized = () => report(cvMod);
}
setTimeout(() => { console.error("TIMEOUT: OpenCV.js no inicializó en 120 s"); process.exit(3); }, 120000);
