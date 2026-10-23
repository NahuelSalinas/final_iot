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
| **Vos** | Ciudadano en la fila | Mudo. Solo actuás con gestos del celular y, si se habilita, con susurros por micrófono. |

### Ranking, base de datos y avisos

Al terminar una partida se anotan 3 iniciales inclinando el celular (sello confirma, rechazo borra), al estilo arcade. El juego manda las **estadísticas** de la partida a `POST /api/score`; el **servidor calcula el puntaje** (`src/shared/score.ts`), la guarda en **Neon (Postgres)** y devuelve el top 10. `GET /api/ranking` alimenta la página `/ranking.html`, pensada para proyectar en la demo.

Si la partida entra al top 10, el servidor llama a un **webhook de Make** que envía un aviso por **Telegram** (no se corre nada en la PC). Sin `DATABASE_URL` el juego funciona igual, solo sin ranking.

Puesta en marcha (una sola vez):

1. Crear un proyecto en Neon y correr `db/schema.sql` en su SQL Editor.
2. Poner `DATABASE_URL` en `.env.local` (y como variable de entorno en Vercel).
3. En Make: escenario con módulo **Webhooks → Custom webhook** y un módulo **Telegram Bot → Send a Text Message or a Reply**. Poner la URL del webhook en `MAKE_WEBHOOK_URL`. El payload trae `iniciales`, `puntaje`, `posicion`, `final`, `tramos`, `segundos` y `esRecord` (un *router* puede mandar un mensaje distinto si `esRecord` es true).

Puntaje: 1000 por ventanilla, +10 por punto de relación, +150 por rechazo acertado, +2 por segundo sobrante al ganar, bonus por final (Escritura firmada +2000, Por el pelo +500), y resta por sellos mal (−100), rechazos de más (−75), mates derramados (−50) y papelitos (−30).

### Estructura: 5 ventanillas = 5 "tramos" del trámite

Cada tramo es un caso corto (2 a 4 minutos) con un **dato secreto distinto** que Gerardo conoce y Tomás debe anotar:

1. **Formulario correcto** (el número y la letra).
2. **Oficina y piso** donde se firma.
3. **Sello requerido** y de qué área.
4. **Horario de atención** de esa oficina (casi siempre es "una ventana de 20 minutos").
5. **Expediente madre**: el dato final, que solo se obtiene si la relación con Gerardo es buena.

### Giro narrativo

En el tramo 5 se revela que Gerardo **tomaba mate con tu abuela Nelly** todas las tardes frente al kiosco, y que su desgano es en parte porque la extraña. Si lo tratás bien durante los tramos anteriores (mate bien servido, no interrumpirlo de más), él mismo te da el dato y un favor extra. Si lo irritaste, hay que ganárselo de otra forma.

### Finales

| Final | Condición |
|---|---|
| **Escritura firmada** | Las 5 ventanillas superadas y relación con Gerardo ≥ 50 al terminar. Revela que le fiaba alfajores a Nelly. |
| **Por el pelo** | Las 5 ventanillas superadas pero con relación < 50 al terminar. Sello a las 12:59 y sin cariño. |
| **Vuelva mañana** | La paciencia de Gerardo llega a 0 en cualquier ventanilla. |
| **Se acabó la hora** | El reloj marca las 13:00. |

El tono es **humor cotidiano rioplatense** (mate, "vuelva mañana", "falta un sello"), con exageración leve.

---

## 3. Cómo se juega

### Flujo

1. Abrís el juego en la PC. Aparece un **QR** con el código de sala.
2. Escaneás el QR con el celular (misma red WiFi), tocás **Conectar** y aceptás los permisos de movimiento.
3. **Historia** (3 tarjetas) y **capacitación**: el juego te enseña cada gesto y no avanza hasta que lo hacés. Si un gesto no sale, hay un botón en el celular y una tecla en la PC.
4. Cinco ventanillas. En cada una, Tomás le pregunta cosas a Gerardo. Cuando Gerardo dice el dato (la línea queda marcada con ★), Tomás lo anota en la **planilla**.
5. **Vos decidís**: si lo anotado coincide con lo que dijo Gerardo, **sellás**; si no, **rechazás**. Tomás se equivoca a propósito algunas veces, y esa es la mecánica central.

### Acciones

| Acción | Gesto | Botón del celular | Tecla | Efecto |
|---|---|---|---|---|
| **Servir mate** | Inclinar entre 15° y 35° durante 1 s | SERVIR MATE | M | +12 paciencia, Gerardo más blando 25 s, +relación. Gasta una cebada. Pasarte de 35° lo derrama (−5 paciencia, −relación, se pierde la cebada). |
| **Papelito** | Empujón hacia adelante | PAPELITO | F | Pista para Tomás: +25 de atención. Cuesta 3 de paciencia. Cantidad limitada por ventanilla. |
| **Sellar** | Golpe seco hacia abajo | SELLAR | T / Espacio | Aprueba la planilla. Si el dato es correcto, pasás de ventanilla; si no, −15 paciencia y −relación. |
| **Rechazar** | Sacudir de lado a lado | RECHAZAR | R | Devuelve la planilla. Bien hecho si estaba mal anotada (+relación, Tomás reintenta). Si estaba bien: −10 paciencia y −relación. |

### Ritmo de lectura

El texto se escribe en pantalla a unos 34 caracteres por segundo y, al terminar, la conversación espera una pausa proporcional al largo de la línea (mínimo 2 s) antes de que hable el otro. Mientras se lee, la paciencia de Gerardo baja a la mitad de velocidad, para no castigar al jugador por leer. Los avisos duran más cuanto más largos son.

### Qué se ve en pantalla

- **Panel superior:** paciencia de Gerardo, atención de Tomás, cebadas y papelitos que quedan, y el **reloj**: arranca 11:00 y la Municipalidad cierra a las 13:00.
- **Cuadro de diálogo:** las últimas líneas de la charla, con colores por personaje y el **objetivo** de la ventanilla arriba. Nada desaparece de golpe.
- **Barra de consejo:** una línea que dice qué conviene hacer ahora (servir mate, tirar un papelito, decidir sobre la planilla).
- **Planilla:** cuando Tomás anota algo aparece una tarjeta al centro con lo anotado y las dos opciones.
- **Celular:** muestra la misma instrucción en grande, confirma cada gesto y vibra (en Android).

### Dificultad creciente de verdad

| Ventanilla | Decaimiento de paciencia | Prob. de que Tomás anote mal | Papelitos | Cebadas |
|---|---|---|---|---|
| 1 · Formulario | 0,4 /s | 100 % (se usa para enseñar) | 3 | 3 |
| 2 · Oficina y piso | 0,5 /s | 60 % | 2 | 3 |
| 3 · Sello | 0,6 /s | 70 % | 3 | 3 |
| 4 · Horario | 0,7 /s | 75 % | 3 | 3 |
| 5 · Expediente madre | 0,8 /s | 80 % | 3 | 3 |

Además, Gerardo exige más ánimo para hablar en cada ventanilla, y en la última **solo colabora de verdad si la relación con él es buena** (≥ 50). El reloj es global: 13 minutos reales (780 s) equivalen a las 2 horas de la oficina.

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

- El dato secreto vive solo en el prompt de Gerardo y en el estado del servidor.
- Gerardo "revela" solo si se cumplen condiciones del caso (pregunta precisa, ánimo mínimo, mate reciente).
- El éxito se comprueba comparando lo que Tomás **escribe en la planilla** contra el dato real, con una comparación normalizada y sin pedirle al modelo que juzgue.
- Los efectos de los gestos sobre el ánimo se calculan localmente, sin pasar por el LLM.

### Modelo

**Groq** (inferencia muy rápida, con plan gratuito), llamado desde una función serverless para no exponer la API key. Por defecto `openai/gpt-oss-120b` (~500 tok/s); con `GROQ_MODEL=openai/gpt-oss-20b` (~1000 tok/s) la respuesta llega al doble de rápido a costa de algo de calidad en el humor. Se usa `reasoning_effort: low` y sin devolver el razonamiento, para bajar la latencia. Respuestas cortas (1 a 2 frases).

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
| LLM | Groq (`openai/gpt-oss-120b`, API compatible con OpenAI) vía función serverless en Vercel, con `fetch` y sin SDK |
| Hosting | Vercel (HTTPS incluido, requisito de los sensores en iOS) |
| Audio | Web Audio API, efectos propios y música libre |

---

## 6. Prioridad: baja latencia

La latencia se trata como requisito de diseño. Se separan **dos tipos de interacción**, con presupuestos distintos.

### Presupuesto

| Camino | Objetivo | Cómo se logra |
|---|---|---|
| Gesto → reacción visual | **< 50 ms** | Datos por WebRTC peer-to-peer, sin pasar por servidor. El efecto (derramar, sellar) se calcula **localmente** en la PC. |
| Orientación continua | 60 Hz | Canal **no ordenado** (`ordered: false`): un paquete perdido no frena a los siguientes, y en la PC se descarta lo que llega más viejo que lo ya visto. PeerJS no permite fijar `maxRetransmits`, así que los reintentos del canal siguen activos. |
| Pregunta → primera palabra del LLM | **< 800 ms** | Streaming, modelo chico, prompt corto, `max_tokens` bajo. |
| Cambio de estado por gestos | instantáneo | No depende del LLM. |

### Tácticas

1. **Los gestos nunca esperan al LLM.** El mate, la tos y el sello afectan al ánimo al instante. El LLM solo recibe el nuevo estado como contexto para el siguiente turno.
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
| Gerardo revela el dato "por error" | El dato solo está en el contexto de Gerardo y se valida por código. Pruebas de prompt específicas. |
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

## 10. Decisiones y cuestiones abiertas

### Decididas

| Tema | Decisión |
|---|---|
| Estilo visual | **Pixel art**, sprites chicos y paleta acotada para mantener cohesión. |
| Micrófono | **Extra opcional.** Se implementa solo si sobra tiempo, con respaldo si el navegador no soporta la Web Speech API (Safari/iOS es irregular). Ninguna mecánica esencial depende de él. |
| Dificultad | **Creciente por tramo**, sin selector. Cada ventanilla es más exigente que la anterior (Gerardo menos paciente, preguntas más precisas, ventanas de tiempo más cortas). |
| Idioma | **Español rioplatense fijo** (voseo, mate, modismos). Simplifica los prompts y da identidad al humor. |

### Abiertas

- Nombre definitivo del juego y de la Municipalidad.
- Privacidad: qué datos viajan por la red y qué se guarda (idealmente nada).

---

## 11. Cómo correrlo

```bash
npm install
cp .env.example .env.local   # completar GROQ_API_KEY (solo servidor; también se lee de .env)
```

| Comando | Para qué |
|---|---|
| `npm run dev` | Servidor con **HTTPS** (certificado autofirmado) en `https://<IP-de-tu-PC>:5173`. Es el que hay que usar con un celular real. La primera vez el celular pedirá aceptar el certificado. **Sirve también las funciones de `api/`** (LLM) sin necesidad de Vercel: la clave se lee de `.env` o `.env.local` en cada pedido, sin reiniciar. |
| `npm run dev:http` | Mismo servidor sin HTTPS, en el puerto 5174, para probar en el navegador de la PC. |
| `npm run build` | Typecheck y build de producción. |

Para producción, las carpetas `api/` se despliegan tal cual como funciones serverless en Vercel. Variables de entorno: `GROQ_API_KEY` (obligatoria), `DATABASE_URL`, `MAKE_WEBHOOK_URL` y `MAKE_WEBHOOK_KEY` (opcionales, ver `.env.example`).

Para jugar: abrir la PC en `/`, escanear el QR con el celular (misma red WiFi) y tocar **Conectar**. Sin celular, el botón "Jugar sin celular" habilita el teclado: `←/→` inclinar, `S` sacudir, `F` lanzar, `T` sellar, `C` recentrar.

### Estructura

```
index.html, controller.html     entradas de la PC y del celular
src/shared/protocol.ts          mensajes y constantes de red
src/shared/dialogue.ts          cliente del LLM (streaming + bloque de control)
src/controller/main.ts          sensores, permisos, Wake Lock, envío a 60 Hz
src/host/net.ts                 receptor WebRTC (PeerJS), descarta paquetes viejos
src/host/gestures.ts            detección de sacudida, lanzamiento y sellado
src/host/input.ts               estado de entrada y calibración
src/host/scene.ts               la ventanilla: HUD, diálogo, planilla, finales
src/host/intro.ts               historia y capacitación interactiva
src/host/conversation.ts        motor: turnos, recursos, dificultad, reloj
src/host/casos.ts               los 5 tramos: dato, dificultad, consejos y reloj
src/host/boot.ts, ui.ts         carga de la escena y piezas de interfaz
src/host/phone.ts, mock.ts      vista del celular en pantalla y modo sin LLM
src/host/art.ts, audio.ts       arte pixel art y sonido generados en código
api/dialogue.ts, api/check.ts   funciones serverless: LLM y validación del dato
api/_cases.ts, api/_prompts.ts  casos secretos y prompts de Gerardo y Tomás
api/_llm.ts, api/_guard.ts      cliente de Groq y límite de ritmo
api/_db.ts                      conexión a Neon
docs/PLAN-MEJORAS.md            plan de mejoras pendiente
api/score.ts, api/ranking.ts    guardar partida (Neon + aviso a Make) y top
src/host/puntaje.ts             pantalla de iniciales y tabla de fin de partida
src/shared/score.ts             estadísticas y fórmula del puntaje
db/schema.sql, ranking.html     esquema de la base y página pública del ranking
```

### Estado

Hecho:
- Conexión por QR, sensores a 60 Hz por canal no ordenado, calibración y detección de gestos.
- **Introducción y capacitación interactiva** (historia en 3 tarjetas, 4 pasos que exigen hacer cada gesto).
- **5 ventanillas jugables**, 4 finales, reloj global, relación con Gerardo.
- **Decisión real:** Tomás se equivoca a propósito y el jugador tiene que sellar o rechazar.
- **Recursos finitos** (cebadas y papelitos) y dificultad creciente.
- **Arte pixel art dibujado en código** (personajes con expresiones, oficina, mostrador, mate), fuentes pixeladas y **efectos de sonido sintetizados**.
- **Diálogo legible**: historial con colores, objetivo siempre visible, consejo contextual, marca ★ en la línea del dato.
- **Celular con feedback**: instrucciones en vivo, confirmación de gestos, vibración y botones de respaldo.
- Endpoints del LLM con streaming, límite de ritmo, validación del dato por código y prompts con personalidad, reglas de variedad y pistas ocultas en las quejas de Gerardo.
- **Modo sin LLM** (`src/host/mock.ts`) si `/api` no responde; lo avisa en pantalla.

Verificado: typecheck y build; partidas en el navegador con el modo de prueba y con **Groq real** (`openai/gpt-oss-120b`: respuestas en 0,5 a 0,8 s, formato de control correcto, errores de Tomás y rechazo de datos mal anotados, avance de ventanillas); la capacitación en dos tamaños de ventana; conexión del celular simulado en ambos sentidos.

**No verificado:** los umbrales de los gestos con celulares físicos (iOS y Android), el sonido (no se pudo escuchar), una partida humana completa con el LLM, el final de la partida contra Groq real y el despliegue en producción.

Pendiente: probar con el LLM y celulares reales y ajustar, música de fondo, animaciones de entrada de los personajes, accesibilidad (tamaños y contraste de la capacitación), despliegue en Vercel.
