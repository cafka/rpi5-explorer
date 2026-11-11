# Tareas — RPi5 Visual Explorer

## Versión 1.1 · 11 de noviembre de 2026

Todos los hitos están pendientes al crear este documento.
El calendario es orientativo; T2 es la puerta de viabilidad.

---

## T0 — Revisar lo existente y fijar el nuevo alcance ✓ CERRADO 11/11/2026 (v1.1)

**Resultado observable**: documentación del estado real del repositorio,
contexto activo en .kiro/, estructura de specs creada, registro de estado
actualizado con correcciones v1.1.

**Lo que se comprobó (observación directa)**:
- Estructura del repositorio: 3 archivos en raíz, sin Git, sin .kiro previo.
- task1_probe.py: sintaxis válida (ast.parse); no se encontraron archivos
  JSON de resultados en este directorio. Eso no prueba que nunca se ejecutó;
  es lo observado. La integración con Together AI queda fuera del alcance:
  no se verificaron saldos ni condiciones del proveedor.
- opencv-python no instalado en este equipo. No es una dependencia del
  diseño propuesto; no valida OpenCV.js.
- Python 3.14.3, Node.js 24.14.0, npm 11.9.0: disponibles.
- Creados: .kiro/steering/proyecto-contexto.md, requirements.md, design.md,
  tasks.md, status.md.
- Propuestas reemplazadas identificadas y aisladas como antecedentes.

**Correcciones aplicadas en v1.1**:
- Eliminada afirmación «nunca fue ejecutado» sin evidencia suficiente.
- Eliminada afirmación de saldo mínimo en Together AI sin fuente verificada.
- Separada opencv-python (paquete Python de escritorio) de OpenCV.js.
- Plataforma abierta a web/PWA o nativa; propuesta PWA justificada en steering.
- SIFT/SURF: retirada prohibición genérica; documentado que la patente de
  SIFT expiró en 2020 y que la disponibilidad depende de la compilación.
- Sección de HTTPS reencuadrada: aplica a web/PWA, no es un requisito universal.

**Pendientes no resueltos en T0** (requieren teléfono real u otro entorno):
- Modelo y SO del teléfono de Claudia.
- Acceso a cámara desde navegador móvil.
- HTTPS local desde el teléfono.
- Funciones disponibles en la compilación de OpenCV.js.
- Rendimiento de localización en el teléfono real.

---

## T1 — Cámara en vivo, congelado y reanudación ⬜ PENDIENTE

**Resultado observable**: abrir la app desde el teléfono real, ver el video
de la cámara trasera, congelar y reanudar. Sin localización ni etiquetas.
El uso normal no requiere cable USB.

**Archivos a crear** (asumiendo PWA; ajustar si se elige nativa):
- `app/index.html`
- `app/camera.js`
- `app/overlay.js` (canvas vacío, sin etiquetas)
- Configuración de acceso seguro elegida y documentada con sus límites

**Criterios de aceptación**:
- Cámara trasera abierta y visible en el teléfono real.
- «Congelar» detiene el video; el cuadro queda fijo en pantalla.
- «Volver a cámara» reanuda el video desde cero.
- Sin etiquetas ni resultados simulados.
- El permiso denegado muestra un mensaje claro.
- Verificar en teléfono real; pruebas simuladas se registran como tales.

**Dependencias**:
- Teléfono real con navegador compatible (modelo a registrar al probar).
- Plataforma confirmada (propuesta PWA, pendiente de adoptar formalmente).
- Acceso seguro documentado con sus límites antes de implementar.

**No implementar en T1**:
- Localización ni detección de ningún tipo.
- Etiquetas, aunque sean fijas o simuladas.

---

## T2 — Localización real de una zona en video y en teléfono ⬜ PENDIENTE

**Resultado observable**: una zona (propuesta: GPIO o Ethernet, por tamaño
y contraste) se etiqueta correctamente sobre la cámara en vivo. La etiqueta
desaparece cuando la zona no está visible.

**Archivos a crear/modificar**:
- `app/localizer.js`
- `data/zones.json` (inicialmente con 1 zona)
- Imagen de referencia anotada en `data/reference/`

**Criterios de aceptación** (puerta de viabilidad):
- Etiqueta correcta en ≥ 2 de 3 encuadres distintos con la placa visible.
- Etiqueta retirada en ≤ 0,5 s tras oclusión o salida de cuadro.
- Sin etiqueta en al menos 1 imagen negativa (placa no visible).
- ≥ 3 localizaciones/segundo medidas en el teléfono real.
- Registrar modelo de teléfono, SO, navegador y resolución.

**Si falla la puerta**: identificar causa, bloque acotado de corrección,
re-evaluar con imagen independiente. Si persiste, reconsiderar técnica
antes de ampliar.

**No declarar viable antes de esta tarea.**

---

## T3 — Cuatro zonas con evidencia, pérdida y recuperación ⬜ PENDIENTE

**Bloqueo**: requiere T2 superado.

Ampliar el método validado en T2 a las cuatro zonas: USB-C, USB, Ethernet,
GPIO. Comprobar evidencia por zona de forma independiente. Verificar
pérdida y recuperación de cada zona por separado. Registrar efecto de
cables, reflejos e inclinación.

**Criterios adicionales**:
- Ubicación ≥ 95 % con IoU ≥ 0,5 sobre 10 cuadros anotados por zona.
- Cobertura ≥ 80 % de zonas claramente visibles.
- Cero etiquetas aceptadas en 2 imágenes negativas.

---

## T4 — Fichas técnicas, interacción táctil y detalle congelado ⬜ PENDIENTE

**Bloqueo**: requiere T3 con al menos 3 de 4 zonas funcionando.

- Crear `data/cards.json` con las 4 fichas, fuentes y fechas de consulta.
- Tocar una etiqueta abre la ficha; cerrar la ficha vuelve a la cámara.
- En imagen congelada: ampliar y consultar detalle de la zona.
- Mejorar legibilidad (contraste, tamaño de texto, accesibilidad mínima).

---

## T5 — Validación, corrección y demostración ⬜ PENDIENTE

**Bloqueo**: requiere T4 completo.

- Evaluación con sesiones nuevas no usadas en ajuste (mínimo 2 sesiones
  de captura independientes con la placa real de Claudia).
- Registrar resultados por zona y por sesión (numerador/denominador).
- Corregir fallos dentro del alcance; documentar límites observados.
- Preparar demostración basada en comportamiento observado, no simulado.
- Documentar entorno reproducible (modelo de teléfono, SO, navegador).
