'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { PulseConfig } from '@/lib/hooks/useMetronome';
import useMetronome from '@/lib/hooks/useMetronome';
import PolyrhythmControls from './PolyrhythmControls';
import VisualBeatIndicator from './VisualBeatIndicator';

export default function PolyMetronome() {
  /* ------------------- state -------------------- */
  const [tempo, setTempo] = useState(120);
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

  /* ------------------ metronome ----------------- */
  const metronome = useMetronome({
    timeSignature: '4/4', // irrelevant in poly mode
    tempo,
    accentFirstBeat: pulses[anchorIndex].accentFirstBeat ?? true,
    subdivision: '1',
    voiceSubdivision: false,
    swingMode: false,
    useClick: true, // not used in poly mode
    useVoice: true,
    polyrhythm: { pulses, anchorIndex },
    onActiveBeat: setActiveBeat,
  });

  /* ------------------- render ------------------- */
  return (
    <div className="space-y-6 p-4 max-w-lg mx-auto">
      <h2 className="text-xl font-semibold text-center">Polyrhythm Metronome</h2>

      {/* Tempo Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm">BPM</span>
          <span className="text-lg font-bold flex items-center space-x-1">
            <span>{tempo}</span>
            <span className="text-yellow-500">★</span>
          </span>
        </div>
        <Slider
          min={40}
          max={240}
          step={1}
          value={[tempo]}
          onValueChange={(val) => setTempo(val[0])}
        />
      </div>

      {/* Visual indicator for pulse 1 */}
      <VisualBeatIndicator
        beatsPerMeasure={pulses[0].beats}
        activeBeat={activeBeat}
        accentFirstBeat={pulses[0].accentFirstBeat ?? true}
      />

      {/* Play / Stop toggle */}
      <div className="flex justify-center">
        <Button onClick={metronome.toggle} variant={metronome.isPlaying ? 'secondary' : 'default'} className="w-32">
          {metronome.isPlaying ? 'Stop' : 'Start'}
        </Button>
      </div>

      {/* Controls */}
      <PolyrhythmControls
        pulses={pulses}
        anchorIndex={anchorIndex}
        onPulsesChange={setPulses}
      />
    </div>
  );
} 