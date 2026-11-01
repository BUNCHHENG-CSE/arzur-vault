"use client";

import { useState } from "react";
import {
  CreditCard,
  Download,
  FileBadge,
  FileCheck,
  FileLock2,
  KeyRound,
  LayoutGrid,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Wallet,
  Wand2,
} from "lucide-react";
import type { VaultCategoryFilter, VaultItemRecord } from "@/types/vault";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PasswordGeneratorDialog } from "@/components/vault/password-generator";

interface VaultSidebarProps {
  activeFilter: VaultCategoryFilter;
  onSelectFilter: (filter: VaultCategoryFilter) => void;
  items: VaultItemRecord[];
  onNavigateMobile?: () => void;
  onOpenAudit?: () => void;
  onOpenBackupImport?: () => void;
  onOpenSettings?: () => void;
  onOpenEmergencyKit?: () => void;
  onOpenSend?: () => void;
  onOpenPayPin?: () => void;
}

export function VaultSidebarContent({
  activeFilter,
  onSelectFilter,
  items,
  onNavigateMobile,
  onOpenAudit,
  onOpenBackupImport,
  onOpenSettings,
  onOpenEmergencyKit,
  onOpenSend,
  onOpenPayPin,
}: VaultSidebarProps) {
  const [generatorOpen, setGeneratorOpen] = useState(false);

  const activeItems = items.filter((item) => !item.deletedAt);
  const trashItems = items.filter((item) => Boolean(item.deletedAt));

  const counts: Record<VaultCategoryFilter, number> = {
    ALL: activeItems.length,
    PASSWORD: activeItems.filter((item) => item.type === "PASSWORD").length,
    PAYMENT_CARD: activeItems.filter((item) => item.type === "PAYMENT_CARD").length,
    IDENTITY: activeItems.filter((item) => item.type === "IDENTITY").length,
    CRYPTO_WALLET: activeItems.filter((item) => item.type === "CRYPTO_WALLET").length,
    SECURE_NOTE: activeItems.filter((item) => item.type === "SECURE_NOTE").length,
    PAY_PIN: activeItems.filter((item) => item.type === "PAY_PIN").length,
    FAVORITES: activeItems.filter((item) => item.favorite).length,
    TRASH: trashItems.length,
  };

  const navItems: {
    id: VaultCategoryFilter;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    accentClass?: string;
    badgeClass?: string;
  }[] = [
    {
      id: "ALL",
      label: "All Items",
      icon: LayoutGrid,
    },
    {
      id: "PASSWORD",
      label: "Logins & Passwords",
      icon: KeyRound,
      accentClass: "text-emerald-600 dark:text-emerald-400",
    },
    {
      id: "PAYMENT_CARD",
      label: "Payment Cards",
      icon: CreditCard,
      accentClass: "text-indigo-600 dark:text-indigo-400",
      badgeClass:
        "border-indigo-500/35 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    },
    {
      id: "IDENTITY",
      label: "Digital Identities",
      icon: FileBadge,
      accentClass: "text-teal-600 dark:text-teal-400",
      badgeClass:
        "border-teal-500/35 bg-teal-500/10 text-teal-700 dark:text-teal-300",
    },
    {
      id: "CRYPTO_WALLET",
      label: "Crypto Wallets",
      icon: Wallet,
      accentClass: "text-amber-600 dark:text-amber-400",
      badgeClass:
        "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
    {
      id: "SECURE_NOTE",
      label: "Secure Notes",
      icon: FileLock2,
      accentClass: "text-cyan-600 dark:text-cyan-400",
    },
    {
      id: "PAY_PIN",
      label: "Pay PINs",
      icon: Sparkles,
      accentClass: "text-[#FCD535] dark:text-[#FCD535]",
      badgeClass:
        "border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      id: "FAVORITES",
      label: "Favorites",
      icon: Star,
      accentClass: "text-amber-500 dark:text-yellow-400",
    },
    {
      id: "TRASH",
      label: "Trash Bin",
      icon: Trash2,
      accentClass: "text-red-500",
      badgeClass:
        trashItems.length > 0
          ? "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300"
          : undefined,
    },
  ];

  const handleSelect = (id: VaultCategoryFilter) => {
    onSelectFilter(id);
    onNavigateMobile?.();
  };

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex size-9 items-center justify-center rounded-lg border border-emerald-500/35 bg-emerald-500/10 text-emerald-600 shadow-[0_4px_14px_-4px_rgba(16,185,129,0.25)] dark:text-emerald-400 dark:shadow-[0_0_20px_-4px_rgba(16,185,129,0.4)]">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <div className="font-mono text-sm font-bold tracking-widest text-sidebar-foreground">
            ARZUR{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              {"//"}
            </span>{" "}
            VAULT
          </div>
          <div className="font-mono text-[10px] font-medium text-emerald-600 dark:text-emerald-400/90">
            ZERO-KNOWLEDGE E2EE
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-4 custom-scrollbar overscroll-contain">
        <p className="px-2.5 pb-2 font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          Encrypted Vaults
        </p>

        {navItems.map((nav) => {
          const Icon = nav.icon;
          const isActive = activeFilter === nav.id;
          return (
            <button
              key={nav.id}
              type="button"
              onClick={() => handleSelect(nav.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-all",
                isActive
                  ? "border border-border bg-sidebar-accent text-sidebar-accent-foreground shadow-xs"
                  : "border border-transparent text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <span className="flex items-center gap-2.5">
                <Icon
                  className={cn(
                    "size-4",
                    isActive
                      ? nav.accentClass ||
                          "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  )}
                />
                <span>{nav.label}</span>
              </span>

              <Badge
                variant="outline"
                className={cn(
                  "h-5 min-w-6 justify-center border-border bg-background font-mono text-[10px] text-muted-foreground",
                  isActive &&
                    (nav.badgeClass ||
                      "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")
                )}
              >
                {counts[nav.id]}
              </Badge>
            </button>
          );
        })}

        <div className="pt-4 space-y-1">
          <p className="px-2.5 pb-2 font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Security & Tools
          </p>

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenPayPin?.();
              onNavigateMobile?.();
            }}
            className="w-full justify-start gap-2.5 font-mono text-xs text-muted-foreground hover:text-amber-500 dark:hover:text-amber-400 group"
          >
            <Sparkles className="size-4 text-[#FCD535]" />
            <span>Pay PIN Feature</span>
            <Badge variant="outline" className="ml-auto text-[9px] border-amber-500/40 bg-amber-500/10 text-amber-500 font-semibold px-1.5 py-0">
              NEW
            </Badge>
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenAudit?.();
              onNavigateMobile?.();
            }}
            className="w-full justify-start gap-2.5 font-mono text-xs text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            <ShieldCheck className="size-4 text-emerald-500" />
            Security Health Audit
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenSend?.();
              onNavigateMobile?.();
            }}
            className="w-full justify-start gap-2.5 font-mono text-xs text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            <Send className="size-4 text-emerald-500" />
            Arzur Send (Burn Links)
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => setGeneratorOpen(true)}
            className="w-full justify-start gap-2.5 font-mono text-xs text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            <Wand2 className="size-4 text-emerald-500" />
            Password Generator
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenBackupImport?.();
              onNavigateMobile?.();
            }}
            className="w-full justify-start gap-2.5 font-mono text-xs text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            <Download className="size-4 text-indigo-500" />
            Backup & Import
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenEmergencyKit?.();
              onNavigateMobile?.();
            }}
            className="w-full justify-start gap-2.5 font-mono text-xs text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            <FileCheck className="size-4 text-amber-500" />
            Emergency Kit
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenSettings?.();
              onNavigateMobile?.();
            }}
            className="w-full justify-start gap-2.5 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            <Settings className="size-4" />
            Vault Settings
          </Button>
        </div>
      </nav>

      {/* Security Telemetry Footer */}
      <div className="border-t border-sidebar-border p-4">
        <div className="space-y-2 rounded-xl border border-border bg-muted/45 p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
              CIPHER ENGINE
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              WebCrypto
            </span>
          </div>
          <div className="space-y-0.5 font-mono text-[10px] text-muted-foreground">
            <p>Algorithm: AES-256-GCM (96b IV)</p>
            <p>KDF: PBKDF2-SHA256 (310,000x)</p>
            <p>TOTP: RFC 6238 Live</p>
          </div>
        </div>
      </div>

      <PasswordGeneratorDialog
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
      />
    </div>
  );
}

export function VaultSidebar(props: VaultSidebarProps) {
  return (
    <aside className="hidden w-68 shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col h-full overflow-hidden">
      <VaultSidebarContent {...props} />
    </aside>
  );
}
