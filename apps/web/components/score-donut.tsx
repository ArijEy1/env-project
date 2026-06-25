'use client';

import { useEffect, useState } from 'react';

interface ScoreDonutProps {
  score: number;
  maturityLevel: number;
  size?: number;
}

const LEVEL_COLORS: Record<number, string> = {
  1: '#E24B4A',
  2: '#EF9F27',
  3: '#ADD378',
  4: '#5DCAA5',
  5: '#0FE656',
};

export function ScoreDonut({ score, maturityLevel, size = 180 }: ScoreDonutProps) {
  // Animate the ring from 0 to the score on mount.
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(score), 60);
    return () => clearTimeout(t);
  }, [score]);

  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - animated / 100);
  const color = LEVEL_COLORS[maturityLevel] ?? LEVEL_COLORS[1];
  const center = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="score-donut">
      {/* Background ring */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={strokeWidth}
      />
      {/* Score arc */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      {/* Score text */}
      <text x={center} y={center - 8} textAnchor="middle" className="score-donut-value">
        {score.toFixed(1)}
      </text>
      <text x={center} y={center + 16} textAnchor="middle" className="score-donut-label">
        / 100
      </text>
    </svg>
  );
}
