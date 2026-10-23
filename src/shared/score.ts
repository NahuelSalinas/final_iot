// Estadísticas de una partida y fórmula del puntaje. Las usan el juego (para mostrarlo al terminar)
// y el servidor (que es quien lo calcula de verdad al guardar la partida).

export const FINAL_IDS = ['bueno', 'justo', 'persiana', 'cierre'] as const;
export type FinalId = (typeof FINAL_IDS)[number];

/** Segundos reales que dura el día de la oficina (11:00 a 13:00). */
export const SEGUNDOS_PARTIDA = 780;
export const TRAMOS_TOTAL = 5;

export interface Stats {
  final: FinalId;
  /** ventanillas superadas */
  tramos: number;
  relacion: number;
  segundos: number;
  sellosMal: number;
  rechazosOk: number;
  rechazosMal: number;
  mates: number;
  derrames: number;
  papelitos: number;
}

const BONUS_FINAL: Record<FinalId, number> = { bueno: 2000, justo: 500, persiana: 0, cierre: 0 };

export function calcularPuntaje(s: Stats): number {
  const gano = s.final === 'bueno' || s.final === 'justo';
  const tiempoRestante = gano ? Math.max(0, SEGUNDOS_PARTIDA - s.segundos) : 0;
  const total =
    s.tramos * 1000 +
    s.relacion * 10 +
    s.rechazosOk * 150 +
    tiempoRestante * 2 +
    BONUS_FINAL[s.final] -
    s.sellosMal * 100 -
    s.rechazosMal * 75 -
    s.derrames * 50 -
    s.papelitos * 30;
  return Math.max(0, Math.round(total));
}

export interface FilaRanking {
  iniciales: string;
  puntaje: number;
  final: FinalId;
  tramos: number;
}

export interface RespuestaScore {
  puntaje: number;
  posicion: number;
  top: FilaRanking[];
}
