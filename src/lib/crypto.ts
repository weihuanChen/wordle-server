/**
 * Cryptography utilities for encrypting/decrypting puzzle answers
 *
 * Uses AES-256-CBC encryption with date-based salt to prevent
 * users from viewing answers in browser DevTools.
 */

import CryptoJS from 'crypto-js';

/**
 * Generate a salt string based on date and game type
 *
 * @param date - Date string in YYYY-MM-DD format
 * @param gameType - Game type (octordle, wordle, etc.)
 * @param language - Language code
 * @returns Salt string
 */
export function generateSalt(date: string, gameType: string, language: string): string {
  return `${date}-${gameType}-${language}`;
}

/**
 * Generate encryption key from salt
 *
 * This uses a secret key from environment + the salt to create a unique key per day/game.
 * The secret key prevents brute-force attacks even if the salt is known.
 *
 * @param salt - Salt string
 * @returns Encryption key
 */
export function generateEncryptionKey(salt: string): string {
  const secretKey = process.env.ENCRYPTION_SECRET || 'default-secret-change-me-in-production';
  return CryptoJS.SHA256(secretKey + salt).toString();
}

/**
 * Encrypt an array of answer words
 *
 * @param answers - Array of answer words
 * @param salt - Salt string (date-based)
 * @returns Encrypted string
 */
export function encryptAnswers(answers: string[], salt: string): string {
  const plaintext = JSON.stringify(answers);
  const key = generateEncryptionKey(salt);
  const encrypted = CryptoJS.AES.encrypt(plaintext, key).toString();
  return encrypted;
}

/**
 * Decrypt answer words
 *
 * This function is used by the client (must use same logic).
 * The client needs to know:
 * 1. The date (from API response)
 * 2. The game type (from API request)
 * 3. The language (from API request)
 * 4. The encryption secret (shared secret between client and server)
 *
 * @param encryptedData - Encrypted string
 * @param salt - Salt string (same as used for encryption)
 * @returns Decrypted array of words
 */
export function decryptAnswers(encryptedData: string, salt: string): string[] {
  try {
    const key = generateEncryptionKey(salt);
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
    return JSON.parse(plaintext);
  } catch (error) {
    throw new Error('Failed to decrypt answers. Invalid salt or corrupted data.');
  }
}

/**
 * Verify that decryption works (for testing)
 *
 * @param encrypted - Encrypted data
 * @param original - Original answer array
 * @param salt - Salt used for encryption
 * @returns True if decryption matches original
 */
export function verifyEncryption(encrypted: string, original: string[], salt: string): boolean {
  try {
    const decrypted = decryptAnswers(encrypted, salt);
    return JSON.stringify(decrypted) === JSON.stringify(original);
  } catch {
    return false;
  }
}
