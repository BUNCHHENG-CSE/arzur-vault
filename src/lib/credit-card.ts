import type { CardBrand } from "@/types/vault";

/**
 * Validates a credit card number using Luhn's algorithm (Mod 10).
 */
export function validateLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Detects card brand based on BIN / IIN ranges.
 */
export function detectCardBrand(cardNumber: string): CardBrand {
  const digits = cardNumber.replace(/\D/g, "");

  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "American Express";
  if (/^(6011|65|64[4-9]|622)/.test(digits)) return "Discover";
  if (/^35(2[89]|[3-8][0-9])/.test(digits)) return "JCB";
  if (/^(30[0-5]|36|38)/.test(digits)) return "Diners Club";
  if (/^62/.test(digits)) return "UnionPay";

  return "Other";
}

/**
 * Formats credit card number into groups with spaces.
 */
export function formatCardNumber(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, "").slice(0, 19);
  const brand = detectCardBrand(digits);

  // Amex format: 4 - 6 - 5
  if (brand === "American Express") {
    const parts = [
      digits.slice(0, 4),
      digits.slice(4, 10),
      digits.slice(10, 15),
    ].filter(Boolean);
    return parts.join(" ");
  }

  // Standard 4 - 4 - 4 - 4
  const parts = digits.match(/[\s\S]{1,4}/g) || [];
  return parts.join(" ");
}

/**
 * Masks credit card number for safe display, showing only last 4 digits.
 */
export function maskCardNumber(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 4) return "•••• •••• •••• ••••";
  const last4 = digits.slice(-4);
  return `•••• •••• •••• ${last4}`;
}
