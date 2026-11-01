"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { DynamicPinPad } from "@/components/ui/dynamic-pin-pad";
import { DynamicPinModal } from "@/components/vault/dynamic-pin-modal";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export default function PinDemoPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmedPin, setConfirmedPin] = useState<string>("246824");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-8 cyber-grid-bg relative overflow-x-hidden">
      {/* Background Accent Glow */}
      <div className="pointer-events-none fixed top-1/4 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-amber-500/10 blur-[130px]" />

      {/* Top Header */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-border">
        <div className="flex items-center gap-3">
          <Link
            href="/vault"
            className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span>Back to Vault</span>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="font-mono text-xs font-semibold text-[#FCD535]">
            Dynamic PIN Redesign Showcase
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
            Test as Dialog Modal
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl w-full mx-auto my-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Left Column: Information & Details */}
        <div className="space-y-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Sparkles className="size-3" />
              FINTECH REFERENCE REDESIGN
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono text-foreground">
              Dynamic Pay PIN
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Designed after the modern payment &amp; transaction authorization screen. Supports dynamic 4/6 digit length, responsive slot boxes, shoulder-surfing scrambled keypad, and strict banking-grade sequence validation.
            </p>
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-4 font-mono text-xs shadow-xs">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-500" />
              Active Security Guardrails
            </h3>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span><strong>No Simple Sequences:</strong> Rejects <code>123456</code>, <code>012345</code>, etc.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span><strong>No Reverse Sequences:</strong> Rejects <code>987654</code>, <code>654321</code>, etc.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span><strong>Max 2 Occurrences:</strong> No digit may appear more than twice (e.g. <code>246824</code> is valid, <code>111234</code> is rejected).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FCD535] font-bold">✓</span>
                <span><strong>Anti-Shoulder Surfing:</strong> Tap <em>Scramble Keypad</em> to randomize digit button positions.</span>
              </li>
            </ul>
          </div>

          {confirmedPin && (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 font-mono text-xs flex items-center justify-between">
              <div>
                <span className="text-muted-foreground">Last Confirmed PIN:</span>
                <span className="ml-2 font-bold text-foreground text-sm tracking-widest">{confirmedPin}</span>
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                ✓ Verified
              </span>
            </div>
          )}
        </div>

        {/* Right Column: The Dynamic PIN Pad (Matching Reference Screenshot) */}
        <div className="flex justify-center">
          <DynamicPinPad
            title="Set Pay PIN"
            subtitle="Your Pay PIN will be used to authorise pay transactions"
            label="Create Pay PIN"
            value="246824"
            defaultLength={6}
            allowLengthToggle={true}
            confirmLabel="Confirm"
            onConfirm={(pin) => {
              setConfirmedPin(pin);
              toast.success(`Dynamic Pay PIN confirmed: ${pin}`);
            }}
            className="w-full max-w-sm"
          />
        </div>
      </main>

      {/* Modal Dialog Showcase */}
      <DynamicPinModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialPin={confirmedPin}
        onPinConfirmed={(pin) => {
          setConfirmedPin(pin);
          toast.success(`Pay PIN updated via Dialog: ${pin}`);
        }}
        title="Set Pay PIN"
        subtitle="Your Pay PIN will be used to authorise pay transactions"
        label="Create Pay PIN"
        confirmLabel="Confirm PIN"
        defaultLength={6}
        allowLengthToggle={true}
        enforceFintechRules={true}
      />

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto text-center py-4 text-xs font-mono text-muted-foreground border-t border-border">
        ArzurVault Dynamic PIN Security Component • Built with Next.js &amp; Tailwind CSS
      </footer>
    </div>
  );
}
