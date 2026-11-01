"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Flame,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { useVault } from "@/context/vault-context";
import {
  runVaultSecurityAudit,
  type AuditIssueType,
  type VaultAuditReport,
} from "@/lib/audit";
import type { PasswordSecretPayload, VaultItemRecord } from "@/types/vault";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type FilterTab = "ALL" | AuditIssueType | "CLEAN";

interface VaultAuditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: VaultItemRecord[];
  onFixItem: (item: VaultItemRecord, secret?: PasswordSecretPayload) => void;
  onAddNewPassword?: () => void;
}

export function VaultAuditModal({
  open,
  onOpenChange,
  items,
  onFixItem,
  onAddNewPassword,
}: VaultAuditModalProps) {
  const { isVaultUnlocked, decryptPayload } = useVault();
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<VaultAuditReport | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const runAudit = useCallback(async () => {
    if (!isVaultUnlocked) {
      toast.error("Unlock vault first to inspect passwords.");
      return;
    }

    setIsRunning(true);
    try {
      const passwordItems = items.filter(
        (i) => i.type === "PASSWORD" && !i.deletedAt
      );

      // Decrypt passwords concurrently for maximum performance
      const decryptedResults = await Promise.all(
        passwordItems.map(async (item) => {
          try {
            const secret = await decryptPayload<PasswordSecretPayload>({
              ciphertext: item.ciphertext,
              iv: item.iv,
              salt: item.salt,
            });
            return { item, secret };
          } catch (e) {
            console.error("Failed to decrypt item for audit:", item.id, e);
            return null;
          }
        })
      );

      const decryptedList = decryptedResults.filter(
        (
          r
        ): r is {
          item: VaultItemRecord;
          secret: PasswordSecretPayload;
        } => r !== null
      );

      const auditResult = await runVaultSecurityAudit(decryptedList, true);
      setReport(auditResult);
    } catch (err: unknown) {
      toast.error("Security audit encountered an error.");
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  }, [isVaultUnlocked, items, decryptPayload]);

  useEffect(() => {
    if (open && isVaultUnlocked && !report) {
      const timer = setTimeout(() => {
        void runAudit();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open, isVaultUnlocked, report, runAudit]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setActiveFilter("ALL");
      setSearchQuery("");
    }
    onOpenChange(nextOpen);
  };

  const totalAnalyzed = report?.totalAnalyzed ?? 0;
  const itemsWithIssues = useMemo(() => {
    if (!report) return [];
    return report.auditedItems.filter((a) => a.issues.length > 0);
  }, [report]);

  const cleanItems = useMemo(() => {
    if (!report) return [];
    return report.auditedItems.filter((a) => a.issues.length === 0);
  }, [report]);

  const filteredItems = useMemo(() => {
    if (!report) return [];

    let list = report.auditedItems;

    // Filter by issue type or status
    if (activeFilter === "ALL") {
      list = itemsWithIssues;
    } else if (activeFilter === "CLEAN") {
      list = cleanItems;
    } else {
      list = report.auditedItems.filter((a) =>
        a.issues.some((issue) => issue.type === activeFilter)
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.item.title.toLowerCase().includes(q) ||
          (a.item.subtitle && a.item.subtitle.toLowerCase().includes(q)) ||
          (a.item.url && a.item.url.toLowerCase().includes(q))
      );
    }

    return list;
  }, [report, activeFilter, searchQuery, itemsWithIssues, cleanItems]);

  const getScoreTheme = (score: number, total: number) => {
    if (total === 0) {
      return {
        text: "text-muted-foreground",
        border: "border-border/60",
        bg: "bg-muted/10",
        stroke: "#71717a",
        label: "Empty Vault",
        description: "0 accounts examined",
      };
    }
    if (score >= 85) {
      return {
        text: "text-emerald-500",
        border: "border-emerald-500/30",
        bg: "bg-emerald-500/10",
        stroke: "#10b981",
        label: "Excellent Posture",
        description: "Credentials are resilient & unbreached",
      };
    }
    if (score >= 70) {
      return {
        text: "text-teal-400",
        border: "border-teal-500/30",
        bg: "bg-teal-500/10",
        stroke: "#14b8a6",
        label: "Good Posture",
        description: "Minor improvements recommended",
      };
    }
    if (score >= 50) {
      return {
        text: "text-amber-500",
        border: "border-amber-500/30",
        bg: "bg-amber-500/10",
        stroke: "#f59e0b",
        label: "Moderate Risk",
        description: "Action advised on flagged items",
      };
    }
    return {
      text: "text-red-500",
      border: "border-red-500/30",
      bg: "bg-red-500/10",
      stroke: "#ef4444",
      label: "Critical Risk",
      description: "Immediate password rotation needed",
    };
  };

  const scoreTheme = getScoreTheme(report?.overallScore ?? 100, totalAnalyzed);

  // SVG Gauge calculations
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    totalAnalyzed === 0
      ? circumference
      : circumference - ((report?.overallScore ?? 100) / 100) * circumference;

  const toggleFilter = (tab: FilterTab) => {
    setActiveFilter((prev) => (prev === tab ? "ALL" : tab));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-3xl max-h-[88vh] flex flex-col p-6 overflow-hidden gap-5"
      >
        {/* Header with clean right action group (No overlapping close button) */}
        <DialogHeader className="pr-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl border transition-colors",
                  totalAnalyzed > 0 && report && report.overallScore >= 80
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-500"
                    : totalAnalyzed > 0 && report && report.overallScore < 60
                    ? "border-red-500/35 bg-red-500/10 text-red-500"
                    : "border-emerald-500/35 bg-emerald-500/10 text-emerald-500"
                )}
              >
                {report && report.pwnedCount > 0 ? (
                  <ShieldAlert className="size-4.5" />
                ) : (
                  <ShieldCheck className="size-4.5" />
                )}
              </div>
              <div className="min-w-0">
                <DialogTitle className="font-mono text-base font-semibold truncate text-foreground">
                  Vault Security & Breach Audit
                </DialogTitle>
                <DialogDescription className="font-mono text-xs text-muted-foreground truncate">
                  Zero-Knowledge client-side evaluation & HaveIBeenPwned k-anonymity check.
                </DialogDescription>
              </div>
            </div>

            {/* Aligned action group */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={runAudit}
                disabled={isRunning || !isVaultUnlocked}
                className="font-mono text-xs gap-1.5 h-8 px-3"
              >
                <RefreshCw
                  className={cn("size-3.5", isRunning && "animate-spin")}
                />
                Re-scan
              </Button>

              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                className="size-8 text-muted-foreground hover:text-foreground rounded-lg"
                aria-label="Close audit"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {isRunning ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="size-9 animate-spin text-emerald-500" />
            <p className="font-mono text-sm text-foreground font-medium">
              Auditing Vault Credentials...
            </p>
            <p className="font-mono text-xs text-muted-foreground max-w-sm text-center">
              Decrypting in-memory and checking k-anonymity ranges against known data breaches.
            </p>
          </div>
        ) : !report ? (
          <div className="text-center py-16 text-sm text-muted-foreground font-mono">
            Unlock your master vault to analyze security health.
          </div>
        ) : (
          <div className="space-y-5 overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar overscroll-contain">
            {/* Top Score & Metric Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {/* Radial Score Gauge Card */}
              <div
                className={cn(
                  "md:col-span-2 flex flex-col items-center justify-center p-4 rounded-xl border relative transition-all",
                  scoreTheme.border,
                  scoreTheme.bg
                )}
              >
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                  Vault Health Score
                </span>

                <div className="relative flex items-center justify-center size-24 my-1">
                  <svg className="size-full -rotate-90" viewBox="0 0 80 80">
                    {/* Background track circle */}
                    <circle
                      cx="40"
                      cy="40"
                      r={radius}
                      className="stroke-muted/30"
                      strokeWidth="6"
                      fill="transparent"
                    />
                    {/* Animated Progress circle */}
                    <circle
                      cx="40"
                      cy="40"
                      r={radius}
                      stroke={scoreTheme.stroke}
                      strokeWidth="6"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={cn("font-mono text-2xl font-black", scoreTheme.text)}>
                      {totalAnalyzed === 0 ? "--" : `${report.overallScore}%`}
                    </span>
                  </div>
                </div>

                <span className={cn("font-mono text-xs font-bold", scoreTheme.text)}>
                  {scoreTheme.label}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground mt-0.5 text-center">
                  {totalAnalyzed === 0
                    ? "Add credentials to evaluate"
                    : `${cleanItems.length} of ${totalAnalyzed} accounts clean`}
                </span>
              </div>

              {/* 4 Interactive Metric Cards */}
              <div className="md:col-span-3 grid grid-cols-2 gap-2.5">
                {/* Breached Passwords */}
                <button
                  type="button"
                  onClick={() => toggleFilter("PWNED")}
                  className={cn(
                    "rounded-xl border p-3 flex flex-col justify-between text-left transition-all cursor-pointer group",
                    report.pwnedCount > 0
                      ? "border-red-500/40 bg-red-500/10 hover:border-red-500/70"
                      : "border-border/60 bg-card/60 hover:border-border",
                    activeFilter === "PWNED" && "ring-2 ring-red-500"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-between text-xs font-mono font-medium",
                      report.pwnedCount > 0 ? "text-red-500" : "text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <Flame className="size-3.5" />
                      <span>Breached</span>
                    </div>
                    {report.pwnedCount > 0 ? (
                      <span className="size-2 rounded-full bg-red-500 animate-pulse" />
                    ) : (
                      <span className="text-[10px] opacity-70">0 risk</span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between mt-2">
                    <span
                      className={cn(
                        "font-mono text-2xl font-bold",
                        report.pwnedCount > 0 ? "text-red-500" : "text-foreground"
                      )}
                    >
                      {report.pwnedCount}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {report.pwnedCount > 0 ? "Compromised" : "Safe"}
                    </span>
                  </div>
                </button>

                {/* Reused Passwords */}
                <button
                  type="button"
                  onClick={() => toggleFilter("REUSED")}
                  className={cn(
                    "rounded-xl border p-3 flex flex-col justify-between text-left transition-all cursor-pointer group",
                    report.reusedCount > 0
                      ? "border-amber-500/40 bg-amber-500/10 hover:border-amber-500/70"
                      : "border-border/60 bg-card/60 hover:border-border",
                    activeFilter === "REUSED" && "ring-2 ring-amber-500"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-between text-xs font-mono font-medium",
                      report.reusedCount > 0 ? "text-amber-500" : "text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <RefreshCw className="size-3.5" />
                      <span>Reused</span>
                    </div>
                    {report.reusedCount > 0 ? (
                      <span className="size-2 rounded-full bg-amber-500" />
                    ) : (
                      <span className="text-[10px] opacity-70">Unique</span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between mt-2">
                    <span
                      className={cn(
                        "font-mono text-2xl font-bold",
                        report.reusedCount > 0 ? "text-amber-500" : "text-foreground"
                      )}
                    >
                      {report.reusedCount}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {report.reusedCount > 0 ? "Duplicate" : "Unique"}
                    </span>
                  </div>
                </button>

                {/* Weak Passwords */}
                <button
                  type="button"
                  onClick={() => toggleFilter("WEAK")}
                  className={cn(
                    "rounded-xl border p-3 flex flex-col justify-between text-left transition-all cursor-pointer group",
                    report.weakCount > 0
                      ? "border-amber-500/40 bg-amber-500/10 hover:border-amber-500/70"
                      : "border-border/60 bg-card/60 hover:border-border",
                    activeFilter === "WEAK" && "ring-2 ring-amber-500"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-between text-xs font-mono font-medium",
                      report.weakCount > 0 ? "text-amber-500" : "text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5" />
                      <span>Weak Entropy</span>
                    </div>
                    {report.weakCount > 0 ? (
                      <span className="size-2 rounded-full bg-amber-500" />
                    ) : (
                      <span className="text-[10px] opacity-70">Strong</span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between mt-2">
                    <span
                      className={cn(
                        "font-mono text-2xl font-bold",
                        report.weakCount > 0 ? "text-amber-500" : "text-foreground"
                      )}
                    >
                      {report.weakCount}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {report.weakCount > 0 ? "Crackable" : "Strong"}
                    </span>
                  </div>
                </button>

                {/* Missing 2FA */}
                <button
                  type="button"
                  onClick={() => toggleFilter("MISSING_2FA")}
                  className={cn(
                    "rounded-xl border p-3 flex flex-col justify-between text-left transition-all cursor-pointer group",
                    report.missing2faCount > 0
                      ? "border-sky-500/30 bg-sky-500/5 hover:border-sky-500/60"
                      : "border-border/60 bg-card/60 hover:border-border",
                    activeFilter === "MISSING_2FA" && "ring-2 ring-sky-500"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-between text-xs font-mono font-medium",
                      report.missing2faCount > 0 ? "text-sky-400" : "text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <KeyRound className="size-3.5" />
                      <span>Missing 2FA</span>
                    </div>
                    <span className="text-[10px] opacity-70">TOTP</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-2">
                    <span
                      className={cn(
                        "font-mono text-2xl font-bold",
                        report.missing2faCount > 0 ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {report.missing2faCount}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {report.missing2faCount > 0 ? "Single-factor" : "Active"}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Findings & Filter Controls */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
                    Audit Findings
                  </span>
                  <Badge variant="outline" className="font-mono text-[11px] px-2 h-5">
                    {totalAnalyzed === 0
                      ? "0 accounts"
                      : `${itemsWithIssues.length} issues across ${totalAnalyzed} accounts`}
                  </Badge>
                </div>

                {/* Search bar */}
                {totalAnalyzed > 0 && (
                  <div className="relative w-full sm:w-56">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search accounts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 pl-8 font-mono text-xs"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Filter Pills */}
              {totalAnalyzed > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pb-1">
                  <button
                    type="button"
                    onClick={() => setActiveFilter("ALL")}
                    className={cn(
                      "font-mono text-[11px] px-2.5 py-1 rounded-md border transition-all cursor-pointer",
                      activeFilter === "ALL"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    All Issues ({itemsWithIssues.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveFilter("PWNED")}
                    className={cn(
                      "font-mono text-[11px] px-2.5 py-1 rounded-md border transition-all cursor-pointer flex items-center gap-1",
                      activeFilter === "PWNED"
                        ? "bg-red-500 text-white border-red-500"
                        : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    <Flame className="size-3" />
                    Breached ({report.pwnedCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveFilter("REUSED")}
                    className={cn(
                      "font-mono text-[11px] px-2.5 py-1 rounded-md border transition-all cursor-pointer flex items-center gap-1",
                      activeFilter === "REUSED"
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    <RefreshCw className="size-3" />
                    Reused ({report.reusedCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveFilter("WEAK")}
                    className={cn(
                      "font-mono text-[11px] px-2.5 py-1 rounded-md border transition-all cursor-pointer flex items-center gap-1",
                      activeFilter === "WEAK"
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    <AlertTriangle className="size-3" />
                    Weak ({report.weakCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveFilter("MISSING_2FA")}
                    className={cn(
                      "font-mono text-[11px] px-2.5 py-1 rounded-md border transition-all cursor-pointer flex items-center gap-1",
                      activeFilter === "MISSING_2FA"
                        ? "bg-sky-500 text-white border-sky-500"
                        : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    <KeyRound className="size-3" />
                    Missing 2FA ({report.missing2faCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveFilter("CLEAN")}
                    className={cn(
                      "font-mono text-[11px] px-2.5 py-1 rounded-md border transition-all cursor-pointer flex items-center gap-1",
                      activeFilter === "CLEAN"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    <CheckCircle2 className="size-3" />
                    Clean ({cleanItems.length})
                  </button>
                </div>
              )}

              {/* Empty Vault State */}
              {totalAnalyzed === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-border bg-card/40 text-center gap-3">
                  <div className="size-10 rounded-full border border-border flex items-center justify-center text-muted-foreground bg-muted/20">
                    <KeyRound className="size-5" />
                  </div>
                  <div>
                    <h5 className="font-mono text-sm font-semibold text-foreground">
                      No Password Items In Vault
                    </h5>
                    <p className="font-mono text-xs text-muted-foreground max-w-md mt-1">
                      Your vault doesn&apos;t have any password records to inspect. Add credentials
                      to scan against HaveIBeenPwned breach databases and detect reuse.
                    </p>
                  </div>
                  {onAddNewPassword && (
                    <Button
                      size="sm"
                      onClick={() => {
                        handleOpenChange(false);
                        onAddNewPassword();
                      }}
                      className="font-mono text-xs gap-1.5 mt-2"
                    >
                      <Plus className="size-3.5" />
                      Add First Password
                    </Button>
                  )}
                </div>
              ) : itemsWithIssues.length === 0 && activeFilter !== "CLEAN" ? (
                /* All Clear Celebration State */
                <div className="flex items-start gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4 text-emerald-500 font-mono text-xs">
                  <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">
                      Zero Security Flaws Detected
                    </p>
                    <p className="text-emerald-500/90 text-xs">
                      All {totalAnalyzed} password credentials passed zero-knowledge evaluation! No
                      compromised, reused, or weak passwords detected. Your vault is in great shape.
                    </p>
                  </div>
                </div>
              ) : filteredItems.length === 0 ? (
                /* Empty Filter Result */
                <div className="text-center py-10 rounded-xl border border-dashed border-border text-muted-foreground font-mono text-xs">
                  No accounts found matching this filter or search.
                </div>
              ) : (
                /* Findings Cards List */
                <div className="space-y-2.5">
                  {filteredItems.map(({ item, secret, issues }) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-2xs hover:border-border/80 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-sm font-semibold truncate text-foreground">
                            {item.title}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground truncate">
                            ({item.subtitle || "No username"})
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                          {item.url && (
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => {
                                const targetUrl = item.url!.startsWith("http")
                                  ? item.url!
                                  : `https://${item.url!}`;
                                window.open(targetUrl, "_blank", "noopener,noreferrer");
                              }}
                              className="font-mono text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                              title="Open account website to change password"
                            >
                              <ExternalLink className="size-3" />
                              <span className="sr-only">Visit</span>
                            </Button>
                          )}

                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => {
                              handleOpenChange(false);
                              onFixItem(item, secret);
                            }}
                            className="font-mono text-xs h-7 px-2.5 hover:border-emerald-500 hover:text-emerald-500"
                          >
                            Update Password
                          </Button>
                        </div>
                      </div>

                      {/* Issues Breakdown */}
                      {issues.length > 0 ? (
                        <div className="space-y-1.5 border-t border-border/40 pt-2.5">
                          {issues.map((issue, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-2 font-mono text-xs"
                            >
                              <Badge
                                variant={
                                  issue.severity === "critical"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className={cn(
                                  "font-mono text-[10px] uppercase shrink-0 mt-0.5",
                                  issue.severity === "critical" &&
                                    "bg-red-500/15 text-red-500 border border-red-500/30",
                                  issue.severity === "high" &&
                                    "bg-amber-500/15 text-amber-500 border border-amber-500/30",
                                  issue.severity === "medium" &&
                                    "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                                )}
                              >
                                {issue.title}
                              </Badge>
                              <span className="text-muted-foreground text-[11px] leading-relaxed">
                                {issue.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-500 font-mono text-xs border-t border-border/40 pt-2">
                          <CheckCircle2 className="size-3.5" />
                          <span>Strong, unique, uncompromised credentials.</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
