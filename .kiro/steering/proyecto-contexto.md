# Contexto activo del proyecto — Raspberry Pi 5 Visual Explorer

## Versión 1.1 · 11 de noviembre de 2026

Este archivo es la fuente de contexto persistente para todos los agentes de Kiro.
Leerlo antes de cualquier implementación.

---

## Alcance vigente

Aplicación educativa para explorar una Raspberry Pi 5 con la cámara del teléfono
abierta en tiempo real. Las etiquetas se actualizan sobre zonas localizadas con
evidencia suficiente. Congelar la imagen para ver detalles es opcional; después
se vuelve a la cámara. Debe ser cómoda desde el teléfono y accesible también
desde una computadora.

El tipo de aplicación (web, PWA o nativa) quedó por definir; ver sección
«Plataforma propuesta» más abajo.

Cuatro zonas objetivo: alimentación USB-C, conjunto de puertos USB, Ethernet y
bloque GPIO. Al tocar una etiqueta aparece una explicación breve con fuente técnica.
El procesamiento normal no requiere pulsar «Analizar»; la cámara permanece abierta.

## Propuestas REEMPLAZADAS — solo antecedentes, no implementar

- Digitalizar lecturas del multímetro del padre de Claudia.
- Reconocimiento genérico de circuitos mediante LLM/RAG.
- Adquisición con ESP32 y canales de medición.

Estos antecedentes se conservan en el historial pero NO dirigen la implementación.

## Archivo existente — task1_probe.py

Implementado en el alcance anterior (reconocimiento genérico con LLM).
Estado comprobado el 11/11/2026:
- Sintaxis válida (ast.parse con Python 3.14.3).
- Dependencia `requests` disponible (2.33.1).
- No se encontraron archivos JSON de resultados en el directorio: no hay
  evidencia de que haya llamado a la API en este entorno. Que no existan
  resultados no prueba que el programa nunca se haya ejecutado; es lo
  observado en este directorio en esta fecha.
- La integración con Together AI queda fuera del alcance; no se accedió
  a cuentas ni se verificaron saldos o condiciones del proveedor.
- NO reutilizable directamente: usa LLM en la nube, no localización geométrica.
- Sí reutilizable: encode_image(), detect_mime(), build_image_content() si se
  necesita codificación base64 en el futuro; save_json() para logging.

## Técnica propuesta (hipótesis, no resultado confirmado)

Homografía estimada con ORB + RANSAC entre una imagen de referencia de la
Raspberry Pi 5 anotada y el fotograma actual. Proyectar el mapa de zonas al
cuadro. Validar evidencia local por zona; retirar etiqueta ante oclusión o duda.

El entorno de ejecución sigue abierto (web/PWA u opción nativa); ver sección
«Plataforma propuesta». Que OpenCV-Python no esté instalado en este equipo no
es relevante para la decisión de plataforma: cada runtime requiere sus propias
verificaciones. No está comprobado qué funciones expone la compilación de
OpenCV.js que se vaya a usar ni su rendimiento en el teléfono real.

## Repositorio

- Sin Git inicializado todavía.
- Archivos en raíz (estado actual): `task1_probe.py`, `Kiro_Correccion_T0_v1_1.md`, `status.md`.
- Carpeta `.kiro/` con `steering/` y `specs/rpi5-visual-explorer/` creadas en T0.
- Los archivos v1.0 (`01_Reglas...` y `02_Planificación...`) fueron borrados en T0;
  sus versiones v1.1 están en `Kiro_Correccion_T0_v1_1.md`.
- No hay `package.json`, `requirements.txt`, `app/` ni `data/` todavía.

## Dependencias verificadas en este equipo (11/11/2026)

Estas son las herramientas disponibles en la computadora de desarrollo.
No determinan la plataforma de la aplicación: opencv-python es un paquete
Python y no valida OpenCV.js ni ninguna biblioteca nativa.

| Herramienta | Versión  | Estado          | Relevancia para el proyecto        |
|-------------|----------|-----------------|------------------------------------|
| Python      | 3.14.3   | ✓ disponible    | Scripts de utilidad, no la app     |
| requests    | 2.33.1   | ✓ disponible    | Usada por task1_probe.py           |
| numpy       | 2.5.1    | ✓ disponible    | Scripts de utilidad si se necesita |
| Pillow      | 12.3.0   | ✓ disponible    | Scripts de utilidad si se necesita |
| Node.js     | 24.14.0  | ✓ disponible    | Servidor de desarrollo             |
| npm         | 11.9.0   | ✓ disponible    | Gestión de dependencias web        |
| opencv-python | —      | No instalado    | No es una dependencia del diseño propuesto |

## Plataforma propuesta — decisión pendiente de confirmar antes de T1

Se recomienda **PWA (Progressive Web App)** como punto de partida. Razones:

- getUserMedia está disponible en navegadores modernos (Chrome/Safari móvil)
  desde origen seguro. No requiere instalar una app nativa.
- OpenCV.js/WASM es una hipótesis de localización a verificar en T2; si no
  rinde, el fallback al servidor propio es más directo desde web.
- La misma URL funciona en teléfono y computadora con adaptación de interfaz,
  sin duplicar el desarrollo.
- La distribución de prueba no requiere tienda de apps.

Requisitos de acceso que trae esta opción (a resolver antes de T1):
- Origen seguro: HTTPS en producción/prueba remota, o localhost para prueba
  local sin certificado.
- Para acceder desde el teléfono en la misma red Wi-Fi: servidor local con
  HTTPS. mkcert genera un certificado de CA local; el teléfono debe confiar
  en esa CA (requiere instalar el certificado raíz en el teléfono — un paso
  manual documentado en github.com/FiloSottile/mkcert#mobile-devices).
- Alternativa sin instalar certificado en el teléfono: Cloudflare Tunnel
  (cloudflared, gratuito), que expone el servidor local con HTTPS válido.
- GitHub Pages (gratuito, solo estáticos) sirve para T1 y T4 si no hay
  servidor dinámico; complica el ciclo de desarrollo iterativo.

Límites de esta recomendación pendientes de verificar:
- Funciones disponibles en la compilación de OpenCV.js (ORB, AKAZE, RANSAC).
- Rendimiento real en el teléfono (se mide en T2).
- Compatibilidad del navegador del teléfono de Claudia.
- Condiciones vigentes de Cloudflare Tunnel si se elige esa vía.

App nativa (React Native, Flutter) sería alternativa si OpenCV.js no rinde
o la experiencia web es inaceptable. Añade SDK, compilación, instalación de
prueba y mayor esfuerzo; no es la recomendación inicial.

Dato que falta: modelo y sistema operativo del teléfono de Claudia. No es
bloqueante para T1 en sí, pero determina el navegador a usar y si hay
restricciones de getUserMedia. Avanzar sin ese dato; registrar al probar.

## No verificado en este entorno

- Acceso a cámara desde navegador móvil (requiere teléfono real).
- HTTPS local accesible desde el teléfono (configuración pendiente).
- Funciones disponibles en la compilación de OpenCV.js (ORB, AKAZE, RANSAC).
- Rendimiento de localización en el teléfono real.
- Condiciones vigentes de Cloudflare Tunnel gratuito.

## Próxima tarea autorizada

T2: localización real de una zona en video y en el teléfono.
Requiere T1 verificado en teléfono real e indicación expresa.
Ver criterios completos: .kiro/specs/rpi5-visual-explorer/tasks.md

## Repositorio y acceso

- Git inicializado. Repositorio: https://github.com/cafka/rpi5-explorer
- URL de la app: **https://cafka.github.io/rpi5-explorer/**
- Rama `main`: código de desarrollo y documentación.
- Rama `gh-pages`: build de la app servido por GitHub Pages.
- Desarrollo local: `node serve.js` → http://localhost:3000
