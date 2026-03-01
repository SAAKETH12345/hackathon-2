import { useRef, useEffect } from 'react';
import { motion } from 'motion/react';

interface AudioVisualizerProps {
  volume: number;
  active: boolean;
}

export function AudioVisualizer({ volume, active }: AudioVisualizerProps) {
  // Use volume to drive scale
  // Volume is 0-1 (approx)
  
  const scale = active ? 1 + volume * 2 : 1;
  const opacity = active ? 0.8 + volume * 0.2 : 0.3;

  return (
    <div className="relative flex items-center justify-center w-64 h-64">
      {/* Core Orb */}
      <motion.div
        className="absolute w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 blur-xl"
        animate={{
          scale: scale,
          opacity: opacity,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 20
        }}
      />
      
      {/* Outer Glow Ring 1 */}
      <motion.div
        className="absolute w-48 h-48 rounded-full border border-indigo-400/30"
        animate={{
          scale: active ? [1, 1.1, 1] : 1,
          rotate: active ? 360 : 0,
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "linear"
        }}
      />

      {/* Outer Glow Ring 2 */}
      <motion.div
        className="absolute w-56 h-56 rounded-full border border-purple-400/20"
        animate={{
          scale: active ? [1, 1.05, 1] : 1,
          rotate: active ? -360 : 0,
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      
      {/* Center Dot */}
      <div className="absolute w-4 h-4 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.8)]" />
    </div>
  );
}
