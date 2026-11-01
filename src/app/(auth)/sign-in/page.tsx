import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/sign-in-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Sign In | ArzurVault",
  description: "Authenticate to access your zero-knowledge ArzurVault.",
};

export default function SignInPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 text-foreground cyber-grid-bg">
      <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>
      <div className="pointer-events-none absolute top-0 left-1/2 -z-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-emerald-500/12 dark:bg-emerald-500/10 blur-[120px]" />
      <div className="relative z-10 flex w-full justify-center">
        <SignInForm />
      </div>
    </main>
  );
}
