import type { EncryptedPayload } from "@/types/vault";

const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTE_LENGTH = 16;
const IV_BYTE_LENGTH = 12;
const AES_KEY_LENGTH = 256;
const VERIFIER_MAGIC_VALUE = "ARZUR_VAULT_VERIFIED_OK" as const;

interface VerifierPayload {
  check: string;
}

export class InvalidMasterPassphraseError extends Error {
  constructor(
    message = "Invalid Master Passphrase. Unable to authenticate encrypted payload."
  ) {
    super(message);
    this.name = "InvalidMasterPassphraseError";
  }
}

function getBrowserCrypto(): Crypto {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error(
      "Web Crypto API (window.crypto.subtle) is strictly required and must run in a secure browser context."
    );
  }
  return window.crypto;
}

/**
 * Encodes an ArrayBuffer into a Base64 string without stack overflow on large payloads.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/**
 * Decodes a Base64 string into a Uint8Array backed by a standard ArrayBuffer.
 */
export function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derives a non-extractable 256-bit AES-GCM key from a Master Passphrase and 16-byte salt
 * using PBKDF2-HMAC-SHA256 with 310,000 iterations.
 */
export async function deriveKey(
  masterPassphrase: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
  const webCrypto = getBrowserCrypto();
  const encoder = new TextEncoder();
  const encodedPassphrase = encoder.encode(masterPassphrase);
  const keyBuffer = new ArrayBuffer(encodedPassphrase.byteLength);
  const keyBytes = new Uint8Array(keyBuffer);
  keyBytes.set(encodedPassphrase);

  const baseKey = await webCrypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return webCrypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    {
      name: "AES-GCM",
      length: AES_KEY_LENGTH,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a structured payload client-side using AES-256-GCM with fresh random 16B salt and 12B IV.
 */
export async function encryptVaultPayload<T>(
  payload: T,
  masterPassphrase: string
): Promise<EncryptedPayload> {
  if (!masterPassphrase) {
    throw new Error("Master passphrase is required for encryption.");
  }

  const webCrypto = getBrowserCrypto();
  const salt = new Uint8Array(new ArrayBuffer(SALT_BYTE_LENGTH));
  const iv = new Uint8Array(new ArrayBuffer(IV_BYTE_LENGTH));
  webCrypto.getRandomValues(salt);
  webCrypto.getRandomValues(iv);

  const key = await deriveKey(masterPassphrase, salt);
  const encoder = new TextEncoder();
  const rawBytes = encoder.encode(JSON.stringify(payload));
  const plaintextBuffer = new ArrayBuffer(rawBytes.byteLength);
  new Uint8Array(plaintextBuffer).set(rawBytes);

  const encryptedBuffer = await webCrypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      tagLength: 128,
    },
    key,
    plaintextBuffer
  );

  return {
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(iv.buffer),
    salt: arrayBufferToBase64(salt.buffer),
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload client-side.
 * Throws InvalidMasterPassphraseError if GCM authentication tag verification fails.
 */
export async function decryptVaultPayload<T>(
  encrypted: EncryptedPayload,
  masterPassphrase: string
): Promise<T> {
  if (!masterPassphrase) {
    throw new InvalidMasterPassphraseError("Vault is locked.");
  }

  const webCrypto = getBrowserCrypto();

  try {
    const salt = base64ToUint8Array(encrypted.salt);
    const iv = base64ToUint8Array(encrypted.iv);
    const ciphertextBytes = base64ToUint8Array(encrypted.ciphertext);

    const key = await deriveKey(masterPassphrase, salt);
    const decryptedBuffer = await webCrypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        tagLength: 128,
      },
      key,
      ciphertextBytes
    );

    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedBuffer);
    return JSON.parse(jsonString) as T;
  } catch {
    throw new InvalidMasterPassphraseError();
  }
}

/**
 * Creates a zero-knowledge Master Passphrase verifier ciphertext.
 */
export async function createVerifier(
  masterPassphrase: string
): Promise<EncryptedPayload> {
  const payload: VerifierPayload = { check: VERIFIER_MAGIC_VALUE };
  return encryptVaultPayload(payload, masterPassphrase);
}

/**
 * Verifies whether a candidate Master Passphrase can decrypt and authenticate the stored verifier.
 */
export async function verifyMasterPassphrase(
  verifier: EncryptedPayload,
  masterPassphrase: string
): Promise<boolean> {
  try {
    const result = await decryptVaultPayload<VerifierPayload>(
      verifier,
      masterPassphrase
    );
    return result?.check === VERIFIER_MAGIC_VALUE;
  } catch {
    return false;
  }
}

export interface PasswordGeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
}

export interface PasswordStrengthInfo {
  bits: number;
  label: "Weak" | "Fair" | "Strong" | "Fortress";
  colorClass: string;
  barPercent: number;
}

const CHARSETS = {
  uppercase: "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz".slice(0, 24)
    ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    : "",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{}|;:,.<>?",
} as const;

function secureRandomIndex(maxExclusive: number, webCrypto: Crypto): number {
  if (maxExclusive <= 1) return 0;
  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - ((maxUint32 + 1) % maxExclusive);
  const rand = new Uint32Array(new ArrayBuffer(4));

  let value = 0;
  do {
    webCrypto.getRandomValues(rand);
    value = rand[0];
  } while (value >= limit);

  return value % maxExclusive;
}

/**
 * Cryptographically secure password generator with unbiased rejection sampling
 * and guaranteed inclusion of each selected character class.
 */
export function generateSecurePassword(
  options: PasswordGeneratorOptions
): string {
  const webCrypto = getBrowserCrypto();
  const length = Math.min(64, Math.max(8, Math.floor(options.length)));

  const activePools: string[] = [];
  if (options.uppercase) activePools.push(CHARSETS.uppercase);
  if (options.lowercase) activePools.push(CHARSETS.lowercase);
  if (options.numbers) activePools.push(CHARSETS.numbers);
  if (options.symbols) activePools.push(CHARSETS.symbols);

  if (activePools.length === 0) {
    activePools.push(CHARSETS.lowercase, CHARSETS.numbers);
  }

  const combinedPool = activePools.join("");
  const chars: string[] = [];

  // Guarantee at least one character from each active character set
  for (const pool of activePools) {
    if (chars.length < length) {
      chars.push(pool[secureRandomIndex(pool.length, webCrypto)]);
    }
  }

  // Fill remaining slots from the combined pool
  while (chars.length < length) {
    chars.push(combinedPool[secureRandomIndex(combinedPool.length, webCrypto)]);
  }

  // Cryptographic Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomIndex(i + 1, webCrypto);
    const temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }

  return chars.join("");
}

/**
 * Calculates Shannon/pool entropy bits for a password or generator configuration.
 */
export function calculatePasswordEntropy(
  password: string
): PasswordStrengthInfo {
  if (!password) {
    return {
      bits: 0,
      label: "Weak",
      colorClass: "text-red-600 dark:text-red-400",
      barPercent: 5,
    };
  }

  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;
  if (poolSize === 0) poolSize = 26;

  const bits = Math.round(password.length * Math.log2(poolSize));

  if (bits < 50) {
    return {
      bits,
      label: "Weak",
      colorClass: "text-red-600 dark:text-red-400",
      barPercent: 25,
    };
  }
  if (bits < 75) {
    return {
      bits,
      label: "Fair",
      colorClass: "text-amber-600 dark:text-amber-400",
      barPercent: 55,
    };
  }
  if (bits < 110) {
    return {
      bits,
      label: "Strong",
      colorClass: "text-emerald-600 dark:text-emerald-400",
      barPercent: 82,
    };
  }
  return {
    bits,
    label: "Fortress",
    colorClass: "text-emerald-700 dark:text-emerald-300",
    barPercent: 100,
  };
}
