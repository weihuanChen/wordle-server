/**
 * Database query functions for word and puzzle management
 */

import { getPool } from './db.js';

export interface WordRecord {
  word: string;
  language: string;
  is_daily_answer: boolean;
  popularity_score: number;
  last_used_at: Date | null;
}

export interface DailyPuzzle {
  id: number;
  date: string;
  game_type: string;
  language: string;
  answers: string[];
  encrypted_answers: string;
  salt: string;
  metadata: Record<string, any>;
  created_by: string;
  created_at: Date;
}

export interface GameSettings {
  game_type: string;
  answer_count: number;
  max_guesses: number;
  config_json: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Verify if a word exists in the allowed_words table
 *
 * @param word - The word to verify (will be normalized to lowercase)
 * @param language - Language code (default: 'en')
 * @returns Object with validation result and word info
 */
export async function verifyWord(
  word: string,
  language = 'en'
): Promise<{ valid: boolean; isAnswerCandidate: boolean }> {
  const normalizedWord = word.toLowerCase().trim();

  const result = await getPool().query<WordRecord>(
    'SELECT word, is_daily_answer FROM allowed_words WHERE word = $1 AND language = $2',
    [normalizedWord, language]
  );

  if (result.rows.length === 0) {
    return { valid: false, isAnswerCandidate: false };
  }

  return {
    valid: true,
    isAnswerCandidate: result.rows[0].is_daily_answer,
  };
}

/**
 * Get daily puzzle from database
 *
 * @param date - Date in YYYY-MM-DD format
 * @param gameType - Game type (octordle, wordle, etc.)
 * @param language - Language code (default: 'en')
 * @returns Daily puzzle or null if not found
 */
export async function getDailyPuzzle(
  date: string,
  gameType: string,
  language = 'en'
): Promise<DailyPuzzle | null> {
  const result = await getPool().query<DailyPuzzle>(
    `SELECT * FROM daily_puzzles
     WHERE date = $1 AND game_type = $2 AND language = $3`,
    [date, gameType, language]
  );

  return result.rows[0] || null;
}

/**
 * Insert a new daily puzzle
 *
 * @param params - Puzzle parameters
 * @returns Inserted puzzle record
 */
export async function insertDailyPuzzle(params: {
  date: string;
  gameType: string;
  language: string;
  answers: string[];
  encryptedAnswers: string;
  salt: string;
  metadata?: Record<string, any>;
  createdBy?: string;
}): Promise<DailyPuzzle> {
  const {
    date,
    gameType,
    language,
    answers,
    encryptedAnswers,
    salt,
    metadata = {},
    createdBy = 'Manual',
  } = params;

  const result = await getPool().query<DailyPuzzle>(
    `INSERT INTO daily_puzzles
     (date, game_type, language, answers, encrypted_answers, salt, metadata, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (date, game_type, language)
     DO UPDATE SET
       answers = EXCLUDED.answers,
       encrypted_answers = EXCLUDED.encrypted_answers,
       salt = EXCLUDED.salt,
       metadata = EXCLUDED.metadata,
       created_by = EXCLUDED.created_by,
       created_at = NOW()
     RETURNING *`,
    [date, gameType, language, answers, encryptedAnswers, salt, JSON.stringify(metadata), createdBy]
  );

  return result.rows[0];
}

/**
 * Update last_used_at timestamp for words
 *
 * @param words - Array of words to mark as used
 * @param timestamp - Timestamp to set (default: NOW())
 */
export async function markWordsAsUsed(words: string[], timestamp?: Date): Promise<void> {
  const ts = timestamp || new Date();

  await getPool().query(
    `UPDATE allowed_words
     SET last_used_at = $1
     WHERE word = ANY($2)`,
    [ts, words]
  );
}

/**
 * Get game settings by game type
 *
 * @param gameType - Game type (octordle, wordle, etc.)
 * @returns Game settings or null if not found
 */
export async function getGameSettings(gameType: string): Promise<GameSettings | null> {
  const result = await getPool().query<GameSettings>('SELECT * FROM game_settings WHERE game_type = $1', [
    gameType,
  ]);

  return result.rows[0] || null;
}

/**
 * Get random answer candidates for puzzle generation
 *
 * This selects words that:
 * 1. Can be used as daily answers (is_daily_answer = true)
 * 2. Haven't been used recently (last_used_at is NULL or > cooldown period)
 * 3. Are in the specified language
 *
 * @param count - Number of words to select
 * @param language - Language code (default: 'en')
 * @param cooldownDays - Days before a word can be reused (default: 60)
 * @returns Array of random words
 */
export async function getRandomCandidates(
  count: number,
  language = 'en',
  cooldownDays = 60
): Promise<string[]> {
  const result = await getPool().query<{ word: string }>(
    `SELECT word FROM allowed_words
     WHERE language = $1
       AND is_daily_answer = true
       AND (last_used_at IS NULL OR last_used_at < NOW() - INTERVAL '${cooldownDays} days')
     ORDER BY RANDOM()
     LIMIT $2`,
    [language, count]
  );

  return result.rows.map((row) => row.word);
}

/**
 * Get word count statistics
 *
 * @returns Object with word statistics
 */
export async function getWordStats(): Promise<{
  total: number;
  answerCandidates: number;
  guessOnly: number;
}> {
  const result = await getPool().query<{
    total: string;
    answer_candidates: string;
    guess_only: string;
  }>(
    `SELECT
      COUNT(*)::text as total,
      COUNT(*) FILTER (WHERE is_daily_answer = true)::text as answer_candidates,
      COUNT(*) FILTER (WHERE is_daily_answer = false)::text as guess_only
     FROM allowed_words`
  );

  const row = result.rows[0];
  return {
    total: parseInt(row.total),
    answerCandidates: parseInt(row.answer_candidates),
    guessOnly: parseInt(row.guess_only),
  };
}

/**
 * Update game settings
 *
 * @param gameType - Game type
 * @param settings - Settings to update
 */
export async function updateGameSettings(
  gameType: string,
  settings: {
    answerCount?: number;
    maxGuesses?: number;
    configJson?: Record<string, any>;
  }
): Promise<GameSettings> {
  const { answerCount, maxGuesses, configJson } = settings;

  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (answerCount !== undefined) {
    updates.push(`answer_count = $${paramIndex++}`);
    values.push(answerCount);
  }

  if (maxGuesses !== undefined) {
    updates.push(`max_guesses = $${paramIndex++}`);
    values.push(maxGuesses);
  }

  if (configJson !== undefined) {
    updates.push(`config_json = $${paramIndex++}`);
    values.push(JSON.stringify(configJson));
  }

  values.push(gameType);

  const result = await getPool().query<GameSettings>(
    `UPDATE game_settings
     SET ${updates.join(', ')}
     WHERE game_type = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows[0];
}
