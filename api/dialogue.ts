import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CASOS, normalizar } from './_cases.js';
import { clampNum, limitar, recortar } from './_guard.js';
import { streamChat } from './_llm.js';
import { promptGerardo, promptTomas, type Estado, type Quien } from './_prompts.js';

interface Body {
  tramo: number;
  who: Quien;
  estado: Partial<Estado>;
  history: { who: string; text: string }[];
}

const NOMBRES: Record<string, string> = { gerardo: 'Gerardo', tomas: 'Tomás' };

/**
 * Devuelve el texto del personaje en streaming (text/plain). La última línea es el
 * bloque de control [[animo:N|revela:bool|anota:...]] que lee el motor del juego.
 *
 * El estado lo manda el cliente: en un juego de un solo jugador sin ranking no vale la pena
 * protegerlo. Lo que sí se hace es acotar tamaños y limitar el ritmo para no regalar créditos.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!limitar(req, res)) return;

  const b = req.body as Body;
  const caso = CASOS[b?.tramo];
  if (!caso || (b.who !== 'gerardo' && b.who !== 'tomas')) return res.status(400).json({ error: 'bad request' });

  const e = b.estado ?? {};
  const estado: Estado = {
    animo: clampNum(e.animo, 0, 100, 50),
    claridad: clampNum(e.claridad, 0, 100, 35),
    relacion: clampNum(e.relacion, 0, 100, 50),
    mate: e.mate === true,
    papelito: e.papelito ? recortar(e.papelito, 120) : null,
    errar: e.errar === true,
    preguntaClara: false,
  };

  // Si Tomás preguntó bien lo decide el código: dejarlo a criterio del LLM generaba bucles de evasivas.
  const hist = Array.isArray(b.history) ? b.history : [];
  const ultima = hist[hist.length - 1];
  estado.preguntaClara = ultima?.who === 'tomas' && typeof ultima.text === 'string' && normalizar(ultima.text).includes(normalizar(caso.clave));

  const system = b.who === 'gerardo' ? promptGerardo(caso, estado) : promptTomas(caso, estado);

  // Los dos agentes comparten la charla. Se pasa como transcripción en un solo mensaje.
  const historial = Array.isArray(b.history) ? b.history.slice(-8) : [];
  const transcript = historial.map((h) => `${NOMBRES[h.who] ?? 'Ciudadano'}: ${recortar(h.text, 300)}`).join('\n');
  const turno = NOMBRES[b.who];
  const user = `${transcript ? `Conversación hasta ahora:\n${transcript}\n\n` : 'La conversación recién empieza.\n\n'}Ahora habla ${turno}.`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');

  try {
    await streamChat(system, user, (t) => res.write(t));
    res.end();
  } catch {
    // El cliente detecta la falta de bloque de control y cae al modo de prueba.
    if (!res.headersSent) res.status(502);
    res.end();
  }
}
