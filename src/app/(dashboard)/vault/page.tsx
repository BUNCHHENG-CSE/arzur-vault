import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { auth } from "@/lib/auth";
import { getVaultItems, getVaultStatus } from "@/actions/vault-actions";
import { VaultProvider } from "@/context/vault-context";
import { VaultDashboard } from "@/components/vault/vault-dashboard";

async function AuthenticatedVaultLoader() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/sign-in");
  }

  const [vaultStatus, initialItems] = await Promise.all([
    getVaultStatus(),
    getVaultItems(),
  ]);

  return (
    <VaultProvider initialVerifier={vaultStatus}>
      <VaultDashboard
        userName={session.user.name}
        userEmail={session.user.email}
        initialItems={initialItems}
      />
    </VaultProvider>
  );
}

function VaultLoadingSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground cyber-grid-bg">
      <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-card/95 px-6 py-4 shadow-xl backdrop-blur">
        <div className="flex size-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Shield className="size-5 animate-pulse" />
        </div>
        <div>
          <p className="font-mono text-sm font-bold tracking-wider text-foreground">
            ARZUR{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              {"//"}
            </span>{" "}
            VAULT
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            Loading encrypted ciphertext envelope...
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VaultPage() {
  return (
    <Suspense fallback={<VaultLoadingSkeleton />}>
      <AuthenticatedVaultLoader />
    </Suspense>
  );
}
