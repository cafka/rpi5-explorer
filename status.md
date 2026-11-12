# Registro de estado — RPi5 Visual Explorer

**Fecha**: 11 de noviembre de 2026
**Versión del plan**: 1.1
**Bloque actual**: T2 corregido tras fallar en teléfono — verificado en escritorio/simulado; teléfono pendiente; falta referencia real
**Último cambio**: T2 fix — OpenCV.js local, publicación verificada, evidencia de zona, métricas medidas
**Nota**: este registro no se sincroniza automáticamente con Drive.

---

## Archivos del proyecto

| Archivo / Carpeta                                        | Estado                        |
|----------------------------------------------------------|-------------------------------|
| `task1_probe.py`                                         | Existente — alcance reemplazado, conservado |
| `Kiro_Correccion_T0_v1_1.md`                             | Instrucciones y contexto v1.1 incorporados en T0 |
| `status.md` (este archivo)                               | Creado en T0, actualizado en T1 |
| `serve.js`                                               | Creado en T1 — servidor local para desarrollo |
| `.gitignore` / `.gitattributes`                          | Creados en T1 |
| `app/index.html`                                         | Creado en T1 — shell PWA |
| `app/camera.js`                                          | Creado en T1 — cámara, congelado, reanudación |
| `app/manifest.json`                                      | Creado en T1 — manifest PWA |
| `tests/t1_camera_logic.test.mjs`                         | Creado en T1 — pruebas de lógica de estado (escritorio) |
| `tests/t1_ui_visibility.test.mjs`                        | Creado en T1 fix — pruebas de visibilidad sobre HTML y JS reales |
| `.kiro/steering/proyecto-contexto.md`                    | Creado en T0, corregido a v1.1 |
| `.kiro/specs/rpi5-visual-explorer/requirements.md`       | Creado en T0, corregido a v1.1 |
| `.kiro/specs/rpi5-visual-explorer/design.md`             | Creado en T0, corregido a v1.1 |
| `.kiro/specs/rpi5-visual-explorer/tasks.md`              | Creado en T0, corregido a v1.1 |
| `01_Reglas...v1.0.md` *(retirado)*                       | Borrado en T0; versión v1.1 en `Kiro_Correccion_T0_v1_1.md` |
| `02_Planificación...v1.0.md` *(retirado)*                | Borrado en T0; versión v1.1 en `Kiro_Correccion_T0_v1_1.md` |
| `app/localizer.js`                                       | Creado en T2 — ORB+RANSAC+homografía, OpenCV.js         |
| `app/overlay.js`                                         | Creado en T2 — dibujo de etiquetas y polígonos          |
| `app/app.js`                                             | Creado en T2 — coordinador cámara+localizer+overlay     |
| `app/data/zones.json`                                    | Creado en T2 — zona GPIO anotada                        |
| `app/data/reference/rpi5_ref.png`                        | Creado en T2 — imagen de referencia sintética           |
| `tools/make_reference.py`                                | Creado en T2 — generador de referencia                  |
| `tests/t2_localizer_logic.test.mjs`                      | Creado en T2 — 34 pruebas estáticas                     |
| `tests/t2_localizer_runtime.test.mjs`                    | T2 fix — ejecuta localizer.js real con OpenCV.js (12)   |
| `tests/t2_page_wiring.test.mjs`                          | T2 fix — cableado real de index.html (9)                |
| `tests/fixtures/rpi5_ref_800x600.rgba`                   | T2 fix — referencia en píxeles crudos para Node         |
| `app/vendor/opencv-4.9.0.js` + `README.md`               | T2 fix — OpenCV.js alojado, SHA-256, licencia           |
| `tools/probe_opencv.cjs`                                 | T2 fix — verifica funciones de una compilación OpenCV.js |
| `tools/browser_smoke.mjs`, `tools/make_y4m.py`           | T2 fix — prueba en Chrome con cámara simulada           |
| `tools/export_rgba.py`                                   | T2 fix — imagen → RGBA para pruebas                     |
| `tools/deploy_gh_pages.ps1`                              | T2 fix — publicación verificada de gh-pages             |
| `data/`                                                  | No existe — se crea en T2/T4  |

---

## T1 — Verificación en teléfono (11/11/2026)

**Verificado por Claudia**: ciclo completo funciona — cámara en vivo, congelar, volver a cámara.
**Pendiente**: prueba de permiso denegado y recuperación. No bloquea T2.

---

## T2 — Localización GPIO con OpenCV.js (11/11/2026)

### Plataforma y acceso
PWA. URL: https://cafka.github.io/rpi5-explorer/

### Zona elegida
GPIO 40-pin header. Justificación: componente más grande de la placa, muy reconocible visualmente (2×20 pines dorados en franja rectangular), textura rica en keypoints ORB, sin cuerpo elevado significativo (menor paralaje que USB o Ethernet).

### Referencia visual
Imagen sintética generada por `tools/make_reference.py` con proporciones aproximadas a Raspberry Pi 5 real (85×56 mm, escala 8 px/mm). Es **material de ajuste**, no del conjunto de evaluación independiente. Para la prueba de viabilidad real se necesita foto de la placa de Claudia.

Fuente de proporciones: Raspberry Pi 5 Product Brief — raspberrypi.com/products/raspberry-pi-5/ (consultado 11/11/2026).

### Primera prueba en teléfono (11/11/2026) — FALLÓ
Claudia: «No aparece ningún polígono». Causas encontradas (no era la calidad del reconocimiento):
1. gh-pages servía el `index.html` y `camera.js` de T1: los archivos de T2 nunca se cargaron. La publicación no se verificó sobre lo publicado.
2. El `index.html` de main había perdido `<script src="camera.js">`.
3. OpenCV.js se pedía a `docs.opencv.org/4.10.0/opencv.js`, que da **404**.
4. El objeto `cv` de OpenCV.js 4.9.0 tiene `.then`; pasarlo a `resolve()` dejaba la espera colgada para siempre.
5. `let mat1/mat2` declarados dentro del `try` y usados en el `finally` → `ReferenceError` en cada fotograma: `locate()` nunca devolvía resultado.
6. La evidencia por varianza del Laplacian aceptaba la zona tapada (verificado: fallaba la prueba de oclusión).
Además: overlay sin el mismo `object-fit` que el video (desalineación), fuga de un `cv.Mat` por fotograma, ante error se mantenía la etiqueta, métrica fps estimada (1000/media) en lugar de medida.

### Correcciones aplicadas
- OpenCV.js **4.9.0 alojado** en `app/vendor/` (SHA-256 en `vendor/README.md`, Apache 2.0). Funciones verificadas ejecutándolas (`tools/probe_opencv.cjs`): ORB, AKAZE, BFMatcher, knnMatch, findHomography+RANSAC, perspectiveTransform, warpPerspective, matchTemplate. **SIFT ausente** en esta compilación.
- Carga robusta con aviso en pantalla (línea DIAGNÓSTICO) si OpenCV o la referencia fallan.
- Evidencia de zona nueva (ambas en el fotograma actual): ≥ 6 inliers RANSAC dentro del polígono GPIO **y** correlación normalizada ≥ 0,45 entre el parche rectificado y el de referencia. Umbrales = hipótesis iniciales.
- Fotograma reducido a ≤ 640 px de ancho para localizar; resultado reescalado.
- Métricas **medidas**: loc/s = locate() completados en la ventana; «proceso p95» = desde que el fotograma quedó dibujado hasta su resultado dibujado. No incluye latencia interna de la cámara.
- Publicación con `tools/deploy_gh_pages.ps1`: copia exacta de `app/` y verificación de blobs idénticos (10/10).

### Técnica implementada
ORB (1500) + BFMatcher NORM_HAMMING + ratio test 0,75 + findHomography RANSAC (5 px, ≥ 10 inliers, ≥ 20 %) + polígono plausible y convexo + evidencia de zona (inliers en zona + NCC).

### Pruebas (11/11/2026)

**AUTOMÁTICAS — escritorio (Node 24.14.0)**: 85/85
- Estáticas T1/T2: 73 (lógica, visibilidad de botones, estructura, cableado real de `index.html`).
- **Ejecución real** de `app/localizer.js` + OpenCV.js 4.9.0: 12/12 — localiza GPIO en la referencia y en 3 transformaciones conocidas (error de esquinas < 12 px); rechaza oclusión negra, oclusión texturada, zona fuera de cuadro, ruido y escena uniforme; 100 llamadas sin excepción.

**SIMULADAS — Chrome sin interfaz con cámara falsa (`tools/browser_smoke.mjs`)**, botones reales:
| Escena | Local | URL pública |
|---|---|---|
| Referencia sintética como cámara | GPIO ETIQUETADA (47 inliers en zona, ncc 0,90); congelar conserva la etiqueta; reanudar OK | igual |
| Sin placa | sin etiqueta en ~100 localizaciones; overlay vacío al congelar | — |
| Rendimiento (sin GPU, escritorio) | 2–5 loc/s, proceso p95 ≈ 360–490 ms | 4,9 loc/s, p95 360 ms |

Las escenas simuladas usan la propia referencia: **no son evaluación independiente** y no dicen nada de la placa real.

**TELÉFONO REAL**: pendiente (ver abajo).

### Revisión independiente (subagente, 2 rondas)
Ronda 2 (tras la corrección): sin defectos que bloqueen la prueba. Hallazgos aplicados: liberar `DMatchVector` por par (posible fuga), loc/s sin subestimar al inicio, métrica rotulada «proceso p95», retirar etiqueta ante error en `onFrame`, recarga al volver desde bfcache.

### Riesgos conocidos
- **Referencia sintética**: casi seguro no coincide con la placa real → se necesita foto de la placa de Claudia (ver «Próxima acción»).
- **Rendimiento**: en escritorio ~230 ms por localización; en el teléfono puede no alcanzar 3 loc/s. El cálculo corre en el hilo principal: el video se ve menos fluido que en T1.

### Segunda prueba en teléfono (12/11/2026, capturas de Claudia) — sin detección
Evidencia (capturas del navegador, URL pública):
- En vivo: localizador activo · 4,8 loc/s · proceso p95 233 ms · video 720x1280 → 640x1138 · kp 1500 · **matches 6 · inliers 0** · GPIO sin evidencia · ref: sintética provisional.
- Congelado (otro encuadre): 5,2 loc/s · p95 212 ms · kp 1500 · matches 2 · inliers 0.
Conclusión: OpenCV.js y el pipeline corren en el teléfono; la referencia sintética no tiene
correspondencias con la placa real (esperado). Rendimiento medido en el teléfono con la
referencia sintética: ≥ 3 loc/s y proceso p95 ≤ 500 ms se cumplen **en esta condición**;
debe repetirse con la referencia real. Congelar/volver siguen funcionando.
Dispositivo: la foto adjunta lleva marca «HONOR Magic6 Lite»; falta confirmar que las capturas
son del mismo teléfono, y registrar sistema operativo y navegador.

### Reemplazo de referencia por foto real — HECHO y PUBLICADO (12/11/2026)
- Archivo recibido: `referencia_original/rbpi5.jfif` (JPEG 2000x1500, **sin EXIF** → no es el
  original de cámara de 108 MP; probable copia exportada/descargada). Excluido de Git.
- Referencia activa: `app/data/reference/rpi5_claudia_ref.jpg`, 1024x768, sin metadatos,
  **SHA-256 eebafe3cdc05c5b54f96179824560944adb81036dfc1d2b3d98d816b828a8be9**.
- Marcado (px del original 2000x1500): GPIO x 828–1835, y 1193–1318 (pines + base);
  contorno de placa con conectores, excluye la marca de agua. Revisado con
  `tests/fixtures/rpi5_claudia_ref.jpg.preview.png`.
- La referencia sintética `rpi5_ref.png` se conserva como antecedente (no activa).

### Hallazgos con la foto real y correcciones acotadas
1. Solo **17 de 1500** puntos de referencia caen en el GPIO; en transformaciones conocidas
   quedaban **0–1 inliers en la zona** aunque la placa se localizaba con 485–1115 inliers.
   Causa: patrón repetitivo de 40 pines → el ratio test descarta sus correspondencias.
   Corrección: la evidencia pasa a ser NCC del parche rectificado **en cada uno de 3 tramos**
   (≥ 0,5) + contraste mínimo; los inliers en zona quedan como diagnóstico.
2. Rendimiento en Chrome sin GPU con 1500 puntos por fotograma: 2,2 loc/s, p95 ≈ 550–590 ms
   (no cumple). Corrección: 800 puntos por fotograma (1500 en la referencia) →
   4,4–4,7 loc/s, p95 ≈ 360–420 ms en las mismas condiciones.
3. Bug de prueba: la oclusión texturada no pintaba nada con coordenadas decimales. Corregido.

### Pruebas tras el cambio (12/11/2026)
- AUTOMÁTICAS (Node): **89/89**. Ejecución real del localizador: referencia y 3 transformaciones
  conocidas → GPIO etiquetado (< 12 px); oclusión negra, texturada y **parcial (1/3)**, fuera
  de cuadro y negativos → sin etiqueta. `locate()` medio en escritorio: 160 ms a 640x480.
- SIMULADAS (Chrome, cámara falsa = la propia foto; **desarrollo, no evaluación**):
  local y URL pública → GPIO ETIQUETADA (ncc 0,97), congelar conserva la etiqueta, reanudar OK;
  escena sin placa → sin etiqueta (≈ 80 localizaciones).
- URL pública verificada: `zones.json` declara `rpi5_claudia_ref.jpg`; el JPEG descargado
  tiene el mismo SHA-256; el DIAGNÓSTICO en el navegador muestra
  `ref: rpi5_claudia_ref.jpg 1024x768 sha256:eebafe3cdc05 · 1500 kp con máscara de placa · foto real`.
- TELÉFONO: pendiente con la nueva referencia.

### Tercera prueba en teléfono (12/11/2026) — sin etiqueta
Dispositivo confirmado: **HONOR Magic6 Lite 5G · MagicOS 9 · Chrome**. Video 720x1280 → 640x1138.
Captura (en vivo, referencia real cargada `sha256:eebafe3cdc05`): 6 loc/s · proceso p95 173 ms ·
kp 800 · **matches 71 · inliers 53** (placa localizada) · GPIO sin evidencia:
**ncc 0,43 · mín. tramo 0,33** (< 0,5) · inl zona 1.
Conclusión: la homografía se acepta; el rechazo viene del criterio de parecido del parche.
Rendimiento en el teléfono con la referencia real: 6 loc/s y p95 173 ms (cumple en esta escena).
Hipótesis principal (no confirmada): **paralaje de los pines** (≈ 8 mm sobre el PCB; la homografía
solo corrige el plano). En la referencia el header está lejos del centro óptico y los pines se ven
inclinados; en vivo se ven casi de frente. Alternativa: desalineación de la proyección.
No se bajó el umbral para que pase (sería ajustar sobre la evaluación).

Acción: modo diagnóstico `?debug=1` publicado (no cambia la decisión): muestra la proyección
rechazada (gris punteada, «DEBUG»), y al congelar los parches de referencia y del cuadro
rectificado con NCC por tramo y una métrica candidata de baja frecuencia (1/4, solo informativa).
Pruebas: 95/95 automáticas; Chrome (simulado) normal sin panel, debug con panel; URL pública verificada.
Pendiente: captura de Claudia en modo diagnóstico para confirmar la causa antes de corregir.

### Cuarta prueba en teléfono (12/11/2026) — sin etiqueta; sin contorno DEBUG
Claudia: varios encuadres, GPIO visible, «GPIO: sin evidencia». No se vio contorno DEBUG ni recortes.
Causas posibles revisadas:
- El modo diagnóstico **estaba publicado**, pero solo se activa con `?debug=1`; además GitHub Pages
  sirve con `max-age=600` y no había marca de versión visible → no se podía comprobar qué corría.
- **Error encontrado**: `scaleResult` no escalaba `polygonDebug` (procesado → canvas, k = 1,125 en el
  teléfono): el contorno DEBUG se habría dibujado ~11 % más chico y corrido. Corregido.

Cambios (versión **t2-diag-2**, visible en la línea DIAGNÓSTICO):
- `app/coords.js`: cadena de coordenadas en un módulo probado (ref —H→ procesado —×k→ canvas
  —cover→ pantalla). La orientación la entrega el navegador; no hay rotación manual.
- Modo diagnóstico: inliers (cian), contorno de placa proyectado (cian, punteado largo), GPIO
  rechazado (gris, punteado corto, rótulo DEBUG). Al congelar: recortes exactos de referencia y
  del cuadro rectificado con divisiones de tramo, ncc por tramo, métrica de baja frecuencia
  (no decide), cadena de coordenadas medida, H y GPIO proyectado.
- Botón «Guardar diagnóstico (archivo local)»: cuadro procesado + resultado + cadena, en Descargas.
- `tools/replay_diag.py`: reproduce ese cuadro en la computadora con el mismo localizador.
- `?v=t2-diag-2` en scripts/imports para no mezclar versiones por caché.
No se cambió ningún umbral ni la regla de decisión.

Verificado:
- 110/110 pruebas automáticas (incluye coordenadas, placa girada 90° en cuadro vertical, datos de diagnóstico).
- Chrome con cámara simulada vertical (placa girada, desenfoque y brillo), local y **URL pública**:
  modo normal sin elementos DEBUG; modo debug con panel; export → reproducción **idéntica**
  (mismos matches, inliers, proyección y ncc por tramo). Contorno de placa y GPIO proyectado
  coinciden con lo visible en el cuadro simulado.
- Observación (no concluyente): en el recorte de referencia los pines se ven como diagonales largas
  (vista oblicua); es compatible con la hipótesis de paralaje, pendiente de confirmar con el teléfono.

Pendiente: diagnóstico guardado desde el teléfono para distinguir desplazamiento / perspectiva /
criterio. Las capturas que se usen para ajustar no servirán como evaluación independiente.

### Quinta prueba en teléfono (12/11/2026) — sin etiqueta; modo diagnóstico NO activo
Capturas con «DIAGNÓSTICO t2-diag-2» (versión correcta) pero sin «MODO DEBUG» → abiertas sin `?debug=1`.
Datos: matches 19–25 · inliers 12–19 · ncc −0,19 / 0,08 / 0,07 (mín. tramo −0,31 / 0,02 / −0,04).
Comparado con la prueba anterior (71 matches, 53 inliers, ncc 0,43): ncc ≈ 0 indica que se compara
otra zona → hipótesis principal ahora: **homografía débil y GPIO desplazado** (no confirmado).

Experimento simulado (`tools/sim_grid_experiment.*`, desarrollo): papel cuadriculado, cuadro
640x1138, placa girada 90°, 50–95 % del ancho, 800 y 1500 puntos → 296–583 matches, GPIO a 1–3 px,
aceptado en 16/16 casos. **Descarta** que la cuadrícula o la orientación expliquen el fallo.
(Una primera corrida dio rechazos por un defecto de la simulación —máscara por brillo que
transparentaba el header negro—; corregido y repetido.)
Conclusión provisional: el código funciona cuando la imagen se parece a la referencia; en el
teléfono las coincidencias reales son ~15 veces menos. La causa (iluminación, calidad de vista
previa, ángulo, reflejos) requiere un cuadro real del teléfono.

Cambios t2-diag-3: tocar la línea DIAGNÓSTICO activa/desactiva el modo (sin escribir la URL);
el reproductor compara 800/1500/2500 puntos sobre el mismo cuadro real. Sin cambios de umbral
ni de la regla de decisión. Verificado en URL pública (Chrome simulado): toque → `?debug=1` y
«MODO DEBUG»; congelar → panel con recortes; export → reproducción idéntica. 111/111 pruebas.

Pendiente: archivo de diagnóstico guardado desde el teléfono.

### Sexta prueba en teléfono (12/11/2026) — modo diagnóstico ACTIVO, placa no localizada
Capturas con «MODO DEBUG · t2-diag-3» (placa dentro de su caja, otra luz y orientación):
matches 12 / inliers 6 y matches 6 / inliers 0 → **homografía rechazada** (mínimo 10 inliers).
El cuadro congelado no contenía la placa (madera desenfocada): no hay diagnóstico guardado útil.
Conclusión: el cuello de botella es la **localización de la placa** con la referencia única en
condiciones distintas (luz, cámara en vivo vs foto, ángulo), no el criterio de parecido del GPIO.
Corrección de presentación: el contorno de una homografía rechazada se dibujaba en cian como si
fuera válido (línea diagonal en la captura 1); ahora es rojo y rotulado «RECHAZADA».
t2-diag-4: el reproductor compara sobre el mismo cuadro ORB 800/1500/2500, ratio 0,8/0,85 y AKAZE
(verificado sobre un cuadro simulado). 112/112 pruebas. URL pública verificada (Chrome simulado):
debug positivo etiqueta; negativo sin etiqueta; modo normal sin elementos de diagnóstico.
Pendiente: diagnóstico guardado desde el teléfono con la placa en el cuadro congelado.

### Verificación en teléfono — PENDIENTE (T2 no aceptado)
Criterios: etiqueta correcta en ≥ 2 de 3 encuadres distintos · retirada ≤ 0,5 s al tapar o sacar de cuadro · sin etiqueta en ≥ 1 escena sin placa · ≥ 3 loc/s medidas · proceso p95 ≤ 500 ms · registrar modelo, SO, navegador, resolución (la línea DIAGNÓSTICO muestra «video WxH»).

---

## T1 — Cámara en vivo, congelado y reanudación (detalle)
PWA (Progressive Web App). Decisión justificada en steering/proyecto-contexto.md.
Repositorio: https://github.com/cafka/rpi5-explorer
URL de acceso: **https://cafka.github.io/rpi5-explorer/**

### Archivos creados
- `app/index.html`, `app/camera.js`, `app/manifest.json`
- `serve.js` (servidor local para desarrollo)
- `tests/t1_camera_logic.test.mjs`
- `.gitignore`, `.gitattributes`

### Pruebas ejecutadas

**Categoría: ESCRITORIO / SIMULADO (sin cámara real)**

| Prueba                                              | Resultado |
|-----------------------------------------------------|-----------|
| freeze() en live → estado frozen                    | ✓         |
| freeze() cancela el loop (rafActive=false)          | ✓         |
| freeze() guarda frozenFrame no nulo                 | ✓         |
| freeze() en frozen → no hace nada                   | ✓         |
| freeze() en idle → no hace nada                     | ✓         |
| resume() en frozen → estado live                    | ✓         |
| resume() descarta frozenFrame (null)                | ✓         |
| resume() reactiva el loop                           | ✓         |
| resume() en live → no hace nada                     | ✓         |
| setError() cancela el loop                          | ✓         |
| getFrozenFrame() en live devuelve null              | ✓         |
| frozenFrame conserva datos entre llamadas           | ✓         |
| Mensajes de error: NotAllowedError, NotFoundError…  | ✓ (5 casos)|
| Sintaxis camera.js (node --check)                   | ✓         |
| Sintaxis serve.js (node --check)                    | ✓         |
| **Subtotal lógica**                                 | **17/17** |
| #btn-resume sin display:none en CSS                 | ✓         |
| #btn-resume con style="display:none" inline en HTML | ✓         |
| #btn-freeze sin display:none inline en HTML         | ✓         |
| setFrozenUI existe en camera.js                     | ✓         |
| setFrozenUI asigna display explícito a btnResume    | ✓         |
| setFrozenUI oculta btnFreeze                        | ✓         |
| setLiveUI oculta btnResume con display:none         | ✓         |
| setLiveUI no oculta btnFreeze                       | ✓         |
| Ciclo freeze/resume: visibilidad inicial            | ✓         |
| Ciclo freeze/resume: tras congelar                  | ✓         |
| Ciclo freeze/resume: tras reanudar                  | ✓         |
| Ciclo freeze/resume: múltiple (3 ciclos)            | ✓         |
| Ciclo freeze/resume: error oculta Volver            | ✓         |
| **Subtotal visibilidad**                            | **13/13** |
| **TOTAL**                                           | **30/30** |

**Categoría: TELÉFONO REAL — PENDIENTE**
No verificado. No reemplazado por las pruebas de escritorio.

### No verificado (requiere teléfono real)
- Video de cámara trasera visible en el teléfono.
- getUserMedia concede permiso y abre la cámara.
- «Congelar imagen» detiene el video en el teléfono.
- «Volver a cámara» reanuda correctamente.
- Mensaje de error al denegar permiso.
- Acceso desde la URL https://cafka.github.io/rpi5-explorer/ en el teléfono.

### Pasos para verificar en teléfono real
1. Esperar a que GitHub Pages termine de construir (estado actual: «building»).
   Verificar en: https://github.com/cafka/rpi5-explorer/actions
   O comprobar: https://cafka.github.io/rpi5-explorer/ hasta que cargue.
2. Abrir esa URL en el navegador del teléfono (Chrome/Safari).
3. Aceptar el permiso de cámara cuando el navegador lo pida.
4. Verificar que el video de la cámara trasera se ve en pantalla.
5. Pulsar «Congelar imagen» — el video debe detenerse.
6. Pulsar «Volver a cámara» — el video debe reanudarse.
7. Denegar el permiso de cámara y verificar que aparece un mensaje claro.
8. Registrar: modelo del teléfono, SO, navegador y versión.

### Acceso desde computadora
La misma URL funciona en cualquier navegador de escritorio que tenga cámara.
Sin cámara, se mostrará el error «No se encontró cámara» — comportamiento correcto.
Para desarrollo local sin teléfono: `node serve.js` → abrir http://localhost:3000

---

## Verificaciones acumuladas

| Verificación                                    | Resultado                                                      |
|-------------------------------------------------|----------------------------------------------------------------|
| Estructura del repositorio                      | 3 archivos en raíz, sin Git, sin .kiro previo                  |
| task1_probe.py — sintaxis                       | ✓ Válida (ast.parse con Python 3.14.3)                         |
| task1_probe.py — archivos JSON de resultados    | No encontrados en el directorio. No prueba que nunca se ejecutó |
| task1_probe.py — integración con Together AI    | No verificada; fuera del alcance actual                         |
| Python 3.14.3                                   | ✓ Disponible                                                   |
| requests 2.33.1                                 | ✓ Disponible                                                   |
| numpy 2.5.1                                     | ✓ Disponible                                                   |
| Pillow 12.3.0                                   | ✓ Disponible                                                   |
| Node.js 24.14.0                                 | ✓ Disponible                                                   |
| npm 11.9.0                                      | ✓ Disponible                                                   |
| opencv-python                                   | No instalado — no es dependencia del diseño propuesto           |
| OpenCV.js (funciones ORB/AKAZE/RANSAC)          | No verificado — requiere comprobar compilación específica       |
| Git inicializado                                | ✓ Inicializado en T1; repositorio en github.com/cafka/rpi5-explorer |
| Node.js — pruebas T1 (17/17)                    | ✓ Pasan (escritorio, sin cámara real)                          |
| GitHub Pages — URL de acceso                    | https://cafka.github.io/rpi5-explorer/ (estado: building al crear) |
| Verificación en teléfono real                   | ⬜ PENDIENTE — ver pasos en sección T1                         |

---

## No verificado — requiere teléfono real u otro entorno

- Modelo y sistema operativo del teléfono de Claudia.
- Acceso a cámara trasera desde navegador móvil (getUserMedia).
- HTTPS local accesible desde el teléfono (aplica si se confirma PWA).
- Funciones de OpenCV.js 4.9.0: verificadas en escritorio (Node); en el navegador del teléfono, pendiente.
- Rendimiento de localización en el teléfono real.
- Localización sobre la placa real (requiere referencia real).
- Condiciones vigentes de Cloudflare Tunnel gratuito (si se elige esa vía).

---

## Propuestas reemplazadas (antecedentes, no implementar)

- Digitalizar lecturas del multímetro → reemplazado por exploración visual.
- Reconocimiento genérico con LLM/RAG → reemplazado por homografía local.
- Adquisición con ESP32 → no forma parte de este proyecto.

task1_probe.py pertenece al alcance reemplazado. Se conserva sin modificar.

---

## Fallos abiertos

- T1: prueba de permiso denegado y recuperación pendiente. No bloquea T2.
- T2: primera prueba en teléfono FALLÓ (causas de infraestructura, corregidas). Nueva prueba en teléfono pendiente.
- T2: referencia real activa; falta evaluación en teléfono con encuadres nuevos.
- T2: rendimiento móvil con la referencia real sin medir (con la sintética: 4,8–5,2 loc/s, p95 212–233 ms).
- T2: umbrales de evidencia (NCC ≥ 0,5 por tramo) son hipótesis; pueden rechazar el GPIO en
  ángulos fuertes o con reflejos, o aceptar objetos muy parecidos. Se ajustan con evidencia del teléfono.
- `new cv.ORB()`: confirmado que funciona en 4.9.0 (escritorio); pendiente en el navegador del teléfono.
- Wikimedia (foto CC BY 2.0 de SparkFun) devolvió HTTP 429; no se insistió.
- Pendiente (hallazgo 5 T0): definir qué funciones estarán disponibles desde computadora. Retomar en T4–T5.

---

## Próxima acción

1. ✓ Foto recibida, referencia generada, probada y publicada (sha256 eebafe3cdc05…).
2. **Claudia**: evaluar T2 en el teléfono con encuadres NUEVOS (distintos de la foto de referencia).
3. Claudia: medir T2 en el teléfono con la línea DIAGNÓSTICO.
4. Si no alcanza 3 loc/s: corrección acotada (menos features ORB / menor resolución / Web Worker) y reevaluar.
T3 solo con T2 aceptado e indicación expresa.
