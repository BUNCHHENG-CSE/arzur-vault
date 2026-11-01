"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { signUp } from "@/lib/auth-client";
import { calculatePasswordEntropy } from "@/lib/crypto";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const signUpSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters.")
      .max(80, "Name is too long."),
    email: z.string().trim().email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "Account password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type SignUpFormValues = z.infer<typeof signUpSchema>;

export function SignUpForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const watchedPassword = useWatch({ control, name: "password" });
  const strength = calculatePasswordEntropy(watchedPassword || "");

  const onSubmit = async (values: SignUpFormValues) => {
    setServerError(null);

    const { error } = await signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    });

    if (error) {
      const msg = error.message || "Unable to create account.";
      setServerError(msg);
      toast.error(msg);
      return;
    }

    toast.success("Account provisioned! Initialize your Master Key next.");
    router.push("/vault");
    router.refresh();
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Brand Emblem */}
      <div className="flex flex-col items-center space-y-3 text-center">
        <div className="relative flex size-14 items-center justify-center rounded-2xl border border-emerald-500/35 bg-card shadow-[0_8px_30px_-6px_rgba(16,185,129,0.25)] dark:shadow-[0_0_40px_-8px_rgba(16,185,129,0.45)]">
          <ShieldCheck className="size-7 text-emerald-600 dark:text-emerald-400" />
        </div>

        <div className="space-y-1">
          <h1 className="font-mono text-2xl font-bold tracking-widest text-foreground">
            ARZUR{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              {"//"}
            </span>{" "}
            VAULT
          </h1>
          <p className="text-xs text-muted-foreground">
            Provision Your Zero-Knowledge Cryptographic Vault
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge
            variant="outline"
            className="border-emerald-500/35 bg-emerald-500/10 font-mono text-[10px] text-emerald-700 dark:text-emerald-300"
          >
            CLIENT-SIDE ENCRYPTION
          </Badge>
          <Badge
            variant="outline"
            className="border-amber-500/35 bg-amber-500/10 font-mono text-[10px] text-amber-700 dark:text-amber-300"
          >
            SEED PHRASE READY
          </Badge>
        </div>
      </div>

      <Card className="border-border bg-card/90 shadow-xl backdrop-blur-xl dark:shadow-2xl">
        <CardHeader className="space-y-1 border-b border-border/80 pb-5">
          <CardTitle className="font-mono text-lg text-card-foreground">
            Create Operator Account
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Step 1 of 2: Register your account identity. You will generate your
            zero-knowledge Master Vault Passphrase immediately after.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-4 pt-5">
            {serverError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-700 dark:text-red-300">
                {serverError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs text-foreground/90">
                Operator Name
              </Label>
              <div className="relative">
                <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Satoshi Nakamoto"
                  className="bg-background pl-9 focus-visible:border-emerald-500/70"
                  aria-invalid={Boolean(errors.name)}
                  {...register("name")}
                />
              </div>
              {errors.name && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs text-foreground/90">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="operator@arzur.security"
                  className="bg-background pl-9 focus-visible:border-emerald-500/70"
                  aria-invalid={Boolean(errors.email)}
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-xs text-foreground/90"
                >
                  Account Password
                </Label>
                {watchedPassword && (
                  <span
                    className={`font-mono text-[11px] font-medium ${strength.colorClass}`}
                  >
                    {strength.label} ({strength.bits}-bit)
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Minimum 8 characters"
                  className="bg-background pr-10 pl-9 font-mono focus-visible:border-emerald-500/70"
                  aria-invalid={Boolean(errors.password)}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {watchedPassword && (
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all duration-300 dark:bg-emerald-500"
                    style={{ width: `${strength.barPercent}%` }}
                  />
                </div>
              )}
              {errors.password && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="confirmPassword"
                className="text-xs text-foreground/90"
              >
                Confirm Account Password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Re-enter account password"
                  className="bg-background pl-9 font-mono focus-visible:border-emerald-500/70"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  {...register("confirmPassword")}
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-amber-500/25 bg-amber-500/8 p-3 text-[11px] leading-relaxed text-muted-foreground dark:bg-amber-500/5">
              <div className="mb-0.5 flex items-center gap-1.5 font-mono font-semibold text-amber-700 dark:text-amber-400">
                <ShieldAlert className="size-3.5" />
                Zero-Knowledge Guarantee
              </div>
              ArzurVault servers never receive plaintext passwords or seed
              phrases. Use a distinct Master Passphrase in the next step for
              maximum cryptographic isolation.
            </div>
          </CardContent>

          <CardFooter className="mt-5 flex flex-col gap-4 border-t border-border/80 pt-5">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-600 font-mono text-xs font-semibold tracking-wider text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  PROVISIONING VAULT...
                </>
              ) : (
                "CREATE ENCRYPTED ACCOUNT"
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Already have a vault?{" "}
              <Link
                href="/sign-in"
                className="font-medium text-emerald-600 underline-offset-4 hover:text-emerald-700 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                Sign in to existing vault
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
