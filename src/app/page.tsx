import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { auth } from "@/lib/auth";

async function SessionRedirectGate(): Promise<null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    redirect("/vault");
  }

  redirect("/sign-in");
}

function EntryLoadingShield() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground cyber-grid-bg">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card/90 px-6 py-4 shadow-xl backdrop-blur">
        <div className="flex size-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Shield className="size-5 animate-pulse" />
        </div>
        <div>
          <p className="font-mono text-sm font-semibold tracking-wider text-foreground">
            ARZUR{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              {"//"}
            </span>{" "}
            VAULT
          </p>
          <p className="text-xs text-muted-foreground">
            Verifying encrypted session boundary...
          </p>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<EntryLoadingShield />}>
      <SessionRedirectGate />
    </Suspense>
  );
}
