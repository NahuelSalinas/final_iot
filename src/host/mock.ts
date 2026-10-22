import { parseControl, type Control } from '../shared/dialogue';

// Modo sin LLM: guion mínimo para desarrollar y para que el juego siga andando si la API falla.
// Los datos secretos acá son de prueba; el juego real los valida en el servidor (api/_cases.ts).

interface Guion {
  dato: string;
  aceptar: string[];
  /** versión equivocada del dato, para cuando Tomás "se equivoca" */
  error: string;
  animoMinimo: number;
  requiereRelacion?: boolean;
  /** palabra clave que debe aparecer en la pregunta de Tomás para que Gerardo suelte el dato */
  clave: string;
  tomasVago: string[];
  tomasPreciso: string[];
  gerardoNo: string[];
  gerardoSi: string;
}

const GUIONES: Guion[] = [
  {
    dato: 'formulario 27-B',
    aceptar: ['27b'],
    error: 'formulario 72-B',
    animoMinimo: 30,
    clave: 'formulario',
    tomasVago: ['Jefe, ¿y el papel ese… el celeste… es de la deuda o del gas?', 'Perdón, ¿esto era para la libreta sanitaria?'],
    tomasPreciso: ['Jefe, ¿me dice el número del FORMULARIO de Libre Deuda, con la letra?', 'Don Gerardo, el formulario. Número y letra. Por favor.'],
    gerardoNo: ['¿Qué papel? Acá hay mil papeles, decime bien cuál.', 'Preguntá bien, que no estoy para adivinar.', 'Eso no es de acá. Y si fuera de acá, no sé cuál.'],
    gerardoSi: 'Formulario 27-B. Ya me voy.',
  },
  {
    dato: 'piso 2, oficina 14',
    aceptar: ['oficina14'],
    error: 'piso 4, oficina 12',
    animoMinimo: 40,
    clave: 'oficina',
    tomasVago: ['Jefe, ¿era arriba o abajo? ¿Había ascensor? ¿Hay ascensor?', '¿Se firma con birome o con lápiz?'],
    tomasPreciso: ['¿En qué OFICINA y piso se firma, jefe?', 'Gerardo, la oficina. La de la firma. Y el piso.'],
    gerardoNo: ['Eso no es una pregunta, es un suspiro.', 'Concretá, que a las 13 cierro.', 'Si no me decís qué buscás, te mando a todas.'],
    gerardoSi: 'Piso 2, oficina 14. Y no corras, que no hay apuro.',
  },
  {
    dato: 'sello de Rentas, en tinta azul',
    aceptar: ['rentas'],
    error: 'sello de Obras, en tinta azul',
    animoMinimo: 45,
    clave: 'sello',
    tomasVago: ['¿Y si usamos un sticker? Tengo uno de un dinosaurio.', 'El timbre… ¿era redondo o cuadrado? ¿o era una estampilla?'],
    tomasPreciso: ['Jefe, ¿qué SELLO hace falta y de qué área?', 'Don Gerardo, el sello. ¿De qué área es?'],
    gerardoNo: ['Sin saber qué sello, no hay sello.', 'Hacelo claro, que estoy a mitad de un almuerzo mental.', 'Eso me lo preguntás a mí o al muro, no sé.'],
    gerardoSi: 'Sello de Rentas, tinta azul. No me preguntes por qué.',
  },
  {
    dato: 'de 11:20 a 11:40',
    aceptar: ['1120'],
    error: 'de 11:30 a 11:40',
    animoMinimo: 50,
    clave: 'horario',
    tomasVago: ['¿Atenderán por la mañana? ¿O por la tarde, de mañana?', 'Jefe, esa oficina… ¿abre? ¿Existe?'],
    tomasPreciso: ['¿Cuál es el HORARIO de atención, jefe? Exacto, con minutos.', 'Gerardo, el horario. La hora de ir.'],
    gerardoNo: ['Hora de qué. Seamos serios.', 'Si me preguntás así, te digo "a la tarde" y no volvés más.', 'Precisá, que el reloj no se detiene.'],
    gerardoSi: 'De 11:20 a 11:40. Veinte minutos, ni uno más.',
  },
  {
    dato: 'expediente 4471/N',
    aceptar: ['4471'],
    error: 'expediente 4417/N',
    animoMinimo: 55,
    requiereRelacion: true,
    clave: 'expediente',
    tomasVago: ['Jefe, ¿se acuerda de la señora del kiosco? ¿O era una florería?', 'Era algo madre. ¿Madre de qué? ¿Del trámite?'],
    tomasPreciso: ['Don Gerardo, ¿cuál es el EXPEDIENTE madre del kiosco de Nelly?', 'El expediente, jefe. El madre. El número.'],
    gerardoNo: ['Nelly… sigamos.', 'Esa gente del kiosco no deja de dar trabajo.', 'Eso lo vemos si el ciudadano se porta bien.'],
    gerardoSi: 'Expediente 4471/N. Nelly era de las buenas.',
  },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

export function mockCheck(tramo: number, anotado: string): boolean {
  const n = norm(anotado);
  return GUIONES[tramo].aceptar.some((a) => n.includes(norm(a)));
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Body {
  tramo: number;
  who: 'gerardo' | 'tomas';
  estado: { animo: number; claridad: number; relacion: number; mate: boolean; papelito: string | null; errar: boolean };
  history: { who: string; text: string }[];
}

export async function mockDialogue(b: Body, onText: (t: string) => void): Promise<{ texto: string; control: Control }> {
  const g = GUIONES[b.tramo];
  const lastG = [...b.history].reverse().find((h) => h.who === 'gerardo')?.text ?? '';
  const lastT = [...b.history].reverse().find((h) => h.who === 'tomas')?.text ?? '';
  const minimo = g.animoMinimo + (g.requiereRelacion && b.estado.relacion < 50 ? 35 : 0);
  let raw: string;

  if (b.who === 'gerardo') {
    const preciso = norm(lastT).includes(g.clave);
    if (preciso && b.estado.animo >= minimo) raw = `${g.gerardoSi}\n[[animo:-2|revela:true|anota:]]`;
    else raw = `${pick(g.gerardoNo)}\n[[animo:${preciso ? -3 : -6}|revela:false|anota:]]`;
  } else if (lastG && norm(lastG).includes(norm(g.dato).slice(0, 6))) {
    const anota = b.estado.errar ? g.error : g.dato;
    raw = `Ya lo anoté, jefe.\n[[animo:0|revela:false|anota:${anota}]]`;
  } else if (b.estado.claridad >= 55 || b.estado.papelito) {
    raw = `${pick(g.tomasPreciso)}\n[[animo:0|revela:false|anota:]]`;
  } else {
    raw = `${pick(g.tomasVago)}\n[[animo:0|revela:false|anota:]]`;
  }

  await sleep(350); // latencia simulada
  const texto = raw.replace(/\[\[[^\]]*\]\]/, '').trim();
  for (let i = 1; i <= texto.length; i++) {
    onText(texto.slice(0, i));
    await sleep(12);
  }
  return parseControl(raw);
}
