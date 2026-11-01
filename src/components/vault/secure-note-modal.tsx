"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileLock2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createVaultItem, updateVaultItem } from "@/actions/vault-actions";
import { useVault } from "@/context/vault-context";
import type {
  SecureNoteSecretPayload,
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

const secureNoteSchema = z.object({
  title: z.string().trim().min(1, "Note title is required.").max(160),
  subtitle: z.string().trim().max(200),
  category: z.string().trim().max(80),
  content: z
    .string()
    .min(1, "Encrypted note content cannot be empty.")
    .max(50000, "Note exceeds maximum length."),
  favorite: z.boolean(),
});

type SecureNoteFormValues = z.infer<typeof secureNoteSchema>;

interface SecureNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem?: VaultItemRecord | null;
  initialSecret?: SecureNoteSecretPayload | null;
  onSaved: (item: VaultItemRecord) => void;
}

export function SecureNoteModal({
  open,
  onOpenChange,
  editingItem = null,
  initialSecret = null,
  onSaved,
}: SecureNoteModalProps) {
  const { encryptPayload } = useVault();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SecureNoteFormValues>({
    resolver: zodResolver(secureNoteSchema),
    defaultValues: {
      title: "",
      subtitle: "",
      category: "Security",
      content: "",
      favorite: false,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editingItem && initialSecret) {
      reset({
        title: editingItem.title,
        subtitle: editingItem.subtitle || "",
        category: editingItem.category || "Security",
        content: initialSecret.content || "",
        favorite: editingItem.favorite,
      });
    } else {
      reset({
        title: "",
        subtitle: "",
        category: "Security",
        content: "",
        favorite: false,
      });
    }
  }, [open, editingItem, initialSecret, reset]);

  const isFavorite = useWatch({ control, name: "favorite" });
  const contentValue = useWatch({ control, name: "content" });

  const onSubmit = async (values: SecureNoteFormValues) => {
    try {
      const secretPayload: SecureNoteSecretPayload = {
        content: values.content,
      };

      const encrypted = await encryptPayload(secretPayload);

      const payload = {
        type: "SECURE_NOTE" as const,
        title: values.title,
        subtitle: values.subtitle || "Encrypted Note",
        url: null,
        category: values.category || "Security",
        favorite: values.favorite,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        salt: encrypted.salt,
      };

      const saved = editingItem
        ? await updateVaultItem(editingItem.id, payload)
        : await createVaultItem(payload);

      toast.success(
        editingItem
          ? "Secure note re-encrypted & updated."
          : "Secure note encrypted & saved."
      );
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to encrypt secure note.";
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden custom-scrollbar overscroll-contain sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg border border-cyan-500/35 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <FileLock2 className="size-4" />
            </div>
            <div>
              <DialogTitle className="font-mono text-base">
                {editingItem ? "Edit Secure Note" : "New Encrypted Secure Note"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Store SSH keys, PGP armor, recovery codes, or confidential text.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sn-title" className="text-xs text-foreground/90">
              Note Title *
            </Label>
            <Input
              id="sn-title"
              placeholder="e.g., Production SSH Key, Proton Recovery Codes"
              className="bg-background focus-visible:border-cyan-500/70"
              aria-invalid={Boolean(errors.title)}
              {...register("title")}
            />
            {errors.title && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.title.message}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="sn-subtitle"
                className="text-xs text-foreground/90"
              >
                Summary Label (Unencrypted)
              </Label>
              <Input
                id="sn-subtitle"
                placeholder="e.g., Ed25519 Key, Backup Codes"
                className="bg-background text-xs focus-visible:border-cyan-500/70"
                {...register("subtitle")}
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="sn-category"
                className="text-xs text-foreground/90"
              >
                Category
              </Label>
              <Input
                id="sn-category"
                placeholder="Security, Infrastructure..."
                className="bg-background text-xs focus-visible:border-cyan-500/70"
                {...register("category")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="sn-content"
                className="text-xs text-foreground/90"
              >
                Encrypted Payload *
              </Label>
              <span className="font-mono text-[10px] text-muted-foreground">
                {(contentValue || "").length} chars • AES-256-GCM
              </span>
            </div>
            <Textarea
              id="sn-content"
              rows={8}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;Enter confidential material here..."
              className="bg-background font-mono text-xs leading-relaxed focus-visible:border-cyan-500/70"
              aria-invalid={Boolean(errors.content)}
              {...register("content")}
            />
            {errors.content && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.content.message}
              </p>
            )}
          </div>

          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/40 px-3.5 py-2.5">
            <div>
              <p className="text-xs font-medium text-foreground">
                Pin to Favorites
              </p>
              <p className="text-[11px] text-muted-foreground">
                Keep this secure note pinned at the top of your vault
              </p>
            </div>
            <Switch
              checked={isFavorite}
              onCheckedChange={(checked) =>
                setValue("favorite", checked, { shouldDirty: true })
              }
            />
          </label>

          <DialogFooter className="border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 font-mono text-xs font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  ENCRYPTING...
                </>
              ) : (
                <>
                  <ShieldCheck className="size-4" />
                  {editingItem ? "RE-ENCRYPT & SAVE" : "ENCRYPT & SAVE NOTE"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
