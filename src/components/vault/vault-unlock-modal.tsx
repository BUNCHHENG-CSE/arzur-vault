"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { useVault } from "@/context/vault-context";
import { signOut } from "@/lib/auth-client";
import { calculatePasswordEntropy } from "@/lib/crypto";
import {
  getBiometricEnrollment,
  unlockWithBiometrics,
} from "@/lib/webauthn";
import {
  getPinEnrollment,
  unlockWithQuickPin,
} from "@/lib/pin-unlock";
import { cn } from "@/lib/utils";
import { DynamicPinModal } from "./dynamic-pin-modal";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface VaultUnlockModalProps {
  userEmail: string;
  userName: string;
}

export function VaultUnlockModal({
  userEmail,
  userName,
}: VaultUnlockModalProps) {
  const router = useRouter();
  const {
    isVaultConfigured,
    isVaultUnlocked,
    unlockVault,
    setupMasterVault,
    lockVault,
  } = useVault();

  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [acknowledgedZeroKnowledge, setAcknowledgedZeroKnowledge] =
    useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasBiometrics, setHasBiometrics] = useState<boolean>(() =>
    typeof window !== "undefined" ? Boolean(getBiometricEnrollment(userEmail)) : false
  );
  const [isBioUnlocking, setIsBioUnlocking] = useState<boolean>(false);
  const [hasPin, setHasPin] = useState<boolean>(() =>
    typeof window !== "undefined" ? Boolean(getPinEnrollment(userEmail)) : false
  );
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isPinUnlocking, setIsPinUnlocking] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const timer = setTimeout(() => {
        setHasBiometrics(Boolean(getBiometricEnrollment(userEmail)));
        setHasPin(Boolean(getPinEnrollment(userEmail)));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [userEmail]);

  if (isVaultUnlocked) {
    return null;
  }

  const handlePinUnlock = async (enteredPin: string) => {
    setIsPinUnlocking(true);
    setErrorMessage(null);
    try {
      const unwrappedPassphrase = await unlockWithQuickPin(userEmail, enteredPin);
      const ok = await unlockVault(unwrappedPassphrase);
      if (ok) {
        toast.success("Dynamic PIN verified. Vault unlocked!");
        setIsPinModalOpen(false);
      } else {
        setErrorMessage("PIN verified, but master verifier check failed.");
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "PIN unlock failed or incorrect."
      );
    } finally {
      setIsPinUnlocking(false);
    }
  };

  const handleBiometricUnlock = async () => {
    setIsBioUnlocking(true);
    setErrorMessage(null);
    try {
      const unwrappedPassphrase = await unlockWithBiometrics(userEmail);
      const ok = await unlockVault(unwrappedPassphrase);
      if (ok) {
        toast.success("Biometric authentication verified. Vault unlocked!");
      } else {
        setErrorMessage("Biometric key verified, but master verifier check failed.");
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Biometric unlock failed or cancelled."
      );
    } finally {
      setIsBioUnlocking(false);
    }
  };

  const strength = calculatePasswordEntropy(passphrase);

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (passphrase.length < 10) {
      setErrorMessage(
        "Master Passphrase must be at least 10 characters for PBKDF2-AES-256 security."
      );
      return;
    }

    if (passphrase !== confirmPassphrase) {
      setErrorMessage("Master Passphrase confirmation does not match.");
      return;
    }

    if (!acknowledgedZeroKnowledge) {
      setErrorMessage(
        "Please acknowledge that zero-knowledge master passphrases cannot be recovered."
      );
      return;
    }

    setIsLoading(true);
    try {
      await setupMasterVault(passphrase);
      setPassphrase("");
      setConfirmPassphrase("");
      toast.success("Master Vault Key initialized & unlocked in memory!");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to initialize Master Vault.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!passphrase) {
      setErrorMessage("Enter your Master Vault Passphrase.");
      return;
    }

    setIsLoading(true);
    try {
      const ok = await unlockVault(passphrase);
      if (!ok) {
        setErrorMessage(
          "Invalid Master Passphrase. AES-GCM verifier tag check failed."
        );
        toast.error("Incorrect Master Passphrase.");
        return;
      }

      setPassphrase("");
      toast.success("ArzurVault unlocked. Decryption active in volatile RAM.");
    } catch {
      setErrorMessage("Decryption verification failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    lockVault("manual");
    await signOut();
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/95 p-4 text-foreground backdrop-blur-xl cyber-grid-bg">
      <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>
      <div className="pointer-events-none fixed top-1/4 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/12 dark:bg-emerald-500/10 blur-[120px]" />

      {!isVaultConfigured ? (
        /* ONBOARDING SHIELD: INITIALIZE MASTER KEY */
        <Card className="w-full max-w-lg border-emerald-500/35 bg-card/95 shadow-[0_20px_60px_-15px_rgba(16,185,129,0.2)] dark:shadow-[0_0_60px_-15px_rgba(16,185,129,0.25)]">
          <CardHeader className="space-y-3 border-b border-border pb-5">
            <div className="flex items-center justify-between">
              <Badge
                variant="outline"
                className="border-emerald-500/35 bg-emerald-500/10 font-mono text-[10px] text-emerald-700 dark:text-emerald-300"
              >
                STEP 2 OF 2 • ZERO-KNOWLEDGE KEYCEREMONY
              </Badge>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground transition hover:text-foreground"
              >
                <LogOut className="size-3" />
                Sign out
              </button>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="size-6" />
              </div>
              <div>
                <CardTitle className="font-mono text-lg text-card-foreground">
                  Initialize ArzurVault Master Key
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Operator:{" "}
                  <span className="font-mono font-medium text-foreground">
                    {userEmail}
                  </span>
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <form onSubmit={handleSetupSubmit}>
            <CardContent className="space-y-4 pt-5">
              <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs leading-relaxed text-amber-950 dark:text-amber-200/90">
                <div className="mb-1 flex items-center gap-2 font-mono font-semibold text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="size-4 shrink-0" />
                  CRITICAL ZERO-KNOWLEDGE NOTICE
                </div>
                Your Master Passphrase derives a 256-bit{" "}
                <span className="font-mono font-semibold text-amber-900 dark:text-amber-100">
                  AES-GCM
                </span>{" "}
                key via{" "}
                <span className="font-mono font-semibold text-amber-900 dark:text-amber-100">
                  310,000 PBKDF2-SHA256
                </span>{" "}
                iterations exclusively inside your browser. It is{" "}
                <strong className="underline">
                  never transmitted or stored
                </strong>{" "}
                on our servers and{" "}
                <strong>cannot be recovered if forgotten</strong>.
              </div>

              {errorMessage && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                  {errorMessage}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="setup-master-passphrase"
                    className="text-xs text-foreground/90"
                  >
                    Create Master Vault Passphrase
                  </Label>
                  {passphrase && (
                    <span
                      className={`font-mono text-[11px] font-medium ${strength.colorClass}`}
                    >
                      {strength.label} • {strength.bits} bits
                    </span>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-emerald-600 dark:text-emerald-500" />
                  <Input
                    id="setup-master-passphrase"
                    type={showPassphrase ? "text" : "password"}
                    autoComplete="off"
                    placeholder="Enter a strong, memorable passphrase (min 10 chars)"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    className="bg-background pr-10 pl-9 font-mono focus-visible:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassphrase((v) => !v)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={
                      showPassphrase ? "Hide passphrase" : "Show passphrase"
                    }
                  >
                    {showPassphrase ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                {passphrase && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all duration-300 dark:bg-emerald-500"
                      style={{ width: `${strength.barPercent}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="confirm-master-passphrase"
                  className="text-xs text-foreground/90"
                >
                  Confirm Master Vault Passphrase
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirm-master-passphrase"
                    type={showPassphrase ? "text" : "password"}
                    autoComplete="off"
                    placeholder="Re-enter Master Vault Passphrase"
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                    className="bg-background pl-9 font-mono focus-visible:border-emerald-500"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-muted/45 p-3 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={acknowledgedZeroKnowledge}
                  onChange={(e) =>
                    setAcknowledgedZeroKnowledge(e.target.checked)
                  }
                  className="mt-0.5 size-4 rounded border-border accent-emerald-600 dark:accent-emerald-500"
                />
                <span>
                  I understand that ArzurVault is strictly zero-knowledge and{" "}
                  <strong className="text-foreground">cannot recover</strong> my
                  encrypted passwords or seed phrases if I forget this Master
                  Passphrase.
                </span>
              </label>
            </CardContent>

            <CardFooter className="mt-5 border-t border-border pt-5">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-600 font-mono text-xs font-semibold tracking-wider text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    DERIVING 310,000 PBKDF2 ROUNDS...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4" />
                    INITIALIZE MASTER VAULT KEY
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : (
        /* LOCKED VAULT SHIELD: UNLOCK MASTER VAULT */
        <Card className="w-full max-w-md border-border bg-card/95 shadow-[0_20px_60px_-15px_rgba(16,185,129,0.18)] dark:shadow-[0_0_60px_-15px_rgba(16,185,129,0.2)]">
          <CardHeader className="space-y-3 border-b border-border pb-5">
            <div className="flex items-center justify-between">
              <Badge
                variant="outline"
                className="border-amber-500/35 bg-amber-500/10 font-mono text-[10px] text-amber-700 dark:text-amber-300"
              >
                VAULT LOCKED • RAM CLEARED
              </Badge>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground transition hover:text-foreground"
              >
                <LogOut className="size-3" />
                Switch account
              </button>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ShieldAlert className="size-6" />
              </div>
              <div>
                <CardTitle className="font-mono text-lg text-card-foreground">
                  Unlock ArzurVault
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Signed in as{" "}
                  <span className="font-medium text-foreground">
                    {userName || userEmail}
                  </span>
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <form onSubmit={handleUnlockSubmit}>
            <CardContent className="space-y-4 pt-5">
              {errorMessage && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-700 dark:text-red-300">
                  {errorMessage}
                </div>
              )}

              {(hasBiometrics || hasPin) && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {hasPin && (
                      <Button
                        type="button"
                        onClick={() => setIsPinModalOpen(true)}
                        disabled={isPinUnlocking}
                        variant="outline"
                        className={cn(
                          "w-full gap-2 border-amber-500/40 bg-amber-500/10 py-5 font-mono text-xs font-semibold text-amber-700 hover:bg-amber-500/20 dark:text-amber-300",
                          !hasBiometrics && "sm:col-span-2"
                        )}
                      >
                        {isPinUnlocking ? (
                          <Loader2 className="size-4 animate-spin text-[#FCD535]" />
                        ) : (
                          <Sparkles className="size-4 text-[#FCD535]" />
                        )}
                        Quick Dynamic PIN
                      </Button>
                    )}

                    {hasBiometrics && (
                      <Button
                        type="button"
                        onClick={handleBiometricUnlock}
                        disabled={isBioUnlocking}
                        variant="outline"
                        className={cn(
                          "w-full gap-2 border-emerald-500/40 bg-emerald-500/10 py-5 font-mono text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300",
                          !hasPin && "sm:col-span-2"
                        )}
                      >
                        {isBioUnlocking ? (
                          <Loader2 className="size-4 animate-spin text-emerald-500" />
                        ) : (
                          <Fingerprint className="size-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                        Quick Biometrics
                      </Button>
                    )}
                  </div>

                  <div className="relative flex items-center justify-center">
                    <div className="w-full border-t border-border" />
                    <span className="bg-card px-2 font-mono text-[10px] uppercase text-muted-foreground">
                      or master passphrase
                    </span>
                    <div className="w-full border-t border-border" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label
                  htmlFor="unlock-master-passphrase"
                  className="text-xs text-foreground/90"
                >
                  Master Vault Passphrase
                </Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-emerald-600 dark:text-emerald-400" />
                  <Input
                    id="unlock-master-passphrase"
                    type={showPassphrase ? "text" : "password"}
                    autoFocus
                    autoComplete="off"
                    placeholder="Enter Master Passphrase to decrypt..."
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    className="bg-background pr-10 pl-9 font-mono focus-visible:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassphrase((v) => !v)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={
                      showPassphrase ? "Hide passphrase" : "Show passphrase"
                    }
                  >
                    {showPassphrase ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/45 p-3 font-mono text-[11px] text-muted-foreground">
                Auto-locks after{" "}
                <span className="font-semibold text-foreground">5 min</span> of
                inactivity or via{" "}
                <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-400">
                  Ctrl+Shift+L
                </kbd>
              </div>
            </CardContent>

            <CardFooter className="mt-5 border-t border-border pt-5">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-600 font-mono text-xs font-semibold tracking-wider text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    VERIFYING AES-256-GCM TAG...
                  </>
                ) : (
                  <>
                    <Unlock className="size-4" />
                    DECRYPT &amp; UNLOCK VAULT
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* Dynamic Quick PIN Unlock Modal */}
      <DynamicPinModal
        open={isPinModalOpen}
        onOpenChange={setIsPinModalOpen}
        onPinConfirmed={handlePinUnlock}
        title="Unlock ArzurVault"
        subtitle="Enter your 4 or 6-digit Dynamic Quick PIN to unlock"
        label="Enter Quick PIN"
        confirmLabel={isPinUnlocking ? "Unlocking..." : "Unlock Vault"}
        allowLengthToggle={true}
        enforceFintechRules={false}
      />
    </div>
  );
}
