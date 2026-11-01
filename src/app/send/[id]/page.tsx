"use client";

import { use, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Flame,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { getPublicVaultSend } from "@/actions/vault-actions";
import { decryptFromSend } from "@/lib/send-crypto";
import { copySecretToClipboard } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PublicSendData {
  title: string;
  ciphertext: string;
  iv: string;
  salt: string | null;
  passwordProtected: boolean;
  passwordSalt: string | null;
  burnOnRead: boolean;
  viewsRemaining: number;
}

function PublicSendContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sendData, setSendData] = useState<{
    title: string;
    ciphertext: string;
    iv: string;
    salt: string | null;
    passwordProtected: boolean;
    passwordSalt: string | null;
    burnOnRead: boolean;
    viewsRemaining: number;
  } | null>(null);

  const [password, setPassword] = useState("");
  const [decryptedSecret, setDecryptedSecret] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchSend() {
      setIsLoading(true);
      try {
        const res = await getPublicVaultSend(id);
        if ("error" in res && res.error) {
          setErrorMsg(res.error);
        } else if ("ciphertext" in res && res.ciphertext && res.iv) {
          setSendData(res as PublicSendData);

          // If not password protected, attempt immediate client-side decryption
          const keyFragment = window.location.hash.replace(/^#/, "");
          if (!res.passwordProtected && keyFragment) {
            try {
              const text = await decryptFromSend(
                res.ciphertext,
                res.iv,
                keyFragment,
                undefined,
                res.passwordSalt
              );
              setDecryptedSecret(text);
            } catch (e) {
              console.error(e);
              setErrorMsg("Failed to decrypt secret with the provided link key.");
            }
          }
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Failed to load secure link.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchSend();
  }, [id]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendData) return;

    const keyFragment = window.location.hash.replace(/^#/, "");
    if (!keyFragment) {
      toast.error("Decryption key missing from URL hash.");
      return;
    }

    setDecrypting(true);
    try {
      const text = await decryptFromSend(
        sendData.ciphertext,
        sendData.iv,
        keyFragment,
        password,
        sendData.passwordSalt
      );
      setDecryptedSecret(text);
      toast.success("Secret unlocked successfully!");
    } catch {
      toast.error("Incorrect password or corrupt key.");
    } finally {
      setDecrypting(false);
    }
  };

  const handleCopy = () => {
    if (!decryptedSecret) return;
    copySecretToClipboard(decryptedSecret, "Shared Secret");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 cyber-grid-bg">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card/95 p-6 shadow-2xl backdrop-blur sm:p-8">
        {/* Brand Header */}
        <div className="flex items-center gap-3 border-b border-border pb-4 mb-6">
          <div className="flex size-10 items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <h1 className="font-mono text-sm font-bold tracking-widest text-foreground">
              ARZUR <span className="text-emerald-600 dark:text-emerald-400">{"//"}</span> SEND
            </h1>
            <p className="font-mono text-[10px] text-muted-foreground">
              End-to-End Encrypted Ephemeral Secret
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 font-mono text-xs text-muted-foreground">
            <Loader2 className="size-8 animate-spin text-emerald-500" />
            <span>Retrieving zero-knowledge envelope...</span>
          </div>
        ) : errorMsg ? (
          <div className="space-y-4 text-center py-8">
            <div className="flex size-12 items-center justify-center rounded-full bg-red-500/10 text-red-500 mx-auto">
              <Flame className="size-6" />
            </div>
            <div className="space-y-1">
              <h2 className="font-mono text-base font-bold text-foreground">
                Secret Unavailable
              </h2>
              <p className="font-mono text-xs text-muted-foreground max-w-sm mx-auto">
                {errorMsg}
              </p>
            </div>
            <Button
              render={<Link href="/vault" />}
              variant="outline"
              size="sm"
              className="font-mono text-xs mt-2"
            >
              Open Arzur Vault
            </Button>
          </div>
        ) : decryptedSecret ? (
          <div className="space-y-5">
            <div>
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Shared Secret
              </span>
              <h2 className="font-mono text-base font-bold text-foreground mt-0.5">
                {sendData?.title || "Confidential Secret"}
              </h2>
            </div>

            <div className="relative rounded-xl border border-border bg-muted/30 p-4 font-mono text-sm break-all text-foreground leading-relaxed dark:bg-zinc-950">
              <pre className="whitespace-pre-wrap">{decryptedSecret}</pre>
            </div>

            <Button
              type="button"
              onClick={handleCopy}
              className="w-full font-mono text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied to Clipboard" : "Copy Secret to Clipboard"}
            </Button>

            {sendData?.burnOnRead && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 font-mono text-xs text-amber-700 dark:text-amber-300">
                <Flame className="size-4 shrink-0 text-amber-500" />
                <span>
                  This secret was configured to burn after reading. It has now been permanently purged from the server.
                </span>
              </div>
            )}
          </div>
        ) : sendData?.passwordProtected ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold text-foreground">
                <Lock className="size-4 text-indigo-500" />
                <span>Password Required</span>
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                The sender protected this secret with a password. Enter it below to decrypt:
              </p>
            </div>

            <Input
              type="password"
              placeholder="Enter decryption password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="font-mono text-xs"
              required
            />

            <Button
              type="submit"
              disabled={decrypting || !password}
              className="w-full font-mono text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {decrypting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Decrypting Payload...
                </>
              ) : (
                <>
                  <KeyRound className="size-3.5" />
                  Unlock &amp; Decrypt Secret
                </>
              )}
            </Button>
          </form>
        ) : (
          <div className="text-center py-6 font-mono text-xs text-muted-foreground">
            Missing decryption key fragment in URL. Please check the full link provided by the sender.
          </div>
        )}
      </div>
    </div>
  );
}

export default function PublicSendPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="size-8 animate-spin text-emerald-500" />
        </div>
      }
    >
      <PublicSendContent params={params} />
    </Suspense>
  );
}
