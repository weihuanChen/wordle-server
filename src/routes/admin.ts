/**
 * Admin API routes for puzzle management
 *
 * These routes require Bearer token authentication
 */

import { Hono } from 'hono';
import { logger } from '../lib/logger.js';
import { requireAuth } from '../middleware/auth.js';
import {
  insertDailyPuzzle,
  getRandomCandidates,
  markWordsAsUsed,
  getGameSettings,
  getWordStats,
  updateGameSettings,
} from '../lib/queries.js';
import { encryptAnswers, generateSalt } from '../lib/crypto.js';
import { invalidatePuzzleCache, getCacheStats } from '../lib/cache.js';

const app = new Hono();

// Apply authentication middleware to all admin routes
app.use('/*', requireAuth);

/**
 * POST /admin/generate-puzzle
 *
 * Generate and store a daily puzzle
 * Request body:
 * {
 *   date?: string,           // Optional, defaults to today (YYYY-MM-DD)
 *   gameType: string,        // Required: octordle, wordle, etc.
 *   language?: string,       // Optional, defaults to 'en'
 *   answers?: string[],      // Optional, manually specify answers
 *   regenerate?: boolean     // Optional, if true, overwrites existing puzzle
 * }
 */
app.post('/generate-puzzle', async (c) => {
  try {
    const body = await c.req.json();
    const { date, gameType, language = 'en', answers, regenerate = false } = body;

    // Validate required fields
    if (!gameType) {
      return c.json(
        {
          error: 'Bad Request',
          message: 'gameType is required',
        },
        400
      );
    }

    // Default to today if no date specified
    const puzzleDate = date || new Date().toISOString().split('T')[0];

    logger.info({ date: puzzleDate, gameType, language }, 'Generating puzzle');

    // Get game settings
    const settings = await getGameSettings(gameType);

    if (!settings) {
      return c.json(
        {
          error: 'Invalid Game Type',
          message: `Game type "${gameType}" is not configured`,
        },
        400
      );
    }

    // Determine answers
    let puzzleAnswers: string[];

    if (answers && Array.isArray(answers)) {
      // Use manually provided answers
      if (answers.length !== settings.answer_count) {
        return c.json(
          {
            error: 'Invalid Answer Count',
            message: `Expected ${settings.answer_count} answers for ${gameType}, got ${answers.length}`,
          },
          400
        );
      }

      // Validate all answers are 5 letters
      const invalidAnswers = answers.filter((word) => word.length !== 5);
      if (invalidAnswers.length > 0) {
        return c.json(
          {
            error: 'Invalid Answers',
            message: 'All answers must be exactly 5 letters',
            invalidAnswers,
          },
          400
        );
      }

      puzzleAnswers = answers.map((w) => w.toLowerCase());
    } else {
      // Randomly select answers from candidates
      const candidates = await getRandomCandidates(settings.answer_count, language);

      if (candidates.length < settings.answer_count) {
        return c.json(
          {
            error: 'Insufficient Words',
            message: `Not enough available words. Need ${settings.answer_count}, found ${candidates.length}`,
            suggestion: 'Try reducing the cooldown period or adding more words to the database',
          },
          500
        );
      }

      puzzleAnswers = candidates;
    }

    // Generate encryption
    const salt = generateSalt(puzzleDate, gameType, language);
    const encryptedAnswers = encryptAnswers(puzzleAnswers, salt);

    // Insert into database
    const puzzle = await insertDailyPuzzle({
      date: puzzleDate,
      gameType,
      language,
      answers: puzzleAnswers,
      encryptedAnswers,
      salt,
      metadata: {
        generated_at: new Date().toISOString(),
        method: answers ? 'manual' : 'random',
      },
      createdBy: 'API',
    });

    // Update last_used_at for selected words
    await markWordsAsUsed(puzzleAnswers, new Date(puzzleDate));

    // Invalidate cache if regenerating
    if (regenerate) {
      await invalidatePuzzleCache(puzzleDate, gameType, language);
    }

    logger.info({ puzzleId: puzzle.id, date: puzzleDate, gameType }, 'Puzzle generated successfully');

    return c.json(
      {
        success: true,
        puzzle: {
          id: puzzle.id,
          date: puzzle.date,
          gameType: puzzle.game_type,
          language: puzzle.language,
          answerCount: puzzleAnswers.length,
          encryptedAnswers: puzzle.encrypted_answers,
          salt: puzzle.salt,
        },
        message: regenerate ? 'Puzzle regenerated successfully' : 'Puzzle created successfully',
      },
      201
    );
  } catch (error: any) {
    logger.error({ error }, 'Error generating puzzle');

    // Handle unique constraint violation (puzzle already exists)
    if (error.code === '23505') {
      return c.json(
        {
          error: 'Puzzle Already Exists',
          message: 'A puzzle for this date/game/language already exists. Use regenerate=true to overwrite.',
        },
        409
      );
    }

    return c.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to generate puzzle',
      },
      500
    );
  }
});

/**
 * PUT /admin/game-settings/:gameType
 *
 * Update game settings
 */
app.put('/game-settings/:gameType', async (c) => {
  const { gameType } = c.req.param();

  try {
    const body = await c.req.json();
    const { answerCount, maxGuesses, config } = body;

    const settings = await updateGameSettings(gameType, {
      answerCount,
      maxGuesses,
      configJson: config,
    });

    logger.info({ gameType }, 'Game settings updated');

    return c.json({
      success: true,
      settings: {
        gameType: settings.game_type,
        answerCount: settings.answer_count,
        maxGuesses: settings.max_guesses,
        config: settings.config_json,
        updatedAt: settings.updated_at,
      },
    });
  } catch (error) {
    logger.error({ error, gameType }, 'Error updating game settings');
    return c.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to update game settings',
      },
      500
    );
  }
});

/**
 * GET /admin/candidates
 *
 * Get random candidate words for AI filtering
 * Query parameters:
 * - count: number of words to return (default: 15, max: 50)
 * - language: language code (default: 'en')
 * - onlyAnswers: return only answer candidates (default: true)
 * - cooldownDays: minimum days since last use (default: 60)
 */
app.get('/candidates', async (c) => {
  try {
    const count = parseInt(c.req.query('count') || '15');
    const language = c.req.query('language') || 'en';
    const onlyAnswers = c.req.query('onlyAnswers') !== 'false';
    const cooldownDays = parseInt(c.req.query('cooldownDays') || '60');

    // Validate count
    if (count < 1 || count > 50) {
      return c.json(
        {
          error: 'Invalid Count',
          message: 'Count must be between 1 and 50',
        },
        400
      );
    }

    logger.info({ count, language, onlyAnswers, cooldownDays }, 'Fetching candidate words');

    // Get random candidates
    const candidates = await getRandomCandidates(count, language, cooldownDays);

    if (candidates.length === 0) {
      return c.json(
        {
          error: 'No Candidates Available',
          message: 'No words available matching the criteria',
          suggestion: 'Try reducing cooldownDays or setting onlyAnswers=false',
        },
        404
      );
    }

    return c.json({
      candidates,
      count: candidates.length,
      requestedCount: count,
      language,
      onlyAnswers,
      cooldownDays,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching candidates');
    return c.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to fetch candidate words',
      },
      500
    );
  }
});

/**
 * GET /admin/stats
 *
 * Get system statistics
 */
app.get('/stats', async (c) => {
  try {
    const wordStats = await getWordStats();
    const cacheStats = await getCacheStats();

    return c.json({
      words: wordStats,
      cache: cacheStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching stats');
    return c.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to fetch statistics',
      },
      500
    );
  }
});

export default app;
