"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system", resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={(resolvedTheme ?? theme ?? "system") as ToasterProps["theme"]}
      className="toaster group"
      gap={10}
      visibleToasts={4}
      icons={{
        success: (
          <CircleCheckIcon className="size-4 shrink-0 text-emerald-500 drop-shadow-[0_0_8px_rgba(52,211,153,0.55)] dark:text-emerald-400" />
        ),
        info: (
          <InfoIcon className="size-4 shrink-0 text-sky-500 drop-shadow-[0_0_8px_rgba(56,189,248,0.55)] dark:text-sky-400" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4 shrink-0 text-amber-500 drop-shadow-[0_0_8px_rgba(251,191,36,0.55)] dark:text-amber-400" />
        ),
        error: (
          <OctagonXIcon className="size-4 shrink-0 text-rose-500 drop-shadow-[0_0_8px_rgba(251,113,133,0.55)] dark:text-rose-400" />
        ),
        loading: (
          <Loader2Icon className="size-4 shrink-0 animate-spin text-emerald-500 drop-shadow-[0_0_8px_rgba(52,211,153,0.55)] dark:text-emerald-400" />
        ),
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast font-sans text-xs antialiased rounded-xl border p-3.5 shadow-2xl backdrop-blur-md select-none transition-all",
          title: "font-mono text-xs font-semibold tracking-tight leading-snug",
          description: "font-sans text-[11px] leading-relaxed opacity-90",
          actionButton:
            "!font-mono !text-xs !font-medium !rounded-md !px-2.5 !py-1 !transition-colors !bg-primary !text-primary-foreground hover:!opacity-90",
          cancelButton:
            "!font-mono !text-xs !font-medium !rounded-md !px-2.5 !py-1 !transition-colors !bg-muted !text-muted-foreground hover:!bg-muted/80",
          closeButton:
            "!border !shadow-sm transition-all hover:scale-105 active:scale-95",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
