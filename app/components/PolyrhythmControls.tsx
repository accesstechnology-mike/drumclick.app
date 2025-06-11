import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Plus, Minus } from 'lucide-react';
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
    <div className="space-y-4">
      {/* Two-column grid */}
      <div className="grid grid-cols-2 gap-4">
        {pulses.map((p, idx) => {
          const colId = `${id}-${idx}`;
          const isAnchor = idx === anchorIndex;
          return (
            <div key={idx} className="border rounded-lg p-3 space-y-3">
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

              {/* Click & Voice toggles */}
              <div className="flex items-center justify-between">
                <Label htmlFor={`${colId}-click`} className="text-sm">
                  Click
                </Label>
                <Switch
                  id={`${colId}-click`}
                  checked={p.useClick}
                  onCheckedChange={() => handleToggle(idx, 'useClick')}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor={`${colId}-voice`} className="text-sm">
                  Voice
                </Label>
                <Switch
                  id={`${colId}-voice`}
                  checked={p.useVoice}
                  onCheckedChange={() => handleToggle(idx, 'useVoice')}
                />
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