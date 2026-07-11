import type { Feeding } from '../../core/feeding/feeding.models';
import type { Diaper, DiaperKind } from '../../core/diaper/diaper.models';
import type { FeedingType } from '../../core/feeding/feeding.models';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DayStats {
  /** ISO date string, local time (YYYY-MM-DD) */
  date: string;
  feedingCount: number;
  /** Average interval between feedings in milliseconds, or null if < 2 feedings */
  avgIntervalMs: number | null;
}

export interface TimelineEvent {
  id: string;
  timestamp: string; // ISO string (started_at for feedings, at for diapers)
  kind: 'feeding' | 'diaper';
  feedingType?: FeedingType;
  diaperKind?: DiaperKind;
  amountMl?: number | null;
}

// ── Pure helpers ───────────────────────────────────────────────────────────────

/**
 * Returns local date string (YYYY-MM-DD) for a given ISO timestamp.
 * Uses the browser's local timezone so that grouping by day is user-visible.
 */
export function toLocalDateString(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a local time (HH:MM) from an ISO timestamp.
 */
export function toLocalTimeString(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Returns the average interval in milliseconds between consecutive feedings in
 * the provided array. Feedings must be sorted by started_at (any order — this
 * function sorts them internally). Returns null if fewer than 2 feedings.
 */
export function averageFeedingInterval(feedings: Feeding[]): number | null {
  if (feedings.length < 2) return null;

  const sorted = [...feedings].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  );

  let totalMs = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalMs +=
      new Date(sorted[i].started_at).getTime() -
      new Date(sorted[i - 1].started_at).getTime();
  }
  return Math.round(totalMs / (sorted.length - 1));
}

/**
 * Groups feedings by local day and computes per-day stats over the last 7 days.
 * Days with 0 feedings appear with feedingCount=0 and avgIntervalMs=null.
 *
 * @param feedings Array of feedings to analyse (any order)
 * @param today    The reference date for "7 days" (defaults to new Date())
 */
export function computeWeekStats(feedings: Feeding[], today: Date = new Date()): DayStats[] {
  // Build the 7-day window [today-6 .. today], local dates
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    days.push(`${year}-${month}-${day}`);
  }

  // Group feedings by local date
  const byDay = new Map<string, Feeding[]>();
  for (const f of feedings) {
    const dateKey = toLocalDateString(f.started_at);
    if (!byDay.has(dateKey)) byDay.set(dateKey, []);
    byDay.get(dateKey)!.push(f);
  }

  return days.map(date => {
    const dayFeedings = byDay.get(date) ?? [];
    return {
      date,
      feedingCount: dayFeedings.length,
      avgIntervalMs: averageFeedingInterval(dayFeedings),
    };
  });
}

/**
 * Formats an interval in milliseconds as a human-readable string (e.g. "2h30").
 * Returns "—" for null (0 or 1 feedings in the day).
 */
export function formatIntervalMs(ms: number | null): string {
  if (ms === null) return '—';
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

// ── Event mappers ──────────────────────────────────────────────────────────────

export function feedingToEvent(f: Feeding): TimelineEvent {
  return {
    id: f.id,
    timestamp: f.started_at,
    kind: 'feeding',
    feedingType: f.type,
    amountMl: f.amount_ml,
  };
}

export function diaperToEvent(d: Diaper): TimelineEvent {
  return {
    id: d.id,
    timestamp: d.at,
    kind: 'diaper',
    diaperKind: d.kind,
  };
}

/**
 * Merges and sorts feeding + diaper events by timestamp descending (most recent first).
 */
export function mergeEventsSorted(feedings: Feeding[], diapers: Diaper[]): TimelineEvent[] {
  const events: TimelineEvent[] = [
    ...feedings.map(feedingToEvent),
    ...diapers.map(diaperToEvent),
  ];
  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
