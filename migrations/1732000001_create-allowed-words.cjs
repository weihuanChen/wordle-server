/* eslint-disable camelcase */

/**
 * Migration: Create allowed_words table
 *
 * This table stores all valid 5-letter words that can be used in the game.
 * - Puzzle candidates (~3,500 words) have is_daily_answer = TRUE
 * - Valid guesses (~12,000 words) have is_daily_answer = FALSE
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create allowed_words table
  pgm.createTable('allowed_words', {
    word: {
      type: 'varchar(5)',
      primaryKey: true,
      notNull: true,
    },
    language: {
      type: 'varchar(10)',
      notNull: true,
      default: 'en',
    },
    is_daily_answer: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'TRUE = can be used as puzzle answer, FALSE = guess-only word',
    },
    popularity_score: {
      type: 'numeric(5, 2)',
      default: 0.00,
      comment: 'Word frequency score (0.00 - 100.00)',
    },
    last_used_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'Last time this word was used as a puzzle answer (prevents repetition)',
    },
  });

  // Create index for efficient candidate selection
  pgm.createIndex('allowed_words', ['language', 'is_daily_answer', 'last_used_at'], {
    name: 'idx_candidate_selection',
  });

  // Create index for word verification
  pgm.createIndex('allowed_words', 'word', {
    name: 'idx_word_lookup',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('allowed_words');
};
