"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { signIn } from "@/lib/auth-client";
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

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Account password is required."),
});

type SignInFormValues = z.infer<typeof signInSchema>;

export function SignInForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: SignInFormValues) => {
    setServerError(null);

    const { error } = await signIn.email({
      email: values.email,
      password: values.password,
    });

    if (error) {
      const msg = error.message || "Invalid email or password.";
      setServerError(msg);
      toast.error(msg);
      return;
    }

    toast.success("Authenticated. Proceed to unlock your Master Vault.");
    router.push("/vault");
    router.refresh();
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Brand Emblem */}
      <div className="flex flex-col items-center space-y-3 text-center">
        <div className="relative flex size-14 items-center justify-center rounded-2xl border border-emerald-500/35 bg-card shadow-[0_8px_30px_-6px_rgba(16,185,129,0.25)] dark:shadow-[0_0_40px_-8px_rgba(16,185,129,0.45)]">
          <ShieldCheck className="size-7 text-emerald-600 dark:text-emerald-400" />
          <span className="absolute -top-1 -right-1 flex size-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
          </span>
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
            Zero-Knowledge Password &amp; Seed Phrase Architecture
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge
            variant="outline"
            className="border-emerald-500/35 bg-emerald-500/10 font-mono text-[10px] text-emerald-700 dark:text-emerald-300"
          >
            AES-256-GCM
          </Badge>
          <Badge
            variant="outline"
            className="border-amber-500/35 bg-amber-500/10 font-mono text-[10px] text-amber-700 dark:text-amber-300"
          >
            BIP-39 VAULT
          </Badge>
          <Badge
            variant="outline"
            className="border-border bg-muted/60 font-mono text-[10px] text-muted-foreground"
          >
            PBKDF2 310K
          </Badge>
        </div>
      </div>

      <Card className="border-border bg-card/90 shadow-xl backdrop-blur-xl dark:shadow-2xl">
        <CardHeader className="space-y-1 border-b border-border/80 pb-5">
          <CardTitle className="font-mono text-lg text-card-foreground">
            Authenticate Operator Session
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Sign in to synchronize your encrypted ciphertext vault. Decryption
            keys remain strictly client-side.
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
              <Label htmlFor="password" className="text-xs text-foreground/90">
                Account Password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
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
              {errors.password && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border bg-muted/45 p-3 text-[11px] leading-relaxed text-muted-foreground">
              <div className="mb-0.5 flex items-center gap-1.5 font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                <KeyRound className="size-3.5" />
                Dual-Layer Separation
              </div>
              Your Account Password authenticates cloud sync. After signing in,
              you will unlock your local vault using your separate{" "}
              <span className="font-medium text-foreground">
                Zero-Knowledge Master Key
              </span>
              .
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
                  ESTABLISHING SESSION...
                </>
              ) : (
                "AUTHENTICATE & CONTINUE"
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              New to ArzurVault?{" "}
              <Link
                href="/sign-up"
                className="font-medium text-emerald-600 underline-offset-4 hover:text-emerald-700 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                Provision an encrypted vault
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
