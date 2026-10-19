import React from 'react';
import { cn } from '../../lib/utils';
import { RiskLevel, AlertLevel } from '../../types';
import { getRiskColor, getAlertColor } from '../../lib/risk';
import { ShieldCheck, AlertCircle, AlertTriangle, Flame } from 'lucide-react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'risk' | 'imd';
  riskLevel?: RiskLevel;
  alertLevel?: AlertLevel;
  size?: 'sm' | 'md' | 'lg';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  riskLevel,
  alertLevel,
  size = 'md',
  children,
  ...props
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  if (variant === 'risk' && riskLevel) {
    const color = getRiskColor(riskLevel);
    const icons = {
      Low: <ShieldCheck className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />,
      Moderate: <AlertCircle className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />,
      High: <AlertTriangle className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />,
      Severe: <Flame className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />,
    };

    return (
      <span
        className={cn(
          'inline-flex items-center font-semibold rounded-full border',
          sizeClasses[size],
          className
        )}
        style={{
          backgroundColor: `${color}18`,
          color: color,
          borderColor: `${color}40`,
        }}
        role="status"
        aria-label={`Heat Risk: ${riskLevel}`}
        {...props}
      >
        {icons[riskLevel]}
        <span>{children || riskLevel}</span>
      </span>
    );
  }

  if (variant === 'imd' && alertLevel) {
    const color = getAlertColor(alertLevel);
    return (
      <span
        className={cn(
          'inline-flex items-center font-bold uppercase tracking-wider rounded-md border',
          sizeClasses[size],
          className
        )}
        style={{
          backgroundColor: `${color}22`,
          color: color,
          borderColor: color,
        }}
        role="status"
        aria-label={`IMD Alert: ${alertLevel}`}
        {...props}
      >
        <span className="w-2 h-2 rounded-full mr-1.5 animate-pulse" style={{ backgroundColor: color }} />
        <span>{children || `${alertLevel} Alert`}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700',
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
