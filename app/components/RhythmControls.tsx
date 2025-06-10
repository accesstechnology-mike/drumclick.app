'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface RhythmControlsProps {
  timeSignature: string;
  subdivision: '1' | '1/2' | '1/3' | '1/4';
  onSubdivisionChange: (sub: '1' | '1/2' | '1/3' | '1/4') => void;
  swingMode: boolean;
  onSwingChange: (v: boolean) => void;
  accentFirstBeat: boolean;
  onAccentChange: (v: boolean) => void;
  voiceSubdivision: boolean;
  onVoiceSubdivisionChange: (v: boolean) => void;
  flashApp: boolean;
  onFlashAppChange: (v: boolean) => void;
  useClick: boolean;
  useVoice: boolean;
}

export default function RhythmControls({
  timeSignature,
  subdivision,
  onSubdivisionChange,
  swingMode,
  onSwingChange,
  accentFirstBeat,
  onAccentChange,
  voiceSubdivision,
  onVoiceSubdivisionChange,
  flashApp,
  onFlashAppChange,
  useClick,
  useVoice,
}: RhythmControlsProps) {
  return (
    <>
      {/* Accent switch */}
      <div className="flex items-center justify-between py-1">
        <Label htmlFor="accent-mode" className="text-lg font-medium">
          Accents
        </Label>
        <Switch
          id="accent-mode"
          checked={accentFirstBeat}
          onCheckedChange={onAccentChange}
          className="scale-125"
        />
      </div>

      {/* Subdivision + swing */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="subdivision" className="text-lg font-medium">
            Subdivision
          </Label>
          {subdivision === '1/3' && (
            <div className="flex items-center space-x-2">
              <Label htmlFor="swing-inline" className="text-sm text-muted-foreground">
                Swing
              </Label>
              <Switch
                id="swing-inline"
                checked={swingMode}
                onCheckedChange={onSwingChange}
                className="scale-90"
              />
            </div>
          )}
        </div>
        <RadioGroup
          id="subdivision"
          value={subdivision}
          onValueChange={(val) => onSubdivisionChange(val as any)}
          className="flex justify-between"
        >
          {(['1', '1/2', '1/3', '1/4'] as const).map((val, idx) => (
            <div key={val} className="flex items-center space-x-1">
              <RadioGroupItem
                value={val}
                id={`sub-${idx}`}
                disabled={timeSignature === '6/8 (Compound)'}
                className="scale-110"
              />
              <Label
                htmlFor={`sub-${idx}`}
                className={`text-base cursor-pointer ${timeSignature === '6/8 (Compound)' ? 'text-gray-400' : ''}`}
              >
                {val}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Voice subdivision */}
      <div className="flex items-center justify-between py-1">
        <Label htmlFor="voice-subdivision" className="text-lg font-medium">
          Voice Subdivision
        </Label>
        <Switch
          id="voice-subdivision"
          checked={voiceSubdivision}
          onCheckedChange={onVoiceSubdivisionChange}
          className="scale-125"
        />
      </div>

      {/* Flash app */}
      <div className="flex items-center justify-between py-1">
        <Label htmlFor="flash-app" className="text-lg font-medium">
          Flash App
        </Label>
        <Switch
          id="flash-app"
          checked={flashApp}
          onCheckedChange={onFlashAppChange}
          className="scale-125"
        />
      </div>
    </>
  );
} 