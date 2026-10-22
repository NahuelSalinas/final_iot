import type { VercelRequest, VercelResponse } from '@vercel/node';

// Límite simple por IP, en memoria. En serverless cada instancia lleva su propia cuenta,
// así que es un freno contra el abuso casual, no una defensa completa.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const hits = new Map<string, number[]>();

export function limitar(req: VercelRequest, res: VercelResponse): boolean {
  const fwd = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim() ?? req.socket?.remoteAddress ?? 'desconocida';
  const now = Date.now();
  const recientes = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recientes.push(now);
  hits.set(ip, recientes);
  if (recientes.length > MAX_PER_WINDOW) {
    res.status(429).json({ error: 'demasiadas solicitudes' });
    return false;
  }
  return true;
}

export const clampNum = (v: unknown, lo: number, hi: number, def: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;

export const recortar = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
