// Cliente del endpoint /api/dialogue: lee el texto en streaming y separa el bloque de control.

export interface Control {
  animo: number;
  revela: boolean;
  anota: string;
}

const CTRL_RE = /\[\[([^\]]*)\]\]/;

/** Los modelos a veces devuelven guiones y espacios "especiales" que la tipografía del juego no dibuja. */
const limpiar = (t: string) => t.replace(/[\u2010-\u2015\u2212]/g, '-').replace(/[\u00a0\u202f\u2009]/g, ' ');

export function parseControl(raw: string): { texto: string; control: Control } {
  const m = raw.match(CTRL_RE);
  const texto = raw.replace(CTRL_RE, '').trim();
  const control: Control = { animo: 0, revela: false, anota: '' };
  if (m) {
    for (const part of m[1].split('|')) {
      const [k, ...v] = part.split(':');
      const val = v.join(':').trim();
      if (k === 'animo') control.animo = Number.parseInt(val, 10) || 0;
      else if (k === 'revela') control.revela = val === 'true';
      else if (k === 'anota') control.anota = val;
    }
  }
  return { texto, control };
}

/** Texto visible mientras llega: oculta el bloque de control aunque esté incompleto. */
export function visibleText(partial: string): string {
  const i = partial.indexOf('[[');
  return (i === -1 ? partial : partial.slice(0, i)).trimStart();
}

export async function streamDialogue(
  body: unknown,
  onText: (visible: string) => void,
): Promise<{ texto: string; control: Control }> {
  const res = await fetch('/api/dialogue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) throw new Error(`dialogue ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let acc = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    acc += limpiar(dec.decode(value, { stream: true }));
    onText(visibleText(acc));
  }
  if (!acc.trim()) throw new Error('respuesta vacía');
  return parseControl(acc);
}
