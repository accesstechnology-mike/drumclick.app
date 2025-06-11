'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useAudioEngine from '@/lib/hooks/useAudioEngine';

export type Subdivision = '1' | '1/2' | '1/3' | '1/4';

export interface PulseConfig {
  /** Number of beats in the pulse for the full cycle (e.g. 3 if ratio is 3:2) */
  beats: number;
  /** Whether the pulse should emit click sounds */
  useClick: boolean;
  /** Whether the pulse should emit spoken counts */
  useVoice: boolean;
  /** Optional per-pulse subdivision (defaults to global) */
  subdivision?: Subdivision;
  /** Accent first beat of the pulse */
  accentFirstBeat?: boolean;
  /** Pan position for all audio material for this pulse (-1 = left, 1 = right) */
  pan?: number;
}

export interface PolyrhythmOptions {
  /** Two (or more) pulses that will run concurrently */
  pulses: PulseConfig[];
  /** Index in `pulses` that acts as the anchor (its BPM = `tempo` prop) */
  anchorIndex: number;
}

export interface MetronomeConfig {
  timeSignature: string;              // e.g. "4/4", "3/4", "6/8 (Compound)"
  tempo: number;                      // anchor BPM (integer)
  accentFirstBeat: boolean;
  subdivision: Subdivision;           // verbal/visual subdivisions (not polyrhythm)
  voiceSubdivision: boolean;
  swingMode: boolean;                 // triplet swing toggle
  useClick: boolean;
  useVoice: boolean;
  // Optional gradual-tempo parameters
  isIncreasingTempo?: boolean;
  startTempo?: number;
  endTempo?: number;
  duration?: number;                  // in minutes
  // Callbacks so consuming component can react to beats / tempo updates
  onActiveBeat?: (beatIndex: number) => void;
  onTempoUpdate?: (currentTempo: number) => void;
  polyrhythm?: PolyrhythmOptions;
}

export interface MetronomeHandle {
  isPlaying: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  currentTempo: number;
}

/**
 * `useMetronome` encapsulates the scheduling logic previously baked into
 * ClickTrackGenerator. It purposefully excludes polyrhythm logic – that will
 * be layered on in a future step.
 */
export default function useMetronome(config: MetronomeConfig): MetronomeHandle {
  const {
    timeSignature,
    tempo,
    accentFirstBeat,
    subdivision,
    voiceSubdivision,
    swingMode,
    useClick,
    useVoice,
    isIncreasingTempo = false,
    startTempo = tempo,
    endTempo = tempo,
    duration = 5,
    onActiveBeat,
    onTempoUpdate,
    polyrhythm,
  } = config;

  /* ------------------------------------------------------------------ */
  /* Audio engine (shared)                                              */
  /* ------------------------------------------------------------------ */
  const {
    audioContextRef,
    audioBuffersRef,
    loadAudioFiles,
    playTone,
    playBuffer,
    resumeContext,
  } = useAudioEngine();

  /* ------------------------------------------------------------------ */
  /* Local reactive state                                               */
  /* ------------------------------------------------------------------ */
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTempo, setCurrentTempo] = useState(tempo);

  /* ------------------------------------------------------------------ */
  /* Mutable refs for scheduler                                         */
  /* ------------------------------------------------------------------ */
  const schedulerIdRef = useRef<number | null>(null);
  const nextNoteTimeRef = useRef(0);       // Absolute time of next sub-beat
  const currentBeatRef = useRef(0);        // Beat counter (includes sub-beats)
  const lastUiUpdateRef = useRef(0);       // Throttle UI callback to 60Hz
  const startTimeRef = useRef(0);          // For gradual tempo increase

  // Mirror changing props into refs to avoid re-creating callbacks
  const timeSignatureRef = useRef(timeSignature);
  const tempoRef = useRef(tempo);
  const accentFirstBeatRef = useRef(accentFirstBeat);
  const subdivisionRef = useRef<Subdivision>(subdivision);
  const voiceSubdivisionRef = useRef(voiceSubdivision);
  const swingModeRef = useRef(swingMode);

  /* Additional refs for polyrhythm mode */
  const nextPulseTimeRefs = useRef<number[]>([]);
  const currentPulseBeatRefs = useRef<number[]>([]); // includes sub-beats

  /* ------------------------------------------------------------------ */
  /* Prop → ref syncing                                                 */
  /* ------------------------------------------------------------------ */
  useEffect(() => { timeSignatureRef.current = timeSignature; }, [timeSignature]);
  useEffect(() => { tempoRef.current = tempo; }, [tempo]);
  useEffect(() => { accentFirstBeatRef.current = accentFirstBeat; }, [accentFirstBeat]);
  useEffect(() => { subdivisionRef.current = subdivision; }, [subdivision]);
  useEffect(() => { voiceSubdivisionRef.current = voiceSubdivision; }, [voiceSubdivision]);
  useEffect(() => { swingModeRef.current = swingMode; }, [swingMode]);

  /* ------------------------------------------------------------------ */
  /* Helper – current tempo when ramping                                */
  /* ------------------------------------------------------------------ */
  const calculateCurrentTempo = useCallback(() => {
    if (!isIncreasingTempo || !audioContextRef.current) return tempoRef.current;

    const elapsedMinutes = (audioContextRef.current.currentTime - startTimeRef.current) / 60;
    const progress = Math.min(elapsedMinutes / duration, 1);
    return Math.round(startTempo + progress * (endTempo - startTempo));
  }, [isIncreasingTempo, startTempo, endTempo, duration, audioContextRef]);

  /* ------------------------------------------------------------------ */
  /* Scheduling helpers (clicks & voice)                                */
  /* ------------------------------------------------------------------ */
  const createClickSound = useCallback((time: number, isAccented: boolean) => {
    const freq = isAccented ? 1000 : 600;
    playTone(time, freq, { volume: 1 });
  }, [playTone]);

  const createSubdivisionClick = useCallback((
    time: number,
    subBeat: number,
    subCount: number,
    isAccented: boolean,
  ) => {
    // Skip middle triplet for swing feel
    if (subCount === 3 && swingModeRef.current && subBeat === 1) return;

    let frequency: number;
    if (subBeat === 0) frequency = isAccented ? 1000 : 600;
    else if (subCount === 2) frequency = 400;
    else if (subCount === 3) frequency = subBeat === 1 ? 500 : 400;
    else if (subCount === 4) frequency = subBeat === 2 ? 500 : 400;
    else return;

    playTone(time, frequency, { volume: 0.6 });
  }, [playTone]);

  const playSubdivisionVoice = useCallback((time: number, subBeat: number, subCount: number) => {
    if (!voiceSubdivisionRef.current) return;
    // Skip swing middle triplet
    if (subCount === 3 && swingModeRef.current && subBeat === 1) return;

    // Map to sample index
    let sampleIdx: number | null = null;
    if (subCount === 2) sampleIdx = 8;               // "and"
    else if (subCount === 3) sampleIdx = subBeat === 1 ? 7 : 9; // "eee"/"ah"
    else if (subCount === 4) sampleIdx = subBeat === 1 ? 7 : subBeat === 2 ? 8 : 9;

    if (sampleIdx != null) playBuffer(time, sampleIdx, 0.6);
  }, [playBuffer]);

  const playBeatVoice = useCallback((time: number, beatInMeasure: number) => {
    if (!useVoice) return;
    playBuffer(time, beatInMeasure, 1); // sample indexes 0-6 map to beats 1-7
  }, [useVoice, playBuffer]);

  /* ------------------------------------------------------------------ */
  /* Core scheduler (single or poly)                                    */
  /* ------------------------------------------------------------------ */
  const schedule = useCallback(() => {
    if (!audioContextRef.current) return;

    const now = audioContextRef.current.currentTime;

    /* ---------------------------- POLY MODE ------------------------- */
    if (polyrhythm) {
      const { pulses, anchorIndex } = polyrhythm;
      if (pulses.length === 0) return;

      // Ensure refs are initialised
      if (nextPulseTimeRefs.current.length === 0) {
        nextPulseTimeRefs.current = pulses.map(() => nextNoteTimeRef.current);
        currentPulseBeatRefs.current = pulses.map(() => 0);
      }

      while (
        Math.min(...nextPulseTimeRefs.current) < now + 0.1 /* ahead time */
      ) {
        const currTempo = calculateCurrentTempo();

        const anchorBeats = pulses[anchorIndex].beats;
        const beatDurAnchor = 60 / currTempo;

        pulses.forEach((pulse, idx) => {
          const subCount = 1; // subdivisions disabled in poly mode

          // Calculate timing for this pulse relative to anchor.
          const beatDur =
            idx === anchorIndex
              ? beatDurAnchor
              : (beatDurAnchor * anchorBeats) / pulse.beats;
          const subDur = beatDur / subCount;

          while (nextPulseTimeRefs.current[idx] < now + 0.1) {
            const pulseBeatCount = currentPulseBeatRefs.current[idx];
            const subBeat = 0; // since subCount is 1
            const beatInPulseAbsolute = Math.floor(pulseBeatCount / subCount);
            const beatInCycle = beatInPulseAbsolute % pulse.beats;
            const isAccented = beatInCycle === 0 && (pulse.accentFirstBeat ?? accentFirstBeatRef.current);

            const schedTime = nextPulseTimeRefs.current[idx];

            /* Click */
            if (pulse.useClick) {
              let freq: number;
              if (isAccented) freq = idx === anchorIndex ? 1000 : 900;
              else freq = idx === anchorIndex ? 600 : 500;
              playTone(schedTime, freq, { volume: 1, pan: pulse.pan ?? 0 });
            }

            /* Voice counting (only on subBeat 0) */
            if (pulse.useVoice) {
              if (beatInCycle < 7) {
                playBuffer(schedTime, beatInCycle, 1, pulse.pan ?? 0);
              }
            }

            /* Anchor-specific callbacks */
            if (
              idx === anchorIndex &&
              onActiveBeat &&
              now - lastUiUpdateRef.current >= 1 / 60
            ) {
              onActiveBeat(beatInCycle);
              lastUiUpdateRef.current = now;
            }

            // Increment counters
            currentPulseBeatRefs.current[idx] += 1;
            nextPulseTimeRefs.current[idx] += subDur;
          }
        });
      }

      schedulerIdRef.current = requestAnimationFrame(schedule);
      return;
    }

    /* --------------------------- SINGLE MODE ------------------------ */
    const [beatsPerMeasure] = timeSignatureRef.current.split('/').map(Number);

    const subCount = subdivisionRef.current === '1' ? 1
      : subdivisionRef.current === '1/2' ? 2
      : subdivisionRef.current === '1/3' ? 3
      : 4;

    // Schedule events 100ms ahead
    while (nextNoteTimeRef.current < now + 0.1) {
      const currTempo = calculateCurrentTempo();
      const beatDur = 60 / currTempo;
      const subDur = beatDur / subCount;

      const beatInMeasure = Math.floor(currentBeatRef.current / subCount) % beatsPerMeasure;
      const subBeat = currentBeatRef.current % subCount;
      const isAccented = beatInMeasure === 0 && accentFirstBeatRef.current;

      const scheduleTime = nextNoteTimeRef.current;

      // Audio (click / voice)
      if (useClick) {
        if (subBeat === 0) createClickSound(scheduleTime, isAccented);
        else createSubdivisionClick(scheduleTime, subBeat, subCount, isAccented);
      }
      if (useVoice)
        if (subBeat === 0) playBeatVoice(scheduleTime, beatInMeasure);
        else playSubdivisionVoice(scheduleTime, subBeat, subCount);

      // UI callbacks (throttled)
      if (subBeat === 0 && onActiveBeat && now - lastUiUpdateRef.current >= 1 / 60) {
        onActiveBeat(beatInMeasure);
        lastUiUpdateRef.current = now;
      }

      // Prepare next notes
      currentBeatRef.current += 1;
      nextNoteTimeRef.current += subDur;
    }

    schedulerIdRef.current = requestAnimationFrame(schedule);
  }, [
    calculateCurrentTempo,
    createClickSound,
    createSubdivisionClick,
    playBeatVoice,
    playSubdivisionVoice,
    useClick,
    useVoice,
    onActiveBeat,
    accentFirstBeatRef,
    subdivisionRef,
    audioContextRef,
    polyrhythm,
  ]);

  /* ------------------------------------------------------------------ */
  /* Transport controls                                                 */
  /* ------------------------------------------------------------------ */
  const start = useCallback(async () => {
    if (isPlaying) return;

    await resumeContext();
    await loadAudioFiles();

    // Reset counters
    currentBeatRef.current = 0;
    nextNoteTimeRef.current = audioContextRef.current!.currentTime + 0.05; // small delay
    startTimeRef.current = audioContextRef.current!.currentTime;

    // Reset poly refs too
    nextPulseTimeRefs.current = [];
    currentPulseBeatRefs.current = [];

    setIsPlaying(true);
    schedulerIdRef.current = requestAnimationFrame(schedule);
  }, [isPlaying, resumeContext, loadAudioFiles, schedule]);

  const stop = useCallback(() => {
    if (!isPlaying) return;
    if (schedulerIdRef.current) cancelAnimationFrame(schedulerIdRef.current);
    schedulerIdRef.current = null;
    setIsPlaying(false);
    setCurrentTempo(tempoRef.current);
    if (onActiveBeat) onActiveBeat(-1);
  }, [isPlaying, onActiveBeat]);

  const toggle = useCallback(() => {
    if (isPlaying) stop(); else start();
  }, [isPlaying, start, stop]);

  /* ------------------------------------------------------------------ */
  /* Auto-update current tempo when ramping                             */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!isIncreasingTempo) return;
    let raf: number;
    const fn = () => {
      const t = calculateCurrentTempo();
      setCurrentTempo(t);
      if (onTempoUpdate) onTempoUpdate(t);
      raf = requestAnimationFrame(fn);
    };
    raf = requestAnimationFrame(fn);
    return () => cancelAnimationFrame(raf);
  }, [isIncreasingTempo, calculateCurrentTempo, onTempoUpdate]);

  return {
    isPlaying,
    start,
    stop,
    toggle,
    currentTempo,
  };
} 