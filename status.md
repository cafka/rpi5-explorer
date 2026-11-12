# Registro de estado — RPi5 Visual Explorer

**Fecha**: 11 de noviembre de 2026
**Versión del plan**: 1.1
**Bloque actual**: T2 implementado — verificación en teléfono real pendiente
**Último cambio**: T2 — localización GPIO ORB+RANSAC; revisión independiente aplicada
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
| `tests/t2_localizer_logic.test.mjs`                      | Creado en T2 — 34 pruebas de escritorio                 |
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

### Técnica implementada
ORB (1500 features) + BFMatcher (NORM_HAMMING) + ratio test Lowe (0.75) + findHomography RANSAC (umbral 5px, mínimo 10 inliers, ratio 20%). Validación local de visibilidad por varianza del Laplacian (proxy de textura/nitidez). Polígono proyectado con perspectiveTransform.

### Pruebas de escritorio (sin cámara, sin OpenCV real)

| Suite | Pruebas | Resultado |
|---|---|---|
| isPolygonPlausible | 7 | ✓ |
| Centroide | 2 | ✓ |
| zones.json estructura | 8 | ✓ |
| Imagen de referencia | 2 | ✓ |
| API de localizer.js | 9 | ✓ |
| Hooks en camera.js | 6 | ✓ |
| **Total T2** | **34/34** | ✓ |
| Total acumulado (T1+T2) | 64/64 | ✓ |

### Revisión independiente (subagente)
Ejecutada. Sin problemas que bloqueen T2. Dos correcciones de gestión de memoria aplicadas (mat1/mat2 y mean/std en bloques finally). Riesgo a verificar: `new cv.ORB(n)` vs `cv.ORB_create(n)` según compilación — se confirma en teléfono.

### Verificación en teléfono — PENDIENTE

T2 no está aceptado hasta completar estas mediciones en el teléfono real:

**Pasos:**
1. Abrir `https://cafka.github.io/rpi5-explorer/`
2. Apuntar la cámara a la Raspberry Pi 5. Esperar ~2-3 segundos para que OpenCV.js cargue (progreso en consola del navegador).
3. Verificar que aparece la etiqueta «GPIO 40-pin header» sobre el header cuando es visible.
4. Tapar el header con la mano → etiqueta debe desaparecer en ≤ 0,5 s.
5. Apuntar a una escena sin la placa → ninguna etiqueta.
6. Congelar con placa visible → etiqueta debe corresponder al cuadro congelado.
7. Reanudar → overlay limpio, relocaliza desde cero.
8. En la consola del navegador: `window.getPerfStats()` → registrar fps y p95Ms.
9. Registrar: modelo del teléfono, SO, versión del navegador, resolución.

**Criterios de aceptación:**
- Etiqueta correcta en ≥ 2 de 3 encuadres distintos.
- Retirada en ≤ 0,5 s al tapar o sacar del encuadre.
- Ninguna etiqueta en al menos 1 escena sin placa.
- ≥ 3 localizaciones/segundo (getPerfStats().fps ≥ 3).
- p95Ms ≤ 500 (getPerfStats().p95Ms ≤ 500).

**Nota sobre la referencia**: la imagen de referencia actual es sintética. Si el localizador no encuentra la placa real de Claudia, es esperable: las texturas y keypoints pueden diferir de la placa real. En ese caso el siguiente paso es tomar una foto de la placa de Claudia y regenerar la referencia con `make_reference.py` adaptado, o anotar directamente sobre esa foto.

---

## Verificaciones acumuladas
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
- Funciones disponibles en la compilación concreta de OpenCV.js.
- Rendimiento de localización en el teléfono real.
- Condiciones vigentes de Cloudflare Tunnel gratuito (si se elige esa vía).

---

## Propuestas reemplazadas (antecedentes, no implementar)

- Digitalizar lecturas del multímetro → reemplazado por exploración visual.
- Reconocimiento genérico con LLM/RAG → reemplazado por homografía local.
- Adquisición con ESP32 → no forma parte de este proyecto.

task1_probe.py pertenece al alcance reemplazado. Se conserva sin modificar.

---

## Fallos abiertos

- T1: prueba de permiso denegado pendiente. No bloquea T2.
- T2: verificación en teléfono real pendiente (ver pasos en sección T2).
- Si la referencia sintética no produce matches con la placa real, necesito foto de la placa de Claudia.
- Hallazgo 4 revisor: compatibilidad `new cv.ORB()` vs `cv.ORB_create()` — confirmar en teléfono.
- Pendiente (hallazgo 5 T0): definir qué funciones estarán disponibles desde computadora. Retomar en T4–T5.

---

## Próxima acción

**Verificar T2 en teléfono** con los pasos descritos en la sección T2.
Si la referencia sintética no produce detección: pedir foto de la placa real de Claudia y regenerar.
Si OpenCV.js falla en el teléfono (hallazgo 4): ajustar `new cv.ORB()` → `cv.ORB_create()`.
Una vez verificados los criterios de T2, iniciar T3 con indicación expresa.
