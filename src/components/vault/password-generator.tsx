"use client";

import { useCallback, useState } from "react";
import { Check, Copy, RefreshCw, ShieldCheck, Wand2 } from "lucide-react";
import {
  calculatePasswordEntropy,
  generateSecurePassword,
  type PasswordGeneratorOptions,
} from "@/lib/crypto";
import { copySecretToClipboard } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface PasswordGeneratorProps {
  onUsePassword?: (password: string) => void;
  compact?: boolean;
}

const DEFAULT_GENERATOR_OPTIONS: PasswordGeneratorOptions = {
  length: 24,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
};

export function PasswordGenerator({
  onUsePassword,
  compact = false,
}: PasswordGeneratorProps) {
  const [options, setOptions] = useState<PasswordGeneratorOptions>(
    DEFAULT_GENERATOR_OPTIONS
  );
  const [generated, setGenerated] = useState(() =>
    typeof window !== "undefined"
      ? generateSecurePassword(DEFAULT_GENERATOR_OPTIONS)
      : ""
  );
  const [copied, setCopied] = useState(false);

  const regenerate = useCallback((opts: PasswordGeneratorOptions) => {
    if (typeof window === "undefined") return;
    const nextPassword = generateSecurePassword(opts);
    setGenerated(nextPassword);
    setCopied(false);
  }, []);

  const updateOption = <K extends keyof PasswordGeneratorOptions>(
    key: K,
    value: PasswordGeneratorOptions[K]
  ) => {
    const next = { ...options, [key]: value };
    // Prevent turning off every character pool simultaneously
    if (!next.uppercase && !next.lowercase && !next.numbers && !next.symbols) {
      return;
    }
    setOptions(next);
    regenerate(next);
  };

  const handleCopy = async () => {
    if (!generated) return;
    const ok = await copySecretToClipboard(generated, "Generated password");
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const strength = calculatePasswordEntropy(generated);

  return (
    <div className="space-y-4">
      {/* Generated Output Display */}
      <div className="space-y-3 rounded-xl border border-border bg-muted/45 p-3.5 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-sm leading-relaxed font-medium break-all text-emerald-700 select-all dark:text-emerald-300">
            {generated || "Generating..."}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => regenerate(options)}
              title="Regenerate CSPRNG password"
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleCopy}
              title="Copy password (auto-clears in 30s)"
              className="text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Entropy Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-mono text-muted-foreground">
              CSPRNG Entropy:{" "}
              <span className="font-semibold text-foreground">
                {strength.bits} bits
              </span>
            </span>
            <Badge
              variant="outline"
              className={`border-border bg-background font-mono text-[10px] ${strength.colorClass}`}
            >
              {strength.label}
            </Badge>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/70">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-300 dark:bg-emerald-500"
              style={{ width: `${strength.barPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Length Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-foreground/90">Password Length</Label>
          <span className="rounded border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {options.length} chars
          </span>
        </div>
        <input
          type="range"
          min={8}
          max={64}
          value={options.length}
          onChange={(e) => updateOption("length", Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-emerald-600 dark:accent-emerald-500"
        />
        <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>8</span>
          <span>16</span>
          <span>32</span>
          <span>48</span>
          <span>64</span>
        </div>
      </div>

      {/* Character Pool Toggles */}
      <div
        className={`grid gap-2.5 ${compact ? "grid-cols-2" : "grid-cols-2"}`}
      >
        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/35 px-3 py-2 transition hover:border-foreground/25">
          <span className="font-mono text-xs text-foreground/90">
            A–Z Uppercase
          </span>
          <Switch
            size="sm"
            checked={options.uppercase}
            onCheckedChange={(checked) => updateOption("uppercase", checked)}
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/35 px-3 py-2 transition hover:border-foreground/25">
          <span className="font-mono text-xs text-foreground/90">
            a–z Lowercase
          </span>
          <Switch
            size="sm"
            checked={options.lowercase}
            onCheckedChange={(checked) => updateOption("lowercase", checked)}
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/35 px-3 py-2 transition hover:border-foreground/25">
          <span className="font-mono text-xs text-foreground/90">
            0–9 Numbers
          </span>
          <Switch
            size="sm"
            checked={options.numbers}
            onCheckedChange={(checked) => updateOption("numbers", checked)}
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/35 px-3 py-2 transition hover:border-foreground/25">
          <span className="font-mono text-xs text-foreground/90">
            !@#$ Symbols
          </span>
          <Switch
            size="sm"
            checked={options.symbols}
            onCheckedChange={(checked) => updateOption("symbols", checked)}
          />
        </label>
      </div>

      {onUsePassword ? (
        <Button
          type="button"
          onClick={() => onUsePassword(generated)}
          className="w-full bg-emerald-600 font-mono text-xs font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
        >
          <Wand2 className="size-3.5" />
          USE THIS PASSWORD
        </Button>
      ) : (
        <Button
          type="button"
          onClick={handleCopy}
          className="w-full bg-emerald-600 font-mono text-xs font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
        >
          <Copy className="size-3.5" />
          COPY SECURE PASSWORD (30S AUTO-CLEAR)
        </Button>
      )}
    </div>
  );
}

interface PasswordGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PasswordGeneratorDialog({
  open,
  onOpenChange,
}: PasswordGeneratorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg border border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <DialogTitle className="font-mono text-base">
                Cryptographic Password Generator
              </DialogTitle>
              <DialogDescription className="text-xs">
                Unbiased Web Crypto CSPRNG entropy — generated locally in RAM.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <PasswordGenerator />
      </DialogContent>
    </Dialog>
  );
}
