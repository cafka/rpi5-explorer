# Raspberry Pi 5 — corrección de T0 y contexto vigente para Kiro

Versión 1.1 · 11 de noviembre de 2026

**Este archivo es autocontenido. La sección 0 es la única orden para la ejecución actual. Las secciones 1–3 son contexto y planificación; incluirlas no ordena ejecutar T1–T5.**

La limitación a T0 es temporal. No debe convertirse en una regla permanente de `.kiro/steering/`. Una indicación posterior de ejecutar T1 activa cámara en vivo, congelado y reanudación, conservando el alcance y las reglas de trabajo.

## 0. Orden para esta ejecución: corregir T0

Versión 1.1 · 11 de noviembre de 2026

### Instrucción para Kiro

Continuá sobre la T0 que ya realizaste. Corregí su documentación y sus
conclusiones; no reinicies el proyecto ni implementes T1 en esta ejecución.

Esta orden vale únicamente para esta ejecución. No copies «corregir T0» ni «no implementar T1» como prohibiciones permanentes en .kiro/steering. Allí deben quedar las reglas estables; el bloque actual y el siguiente pertenecen al registro de estado. Al cerrar esta corrección, actualizá ese registro. Una indicación posterior de ejecutar T1 activa cámara en vivo, congelado y reanudación sin volver a ejecutar T0.

Leé las tres secciones de contexto incluidas en este mismo archivo, todas en versión 1.1 del 11/11/2026:

- Sección 1: reglas generales.
- Sección 2: planificación y criterios de aceptación.
- Sección 3: indicaciones por tarea, para usar cuando corresponda.

No necesitás archivos compañeros: todo su contenido operativo está incluido aquí.

Estas secciones y esta corrección reemplazan conjuntamente las instrucciones
equivalentes de la versión 1.0. Conservá los antecedentes e identificá qué
quedó reemplazado. Respetá las correcciones explícitas de la usuaria.

### Alcance y elección técnica

El objetivo sigue siendo explorar educativamente una Raspberry Pi 5 con la
cámara del teléfono abierta, localizar zonas visibles y actualizar sus
etiquetas. Congelar el cuadro para consultar detalles y volver al vivo es
opcional. No incorpores diagnóstico, mediciones, otras placas ni un LLM.

El formato de la aplicación está por decidir: web, PWA o app nativa. No
conviertas navegador, JavaScript, OpenCV.js, URL o HTTPS en requisitos del
producto antes de justificar la plataforma. La propuesta debe contemplar
también acceso desde computadora, explicando qué funciones ofrece allí,
sin imponer dos aplicaciones completas ni duplicar innecesariamente el
desarrollo.

Recomendá una alternativa concreta, con motivos y límites, considerando la
cámara, las bibliotecas de localización, la compatibilidad del teléfono,
el rendimiento por comprobar y el plazo. Indicá qué procesamiento harías
en el teléfono y qué requeriría un servidor. Compará solo las alternativas
que cambien materialmente la decisión.

Proponé también cómo se accedería a la primera prueba. No traslades a la
usuaria un menú de herramientas como mkcert, túneles o alojamiento para
que tome una decisión técnica sin recomendación. Si falta un dato esencial
del dispositivo, señalá exactamente cuál y avanzá con lo independiente.

### Correcciones de evidencia

- Sustituí «nunca fue ejecutado» por lo efectivamente comprobado. La
  sintaxis válida y la ausencia de resultados JSON no demuestran que un
  programa jamás haya corrido. Separá ejecuciones observadas, evidencia
  encontrada y antecedentes no verificados.
- No afirmes que falta saldo o que se exige un importe mínimo en un
  proveedor sin evidencia. Esa integración anterior quedó fuera del
  alcance; no accedas a cuentas, pidas claves ni hagas pagos para validarla.
- Separá OpenCV para Python de OpenCV.js. Consultar paquetes con `pip` no
  verifica las funciones disponibles en una compilación JavaScript ni
  convierte esos paquetes Python en dependencias del diseño propuesto.
- Marcá como pendientes las funciones, compatibilidad, cuotas, condiciones
  gratuitas y configuración de acceso que no hayas comprobado. Si elegís
  la vía web, explicá los requisitos de acceso seguro y certificados que
  correspondan. No instales ni contrates servicios ahora.
- Presentá los mecanismos de localización y validación de visibilidad como
  hipótesis hasta probarlos. Contraste o gradientes por sí solos no
  demuestran que el componente esté visible. No declares viable el
  reconocimiento antes del experimento T2.
- Retirá la prohibición genérica de SIFT/SURF por patentes y verificá cada
  caso por separado. La documentación de OpenCV indica que la patente de
  SIFT expiró en 2020; esto tampoco prueba que SIFT esté disponible en la
  compilación que se vaya a utilizar.

### Actualización y revisión

Inspeccioná los cambios locales antes de editar. Ajustá únicamente lo
necesario en el contexto activo, requisitos, diseño, tareas y registro de
estado, preservando modificaciones de la usuaria y el código existente.
No borres ni muevas archivos para hacer esta corrección.

Si disponés de subagentes, pedí una revisión independiente breve y de solo
lectura. Proporcionale la versión 1.1, esta corrección y los documentos
modificados. Debe contrastar alcance, evidencia y coherencia, sin ampliar
funciones. Si esa revisión no se ejecuta, dejalo explícito; no la sustituyas
por una afirmación de aprobación.

Entregá los cambios documentales, las correcciones de afirmaciones, la
propuesta técnica recomendada, los pendientes y el resultado de la
revisión. Dejá T1 preparada. No la inicies automáticamente por recibir una
respuesta sobre infraestructura: su ejecución requiere una indicación
expresa posterior.

### Fuentes para estas correcciones

- [OpenCV: instalación diferenciada para Python y JavaScript](https://opencv.org/get-started/).
- [OpenCV: SIFT y la patente expirada en 2020](https://docs.opencv.org/4.10.0/da/df5/tutorial_py_sift_intro.html).
- [mkcert: configuración y confianza en dispositivos móviles](https://github.com/FiloSottile/mkcert#mobile-devices).

---

## 1. Reglas generales de trabajo

*Raspberry Pi 5 · Versión 1.1 · 11 de noviembre de 2026*

Estas reglas conservan las decisiones del proyecto y permiten retomar el trabajo sin depender del historial del chat. Versión 1.1: corrige contradicciones de la 1.0 sobre plataforma y evidencia; conserva el objetivo y el alcance. Guardar aquí las reglas estables; registrar el bloque actual y el siguiente en el estado del proyecto. La orden de corregir T0 corresponde a una ejecución concreta: no copiarla como prohibición permanente de T1 ni repetir T0 cuando después se indique otro bloque. Estas reglas son un acuerdo para este proyecto, no un método óptimo demostrado para todas las versiones de Kiro.

[Planificación vigente y prueba de viabilidad](https://docs.google.com/document/d/1PlGb0dwGjJWWoCkywHIfM2KFL8tDIzrc0rrjfjOOhRM/edit?usp=drivesdk)

[Indicaciones para Kiro por tarea](https://docs.google.com/document/d/1q5z-jqUwnL5sAKDTdq4rvs0hNksh3uVbstczyl8ef6w/edit?usp=drivesdk)

### 1. Alcance vigente

Desarrollar una aplicación educativa para explorar una Raspberry Pi 5 con la cámara del teléfono abierta. El análisis se actualiza sobre el video y las etiquetas siguen las zonas mientras haya evidencia suficiente. Congelar la imagen para ver detalles es opcional; después se vuelve al modo en vivo. Debe ser cómoda desde el teléfono y accesible también desde una computadora. El tipo de aplicación móvil queda por definir: web, PWA o nativa. Kiro debe recomendar una opción con razones, dependencias y límites antes de fijar la arquitectura. El acceso desde computadora no obliga por sí solo a usar navegador en el teléfono ni a desarrollar dos aplicaciones completas.

El objetivo inicial comprende alimentación USB-C, puertos USB, Ethernet y bloque GPIO. Al tocar una etiqueta se presenta una explicación breve con fuentes técnicas. El procesamiento interno de fotogramas no debe obligar a sacar una foto ni pulsar «Analizar» en el uso normal.

Este alcance reemplaza las propuestas de digitalizar el multímetro y analizar circuitos genéricos con un LLM. No incluir diagnóstico, mediciones inferidas de la imagen, seguimiento de cables, identificación pin por pin, otras placas, varios agentes dentro de la aplicación ni una base de datos compleja.

### 2. Inspeccionar y conservar

Antes de cambiar código, leer las instrucciones del repositorio, su estructura, los cambios locales y la antigua tarea 1. Informar qué existe y qué se pudo ejecutar. Una tarea mencionada en el chat o marcada como terminada no equivale a una función verificada.

Reutilizar lo que sirva y modificar únicamente lo necesario para el bloque actual. Conservar el trabajo previo y su historial. No borrar ni mover archivos existentes sin consultar; no sobrescribir cambios ajenos ni reescribir el historial de Git.

Mantener las propuestas reemplazadas como antecedentes claramente identificados. Actualizar el contexto activo para que no vuelva a dirigir la implementación hacia el multímetro. Resolver decisiones rutinarias y reversibles dentro del bloque autorizado sin pedir confirmación a cada paso.

### 3. Plan completo, ejecución acotada

Conservar el objetivo completo, pero ejecutar un bloque coherente y comprobable por vez. Definir su resultado observable, dependencias, archivos afectados y criterios de aceptación. El plan general no ordena implementar todas las funciones en una sola ejecución.

Separar exploración técnica, implementación y verificación. Priorizar la prueba de viabilidad de la localización antes de ampliar la interfaz. Si un bloqueo afecta una parte, continuar el trabajo independiente y registrar exactamente qué falta.

### 4. Implementación y revisión

Comenzar con un implementador y una revisión independiente. Si la versión instalada permite subagentes, el revisor recibe el alcance, los requisitos, los archivos cambiados y las pruebas; inspecciona el código real y no solo el resumen del implementador. Registrar versión y modo de Kiro cuando estén disponibles, sin inventarlos.

El revisor propone hallazgos y el implementador aplica correcciones. Paralelizar únicamente tareas independientes, como consultar fuentes y preparar casos de evaluación. Evitar que dos agentes editen los mismos archivos. Si no hay subagentes disponibles, realizar las revisiones secuencialmente e indicar esa limitación.

Un agente adicional se justifica si cubre una necesidad concreta. Los agentes de desarrollo no forman parte de la arquitectura de la aplicación. Evitar ciclos de revisión sin límite: tras dos rondas sin resolver un mismo fallo, registrar el bloqueo y reconsiderar el enfoque.

### 5. Pruebas y evidencia

Ejecutar comprobaciones pertinentes al cambio. Las pruebas deben recorrer el código real y detectar fallos de comportamiento, no limitarse a reproducir la implementación o comprobar que un mock devuelve lo esperado. Registrar comandos, resultados, entorno y limitaciones.

Distinguir pendiente, implementado sin verificar, verificado en entorno de desarrollo y verificado en teléfono real. Una comprobación de sintaxis no demuestra ejecución ni funcionamiento; la ausencia de archivos de resultados no demuestra que un programa nunca se ejecutó. Usar «no encontré evidencia de ejecución» cuando eso sea lo observado. No inferir saldos, credenciales o límites de servicios sin una fuente comprobada. Una revisión de código o una prueba de escritorio no demuestra rendimiento móvil.

No contar recuadros fijos, animaciones preparadas ni resultados simulados como localización. Identificar visualmente toda simulación utilizada para probar la interfaz. Evaluar con capturas y secuencias diferentes de las referencias, incluyendo casos negativos.

Retirar las etiquetas cuando se pierde evidencia o el resultado queda desactualizado. La alineación global de la placa no confirma que cada puerto esté visible. Validar la evidencia local con oclusiones reales; contraste o gradientes, por sí solos, no demuestran identidad ni visibilidad. Abstenerse cuando la zona esté tapada o no pueda validarse.

### 6. Fuentes, costos y privacidad

Guardar cada explicación junto con su fuente oficial, sección y fecha de consulta. Separar las especificaciones del fabricante de cualquier medición real. La imagen no permite afirmar tensión, resistencia, continuidad ni estado eléctrico.

La primera versión no requiere LLM ni API key. No activar facturación, contratar servicios ni introducir una dependencia de pago. Comprobar y citar los límites vigentes de cualquier opción gratuita antes de adoptarla; no inventar cuotas ni afirmar «sin límites». Proponer una alternativa técnica concreta y justificarla, sin trasladar a la usuaria un menú de herramientas que Kiro puede evaluar. Preguntar solo por información o preferencias imprescindibles que no estén disponibles.

No prometer procesamiento local hasta comprobar compatibilidad y rendimiento en el entorno elegido. Diferenciar OpenCV.js/WebAssembly en navegador, OpenCV para Python y una biblioteca nativa: comprobar una no valida las otras. Verificar las funciones y la versión o compilación necesarias. HTTPS, certificados y alojamiento se analizan según la arquitectura; no son un requisito universal de una aplicación nativa. Informar dónde se procesa el video. Si se propone enviar fotogramas a un servidor, explicitarlo antes de implementarlo. Congelar una imagen no implica subirla ni guardarla permanentemente.

### 7. Estado recuperable

Mantener una copia operativa de estas decisiones en el proyecto: contexto breve en .kiro/steering/ o en el mecanismo existente, requisitos/diseño/tareas de la función y un registro de estado. Incorporar la versión 1.1 de reglas, plan e indicaciones y corregir las contradicciones activas de la 1.0. No recrear documentos que ya existen ni dar por hecho que el directorio está versionado con Git. Comprobar qué contexto reciben los agentes personalizados; no confundir llamadas paralelas a herramientas con una revisión independiente.

El registro debe incluir fecha, versión del plan, bloque actual, último cambio, verificaciones ejecutadas, evidencia, fallos abiertos y siguiente acción. No guardar secretos. Antes de cambiar de conversación, actualizarlo; al retomarla, leerlo.

Drive conserva los documentos para consulta. Drive y el repositorio no se sincronizan automáticamente: registrar qué versión se incorporó y reflejar las decisiones nuevas en la siguiente actualización documental.

La entrega de cada bloque debe explicar qué cambió, por qué, qué se comprobó, qué falló y qué sigue pendiente. No marcar la tarea completa si falta una comprobación necesaria.

### 8. Referencias del método

Las fuentes oficiales respaldan las capacidades descritas. La elección de bloques pequeños y una revisión independiente es una decisión práctica para este proyecto; no existe un número universal de tareas o agentes garantizado como óptimo.

[Kiro — buenas prácticas de especificaciones](https://kiro.dev/docs/specs/best-practices/)

[Kiro — subagentes](https://kiro.dev/docs/custom-agents/subagents/)

[Kiro — contexto persistente (steering)](https://kiro.dev/docs/steering/)

[Kiro — hooks para comprobaciones](https://kiro.dev/docs/hooks/)


---

## 2. Planificación y criterios de aceptación

*Exploración visual de Raspberry Pi 5 · Versión 1.1 · 11 de noviembre de 2026*

Este plan reemplaza el alcance centrado en el multímetro y la propuesta de reconocimiento genérico mediante LLM. La versión 1.1 corrige las referencias que imponían una aplicación web y distingue el reporte de T0 de la evidencia directa. No certifica que la cámara, la localización, el seguimiento ni el rendimiento móvil estén implementados.

[Reglas generales de trabajo con Kiro](https://docs.google.com/document/d/12nT07APVNwhYGKSudeQX_zNMJ0VqatGHBAb9bLLiDKw/edit?usp=drivesdk)

[Indicaciones para Kiro por tarea](https://docs.google.com/document/d/1q5z-jqUwnL5sAKDTdq4rvs0hNksh3uVbstczyl8ef6w/edit?usp=drivesdk)

### 1. Estado real y cambio sobre lo existente

Se revisó el registro de Kiro aportado el 11/11/2026. Muestra lectura de task1_probe.py, una comprobación de sintaxis con ast.parse, consultas de dependencias y creación de cinco documentos de contexto, requisitos, diseño, tareas y estado. No muestra ejecución funcional del programa ni implementación de cámara o reconocimiento. Esta revisión documental no accedió directamente al proyecto local: solo design.md está completo en el registro. El estado de los otros documentos y el comportamiento real deben contrastarse en el proyecto, conservando los resultados válidos ya obtenidos.

Se verificó que el plan anterior guardado en Drive describe adquisición con ESP32, canales de medición y una extensión fotográfica con LLM/RAG. Es un antecedente reemplazado, no una especificación activa. El guion audiovisual es un documento separado y no determina por sí solo las funciones que deben programarse.

Siguiente paso: corregir y completar T0 sobre los documentos ya creados. Conservar código, antecedentes y verificaciones válidas; ajustar plataforma, dependencias y afirmaciones sin evidencia. La ausencia de JSON no permite concluir «nunca fue ejecutado», y no se verificó en el registro el saldo de servicios. Según la salida mostrada, Git no estaba inicializado en ese directorio; no presentar historial de Git como existente. Mantener T1 pendiente hasta una instrucción expresa para ejecutarla.

Tipo de aplicación por definir según viabilidad y pruebas. Comparar de forma breve web, PWA y app nativa para el teléfono: cámara, bibliotecas de localización, instalación/distribución, pruebas disponibles, acceso desde computadora y esfuerzo dentro de un mes. Recomendar una opción y explicar sus límites. No imponer navegador ni HTTPS por haber aparecido en la versión 1.0. El acceso desde computadora puede resolverse con una interfaz apropiada; no se exige mantener dos aplicaciones completas. La decisión debe quedar justificada antes de T1, sin dar por comprobado el rendimiento que se medirá en T2.

### 2. Resultado inicial esperado

La persona abre la app desde el teléfono, permite el acceso a la cámara trasera y apunta a una Raspberry Pi 5. La cámara permanece abierta; se analizan fotogramas recientes automáticamente y se dibujan etiquetas sobre zonas localizadas con evidencia suficiente.

Cuatro zonas objetivo: alimentación USB-C, conjunto de puertos USB, Ethernet y bloque GPIO. Al tocar una etiqueta aparece una explicación breve y su enlace técnico. No se identifican pines individuales ni componentes pequeños.

El botón «Congelar imagen» detiene la vista en un cuadro para examinarlo, ampliar la imagen y consultar detalles. El análisis y las etiquetas deben corresponder a ese mismo cuadro. «Volver a cámara» descarta resultados viejos y vuelve a localizar. Guardar una foto será una acción explícita; congelar no significa publicarla ni almacenarla permanentemente.

Primer rango de uso: placa descubierta, vista superior o inclinación moderada, iluminación suficiente y movimiento lento. Registrar los límites observados. Cuando no haya evidencia, indicar «Buscando placa» o «No puedo localizar esta zona con suficiente claridad» y orientar a mejorar el encuadre.

Fotografías y videos grabados se usan como referencias, pruebas y regresiones. No sustituyen la cámara en vivo como recorrido principal ni obligan al usuario a tomar una foto para cada análisis.

### 3. Técnica propuesta

Preparar una referencia visual de Raspberry Pi 5 con regiones anotadas. Comparar puntos visuales entre referencia y cuadro actual y estimar una transformación de perspectiva robusta (homografía). ORB, emparejamiento de características y RANSAC son candidatos para el experimento; se debe comprobar la disponibilidad en la compilación elegida.

Aceptar la alineación solo con coincidencias suficientes y distribuidas, error geométrico controlado, tamaño y forma plausibles. Proyectar el mapa al cuadro y comprobar evidencia local de cada zona. Una transformación global válida no demuestra que un conector esté visible. Contraste y gradientes locales son señales candidatas, no pruebas suficientes de identidad: deben evaluarse con manos u otros objetos que tapen la zona. Ante oclusión o duda, retirar esa etiqueta.

La homografía aproxima el plano de la placa. USB y Ethernet sobresalen y pueden desplazarse visualmente por paralaje al inclinar la cámara. Por eso el experimento debe incluir cambios de ángulo y comprobar los contornos reales de los conectores. No prometer reconocimiento desde cualquier perspectiva.

Mantener el video fluido y analizar un fotograma reciente por vez, sin acumular una cola atrasada. Medir la frecuencia posible. Si hace falta, probar seguimiento entre relocalizaciones, con comprobaciones periódicas para evitar deriva. El suavizado no puede mantener etiquetas cuando se pierde la evidencia.

Guardar las cuatro fichas en un archivo sencillo, por ejemplo JSON: identificador, nombre, explicación, fuente oficial, sección y fecha. No se necesita base vectorial, agentes en la aplicación ni LLM para este alcance. Una futura explicación generativa requeriría evaluación propia y no forma parte de esta prueba.

### 4. Teléfono, servidor y acceso

En el teléfono: cámara, visualización del video, controles táctiles, congelado, superposición de etiquetas y fichas. El entorno de ejecución sigue abierto. Si se elige web/PWA, OpenCV.js/WebAssembly y resolución reducida son candidatos; si se elige una app nativa, debe verificarse la biblioteca equivalente y su integración. No hay rendimiento local confirmado. Elegir una opción no convierte su disponibilidad ni su velocidad en hechos comprobados.

Comprobar las funciones, la versión y la compilación disponibles en el entorno elegido; después medir tiempo por cuadro, memoria y respuesta de la interfaz en el teléfono real. pip show opencv-python solo comprueba un paquete Python y no valida OpenCV.js ni sus funciones. Registrar teléfono, sistema, navegador o runtime nativo, versión y resolución. No anunciar compatibilidad general sin pruebas.

Si se elige web/PWA y el procesamiento local pasa la prueba, el servidor puede limitarse a servir archivos estáticos. Para acceder a la cámara desde el navegador del teléfono, preparar un origen seguro y permisos; normalmente será una URL HTTPS. Una URL HTTP de la computadora en la red local no equivale a ese origen seguro. Si se elige app nativa, documentar permisos, instalación y distribución de prueba según su plataforma; no imponer alojamiento web para usar la cámara local. En todas las alternativas, el uso normal no debe requerir cable USB.

Si no rinde localmente, evaluar como alternativa explícita Python/OpenCV en una computadora propia accesible por red. El teléfono conservaría la cámara y la interfaz; se enviarían cuadros reducidos. Esto añade equipo encendido, conexión, protección del transporte y latencia. Explicar esos cambios antes de adoptarlos y no presentarlos como procesamiento local en el teléfono. No instalar dependencias de esta alternativa mientras no esté elegida.

No activar facturación ni contratar alojamiento. Verificar requisitos y límites vigentes de cualquier opción gratuita antes de proponer su uso; no afirmar que un servicio carece de límites ni fijar cuotas sin una fuente actual. Si se evalúa mkcert, incluir que el teléfono necesita confiar en el certificado de la autoridad local y que el servidor requiere configuración HTTPS. Kiro debe recomendar una opción de acceso coherente con la plataforma y explicar sus pasos, en lugar de exigir a la usuaria elegir entre herramientas sin evaluar. La Raspberry Pi disponible es el objeto de exploración; no se asume como servidor. El experimento no requiere API key.

### 5. Primer experimento: puerta de viabilidad

Plazo orientativo: primeros 4 a 7 días de trabajo, con un prototipo mínimo. Primero cámara real y congelado/reanudación; enseguida, localización de una zona objetivo. La cámara sola valida infraestructura, no la función central.

Separar material de referencia/ajuste y evaluación por sesión de captura. Una rotación artificial o un cuadro vecino del mismo video no cuentan como una nueva captura independiente. Registrar origen y condiciones de reutilización de imágenes de Internet; incorporar pronto la placa real de la usuaria.

Evaluación piloto propuesta: 12 clips reservados de 15 a 30 segundos, distintos del material de ajuste. Seis con cambios de posición, escala y rotación; cuatro con oclusión, desenfoque o salida de cuadro; dos negativos sin Raspberry Pi 5 o con otra placa. Además, ejecutar el flujo en vivo en el teléfono.

Anotar 10 cuadros distribuidos en cada clip —120 en total— con contorno real y estado de visibilidad de la zona. Registrar también las transiciones de pérdida y recuperación en el video completo. Para la primera zona se evalúa esa zona; al ampliar a cuatro se anota y se informa el resultado por cada una.

Fijar criterios antes de usar el conjunto reservado. Si se usa un clip para ajustar umbrales, deja de ser evaluación independiente y debe reemplazarse. Este piloto busca detectar problemas y decidir si continuar; no demuestra funcionamiento general con cualquier placa, teléfono o entorno.

### 6. Criterios de aceptación propuestos

Los siguientes valores son objetivos iniciales del proyecto, no resultados obtenidos ni garantías de la documentación. Registrar numerador, denominador y casos fallidos; no informar solo porcentajes.

- Ubicación: al menos 95% de las etiquetas mostradas corresponden a la zona correcta y su región alcanza IoU ≥ 0,5 respecto de la anotación. IoU mide el área compartida dividida por el área total combinada. El indicador o línea de la etiqueta debe apuntar a esa región, no a un componente vecino.

- Cobertura: localizar al menos 80% de las zonas claramente visibles dentro del rango de uso declarado. Este criterio impide aprobar ocultando todas las etiquetas. Informar ubicación y cobertura por zona y por clip, sin tratar cuadros consecutivos como ensayos independientes.

- Evidencia insuficiente: retirar la etiqueta inválida en un máximo de 0,5 segundos desde una oclusión, salida o desenfoque claramente anotados. No mantenerla sobre el fondo. Recuperar la localización en un máximo de 2 segundos al volver a una vista válida.

- Negativos: ninguna etiqueta aceptada en los clips negativos del piloto. Informar cualquier falso positivo; cero en esta muestra no garantiza cero en todos los escenarios.

- Rendimiento: objetivo exploratorio de al menos 3 actualizaciones de localización por segundo y antigüedad p95 del resultado mostrado de hasta 500 ms con movimiento lento. Medir desde el cuadro usado hasta su presentación, además del tiempo de cálculo. Registrar estabilidad durante 5 minutos y cualquier bloqueo o aumento de latencia.

- Congelar/reanudar: el cuadro y sus etiquetas están sincronizados; una etiqueta antigua no se copia sobre un cuadro nuevo. Al reanudar, se invalida el resultado congelado y se vuelve a localizar. La interacción táctil sigue siendo utilizable.

- Fuentes: todas las afirmaciones técnicas de las cuatro fichas tienen respaldo en una sección concreta de documentación oficial. No presentar valores de especificación como mediciones ni afirmar que la placa funciona o está averiada.

Si falla la puerta de viabilidad, identificar una causa y realizar un bloque acotado de corrección. Repetir con evaluación independiente. Si persiste, registrar el límite y reconsiderar técnica o rango de uso antes de ampliar funciones. Un marcador añadido o una lámina impresa sería otro experimento; no demostraría por sí solo reconocimiento directo de la placa.

### 7. Orden de trabajo para aproximadamente un mes

#### Semana 1 — estado real y viabilidad

T0: corregir la auditoría inicial, reconciliar los documentos ya creados y justificar la plataforma propuesta. T1: cámara móvil, congelado y reanudación con permisos y acceso acordes a esa plataforma. T2: probar localización real de una zona en video y en el teléfono. Resolver la puerta de viabilidad al final de esta semana como objetivo orientativo. El registro aportado corresponde a trabajo documental de T0; T1–T5 no están verificados ni autorizados por esta actualización.

#### Semana 2 — cuatro zonas

T3: ampliar el método validado a USB-C, USB, Ethernet y GPIO. Comprobar evidencia por zona, pérdida, recuperación y estabilidad. Revisar el efecto de cables, reflejos e inclinación sin ampliar el alcance por defecto.

#### Semana 3 — explicaciones e interacción

T4: fichas técnicas verificadas, enlaces, selección táctil y detalles de imagen congelada. Mejorar legibilidad y accesibilidad. El congelado básico ya debe existir desde T1; esta semana no introduce por primera vez la cámara continua.

#### Semana 4 — validación y demostración

T5: evaluación con sesiones nuevas y teléfono real, corrección de fallos, documentación reproducible y demostración basada en el comportamiento observado. Reservar margen para problemas de compatibilidad. El calendario es orientativo, no un compromiso de finalización sin comprobar T2.

### 8. Dependencias e incertidumbres

Dependencias tempranas: acceso al proyecto y sus cambios actuales; teléfono real y permiso de cámara; capturas propias; forma de ejecución y distribución accesible sin pago según la plataforma; bibliotecas compatibles y referencias visuales utilizables. HTTPS/alojamiento es una dependencia de la opción web o del transporte que lo requiera, no de toda app nativa por definición. Si falta el modelo o sistema del teléfono, no inventarlo; avanzar en la documentación que no dependa de ese dato. Ninguna de estas dependencias exige una API key por definición.

Incertidumbres principales: correspondencias visuales repetidas, reflejos, paralaje, zonas tapadas, desempeño y temperatura del teléfono, apariencia con accesorios y latencia de un eventual servidor. No están resueltas por este documento.

Ideas posteriores —explicaciones por edad, animaciones del funcionamiento, otros componentes o asistencia a proyectos— quedan fuera de T0–T5. Se evaluarán cuando la función central tenga evidencia suficiente y la usuaria las priorice.

### 9. Fuentes técnicas iniciales

Consultadas el 11 de noviembre de 2026. La técnica, los plazos y los umbrales de aceptación son propuestas del proyecto. Estas fuentes respaldan el hardware y los mecanismos técnicos, no garantizan el resultado del experimento.

[Raspberry Pi 5 — página oficial y especificaciones](https://www.raspberrypi.com/products/raspberry-pi-5/)

[Raspberry Pi — documentación de hardware y GPIO](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html)

[OpenCV — localización de un objeto conocido con características y homografía](https://docs.opencv.org/4.x/d7/dff/tutorial_feature_homography.html)

[MDN — getUserMedia, permisos y contexto seguro](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

### IDEAS PARA LA APLICACIÓN — 11 DE NOVIEMBRE DE 2026

Objetivo

Una aplicación educativa, cómoda de usar desde el celular y accesible también desde una computadora, para explorar visualmente una Raspberry Pi 5 y comprender sus componentes y conexiones principales.

Experiencia imaginada

La persona apunta la cámara del teléfono a la placa y ve su imagen en pantalla. La aplicación intenta localizar las zonas con evidencia suficiente y muestra recuadros o etiquetas sobre ellas. Al tocar una etiqueta se abre información sobre el componente correspondiente. Si la persona quiere observar con más calma, puede congelar el fotograma y ampliar o consultar sus detalles; guardar una fotografía sería una acción explícita. La cámara en vivo es el recorrido principal previsto, y la localización y el rendimiento deben validarse en el teléfono real.

El plan inicial propone comenzar con cuatro zonas: alimentación USB-C, conjunto de puertos USB, Ethernet y bloque GPIO. Estas son zonas objetivo para una prueba de viabilidad, no funciones cuya implementación o precisión esté confirmada.

Explicaciones para distintos públicos — idea posterior

Ofrecer una explicación para niños y otra para adultos sobre el mismo componente. La versión para niños emplearía palabras sencillas y ejemplos cercanos, sin resultar infantilizante; la de adultos podría agregar profundidad técnica. La persona elegiría entre ambas desde la misma ficha.

Ejemplo ilustrativo — puerto USB:

• Niños: «Acá podés conectar cosas como un teclado o un mouse».

• Adultos: «Este puerto USB permite conectar periféricos, como teclados, ratones y dispositivos de almacenamiento».

Los contenidos finales deben revisarse según el componente exacto y su documentación oficial.

Animaciones y recursos interactivos — idea posterior

Incluir animaciones breves, videos o HTML interactivos que ayuden a comprender qué es un componente, qué función cumple, cómo se relaciona con otros o cómo llega y sale una señal cuando el recorrido esté documentado. Un ejemplo sería una animación de un teclado conectado por USB. La persona podría reproducirla y volver a verla desde la ficha. Las representaciones conceptuales deben identificarse como simplificadas y no inventar recorridos eléctricos ni detalles internos.

Información y costos

Preparar contenido propio respaldado por fuentes técnicas verificables, que pueda consultarse desde datos de la aplicación sin depender necesariamente de una API o de una consulta a un modelo de lenguaje en cada interacción. Evitar requerir una API paga para el alcance inicial. La forma concreta de almacenar la información y eventuales ampliaciones se decidirán durante la implementación.

Criterio de trabajo y alcance

Las ideas de explicaciones por edad y animaciones son propuestas para evaluar y priorizar después de validar la función central de localización, de acuerdo con la sección de ideas posteriores de esta planificación. No están confirmadas como implementadas ni pasan automáticamente a formar parte de T0–T5. El orden y la viabilidad se decidirán con Claudia tras la prueba central.

Vínculo con la historia del video

El multímetro de su padre aporta el origen narrativo del proyecto. La aplicación educativa vigente se centra en la exploración visual de la Raspberry Pi 5. Cualquier dispositivo que se use para leer el multímetro pertenece a la parte separada de digitalización, no es un requisito de esta aplicación educativa.


---

## 3. Indicaciones por tarea — contexto de las etapas

*Raspberry Pi 5 · Versión 1.1 · 11 de noviembre de 2026*

### Cómo usar este documento

Para continuar ahora, usar únicamente la sección 0 «Corrección de T0» al comienzo de este archivo: corrige la T0 ya realizada y conserva lo creado. No reiniciar la auditoría ni ejecutar T1. Los bloques T0–T5 de este documento son referencias para cada etapa; enviar solo el bloque autorizado, nunca todos como una orden única. Mantener los identificadores técnicos del proyecto.

Dar a Kiro el contenido de las reglas, el plan y estas indicaciones en versión 1.1 —como archivos o texto—. Un enlace por sí solo no garantiza lectura. Incorporar la versión operativa al proyecto y registrar qué archivos se consultaron. Las correcciones v1.1 reemplazan las instrucciones contradictorias de v1.0; no se supone sincronización automática con Drive.

[Documento de reglas generales](https://docs.google.com/document/d/12nT07APVNwhYGKSudeQX_zNMJ0VqatGHBAb9bLLiDKw/edit?usp=drivesdk)

[Documento de planificación y criterios de aceptación](https://docs.google.com/document/d/1PlGb0dwGjJWWoCkywHIfM2KFL8tDIzrc0rrjfjOOhRM/edit?usp=drivesdk)

Estado conocido a partir del registro compartido de Kiro: hubo inspecciones, comprobación de sintaxis de task1_probe.py y creación de cinco documentos de T0. No se inspeccionó directamente el proyecto local desde esta revisión. La ejecución funcional del programa anterior, la cámara y el reconocimiento no quedaron demostrados por ese registro. T0 requiere la corrección documental indicada; T1–T5 siguen pendientes salvo evidencia posterior. T1 es cámara en vivo y no la antigua tarea 1.

### T0 — Revisar lo existente y fijar el nuevo alcance (referencia inicial)

INICIO DEL TEXTO PARA KIRO

Cambiamos el enfoque del proyecto. El objetivo es una aplicación educativa para explorar una Raspberry Pi 5 desde la cámara del teléfono EN VIVO, con etiquetas sobre zonas localizadas con evidencia. Congelar para ver detalles y volver a la cámara es opcional. Debe ser cómoda en el teléfono y accesible también desde computadora; eso no obliga a una implementación idéntica. Web, PWA y app nativa son opciones por evaluar, no requisitos fijados. Este alcance reemplaza el registro del multímetro y el análisis genérico de circuitos mediante LLM.

Leé las reglas generales y la planificación versión 1.1 del 11/11/2026. Este bloque describe la T0 inicial. Si ya fue ejecutada, continuar con la sección 0 de este archivo y reutilizar las comprobaciones válidas. No implementes T1–T5 ni reconstruyas documentos o código desde cero.

- Inspeccioná instrucciones, estructura, dependencias, cambios locales y la antigua tarea 1. Identificá archivos y comportamiento existentes. Ejecutá solo las comprobaciones necesarias para establecer su estado, sin destruir ni sobrescribir trabajo previo. Al retomar, no repitas resultados válidos salvo cambios, fallos o evidencia insuficiente.

- Informá qué existe, qué comprobaste, qué falla y qué no pudiste verificar. Separá observación, hipótesis y propuesta. Una comprobación de sintaxis no prueba ejecución funcional; no encontrar resultados no prueba que el programa nunca se ejecutó. No afirmes saldo, permisos, costos ni límites de servicios sin evidencia pertinente. No deduzcas el estado de una casilla marcada o del historial del chat.

- Proponé qué reutilizar y qué cambios mínimos necesita el nuevo alcance. Conservá antecedentes e historial; no borres ni muevas archivos existentes sin consultarme.

- Actualizá el contexto activo y los requisitos, diseño y tareas en la estructura existente. Conservá los documentos ya creados y corregí sus contradicciones. Si no hay estructura, creá una pequeña. Indicá que multímetro y LLM genérico fueron reemplazados. Compará brevemente web/PWA y app nativa según cámara, bibliotecas disponibles, rendimiento a probar, acceso desde computadora y esfuerzo del mes disponible. Recomendá una opción con sus razones y pendientes; no conviertas una hipótesis en una decisión demostrada ni pidas elegir alojamiento antes de resolver la plataforma.

- Creá o actualizá un registro de estado con fecha, versión del plan, archivos relevantes, verificaciones, pendientes y siguiente tarea. No lo marques como sincronizado automáticamente con Drive.

- Comprobá las dependencias del primer experimento según la plataforma propuesta: permisos y acceso a cámara, bibliotecas, funciones necesarias y uso sin conectar el teléfono por USB a una computadora. Si se elige web/PWA, verificar HTTPS y navegador; si se elige nativa, SDK, permisos, compilación e instalación. Comprobar opencv-python no verifica OpenCV.js; cada runtime exige sus propias pruebas. Identificá lo que requiera teléfono real o material faltante. Verificá fuentes oficiales y límites vigentes de cualquier opción gratuita antes de adoptarla. No actives facturación ni pidas una API key.

Al terminar, entregá un resumen del estado comprobado, los cambios documentales, la recomendación de plataforma y el bloque T1 preparado, sin ejecutarlo. Si falta información esencial, indicá exactamente cuál y avanzá en lo independiente. No declares viable el reconocimiento antes de T2. Una corrección documental se comprueba revisando su coherencia; no requiere inventar ni repetir pruebas de ejecución.

FIN DEL TEXTO PARA KIRO

### T1 — Cámara en vivo, congelado y reanudación

INICIO DEL TEXTO PARA KIRO

Cuando se autorice T1, leé el alcance vigente, el registro de estado y la elección técnica justificada al cerrar T0. Ejecutá únicamente T1 y reutilizá la estructura existente. Si la plataforma sigue pendiente, resolvé primero esa decisión y su justificación. Implementá cámara trasera en vivo, «Congelar imagen» y «Volver a cámara», con manejo de permisos denegados y errores de cámara. No añadas reconocimiento simulado para hacer parecer terminado T2.

El uso normal debe funcionar en el teléfono sin cable USB a una computadora. Para web/PWA, documentá y comprobá una URL HTTPS y permisos; para app nativa, documentá y comprobá instalación y permisos en el sistema elegido. Explicá el acceso previsto desde computadora sin exigir que comparta toda la implementación. Usá una alternativa gratuita verificada, sin contratar servicios. Si no podés probar el teléfono real, dejá esa verificación pendiente y entregá pasos concretos para hacerla.

Al congelar, conservá el cuadro seleccionado de manera temporal para ampliarlo y consultar detalles futuros. Al reanudar, volvé al video y descartá cualquier resultado ligado al cuadro congelado. Evitá bucles de procesamiento duplicados y liberá los recursos de cámara cuando corresponda.

Verificá los caminos relevantes de la aplicación y ejecutá las pruebas disponibles. Registrá por separado pruebas con cámara real y pruebas simuladas. La aceptación requiere video visible, congelado estable, reanudación correcta, controles utilizables y errores manejados; no demuestra localización. Actualizá el estado y entregá archivos cambiados, comprobaciones y pendientes. No avances a T2 en esta ejecución.

FIN DEL TEXTO PARA KIRO

### T2 — Comprobar localización real de una zona

INICIO DEL TEXTO PARA KIRO

Leé el plan, las reglas y el estado real de T1. Ejecutá únicamente el experimento T2. El objetivo es localizar una de las zonas previstas de una Raspberry Pi 5 sobre la cámara EN VIVO y comprobar que la etiqueta sigue la zona ante cambios de encuadre. Elegí la zona según la evidencia visual y explicá la elección.

Probá primero un mapa de referencia con emparejamiento de características y homografía robusta. ORB y RANSAC son candidatos; comprobá que la biblioteca y compilación elegidas exponen las funciones necesarias. Empezá con vista superior, inclinación moderada y movimientos lentos. La elevación de los conectores puede producir paralaje.

Validá la alineación y la evidencia local de la zona. Si está tapada, borrosa, fuera de cuadro o no hay suficientes coincidencias, retirale la etiqueta y mostrale al usuario el estado adecuado. No uses coordenadas fijas ni aceptes la homografía global como prueba de visibilidad. Gradientes o contraste por sí solos no confirman el componente: probá oclusiones reales y tratá cualquier criterio local como hipótesis hasta evaluarlo.

Mantené el video continuo y analizá cuadros recientes sin acumular retraso. Registrá tiempo de cálculo y antigüedad del resultado mostrado. Comprobá el procesamiento local en la plataforma y runtime elegidos, con sus bibliotecas concretas; no afirmes rendimiento móvil sin medirlo. Si necesitás servidor, describí dónde se procesan los cuadros, la conexión, los costos y los límites antes de incorporarlo.

Usá el protocolo del plan: referencias y ajuste separados de 12 clips de evaluación por sesiones, 120 cuadros anotados y prueba en vivo. Registrá precisión de ubicación, cobertura, pérdida, recuperación, negativos y latencia con los criterios propuestos. No ajustes umbrales sobre el conjunto reservado sin reemplazarlo para la siguiente evaluación.

El congelado debe asociar la etiqueta al cuadro exacto. Al volver a la cámara, invalidá resultados viejos y relocalizá. No introduzcas LLM, APIs de pago, diagnóstico ni nuevas placas.

Entregá el experimento reproducible, resultados reales por caso, errores y conclusión: viable dentro del rango probado, necesita corrección o aún no comprobado. Si faltan videos propios o acceso al teléfono, continuá las partes independientes y dejá claramente pendiente esa evidencia; imágenes sintéticas o recuadros preparados no la sustituyen. No avances a las cuatro zonas hasta resolver esta evaluación.

FIN DEL TEXTO PARA KIRO

### Revisión independiente — usar tras la corrección de T0 y cada implementación

Instrucción para Kiro antes de delegar: si tu versión permite subagentes, entregá el bloque siguiente a un revisor con alcance, reglas, plan, archivos cambiados y evidencia. Si no es posible, realizá una revisión separada y registrá la limitación; no afirmes que hubo un revisor independiente sin haberlo invocado.

INICIO DEL TEXTO PARA EL REVISOR

Revisá el bloque actual contra sus requisitos y criterios de aceptación. Para T0, comprobá coherencia de documentos y afirmaciones; para implementación, inspeccioná también código y pruebas reales. Leé las reglas, el plan, los archivos cambiados y la evidencia. Informá hallazgos sin modificar archivos de implementación ni confiar solo en el resumen del implementador. No vuelvas a delegar esta revisión.

Buscá errores concretos, casos omitidos y afirmaciones sin evidencia. Comprobá si las pruebas recorren el código usado por la aplicación y si fallarían al romper el comportamiento esperado. Para reconocimiento, distinguí la alineación de la placa de la visibilidad de cada zona y la evaluación independiente del material de ajuste.

Devolvé hallazgos con importancia, archivo o comportamiento afectado y forma de reproducirlos. Señalá qué bloquea la aceptación y qué comprobaciones siguen pendientes. Si no encontrás problemas, indicá el alcance de tu revisión sin presentar eso como garantía de funcionamiento móvil. No propongas nuevas funciones fuera del bloque.

FIN DEL TEXTO PARA EL REVISOR

### T3–T5 — Indicaciones siguientes

#### T3 — Ampliar a cuatro zonas

Cuando T2 tenga evidencia suficiente, ejecutá solo T3: extendé la localización a alimentación USB-C, conjunto USB, Ethernet y bloque GPIO. Comprobá visibilidad por zona, oclusión, pérdida y recuperación. Evaluá cada zona con material independiente y reportá resultados por separado. No identifiques pines individuales ni agregues otras placas. Actualizá el estado y someté los cambios a revisión.

#### T4 — Fichas y detalles

Cuando las zonas estén localizadas con evidencia, ejecutá solo T4: incorporá fichas breves al tocarlas, con datos comprobados y enlaces a secciones oficiales de Raspberry Pi 5. Guardá el contenido y sus fuentes en un formato sencillo. Mejorá la consulta y ampliación en imagen congelada. No incorpores LLM, diagnóstico ni valores supuestamente medidos. Revisá cada afirmación contra su fuente.

#### T5 — Validación y demostración

Ejecutá solo T5: probá el recorrido completo en el teléfono real y con sesiones nuevas, aplicando los criterios del plan. Corregí fallos y documentá dispositivo, sistema operativo, plataforma, navegador si corresponde, versión del código, límites y resultados. Comprobá también el acceso previsto desde computadora dentro del alcance elegido. Prepará una demostración reproducible de cámara en vivo, etiquetas, pérdida/recuperación, fichas y congelado/reanudación. Separá lo observado de lo pendiente; no sustituyas fallos por una simulación sin identificarla.

### Para retomar en una conversación nueva

Leé las instrucciones vigentes del proyecto, la planificación y el registro de estado; comprobá que incorporan la versión 1.1 o una posterior explícitamente adoptada. Resumí el alcance actual, el último bloque realmente verificado, las pruebas pendientes y la siguiente acción. Contrastá el registro con los archivos y cambios actuales. No reinicies trabajo ya comprobado ni retomes multímetro o LLM genérico. Continuá únicamente el bloque indicado y actualizá el estado al terminar.


