import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Plus, Minus, Music, Volume2 } from 'lucide-react';
import { PulseConfig } from '@/lib/hooks/useMetronome';

interface PolyrhythmControlsProps {
  pulses: PulseConfig[]; // expected length 2 for now
  anchorIndex: number;
  onPulsesChange: (newPulses: PulseConfig[]) => void;
}

export default function PolyrhythmControls({
  pulses,
  anchorIndex,
  onPulsesChange,
}: PolyrhythmControlsProps) {
  const id = useId();
  const handleBeatAdjust = (idx: number, delta: number) => {
    const newVal = Math.max(2, Math.min(7, pulses[idx].beats + delta));
    const next = [...pulses];
    next[idx] = { ...next[idx], beats: newVal };
    onPulsesChange(next);
  };

  const handleToggle = (idx: number, key: 'useClick' | 'useVoice') => {
    const next = [...pulses];
    next[idx] = { ...next[idx], [key]: !next[idx][key] } as PulseConfig;
    onPulsesChange(next);
  };

  const handlePanChange = (idx: number, panVals: number[]) => {
    let val = Math.max(-1, Math.min(1, panVals[0]));
    const next = [...pulses];
    next[idx] = { ...next[idx], pan: val };
    onPulsesChange(next);
  };

  const getDisplayPan = (idx: number, val: number | undefined) => {
    if (val == null) return 0;
    if (idx === 0) return Math.min(val, 0);
    return Math.max(val, 0);
  };

  return (
    <div className="space-y-2">
      {/* Two-column grid */}
      <div className="grid grid-cols-2 gap-2">
        {pulses.map((p, idx) => {
          const colId = `${id}-${idx}`;
          const isAnchor = idx === anchorIndex;
          return (
            <div key={idx} className="border rounded-lg p-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold flex items-center space-x-1">
                  <span>{idx === 0 ? 'Pulse 1' : 'Pulse 2'}</span>
                  {idx === 0 && <span className="text-yellow-500">★</span>}
                </span>
              </div>

              {/* Beat count */}
              <div className="flex items-center justify-center space-x-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleBeatAdjust(idx, -1)}
                  disabled={p.beats <= 2}
                  className="h-10 w-10 p-0"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-3xl font-bold w-12 text-center">{p.beats}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleBeatAdjust(idx, 1)}
                  disabled={p.beats >= 7}
                  className="h-10 w-10 p-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Click & Voice toggles (matching main app style) */}
              <div className="flex justify-between space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={`flex-1 ${
                    p.useClick ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'hover:bg-secondary'
                  }`}
                  onClick={() => handleToggle(idx, 'useClick')}
                >
                  <Music className="mr-1 h-3 w-3" />
                  Click
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={`flex-1 ${
                    p.useVoice ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'hover:bg-secondary'
                  }`}
                  onClick={() => handleToggle(idx, 'useVoice')}
                >
                  <Volume2 className="mr-1 h-3 w-3" />
                  Voice
                </Button>
              </div>

              {/* Pan slider */}
              <div>
                <Label className="text-sm">Pan</Label>
                <Slider
                  min={-1}
                  max={1}
                  step={0.1}
                  value={[p.pan ?? 0]}
                  onValueChange={(vals) => handlePanChange(idx, vals)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 