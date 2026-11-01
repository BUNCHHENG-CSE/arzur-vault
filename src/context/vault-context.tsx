"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { saveVaultVerifier } from "@/actions/vault-actions";
import {
  createVerifier,
  decryptVaultPayload,
  encryptVaultPayload,
  verifyMasterPassphrase,
} from "@/lib/crypto";
import type { EncryptedPayload, VaultVerifierStatus } from "@/types/vault";

interface VaultContextValue {
  isVaultConfigured: boolean;
  isVaultUnlocked: boolean;
  isDuressMode: boolean;
  masterPassphrase: string | null;
  autoLockTimeoutMs: number;
  setAutoLockTimeoutMs: (ms: number) => void;
  setUpdatedVerifier: (status: VaultVerifierStatus) => void;
  unlockVault: (passphrase: string) => Promise<boolean>;
  setupMasterVault: (passphrase: string) => Promise<void>;
  lockVault: (reason?: "manual" | "inactivity") => void;
  encryptPayload: <T>(payload: T) => Promise<EncryptedPayload>;
  decryptPayload: <T>(encrypted: EncryptedPayload) => Promise<T>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

interface VaultProviderProps {
  initialVerifier: VaultVerifierStatus;
  children: React.ReactNode;
}

export function VaultProvider({
  initialVerifier,
  children,
}: VaultProviderProps) {
  // Master passphrase lives strictly in volatile React memory — NEVER persisted to storage or cookies.
  const [masterPassphrase, setMasterPassphrase] = useState<string | null>(null);
  const [isDuressMode, setIsDuressMode] = useState<boolean>(false);
  const [updatedVerifier, setUpdatedVerifier] =
    useState<VaultVerifierStatus | null>(null);
  const [autoLockTimeoutMs, setAutoLockTimeoutState] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("arzur_vault_autolock_ms");
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return 5 * 60 * 1000;
  });

  const setAutoLockTimeoutMs = useCallback((ms: number) => {
    setAutoLockTimeoutState(ms);
    if (typeof window !== "undefined") {
      localStorage.setItem("arzur_vault_autolock_ms", ms.toString());
    }
  }, []);

  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const verifier = updatedVerifier ?? initialVerifier;

  const isVaultConfigured = Boolean(
    verifier.isConfigured &&
      verifier.vaultVerifierCipher &&
      verifier.vaultVerifierIv &&
      verifier.vaultVerifierSalt
  );

  const isVaultUnlocked = Boolean(masterPassphrase);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const lockVault = useCallback(
    (reason: "manual" | "inactivity" = "manual") => {
      clearInactivityTimer();
      setIsDuressMode(false);
      setMasterPassphrase((prev) => {
        if (prev !== null) {
          if (reason === "inactivity") {
            toast.warning(
              "ArzurVault auto-locked after 5 minutes of inactivity."
            );
          } else {
            toast.info("Vault locked — Master key wiped from memory.");
          }
        }
        return null;
      });
    },
    [clearInactivityTimer]
  );

  const resetInactivityTimer = useCallback(() => {
    clearInactivityTimer();
    if (!masterPassphrase || autoLockTimeoutMs <= 0) return;

    inactivityTimerRef.current = setTimeout(() => {
      lockVault("inactivity");
    }, autoLockTimeoutMs);
  }, [clearInactivityTimer, lockVault, masterPassphrase, autoLockTimeoutMs]);

  // Monitor user activity to reset the 5-minute auto-lock timer
  useEffect(() => {
    if (!masterPassphrase) {
      clearInactivityTimer();
      return;
    }

    resetInactivityTimer();

    let lastReset = Date.now();
    const handleActivity = () => {
      const now = Date.now();
      // Throttle timer resets to once per second to avoid event storms on mousemove
      if (now - lastReset >= 1000) {
        lastReset = now;
        resetInactivityTimer();
      }
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "keydown",
      "mousedown",
      "touchstart",
    ];

    for (const eventName of events) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }

    return () => {
      for (const eventName of events) {
        window.removeEventListener(eventName, handleActivity);
      }
      clearInactivityTimer();
    };
  }, [masterPassphrase, resetInactivityTimer, clearInactivityTimer]);

  // Keyboard shortcut: Ctrl+Shift+L (or Cmd+Shift+L) to lock immediately
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "l"
      ) {
        event.preventDefault();
        if (masterPassphrase) {
          lockVault("manual");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [masterPassphrase, lockVault]);

  const unlockVault = useCallback(
    async (passphrase: string): Promise<boolean> => {
      if (
        !verifier.vaultVerifierCipher ||
        !verifier.vaultVerifierIv ||
        !verifier.vaultVerifierSalt
      ) {
        return false;
      }

      // 1. Check primary master passphrase
      const isValid = await verifyMasterPassphrase(
        {
          ciphertext: verifier.vaultVerifierCipher,
          iv: verifier.vaultVerifierIv,
          salt: verifier.vaultVerifierSalt,
        },
        passphrase
      );

      if (isValid) {
        setIsDuressMode(false);
        setMasterPassphrase(passphrase);
        return true;
      }

      // 2. Check Duress / Decoy passphrase if duress mode is enabled
      if (
        verifier.duressEnabled &&
        verifier.duressVerifierCipher &&
        verifier.duressVerifierIv &&
        verifier.duressVerifierSalt
      ) {
        const isDuressValid = await verifyMasterPassphrase(
          {
            ciphertext: verifier.duressVerifierCipher,
            iv: verifier.duressVerifierIv,
            salt: verifier.duressVerifierSalt,
          },
          passphrase
        );

        if (isDuressValid) {
          setIsDuressMode(true);
          setMasterPassphrase(passphrase);
          return true;
        }
      }

      return false;
    },
    [verifier]
  );

  const setupMasterVault = useCallback(async (passphrase: string) => {
    const encryptedVerifier = await createVerifier(passphrase);
    const savedStatus = await saveVaultVerifier(encryptedVerifier);
    setUpdatedVerifier(savedStatus);
    setMasterPassphrase(passphrase);
  }, []);

  const encryptPayload = useCallback(
    async <T,>(payload: T): Promise<EncryptedPayload> => {
      if (!masterPassphrase) {
        throw new Error("Vault is locked. Unlock before encrypting items.");
      }
      return encryptVaultPayload(payload, masterPassphrase);
    },
    [masterPassphrase]
  );

  const decryptPayload = useCallback(
    async <T,>(encrypted: EncryptedPayload): Promise<T> => {
      if (!masterPassphrase) {
        throw new Error("Vault is locked. Unlock before decrypting items.");
      }
      return decryptVaultPayload<T>(encrypted, masterPassphrase);
    },
    [masterPassphrase]
  );

  const value = useMemo<VaultContextValue>(
    () => ({
      isVaultConfigured,
      isVaultUnlocked,
      isDuressMode,
      masterPassphrase,
      autoLockTimeoutMs,
      setAutoLockTimeoutMs,
      setUpdatedVerifier,
      unlockVault,
      setupMasterVault,
      lockVault,
      encryptPayload,
      decryptPayload,
    }),
    [
      isVaultConfigured,
      isVaultUnlocked,
      isDuressMode,
      masterPassphrase,
      autoLockTimeoutMs,
      setAutoLockTimeoutMs,
      setUpdatedVerifier,
      unlockVault,
      setupMasterVault,
      lockVault,
      encryptPayload,
      decryptPayload,
    ]
  );

  return (
    <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
  );
}

export function useOptionalVault(): VaultContextValue | null {
  return useContext(VaultContext);
}

export function useVault(): VaultContextValue {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error("useVault must be used within a VaultProvider.");
  }
  return context;
}
