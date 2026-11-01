import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Provision Vault | ArzurVault",
  description: "Create a zero-knowledge ArzurVault account.",
};

export default function SignUpPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 text-foreground cyber-grid-bg">
      <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>
      <div className="pointer-events-none absolute top-0 left-1/2 -z-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-emerald-500/12 dark:bg-emerald-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-1/4 bottom-0 -z-0 h-[280px] w-[420px] rounded-full bg-amber-500/10 dark:bg-amber-500/5 blur-[110px]" />
      <div className="relative z-10 flex w-full justify-center">
        <SignUpForm />
      </div>
    </main>
  );
}
