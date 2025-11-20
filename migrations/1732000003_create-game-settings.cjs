/* eslint-disable camelcase */

/**
 * Migration: Create game_settings table and insert default configurations
 *
 * This table stores game-specific settings like answer count and max guesses.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create game_settings table
  pgm.createTable('game_settings', {
    game_type: {
      type: 'varchar(50)',
      primaryKey: true,
      notNull: true,
    },
    answer_count: {
      type: 'integer',
      notNull: true,
      comment: 'Number of answers per puzzle (Octordle=8, Wordle=1, Quordle=4)',
    },
    max_guesses: {
      type: 'integer',
      notNull: true,
      comment: 'Maximum number of guesses allowed',
    },
    config_json: {
      type: 'jsonb',
      default: '{}',
      comment: 'Additional game-specific configuration',
    },
    created_at: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
  });

  // Insert default game configurations
  pgm.sql(`
    INSERT INTO game_settings (game_type, answer_count, max_guesses, config_json)
    VALUES
      ('octordle', 8, 13, '{"difficulty_levels": ["easy", "medium", "hard"], "description": "Guess 8 words simultaneously"}'::jsonb),
      ('wordle', 1, 6, '{"difficulty_levels": ["normal"], "description": "Classic single word game"}'::jsonb),
      ('quordle', 4, 9, '{"difficulty_levels": ["easy", "medium", "hard"], "description": "Guess 4 words simultaneously"}'::jsonb),
      ('dordle', 2, 7, '{"difficulty_levels": ["easy", "medium"], "description": "Guess 2 words simultaneously"}'::jsonb)
  `);

  // Add update trigger for updated_at
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER update_game_settings_updated_at
    BEFORE UPDATE ON game_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TRIGGER IF EXISTS update_game_settings_updated_at ON game_settings');
  pgm.sql('DROP FUNCTION IF EXISTS update_updated_at_column');
  pgm.dropTable('game_settings');
};
