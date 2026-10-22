// Cliente mínimo de Groq (API compatible con OpenAI). Sin SDK: un fetch y un parser de SSE.

const URL = process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1/chat/completions';

// gpt-oss-120b: buen español y ~500 tok/s. Para más velocidad: GROQ_MODEL=openai/gpt-oss-20b (~1000 tok/s).
export const MODEL = process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b';

export class LlmError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

/** Llama a Groq con streaming y entrega cada fragmento de texto a `onText`. */
export async function streamChat(system: string, user: string, onText: (chunk: string) => void): Promise<void> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new LlmError('falta GROQ_API_KEY', 500);

  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      temperature: 0.9,
      // gpt-oss razona antes de responder: poco esfuerzo y sin devolver el razonamiento, para bajar la latencia.
      reasoning_effort: 'low',
      include_reasoning: false,
      // los tokens de razonamiento cuentan para el tope, por eso es más alto que el largo de la respuesta
      max_completion_tokens: 500,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok || !res.body) throw new LlmError(`groq ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`, res.status === 429 ? 429 : 502);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const delta = (JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content;
        if (delta) onText(delta);
      } catch {
        /* línea incompleta o keep-alive: se ignora */
      }
    }
  }
}
