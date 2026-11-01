/**
 * BIP-39 Mnemonic Seed Phrase Utilities & Backup Verification Quiz
 */

export interface BIP39ValidationResult {
  isValid: boolean;
  wordCount: number;
  invalidWords: { index: number; word: string }[];
  errorMessage?: string;
}

/**
 * Validates word count and formatting for BIP-39 recovery phrases.
 */
export function validateBIP39Mnemonic(words: string[]): BIP39ValidationResult {
  const cleaned = words.map((w) => w.trim().toLowerCase());
  const invalidWords: { index: number; word: string }[] = [];

  cleaned.forEach((word, idx) => {
    if (!word || !/^[a-z]+$/.test(word)) {
      invalidWords.push({ index: idx + 1, word });
    }
  });

  const validLengths = [12, 15, 18, 21, 24];
  const count = cleaned.length;

  if (!validLengths.includes(count)) {
    return {
      isValid: false,
      wordCount: count,
      invalidWords,
      errorMessage: `Expected 12 or 24 words, but got ${count}.`,
    };
  }

  if (invalidWords.length > 0) {
    return {
      isValid: false,
      wordCount: count,
      invalidWords,
      errorMessage: `${invalidWords.length} invalid word(s) detected.`,
    };
  }

  return {
    isValid: true,
    wordCount: count,
    invalidWords: [],
  };
}

/**
 * Generates 3 random challenge indices (1-based) to verify the user has accurately saved their seed phrase.
 */
export function generateSeedChallenge(totalWords: number): number[] {
  const indices: Set<number> = new Set();
  const max = Math.min(totalWords, 24);

  while (indices.size < Math.min(3, max)) {
    const randomIdx = Math.floor(Math.random() * max) + 1;
    indices.add(randomIdx);
  }

  return Array.from(indices).sort((a, b) => a - b);
}
