/* eslint-disable camelcase */

/**
 * Migration: Create daily_puzzles table
 *
 * This table stores daily puzzle sets for all game types (Octordle, Wordle, Quordle, etc.)
 * Supports encrypted answers to prevent client-side cheating.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create daily_puzzles table
  pgm.createTable('daily_puzzles', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    date: {
      type: 'date',
      notNull: true,
    },
    game_type: {
      type: 'varchar(50)',
      notNull: true,
      comment: 'Game variant: octordle, wordle, quordle, etc.',
    },
    language: {
      type: 'varchar(10)',
      notNull: true,
      default: 'en',
    },
    answers: {
      type: 'text[]',
      notNull: true,
      comment: 'Array of answer words (plain text, for backend use)',
    },
    encrypted_answers: {
      type: 'text',
      notNull: true,
      comment: 'Encrypted version of answers (sent to client)',
    },
    salt: {
      type: 'varchar(64)',
      notNull: true,
      comment: 'Salt used for encryption (date-based)',
    },
    metadata: {
      type: 'jsonb',
      notNull: true,
      default: '{}',
      comment: 'Additional game metadata (difficulty levels, hints, etc.)',
    },
    created_by: {
      type: 'varchar(50)',
      default: 'Manual',
      comment: 'Source: Manual, AI, n8n',
    },
    created_at: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
  });

  // Ensure only one puzzle per date/game/language combination
  pgm.createIndex('daily_puzzles', ['date', 'game_type', 'language'], {
    name: 'idx_daily_unique_puzzle',
    unique: true,
  });

  // Index for quick lookups by date and game type
  pgm.createIndex('daily_puzzles', ['date', 'game_type'], {
    name: 'idx_daily_lookup',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('daily_puzzles');
};
