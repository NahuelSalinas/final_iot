// Mensajes entre el celular (control) y la PC (juego).

/** Acciones del jugador. Cada una se puede disparar con un gesto, con un botón del celular o con el teclado. */
export type Accion = 'mate' | 'sellar' | 'rechazar' | 'papelito';

/** Canal fiable: eventos puntuales que no se pueden perder. */
export type CtrlMsg =
  | { t: 'hello'; ua: string }
  | { t: 'calibrate' }
  | { t: 'act'; a: Accion }
  | { t: 'mic'; text: string };

/** PC → celular: instrucciones y feedback. */
export type HostMsg =
  | { t: 'say'; title: string; sub?: string; tone?: 'info' | 'ok' | 'warn' }
  | { t: 'buzz'; ms: number }
  | { t: 'did'; label: string };

/** Canal no fiable y desordenado: flujo de sensores, el último paquete reemplaza al anterior. */
export interface SensorPacket {
  /** secuencia, para descartar paquetes viejos que llegan tarde */
  n: number;
  /** marca de tiempo del celular (ms) */
  ts: number;
  /** orientación en grados */
  a: number; // alpha (yaw)
  b: number; // beta (pitch)
  g: number; // gamma (roll)
  /** aceleración sin gravedad, m/s² (ejes del dispositivo) */
  x: number;
  y: number;
  z: number;
}

export const CH_CTRL = 'ctrl';
export const CH_SENSOR = 'sensor';

/** Prefijo para evitar colisiones de IDs en el servidor público de PeerJS. */
export const PEER_PREFIX = 'mesa-de-entradas-';

export function makeRoomCode(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}
