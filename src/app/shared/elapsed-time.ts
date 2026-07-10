import type { FeedingType } from '../core/feeding/feeding.models';

export function formatElapsed(from: Date, now: Date): string {
  const diffMs = now.getTime() - from.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (m === 0) return `il y a ${h} h`;
  return `il y a ${h} h ${m} min`;
}

export function feedingTypeLabel(type: FeedingType): string {
  switch (type) {
    case 'breast_left':
      return 'sein gauche';
    case 'breast_right':
      return 'sein droit';
    case 'bottle':
      return 'biberon';
  }
}

export function formatChrono(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
