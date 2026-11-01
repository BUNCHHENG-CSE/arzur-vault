"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { DynamicPinPad } from "@/components/ui/dynamic-pin-pad";

export interface DynamicPinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPin?: string;
  onPinConfirmed: (pin: string) => void;
  title?: string;
  subtitle?: string;
  label?: string;
  confirmLabel?: string;
  defaultLength?: 4 | 6;
  allowLengthToggle?: boolean;
  enforceFintechRules?: boolean;
}

export function DynamicPinModal({
  open,
  onOpenChange,
  initialPin = "",
  onPinConfirmed,
  title = "Set Pay PIN",
  subtitle = "Your Pay PIN will be used to authorise pay transactions",
  label = "Create Pay PIN",
  confirmLabel = "Confirm",
  defaultLength = 6,
  allowLengthToggle = true,
  enforceFintechRules = true,
}: DynamicPinModalProps) {
  const handleConfirm = (confirmedPin: string) => {
    onPinConfirmed(confirmedPin);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-sm w-full mx-auto sm:rounded-2xl overflow-hidden focus:outline-none">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DynamicPinPad
          title={title}
          subtitle={subtitle}
          label={label}
          confirmLabel={confirmLabel}
          value={initialPin}
          defaultLength={defaultLength}
          allowLengthToggle={allowLengthToggle}
          enforceFintechRules={enforceFintechRules}
          onConfirm={handleConfirm}
          onBack={() => onOpenChange(false)}
          className="w-full border border-zinc-800 shadow-2xl"
        />
      </DialogContent>
    </Dialog>
  );
}
