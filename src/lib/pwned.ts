/**
 * HaveIBeenPwned k-Anonymity Password Breach Checker
 * Uses client-side SHA-1 hashing via Web Crypto API.
 * ONLY the first 5 characters of the hash are queried (k-Anonymity),
 * ensuring the password NEVER leaves the client.
 */

export interface PwnedCheckResult {
  isPwned: boolean;
  breachCount: number;
}

// In-memory cache for HIBP range queries (prefix -> Map<suffix, breachCount>)
// A single prefix returns ~500 hashes, so one query can answer multiple passwords.
const prefixRangeCache = new Map<string, Map<string, number>>();

// In-memory cache for full hash results to make re-audits instantaneous
const hashResultCache = new Map<string, PwnedCheckResult>();

// In-flight promises to deduplicate simultaneous requests for the same prefix
const inFlightPrefixRequests = new Map<string, Promise<Map<string, number>>>();

/**
 * Computes SHA-1 hash of a string using Web Crypto API.
 */
async function computeSha1Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const cryptoObj = typeof window !== "undefined" && window.crypto?.subtle
    ? window.crypto
    : globalThis.crypto;

  if (!cryptoObj?.subtle) {
    throw new Error("Web Crypto API is not available in this environment.");
  }

  const hashBuffer = await cryptoObj.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * Fetches the HIBP range for a given 5-character SHA-1 prefix with caching and deduplication.
 */
async function fetchPrefixRange(prefix: string): Promise<Map<string, number>> {
  const upperPrefix = prefix.toUpperCase();

  // 1. Check cache
  const cached = prefixRangeCache.get(upperPrefix);
  if (cached) {
    return cached;
  }

  // 2. Check in-flight
  const inFlight = inFlightPrefixRequests.get(upperPrefix);
  if (inFlight) {
    return inFlight;
  }

  // 3. Dispatch fetch with timeout
  const requestPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(
        `https://api.pwnedpasswords.com/range/${upperPrefix}`,
        {
          method: "GET",
          headers: {
            "Add-Padding": "true", // Obfuscates response length for extra privacy
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        return new Map<string, number>();
      }

      const text = await response.text();
      const lines = text.split("\r\n");
      const suffixMap = new Map<string, number>();

      for (const line of lines) {
        const [hashSuffix, countStr] = line.split(":");
        if (hashSuffix) {
          const count = parseInt(countStr?.trim() || "1", 10) || 1;
          suffixMap.set(hashSuffix.trim().toUpperCase(), count);
        }
      }

      prefixRangeCache.set(upperPrefix, suffixMap);
      return suffixMap;
    } catch (err) {
      console.warn(`HIBP breach check query failed for prefix ${upperPrefix}:`, err);
      return new Map<string, number>();
    } finally {
      inFlightPrefixRequests.delete(upperPrefix);
    }
  })();

  inFlightPrefixRequests.set(upperPrefix, requestPromise);
  return requestPromise;
}

/**
 * Checks a single password against HaveIBeenPwned using k-Anonymity.
 */
export async function checkPasswordBreach(
  password: string
): Promise<PwnedCheckResult> {
  if (!password || password.length === 0) {
    return { isPwned: false, breachCount: 0 };
  }

  try {
    const hashHex = await computeSha1Hex(password);

    // Check fast cache
    const cachedResult = hashResultCache.get(hashHex);
    if (cachedResult) {
      return cachedResult;
    }

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const suffixMap = await fetchPrefixRange(prefix);
    const breachCount = suffixMap.get(suffix) || 0;
    const result: PwnedCheckResult = {
      isPwned: breachCount > 0,
      breachCount,
    };

    hashResultCache.set(hashHex, result);
    return result;
  } catch (err) {
    console.error("Error checking password breach status:", err);
    return { isPwned: false, breachCount: 0 };
  }
}

/**
 * Checks multiple unique passwords against HaveIBeenPwned in parallel with concurrency control.
 * Deduplicates prefixes so passwords with the same prefix only trigger 1 network call.
 */
export async function batchCheckPasswordBreaches(
  passwords: string[],
  concurrency = 6
): Promise<Map<string, PwnedCheckResult>> {
  const resultMap = new Map<string, PwnedCheckResult>();
  const uniquePasswords = Array.from(new Set(passwords.filter((p) => p && p.length > 0)));

  if (uniquePasswords.length === 0) {
    return resultMap;
  }

  // 1. Hash all unique passwords and map to their prefix/suffix
  const hashedList: { password: string; hashHex: string; prefix: string; suffix: string }[] = [];
  for (const pw of uniquePasswords) {
    try {
      const hashHex = await computeSha1Hex(pw);
      hashedList.push({
        password: pw,
        hashHex,
        prefix: hashHex.slice(0, 5),
        suffix: hashHex.slice(5),
      });
    } catch {
      resultMap.set(pw, { isPwned: false, breachCount: 0 });
    }
  }

  // 2. Collect unique prefixes that need fetching
  const uniquePrefixes = Array.from(new Set(hashedList.map((h) => h.prefix)));

  // 3. Fetch unique prefixes in batches with controlled concurrency
  for (let i = 0; i < uniquePrefixes.length; i += concurrency) {
    const chunk = uniquePrefixes.slice(i, i + concurrency);
    await Promise.all(chunk.map((prefix) => fetchPrefixRange(prefix)));
  }

  // 4. Resolve all passwords against the prefix caches
  for (const item of hashedList) {
    const cachedResult = hashResultCache.get(item.hashHex);
    if (cachedResult) {
      resultMap.set(item.password, cachedResult);
      continue;
    }

    const suffixMap = prefixRangeCache.get(item.prefix) || new Map<string, number>();
    const breachCount = suffixMap.get(item.suffix) || 0;
    const res: PwnedCheckResult = {
      isPwned: breachCount > 0,
      breachCount,
    };

    hashResultCache.set(item.hashHex, res);
    resultMap.set(item.password, res);
  }

  return resultMap;
}
