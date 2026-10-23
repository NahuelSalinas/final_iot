# Plan de mejoras: Mesa de Entradas

Documento de traspaso para retomar el desarrollo en una sesión nueva. Nace de una revisión crítica del juego (experiencia de producto y jugabilidad) hecha después de implementar el ranking. Está pensado para leerse solo: no hace falta el historial de la conversación anterior.

---

## 1. Contexto mínimo

### Qué es
Juego web de un solo jugador tipo *Papers, Please*. La PC muestra la oficina; el celular, vinculado por QR (WebRTC con PeerJS), es el control por movimiento. Dos NPCs con LLM (Gerardo y Tomás) conversan; el jugador influye con gestos (mate, papelito, sellar, rechazar). Detalle completo en `README.md`.

### Estado actual (rama `feat/juego-base`)
- Juego completo: intro, 5 ventanillas, 4 finales, gestos, LLM con Groq.
- **Ranking arcade implementado y probado de punta a punta:** iniciales con el celular al terminar → `POST /api/score` → Neon (Postgres) → top 10 → aviso a Telegram vía webhook de Make si entra al top 10. Página pública `/ranking.html`.
- Los cambios del ranking **pueden estar sin commitear**: revisar `git status` primero.

### Decisiones ya tomadas (no reabrir)
| Tema | Decisión |
|---|---|
| Base de datos | **Neon (Postgres)**, driver `@neondatabase/serverless` por HTTP. **No** Supabase. |
| Automatización | **Make** (webhook → Telegram). Sin Node-RED ni servicios locales. |
| Protocolos | **HTTP** (API + webhook) y WebRTC. **MQTT solo si hace falta**; hoy no. |
| Infraestructura | Nada debe correr en la PC de los integrantes. Todo en Vercel, Neon y Make. |
| Enfoque | Juego divertido y accesible (cualquiera con celular juega). El profesor aprobó que no resuelva un problema "clásico". |

### Archivos clave
```
src/host/main.ts          lobby (QR), arranque de Phaser
src/host/scene.ts         escena principal (DeskScene) y fin de partida
src/host/puntaje.ts       pantalla de iniciales y tabla de ranking
src/host/conversation.ts  motor de turnos, recursos y estadísticas
src/host/input.ts         InputState, PourDetector (mate)
src/host/gestures.ts      detección de sellar / rechazar / papelito
src/controller/main.ts    celular: sensores, envío a 60 Hz
src/shared/protocol.ts    mensajes y SensorPacket
src/shared/score.ts       estadísticas y fórmula del puntaje
api/score.ts, api/ranking.ts, api/_db.ts   ranking en Neon + aviso a Make
db/schema.sql             esquema de la tabla `partidas`
```

### Cómo trabajar
- `npm run dev:http` (puerto 5174) para probar en el navegador de la PC; `npm run dev` (HTTPS) para el celular real. El servidor de desarrollo también sirve `api/`.
- Verificar siempre con `npm run build` (incluye typecheck).
- En modo desarrollo, `window.__game` expone Phaser. Para forzar un final: `__game.scene.getScene('desk').conv.finish('bueno')`.
- Variables en `.env` (ya en `.gitignore`): `GROQ_API_KEY`, `DATABASE_URL`, `MAKE_WEBHOOK_URL`, opcional `MAKE_WEBHOOK_KEY`. **Nunca imprimir ni commitear valores.**
- Las partidas de prueba contra Neon se borran después (`DELETE FROM partidas WHERE iniciales = 'TST'`).
- **No volver a correr `neon init`**: ya se probó y se revirtió; el proyecto solo usa el driver.
- El `.env` también tiene `NEON_AI_GATEWAY_*` que no se usan (el LLM va por Groq).

---

## 2. Diagnóstico (por qué estos sprints)

1. **Los primeros 30 segundos son fríos:** el lobby es un formulario con QR; no hay título, menú ni ranking visible antes de jugar.
2. **El gesto es el producto y no está validado:** las lecturas llegan crudas, sin filtro ni zona muerta; la banda del mate es de solo 20° (15° a 35°) y los umbrales nunca se probaron en celulares físicos.
3. **Duración contra ranking:** una partida dura ~13 min; los rankings arcade funcionan con 2 a 5 min.
4. **Ranking poco justo y falsificable:** Tomás se equivoca al azar, el LLM varía y el cliente manda las estadísticas.
5. **Fragilidad de conexión:** si el celular se cae a mitad de partida, se pierde.

---

## 3. Sprints

Cada sprint es entregable por sí solo y termina con el juego funcionando. Los criterios de aprobación son comprobables; un sprint no se da por cerrado hasta cumplirlos todos.

### Sprint 0: Cierre de la base (previo a todo)
**Objetivo:** que lo ya hecho esté commiteado, desplegado y probado en un celular real.

**Tareas**
- Revisar y commitear el ranking (Neon + Make) en `feat/juego-base`.
- Cargar `DATABASE_URL`, `MAKE_WEBHOOK_URL`, `GROQ_API_KEY` en Vercel y desplegar.
- Probar una partida completa desde un celular físico (iOS y/o Android) contra la versión desplegada.
- Verificar que el mensaje de Telegram muestre bien el tiempo (el campo usa `{{segundos - floor(segundos / 60) * 60}}`, sin `%`).

**Criterios de aprobación**
- [ ] `git status` limpio y `npm run build` pasa.
- [ ] La URL de Vercel permite jugar de principio a fin con celular real.
- [ ] Una partida terminada aparece en `/ranking.html` de producción.
- [ ] Una partida que entra al top 10 genera el mensaje de Telegram con todos los campos correctos (sin `NaN`).
- [ ] Se anotan en este documento los problemas de gestos detectados en el celular real (insumo del Sprint 1).

---

### Sprint 1: Control del celular fiable
**Objetivo:** que servir mate, sellar, rechazar y elegir letras se sienta preciso y perdone el temblor de la mano.

**Tareas**
- Filtro de baja frecuencia (media móvil exponencial) sobre `gamma`, `beta` y `alpha` antes de usarlos; constante configurable.
- Zona muerta alrededor de 0° y **histéresis** en los umbrales de servir/derramar (entrar a 15° y salir a 12°; derramar a 35° y recuperarse a 32°).
- Misma histéresis en la selección de letras (`PantallaPuntaje`), para que no salte entre letras con el pulso.
- Gestos: suavizar o validar la aceleración (ventana corta de 2 a 3 muestras) y manejar `acceleration === null` usando `accelerationIncludingGravity` menos la gravedad estimada.
- Ajustar umbrales de `gestures.ts` con datos de un celular real; documentar los valores finales y el modelo probado.
- Modo depuración opcional (`?debug`) que muestre roll filtrado, picos de aceleración y último gesto, para calibrar sin adivinar.

**Criterios de aprobación**
- [ ] Con el celular sostenido quieto a 25° durante 30 s: 0 derrames, 1 servido por cada ciclo de 1 s sostenido, y sin parpadeo de estado.
- [ ] Con el celular quieto en la mano durante 30 s: 0 gestos falsos (sellar, rechazar o papelito).
- [ ] 20 sellos intencionales seguidos: ≥ 18 detectados. Lo mismo para rechazar y papelito (≥ 18/20).
- [ ] Elegir las iniciales `NAH` inclinando el celular se logra en menos de 20 s sin errores de salto de letra.
- [ ] Verificado en al menos un celular Android y uno iOS (o se documenta cuál falta).
- [ ] `npm run build` pasa y el modo teclado sigue funcionando igual.

---

### Sprint 2: Pantalla de inicio
**Objetivo:** una primera impresión con identidad, y acceso al ranking sin jugar.

**Tareas**
- Nueva escena `MenuScene` entre la conexión del celular y la intro, con título, la oficina de fondo y tres opciones: **JUGAR**, **RANKING**, **CÓMO SE JUEGA**.
- Navegación con el celular: inclinar izquierda/derecha cambia de opción, sello elige, rechazo vuelve. Mismo esquema con flechas, T y R en la PC.
- Pantalla de ranking dentro del juego, que lea `/api/ranking` (top 10) y tenga estado vacío y de error claros.
- "Cómo se juega": resumen de los cuatro gestos en una pantalla, sin repetir la capacitación.
- La capacitación se salta si el jugador ya la hizo en esta sesión (opción "saltar intro" visible).
- Al terminar una partida y ver la tabla, poder volver al menú además de jugar de nuevo.
- Texto del celular acorde a cada pantalla (`phone.say`).

**Criterios de aprobación**
- [ ] Al conectar el celular se ve el título y el menú, no la intro directa.
- [ ] Se puede ver el ranking sin iniciar una partida, usando solo el celular.
- [ ] JUGAR lleva a la intro; en la segunda partida de la sesión no obliga a repetir la capacitación.
- [ ] Sin base de datos o sin conexión, la pantalla de ranking muestra un mensaje claro y no se cuelga.
- [ ] Todas las pantallas del menú son operables sin celular (teclado).
- [ ] Se ve bien en una ventana de 1280×720 y en una de 800×600.
- [ ] `npm run build` pasa.

---

### Sprint 3: Partida corta y ranking justo
**Objetivo:** rejugabilidad y un ranking creíble.

**Tareas**
- **Modo corto:** 3 ventanillas, reloj proporcional (~5 min). El modo completo se mantiene. Se elige en el menú.
- Migración de base de datos: agregar columna `modo` (`'corto' | 'completo'`) a `partidas`, con `DEFAULT 'completo'` para no romper filas existentes. Ranking y página pública separados por modo.
- Ajustar la fórmula de puntaje y las validaciones del servidor (`tramos`, tiempo mínimo) según el modo; actualizar `src/shared/score.ts`.
- **Integridad básica:** `POST /api/start` que devuelve un identificador de partida con la hora de inicio; `POST /api/score` lo exige y verifica que el tiempo declarado sea coherente con el real transcurrido y que no se reutilice. Las partidas sin identificador válido se rechazan.
- Reducir la varianza injusta: que la decisión de "Tomás se equivoca en esta anotación" use una semilla por partida (enviada junto con el identificador), de modo que sea reproducible.

**Criterios de aprobación**
- [ ] Una partida en modo corto se puede completar en 5 min ± 1 min y termina en la pantalla de iniciales.
- [ ] La migración se aplica sobre la base con datos existentes sin perder filas (`SELECT count(*)` antes y después coincide).
- [ ] `/ranking.html` y la API muestran por separado los dos modos.
- [ ] Reenviar el mismo identificador de partida dos veces devuelve error la segunda vez.
- [ ] Una partida con tiempo declarado mucho menor al real (p. ej. 10 s para 3 ventanillas) es rechazada.
- [ ] Dos partidas con la misma semilla producen la misma secuencia de errores de Tomás (comprobado con el modo sin LLM).
- [ ] `npm run build` pasa.

---

### Sprint 4: Resiliencia, datos y entrega
**Objetivo:** que no se rompa en la demo y que el trabajo cubra los criterios de evaluación de la materia.

**Tareas**
- **Reconexión del celular sin perder la partida:** al caerse el enlace, el juego se pausa con un aviso; al volver a escanear/recargar con la misma sala, retoma. Si pasan más de N segundos, vuelve al menú.
- **Script en Python** que simule jugadores (genera partidas variadas y las envía a `/api/score` con identificador válido). Sirve para poblar el ranking y para la parte de "dispositivos y datos simulados".
- **Dashboard opcional** con Grafana Cloud conectado a Neon: partidas por día, finales más frecuentes, tasa de sellos mal. Solo si hay tiempo y sin servicios locales.
- **Documento de entrega** que mapee el proyecto a los criterios: problema (juego distinto y accesible, aprobado por el profesor), herramientas (Make), dispositivos y datos (sensores del celular + simulación Python), base de datos (Neon), protocolos (HTTP y WebRTC; MQTT descartado con la razón).
- Plan de contingencia de la demo: video de respaldo, prueba en la red real de la presentación y modo teclado listo.

**Criterios de aprobación**
- [ ] Cortar el WiFi del celular 10 s a mitad de partida y recuperarlo no pierde la partida; la pausa y el aviso se ven.
- [ ] El script de Python carga 50 partidas con una sola ejecución y todas aparecen en el ranking y la base.
- [ ] El documento de entrega tiene una sección por cada criterio obligatorio con evidencia (capturas o salidas).
- [ ] Existe un video de la partida completa de respaldo.
- [ ] Se ejecutó una prueba completa en la red donde se hará la demo.
- [ ] (Opcional) El dashboard de Grafana muestra datos reales de la base.

---

## 4. Definición de terminado (aplica a todos los sprints)
- `npm run build` pasa sin errores de tipos.
- Verificado en el navegador (y en celular real cuando el sprint toca sensores).
- Sin secretos en el código ni en los commits; las variables nuevas figuran en `.env.example`.
- README actualizado si cambia cómo se juega, se configura o se despliega.
- Datos de prueba borrados de la base.
- Commit con mensaje claro en la rama de trabajo.

## 5. Fuera de alcance (a propósito)
- MQTT y ESP32/Wokwi, salvo que algún criterio de evaluación termine exigiéndolo.
- Servicios que corran en las PC del equipo (Node-RED, Grafana local, brokers propios).
- Autenticación de usuarios y cuentas.
- Anti-trampas fuerte: el Sprint 3 solo sube el costo de falsear, no lo impide.

## 6. Riesgos conocidos
| Riesgo | Mitigación |
|---|---|
| Los umbrales de gestos no sirven en otros modelos de celular | Modo `?debug` del Sprint 1; botones de respaldo siempre disponibles |
| La Wi-Fi de la demo bloquea WebRTC | Probar en esa red (Sprint 4); considerar TURN si falla |
| Límites del plan gratuito de Make u operaciones agotadas | Solo se avisa el top 10; revisar el consumo antes de la demo |
| Cold start de Neon al primer guardado | Aceptable para este uso; probar el primer guardado antes de la demo |
| La URL del webhook de Make se pegó en un chat | Regenerarla o activar API key (`MAKE_WEBHOOK_KEY`) antes de publicar el repo |
