/**
 * Public API routes for client applications
 *
 * These routes are accessible without authentication
 */

import { Hono } from 'hono';
import { logger } from '../lib/logger.js';
import { getDailyPuzzle, getGameSettings, verifyWord } from '../lib/queries.js';
import { getDailyCacheKey, getCachedPuzzle, setCachedPuzzle } from '../lib/cache.js';

const app = new Hono();

/**
 * GET /daily/:gameType/:lang
 *
 * Get today's puzzle for a specific game type and language
 * Uses cache-first strategy (Redis -> PostgreSQL)
 */
app.get('/daily/:gameType/:lang', async (c) => {
  const { gameType, lang } = c.req.param();

  // Get current UTC date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  logger.info({ gameType, lang, date: today }, 'Fetching daily puzzle');

  try {
    // Try to get from cache first
    const cacheKey = getDailyCacheKey(today, gameType, lang);
    const startTime = Date.now();

    let cachedData = await getCachedPuzzle(cacheKey);

    if (cachedData) {
      const responseTime = Date.now() - startTime;
      logger.info({ gameType, lang, responseTime, source: 'cache' }, 'Puzzle served from cache');

      return c.json({
        ...cachedData,
        _meta: {
          source: 'cache',
          responseTime: `${responseTime}ms`,
        },
      });
    }

    // Cache miss - query database
    const puzzle = await getDailyPuzzle(today, gameType, lang);

    if (!puzzle) {
      logger.warn({ gameType, lang, date: today }, 'Puzzle not found');
      return c.json(
        {
          error: 'Puzzle Not Found',
          message: `No puzzle available for ${gameType} (${lang}) on ${today}`,
          suggestion: 'The puzzle may not have been generated yet. Please try again later.',
        },
        404
      );
    }

    // Get game settings
    const settings = await getGameSettings(gameType);

    if (!settings) {
      logger.error({ gameType }, 'Game settings not found');
      return c.json(
        {
          error: 'Invalid Game Type',
          message: `Game type "${gameType}" is not configured`,
        },
        400
      );
    }

    // Prepare response data
    const responseData = {
      date: puzzle.date,
      gameType: puzzle.game_type,
      language: puzzle.language,
      encryptedAnswers: puzzle.encrypted_answers,
      salt: puzzle.salt,
      answerCount: settings.answer_count,
      maxGuesses: settings.max_guesses,
      metadata: puzzle.metadata,
    };

    // Cache for next request
    await setCachedPuzzle(cacheKey, responseData);

    const responseTime = Date.now() - startTime;
    logger.info({ gameType, lang, responseTime, source: 'database' }, 'Puzzle served from database');

    return c.json({
      ...responseData,
      _meta: {
        source: 'database',
        responseTime: `${responseTime}ms`,
      },
    });
  } catch (error) {
    logger.error({ error, gameType, lang }, 'Error fetching daily puzzle');
    return c.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to fetch daily puzzle',
      },
      500
    );
  }
});

/**
 * GET /config/:gameType
 *
 * Get game configuration for a specific game type
 */
app.get('/config/:gameType', async (c) => {
  const { gameType } = c.req.param();

  logger.info({ gameType }, 'Fetching game configuration');

  try {
    const settings = await getGameSettings(gameType);

    if (!settings) {
      return c.json(
        {
          error: 'Not Found',
          message: `Game type "${gameType}" not found`,
        },
        404
      );
    }

    return c.json({
      gameType: settings.game_type,
      answerCount: settings.answer_count,
      maxGuesses: settings.max_guesses,
      config: settings.config_json,
      updatedAt: settings.updated_at,
    });
  } catch (error) {
    logger.error({ error, gameType }, 'Error fetching game configuration');
    return c.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to fetch game configuration',
      },
      500
    );
  }
});

/**
 * GET /verify/:lang/:word
 *
 * Verify if a word is valid for guessing
 */
app.get('/verify/:lang/:word', async (c) => {
  const { lang, word } = c.req.param();

  // Validate word format
  if (word.length !== 5) {
    return c.json(
      {
        word,
        valid: false,
        reason: 'Word must be exactly 5 letters',
      },
      400
    );
  }

  // Check for invalid characters (only letters allowed)
  if (!/^[a-zA-Z]+$/.test(word)) {
    return c.json(
      {
        word,
        valid: false,
        reason: 'Word must contain only letters',
      },
      400
    );
  }

  try {
    const result = await verifyWord(word, lang);

    return c.json({
      word: word.toLowerCase(),
      language: lang,
      valid: result.valid,
      isAnswerCandidate: result.isAnswerCandidate,
    });
  } catch (error) {
    logger.error({ error, word, lang }, 'Error verifying word');
    return c.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to verify word',
      },
      500
    );
  }
});

export default app;
