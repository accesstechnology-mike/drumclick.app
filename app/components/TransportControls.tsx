'use client';

import { MutableRefObject } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Plus, Minus } from 'lucide-react';

interface TransportControlsProps {
  displayTempo: number;
  isIncreasingTempo: boolean;
  onSliderChange: (value: number) => void;
  onStartAdjust: (inc: number, isTouch?: boolean) => void;
  onStopAdjust: () => void;
  canDec: boolean;
  canInc: boolean;
  // BPM main display editing
  isEditing: boolean;
  mainDisplayInput: string;
  onMainDisplayInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMainDisplayBlur: () => void;
  onMainDisplayKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onMainDisplayClick: () => void;
  mainDisplayInputRef: MutableRefObject<HTMLInputElement | null>;
}

export default function TransportControls({
  displayTempo,
  isIncreasingTempo,
  onSliderChange,
  onStartAdjust,
  onStopAdjust,
  canDec,
  canInc,
  isEditing,
  mainDisplayInput,
  onMainDisplayInputChange,
  onMainDisplayBlur,
  onMainDisplayKeyDown,
  onMainDisplayClick,
  mainDisplayInputRef,
}: TransportControlsProps) {
  return (
    <>
      {/* Tempo Slider */}
      <div className="px-4">
        <Slider
          id="tempo-slider"
          min={60}
          max={200}
          step={1}
          value={[displayTempo]}
          onValueChange={(val) => onSliderChange(val[0])}
          className="w-full"
          disabled={isIncreasingTempo}
        />
      </div>

      {/* +/- buttons and BPM display */}
      <div className="flex items-center justify-center space-x-6">
        <Button
          variant="outline"
          size="lg"
          className="h-16 w-16 p-0"
          onMouseDown={() => onStartAdjust(-1, false)}
          onMouseUp={onStopAdjust}
          onMouseLeave={onStopAdjust}
          onTouchStart={(e) => {
            e.preventDefault();
            onStartAdjust(-1, true);
          }}
          onTouchEnd={onStopAdjust}
          disabled={!canDec || isIncreasingTempo}
        >
          <Minus className="h-8 w-8" />
        </Button>

        {/* Main BPM display or inline editor */}
        {isEditing ? (
          <input
            ref={mainDisplayInputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={mainDisplayInput}
            onChange={onMainDisplayInputChange}
            onBlur={onMainDisplayBlur}
            onKeyDown={onMainDisplayKeyDown}
            className="text-6xl font-bold w-32 h-20 text-center bg-transparent border-none outline-none"
            disabled={isIncreasingTempo}
          />
        ) : (
          <div
            className={`text-6xl font-bold w-32 h-20 text-center flex items-center justify-center transition-colors ${
              isIncreasingTempo ? 'cursor-default' : 'cursor-pointer hover:bg-gray-100 rounded-lg'
            }`}
            onClick={onMainDisplayClick}
            title={isIncreasingTempo ? 'Cannot edit during increasing tempo mode' : 'Click to edit'}
          >
            {displayTempo}
          </div>
        )}

        <Button
          variant="outline"
          size="lg"
          className="h-16 w-16 p-0"
          onMouseDown={() => onStartAdjust(1, false)}
          onMouseUp={onStopAdjust}
          onMouseLeave={onStopAdjust}
          onTouchStart={(e) => {
            e.preventDefault();
            onStartAdjust(1, true);
          }}
          onTouchEnd={onStopAdjust}
          disabled={!canInc || isIncreasingTempo}
        >
          <Plus className="h-8 w-8" />
        </Button>
      </div>
    </>
  );
} 