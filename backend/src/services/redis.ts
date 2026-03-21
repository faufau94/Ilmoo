import { Redis } from 'ioredis';

// ── Connection ──

const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379');

export default redis;

// ══════════════════════════════════════════════
// Matchmaking  —  queue:{flavorSlug}:{categoryId}
// ══════════════════════════════════════════════

function queueKey(flavorSlug: string, categoryId: string): string {
  return `queue:${flavorSlug}:${categoryId}`;
}

/** Add a player to the matchmaking queue. Returns the position in queue (1-based). */
export async function addToQueue(
  flavorSlug: string,
  categoryId: string,
  userId: string,
): Promise<number> {
  const key = queueKey(flavorSlug, categoryId);
  await redis.rpush(key, userId);
  return redis.llen(key);
}

/** Remove a player from the matchmaking queue. */
export async function removeFromQueue(
  flavorSlug: string,
  categoryId: string,
  userId: string,
): Promise<void> {
  await redis.lrem(queueKey(flavorSlug, categoryId), 1, userId);
}

/**
 * Pop the first player from the queue who is not `excludeUserId`.
 * Returns the opponent userId or null if nobody is waiting.
 */
export async function findOpponent(
  flavorSlug: string,
  categoryId: string,
  excludeUserId: string,
): Promise<string | null> {
  const key = queueKey(flavorSlug, categoryId);
  const length = await redis.llen(key);

  for (let i = 0; i < length; i++) {
    // Atomically pop the front of the queue
    const candidate = await redis.lpop(key);
    if (!candidate) return null;

    if (candidate !== excludeUserId) {
      return candidate;
    }

    // Put self back at the end if we accidentally popped ourselves
    await redis.rpush(key, candidate);
  }

  return null;
}

// ══════════════════════════════════════════════
// Leaderboards  —  Redis Sorted Sets
//   leaderboard:{flavorSlug}:global
//   leaderboard:{flavorSlug}:cat:{categoryId}
//   leaderboard:{flavorSlug}:weekly
// ══════════════════════════════════════════════

function leaderboardKey(
  flavorSlug: string,
  scope: 'global' | 'weekly' | { categoryId: string },
): string {
  if (typeof scope === 'object') {
    return `leaderboard:${flavorSlug}:cat:${scope.categoryId}`;
  }
  return `leaderboard:${flavorSlug}:${scope}`;
}

/** Set (or replace) a player's score in a leaderboard. */
export async function updateScore(
  flavorSlug: string,
  userId: string,
  score: number,
  scope: 'global' | 'weekly' | { categoryId: string } = 'global',
): Promise<void> {
  await redis.zadd(leaderboardKey(flavorSlug, scope), score, userId);
}

/** Get the top N players from a leaderboard (descending by score). */
export async function getTopPlayers(
  flavorSlug: string,
  limit: number,
  scope: 'global' | 'weekly' | { categoryId: string } = 'global',
): Promise<{ userId: string; score: number }[]> {
  const results = await redis.zrevrange(
    leaderboardKey(flavorSlug, scope),
    0,
    limit - 1,
    'WITHSCORES',
  );

  const entries: { userId: string; score: number }[] = [];
  for (let i = 0; i < results.length; i += 2) {
    entries.push({ userId: results[i]!, score: Number(results[i + 1]) });
  }
  return entries;
}

/** Get a player's 1-based rank in a leaderboard, or null if not ranked. */
export async function getUserRank(
  flavorSlug: string,
  userId: string,
  scope: 'global' | 'weekly' | { categoryId: string } = 'global',
): Promise<number | null> {
  const rank = await redis.zrevrank(leaderboardKey(flavorSlug, scope), userId);
  return rank === null ? null : rank + 1;
}

// ══════════════════════════════════════════════
// Cache: flavor config  —  config:{slug}  TTL 5 min
// ══════════════════════════════════════════════

const CONFIG_TTL = 300; // 5 minutes

export async function cacheFlavorConfig(
  slug: string,
  data: Record<string, unknown>,
): Promise<void> {
  await redis.set(`config:${slug}`, JSON.stringify(data), 'EX', CONFIG_TTL);
}

export async function getFlavorConfig(
  slug: string,
): Promise<Record<string, unknown> | null> {
  const raw = await redis.get(`config:${slug}`);
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

// ══════════════════════════════════════════════
// Cache: questions  —  questions:{categoryId}  TTL 10 min
// ══════════════════════════════════════════════

const QUESTIONS_TTL = 600; // 10 minutes

export async function cacheQuestions(
  categoryId: string,
  questions: unknown[],
): Promise<void> {
  await redis.set(
    `questions:${categoryId}`,
    JSON.stringify(questions),
    'EX',
    QUESTIONS_TTL,
  );
}

export async function getCachedQuestions(
  categoryId: string,
): Promise<unknown[] | null> {
  const raw = await redis.get(`questions:${categoryId}`);
  return raw ? (JSON.parse(raw) as unknown[]) : null;
}
