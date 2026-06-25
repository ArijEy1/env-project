'use client';

import { useState } from 'react';

export interface RadarDatum {
  label: string; // short axis label, e.g. "D1"
  fullLabel: string; // shown on hover
  score: number; // 0-100
}

interface RadarChartProps {
  data: RadarDatum[];
  size?: number;
  color?: string;
}

const RINGS = [20, 40, 60, 80, 100];

export function RadarChart({ data, size = 340, color = '#5DCAA5' }: RadarChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const n = data.length;
  const center = size / 2;
  const maxR = center - 52;

  const angleFor = (i: number) => (-90 + (360 / n) * i) * (Math.PI / 180);
  const point = (i: number, value: number): [number, number] => {
    const r = (value / 100) * maxR;
    const a = angleFor(i);
    return [center + r * Math.cos(a), center + r * Math.sin(a)];
  };

  if (n === 0) return null;

  const scorePolygon = data.map((d, i) => point(i, d.score).join(',')).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="radar-chart" role="img" aria-label="Domain scores radar chart">
      {RINGS.map((r) => (
        <polygon
          key={r}
          points={data.map((_, i) => point(i, r).join(',')).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1}
        />
      ))}

      {data.map((_, i) => {
        const [x, y] = point(i, 100);
        return <line key={`axis-${i}`} x1={center} y1={center} x2={x} y2={y} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />;
      })}

      <polygon points={scorePolygon} fill={`${color}33`} stroke={color} strokeWidth={2} style={{ transition: 'all 0.6s ease' }} />

      {data.map((d, i) => {
        const [x, y] = point(i, d.score);
        return (
          <circle
            key={`pt-${i}`}
            cx={x}
            cy={y}
            r={hover === i ? 7 : 4.5}
            fill={color}
            stroke="#0c1f1b"
            strokeWidth={hover === i ? 2 : 0}
            style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <title>{d.fullLabel}: {d.score}/100</title>
          </circle>
        );
      })}

      {data.map((d, i) => {
        const [x, y] = point(i, 118);
        const anchor = Math.abs(x - center) < 10 ? 'middle' : x > center ? 'start' : 'end';
        return (
          <text key={`lbl-${i}`} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" className="radar-label">
            {d.label}
          </text>
        );
      })}

      {hover !== null ? (() => {
        const [x, y] = point(hover, data[hover].score);
        return (
          <text x={x} y={y - 12} textAnchor="middle" className="radar-hover-value">
            {data[hover].score}
          </text>
        );
      })() : null}
    </svg>
  );
}
