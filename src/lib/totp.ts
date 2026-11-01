/**
 * Client-Side RFC 6238 TOTP (Time-Based One-Time Password) Generator
 * Powered strictly by standard Web Crypto API (SubtleCrypto HMAC-SHA1).
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Decodes an RFC 4648 Base32 encoded secret into a raw Uint8Array.
 */
export function base32ToUint8Array(base32: string): Uint8Array<ArrayBuffer> {
  const cleaned = base32.toUpperCase().replace(/[\s\-_=]/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned.charAt(i);
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      continue; // Skip invalid or padding characters
    }
    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  const buffer = new ArrayBuffer(output.length);
  const bytes = new Uint8Array(buffer);
  bytes.set(output);
  return bytes;
}

/**
 * Parses an otpauth:// URI or raw secret key.
 */
export function parseTotpInput(raw: string): {
  secret: string;
  issuer?: string;
  account?: string;
  period: number;
  digits: number;
} {
  const trimmed = raw.trim();
  if (trimmed.startsWith("otpauth://")) {
    try {
      const url = new URL(trimmed);
      const secret = url.searchParams.get("secret") || "";
      const issuer = url.searchParams.get("issuer") || undefined;
      const period = parseInt(url.searchParams.get("period") || "30", 10);
      const digits = parseInt(url.searchParams.get("digits") || "6", 10);

      // Label is often 'Issuer:Account' or 'Account'
      const label = decodeURIComponent(url.pathname.replace(/^\/\/totp\//, "").replace(/^\//, ""));
      const account = label.includes(":") ? label.split(":")[1]?.trim() : label;

      return {
        secret: secret.replace(/[\s\-_]/g, ""),
        issuer,
        account,
        period: isNaN(period) || period <= 0 ? 30 : period,
        digits: isNaN(digits) || digits <= 0 ? 6 : digits,
      };
    } catch {
      // If URL parsing fails, fallback to treating as secret
    }
  }

  return {
    secret: trimmed.replace(/[\s\-_]/g, ""),
    period: 30,
    digits: 6,
  };
}

/**
 * Generates the current 6-digit TOTP code and remaining seconds in the current 30s window.
 */
export async function generateTotp(
  secretInput: string,
  timeStep = 30,
  digits = 6
): Promise<{ code: string; formatted: string; remainingSeconds: number } | null> {
  const { secret } = parseTotpInput(secretInput);
  if (!secret) return null;

  try {
    const keyBytes = base32ToUint8Array(secret);
    if (keyBytes.length === 0) return null;

    const epochSeconds = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epochSeconds / timeStep);
    const remainingSeconds = timeStep - (epochSeconds % timeStep);

    // Convert 64-bit integer counter to 8-byte big-endian buffer
    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);
    // In JS numbers are safe up to 2^53 - 1, split into two 32-bit words
    counterView.setUint32(0, Math.floor(counter / 0x100000000), false);
    counterView.setUint32(4, counter & 0xffffffff, false);

    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      keyBytes.buffer as ArrayBuffer,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    );

    const signature = await window.crypto.subtle.sign("HMAC", cryptoKey, counterBuffer);
    const hash = new Uint8Array(signature);

    // Dynamic truncation (RFC 4226 section 5.4)
    const offset = hash[hash.length - 1] & 0x0f;
    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    const modulo = Math.pow(10, digits);
    const codeNumber = binary % modulo;
    const code = codeNumber.toString().padStart(digits, "0");

    // Format as 123 456
    const half = Math.floor(digits / 2);
    const formatted = `${code.slice(0, half)} ${code.slice(half)}`;

    return {
      code,
      formatted,
      remainingSeconds,
    };
  } catch (err) {
    console.error("Failed to generate TOTP code:", err);
    return null;
  }
}
