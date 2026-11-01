import { calculatePasswordEntropy } from "@/lib/crypto";
import { batchCheckPasswordBreaches, type PwnedCheckResult } from "@/lib/pwned";
import type {
  PasswordSecretPayload,
  VaultItemRecord,
} from "@/types/vault";

export type AuditIssueType =
  | "PWNED"
  | "REUSED"
  | "WEAK"
  | "MISSING_2FA";

export interface AuditItemIssue {
  type: AuditIssueType;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
}

export interface AuditedItem {
  item: VaultItemRecord;
  secret: PasswordSecretPayload;
  password?: string;
  issues: AuditItemIssue[];
}

export interface VaultAuditReport {
  overallScore: number; // 0 - 100
  totalAnalyzed: number;
  pwnedCount: number;
  reusedCount: number;
  weakCount: number;
  missing2faCount: number;
  auditedItems: AuditedItem[];
  auditedAt: number;
}

/**
 * Runs a comprehensive security audit on decrypted passwords.
 * Optimized with batch k-Anonymity breach checking and parallel analysis.
 */
export async function runVaultSecurityAudit(
  items: { item: VaultItemRecord; secret: PasswordSecretPayload }[],
  checkBreaches = true
): Promise<VaultAuditReport> {
  // 1. Group for reuse analysis: password -> list of { id, title }
  const passwordMap = new Map<string, { id: string; title: string }[]>();

  for (const { item, secret } of items) {
    if (secret.password) {
      const existing = passwordMap.get(secret.password) || [];
      existing.push({ id: item.id, title: item.title });
      passwordMap.set(secret.password, existing);
    }
  }

  // 2. Batch check all unique passwords against HaveIBeenPwned in parallel
  let breachResults = new Map<string, PwnedCheckResult>();
  if (checkBreaches) {
    const uniquePasswords = Array.from(passwordMap.keys());
    breachResults = await batchCheckPasswordBreaches(uniquePasswords, 6);
  }

  let pwnedCount = 0;
  let reusedCount = 0;
  let weakCount = 0;
  let missing2faCount = 0;

  const auditedItems: AuditedItem[] = [];

  for (const { item, secret } of items) {
    const issues: AuditItemIssue[] = [];
    const password = secret.password || "";

    // A. Check Password Strength / Entropy
    if (!password || password.length === 0) {
      weakCount++;
      issues.push({
        type: "WEAK",
        title: "Missing Password",
        description: "This account record has no password saved.",
        severity: "critical",
      });
    } else if (password.length < 8) {
      weakCount++;
      issues.push({
        type: "WEAK",
        title: "Critically Short Password",
        description: `Only ${password.length} characters long. Susceptible to instant dictionary and brute-force cracking.`,
        severity: "critical",
      });
    } else {
      const entropy = calculatePasswordEntropy(password);
      if (entropy.bits < 50) {
        weakCount++;
        issues.push({
          type: "WEAK",
          title: "Weak Password",
          description: `Low entropy score (${entropy.bits} bits). Predictable character sets make it vulnerable.`,
          severity: "high",
        });
      }
    }

    // B. Check Password Reuse
    if (password) {
      const reusedList = passwordMap.get(password) || [];
      if (reusedList.length > 1) {
        reusedCount++;
        const otherAccounts = reusedList
          .filter((r) => r.id !== item.id)
          .map((r) => r.title);
        const preview =
          otherAccounts.slice(0, 3).join(", ") +
          (otherAccounts.length > 3
            ? ` and ${otherAccounts.length - 3} others`
            : "");

        issues.push({
          type: "REUSED",
          title: "Reused Password",
          description: `Shared with: ${preview}. If one service suffers a credential leak, all shared accounts are vulnerable.`,
          severity: "high",
        });
      }
    }

    // C. Check Missing 2FA / TOTP
    if (!secret.totpSecret) {
      missing2faCount++;
      issues.push({
        type: "MISSING_2FA",
        title: "No Two-Factor (TOTP) Secret",
        description:
          "Account lacks an integrated TOTP authenticator key. 2FA prevents takeover even if credentials leak.",
        severity: "medium",
      });
    }

    // D. Check HaveIBeenPwned Data Breaches
    if (checkBreaches && password) {
      const breach = breachResults.get(password);
      if (breach?.isPwned) {
        pwnedCount++;
        issues.push({
          type: "PWNED",
          title: "Exposed in Known Breach",
          description: `Found in ${breach.breachCount.toLocaleString()} public data breach${
            breach.breachCount === 1 ? "" : "es"
          } via HaveIBeenPwned. Rotate this password immediately.`,
          severity: "critical",
        });
      }
    }

    // Sort issues by severity: critical -> high -> medium -> low
    const severityOrder: Record<AuditItemIssue["severity"], number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    issues.sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );

    auditedItems.push({
      item,
      secret,
      password,
      issues,
    });
  }

  // Calculate overall score (0 - 100)
  const total = items.length;
  let score = 100;

  if (total > 0) {
    // Breached passwords are disproportionately dangerous:
    // Even 1 breached password should noticeably pull down score
    const pwnedPenalty = (pwnedCount / total) * 50;
    const reusedPenalty = (reusedCount / total) * 25;
    const weakPenalty = (weakCount / total) * 20;
    const missing2faPenalty = (missing2faCount / total) * 5;

    score = Math.max(
      0,
      Math.round(100 - pwnedPenalty - reusedPenalty - weakPenalty - missing2faPenalty)
    );
  }

  return {
    overallScore: score,
    totalAnalyzed: total,
    pwnedCount,
    reusedCount,
    weakCount,
    missing2faCount,
    auditedItems,
    auditedAt: Date.now(),
  };
}
