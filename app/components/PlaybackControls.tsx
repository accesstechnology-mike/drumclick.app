'use client';

import { Music, Volume2, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlaybackControlsProps {
  useClick: boolean;
  useVoice: boolean;
  onToggleClick: () => void;
  onToggleVoice: () => void;
  isPlaying: boolean;
  onStartStop: () => void;
}

export default function PlaybackControls({
  useClick,
  useVoice,
  onToggleClick,
  onToggleVoice,
  isPlaying,
  onStartStop,
}: PlaybackControlsProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between space-x-4">
        <Button
          variant="outline"
          size="sm"
          className={`flex-1 ${
            useClick ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'hover:bg-secondary'
          }`}
          onClick={onToggleClick}
        >
          <Music className="mr-2 h-4 w-4" />
          Click
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={`flex-1 ${
            useVoice ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'hover:bg-secondary'
          }`}
          onClick={onToggleVoice}
        >
          <Volume2 className="mr-2 h-4 w-4" />
          Voice
        </Button>
      </div>

      <Button onClick={onStartStop} className="w-full" size="lg">
        {isPlaying ? (
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
  );
} 