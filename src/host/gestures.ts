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
  cooldownMs: 650,
  reboteMs: 1000, // tras un golpe o sacudida, el rebote de la mano no cuenta como otro gesto
};

export class GestureDetector {
  private flips: number[] = [];
  private lastSign = 0;
  private lastFire = 0;
  private prev = { x: 0, y: 0, z: 0 };

  constructor(private onGesture: (g: GestureName) => void) {}

  feed(p: SensorPacket, now = performance.now()) {
    // promedio con la muestra anterior: un pico de un solo paquete (ruido) no alcanza
    const ax = Math.abs(p.x + this.prev.x) / 2;
    const ay = Math.abs(p.y + this.prev.y) / 2;
    const az = Math.abs(p.z + this.prev.z) / 2;
    this.prev = { x: p.x, y: p.y, z: p.z };

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
      else if (az > ay * T.dominance && az > ax * T.dominance && now - this.lastFire > T.reboteMs) this.fire('flick', now);
    }
  }

  private fire(g: GestureName, now: number) {
    this.lastFire = now;
    this.flips = [];
    this.lastSign = 0;
    this.onGesture(g);
  }
}
