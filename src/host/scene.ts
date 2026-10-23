import Phaser from 'phaser';
import type { Accion } from '../shared/protocol';
import { STAGE_H, STAGE_W, personaKey, type Estado } from './art';
import { sfx, type Sfx } from './audio';
import { CASOS_CLIENTE, FINALES, RELOJ, type FinalKey } from './casos';
import { Conversation, CPS, type Quien, type Tono } from './conversation';
import { PourDetector, type InputState } from './input';
import { PantallaPuntaje } from './puntaje';
import { calcularPuntaje, type Stats } from '../shared/score';
import { phone } from './phone';
import { ACCION_LABEL, bindKeys, COL, FONT, FONT_TITLE, fitText, tiltFromKeys } from './ui';

interface Linea {
  who: Quien;
  text: string;
  final: boolean;
  revela: boolean;
  /** caracteres ya escritos en pantalla (efecto máquina de escribir) */
  shown: number;
  obj: Phaser.GameObjects.Text;
}

const NOMBRE: Record<Quien, string> = { gerardo: 'GERARDO', tomas: 'TOMÁS' };
const COLOR: Record<Quien, string> = { gerardo: COL.gerardo, tomas: COL.tomas };
/** Por debajo de esta atención Tomás pregunta mal (es el mismo umbral del prompt). */
const CLARIDAD_OK = 55;
const TONO_COLOR: Record<Tono, string> = { info: COL.cream, ok: COL.greenLight, warn: '#f0b0a0' };

/**
 * La ventanilla. De arriba abajo: panel de estado, escenario, consejo del momento y cuadro de diálogo.
 * El jugador no habla: observa la charla entre Tomás y Gerardo e interviene con el celular.
 */
export class DeskScene extends Phaser.Scene {
  private inp!: InputState;
  private conv!: Conversation;
  private keys!: ReturnType<typeof bindKeys>;
  private unsub?: () => void;
  private pour = new PourDetector();

  // layout
  private W = 0;
  private H = 0;
  private s = 1;
  private sx = 0;
  private sy = 0;
  private stageTop = 0;
  private dlgY = 0;
  private hintY = 0;
  private hintH = 0;

  // objetos
  private hud!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private tomasImg!: Phaser.GameObjects.Image;
  private gerardoImg!: Phaser.GameObjects.Image;
  private mateImg!: Phaser.GameObjects.Image;
  private tituloT!: Phaser.GameObjects.Text;
  private relojT!: Phaser.GameObjects.Text;
  private pedidoT!: Phaser.GameObjects.Text;
  private hintT!: Phaser.GameObjects.Text;
  private toastT!: Phaser.GameObjects.Text;
  private bannerT!: Phaser.GameObjects.Text;
  private statusT!: Phaser.GameObjects.Text;
  private card!: Phaser.GameObjects.Container;
  private cardBg!: Phaser.GameObjects.Graphics;
  private cardHead!: Phaser.GameObjects.Text;
  private cardDato!: Phaser.GameObjects.Text;
  private cardKeys!: Phaser.GameObjects.Text;
  private overlay?: Phaser.GameObjects.Container;
  private pantalla?: PantallaPuntaje;
  private finStats?: Stats;
  private finAt = 0;

  private lineas: Linea[] = [];
  private lastTalkSfx = 0;
  private tramoT = 0;
  private hintAcc = 0;

  constructor() {
    super('desk');
  }

  create() {
    this.inp = this.registry.get('input') as InputState;
    const W = (this.W = this.scale.width);
    const H = (this.H = this.scale.height);
    this.lineas = [];
    this.overlay = undefined;
    this.pantalla = undefined;
    this.cameras.main.setBackgroundColor(COL.ink);

    // --- layout ---
    const hudH = 88;
    const dlgH = Math.max(132, Math.round(H * 0.3));
    const hintH = Math.round(Math.min(54, Math.max(44, H * 0.09)));
    this.stageTop = hudH;
    this.dlgY = H - dlgH;
    this.hintY = this.dlgY - hintH;
    this.hintH = hintH;
    const stageH = this.hintY - hudH;
    this.s = Math.max(1, Math.min(W / STAGE_W, stageH / STAGE_H));
    this.sx = (W - STAGE_W * this.s) / 2;
    this.sy = hudH + (stageH - STAGE_H * this.s) / 2;
    const { s } = this;
    const P = (x: number, y: number) => ({ x: this.sx + x * s, y: this.sy + y * s });

    // --- escenario ---
    this.add.image(this.sx, this.sy, 'bg').setOrigin(0).setScale(s);
    const sign = P(160, 15.5);
    this.add.text(sign.x, sign.y, 'MESA DE ENTRADAS', { fontFamily: FONT_TITLE, fontSize: `${Math.max(8, Math.round(5.2 * s))}px`, color: COL.amber }).setOrigin(0.5);
    const t = P(88, 108);
    const g = P(232, 108);
    this.tomasImg = this.add.image(t.x, t.y, personaKey('tomas', { animo: 0, boca: 0 })).setOrigin(0.5, 1).setScale(s * 1.35);
    this.gerardoImg = this.add.image(g.x, g.y, personaKey('gerardo', { animo: 0, boca: 0 })).setOrigin(0.5, 1).setScale(s * 1.35);
    this.add.image(this.sx, this.sy, 'counter').setOrigin(0).setScale(s);
    const m = P(160, 112);
    this.mateImg = this.add.image(m.x, m.y, 'mate').setOrigin(0.5, 0.86).setScale(s * 1.7);
    this.fx = this.add.graphics().setDepth(5);
    this.hud = this.add.graphics().setDepth(6);

    // --- HUD ---
    const f = (px: number) => `${Math.round(px)}px`;
    const small = Math.max(18, Math.min(24, W * 0.022));
    this.add.rectangle(W / 2, hudH / 2, W, hudH, 0x12111f).setDepth(5);
    this.add.text(16, 6, 'PACIENCIA DE GERARDO', { fontFamily: FONT, fontSize: f(small), color: COL.gerardo }).setDepth(6);
    this.add.text(16, 56, 'MATE', { fontFamily: FONT, fontSize: f(small), color: COL.cream }).setDepth(6);
    this.add.text(W - 16, 6, 'ATENCIÓN DE TOMÁS', { fontFamily: FONT, fontSize: f(small), color: COL.tomas }).setOrigin(1, 0).setDepth(6);
    this.add.text(W - 16, 56, 'PAPELITOS', { fontFamily: FONT, fontSize: f(small), color: COL.cream }).setOrigin(1, 0).setDepth(6);
    this.tituloT = this.add.text(W / 2, 4, '', { fontFamily: FONT, fontSize: f(small), color: COL.cream }).setOrigin(0.5, 0).setDepth(6);
    this.relojT = this.add.text(W / 2, 26, '11:00', { fontFamily: FONT_TITLE, fontSize: f(Math.max(16, small * 1.15)), color: COL.amber }).setOrigin(0.5, 0).setDepth(6);
    this.add.text(W / 2, 62, 'cierra 13:00', { fontFamily: FONT, fontSize: f(small * 0.85), color: COL.dim }).setOrigin(0.5, 0).setDepth(6);

    this.pedidoT = this.add
      .text(20, this.dlgY + 8, '', { fontFamily: FONT, fontSize: f(Math.max(20, Math.min(26, W * 0.024))), color: COL.amber, wordWrap: { width: W - 40 } })
      .setDepth(6);
    this.statusT = this.add.text(8, this.hintY - 6, '', { fontFamily: FONT, fontSize: '16px', color: COL.dim }).setOrigin(0, 1).setDepth(6);

    // --- consejo del momento ---
    this.add.rectangle(W / 2, this.hintY + hintH / 2, W, hintH, 0x2a2848).setDepth(5);
    this.hintT = this.add
      .text(W / 2, this.hintY + hintH / 2, '', { fontFamily: FONT, fontSize: f(Math.max(20, Math.min(26, W * 0.024))), color: COL.amber, align: 'center', wordWrap: { width: W - 24 } })
      .setOrigin(0.5)
      .setDepth(6);

    // --- cuadro de diálogo ---
    this.add.rectangle(W / 2, this.dlgY + dlgH / 2, W, dlgH, 0x12111f).setDepth(5);
    this.add.rectangle(W / 2, this.dlgY, W, 3, 0x3b3a5c).setDepth(6);

    // --- planilla ---
    this.cardBg = this.add.graphics();
    this.cardHead = this.add.text(0, 0, 'PLANILLA', { fontFamily: FONT_TITLE, fontSize: f(Math.max(10, small * 0.6)), color: COL.ink }).setOrigin(0.5, 0);
    this.cardDato = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: f(Math.max(30, Math.min(46, W * 0.04))), color: COL.ink, align: 'center', wordWrap: { width: Math.min(520, W * 0.7) - 40 } }).setOrigin(0.5, 0);
    this.cardKeys = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: f(Math.max(18, Math.min(24, W * 0.022))), color: COL.ink, align: 'center', wordWrap: { width: Math.min(520, W * 0.7) - 40 } }).setOrigin(0.5, 0);
    this.card = this.add.container(W / 2, this.sy + STAGE_H * s * 0.34, [this.cardBg, this.cardHead, this.cardDato, this.cardKeys]).setDepth(7).setVisible(false);

    // --- avisos ---
    this.toastT = this.add
      .text(W / 2, this.stageTop + 60, '', { fontFamily: FONT, fontSize: f(Math.max(22, Math.min(30, W * 0.028))), color: COL.cream, backgroundColor: '#000000cc', padding: { x: 12, y: 6 }, align: 'center', wordWrap: { width: W * 0.8 } })
      .setOrigin(0.5, 0)
      .setDepth(8)
      .setAlpha(0);
    this.bannerT = this.add
      .text(W / 2, this.sy + STAGE_H * s * 0.5, '', { fontFamily: FONT_TITLE, fontSize: f(Math.max(14, W * 0.022)), color: COL.amber, backgroundColor: '#12111fe6', padding: { x: 18, y: 12 }, align: 'center', wordWrap: { width: W * 0.7 } })
      .setOrigin(0.5)
      .setDepth(9)
      .setAlpha(0);

    // --- entrada ---
    this.keys = bindKeys(this, this.inp);
    this.unsub = this.inp.onAccion((a) => this.onAccion(a));
    this.events.once('shutdown', () => this.unsub?.());

    this.conv = new Conversation({
      speak: (who, text, final, revela) => this.onSpeak(who, text, final, revela),
      thinking: (who) => this.onThinking(who),
      planilla: (text, status) => this.onPlanilla(text, status),
      tramo: (i) => this.onTramo(i),
      toast: (msg, tono) => this.showToast(msg, tono),
      fx: (n: Sfx) => sfx(n),
      end: (r) => this.showEnd(r),
    });
    this.conv.newGame();
  }

  // --- eventos de la conversación ---------------------------------------

  private onTramo(i: number) {
    this.overlay?.destroy();
    this.overlay = undefined;
    this.pantalla?.destroy();
    this.pantalla = undefined;
    this.tramoT = 0;
    const c = CASOS_CLIENTE[i];
    this.tituloT.setText(`VENTANILLA ${i + 1}/${CASOS_CLIENTE.length} · ${c.titulo.toUpperCase()}`);
    this.pedidoT.setText(`OBJETIVO: ${c.pedido}`);
    this.clearLines();
    this.showBanner(`VENTANILLA ${i + 1}\n${c.titulo}`);
    sfx('paso');
  }

  private clearLines() {
    this.lineas.forEach((l) => l.obj.destroy());
    this.lineas = [];
  }

  private nuevaLinea(who: Quien): Linea {
    const size = Math.round(Math.max(22, Math.min(30, this.H * 0.04)));
    const obj = this.add
      .text(20, 0, '', { fontFamily: FONT, fontSize: `${size}px`, color: COLOR[who], wordWrap: { width: this.W - 40 }, lineSpacing: 2 })
      .setDepth(6);
    this.lineas.forEach((o) => (o.shown = Infinity)); // lo anterior queda completo
    const l: Linea = { who, text: '', final: false, revela: false, shown: 0, obj };
    this.lineas.push(l);
    return l;
  }

  private onThinking(who: Quien) {
    const l = this.nuevaLinea(who);
    l.text = '…';
    l.shown = Infinity;
    this.refreshLines();
  }

  private onSpeak(who: Quien, text: string, final: boolean, revela = false) {
    let l = this.lineas[this.lineas.length - 1];
    if (!l || l.final || l.who !== who) l = this.nuevaLinea(who);
    l.text = text || '…';
    l.final = final;
    l.revela = revela;
    if (l.shown === Infinity && l.text !== '…') l.shown = 0; // la línea pasó de "…" a texto real
    this.refreshLines();
  }

  /** Apila las líneas desde abajo; las que no entran se ocultan. Las viejas se atenúan. */
  private refreshLines() {
    let y = this.H - 10;
    const top = this.dlgY + 14 + this.pedidoT.height;
    for (let i = this.lineas.length - 1; i >= 0; i--) {
      const l = this.lineas[i];
      const completa = l.shown >= l.text.length;
      const visible = completa ? l.text : l.text.slice(0, Math.floor(l.shown));
      l.obj.setText(`${NOMBRE[l.who]}: ${visible}${completa && l.final && l.revela ? '  ★' : ''}`);
      y -= l.obj.height + 4;
      const fits = y >= top;
      l.obj.setPosition(20, y).setVisible(fits).setAlpha(i === this.lineas.length - 1 ? 1 : 0.55);
    }
  }

  private onPlanilla(text: string | null, status: 'pendiente' | 'ok' | 'mal') {
    if (!text) {
      this.card.setVisible(false);
      return;
    }
    const w = Math.min(520, this.W * 0.7);
    const color = { pendiente: 0xf2efe2, ok: 0xb9e0a5, mal: 0xf0b0a0 }[status];
    this.cardHead.setText('PLANILLA · TOMÁS ANOTÓ');
    this.cardDato.setText(text);
    this.cardKeys.setText(
      status === 'pendiente'
        ? '¿Coincide con lo que dijo Gerardo?\nSELLAR (golpe ↓) si está bien · RECHAZAR (sacudir) si no'
        : status === 'ok'
          ? 'SELLADO ✔'
          : 'RECHAZADO ✘',
    );
    this.cardHead.setPosition(0, 14);
    this.cardDato.setPosition(0, 14 + this.cardHead.height + 10);
    this.cardKeys.setPosition(0, this.cardDato.y + this.cardDato.height + 12);
    const h = this.cardKeys.y + this.cardKeys.height + 16;
    this.cardBg.clear().fillStyle(0x000000, 0.35).fillRect(-w / 2 + 6, 6, w, h).fillStyle(color).fillRect(-w / 2, 0, w, h).lineStyle(4, 0x1b1a2e).strokeRect(-w / 2, 0, w, h);
    this.card.setVisible(true);
  }

  private showToast(msg: string, tono: Tono = 'info') {
    this.toastT.setText(msg).setColor(TONO_COLOR[tono]).setAlpha(1);
    this.tweens.killTweensOf(this.toastT);
    this.tweens.add({ targets: this.toastT, alpha: 0, delay: 2400 + msg.length * 45, duration: 500 });
    if (tono !== 'info') phone.buzz(tono === 'warn' ? 120 : 50);
  }

  private showBanner(msg: string) {
    this.bannerT.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.bannerT);
    this.tweens.add({ targets: this.bannerT, alpha: 0, delay: 1700, duration: 500 });
  }

  private onAccion(a: Accion) {
    if (this.pantalla) {
      this.pantalla.accion(a);
      return;
    }
    if (this.conv.ended && a !== 'sellar') return;
    if (this.conv.ended && this.finStats) {
      if (this.time.now - this.finAt < 1200) return; // evita que el último golpe salte la pantalla del final
      sfx('sellar');
      this.cameras.main.shake(110, 0.006);
      this.overlay?.destroy();
      this.overlay = undefined;
      this.pantalla = new PantallaPuntaje(this, this.finStats, calcularPuntaje(this.finStats), () => this.conv.accion('sellar'));
      return;
    }
    if (this.conv.awaitingDecision && (a === 'mate' || a === 'papelito')) return;
    phone.did(ACCION_LABEL[a]);
    phone.buzz(a === 'sellar' ? 80 : 40);
    if (a === 'sellar' && this.conv.awaitingDecision) {
      sfx('sellar');
      this.cameras.main.shake(110, 0.006);
    }
    this.conv.accion(a);
  }

  private showEnd(r: FinalKey) {
    const fin = FINALES[r];
    this.finStats = this.conv.stats(r);
    this.finAt = this.time.now;
    const { W, H } = this;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.82);
    const t1 = this.add.text(W / 2, H * 0.28, fin.titulo.toUpperCase(), { fontFamily: FONT_TITLE, fontSize: `${Math.round(Math.max(18, W * 0.032))}px`, color: fin.color, align: 'center', wordWrap: { width: W * 0.85 } }).setOrigin(0.5);
    const t2 = this.add.text(W / 2, H * 0.5, fin.texto, { fontFamily: FONT, fontSize: `${Math.round(Math.max(24, Math.min(36, W * 0.03)))}px`, color: COL.cream, align: 'center', wordWrap: { width: W * 0.75 }, lineSpacing: 8 }).setOrigin(0.5);
    fitText(t2, W * 0.78, H * 0.3, Math.max(24, Math.min(36, W * 0.03)), 16);
    const puntaje = calcularPuntaje(this.finStats);
    const stats = `Ventanillas: ${this.finStats.tramos}/${CASOS_CLIENTE.length}  ·  Relación con Gerardo: ${this.finStats.relacion}/100  ·  Puntaje: ${puntaje}`;
    const t3 = this.add.text(W / 2, H * 0.72, stats, { fontFamily: FONT, fontSize: '24px', color: COL.dim, wordWrap: { width: W * 0.9 }, align: 'center' }).setOrigin(0.5);
    const t4 = this.add.text(W / 2, H * 0.84, 'Golpeá hacia abajo (o tecla T / Espacio) para anotar tu puntaje', { fontFamily: FONT, fontSize: '24px', color: COL.amber }).setOrigin(0.5);
    this.overlay = this.add.container(0, 0, [dim, t1, t2, t3, t4]).setDepth(20);
    phone.say(fin.titulo.toUpperCase(), 'Golpeá hacia abajo para anotar tu puntaje', r === 'bueno' || r === 'justo' ? 'ok' : 'warn');
  }

  // --- consejo del momento ---------------------------------------------

  private consejo(): { texto: string; celu: string; sub: string; tono: Tono } {
    const c = this.conv;
    if (c.awaitingDecision)
      return { texto: 'DECIDÍ: ¿lo que anotó Tomás coincide con lo que dijo Gerardo?   SELLAR = golpe ↓   ·   RECHAZAR = sacudir', celu: 'SELLÁ O RECHAZÁ', sub: 'Golpe ↓ sella · sacudir rechaza', tono: 'warn' };
    if (c.patience < 35 && c.cebadas > 0)
      return { texto: 'Gerardo se está por ir. Servile un MATE: inclinalo entre 15° y 35° durante 1 segundo.', celu: 'SERVÍ MATE', sub: 'Inclinalo de costado, suave', tono: 'warn' };
    if (c.claridad < CLARIDAD_OK && c.papelitos > 0)
      return { texto: 'Tomás está perdido. Un PAPELITO lo encamina: empujá el celular hacia adelante.', celu: 'PAPELITO', sub: 'Empujalo hacia adelante', tono: 'info' };
    if (this.tramoT < 14) return { texto: CASOS_CLIENTE[c.tramo].consejo, celu: 'ESCUCHÁ', sub: 'Mirá la pantalla', tono: 'info' };
    return { texto: 'Escuchá: cuando Gerardo diga el dato (★), Tomás lo va a anotar. Ahí decidís.', celu: 'ESCUCHÁ', sub: 'Mirá la pantalla', tono: 'info' };
  }

  // --- bucle -------------------------------------------------------------

  update(_t: number, dtMs: number) {
    const dt = dtMs / 1000;
    const inp = this.inp;
    const c = this.conv;
    this.tramoT += dt;
    tiltFromKeys(inp, this.keys, dt);

    if (this.pantalla) {
      const flecha = !inp.connected ? 0 : Phaser.Input.Keyboard.JustDown(this.keys.RIGHT) ? 1 : Phaser.Input.Keyboard.JustDown(this.keys.LEFT) ? -1 : 0;
      this.pantalla.update(inp.roll, dt, flecha);
      const m = this.pantalla.celu();
      phone.say(m.titulo, m.sub, 'info');
    }

    if (!c.ended && !c.awaitingDecision) {
      const ev = this.pour.update(inp.roll, dt);
      if (ev === 'pour') this.onAccion('mate');
      else if (ev === 'spill') {
        c.derramar();
        this.spillFx();
      }
    } else {
      this.pour.update(0, dt);
    }
    c.tick(dt);

    // personajes: expresión según el estado de juego
    // escritura de la última línea, a velocidad de lectura
    const ultima = this.lineas[this.lineas.length - 1];
    const escribiendo = !!ultima && ultima.text !== '…' && ultima.shown < ultima.text.length;
    if (escribiendo) {
      const antes = Math.floor(ultima.shown);
      ultima.shown = Math.min(ultima.text.length, ultima.shown + CPS * dt);
      if (Math.floor(ultima.shown) !== antes) {
        this.refreshLines();
        if (this.time.now - this.lastTalkSfx > 70) {
          this.lastTalkSfx = this.time.now;
          sfx('hablar');
        }
      }
    }
    const hablando = (q: Quien) => escribiendo && ultima.who === q && Math.floor(this.time.now / 120) % 2 === 0;
    const eG: Estado = { animo: c.patience < 30 ? 1 : c.mate > 0 ? 2 : 0, boca: hablando('gerardo') ? 1 : 0 };
    const eT: Estado = { animo: c.claridad < CLARIDAD_OK ? 1 : 0, boca: hablando('tomas') ? 1 : 0 };
    this.gerardoImg.setTexture(personaKey('gerardo', eG));
    this.tomasImg.setTexture(personaKey('tomas', eT));

    this.mateImg.setAngle(Phaser.Math.Clamp(inp.roll, -80, 80));
    this.drawHud();
    this.drawFx();

    this.hintAcc += dt;
    if (this.hintAcc > 0.2) {
      this.hintAcc = 0;
      const h = this.consejo();
      if (this.hintT.text !== h.texto) {
        this.hintT.setText(h.texto);
        fitText(this.hintT, this.W - 24, this.hintH - 6, Math.max(20, Math.min(26, this.W * 0.024)), 14);
      }
      if (!c.ended) phone.say(h.celu, h.sub, h.tono);
    }
    this.statusT.setText(c.usingMock ? '[modo sin LLM]' : '');
    const hh = Math.floor(c.hora() / 60);
    const mm = Math.floor(c.hora() % 60);
    this.relojT.setText(`${hh}:${String(mm).padStart(2, '0')}`).setColor(c.hora() > RELOJ.cierreMin - 15 ? COL.red : COL.amber);
  }

  private drawHud() {
    const g = this.hud.clear();
    const { W, conv: c } = this;
    const small = Math.max(18, Math.min(24, W * 0.022));
    const bw = Math.min(280, W * 0.3);
    const by = 6 + small + 4;
    const bar = (x: number, value: number, colorFn: (v: number) => number) => {
      g.fillStyle(0x000000, 0.6).fillRect(x, by, bw, 20);
      g.fillStyle(colorFn(value)).fillRect(x + 2, by + 2, (bw - 4) * (value / 100), 16);
      g.lineStyle(2, 0x3b3a5c).strokeRect(x, by, bw, 20);
    };
    bar(16, c.patience, (v) => (v > 50 ? 0x6aa84f : v > 25 ? 0xe0a030 : 0xc2452d));
    bar(W - 16 - bw, c.claridad, (v) => (v > 55 ? 0x6aa84f : v > 35 ? 0xe0a030 : 0xc2452d));

    const maxCeb = CASOS_CLIENTE[c.tramo].dif.cebadas;
    for (let i = 0; i < maxCeb; i++) {
      const x = 16 + 60 + i * 26;
      g.fillStyle(i < c.cebadas ? 0x7a9a3a : 0x3b3a5c).fillCircle(x + 9, 70, 9);
      g.fillStyle(i < c.cebadas ? 0xcfd8dc : 0x3b3a5c).fillRect(x + 11, 56, 2, 10);
    }
    const maxPap = CASOS_CLIENTE[c.tramo].dif.papelitos;
    for (let i = 0; i < maxPap; i++) {
      const x = W - 16 - 100 - i * 24;
      g.fillStyle(i < c.papelitos ? 0xf2efe2 : 0x3b3a5c).fillRect(x - 14, 60, 16, 20);
      if (i < c.papelitos) g.fillStyle(0x6b6a80).fillRect(x - 12, 64, 12, 2).fillRect(x - 12, 69, 9, 2);
    }
    if (c.mate > 0) {
      g.fillStyle(0x6aa84f).fillRect(16 + 60 + maxCeb * 26 + 4, 64, Math.min(60, (c.mate / 25) * 60), 8);
    }
  }

  private drawFx() {
    const g = this.fx.clear();
    const { s, sx, sy } = this;
    // aguja del reloj de pared
    const cx = sx + 160 * s;
    const cy = sy + 46 * s;
    const min = this.conv.hora();
    const am = ((min % 60) / 60) * Math.PI * 2;
    const ah = (((min / 60) % 12) / 12) * Math.PI * 2;
    g.lineStyle(Math.max(1, s * 0.7), 0x1b1a2e);
    g.lineBetween(cx, cy, cx + Math.sin(ah) * 6 * s, cy - Math.cos(ah) * 6 * s);
    g.lineStyle(Math.max(1, s * 0.5), 0xc2452d);
    g.lineBetween(cx, cy, cx + Math.sin(am) * 9.5 * s, cy - Math.cos(am) * 9.5 * s);

    // anillo de "sirviendo"
    if (this.pour.progress > 0) {
      g.lineStyle(Math.max(3, s * 1.5), 0x6aa84f);
      g.beginPath();
      g.arc(this.mateImg.x, this.mateImg.y - 14 * s, 26 * s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.pour.progress, false);
      g.strokePath();
    }
    if (this.pour.spilling) {
      g.lineStyle(Math.max(3, s * 1.5), 0xc2452d);
      g.strokeCircle(this.mateImg.x, this.mateImg.y - 14 * s, 26 * s);
    }
  }

  private spillFx() {
    for (let i = 0; i < 8; i++) {
      const dir = Math.sign(this.inp.roll) || 1;
      const r = this.add.rectangle(this.mateImg.x + dir * 20 * this.s, this.mateImg.y - 20 * this.s, 6, 6, 0x7a9a3a).setDepth(6);
      this.tweens.add({
        targets: r, x: r.x + dir * (20 + Math.random() * 40) * this.s * 0.5, y: r.y + (30 + Math.random() * 30) * this.s * 0.5,
        alpha: 0, duration: 600 + Math.random() * 300, onComplete: () => r.destroy(),
      });
    }
  }
}
