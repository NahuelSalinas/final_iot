// Parte pública de cada tramo. El dato secreto NO está acá: vive en api/_cases.ts.
import { SEGUNDOS_PARTIDA } from '../shared/score';

export interface Dificultad {
  /** paciencia que pierde Gerardo por segundo */
  decay: number;
  /** probabilidad de que Tomás se equivoque en su primera anotación */
  errorProb: number;
  /** papelitos disponibles */
  papelitos: number;
  /** cebadas de mate disponibles */
  cebadas: number;
}

export interface CasoCliente {
  titulo: string;
  /** Lo que el jugador tiene que lograr, en sus palabras. */
  pedido: string;
  /** Primera frase de Tomás: escrita a mano para que el tramo arranque sin esperar al LLM. */
  apertura: string;
  animoInicial: number;
  claridadInicial: number;
  /** Papelitos que el jugador puede lanzar, en orden. */
  pistas: string[];
  dif: Dificultad;
  /** Consejo que aparece al arrancar el tramo. */
  consejo: string;
}

export const CASOS_CLIENTE: CasoCliente[] = [
  {
    titulo: 'Formulario correcto',
    pedido: 'Que Tomás anote el número y la letra del formulario de Libre Deuda.',
    apertura: 'Jefe, buen día. Vengo por un papel para un señor. Es sobre una deuda. O una libreta. Algo con libre.',
    animoInicial: 75,
    claridadInicial: 30,
    pistas: ['Preguntale por el FORMULARIO de Libre Deuda.', 'Que te diga el número y la letra, exactos.', 'FORMULARIO. Número. Letra.'],
    dif: { decay: 0.4, errorProb: 1, papelitos: 3, cebadas: 3 },
    consejo: 'Tomás está perdido: lanzale un papelito. Después, fijate que anote lo mismo que dijo Gerardo.',
  },
  {
    titulo: 'Oficina y piso',
    pedido: 'Que Tomás anote en qué oficina y piso se firma el formulario.',
    apertura: 'Jefe, ya tenemos el formulario. Ahora falta saber dónde se firma. O se pega. Algo se hace con una birome.',
    animoInicial: 70,
    claridadInicial: 30,
    pistas: ['Preguntá en qué OFICINA se firma.', 'Pedile también el piso.'],
    dif: { decay: 0.5, errorProb: 0.6, papelitos: 2, cebadas: 3 },
    consejo: 'Cuidá la yerba: solo tenés 3 cebadas por ventanilla.',
  },
  {
    titulo: 'Sello requerido',
    pedido: 'Que Tomás anote qué sello hace falta y de qué área.',
    apertura: 'Casi terminamos, jefe. Queda lo del sello. ¿Había un sello? Había un sello. ¿O era un sticker?',
    animoInicial: 65,
    claridadInicial: 25,
    pistas: ['Preguntá qué SELLO hace falta.', 'Preguntá de qué área es ese sello.'],
    dif: { decay: 0.6, errorProb: 0.7, papelitos: 2, cebadas: 3 },
    consejo: 'Cada papelito molesta un poco a Gerardo. Usalos cuando Tomás esté realmente perdido.',
  },
  {
    titulo: 'Horario de atención',
    pedido: 'Que Tomás anote en qué horario atiende esa oficina.',
    apertura: 'Jefe, otra más. Es sobre cuándo se puede ir. Digo, a la oficina esa. ¿Atenderán? ¿Es una oficina que atiende?',
    animoInicial: 60,
    claridadInicial: 25,
    pistas: ['Preguntá el HORARIO de atención.', 'Que sea la hora exacta, no "a la mañana".'],
    dif: { decay: 0.7, errorProb: 0.75, papelitos: 1, cebadas: 2 },
    consejo: 'Se hace tarde: mirá el reloj de la pared. Cada minuto cuenta.',
  },
  {
    titulo: 'Expediente madre',
    pedido: 'Que Tomás anote el número del expediente madre del kiosco.',
    apertura: 'Jefe, la última. Es el expediente madre. Del kiosco de la señora Nelly. Me dijeron que usted sabe.',
    animoInicial: 60,
    claridadInicial: 25,
    pistas: ['Preguntá por el EXPEDIENTE madre.'],
    dif: { decay: 0.8, errorProb: 0.8, papelitos: 1, cebadas: 2 },
    consejo: 'Gerardo solo colabora de verdad con quien le cae bien. Tratalo con cuidado.',
  },
];

/** Reloj de la pared: arranca a las 11:00 y la oficina cierra a las 13:00. */
export const RELOJ = { inicioMin: 11 * 60, cierreMin: 13 * 60, segundosReales: SEGUNDOS_PARTIDA };

export const HISTORIA: string[] = [
  'Martes, 10:40.\nTu abuela Nelly atendió el kiosco de la esquina durante 41 años. Ahora es tuyo, si presentás el Certificado de Libre Deuda antes de las 13:00. Después, remate.',
  'Municipalidad de Villa Expediente.\nHay una sola ventanilla abierta: Mesa de Entradas. Atiende Gerardo, que tiene 31 años de oficio y ninguna prisa. Hoy lo secunda Tomás, el pasante nuevo.',
  'Vos no podés hablar. Nadie te lo preguntó.\nPero tenés un celular en la mano, y Gerardo tiene sed.',
];

export interface Final {
  titulo: string;
  texto: string;
  color: string;
}

export const FINALES = {
  bueno: {
    titulo: 'Escritura firmada',
    texto:
      'Gerardo estampa el último sello y, sin mirarte, dice:\n"Tu abuela me fiaba los alfajores de maicena. Digamos que estamos a mano."\nEl kiosco de Nelly abre el lunes.',
    color: '#b9e0a5',
  },
  justo: {
    titulo: 'Por el pelo',
    texto: '12:59. Gerardo estampa el sello como quien tira una moneda a una fuente.\n"Ya está. Andá, antes de que me arrepienta."\nEl kiosco es tuyo. Tu relación con la Municipalidad, no tanto.',
    color: '#e0a030',
  },
  persiana: {
    titulo: 'Vuelva mañana',
    texto: 'A Gerardo se le acabó la paciencia y bajó la persiana.\nEl kiosco de Nelly va a remate.\nTomás te acompaña a la salida y te regala una birome.',
    color: '#c2452d',
  },
  cierre: {
    titulo: 'Se acabó la hora',
    texto: 'El reloj marcó las 13:00 y la Municipalidad cerró con vos todavía en la fila.\nEl remate es el lunes.',
    color: '#c2452d',
  },
} satisfies Record<string, Final>;

export type FinalKey = keyof typeof FINALES;
