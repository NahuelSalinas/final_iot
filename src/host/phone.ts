import type { HostMsg } from '../shared/protocol';

// Canal hacia el celular. Hasta que haya uno conectado, los mensajes se descartan.
let sender: (m: HostMsg) => void = () => {};
let lastKey = '';
let lastSay: HostMsg | null = null;

export const phone = {
  setSender(fn: (m: HostMsg) => void) {
    sender = fn;
    lastKey = '';
  },
  /** Instrucción grande en la pantalla del celular. No reenvía si no cambió. */
  say(title: string, sub = '', tone: 'info' | 'ok' | 'warn' = 'info') {
    const key = `${title}|${sub}|${tone}`;
    if (key === lastKey) return;
    lastKey = key;
    lastSay = { t: 'say', title, sub, tone };
    sender(lastSay);
  },
  /** Reenvía la última instrucción: sirve cuando el celular se conecta tarde o se reconecta. */
  resend() {
    if (lastSay) sender(lastSay);
  },
  buzz(ms = 40) {
    sender({ t: 'buzz', ms });
  },
  did(label: string) {
    sender({ t: 'did', label });
  },
};
