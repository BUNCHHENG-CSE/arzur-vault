"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  FileBadge,
  FileLock2,
  History,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteVaultItem,
  permanentDeleteVaultItem,
  restoreVaultItem,
  toggleFavoriteItem,
} from "@/actions/vault-actions";
import { useVault } from "@/context/vault-context";
import {
  cn,
  copyPublicToClipboard,
  copySecretToClipboard,
} from "@/lib/utils";
import { maskCardNumber } from "@/lib/credit-card";
import { TotpDisplay } from "@/components/vault/totp-display";
import { CustomFieldsEditor } from "@/components/vault/custom-fields-editor";
import { EncryptedAttachmentManager } from "@/components/vault/encrypted-attachment-manager";
import { DigitalIdentityCard } from "@/components/vault/digital-identity-card";
import { ArzurSendModal } from "@/components/vault/arzur-send-modal";
import { DynamicPinModal } from "@/components/vault/dynamic-pin-modal";
import { getFaviconUrl, checkPhishingRisk } from "@/lib/phishing";
import { fetchCryptoBalance, type WalletBalanceResult } from "@/lib/web3-balance";
import type {
  CryptoWalletSecretPayload,
  DecryptedPayload,
  IdentitySecretPayload,
  PasswordSecretPayload,
  PaymentCardSecretPayload,
  PayPinSecretPayload,
  SecureNoteSecretPayload,
  VaultItemRecord,
} from "@/types/vault";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

interface VaultItemCardProps {
  item: VaultItemRecord;
  onEditItem: (item: VaultItemRecord, decrypted: DecryptedPayload) => void;
  onItemUpdated: (updated: VaultItemRecord) => void;
  onItemDeleted: (id: string) => void;
}

function getExplorerUrl(address: string, chain: string): string | null {
  const clean = address.trim();
  if (!clean) return null;
  if (chain.includes("Ethereum") || chain.includes("EVM")) {
    return `https://etherscan.io/address/${clean}`;
  }
  if (chain.includes("Bitcoin")) {
    return `https://mempool.space/address/${clean}`;
  }
  if (chain.includes("Solana")) {
    return `https://solscan.io/account/${clean}`;
  }
  if (chain.includes("Cosmos")) {
    return `https://www.mintscan.io/cosmos/address/${clean}`;
  }
  return null;
}

const CHAIN_META: Record<string, { badge: string; color: string }> = {
  "Ethereum / EVM": {
    badge: "ETH / EVM",
    color: "text-blue-500 bg-blue-500/10 border-blue-500/25",
  },
  Bitcoin: {
    badge: "BTC",
    color: "text-amber-500 bg-amber-500/10 border-amber-500/25",
  },
  Solana: {
    badge: "SOL",
    color: "text-purple-500 bg-purple-500/10 border-purple-500/25",
  },
  Cosmos: {
    badge: "ATOM",
    color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/25",
  },
  "Hardware Wallet": {
    badge: "HARDWARE",
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/25",
  },
  "Multi-Chain": {
    badge: "MULTI",
    color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/25",
  },
};

export function VaultItemCard({
  item,
  onEditItem,
  onItemUpdated,
  onItemDeleted,
}: VaultItemCardProps) {
  const { isVaultUnlocked, decryptPayload } = useVault();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [decrypted, setDecrypted] = useState<DecryptedPayload | null>(null);

  // Reveal states inside drawer (default strictly masked)
  const [revealPassword, setRevealPassword] = useState(false);
  const [revealTotp, setRevealTotp] = useState(false);
  const [revealSeedPhrase, setRevealSeedPhrase] = useState(false);
  const [revealPrivateKey, setRevealPrivateKey] = useState(false);
  const [revealBip39Pass, setRevealBip39Pass] = useState(false);
  const [revealPin, setRevealPin] = useState(false);
  const [testingPayPin, setTestingPayPin] = useState<string | null>(null);
  const [revealNote, setRevealNote] = useState(false);
  const [revealCardNumber, setRevealCardNumber] = useState(false);
  const [revealCvv, setRevealCvv] = useState(false);
  const [revealDocNumber, setRevealDocNumber] = useState(false);

  const [isTogglingFav, setIsTogglingFav] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Advanced feature states
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [balanceInfo, setBalanceInfo] = useState<WalletBalanceResult | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Redesign enhancements
  const [showEnvelope, setShowEnvelope] = useState(false);
  const [seedViewMode, setSeedViewMode] = useState<"grid" | "text">("grid");
  const [seedCountdown, setSeedCountdown] = useState<number | null>(null);
  const [copiedWordIndex, setCopiedWordIndex] = useState<number | null>(null);
  const [copiedSeedAll, setCopiedSeedAll] = useState(false);

  // Quick reveal / copy on dashboard card for Login items (Image 2 format)
  const [revealedCardPassword, setRevealedCardPassword] = useState<string | null>(null);
  const [isCardDecrypting, setIsCardDecrypting] = useState(false);
  const [copiedCardPassword, setCopiedCardPassword] = useState(false);
  const [copiedCardCombo, setCopiedCardCombo] = useState(false);
  const [revealedCardPayPin, setRevealedCardPayPin] = useState<string | null>(null);
  const [copiedCardPayPin, setCopiedCardPayPin] = useState(false);

  const handleToggleCardPasswordReveal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (revealedCardPassword) {
      setRevealedCardPassword(null);
      return;
    }
    if (!isVaultUnlocked) {
      toast.error("Unlock your Master Vault first.");
      return;
    }
    setIsCardDecrypting(true);
    try {
      const payload = await decryptPayload<PasswordSecretPayload>({
        ciphertext: item.ciphertext,
        iv: item.iv,
        salt: item.salt,
      });
      setRevealedCardPassword(payload.password);
    } catch {
      toast.error("Failed to decrypt password.");
    } finally {
      setIsCardDecrypting(false);
    }
  };

  const handleCopyCardPassword = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isVaultUnlocked) {
      toast.error("Unlock your Master Vault first.");
      return;
    }
    try {
      let pass = revealedCardPassword;
      if (!pass) {
        const payload = await decryptPayload<PasswordSecretPayload>({
          ciphertext: item.ciphertext,
          iv: item.iv,
          salt: item.salt,
        });
        pass = payload.password;
      }
      if (pass) {
        await copySecretToClipboard(pass, "Password");
        setCopiedCardPassword(true);
        setTimeout(() => setCopiedCardPassword(false), 2000);
      }
    } catch {
      toast.error("Failed to copy password.");
    }
  };

  const handleCopyCardCombo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isVaultUnlocked) {
      toast.error("Unlock your Master Vault first.");
      return;
    }
    try {
      let pass = revealedCardPassword;
      let user = item.subtitle || "";
      if (!pass) {
        const payload = await decryptPayload<PasswordSecretPayload>({
          ciphertext: item.ciphertext,
          iv: item.iv,
          salt: item.salt,
        });
        pass = payload.password;
        user = payload.username || item.subtitle || "";
      }
      const combo = `${user ? `${user}: ` : ""}${pass}`;
      await copySecretToClipboard(combo, "Credential Combo");
      setCopiedCardCombo(true);
      setTimeout(() => setCopiedCardCombo(false), 2000);
    } catch {
      toast.error("Failed to copy credential combo.");
    }
  };

  const handleToggleCardPayPinReveal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (revealedCardPayPin) {
      setRevealedCardPayPin(null);
      return;
    }
    if (!isVaultUnlocked) {
      toast.error("Unlock your Master Vault first.");
      return;
    }
    setIsCardDecrypting(true);
    try {
      const payload = await decryptPayload<PayPinSecretPayload>({
        ciphertext: item.ciphertext,
        iv: item.iv,
        salt: item.salt,
      });
      setRevealedCardPayPin(payload.pin);
    } catch {
      toast.error("Failed to decrypt Pay PIN.");
    } finally {
      setIsCardDecrypting(false);
    }
  };

  const handleCopyCardPayPin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isVaultUnlocked) {
      toast.error("Unlock your Master Vault first.");
      return;
    }
    try {
      let pinVal = revealedCardPayPin;
      if (!pinVal) {
        const payload = await decryptPayload<PayPinSecretPayload>({
          ciphertext: item.ciphertext,
          iv: item.iv,
          salt: item.salt,
        });
        pinVal = payload.pin;
      }
      if (pinVal) {
        await copySecretToClipboard(pinVal, "Pay PIN");
        setCopiedCardPayPin(true);
        setTimeout(() => setCopiedCardPayPin(false), 2000);
      }
    } catch {
      toast.error("Failed to copy Pay PIN.");
    }
  };

  // Auto-mask countdown effect for seed phrase (30s)
  useEffect(() => {
    if (!revealSeedPhrase) {
      const timer = setTimeout(() => setSeedCountdown(null), 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setSeedCountdown(30), 0);
    const interval = setInterval(() => {
      setSeedCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setRevealSeedPhrase(false);
          toast.info("Seed phrase auto-masked for privacy.");
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [revealSeedPhrase]);

  // Wipe decrypted RAM state immediately if vault locks or drawer closes
  const resetSecrets = () => {
    setDecrypted(null);
    setDecryptError(null);
    setRevealPassword(false);
    setRevealTotp(false);
    setRevealedCardPayPin(null);
    setRevealSeedPhrase(false);
    setRevealPrivateKey(false);
    setRevealBip39Pass(false);
    setRevealPin(false);
    setRevealNote(false);
    setRevealCardNumber(false);
    setRevealCvv(false);
    setRevealDocNumber(false);
    setConfirmDelete(false);
    setBalanceInfo(null);
    setShowHistory(false);
    setShowEnvelope(false);
    setSeedCountdown(null);
    setCopiedWordIndex(null);
    setCopiedSeedAll(false);
    setRevealedCardPassword(null);
    setCopiedCardPassword(false);
    setCopiedCardCombo(false);
  };

  const handleOpenAndDecrypt = async () => {
    if (!isVaultUnlocked) {
      toast.error("Unlock your Master Vault first.");
      return;
    }

    resetSecrets();
    setDrawerOpen(true);
    setIsDecrypting(true);
    setDecryptError(null);

    try {
      const result = await decryptPayload<DecryptedPayload>({
        ciphertext: item.ciphertext,
        iv: item.iv,
        salt: item.salt,
      });
      setDecrypted(result);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "AES-256-GCM authentication failed.";
      setDecryptError(msg);
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleDrawerOpenChange = (nextOpen: boolean) => {
    setDrawerOpen(nextOpen);
    if (!nextOpen) {
      resetSecrets();
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTogglingFav) return;
    setIsTogglingFav(true);
    try {
      const updated = await toggleFavoriteItem(item.id);
      onItemUpdated(updated);
    } catch {
      toast.error("Failed to update favorite status.");
    } finally {
      setIsTogglingFav(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      if (item.deletedAt) {
        await permanentDeleteVaultItem(item.id);
        toast.success("Item permanently purged from database.");
      } else {
        await deleteVaultItem(item.id);
        toast.success("Item moved to Trash.");
      }
      setDrawerOpen(false);
      resetSecrets();
      onItemDeleted(item.id);
    } catch {
      toast.error("Failed to delete vault item.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await restoreVaultItem(item.id);
      toast.success("Item restored to Vault.");
      setDrawerOpen(false);
      resetSecrets();
      onItemUpdated({ ...item, deletedAt: null });
    } catch {
      toast.error("Failed to restore item.");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleEditClick = () => {
    if (!decrypted) return;
    const payloadSnapshot = decrypted;
    setDrawerOpen(false);
    resetSecrets();
    onEditItem(item, payloadSnapshot);
  };

  const typeConfig = {
    PASSWORD: {
      label: "Login",
      icon: KeyRound,
      iconBox:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 group-hover:border-emerald-500/50 dark:text-emerald-400",
      badge:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      hoverBorder: "hover:border-emerald-500/45",
    },
    CRYPTO_WALLET: {
      label: "Seed Vault",
      icon: Wallet,
      iconBox:
        "border-amber-500/35 bg-amber-500/10 text-amber-600 group-hover:border-amber-500/55 dark:text-amber-400",
      badge:
        "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      hoverBorder: "hover:border-amber-500/45",
    },
    SECURE_NOTE: {
      label: "Secure Note",
      icon: FileLock2,
      iconBox:
        "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 group-hover:border-cyan-500/50 dark:text-cyan-400",
      badge:
        "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
      hoverBorder: "hover:border-cyan-500/45",
    },
    PAYMENT_CARD: {
      label: "Payment Card",
      icon: CreditCard,
      iconBox:
        "border-indigo-500/30 bg-indigo-500/10 text-indigo-600 group-hover:border-indigo-500/50 dark:text-indigo-400",
      badge:
        "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
      hoverBorder: "hover:border-indigo-500/45",
    },
    IDENTITY: {
      label: "Identity",
      icon: FileBadge,
      iconBox:
        "border-teal-500/30 bg-teal-500/10 text-teal-600 group-hover:border-teal-500/50 dark:text-teal-400",
      badge:
        "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
      hoverBorder: "hover:border-teal-500/45",
    },
    PAY_PIN: {
      label: "Pay PIN",
      icon: Sparkles,
      iconBox:
        "border-amber-500/35 bg-amber-500/10 text-[#FCD535] group-hover:border-amber-500/55 dark:text-[#FCD535]",
      badge:
        "border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      hoverBorder: "hover:border-amber-500/45",
    },
  }[item.type];

  const TypeIcon = typeConfig.icon;
  const formattedDate = new Date(item.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const activeDecrypted = isVaultUnlocked ? decrypted : null;

  const passwordPayload =
    item.type === "PASSWORD" && activeDecrypted
      ? (activeDecrypted as PasswordSecretPayload)
      : null;

  const walletPayload =
    item.type === "CRYPTO_WALLET" && activeDecrypted
      ? (activeDecrypted as CryptoWalletSecretPayload)
      : null;

  const notePayload =
    item.type === "SECURE_NOTE" && activeDecrypted
      ? (activeDecrypted as SecureNoteSecretPayload)
      : null;

  const cardPayload =
    item.type === "PAYMENT_CARD" && activeDecrypted
      ? (activeDecrypted as PaymentCardSecretPayload)
      : null;

  const identityPayload =
    item.type === "IDENTITY" && activeDecrypted
      ? (activeDecrypted as IdentitySecretPayload)
      : null;

  const payPinPayload =
    item.type === "PAY_PIN" && activeDecrypted
      ? (activeDecrypted as PayPinSecretPayload)
      : null;

  const favicon = item.url ? getFaviconUrl(item.url) : null;
  const phishing = item.url ? checkPhishingRisk(item.url) : null;

  return (
    <>
      {/* Vault Item Card */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleOpenAndDecrypt}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpenAndDecrypt();
          }
        }}
        className={cn(
          "group relative flex cursor-pointer flex-col justify-between rounded-xl border border-border bg-card p-4 text-left shadow-xs transition-all duration-150 hover:bg-accent/35 hover:shadow-md dark:bg-card/85 dark:hover:bg-card",
          typeConfig.hoverBorder
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl border transition overflow-hidden",
                typeConfig.iconBox
              )}
            >
              {favicon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={favicon}
                  alt=""
                  className="size-5 rounded object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <TypeIcon className="size-5" />
              )}
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="truncate font-mono text-sm font-semibold text-card-foreground">
                  {item.title}
                </h3>
                {item.deletedAt && (
                  <Badge variant="destructive" className="font-mono text-[9px] py-0 px-1">
                    Trash
                  </Badge>
                )}
                {phishing?.isSuspicious && (
                  <Badge variant="destructive" className="font-mono text-[9px] py-0 px-1 gap-0.5">
                    <AlertTriangle className="size-2.5" />
                    Phishing Warning
                  </Badge>
                )}
              </div>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {item.subtitle || "Encrypted payload"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleFavorite}
            aria-label={
              item.favorite ? "Remove from favorites" : "Add to favorites"
            }
            className={cn(
              "rounded-md p-1.5 transition",
              item.favorite
                ? "text-amber-500 hover:bg-accent dark:text-yellow-400"
                : "text-muted-foreground/60 hover:bg-accent hover:text-foreground"
            )}
          >
            <Star
              className={cn(
                "size-4",
                item.favorite && "fill-amber-500 dark:fill-yellow-400"
              )}
            />
          </button>
        </div>

        {/* For PASSWORD (Login) items: Image 2 Style Credential Bar */}
        {item.type === "PASSWORD" && item.subtitle && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-sky-500/25 bg-sky-950/20 px-2.5 py-1.5 font-mono text-xs text-foreground/90 dark:border-sky-500/20 dark:bg-sky-950/30"
          >
            <div className="flex min-w-0 items-center gap-1 truncate">
              <span className="font-semibold text-sky-500 dark:text-sky-400 truncate">
                {item.subtitle}:
              </span>{" "}
              <span className="truncate tracking-wider text-emerald-600 dark:text-emerald-400 font-medium">
                {revealedCardPassword ? revealedCardPassword : "••••••••••••"}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={handleToggleCardPasswordReveal}
                title={revealedCardPassword ? "Hide password" : "Quick reveal password"}
                className="text-muted-foreground hover:text-foreground h-6 w-6"
              >
                {isCardDecrypting ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : revealedCardPassword ? (
                  <EyeOff className="size-3" />
                ) : (
                  <Eye className="size-3" />
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={handleCopyCardPassword}
                title="Copy password"
                className="text-muted-foreground hover:text-emerald-500 h-6 w-6"
              >
                {copiedCardPassword ? (
                  <Check className="size-3 text-emerald-500" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleCopyCardCombo}
                title="Copy combo (account: password)"
                className="h-6 px-1.5 font-mono text-[10px] border-sky-500/35 text-sky-500 hover:bg-sky-500/10 dark:text-sky-400"
              >
                {copiedCardCombo ? (
                  <Check className="size-3 text-emerald-500" />
                ) : (
                  <span>u:p</span>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* For PAY_PIN items: Dynamic Discrete Slots Bar */}
        {item.type === "PAY_PIN" && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-amber-500/25 bg-amber-950/20 px-2.5 py-1.5 font-mono text-xs text-foreground/90 dark:border-amber-500/20 dark:bg-amber-950/30"
          >
            <div className="flex min-w-0 items-center gap-2 truncate">
              <span className="font-semibold text-amber-500 dark:text-[#FCD535] text-[11px] uppercase tracking-wider">
                PIN:
              </span>
              <div className="flex items-center gap-1.5">
                {revealedCardPayPin ? (
                  <span className="font-mono text-xs font-bold tracking-widest text-[#FCD535]">
                    {revealedCardPayPin}
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <span
                        key={i}
                        className="inline-block size-2 rounded-full bg-amber-500/60"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={handleToggleCardPayPinReveal}
                title={revealedCardPayPin ? "Hide PIN" : "Quick reveal PIN"}
                className="text-muted-foreground hover:text-foreground h-6 w-6"
              >
                {isCardDecrypting ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : revealedCardPayPin ? (
                  <EyeOff className="size-3" />
                ) : (
                  <Eye className="size-3" />
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={handleCopyCardPayPin}
                title="Copy PIN"
                className="text-muted-foreground hover:text-[#FCD535] h-6 w-6"
              >
                {copiedCardPayPin ? (
                  <Check className="size-3 text-[#FCD535]" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn("font-mono text-[10px]", typeConfig.badge)}
            >
              {typeConfig.label}
            </Badge>
            {item.category && (
              <Badge
                variant="outline"
                className="border-border bg-muted/60 font-mono text-[10px] text-muted-foreground"
              >
                {item.category}
              </Badge>
            )}
            {item.tags?.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="border-border/60 bg-muted/30 font-mono text-[9px] text-muted-foreground/80"
              >
                #{tag}
              </Badge>
            ))}
          </div>

          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
            <Lock className="size-3 text-emerald-600/80 dark:text-emerald-500/80" />
            {formattedDate}
          </span>
        </div>
      </div>

      {/* Secure Reveal Drawer */}
      <Sheet
        open={isVaultUnlocked && drawerOpen}
        onOpenChange={handleDrawerOpenChange}
      >
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col overflow-hidden border-l border-border/80 bg-background/95 p-0 text-foreground shadow-2xl backdrop-blur-xl sm:max-w-xl md:max-w-2xl data-[side=right]:sm:max-w-xl data-[side=right]:md:max-w-2xl"
        >
          {/* High-Tech Ambient Header */}
          <div className="relative border-b border-border/80 bg-gradient-to-b from-card/90 via-muted/20 to-transparent p-5 sm:p-6 pb-4">
            {/* Top Security Status Bar */}
            <div className="flex items-center justify-between gap-2 pb-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <span className="font-semibold tracking-wide">RAM BUFFER ACTIVE</span>
                <span className="text-muted-foreground/80">•</span>
                <span>AES-256-GCM SEALED</span>
              </div>

              <div className="flex items-center gap-1.5 pr-8">
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  title={item.favorite ? "Favorited" : "Add to favorites"}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg border border-border/60 bg-background/60 transition",
                    item.favorite
                      ? "border-amber-500/40 text-amber-500 bg-amber-500/10"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Star className={cn("size-3.5", item.favorite && "fill-amber-500")} />
                </button>
              </div>
            </div>

            {/* Title & Metadata Strip */}
            <div className="flex items-start gap-3.5">
              <div
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-xl border shadow-sm transition",
                  typeConfig.iconBox
                )}
              >
                {favicon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={favicon}
                    alt=""
                    className="size-6 rounded object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <TypeIcon className="size-6" />
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={cn("font-mono text-[10px] font-semibold", typeConfig.badge)}
                  >
                    {typeConfig.label}
                  </Badge>
                  {item.category && (
                    <Badge
                      variant="outline"
                      className="border-border bg-muted/60 font-mono text-[10px] text-muted-foreground"
                    >
                      {item.category}
                    </Badge>
                  )}
                  {item.tags?.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="border-border/60 bg-muted/30 font-mono text-[9px] text-muted-foreground/80"
                    >
                      #{tag}
                    </Badge>
                  ))}
                </div>

                <SheetTitle className="truncate font-mono text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  {item.title}
                </SheetTitle>

                <SheetDescription className="font-mono text-xs text-muted-foreground truncate">
                  {item.subtitle || "Zero-knowledge client-side encrypted record"}
                </SheetDescription>
              </div>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 sm:p-6 space-y-5 custom-scrollbar overscroll-contain">
            {isDecrypting && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/40 py-14">
                <Loader2 className="size-6 animate-spin text-emerald-600 dark:text-emerald-400" />
                <p className="font-mono text-xs text-muted-foreground">
                  Deriving PBKDF2-SHA256 key &amp; verifying GCM auth tag...
                </p>
              </div>
            )}

            {decryptError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-700 dark:text-red-300 space-y-2">
                <div className="flex items-center gap-2 font-mono font-semibold text-red-800 dark:text-red-200">
                  <ShieldAlert className="size-4" />
                  DECRYPTION INTEGRITY ERROR
                </div>
                <p>{decryptError}</p>
              </div>
            )}

            {/* PASSWORD REVEAL VIEW */}
            {passwordPayload && !isDecrypting && (
              <div className="space-y-4">
                {/* Image 2 Inspired Credential Combo Box */}
                <div className="rounded-xl border border-sky-500/35 bg-sky-950/20 p-4 space-y-3 dark:border-sky-500/25 dark:bg-sky-950/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-sky-400 dark:text-sky-300">
                        {item.title}
                      </span>
                      <Badge
                        variant="outline"
                        className="border-sky-500/30 bg-sky-500/10 text-sky-400 font-mono text-[9px] py-0 px-1.5"
                      >
                        Account : Password
                      </Badge>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-1">
                      <Eye className="size-3 text-sky-400" />
                      Live Combo
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-lg border border-border/70 bg-background/90 p-3 font-mono text-xs">
                    <div className="min-w-0 flex-1 break-all">
                      <span className="text-foreground/90 font-medium">
                        {passwordPayload.username}:
                      </span>{" "}
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {revealPassword ? passwordPayload.password : "••••••••••••••••"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setRevealPassword((prev) => !prev)}
                        className="text-muted-foreground hover:text-foreground"
                        title={revealPassword ? "Mask password" : "Show password"}
                      >
                        {revealPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </Button>

                      <Button
                        type="button"
                        size="xs"
                        onClick={() =>
                          copySecretToClipboard(
                            `${passwordPayload.username}: ${passwordPayload.password}`,
                            "Combo (Account: Password)"
                          )
                        }
                        className="bg-sky-600 font-mono text-[11px] font-semibold text-white hover:bg-sky-700 dark:bg-sky-500 dark:text-zinc-950 dark:hover:bg-sky-400 gap-1.5"
                      >
                        <Copy className="size-3" />
                        Copy Combo
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Username */}
                <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      Account / Username
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        copyPublicToClipboard(
                          passwordPayload.username,
                          "Username"
                        )
                      }
                      className="font-mono text-[11px] text-muted-foreground hover:bg-accent hover:text-emerald-700 dark:hover:text-emerald-300"
                    >
                      <Copy className="size-3" />
                      Copy Username
                    </Button>
                  </div>
                  <p className="font-mono text-sm break-all text-foreground">
                    {passwordPayload.username}
                  </p>
                </div>

                {/* Email (if present) */}
                {passwordPayload.email && (
                  <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                        Email Address
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          copyPublicToClipboard(
                            passwordPayload.email!,
                            "Email"
                          )
                        }
                        className="font-mono text-[11px] text-muted-foreground hover:bg-accent hover:text-emerald-700 dark:hover:text-emerald-300"
                      >
                        <Copy className="size-3" />
                        Copy Email
                      </Button>
                    </div>
                    <p className="font-mono text-sm break-all text-foreground">
                      {passwordPayload.email}
                    </p>
                  </div>
                )}

                {/* Password */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.03] p-3.5 space-y-2 dark:bg-card/70">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] tracking-wider text-emerald-700 dark:text-emerald-400 uppercase">
                      Encrypted Password
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => setRevealPassword((v) => !v)}
                        className="font-mono text-[11px]"
                      >
                        {revealPassword ? (
                          <>
                            <EyeOff className="size-3" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Eye className="size-3" />
                            Reveal
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        onClick={() =>
                          copySecretToClipboard(
                            passwordPayload.password,
                            "Password"
                          )
                        }
                        className="bg-emerald-600 font-mono text-[11px] font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
                      >
                        <Copy className="size-3" />
                        Copy Password
                      </Button>
                    </div>
                  </div>
                  <p className="rounded-lg border border-border bg-muted/50 px-3 py-2.5 font-mono text-sm break-all text-foreground dark:bg-zinc-950">
                    {revealPassword
                      ? passwordPayload.password
                      : "••••••••••••••••••••"}
                  </p>
                </div>

                {/* Website URL */}
                {item.url && (
                  <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                        Website URL
                      </span>
                      <a
                        href={
                          item.url.startsWith("http")
                            ? item.url
                            : `https://${item.url}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        Open site
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                    <p className="truncate font-mono text-xs text-foreground/90">
                      {item.url}
                    </p>
                  </div>
                )}

                {/* TOTP Live 2FA Display & Secret */}
                {passwordPayload.totpSecret && (
                  <div className="space-y-3">
                    <TotpDisplay secret={passwordPayload.totpSecret} />
                    <div className="rounded-xl border border-border bg-card p-3 shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                          TOTP Secret Key (For Backup)
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => setRevealTotp((v) => !v)}
                            className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            {revealTotp ? "Hide" : "Reveal"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() =>
                              copySecretToClipboard(
                                passwordPayload.totpSecret!,
                                "TOTP secret"
                              )
                            }
                            className="font-mono text-[11px]"
                          >
                            <Copy className="size-3" />
                            Copy
                          </Button>
                        </div>
                      </div>
                      <p className="font-mono text-xs break-all text-foreground">
                        {revealTotp
                          ? passwordPayload.totpSecret
                          : "••••••••••••••••"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {passwordPayload.notes && (
                  <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-1.5">
                    <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      Encrypted Notes
                    </span>
                    <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/90">
                      {passwordPayload.notes}
                    </p>
                  </div>
                )}

                {/* Custom Fields */}
                {passwordPayload.customFields && (
                  <CustomFieldsEditor
                    fields={passwordPayload.customFields}
                    onChange={() => {}}
                    readOnly
                  />
                )}

                {/* Password Revision History */}
                {passwordPayload.history && passwordPayload.history.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                        <History className="size-3" />
                        Password History ({passwordPayload.history.length})
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setShowHistory((v) => !v)}
                        className="font-mono text-[10px]"
                      >
                        {showHistory ? "Hide" : "Show"}
                      </Button>
                    </div>

                    {showHistory && (
                      <div className="space-y-1.5 pt-1">
                        {passwordPayload.history.map((h, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-2 font-mono text-xs"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="text-foreground block truncate">
                                {h.password}
                              </span>
                              <span className="text-[9px] text-muted-foreground">
                                {new Date(h.changedAt).toLocaleString()}
                              </span>
                            </div>
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              onClick={() =>
                                copySecretToClipboard(h.password, "Past password")
                              }
                              className="font-mono text-[10px] shrink-0"
                            >
                              <Copy className="size-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* CRYPTO WALLET SEED PHRASE REVEAL VIEW */}
            {walletPayload && !isDecrypting && (
              <div className="space-y-4">
                {/* Network & Ecosystem Card */}
                <div className="rounded-2xl border border-border/80 bg-card/75 p-4 shadow-xs backdrop-blur-xs space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500">
                        <Wallet className="size-3.5" />
                      </div>
                      <span className="font-mono text-xs font-semibold text-foreground">
                        Blockchain Network
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-mono text-xs font-bold border",
                          CHAIN_META[walletPayload.walletType]?.color ||
                            "text-amber-500 bg-amber-500/10 border-amber-500/25"
                        )}
                      >
                        {walletPayload.walletType}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-amber-500/30 bg-amber-500/10 font-mono text-xs font-medium text-amber-600 dark:text-amber-400"
                      >
                        {walletPayload.wordCount} Words
                      </Badge>
                    </div>
                  </div>

                  {/* Derivation Path Chip (if present) */}
                  {walletPayload.derivationPath && (
                    <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        Derivation Path
                      </span>
                      <div className="flex items-center gap-1.5 font-mono text-xs font-medium text-foreground">
                        <span>{walletPayload.derivationPath}</span>
                        <button
                          type="button"
                          onClick={() =>
                            copyPublicToClipboard(
                              walletPayload.derivationPath!,
                              "Derivation path"
                            )
                          }
                          className="text-muted-foreground hover:text-foreground transition p-0.5"
                          title="Copy Derivation Path"
                        >
                          <Copy className="size-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Public Address Card (if present) */}
                  {walletPayload.publicAddress && (
                    <div className="space-y-2 pt-1 border-t border-border/60">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase font-medium">
                          Public Address
                        </span>
                        <div className="flex items-center gap-1">
                          {getExplorerUrl(
                            walletPayload.publicAddress,
                            walletPayload.walletType
                          ) && (
                            <a
                              href={
                                getExplorerUrl(
                                  walletPayload.publicAddress,
                                  walletPayload.walletType
                                )!
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground hover:border-border transition"
                              title="View on block explorer"
                            >
                              <span>Explorer</span>
                              <ExternalLink className="size-2.5" />
                            </a>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() =>
                              copyPublicToClipboard(
                                walletPayload.publicAddress!,
                                "Public address"
                              )
                            }
                            className="font-mono text-[11px] h-6 px-2 gap-1"
                          >
                            <Copy className="size-3" />
                            <span>Copy Address</span>
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/80 bg-background/80 p-3 font-mono text-xs break-all text-foreground select-all">
                        {walletPayload.publicAddress}
                      </div>

                      {/* Live Balance Strip */}
                      <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3 mt-1">
                        <div className="space-y-0.5">
                          <span className="block font-mono text-[10px] tracking-wider text-muted-foreground uppercase font-medium">
                            Live RPC On-Chain Balance
                          </span>
                          <span className="font-mono text-xs font-bold text-foreground">
                            {balanceInfo
                              ? balanceInfo.formatted
                              : "Not queried yet"}
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={checkingBalance}
                          onClick={async () => {
                            setCheckingBalance(true);
                            try {
                              const res = await fetchCryptoBalance(
                                walletPayload.publicAddress!,
                                walletPayload.walletType
                              );
                              setBalanceInfo(res);
                              if (res)
                                toast.success(`Balance: ${res.formatted}`);
                              else
                                toast.error(
                                  "Could not fetch balance from public RPC."
                                );
                            } finally {
                              setCheckingBalance(false);
                            }
                          }}
                          className="font-mono text-[11px] gap-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                        >
                          {checkingBalance ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Sparkles className="size-3" />
                          )}
                          <span>Query Balance</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* BIP-39 RECOVERY SEED PHRASE HERO CARD */}
                <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/[0.07] via-card to-card p-4 sm:p-5 shadow-lg shadow-black/10 space-y-4">
                  {/* Card Header & Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-500 shadow-xs shadow-amber-500/10">
                        <KeyRound className="size-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-mono text-xs font-bold tracking-tight text-foreground">
                            BIP-39 RECOVERY SEED PHRASE
                          </h4>
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.2 font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            {walletPayload.wordCount} WORDS
                          </span>
                        </div>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          Master cryptographic seed phrase for wallet derivation
                        </p>
                      </div>
                    </div>

                    {/* Actions toolbar */}
                    <div className="flex items-center gap-1.5">
                      {revealSeedPhrase && (
                        <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
                          <button
                            type="button"
                            onClick={() => setSeedViewMode("grid")}
                            className={cn(
                              "rounded-md px-2 py-1 font-mono text-[10px] font-medium transition",
                              seedViewMode === "grid"
                                ? "bg-amber-500 text-zinc-950 font-bold"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Grid
                          </button>
                          <button
                            type="button"
                            onClick={() => setSeedViewMode("text")}
                            className={cn(
                              "rounded-md px-2 py-1 font-mono text-[10px] font-medium transition",
                              seedViewMode === "text"
                                ? "bg-amber-500 text-zinc-950 font-bold"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Text
                          </button>
                        </div>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          const next = !revealSeedPhrase;
                          setRevealSeedPhrase(next);
                        }}
                        className="font-mono text-xs gap-1.5 border-border hover:border-amber-500/40"
                      >
                        {revealSeedPhrase ? (
                          <>
                            <EyeOff className="size-3 text-muted-foreground" />
                            <span>Hide</span>
                          </>
                        ) : (
                          <>
                            <Eye className="size-3 text-amber-500" />
                            <span>Reveal</span>
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        size="xs"
                        onClick={() => {
                          copySecretToClipboard(
                            walletPayload.mnemonicWords.join(" "),
                            "Full recovery seed phrase"
                          );
                          setCopiedSeedAll(true);
                          setTimeout(() => setCopiedSeedAll(false), 2000);
                        }}
                        className="bg-amber-500 font-mono text-xs font-semibold text-zinc-950 hover:bg-amber-400 gap-1.5 shadow-sm"
                      >
                        {copiedSeedAll ? (
                          <>
                            <Check className="size-3 text-zinc-950" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" />
                            <span>Copy All</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Auto-Lock Active Countdown Banner */}
                  {revealSeedPhrase && seedCountdown !== null && (
                    <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 font-mono text-[11px] text-amber-700 dark:text-amber-300">
                      <div className="flex items-center gap-2">
                        <Clock className="size-3.5 text-amber-500 animate-pulse" />
                        <span>
                          Auto-masking in <strong className="font-bold">{seedCountdown}s</strong> for security
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSeedCountdown(30)}
                          className="text-[10px] underline hover:text-amber-500 font-medium"
                        >
                          +30s
                        </button>
                        <button
                          type="button"
                          onClick={() => setRevealSeedPhrase(false)}
                          className="text-[10px] text-muted-foreground hover:text-foreground pl-1"
                        >
                          Mask Now
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Container: Hidden Privacy Shield or Revealed Words */}
                  <div className="relative overflow-hidden rounded-xl border border-border/80 bg-background/90 p-3.5 sm:p-4 backdrop-blur-xs">
                    {/* GRID VIEW */}
                    {seedViewMode === "grid" ? (
                      <div
                        className={cn(
                          "grid grid-cols-2 sm:grid-cols-3 gap-2 transition duration-200",
                          !revealSeedPhrase && "blur-md select-none pointer-events-none"
                        )}
                      >
                        {walletPayload.mnemonicWords.map((word, idx) => (
                          <div
                            key={idx}
                            className="group/word relative flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 px-2.5 py-2 font-mono text-xs transition-colors hover:border-amber-500/50 hover:bg-amber-500/5"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 text-[10px] font-semibold text-amber-600/70 dark:text-amber-400/70 select-none">
                                {String(idx + 1).padStart(2, "0")}
                              </span>
                              <span className="font-semibold text-foreground tracking-wide truncate">
                                {revealSeedPhrase ? word : "••••••"}
                              </span>
                            </div>
                            {revealSeedPhrase && (
                              <button
                                type="button"
                                onClick={() => {
                                  copySecretToClipboard(word, `Word #${idx + 1}`);
                                  setCopiedWordIndex(idx);
                                  setTimeout(() => setCopiedWordIndex(null), 1500);
                                }}
                                className="opacity-0 group-hover/word:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-amber-500 cursor-pointer"
                                title={`Copy word #${idx + 1}`}
                              >
                                {copiedWordIndex === idx ? (
                                  <Check className="size-3 text-emerald-500" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* CONTINUOUS TEXT VIEW */
                      <div
                        className={cn(
                          "rounded-xl border border-border/70 bg-muted/30 p-3.5 font-mono text-xs leading-relaxed transition duration-200 select-all",
                          !revealSeedPhrase && "blur-md select-none pointer-events-none"
                        )}
                      >
                        {revealSeedPhrase
                          ? walletPayload.mnemonicWords.join(" ")
                          : "•••••• •••••• •••••• •••••• •••••• •••••• •••••• •••••• •••••• •••••• •••••• ••••••"}
                      </div>
                    )}

                    {/* PRIVACY SHIELD OVERLAY (WHEN MASKED) */}
                    {!revealSeedPhrase && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 p-4 text-center backdrop-blur-md dark:bg-zinc-950/75 z-10">
                        <div className="flex size-11 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-500 shadow-md shadow-amber-500/10 mb-2">
                          <Eye className="size-5" />
                        </div>
                        <Button
                          type="button"
                          onClick={() => setRevealSeedPhrase(true)}
                          className="border border-amber-500/40 bg-gradient-to-r from-amber-500 to-amber-600 font-mono text-xs font-bold text-zinc-950 shadow-md hover:from-amber-400 hover:to-amber-500 transition-all gap-1.5"
                        >
                          <Eye className="size-3.5" />
                          <span>Reveal {walletPayload.wordCount}-Word Seed Phrase</span>
                        </Button>
                        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                          Protected RAM buffer • Ensure no cameras or shoulder-surfers are viewing
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Extended Wallet Secrets (Private Key, 25th Passphrase, Hardware PIN) */}
                {(walletPayload.privateKey ||
                  walletPayload.bip39Passphrase ||
                  walletPayload.pinCode) && (
                  <div className="rounded-2xl border border-border/80 bg-card/75 p-4 shadow-xs backdrop-blur-xs space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground">
                        <Lock className="size-3.5" />
                      </div>
                      <span className="font-mono text-xs font-semibold text-foreground">
                        Extended Secrets & Hardware Credentials
                      </span>
                    </div>

                    {/* Private Key */}
                    {walletPayload.privateKey && (
                      <div className="rounded-xl border border-border/70 bg-background/60 p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase font-medium">
                            Private Key (Raw Hex)
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => setRevealPrivateKey((v) => !v)}
                              className="font-mono text-[11px] h-6 px-2"
                            >
                              {revealPrivateKey ? "Hide" : "Reveal"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              onClick={() =>
                                copySecretToClipboard(
                                  walletPayload.privateKey!,
                                  "Private key"
                                )
                              }
                              className="font-mono text-[11px] h-6 px-2 gap-1"
                            >
                              <Copy className="size-3" />
                              <span>Copy</span>
                            </Button>
                          </div>
                        </div>
                        <p className="font-mono text-xs break-all text-foreground">
                          {revealPrivateKey
                            ? walletPayload.privateKey
                            : "••••••••••••••••••••••••••••••••••••••••••••••••"}
                        </p>
                      </div>
                    )}

                    {/* BIP-39 25th Passphrase */}
                    {walletPayload.bip39Passphrase && (
                      <div className="rounded-xl border border-border/70 bg-background/60 p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase font-medium">
                            BIP-39 25th Word (Passphrase)
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => setRevealBip39Pass((v) => !v)}
                              className="font-mono text-[11px] h-6 px-2"
                            >
                              {revealBip39Pass ? "Hide" : "Reveal"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              onClick={() =>
                                copySecretToClipboard(
                                  walletPayload.bip39Passphrase!,
                                  "BIP-39 passphrase"
                                )
                              }
                              className="font-mono text-[11px] h-6 px-2 gap-1"
                            >
                              <Copy className="size-3" />
                              <span>Copy</span>
                            </Button>
                          </div>
                        </div>
                        <p className="font-mono text-xs break-all text-foreground">
                          {revealBip39Pass
                            ? walletPayload.bip39Passphrase
                            : "••••••••••••••••••••"}
                        </p>
                      </div>
                    )}

                    {/* Device PIN */}
                    {walletPayload.pinCode && (
                      <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 p-3">
                        <div>
                          <span className="block font-mono text-[10px] tracking-wider text-muted-foreground uppercase font-medium">
                            Hardware Device PIN
                          </span>
                          <span className="font-mono text-sm font-bold text-foreground">
                            {revealPin ? walletPayload.pinCode : "••••••••"}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => setRevealPin((v) => !v)}
                          className="font-mono text-[11px] h-6 px-2"
                        >
                          {revealPin ? "Hide" : "Reveal"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Wallet Notes */}
                {walletPayload.notes && (
                  <div className="rounded-2xl border border-border/80 bg-card/75 p-4 shadow-xs backdrop-blur-xs space-y-1.5">
                    <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase font-medium">
                      Encrypted Notes
                    </span>
                    <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/90">
                      {walletPayload.notes}
                    </p>
                  </div>
                )}

                {/* Custom Fields */}
                {walletPayload.customFields && (
                  <CustomFieldsEditor
                    fields={walletPayload.customFields}
                    onChange={() => {}}
                    readOnly
                  />
                )}
              </div>
            )}

            {/* SECURE NOTE REVEAL VIEW */}
            {notePayload && !isDecrypting && (
              <div className="space-y-4">
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/[0.03] p-4 space-y-3 dark:bg-card/70">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-cyan-700 dark:text-cyan-400">
                      ENCRYPTED NOTE PAYLOAD
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => setRevealNote((v) => !v)}
                        className="font-mono text-[11px]"
                      >
                        {revealNote ? (
                          <>
                            <EyeOff className="size-3" />
                            Mask
                          </>
                        ) : (
                          <>
                            <Eye className="size-3" />
                            Reveal
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        onClick={() =>
                          copySecretToClipboard(
                            notePayload.content,
                            "Secure note"
                          )
                        }
                        className="bg-emerald-600 font-mono text-[11px] font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
                      >
                        <Copy className="size-3" />
                        Copy Note
                      </Button>
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-lg border border-border bg-background p-3.5 dark:bg-zinc-950">
                    <pre
                      className={cn(
                        "max-h-96 overflow-y-auto overflow-x-hidden custom-scrollbar overscroll-contain whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground transition",
                        !revealNote && "blur-md select-none"
                      )}
                    >
                      {revealNote
                        ? notePayload.content
                        : "████████████████████████████████\n████████████████████████\n██████████████████████████████"}
                    </pre>

                    {!revealNote && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-[3px] dark:bg-zinc-950/60">
                        <Button
                          type="button"
                          onClick={() => setRevealNote(true)}
                          className="border border-cyan-500/45 bg-card font-mono text-xs font-semibold text-cyan-700 shadow-lg hover:bg-accent dark:bg-zinc-900 dark:text-cyan-300 dark:hover:bg-zinc-800"
                        >
                          <Eye className="size-4 text-cyan-600 dark:text-cyan-400" />
                          Click to Reveal Encrypted Note
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* PAYMENT CARD REVEAL VIEW */}
            {cardPayload && !isDecrypting && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-xl border border-indigo-500/20 space-y-4">
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-xs font-semibold tracking-widest uppercase text-indigo-300">
                      Arzur Encrypted Card
                    </span>
                    <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs font-bold text-indigo-200">
                      {cardPayload.brand}
                    </span>
                  </div>

                  <div className="font-mono text-lg tracking-widest">
                    {revealCardNumber
                      ? cardPayload.cardNumber
                      : maskCardNumber(cardPayload.cardNumber)}
                  </div>

                  <div className="flex justify-between items-end font-mono text-xs">
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-white/50">
                        Cardholder
                      </div>
                      <div className="font-semibold tracking-wider">
                        {cardPayload.cardholderName.toUpperCase()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-white/50">
                        Expires
                      </div>
                      <div className="font-semibold tracking-wider">
                        {cardPayload.expiryMonth}/{cardPayload.expiryYear}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      Card Number
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setRevealCardNumber((v) => !v)}
                        className="font-mono text-[11px]"
                      >
                        {revealCardNumber ? "Mask" : "Reveal"}
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        onClick={() =>
                          copySecretToClipboard(cardPayload.cardNumber, "Card number")
                        }
                        className="bg-indigo-600 font-mono text-[11px] font-semibold text-white hover:bg-indigo-700"
                      >
                        <Copy className="size-3" />
                        Copy Number
                      </Button>
                    </div>
                  </div>
                  <p className="font-mono text-sm break-all text-foreground">
                    {revealCardNumber
                      ? cardPayload.cardNumber
                      : maskCardNumber(cardPayload.cardNumber)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                        CVV / CVC
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setRevealCvv((v) => !v)}
                        className="font-mono text-[11px]"
                      >
                        {revealCvv ? "Hide" : "Reveal"}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-foreground">
                        {revealCvv ? cardPayload.cvv : "•••"}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => copySecretToClipboard(cardPayload.cvv, "CVV")}
                        className="font-mono text-[10px]"
                      >
                        <Copy className="size-3" />
                      </Button>
                    </div>
                  </div>

                  {cardPayload.pin ? (
                    <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                          Card PIN
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => setRevealPin((v) => !v)}
                          className="font-mono text-[11px]"
                        >
                          {revealPin ? "Hide" : "Reveal"}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-bold text-foreground">
                          {revealPin ? cardPayload.pin : "••••"}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => copySecretToClipboard(cardPayload.pin!, "PIN")}
                          className="font-mono text-[10px]"
                        >
                          <Copy className="size-3" />
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {cardPayload.notes && (
                  <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-1.5">
                    <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      Card Notes / Billing Address
                    </span>
                    <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/90">
                      {cardPayload.notes}
                    </p>
                  </div>
                )}

                {/* Custom Fields */}
                {cardPayload.customFields && (
                  <CustomFieldsEditor
                    fields={cardPayload.customFields}
                    onChange={() => {}}
                    readOnly
                  />
                )}
              </div>
            )}

            {/* DIGITAL IDENTITY REVEAL VIEW */}
            {identityPayload && !isDecrypting && (
              <div className="space-y-4">
                {/* Styled Document Card Preview */}
                <DigitalIdentityCard
                  identityType={identityPayload.identityType}
                  title={item.title}
                  fullName={identityPayload.fullName}
                  documentNumber={identityPayload.documentNumber}
                  issuingCountry={identityPayload.issuingCountry}
                  issuingAuthority={identityPayload.issuingAuthority}
                  birthDate={identityPayload.birthDate}
                  issueDate={identityPayload.issueDate}
                  expirationDate={identityPayload.expirationDate}
                  mrzLine1={identityPayload.mrzLine1}
                  mrzLine2={identityPayload.mrzLine2}
                  category={item.category || undefined}
                />

                {/* Document Number Detailed Field */}
                <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      Document Number
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setRevealDocNumber((v) => !v)}
                        className="font-mono text-[11px]"
                      >
                        {revealDocNumber ? "Mask" : "Reveal"}
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        onClick={() =>
                          copySecretToClipboard(
                            identityPayload.documentNumber,
                            "Document number"
                          )
                        }
                        className="bg-teal-600 font-mono text-[11px] font-semibold text-white hover:bg-teal-700"
                      >
                        <Copy className="size-3" />
                        Copy Number
                      </Button>
                    </div>
                  </div>
                  <p className="font-mono text-sm break-all text-foreground font-semibold">
                    {revealDocNumber
                      ? identityPayload.documentNumber
                      : `••••••••••••${identityPayload.documentNumber.slice(-4)}`}
                  </p>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {identityPayload.birthDate && (
                    <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
                      <span className="font-mono text-[10px] uppercase text-muted-foreground">
                        Date of Birth
                      </span>
                      <p className="font-mono text-xs font-semibold text-foreground mt-0.5">
                        {identityPayload.birthDate}
                      </p>
                    </div>
                  )}

                  {identityPayload.expirationDate && (
                    <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
                      <span className="font-mono text-[10px] uppercase text-muted-foreground">
                        Expiration Date
                      </span>
                      <p className="font-mono text-xs font-semibold text-foreground mt-0.5">
                        {identityPayload.expirationDate}
                      </p>
                    </div>
                  )}

                  {identityPayload.issueDate && (
                    <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
                      <span className="font-mono text-[10px] uppercase text-muted-foreground">
                        Issue Date
                      </span>
                      <p className="font-mono text-xs font-semibold text-foreground mt-0.5">
                        {identityPayload.issueDate}
                      </p>
                    </div>
                  )}

                  {identityPayload.issuingAuthority && (
                    <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
                      <span className="font-mono text-[10px] uppercase text-muted-foreground">
                        Issuing Authority
                      </span>
                      <p className="font-mono text-xs font-semibold text-foreground mt-0.5">
                        {identityPayload.issuingAuthority}
                      </p>
                    </div>
                  )}
                </div>

                {/* Machine Readable Zone (MRZ) */}
                {(identityPayload.mrzLine1 || identityPayload.mrzLine2) && (
                  <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        Machine Readable Zone (ICAO MRZ)
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          copySecretToClipboard(
                            `${identityPayload.mrzLine1}\n${identityPayload.mrzLine2}`,
                            "Passport MRZ Lines"
                          )
                        }
                        className="font-mono text-[10px] gap-1"
                      >
                        <Copy className="size-3" />
                        Copy MRZ
                      </Button>
                    </div>
                    <div className="rounded-lg bg-background p-2.5 font-mono text-[11px] tracking-widest text-foreground space-y-0.5 overflow-x-auto">
                      <div>{identityPayload.mrzLine1}</div>
                      <div>{identityPayload.mrzLine2}</div>
                    </div>
                  </div>
                )}

                {identityPayload.address && (
                  <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-1">
                    <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      Address on Document
                    </span>
                    <p className="font-mono text-xs text-foreground">
                      {identityPayload.address}
                    </p>
                  </div>
                )}

                {identityPayload.notes && (
                  <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-1">
                    <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      Confidential Notes
                    </span>
                    <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">
                      {identityPayload.notes}
                    </p>
                  </div>
                )}

                {/* Custom Fields */}
                {identityPayload.customFields && (
                  <CustomFieldsEditor
                    fields={identityPayload.customFields}
                    onChange={() => {}}
                    readOnly
                  />
                )}
              </div>
            )}

            {/* PAY PIN REVEAL VIEW */}
            {payPinPayload && !isDecrypting && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-500/35 bg-zinc-950 p-5 space-y-4 text-white shadow-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-[#FCD535]" />
                      <span className="font-mono text-xs font-bold text-white">
                        {item.title}
                      </span>
                      <Badge
                        variant="outline"
                        className="border-amber-500/30 bg-amber-500/10 text-amber-400 font-mono text-[9px] py-0 px-1.5"
                      >
                        {payPinPayload.pin.length} Digits
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => setRevealPin((v) => !v)}
                        className="font-mono text-[11px] h-7 border-zinc-700 bg-zinc-900 text-zinc-200 hover:text-white"
                      >
                        {revealPin ? <EyeOff className="size-3 mr-1" /> : <Eye className="size-3 mr-1" />}
                        {revealPin ? "Hide" : "Show"}
                      </Button>

                      <Button
                        type="button"
                        size="xs"
                        onClick={() => copySecretToClipboard(payPinPayload.pin, "Pay PIN")}
                        className="bg-[#FCD535] hover:bg-[#F0B90B] text-zinc-950 font-bold font-mono text-[11px] h-7"
                      >
                        <Copy className="size-3 mr-1" />
                        Copy PIN
                      </Button>
                    </div>
                  </div>

                  {/* Dynamic Discrete PIN Slots */}
                  <div className="flex items-center justify-center gap-2.5 py-2">
                    {payPinPayload.pin.split("").map((digit, i) => (
                      <div
                        key={`paypin-slot-${i}`}
                        className="flex size-11 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 font-mono text-lg font-bold text-white shadow-inner"
                      >
                        {revealPin ? digit : <span className="inline-block size-2.5 rounded-full bg-white" />}
                      </div>
                    ))}
                  </div>

                  {/* Interactive Dynamic Keypad Tester */}
                  <Button
                    type="button"
                    onClick={() => setTestingPayPin(payPinPayload.pin)}
                    variant="outline"
                    className="w-full font-mono text-xs border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 h-10 gap-2"
                  >
                    <Sparkles className="size-3.5 text-[#FCD535]" />
                    Open Dynamic Keypad Tester
                  </Button>
                </div>

                {payPinPayload.notes && (
                  <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-1.5">
                    <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      Encrypted Notes
                    </span>
                    <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/90">
                      {payPinPayload.notes}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Encrypted File Attachments */}
            {activeDecrypted && (
              <EncryptedAttachmentManager
                vaultItemId={item.id}
                initialAttachments={item.attachments}
              />
            )}

            {/* Zero-Knowledge Envelope Verification */}
            <div className="rounded-2xl border border-border/80 bg-card/75 p-4 shadow-xs backdrop-blur-xs">
              <button
                type="button"
                onClick={() => setShowEnvelope((v) => !v)}
                className="flex w-full items-center justify-between text-left group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex size-7 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="size-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        Cryptographic Verification Seal
                      </span>
                      <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        AES-256-GCM
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      PBKDF2-HMAC-SHA256 • 310,000 Rounds
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-muted-foreground group-hover:text-foreground transition">
                  <span className="font-mono text-[10px]">
                    {showEnvelope ? "Hide Details" : "Verify Hashes"}
                  </span>
                  {showEnvelope ? (
                    <ChevronUp className="size-3.5" />
                  ) : (
                    <ChevronDown className="size-3.5" />
                  )}
                </div>
              </button>

              {showEnvelope && (
                <div className="mt-3.5 pt-3 border-t border-border/60 space-y-2 font-mono text-[11px]">
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2">
                    <span className="text-muted-foreground">IV (96-bit):</span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-foreground select-all truncate">{item.iv}</span>
                      <button
                        type="button"
                        onClick={() =>
                          copyPublicToClipboard(
                            item.iv,
                            "Initialization Vector (IV)"
                          )
                        }
                        className="text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                        title="Copy IV"
                      >
                        <Copy className="size-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2">
                    <span className="text-muted-foreground">
                      PBKDF2 Salt (128-bit):
                    </span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-foreground select-all truncate max-w-[200px]">
                        {item.salt}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyPublicToClipboard(item.salt, "PBKDF2 Salt")
                        }
                        className="text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                        title="Copy Salt"
                      >
                        <Copy className="size-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2 text-muted-foreground">
                    <span>Cipher &amp; Mode:</span>
                    <span className="text-foreground font-semibold">
                      AES-256-GCM (128-bit Tag)
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2 text-muted-foreground">
                    <span>Last Sealed / Updated:</span>
                    <span>{new Date(item.updatedAt).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sticky Bottom Action Bar (Zero-overflow responsive layout) */}
          <div className="sticky bottom-0 z-20 mt-auto border-t border-border/80 bg-background/95 backdrop-blur-md p-4 px-5 sm:px-6 shadow-2xl">
            {!confirmDelete ? (
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                {item.deletedAt ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isRestoring}
                      onClick={handleRestore}
                      className="font-mono text-xs text-emerald-600 hover:text-emerald-700 hover:border-emerald-500/40"
                    >
                      <RotateCcw className="size-3.5 mr-1" />
                      {isRestoring ? "Restoring..." : "Restore"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmDelete(true)}
                      className="font-mono text-xs"
                    >
                      <Trash2 className="size-3.5 mr-1" />
                      Purge Forever
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                    className="font-mono text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    Move to Trash
                  </Button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  {!item.deletedAt && activeDecrypted && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSendModalOpen(true)}
                      className="font-mono text-xs gap-1.5 border-border hover:border-teal-500/50 hover:text-teal-600 dark:hover:text-teal-400"
                    >
                      <Send className="size-3.5 text-teal-500" />
                      <span>Arzur Send</span>
                    </Button>
                  )}

                  {!item.deletedAt && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={!decrypted || isDecrypting}
                      onClick={handleEditClick}
                      className="bg-primary font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-sm"
                    >
                      <Pencil className="size-3.5" />
                      <span>Edit Vault Item</span>
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex w-full items-center justify-between gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-2.5">
                <span className="font-mono text-xs text-destructive">
                  {item.deletedAt
                    ? "Purge permanently from vault?"
                    : "Move this item to Trash?"}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setConfirmDelete(false)}
                    className="font-mono text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="xs"
                    disabled={isDeleting}
                    onClick={handleDelete}
                    className="font-mono text-xs"
                  >
                    {isDeleting ? "Deleting..." : "Confirm"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ArzurSendModal
        open={sendModalOpen}
        onOpenChange={setSendModalOpen}
        prefillTitle={item.title}
        prefillSecret={
          (passwordPayload
            ? `${passwordPayload.username}: ${passwordPayload.password}`
            : null) ||
          cardPayload?.cardNumber ||
          (walletPayload?.mnemonicWords
            ? walletPayload.mnemonicWords.join(" ")
            : "") ||
          notePayload?.content ||
          payPinPayload?.pin ||
          ""
        }
      />

      {/* Pay PIN Dynamic Testing & Inspection Pad */}
      <DynamicPinModal
        open={Boolean(testingPayPin)}
        onOpenChange={(open) => {
          if (!open) setTestingPayPin(null);
        }}
        initialPin={testingPayPin || ""}
        onPinConfirmed={(pin) => {
          if (pin === testingPayPin) {
            toast.success("Pay PIN verified successfully!");
          } else {
            toast.info(`Entered PIN: ${pin}`);
          }
          setTestingPayPin(null);
        }}
        title="Verify Pay PIN"
        subtitle={`Verifying PIN authorization for ${item.title}`}
        label="Enter Pay PIN"
        confirmLabel="Verify PIN"
        defaultLength={testingPayPin?.length === 4 ? 4 : 6}
        allowLengthToggle={false}
        enforceFintechRules={false}
      />
    </>
  );
}
