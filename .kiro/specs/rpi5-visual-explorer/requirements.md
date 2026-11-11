# Requisitos — RPi5 Visual Explorer

## Versión 1.1 · 11 de noviembre de 2026

Este documento describe los requisitos del alcance vigente.
Reemplaza las propuestas de multímetro y reconocimiento genérico con LLM.

---

## R1 — Cámara en vivo

- La app abre la cámara trasera del teléfono sin obligar al usuario a tomar
  una foto ni pulsar «Analizar».
- El video se muestra en pantalla de forma continua.
- El uso normal no requiere conectar el teléfono por cable USB a una computadora.
- Si la plataforma es web/PWA: getUserMedia requiere origen seguro (HTTPS o
  localhost). La forma de proveerlo se define antes de T1.
- Si la plataforma es nativa: el acceso a cámara se gestiona con permisos del SO.
- Al denegar el permiso, se muestra un mensaje orientativo claro.

## R2 — Localización de zonas

- La app detecta la presencia de una Raspberry Pi 5 en el encuadre y estima
  la posición de hasta cuatro zonas: alimentación USB-C, puertos USB,
  Ethernet y bloque GPIO.
- Las etiquetas se dibujan superpuestas al video sobre las zonas detectadas.
- Cuando no hay evidencia suficiente, se muestra «Buscando placa» en lugar
  de una etiqueta desactualizada.
- Cuando una zona está tapada u ocluida, su etiqueta se retira; no se
  congela en la última posición conocida.

## R3 — Congelar / reanudar

- Un botón «Congelar imagen» detiene el video en un cuadro.
- Las etiquetas mostradas corresponden exactamente a ese cuadro.
- «Volver a cámara» descarta los resultados congelados y relocaliza desde cero.
- Congelar no guarda la imagen ni la sube a ningún servidor.

## R4 — Fichas de componentes

- Al tocar una etiqueta aparece una ficha con: nombre del componente,
  explicación breve y enlace a documentación oficial.
- Cuatro fichas requeridas: USB-C power, USB ports, Ethernet, GPIO header.
- Cada afirmación técnica tiene respaldo en una sección concreta de
  documentación oficial con fecha de consulta.
- La ficha no afirma tensión, continuidad ni estado eléctrico.

## R5 — Rendimiento y privacidad

- Objetivo exploratorio: ≥ 3 localizaciones/segundo, antigüedad p95 ≤ 500 ms.
- El video no se envía a ningún servidor externo en el alcance inicial.
- Si se evalúa procesamiento en servidor propio, debe declararse explícitamente
  antes de implementarlo.
- No se requiere API key ni facturación para T1–T5.

## Fuera de alcance (T0–T5)

- Diagnóstico de la placa o mediciones inferidas.
- Identificación pin por pin del GPIO.
- Seguimiento de cables.
- Otras placas o microcontroladores.
- Explicaciones por edad (idea posterior).
- Animaciones interactivas (idea posterior).
- Base de datos compleja o agentes dentro de la aplicación.
- Digitalización del multímetro (propuesta reemplazada).
