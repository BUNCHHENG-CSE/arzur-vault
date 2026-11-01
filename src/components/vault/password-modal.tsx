"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Globe,
  History,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Timer,
  User,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createVaultItem, updateVaultItem } from "@/actions/vault-actions";
import { useVault } from "@/context/vault-context";
import {
  calculatePasswordEntropy,
  generateSecurePassword,
  type PasswordGeneratorOptions,
} from "@/lib/crypto";
import { copySecretToClipboard, cn } from "@/lib/utils";
import {
  extractDomain,
  getFaviconUrl,
  checkPhishingRisk,
} from "@/lib/phishing";
import { parseTotpInput } from "@/lib/totp";
import { CustomFieldsEditor } from "@/components/vault/custom-fields-editor";
import { TotpDisplay } from "@/components/vault/totp-display";
import type {
  CustomField,
  PasswordSecretPayload,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const passwordFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title / Service name is required.").max(160),
    username: z.string().trim().max(200),
    email: z
      .string()
      .trim()
      .max(200)
      .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
        message: "Please enter a valid email address.",
      }),
    password: z.string().min(1, "Password is required."),
    url: z.string().trim().max(500),
    category: z.string().trim().max(80),
    totpSecret: z.string().trim().max(240),
    notes: z.string().max(4000),
    favorite: z.boolean(),
  })
  .refine((data) => data.username.length > 0 || data.email.length > 0, {
    message: "Either Account/Username or Email is required.",
    path: ["username"],
  });

type PasswordFormValues = z.infer<typeof passwordFormSchema>;

interface PasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem?: VaultItemRecord | null;
  initialSecret?: PasswordSecretPayload | null;
  onSaved: (item: VaultItemRecord) => void;
}

const QUICK_CATEGORIES = [
  "Work",
  "Personal",
  "DeFi",
  "Banking",
  "Social",
  "Cloud",
  "Dev",
  "Crypto",
];

const DEFAULT_GEN_OPTIONS: PasswordGeneratorOptions = {
  length: 24,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
};

const KNOWN_SERVICES: Record<string, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  google: "Google",
  binance: "Binance",
  coinbase: "Coinbase",
  kraken: "Kraken",
  metamask: "MetaMask",
  twitter: "Twitter / X",
  x: "X (Twitter)",
  aws: "AWS Console",
  cloudflare: "Cloudflare",
  discord: "Discord",
  notion: "Notion",
  slack: "Slack",
  linear: "Linear",
  vercel: "Vercel",
  apple: "Apple ID",
  microsoft: "Microsoft",
  amazon: "Amazon",
  proton: "Proton",
};

export function PasswordModal({
  open,
  onOpenChange,
  editingItem = null,
  initialSecret = null,
  onSaved,
}: PasswordModalProps) {
  const { encryptPayload } = useVault();
  const [activeTab, setActiveTab] = useState("credentials");
  const [showPassword, setShowPassword] = useState(false);
  const [showGenSettings, setShowGenSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const [genOptions, setGenOptions] = useState<PasswordGeneratorOptions>(DEFAULT_GEN_OPTIONS);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      title: "",
      username: "",
      email: "",
      password: "",
      url: "",
      category: "",
      totpSecret: "",
      notes: "",
      favorite: false,
    },
  });

  useEffect(() => {
    if (open) {
      if (editingItem && initialSecret) {
        reset({
          title: editingItem.title,
          username: initialSecret.username || editingItem.subtitle || "",
          email: initialSecret.email || "",
          password: initialSecret.password || "",
          url: editingItem.url || "",
          category: editingItem.category || "",
          totpSecret: initialSecret.totpSecret || "",
          notes: initialSecret.notes || "",
          favorite: editingItem.favorite,
        });
      } else {
        reset({
          title: "",
          username: "",
          email: "",
          password: "",
          url: "",
          category: "",
          totpSecret: "",
          notes: "",
          favorite: false,
        });
      }
      const timer = setTimeout(() => {
        setFaviconFailed(false);
        setShowPassword(false);
        setShowGenSettings(false);
        setShowHistory(false);
        setActiveTab("credentials");
        setCustomFields(
          editingItem && initialSecret ? initialSecret.customFields || [] : []
        );
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open, editingItem, initialSecret, reset]);

  const currentPassword = useWatch({ control, name: "password" });
  const currentTitle = useWatch({ control, name: "title" });
  const currentUrl = useWatch({ control, name: "url" });
  const currentCategory = useWatch({ control, name: "category" });
  const currentTotp = useWatch({ control, name: "totpSecret" });
  const currentNotes = useWatch({ control, name: "notes" });
  const isFavorite = useWatch({ control, name: "favorite" });

  const strength = useMemo(
    () => calculatePasswordEntropy(currentPassword || ""),
    [currentPassword]
  );

  const domain = useMemo(
    () => (currentUrl ? extractDomain(currentUrl) : null),
    [currentUrl]
  );

  const faviconUrl = useMemo(() => {
    if (!domain || faviconFailed) return null;
    return getFaviconUrl(domain);
  }, [domain, faviconFailed]);

  const phishingRisk = useMemo(() => {
    if (!currentUrl) return { isSuspicious: false };
    return checkPhishingRisk(currentUrl);
  }, [currentUrl]);

  const suggestedTitle = useMemo(() => {
    if (!domain) return null;
    const base = domain.replace(/^www\./, "").split(".")[0]?.toLowerCase();
    if (!base) return null;
    return KNOWN_SERVICES[base] || (base.charAt(0).toUpperCase() + base.slice(1));
  }, [domain]);

  const handleApplyCombo = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return false;

    // Check if multi-line format:
    // Line 1: Title (e.g., "MyStorage")
    // Line 2: "metamaskWeb+bravewallet: rGTID2mxvGo;Q[as"
    const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let potentialTitle = "";
    let credentialLine = "";

    if (lines.length >= 2 && lines[1].includes(":")) {
      potentialTitle = lines[0];
      credentialLine = lines[1];
    } else {
      credentialLine = lines[0];
    }

    if (credentialLine.includes(":")) {
      const colonIdx = credentialLine.indexOf(":");
      const parsedUser = credentialLine.slice(0, colonIdx).trim();
      const parsedPass = credentialLine.slice(colonIdx + 1).trim();

      if (parsedUser) {
        if (parsedUser.includes("@")) {
          setValue("email", parsedUser, { shouldValidate: true, shouldDirty: true });
        }
        setValue("username", parsedUser, { shouldValidate: true, shouldDirty: true });
      }
      if (parsedPass) {
        setValue("password", parsedPass, { shouldValidate: true, shouldDirty: true });
      }
      if (potentialTitle && !currentTitle) {
        setValue("title", potentialTitle, { shouldValidate: true, shouldDirty: true });
      }
      toast.success("Credential combo parsed & applied!");
      return true;
    }
    return false;
  };

  const handleGeneratePassword = (opts: PasswordGeneratorOptions) => {
    const newPassword = generateSecurePassword(opts);
    setValue("password", newPassword, {
      shouldValidate: true,
      shouldDirty: true,
    });
    toast.success("Generated strong CSPRNG password");
  };

  const handleCopyPassword = async () => {
    if (!currentPassword) return;
    const ok = await copySecretToClipboard(currentPassword, "Password");
    if (ok) {
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  const handleTotpInputChange = (val: string) => {
    const trimmed = val.trim();
    if (trimmed.startsWith("otpauth://")) {
      const parsed = parseTotpInput(trimmed);
      if (parsed.secret) {
        setValue("totpSecret", parsed.secret, {
          shouldValidate: true,
          shouldDirty: true,
        });
        if (parsed.issuer && !currentTitle) {
          setValue("title", parsed.issuer, {
            shouldValidate: true,
            shouldDirty: true,
          });
        }
        toast.success(
          `Imported 2FA authenticator key${parsed.issuer ? ` for ${parsed.issuer}` : ""}`
        );
        return;
      }
    }
    setValue("totpSecret", val, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const onSubmit = async (values: PasswordFormValues) => {
    try {
      let updatedHistory = initialSecret?.history || [];
      if (
        editingItem &&
        initialSecret?.password &&
        initialSecret.password !== values.password
      ) {
        updatedHistory = [
          {
            password: initialSecret.password,
            changedAt: new Date().toISOString(),
          },
          ...updatedHistory,
        ].slice(0, 10);
      }

      const resolvedUsername = values.username.trim() || values.email.trim();

      const secretPayload: PasswordSecretPayload = {
        username: resolvedUsername,
        email: values.email.trim() || undefined,
        password: values.password,
        totpSecret: values.totpSecret || undefined,
        notes: values.notes || undefined,
        customFields: customFields.length > 0 ? customFields : undefined,
        history: updatedHistory.length > 0 ? updatedHistory : undefined,
      };

      const encrypted = await encryptPayload(secretPayload);

      const input = {
        type: "PASSWORD" as const,
        title: values.title,
        subtitle: resolvedUsername,
        url: values.url || null,
        category: values.category || null,
        favorite: values.favorite,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        salt: encrypted.salt,
      };

      const saved = editingItem
        ? await updateVaultItem(editingItem.id, input)
        : await createVaultItem(input);

      toast.success(
        editingItem
          ? "Encrypted login updated in vault."
          : "Password encrypted & stored in vault."
      );
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to encrypt password item.";
      toast.error(msg);
    }
  };

  const handleModalOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setShowPassword(false);
      setShowGenSettings(false);
      setShowHistory(false);
    }
    onOpenChange(nextOpen);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSubmit(onSubmit)();
    }
  };

  const hasTotp = Boolean(currentTotp?.trim());
  const hasNotesOrFields = Boolean(currentNotes?.trim() || customFields.length > 0);

  return (
    <Dialog open={open} onOpenChange={handleModalOpenChange}>
      <DialogContent
        className="max-h-[92vh] sm:max-w-2xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl dark:border-emerald-500/20 dark:shadow-[0_0_50px_-10px_rgba(16,185,129,0.18)]"
        showCloseButton={false}
      >
        {/* Top Header */}
        <DialogHeader className="px-6 py-4.5 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Live Favicon or Glowing Security Squircle */}
            <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-500/10 shadow-[0_0_15px_-3px_rgba(16,185,129,0.25)] text-emerald-600 dark:text-emerald-400">
              {faviconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={faviconUrl}
                  alt=""
                  className="size-5.5 rounded object-contain"
                  onError={() => setFaviconFailed(true)}
                />
              ) : (
                <KeyRound className="size-5" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="font-heading font-semibold text-base tracking-tight text-foreground truncate">
                  {editingItem ? "Edit Encrypted Login" : "New Encrypted Login"}
                </DialogTitle>
                <span className="inline-flex items-center gap-1 rounded border border-emerald-500/35 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
                  <Lock className="size-2.5" /> AES-256-GCM
                </span>
              </div>
              <DialogDescription className="font-mono text-xs text-muted-foreground mt-0.5 truncate">
                Zero-knowledge client-side encryption • RAM only
              </DialogDescription>
            </div>
          </div>

          {/* Header Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Favorite Star Button */}
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

            {/* Custom Close Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => handleModalOpenChange(false)}
              className="rounded-lg text-muted-foreground hover:text-foreground"
              title="Close modal (Esc)"
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Tab Navigation Header */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-6 pt-2.5 pb-2 border-b border-border/40 bg-muted/10">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger
                value="credentials"
                className="font-mono text-xs gap-1.5 rounded-lg data-active:bg-background data-active:text-foreground data-active:shadow-xs py-1.5"
              >
                <KeyRound className="size-3.5" />
                <span>Credentials</span>
              </TabsTrigger>
              <TabsTrigger
                value="totp"
                className="font-mono text-xs gap-1.5 rounded-lg data-active:bg-background data-active:text-foreground data-active:shadow-xs py-1.5 relative"
              >
                <Timer className="size-3.5" />
                <span>2FA Authenticator</span>
                {hasTotp && (
                  <span className="flex size-1.5 rounded-full bg-emerald-500" />
                )}
              </TabsTrigger>
              <TabsTrigger
                value="notes"
                className="font-mono text-xs gap-1.5 rounded-lg data-active:bg-background data-active:text-foreground data-active:shadow-xs py-1.5 relative"
              >
                <FileText className="size-3.5" />
                <span>Notes &amp; Fields</span>
                {hasNotesOrFields && (
                  <span className="rounded bg-muted px-1 py-0.2 text-[9px] font-mono text-muted-foreground">
                    {customFields.length + (currentNotes?.trim() ? 1 : 0)}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Form Content Container */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            onKeyDown={handleKeyDown}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Scrollable Tab Panels */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 custom-scrollbar overscroll-contain">
              {/* TAB 1: PRIMARY CREDENTIALS */}
              <TabsContent value="credentials" className="space-y-4.5 mt-0 focus-visible:outline-none">
                {/* Phishing Alert Banner (if suspicious URL) */}
                {phishingRisk.isSuspicious && (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400 flex items-start gap-2.5">
                    <ShieldAlert className="size-4 shrink-0 mt-0.5 text-red-500" />
                    <div className="space-y-1">
                      <p className="font-mono font-semibold">
                        High Phishing Risk Detected
                      </p>
                      <p className="text-[11px] leading-relaxed text-red-700 dark:text-red-300">
                        {phishingRisk.reason}
                      </p>
                    </div>
                  </div>
                )}

                {/* Service Title & URL */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pw-title" className="font-mono text-xs text-foreground/90 font-medium">
                        Service / Title *
                      </Label>
                      {suggestedTitle && !currentTitle && (
                        <button
                          type="button"
                          onClick={() => setValue("title", suggestedTitle, { shouldDirty: true })}
                          className="font-mono text-[10px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1"
                        >
                          <Sparkles className="size-3" />
                          Suggest: &quot;{suggestedTitle}&quot;
                        </button>
                      )}
                    </div>
                    <Input
                      id="pw-title"
                      placeholder="e.g., GitHub, Binance, AWS Root"
                      className="bg-background focus-visible:border-emerald-500/70 font-sans text-xs h-9"
                      aria-invalid={Boolean(errors.title)}
                      {...register("title")}
                    />
                    {errors.title && (
                      <p className="text-xs text-red-600 dark:text-red-400 font-mono">
                        {errors.title.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pw-url" className="font-mono text-xs text-foreground/90 font-medium">
                        Website URL
                      </Label>
                      {domain && (
                        <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px]">
                          {domain}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Globe className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="pw-url"
                        type="url"
                        placeholder="https://github.com/login"
                        className="bg-background font-mono text-xs pl-8.5 focus-visible:border-emerald-500/70 h-9"
                        {...register("url")}
                      />
                      {currentUrl && (
                        <button
                          type="button"
                          onClick={() => setValue("url", "", { shouldDirty: true })}
                          className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          title="Clear URL"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Account / Username & Email Address */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pw-username" className="font-mono text-xs text-foreground/90 font-medium">
                        Account / Username
                      </Label>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        Name, login, or ID
                      </span>
                    </div>
                    <div className="relative">
                      <User className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="pw-username"
                        placeholder="e.g., metamaskWeb or admin"
                        className="bg-background font-mono text-xs pl-8.5 focus-visible:border-emerald-500/70 h-9"
                        aria-invalid={Boolean(errors.username)}
                        {...register("username")}
                        onPaste={(e) => {
                          const pasted = e.clipboardData.getData("text");
                          if (pasted && pasted.includes(":")) {
                            const ok = handleApplyCombo(pasted);
                            if (ok) {
                              e.preventDefault();
                            }
                          }
                        }}
                      />
                    </div>
                    {errors.username && (
                      <p className="text-xs text-red-600 dark:text-red-400 font-mono">
                        {errors.username.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pw-email" className="font-mono text-xs text-foreground/90 font-medium">
                        Email Address
                      </Label>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        Optional
                      </span>
                    </div>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="pw-email"
                        type="email"
                        placeholder="e.g., operator@security.io"
                        className="bg-background font-mono text-xs pl-8.5 focus-visible:border-emerald-500/70 h-9"
                        aria-invalid={Boolean(errors.email)}
                        {...register("email")}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-xs text-red-600 dark:text-red-400 font-mono">
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Password Card with Integrated Generator & Strength Meter */}
                <div className="rounded-xl border border-border/80 bg-muted/25 p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pw-secret" className="font-mono text-xs text-foreground font-semibold flex items-center gap-1.5">
                      <Lock className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      Password *
                    </Label>

                    {/* Toolbar: Strength Pill + Quick Generate + Generator Settings */}
                    <div className="flex items-center gap-1.5">
                      {currentPassword && (
                        <span
                          className={cn(
                            "rounded-md border border-border/60 bg-background/80 px-2 py-0.5 font-mono text-[10px] font-semibold",
                            strength.colorClass
                          )}
                        >
                          {strength.label} ({strength.bits}b)
                        </span>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => handleGeneratePassword(genOptions)}
                        className="font-mono text-[11px] gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                        title="Generate strong 24-character cryptographic password"
                      >
                        <Wand2 className="size-3" />
                        <span>Generate</span>
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setShowGenSettings((prev) => !prev)}
                        className={cn(
                          "font-mono text-[11px] gap-1 text-muted-foreground hover:text-foreground",
                          showGenSettings && "bg-muted text-foreground"
                        )}
                        title="Generator parameters"
                      >
                        <SlidersHorizontal className="size-3" />
                        <span className="hidden sm:inline">Options</span>
                      </Button>
                    </div>
                  </div>

                  {/* Password Input Row */}
                  <div className="relative">
                    <Input
                      id="pw-secret"
                      type={showPassword ? "text" : "password"}
                      autoComplete="off"
                      placeholder="••••••••••••••••••••••••"
                      className="bg-background pr-18 font-mono text-xs tracking-wider focus-visible:border-emerald-500/70 h-9.5"
                      aria-invalid={Boolean(errors.password)}
                      {...register("password")}
                    />

                    <div className="absolute top-1/2 right-2 -translate-y-1/2 flex items-center gap-1">
                      {currentPassword && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={handleCopyPassword}
                          className="text-muted-foreground hover:text-foreground"
                          title="Copy password (auto-clears in 30s)"
                        >
                          {copiedPassword ? (
                            <Check className="size-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="text-muted-foreground hover:text-foreground"
                        title={showPassword ? "Hide password" : "Reveal password"}
                      >
                        {showPassword ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* 4-Segment Strength Meter */}
                  <div className="space-y-1.5 pt-0.5">
                    <div className="grid grid-cols-4 gap-1.5">
                      <div
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-300",
                          strength.bits > 0
                            ? strength.bits < 50
                              ? "bg-red-500"
                              : "bg-emerald-500"
                            : "bg-muted"
                        )}
                      />
                      <div
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-300",
                          strength.bits >= 50
                            ? strength.bits < 75
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                            : "bg-muted"
                        )}
                      />
                      <div
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-300",
                          strength.bits >= 75 ? "bg-emerald-500" : "bg-muted"
                        )}
                      />
                      <div
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-300",
                          strength.bits >= 110 ? "bg-emerald-400 dark:bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-muted"
                        )}
                      />
                    </div>
                    <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                      <span>
                        {strength.bits >= 110
                          ? "Fortress • High-entropy CSPRNG"
                          : strength.bits >= 75
                          ? "Strong • Resistant to brute force"
                          : strength.bits >= 50
                          ? "Fair • Consider adding symbols or length"
                          : "Weak • Low cryptographic complexity"}
                      </span>
                      <span>Web Crypto CSPRNG</span>
                    </div>
                  </div>

                  {/* Expandable Inline Generator Controls */}
                  {showGenSettings && (
                    <div className="rounded-xl border border-border/70 bg-background/80 p-3.5 space-y-3 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          Generator Settings
                        </span>
                        <span className="rounded border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {genOptions.length} chars
                        </span>
                      </div>

                      {/* Length Slider */}
                      <div className="space-y-1">
                        <input
                          type="range"
                          min={8}
                          max={64}
                          value={genOptions.length}
                          onChange={(e) => {
                            const next = { ...genOptions, length: Number(e.target.value) };
                            setGenOptions(next);
                            handleGeneratePassword(next);
                          }}
                          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-emerald-600 dark:accent-emerald-500"
                        />
                        <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
                          <span>8</span>
                          <span>16</span>
                          <span>24</span>
                          <span>32</span>
                          <span>48</span>
                          <span>64</span>
                        </div>
                      </div>

                      {/* Character Toggles */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs font-mono">
                          <span>A–Z</span>
                          <Switch
                            size="sm"
                            checked={genOptions.uppercase}
                            onCheckedChange={(checked) => {
                              const next = { ...genOptions, uppercase: checked };
                              setGenOptions(next);
                              handleGeneratePassword(next);
                            }}
                          />
                        </label>
                        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs font-mono">
                          <span>a–z</span>
                          <Switch
                            size="sm"
                            checked={genOptions.lowercase}
                            onCheckedChange={(checked) => {
                              const next = { ...genOptions, lowercase: checked };
                              setGenOptions(next);
                              handleGeneratePassword(next);
                            }}
                          />
                        </label>
                        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs font-mono">
                          <span>0–9</span>
                          <Switch
                            size="sm"
                            checked={genOptions.numbers}
                            onCheckedChange={(checked) => {
                              const next = { ...genOptions, numbers: checked };
                              setGenOptions(next);
                              handleGeneratePassword(next);
                            }}
                          />
                        </label>
                        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs font-mono">
                          <span>!@#$</span>
                          <Switch
                            size="sm"
                            checked={genOptions.symbols}
                            onCheckedChange={(checked) => {
                              const next = { ...genOptions, symbols: checked };
                              setGenOptions(next);
                              handleGeneratePassword(next);
                            }}
                          />
                        </label>
                      </div>

                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => handleGeneratePassword(genOptions)}
                        className="w-full font-mono text-xs gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                      >
                        <RefreshCw className="size-3" />
                        Regenerate With These Settings
                      </Button>
                    </div>
                  )}

                  {/* Password History Collapsible (when editing) */}
                  {initialSecret?.history && initialSecret.history.length > 0 && (
                    <div className="border-t border-border/60 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowHistory((prev) => !prev)}
                        className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <History className="size-3 text-emerald-500" />
                        <span>
                          Previous Password History ({initialSecret.history.length})
                        </span>
                      </button>

                      {showHistory && (
                        <div className="mt-2 space-y-1.5 rounded-lg border border-border/70 bg-background/60 p-2.5">
                          {initialSecret.history.map((h, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-2 font-mono text-xs p-1 rounded hover:bg-muted/40"
                            >
                              <div className="min-w-0">
                                <span className="text-foreground truncate block">
                                  ••••••••••••••••
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(h.changedAt).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => copySecretToClipboard(h.password, "Past password")}
                                  title="Copy past password"
                                >
                                  <Copy className="size-3" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => {
                                    setValue("password", h.password, {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    });
                                    toast.info("Restored password from revision history.");
                                  }}
                                  className="font-mono text-[10px] gap-1"
                                >
                                  <RotateCcw className="size-2.5" />
                                  Restore
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {errors.password && (
                    <p className="text-xs text-red-600 dark:text-red-400 font-mono">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {/* Quick Category Chips */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pw-category" className="font-mono text-xs text-foreground/90 font-medium">
                      Category Tag
                    </Label>
                    {currentCategory && (
                      <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                        Selected: {currentCategory}
                      </span>
                    )}
                  </div>
                  <Input
                    id="pw-category"
                    placeholder="Work, DeFi, Banking, Social..."
                    className="bg-background text-xs h-9 focus-visible:border-emerald-500/70"
                    {...register("category")}
                  />
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {QUICK_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() =>
                          setValue("category", currentCategory === cat ? "" : cat, {
                            shouldDirty: true,
                          })
                        }
                        className={cn(
                          "rounded-md border px-2.5 py-0.5 font-mono text-[10px] transition-all",
                          currentCategory === cat
                            ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-700 font-semibold shadow-xs dark:text-emerald-300"
                            : "border-border bg-muted/40 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bottom Quick Jumpers */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 font-mono text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => setActiveTab("totp")}
                    className="inline-flex items-center gap-1.5 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                  >
                    <Timer className="size-3.5 text-emerald-500" />
                    <span>{hasTotp ? "Configure 2FA (Active)" : "+ Set up 2FA Authenticator"}</span>
                    <ArrowRight className="size-3" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("notes")}
                    className="inline-flex items-center gap-1.5 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                  >
                    <FileText className="size-3.5 text-emerald-500" />
                    <span>{hasNotesOrFields ? "Custom Fields & Notes (Set)" : "+ Add Notes or Custom Fields"}</span>
                    <ArrowRight className="size-3" />
                  </button>
                </div>
              </TabsContent>

              {/* TAB 2: TWO-FACTOR AUTHENTICATION (2FA) */}
              <TabsContent value="totp" className="space-y-4.5 mt-0 focus-visible:outline-none">
                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-lg border border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Timer className="size-4" />
                      </div>
                      <div>
                        <Label htmlFor="pw-totp" className="font-mono text-xs font-semibold text-foreground">
                          2FA / TOTP Authenticator Key
                        </Label>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          RFC 6238 Time-Based One-Time Password
                        </p>
                      </div>
                    </div>

                    {hasTotp && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="flex size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live Synchronized
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Input
                      id="pw-totp"
                      type={showPassword ? "text" : "password"}
                      autoComplete="off"
                      placeholder="Paste Base32 key (e.g. JBSWY3DPEHPK3PXP) or otpauth:// URI"
                      value={currentTotp || ""}
                      onChange={(e) => handleTotpInputChange(e.target.value)}
                      className="bg-background font-mono text-xs focus-visible:border-emerald-500/70 h-9"
                    />
                    <p className="font-mono text-[10px] text-muted-foreground">
                      Tip: You can paste full <code className="text-foreground">otpauth://totp/...</code> QR export links directly.
                    </p>
                  </div>
                </div>

                {/* Live TOTP Verification Widget */}
                {hasTotp ? (
                  <div className="space-y-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Live TOTP Verification Preview
                    </span>
                    <TotpDisplay secret={currentTotp} />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-5 text-center space-y-2">
                    <Timer className="size-8 text-muted-foreground/60 mx-auto" />
                    <p className="font-mono text-xs font-semibold text-foreground">
                      No 2FA Key Configured Yet
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground max-w-md mx-auto leading-relaxed">
                      Enable two-factor authentication without third-party phone apps. Paste the setup secret provided by your service, and Arzur Vault computes 6-digit codes in local RAM.
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* TAB 3: NOTES & CUSTOM FIELDS */}
              <TabsContent value="notes" className="space-y-4.5 mt-0 focus-visible:outline-none">
                {/* Encrypted Notes */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pw-notes" className="font-mono text-xs text-foreground/90 font-medium">
                      Encrypted Notes
                    </Label>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      Zero-knowledge AES-256-GCM
                    </span>
                  </div>
                  <Textarea
                    id="pw-notes"
                    rows={4}
                    placeholder="Recovery codes, server IPs, operational notes, or security answers..."
                    className="bg-background font-mono text-xs focus-visible:border-emerald-500/70 leading-relaxed"
                    {...register("notes")}
                  />
                </div>

                {/* Custom Fields & Security Questions Editor */}
                <CustomFieldsEditor
                  fields={customFields}
                  onChange={setCustomFields}
                />
              </TabsContent>
            </div>

            {/* Pinned Bottom Footer */}
            <DialogFooter className="px-6 py-3.5 border-t border-border/60 bg-muted/20 flex flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 text-muted-foreground font-mono text-[11px]">
                <div className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden sm:inline">AES-256-GCM Zero-Knowledge RAM</span>
                <span className="sm:hidden">Zero-Knowledge</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleModalOpenChange(false)}
                  className="font-mono text-xs h-8.5 px-3.5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-semibold h-8.5 px-4 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      ENCRYPTING...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-3.5" />
                      <span>{editingItem ? "RE-ENCRYPT & SAVE" : "ENCRYPT & SAVE LOGIN"}</span>
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
