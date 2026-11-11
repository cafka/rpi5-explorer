# Diseño — RPi5 Visual Explorer

## Versión 1.1 · 11 de noviembre de 2026

Diseño técnico para el alcance T1–T5. Los componentes marcados como
«hipótesis» no están confirmados; se validan en T1 y T2 respectivamente.

La plataforma propuesta es PWA (web). Si se decide nativa, esta arquitectura
cambia: getUserMedia se reemplaza por la API de cámara del SDK, y OpenCV.js
por la biblioteca nativa equivalente. Ver razonamiento en steering/proyecto-contexto.md.

---

## 1. Arquitectura propuesta (PWA, hipótesis de plataforma)

```
Teléfono (navegador móvil) / Computadora (mismo navegador)
│
├── index.html          — shell de la app, carga scripts
├── camera.js           — getUserMedia, loop de fotogramas, congelado
├── localizer.js        — homografía, proyección de zonas (OpenCV.js — hipótesis)
├── overlay.js          — dibujo de etiquetas sobre canvas
├── cards.js            — fichas de componentes, lógica táctil
└── data/
    ├── zones.json      — coordenadas de las 4 zonas en la referencia
    └── cards.json      — fichas: id, nombre, explicación, fuente, fecha
```

Acceso: origen seguro (HTTPS o localhost). Para pruebas desde el teléfono
en red local, se requiere HTTPS; ver opciones en la sección 6. Para pruebas
locales desde la misma computadora, localhost es suficiente sin certificado.

No hay servidor de inferencia en el alcance inicial. Si el rendimiento
local no es suficiente (se determina en T2), se evalúa explícitamente una
alternativa con servidor propio antes de adoptarla.

---

## 2. Flujo principal (cámara en vivo)

El flujo se construye en dos etapas. T1 implementa únicamente la captura
y visualización; T2 incorpora la localización.

**T1 — lo que se implementa (cámara, congelado, permisos):**

```
getUserMedia(cámara trasera)
    │  error → mostrar mensaje orientativo y detener
    │
    └── requestAnimationFrame loop
            │
            ├── capturar fotograma → pintar en <canvas> o <video>
            │
            ├── [congelado] copiar cuadro actual; pausar loop
            └── [reanudar]  descartar cuadro congelado; reiniciar loop
```

`localizer.js` no existe en T1. No se muestran etiquetas ni resultados
simulados. El estado de la pantalla es: video en vivo, o cuadro fijo si
está congelado.

**T2 — lo que se añade (localización, hipótesis):**

```
loop (reanudado desde T1)
    │
    ├── localizer.locate(frame)   ← se incorpora en T2
    │       ├── extraer descriptores ORB del fotograma
    │       ├── emparejar con descriptores de referencia
    │       ├── RANSAC → homografía H (o null si insuficiente)
    │       └── proyectar zonas con H; validar evidencia local
    │
    ├── si H válida: overlay.draw(zonas proyectadas)
    └── si H nula:   overlay.showSearching()
```

«Localización suficiente» requiere: mínimo de coincidencias, distribución
espacial, error de reproyección y relación inliers/outliers. Los umbrales
exactos se fijan en T2 con evidencia del experimento.
ORB, RANSAC y homografía son candidatos; disponibilidad en la compilación
de OpenCV.js a verificar antes de adoptar.

---

## 3. Congelar / reanudar

- Estado: `{live | frozen}`.
- Al congelar: pausar loop, copiar fotograma y etiquetas actuales al canvas
  de presentación. Las etiquetas quedan ligadas a ese cuadro.
- Al reanudar: descartar resultado congelado, resetear localizer, reiniciar
  loop desde cero. No copiar etiquetas del estado frozen al primer cuadro live.

---

## 4. Localización — detalles (hipótesis T2)

**Referencia visual**: fotografía de Raspberry Pi 5 vista superior, alta
resolución, con cuatro regiones anotadas como polígonos convexos en
`zones.json`. Origen: foto propia o imagen oficial con licencia compatible.

**Descriptores candidatos**: ORB es libre de patentes y es el primer candidato.
SIFT: la patente expiró en 2020 según la documentación de OpenCV
(docs.opencv.org/4.10.0/da/df5/tutorial_py_sift_intro.html); sin embargo,
su disponibilidad depende de la compilación concreta de OpenCV.js que se use,
no de la patente en sí. AKAZE es otra alternativa libre. Se debe comprobar
qué funciones expone la compilación elegida antes de decidir; no prohibir ni
asumir disponibilidad sin verificar.

**Homografía**: estimada con cv.findHomography + RANSAC. Umbral de
reproyección y conteo mínimo de inliers por determinar en experimento.

**Validación por zona**: tras proyectar, comprobar evidencia local en la
región proyectada. Si la zona está fuera del encuadre o tapada, retirar su
etiqueta. Gradientes y contraste son señales candidatas, no prueba suficiente
de identidad: evaluar con oclusiones reales (mano sobre el conector) antes
de adoptarlos como criterio definitivo.

**Paralaje**: USB y Ethernet sobresalen del PCB. Con inclinación moderada
pueden desplazarse respecto de la homografía plana. Se registra el error
observado en T2; no se promete corrección sin evidencia.

---

## 5. Fichas de componentes

Archivo `data/cards.json`. Estructura de cada entrada:

```json
{
  "id": "usb_c_power",
  "name": "Alimentación USB-C",
  "summary": "...",
  "source_title": "Raspberry Pi 5 — Product Brief",
  "source_url": "https://datasheets.raspberrypi.com/rpi5/raspberry-pi-5-product-brief.pdf",
  "source_section": "Power",
  "consulted": "2026-11-11"
}
```

No se afirma tensión, resistencia ni estado eléctrico. Las cuatro fichas
se redactan en T4 con respaldo en documentación oficial verificada.

---

## 6. Acceso desde el teléfono — opciones para T1 (PWA)

Esta sección aplica si se confirma la plataforma web/PWA. Para app nativa,
el acceso a cámara no requiere HTTPS: se gestiona con permisos del SO.

getUserMedia requiere origen seguro en el navegador móvil. Las opciones
gratuitas verificadas (límites a confirmar antes de usar):

| Opción                   | Coste | Instalación requerida           | Alcance          |
|--------------------------|-------|---------------------------------|------------------|
| mkcert + servidor Node   | Gratis| mkcert + certificado en teléfono| Red local        |
| Cloudflare Tunnel (free) | Gratis| cloudflared CLI                 | Cualquier red    |
| GitHub Pages             | Gratis| push a rama gh-pages            | Solo estáticos   |

**Recomendación para T1**: mkcert + servidor Node si el teléfono y la
computadora están en la misma red Wi-Fi. El teléfono necesita confiar en
la CA de mkcert (un paso manual descrito en github.com/FiloSottile/mkcert
#mobile-devices). Si instalar el certificado en el teléfono es un obstáculo,
Cloudflare Tunnel evita ese paso a costa de dependencia de un servicio externo.

Los límites vigentes de Cloudflare Tunnel gratuito deben verificarse en
developers.cloudflare.com antes de adoptarlo. No afirmar «sin límites».

---

## 7. Lo que este diseño NO cubre (fuera de T0–T5)

- Explicaciones por edad (idea posterior, §9 del plan).
- Animaciones interactivas (idea posterior).
- Identificación pin por pin del GPIO.
- Otras placas.
- LLM o agentes dentro de la app.
- Digitalización del multímetro (propuesta reemplazada).
