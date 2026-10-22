import Peer, { type DataConnection } from 'peerjs';
import { CH_CTRL, CH_SENSOR, PEER_PREFIX, type CtrlMsg, type HostMsg, type SensorPacket } from '../shared/protocol';

export interface HostNetHandlers {
  onSensor(p: SensorPacket): void;
  onCtrl(m: CtrlMsg): void;
  onStatus(s: 'waiting' | 'connected' | 'lost' | 'error', detail?: string): void;
}

export interface HostNet {
  peer: Peer;
  send(m: HostMsg): void;
}

export function startHost(room: string, h: HostNetHandlers): HostNet {
  const peer = new Peer(PEER_PREFIX + room);
  let lastSeq = -1;
  let ctrl: DataConnection | undefined;

  peer.on('open', () => h.onStatus('waiting'));
  peer.on('error', (e) => h.onStatus('error', e.type));
  peer.on('connection', (conn: DataConnection) => {
    conn.on('open', () => {
      if (conn.label === CH_CTRL) {
        ctrl = conn;
        lastSeq = -1;
        h.onStatus('connected');
      }
    });
    conn.on('data', (d) => {
      if (conn.label === CH_SENSOR) {
        const p = d as SensorPacket;
        // Canal desordenado: descartamos lo que llegue más viejo que lo ya visto.
        if (p.n <= lastSeq) return;
        lastSeq = p.n;
        h.onSensor(p);
      } else if (conn.label === CH_CTRL) {
        h.onCtrl(d as CtrlMsg);
      }
    });
    conn.on('close', () => {
      if (conn.label === CH_CTRL && ctrl === conn) {
        ctrl = undefined;
        h.onStatus('lost');
      }
    });
  });
  return { peer, send: (m) => ctrl?.open && ctrl.send(m) };
}
