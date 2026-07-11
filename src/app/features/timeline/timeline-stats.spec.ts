import { describe, it, expect } from 'vitest';
import type { Feeding } from '../../core/feeding/feeding.models';
import {
  averageFeedingInterval,
  computeWeekStats,
  formatIntervalMs,
  toLocalDateString,
  toLocalTimeString,
  mergeEventsSorted,
} from './timeline-stats';
import type { Diaper } from '../../core/diaper/diaper.models';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFeeding(id: string, startedAt: string): Feeding {
  return {
    id,
    baby_id: 'b-1',
    started_at: startedAt,
    ended_at: null,
    type: 'breast_left',
    amount_ml: null,
    created_by: 'user-1',
    created_at: startedAt,
  };
}

function makeDiaper(id: string, at: string): Diaper {
  return {
    id,
    baby_id: 'b-1',
    at,
    kind: 'wet',
    created_by: 'user-1',
    created_at: at,
  };
}

// ── averageFeedingInterval ─────────────────────────────────────────────────────

describe('averageFeedingInterval', () => {
  it('retourne null pour 0 tétée', () => {
    expect(averageFeedingInterval([])).toBeNull();
  });

  it('retourne null pour 1 tétée', () => {
    const f = makeFeeding('f-1', '2026-01-01T08:00:00Z');
    expect(averageFeedingInterval([f])).toBeNull();
  });

  it('calcule l\'intervalle exact pour 2 tétées séparées de 2h', () => {
    const f1 = makeFeeding('f-1', '2026-01-01T08:00:00Z');
    const f2 = makeFeeding('f-2', '2026-01-01T10:00:00Z');
    // 2h = 7 200 000 ms
    expect(averageFeedingInterval([f1, f2])).toBe(7_200_000);
  });

  it('calcule la moyenne pour 3 tétées (intervalles 2h et 3h → moyenne 2h30)', () => {
    const f1 = makeFeeding('f-1', '2026-01-01T08:00:00Z');
    const f2 = makeFeeding('f-2', '2026-01-01T10:00:00Z'); // +2h
    const f3 = makeFeeding('f-3', '2026-01-01T13:00:00Z'); // +3h
    // (2h + 3h) / 2 = 2h30 = 9 000 000 ms
    expect(averageFeedingInterval([f1, f2, f3])).toBe(9_000_000);
  });

  it('trie les tétées avant de calculer (peu importe l\'ordre en entrée)', () => {
    const f1 = makeFeeding('f-1', '2026-01-01T08:00:00Z');
    const f2 = makeFeeding('f-2', '2026-01-01T10:00:00Z');
    // Passed in reverse order — result must be identical
    expect(averageFeedingInterval([f2, f1])).toBe(7_200_000);
  });
});

// ── computeWeekStats ──────────────────────────────────────────────────────────

describe('computeWeekStats', () => {
  // Reference: "today" is 2026-01-07 local time
  // Note: using UTC timestamps that align with local=UTC for determinism
  const TODAY = new Date('2026-01-07T12:00:00Z');

  it('retourne 7 entrées pour une semaine sans tétées', () => {
    const stats = computeWeekStats([], TODAY);
    expect(stats).toHaveLength(7);
  });

  it('toutes les entrées ont feedingCount=0 et avgIntervalMs=null si aucune tétée', () => {
    const stats = computeWeekStats([], TODAY);
    for (const s of stats) {
      expect(s.feedingCount).toBe(0);
      expect(s.avgIntervalMs).toBeNull();
    }
  });

  it('la fenêtre va de J-6 à aujourd\'hui inclus', () => {
    const stats = computeWeekStats([], TODAY);
    expect(stats[0].date).toBe('2026-01-01');
    expect(stats[6].date).toBe('2026-01-07');
  });

  it('compte correctement les tétées du jour J', () => {
    const feedings = [
      makeFeeding('f-1', '2026-01-07T08:00:00Z'),
      makeFeeding('f-2', '2026-01-07T10:00:00Z'),
    ];
    const stats = computeWeekStats(feedings, TODAY);
    const todayStat = stats.find(s => s.date === '2026-01-07')!;
    expect(todayStat.feedingCount).toBe(2);
    expect(todayStat.avgIntervalMs).toBe(7_200_000); // 2h
  });

  it('ignore les tétées hors de la fenêtre 7 jours', () => {
    // J-8 = 2025-12-30
    const old = makeFeeding('f-old', '2025-12-30T08:00:00Z');
    const stats = computeWeekStats([old], TODAY);
    const total = stats.reduce((sum, s) => sum + s.feedingCount, 0);
    expect(total).toBe(0);
  });

  it('1 tétée dans un jour → avgIntervalMs=null pour ce jour', () => {
    const feedings = [makeFeeding('f-1', '2026-01-05T09:00:00Z')];
    const stats = computeWeekStats(feedings, TODAY);
    const dayStat = stats.find(s => s.date === '2026-01-05')!;
    expect(dayStat.feedingCount).toBe(1);
    expect(dayStat.avgIntervalMs).toBeNull();
  });

  it('gère les tétées réparties sur plusieurs jours', () => {
    const feedings = [
      makeFeeding('f-1', '2026-01-01T08:00:00Z'),
      makeFeeding('f-2', '2026-01-01T10:00:00Z'),
      makeFeeding('f-3', '2026-01-03T09:00:00Z'),
    ];
    const stats = computeWeekStats(feedings, TODAY);

    const jan1 = stats.find(s => s.date === '2026-01-01')!;
    expect(jan1.feedingCount).toBe(2);
    expect(jan1.avgIntervalMs).toBe(7_200_000);

    const jan3 = stats.find(s => s.date === '2026-01-03')!;
    expect(jan3.feedingCount).toBe(1);
    expect(jan3.avgIntervalMs).toBeNull();

    const jan2 = stats.find(s => s.date === '2026-01-02')!;
    expect(jan2.feedingCount).toBe(0);
    expect(jan2.avgIntervalMs).toBeNull();
  });
});

// ── formatIntervalMs ──────────────────────────────────────────────────────────

describe('formatIntervalMs', () => {
  it('retourne "—" pour null', () => {
    expect(formatIntervalMs(null)).toBe('—');
  });

  it('affiche les minutes seules pour < 1h', () => {
    expect(formatIntervalMs(30 * 60_000)).toBe('30min');
  });

  it('affiche les heures seules si pas de minutes résiduelles', () => {
    expect(formatIntervalMs(2 * 3_600_000)).toBe('2h');
  });

  it('affiche heures + minutes', () => {
    expect(formatIntervalMs(2 * 3_600_000 + 30 * 60_000)).toBe('2h30');
  });
});

// ── toLocalDateString / toLocalTimeString ─────────────────────────────────────

describe('toLocalDateString', () => {
  it('retourne la date locale YYYY-MM-DD pour un timestamp UTC', () => {
    // This test assumes local TZ = UTC for CI (or accepts both sides of midnight)
    // We test with a midday timestamp to avoid TZ edge cases
    const result = toLocalDateString('2026-01-15T12:00:00Z');
    // Must be a valid date format
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('toLocalTimeString', () => {
  it('retourne l\'heure locale HH:MM', () => {
    const result = toLocalTimeString('2026-01-15T12:30:00Z');
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });
});

// ── mergeEventsSorted ─────────────────────────────────────────────────────────

describe('mergeEventsSorted', () => {
  it('retourne une liste vide si aucun événement', () => {
    expect(mergeEventsSorted([], [])).toEqual([]);
  });

  it('trie les événements mélangés par timestamp décroissant', () => {
    const f1 = makeFeeding('f-1', '2026-01-01T08:00:00Z');
    const f2 = makeFeeding('f-2', '2026-01-01T10:00:00Z');
    const d1 = makeDiaper('d-1', '2026-01-01T09:00:00Z');

    const events = mergeEventsSorted([f1, f2], [d1]);
    expect(events[0].id).toBe('f-2'); // 10h — le plus récent
    expect(events[1].id).toBe('d-1'); // 09h
    expect(events[2].id).toBe('f-1'); // 08h
  });

  it('mappe correctement le timestamp : started_at pour les tétées, at pour les couches', () => {
    const f = makeFeeding('f-1', '2026-01-01T08:00:00Z');
    const d = makeDiaper('d-1', '2026-01-01T09:00:00Z');

    const events = mergeEventsSorted([f], [d]);
    const feedingEvent = events.find(e => e.kind === 'feeding')!;
    const diaperEvent = events.find(e => e.kind === 'diaper')!;

    expect(feedingEvent.timestamp).toBe('2026-01-01T08:00:00Z');
    expect(diaperEvent.timestamp).toBe('2026-01-01T09:00:00Z');
  });

  it('préserve le type de tétée et le kind de couche', () => {
    const f = makeFeeding('f-1', '2026-01-01T08:00:00Z');
    const d = makeDiaper('d-1', '2026-01-01T09:00:00Z');

    const events = mergeEventsSorted([f], [d]);
    const fe = events.find(e => e.kind === 'feeding')!;
    const de = events.find(e => e.kind === 'diaper')!;

    expect(fe.feedingType).toBe('breast_left');
    expect(de.diaperKind).toBe('wet');
  });
});
