import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FINAL_IDS, TRAMOS_TOTAL, calcularPuntaje, type FilaRanking, type FinalId, type Stats } from '../src/shared/score.js';
import { db } from './_db.js';
import { clampNum, limitar } from './_guard.js';

const TITULO: Record<FinalId, string> = { bueno: 'Escritura firmada', justo: 'Por el pelo', persiana: 'Vuelva mañana', cierre: 'Se acabó la hora' };
// Iniciales que no queremos ver en el ranking. Se guardan como "***".
const VEDADAS = new Set(['PUT', 'PTO', 'PTA', 'CUL', 'VGA', 'SEX', 'NZI', 'KKK', 'FUK', 'FCK', 'SHT', 'ORT']);
const MIN_SEG_POR_TRAMO = 15;
const TOP_AVISO = 10;

const int = (v: unknown, hi: number) => Math.round(clampNum(v, 0, hi, 0));

/**
 * Guarda una partida. El cliente manda estadísticas, no el puntaje: el servidor lo calcula.
 * No es anti-trampas (el cliente puede mentir en las estadísticas), pero descarta lo imposible.
 * Si la partida entra al top, avisa al webhook de Make, que la manda a Telegram.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!limitar(req, res)) return;
  const sql = db();
  if (!sql) return res.status(503).json({ error: 'ranking no configurado' });

  const b = (req.body ?? {}) as { iniciales?: unknown; stats?: Partial<Stats> };
  const s = b.stats;
  if (!s || !FINAL_IDS.includes(s.final as FinalId)) return res.status(400).json({ error: 'bad request' });

  const stats: Stats = {
    final: s.final as FinalId,
    tramos: int(s.tramos, TRAMOS_TOTAL),
    relacion: int(s.relacion, 100),
    segundos: int(s.segundos, 900),
    sellosMal: int(s.sellosMal, 200),
    rechazosOk: int(s.rechazosOk, 200),
    rechazosMal: int(s.rechazosMal, 200),
    mates: int(s.mates, 200),
    derrames: int(s.derrames, 200),
    papelitos: int(s.papelitos, 200),
  };
  const gano = stats.final === 'bueno' || stats.final === 'justo';
  if ((gano && stats.tramos !== TRAMOS_TOTAL) || stats.segundos < stats.tramos * MIN_SEG_POR_TRAMO) {
    return res.status(422).json({ error: 'partida inválida' });
  }

  const limpias = (typeof b.iniciales === 'string' ? b.iniciales : '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'A');
  const iniciales = VEDADAS.has(limpias) ? '***' : limpias;
  const puntaje = calcularPuntaje(stats);

  try {
    await sql`
      INSERT INTO partidas (iniciales, puntaje, final, tramos, relacion, segundos, sellos_mal, rechazos_ok, rechazos_mal, mates, derrames, papelitos)
      VALUES (${iniciales}, ${puntaje}, ${stats.final}, ${stats.tramos}, ${stats.relacion}, ${stats.segundos}, ${stats.sellosMal},
              ${stats.rechazosOk}, ${stats.rechazosMal}, ${stats.mates}, ${stats.derrames}, ${stats.papelitos})`;
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM partidas WHERE puntaje > ${puntaje}`;
    const posicion = (n as number) + 1;
    const top = (await sql`SELECT iniciales, puntaje, final, tramos FROM partidas ORDER BY puntaje DESC, creado ASC LIMIT 10`) as FilaRanking[];

    if (posicion <= TOP_AVISO) await avisarMake({ iniciales, puntaje, posicion, final: TITULO[stats.final], tramos: stats.tramos, segundos: stats.segundos, esRecord: posicion === 1 });
    res.json({ puntaje, posicion, top });
  } catch {
    res.status(502).json({ error: 'base de datos no disponible' });
  }
}

/** Webhook de Make (Telegram). Si falla o no está configurado, la partida igual quedó guardada. */
async function avisarMake(payload: Record<string, unknown>) {
  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url) return;
  const key = process.env.MAKE_WEBHOOK_KEY;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(key ? { 'x-make-apikey': key } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    /* el aviso es secundario */
  }
}
