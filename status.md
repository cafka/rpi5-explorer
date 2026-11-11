# Registro de estado — RPi5 Visual Explorer

**Fecha**: 11 de noviembre de 2026
**Versión del plan**: 1.1
**Bloque actual**: T1 (siguiente a ejecutar — requiere indicación expresa)
**Último cambio**: T0 cerrado con correcciones v1.1
**Nota**: este registro no se sincroniza automáticamente con Drive.

---

## Archivos del proyecto

| Archivo / Carpeta                                        | Estado                        |
|----------------------------------------------------------|-------------------------------|
| `task1_probe.py`                                         | Existente — alcance reemplazado, conservado |
| `Kiro_Correccion_T0_v1_1.md`                             | Instrucciones y contexto v1.1 incorporados en T0 |
| `status.md` (este archivo)                               | Creado en T0, corregido a v1.1 |
| `.kiro/steering/proyecto-contexto.md`                    | Creado en T0, corregido a v1.1 |
| `.kiro/specs/rpi5-visual-explorer/requirements.md`       | Creado en T0, corregido a v1.1 |
| `.kiro/specs/rpi5-visual-explorer/design.md`             | Creado en T0, corregido a v1.1 |
| `.kiro/specs/rpi5-visual-explorer/tasks.md`              | Creado en T0, corregido a v1.1 |
| `01_Reglas...v1.0.md` *(retirado)*                       | Borrado en T0; versión v1.1 en `Kiro_Correccion_T0_v1_1.md` |
| `02_Planificación...v1.0.md` *(retirado)*                | Borrado en T0; versión v1.1 en `Kiro_Correccion_T0_v1_1.md` |
| `app/` (toda la carpeta)                                 | No existe — se crea en T1     |
| `data/` (toda la carpeta)                                | No existe — se crea en T2/T4  |

---

## Verificaciones ejecutadas en T0 (11/11/2026)

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
| Git inicializado                                | No es repositorio Git todavía                                  |

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

- Ninguno estructural en T0.
- Correcciones de evidencia y plataforma aplicadas en v1.1 (ver sección correcciones en tasks.md).
- Pendiente: confirmar plataforma (propuesta PWA justificada en steering/proyecto-contexto.md).
- Pendiente: obtener modelo y SO del teléfono de Claudia antes de probar T1.
- Pendiente: obtener o tomar una foto de referencia de la Raspberry Pi 5
  propia de Claudia (necesaria para T2; no para T1).
- Pendiente: inicializar Git si se desea control de versiones del código.
- Pendiente: documentar acceso seguro elegido y sus límites antes de T1.
- Pendiente (hallazgo 5): definir qué funciones estarán disponibles desde
  computadora. No bloquea T1; retomar al preparar T4–T5.

---

## Próxima acción

**T1 — Cámara en vivo, congelado y reanudación**

Requiere indicación expresa para ejecutar. Antes de implementar:

1. Confirmar plataforma: PWA es la propuesta; si hay objeción, discutirla.
2. Registrar modelo y SO del teléfono (no es bloqueante para escribir el
   código, sí para verificarlo).
3. Elegir acceso seguro para prueba en teléfono:
   - mkcert + Node: mismo Wi-Fi, instalar certificado raíz en el teléfono.
   - Cloudflare Tunnel: cualquier red, sin instalar certificado en el teléfono.
   - GitHub Pages: solo si no hay servidor dinámico en T1.
   Kiro puede implementar cualquiera de las dos primeras opciones y documentar
   los pasos; no es necesario que Claudia elija herramientas sin recomendación.

Criterio de aceptación de T1: ver el video de la cámara trasera en el
teléfono real y poder congelar/reanudar. Sin localización ni etiquetas.
