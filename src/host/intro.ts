import Phaser from 'phaser';
import { sfx } from './audio';
import { HISTORIA } from './casos';
import { PourDetector, POUR_MIN, SPILL_ANGLE, type InputState } from './input';
import { phone } from './phone';
import { STAGE_H, STAGE_W } from './art';
import { ACCION_LABEL, bindKeys, COL, FONT, FONT_TITLE, fitText, tiltFromKeys } from './ui';
import type { Accion } from '../shared/protocol';

interface Paso {
  titulo: string;
  texto: string;
  accion: Accion;
  teclado: string;
  /** texto corto para la pantalla del celular */
  celu: string;
}

const PASOS: Paso[] = [
  {
    titulo: 'SERVIR EL MATE',
    texto: 'Inclinalo como si sirvieras un mate. Mantenelo entre 15° y 35° durante 1 segundo. Si te pasás de 35°, el mate se derrama.',
    accion: 'mate',
    teclado: 'flechas ←/→ para inclinar, o tecla M',
    celu: 'Inclinalo de costado, suave',
  },
  {
    titulo: 'LANZAR UN PAPELITO',
    texto: 'Empujá el celular hacia adelante, como si tiraras un papelito. Le da una pista a Tomás cuando está perdido, pero cuesta un poco de paciencia.',
    accion: 'papelito',
    teclado: 'tecla F',
    celu: 'Empujalo hacia adelante',
  },
  {
    titulo: 'SELLAR',
    texto: 'Golpeá hacia abajo, como si estamparas un sello. Así aprobás lo que Tomás anotó en la planilla.',
    accion: 'sellar',
    teclado: 'tecla T o Espacio',
    celu: 'Golpeá hacia abajo',
  },
  {
    titulo: 'RECHAZAR',
    texto: 'Sacudí el celular de lado a lado, como diciendo "no". Así devolvés la planilla cuando lo anotado no coincide con lo que dijo Gerardo.',
    accion: 'rechazar',
    teclado: 'tecla R',
    celu: 'Sacudilo de lado a lado',
  },
];

/**
 * Historia + capacitación. El jugador aprende cada gesto haciéndolo: el paso no avanza hasta que se detecta.
 * Si algo falla (el gesto no sale), siempre hay botón en el celular y tecla en la PC.
 */
export class IntroScene extends Phaser.Scene {
  private inp!: InputState;
  private unsub?: () => void;
  private keys!: ReturnType<typeof bindKeys>;
  private pour = new PourDetector();

  private phase: 'historia' | 'tuto' | 'fin' = 'historia';
  private card = 0;
  private full = '';
  private typed = 0;
  private story!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private size = 28;

  private paso = 0;
  private stepDone = false;
  private tutoObjs: Phaser.GameObjects.GameObject[] = [];
  private phoneBox?: Phaser.GameObjects.Container;
  private gauge!: Phaser.GameObjects.Graphics;
  private dots!: Phaser.GameObjects.Graphics;
  private tutoText!: Phaser.GameObjects.Text;
  private tutoTitle!: Phaser.GameObjects.Text;
  private tutoKeys!: Phaser.GameObjects.Text;
  private check!: Phaser.GameObjects.Text;
  private mateImg?: Phaser.GameObjects.Image;

  constructor() {
    super('intro');
  }

  create() {
    this.inp = this.registry.get('input') as InputState;
    if (this.registry.get('skipIntro')) return void this.scene.start('desk');

    const { width: W, height: H } = this.scale;
    this.cameras.main.setBackgroundColor(COL.ink);

    // Fondo: la oficina, apagada.
    const s = Math.max(W / STAGE_W, H / STAGE_H);
    this.add.image(W / 2, H / 2, 'bg').setScale(s).setAlpha(0.2);
    this.add.image(W / 2, H / 2, 'counter').setScale(s).setAlpha(0.2);
    this.add.rectangle(W / 2, H * 0.47, W * 0.84, H * 0.72, 0x12111f, 0.82).setStrokeStyle(3, 0x3b3a5c);

    this.keys = bindKeys(this, this.inp);
    this.input.keyboard!.on('keydown-ENTER', () => this.scene.start('desk'));
    this.unsub = this.inp.onAccion((a) => this.onAccion(a));
    this.events.once('shutdown', () => this.unsub?.());

    const size = Math.round(Math.max(24, Math.min(40, W * 0.032)));
    this.size = size;
    this.story = this.add
      .text(W / 2, H * 0.42, '', { fontFamily: FONT, fontSize: `${size}px`, color: COL.cream, align: 'center', wordWrap: { width: W * 0.72 }, lineSpacing: 8 })
      .setOrigin(0.5);
    this.prompt = this.add
      .text(W / 2, H * 0.86, '', { fontFamily: FONT, fontSize: `${Math.round(size * 0.75)}px`, color: COL.amber, align: 'center' })
      .setOrigin(0.5);
    this.add
      .text(W - 14, H - 10, 'ENTER: saltar introducción', { fontFamily: FONT, fontSize: '18px', color: COL.dim })
      .setOrigin(1, 1);
    this.add.text(W / 2, 28, 'MESA DE ENTRADAS', { fontFamily: FONT_TITLE, fontSize: `${Math.round(size * 0.55)}px`, color: COL.amber }).setOrigin(0.5);

    this.showCard(0);

    this.time.addEvent({
      delay: 28,
      loop: true,
      callback: () => {
        if (this.phase !== 'historia' || this.typed >= this.full.length) return;
        this.typed++;
        this.story.setText(this.full.slice(0, this.typed));
        if (this.typed % 3 === 0) sfx('hablar');
        if (this.typed >= this.full.length) this.prompt.setText('Golpeá hacia abajo (o tecla T / Espacio) para seguir');
      },
    });
  }

  // --- historia ---------------------------------------------------------

  private showCard(i: number) {
    this.card = i;
    this.full = HISTORIA[i];
    this.typed = 0;
    // se mide con el texto completo para que no se desborde del recuadro mientras se escribe
    this.story.setText(this.full);
    fitText(this.story, this.scale.width * 0.74, this.scale.height * 0.5, this.size, 16);
    this.story.setText('');
    this.prompt.setText('');
    phone.say('HISTORIA', 'Golpeá hacia abajo para seguir', 'info');
  }

  private nextCard() {
    if (this.typed < this.full.length) {
      this.typed = this.full.length;
      this.story.setText(this.full);
      this.prompt.setText('Golpeá hacia abajo (o tecla T / Espacio) para seguir');
      return;
    }
    sfx('paso');
    if (this.card + 1 < HISTORIA.length) this.showCard(this.card + 1);
    else this.startTuto();
  }

  // --- capacitación -----------------------------------------------------

  private startTuto() {
    this.phase = 'tuto';
    this.story.setText('');
    this.prompt.setText('');
    const { width: W, height: H } = this.scale;
    const size = Math.round(Math.max(24, Math.min(36, W * 0.03)));

    this.tutoTitle = this.add.text(W * 0.54, H * 0.17, '', { fontFamily: FONT_TITLE, fontSize: `${Math.round(size * 0.6)}px`, color: COL.amber, lineSpacing: 10 });
    this.tutoText = this.add.text(W * 0.54, H * 0.27, '', { fontFamily: FONT, fontSize: `${size}px`, color: COL.cream, wordWrap: { width: W * 0.36 }, lineSpacing: 6 });
    this.tutoKeys = this.add.text(W * 0.54, H * 0.69, '', { fontFamily: FONT, fontSize: `${Math.round(size * 0.7)}px`, color: COL.dim });
    this.check = this.add.text(W * 0.25, H * 0.44, '✔', { fontFamily: FONT, fontSize: '120px', color: COL.greenLight }).setOrigin(0.5).setAlpha(0);
    this.gauge = this.add.graphics();
    this.dots = this.add.graphics();
    this.tutoObjs.push(this.tutoTitle, this.tutoText, this.tutoKeys, this.check, this.gauge, this.dots);

    this.mateImg = this.add.image(W * 0.25, H * 0.7, 'mate').setScale(Math.max(3, Math.round(H / 130))).setOrigin(0.5, 0.85);
    this.tutoObjs.push(this.mateImg);
    this.showPaso(0);
  }

  private showPaso(i: number) {
    this.paso = i;
    this.stepDone = false;
    const p = PASOS[i];
    const { width: W, height: H } = this.scale;
    const colW = W * 0.37;
    this.tutoTitle.setText(`${i + 1}/${PASOS.length} · ${p.titulo}`);
    fitText(this.tutoTitle, colW, H * 0.09, Math.max(24, Math.min(36, W * 0.03)) * 0.6, 9);
    this.tutoText.setText(p.texto);
    fitText(this.tutoText, colW, H * 0.3, Math.max(24, Math.min(36, W * 0.03)), 14);
    this.tutoKeys.setText(`Si no te sale, usá el botón "${ACCION_LABEL[p.accion]}" del celular.\nTeclado: ${p.teclado}`);
    fitText(this.tutoKeys, colW, H * 0.12, Math.max(24, Math.min(36, W * 0.03)) * 0.7, 12);
    this.mateImg?.setVisible(p.accion === 'mate');
    phone.say(p.titulo, p.celu, 'info');

    this.phoneBox?.destroy();
    const g = this.add.graphics();
    g.fillStyle(0x0d0c18).fillRoundedRect(-34, -64, 68, 128, 8);
    g.fillStyle(0x3b3a5c).fillRoundedRect(-30, -58, 60, 112, 4);
    g.fillStyle(0x6aa84f).fillRect(-18, -20, 36, 8);
    g.fillStyle(0xf4e9c8).fillRect(-18, -4, 36, 4).fillRect(-18, 4, 26, 4);
    g.fillStyle(0x0d0c18).fillCircle(0, 58, 3);
    const box = this.add.container(W * 0.25, H * 0.4, [g]).setScale(Math.max(1.2, H / 420));
    this.phoneBox = box;
    this.tutoObjs.push(box);
    this.tweens.killTweensOf(box);
    box.setAngle(0).setPosition(W * 0.25, H * 0.4);
    const bx = W * 0.25;
    const by = H * 0.4;
    switch (p.accion) {
      case 'mate':
        this.tweens.add({ targets: box, angle: 26, duration: 900, yoyo: true, hold: 700, repeat: -1, ease: 'Sine.easeInOut' });
        break;
      case 'papelito':
        this.tweens.add({ targets: box, x: bx + 70, scale: box.scale * 1.15, duration: 350, yoyo: true, hold: 500, repeatDelay: 600, repeat: -1, ease: 'Cubic.easeOut' });
        break;
      case 'sellar':
        this.tweens.add({ targets: box, y: by + 60, duration: 220, yoyo: true, hold: 200, repeatDelay: 800, repeat: -1, ease: 'Cubic.easeIn' });
        break;
      case 'rechazar':
        this.tweens.add({ targets: box, x: bx + 34, duration: 110, yoyo: true, repeat: 5, repeatDelay: 900, ease: 'Sine.easeInOut' });
        break;
    }
  }

  private completePaso() {
    if (this.stepDone) return;
    this.stepDone = true;
    sfx('ok');
    phone.buzz(60);
    phone.say('¡Bien!', '', 'ok');
    this.check.setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.check, scale: 1, alpha: 0, duration: 800, ease: 'Cubic.easeOut' });
    this.time.delayedCall(900, () => {
      if (this.paso + 1 < PASOS.length) this.showPaso(this.paso + 1);
      else this.finTuto();
    });
  }

  private finTuto() {
    this.phase = 'fin';
    this.tutoObjs.forEach((o) => o.destroy());
    this.tutoObjs = [];
    this.phoneBox = undefined;
    const { width: W, height: H } = this.scale;
    const size = Math.round(Math.max(24, Math.min(38, W * 0.032)));
    this.story
      .setText(
        'Capacitación completa.\n\nRegla de oro: Tomás a veces anota MAL.\nAntes de sellar, fijate que coincida con lo que dijo Gerardo.\n\nSi Gerardo se impacienta, servile un mate.\nSi Tomás está perdido, tirale un papelito.',
      )
      .setFontSize(size);
    fitText(this.story, W * 0.74, H * 0.5, size, 16);
    this.prompt.setText('Golpeá hacia abajo (o tecla T / Espacio) para abrir la ventanilla').setPosition(W / 2, H * 0.86);
    phone.say('¡A LA VENTANILLA!', 'Golpeá hacia abajo para empezar', 'ok');
  }

  private onAccion(a: Accion) {
    if (this.phase === 'historia') {
      if (a === 'sellar') this.nextCard();
    } else if (this.phase === 'tuto') {
      if (a === PASOS[this.paso].accion) this.completePaso();
    } else if (a === 'sellar') {
      sfx('paso');
      this.scene.start('desk');
    }
  }

  update(_t: number, dtMs: number) {
    const dt = dtMs / 1000;
    tiltFromKeys(this.inp, this.keys, dt);
    if (this.phase !== 'tuto') return;

    // medidor de inclinación para el paso del mate
    const g = this.gauge.clear();
    const { width: W, height: H } = this.scale;
    if (PASOS[this.paso].accion === 'mate') {
      const ev = this.pour.update(this.inp.roll, dt);
      if (ev === 'pour') this.onAccion('mate');
      if (ev === 'spill') {
        sfx('derrame');
        phone.say('¡Te pasaste!', 'Inclinalo menos', 'warn');
      }
      const x0 = W * 0.54;
      const y0 = H * 0.6;
      const w = W * 0.36;
      const max = 60;
      g.fillStyle(0x000000, 0.5).fillRect(x0, y0, w, 22);
      g.fillStyle(0x6aa84f, 0.85).fillRect(x0 + (POUR_MIN / max) * w, y0, ((SPILL_ANGLE - POUR_MIN) / max) * w, 22);
      g.fillStyle(0xc2452d, 0.85).fillRect(x0 + (SPILL_ANGLE / max) * w, y0, ((max - SPILL_ANGLE) / max) * w, 22);
      const ang = Math.min(max, Math.abs(this.inp.roll));
      g.fillStyle(0xf4e9c8).fillRect(x0 + (ang / max) * w - 3, y0 - 6, 6, 34);
      if (this.pour.progress > 0) g.fillStyle(0xf4e9c8).fillRect(x0, y0 + 30, w * this.pour.progress, 6);
      if (this.mateImg) this.mateImg.setAngle(Phaser.Math.Clamp(this.inp.roll, -80, 80));
    } else {
      this.pour.update(0, dt);
    }

    // puntos de avance
    const d = this.dots.clear();
    PASOS.forEach((_, i) => {
      d.fillStyle(i < this.paso || (i === this.paso && this.stepDone) ? 0x6aa84f : i === this.paso ? 0xe0a030 : 0x3b3a5c).fillRect(W * 0.54 + i * 26, H * 0.13, 18, 8);
    });
  }
}
