"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { DynamicPinPad } from "@/components/ui/dynamic-pin-pad";
import { PayPinModal } from "@/components/vault/pay-pin-modal";
import {
  getStoredPayPin,
  removePayPin,
  setPayPin,
  verifyPayPin,
  type StoredPayPin,
} from "@/lib/pay-pin";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function PayPinFeaturePage() {
  const userEmail = "operator@arzur-vault.local";
  const [storedPin, setStoredPin] = useState<StoredPayPin | null>(() =>
    typeof window !== "undefined" ? getStoredPayPin(userEmail) : null
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"set" | "verify">("set");
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const timer = setTimeout(() => {
        setStoredPin(getStoredPayPin(userEmail));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [userEmail]);

  const handleSavePin = async (newPin: string) => {
    try {
      const record = await setPayPin(userEmail, newPin);
      setStoredPin(record);
      setActiveTab("verify");
      toast.success(`Pay PIN created (${newPin.length} digits)!`, {
        description: "Your Pay PIN is now active for authorising pay transactions.",
      });
    } catch {
      toast.error("Failed to save Pay PIN.");
    }
  };

  const handleVerifyPin = async (enteredPin: string) => {
    setVerifyError(null);
    try {
      const isValid = await verifyPayPin(userEmail, enteredPin);
      if (isValid) {
        toast.success("Transaction Authorised Successfully!", {
          description: "Zero-knowledge Pay PIN verification passed.",
        });
        setStoredPin(getStoredPayPin(userEmail));
      } else {
        setVerifyError("Incorrect Pay PIN. Authorization rejected.");
        toast.error("Incorrect Pay PIN");
      }
    } catch {
      setVerifyError("No Pay PIN configured yet. Set one first.");
    }
  };

  const handleRemove = () => {
    removePayPin(userEmail);
    setStoredPin(null);
    setActiveTab("set");
    toast.success("Pay PIN removed.");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-8 cyber-grid-bg relative overflow-x-hidden">
      {/* Background Ambient Glow */}
      <div className="pointer-events-none fixed top-1/4 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-amber-500/10 blur-[130px]" />

      {/* Top Navigation */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-border">
        <div className="flex items-center gap-3">
          <Link
            href="/vault"
            className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span>Return to Vault</span>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="font-mono text-xs font-semibold text-[#FCD535]">
            New Feature: Pay PIN Authorization
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalOpen(true)}
            className="font-mono text-xs gap-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
          >
            <Sparkles className="size-3.5 text-[#FCD535]" />
            Launch Modal Dialog
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-4xl w-full mx-auto my-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left Column: Feature Description & Status */}
        <div className="space-y-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Sparkles className="size-3" />
              STANDALONE SECURITY FEATURE
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono text-foreground">
              Set Pay PIN
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A dedicated transaction security PIN used exclusively to authorise pay operations, high-security transfers, and sensitive exports. Separate from cards and logins.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-xl border border-border w-fit font-mono text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("set")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === "set"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              1. Set Pay PIN
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("verify")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === "verify"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              2. Test Authorise
            </button>
          </div>

          {/* Status Box */}
          {storedPin ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-500" />
                  <span className="font-semibold text-foreground">
                    Active Pay PIN Enrolled
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-[10px]"
                >
                  {storedPin.pinLength} DIGITS
                </Badge>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Stored via zero-knowledge client-side salted SHA-256 verifier. Ready for authorization.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemove}
                className="h-7 text-xs font-mono text-red-600 hover:bg-red-500/10 dark:text-red-400"
              >
                <Trash2 className="size-3 mr-1" />
                Remove Current Pay PIN
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-4 font-mono text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">No Pay PIN configured yet</p>
              <p className="text-[11px]">
                Create a 6-digit dynamic PIN using the interactive pad on the right.
              </p>
            </div>
          )}

          {/* Security Guardrails Box */}
          <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-4 font-mono text-xs shadow-xs">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-500" />
              Dynamic Security Requirements
            </h3>
            <ul className="space-y-2 text-muted-foreground text-[11px]">
              <li className="flex items-start gap-2">
                <span className="text-[#FCD535] font-bold">✓</span>
                <span><strong>No Simple Order:</strong> Rejects sequential numbers like <code>123456</code> or <code>012345</code>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FCD535] font-bold">✓</span>
                <span><strong>No Reverse Order:</strong> Rejects reverse sequences like <code>987654</code> or <code>654321</code>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FCD535] font-bold">✓</span>
                <span><strong>Max 2 Occurrences:</strong> Same number cannot appear more than 2 times (e.g. <code>246824</code> is valid, <code>111234</code> is rejected).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FCD535] font-bold">✓</span>
                <span><strong>Dynamic Scramble Mode:</strong> Randomizes numeric keypad buttons against shoulder-surfers.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: The Dynamic PIN Pad Screen */}
        <div className="flex justify-center">
          {activeTab === "set" ? (
            <DynamicPinPad
              title="Set Pay PIN"
              subtitle="Your Pay PIN will be used to authorise pay transactions"
              label="Create Pay PIN"
              defaultLength={6}
              allowLengthToggle={true}
              confirmLabel="Confirm"
              enforceFintechRules={true}
              onConfirm={handleSavePin}
              className="w-full max-w-sm"
            />
          ) : (
            <DynamicPinPad
              title="Authorise Pay"
              subtitle="Enter your Pay PIN to authorise the transaction"
              label="Enter Pay PIN"
              defaultLength={storedPin?.pinLength === 4 ? 4 : 6}
              allowLengthToggle={false}
              confirmLabel="Authorise"
              enforceFintechRules={false}
              externalError={verifyError}
              onConfirm={handleVerifyPin}
              onBack={() => setActiveTab("set")}
              className="w-full max-w-sm"
            />
          )}
        </div>
      </main>

      {/* Standalone Feature Modal */}
      <PayPinModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={(item) => {
          toast.success(`Pay PIN "${item.title}" encrypted & saved!`);
        }}
      />

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto text-center py-4 text-xs font-mono text-muted-foreground border-t border-border">
        ArzurVault Pay PIN Feature • Standalone Transaction Authorization Security Layer
      </footer>
    </div>
  );
}
