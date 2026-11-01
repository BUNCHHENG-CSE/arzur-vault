/**
 * Read-Only Public Blockchain RPC Balance Inspector
 * Completely non-custodial: only queries public read-only nodes with public addresses.
 */

export interface WalletBalanceResult {
  chain: string;
  symbol: string;
  balance: string;
  formatted: string;
}

export async function fetchCryptoBalance(
  address: string,
  chain: string
): Promise<WalletBalanceResult | null> {
  const cleanAddress = address.trim();
  if (!cleanAddress) return null;

  try {
    // 1. Ethereum / EVM
    if (chain.includes("Ethereum") || chain.includes("EVM")) {
      const response = await fetch("https://cloudflare-eth.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getBalance",
          params: [cleanAddress, "latest"],
          id: 1,
        }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      if (!data.result) return null;

      const wei = BigInt(data.result);
      // Convert wei to ETH with 4 decimal places
      const ethVal = Number(wei) / 1e18;
      const formatted = `${ethVal.toFixed(4)} ETH`;

      return {
        chain: "Ethereum",
        symbol: "ETH",
        balance: ethVal.toString(),
        formatted,
      };
    }

    // 2. Solana
    if (chain.includes("Solana")) {
      const response = await fetch("https://api.mainnet-beta.solana.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getBalance",
          params: [cleanAddress],
        }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      if (typeof data?.result?.value !== "number") return null;

      const lamports = data.result.value;
      const solVal = lamports / 1e9;
      const formatted = `${solVal.toFixed(4)} SOL`;

      return {
        chain: "Solana",
        symbol: "SOL",
        balance: solVal.toString(),
        formatted,
      };
    }

    // 3. Bitcoin
    if (chain.includes("Bitcoin")) {
      const response = await fetch(
        `https://blockchain.info/q/addressbalance/${encodeURIComponent(cleanAddress)}`
      );

      if (!response.ok) return null;
      const satoshisStr = await response.text();
      const satoshis = parseInt(satoshisStr, 10);
      if (isNaN(satoshis)) return null;

      const btcVal = satoshis / 1e8;
      const formatted = `${btcVal.toFixed(6)} BTC`;

      return {
        chain: "Bitcoin",
        symbol: "BTC",
        balance: btcVal.toString(),
        formatted,
      };
    }

    return null;
  } catch (err) {
    console.error("Failed to query public balance:", err);
    return null;
  }
}
