import { describe, it, expect } from 'vitest';
import {
  calculateRoundPoints,
  calculateMatchXP,
  calculateLevel,
  calculateBadge,
  type ScoringConfig,
} from '../../src/services/scoring.js';

const defaultConfig: ScoringConfig = {
  timerSeconds: 10,
  pointsPerRound: 20,
  pointsBonusRound: 40,
  speedWeight: 0.7,
  baseWeight: 0.3,
  minCorrectPoints: 5,
  xpBaseMatch: 10,
  xpWinBonus: 15,
  xpPerfectBonus: 25,
  xpStreakMultiplier: 2,
  levelFormulaDivisor: 100,
  badgeThresholds: {
    bronze: 100,
    silver: 500,
    gold: 1500,
    expert: 5000,
    grand_master: 15000,
  },
};

describe('calculateRoundPoints', () => {
  it('returns 0 for incorrect answer', () => {
    expect(calculateRoundPoints(defaultConfig, 3000, false, false)).toBe(0);
  });

  it('returns 0 for incorrect answer even with 0ms', () => {
    expect(calculateRoundPoints(defaultConfig, 0, false, false)).toBe(0);
  });

  it('returns max points for instant correct answer', () => {
    // timeMs = 0: speed = 20 * 1.0 * 0.7 = 14, base = 20 * 0.3 = 6, total = 20
    const points = calculateRoundPoints(defaultConfig, 0, true, false);
    expect(points).toBe(20);
  });

  it('returns base points for answer at exactly the timeout', () => {
    // timeMs = 10000: speed = 20 * 0.0 * 0.7 = 0, base = 20 * 0.3 = 6, total = 6
    const points = calculateRoundPoints(defaultConfig, 10000, true, false);
    expect(points).toBe(6);
  });

  it('returns correct points for mid-speed answer', () => {
    // timeMs = 5000: speed = 20 * 0.5 * 0.7 = 7, base = 20 * 0.3 = 6, total = 13
    const points = calculateRoundPoints(defaultConfig, 5000, true, false);
    expect(points).toBe(13);
  });

  it('respects minCorrectPoints', () => {
    // Very slow answer but still correct
    const points = calculateRoundPoints(defaultConfig, 9999, true, false);
    expect(points).toBeGreaterThanOrEqual(defaultConfig.minCorrectPoints);
  });

  it('uses pointsBonusRound for bonus rounds', () => {
    // timeMs = 0, bonus: speed = 40 * 1.0 * 0.7 = 28, base = 40 * 0.3 = 12, total = 40
    const points = calculateRoundPoints(defaultConfig, 0, true, true);
    expect(points).toBe(40);
  });

  it('bonus round at half time', () => {
    // timeMs = 5000: speed = 40 * 0.5 * 0.7 = 14, base = 40 * 0.3 = 12, total = 26
    const points = calculateRoundPoints(defaultConfig, 5000, true, true);
    expect(points).toBe(26);
  });

  it('works with custom config values', () => {
    const custom: ScoringConfig = {
      ...defaultConfig,
      timerSeconds: 15,
      pointsPerRound: 30,
      speedWeight: 0.5,
      baseWeight: 0.5,
      minCorrectPoints: 10,
    };
    // timeMs = 0: speed = 30 * 1.0 * 0.5 = 15, base = 30 * 0.5 = 15, total = 30
    expect(calculateRoundPoints(custom, 0, true, false)).toBe(30);
    // timeMs = 15000: speed = 0, base = 15, total = 15
    expect(calculateRoundPoints(custom, 15000, true, false)).toBe(15);
  });

  it('clamps timeMs to valid range', () => {
    // Negative time should be treated as 0
    const pointsNeg = calculateRoundPoints(defaultConfig, -100, true, false);
    expect(pointsNeg).toBe(20);

    // Time exceeding timer should be treated as max timer
    const pointsOver = calculateRoundPoints(defaultConfig, 99999, true, false);
    expect(pointsOver).toBe(6);
  });
});

describe('calculateMatchXP', () => {
  it('returns base XP for a loss with no streak', () => {
    const xp = calculateMatchXP(defaultConfig, { won: false, perfectRound: false, streak: 0 });
    expect(xp).toBe(10);
  });

  it('adds win bonus', () => {
    const xp = calculateMatchXP(defaultConfig, { won: true, perfectRound: false, streak: 0 });
    expect(xp).toBe(25); // 10 + 15
  });

  it('adds perfect bonus', () => {
    const xp = calculateMatchXP(defaultConfig, { won: false, perfectRound: true, streak: 0 });
    expect(xp).toBe(35); // 10 + 25
  });

  it('adds streak bonus', () => {
    const xp = calculateMatchXP(defaultConfig, { won: false, perfectRound: false, streak: 5 });
    expect(xp).toBe(20); // 10 + 5*2
  });

  it('combines all bonuses', () => {
    const xp = calculateMatchXP(defaultConfig, { won: true, perfectRound: true, streak: 3 });
    expect(xp).toBe(56); // 10 + 15 + 25 + 3*2
  });

  it('works with custom config', () => {
    const custom: ScoringConfig = {
      ...defaultConfig,
      xpBaseMatch: 20,
      xpWinBonus: 30,
      xpPerfectBonus: 50,
      xpStreakMultiplier: 5,
    };
    const xp = calculateMatchXP(custom, { won: true, perfectRound: true, streak: 2 });
    expect(xp).toBe(110); // 20 + 30 + 50 + 2*5
  });
});

describe('calculateLevel', () => {
  it('returns level 1 for 0 XP', () => {
    expect(calculateLevel(0, defaultConfig)).toBe(1);
  });

  it('returns level 1 for XP below first threshold', () => {
    expect(calculateLevel(99, defaultConfig)).toBe(1);
  });

  it('returns level 2 for 100 XP', () => {
    // sqrt(100/100) = 1, +1 = 2
    expect(calculateLevel(100, defaultConfig)).toBe(2);
  });

  it('returns level 4 for 900 XP', () => {
    // sqrt(900/100) = 3, +1 = 4
    expect(calculateLevel(900, defaultConfig)).toBe(4);
  });

  it('returns correct level for large XP', () => {
    // sqrt(10000/100) = 10, +1 = 11
    expect(calculateLevel(10000, defaultConfig)).toBe(11);
  });

  it('works with custom divisor', () => {
    const custom: ScoringConfig = { ...defaultConfig, levelFormulaDivisor: 50 };
    // sqrt(200/50) = 2, +1 = 3
    expect(calculateLevel(200, custom)).toBe(3);
  });
});

describe('calculateBadge', () => {
  it('returns null for 0 XP', () => {
    expect(calculateBadge(0, defaultConfig)).toBeNull();
  });

  it('returns null for XP below bronze', () => {
    expect(calculateBadge(99, defaultConfig)).toBeNull();
  });

  it('returns bronze at threshold', () => {
    expect(calculateBadge(100, defaultConfig)).toBe('bronze');
  });

  it('returns silver at threshold', () => {
    expect(calculateBadge(500, defaultConfig)).toBe('silver');
  });

  it('returns gold at threshold', () => {
    expect(calculateBadge(1500, defaultConfig)).toBe('gold');
  });

  it('returns expert at threshold', () => {
    expect(calculateBadge(5000, defaultConfig)).toBe('expert');
  });

  it('returns grand_master at threshold', () => {
    expect(calculateBadge(15000, defaultConfig)).toBe('grand_master');
  });

  it('returns grand_master for XP well above threshold', () => {
    expect(calculateBadge(999999, defaultConfig)).toBe('grand_master');
  });

  it('returns highest qualifying tier', () => {
    // 600 XP: above bronze (100) and silver (500), below gold (1500)
    expect(calculateBadge(600, defaultConfig)).toBe('silver');
  });
});
