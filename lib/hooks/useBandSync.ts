'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { DataConnection } from 'peerjs';
import useAudioEngine from './useAudioEngine';

/** Reconnection backoff timing (ms) */
const INITIAL_BACKOFF = 2_000;
const MAX_BACKOFF = 30_000;

/** Slide-window size for skew median filtering */
const SKEW_WINDOW = 16;

/** Exponential Weighted Moving Average for smooth slow drift */
const EWMA_ALPHA = 0.2;

// After EWMA_ALPHA constant definitions add quality thresholds
const QUALITY_THRESHOLDS = {
  excellent: 3, // ms std-dev
  good: 7,
};

type SyncQuality = 'excellent' | 'good' | 'poor';

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
  type Status = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  const [status, setStatus] = useState<Status>('idle');
  const [connections, setConnections] = useState<DataConnection[]>([]);
  const skewRef = useRef<number>(0); // hostAudioTime - localAudioTime

  // Internal refs ---------------------------------------------------
  const peerRef = useRef<Peer | null>(null);
  const pingsRef = useRef<Map<number, number>>(new Map());
  const skewSamplesRef = useRef<number[]>([]);
  const backoffRef = useRef<number>(INITIAL_BACKOFF);
  const retryAtRef = useRef<number | null>(null);
  const ewmaRef = useRef<number | null>(null);
  const qualityRef = useRef<SyncQuality>('poor');
  const stdDevRef = useRef<number>(Infinity);

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

    peer.on('connection', (conn: DataConnection) => {
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

    const attempt = () => {
      setStatus(backoffRef.current === INITIAL_BACKOFF ? 'connecting' : 'reconnecting');

      const peer = createPeer();
      peer.on('open', () => {
        const conn: DataConnection = peer.connect(id, { reliable: true });

        const resetBackoff = () => {
          backoffRef.current = INITIAL_BACKOFF;
          setStatus('connected');
        };

        conn.on('open', () => {
          setConnections([conn]);
          setReady(true);
          resetBackoff();
        });

        const scheduleRetry = () => {
          setConnections([]);
          setStatus('error');
          const delay = backoffRef.current * (1 + Math.random() * 0.3); // jitter 0-30%
          retryAtRef.current = Date.now() + delay;
          backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
          setTimeout(attempt, delay);
        };

        conn.on('close', scheduleRetry);
        conn.on('error', scheduleRetry as any);

        conn.on('data', (raw: unknown) => {
          handleMsgFromLeader(conn, raw as SyncMsg);
        });
      });

      peer.on('error', () => {
        const delay = backoffRef.current * (1 + Math.random() * 0.3);
        retryAtRef.current = Date.now() + delay;
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
        setTimeout(attempt, delay);
      });
    };

    attempt();
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
          const sample = -skew; // host = local + sample
          const samples = skewSamplesRef.current;

          // Outlier detection using Median Absolute Deviation (MAD)
          if (samples.length >= 3) {
            const med = median(samples);
            const absDevs = samples.map((s) => Math.abs(s - med));
            const mad = median(absDevs) || 1e-9; // avoid 0
            if (Math.abs(sample - med) > 3 * mad) {
              // Skip outlier
              pingsRef.current.delete(msg.ts);
              return;
            }
          }

          samples.push(sample);
          if (samples.length > SKEW_WINDOW) samples.shift();

          // Exponential Weighted Moving Average for smooth slow drift
          if (ewmaRef.current === null) {
            ewmaRef.current = sample;
          } else {
            ewmaRef.current = EWMA_ALPHA * sample + (1 - EWMA_ALPHA) * ewmaRef.current;
          }

          // Combine: take median for robustness then correct slowly towards EWMA
          const blended = (median(samples) + ewmaRef.current) / 2;
          skewRef.current = blended;

          // Calculate std-dev (jitter) in ms
          if (samples.length >= 3) {
            const mean = samples.reduce((a,b)=>a+b,0)/samples.length;
            const variance = samples.reduce((a,b)=>a+(b-mean)**2,0)/samples.length;
            const stdDev = Math.sqrt(variance) * 1000; // convert sec->ms
            stdDevRef.current = stdDev;

            if (stdDev < QUALITY_THRESHOLDS.excellent) {
              qualityRef.current = 'excellent';
            } else if (stdDev < QUALITY_THRESHOLDS.good) {
              qualityRef.current = 'good';
            } else {
              qualityRef.current = 'poor';
            }
          }
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

    /* Additional helpers */
    get retryInMs() {
      return retryAtRef.current ? Math.max(0, retryAtRef.current - Date.now()) : 0;
    },

    get jitterMs() {
      return stdDevRef.current;
    },

    get quality(): SyncQuality {
      return qualityRef.current;
    },
  } as const;
}

/** Return median of array (mutates order) */
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const copy = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(copy.length / 2);
  return copy.length % 2 === 0 ? (copy[mid - 1] + copy[mid]) / 2 : copy[mid];
}