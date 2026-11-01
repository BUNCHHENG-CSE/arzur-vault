"use client";

import { useMemo, useState } from "react";
import {
  CreditCard,
  FileBadge,
  FileLock2,
  KeyRound,
  Plus,
  SearchX,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { emptyTrash } from "@/actions/vault-actions";
import { useVault } from "@/context/vault-context";
import { cn } from "@/lib/utils";
import type {
  CryptoWalletSecretPayload,
  DecryptedPayload,
  IdentitySecretPayload,
  PasswordSecretPayload,
  PaymentCardSecretPayload,
  PayPinSecretPayload,
  SecureNoteSecretPayload,
  VaultCategoryFilter,
  VaultItemRecord,
  VaultItemType,
} from "@/types/vault";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArzurSendModal } from "@/components/vault/arzur-send-modal";
import { CryptoWalletModal } from "@/components/vault/crypto-wallet-modal";
import { EmergencyKitDialog } from "@/components/vault/emergency-kit-dialog";
import { IdentityModal } from "@/components/vault/identity-modal";
import { ImportExportModal } from "@/components/vault/import-export-modal";
import { PasswordModal } from "@/components/vault/password-modal";
import { PaymentCardModal } from "@/components/vault/payment-card-modal";
import { PayPinModal } from "@/components/vault/pay-pin-modal";
import { SecureNoteModal } from "@/components/vault/secure-note-modal";
import { VaultAuditModal } from "@/components/vault/vault-audit-modal";
import { VaultHeader } from "@/components/vault/vault-header";
import { VaultItemCard } from "@/components/vault/vault-item-card";
import { VaultSettingsModal } from "@/components/vault/vault-settings-modal";
import { VaultSidebar } from "@/components/vault/vault-sidebar";
import { VaultUnlockModal } from "@/components/vault/vault-unlock-modal";

interface VaultDashboardProps {
  userName: string;
  userEmail: string;
  initialItems: VaultItemRecord[];
}

function sortVaultItems(list: VaultItemRecord[]): VaultItemRecord[] {
  return [...list].sort((a, b) => {
    if (a.favorite !== b.favorite) {
      return a.favorite ? -1 : 1;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function VaultDashboard({
  userName,
  userEmail,
  initialItems,
}: VaultDashboardProps) {
  const { isVaultUnlocked, isDuressMode } = useVault();

  const [items, setItems] = useState<VaultItemRecord[]>(() =>
    sortVaultItems(initialItems)
  );
  const [activeFilter, setActiveFilter] = useState<VaultCategoryFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [cryptoModalOpen, setCryptoModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [identityModalOpen, setIdentityModalOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [backupImportOpen, setBackupImportOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [emergencyKitOpen, setEmergencyKitOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [payPinOpen, setPayPinOpen] = useState(false);

  const [editingItem, setEditingItem] = useState<VaultItemRecord | null>(null);
  const [editingSecret, setEditingSecret] = useState<DecryptedPayload | null>(
    null
  );
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);

  const handleOpenCreateModal = (type: VaultItemType) => {
    setEditingItem(null);
    setEditingSecret(null);
    if (type === "PASSWORD") setPasswordModalOpen(true);
    if (type === "CRYPTO_WALLET") setCryptoModalOpen(true);
    if (type === "SECURE_NOTE") setNoteModalOpen(true);
    if (type === "PAYMENT_CARD") setPaymentModalOpen(true);
    if (type === "IDENTITY") setIdentityModalOpen(true);
    if (type === "PAY_PIN") setPayPinOpen(true);
  };

  const handleOpenEditModal = (
    item: VaultItemRecord,
    decrypted: DecryptedPayload
  ) => {
    setEditingItem(item);
    setEditingSecret(decrypted);
    if (item.type === "PASSWORD") setPasswordModalOpen(true);
    if (item.type === "CRYPTO_WALLET") setCryptoModalOpen(true);
    if (item.type === "SECURE_NOTE") setNoteModalOpen(true);
    if (item.type === "PAYMENT_CARD") setPaymentModalOpen(true);
    if (item.type === "IDENTITY") setIdentityModalOpen(true);
    if (item.type === "PAY_PIN") setPayPinOpen(true);
  };

  const handleItemSaved = (savedItem: VaultItemRecord) => {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === savedItem.id);
      const next = exists
        ? prev.map((i) => (i.id === savedItem.id ? savedItem : i))
        : [savedItem, ...prev];
      return sortVaultItems(next);
    });
    setEditingItem(null);
    setEditingSecret(null);
  };

  const handleItemUpdated = (updated: VaultItemRecord) => {
    setItems((prev) =>
      sortVaultItems(prev.map((i) => (i.id === updated.id ? updated : i)))
    );
  };

  const handleItemDeleted = (deletedId: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === deletedId ? { ...i, deletedAt: new Date() } : i))
    );
  };

  const handleItemsImported = (importedList: VaultItemRecord[]) => {
    setItems((prev) => sortVaultItems([...importedList, ...prev]));
  };

  const handleItemsReencrypted = (reencryptedList: VaultItemRecord[]) => {
    setItems(sortVaultItems(reencryptedList));
  };

  const handleEmptyTrashConfirm = async () => {
    setIsEmptyingTrash(true);
    try {
      const res = await emptyTrash();
      setItems((prev) => prev.filter((i) => !i.deletedAt));
      toast.success(`Emptied trash: permanently purged ${res.count} items.`);
    } catch {
      toast.error("Failed to empty trash.");
    } finally {
      setIsEmptyingTrash(false);
    }
  };

  const modeItems = useMemo(() => {
    return items.filter((i) => Boolean(i.isDecoy) === Boolean(isDuressMode));
  }, [items, isDuressMode]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return modeItems.filter((item) => {
      // Trash view
      if (activeFilter === "TRASH") {
        if (!item.deletedAt) return false;
      } else {
        // All non-trash views exclude soft-deleted items
        if (item.deletedAt) return false;

        if (activeFilter === "FAVORITES" && !item.favorite) return false;
        if (
          activeFilter !== "ALL" &&
          activeFilter !== "FAVORITES" &&
          item.type !== activeFilter
        ) {
          return false;
        }
      }

      if (!q) return true;

      const haystack = [item.title, item.subtitle, item.category, item.url]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [modeItems, activeFilter, searchQuery]);

  const filterTitleMap: Record<VaultCategoryFilter, string> = {
    ALL: isDuressMode ? "Vault Workspace" : "All Encrypted Vault Items",
    PASSWORD: "Logins & Passwords",
    PAYMENT_CARD: "Payment & Credit Cards",
    IDENTITY: "Digital Identities & Official IDs",
    CRYPTO_WALLET: "Crypto Seed Phrase Vaults",
    SECURE_NOTE: "Encrypted Secure Notes",
    PAY_PIN: "Encrypted Pay PINs",
    FAVORITES: "Pinned Favorites",
    TRASH: "Trash Bin (Soft Deleted)",
  };

  const activeItems = modeItems.filter((i) => !i.deletedAt);
  const passwordCount = activeItems.filter((i) => i.type === "PASSWORD").length;
  const cardCount = activeItems.filter((i) => i.type === "PAYMENT_CARD").length;
  const identityCount = activeItems.filter((i) => i.type === "IDENTITY").length;
  const walletCount = activeItems.filter((i) => i.type === "CRYPTO_WALLET").length;
  const noteCount = activeItems.filter((i) => i.type === "SECURE_NOTE").length;
  const payPinCount = activeItems.filter((i) => i.type === "PAY_PIN").length;
  const trashCount = modeItems.filter((i) => Boolean(i.deletedAt)).length;

  const quickStats = useMemo(
    () => [
      {
        filter: "PASSWORD" as const,
        label: "Logins",
        count: passwordCount,
        icon: KeyRound,
        color: "text-emerald-500 dark:text-emerald-400",
        activeBorder: "border-emerald-500/50 dark:border-emerald-400/50",
        activeBg: "bg-emerald-500/10 dark:bg-emerald-500/15",
        glow: "shadow-[0_0_12px_rgba(16,185,129,0.2)]",
        indicator: "bg-emerald-500",
      },
      {
        filter: "PAYMENT_CARD" as const,
        label: "Cards",
        count: cardCount,
        icon: CreditCard,
        color: "text-indigo-500 dark:text-indigo-400",
        activeBorder: "border-indigo-500/50 dark:border-indigo-400/50",
        activeBg: "bg-indigo-500/10 dark:bg-indigo-500/15",
        glow: "shadow-[0_0_12px_rgba(99,102,241,0.2)]",
        indicator: "bg-indigo-500",
      },
      {
        filter: "IDENTITY" as const,
        label: "IDs",
        count: identityCount,
        icon: FileBadge,
        color: "text-teal-500 dark:text-teal-400",
        activeBorder: "border-teal-500/50 dark:border-teal-400/50",
        activeBg: "bg-teal-500/10 dark:bg-teal-500/15",
        glow: "shadow-[0_0_12px_rgba(20,184,166,0.2)]",
        indicator: "bg-teal-500",
      },
      {
        filter: "PAY_PIN" as const,
        label: "PINs",
        count: payPinCount,
        icon: Sparkles,
        color: "text-rose-500 dark:text-rose-400",
        activeBorder: "border-rose-500/50 dark:border-rose-400/50",
        activeBg: "bg-rose-500/10 dark:bg-rose-500/15",
        glow: "shadow-[0_0_12px_rgba(244,63,94,0.2)]",
        indicator: "bg-rose-500",
      },
      {
        filter: "CRYPTO_WALLET" as const,
        label: "Wallets",
        count: walletCount,
        icon: Wallet,
        color: "text-amber-500 dark:text-amber-400",
        activeBorder: "border-amber-500/50 dark:border-amber-400/50",
        activeBg: "bg-amber-500/10 dark:bg-amber-500/15",
        glow: "shadow-[0_0_12px_rgba(245,158,11,0.2)]",
        indicator: "bg-amber-500",
      },
      {
        filter: "SECURE_NOTE" as const,
        label: "Notes",
        count: noteCount,
        icon: FileLock2,
        color: "text-cyan-500 dark:text-cyan-400",
        activeBorder: "border-cyan-500/50 dark:border-cyan-400/50",
        activeBg: "bg-cyan-500/10 dark:bg-cyan-500/15",
        glow: "shadow-[0_0_12px_rgba(6,182,212,0.2)]",
        indicator: "bg-cyan-500",
      },
    ],
    [passwordCount, cardCount, identityCount, payPinCount, walletCount, noteCount]
  );

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-background text-foreground">
      {/* Zero-Knowledge Master Key Setup & Unlock Shield */}
      <VaultUnlockModal userEmail={userEmail} userName={userName} />

      {/* Sidebar */}
      <VaultSidebar
        activeFilter={activeFilter}
        onSelectFilter={setActiveFilter}
        items={modeItems}
        onOpenAudit={() => setAuditModalOpen(true)}
        onOpenBackupImport={() => setBackupImportOpen(true)}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onOpenEmergencyKit={() => setEmergencyKitOpen(true)}
        onOpenSend={() => setSendModalOpen(true)}
        onOpenPayPin={() => setPayPinOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
        <VaultHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onCreateNewItem={handleOpenCreateModal}
          activeFilter={activeFilter}
          onSelectFilter={setActiveFilter}
          items={modeItems}
          userEmail={userEmail}
          onOpenAudit={() => setAuditModalOpen(true)}
          onOpenBackupImport={() => setBackupImportOpen(true)}
          onOpenSettings={() => setSettingsModalOpen(true)}
          onOpenEmergencyKit={() => setEmergencyKitOpen(true)}
          onOpenSend={() => setSendModalOpen(true)}
          onOpenPayPin={() => setPayPinOpen(true)}
        />

        <main className="flex min-h-0 flex-1 flex-col p-4 sm:p-6 lg:p-8 cyber-grid-bg overflow-hidden">
          {/* Top Overview Banner & Quick Stats */}
          <div className="shrink-0 mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card/85 p-4 sm:p-5 shadow-xs backdrop-blur xl:flex-row xl:items-center">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-mono text-lg font-bold text-foreground sm:text-xl">
                  {filterTitleMap[activeFilter]}
                </h1>
                {activeFilter !== "ALL" && activeFilter !== "TRASH" && (
                  <button
                    type="button"
                    onClick={() => setActiveFilter("ALL")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all cursor-pointer shadow-xs"
                    title="Clear filter and view all vault items"
                  >
                    <X className="size-3" />
                    <span>Show All ({activeItems.length})</span>
                  </button>
                )}
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 font-mono text-[10px] text-emerald-700 dark:text-emerald-300"
                >
                  <ShieldCheck className="mr-1 size-3" />
                  ZERO-KNOWLEDGE ACTIVE
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                All sensitive fields are decrypted exclusively on-demand in volatile browser memory.
              </p>
            </div>

            <div className="w-full xl:w-auto shrink-0">
              {activeFilter === "TRASH" && trashCount > 0 ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleEmptyTrashConfirm}
                  disabled={isEmptyingTrash}
                  className="font-mono text-xs gap-1.5"
                >
                  <Trash2 className="size-3.5" />
                  {isEmptyingTrash ? "Purging..." : `Empty Trash (${trashCount})`}
                </Button>
              ) : (
                <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-6 xl:w-auto">
                  {quickStats.map((stat) => {
                    const isActive = activeFilter === stat.filter;
                    const hasItems = stat.count > 0;
                    const Icon = stat.icon;

                    return (
                      <button
                        key={stat.filter}
                        type="button"
                        onClick={() =>
                          setActiveFilter(isActive ? "ALL" : stat.filter)
                        }
                        aria-pressed={isActive}
                        title={
                          isActive
                            ? `Active: ${stat.label} — click to show all vault items`
                            : `Filter by ${stat.label} (${stat.count})`
                        }
                        className={cn(
                          "group relative flex w-full min-w-0 sm:min-w-[62px] flex-col items-center justify-center rounded-xl border px-2 py-2 text-center transition-all duration-150 select-none cursor-pointer overflow-hidden",
                          "outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/20",
                          isActive
                            ? cn(
                                "bg-background/90 dark:bg-background/95",
                                stat.activeBorder,
                                stat.activeBg,
                                stat.glow
                              )
                            : "border-border/60 bg-muted/30 hover:border-border hover:bg-muted/60 dark:bg-background/60 dark:hover:bg-background/90"
                        )}
                      >
                        {/* Top glowing accent indicator bar when active */}
                        {isActive && (
                          <span
                            className={cn(
                              "absolute top-0 inset-x-2 h-[2px] rounded-full",
                              stat.indicator
                            )}
                          />
                        )}

                        <div className="flex items-center justify-center gap-1.5">
                          <Icon
                            className={cn(
                              "size-3 shrink-0 transition-colors duration-150",
                              isActive || hasItems
                                ? stat.color
                                : "text-muted-foreground/45 group-hover:text-muted-foreground/80"
                            )}
                          />
                          <span
                            className={cn(
                              "font-mono text-xs font-bold leading-none tracking-tight transition-colors duration-150",
                              isActive || hasItems
                                ? stat.color
                                : "text-muted-foreground/45 group-hover:text-muted-foreground/80"
                            )}
                          >
                            {stat.count}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "font-mono text-[9.5px] leading-none mt-1 transition-colors duration-150 select-none truncate max-w-full",
                            isActive
                              ? "font-semibold text-foreground"
                              : hasItems
                                ? "text-muted-foreground/90 group-hover:text-foreground"
                                : "text-muted-foreground/50 group-hover:text-muted-foreground/80"
                          )}
                        >
                          {stat.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Scrollable Vault Items Container */}
          <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
            {filteredItems.length > 0 ? (
              <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 pt-1 pb-8">
                {filteredItems.map((item) => (
                  <VaultItemCard
                    key={item.id}
                    item={item}
                    onEditItem={handleOpenEditModal}
                    onItemUpdated={handleItemUpdated}
                    onItemDeleted={handleItemDeleted}
                  />
                ))}
              </div>
            ) : searchQuery.trim() ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center shadow-2xs">
                <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
                  <SearchX className="size-6" />
                </div>
                <h2 className="mt-4 font-mono text-base font-semibold text-foreground">
                  No matching encrypted records
                </h2>
                <p className="mt-1 max-w-md text-xs text-muted-foreground">
                  No items matched{" "}
                  <span className="font-mono font-medium text-foreground">
                    &ldquo;{searchQuery}&rdquo;
                  </span>{" "}
                  in {filterTitleMap[activeFilter].toLowerCase()}.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="mt-4 font-mono text-xs"
                >
                  Reset Search Filter
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center shadow-2xs">
                <div className="flex size-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  {activeFilter === "PAYMENT_CARD" ? (
                    <CreditCard className="size-7 text-indigo-600 dark:text-indigo-400" />
                  ) : activeFilter === "CRYPTO_WALLET" ? (
                    <Wallet className="size-7 text-amber-600 dark:text-amber-400" />
                  ) : activeFilter === "SECURE_NOTE" ? (
                    <FileLock2 className="size-7 text-cyan-600 dark:text-cyan-400" />
                  ) : activeFilter === "FAVORITES" ? (
                    <Star className="size-7 text-amber-500 dark:text-yellow-400" />
                  ) : activeFilter === "TRASH" ? (
                    <Trash2 className="size-7 text-muted-foreground" />
                  ) : (
                    <ShieldCheck className="size-7 text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>

                <h2 className="mt-4 font-mono text-base font-semibold text-foreground">
                  {activeFilter === "FAVORITES"
                    ? "No pinned favorites yet"
                    : activeFilter === "TRASH"
                    ? "Trash bin is empty"
                    : "Your Zero-Knowledge Vault is Empty"}
                </h2>
                <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
                  {activeFilter === "FAVORITES"
                    ? "Star any login, payment card, crypto seed phrase, or note to pin it here."
                    : activeFilter === "TRASH"
                    ? "Deleted items will remain in the trash until restored or permanently purged."
                    : "Encrypt your first password, credit card, 12/24-word recovery phrase, or confidential note using client-side AES-256-GCM."}
                </p>

                {activeFilter !== "FAVORITES" && activeFilter !== "TRASH" && (
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleOpenCreateModal("PASSWORD")}
                      className="bg-emerald-600 font-mono text-xs font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
                    >
                      <KeyRound className="size-3.5" />
                      <Plus className="size-3" />
                      New Login
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleOpenCreateModal("PAYMENT_CARD")}
                      className="bg-indigo-600 font-mono text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      <CreditCard className="size-3.5" />
                      <Plus className="size-3" />
                      New Payment Card
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleOpenCreateModal("IDENTITY")}
                      className="bg-teal-600 font-mono text-xs font-semibold text-white hover:bg-teal-700"
                    >
                      <FileBadge className="size-3.5" />
                      <Plus className="size-3" />
                      New Identity
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleOpenCreateModal("CRYPTO_WALLET")}
                      className="bg-amber-500 font-mono text-xs font-semibold text-zinc-950 hover:bg-amber-400"
                    >
                      <Wallet className="size-3.5" />
                      <Plus className="size-3" />
                      Seal Crypto Wallet
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenCreateModal("SECURE_NOTE")}
                      className="font-mono text-xs"
                    >
                      <FileLock2 className="size-3.5 text-cyan-600 dark:text-cyan-400" />
                      New Secure Note
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenCreateModal("PAY_PIN")}
                      className="font-mono text-xs border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                    >
                      <Sparkles className="size-3.5 text-[#FCD535]" />
                      New Pay PIN
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Item Modals */}
      <PasswordModal
        open={isVaultUnlocked && passwordModalOpen}
        onOpenChange={(nextOpen) => {
          setPasswordModalOpen(nextOpen);
          if (!nextOpen) {
            setEditingItem(null);
            setEditingSecret(null);
          }
        }}
        editingItem={editingItem?.type === "PASSWORD" ? editingItem : null}
        initialSecret={
          editingItem?.type === "PASSWORD"
            ? (editingSecret as PasswordSecretPayload | null)
            : null
        }
        onSaved={handleItemSaved}
      />

      <PaymentCardModal
        open={isVaultUnlocked && paymentModalOpen}
        onOpenChange={(nextOpen) => {
          setPaymentModalOpen(nextOpen);
          if (!nextOpen) {
            setEditingItem(null);
            setEditingSecret(null);
          }
        }}
        editingItem={editingItem?.type === "PAYMENT_CARD" ? editingItem : null}
        initialSecret={
          editingItem?.type === "PAYMENT_CARD"
            ? (editingSecret as PaymentCardSecretPayload | null)
            : null
        }
        onSaved={handleItemSaved}
      />

      <IdentityModal
        open={isVaultUnlocked && identityModalOpen}
        onOpenChange={(nextOpen) => {
          setIdentityModalOpen(nextOpen);
          if (!nextOpen) {
            setEditingItem(null);
            setEditingSecret(null);
          }
        }}
        editingItem={editingItem?.type === "IDENTITY" ? editingItem : null}
        initialSecret={
          editingItem?.type === "IDENTITY"
            ? (editingSecret as IdentitySecretPayload | null)
            : null
        }
        onSaved={handleItemSaved}
      />

      <CryptoWalletModal
        open={isVaultUnlocked && cryptoModalOpen}
        onOpenChange={(nextOpen) => {
          setCryptoModalOpen(nextOpen);
          if (!nextOpen) {
            setEditingItem(null);
            setEditingSecret(null);
          }
        }}
        editingItem={editingItem?.type === "CRYPTO_WALLET" ? editingItem : null}
        initialSecret={
          editingItem?.type === "CRYPTO_WALLET"
            ? (editingSecret as CryptoWalletSecretPayload | null)
            : null
        }
        onSaved={handleItemSaved}
      />

      <SecureNoteModal
        open={isVaultUnlocked && noteModalOpen}
        onOpenChange={(nextOpen) => {
          setNoteModalOpen(nextOpen);
          if (!nextOpen) {
            setEditingItem(null);
            setEditingSecret(null);
          }
        }}
        editingItem={editingItem?.type === "SECURE_NOTE" ? editingItem : null}
        initialSecret={
          editingItem?.type === "SECURE_NOTE"
            ? (editingSecret as SecureNoteSecretPayload | null)
            : null
        }
        onSaved={handleItemSaved}
      />

      {/* Feature Dialogs */}
      <VaultAuditModal
        open={auditModalOpen}
        onOpenChange={setAuditModalOpen}
        items={items}
        onFixItem={(fixItem, secret) => {
          if (secret) {
            handleOpenEditModal(fixItem, secret);
          } else {
            handleOpenCreateModal(fixItem.type);
          }
        }}
        onAddNewPassword={() => handleOpenCreateModal("PASSWORD")}
      />

      <ImportExportModal
        open={backupImportOpen}
        onOpenChange={setBackupImportOpen}
        items={items}
        onItemsImported={handleItemsImported}
        onOpenEmergencyKit={() => setEmergencyKitOpen(true)}
      />

      <VaultSettingsModal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
        items={items}
        userEmail={userEmail}
        userName={userName}
        onItemsReencrypted={handleItemsReencrypted}
      />

      <EmergencyKitDialog
        open={emergencyKitOpen}
        onOpenChange={setEmergencyKitOpen}
        userEmail={userEmail}
        userName={userName}
      />

      <ArzurSendModal
        open={sendModalOpen}
        onOpenChange={setSendModalOpen}
      />

      {/* Encrypted Pay PIN Modal (Stored like Passwords & Crypto Wallets) */}
      <PayPinModal
        open={isVaultUnlocked && payPinOpen}
        onOpenChange={(nextOpen) => {
          setPayPinOpen(nextOpen);
          if (!nextOpen) {
            setEditingItem(null);
            setEditingSecret(null);
          }
        }}
        editingItem={editingItem?.type === "PAY_PIN" ? editingItem : null}
        initialSecret={
          editingItem?.type === "PAY_PIN"
            ? (editingSecret as PayPinSecretPayload | null)
            : null
        }
        onSaved={handleItemSaved}
      />
    </div>
  );
}
