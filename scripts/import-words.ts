/**
 * Word Import Script
 *
 * This script imports word data from puzzle_candidates.json and valid_guesses.json
 * into the allowed_words table.
 *
 * Usage: npm run import:words
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

const { Pool } = pg;

interface WordRecord {
  word: string;
  language: string;
  is_daily_answer: boolean;
  popularity_score: number;
}

async function importWords() {
  console.log('🚀 Starting word import process...\n');

  // Create database connection
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'password'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || 'wordle'}`,
  });

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');

    // Read JSON files
    const puzzleCandidatesPath = join(__dirname, '..', 'puzzle_candidates.json');
    const validGuessesPath = join(__dirname, '..', 'valid_guesses.json');

    console.log('📖 Reading word files...');
    const puzzleCandidates: string[] = JSON.parse(readFileSync(puzzleCandidatesPath, 'utf-8'));
    const validGuesses: string[] = JSON.parse(readFileSync(validGuessesPath, 'utf-8'));

    console.log(`   - Puzzle candidates: ${puzzleCandidates.length} words`);
    console.log(`   - Valid guesses: ${validGuesses.length} words\n`);

    // Prepare word records
    const wordRecords: WordRecord[] = [];

    // Process puzzle candidates (high popularity words that can be answers)
    puzzleCandidates.forEach((word, index) => {
      // Normalize to lowercase
      const normalizedWord = word.toLowerCase().trim();

      // Skip if not exactly 5 letters
      if (normalizedWord.length !== 5) {
        console.warn(`⚠️  Skipping invalid word: "${word}" (length: ${normalizedWord.length})`);
        return;
      }

      // Calculate popularity score (0-100 based on position in list)
      // Words at the beginning of the list are more popular
      const popularityScore = Math.round((1 - index / puzzleCandidates.length) * 100 * 100) / 100;

      wordRecords.push({
        word: normalizedWord,
        language: 'en',
        is_daily_answer: true, // These can be used as puzzle answers
        popularity_score: popularityScore,
      });
    });

    // Process valid guesses (can only be used for guessing, not as answers)
    validGuesses.forEach((word) => {
      const normalizedWord = word.toLowerCase().trim();

      // Skip if not exactly 5 letters
      if (normalizedWord.length !== 5) {
        console.warn(`⚠️  Skipping invalid word: "${word}" (length: ${normalizedWord.length})`);
        return;
      }

      // Skip if already in puzzle candidates (avoid duplicates)
      const isDuplicate = wordRecords.some((r) => r.word === normalizedWord);
      if (isDuplicate) {
        return;
      }

      // Lower popularity score for guess-only words
      wordRecords.push({
        word: normalizedWord,
        language: 'en',
        is_daily_answer: false, // Guess-only words
        popularity_score: 0,
      });
    });

    console.log(`📊 Prepared ${wordRecords.length} unique words for import\n`);

    // Clear existing data
    console.log('🗑️  Clearing existing word data...');
    await pool.query('DELETE FROM allowed_words');
    console.log('✅ Existing data cleared\n');

    // Batch insert (500 words at a time for efficiency)
    const batchSize = 500;
    let insertedCount = 0;

    console.log('💾 Inserting words into database...');

    for (let i = 0; i < wordRecords.length; i += batchSize) {
      const batch = wordRecords.slice(i, i + batchSize);

      // Build VALUES clause
      const values: any[] = [];
      const placeholders = batch
        .map((record, index) => {
          const offset = index * 4;
          values.push(record.word, record.language, record.is_daily_answer, record.popularity_score);
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
        })
        .join(', ');

      const query = `
        INSERT INTO allowed_words (word, language, is_daily_answer, popularity_score)
        VALUES ${placeholders}
        ON CONFLICT (word) DO UPDATE SET
          language = EXCLUDED.language,
          is_daily_answer = EXCLUDED.is_daily_answer,
          popularity_score = EXCLUDED.popularity_score
      `;

      await pool.query(query, values);
      insertedCount += batch.length;

      process.stdout.write(`\r   Progress: ${insertedCount} / ${wordRecords.length}`);
    }

    console.log('\n✅ All words inserted successfully!\n');

    // Display statistics
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_words,
        COUNT(*) FILTER (WHERE is_daily_answer = true) as answer_candidates,
        COUNT(*) FILTER (WHERE is_daily_answer = false) as guess_only,
        ROUND(AVG(popularity_score), 2) as avg_popularity
      FROM allowed_words
    `);

    console.log('📊 Import Statistics:');
    console.log(`   Total words: ${stats.rows[0].total_words}`);
    console.log(`   Answer candidates: ${stats.rows[0].answer_candidates}`);
    console.log(`   Guess-only words: ${stats.rows[0].guess_only}`);
    console.log(`   Average popularity score: ${stats.rows[0].avg_popularity}\n`);

    console.log('✨ Word import completed successfully!\n');
  } catch (error) {
    console.error('❌ Error during word import:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the import
importWords();
