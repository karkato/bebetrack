import { describe, it, expect } from 'vitest';
import { formatElapsed, feedingTypeLabel } from './elapsed-time';

function dateAt(offsetMs: number): { from: Date; now: Date } {
  const base = new Date('2026-01-01T10:00:00Z');
  return { from: base, now: new Date(base.getTime() + offsetMs) };
}

describe('formatElapsed', () => {
  it("retourne \"à l'instant\" si moins d'1 minute", () => {
    const { from, now } = dateAt(30_000); // 30 secondes
    expect(formatElapsed(from, now)).toBe("à l'instant");
  });

  it('retourne "il y a 5 min" pour 5 minutes', () => {
    const { from, now } = dateAt(5 * 60_000);
    expect(formatElapsed(from, now)).toBe('il y a 5 min');
  });

  it('retourne "il y a 59 min" juste avant 1h', () => {
    const { from, now } = dateAt(59 * 60_000);
    expect(formatElapsed(from, now)).toBe('il y a 59 min');
  });

  it('retourne "il y a 1 h" pour exactement 60 minutes', () => {
    const { from, now } = dateAt(60 * 60_000);
    expect(formatElapsed(from, now)).toBe('il y a 1 h');
  });

  it('retourne "il y a 2 h" pour exactement 120 minutes', () => {
    const { from, now } = dateAt(120 * 60_000);
    expect(formatElapsed(from, now)).toBe('il y a 2 h');
  });

  it('retourne "il y a 1 h 20 min" pour 80 minutes', () => {
    const { from, now } = dateAt(80 * 60_000);
    expect(formatElapsed(from, now)).toBe('il y a 1 h 20 min');
  });

  it('retourne "il y a 3 h 5 min" pour 185 minutes', () => {
    const { from, now } = dateAt(185 * 60_000);
    expect(formatElapsed(from, now)).toBe('il y a 3 h 5 min');
  });
});

describe('feedingTypeLabel', () => {
  it('retourne "sein gauche" pour breast_left', () => {
    expect(feedingTypeLabel('breast_left')).toBe('sein gauche');
  });

  it('retourne "sein droit" pour breast_right', () => {
    expect(feedingTypeLabel('breast_right')).toBe('sein droit');
  });

  it('retourne "biberon" pour bottle', () => {
    expect(feedingTypeLabel('bottle')).toBe('biberon');
  });

  it('retourne la valeur brute pour un type inconnu', () => {
    expect(feedingTypeLabel('unknown_type')).toBe('unknown_type');
  });
});
