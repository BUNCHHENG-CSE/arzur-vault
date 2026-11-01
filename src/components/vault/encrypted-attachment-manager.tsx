"use client";

import { useRef, useState } from "react";
import {
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  addVaultAttachment,
  deleteVaultAttachment,
} from "@/actions/vault-actions";
import { useVault } from "@/context/vault-context";
import {
  arrayBufferToBase64,
  base64ToUint8Array,
  deriveKey,
} from "@/lib/crypto";
import type { AttachmentRecord } from "@/types/vault";
import { Button } from "@/components/ui/button";

interface EncryptedAttachmentManagerProps {
  vaultItemId: string;
  initialAttachments?: AttachmentRecord[];
  onAttachmentChanged?: () => void;
}

export function EncryptedAttachmentManager({
  vaultItemId,
  initialAttachments = [],
  onAttachmentChanged,
}: EncryptedAttachmentManagerProps) {
  const { isVaultUnlocked, masterPassphrase } = useVault();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [attachments, setAttachments] = useState<AttachmentRecord[]>(
    initialAttachments
  );
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isVaultUnlocked || !masterPassphrase) {
      toast.error("Unlock vault first to encrypt attachments.");
      return;
    }

    // Limit to 10MB for client-side encryption performance
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10MB limit.");
      return;
    }

    setIsUploading(true);
    try {
      const buffer = await file.arrayBuffer();

      // Client-side AES-256-GCM encryption
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(masterPassphrase, salt);

      const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv, tagLength: 128 },
        key,
        buffer
      );

      const ciphertextBase64 = arrayBufferToBase64(encryptedBuffer);
      const ivBase64 = arrayBufferToBase64(iv.buffer as ArrayBuffer);
      const saltBase64 = arrayBufferToBase64(salt.buffer as ArrayBuffer);

      const created = await addVaultAttachment(vaultItemId, {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        ciphertext: ciphertextBase64,
        iv: ivBase64,
        salt: saltBase64,
      });

      setAttachments((prev) => [created as AttachmentRecord, ...prev]);
      toast.success(`Encrypted & attached "${file.name}" to vault item!`);
      onAttachmentChanged?.();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error(err);
      toast.error("Failed to encrypt and attach file.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (attachment: AttachmentRecord) => {
    if (!isVaultUnlocked || !masterPassphrase) {
      toast.error("Unlock vault first to decrypt file.");
      return;
    }

    setDownloadingId(attachment.id);
    try {
      const salt = base64ToUint8Array(attachment.salt);
      const iv = base64ToUint8Array(attachment.iv);
      const ciphertext = base64ToUint8Array(attachment.ciphertext);

      const key = await deriveKey(masterPassphrase, salt);
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv, tagLength: 128 },
        key,
        ciphertext
      );

      const blob = new Blob([decryptedBuffer], { type: attachment.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Decrypted and downloaded "${attachment.fileName}".`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to decrypt attachment.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (attachmentId: string) => {
    try {
      await deleteVaultAttachment(attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      toast.success("Attachment removed.");
      onAttachmentChanged?.();
    } catch {
      toast.error("Failed to delete attachment.");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border/80 bg-card/75 p-4 shadow-xs backdrop-blur-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground">
            <Paperclip className="size-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-semibold text-foreground">
                Encrypted Attachments
              </span>
              <span className="rounded-full bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground border border-border/60">
                {attachments.length}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Client-side AES-256-GCM sealed blobs
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          className="hidden"
        />

        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={isUploading || !isVaultUnlocked}
          onClick={() => fileInputRef.current?.click()}
          className="font-mono text-xs gap-1.5 border-border hover:border-primary/40 hover:bg-primary/5"
        >
          {isUploading ? (
            <Loader2 className="size-3 animate-spin text-primary" />
          ) : (
            <Plus className="size-3" />
          )}
          <span>{isUploading ? "Encrypting..." : "Attach File"}</span>
        </Button>
      </div>

      {attachments.length === 0 ? (
        <button
          type="button"
          disabled={isUploading || !isVaultUnlocked}
          onClick={() => fileInputRef.current?.click()}
          className="group flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-5 text-center transition-all hover:border-primary/50 hover:bg-muted/40 cursor-pointer disabled:cursor-not-allowed"
        >
          <div className="flex size-8 items-center justify-center rounded-lg border border-border/80 bg-background/80 text-muted-foreground group-hover:text-primary group-hover:border-primary/40 transition">
            <Plus className="size-4" />
          </div>
          <span className="mt-2 font-mono text-xs font-medium text-foreground/90 group-hover:text-primary transition">
            Attach Recovery Documents or Key Scans
          </span>
          <span className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            ID scans, paper wallet backups, SSH keys • Max 10MB
          </span>
        </button>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 p-2.5 font-mono text-xs transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                  {att.mimeType.startsWith("image/") ? (
                    <ImageIcon className="size-4 text-emerald-500" />
                  ) : (
                    <FileText className="size-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-foreground truncate block text-xs">
                    {att.fileName}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{formatFileSize(att.fileSize)}</span>
                    <span>•</span>
                    <span className="text-emerald-600 dark:text-emerald-400">Encrypted</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={downloadingId === att.id}
                  onClick={() => handleDownload(att)}
                  className="font-mono text-[10px] gap-1 hover:border-primary/50 hover:text-primary"
                >
                  {downloadingId === att.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Download className="size-3" />
                  )}
                  <span>Decrypt</span>
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => handleDelete(att.id)}
                  className="size-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
