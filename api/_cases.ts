// Casos del trámite. Viven solo en el servidor: el cliente nunca ve el dato secreto.

export interface Caso {
  titulo: string;
  /** Lo que el ciudadano necesita averiguar. */
  objetivo: string;
  /** Palabra que debe aparecer en una pregunta bien hecha. */
  clave: string;
  /** Dato secreto que solo conoce Gerardo. */
  dato: string;
  /** Variantes aceptadas al comparar lo que Tomás anota (se normalizan). */
  aceptar: string[];
  /** Ánimo mínimo (0-100) para que Gerardo suelte el dato. */
  animoMinimo: number;
  /** Si es true, Gerardo solo colabora de verdad cuando la relación con él es buena. */
  requiereRelacion?: boolean;
}

export const CASOS: Caso[] = [
  {
    titulo: 'Formulario correcto',
    objetivo: 'el número y la letra del formulario de Libre Deuda',
    clave: 'formulario',
    dato: 'formulario 27-B',
    aceptar: ['27b'],
    animoMinimo: 30,
  },
  {
    titulo: 'Oficina y piso',
    objetivo: 'en qué oficina y en qué piso se firma el formulario',
    clave: 'oficina',
    dato: 'piso 2, oficina 14',
    aceptar: ['piso2oficina14', 'oficina14piso2', '2o14', 'oficina14'],
    animoMinimo: 40,
  },
  {
    titulo: 'Sello requerido',
    objetivo: 'qué sello hace falta y de qué área es',
    clave: 'sello',
    dato: 'sello de Rentas, en tinta azul',
    aceptar: ['rentas'],
    animoMinimo: 45,
  },
  {
    titulo: 'Horario de atención',
    objetivo: 'en qué horario atiende esa oficina',
    clave: 'horario',
    dato: 'de 11:20 a 11:40',
    aceptar: ['1120'],
    animoMinimo: 50,
  },
  {
    titulo: 'Expediente madre',
    objetivo: 'el número del expediente madre del kiosco',
    clave: 'expediente',
    dato: 'expediente 4471/N',
    aceptar: ['4471'],
    animoMinimo: 55,
    requiereRelacion: true,
  },
];

export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function esCorrecto(caso: Caso, anotado: string): boolean {
  const n = normalizar(anotado);
  return caso.aceptar.some((a) => n.includes(normalizar(a)));
}
