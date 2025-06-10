'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { DataConnection } from 'peerjs';
import useAudioEngine from './useAudioEngine';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
export type SyncRole = 'leader' | 'member';

// Generic message envelope for data-channel communication
interface BaseMsg {
  type: string;
}

interface PingMsg extends BaseMsg {
  type: 'ping';
  ts: number; // performance.now() at sender
  audioTime: number; // AudioContext.currentTime at sender
}

interface PongMsg extends BaseMsg {
  type: 'pong';
  ts: number; // echo of original ping.ts
  audioTime: number; // currentTime at receiver when echoing
}

interface StartMsg extends BaseMsg {
  type: 'start';
  startAudioTime: number; // Leader's AudioContext time when first beat plays
  tempo: number;
  signature: string;
}

interface StopMsg extends BaseMsg {
  type: 'stop';
}

type SyncMsg = PingMsg | PongMsg | StartMsg | StopMsg;

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */
export default function useBandSync(role: SyncRole) {
  // Dependencies ----------------------------------------------------
  const { audioContextRef, resumeContext } = useAudioEngine();

  // State -----------------------------------------------------------
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [connections, setConnections] = useState<DataConnection[]>([]);
  const skewRef = useRef<number>(0); // hostAudioTime - localAudioTime

  // Internal refs ---------------------------------------------------
  const peerRef = useRef<Peer | null>(null);
  const pingsRef = useRef<Map<number, number>>(new Map());
  const skewSamplesRef = useRef<number[]>([]);

  const SKEW_WINDOW = 8;

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */
  const createPeer = useCallback((id?: string) => {
    peerRef.current?.destroy();
    peerRef.current = new Peer(id, {
      // PeerJS offers a free cloud signalling server at 0.peerjs.com.
      // For production you should self-host.
      debug: 2,
    });
    peerRef.current.on('error', (err: any) => {
      console.error('[BandSync] peer error', err);
      setStatus('error');
    });
    peerRef.current.on('disconnected', () => {
      console.warn('[BandSync] signalling server disconnected, attempting reconnect');
      peerRef.current?.reconnect();
    });
    return peerRef.current;
  }, []);

  /* Leader setup ---------------------------------------------------- */
  const startHosting = useCallback(() => {
    if (role !== 'leader') throw new Error('Only leader can host');
    setStatus('connecting');
    const peer = createPeer();
    peer.on('open', (id: string) => {
      setSessionId(id);
      setReady(true);
      setStatus('connected');
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        setConnections((prev) => [...prev, conn]);
        setStatus('connected');
      });
      conn.on('close', () => {
        setConnections((prev) => prev.filter((c) => c !== conn));
        // Members will handle their own reconnect logic; for leader just log
        console.warn('[BandSync] connection closed by member');
      });
      conn.on('data', (raw: unknown) => {
        handleMsgFromMember(conn, raw as SyncMsg);
      });
    });
  }, [role, createPeer]);

  /* Member setup ---------------------------------------------------- */
  const joinSession = useCallback((id: string) => {
    if (role !== 'member') throw new Error('Only member can join');
    setSessionId(id);
    setStatus('connecting');
    const peer = createPeer();
    peer.on('open', () => {
      const conn: DataConnection = peer.connect(id, { reliable: true });
      conn.on('open', () => {
        setConnections([conn]);
        setReady(true);
        setStatus('connected');
      });
      conn.on('close', () => {
        setConnections([]);
        setStatus('error');
        // attempt reconnection
        setTimeout(() => joinSession(id), 2000);
      });
      conn.on('data', (raw: unknown) => {
        handleMsgFromLeader(conn, raw as SyncMsg);
      });
    });
  }, [role, createPeer]);

  /* ------------------------------------------------------------------ */
  /* Messaging                                                         */
  /* ------------------------------------------------------------------ */
  const sendToAll = useCallback(
    (msg: SyncMsg) => {
      connections.forEach((c) => {
        if (c.open) c.send(msg);
      });
    },
    [connections],
  );

  const handleMsgFromMember = useCallback(
    (_conn: DataConnection, msg: SyncMsg) => {
      if (msg.type === 'pong') {
        const rtt = performance.now() - msg.ts;
        const pingSendAudioTime = pingsRef.current.get(msg.ts);
        if (pingSendAudioTime !== undefined && audioContextRef.current) {
          // Skew = memberAudioTimeAtPong - leaderAudioTimeAtPing - (rtt / 2)
          const approxMemberAudioAtPing = msg.audioTime - (rtt / 1000) / 2;
          const skew = approxMemberAudioAtPing - pingSendAudioTime;
          // Save sample then compute moving average for stability
          const sample = -skew; // so that host = local + skew
          const samples = skewSamplesRef.current;
          samples.push(sample);
          if (samples.length > SKEW_WINDOW) samples.shift();
          skewRef.current = samples.reduce((a, b) => a + b, 0) / samples.length;
        }
        pingsRef.current.delete(msg.ts);
      }
    },
    [audioContextRef],
  );

  const handleMsgFromLeader = useCallback(
    (conn: DataConnection, msg: SyncMsg) => {
      if (msg.type === 'ping') {
        // Respond immediately
        if (!audioContextRef.current) return;
        conn.send({
          type: 'pong',
          ts: msg.ts,
          audioTime: audioContextRef.current.currentTime,
        } as PongMsg);
      } else if (msg.type === 'start') {
        if (!audioContextRef.current) return;
        // Compute offset: hostAudioTime - localAudioTime
        skewRef.current = msg.startAudioTime - audioContextRef.current.currentTime;
        // TODO: emit callback so consumer can schedule
        onStartCbRef.current?.(msg);
      } else if (msg.type === 'stop') {
        onStopCbRef.current?.();
      }
    },
    [audioContextRef],
  );

  /* ------------------------------------------------------------------ */
  /* Public helpers                                                    */
  /* ------------------------------------------------------------------ */
  const sendPing = useCallback(() => {
    if (!audioContextRef.current) return;
    const ts = performance.now();
    pingsRef.current.set(ts, audioContextRef.current.currentTime);
    sendToAll({
      type: 'ping',
      ts,
      audioTime: audioContextRef.current.currentTime,
    } as PingMsg);
  }, [audioContextRef, sendToAll]);

  // Leader: broadcast start
  const startTransport = useCallback(
    (startDelaySec: number, tempo: number, signature: string) => {
      if (role !== 'leader' || !audioContextRef.current)
        throw new Error('Only leader can start transport');
      const startAudioTime = audioContextRef.current.currentTime + startDelaySec;
      const msg: StartMsg = {
        type: 'start',
        startAudioTime,
        tempo,
        signature,
      };
      sendToAll(msg);
      // also call local
      onStartCbRef.current?.(msg);
    },
    [role, audioContextRef, sendToAll],
  );

  const stopTransport = useCallback(() => {
    const msg: StopMsg = { type: 'stop' };
    sendToAll(msg);
    onStopCbRef.current?.();
  }, [sendToAll]);

  /* ------------------------------------------------------------------ */
  /* Callbacks for consumer                                            */
  /* ------------------------------------------------------------------ */
  const onStartCbRef = useRef<(msg: StartMsg) => void>();
  const onStopCbRef = useRef<() => void>();

  const onStart = useCallback((cb: (msg: StartMsg) => void) => {
    onStartCbRef.current = cb;
  }, []);
  const onStop = useCallback((cb: () => void) => {
    onStopCbRef.current = cb;
  }, []);

  /* ------------------------------------------------------------------ */
  /* Ping loop (leader -> members)                                     */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (role !== 'leader' || !ready) return;
    const id = setInterval(() => {
      sendPing();
    }, 1000);
    return () => clearInterval(id);
  }, [role, ready, sendPing]);

  /* Ensure AudioContext exists                                        */
  useEffect(() => {
    if (!ready) return;
    resumeContext();
  }, [ready, resumeContext]);

  /* ------------------------------------------------------------------ */
  /* API                                                               */
  /* ------------------------------------------------------------------ */
  return {
    /* identity */
    role,
    ready,
    sessionId,
    status,

    /* Leader actions */
    startHosting,
    startTransport,
    stopTransport,

    /* Member actions */
    joinSession,

    /* Offset helpers */
    get hostToLocalOffset() {
      return skewRef.current; // hostAudioTime = localTime + offset
    },

    convertHostTime(hostAudioTime: number) {
      if (!audioContextRef.current) return hostAudioTime;
      return hostAudioTime - skewRef.current;
    },

    /* Event hooks */
    onStart,
    onStop,
  } as const;
}