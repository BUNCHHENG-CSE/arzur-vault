/**
 * Arzur Pay PIN Feature
 * Provides zero-knowledge storage and authorization verification for Pay PIN transactions.
 */

const PAY_PIN_STORAGE_PREFIX = "arzur_vault_pay_pin_";

export interface StoredPayPin {
  pinHash: string; // SHA-256 hash of pin + salt
  salt: string;
  pinLength: number;
  createdAt: string;
  lastAuthorizedAt?: string;
}

function getBrowserCrypto(): Crypto {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Web Crypto API required for Pay PIN.");
  }
  return window.crypto;
}

/**
 * Computes a secure SHA-256 hash of (pin + salt)
 */
async function hashPin(pin: string, salt: string): Promise<string> {
  const crypto = getBrowserCrypto();
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${pin}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Checks if a Pay PIN is configured for the given user
 */
export function getStoredPayPin(userEmail: string): StoredPayPin | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(`${PAY_PIN_STORAGE_PREFIX}${userEmail}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredPayPin;
  } catch {
    return null;
  }
}

/**
 * Saves a new Pay PIN
 */
export async function setPayPin(
  userEmail: string,
  pin: string
): Promise<StoredPayPin> {
  const crypto = getBrowserCrypto();
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = Array.from(saltBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const pinHash = await hashPin(pin, salt);

  const record: StoredPayPin = {
    pinHash,
    salt,
    pinLength: pin.length,
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(
    `${PAY_PIN_STORAGE_PREFIX}${userEmail}`,
    JSON.stringify(record)
  );

  return record;
}

/**
 * Verifies an entered PIN against the stored Pay PIN for authorization
 */
export async function verifyPayPin(
  userEmail: string,
  enteredPin: string
): Promise<boolean> {
  const stored = getStoredPayPin(userEmail);
  if (!stored) {
    throw new Error("No Pay PIN configured.");
  }

  const computedHash = await hashPin(enteredPin, stored.salt);
  const isValid = computedHash === stored.pinHash;

  if (isValid) {
    stored.lastAuthorizedAt = new Date().toISOString();
    localStorage.setItem(
      `${PAY_PIN_STORAGE_PREFIX}${userEmail}`,
      JSON.stringify(stored)
    );
  }

  return isValid;
}

/**
 * Removes the Pay PIN
 */
export function removePayPin(userEmail: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${PAY_PIN_STORAGE_PREFIX}${userEmail}`);
}
