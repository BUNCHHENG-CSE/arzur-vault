"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  configureDuressVault,
  rotateMasterPassphrase,
} from "@/actions/vault-actions";
import { useVault } from "@/context/vault-context";
import {
  createVerifier,
  decryptVaultPayload,
  encryptVaultPayload,
} from "@/lib/crypto";
import { DEFAULT_DECOY_ITEMS } from "@/lib/duress";
import {
  enrollBiometrics,
  getBiometricEnrollment,
  isPlatformBiometricsAvailable,
  removeBiometricEnrollment,
  type StoredBiometricCredential,
} from "@/lib/webauthn";
import {
  enrollQuickPin,
  getPinEnrollment,
  removePinEnrollment,
  type StoredPinCredential,
} from "@/lib/pin-unlock";
import { DynamicPinModal } from "./dynamic-pin-modal";
import type { VaultItemRecord } from "@/types/vault";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface VaultSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: VaultItemRecord[];
  userEmail: string;
  userName: string;
  onItemsReencrypted: (updatedItems: VaultItemRecord[]) => void;
}

const TIMEOUT_OPTIONS = [
  { label: "1 Minute", value: 60 * 1000 },
  { label: "5 Minutes (Default)", value: 5 * 60 * 1000 },
  { label: "15 Minutes", value: 15 * 60 * 1000 },
  { label: "30 Minutes", value: 30 * 60 * 1000 },
  { label: "1 Hour", value: 60 * 60 * 1000 },
  { label: "Never (Lock Manually)", value: 0 },
];

export function VaultSettingsModal({
  open,
  onOpenChange,
  items,
  userEmail,
  userName,
  onItemsReencrypted,
}: VaultSettingsModalProps) {
  const {
    isVaultUnlocked,
    masterPassphrase,
    autoLockTimeoutMs,
    setAutoLockTimeoutMs,
    setUpdatedVerifier,
  } = useVault();

  // Master key rotation state
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  // Biometrics state
  const [bioSupported, setBioSupported] = useState(false);
  const [bioEnrollment, setBioEnrollment] =
    useState<StoredBiometricCredential | null>(() =>
      typeof window !== "undefined" ? getBiometricEnrollment(userEmail) : null
    );
  const [isEnrollingBio, setIsEnrollingBio] = useState(false);

  // Quick PIN state
  const [pinEnrollment, setPinEnrollment] =
    useState<StoredPinCredential | null>(() =>
      typeof window !== "undefined" ? getPinEnrollment(userEmail) : null
    );
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Duress / Decoy Vault state
  const [duressPass, setDuressPass] = useState("");
  const [confirmDuressPass, setConfirmDuressPass] = useState("");
  const [showDuressPass, setShowDuressPass] = useState(false);
  const [isConfiguringDuress, setIsConfiguringDuress] = useState(false);
  const [duressActive, setDuressActive] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      isPlatformBiometricsAvailable().then(setBioSupported);
    }
  }, []);

  useEffect(() => {
    if (open && typeof window !== "undefined") {
      const timer = setTimeout(() => {
        setBioEnrollment(getBiometricEnrollment(userEmail));
        setPinEnrollment(getPinEnrollment(userEmail));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open, userEmail]);

  const handleEnrollPin = async (pin: string) => {
    if (!masterPassphrase) {
      toast.error("Unlock vault first to configure Quick PIN.");
      return;
    }
    try {
      const cred = await enrollQuickPin({ userEmail, pin, masterPassphrase });
      setPinEnrollment(cred);
      toast.success(`Dynamic Quick-Unlock PIN configured (${pin.length} digits)!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to enroll PIN.");
    }
  };

  const handleRemovePin = () => {
    removePinEnrollment(userEmail);
    setPinEnrollment(null);
    toast.success("Quick-Unlock PIN removed.");
  };

  const handleTimeoutChange = (valStr: string | null) => {
    if (!valStr) return;
    const ms = parseInt(valStr, 10);
    setAutoLockTimeoutMs(ms);
    toast.success("Inactivity lock timer updated.");
  };

  // Biometric actions
  const handleEnrollBiometrics = async () => {
    if (!masterPassphrase) {
      toast.error("Unlock vault first to enroll biometrics.");
      return;
    }

    setIsEnrollingBio(true);
    try {
      const record = await enrollBiometrics({
        userEmail,
        userName,
        masterPassphrase,
      });
      setBioEnrollment(record);
      toast.success(
        `Biometrics enrolled! You can now unlock with ${record.deviceName}.`
      );
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to enroll biometrics."
      );
    } finally {
      setIsEnrollingBio(false);
    }
  };

  const handleRemoveBiometrics = () => {
    removeBiometricEnrollment(userEmail);
    setBioEnrollment(null);
    toast.info("Biometric enrollment removed from this device.");
  };

  // Duress Mode actions
  const handleEnableDuress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVaultUnlocked || !masterPassphrase) {
      toast.error("Unlock vault first.");
      return;
    }

    if (duressPass.length < 10) {
      toast.error("Duress passphrase must be at least 10 characters.");
      return;
    }

    if (duressPass === masterPassphrase) {
      toast.error(
        "Duress passphrase MUST be different from your real Master Passphrase!"
      );
      return;
    }

    if (duressPass !== confirmDuressPass) {
      toast.error("Duress passphrases do not match.");
      return;
    }

    setIsConfiguringDuress(true);
    try {
      // 1. Create duress verifier
      const verifier = await createVerifier(duressPass);

      // 2. Client-side encrypt realistic decoy items using the duress passphrase
      const decoyPayloads = await Promise.all(
        DEFAULT_DECOY_ITEMS.map(async (decoy) => {
          const enc = await encryptVaultPayload(decoy.payload, duressPass);
          return {
            title: decoy.title,
            subtitle: decoy.subtitle,
            url: decoy.url,
            category: decoy.category,
            type: decoy.type,
            ciphertext: enc.ciphertext,
            iv: enc.iv,
            salt: enc.salt,
          };
        })
      );

      // 3. Commit duress configuration and decoy items
      await configureDuressVault({
        enabled: true,
        verifier: {
          ciphertext: verifier.ciphertext,
          iv: verifier.iv,
          salt: verifier.salt,
        },
        decoyItems: decoyPayloads,
      });

      setDuressActive(true);
      toast.success(
        "Duress Vault active! Entering your Duress Passphrase will unlock convincing decoy data."
      );
      setDuressPass("");
      setConfirmDuressPass("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to configure Duress Vault mode.");
    } finally {
      setIsConfiguringDuress(false);
    }
  };

  const handleDisableDuress = async () => {
    setIsConfiguringDuress(true);
    try {
      await configureDuressVault({ enabled: false });
      setDuressActive(false);
      toast.info("Duress Vault disabled and decoy records purged.");
    } catch {
      toast.error("Failed to disable Duress Vault.");
    } finally {
      setIsConfiguringDuress(false);
    }
  };

  // Master key rotation
  const handleRotatePassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVaultUnlocked) {
      toast.error("Unlock your master vault first.");
      return;
    }

    if (currentPass !== masterPassphrase) {
      toast.error("Current Master Passphrase does not match.");
      return;
    }

    if (newPass.length < 12) {
      toast.error("New passphrase must be at least 12 characters long.");
      return;
    }

    if (newPass !== confirmPass) {
      toast.error("New passphrases do not match.");
      return;
    }

    setIsRotating(true);
    try {
      const activeItems = items.filter((i) => !i.isDecoy);
      const reencryptedItems = [];
      const updatedLocalRecords: VaultItemRecord[] = [];

      for (const item of activeItems) {
        const decryptedPayload = await decryptVaultPayload(
          {
            ciphertext: item.ciphertext,
            iv: item.iv,
            salt: item.salt,
          },
          currentPass
        );

        const newlyEncrypted = await encryptVaultPayload(
          decryptedPayload,
          newPass
        );

        reencryptedItems.push({
          id: item.id,
          ciphertext: newlyEncrypted.ciphertext,
          iv: newlyEncrypted.iv,
          salt: newlyEncrypted.salt,
        });

        updatedLocalRecords.push({
          ...item,
          ciphertext: newlyEncrypted.ciphertext,
          iv: newlyEncrypted.iv,
          salt: newlyEncrypted.salt,
        });
      }

      const newVerifier = await createVerifier(newPass);

      await rotateMasterPassphrase({
        verifier: {
          ciphertext: newVerifier.ciphertext,
          iv: newVerifier.iv,
          salt: newVerifier.salt,
        },
        reencryptedItems,
      });

      setUpdatedVerifier({
        isConfigured: true,
        vaultVerifierCipher: newVerifier.ciphertext,
        vaultVerifierIv: newVerifier.iv,
        vaultVerifierSalt: newVerifier.salt,
      });

      onItemsReencrypted(updatedLocalRecords);
      toast.success(
        `Master Passphrase rotated! All ${activeItems.length} items re-encrypted successfully.`
      );
      setCurrentPass("");
      setNewPass("");
      setConfirmPass("");
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      toast.error("Failed to re-encrypt and rotate Master Passphrase.");
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden custom-scrollbar overscroll-contain sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
              <Settings className="size-4" />
            </div>
            <div>
              <DialogTitle className="font-mono text-base">
                Vault Security Preferences
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">
                Biometrics, duress decoy protection &amp; key rotation
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="preferences" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="preferences" className="gap-1 font-mono text-[11px]">
              <Clock className="size-3" />
              Auto-Lock
            </TabsTrigger>
            <TabsTrigger value="biometrics" className="gap-1 font-mono text-[11px]">
              <Fingerprint className="size-3" />
              Biometrics
            </TabsTrigger>
            <TabsTrigger value="quick-pin" className="gap-1 font-mono text-[11px]">
              <Sparkles className="size-3 text-[#FCD535]" />
              Quick PIN
            </TabsTrigger>
            <TabsTrigger value="duress" className="gap-1 font-mono text-[11px]">
              <ShieldAlert className="size-3" />
              Duress
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1 font-mono text-[11px]">
              <KeyRound className="size-3" />
              Rotate Key
            </TabsTrigger>
          </TabsList>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-4 pt-3">
            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                <div>
                  <h4 className="font-mono text-sm font-semibold text-foreground">
                    Auto-Lock Inactivity Timeout
                  </h4>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    Automatically clears your master key from volatile memory when no user activity is detected.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Select
                  value={autoLockTimeoutMs.toString()}
                  onValueChange={handleTimeoutChange}
                >
                  <SelectTrigger className="font-mono text-xs">
                    <SelectValue placeholder="Select timeout" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEOUT_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value.toString()}
                        className="font-mono text-xs"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          {/* Biometrics Tab */}
          <TabsContent value="biometrics" className="space-y-4 pt-3">
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <Fingerprint className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                <div>
                  <h4 className="font-mono text-sm font-semibold text-foreground">
                    Hardware Biometric Quick-Unlock
                  </h4>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    Unlock your zero-knowledge vault using Touch ID, Windows Hello, or FIDO2 hardware keys without typing your full master passphrase every time.
                  </p>
                </div>
              </div>

              {!bioSupported ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 font-mono text-xs text-amber-700 dark:text-amber-300">
                  Platform biometrics (Touch ID / Windows Hello) are not detected on this browser or platform.
                </div>
              ) : bioEnrollment ? (
                <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {bioEnrollment.deviceName}
                      </span>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/30 font-mono text-[10px] text-emerald-700 dark:text-emerald-300">
                      ENROLLED &amp; ACTIVE
                    </Badge>
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    Enrolled on {new Date(bioEnrollment.enrolledAt).toLocaleDateString()}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveBiometrics}
                    className="font-mono text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    <Trash2 className="mr-1.5 size-3" />
                    Remove Biometrics from This Device
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Button
                    type="button"
                    size="sm"
                    disabled={isEnrollingBio || !isVaultUnlocked}
                    onClick={handleEnrollBiometrics}
                    className="gap-2 bg-emerald-600 font-mono text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    {isEnrollingBio ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Fingerprint className="size-3.5" />
                    )}
                    Pair Platform Authenticator
                  </Button>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    Your master key is wrapped locally via AES-256-GCM using keys bound to this physical hardware authenticator.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Dynamic Quick PIN Tab */}
          <TabsContent value="quick-pin" className="space-y-4 pt-3">
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#FCD535] shrink-0 mt-0.5">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <h4 className="font-mono text-sm font-semibold text-foreground">
                    Dynamic Quick-Unlock PIN
                  </h4>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground leading-relaxed">
                    Set a 4 or 6-digit dynamic PIN with on-screen keypad and anti-shoulder surfing scrambled mode to instantly unlock your vault without typing your full master passphrase.
                  </p>
                </div>
              </div>

              {pinEnrollment ? (
                <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-[#FCD535]" />
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {pinEnrollment.pinLength}-Digit Dynamic PIN Active
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 bg-amber-500/20 font-mono text-[10px] text-amber-700 dark:text-amber-300"
                    >
                      ENROLLED
                    </Badge>
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    Configured on {new Date(pinEnrollment.enrolledAt).toLocaleDateString()} with AES-256-GCM local zero-knowledge wrap.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsPinModalOpen(true)}
                      className="gap-1.5 font-mono text-xs border-amber-500/40 hover:bg-amber-500/20 text-foreground"
                    >
                      <Sparkles className="size-3 text-[#FCD535]" />
                      Change PIN
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemovePin}
                      className="gap-1.5 font-mono text-xs text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400"
                    >
                      <Trash2 className="size-3" />
                      Remove PIN
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border border-dashed border-border/80 p-4 bg-muted/20">
                  <p className="font-mono text-xs text-muted-foreground">
                    No Quick-Unlock PIN currently configured.
                  </p>
                  <Button
                    type="button"
                    onClick={() => setIsPinModalOpen(true)}
                    className="gap-1.5 font-mono text-xs bg-[#FCD535] hover:bg-[#F0B90B] text-zinc-950 font-semibold"
                  >
                    <Sparkles className="size-3.5" />
                    Configure Dynamic Quick PIN
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Duress / Decoy Vault Tab */}
          <TabsContent value="duress" className="space-y-4 pt-3">
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-500" />
                <div>
                  <h4 className="font-mono text-sm font-semibold text-foreground">
                    Decoy Vault &amp; Duress Mode (Plausible Deniability)
                  </h4>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    If forced under threat or coercion to unlock your vault, entering your designated Duress Passphrase opens a convincing decoy vault with harmless fake accounts. Real confidential passwords, crypto wallets, and identities remain completely hidden and cryptographically inaccessible.
                  </p>
                </div>
              </div>

              {duressActive ? (
                <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-amber-800 dark:text-amber-200">
                      Duress Mode is Active
                    </span>
                    <Badge variant="outline" className="border-amber-500/40 font-mono text-[10px] text-amber-700 dark:text-amber-300">
                      ARMED
                    </Badge>
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    Decoy items are loaded whenever your Duress Passphrase is typed into the unlock screen.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isConfiguringDuress}
                    onClick={handleDisableDuress}
                    className="font-mono text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    Disable Duress Decoy Protection
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleEnableDuress} className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label className="font-mono text-xs">
                      Duress Passphrase * (Must differ from real Master Key)
                    </Label>
                    <div className="relative">
                      <Input
                        type={showDuressPass ? "text" : "password"}
                        value={duressPass}
                        onChange={(e) => setDuressPass(e.target.value)}
                        placeholder="e.g. CoercionSafePassword#99"
                        className="pr-9 font-mono text-xs"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowDuressPass(!showDuressPass)}
                        className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground"
                      >
                        {showDuressPass ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-mono text-xs">Confirm Duress Passphrase *</Label>
                    <Input
                      type={showDuressPass ? "text" : "password"}
                      value={confirmDuressPass}
                      onChange={(e) => setConfirmDuressPass(e.target.value)}
                      placeholder="Repeat Duress Passphrase"
                      className="font-mono text-xs"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={isConfiguringDuress || !isVaultUnlocked}
                    className="gap-2 bg-amber-600 font-mono text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    {isConfiguringDuress ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="size-3.5" />
                    )}
                    Arm Decoy Vault Protection
                  </Button>
                </form>
              )}
            </div>
          </TabsContent>

          {/* Change Master Passphrase Tab */}
          <TabsContent value="security" className="space-y-4 pt-3">
            <form onSubmit={handleRotatePassphrase} className="space-y-3">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 font-mono text-[11px] text-amber-700 dark:text-amber-300">
                Rotating your Master Passphrase will decrypt and re-encrypt all {items.length} items in your vault client-side with your new key.
              </div>

              <div className="space-y-1.5">
                <Label className="font-mono text-xs">Current Master Passphrase *</Label>
                <div className="relative">
                  <Input
                    type={showPasswords ? "text" : "password"}
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    placeholder="Enter current passphrase"
                    className="pr-9 font-mono text-xs"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPasswords ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="font-mono text-xs">New Master Passphrase * (min 12 chars)</Label>
                <Input
                  type={showPasswords ? "text" : "password"}
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Enter new strong passphrase"
                  className="font-mono text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-mono text-xs">Confirm New Passphrase *</Label>
                <Input
                  type={showPasswords ? "text" : "password"}
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Repeat new passphrase"
                  className="font-mono text-xs"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isRotating || !isVaultUnlocked}
                className="mt-2 w-full gap-2 bg-emerald-600 font-mono text-xs text-white hover:bg-emerald-700"
              >
                {isRotating ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Re-encrypting all vault items...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-3.5" />
                    Rotate Master Passphrase &amp; Re-encrypt
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Dynamic Quick PIN Configuration Modal */}
      <DynamicPinModal
        open={isPinModalOpen}
        onOpenChange={setIsPinModalOpen}
        onPinConfirmed={handleEnrollPin}
        title="Set Quick Unlock PIN"
        subtitle="This Dynamic PIN will let you unlock your vault instantly"
        label="Create Quick PIN"
        confirmLabel="Save Quick PIN"
        defaultLength={6}
        allowLengthToggle={true}
        enforceFintechRules={true}
      />
    </Dialog>
  );
}
