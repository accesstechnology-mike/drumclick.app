'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square } from 'lucide-react';
import { PulseConfig } from '@/lib/hooks/useMetronome';
import useMetronome from '@/lib/hooks/useMetronome';
import PolyrhythmControls from './PolyrhythmControls';
import VisualBeatIndicator from './VisualBeatIndicator';
import TransportControls from './TransportControls';

export default function PolyMetronome() {
  /* ------------------- state -------------------- */
  const [tempo, setTempo] = useState(120);
  const [displayTempo, setDisplayTempo] = useState(120);
  const [activeBeat, setActiveBeat] = useState(-1);
  const anchorIndex = 0; // fixed lead pulse
  const [pulses, setPulses] = useState<PulseConfig[]>([
    {
      beats: 3,
      useClick: true,
      useVoice: false,
      subdivision: '1',
      accentFirstBeat: true,
      pan: -0.8,
    },
    {
      beats: 2,
      useClick: true,
      useVoice: false,
      subdivision: '1',
      accentFirstBeat: false,
      pan: 0.8,
    },
  ]);

  // BPM adjustment state (matching main app)
  const bpmAdjustIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bpmAdjustTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTouchActiveRef = useRef(false);
  const touchStartTimeRef = useRef(0);

  // Main display editing state (matching main app)
  const [isEditingMainDisplay, setIsEditingMainDisplay] = useState(false);
  const [mainDisplayInput, setMainDisplayInput] = useState(tempo.toString());
  const mainDisplayInputRef = useRef<HTMLInputElement>(null);

  /* ------------------ BPM control functions ----------------- */
  const adjustBpm = useCallback((increment: number) => {
    setTempo(prevTempo => {
      const newTempo = Math.max(40, Math.min(240, prevTempo + increment));
      setDisplayTempo(newTempo);
      return newTempo;
    });
  }, []);

  const stopBpmAdjustment = useCallback(() => {
    if (bpmAdjustIntervalRef.current) {
      clearInterval(bpmAdjustIntervalRef.current);
      bpmAdjustIntervalRef.current = null;
    }
    if (bpmAdjustTimeoutRef.current) {
      clearTimeout(bpmAdjustTimeoutRef.current);
      bpmAdjustTimeoutRef.current = null;
    }
    setTimeout(() => {
      isTouchActiveRef.current = false;
    }, 100);
  }, []);

  const startBpmAdjustment = useCallback((increment: number, isTouchEvent = false) => {
    if (isTouchEvent) {
      isTouchActiveRef.current = true;
      touchStartTimeRef.current = Date.now();
    } else if (isTouchActiveRef.current && Date.now() - touchStartTimeRef.current < 300) {
      return;
    }

    if (bpmAdjustIntervalRef.current) {
      clearInterval(bpmAdjustIntervalRef.current);
      bpmAdjustIntervalRef.current = null;
    }
    if (bpmAdjustTimeoutRef.current) {
      clearTimeout(bpmAdjustTimeoutRef.current);
      bpmAdjustTimeoutRef.current = null;
    }
    
    adjustBpm(increment);
    
    const holdDelay = isTouchEvent ? 700 : 500;
    const repeatInterval = isTouchEvent ? 150 : 100;
    
    bpmAdjustTimeoutRef.current = setTimeout(() => {
      bpmAdjustIntervalRef.current = setInterval(() => {
        adjustBpm(increment);
      }, repeatInterval);
    }, holdDelay);
  }, [adjustBpm]);

  // Main display editing handlers (matching main app)
  const handleMainDisplayClick = useCallback(() => {
    setIsEditingMainDisplay(true);
    setMainDisplayInput(displayTempo.toString());
    setTimeout(() => {
      mainDisplayInputRef.current?.focus();
      mainDisplayInputRef.current?.select();
    }, 0);
  }, [displayTempo]);

  const handleMainDisplayInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMainDisplayInput(e.target.value);
  }, []);

  const handleMainDisplaySubmit = useCallback(() => {
    const numericValue = parseInt(mainDisplayInput, 10);
    if (!isNaN(numericValue)) {
      const clampedValue = Math.max(40, Math.min(240, numericValue));
      setTempo(clampedValue);
      setDisplayTempo(clampedValue);
      setMainDisplayInput(clampedValue.toString());
    } else {
      setMainDisplayInput(displayTempo.toString());
    }
    setIsEditingMainDisplay(false);
  }, [mainDisplayInput, displayTempo]);

  const handleMainDisplayKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleMainDisplaySubmit();
    } else if (e.key === 'Escape') {
      setMainDisplayInput(displayTempo.toString());
      setIsEditingMainDisplay(false);
    }
  }, [handleMainDisplaySubmit, displayTempo]);

  const handleMainDisplayBlur = useCallback(() => {
    handleMainDisplaySubmit();
  }, [handleMainDisplaySubmit]);

  /* ------------------ metronome ----------------- */
  const metronome = useMetronome({
    timeSignature: '4/4', // irrelevant in poly mode
    tempo,
    accentFirstBeat: pulses[anchorIndex].accentFirstBeat ?? true,
    subdivision: '1',
    voiceSubdivision: false,
    swingMode: false,
    useClick: true, // controlled per pulse in polyrhythm mode
    useVoice: true, // controlled per pulse in polyrhythm mode
    polyrhythm: { pulses, anchorIndex },
    onActiveBeat: setActiveBeat,
  });

  /* ------------------- render ------------------- */
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Content area (like tabs in main app) */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Polyrhythm Controls */}
        <PolyrhythmControls
          pulses={pulses}
          anchorIndex={anchorIndex}
          onPulsesChange={setPulses}
        />
      </div>

      {/* Transport section at bottom (exactly like main app) */}
      <div className="text-center border-t pt-4 bg-white space-y-4">
        <TransportControls
          displayTempo={displayTempo}
          isIncreasingTempo={false}
          onSliderChange={(val) => {
            setTempo(val);
            setDisplayTempo(val);
          }}
          onStartAdjust={startBpmAdjustment}
          onStopAdjust={stopBpmAdjustment}
          canDec={displayTempo > 40}
          canInc={displayTempo < 240}
          isEditing={isEditingMainDisplay}
          mainDisplayInput={mainDisplayInput}
          onMainDisplayInputChange={handleMainDisplayInputChange}
          onMainDisplayBlur={handleMainDisplayBlur}
          onMainDisplayKeyDown={handleMainDisplayKeyDown}
          onMainDisplayClick={handleMainDisplayClick}
          mainDisplayInputRef={mainDisplayInputRef}
        />

        <VisualBeatIndicator
          beatsPerMeasure={pulses[0].beats}
          activeBeat={activeBeat}
          accentFirstBeat={pulses[0].accentFirstBeat ?? true}
        />

        {/* Play/Stop Button in same location as PlaybackControls */}
        <div className="space-y-4">
          {/* Blank space where click/voice toggles would be */}
          <div className="h-12"></div>
          
          <Button onClick={metronome.toggle} className="w-full" size="lg">
            {metronome.isPlaying ? (
              <>
                <Square className="mr-2 h-4 w-4" /> Stop
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" /> Play
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
} 