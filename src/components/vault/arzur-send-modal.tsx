"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Flame,
  Globe,
  Link as LinkIcon,
  Loader2,
  Lock,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createVaultSend,
  deleteVaultSend,
  listUserVaultSends,
} from "@/actions/vault-actions";
import { encryptForSend } from "@/lib/send-crypto";
import { copySecretToClipboard } from "@/lib/utils";
import type { VaultSendRecord } from "@/types/vault";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface ArzurSendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillSecret?: string;
  prefillTitle?: string;
}

export function ArzurSendModal({
  open,
  onOpenChange,
  prefillSecret = "",
  prefillTitle = "",
}: ArzurSendModalProps) {
  const [title, setTitle] = useState(prefillTitle || "");
  const [secretText, setSecretText] = useState(prefillSecret || "");
  const [burnOnRead, setBurnOnRead] = useState(true);
  const [hoursToExpire, setHoursToExpire] = useState(24);
  const [usePassword, setUsePassword] = useState(false);
  const [recipientPassword, setRecipientPassword] = useState("");

  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Active sends list
  const [activeSends, setActiveSends] = useState<VaultSendRecord[]>([]);
  const [isLoadingSends, setIsLoadingSends] = useState(false);

  const loadActiveSends = useCallback(async () => {
    setIsLoadingSends(true);
    try {
      const sends = await listUserVaultSends();
      setActiveSends(sends as VaultSendRecord[]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingSends(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        void loadActiveSends();
        if (prefillSecret) setSecretText(prefillSecret);
        if (prefillTitle) setTitle(prefillTitle);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open, prefillSecret, prefillTitle, loadActiveSends]);

  const handleCreateSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretText.trim()) {
      toast.error("Secret content is required.");
      return;
    }

    setIsCreating(true);
    try {
      // 1. Encrypt client-side: encryption key lives in URL hash fragment
      const encrypted = await encryptForSend(
        secretText,
        usePassword ? recipientPassword : undefined
      );

      // 2. Commit ciphertext and options to server
      const sendRecord = await createVaultSend({
        title: title.trim() || "Confidential Secret",
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        burnOnRead,
        maxViews: burnOnRead ? 1 : 10,
        hoursToExpire,
        passwordProtected: usePassword && Boolean(recipientPassword.trim()),
        passwordSalt: encrypted.passwordSalt,
      });

      // 3. Assemble link: https://domain/send/{id}#{keyFragment}
      const origin = window.location.origin;
      const fullShareLink = `${origin}/send/${sendRecord.id}#${encrypted.keyFragment}`;

      setGeneratedLink(fullShareLink);
      toast.success("Zero-Knowledge secure send link created!");
      loadActiveSends();
    } catch (err) {
      console.error(err);
      toast.error("Failed to encrypt and create send link.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSend = async (id: string) => {
    try {
      await deleteVaultSend(id);
      setActiveSends((prev) => prev.filter((s) => s.id !== id));
      toast.success("Shared secret revoked and purged.");
    } catch {
      toast.error("Failed to revoke share link.");
    }
  };

  const handleCopyLink = () => {
    if (!generatedLink) return;
    copySecretToClipboard(generatedLink, "Secret Share Link");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg border border-emerald-500/35 bg-emerald-500/10 text-emerald-500">
              <Send className="size-4" />
            </div>
            <div>
              <DialogTitle className="font-mono text-base">
                Arzur Send // Ephemeral Secret Sharing
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">
                Burn-after-reading encrypted links. Server never sees the decryption key.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create" className="font-mono text-xs gap-1.5">
              <Plus className="size-3.5" />
              Create Secret Link
            </TabsTrigger>
            <TabsTrigger value="active" className="font-mono text-xs gap-1.5">
              <Globe className="size-3.5" />
              Active Shares ({activeSends.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4 pt-3">
            {generatedLink ? (
              <div className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-semibold">
                  <ShieldCheck className="size-4" />
                  <span>Secure Link Ready for Recipient</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-mono text-xs text-muted-foreground">
                    Shareable Link (Decryption key stored in #hash)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={generatedLink}
                      className="font-mono text-xs bg-background"
                    />
                    <Button
                      type="button"
                      onClick={handleCopyLink}
                      className="font-mono text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 gap-1.5"
                    >
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copied ? "Copied" : "Copy Link"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-3 font-mono text-[11px] text-muted-foreground space-y-1">
                  <p>• {burnOnRead ? "Burns after 1 view" : `Expires in ${hoursToExpire} hours`}</p>
                  <p>• End-to-end encrypted with Web Crypto AES-256-GCM</p>
                  {usePassword && <p>• Recipient password required to decrypt</p>}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setGeneratedLink(null);
                    setSecretText("");
                    setTitle("");
                  }}
                  className="w-full font-mono text-xs"
                >
                  Create Another Link
                </Button>
              </div>
            ) : (
              <form onSubmit={handleCreateSend} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label className="font-mono text-xs">Secret Title / Label</Label>
                  <Input
                    placeholder="e.g. AWS Production Token, Staging Database Password"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-mono text-xs">Confidential Text / Secret *</Label>
                  <Textarea
                    placeholder="Paste the secret, password, private key, or sensitive note..."
                    rows={4}
                    value={secretText}
                    onChange={(e) => setSecretText(e.target.value)}
                    className="font-mono text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="font-mono text-xs">Expiration Window</Label>
                    <Select
                      value={hoursToExpire.toString()}
                      onValueChange={(val) => {
                        if (val) setHoursToExpire(parseInt(val, 10));
                      }}
                    >
                      <SelectTrigger className="font-mono text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1" className="font-mono text-xs">
                          1 Hour
                        </SelectItem>
                        <SelectItem value="24" className="font-mono text-xs">
                          24 Hours (1 Day)
                        </SelectItem>
                        <SelectItem value="168" className="font-mono text-xs">
                          7 Days
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col justify-end">
                    <div className="flex items-center justify-between rounded-lg border p-2.5 bg-muted/20">
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <Flame className="size-3.5 text-amber-500" />
                        <span>Burn on Read</span>
                      </div>
                      <Switch
                        checked={burnOnRead}
                        onCheckedChange={setBurnOnRead}
                      />
                    </div>
                  </div>
                </div>

                {/* Password Protection */}
                <div className="space-y-2 rounded-xl border border-border p-3 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <Lock className="size-3.5 text-indigo-500" />
                      <span>Require Recipient Password</span>
                    </div>
                    <Switch
                      checked={usePassword}
                      onCheckedChange={setUsePassword}
                    />
                  </div>

                  {usePassword && (
                    <Input
                      type="password"
                      placeholder="Enter password recipient must supply"
                      value={recipientPassword}
                      onChange={(e) => setRecipientPassword(e.target.value)}
                      className="font-mono text-xs bg-background"
                      required={usePassword}
                    />
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isCreating}
                  className="w-full font-mono text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Generating Zero-Knowledge Link...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="size-3.5" />
                      Generate Encrypted Share Link
                    </>
                  )}
                </Button>
              </form>
            )}
          </TabsContent>

          {/* Active Sends */}
          <TabsContent value="active" className="space-y-3 pt-3">
            {isLoadingSends ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeSends.length === 0 ? (
              <p className="text-center py-8 font-mono text-xs text-muted-foreground">
                No active shared links. Links automatically purge when burned or expired.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto overflow-x-hidden custom-scrollbar overscroll-contain pr-1">
                {activeSends.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-3 font-mono text-xs shadow-2xs"
                  >
                    <div>
                      <span className="font-semibold text-foreground block">
                        {s.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Views: {s.viewCount} / {s.maxViews} • {s.burnOnRead ? "Burn on read" : "Timed link"}
                      </span>
                    </div>

                    <Button
                      type="button"
                      size="xs"
                      variant="destructive"
                      onClick={() => handleDeleteSend(s.id)}
                      className="font-mono text-[10px] gap-1"
                    >
                      <Trash2 className="size-3" />
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
