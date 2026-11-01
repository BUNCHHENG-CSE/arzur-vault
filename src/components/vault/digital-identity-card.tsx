"use client";

import { useMemo, useState } from "react";
import {
  Car,
  Check,
  Copy,
  Cpu,
  Eye,
  EyeOff,
  HeartPulse,
  Landmark,
  Plane,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  Star,
} from "lucide-react";
import {
  COMMON_COUNTRIES,
  checkDocumentExpiry,
} from "@/lib/identity";
import { cn, copySecretToClipboard } from "@/lib/utils";
import type { IdentityType } from "@/types/vault";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DigitalIdentityCardProps {
  identityType: IdentityType;
  title?: string;
  fullName?: string;
  documentNumber?: string;
  issuingCountry?: string;
  issuingAuthority?: string;
  birthDate?: string;
  issueDate?: string;
  expirationDate?: string;
  mrzLine1?: string;
  mrzLine2?: string;
  category?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  className?: string;
  compact?: boolean;
}

export function DigitalIdentityCard({
  identityType = "PASSPORT",
  title,
  fullName,
  documentNumber,
  issuingCountry = "KHM",
  issuingAuthority,
  birthDate,
  issueDate,
  expirationDate,
  mrzLine1,
  mrzLine2,
  category,
  isFavorite,
  onToggleFavorite,
  className,
  compact = false,
}: DigitalIdentityCardProps) {
  const [isMasked, setIsMasked] = useState(true);
  const [viewMode, setViewMode] = useState<"card" | "mrz">("card");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const country = useMemo(
    () => COMMON_COUNTRIES.find((c) => c.code === issuingCountry),
    [issuingCountry]
  );

  const expiry = useMemo(
    () => checkDocumentExpiry(expirationDate),
    [expirationDate]
  );

  const handleCopy = async (text: string, label: string) => {
    if (!text) return;
    const ok = await copySecretToClipboard(text, label);
    if (ok) {
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 1800);
    }
  };

  const maskedNumber = useMemo(() => {
    if (!documentNumber) return "•••• •••• ••••";
    if (!isMasked) return documentNumber;
    if (documentNumber.length <= 4) return "•••• " + documentNumber;
    return `•••• •••• ${documentNumber.slice(-4)}`;
  }, [documentNumber, isMasked]);

  // Visual Theme Configurations based on Identity Type
  const theme = useMemo(() => {
    switch (identityType) {
      case "PASSPORT":
        return {
          typeLabel: "PASSPORT / PASSEPORT",
          subLabel: "OFFICIAL BIOMETRIC TRAVEL DOCUMENT",
          icon: Plane,
          cardClass:
            "border-teal-500/40 bg-gradient-to-br from-[#05111e] via-[#041c24] to-[#03151b] text-teal-50 shadow-[0_12px_40px_-10px_rgba(20,184,166,0.3)]",
          glowClass: "bg-teal-500/15",
          accentColor: "text-teal-400",
          accentBorder: "border-teal-500/30",
          badgeBg: "bg-teal-500/15 text-teal-300 border-teal-500/30",
          typeCode: "P",
        };
      case "DRIVERS_LICENSE":
        return {
          typeLabel: "DRIVER LICENSE / PERMIS DE CONDUIRE",
          subLabel: "MOTOR VEHICLE OPERATOR & IDENTIFICATION",
          icon: Car,
          cardClass:
            "border-sky-500/40 bg-gradient-to-br from-[#061120] via-[#051d33] to-[#041324] text-sky-50 shadow-[0_12px_40px_-10px_rgba(14,165,233,0.3)]",
          glowClass: "bg-sky-500/15",
          accentColor: "text-sky-400",
          accentBorder: "border-sky-500/30",
          badgeBg: "bg-sky-500/15 text-sky-300 border-sky-500/30",
          typeCode: "DL",
        };
      case "NATIONAL_ID":
        return {
          typeLabel: "NATIONAL IDENTITY / CARTE NATIONALE",
          subLabel: "OFFICIAL CITIZEN REGISTRATION CREDENTIAL",
          icon: Landmark,
          cardClass:
            "border-indigo-500/40 bg-gradient-to-br from-[#0c0d24] via-[#12153b] to-[#090a1f] text-indigo-50 shadow-[0_12px_40px_-10px_rgba(99,102,241,0.3)]",
          glowClass: "bg-indigo-500/15",
          accentColor: "text-indigo-400",
          accentBorder: "border-indigo-500/30",
          badgeBg: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
          typeCode: "ID",
        };
      case "TAX_ID":
        return {
          typeLabel: "TAX IDENTIFICATION / REGISTRATION",
          subLabel: "OFFICIAL FISCAL & REVENUE CREDENTIAL",
          icon: ReceiptText,
          cardClass:
            "border-amber-500/40 bg-gradient-to-br from-[#161208] via-[#241a06] to-[#120e05] text-amber-50 shadow-[0_12px_40px_-10px_rgba(245,158,11,0.25)]",
          glowClass: "bg-amber-500/15",
          accentColor: "text-amber-400",
          accentBorder: "border-amber-500/30",
          badgeBg: "bg-amber-500/15 text-amber-300 border-amber-500/30",
          typeCode: "TAX",
        };
      case "HEALTH_CARD":
        return {
          typeLabel: "HEALTH INSURANCE & MEDICAL ID",
          subLabel: "EMERGENCY COVERAGE & CLINICAL REGISTRATION",
          icon: HeartPulse,
          cardClass:
            "border-emerald-500/40 bg-gradient-to-br from-[#041611] via-[#05261d] to-[#031510] text-emerald-50 shadow-[0_12px_40px_-10px_rgba(16,185,129,0.3)]",
          glowClass: "bg-emerald-500/15",
          accentColor: "text-emerald-400",
          accentBorder: "border-emerald-500/30",
          badgeBg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
          typeCode: "MED",
        };
    }
  }, [identityType]);

  const TypeIcon = theme.icon;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border transition-all duration-300",
        theme.cardClass,
        compact ? "p-4" : "p-5",
        className
      )}
    >
      {/* Background Guilloché / Security Geometric Pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-10">
        <svg
          className="h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          height="100%"
        >
          <defs>
            <pattern
              id="guilloche-grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M0 20 Q10 0 20 20 T40 20 M20 0 Q30 20 40 0 T60 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.75"
              />
              <circle
                cx="20"
                cy="20"
                r="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#guilloche-grid)" />
        </svg>
      </div>

      {/* Ambient Radial Glowing Orbs */}
      <div
        className={cn(
          "pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full blur-3xl transition-opacity",
          theme.glowClass
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full blur-2xl opacity-60",
          theme.glowClass
        )}
      />

      {/* Holographic Sheen Overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-transparent" />

      {/* Interactive Card Action Header */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        {/* Left: Flag, Country & Document Class */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-2xl shadow-inner backdrop-blur-md">
            {country?.flag || "🌐"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-white/90">
                {country?.name || issuingCountry || "INTERNATIONAL"}
              </span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.2 font-mono text-[9px] font-semibold uppercase tracking-wider border",
                  theme.badgeBg
                )}
              >
                {issuingCountry || "UTO"}
              </span>
              {category && (
                <span className="rounded bg-white/10 px-1.5 py-0.2 font-mono text-[9px] text-white/70">
                  {category}
                </span>
              )}
            </div>
            <p className="font-mono text-xs font-semibold tracking-wider text-white truncate mt-0.5">
              {title || theme.typeLabel}
            </p>
          </div>
        </div>

        {/* Right: Status Pill & Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant="outline"
            className={cn("font-mono text-[10px] tracking-wide", expiry.badgeClass)}
          >
            {expiry.label}
          </Badge>

          {/* MRZ / Front Toggle (if passport or has MRZ) */}
          {(identityType === "PASSPORT" || mrzLine1) && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() =>
                setViewMode((prev) => (prev === "card" ? "mrz" : "card"))
              }
              title={viewMode === "card" ? "Show ICAO MRZ Code" : "Show Card View"}
              className={cn(
                "size-7 rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/15 hover:text-white transition-all",
                viewMode === "mrz" && "border-teal-400 bg-teal-500/20 text-teal-300"
              )}
            >
              <ScanLine className="size-3.5" />
            </Button>
          )}

          {/* Favorite Indicator / Toggle */}
          {onToggleFavorite ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onToggleFavorite}
              title={isFavorite ? "Favorited" : "Mark as favorite"}
              className={cn(
                "size-7 rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/15 hover:text-white transition-all",
                isFavorite && "border-amber-400/50 bg-amber-500/20 text-amber-400"
              )}
            >
              <Star
                className={cn("size-3.5", isFavorite && "fill-amber-400")}
              />
            </Button>
          ) : isFavorite ? (
            <div
              className="flex size-7 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-500/20 text-amber-400 shadow-xs"
              title="Favorited (Pinned)"
            >
              <Star className="size-3.5 fill-amber-400" />
            </div>
          ) : null}
        </div>
      </div>

      {/* VIEW MODE: MRZ TERMINAL VIEW */}
      {viewMode === "mrz" ? (
        <div className="relative z-10 mt-4 rounded-xl border border-teal-500/30 bg-black/60 p-3.5 font-mono backdrop-blur-md">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-teal-500/20 text-[10px]">
            <div className="flex items-center gap-1.5 text-teal-300">
              <ScanLine className="size-3" />
              <span className="uppercase tracking-widest font-semibold">
                ICAO Doc 9303 TD3 Terminal
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() =>
                handleCopy(
                  `${mrzLine1 || ""}\n${mrzLine2 || ""}`,
                  "MRZ Code Lines"
                )
              }
              className="h-6 gap-1 px-2 font-mono text-[10px] text-teal-300 hover:bg-teal-500/20 hover:text-white"
            >
              {copiedField === "MRZ Code Lines" ? (
                <>
                  <Check className="size-3 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  <span>Copy MRZ</span>
                </>
              )}
            </Button>
          </div>
          <div className="space-y-1 font-mono text-[11px] sm:text-xs tracking-widest text-teal-300 overflow-x-auto whitespace-pre">
            <div className="bg-teal-950/40 px-2 py-1 rounded border border-teal-500/20">
              {mrzLine1 || "P<KHM<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<"}
            </div>
            <div className="bg-teal-950/40 px-2 py-1 rounded border border-teal-500/20">
              {mrzLine2 || "0000000000KHM0000000X0000000<<<<<<<<<<<<<<0"}
            </div>
          </div>
        </div>
      ) : (
        /* VIEW MODE: REALISTIC CARD BODY */
        <div className="relative z-10 mt-4 space-y-3.5">
          {/* Main Card Data Grid */}
          <div className="grid grid-cols-12 gap-3.5 items-center">
            {/* Left Biometric / Photo ID Box */}
            <div className="col-span-3 sm:col-span-3">
              <div
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-xl border border-white/15 bg-white/5 p-2 text-center aspect-[3/3.8] shadow-inner backdrop-blur-sm group/photo overflow-hidden",
                  theme.accentBorder
                )}
              >
                {/* Simulated Holographic Crosshair Reticle */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                  <div className="size-10 border border-dashed border-white/40 rounded-full animate-[spin_18s_linear_infinite]" />
                  <div className="absolute h-full w-[1px] bg-white/20" />
                  <div className="absolute w-full h-[1px] bg-white/20" />
                </div>

                {/* Laser-Engraved Biometric Silhouette Icon */}
                <TypeIcon className={cn("size-6 opacity-85", theme.accentColor)} />

                <span className="font-mono text-[8px] tracking-wider uppercase text-white/60 mt-1.5 font-medium">
                  {identityType === "PASSPORT"
                    ? "BIO-CHIP"
                    : identityType === "DRIVERS_LICENSE"
                    ? "REAL ID"
                    : "ENCRYPTED"}
                </span>

                {/* Simulated e-Passport Chip Emblem */}
                {identityType === "PASSPORT" && (
                  <div className="mt-1 flex items-center gap-1 rounded bg-teal-500/20 px-1 py-0.5 border border-teal-400/30 text-[7px] text-teal-300 font-mono font-bold tracking-widest">
                    <Cpu className="size-2.5" />
                    <span>ICAO</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Cardholder Information */}
            <div className="col-span-9 sm:col-span-9 space-y-2.5">
              {/* Full Legal Name */}
              <div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-white/50 block">
                  Full Legal Name / Nom
                </span>
                <p className="font-mono text-sm sm:text-base font-bold tracking-wide text-white truncate">
                  {fullName ? fullName.toUpperCase() : "SPECIFY LEGAL NAME"}
                </p>
              </div>

              {/* Document Number with Mask & Copy */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-white/50">
                    Document Number / No.
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setIsMasked((v) => !v)}
                      className="rounded p-0.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                      title={isMasked ? "Reveal number" : "Mask number"}
                    >
                      {isMasked ? (
                        <Eye className="size-3" />
                      ) : (
                        <EyeOff className="size-3" />
                      )}
                    </button>
                    {documentNumber && (
                      <button
                        type="button"
                        onClick={() => handleCopy(documentNumber, "Document Number")}
                        className="rounded p-0.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                        title="Copy document number"
                      >
                        {copiedField === "Document Number" ? (
                          <Check className="size-3 text-emerald-400" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <p
                  className={cn(
                    "font-mono text-xs sm:text-sm font-semibold tracking-widest truncate",
                    theme.accentColor
                  )}
                >
                  {maskedNumber}
                </p>
              </div>

              {/* Metadata Micro-Grid (Authority, Dates) */}
              <div className="grid grid-cols-2 gap-2 pt-0.5 border-t border-white/10 text-[10px] font-mono">
                <div>
                  <span className="text-[8px] uppercase tracking-wider text-white/50 block">
                    Issuing Authority
                  </span>
                  <span className="text-white/90 truncate block font-medium">
                    {issuingAuthority || "OFFICIAL REGISTRY"}
                  </span>
                </div>
                <div>
                  <span className="text-[8px] uppercase tracking-wider text-white/50 block">
                    {issueDate ? `Issued: ${issueDate}` : "Valid Thru / Expiry"}
                  </span>
                  <span
                    className={cn(
                      "font-semibold truncate block",
                      expiry.status === "EXPIRED"
                        ? "text-red-400"
                        : expiry.status === "CRITICAL"
                        ? "text-amber-400"
                        : "text-emerald-300"
                    )}
                  >
                    {expirationDate || "NO EXPIRATION"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Security Band */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10 font-mono text-[9px] text-white/50">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="size-3 text-teal-400" />
              <span className="tracking-widest uppercase">
                ZERO-KNOWLEDGE SEALED
              </span>
            </div>
            <div className="flex items-center gap-2">
              {birthDate && (
                <span>DOB: {birthDate}</span>
              )}
              <span className="tracking-widest uppercase text-white/70 font-semibold">
                {theme.typeCode} • {issuingCountry || "KHM"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
