import { streamDialogue, type Control } from '../shared/dialogue';
import type { Accion } from '../shared/protocol';
import type { Stats } from '../shared/score';
import { CASOS_CLIENTE, RELOJ, type FinalKey } from './casos';
import { mockCheck, mockDialogue } from './mock';
import type { Sfx } from './audio';

export type Quien = 'gerardo' | 'tomas';
export type Tono = 'info' | 'ok' | 'warn';

export interface Hooks {
  /** `final` es false mientras el texto llega en streaming. `revela` marca la línea donde Gerardo dijo el dato. */
  speak(who: Quien, text: string, final: boolean, revela?: boolean): void;
  thinking(who: Quien): void;
  planilla(text: string | null, status: 'pendiente' | 'ok' | 'mal'): void;
  tramo(i: number): void;
  toast(msg: string, tono?: Tono): void;
  fx(name: Sfx): void;
  end(r: FinalKey): void;
}

// Balance. Se concentra acá para poder afinar la dificultad en un solo lugar.
const BUSY_DECAY = 0.4; // mientras se espera al LLM la paciencia baja más lento
const READING_DECAY = 0.5; // y también mientras se lee: no se castiga leer
const MATE_SECS = 25;
const MATE_PATIENCE = 12;
const PAPELITO_COST = 3;
const SELLO_MAL_COST = 15;
const RECHAZO_MAL_COST = 10;
const SPILL_COST = 5;
const MEMORIA = 7; // líneas de charla que se le pasan al LLM (tope del servidor: 8)
const ERROR_DECAY = 0.3; // después de cada anotación Tomás se equivoca menos

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Decision = 'sellar' | 'rechazar';

/**
 * Motor de la conversación. Decide de quién es el turno, qué estado se le pasa a cada LLM
 * y qué pasa con la respuesta. Las reglas viven acá; el LLM solo pone las palabras.
 */
export class Conversation {
  tramo = 0;
  patience = 70;
  claridad = 35;
  relacion = 50;
  cebadas = 3;
  papelitos = 3;
  mate = 0; // segundos restantes del efecto
  elapsed = 0; // segundos de juego (alimenta el reloj de la pared)
  usingMock = false;
  ended = false;
  busy = false;
  reading = false;
  awaitingDecision = false;
  /** La planilla está sobre la mesa (decidiendo, verificando o mostrando el resultado): no se cebe mate ni se pasan papelitos. */
  planillaAbierta = false;
  /** Apertura de la primera conversación: los gestos que lleguen todavía son ruido (celular recién conectado, restos del menú). */
  arrancando = false;
  /** Contadores de la partida completa (no se reinician entre ventanillas). */
  completados = 0;
  private cont = { sellosMal: 0, rechazosOk: 0, rechazosMal: 0, mates: 0, derrames: 0, papelitos: 0 };

  private papelito: string | null = null;
  private pistaIdx = 0;
  private history: { who: Quien | 'ciudadano'; text: string }[] = [];
  private pendingAnota: string | null = null;
  private decide?: (d: Decision) => void;
  private errarChance = 0;
  private errarProx = false;
  private runId = 0;

  constructor(private h: Hooks) {}

  get bloqueado() {
    return this.awaitingDecision || this.planillaAbierta || this.arrancando;
  }

  /** Minutos del día en el reloj de la pared. */
  hora(): number {
    return RELOJ.inicioMin + (this.elapsed * (RELOJ.cierreMin - RELOJ.inicioMin)) / RELOJ.segundosReales;
  }

  newGame() {
    this.elapsed = 0;
    this.relacion = 50;
    this.completados = 0;
    this.cont = { sellosMal: 0, rechazosOk: 0, rechazosMal: 0, mates: 0, derrames: 0, papelitos: 0 };
    this.usingMock = false;
    this.arrancando = true;
    this.start(0);
  }

  start(tramo: number) {
    this.runId++;
    this.ended = false;
    this.tramo = tramo;
    const c = CASOS_CLIENTE[tramo];
    this.patience = c.animoInicial;
    this.claridad = c.claridadInicial;
    this.cebadas = c.dif.cebadas;
    this.papelitos = c.dif.papelitos;
    this.mate = 0;
    this.papelito = null;
    this.pistaIdx = 0;
    this.pendingAnota = null;
    this.awaitingDecision = false;
    this.planillaAbierta = false;
    this.errarChance = c.dif.errorProb;
    this.errarProx = Math.random() < this.errarChance;
    this.history = [];
    this.busy = false;
    this.h.planilla(null, 'pendiente');
    void this.loop(this.runId);
  }

  addPatience(d: number) {
    if (this.ended) return;
    this.patience = clamp(this.patience + d, 0, 100);
    if (this.patience <= 0) this.finish('persiana');
  }

  addRelacion(d: number) {
    this.relacion = clamp(this.relacion + d, 0, 100);
  }

  /** El jugador terminó de servir el mate. */
  servirMate() {
    if (this.ended) return;
    if (this.cebadas <= 0) {
      this.h.toast('No queda yerba en esta ventanilla', 'warn');
      return;
    }
    this.cebadas--;
    this.cont.mates++;
    this.mate = MATE_SECS;
    this.addPatience(MATE_PATIENCE);
    this.addRelacion(4);
    this.h.fx('mate');
    this.h.toast('Gerardo acepta el mate: +paciencia', 'ok');
  }

  /** Se derramó: castigo y se pierde la cebada. */
  derramar() {
    if (this.ended) return;
    this.h.fx('derrame');
    this.cont.derrames++;
    this.addPatience(-SPILL_COST);
    this.addRelacion(-4);
    this.cebadas = Math.max(0, this.cebadas - 1);
    this.h.toast('¡Se derramó el mate! −paciencia, −1 cebada', 'warn');
  }

  /** Reacciones locales a las acciones: no esperan al LLM. */
  accion(a: Accion) {
    if (this.ended) {
      if (a === 'sellar') this.newGame();
      return;
    }
    // con el formulario sobre la mesa sólo se sella o se rechaza: nada de mates ni papelitos de fondo
    if (this.bloqueado && (a === 'mate' || a === 'papelito')) return;
    if (a === 'mate') return this.servirMate();

    if (a === 'sellar' || a === 'rechazar') {
      if (this.decide) this.decide(a);
      else this.h.toast(a === 'sellar' ? 'Todavía no hay nada para sellar' : 'Todavía no hay nada para rechazar', 'warn');
      return;
    }

    // papelito
    const pista = CASOS_CLIENTE[this.tramo].pistas[this.pistaIdx];
    if (this.papelitos <= 0 || !pista) {
      this.h.toast('No te quedan papelitos', 'warn');
      return;
    }
    this.papelitos--;
    this.cont.papelitos++;
    this.pistaIdx++;
    this.papelito = pista;
    this.claridad = clamp(this.claridad + 25, 0, 100);
    this.addPatience(-PAPELITO_COST);
    this.h.fx('papelito');
    this.h.toast(`Papelito para Tomás: "${pista}"`, 'info');
  }

  tick(dt: number) {
    if (this.ended) return;
    this.elapsed += dt;
    this.mate = Math.max(0, this.mate - dt);
    const decay = CASOS_CLIENTE[this.tramo].dif.decay;
    this.addPatience(-decay * dt * (this.busy ? BUSY_DECAY : this.reading ? READING_DECAY : 1));
    if (this.hora() >= RELOJ.cierreMin) this.finish('cierre');
  }

  // --- bucle de turnos -------------------------------------------------

  private alive(id: number) {
    return !this.ended && id === this.runId;
  }

  private async loop(id: number) {
    const caso = CASOS_CLIENTE[this.tramo];
    this.h.tramo(this.tramo);
    this.say('tomas', caso.apertura);
    await this.leer(caso.apertura);
    if (id === this.runId) this.arrancando = false;

    while (this.alive(id)) {
      const g = await this.turn('gerardo', id);
      if (!this.alive(id)) return;
      await this.leer(g);

      const t = await this.turn('tomas', id);
      if (!this.alive(id)) return;
      await this.leer(t);

      if (this.pendingAnota) {
        const anotado = this.pendingAnota;
        this.planillaAbierta = true;
        this.h.planilla(anotado, 'pendiente');
        this.h.fx('paso');
        const d = await new Promise<Decision>((r) => {
          this.awaitingDecision = true;
          this.decide = r;
        });
        this.awaitingDecision = false;
        this.decide = undefined;
        if (!this.alive(id)) return;

        const ok = await this.verificar(anotado);
        if (d === 'sellar' && ok) return void (await this.avanzar(id, anotado));

        if (d === 'sellar') {
          // Sellaste algo mal anotado.
          this.h.fx('mal');
          this.h.planilla(anotado, 'mal');
          this.h.toast('¡Sellaste un dato incorrecto! −paciencia', 'warn');
          this.cont.sellosMal++;
          this.addPatience(-SELLO_MAL_COST);
          this.addRelacion(-8);
          this.history.push({ who: 'ciudadano', text: '(El ciudadano selló la planilla y salió rechazada: el dato estaba mal.)' });
        } else if (ok) {
          // Rechazaste algo que estaba bien.
          this.h.fx('mal');
          this.h.toast('¡Estaba bien! Gerardo odia que le hagan perder el tiempo', 'warn');
          this.cont.rechazosMal++;
          this.addPatience(-RECHAZO_MAL_COST);
          this.addRelacion(-5);
          this.history.push({ who: 'ciudadano', text: '(El ciudadano devolvió la planilla, pero el dato estaba bien.)' });
        } else {
          // Rechazaste algo mal anotado: bien visto.
          this.h.fx('rechazar');
          this.h.toast('Bien visto: Tomás lo anotó mal. Lo intenta de nuevo', 'ok');
          this.cont.rechazosOk++;
          this.addRelacion(3);
          this.claridad = clamp(this.claridad + 10, 0, 100);
          this.history.push({ who: 'ciudadano', text: '(El ciudadano devolvió la planilla: el dato estaba mal anotado.)' });
        }
        this.pendingAnota = null;
        // La primera ventanilla enseña la mecánica: después del primer error, Tomás anota bien.
        this.errarChance = this.tramo === 0 ? 0 : this.errarChance * ERROR_DECAY;
        this.errarProx = Math.random() < this.errarChance;
        await sleep(1400);
        this.planillaAbierta = false;
        this.h.planilla(null, 'pendiente');
      }
    }
  }

  private async avanzar(id: number, anotado: string) {
    this.h.planilla(anotado, 'ok');
    this.h.fx('ok');
    this.h.toast('¡Dato correcto! Ventanilla superada', 'ok');
    this.completados++;
    this.addRelacion(2);
    await sleep(1800);
    if (!this.alive(id)) return;
    if (this.tramo + 1 < CASOS_CLIENTE.length) this.start(this.tramo + 1);
    else this.finish(this.relacion >= 50 ? 'bueno' : 'justo');
  }

  /** Pausa para que el texto se escriba y se pueda leer. */
  private async leer(text: string) {
    this.reading = true;
    await sleep(readTime(text));
    this.reading = false;
  }

  private say(who: Quien, text: string) {
    this.history.push({ who, text });
    this.h.speak(who, text, true);
  }

  private async turn(who: Quien, id: number): Promise<string> {
    this.busy = true;
    this.h.thinking(who);
    const body = {
      tramo: this.tramo,
      who,
      estado: {
        animo: Math.round(this.patience),
        claridad: this.claridad,
        relacion: Math.round(this.relacion),
        mate: this.mate > 0,
        papelito: this.papelito,
        errar: this.errarProx,
      },
      history: this.memoria(),
    };
    const onText = (t: string) => this.alive(id) && this.h.speak(who, t, false);

    let res: { texto: string; control: Control };
    try {
      res = this.usingMock ? await mockDialogue(body, onText) : await streamDialogue(body, onText);
    } catch {
      if (!this.usingMock) this.h.toast('No hay conexión con el LLM: se usa el modo de prueba', 'warn');
      this.usingMock = true;
      res = await mockDialogue(body, onText);
    }
    this.busy = false;
    if (!this.alive(id)) return '';

    const { texto, control } = res;
    this.history.push({ who, text: texto });
    this.h.speak(who, texto, true, who === 'gerardo' && control.revela);
    if (who === 'gerardo') {
      this.addPatience(clamp(control.animo, -15, 10));
    } else {
      this.papelito = null;
      if (control.anota) this.pendingAnota = control.anota;
    }
    return texto;
  }

  /**
   * Lo que recuerda el LLM: la apertura del trámite (fija, para no perder el tema) y las últimas
   * líneas. Una charla más larga empuja a los modelos a repetirse y a arrastrar errores viejos.
   */
  private memoria() {
    const h = this.history;
    return h.length > MEMORIA ? [h[0], ...h.slice(-(MEMORIA - 1))] : h;
  }

  private async verificar(anotado: string): Promise<boolean> {
    if (this.usingMock) return mockCheck(this.tramo, anotado);
    try {
      const r = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tramo: this.tramo, anotado }),
      });
      if (!r.ok) throw new Error(String(r.status));
      return ((await r.json()) as { correcto: boolean }).correcto;
    } catch {
      this.usingMock = true;
      return mockCheck(this.tramo, anotado);
    }
  }

  /** Estadísticas de la partida para el puntaje. */
  stats(final: FinalKey): Stats {
    return { final, tramos: this.completados, relacion: Math.round(this.relacion), segundos: Math.round(this.elapsed), ...this.cont };
  }

  private finish(r: FinalKey) {
    if (this.ended) return;
    this.ended = true;
    this.decide?.('rechazar');
    this.h.fx(r === 'bueno' || r === 'justo' ? 'ganar' : 'perder');
    this.h.end(r);
  }
}

/** Caracteres por segundo con que se escribe cada línea en pantalla. */
export const CPS = 34;

/** Lo que tarda en escribirse la línea más una pausa de lectura proporcional a su largo. */
function readTime(text: string): number {
  const escritura = (text.length / CPS) * 1000;
  const lectura = Math.max(2000, 1200 + text.length * 30);
  return escritura + lectura;
}
