# Dependencias alojadas en el proyecto

## opencv-4.9.0.js

- Origen: https://docs.opencv.org/4.9.0/opencv.js (descargado el 11/11/2026)
- SHA-256: 4D7B85E2E12EA0BD088F491C311D620A45B53D1489B7F065B4492A230BDA243A
- Licencia: Apache License 2.0 (OpenCV 4.5.0 y posteriores) — https://opencv.org/license/
- Motivo de alojarlo aquí: la URL usada antes (docs.opencv.org/4.10.0/opencv.js)
  devolvía 404. Alojarlo fija la versión y evita depender de un tercero en tiempo de uso.

Funciones verificadas con `node tools/probe_opencv.cjs app/vendor/opencv-4.9.0.js`
(escritorio, Node 24.14.0): ORB, AKAZE, BFMatcher, knnMatch, findHomography(RANSAC),
perspectiveTransform, matFromArray, Laplacian, meanStdDev. SIFT: ausente.
Esa verificación prueba la API con datos sintéticos; no prueba rendimiento en teléfono
ni calidad de reconocimiento sobre una placa real.
