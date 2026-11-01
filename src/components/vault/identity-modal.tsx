"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  Calendar,
  Car,
  Check,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  FileBadge,
  FileText,
  Folder,
  Globe2,
  HeartPulse,
  Info,
  Landmark,
  Loader2,
  Lock,
  MapPin,
  Plane,
  ReceiptText,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createVaultItem, updateVaultItem } from "@/actions/vault-actions";
import { useVault } from "@/context/vault-context";
import {
  ALL_COUNTRIES,
  POPULAR_COUNTRIES,
  calculateAge,
  checkDocumentExpiry,
  generatePassportMrz,
} from "@/lib/identity";
import { cn, copySecretToClipboard } from "@/lib/utils";
import type {
  CustomField,
  IdentitySecretPayload,
  IdentityType,
  VaultItemRecord,
} from "@/types/vault";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CustomFieldsEditor } from "@/components/vault/custom-fields-editor";
import { DigitalIdentityCard } from "@/components/vault/digital-identity-card";

interface IdentityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem?: VaultItemRecord | null;
  initialSecret?: IdentitySecretPayload | null;
  onSaved: (item: VaultItemRecord) => void;
}

interface IdentityFormValues {
  title: string;
  identityType: IdentityType;
  fullName: string;
  documentNumber: string;
  issuingCountry: string;
  issuingAuthority: string;
  birthDate: string;
  issueDate: string;
  expirationDate: string;
  mrzLine1: string;
  mrzLine2: string;
  address: string;
  category: string;
  notes: string;
  favorite: boolean;
}

const IDENTITY_TYPE_OPTIONS: {
  value: IdentityType;
  label: string;
  sub: string;
  icon: typeof Plane;
}[] = [
  {
    value: "PASSPORT",
    label: "Passport",
    sub: "Biometric travel document & official citizen passport",
    icon: Plane,
  },
  {
    value: "DRIVERS_LICENSE",
    label: "Driver's License",
    sub: "Motor vehicle operator credential & Real ID",
    icon: Car,
  },
  {
    value: "NATIONAL_ID",
    label: "National ID / SSN",
    sub: "Civil registration, national identity or social security",
    icon: Landmark,
  },
  {
    value: "TAX_ID",
    label: "Tax ID / EIN",
    sub: "Fiscal identification & business taxpayer registration",
    icon: ReceiptText,
  },
  {
    value: "HEALTH_CARD",
    label: "Health Insurance Card",
    sub: "Medical insurance policy & healthcare emergency identity",
    icon: HeartPulse,
  },
];

const QUICK_CATEGORIES = [
  "Personal",
  "Travel",
  "Government",
  "Work",
  "Family",
];

export function IdentityModal({
  open,
  onOpenChange,
  editingItem,
  initialSecret,
  onSaved,
}: IdentityModalProps) {
  const { encryptPayload, isVaultUnlocked } = useVault();
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("identity");
  const [copiedMrz, setCopiedMrz] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm<IdentityFormValues>({
    defaultValues: {
      title: "",
      identityType: "PASSPORT",
      fullName: "",
      documentNumber: "",
      issuingCountry: "KHM",
      issuingAuthority: "",
      birthDate: "",
      issueDate: "",
      expirationDate: "",
      mrzLine1: "",
      mrzLine2: "",
      address: "",
      category: "Personal",
      notes: "",
      favorite: false,
    },
  });

  useEffect(() => {
    if (open) {
      if (editingItem && initialSecret) {
        reset({
          title: editingItem.title,
          identityType: initialSecret.identityType || "PASSPORT",
          fullName: initialSecret.fullName || "",
          documentNumber: initialSecret.documentNumber || "",
          issuingCountry: initialSecret.issuingCountry || "KHM",
          issuingAuthority: initialSecret.issuingAuthority || "",
          birthDate: initialSecret.birthDate || "",
          issueDate: initialSecret.issueDate || "",
          expirationDate: initialSecret.expirationDate || "",
          mrzLine1: initialSecret.mrzLine1 || "",
          mrzLine2: initialSecret.mrzLine2 || "",
          address: initialSecret.address || "",
          category: editingItem.category || "Personal",
          notes: initialSecret.notes || "",
          favorite: editingItem.favorite,
        });
      } else {
        reset({
          title: "",
          identityType: "PASSPORT",
          fullName: "",
          documentNumber: "",
          issuingCountry: "KHM",
          issuingAuthority: "",
          birthDate: "",
          issueDate: "",
          expirationDate: "",
          mrzLine1: "",
          mrzLine2: "",
          address: "",
          category: "Personal",
          notes: "",
          favorite: false,
        });
      }
      const timer = setTimeout(() => {
        setActiveTab("identity");
        setCustomFields(
          editingItem && initialSecret ? initialSecret.customFields || [] : []
        );
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open, editingItem, initialSecret, reset]);

  // Form watchers for dynamic live preview
  const currentTitle = useWatch({ control, name: "title" });
  const currentType = useWatch({ control, name: "identityType" });
  const currentFullName = useWatch({ control, name: "fullName" });
  const currentDocNum = useWatch({ control, name: "documentNumber" });
  const currentCountry = useWatch({ control, name: "issuingCountry" });
  const currentAuthority = useWatch({ control, name: "issuingAuthority" });
  const currentBirthDate = useWatch({ control, name: "birthDate" });
  const currentIssueDate = useWatch({ control, name: "issueDate" });
  const currentExpDate = useWatch({ control, name: "expirationDate" });
  const currentMrzLine1 = useWatch({ control, name: "mrzLine1" });
  const currentMrzLine2 = useWatch({ control, name: "mrzLine2" });
  const currentCategory = useWatch({ control, name: "category" });
  const currentNotes = useWatch({ control, name: "notes" });
  const isFavorite = useWatch({ control, name: "favorite" });

  const expiryResult = useMemo(
    () => checkDocumentExpiry(currentExpDate),
    [currentExpDate]
  );

  const calculatedAge = useMemo(
    () => calculateAge(currentBirthDate),
    [currentBirthDate]
  );

  const countryObj = useMemo(
    () => ALL_COUNTRIES.find((c) => c.code === currentCountry),
    [currentCountry]
  );

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return ALL_COUNTRIES;
    return ALL_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  // Suggested Title generator
  const suggestedTitle = useMemo(() => {
    const cName = countryObj?.name || currentCountry || "";
    switch (currentType) {
      case "PASSPORT":
        return `${cName} Passport`.trim();
      case "DRIVERS_LICENSE":
        return `${cName} Driver's License`.trim();
      case "NATIONAL_ID":
        return `${cName} National ID`.trim();
      case "TAX_ID":
        return `${cName} Tax Registration`.trim();
      case "HEALTH_CARD":
        return `${cName} Health Card`.trim();
    }
  }, [currentType, countryObj, currentCountry]);

  // Quick Expiration Presets (+5 yrs, +10 yrs)
  const handleSetExpiryYears = (years: number) => {
    const baseDate = currentIssueDate ? new Date(currentIssueDate) : new Date();
    if (!isNaN(baseDate.getTime())) {
      const future = new Date(baseDate);
      future.setFullYear(future.getFullYear() + years);
      const yyyy = future.getFullYear();
      const mm = String(future.getMonth() + 1).padStart(2, "0");
      const dd = String(future.getDate()).padStart(2, "0");
      setValue("expirationDate", `${yyyy}-${mm}-${dd}`, {
        shouldDirty: true,
        shouldValidate: true,
      });
      toast.success(`Set expiration to ${years} years from ${currentIssueDate ? "issue date" : "today"}.`);
    }
  };

  const handleGenerateMrz = () => {
    const { line1, line2 } = generatePassportMrz({
      countryCode: currentCountry || "KHM",
      fullName: currentFullName || "SMITH JOHN",
      documentNumber: currentDocNum || "000000000",
      birthDate: getValues("birthDate"),
      expirationDate: currentExpDate,
    });
    setValue("mrzLine1", line1, { shouldDirty: true });
    setValue("mrzLine2", line2, { shouldDirty: true });
    toast.success("Generated compliant ICAO Doc 9303 TD3 MRZ lines.");
  };

  const handleCopyMrz = async () => {
    if (!currentMrzLine1 && !currentMrzLine2) return;
    const ok = await copySecretToClipboard(
      `${currentMrzLine1 || ""}\n${currentMrzLine2 || ""}`,
      "Passport MRZ Lines"
    );
    if (ok) {
      setCopiedMrz(true);
      setTimeout(() => setCopiedMrz(false), 2000);
    }
  };

  // Keyboard shortcut Ctrl+Enter to submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(onSubmit)();
    }
  };

  const onSubmit = async (values: IdentityFormValues) => {
    if (!isVaultUnlocked) {
      toast.error("Unlock vault first to save encrypted identity.");
      return;
    }

    setIsSubmitting(true);
    try {
      const secretPayload: IdentitySecretPayload = {
        identityType: values.identityType,
        fullName: values.fullName.trim(),
        documentNumber: values.documentNumber.trim(),
        issuingCountry: values.issuingCountry,
        issuingAuthority: values.issuingAuthority?.trim() || undefined,
        birthDate: values.birthDate || undefined,
        issueDate: values.issueDate || undefined,
        expirationDate: values.expirationDate || undefined,
        mrzLine1: values.mrzLine1 || undefined,
        mrzLine2: values.mrzLine2 || undefined,
        address: values.address?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
        customFields: customFields.length > 0 ? customFields : undefined,
      };

      const encrypted = await encryptPayload(secretPayload);

      // Subtitle format: e.g. "Passport • USA • Exp: 2029"
      const typeLabel =
        values.identityType === "PASSPORT"
          ? "Passport"
          : values.identityType === "DRIVERS_LICENSE"
          ? "Driver's License"
          : values.identityType === "NATIONAL_ID"
          ? "National ID"
          : values.identityType === "TAX_ID"
          ? "Tax ID"
          : "Health Card";

      const subtitle = `${typeLabel} • ${values.issuingCountry} ${
        values.expirationDate ? `• Exp: ${values.expirationDate}` : ""
      }`.trim();

      let savedRecord: VaultItemRecord;
      if (editingItem) {
        savedRecord = await updateVaultItem(editingItem.id, {
          type: "IDENTITY",
          title: values.title.trim(),
          subtitle,
          url: null,
          category: values.category.trim() || "Personal",
          tags: ["identity", values.identityType.toLowerCase()],
          favorite: values.favorite,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          salt: encrypted.salt,
        });
        toast.success("Identity record updated & re-encrypted.");
      } else {
        savedRecord = await createVaultItem({
          type: "IDENTITY",
          title: values.title.trim(),
          subtitle,
          url: null,
          category: values.category.trim() || "Personal",
          tags: ["identity", values.identityType.toLowerCase()],
          favorite: values.favorite,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          salt: encrypted.salt,
        });
        toast.success("Identity record encrypted & sealed in vault.");
      }

      onSaved(savedRecord);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to encrypt identity record."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[92vh] sm:max-w-3xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl dark:border-teal-500/20 dark:shadow-[0_0_50px_-10px_rgba(20,184,166,0.18)]"
        onKeyDown={handleKeyDown}
      >
        {/* Fixed Modern Modal Header */}
        <DialogHeader className="px-6 py-4 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-teal-500/35 bg-teal-500/10 text-teal-600 dark:text-teal-400 shadow-inner">
              <FileBadge className="size-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="font-mono text-base font-bold tracking-tight text-foreground truncate">
                  {editingItem ? "Edit Encrypted Identity" : "New Digital Identity"}
                </DialogTitle>
                <span className="inline-flex items-center gap-1 rounded border border-teal-500/35 bg-teal-500/10 px-1.5 py-0.5 font-mono text-[9px] font-medium text-teal-600 dark:text-teal-400">
                  <Lock className="size-2.5" /> AES-256-GCM
                </span>
              </div>
              <DialogDescription className="font-mono text-xs text-muted-foreground mt-0.5 truncate">
                Zero-knowledge client-side encryption • RAM only
              </DialogDescription>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setValue("favorite", !isFavorite, { shouldDirty: true })}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-mono transition-all",
                isFavorite
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                  : "border-border/60 bg-background/50 text-muted-foreground hover:border-foreground/20 hover:text-foreground"
              )}
              title={isFavorite ? "Favorited (Pinned)" : "Pin to Favorites"}
            >
              <Star className={cn("size-3.5", isFavorite && "fill-amber-500")} />
              <span className="hidden sm:inline text-[11px]">
                {isFavorite ? "Favorite" : "Pin"}
              </span>
            </button>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
              className="rounded-lg text-muted-foreground hover:text-foreground"
              title="Close modal (Esc)"
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Live Interactive Digital Credential Hero Preview */}
        <div className="px-6 pt-4 pb-2 border-b border-border/40 bg-muted/10 shrink-0">
          <DigitalIdentityCard
            identityType={currentType}
            title={currentTitle}
            fullName={currentFullName}
            documentNumber={currentDocNum}
            issuingCountry={currentCountry}
            issuingAuthority={currentAuthority}
            birthDate={currentBirthDate}
            issueDate={currentIssueDate}
            expirationDate={currentExpDate}
            mrzLine1={currentMrzLine1}
            mrzLine2={currentMrzLine2}
            category={currentCategory}
            isFavorite={isFavorite}
            compact
          />
        </div>

        {/* Tabs Navigation Header */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-6 pt-2 pb-2 border-b border-border/40 bg-muted/5 shrink-0">
            <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger
                value="identity"
                className="font-mono text-xs gap-1.5 rounded-lg data-active:bg-background data-active:text-foreground data-active:shadow-xs py-1.5"
              >
                <CreditCard className="size-3.5" />
                <span className="hidden sm:inline">Identity</span>
                <span className="sm:hidden">ID</span>
              </TabsTrigger>

              <TabsTrigger
                value="validity"
                className="font-mono text-xs gap-1.5 rounded-lg data-active:bg-background data-active:text-foreground data-active:shadow-xs py-1.5"
              >
                <Calendar className="size-3.5" />
                <span className="hidden sm:inline">Validity &amp; Dates</span>
                <span className="sm:hidden">Dates</span>
              </TabsTrigger>

              <TabsTrigger
                value="mrz"
                className="font-mono text-xs gap-1.5 rounded-lg data-active:bg-background data-active:text-foreground data-active:shadow-xs py-1.5 relative"
              >
                <ScanLine className="size-3.5" />
                <span className="hidden sm:inline">MRZ / Machine</span>
                <span className="sm:hidden">MRZ</span>
                {(currentMrzLine1 || currentMrzLine2) && (
                  <span className="flex size-1.5 rounded-full bg-teal-500" />
                )}
              </TabsTrigger>

              <TabsTrigger
                value="notes"
                className="font-mono text-xs gap-1.5 rounded-lg data-active:bg-background data-active:text-foreground data-active:shadow-xs py-1.5 relative"
              >
                <FileText className="size-3.5" />
                <span className="hidden sm:inline">Notes &amp; Extra</span>
                <span className="sm:hidden">Notes</span>
                {(customFields.length > 0 || currentNotes?.trim()) && (
                  <span className="rounded bg-muted px-1 py-0.2 text-[9px] font-mono text-muted-foreground">
                    {customFields.length + (currentNotes?.trim() ? 1 : 0)}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Form Scrollable Body */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 custom-scrollbar overscroll-contain">
              {/* TAB 1: PRIMARY IDENTITY & DOCUMENT DETAILS */}
              <TabsContent
                value="identity"
                className="space-y-4 mt-0 focus-visible:outline-none"
              >
                {/* Visual Identity Type Selector */}
                <div className="space-y-2">
                  <Label className="font-mono text-xs flex items-center justify-between">
                    <span>Identity Document Type *</span>
                    <span className="text-[10px] text-muted-foreground">
                      Format-specific encryption &amp; card layout
                    </span>
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {IDENTITY_TYPE_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = currentType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setValue("identityType", opt.value, {
                              shouldDirty: true,
                            })
                          }
                          className={cn(
                            "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all",
                            isSelected
                              ? "border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400 shadow-sm"
                              : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                          )}
                        >
                          <Icon className="size-4 mb-1.5" />
                          <span className="font-mono text-xs font-semibold leading-tight">
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Record Title with Smart Suggestion */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="font-mono text-xs">Record Title *</Label>
                    {suggestedTitle && currentTitle !== suggestedTitle && (
                      <button
                        type="button"
                        onClick={() =>
                          setValue("title", suggestedTitle, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                        className="flex items-center gap-1 font-mono text-[10px] text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 transition-colors"
                      >
                        <Sparkles className="size-3" />
                        <span>Use &quot;{suggestedTitle}&quot;</span>
                      </button>
                    )}
                  </div>
                  <Input
                    {...register("title", { required: "Record title is required" })}
                    placeholder="e.g. US Passport, CA Driver License"
                    className="font-mono text-xs"
                  />
                  {errors.title && (
                    <p className="font-mono text-[10px] text-red-500">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                {/* Full Legal Name & Document Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-mono text-xs">Full Legal Name *</Label>
                    <div className="relative">
                      <User className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        {...register("fullName", {
                          required: "Full legal name is required",
                        })}
                        placeholder="e.g. Johnathan Adam Doe"
                        className="pl-9 font-mono text-xs"
                      />
                    </div>
                    {errors.fullName ? (
                      <p className="font-mono text-[10px] text-red-500">
                        {errors.fullName.message}
                      </p>
                    ) : (
                      <p className="font-mono text-[10px] text-muted-foreground">
                        Exact name as printed on the credential
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-mono text-xs">Document Number *</Label>
                    <div className="relative">
                      <CreditCard className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        {...register("documentNumber", {
                          required: "Document number is required",
                        })}
                        placeholder="e.g. C01293849, DL-9382103"
                        className="pl-9 font-mono text-xs uppercase"
                      />
                    </div>
                    {errors.documentNumber ? (
                      <p className="font-mono text-[10px] text-red-500">
                        {errors.documentNumber.message}
                      </p>
                    ) : (
                      <p className="font-mono text-[10px] text-muted-foreground">
                        Unique alphanumeric ID / serial number
                      </p>
                    )}
                  </div>
                </div>

                {/* Issuing Country & Issuing Authority */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-mono text-xs flex items-center gap-1.5">
                      <Globe2 className="size-3.5 text-muted-foreground" />
                      <span>Issuing Country</span>
                    </Label>
                    <Popover
                      open={countryPickerOpen}
                      onOpenChange={setCountryPickerOpen}
                    >
                      <PopoverTrigger className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-xs font-mono shadow-xs transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0 leading-none">
                            {countryObj?.flag || "🌐"}
                          </span>
                          <span className="truncate font-medium text-foreground">
                            {countryObj?.name || currentCountry || "Select Country"}
                          </span>
                          <span className="text-muted-foreground text-[10px] shrink-0 font-mono">
                            ({countryObj?.code || currentCountry})
                          </span>
                        </div>
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground ml-2" />
                      </PopoverTrigger>

                      <PopoverContent
                        align="start"
                        sideOffset={6}
                        className="w-[calc(100vw-3rem)] sm:w-[420px] p-0 gap-0 font-mono text-xs shadow-2xl rounded-xl border border-border bg-popover overflow-hidden z-50"
                      >
                        {/* Sticky Search Header */}
                        <div className="p-2.5 border-b border-border/60 bg-muted/20">
                          <div className="relative">
                            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <input
                              type="text"
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                              placeholder="Search 190+ countries or code..."
                              className="w-full bg-background rounded-lg pl-8 pr-7 py-1.5 text-xs font-mono border border-border/60 focus:outline-none focus:border-teal-500/70"
                              autoFocus
                            />
                            {countrySearch && (
                              <button
                                type="button"
                                onClick={() => setCountrySearch("")}
                                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                <X className="size-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Quick Popular Country Chips */}
                          {!countrySearch && (
                            <div className="flex items-center gap-1.5 pt-2 flex-wrap">
                              <span className="text-[10px] text-muted-foreground font-mono">
                                Popular:
                              </span>
                              {POPULAR_COUNTRIES.slice(0, 6).map((pCode) => {
                                const c = ALL_COUNTRIES.find((x) => x.code === pCode);
                                if (!c) return null;
                                return (
                                  <button
                                    key={c.code}
                                    type="button"
                                    onClick={() => {
                                      setValue("issuingCountry", c.code, {
                                        shouldDirty: true,
                                      });
                                      setCountryPickerOpen(false);
                                      setCountrySearch("");
                                    }}
                                    className={cn(
                                      "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] border transition-colors cursor-pointer",
                                      currentCountry === c.code
                                        ? "border-teal-500 bg-teal-500/15 text-teal-600 dark:text-teal-400 font-semibold"
                                        : "border-border/60 bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                  >
                                    <span>{c.flag}</span>
                                    <span>{c.code}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Scrollable List of All Countries */}
                        <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
                          {filteredCountries.length === 0 ? (
                            <div className="py-6 text-center text-muted-foreground text-xs font-mono">
                              No country found matching &quot;{countrySearch}&quot;
                            </div>
                          ) : (
                            filteredCountries.map((c) => {
                              const isSelected = currentCountry === c.code;
                              return (
                                <button
                                  key={c.code}
                                  type="button"
                                  onClick={() => {
                                    setValue("issuingCountry", c.code, {
                                      shouldDirty: true,
                                    });
                                    setCountryPickerOpen(false);
                                    setCountrySearch("");
                                  }}
                                  className={cn(
                                    "flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer",
                                    isSelected
                                      ? "bg-teal-500/15 text-teal-600 dark:text-teal-400 font-semibold"
                                      : "hover:bg-muted/60 text-foreground"
                                  )}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 pr-3">
                                    <span className="text-base shrink-0 leading-none">
                                      {c.flag}
                                    </span>
                                    <span className="truncate">{c.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 border border-border/40 px-1.5 py-0.5 rounded">
                                      {c.code}
                                    </span>
                                    {isSelected && (
                                      <Check className="size-3.5 text-teal-500 shrink-0" />
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-mono text-xs flex items-center justify-between">
                      <span>Issuing Authority</span>
                      <span className="text-[10px] text-muted-foreground">
                        Optional
                      </span>
                    </Label>
                    <Input
                      {...register("issuingAuthority")}
                      placeholder="e.g. Department of State, DMV, DVLA"
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: VALIDITY & DATES */}
              <TabsContent
                value="validity"
                className="space-y-4.5 mt-0 focus-visible:outline-none"
              >
                {/* Expiration Status Callout Banner */}
                {currentExpDate && (
                  <div
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border text-xs font-mono",
                      expiryResult.status === "EXPIRED"
                        ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                        : expiryResult.status === "CRITICAL"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "border-teal-500/30 bg-teal-500/10 text-teal-600 dark:text-teal-400"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 shrink-0" />
                      <div>
                        <p className="font-semibold">{expiryResult.label}</p>
                        <p className="text-[10px] opacity-80">
                          {expiryResult.daysRemaining !== null &&
                          expiryResult.daysRemaining > 0
                            ? `Expires in ${expiryResult.daysRemaining} days (${(
                                expiryResult.daysRemaining / 365
                              ).toFixed(1)} years)`
                            : "Document expired. Vault will remind you on renewal."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dates Section: DOB, Issue Date, Expiration Date */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="font-mono text-xs">Date of Birth</Label>
                      {calculatedAge !== null && (
                        <span className="font-mono text-[10px] text-teal-600 dark:text-teal-400">
                          Age: {calculatedAge}y
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="date"
                        {...register("birthDate")}
                        className="pl-9 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-mono text-xs">Issue Date</Label>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="date"
                        {...register("issueDate")}
                        className="pl-9 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="font-mono text-xs">Expiration Date</Label>
                      {currentExpDate && (
                        <button
                          type="button"
                          onClick={() =>
                            setValue("expirationDate", "", { shouldDirty: true })
                          }
                          className="font-mono text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="date"
                        {...register("expirationDate")}
                        className="pl-9 font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Expiration Quick Presets */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    Quick Expiry Presets:
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => handleSetExpiryYears(10)}
                    className="h-6 font-mono text-[10px]"
                  >
                    +10 Years (Passport)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => handleSetExpiryYears(5)}
                    className="h-6 font-mono text-[10px]"
                  >
                    +5 Years (License)
                  </Button>
                </div>

                {/* Address on Document */}
                <div className="space-y-1.5 pt-2">
                  <Label className="font-mono text-xs flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    <span>Address on Document</span>
                  </Label>
                  <Input
                    {...register("address")}
                    placeholder="e.g. 742 Evergreen Terrace, Springfield, OR"
                    className="font-mono text-xs"
                  />
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Residential address as registered on this official ID
                  </p>
                </div>

                {/* Folder / Category Selection */}
                <div className="space-y-1.5">
                  <Label className="font-mono text-xs flex items-center gap-1.5">
                    <Folder className="size-3.5 text-muted-foreground" />
                    <span>Folder / Category</span>
                  </Label>
                  <Input
                    {...register("category")}
                    placeholder="e.g. Personal, Travel, Government"
                    className="font-mono text-xs"
                  />
                  <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      Suggestions:
                    </span>
                    {QUICK_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() =>
                          setValue("category", cat, { shouldDirty: true })
                        }
                        className={cn(
                          "rounded-md border px-2 py-0.5 font-mono text-[10px] transition-colors",
                          currentCategory === cat
                            ? "border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400 font-semibold"
                            : "border-border/60 bg-background text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: MRZ & MACHINE READABLE ZONE */}
              <TabsContent
                value="mrz"
                className="space-y-4.5 mt-0 focus-visible:outline-none"
              >
                {/* Informational Guidance Box */}
                <div className="rounded-xl border border-border bg-muted/20 p-3.5 text-xs font-mono space-y-1">
                  <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-semibold">
                    <Info className="size-4" />
                    <span>ICAO Doc 9303 TD3 Machine Readable Zone</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Standard 2-line 44-character optical character recognition (OCR)
                    code found on biometric passports and national travel identity
                    cards. Used by airport e-gates and automated border control.
                  </p>
                </div>

                {/* Auto-Generate Bar & Actions */}
                <div className="flex items-center justify-between">
                  <Label className="font-mono text-xs font-semibold">
                    MRZ Optical Lines (Line 1 &amp; Line 2)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={handleGenerateMrz}
                      className="gap-1 font-mono text-[10px] border-teal-500/30 text-teal-600 dark:text-teal-400 hover:bg-teal-500/10"
                    >
                      <Wand2 className="size-3" />
                      Auto-Generate MRZ
                    </Button>
                    {(currentMrzLine1 || currentMrzLine2) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={handleCopyMrz}
                        className="gap-1 font-mono text-[10px]"
                      >
                        {copiedMrz ? (
                          <>
                            <Check className="size-3 text-emerald-500" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" />
                            <span>Copy Lines</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* MRZ Line 1 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="font-mono text-[10px] text-muted-foreground">
                      Line 1 (Document Type, Country &amp; Name)
                    </Label>
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {(currentMrzLine1 || "").length} / 44 chars
                    </span>
                  </div>
                  <Input
                    {...register("mrzLine1")}
                    placeholder="P<KHM DOE<<JOHNATHAN<ADAM<<<<<<<<<<<<<<<<<<<<"
                    className="font-mono text-xs tracking-widest uppercase bg-muted/10 font-medium"
                    maxLength={44}
                  />
                </div>

                {/* MRZ Line 2 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="font-mono text-[10px] text-muted-foreground">
                      Line 2 (Doc #, DOB, Gender, Expiry &amp; Checksums)
                    </Label>
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {(currentMrzLine2 || "").length} / 44 chars
                    </span>
                  </div>
                  <Input
                    {...register("mrzLine2")}
                    placeholder="C012938497KHM9010144M3010148<<<<<<<<<<<<<<0"
                    className="font-mono text-xs tracking-widest uppercase bg-muted/10 font-medium"
                    maxLength={44}
                  />
                </div>
              </TabsContent>

              {/* TAB 4: NOTES & CUSTOM FIELDS */}
              <TabsContent
                value="notes"
                className="space-y-5 mt-0 focus-visible:outline-none"
              >
                {/* Confidential Notes */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="font-mono text-xs">
                      Confidential Document Notes
                    </Label>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      AES-256-GCM Encrypted
                    </span>
                  </div>
                  <Textarea
                    {...register("notes")}
                    placeholder="Renewal tracking numbers, emergency consulate contacts, biometric passport chip pin, or safe location..."
                    rows={4}
                    className="font-mono text-xs resize-none leading-relaxed"
                  />
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Only decrypted when your master key unlocks this vault item.
                  </p>
                </div>

                {/* Custom Fields & Security Questions */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <Label className="font-mono text-xs">
                    Custom Encrypted Fields &amp; Attributes
                  </Label>
                  <CustomFieldsEditor
                    fields={customFields}
                    onChange={setCustomFields}
                  />
                </div>
              </TabsContent>
            </div>

            {/* Pinned Bottom Footer */}
            <DialogFooter className="px-6 py-3.5 border-t border-border/60 bg-muted/20 flex flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 text-muted-foreground font-mono text-[11px]">
                <div className="flex size-2 rounded-full bg-teal-500 animate-pulse" />
                <span className="hidden sm:inline">
                  AES-256-GCM Zero-Knowledge RAM
                </span>
                <span className="sm:hidden">Zero-Knowledge</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="font-mono text-xs h-8.5 px-3.5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-teal-600 hover:bg-teal-500 text-white font-mono text-xs font-semibold h-8.5 px-4 shadow-[0_0_20px_rgba(20,184,166,0.25)] transition-all dark:bg-teal-500 dark:text-zinc-950 dark:hover:bg-teal-400"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      ENCRYPTING...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-3.5" />
                      <span>
                        {editingItem ? "RE-ENCRYPT & SAVE" : "ENCRYPT & SEAL IDENTITY"}
                      </span>
                      <kbd className="hidden sm:inline-flex ml-1.5 px-1.5 py-0.5 text-[9px] rounded bg-black/20 text-white/90 dark:bg-white/20 dark:text-zinc-950 font-mono">
                        Ctrl+↵
                      </kbd>
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
