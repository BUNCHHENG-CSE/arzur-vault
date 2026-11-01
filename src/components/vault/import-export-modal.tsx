"use client";

import { useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Download,
  FileCheck,
  FileText,
  Loader2,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { batchCreateVaultItems } from "@/actions/vault-actions";
import { useVault } from "@/context/vault-context";
import {
  generateEncryptedBackup,
  parseImportData,
  type ImportedParsedItem,
} from "@/lib/vault-export-import";
import type { VaultItemRecord } from "@/types/vault";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ImportExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: VaultItemRecord[];
  onItemsImported: (newItems: VaultItemRecord[]) => void;
  onOpenEmergencyKit: () => void;
}

export function ImportExportModal({
  open,
  onOpenChange,
  items,
  onItemsImported,
  onOpenEmergencyKit,
}: ImportExportModalProps) {
  const { isVaultUnlocked, encryptPayload } = useVault();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [importSource, setImportSource] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ImportedParsedItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Export encrypted backup
  const handleExportBackup = () => {
    try {
      const backupJson = generateEncryptedBackup(items);
      const blob = new Blob([backupJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `arzur-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Encrypted backup downloaded successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export backup.");
    }
  };

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const result = parseImportData(text);
      setImportSource(result.source);
      setParsedItems(result.items);

      if (result.items.length === 0) {
        toast.error(
          result.source === "ArzurVault"
            ? "Arzur encrypted backups can be restored by re-importing through database sync."
            : "Could not detect valid login records from file. Supported: Bitwarden, 1Password, Chrome CSV."
        );
      } else {
        toast.success(`Detected ${result.items.length} items from ${result.source}!`);
      }
    };
    reader.readAsText(file);
  };

  // Perform client-side encryption and batch commit
  const handleConfirmImport = async () => {
    if (!isVaultUnlocked) {
      toast.error("Unlock vault first to encrypt imported records.");
      return;
    }
    if (parsedItems.length === 0) return;

    setIsImporting(true);
    try {
      const batchPayloads = [];

      for (const item of parsedItems) {
        const encrypted = await encryptPayload(item.secretPayload);
        batchPayloads.push({
          type: item.type,
          title: item.title,
          subtitle: item.subtitle || null,
          url: item.url || null,
          category: item.category || "Imported",
          favorite: item.favorite || false,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          salt: encrypted.salt,
        });
      }

      const created = await batchCreateVaultItems(batchPayloads);
      toast.success(`Successfully encrypted and imported ${created.length} vault items!`);
      onItemsImported(created);
      setParsedItems([]);
      setImportSource(null);
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      toast.error("Failed during batch import encryption.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg border border-emerald-500/35 bg-emerald-500/10 text-emerald-500">
              <Download className="size-4" />
            </div>
            <div>
              <DialogTitle className="font-mono text-base">
                Vault Backup & Import
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">
                Zero-Knowledge export, Bitwarden/Chrome migration, and recovery kit.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="export" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="font-mono text-xs gap-1.5">
              <ArrowUpFromLine className="size-3.5" />
              Export & Backup
            </TabsTrigger>
            <TabsTrigger value="import" className="font-mono text-xs gap-1.5">
              <ArrowDownToLine className="size-3.5" />
              Import Passwords
            </TabsTrigger>
          </TabsList>

          {/* Export View */}
          <TabsContent value="export" className="space-y-4 pt-3">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h4 className="font-mono text-sm font-semibold text-foreground">
                    Encrypted JSON Backup
                  </h4>
                  <p className="font-mono text-xs text-muted-foreground mt-0.5">
                    Exports all {items.length} items with their existing AES-256-GCM ciphertexts intact. Completely safe to store on cloud drives or offline USB.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleExportBackup}
                className="w-full font-mono text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <Download className="size-3.5" />
                Download Encrypted Backup (.json)
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-500">
                  <FileText className="size-5" />
                </div>
                <div>
                  <h4 className="font-mono text-sm font-semibold text-foreground">
                    Printable Emergency Recovery Kit
                  </h4>
                  <p className="font-mono text-xs text-muted-foreground mt-0.5">
                    Generate an offline physical 1Password-style recovery sheet for safe keeping in a safe or with a trusted family executor.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onOpenEmergencyKit();
                }}
                className="w-full font-mono text-xs gap-2"
              >
                <FileCheck className="size-3.5" />
                Open Emergency Kit
              </Button>
            </div>
          </TabsContent>

          {/* Import View */}
          <TabsContent value="import" className="space-y-4 pt-3">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.json"
              onChange={handleFileChange}
              className="hidden"
            />

            {parsedItems.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-8 text-center cursor-pointer transition hover:border-emerald-500/50 hover:bg-muted/30"
              >
                <UploadCloud className="size-10 text-muted-foreground mb-3" />
                <h4 className="font-mono text-sm font-semibold text-foreground">
                  Click to select CSV or JSON export
                </h4>
                <p className="font-mono text-xs text-muted-foreground mt-1 max-w-sm">
                  Supports CSV exports from Bitwarden, Google Chrome, and 1Password.
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <span className="font-mono text-[10px] bg-muted px-2 py-0.5 rounded border">
                    Bitwarden (.csv)
                  </span>
                  <span className="font-mono text-[10px] bg-muted px-2 py-0.5 rounded border">
                    Chrome (.csv)
                  </span>
                  <span className="font-mono text-[10px] bg-muted px-2 py-0.5 rounded border">
                    1Password (.csv)
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <div>
                    <span className="font-mono text-xs font-semibold text-emerald-500">
                      {importSource} File Detected
                    </span>
                    <p className="font-mono text-xs text-muted-foreground">
                      Found {parsedItems.length} accounts ready to be encrypted client-side.
                    </p>
                  </div>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      setParsedItems([]);
                      setImportSource(null);
                    }}
                    className="font-mono text-xs"
                  >
                    Change File
                  </Button>
                </div>

                <div className="max-h-48 overflow-y-auto overflow-x-hidden space-y-1.5 border rounded-lg p-2 bg-muted/20 custom-scrollbar overscroll-contain pr-1">
                  {parsedItems.slice(0, 10).map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs font-mono px-2 py-1 bg-card rounded border"
                    >
                      <span className="font-semibold truncate">{it.title}</span>
                      <span className="text-muted-foreground truncate">{it.subtitle}</span>
                    </div>
                  ))}
                  {parsedItems.length > 10 && (
                    <div className="text-center font-mono text-[11px] text-muted-foreground pt-1">
                      ...and {parsedItems.length - 10} more items
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  disabled={isImporting || !isVaultUnlocked}
                  onClick={handleConfirmImport}
                  className="w-full font-mono text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Encrypting & Storing in Vault...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-3.5" />
                      Encrypt & Import {parsedItems.length} Items
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
