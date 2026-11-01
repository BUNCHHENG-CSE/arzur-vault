import {
  encryptVaultPayload,
  decryptVaultPayload,
} from "./crypto";

const PIN_STORAGE_PREFIX = "arzur_vault_pin_";

export interface StoredPinCredential {
  wrappedPassphraseCipher: string;
  wrappedPassphraseIv: string;
  wrappedPassphraseSalt: string;
  pinLength: number;
  enrolledAt: string;
}

/**
 * Checks if the user has enrolled a Quick Unlock PIN
 */
export function getPinEnrollment(userEmail: string): StoredPinCredential | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(`${PIN_STORAGE_PREFIX}${userEmail}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredPinCredential;
  } catch {
    return null;
  }
}

/**
 * Removes the stored Quick Unlock PIN
 */
export function removePinEnrollment(userEmail: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${PIN_STORAGE_PREFIX}${userEmail}`);
}

/**
 * Enrolls a Quick Unlock PIN by encrypting the Master Passphrase using the PIN.
 */
export async function enrollQuickPin(params: {
  userEmail: string;
  pin: string;
  masterPassphrase: string;
}): Promise<StoredPinCredential> {
  if (typeof window === "undefined") {
    throw new Error("Window environment required for PIN storage.");
  }

  // Encrypt the master passphrase using the user's PIN as secret key
  const wrapped = await encryptVaultPayload(
    { masterPassphrase: params.masterPassphrase },
    params.pin
  );

  const cred: StoredPinCredential = {
    wrappedPassphraseCipher: wrapped.ciphertext,
    wrappedPassphraseIv: wrapped.iv,
    wrappedPassphraseSalt: wrapped.salt,
    pinLength: params.pin.length,
    enrolledAt: new Date().toISOString(),
  };

  localStorage.setItem(
    `${PIN_STORAGE_PREFIX}${params.userEmail}`,
    JSON.stringify(cred)
  );

  return cred;
}

/**
 * Unwraps and returns the Master Passphrase using the entered PIN.
 */
export async function unlockWithQuickPin(
  userEmail: string,
  enteredPin: string
): Promise<string> {
  const enrollment = getPinEnrollment(userEmail);
  if (!enrollment) {
    throw new Error("No Quick Unlock PIN enrolled for this user.");
  }

  try {
    const payload = await decryptVaultPayload<{ masterPassphrase: string }>(
      {
        ciphertext: enrollment.wrappedPassphraseCipher,
        iv: enrollment.wrappedPassphraseIv,
        salt: enrollment.wrappedPassphraseSalt,
      },
      enteredPin
    );

    if (!payload?.masterPassphrase) {
      throw new Error("Invalid decrypted master passphrase.");
    }

    return payload.masterPassphrase;
  } catch (err) {
    console.error("PIN unlock error:", err);
    throw new Error("Incorrect PIN. Decryption failed.");
  }
}
