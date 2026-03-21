/**
 * Scoring service — all gameplay calculations in one place.
 * Every function receives the config as a parameter, never hardcoded values.
 */

export interface ScoringConfig {
  timerSeconds: number;
  pointsPerRound: number;
  pointsBonusRound: number;
  speedWeight: number;
  baseWeight: number;
  minCorrectPoints: number;
  xpBaseMatch: number;
  xpWinBonus: number;
  xpPerfectBonus: number;
  xpStreakMultiplier: number;
  levelFormulaDivisor: number;
  badgeThresholds: Record<string, number>;
}

/**
 * Calculate points for a single round.
 * - Incorrect or timeout → 0
 * - Correct → speed component + base component, minimum minCorrectPoints
 */
export function calculateRoundPoints(
  config: ScoringConfig,
  timeMs: number,
  isCorrect: boolean,
  isBonus: boolean,
): number {
  if (!isCorrect) return 0;

  const maxPoints = isBonus ? config.pointsBonusRound : config.pointsPerRound;
  const timerMs = config.timerSeconds * 1000;

  // Clamp timeMs to valid range
  const clampedTime = Math.max(0, Math.min(timeMs, timerMs));

  const speedComponent = maxPoints * (1 - clampedTime / timerMs) * config.speedWeight;
  const baseComponent = maxPoints * config.baseWeight;

  const points = Math.round(speedComponent + baseComponent);
  return Math.max(points, config.minCorrectPoints);
}

/**
 * Calculate XP earned from a match.
 */
export function calculateMatchXP(
  config: ScoringConfig,
  result: { won: boolean; perfectRound: boolean; streak: number },
): number {
  let xp = config.xpBaseMatch;
  if (result.won) xp += config.xpWinBonus;
  if (result.perfectRound) xp += config.xpPerfectBonus;
  xp += result.streak * config.xpStreakMultiplier;
  return xp;
}

/**
 * Calculate player level from total XP.
 * level = floor(sqrt(totalXP / divisor)) + 1
 */
export function calculateLevel(totalXP: number, config: ScoringConfig): number {
  return Math.floor(Math.sqrt(totalXP / config.levelFormulaDivisor)) + 1;
}

/**
 * Determine badge tier based on category XP.
 * Returns the highest tier the player qualifies for, or null if none.
 */
export function calculateBadge(
  categoryXP: number,
  config: ScoringConfig,
): string | null {
  const tiers = ['grand_master', 'expert', 'gold', 'silver', 'bronze'] as const;
  for (const tier of tiers) {
    const threshold = config.badgeThresholds[tier];
    if (threshold !== undefined && categoryXP >= threshold) {
      return tier;
    }
  }
  return null;
}
