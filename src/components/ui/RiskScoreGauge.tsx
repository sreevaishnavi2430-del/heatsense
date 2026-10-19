import React from 'react';
import { getRiskColor, getRiskLevel, getRiskDescription } from '../../lib/risk';
import { cn } from '../../lib/utils';
import { Badge } from './Badge';

interface RiskScoreGaugeProps {
  score: number; // 0 to 100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const RiskScoreGauge: React.FC<RiskScoreGaugeProps> = ({
  score,
  size = 'md',
  showLabel = true,
  className,
}) => {
  const level = getRiskLevel(score);
  const color = getRiskColor(level);
  const description = getRiskDescription(level);

  // Gauge dimensions
  const dims = {
    sm: { width: 120, height: 75, r: 44, stroke: 10, fontSize: 'text-2xl', subSize: 'text-xs' },
    md: { width: 180, height: 110, r: 68, stroke: 14, fontSize: 'text-3xl', subSize: 'text-sm' },
    lg: { width: 240, height: 145, r: 92, stroke: 18, fontSize: 'text-4xl', subSize: 'text-base' },
  }[size];

  // SVG arc calculation (half circle from 180 deg to 0 deg)
  const cx = dims.width / 2;
  const cy = dims.height - 10;
  const radius = dims.r;
  const strokeWidth = dims.stroke;
  const circumference = Math.PI * radius; // half circle length

  // Clamp score
  const clampedScore = Math.max(0, Math.min(100, score));
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  return (
    <div
      className={cn('flex flex-col items-center justify-center text-center', className)}
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Heat Risk Score: ${score} out of 100, Level: ${level}. ${description}`}
    >
      <div className="relative" style={{ width: dims.width, height: dims.height }}>
        <svg
          width={dims.width}
          height={dims.height}
          viewBox={`0 0 ${dims.width} ${dims.height}`}
          className="overflow-visible"
        >
          {/* Background Track */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="text-slate-200 dark:text-slate-800"
          />

          {/* Coloured Progress Arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center Value */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 pointer-events-none">
          <span className={cn('font-heading font-extrabold tracking-tight leading-none', dims.fontSize)} style={{ color }}>
            {score}
          </span>
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-0.5">/ 100</span>
        </div>
      </div>

      {showLabel && (
        <div className="mt-2 flex flex-col items-center gap-1">
          <Badge variant="risk" riskLevel={level} size={size === 'lg' ? 'lg' : 'md'}>
            {level} Risk
          </Badge>
        </div>
      )}
    </div>
  );
};
