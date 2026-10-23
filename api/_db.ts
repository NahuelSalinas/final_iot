import { neon } from '@neondatabase/serverless';

/** Cliente HTTP de Neon. Devuelve null si falta DATABASE_URL, para que el juego siga andando sin ranking. */
export function db() {
  const url = process.env.DATABASE_URL;
  return url ? neon(url) : null;
}
