// Efectos sintetizados con Web Audio: no hay archivos que cargar ni derechos de autor que revisar.

let ctx: AudioContext | undefined;
let muted = false;

function ac(): AudioContext | undefined {
  try {
    ctx ??= new AudioContext();
    return ctx;
  } catch {
    return undefined;
  }
}

/** El navegador exige un gesto del usuario en la PC para habilitar el audio. */
export function unlockAudio() {
  const c = ac();
  if (c && c.state === 'suspended') void c.resume();
}

export function setMuted(m: boolean) {
  muted = m;
}

interface Tono {
  f: number;
  t?: number; // inicio relativo en segundos
  d: number; // duración
  type?: OscillatorType;
  v?: number; // volumen
  to?: number; // frecuencia final
}

function tonos(list: Tono[]) {
  const c = ac();
  if (!c || muted || c.state !== 'running') return;
  const now = c.currentTime;
  for (const n of list) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = n.type ?? 'square';
    const t0 = now + (n.t ?? 0);
    o.frequency.setValueAtTime(n.f, t0);
    if (n.to) o.frequency.exponentialRampToValueAtTime(n.to, t0 + n.d);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(n.v ?? 0.08, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.d);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + n.d + 0.02);
  }
}

function ruido(d: number, v = 0.1, filtro = 1200) {
  const c = ac();
  if (!c || muted || c.state !== 'running') return;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * d), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filtro;
  const g = c.createGain();
  g.gain.value = v;
  src.connect(f).connect(g).connect(c.destination);
  src.start();
}

export type Sfx = 'sellar' | 'ok' | 'mal' | 'mate' | 'derrame' | 'papelito' | 'rechazar' | 'hablar' | 'ganar' | 'perder' | 'paso';

export function sfx(name: Sfx) {
  switch (name) {
    case 'sellar':
      tonos([{ f: 120, to: 50, d: 0.12, type: 'triangle', v: 0.25 }]);
      ruido(0.08, 0.2, 800);
      break;
    case 'ok':
      tonos([{ f: 523, d: 0.1 }, { f: 784, t: 0.1, d: 0.18 }]);
      break;
    case 'mal':
      tonos([{ f: 180, d: 0.18, type: 'sawtooth', v: 0.1 }, { f: 130, t: 0.16, d: 0.25, type: 'sawtooth', v: 0.1 }]);
      break;
    case 'mate':
      ruido(0.5, 0.12, 900);
      tonos([{ f: 660, t: 0.45, d: 0.08, type: 'sine' }]);
      break;
    case 'derrame':
      ruido(0.35, 0.18, 2500);
      break;
    case 'papelito':
      ruido(0.18, 0.1, 4000);
      break;
    case 'rechazar':
      tonos([{ f: 300, to: 180, d: 0.15, type: 'square', v: 0.07 }, { f: 300, t: 0.18, to: 180, d: 0.15, type: 'square', v: 0.07 }]);
      break;
    case 'hablar':
      tonos([{ f: 200 + Math.random() * 90, d: 0.04, type: 'square', v: 0.025 }]);
      break;
    case 'ganar':
      tonos([523, 659, 784, 1047].map((f, i) => ({ f, t: i * 0.13, d: 0.2 })));
      break;
    case 'perder':
      tonos([392, 330, 262, 196].map((f, i) => ({ f, t: i * 0.2, d: 0.3, type: 'sawtooth' as const, v: 0.07 })));
      break;
    case 'paso':
      tonos([{ f: 440, d: 0.07 }, { f: 660, t: 0.07, d: 0.1 }]);
      break;
  }
}
