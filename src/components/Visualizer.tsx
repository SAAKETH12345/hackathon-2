import React from 'react';

export const Visualizer = ({ volume }: { volume: number }) => {
  // Create a few bars that react to volume
  // Volume is 0-100
  
  const bars = 5;
  
  return (
    <div className="flex items-center justify-center gap-1 h-8">
      {Array.from({ length: bars }).map((_, i) => {
        // Calculate height based on volume and some randomness/offset
        // Center bars are taller
        const isCenter = i === Math.floor(bars / 2);
        const multiplier = isCenter ? 1 : 0.6;
        const height = Math.max(4, (volume * multiplier) * (0.5 + Math.random() * 0.5));
        
        return (
          <div
            key={i}
            className="w-1.5 bg-emerald-500 rounded-full transition-all duration-75"
            style={{ height: `${Math.min(32, height)}px` }}
          />
        );
      })}
    </div>
  );
};
