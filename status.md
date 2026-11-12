# Registro de estado — RPi5 Visual Explorer

**Fecha**: 11 de noviembre de 2026
**Versión del plan**: 1.1
**Bloque actual**: T1 implementado — corrección de visibilidad publicada — verificación en teléfono pendiente
**Último cambio**: T1 fix — btn-resume visible al congelar
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
| `app/localizer.js`                                       | No existe — se crea en T2     |
| `data/`                                                  | No existe — se crea en T2/T4  |

---

## T1 — Cámara en vivo, congelado y reanudación (11/11/2026)

### Plataforma adoptada
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

- Verificación en teléfono real pendiente (ver pasos en sección T1).
- Modelo y SO del teléfono de Claudia: no registrados todavía.
- Pendiente: obtener o tomar una foto de referencia de la Raspberry Pi 5
  propia de Claudia (necesaria para T2; no para T1).
- Pendiente (hallazgo 5): definir qué funciones estarán disponibles desde
  computadora. No bloquea T1; retomar al preparar T4–T5.

---

## Próxima acción

**T2 — Localización real de una zona** (requiere indicación expresa)

Bloqueo hasta que se verifique T1 en teléfono real. Una vez verificado:
- Preparar imagen de referencia de la Raspberry Pi 5 de Claudia.
- Comprobar qué funciones expone la compilación de OpenCV.js disponible.
- Iniciar el experimento de localización de una zona (ver tasks.md T2).
