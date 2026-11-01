import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Encrypted Vault | ArzurVault",
  description:
    "Manage your zero-knowledge encrypted passwords, BIP-39 crypto wallet seed phrases, and secure notes.",
};

export default function VaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">{children}</div>
  );
}
