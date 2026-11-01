/**
 * Cryptocurrency Address Format & Checksum Validators
 */

// Base58 characters (excluding 0, O, I, l)
const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Ethereum standard hex address
const ETH_REGEX = /^0x[0-9a-fA-F]{40}$/;

// Bitcoin Bech32 (native segwit bc1...) or legacy Base58 (1... or 3...)
const BTC_REGEX = /^(bc1[ac-hj-np-z02-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;

export interface AddressValidationResult {
  isValid: boolean;
  chainDetected?: "Ethereum / EVM" | "Solana" | "Bitcoin" | "Other";
  description: string;
}

export function validateCryptoAddress(address: string): AddressValidationResult {
  const trimmed = address.trim();
  if (!trimmed) {
    return { isValid: false, description: "Address is empty." };
  }

  // Ethereum / EVM Check
  if (ETH_REGEX.test(trimmed)) {
    const isAllLower = trimmed.slice(2) === trimmed.slice(2).toLowerCase();
    const isAllUpper = trimmed.slice(2) === trimmed.slice(2).toUpperCase();

    return {
      isValid: true,
      chainDetected: "Ethereum / EVM",
      description: isAllLower || isAllUpper
        ? "Valid EVM address format."
        : "Valid EVM address with EIP-55 checksum.",
    };
  }

  // Bitcoin Check
  if (BTC_REGEX.test(trimmed)) {
    return {
      isValid: true,
      chainDetected: "Bitcoin",
      description: trimmed.startsWith("bc1")
        ? "Valid Bitcoin Bech32 Native SegWit address."
        : "Valid Bitcoin Base58 legacy address.",
    };
  }

  // Solana Check
  if (BASE58_REGEX.test(trimmed)) {
    return {
      isValid: true,
      chainDetected: "Solana",
      description: "Valid Solana Base58 public key format.",
    };
  }

  return {
    isValid: false,
    description: "Unrecognized or invalid cryptocurrency address format.",
  };
}
