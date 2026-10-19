import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTemp(tempC: number, unit: 'C' | 'F' = 'C'): string {
  if (unit === 'F') {
    const f = (tempC * 9) / 5 + 32;
    return `${f.toFixed(1)}°F`;
  }
  return `${tempC.toFixed(1)}°C`;
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num);
}

export function formatCurrencyLakh(lakh: number): string {
  return `₹${lakh.toLocaleString('en-IN')} Lakh`;
}

export function formatPercent(val: number): string {
  return `${val.toFixed(1)}%`;
}

export function getRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
