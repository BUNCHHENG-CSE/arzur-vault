/**
 * Dynamic PIN Validator & Security Rules Engine
 * Implements security rules such as preventing sequential numbers (simple/reverse order)
 * and preventing repeated digits (> 2 occurrences).
 */

export interface PinValidationResult {
  isValid: boolean;
  isComplete: boolean;
  errors: string[];
  isSimpleOrder: boolean;
  isReverseOrder: boolean;
  hasOverusedDigits: boolean;
  overusedDigits: { digit: string; count: number }[];
  isAllSame: boolean;
}

/**
 * Checks if a numeric string is in ascending simple sequential order (e.g. 123456, 0123, 3456)
 */
export function isSimpleSequential(digits: string): boolean {
  if (digits.length < 3) return false;
  for (let i = 0; i < digits.length - 1; i++) {
    const current = Number.parseInt(digits[i], 10);
    const next = Number.parseInt(digits[i + 1], 10);
    if (next !== current + 1) {
      return false;
    }
  }
  return true;
}

/**
 * Checks if a numeric string is in descending reverse sequential order (e.g. 987654, 4321, 6543)
 */
export function isReverseSequential(digits: string): boolean {
  if (digits.length < 3) return false;
  for (let i = 0; i < digits.length - 1; i++) {
    const current = Number.parseInt(digits[i], 10);
    const next = Number.parseInt(digits[i + 1], 10);
    if (next !== current - 1) {
      return false;
    }
  }
  return true;
}

/**
 * Validates a PIN against banking / fintech security constraints:
 * 1. Must match target length (e.g. 4 or 6 digits)
 * 2. Cannot be in simple order (e.g. 123456)
 * 3. Cannot be in reverse order (e.g. 987654)
 * 4. The same number cannot appear more than 2 times
 */
export function validateDynamicPin(
  pin: string,
  targetLength: number = 6
): PinValidationResult {
  const cleanPin = pin.replace(/\D/g, "");
  const isComplete = cleanPin.length === targetLength;
  const errors: string[] = [];

  // Check simple sequential order (e.g. 123456)
  const isSimpleOrder = cleanPin.length >= 3 && isSimpleSequential(cleanPin);
  if (isSimpleOrder && isComplete) {
    errors.push("PIN cannot be in simple sequential order (e.g. 123456).");
  }

  // Check reverse sequential order (e.g. 987654)
  const isReverseOrder = cleanPin.length >= 3 && isReverseSequential(cleanPin);
  if (isReverseOrder && isComplete) {
    errors.push("PIN cannot be in reverse sequential order (e.g. 987654).");
  }

  // Count digit frequencies
  const counts: Record<string, number> = {};
  for (const char of cleanPin) {
    counts[char] = (counts[char] || 0) + 1;
  }

  const overusedDigits: { digit: string; count: number }[] = [];
  for (const [digit, count] of Object.entries(counts)) {
    if (count > 2) {
      overusedDigits.push({ digit, count });
    }
  }

  const hasOverusedDigits = overusedDigits.length > 0;
  if (hasOverusedDigits) {
    const overusedStr = overusedDigits
      .map((item) => `Number '${item.digit}' (${item.count}×)`)
      .join(", ");
    errors.push(`The same number cannot appear more than 2 times (${overusedStr}).`);
  }

  // All identical digits check (e.g. 111111)
  const isAllSame =
    cleanPin.length >= 3 &&
    cleanPin.split("").every((d) => d === cleanPin[0]);

  const isValid =
    isComplete &&
    !isSimpleOrder &&
    !isReverseOrder &&
    !hasOverusedDigits &&
    !isAllSame;

  return {
    isValid,
    isComplete,
    errors,
    isSimpleOrder,
    isReverseOrder,
    hasOverusedDigits,
    overusedDigits,
    isAllSame,
  };
}

/**
 * Generates a randomized keypad layout (0-9 scrambled)
 */
export function generateScrambledKeypad(): number[] {
  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  return digits;
}
