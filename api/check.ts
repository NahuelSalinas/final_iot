import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CASOS, esCorrecto } from './_cases.js';
import { limitar, recortar } from './_guard.js';

/** Verifica por código, sin LLM, si lo que Tomás anotó coincide con el dato real. */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!limitar(req, res)) return;
  const { tramo, anotado } = (req.body ?? {}) as { tramo: number; anotado: string };
  const caso = CASOS[tramo];
  if (!caso || typeof anotado !== 'string') return res.status(400).json({ error: 'bad request' });
  res.json({ correcto: esCorrecto(caso, recortar(anotado, 200)) });
}
