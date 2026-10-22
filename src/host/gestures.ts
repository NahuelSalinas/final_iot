import type { SensorPacket } from '../shared/protocol';

export type GestureName = 'shake' | 'flick' | 'stamp';

// Postura esperada: celular en vertical, pantalla hacia el jugador.
//  - stamp: golpe seco hacia abajo → pico en el eje Y del dispositivo.
//  - flick: empujón hacia adelante → pico en el eje Z (normal a la pantalla).
//  - shake: vaivén rápido → varios cambios de signo con amplitud sostenida.
// Los umbrales son un punto de partida y hay que ajustarlos con dispositivos reales.
const T = {
  spike: 14, // m/s² para stamp/flick
  dominance: 1.8, // el eje ganador debe superar al resto por este factor
  shakeAmp: 7,
  shakeFlips: 4,
  shakeWindowMs: 700,
  cooldownMs: 450,
};

export class GestureDetector {
  private flips: number[] = [];
  private lastSign = 0;
  private lastFire = 0;

  constructor(private onGesture: (g: GestureName) => void) {}

  feed(p: SensorPacket, now = performance.now()) {
    const ax = Math.abs(p.x);
    const ay = Math.abs(p.y);
    const az = Math.abs(p.z);

    // Sacudida: contamos cambios de signo en el eje con más energía.
    const dom = Math.max(ax, ay, az);
    const axis = ax >= ay && ax >= az ? p.x : ay >= az ? p.y : p.z;
    if (Math.abs(axis) > T.shakeAmp) {
      const s = Math.sign(axis);
      if (s !== 0 && s !== this.lastSign) {
        this.flips.push(now);
        this.lastSign = s;
      }
    }
    this.flips = this.flips.filter((t) => now - t < T.shakeWindowMs);

    if (now - this.lastFire < T.cooldownMs) return;

    if (this.flips.length >= T.shakeFlips) {
      this.fire('shake', now);
      return;
    }
    if (dom > T.spike) {
      if (ay > az * T.dominance && ay > ax * T.dominance) this.fire('stamp', now);
      else if (az > ay * T.dominance && az > ax * T.dominance) this.fire('flick', now);
    }
  }

  private fire(g: GestureName, now: number) {
    this.lastFire = now;
    this.flips = [];
    this.lastSign = 0;
    this.onGesture(g);
  }
}
