import Phaser from 'phaser';
import type { Accion } from '../shared/protocol';
import type { FilaRanking, RespuestaScore, Stats } from '../shared/score';
import { FINALES } from './casos';
import { COL, FONT, FONT_TITLE } from './ui';

export async function guardarPartida(iniciales: string, stats: Stats): Promise<RespuestaScore> {
  const r = await fetch('/api/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ iniciales, stats }),
  });
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()) as RespuestaScore;
}

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const UMBRAL = 25; // grados de inclinación para cambiar de letra
const PASO = 0.3; // segundos entre cambios mientras se mantiene inclinado
const PASO_RAPIDO = 0.12;

/**
 * Pantalla de puntaje de fin de partida, al estilo arcade: se eligen 3 iniciales inclinando el celular
 * (sello confirma, rechazo borra), se guarda la partida y se muestra la tabla.
 */
export class PantallaPuntaje {
  private root: Phaser.GameObjects.Container;
  private letras: number[] = [];
  private paso = 0;
  private fase: 'iniciales' | 'guardando' | 'tabla' = 'iniciales';
  private slots: Phaser.GameObjects.Text[] = [];
  private info!: Phaser.GameObjects.Text;
  private cuerpo!: Phaser.GameObjects.Text;
  private pie!: Phaser.GameObjects.Text;

  constructor(
    private scene: Phaser.Scene,
    private stats: Stats,
    puntaje: number,
    private alTerminar: () => void,
  ) {
    const { width: W, height: H } = scene.scale;
    const f = (px: number) => `${Math.round(px)}px`;
    const big = Math.max(24, Math.min(36, W * 0.03));
    const dim = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.97);
    const titulo = scene.add.text(W / 2, H * 0.1, `PUNTAJE ${puntaje}`, { fontFamily: FONT_TITLE, fontSize: f(Math.max(18, W * 0.03)), color: COL.amber }).setOrigin(0.5);
    this.info = scene.add.text(W / 2, H * 0.2, 'INICIALES', { fontFamily: FONT, fontSize: f(big), color: COL.cream, align: 'center', wordWrap: { width: W * 0.85 } }).setOrigin(0.5);
    const gap = Math.max(70, W * 0.08);
    for (let i = 0; i < 3; i++) {
      this.slots.push(scene.add.text(W / 2 + (i - 1) * gap, H * 0.45, '_', { fontFamily: FONT_TITLE, fontSize: f(Math.max(40, W * 0.07)), color: COL.cream }).setOrigin(0.5));
    }
    this.cuerpo = scene.add.text(W / 2, H * 0.5, '', { fontFamily: FONT, fontSize: f(big), color: COL.cream, align: 'left', lineSpacing: 6 }).setOrigin(0.5).setVisible(false);
    this.pie = scene.add.text(W / 2, H * 0.88, '', { fontFamily: FONT, fontSize: f(Math.max(22, big * 0.8)), color: COL.amber, align: 'center', wordWrap: { width: W * 0.9 } }).setOrigin(0.5);
    this.root = scene.add.container(0, 0, [dim, titulo, this.info, ...this.slots, this.cuerpo, this.pie]).setDepth(30);
    this.letras = [0];
    this.pintar();
  }

  /** Texto para el celular según la fase. */
  celu(): { titulo: string; sub: string } {
    if (this.fase === 'iniciales') return { titulo: 'TUS INICIALES', sub: 'Inclinar elige letra · sello confirma' };
    if (this.fase === 'guardando') return { titulo: 'GUARDANDO…', sub: '' };
    return { titulo: 'RANKING', sub: 'Golpeá hacia abajo para jugar de nuevo' };
  }

  update(roll: number, dt: number, flecha: -1 | 0 | 1) {
    if (this.fase !== 'iniciales') return;
    this.paso = Math.max(0, this.paso - dt);
    const dir = flecha || (roll > UMBRAL ? 1 : roll < -UMBRAL ? -1 : 0);
    if (!dir) {
      this.paso = 0;
      return;
    }
    if (flecha || this.paso === 0) {
      this.paso = Math.abs(roll) > 50 ? PASO_RAPIDO : PASO;
      const i = this.letras.length - 1;
      this.letras[i] = (this.letras[i] + dir + LETRAS.length) % LETRAS.length;
      this.pintar();
    }
  }

  /** Devuelve true si la acción fue absorbida por esta pantalla. */
  accion(a: Accion): boolean {
    if (this.fase === 'guardando') return true;
    if (this.fase === 'tabla') {
      if (a === 'sellar') this.alTerminar();
      return true;
    }
    if (a === 'sellar') {
      if (this.letras.length < 3) this.letras.push(this.letras[this.letras.length - 1]);
      else void this.guardar();
      this.pintar();
    } else if (a === 'rechazar') {
      if (this.letras.length > 1) this.letras.pop();
      else void this.omitir();
      this.pintar();
    }
    return true;
  }

  destroy() {
    this.root.destroy();
  }

  private pintar() {
    this.slots.forEach((s, i) => {
      const activo = i === this.letras.length - 1 && this.letras.length <= 3;
      s.setText(i < this.letras.length ? LETRAS[this.letras[i]] : '_').setColor(activo ? COL.amber : COL.cream);
    });
    const completo = this.letras.length === 3;
    this.pie.setText(
      completo
        ? 'SELLO: guardar · RECHAZO: borrar letra'
        : 'Inclinar (o flechas): cambiar letra · SELLO (T): fijar · RECHAZO (R): borrar / omitir',
    );
  }

  private iniciales(): string {
    return this.letras.map((i) => LETRAS[i]).join('');
  }

  private async omitir() {
    this.fase = 'tabla';
    this.slots.forEach((s) => s.setVisible(false));
    this.info.setText('Puntaje no guardado');
    this.pie.setText('Golpeá hacia abajo (o T / Espacio) para jugar de nuevo');
  }

  private async guardar() {
    this.fase = 'guardando';
    this.info.setText('Guardando…');
    const iniciales = this.iniciales();
    try {
      const r = await guardarPartida(iniciales, this.stats);
      this.mostrarTabla(r, iniciales);
    } catch {
      this.fase = 'tabla';
      this.slots.forEach((s) => s.setVisible(false));
      this.info.setText('No se pudo guardar el puntaje (ranking sin conexión)');
      this.pie.setText('Golpeá hacia abajo (o T / Espacio) para jugar de nuevo');
    }
  }

  private mostrarTabla(r: RespuestaScore, iniciales: string) {
    this.fase = 'tabla';
    this.slots.forEach((s) => s.setVisible(false));
    this.info.setText(r.posicion === 1 ? '¡NUEVO RÉCORD!' : `Quedaste #${r.posicion}`);
    const fila = (x: FilaRanking, i: number) => `${String(i + 1).padStart(2, '0')}  ${x.iniciales}  ${String(x.puntaje).padStart(6)}  ${FINALES[x.final].titulo}`;
    const mia = r.top.findIndex((x) => x.puntaje === r.puntaje && x.iniciales === iniciales);
    const lineas = r.top.map((x, i) => (i === mia ? `> ${fila(x, i)}` : `  ${fila(x, i)}`));
    if (mia < 0) lineas.push('  ...', `> ${String(r.posicion).padStart(2, '0')}  ${iniciales}  ${String(r.puntaje).padStart(6)}`);
    this.cuerpo.setText(lineas.join('\n')).setVisible(true).setFontFamily('ui-monospace, Menlo, monospace');
    const { width: W, height: H } = this.scene.scale;
    let size = Math.round(Math.max(18, Math.min(28, W * 0.024)));
    this.cuerpo.setFontSize(size);
    while (this.cuerpo.height > H * 0.6 && size > 12) this.cuerpo.setFontSize(--size);
    this.pie.setText('Golpeá hacia abajo (o T / Espacio) para jugar de nuevo');
  }
}
