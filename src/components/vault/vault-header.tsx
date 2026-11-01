"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  CreditCard,
  FileBadge,
  FileLock2,
  KeyRound,
  Lock,
  LogOut,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { useVault } from "@/context/vault-context";
import { signOut } from "@/lib/auth-client";
import type {
  VaultCategoryFilter,
  VaultItemRecord,
  VaultItemType,
} from "@/types/vault";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { VaultSidebarContent } from "@/components/vault/vault-sidebar";

interface VaultHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onCreateNewItem: (type: VaultItemType) => void;
  activeFilter: VaultCategoryFilter;
  onSelectFilter: (filter: VaultCategoryFilter) => void;
  items: VaultItemRecord[];
  userEmail: string;
  onOpenAudit?: () => void;
  onOpenBackupImport?: () => void;
  onOpenSettings?: () => void;
  onOpenEmergencyKit?: () => void;
  onOpenSend?: () => void;
  onOpenPayPin?: () => void;
}

export function VaultHeader({
  searchQuery,
  onSearchChange,
  onCreateNewItem,
  activeFilter,
  onSelectFilter,
  items,
  userEmail,
  onOpenAudit,
  onOpenBackupImport,
  onOpenSettings,
  onOpenEmergencyKit,
  onOpenSend,
  onOpenPayPin,
}: VaultHeaderProps) {
  const router = useRouter();
  const { isVaultUnlocked, lockVault } = useVault();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSignOut = async () => {
    lockVault("manual");
    await signOut();
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <div className="flex flex-1 items-center gap-3">
        {/* Mobile Sidebar Drawer */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                className="lg:hidden"
                aria-label="Open vault navigation"
              />
            }
          >
            <Menu className="size-4" />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-72 border-r border-sidebar-border bg-sidebar p-0"
          >
            <SheetTitle className="sr-only">ArzurVault Navigation</SheetTitle>
            <VaultSidebarContent
              activeFilter={activeFilter}
              onSelectFilter={onSelectFilter}
              items={items}
              onNavigateMobile={() => setMobileMenuOpen(false)}
              onOpenAudit={onOpenAudit}
              onOpenBackupImport={onOpenBackupImport}
              onOpenSettings={onOpenSettings}
              onOpenEmergencyKit={onOpenEmergencyKit}
              onOpenSend={onOpenSend}
              onOpenPayPin={onOpenPayPin}
            />
          </SheetContent>
        </Sheet>

        {/* Instant Search Input */}
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search titles, usernames, chains, URLs... (Ctrl+K)"
            className="bg-muted/40 pr-8 pl-9 text-xs focus-visible:bg-background focus-visible:border-emerald-500/70"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Theme Mode Switcher */}
        <ThemeToggle />

        {/* Lock Status & Lock Vault Button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => lockVault("manual")}
          disabled={!isVaultUnlocked}
          title="Wipe Master Key from RAM (Ctrl+Shift+L)"
          className="font-mono text-xs hover:border-amber-500/45 hover:text-amber-700 dark:hover:text-amber-300"
        >
          <span
            className={`size-2 rounded-full ${
              isVaultUnlocked ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
          <Lock className="size-3.5" />
          <span className="hidden sm:inline">Lock Vault</span>
        </Button>

        {/* Pay PIN Feature Header Button */}
        {onOpenPayPin && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenPayPin}
            className="hidden sm:inline-flex items-center gap-1.5 font-mono text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            title="Pay PIN Security Feature"
          >
            <Sparkles className="size-3.5 text-[#FCD535]" />
            <span>Pay PIN</span>
          </Button>
        )}

        {/* + New Item Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="sm"
                className="bg-emerald-600 font-mono text-xs font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
              />
            }
          >
            <Plus className="size-4" />
            <span>New Item</span>
            <ChevronDown className="size-3.5 opacity-80" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-mono text-[10px] tracking-wider uppercase">
                Encrypt New Secret
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onCreateNewItem("PASSWORD")}
                className="cursor-pointer gap-2.5 py-2 text-xs"
              >
                <div className="flex size-7 items-center justify-center rounded-md border border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <KeyRound className="size-3.5" />
                </div>
                <div>
                  <p className="font-medium text-popover-foreground">
                    New Password
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Login, TOTP &amp; URL credentials
                  </p>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onCreateNewItem("PAYMENT_CARD")}
                className="cursor-pointer gap-2.5 py-2 text-xs"
              >
                <div className="flex size-7 items-center justify-center rounded-md border border-indigo-500/35 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <CreditCard className="size-3.5" />
                </div>
                <div>
                  <p className="font-medium text-popover-foreground">
                    New Payment Card
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Credit / debit card, CVV &amp; PIN
                  </p>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onCreateNewItem("IDENTITY")}
                className="cursor-pointer gap-2.5 py-2 text-xs"
              >
                <div className="flex size-7 items-center justify-center rounded-md border border-teal-500/35 bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <FileBadge className="size-3.5" />
                </div>
                <div>
                  <p className="font-medium text-popover-foreground">
                    New Digital Identity
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Passport, driver license &amp; ID card
                  </p>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onCreateNewItem("CRYPTO_WALLET")}
                className="cursor-pointer gap-2.5 py-2 text-xs"
              >
                <div className="flex size-7 items-center justify-center rounded-md border border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Wallet className="size-3.5" />
                </div>
                <div>
                  <p className="font-medium text-popover-foreground">
                    New Crypto Seed Phrase
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    12 / 24 BIP-39 words &amp; keys
                  </p>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onCreateNewItem("SECURE_NOTE")}
                className="cursor-pointer gap-2.5 py-2 text-xs"
              >
                <div className="flex size-7 items-center justify-center rounded-md border border-cyan-500/35 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  <FileLock2 className="size-3.5" />
                </div>
                <div>
                  <p className="font-medium text-popover-foreground">
                    New Secure Note
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    SSH keys, recovery codes &amp; notes
                  </p>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onCreateNewItem("PAY_PIN")}
                className="cursor-pointer gap-2.5 py-2 text-xs"
              >
                <div className="flex size-7 items-center justify-center rounded-md border border-amber-500/35 bg-amber-500/10 text-amber-500">
                  <Sparkles className="size-3.5" />
                </div>
                <div>
                  <p className="font-medium text-popover-foreground">
                    New Pay PIN
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Dynamic 4/6-digit transaction PIN
                  </p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Operator Account / Sign Out */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                title={userEmail}
              />
            }
          >
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="space-y-0.5">
                <p className="font-mono text-[10px] text-emerald-600 uppercase dark:text-emerald-400">
                  Authenticated Operator
                </p>
                <p className="truncate font-mono text-xs text-popover-foreground">
                  {userEmail}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => lockVault("manual")}
                className="cursor-pointer gap-2 text-xs"
              >
                <Lock className="size-3.5 text-amber-600 dark:text-amber-400" />
                Lock Vault (Ctrl+Shift+L)
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={handleSignOut}
                className="cursor-pointer gap-2 text-xs"
              >
                <LogOut className="size-3.5" />
                Sign Out &amp; Wipe RAM
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
