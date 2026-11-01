import {
  arrayBufferToBase64,
  base64ToUint8Array,
  encryptVaultPayload,
  decryptVaultPayload,
} from "./crypto";

const BIO_STORAGE_PREFIX = "arzur_vault_bio_";

export interface StoredBiometricCredential {
  credentialId: string; // Base64
  wrappedPassphraseCipher: string;
  wrappedPassphraseIv: string;
  wrappedPassphraseSalt: string;
  deviceName: string;
  enrolledAt: string;
}

export async function isPlatformBiometricsAvailable(): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !window.PublicKeyCredential ||
    !navigator.credentials
  ) {
    return false;
  }

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function getBiometricEnrollment(
  userEmail: string
): StoredBiometricCredential | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(`${BIO_STORAGE_PREFIX}${userEmail}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredBiometricCredential;
  } catch {
    return null;
  }
}

export function removeBiometricEnrollment(userEmail: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${BIO_STORAGE_PREFIX}${userEmail}`);
}

/**
 * Register hardware platform authenticator (TouchID / Windows Hello / YubiKey)
 * and wrap the Master Passphrase for instant local zero-knowledge biometric unlock.
 */
export async function enrollBiometrics(params: {
  userEmail: string;
  userName: string;
  masterPassphrase: string;
}): Promise<StoredBiometricCredential> {
  if (typeof window === "undefined" || !navigator.credentials) {
    throw new Error("WebAuthn is not supported in this environment.");
  }

  const challenge = window.crypto.getRandomValues(new Uint8Array(32));
  const userId = new TextEncoder().encode(params.userEmail);

  // Request platform authenticator (Windows Hello, TouchID, FaceID)
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: "ArzurVault Zero-Knowledge",
        id: window.location.hostname === "localhost" ? "localhost" : window.location.hostname,
      },
      user: {
        id: userId,
        name: params.userEmail,
        displayName: params.userName || params.userEmail,
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256
        { alg: -257, type: "public-key" }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("Biometric enrollment cancelled or timed out.");
  }

  const credentialIdBase64 = arrayBufferToBase64(credential.rawId);

  // Client-side wrap the master passphrase with credential key
  const wrapped = await encryptVaultPayload(
    params.masterPassphrase,
    credentialIdBase64 + params.userEmail
  );

  const deviceName = /Macintosh|Mac OS/.test(navigator.userAgent)
    ? "Touch ID / Apple Biometrics"
    : /Windows/.test(navigator.userAgent)
    ? "Windows Hello"
    : /Android/.test(navigator.userAgent)
    ? "Android Biometrics"
    : "Security Key / Biometrics";

  const record: StoredBiometricCredential = {
    credentialId: credentialIdBase64,
    wrappedPassphraseCipher: wrapped.ciphertext,
    wrappedPassphraseIv: wrapped.iv,
    wrappedPassphraseSalt: wrapped.salt,
    deviceName,
    enrolledAt: new Date().toISOString(),
  };

  localStorage.setItem(
    `${BIO_STORAGE_PREFIX}${params.userEmail}`,
    JSON.stringify(record)
  );

  return record;
}

/**
 * Challenge the platform authenticator (TouchID / Windows Hello)
 * and unwrap the Master Passphrase upon successful verification.
 */
export async function unlockWithBiometrics(
  userEmail: string
): Promise<string> {
  const enrollment = getBiometricEnrollment(userEmail);
  if (!enrollment) {
    throw new Error("No biometric authenticator enrolled for this account.");
  }

  const challenge = window.crypto.getRandomValues(new Uint8Array(32));
  const credIdBytes = base64ToUint8Array(enrollment.credentialId);

  // Assertion challenge
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [
        {
          id: credIdBytes,
          type: "public-key",
        },
      ],
      userVerification: "required",
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error("Biometric verification cancelled.");
  }

  // Decrypt master passphrase
  const decryptedPassphrase = await decryptVaultPayload<string>(
    {
      ciphertext: enrollment.wrappedPassphraseCipher,
      iv: enrollment.wrappedPassphraseIv,
      salt: enrollment.wrappedPassphraseSalt,
    },
    enrollment.credentialId + userEmail
  );

  return decryptedPassphrase;
}
