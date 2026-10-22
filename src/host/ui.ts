import Phaser from 'phaser';
import type { Accion } from '../shared/protocol';
import type { InputState } from './input';

export const FONT = '"VT323", ui-monospace, Menlo, monospace';
export const FONT_TITLE = '"Press Start 2P", "VT323", monospace';

export const COL = {
  ink: '#1b1a2e',
  cream: '#f4e9c8',
  paper: '#f2efe2',
  amber: '#e0a030',
  red: '#c2452d',
  green: '#6aa84f',
  greenLight: '#b9e0a5',
  tomas: '#8fb8ff',
  gerardo: '#ffd27a',
  dim: '#9a94b8',
};

type Keys = Record<string, Phaser.Input.Keyboard.Key>;

/** Teclas de respaldo para jugar sin celular: sirven también para depurar y para la demo si algo falla. */
export function bindKeys(scene: Phaser.Scene, inp: InputState): Keys {
  const k = scene.input.keyboard!.addKeys('LEFT,RIGHT,T,SPACE,R,F,M') as Keys;
  const on = (key: Phaser.Input.Keyboard.Key, a: Accion) => key.on('down', () => inp.emit(a));
  on(k.T, 'sellar');
  on(k.SPACE, 'sellar');
  on(k.R, 'rechazar');
  on(k.F, 'papelito');
  on(k.M, 'mate');
  return k;
}

/** Con el celular desconectado, las flechas inclinan la taza. */
export function tiltFromKeys(inp: InputState, k: Keys, dt: number) {
  if (inp.connected) return;
  if (k.LEFT.isDown) inp.roll = Math.max(-80, inp.roll - 90 * dt);
  else if (k.RIGHT.isDown) inp.roll = Math.min(80, inp.roll + 90 * dt);
  else inp.roll *= 0.9;
}

export const ACCION_LABEL: Record<Accion, string> = {
  mate: 'MATE',
  sellar: 'SELLO',
  rechazar: 'RECHAZO',
  papelito: 'PAPELITO',
};

/** Achica la tipografía hasta que el texto entre en el recuadro (ancho y alto máximos). */
export function fitText(t: Phaser.GameObjects.Text, maxW: number, maxH: number, start: number, min = 14) {
  t.setWordWrapWidth(maxW);
  let size = Math.round(start);
  t.setFontSize(size);
  while (t.height > maxH && size > min) {
    size -= 1;
    t.setFontSize(size);
  }
}
