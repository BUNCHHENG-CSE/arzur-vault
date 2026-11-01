"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createVaultItem, updateVaultItem } from "@/actions/vault-actions";
import { useOptionalVault } from "@/context/vault-context";
import { cn } from "@/lib/utils";
import {
  validateDynamicPin,
} from "@/lib/pin-validator";
import type {
  PayPinSecretPayload,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DynamicPinPad } from "@/components/ui/dynamic-pin-pad";

interface PayPinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem?: VaultItemRecord | null;
  initialSecret?: PayPinSecretPayload | null;
  onSaved: (item: VaultItemRecord) => void;
}

const QUICK_PIN_SERVICES = [
  "Binance Pay",
  "Apple Pay",
  "Revolut",
  "Google Pay",
  "Wise Transfer",
  "Bank ATM",
  "Crypto Hardware",
];

export function PayPinModal({
  open,
  onOpenChange,
  editingItem = null,
  initialSecret = null,
  onSaved,
}: PayPinModalProps) {
  const vault = useOptionalVault();

  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [category, setCategory] = useState("Payment");
  const [notes, setNotes] = useState("");
  const [favorite, setFavorite] = useState(false);

  const [modalView, setModalView] = useState<"form" | "keypad">("form");
  const [showPin, setShowPin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state when editing or opening
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        if (editingItem && initialSecret) {
          setName(editingItem.title);
          setPin(initialSecret.pin || "");
          setCategory(editingItem.category || "Payment");
          setNotes(initialSecret.notes || "");
          setFavorite(editingItem.favorite);
        } else {
          setName("");
          setPin("");
          setCategory("Payment");
          setNotes("");
          setFavorite(false);
        }
        setModalView("form");
        setShowPin(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open, editingItem, initialSecret]);

  const validation = validateDynamicPin(pin, pin.length === 4 ? 4 : 6);
  const isPinValid = pin.length >= 4 && validation.isValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a name for this Pay PIN.");
      return;
    }
    if (!pin || pin.length < 4) {
      toast.error("Please set a 4 or 6-digit Pay PIN.");
      return;
    }
    if (!validation.isValid) {
      toast.error(validation.errors[0] || "PIN does not satisfy security requirements.");
      return;
    }

    if (!vault?.encryptPayload) {
      toast.error("Vault is locked. Please unlock your vault from the dashboard to save items.");
      return;
    }

    setIsSubmitting(true);
    try {
      const secretPayload: PayPinSecretPayload = {
        name: name.trim(),
        pin: pin.trim(),
        notes: notes.trim() || undefined,
      };

      const encrypted = await vault.encryptPayload(secretPayload);
      const subtitle = `${pin.length}-Digit Dynamic PIN`;

      const input = {
        type: "PAY_PIN" as const,
        title: name.trim(),
        subtitle,
        url: null,
        category: category.trim() || "Payment",
        favorite,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        salt: encrypted.salt,
      };

      const saved = editingItem
        ? await updateVaultItem(editingItem.id, input)
        : await createVaultItem(input);

      toast.success(
        editingItem
          ? "Pay PIN updated in encrypted vault."
          : "Pay PIN encrypted & stored in vault."
      );
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to encrypt and store Pay PIN.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[95vh] p-0 gap-0 overflow-hidden flex flex-col rounded-3xl border border-zinc-800 bg-[#181a20] shadow-2xl transition-all duration-200",
          modalView === "keypad" ? "max-w-[390px] w-full mx-auto" : "sm:max-w-xl w-full"
        )}
        showCloseButton={false}
      >
        {modalView === "keypad" ? (
          <div className="p-0 overflow-y-auto max-h-[95vh]">
            <DynamicPinPad
              title="Set Pay PIN"
              subtitle="Your Pay PIN will be used to authorise pay transactions"
              label="Create Pay PIN"
              value={pin}
              onChange={setPin}
              defaultLength={6}
              allowLengthToggle={false}
              confirmLabel="Confirm"
              enforceFintechRules={true}
              onConfirm={(confirmed) => {
                setPin(confirmed);
                setModalView("form");
                toast.success(`PIN applied (${confirmed.length} digits)!`);
              }}
              onBack={() => setModalView("form")}
              className="w-full border-0 shadow-none bg-[#181a20]"
            />
          </div>
        ) : (
          <>
            {/* Header */}
            <DialogHeader className="px-6 py-4 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-[#FCD535] shadow-[0_0_15px_-3px_rgba(252,213,53,0.3)]">
                  <Sparkles className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <DialogTitle className="font-heading font-semibold text-base tracking-tight text-foreground truncate">
                      {editingItem ? "Edit Encrypted Pay PIN" : "New Encrypted Pay PIN"}
                    </DialogTitle>
                    <span className="inline-flex items-center gap-1 rounded border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-medium text-amber-600 dark:text-amber-400">
                      <Lock className="size-2.5" /> AES-256-GCM
                    </span>
                  </div>
                  <DialogDescription className="font-mono text-xs text-muted-foreground mt-0.5 truncate">
                    Zero-knowledge client-side encryption • Stored securely like passwords
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setFavorite(!favorite)}
                  className={`p-1.5 rounded-lg border transition-all ${
                    favorite
                      ? "border-amber-500/50 bg-amber-500/15 text-amber-500"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                  title={favorite ? "Pinned to favorites" : "Pin to favorites"}
                >
                  <Star className="size-4 fill-current" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all"
                >
                  <X className="size-4" />
                </button>
              </div>
            </DialogHeader>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(92vh-130px)]">
              {/* Name / Title Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pin-name" className="font-mono text-xs font-semibold">
                    Pay PIN Name *
                  </Label>
                  <span className="font-mono text-[10px] text-muted-foreground">e.g. Binance Pay, Revolut</span>
                </div>
                <Input
                  id="pin-name"
                  type="text"
                  autoFocus
                  placeholder="e.g. Binance Pay PIN"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="font-mono text-xs bg-muted/30 focus-visible:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/25"
                  required
                />

                {/* Quick Suggestions */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {QUICK_PIN_SERVICES.map((srv) => (
                    <button
                      key={srv}
                      type="button"
                      onClick={() => setName(srv)}
                      className="px-2 py-0.5 rounded-md font-mono text-[10px] bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors focus-visible:ring-1 focus-visible:ring-amber-500/30"
                    >
                      {srv}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic PIN Section (Reference Design) */}
              <div className="space-y-2 rounded-2xl border border-border/80 bg-zinc-950 p-3.5 sm:p-4 shadow-inner text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-300">Create Pay PIN</span>
                    {pin && (
                      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-400 font-mono text-[9px]">
                        {pin.length} DIGITS
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {pin && (
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="flex items-center gap-1 font-mono text-[11px] text-zinc-400 hover:text-amber-400 transition-colors focus:outline-none"
                      >
                        {showPin ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        <span>{showPin ? "Hide" : "Show"}</span>
                      </button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setModalView("keypad")}
                      className="h-7 font-mono text-[11px] border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 focus-visible:ring-2 focus-visible:ring-amber-500/30 focus-visible:border-amber-500"
                    >
                      <Sparkles className="size-3 text-[#FCD535]" />
                      Open Dynamic Keypad
                    </Button>
                  </div>
                </div>

                {/* Interactive Dynamic Slots Preview (Clean Reference Design) */}
                <div
                  onClick={() => setModalView("keypad")}
                  className="grid grid-cols-6 gap-2 justify-center items-center py-2 cursor-pointer group"
                  title="Click to launch Dynamic Keypad"
                >
                  {Array.from({ length: 6 }).map((_, i) => {
                    const digit = pin[i];
                    const isFilled = digit !== undefined;
                    return (
                      <div
                        key={`slot-${i}`}
                        className={cn(
                          "flex h-12 w-full max-w-[46px] mx-auto items-center justify-center rounded-xl font-sans text-xl font-bold transition-all",
                          isFilled
                            ? "bg-[#2B313A] text-white shadow-inner group-hover:bg-[#343b46]"
                            : "bg-[#22262E] text-transparent group-hover:bg-[#282d36]"
                        )}
                      >
                        {isFilled ? (
                          showPin ? (
                            digit
                          ) : (
                            <span className="inline-block size-3 rounded-full bg-white shadow-xs" />
                          )
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Security Validation Notice */}
                <div className="pt-0.5">
                  {pin.length > 0 && validation.errors.length > 0 ? (
                    <div className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] leading-tight">
                      <AlertCircle className="size-3.5 shrink-0 mt-0.5 text-amber-400" />
                      <span>{validation.errors[0]}</span>
                    </div>
                  ) : pin.length >= 4 ? (
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px]">
                      <ShieldCheck className="size-3.5 shrink-0 text-emerald-400" />
                      <span>High-entropy PIN valid & ready to encrypt.</span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      PIN cannot be in simple/reverse order (e.g 123456, 987654) and the same number cannot appear more than 2 times.
                    </p>
                  )}
                </div>
              </div>

              {/* Category & Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pin-category" className="font-mono text-xs">
                    Category
                  </Label>
                  <Input
                    id="pin-category"
                    type="text"
                    placeholder="e.g. Payment, Banking, DeFi"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="font-mono text-xs focus-visible:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/25"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-mono text-xs">Favorite PIN</Label>
                  <div className="flex items-center justify-between rounded-lg border border-border p-2">
                    <span className="font-mono text-[11px] text-muted-foreground">Pin to top of vault</span>
                    <Switch checked={favorite} onCheckedChange={setFavorite} />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="pin-notes" className="font-mono text-xs">
                  Encrypted Notes (Optional)
                </Label>
                <Textarea
                  id="pin-notes"
                  rows={2}
                  placeholder="Authorization limits, daily cap, emergency phone contact..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="font-mono text-xs focus-visible:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/25"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="font-mono text-xs focus-visible:ring-1 focus-visible:ring-amber-500/30"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !name.trim() || !isPinValid}
                  className="font-mono text-xs bg-[#FCD535] hover:bg-[#F0B90B] text-zinc-950 font-bold gap-1.5 shadow-md shadow-amber-400/20 focus-visible:ring-2 focus-visible:ring-amber-500/30"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Encrypting PIN...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-3.5" />
                      {editingItem ? "Update Pay PIN" : "Save Encrypted Pay PIN"}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
