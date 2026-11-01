"use client";

import { useRef } from "react";
import { Printer, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EmergencyKitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
  userName: string;
}

export function EmergencyKitDialog({
  open,
  onOpenChange,
  userEmail,
  userName,
}: EmergencyKitDialogProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden custom-scrollbar overscroll-contain">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg border border-emerald-500/35 bg-emerald-500/10 text-emerald-500">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <DialogTitle className="font-mono text-base">
                  Emergency Recovery Kit
                </DialogTitle>
                <DialogDescription className="font-mono text-xs">
                  Physical offline backup for trusted family or physical safe storage.
                </DialogDescription>
              </div>
            </div>

            <Button
              size="sm"
              onClick={handlePrint}
              className="font-mono text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Printer className="size-3.5" />
              Print Kit
            </Button>
          </div>
        </DialogHeader>

        {/* Printable Sheet */}
        <div
          ref={printAreaRef}
          className="rounded-2xl border-2 border-border p-6 bg-card text-card-foreground space-y-6 print:border-black print:p-8 print:text-black print:bg-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="font-mono text-xl font-bold tracking-tight text-foreground">
                ARZUR VAULT // EMERGENCY KIT
              </h2>
              <p className="font-mono text-xs text-muted-foreground mt-0.5">
                Zero-Knowledge Encrypted Digital Vault Recovery Document
              </p>
            </div>
            <div className="font-mono text-xs text-right text-muted-foreground">
              Date: {new Date().toLocaleDateString()}
            </div>
          </div>

          {/* Account Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border p-3 bg-muted/20">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Account Owner
              </span>
              <p className="font-mono text-sm font-semibold">{userName || "Vault Owner"}</p>
            </div>
            <div className="rounded-xl border p-3 bg-muted/20">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Sign-In Email Address
              </span>
              <p className="font-mono text-sm font-semibold truncate">{userEmail}</p>
            </div>
          </div>

          {/* Master Passphrase Slot */}
          <div className="rounded-xl border-2 border-dashed border-emerald-500/40 p-4 bg-emerald-500/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Master Passphrase (Handwrite Below)
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                Never stored unencrypted anywhere
              </span>
            </div>
            <div className="h-16 rounded-lg border border-border bg-background p-2 font-mono text-xs text-muted-foreground flex items-center justify-center">
              [ Write your Master Passphrase clearly in ink here ]
            </div>
          </div>

          {/* Important Security Notice */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2 text-xs font-mono">
            <div className="flex items-center gap-2 text-amber-600 font-semibold">
              <ShieldAlert className="size-4 shrink-0" />
              <span>CRITICAL INSTRUCTIONS FOR RECOVERY</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Keep this printed document in a physically secure location (e.g., a fireproof safe).</li>
              <li>Arzur Vault uses client-side zero-knowledge encryption. If the Master Passphrase is lost, no one (not even system administrators) can recover your encrypted secrets.</li>
              <li>You may grant access to this kit to a trusted legal executor or family member for digital legacy succession.</li>
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
