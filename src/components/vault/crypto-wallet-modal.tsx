"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clipboard,
  Eraser,
  Eye,
  EyeOff,
  Globe,
  HelpCircle,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Star,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createVaultItem, updateVaultItem } from "@/actions/vault-actions";
import { useVault } from "@/context/vault-context";
import { validateCryptoAddress } from "@/lib/address-validator";
import { generateSeedChallenge } from "@/lib/bip39";
import type {
  CryptoWalletChain,
  CryptoWalletSecretPayload,
  VaultItemRecord,
} from "@/types/vault";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const WALLET_CHAINS: {
  value: CryptoWalletChain;
  label: string;
  badge: string;
  color: string;
}[] = [
  {
    value: "Ethereum / EVM",
    label: "Ethereum / EVM",
    badge: "ETH",
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  },
  {
    value: "Bitcoin",
    label: "Bitcoin",
    badge: "BTC",
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  },
  {
    value: "Solana",
    label: "Solana",
    badge: "SOL",
    color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
  },
  {
    value: "Cosmos",
    label: "Cosmos",
    badge: "ATOM",
    color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
  },
  {
    value: "Hardware Wallet",
    label: "Hardware Wallet (Cold)",
    badge: "HW",
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  },
  {
    value: "Multi-Chain",
    label: "Multi-Chain Vault",
    badge: "MULTI",
    color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
  },
  {
    value: "Other",
    label: "Other Crypto Network",
    badge: "ALT",
    color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
  },
];

const DERIVATION_PRESETS = [
  { label: "Ethereum (BIP-44)", path: "m/44'/60'/0'/0/0" },
  { label: "Bitcoin SegWit (BIP-84)", path: "m/84'/0'/0'/0/0" },
  { label: "Solana (BIP-44)", path: "m/44'/501'/0'/0'" },
  { label: "Cosmos Hub (BIP-44)", path: "m/44'/118'/0'/0/0" },
];

interface CryptoWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem?: VaultItemRecord | null;
  initialSecret?: CryptoWalletSecretPayload | null;
  onSaved: (item: VaultItemRecord) => void;
}

function createEmptyWords(count: 12 | 24): string[] {
  return Array.from({ length: count }, () => "");
}

export function CryptoWalletModal({
  open,
  onOpenChange,
  editingItem = null,
  initialSecret = null,
  onSaved,
}: CryptoWalletModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <CryptoWalletModalContent
          key={editingItem?.id ?? "create-crypto-wallet"}
          onOpenChange={onOpenChange}
          editingItem={editingItem}
          initialSecret={initialSecret}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  );
}

type TabType = "phrase" | "address" | "advanced";

function CryptoWalletModalContent({
  onOpenChange,
  editingItem,
  initialSecret,
  onSaved,
}: Omit<CryptoWalletModalProps, "open">) {
  const { encryptPayload } = useVault();

  const initialTargetCount: 12 | 24 =
    editingItem && initialSecret?.wordCount === 24 ? 24 : 12;

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabType>("phrase");

  // Primary Metadata
  const [title, setTitle] = useState(() => editingItem?.title ?? "");
  const [walletType, setWalletType] = useState<CryptoWalletChain>(
    () => initialSecret?.walletType || "Ethereum / EVM"
  );
  const [category, setCategory] = useState(
    () => editingItem?.category || "Cold Storage"
  );

  // BIP-39 Seed Phrase state
  const [wordCount, setWordCount] = useState<12 | 24>(initialTargetCount);
  const [mnemonicWords, setMnemonicWords] = useState<string[]>(() =>
    editingItem && initialSecret
      ? Array.from({ length: initialTargetCount }, (_, idx) =>
          (initialSecret.mnemonicWords[idx] || "").trim().toLowerCase()
        )
      : createEmptyWords(12)
  );
  const [maskWords, setMaskWords] = useState(() => Boolean(editingItem));
  const wordInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Quick Paste Dialog/Popover state
  const [quickPasteOpen, setQuickPasteOpen] = useState(false);
  const [quickPasteText, setQuickPasteText] = useState("");

  // Public Address & Derivation Path
  const [publicAddress, setPublicAddress] = useState(
    () => initialSecret?.publicAddress || ""
  );
  const [derivationPath, setDerivationPath] = useState(
    () => initialSecret?.derivationPath || ""
  );

  // Extended Encrypted Secrets
  const [privateKey, setPrivateKey] = useState(
    () => initialSecret?.privateKey || ""
  );
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [bip39Passphrase, setBip39Passphrase] = useState(
    () => initialSecret?.bip39Passphrase || ""
  );
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [pinCode, setPinCode] = useState(() => initialSecret?.pinCode || "");
  const [showPin, setShowPin] = useState(false);
  const [notes, setNotes] = useState(() => initialSecret?.notes || "");
  const [favorite, setFavorite] = useState(
    () => editingItem?.favorite ?? false
  );

  // Backup Verification Quiz
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizIndices, setQuizIndices] = useState<number[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizPassed, setQuizPassed] = useState<boolean | null>(null);

  // Submission & Validation
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filledWordCount = mnemonicWords.filter((w) => w.trim().length > 0).length;
  const isPhraseComplete = filledWordCount === wordCount;
  const addressValidation = publicAddress.trim()
    ? validateCryptoAddress(publicAddress)
    : null;

  // Auto-focus next input on Space or Enter
  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (index < wordCount - 1) {
        wordInputRefs.current[index + 1]?.focus();
      }
    } else if (e.key === "Backspace" && !mnemonicWords[index] && index > 0) {
      e.preventDefault();
      wordInputRefs.current[index - 1]?.focus();
    }
  };

  const handleWordCountSwitch = (nextCount: 12 | 24) => {
    setWordCount(nextCount);
    setMnemonicWords((prev) =>
      Array.from({ length: nextCount }, (_, i) => prev[i] || "")
    );
    setQuizOpen(false);
    setQuizPassed(null);
  };

  const handleWordChange = (index: number, rawValue: string) => {
    const clean = rawValue.trim().toLowerCase();
    setMnemonicWords((prev) => {
      const copy = [...prev];
      copy[index] = clean;
      return copy;
    });
  };

  function parseMnemonicTokens(text: string): string[] {
    return text
      .trim()
      .split(/[\s,\n\r]+/)
      .map((t) => t.replace(/^\d+[.)\-:]?\s*/, "").trim().toLowerCase())
      .filter((t) => /^[a-z]+$/.test(t));
  }

  // Smart multi-word paste detection in any slot
  const handleWordPaste = (
    index: number,
    event: React.ClipboardEvent<HTMLInputElement>
  ) => {
    const pasted = event.clipboardData.getData("text");
    if (!pasted) return;

    const tokens = parseMnemonicTokens(pasted);
    if (tokens.length <= 1) return; // Normal single word

    event.preventDefault();

    if (tokens.length >= 24) {
      setWordCount(24);
      setMnemonicWords(tokens.slice(0, 24));
      toast.success("Imported full 24-word recovery phrase!");
      return;
    }

    if (tokens.length >= 12 && index === 0) {
      setWordCount(12);
      setMnemonicWords(tokens.slice(0, 12));
      toast.success("Imported full 12-word recovery phrase!");
      return;
    }

    setMnemonicWords((prev) => {
      const copy = [...prev];
      for (let offset = 0; offset < tokens.length; offset++) {
        if (index + offset < copy.length) {
          copy[index + offset] = tokens[offset];
        }
      }
      return copy;
    });
    toast.success(`Populated ${tokens.length} words from slot #${index + 1}.`);
  };

  // Quick Paste Popover Handler
  const handleApplyQuickPaste = () => {
    const tokens = parseMnemonicTokens(quickPasteText);
    if (tokens.length === 0) {
      toast.error("No valid BIP-39 words found in clipboard text.");
      return;
    }

    if (tokens.length >= 24) {
      setWordCount(24);
      setMnemonicWords(tokens.slice(0, 24));
      toast.success("Applied 24 recovery words to grid!");
    } else if (tokens.length >= 12) {
      setWordCount(12);
      setMnemonicWords(tokens.slice(0, 12));
      toast.success("Applied 12 recovery words to grid!");
    } else {
      const nextWords = createEmptyWords(wordCount);
      tokens.forEach((t, i) => {
        if (i < nextWords.length) nextWords[i] = t;
      });
      setMnemonicWords(nextWords);
      toast.success(`Applied ${tokens.length} words to grid.`);
    }

    setQuickPasteOpen(false);
    setQuickPasteText("");
  };

  // Direct Clipboard Paste attempt
  const handleDirectClipboardPaste = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        const tokens = parseMnemonicTokens(text);
        if (tokens.length >= 12) {
          if (tokens.length >= 24) {
            setWordCount(24);
            setMnemonicWords(tokens.slice(0, 24));
            toast.success("Imported 24 words directly from clipboard!");
          } else {
            setWordCount(12);
            setMnemonicWords(tokens.slice(0, 12));
            toast.success("Imported 12 words directly from clipboard!");
          }
          return;
        }
      }
      setQuickPasteOpen(true);
    } catch {
      setQuickPasteOpen(true);
    }
  };

  // Backup Quiz Handlers
  const startQuiz = () => {
    const indices = generateSeedChallenge(wordCount);
    setQuizIndices(indices);
    setQuizAnswers({});
    setQuizPassed(null);
    setQuizOpen(true);
  };

  const handleVerifyQuiz = () => {
    const allCorrect = quizIndices.every((idx) => {
      const expected = (mnemonicWords[idx - 1] || "").trim().toLowerCase();
      const answer = (quizAnswers[idx] || "").trim().toLowerCase();
      return expected && expected === answer;
    });

    if (allCorrect) {
      setQuizPassed(true);
      toast.success("Seed backup verified! All challenge words matched.");
    } else {
      setQuizPassed(false);
      toast.error("Word mismatch! Please check your written seed words.");
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage("Wallet name is required (e.g., Ledger Nano X Main).");
      return;
    }

    const normalizedWords = mnemonicWords
      .slice(0, wordCount)
      .map((w) => w.trim().toLowerCase());

    const emptyIndex = normalizedWords.findIndex((w) => !w);
    if (emptyIndex !== -1) {
      setActiveTab("phrase");
      setErrorMessage(
        `Word #${emptyIndex + 1} is empty. Complete all ${wordCount} BIP-39 recovery words.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const secretPayload: CryptoWalletSecretPayload = {
        wordCount,
        mnemonicWords: normalizedWords,
        walletType,
        publicAddress: publicAddress.trim() || undefined,
        privateKey: privateKey.trim() || undefined,
        derivationPath: derivationPath.trim() || undefined,
        bip39Passphrase: bip39Passphrase || undefined,
        pinCode: pinCode.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      const encrypted = await encryptPayload(secretPayload);

      const truncatedAddr = publicAddress.trim()
        ? publicAddress.trim().length > 14
          ? `${publicAddress.trim().slice(0, 6)}...${publicAddress
              .trim()
              .slice(-4)}`
          : publicAddress.trim()
        : null;

      const subtitle = truncatedAddr
        ? `${walletType} • ${truncatedAddr}`
        : `${walletType} (${wordCount} Words)`;

      const saved = editingItem
        ? await updateVaultItem(editingItem.id, {
            type: "CRYPTO_WALLET",
            title: trimmedTitle,
            subtitle,
            url: null,
            category: category.trim() || "Crypto",
            favorite,
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            salt: encrypted.salt,
          })
        : await createVaultItem({
            type: "CRYPTO_WALLET",
            title: trimmedTitle,
            subtitle,
            url: null,
            category: category.trim() || "Crypto",
            favorite,
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            salt: encrypted.salt,
          });

      toast.success(
        editingItem
          ? "Crypto seed phrase re-encrypted & updated."
          : "Crypto seed phrase encrypted & sealed in vault."
      );
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to encrypt crypto wallet.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedChainMeta =
    WALLET_CHAINS.find((c) => c.value === walletType) || WALLET_CHAINS[0];

  return (
    <DialogContent className="overflow-hidden p-0 sm:max-w-3xl border-border/80 bg-background shadow-2xl">
      {/* High-Tech Glowing Header Bar */}
      <div className="relative border-b border-border/70 bg-gradient-to-b from-amber-500/10 via-muted/20 to-transparent p-5 sm:p-6 pb-4">
        <DialogHeader className="flex flex-row items-start justify-between gap-4 text-left">
          <div className="flex items-center gap-3.5">
            <div className="relative flex size-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-500 shadow-sm shadow-amber-500/10">
              <Wallet className="size-5" />
              <div className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-background border border-amber-500/40 text-[9px] text-amber-500">
                <Lock className="size-2.5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="font-mono text-base font-semibold tracking-tight text-foreground">
                  {editingItem
                    ? "Edit Encrypted Crypto Vault"
                    : "Seal Crypto Wallet Seed Phrase"}
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="hidden sm:inline-flex border-amber-500/30 bg-amber-500/10 font-mono text-[10px] text-amber-600 dark:text-amber-400"
                >
                  AES-256-GCM
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Zero-knowledge BIP-39 vault — recovery words are encrypted in
                client RAM before leaving your device.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Primary Metadata Strip (Wallet Label, Chain, Category) */}
        <div className="mt-4 grid gap-3 sm:grid-cols-12 items-end">
          <div className="space-y-1 sm:col-span-5">
            <Label htmlFor="cw-title" className="text-[11px] font-medium text-foreground/80">
              Wallet Label <span className="text-amber-500">*</span>
            </Label>
            <Input
              id="cw-title"
              placeholder="e.g. Ledger Nano X, Trezor Cold Vault"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 bg-background/80 text-xs font-medium focus-visible:border-amber-500/60 focus-visible:ring-amber-500/20"
            />
          </div>

          <div className="space-y-1 sm:col-span-4">
            <Label className="text-[11px] font-medium text-foreground/80">
              Network / Ecosystem
            </Label>
            <Select
              value={walletType}
              onValueChange={(val) => {
                if (val) setWalletType(val as CryptoWalletChain);
              }}
            >
              <SelectTrigger className="h-9 w-full bg-background/80 text-xs font-mono">
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold border ${selectedChainMeta.color}`}
                  >
                    {selectedChainMeta.badge}
                  </span>
                  <span className="truncate">{walletType}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {WALLET_CHAINS.map((chain) => (
                  <SelectItem key={chain.value} value={chain.value} className="text-xs">
                    <div className="flex items-center gap-2 font-mono">
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${chain.color}`}
                      >
                        {chain.badge}
                      </span>
                      <span>{chain.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 sm:col-span-3">
            <Label htmlFor="cw-category" className="text-[11px] font-medium text-foreground/80">
              Category
            </Label>
            <Input
              id="cw-category"
              placeholder="Cold Storage"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 bg-background/80 text-xs focus-visible:border-amber-500/60 focus-visible:ring-amber-500/20"
            />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col">
        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-5 sm:mx-6 mt-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Navigation Tabs Header */}
        <div className="px-5 sm:px-6 pt-3 pb-2 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab("phrase")}
                className={`relative flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition-all ${
                  activeTab === "phrase"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-xs border border-amber-500/30 font-semibold"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <KeyRound className="size-3.5" />
                <span>Recovery Phrase</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono border ${
                    isPhraseComplete
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {filledWordCount}/{wordCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("address")}
                className={`relative flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition-all ${
                  activeTab === "address"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-xs border border-amber-500/30 font-semibold"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <Globe className="size-3.5" />
                <span>Address & Path</span>
                {publicAddress.trim() && (
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("advanced")}
                className={`relative flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition-all ${
                  activeTab === "advanced"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-xs border border-amber-500/30 font-semibold"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <ShieldCheck className="size-3.5" />
                <span>Extended Secrets</span>
                {(privateKey.trim() || bip39Passphrase.trim() || pinCode.trim()) && (
                  <span className="size-1.5 rounded-full bg-amber-500" />
                )}
              </button>
            </div>

            {/* Quick Helper Badge */}
            {activeTab === "phrase" && (
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                <Sparkles className="size-3 text-amber-500" />
                <span>Space / Enter advances word</span>
              </div>
            )}
          </div>
        </div>

        {/* Tab 1: BIP-39 Recovery Phrase Content */}
        {activeTab === "phrase" && (
          <div className="p-5 sm:p-6 space-y-4">
            {/* Seed Phrase Control Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border/80 bg-muted/30 p-2.5">
              {/* 12 / 24 Toggle */}
              <div className="flex items-center gap-1 bg-background rounded-lg p-0.5 border border-border">
                <button
                  type="button"
                  onClick={() => handleWordCountSwitch(12)}
                  className={`rounded-md px-3 py-1 font-mono text-xs font-medium transition-all ${
                    wordCount === 12
                      ? "bg-amber-500 text-zinc-950 font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  12 Words
                </button>
                <button
                  type="button"
                  onClick={() => handleWordCountSwitch(24)}
                  className={`rounded-md px-3 py-1 font-mono text-xs font-medium transition-all ${
                    wordCount === 24
                      ? "bg-amber-500 text-zinc-950 font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  24 Words
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleDirectClipboardPaste}
                  className="font-mono text-xs gap-1.5 border-border hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400"
                >
                  <Clipboard className="size-3" />
                  Paste Phrase
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setMaskWords((v) => !v)}
                  className="font-mono text-xs gap-1.5 border-border"
                >
                  {maskWords ? (
                    <>
                      <Eye className="size-3 text-muted-foreground" />
                      Unmask
                    </>
                  ) : (
                    <>
                      <EyeOff className="size-3 text-muted-foreground" />
                      Mask
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setMnemonicWords(createEmptyWords(wordCount));
                    setQuizPassed(null);
                    setQuizOpen(false);
                    toast.info("Cleared all recovery words.");
                  }}
                  className="font-mono text-xs gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Eraser className="size-3" />
                  Clear
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={!isPhraseComplete}
                  onClick={startQuiz}
                  className={`font-mono text-xs gap-1.5 border-amber-500/30 ${
                    quizPassed
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/40"
                      : "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                  }`}
                >
                  {quizPassed ? (
                    <>
                      <CheckCircle2 className="size-3 text-emerald-500" />
                      Backup Verified
                    </>
                  ) : (
                    <>
                      <HelpCircle className="size-3" />
                      Backup Quiz
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Quick Paste Modal / Drawer */}
            {quickPasteOpen && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clipboard className="size-4 text-amber-500" />
                    <span className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Smart Paste Seed Phrase
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => setQuickPasteOpen(false)}
                    className="size-6 p-0"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Paste your raw 12 or 24 words below. Numbers, commas, and line breaks are automatically cleaned:
                </p>
                <Textarea
                  rows={2}
                  value={quickPasteText}
                  onChange={(e) => setQuickPasteText(e.target.value)}
                  placeholder="abandon ability able about above absent absorb abstract absurd abuse access accident..."
                  className="font-mono text-xs bg-background"
                />
                <div className="flex items-center justify-between pt-1">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    Words detected:{" "}
                    <strong className="text-foreground">
                      {parseMnemonicTokens(quickPasteText).length}
                    </strong>
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => setQuickPasteOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      onClick={handleApplyQuickPaste}
                      className="bg-amber-500 text-zinc-950 font-semibold hover:bg-amber-400"
                    >
                      Fill Recovery Grid
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Backup Quiz Challenge Section */}
            {quizOpen && (
              <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-amber-500" />
                    <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                      Cold Storage Verification Challenge
                    </span>
                  </div>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setQuizOpen(false)}
                    className="font-mono text-xs text-muted-foreground"
                  >
                    Close
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Confirm your physical steel or paper backup! Type the 3 requested words from your written sheet:
                </p>

                <div className="grid grid-cols-3 gap-2.5">
                  {quizIndices.map((idx) => (
                    <div key={idx} className="space-y-1">
                      <Label className="font-mono text-[10px] text-muted-foreground">
                        Challenge Word #{idx}
                      </Label>
                      <Input
                        placeholder={`Word #${idx}`}
                        value={quizAnswers[idx] || ""}
                        onChange={(e) =>
                          setQuizAnswers((prev) => ({
                            ...prev,
                            [idx]: e.target.value,
                          }))
                        }
                        className="font-mono text-xs bg-background h-8"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  {quizPassed !== null ? (
                    <span
                      className={`font-mono text-xs font-semibold flex items-center gap-1.5 ${
                        quizPassed ? "text-emerald-500" : "text-destructive"
                      }`}
                    >
                      {quizPassed ? (
                        <>
                          <CheckCircle2 className="size-3.5" />
                          Backup 100% verified! Matches written record.
                        </>
                      ) : (
                        <>
                          <AlertCircle className="size-3.5" />
                          Words do not match your seed grid.
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Check your paper sheet before storing
                    </span>
                  )}
                  <Button
                    type="button"
                    size="xs"
                    onClick={handleVerifyQuiz}
                    className="font-mono text-xs bg-amber-500 text-zinc-950 font-semibold hover:bg-amber-400"
                  >
                    Verify Answers
                  </Button>
                </div>
              </div>
            )}

            {/* Mnemonic Words Grid */}
            <div
              className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 ${
                wordCount === 24 ? "max-h-[320px] overflow-y-auto overflow-x-hidden custom-scrollbar overscroll-contain pr-1" : ""
              }`}
            >
              {mnemonicWords.slice(0, wordCount).map((word, index) => {
                const isFilled = word.trim().length > 0;
                return (
                  <div
                    key={index}
                    className={`group relative flex items-center rounded-lg border bg-card/70 px-2 py-1.5 transition-all shadow-2xs focus-within:border-amber-500/70 focus-within:ring-2 focus-within:ring-amber-500/20 ${
                      isFilled
                        ? "border-border/90 bg-card"
                        : "border-border/50 bg-muted/20"
                    }`}
                  >
                    <span className="w-6 shrink-0 font-mono text-[10px] font-semibold text-amber-500/70 select-none">
                      {String(index + 1).padStart(2, "0")}.
                    </span>
                    <input
                      ref={(el) => {
                        wordInputRefs.current[index] = el;
                      }}
                      type={maskWords ? "password" : "text"}
                      value={word}
                      autoComplete="off"
                      spellCheck={false}
                      autoCapitalize="none"
                      placeholder={`word ${index + 1}`}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={(e) => handleWordPaste(index, e)}
                      onChange={(e) => handleWordChange(index, e.target.value)}
                      className="w-full min-w-0 bg-transparent py-0.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/35 outline-none"
                    />
                    {isFilled && !maskWords && (
                      <span className="size-1.5 rounded-full bg-emerald-500/70 shrink-0 ml-1" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Status summary pill */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-300"
                    style={{
                      width: `${Math.round((filledWordCount / wordCount) * 100)}%`,
                    }}
                  />
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {filledWordCount} of {wordCount} words filled
                </span>
              </div>
              {isPhraseComplete && (
                <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                  <Check className="size-3" /> Ready to seal
                </span>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Public Address & Derivation Path */}
        {activeTab === "address" && (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="cw-pub" className="text-xs font-medium text-foreground">
                  Public Wallet Address (Optional)
                </Label>
                {addressValidation && (
                  <Badge
                    variant="outline"
                    className={`font-mono text-[10px] ${
                      addressValidation.isValid
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {addressValidation.chainDetected || "Custom"}
                  </Badge>
                )}
              </div>
              <Input
                id="cw-pub"
                placeholder="0x71C... or bc1q... or Solana base58 address"
                value={publicAddress}
                onChange={(e) => setPublicAddress(e.target.value)}
                className="bg-background font-mono text-xs focus-visible:border-amber-500/60"
              />
              {addressValidation && (
                <p
                  className={`font-mono text-[11px] mt-1 ${
                    addressValidation.isValid
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {addressValidation.isValid ? "✓ " : "⚠ "}
                  {addressValidation.description}
                </p>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <Label htmlFor="cw-path" className="text-xs font-medium text-foreground">
                Derivation Path (Optional)
              </Label>
              <Input
                id="cw-path"
                placeholder="m/44'/60'/0'/0/0"
                value={derivationPath}
                onChange={(e) => setDerivationPath(e.target.value)}
                className="bg-background font-mono text-xs focus-visible:border-amber-500/60"
              />

              {/* Presets */}
              <div className="space-y-1 pt-1">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block">
                  Common Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {DERIVATION_PRESETS.map((preset) => (
                    <button
                      key={preset.path}
                      type="button"
                      onClick={() => setDerivationPath(preset.path)}
                      className={`rounded-md border px-2 py-1 font-mono text-[10px] transition-all ${
                        derivationPath === preset.path
                          ? "border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold"
                          : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {preset.label}: {preset.path}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-1 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground flex items-center gap-1.5 font-mono text-[11px]">
                <Globe className="size-3.5 text-amber-500" />
                Public Address Benefits
              </span>
              <p className="text-[11px]">
                Adding your public address enables real-time portfolio balance inspections and rapid copy-pasting for incoming transactions, without decrypting your master recovery words.
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: Extended Secrets & Hardware */}
        {activeTab === "advanced" && (
          <div className="p-5 sm:p-6 space-y-4">
            {/* Raw Private Key */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="cw-privkey" className="text-xs font-medium text-foreground">
                  Raw Private Key (Hex / Base58)
                </Label>
                <button
                  type="button"
                  onClick={() => setShowPrivateKey((v) => !v)}
                  className="font-mono text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {showPrivateKey ? (
                    <>
                      <EyeOff className="size-3" /> Hide
                    </>
                  ) : (
                    <>
                      <Eye className="size-3" /> Reveal
                    </>
                  )}
                </button>
              </div>
              <Input
                id="cw-privkey"
                type={showPrivateKey ? "text" : "password"}
                autoComplete="off"
                placeholder="Optional exported private key (e.g. 0x... or base58)"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="bg-background font-mono text-xs focus-visible:border-amber-500/60"
              />
              <p className="text-[10px] text-muted-foreground">
                Encrypted in client RAM with AES-256-GCM. Never shared with servers.
              </p>
            </div>

            {/* BIP-39 Passphrase & Hardware PIN */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cw-bip39pass" className="text-xs font-medium text-foreground">
                    BIP-39 25th Passphrase
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowPassphrase((v) => !v)}
                    className="font-mono text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    {showPassphrase ? "Hide" : "Show"}
                  </button>
                </div>
                <Input
                  id="cw-bip39pass"
                  type={showPassphrase ? "text" : "password"}
                  autoComplete="off"
                  placeholder="Optional 25th secret word"
                  value={bip39Passphrase}
                  onChange={(e) => setBip39Passphrase(e.target.value)}
                  className="bg-background font-mono text-xs focus-visible:border-amber-500/60"
                />
                <p className="text-[10px] text-muted-foreground">
                  The &quot;hidden wallet&quot; extension word.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cw-pin" className="text-xs font-medium text-foreground">
                    Hardware Device PIN
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    className="font-mono text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    {showPin ? "Hide" : "Show"}
                  </button>
                </div>
                <Input
                  id="cw-pin"
                  type={showPin ? "text" : "password"}
                  autoComplete="off"
                  placeholder="Device unlock PIN (e.g. Ledger/Trezor)"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  className="bg-background font-mono text-xs focus-visible:border-amber-500/60"
                />
                <p className="text-[10px] text-muted-foreground">
                  Backup PIN for your physical device.
                </p>
              </div>
            </div>

            {/* Encrypted Vault Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="cw-notes" className="text-xs font-medium text-foreground">
                Encrypted Vault Notes
              </Label>
              <Textarea
                id="cw-notes"
                rows={2}
                placeholder="Safe deposit box #, stainless steel plate location, multisig co-signers..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-background font-mono text-xs focus-visible:border-amber-500/60"
              />
            </div>

            {/* Favorite Pin Switch */}
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border/80 bg-muted/30 p-3 hover:bg-muted/50 transition">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <Star className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">
                    Pin Wallet to Favorites
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Display this seed vault at the top of your dashboard
                  </p>
                </div>
              </div>
              <Switch checked={favorite} onCheckedChange={setFavorite} />
            </label>
          </div>
        )}

        {/* Dialog Footer with Security Assurance */}
        <DialogFooter className="border-t border-border/80 bg-muted/20 px-5 sm:px-6 py-3 flex-row items-center justify-between sm:justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="size-4 text-emerald-500" />
            <span className="font-mono text-[11px] hidden sm:inline">
              Client-Side AES-256-GCM Zero-Knowledge Encryption
            </span>
            <span className="font-mono text-[11px] sm:hidden">
              AES-256-GCM RAM Only
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs font-mono"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-500 font-mono text-xs font-semibold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1" />
                  SEALING VAULT...
                </>
              ) : (
                <>
                  <ShieldCheck className="size-3.5 mr-1" />
                  {editingItem
                    ? "RE-ENCRYPT & UPDATE"
                    : "ENCRYPT & SEAL SEED PHRASE"}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
