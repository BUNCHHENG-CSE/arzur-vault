import {
  arrayBufferToBase64,
  base64ToUint8Array,
} from "@/lib/crypto";

export interface EncryptedSendPayload {
  ciphertext: string;
  iv: string;
  keyFragment: string;
  passwordSalt?: string;
}

/**
 * Encrypts a message or secret payload for ephemeral zero-knowledge sharing.
 * The encryption key is returned as a URL hash fragment string.
 */
export async function encryptForSend(
  plaintext: string,
  optionalPassword?: string
): Promise<EncryptedSendPayload> {
  const encoder = new TextEncoder();
  const rawData = encoder.encode(plaintext);

  // 1. Generate 256-bit random AES-GCM key
  const randomKeyBytes = window.crypto.getRandomValues(new Uint8Array(32));
  const hashKeyFragment = arrayBufferToBase64(randomKeyBytes.buffer as ArrayBuffer)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    randomKeyBytes.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    baseKey,
    rawData
  );

  let finalCiphertext = arrayBufferToBase64(encryptedBuffer);
  let finalIv = arrayBufferToBase64(iv.buffer as ArrayBuffer);
  let passwordSalt: string | undefined = undefined;

  // 2. If password protected, layer password encryption
  if (optionalPassword && optionalPassword.trim()) {
    const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
    passwordSalt = arrayBufferToBase64(saltBytes.buffer as ArrayBuffer);

    const passKeyBytes = encoder.encode(optionalPassword.trim());
    const passImport = await window.crypto.subtle.importKey(
      "raw",
      passKeyBytes,
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: saltBytes,
        iterations: 150_000,
        hash: "SHA-256",
      },
      passImport,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );

    const outerIv = window.crypto.getRandomValues(new Uint8Array(12));
    const outerBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: outerIv, tagLength: 128 },
      derivedKey,
      new TextEncoder().encode(finalCiphertext)
    );

    finalCiphertext = arrayBufferToBase64(outerBuffer);
    finalIv = arrayBufferToBase64(outerIv.buffer as ArrayBuffer);
  }

  return {
    ciphertext: finalCiphertext,
    iv: finalIv,
    keyFragment: hashKeyFragment,
    passwordSalt,
  };
}

/**
 * Decrypts an ephemeral send payload using the key fragment from the URL hash.
 */
export async function decryptFromSend(
  ciphertext: string,
  iv: string,
  keyFragment: string,
  password?: string,
  passwordSalt?: string | null
): Promise<string> {
  const decoder = new TextDecoder();
  let innerCiphertext = ciphertext;

  // 1. If password protected, decrypt outer layer first
  if (passwordSalt) {
    if (!password) {
      throw new Error("Password required to unlock this secret.");
    }

    const saltBytes = base64ToUint8Array(passwordSalt);
    const passKeyBytes = new TextEncoder().encode(password.trim());
    const passImport = await window.crypto.subtle.importKey(
      "raw",
      passKeyBytes,
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: saltBytes,
        iterations: 150_000,
        hash: "SHA-256",
      },
      passImport,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    const outerIvBytes = base64ToUint8Array(iv);
    const outerCipherBytes = base64ToUint8Array(ciphertext);

    const decryptedOuter = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: outerIvBytes, tagLength: 128 },
      derivedKey,
      outerCipherBytes
    );

    innerCiphertext = decoder.decode(decryptedOuter);
  }

  // 2. Decode key fragment from URL-safe base64
  let base64 = keyFragment.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }

  const keyBytes = base64ToUint8Array(base64);
  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const ivBytes = base64ToUint8Array(iv);
  const cipherBytes = base64ToUint8Array(innerCiphertext);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes, tagLength: 128 },
    cryptoKey,
    cipherBytes
  );

  return decoder.decode(decryptedBuffer);
}
