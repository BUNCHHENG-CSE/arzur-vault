/**
 * Domain & Anti-Phishing Utilities
 */

export function extractDomain(rawUrl: string): string | null {
  if (!rawUrl) return null;
  try {
    const formatted = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
      ? rawUrl
      : `https://${rawUrl}`;
    const parsed = new URL(formatted);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function getFaviconUrl(rawUrl: string): string | null {
  const domain = extractDomain(rawUrl);
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

// Common high-profile targets often impersonated
const TARGET_DOMAINS = [
  "paypal.com",
  "google.com",
  "binance.com",
  "coinbase.com",
  "github.com",
  "apple.com",
  "microsoft.com",
  "amazon.com",
  "metamask.io",
  "kraken.com",
  "ledger.com",
];

export interface PhishingCheckResult {
  isSuspicious: boolean;
  reason?: string;
}

export function checkPhishingRisk(rawUrl: string): PhishingCheckResult {
  const domain = extractDomain(rawUrl);
  if (!domain) {
    return { isSuspicious: false };
  }

  // 1. Check for Punycode / Internationalized Domain Names (IDN) homoglyph attack
  if (domain.startsWith("xn--") || domain.includes(".xn--")) {
    return {
      isSuspicious: true,
      reason: "Punycode (IDN) domain detected. Attackers frequently use this to mimic letters (e.g. Cyrillic 'а' for Latin 'a').",
    };
  }

  // 2. Check for suspicious non-ASCII characters directly in hostname
  if (/[^\u0020-\u007E]/.test(domain)) {
    return {
      isSuspicious: true,
      reason: "Domain contains non-standard unicode characters. High risk of visual spoofing (homoglyph attack).",
    };
  }

  // 3. Check for obvious character substitutions on major brands (e.g., paypaI with capital I, g00gle)
  for (const target of TARGET_DOMAINS) {
    const baseTarget = target.split(".")[0];
    if (domain !== target && domain.includes(baseTarget)) {
      // e.g. paypal-security-update.com or secure-binance-login.net
      if (
        domain.endsWith(`.${target}`) // legitimate subdomain like login.binance.com is fine
      ) {
        continue;
      }
      return {
        isSuspicious: true,
        reason: `Domain contains "${baseTarget}" but does not belong to the official ${target} domain.`,
      };
    }
  }

  return { isSuspicious: false };
}
