/**
 * Redis cache management for daily puzzles
 *
 * Implements cache-first strategy for faster response times
 */

import { getRedisClient } from './redis.js';
import { logger } from './logger.js';

const CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds

/**
 * Generate cache key for daily puzzle
 *
 * @param date - Date in YYYY-MM-DD format
 * @param gameType - Game type
 * @param language - Language code
 * @returns Redis cache key
 */
export function getDailyCacheKey(date: string, gameType: string, language: string): string {
  return `daily:${date}:${gameType}:${language}`;
}

/**
 * Set cached puzzle data
 *
 * @param key - Cache key
 * @param data - Puzzle data to cache
 * @returns Promise<void>
 */
export async function setCachedPuzzle(key: string, data: any): Promise<void> {
  try {
    const jsonData = JSON.stringify(data);
    await getRedisClient().setex(key, CACHE_TTL, jsonData);
    logger.info({ key, ttl: CACHE_TTL }, 'Puzzle cached successfully');
  } catch (error) {
    logger.error({ error, key }, 'Failed to cache puzzle');
    // Don't throw - caching failure shouldn't break the app
  }
}

/**
 * Get cached puzzle data
 *
 * @param key - Cache key
 * @returns Cached data or null if not found/expired
 */
export async function getCachedPuzzle(key: string): Promise<any | null> {
  try {
    const cachedData = await getRedisClient().get(key);

    if (!cachedData) {
      logger.debug({ key }, 'Cache miss');
      return null;
    }

    logger.debug({ key }, 'Cache hit');
    return JSON.parse(cachedData);
  } catch (error) {
    logger.error({ error, key }, 'Failed to retrieve from cache');
    return null;
  }
}

/**
 * Invalidate cache for a specific puzzle
 *
 * @param date - Date in YYYY-MM-DD format
 * @param gameType - Game type
 * @param language - Language code
 */
export async function invalidatePuzzleCache(
  date: string,
  gameType: string,
  language: string
): Promise<void> {
  try {
    const key = getDailyCacheKey(date, gameType, language);
    await getRedisClient().del(key);
    logger.info({ key }, 'Cache invalidated');
  } catch (error) {
    logger.error({ error }, 'Failed to invalidate cache');
  }
}

/**
 * Invalidate all puzzle caches (use with caution)
 */
export async function invalidateAllPuzzleCaches(): Promise<void> {
  try {
    const keys = await getRedisClient().keys('daily:*');
    if (keys.length > 0) {
      await getRedisClient().del(...keys);
      logger.info({ count: keys.length }, 'All puzzle caches invalidated');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to invalidate all caches');
  }
}

/**
 * Get cache statistics
 *
 * @returns Object with cache stats
 */
export async function getCacheStats(): Promise<{
  totalKeys: number;
  puzzleKeys: number;
  memoryUsed: string;
}> {
  try {
    const info = await getRedisClient().info('memory');
    const memoryMatch = info.match(/used_memory_human:(.+)/);
    const memoryUsed = memoryMatch ? memoryMatch[1].trim() : 'Unknown';

    const allKeys = await getRedisClient().keys('*');
    const puzzleKeys = await getRedisClient().keys('daily:*');

    return {
      totalKeys: allKeys.length,
      puzzleKeys: puzzleKeys.length,
      memoryUsed,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get cache stats');
    return {
      totalKeys: 0,
      puzzleKeys: 0,
      memoryUsed: 'Unknown',
    };
  }
}
