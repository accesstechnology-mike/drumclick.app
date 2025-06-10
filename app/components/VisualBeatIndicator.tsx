'use client';

interface VisualBeatIndicatorProps {
  beatsPerMeasure: number;
  activeBeat: number;
  accentFirstBeat: boolean;
  isCompound?: boolean; // treat 6/8 compound accent pattern (0 & 3)
}

export default function VisualBeatIndicator({
  beatsPerMeasure,
  activeBeat,
  accentFirstBeat,
  isCompound = false,
}: VisualBeatIndicatorProps) {
  return (
    <div className="flex justify-center gap-4">
      {Array.from({ length: beatsPerMeasure }, (_, i) => {
        const isAccented = isCompound ? (i === 0 || i === 3) : i === 0;
        const isActive = i === activeBeat;

        const className = isActive
          ? isAccented && accentFirstBeat
            ? 'bg-yellow-400'
            : 'bg-green-500'
          : 'bg-gray-300';

        return (
          <div
            key={i}
            className={`w-8 h-8 rounded-full transition-colors duration-100 ${className}`}
          />
        );
      })}
    </div>
  );
} 