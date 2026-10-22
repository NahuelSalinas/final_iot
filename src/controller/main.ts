import Peer, { type DataConnection } from 'peerjs';
import { CH_CTRL, CH_SENSOR, PEER_PREFIX, type Accion, type CtrlMsg, type HostMsg, type SensorPacket } from '../shared/protocol';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const roomEl = $('room');
const statusEl = $('status');
const dbgEl = $('dbg');
const connectBtn = $<HTMLButtonElement>('connect');
const startEl = $('start');
const playingEl = $('playing');
const panel = $('panel');
const titleEl = $('title');
const subEl = $('sub');
const didEl = $('did');

const room = (new URLSearchParams(location.search).get('r') ?? '').toUpperCase();
roomEl.textContent = room ? `Sala ${room}` : 'Falta el código de sala. Escaneá el QR de la pantalla.';
connectBtn.disabled = !room;

const SEND_HZ = 60;

// Último valor de cada sensor; un temporizador los empaqueta y los envía.
const last = { a: 0, b: 0, g: 0, x: 0, y: 0, z: 0 };
let seq = 0;
let ctrl: DataConnection | undefined;
let sensor: DataConnection | undefined;
let wakeLock: WakeLockSentinel | undefined;
let didTimer: number | undefined;

function setStatus(msg: string) {
  statusEl.textContent = msg;
}

async function askSensorPermission(): Promise<boolean> {
  // iOS 13+: requestPermission existe y debe llamarse dentro de un gesto del usuario.
  type Req = { requestPermission?: () => Promise<'granted' | 'denied'> };
  const dm = (window.DeviceMotionEvent ?? {}) as unknown as Req;
  const dor = (window.DeviceOrientationEvent ?? {}) as unknown as Req;
  try {
    if (typeof dm.requestPermission === 'function' && (await dm.requestPermission()) !== 'granted') return false;
    if (typeof dor.requestPermission === 'function' && (await dor.requestPermission()) !== 'granted') return false;
    return true;
  } catch {
    return false;
  }
}

async function keepAwake() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    /* no crítico */
  }
}

function listenSensors() {
  window.addEventListener('deviceorientation', (e) => {
    last.a = e.alpha ?? 0;
    last.b = e.beta ?? 0;
    last.g = e.gamma ?? 0;
  });
  window.addEventListener('devicemotion', (e) => {
    const acc = e.acceleration;
    last.x = acc?.x ?? 0;
    last.y = acc?.y ?? 0;
    last.z = acc?.z ?? 0;
  });
}

function sendCtrl(m: CtrlMsg) {
  if (ctrl?.open) ctrl.send(m);
}

function startStreaming() {
  setInterval(() => {
    if (!sensor?.open) return;
    const p: SensorPacket = { n: seq++, ts: Date.now(), ...last };
    sensor.send(p);
  }, 1000 / SEND_HZ);
}

/** Mensajes de la PC: instrucción actual, confirmación de gesto y vibración. */
function onHost(m: HostMsg) {
  if (m.t === 'say') {
    titleEl.textContent = m.title;
    subEl.textContent = m.sub ?? '';
    panel.className = m.tone && m.tone !== 'info' ? m.tone : '';
  } else if (m.t === 'did') {
    didEl.textContent = `✔ ${m.label}`;
    clearTimeout(didTimer);
    didTimer = window.setTimeout(() => (didEl.textContent = ''), 900);
  } else if (m.t === 'buzz') {
    // Android sí vibra; iOS no soporta la API y lo ignora.
    navigator.vibrate?.(m.ms);
  }
}

function connect() {
  setStatus('Conectando…');
  const peer = new Peer();
  peer.on('error', (err) => setStatus(`Error de conexión: ${err.type}`));
  peer.on('open', () => {
    const target = PEER_PREFIX + room;
    ctrl = peer.connect(target, { label: CH_CTRL, reliable: true, serialization: 'json' });
    // El flujo de sensores va en un canal desordenado: un paquete perdido no frena a los siguientes.
    sensor = peer.connect(target, { label: CH_SENSOR, reliable: false, serialization: 'json' });
    ctrl.on('open', () => {
      setStatus('');
      startEl.classList.add('hidden');
      playingEl.classList.remove('hidden');
      sendCtrl({ t: 'hello', ua: navigator.userAgent });
    });
    ctrl.on('data', (d) => onHost(d as HostMsg));
    ctrl.on('close', () => setStatus('Se cortó la conexión. Recargá la página.'));
    ctrl.on('error', () => setStatus('Error en el canal de control.'));
  });
}

connectBtn.addEventListener('click', async () => {
  if (!window.isSecureContext) {
    setStatus('Hace falta HTTPS para usar los sensores.');
    return;
  }
  const ok = await askSensorPermission();
  if (!ok) {
    setStatus('Sin permiso de sensores. Revisá los ajustes del navegador.');
    return;
  }
  await keepAwake();
  listenSensors();
  startStreaming();
  connect();
});

document.querySelectorAll<HTMLButtonElement>('#grid button').forEach((b) =>
  b.addEventListener('click', () => sendCtrl({ t: 'act', a: b.dataset.a as Accion })),
);
$('recenter').addEventListener('click', () => sendCtrl({ t: 'calibrate' }));

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && (!wakeLock || wakeLock.released)) void keepAwake();
});

setInterval(() => {
  dbgEl.textContent = `inclinación ${last.g.toFixed(0)}°`;
}, 200);
