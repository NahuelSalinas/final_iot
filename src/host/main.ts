import Phaser from 'phaser';
import QRCode from 'qrcode';
import { makeRoomCode } from '../shared/protocol';
import { unlockAudio } from './audio';
import { BootScene } from './boot';
import { GestureDetector } from './gestures';
import { GESTO_A_ACCION, InputState } from './input';
import { IntroScene } from './intro';
import { startHost } from './net';
import { phone } from './phone';
import { DeskScene } from './scene';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const room = makeRoomCode();
const input = new InputState();
const gestures = new GestureDetector((g) => input.emit(GESTO_A_ACCION[g]));
const params = new URLSearchParams(location.search);

// En desarrollo localhost no sirve para el celular: usamos la IP de la red local.
const base = ['localhost', '127.0.0.1'].includes(location.hostname) ? __LAN_ORIGIN__ : location.origin;
const url = `${base}/controller.html?r=${room}`;

$('code').textContent = room;
void QRCode.toDataURL(url, { margin: 1, width: 260 }).then((src) => ($<HTMLImageElement>('qr').src = src));
$('url').textContent = url;

// El navegador solo habilita el audio tras un gesto del usuario en esta ventana.
for (const ev of ['pointerdown', 'keydown'] as const) window.addEventListener(ev, unlockAudio);

let game: Phaser.Game | undefined;

async function startGame(skipIntro = false) {
  if (game) return;
  $('lobby').classList.add('hidden');
  // Espera (con tope) a las fuentes; si no hay internet se usa la monoespaciada del sistema.
  await Promise.race([
    Promise.all([document.fonts.load('24px "VT323"'), document.fonts.load('16px "Press Start 2P"')]),
    new Promise((r) => setTimeout(r, 1500)),
  ]).catch(() => {});
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    pixelArt: true,
    backgroundColor: '#1b1a2e',
    scene: [BootScene, IntroScene, DeskScene],
  });
  game.registry.set('input', input);
  game.registry.set('skipIntro', skipIntro || params.has('skip'));
  if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game; // para depurar en consola
}

const net = startHost(room, {
  onSensor: (p) => {
    input.applySensor(p);
    gestures.feed(p);
  },
  onCtrl: (m) => {
    if (m.t === 'calibrate') input.calibrate();
    else if (m.t === 'act') input.emit(m.a);
  },
  onStatus: (s, detail) => {
    $('conn').textContent = { waiting: 'Esperando celular…', connected: 'Celular conectado ✔', lost: 'Se perdió la conexión: reconectá escaneando de nuevo', error: `Error: ${detail ?? ''}` }[s];
    input.connected = s === 'connected';
    if (s === 'connected') {
      input.calibrate();
      phone.resend();
      void startGame();
    }
  },
});
phone.setSender(net.send);

$('skip').addEventListener('click', () => void startGame());
$('skip-intro')?.addEventListener('click', () => void startGame(true));
