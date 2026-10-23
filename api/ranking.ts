import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_db.js';
import { clampNum, limitar } from './_guard.js';

/** Top de partidas, de mayor a menor puntaje. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!limitar(req, res)) return;
  const sql = db();
  if (!sql) return res.status(503).json({ error: 'ranking no configurado' });

  const limit = clampNum(Number(req.query?.limit ?? new URL(req.url ?? '', 'http://x').searchParams.get('limit')), 1, 50, 10);
  try {
    const top = await sql`
      SELECT iniciales, puntaje, final, tramos
      FROM partidas ORDER BY puntaje DESC, creado ASC LIMIT ${limit}`;
    res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=30');
    res.json({ top });
  } catch {
    res.status(502).json({ error: 'base de datos no disponible' });
  }
}
