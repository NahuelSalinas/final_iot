import Phaser from 'phaser';

// Todo el arte se dibuja en código sobre canvas chicos (un píxel del canvas = un "píxel" del juego)
// y Phaser lo escala con filtro nearest. No hay imágenes externas que cargar ni licenciar.

export const STAGE_W = 320;
export const STAGE_H = 144;
export const PERSON_W = 32;
export const PERSON_H = 52;
export const MATE_W = 18;
export const MATE_H = 26;

export const PAL = {
  ink: '#1b1a2e',
  cream: '#f4e9c8',
  paper: '#f2efe2',
  red: '#c2452d',
  green: '#6aa84f',
  amber: '#e0a030',
  wallUp: '#e6d9b8',
  wallLow: '#6f9a8e',
  wallLowDark: '#5d867b',
  trim: '#cdb98a',
  wood: '#a06b45',
  woodLight: '#b97c52',
  woodDark: '#6b4429',
  woodDarker: '#3d2616',
  skin: '#e0b48a',
  skinShade: '#c99a70',
};

type Ctx = CanvasRenderingContext2D;
const R = (c: Ctx, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
};

function canvas(scene: Phaser.Scene, key: string, w: number, h: number): Ctx | null {
  if (scene.textures.exists(key)) return null;
  const t = scene.textures.createCanvas(key, w, h);
  return t ? t.getContext() : null;
}
function refresh(scene: Phaser.Scene, key: string) {
  (scene.textures.get(key) as Phaser.Textures.CanvasTexture).refresh();
}

// --- fondo y mostrador -----------------------------------------------------

function drawBackground(c: Ctx) {
  R(c, PAL.wallUp, 0, 0, STAGE_W, 70);
  R(c, PAL.wallLow, 0, 70, STAGE_W, 74);
  R(c, PAL.trim, 0, 67, STAGE_W, 3);
  R(c, PAL.wallLowDark, 0, 70, STAGE_W, 2);
  for (let x = 0; x < STAGE_W; x += 32) R(c, PAL.wallLowDark, x, 72, 1, 72);
  // manchas de humedad en la pared: la Municipalidad tiene historia
  R(c, '#d9ccaa', 40, 52, 22, 3);
  R(c, '#d9ccaa', 44, 55, 10, 2);
  R(c, '#d9ccaa', 270, 6, 18, 3);

  // tubo fluorescente
  R(c, '#fffbe0', 112, 0, 96, 3);
  R(c, '#c9c4a8', 112, 3, 96, 1);

  // estantería izquierda y derecha con biblioratos
  const shelf = (x: number) => {
    R(c, '#3a281c', x, 12, 54, 54);
    R(c, '#2a1c13', x + 2, 14, 50, 50);
    const colores = ['#c2452d', '#3f6fa5', '#6aa84f', '#e0a030', '#8a5fa5', '#d9d2b8'];
    for (let row = 0; row < 3; row++) {
      const y = 14 + row * 17;
      R(c, '#4a3426', x + 2, y + 15, 50, 2);
      let cx = x + 3;
      let i = row * 2 + Math.floor(x / 40);
      while (cx < x + 50) {
        const w = 3 + ((i * 7) % 3);
        const h = 11 + ((i * 5) % 4);
        R(c, colores[i % colores.length], cx, y + 15 - h, w, h);
        R(c, 'rgba(0,0,0,0.25)', cx + w - 1, y + 15 - h, 1, h);
        cx += w + 1;
        i++;
      }
    }
  };
  shelf(8);
  shelf(258);

  // cartel de la oficina (el texto lo pone Phaser, nítido)
  R(c, '#2a2848', 100, 7, 120, 17);
  R(c, PAL.amber, 100, 7, 120, 1);
  R(c, PAL.amber, 100, 23, 120, 1);

  // reloj de pared (las agujas son dinámicas)
  const cx = 160;
  const cy = 46;
  for (let dy = -13; dy <= 13; dy++) {
    for (let dx = -13; dx <= 13; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= 13) R(c, d > 11 ? PAL.woodDarker : PAL.paper, cx + dx, cy + dy, 1, 1);
    }
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    R(c, PAL.ink, Math.round(cx + Math.sin(a) * 9), Math.round(cy - Math.cos(a) * 9), 1, 1);
  }

  // calendario y cuadro del intendente
  R(c, PAL.paper, 120, 34, 15, 19);
  R(c, PAL.red, 120, 34, 15, 4);
  for (let i = 0; i < 4; i++) R(c, '#bdb7a0', 122, 41 + i * 3, 11, 1);
  R(c, '#4a3426', 185, 33, 17, 21);
  R(c, '#a9c2cf', 187, 35, 13, 17);
  R(c, PAL.skin, 191, 40, 5, 6);
  R(c, '#2b2b2b', 190, 38, 7, 3);
  R(c, '#2a2848', 189, 46, 9, 6);
}

function drawCounter(c: Ctx) {
  // objetos sobre el mostrador
  // pila de expedientes (izquierda)
  R(c, '#d9d2b8', 16, 96, 26, 8);
  R(c, '#bdb7a0', 16, 99, 26, 1);
  R(c, '#c2452d', 18, 91, 22, 5);
  R(c, '#3f6fa5', 20, 87, 20, 4);
  // radio de Gerardo (derecha)
  R(c, '#4a3426', 268, 90, 26, 14);
  R(c, '#d9c58a', 271, 93, 10, 8);
  R(c, '#1b1a2e', 284, 94, 6, 6);
  R(c, '#cfd8dc', 292, 76, 1, 15);
  R(c, '#cfd8dc', 286, 78, 7, 1);
  // maceta
  R(c, '#b0583a', 300, 96, 10, 8);
  R(c, '#4f8a3a', 298, 86, 14, 11);
  R(c, '#6aa84f', 301, 82, 8, 7);

  // tapa y frente
  R(c, PAL.woodLight, 0, 104, STAGE_W, 2);
  R(c, PAL.wood, 0, 106, STAGE_W, 5);
  R(c, PAL.woodDark, 0, 111, STAGE_W, 33);
  for (let x = 12; x < STAGE_W; x += 24) R(c, '#5a3822', x, 112, 1, 28);
  R(c, PAL.woodDarker, 0, 140, STAGE_W, 4);
  // placa de bronce
  R(c, '#c9a227', 128, 120, 64, 12);
  R(c, '#8a6c12', 128, 131, 64, 1);
  for (let i = 0; i < 8; i++) R(c, '#6a5210', 132 + i * 7, 124, 5, 2);
}

// --- personajes ------------------------------------------------------------

export interface PersonaSpec {
  skin: string;
  skinShade: string;
  hair: string;
  shirt: string;
  shirtDark: string;
  tie?: string;
  glasses?: boolean;
  mustache?: boolean;
  bald?: boolean;
  lanyard?: boolean;
  cardigan?: boolean;
}

export type Estado = { boca: 0 | 1; animo: 0 | 1 | 2 };
// animo: 0 normal/cansado, 1 irritado o confundido, 2 tranquilo (sonríe)

function persona(c: Ctx, p: PersonaSpec, e: Estado, quien: 'tomas' | 'gerardo') {
  // cuerpo
  R(c, p.shirt, 3, 31, 26, 21);
  R(c, p.shirtDark, 3, 31, 3, 21);
  R(c, p.shirtDark, 26, 31, 3, 21);
  if (p.cardigan) {
    R(c, '#f1efe6', 12, 31, 8, 21);
    R(c, p.shirtDark, 12, 31, 1, 21);
    R(c, p.shirtDark, 19, 31, 1, 21);
    R(c, '#c9a227', 21, 40, 2, 2);
    R(c, '#c9a227', 21, 46, 2, 2);
  } else {
    R(c, '#f1efe6', 12, 31, 8, 4);
  }
  if (p.tie) {
    R(c, p.tie, 15, 33, 2, 12);
    R(c, 'rgba(0,0,0,0.3)', 15, 32, 2, 2);
  }
  if (p.lanyard) {
    R(c, PAL.red, 14, 31, 1, 9);
    R(c, PAL.red, 17, 31, 1, 9);
    R(c, '#fff', 13, 40, 6, 5);
    R(c, PAL.ink, 14, 42, 4, 1);
  }
  // cuello
  R(c, p.skinShade, 13, 27, 6, 5);

  // cabeza
  R(c, p.skin, 9, 8, 14, 19);
  R(c, p.skinShade, 9, 8, 1, 19);
  R(c, p.skinShade, 22, 8, 1, 19);
  R(c, p.skinShade, 10, 26, 12, 1);
  R(c, p.skin, 7, 15, 2, 5);
  R(c, p.skin, 23, 15, 2, 5);
  R(c, p.skinShade, 8, 16, 1, 3);
  R(c, p.skinShade, 23, 16, 1, 3);

  // pelo
  if (p.bald) {
    R(c, p.hair, 8, 11, 2, 8);
    R(c, p.hair, 22, 11, 2, 8);
    R(c, p.hair, 10, 8, 12, 2); // peinado de lado
    R(c, p.skinShade, 12, 7, 8, 1);
  } else {
    R(c, p.hair, 8, 5, 16, 6);
    R(c, p.hair, 8, 9, 2, 6);
    R(c, p.hair, 22, 9, 2, 6);
    R(c, p.hair, 15, 3, 3, 2);
    R(c, p.hair, 18, 4, 2, 1);
  }

  // ojos
  const ojosCansados = quien === 'gerardo' && e.animo === 0;
  const ojosGrandes = quien === 'tomas' && e.animo === 1;
  const eyeY = ojosGrandes ? 14 : 15;
  const eyeH = ojosGrandes ? 4 : ojosCansados ? 2 : 3;
  for (const ex of [11, 17]) {
    R(c, '#fff', ex, eyeY + (ojosCansados ? 1 : 0), 4, eyeH);
    R(c, PAL.ink, ex + (ex === 11 ? 2 : 1), eyeY + (ojosCansados ? 1 : 0), 2, eyeH);
  }
  if (ojosCansados) {
    R(c, p.skinShade, 11, 15, 4, 1);
    R(c, p.skinShade, 17, 15, 4, 1);
    R(c, 'rgba(90,60,40,0.35)', 11, 18, 4, 1); // ojeras
    R(c, 'rgba(90,60,40,0.35)', 17, 18, 4, 1);
  }

  // cejas
  const ceja = p.hair === '#2b2b2b' || p.bald ? '#555' : p.hair;
  if (e.animo === 1 && quien === 'gerardo') {
    // enojado: cejas inclinadas hacia el centro
    R(c, ceja, 10, 12, 3, 1);
    R(c, ceja, 12, 13, 3, 1);
    R(c, ceja, 17, 13, 3, 1);
    R(c, ceja, 19, 12, 3, 1);
  } else if (e.animo === 1) {
    // confundido: una ceja alta, otra baja
    R(c, ceja, 10, 10, 4, 1);
    R(c, ceja, 17, 12, 4, 1);
  } else {
    R(c, ceja, 10, 12, 5, 1);
    R(c, ceja, 17, 12, 5, 1);
  }

  // anteojos
  if (p.glasses) {
    const f = '#2b2b3a';
    for (const gx of [10, 17]) {
      R(c, f, gx, 14, 6, 1);
      R(c, f, gx, 18, 6, 1);
      R(c, f, gx, 14, 1, 5);
      R(c, f, gx + 5, 14, 1, 5);
    }
    R(c, f, 16, 15, 1, 1);
  }

  // nariz
  R(c, p.skinShade, 15, 18, 2, 3);

  // bigote
  if (p.mustache) {
    R(c, p.hair === '#2b2b2b' ? '#444' : p.hair, 12, 21, 8, 2);
  }

  // boca
  const my = p.mustache ? 24 : 23;
  const boca = '#7a2a20';
  if (e.boca) {
    R(c, boca, 13, my, 6, 3);
    R(c, PAL.red, 14, my + 2, 4, 1);
  } else if (e.animo === 2) {
    R(c, boca, 12, my - 1, 1, 1);
    R(c, boca, 13, my, 6, 1);
    R(c, boca, 19, my - 1, 1, 1);
  } else if (e.animo === 1 && quien === 'gerardo') {
    R(c, boca, 13, my + 1, 6, 1);
    R(c, boca, 12, my + 2, 1, 1);
    R(c, boca, 19, my + 2, 1, 1);
  } else {
    R(c, boca, 13, my, 6, 1);
  }
}

export const TOMAS: PersonaSpec = {
  skin: PAL.skin, skinShade: PAL.skinShade, hair: '#6b4a2e', shirt: '#4a6fa5', shirtDark: '#3b5a87',
  glasses: true, lanyard: true,
};
export const GERARDO: PersonaSpec = {
  skin: '#d9a47c', skinShade: '#bd8860', hair: '#2b2b2b', shirt: '#6e6a4f', shirtDark: '#575339',
  tie: '#7a2a20', mustache: true, bald: true, cardigan: true,
};

export const personaKey = (quien: 'tomas' | 'gerardo', e: Estado) => `${quien}_${e.animo}_${e.boca}`;

// --- mate ----------------------------------------------------------------------

function drawMate(c: Ctx) {
  // calabaza
  R(c, '#5b3418', 3, 21, 12, 3);
  R(c, '#7a4a26', 2, 11, 14, 11);
  R(c, '#8b5a2e', 3, 12, 8, 9);
  R(c, '#6a3f1f', 13, 12, 3, 10);
  R(c, '#c9a227', 2, 10, 14, 2); // virola
  R(c, '#e8c64a', 2, 10, 14, 1);
  // yerba
  R(c, '#4a7024', 3, 7, 12, 4);
  R(c, '#5e8a2e', 4, 7, 9, 2);
  R(c, '#7aa83a', 6, 7, 3, 1);
  // bombilla
  R(c, '#cfd8dc', 12, 0, 2, 2);
  R(c, '#cfd8dc', 11, 2, 1, 4);
  R(c, '#9fb0b8', 10, 5, 1, 4);
  R(c, '#eceff1', 11, 2, 1, 1);
}

// --- punto de entrada --------------------------------------------------------

export function makeTextures(scene: Phaser.Scene) {
  let c = canvas(scene, 'bg', STAGE_W, STAGE_H);
  if (c) {
    drawBackground(c);
    refresh(scene, 'bg');
  }
  c = canvas(scene, 'counter', STAGE_W, STAGE_H);
  if (c) {
    drawCounter(c);
    refresh(scene, 'counter');
  }
  for (const animo of [0, 1, 2] as const) {
    for (const boca of [0, 1] as const) {
      const e: Estado = { animo, boca };
      for (const q of ['tomas', 'gerardo'] as const) {
        const key = personaKey(q, e);
        const cc = canvas(scene, key, PERSON_W, PERSON_H);
        if (cc) {
          persona(cc, q === 'tomas' ? TOMAS : GERARDO, e, q);
          refresh(scene, key);
        }
      }
    }
  }
  c = canvas(scene, 'mate', MATE_W, MATE_H);
  if (c) {
    drawMate(c);
    refresh(scene, 'mate');
  }
}
