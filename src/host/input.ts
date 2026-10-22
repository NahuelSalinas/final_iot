import type { Accion, SensorPacket } from '../shared/protocol';
import type { GestureName } from './gestures';

/** Gesto detectado → acción del juego. */
export const GESTO_A_ACCION: Record<GestureName, Accion> = {
  stamp: 'sellar',
  shake: 'rechazar',
  flick: 'papelito',
};

/** Estado de entrada compartido entre la red y las escenas. */
export class InputState {
  /** inclinación lateral en grados (positivo = derecha) */
  roll = 0;
  pitch = 0;
  yaw = 0;
  connected = false;

  private yawZero = 0;
  private lastAlpha = 0;
  private listeners = new Set<(a: Accion) => void>();

  /** Devuelve la función para darse de baja (hay que llamarla al cerrar la escena). */
  onAccion(fn: (a: Accion) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(a: Accion) {
    [...this.listeners].forEach((fn) => fn(a));
  }

  applySensor(p: SensorPacket) {
    this.lastAlpha = p.a;
    this.roll = p.g;
    this.pitch = p.b;
    this.yaw = wrap180(p.a - this.yawZero);
  }

  calibrate() {
    this.yawZero = this.lastAlpha;
    this.yaw = 0;
  }
}

function wrap180(d: number): number {
  return ((((d + 180) % 360) + 360) % 360) - 180;
}

export const POUR_MIN = 15; // grados mínimos para servir
export const SPILL_ANGLE = 35; // a partir de acá se derrama
export const POUR_SECS = 1; // cuánto hay que sostener el ángulo
const SPILL_SECS = 0.35;

/**
 * Convierte la inclinación del celular en "serví un mate" o "se derramó".
 * Sostener entre POUR_MIN y SPILL_ANGLE durante POUR_SECS sirve; pasarse de SPILL_ANGLE derrama.
 */
export class PourDetector {
  /** 0..1, cuánto falta para servir (para dibujar el anillo) */
  progress = 0;
  spilling = false;
  private t = 0;
  private spillT = 0;
  private cooldown = 0;

  update(roll: number, dt: number): 'pour' | 'spill' | null {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const ang = Math.abs(roll);
    this.spilling = ang > SPILL_ANGLE;
    if (this.spilling) {
      this.t = 0;
      this.progress = 0;
      this.spillT += dt;
      if (this.spillT >= SPILL_SECS && this.cooldown === 0) {
        this.cooldown = 1.5;
        this.spillT = 0;
        return 'spill';
      }
      return null;
    }
    this.spillT = 0;
    if (ang >= POUR_MIN && this.cooldown === 0) {
      this.t += dt;
      this.progress = Math.min(1, this.t / POUR_SECS);
      if (this.t >= POUR_SECS) {
        this.t = 0;
        this.progress = 0;
        this.cooldown = 1;
        return 'pour';
      }
    } else {
      this.t = 0;
      this.progress = 0;
    }
    return null;
  }
}
