# Mesa de Entradas

> Un juego de ventanilla donde el celular es tu mano. Ganás el trámite manipulando una conversación que no es tuya.

Proyecto final de la materia **Internet de las Cosas (IoT)**.

## Integrantes

| Nombre |
|---|
| Balbi, Arturo |
| Dávalos, Nicolás |
| Meza, Gabriel |
| Salinas, Nahuel |

---

## 1. Idea en una línea

Juego web de un solo jugador, inspirado en *Papers, Please*, donde la PC muestra la oficina y el **celular del jugador, vinculado con un QR y sin instalar nada, funciona como control por movimiento** (giroscopio y acelerómetro, al estilo Wii). Dos NPCs con LLM conversan entre sí en el mostrador: uno tiene el dato que necesitás y el otro tiene que pedirlo. El jugador no controla la charla; la **influye**.

## 2. Historia

### Premisa

Heredaste el **kiosco de tu abuela Nelly**, en el barrio desde hace 40 años. Para escriturarlo a tu nombre necesitás el **Certificado de Libre Deuda**, y el plazo vence **mañana a las 13:00**. Si no llega a tiempo, el local pasa a remate municipal.

Vas a la Municipalidad de *Villa Expediente*. Hay una sola ventanilla abierta, la **Mesa de Entradas**, y nadie te va a explicar nada.

### Personajes

| Personaje | Rol | Personalidad |
|---|---|---|
| **Gerardo**, el Funcionario | Tiene todos los datos del trámite | Desganado, monosilábico, siempre "a punto de irse". Se ablanda con el mate y las buenas formas. Detesta las preguntas vagas. |
| **Tomás**, el Pasante | Debe pedirle los datos a Gerardo en tu nombre | Bien intencionado pero colgado. Confunde formularios, repite preguntas, se distrae. Es quien termina escribiendo en la planilla. |
| **Vos** | Ciudadano en la fila | Mudo. Sólo actuás con gestos del celular y, si se habilita, con susurros por micrófono. |

### Estructura: 5 ventanillas = 5 "tramos" del trámite

Cada tramo es un caso corto (2 a 4 minutos) con un **dato secreto distinto** que Gerardo conoce y Tomás debe anotar:

1. **Formulario correcto** (el número y la letra).
2. **Oficina y piso** donde se firma.
3. **Sello requerido** y de qué área.
4. **Horario de atención** de esa oficina (casi siempre es "una ventana de 20 minutos").
5. **Expediente madre**: el dato final, que sólo se obtiene si la relación con Gerardo es buena.

### Giro narrativo

En el tramo 5 se revela que Gerardo **tomaba mate con tu abuela Nelly** todas las tardes frente al kiosco, y que su desgano es en parte porque la extraña. Si lo tratás bien durante los tramos anteriores (mate bien servido, no interrumpirlo de más), él mismo te da el dato y un favor extra. Si lo irritaste, hay que ganárselo de otra forma.

### Finales

| Final | Condición | Qué pasa |
|---|---|---|
| **Escritura firmada** | Los 5 datos correctos y buena relación con Gerardo | Te quedás con el kiosco. Gerardo aparece en la escena final con un mate. |
| **Por el pelo** | Los 5 datos correctos pero con mala relación | Conseguís el certificado a las 12:59, después de una última humillación burocrática. |
| **Vuelva mañana** | La paciencia de Gerardo llega a 0 en cualquier tramo | Cierra la ventanilla. Es demasiado tarde y el kiosco va a remate. Escena final agridulce con Tomás pidiendo disculpas. |
| **Secreto** *(opcional)* | Descubrir el patrón de rutina de Gerardo | Un final extra para quienes rejuegan. |

El tono es **humor cotidiano rioplatense** (mate, "vuelva mañana", "falta un sello"), con exageración leve y sin llegar a lo absurdo.

---

## 3. Cómo se juega

### Flujo

1. Abrís el juego en la PC. Aparece un **QR** con el código de sala.
2. Escaneás el QR con el celular. Se abre una web (sin instalar apps). Tocás **"Conectar"**, que da permiso a los sensores.
3. Calibrás: "apuntá a la pantalla y tocá".
4. Empieza el tramo. Gerardo y Tomás dialogan. Vos intervenís con el celular.
5. Si Tomás anota el **dato correcto** antes de que se agote la paciencia de Gerardo, pasás al siguiente tramo.

### Gestos del celular

| Gesto | Sensor | Efecto |
|---|---|---|
| Inclinar suavemente | Giroscopio / orientación | Servir mate o café sin derramar. Si se derrama, baja el ánimo de Gerardo. |
| Sacudir | Acelerómetro | Toser para interrumpir un malentendido o despertar a Gerardo. |
| Flick hacia adelante | Acelerómetro | Tirar un papelito con una pista al Pasante. |
| Golpe hacia abajo | Acelerómetro | Estampar el sello cuando el formulario está bien. |
| Apuntar | Giroscopio | Señalar en pantalla un campo del formulario. |
| Hablar *(opcional)* | Micrófono, Web Speech API | Susurrar una pista a Tomás. |

### Recursos del jugador

- **Paciencia de Gerardo**: barra principal. Si llega a 0, se pierde el tramo.
- **Claridad de Tomás**: qué tan encaminada está su pregunta. Sube con pistas y baja con distracciones.
- **Reloj de la Municipalidad**: el día avanza y la oficina cierra. Presión de tiempo global.

---

## 4. Diseño de los LLMs

### Principio

**El LLM pone las palabras. El motor de juego pone las reglas.** Los dos personajes son agentes separados con prompts independientes porque la **información asimétrica es la jugabilidad**: Tomás de verdad no sabe el dato.

### Cada turno devuelve

```
<texto del personaje, en streaming>
[[animo:-5|revela:false]]
```

El texto va primero para poder mostrarlo mientras se genera. El bloque final de metadatos lo lee el motor y decide los cambios de estado.

### Reglas verificadas por código, no por el modelo

- El dato secreto vive sólo en el prompt de Gerardo y en el estado del servidor.
- Gerardo "revela" sólo si se cumplen condiciones del caso (pregunta precisa, ánimo mínimo, mate reciente).
- El éxito se comprueba comparando lo que Tomás **escribe en la planilla** contra el dato real, con una comparación normalizada y sin pedirle al modelo que juzgue.
- Los efectos de los gestos sobre el ánimo se calculan localmente, sin pasar por el LLM.

### Modelo

Un modelo chico y rápido (Claude Haiku 5.5) llamado desde una función serverless, para no exponer la API key. Respuestas cortas (1 a 2 frases, `max_tokens` bajo).

---

## 5. Arquitectura

```
┌──────────────┐   WebRTC DataChannel   ┌──────────────┐
│  Celular     │ ─────────────────────▶ │     PC       │
│  (control)   │   orientación @ 60 Hz  │   (juego)    │
└──────────────┘                        └──────┬───────┘
        ▲                                      │ HTTPS (streaming)
        │ QR con código de sala                ▼
        │                              ┌──────────────┐
   señalización                        │ Función LLM  │
   (PeerJS / Supabase)                 │  (Vercel)    │
                                       └──────────────┘
```

### Stack propuesto

| Capa | Tecnología |
|---|---|
| Juego (PC) | Vite + TypeScript + Phaser (o PixiJS) |
| Control (celular) | Página web liviana, JS plano, `DeviceOrientationEvent` / `DeviceMotionEvent` |
| Conexión | **WebRTC DataChannel** (PeerJS para la señalización) |
| Respaldo de conexión | Supabase Realtime (WebSocket) si WebRTC falla |
| LLM | API de Claude (Haiku 5.5) vía función serverless en Vercel |
| Hosting | Vercel (HTTPS incluido, requisito de los sensores en iOS) |
| Audio | Web Audio API, efectos propios y música libre |

---

## 6. Prioridad: baja latencia

La latencia se trata como requisito de diseño. Se separan **dos tipos de interacción**, con presupuestos distintos.

### Presupuesto

| Camino | Objetivo | Cómo se logra |
|---|---|---|
| Gesto → reacción visual | **< 50 ms** | Datos por WebRTC peer-to-peer, sin pasar por servidor. El efecto (derramar, sellar) se calcula **localmente** en la PC. |
| Orientación continua | 60 Hz | Canal **no ordenado y sin reintentos** (`ordered: false`, `maxRetransmits: 0`): si se pierde un paquete, el siguiente lo reemplaza. |
| Pregunta → primera palabra del LLM | **< 800 ms** | Streaming, modelo chico, prompt corto, `max_tokens` bajo. |
| Cambio de estado por gestos | instantáneo | No depende del LLM. |

### Tácticas

1. **Los gestos nunca esperan al LLM.** El mate, la tos y el sello afectan al ánimo al instante. El LLM sólo recibe el nuevo estado como contexto para el siguiente turno.
2. **Streaming con máquina de escribir.** El texto aparece apenas llega el primer token.
3. **Conversación prefabricada de arranque.** La apertura de cada tramo está escrita a mano y se muestra mientras el modelo genera el resto.
4. **Prellenado anticipado.** Mientras Gerardo habla, se dispara por adelantado la respuesta probable de Tomás.
5. **Animaciones de espera con sentido.** Gerardo suspirando, Tomás rascándose la cabeza: la espera forma parte de la comedia.
6. **Cuota de datos mínima.** El celular manda un cuaternión compacto, no objetos grandes.
7. **Cacheo de casos.** Los 5 tramos tienen datos y condiciones definidos de antemano. El LLM improvisa los diálogos, no los casos, y así los prompts son cortos.

---

## 7. Requisitos y riesgos técnicos

| Riesgo | Mitigación |
|---|---|
| iOS exige HTTPS y un toque para dar permiso a los sensores | Botón "Conectar" explícito. Desarrollo con túnel HTTPS. Producción en Vercel. |
| El celular se bloquea y se cortan los sensores | Wake Lock API activa durante la partida. |
| El giroscopio deriva | Paso de calibración al inicio y botón "recentrar" en el celular. |
| La WiFi del lugar de la demo bloquea el P2P | Conexión de respaldo por WebSocket y, de ser necesario, servidor TURN. Probar en la red de la demo **antes** de presentar. |
| Respuestas inconsistentes del LLM | Salida con formato fijo, validación, y reintento o frase de respaldo si el formato falla. |
| Costo y límites de la API | Respuestas cortas, modelo chico, tope de turnos por tramo. |
| Gerardo revela el dato "por error" | El dato sólo está en el contexto de Gerardo y se valida por código. Pruebas de prompt específicas. |
| Android y iOS se comportan distinto | Probar en al menos un dispositivo de cada sistema desde la semana 1. |

---

## 8. Plan de trabajo (3 semanas, 4 integrantes)

Hay tiempo de sobra, así que el plan deja margen para pulir en la última semana. Las áreas son **a definir** entre el grupo.

### Áreas

| Área | Responsabilidad |
|---|---|
| **A. Control y conexión** | Página del celular, sensores, calibración, WebRTC, QR, respaldo por WebSocket. |
| **B. Motor de juego** | Escena de la oficina, estados, barras, gestos → efectos, lógica de tramos. |
| **C. LLM y backend** | Función serverless, prompts de Gerardo y Tomás, streaming, validación, casos. |
| **D. Narrativa, arte y audio** | Guion, diálogos de respaldo, arte, sonido, pruebas de juego. |

### Cronograma

**Semana 1: la base funciona**
- QR → celular conectado → la orientación mueve un objeto en la PC. *(A)*
- Escena estática de la oficina con Gerardo y Tomás. *(B)*
- Primera llamada al LLM con streaming y un caso de prueba. *(C)*
- Guion cerrado de los 5 tramos y la historia. *(D)*
- **Hito:** se puede mover algo con el celular y se puede hablar con un NPC.

**Semana 2: el juego existe**
- Los 6 gestos con detección fiable. *(A)*
- Barras de paciencia y claridad, reloj, condiciones de victoria y derrota. *(B)*
- Los dos agentes dialogando, el dato secreto y la validación por código. *(C)*
- Arte final de los personajes y la oficina, sonidos. *(D)*
- **Hito:** un tramo completo se puede jugar de principio a fin.

**Semana 3: pulido y entrega**
- Latencia: medición y ajustes. Compatibilidad iOS y Android. *(A + C)*
- Los 5 tramos, el giro narrativo y los finales. *(B + D)*
- Pruebas con gente que no conoce el juego, ajuste de dificultad. *(todos)*
- Prueba en la red real de la presentación. Video de respaldo de la demo. *(todos)*
- **Hito:** versión final desplegada y probada.

### Alcance

| Imprescindible | Deseable | Si sobra tiempo |
|---|---|---|
| QR + sensores + conexión estable | Susurro por micrófono | Final secreto |
| 3 tramos completos | 5 tramos y el giro narrativo | Segunda ambientación |
| Dos LLMs con dato secreto validado | Música y arte final | Ranking local |
| Gestos: mate, tos, sello | Papelito y apuntado | Modo accesibilidad |

---

## 9. Conexión con la materia (IoT)

- El **celular es un dispositivo IoT**: sensores de movimiento transmitiendo en tiempo real.
- Protocolos y transporte: **WebRTC DataChannel** con modos fiable y no fiable, señalización, respaldo por WebSocket.
- Tema de la materia a evaluar: latencia, pérdida de paquetes y frecuencia de muestreo. Se pueden **medir y documentar** los tiempos reales del proyecto.
- Calibración y manejo de la deriva de sensores inerciales.

---

## 10. Cuestiones abiertas

- Nombre definitivo del juego y de la Municipalidad.
- Estilo visual: pixel art, vectorial plano o collage de papeles.
- ¿Habilitamos el micrófono? Depende del soporte de la Web Speech API en iOS.
- Dificultad: ¿modo fácil con ayudas visuales y modo difícil sin pistas?
- Idioma de los diálogos: español rioplatense fijo, o parametrizable.
- Privacidad: qué datos viajan por la red y qué se guarda (idealmente nada).

---

## 11. Cómo correrlo

*(A completar cuando exista el código.)*

```bash
# instalar dependencias
npm install

# desarrollo
npm run dev

# producción
npm run build
```

Variables de entorno necesarias: `ANTHROPIC_API_KEY` (sólo en el servidor, nunca en el cliente).
