'use client';

import { useCallback, useRef } from 'react';

/**
 * `useAudioEngine` centralises all low-level Web-Audio duties so that higher-level
 * hooks/components (e.g. `useMetronome`) can focus on timing logic.
 *
 *  Responsibilities:
 *  • Lazily create & resume a singleton `AudioContext`.
 *  • Load click/voice samples into buffers (exposed via ref).
 *  • Provide helper utilities to play raw tones or sample buffers at a given time.
 *
 *  NOTE: This hook is CLIENT-only; importing it in a server component will error.
 */
export default function useAudioEngine() {
  // Singleton Web-Audio context
  const audioContextRef = useRef<AudioContext | null>(null);
  // All imported AudioBuffer objects live here (voices & other samples)
  const audioBuffersRef = useRef<AudioBuffer[]>([]);

  /* ------------------------------------------------------------------ */
  /* Internal helpers                                                   */
  /* ------------------------------------------------------------------ */
  const getOrCreateContext = useCallback((): AudioContext => {
    if (audioContextRef.current) return audioContextRef.current;

    // Safari prefix fallback
    const AudioCtx =
      (typeof window !== 'undefined' &&
        (window.AudioContext || (window as any).webkitAudioContext)) ||
      undefined;

    if (!AudioCtx) {
      throw new Error('Web Audio API is not supported in this browser');
    }

    audioContextRef.current = new AudioCtx();
    return audioContextRef.current;
  }, []);

  const resumeContext = useCallback(async () => {
    const ctx = getOrCreateContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }, [getOrCreateContext]);

  /* ------------------------------------------------------------------ */
  /* Public API                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Load a list of mp3 files from `/audio` into memory. Returns the loaded buffers.
   */
  const loadAudioFiles = useCallback(
    async (
      filenames: string[] = [
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        'eee',
        'and',
        'ah',
      ],
    ): Promise<AudioBuffer[]> => {
      const ctx = getOrCreateContext();

      const buffers = await Promise.all(
        filenames.map(async (name) => {
          try {
            const resp = await fetch(`/audio/${name}.mp3`);
            if (!resp.ok) throw new Error(`Failed to fetch audio file ${name}`);

            const arrayBuffer = await resp.arrayBuffer();
            return await ctx.decodeAudioData(arrayBuffer);
          } catch (err) {
            console.error('[AudioEngine] Error loading', name, err);
            return null;
          }
        }),
      );

      audioBuffersRef.current = buffers.filter(
        (b): b is AudioBuffer => b !== null,
      );

      return audioBuffersRef.current;
    },
    [getOrCreateContext],
  );

  /**
   * Play a short click-tone at `frequency` (Hz).
   */
  const playTone = useCallback(
    (
      time: number,
      frequency: number,
      {
        volume = 1,
        duration = 0.1,
        pan = 0,
      }: { volume?: number; duration?: number; pan?: number } = {},
    ) => {
      const ctx = getOrCreateContext();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner();

      // Routing: osc → gain → panner (→ destination)
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(ctx.destination);

      // Apply params
      osc.frequency.setValueAtTime(frequency, time);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(volume, time + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.00001, time + duration);

      if (pan !== 0) {
        // Clamp to range just in case
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), time);
      }

      osc.start(time);
      osc.stop(time + duration);
    },
    [getOrCreateContext],
  );

  /**
   * Play a pre-loaded audio buffer (by index) at the given time.
   */
  const playBuffer = useCallback(
    (
      time: number,
      index: number,
      volume = 1,
      pan: number = 0,
    ) => {
      const ctx = getOrCreateContext();
      const buffer = audioBuffersRef.current[index];
      if (!buffer) return;

      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner();

      src.buffer = buffer;
      gain.gain.setValueAtTime(volume, time);
      if (pan !== 0) {
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), time);
      }

      // Routing: src → gain → panner → destination
      src.connect(gain);
      gain.connect(panner);
      panner.connect(ctx.destination);

      src.start(time);
    },
    [getOrCreateContext],
  );

  return {
    /* Refs */
    audioContextRef,
    audioBuffersRef,

    /* Control */
    resumeContext,

    /* Load */
    loadAudioFiles,

    /* Playback helpers */
    playTone,
    playBuffer,
  } as const;
} 