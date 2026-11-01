"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ShieldAlert, Timer } from "lucide-react";
import { generateTotp } from "@/lib/totp";
import { copySecretToClipboard } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TotpDisplayProps {
  secret: string;
  className?: string;
  compact?: boolean;
}

export function TotpDisplay({ secret, className = "", compact = false }: TotpDisplayProps) {
  const [totp, setTotp] = useState<{
    code: string;
    formatted: string;
    remainingSeconds: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function tick() {
      const result = await generateTotp(secret);
      if (mounted) {
        setTotp(result);
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [secret]);

  if (!totp) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldAlert className="size-4 text-amber-500" />
        <span>Invalid TOTP Secret Key</span>
      </div>
    );
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    copySecretToClipboard(totp.code, "2FA Code");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const progressPercent = (totp.remainingSeconds / 30) * 100;
  const isExpiringSoon = totp.remainingSeconds <= 5;

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        title="Click to copy 2FA Code"
        className="group inline-flex items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-2.5 py-1 text-xs font-mono transition hover:border-emerald-500/50 hover:bg-emerald-500/10 dark:bg-zinc-900"
      >
        <span className="font-semibold tracking-wider text-foreground group-hover:text-emerald-500">
          {totp.formatted}
        </span>
        <div className="relative flex size-3.5 items-center justify-center">
          <svg className="size-full -rotate-90" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-border"
            />
            <circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={56.54}
              strokeDashoffset={56.54 - (56.54 * progressPercent) / 100}
              className={`transition-all duration-300 ${
                isExpiringSoon ? "text-red-500" : "text-emerald-500"
              }`}
            />
          </svg>
        </div>
      </button>
    );
  }

  return (
    <div
      className={`flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-2xs ${className}`}
    >
      <div className="flex items-center gap-3">
        {/* Animated Countdown Circle */}
        <div className="relative flex size-10 shrink-0 items-center justify-center">
          <svg className="size-full -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-muted/40"
            />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeDasharray={94.25}
              strokeDashoffset={94.25 - (94.25 * progressPercent) / 100}
              strokeLinecap="round"
              className={`transition-all duration-500 ${
                isExpiringSoon ? "text-red-500" : "text-emerald-500"
              }`}
            />
          </svg>
          <span
            className={`absolute font-mono text-[11px] font-bold ${
              isExpiringSoon ? "text-red-500" : "text-muted-foreground"
            }`}
          >
            {totp.remainingSeconds}
          </span>
        </div>

        <div>
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <Timer className="size-3" />
            <span>2FA Authenticator Code</span>
          </div>
          <div className="font-mono text-xl font-bold tracking-widest text-foreground">
            {totp.formatted}
          </div>
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleCopy}
        className="font-mono text-xs gap-1.5 hover:border-emerald-500/50 hover:text-emerald-500"
      >
        {copied ? (
          <>
            <Check className="size-3.5 text-emerald-500" />
            <span>Copied</span>
          </>
        ) : (
          <>
            <Copy className="size-3.5" />
            <span>Copy Code</span>
          </>
        )}
      </Button>
    </div>
  );
}
