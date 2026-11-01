"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CreditCard, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createVaultItem, updateVaultItem } from "@/actions/vault-actions";
import { useVault } from "@/context/vault-context";
import {
  detectCardBrand,
  formatCardNumber,
  validateLuhn,
} from "@/lib/credit-card";
import type {
  CardBrand,
  PaymentCardSecretPayload,
  VaultItemRecord,
} from "@/types/vault";
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

const paymentCardFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required (e.g., 'Chase Sapphire')").max(160),
  cardholderName: z.string().trim().min(1, "Cardholder name is required").max(160),
  cardNumber: z.string().min(12, "Valid card number is required"),
  expiryMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, "MM must be 01-12"),
  expiryYear: z.string().regex(/^20\d{2}$|^\d{2}$/, "YY or YYYY required"),
  cvv: z.string().min(3, "CVV is 3-4 digits").max(4),
  pin: z.string().max(8).optional(),
  category: z.string().trim().max(80).optional(),
  notes: z.string().max(4000).optional(),
  favorite: z.boolean(),
});

type PaymentCardFormValues = z.infer<typeof paymentCardFormSchema>;

interface PaymentCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem?: VaultItemRecord | null;
  initialSecret?: PaymentCardSecretPayload | null;
  onSaved: (item: VaultItemRecord) => void;
}

export function PaymentCardModal({
  open,
  onOpenChange,
  editingItem = null,
  initialSecret = null,
  onSaved,
}: PaymentCardModalProps) {
  const { encryptPayload } = useVault();
  const [showCvv, setShowCvv] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PaymentCardFormValues>({
    resolver: zodResolver(paymentCardFormSchema),
    defaultValues: {
      title: "",
      cardholderName: "",
      cardNumber: "",
      expiryMonth: "",
      expiryYear: "",
      cvv: "",
      pin: "",
      category: "Banking",
      notes: "",
      favorite: false,
    },
  });

  const cardNumber = useWatch({ control, name: "cardNumber" }) || "";
  const cardholderName = useWatch({ control, name: "cardholderName" }) || "CARDHOLDER NAME";
  const expiryMonth = useWatch({ control, name: "expiryMonth" }) || "MM";
  const expiryYear = useWatch({ control, name: "expiryYear" }) || "YY";
  const detectedBrand = detectCardBrand(cardNumber);
  const isLuhnValid = validateLuhn(cardNumber);

  useEffect(() => {
    if (open) {
      if (editingItem && initialSecret) {
        reset({
          title: editingItem.title,
          cardholderName: initialSecret.cardholderName,
          cardNumber: formatCardNumber(initialSecret.cardNumber),
          expiryMonth: initialSecret.expiryMonth,
          expiryYear: initialSecret.expiryYear,
          cvv: initialSecret.cvv,
          pin: initialSecret.pin || "",
          category: editingItem.category || "Banking",
          notes: initialSecret.notes || "",
          favorite: editingItem.favorite,
        });
      } else {
        reset({
          title: "",
          cardholderName: "",
          cardNumber: "",
          expiryMonth: "",
          expiryYear: "",
          cvv: "",
          pin: "",
          category: "Banking",
          notes: "",
          favorite: false,
        });
      }
    }
  }, [open, editingItem, initialSecret, reset]);

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setValue("cardNumber", formatted, { shouldValidate: true });
  };

  const onSubmit = async (values: PaymentCardFormValues) => {
    try {
      const cleanNumber = values.cardNumber.replace(/\D/g, "");
      const brand: CardBrand = detectCardBrand(cleanNumber);

      const secretPayload: PaymentCardSecretPayload = {
        cardholderName: values.cardholderName,
        cardNumber: cleanNumber,
        expiryMonth: values.expiryMonth,
        expiryYear: values.expiryYear,
        cvv: values.cvv,
        pin: values.pin || undefined,
        brand,
        notes: values.notes || undefined,
      };

      const encrypted = await encryptPayload(secretPayload);
      const last4 = cleanNumber.slice(-4);
      const subtitle = `${brand} •••• ${last4} | Exp ${values.expiryMonth}/${values.expiryYear}`;

      let savedRecord: VaultItemRecord;

      if (editingItem) {
        savedRecord = await updateVaultItem(editingItem.id, {
          type: "PAYMENT_CARD",
          title: values.title,
          subtitle,
          category: values.category || "Banking",
          favorite: values.favorite,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          salt: encrypted.salt,
        });
        toast.success("Payment card updated successfully.");
      } else {
        savedRecord = await createVaultItem({
          type: "PAYMENT_CARD",
          title: values.title,
          subtitle,
          category: values.category || "Banking",
          favorite: values.favorite,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          salt: encrypted.salt,
        });
        toast.success("Payment card encrypted & saved to vault.");
      }

      onSaved(savedRecord);
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save card.";
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg border border-indigo-500/35 bg-indigo-500/10 text-indigo-500">
              <CreditCard className="size-4" />
            </div>
            <div>
              <DialogTitle className="font-mono text-base">
                {editingItem ? "Edit Payment Card" : "New Payment Card"}
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">
                Zero-knowledge encrypted credit or debit card.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Realistic Card Preview */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-xl border border-indigo-500/20">
          <div className="flex justify-between items-start mb-6">
            <span className="font-mono text-xs font-semibold tracking-widest uppercase text-indigo-300">
              Arzur Secure Card
            </span>
            <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-indigo-200">
              {detectedBrand}
            </span>
          </div>

          <div className="font-mono text-lg tracking-widest mb-4 break-all">
            {cardNumber ? cardNumber : "•••• •••• •••• ••••"}
          </div>

          <div className="flex justify-between items-end font-mono text-xs">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-white/50">
                Cardholder
              </div>
              <div className="font-semibold tracking-wider truncate max-w-[200px]">
                {cardholderName.toUpperCase()}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-white/50">
                Expires
              </div>
              <div className="font-semibold tracking-wider">
                {expiryMonth}/{expiryYear}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-mono text-xs">Card Label / Title *</Label>
            <Input
              {...register("title")}
              placeholder="e.g., Personal Visa, Apple Card, Business Amex"
              className="font-mono text-xs"
            />
            {errors.title && (
              <p className="text-xs text-red-500">{errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Cardholder Name *</Label>
              <Input
                {...register("cardholderName")}
                placeholder="Full Name on Card"
                className="font-mono text-xs uppercase"
              />
              {errors.cardholderName && (
                <p className="text-xs text-red-500">{errors.cardholderName.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="font-mono text-xs">Card Number *</Label>
                {cardNumber.length >= 12 && (
                  <span
                    className={`font-mono text-[10px] ${
                      isLuhnValid ? "text-emerald-500" : "text-amber-500"
                    }`}
                  >
                    {isLuhnValid ? "✓ Luhn Valid" : "Check card digits"}
                  </span>
                )}
              </div>
              <Input
                value={cardNumber}
                onChange={handleCardNumberChange}
                placeholder="4532 0000 0000 0000"
                className="font-mono text-xs"
              />
              {errors.cardNumber && (
                <p className="text-xs text-red-500">{errors.cardNumber.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Exp Month *</Label>
              <Input
                {...register("expiryMonth")}
                placeholder="MM (e.g. 08)"
                maxLength={2}
                className="font-mono text-xs"
              />
              {errors.expiryMonth && (
                <p className="text-xs text-red-500">{errors.expiryMonth.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Exp Year *</Label>
              <Input
                {...register("expiryYear")}
                placeholder="YY (e.g. 28)"
                maxLength={4}
                className="font-mono text-xs"
              />
              {errors.expiryYear && (
                <p className="text-xs text-red-500">{errors.expiryYear.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="font-mono text-xs">CVV *</Label>
                <button
                  type="button"
                  onClick={() => setShowCvv(!showCvv)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {showCvv ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                </button>
              </div>
              <Input
                {...register("cvv")}
                type={showCvv ? "text" : "password"}
                placeholder="3-4 digits"
                maxLength={4}
                className="font-mono text-xs"
              />
              {errors.cvv && (
                <p className="text-xs text-red-500">{errors.cvv.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="font-mono text-xs">Card PIN (Optional)</Label>
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {showPin ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                </button>
              </div>
              <Input
                {...register("pin")}
                type={showPin ? "text" : "password"}
                placeholder="ATM PIN"
                maxLength={8}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Category</Label>
              <Input
                {...register("category")}
                placeholder="e.g. Banking, Personal, Work"
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-xs">Notes / Billing Address</Label>
            <Textarea
              {...register("notes")}
              placeholder="Card billing zip code, customer service phone, etc."
              rows={2}
              className="font-mono text-xs"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <Label className="font-mono text-xs">Favorite Card</Label>
              <p className="font-mono text-[11px] text-muted-foreground">
                Pin this payment card to the top of your vault.
              </p>
            </div>
            <Switch
              checked={useWatch({ control, name: "favorite" })}
              onCheckedChange={(checked) => setValue("favorite", checked)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="font-mono text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="font-mono text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Encrypting Card...
                </>
              ) : (
                <>
                  <ShieldCheck className="size-3.5" />
                  Save Payment Card
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
