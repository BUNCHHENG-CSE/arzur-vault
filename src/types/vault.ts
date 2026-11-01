export type VaultItemType =
  | "PASSWORD"
  | "CRYPTO_WALLET"
  | "SECURE_NOTE"
  | "PAYMENT_CARD"
  | "IDENTITY"
  | "PAY_PIN";

export type VaultCategoryFilter =
  | "ALL"
  | "PASSWORD"
  | "PAYMENT_CARD"
  | "IDENTITY"
  | "CRYPTO_WALLET"
  | "SECURE_NOTE"
  | "PAY_PIN"
  | "FAVORITES"
  | "TRASH";

export type CardBrand =
  | "Visa"
  | "Mastercard"
  | "American Express"
  | "Discover"
  | "JCB"
  | "Diners Club"
  | "UnionPay"
  | "Other";

export interface CustomField {
  id: string;
  label: string;
  value: string;
  isSecret: boolean;
  type?: "text" | "hidden" | "security_question";
}

export interface PasswordHistoryRecord {
  password: string;
  changedAt: string;
}

export interface PaymentCardSecretPayload {
  cardholderName: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  pin?: string;
  brand: CardBrand;
  notes?: string;
  customFields?: CustomField[];
}

export type CryptoWalletChain =
  | "Bitcoin"
  | "Ethereum / EVM"
  | "Solana"
  | "Cosmos"
  | "Hardware Wallet"
  | "Multi-Chain"
  | "Other";

export interface PasswordSecretPayload {
  username: string;
  email?: string;
  password: string;
  totpSecret?: string;
  notes?: string;
  customFields?: CustomField[];
  history?: PasswordHistoryRecord[];
}

export interface CryptoWalletSecretPayload {
  wordCount: 12 | 24;
  mnemonicWords: string[]; // Array of 12 or 24 BIP-39 recovery words in exact order
  walletType: CryptoWalletChain;
  publicAddress?: string;
  privateKey?: string;
  derivationPath?: string; // e.g., m/44'/60'/0'/0/0
  bip39Passphrase?: string; // Optional 25th word
  pinCode?: string;
  notes?: string;
  customFields?: CustomField[];
}

export interface SecureNoteSecretPayload {
  content: string;
}

export type IdentityType =
  | "PASSPORT"
  | "DRIVERS_LICENSE"
  | "NATIONAL_ID"
  | "TAX_ID"
  | "HEALTH_CARD";

export interface IdentitySecretPayload {
  identityType: IdentityType;
  fullName: string;
  documentNumber: string;
  issuingCountry: string;
  issuingAuthority?: string;
  birthDate?: string;
  issueDate?: string;
  expirationDate?: string;
  mrzLine1?: string;
  mrzLine2?: string;
  address?: string;
  notes?: string;
  customFields?: CustomField[];
}

export interface PayPinSecretPayload {
  name?: string;
  pin: string;
  notes?: string;
  customFields?: CustomField[];
}

export type DecryptedPayload =
  | PasswordSecretPayload
  | CryptoWalletSecretPayload
  | SecureNoteSecretPayload
  | PaymentCardSecretPayload
  | IdentitySecretPayload
  | PayPinSecretPayload;

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  salt: string;
}

export interface VaultVerifierStatus {
  isConfigured: boolean;
  vaultVerifierCipher: string | null;
  vaultVerifierIv: string | null;
  vaultVerifierSalt: string | null;
  duressEnabled?: boolean;
  duressVerifierCipher?: string | null;
  duressVerifierIv?: string | null;
  duressVerifierSalt?: string | null;
}

export interface AttachmentRecord {
  id: string;
  vaultItemId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  ciphertext: string;
  iv: string;
  salt: string;
  createdAt: Date | string;
}

export interface VaultSendRecord {
  id: string;
  userId: string;
  title: string;
  ciphertext: string;
  iv: string;
  salt: string | null;
  burnOnRead: boolean;
  maxViews: number;
  viewCount: number;
  expiresAt: Date | string;
  passwordProtected: boolean;
  passwordSalt: string | null;
  createdAt: Date | string;
}

export interface VaultItemRecord {
  id: string;
  userId: string;
  type: VaultItemType;
  title: string;
  subtitle: string | null;
  url: string | null;
  category: string | null;
  tags?: string[];
  favorite: boolean;
  deletedAt?: Date | string | null;
  isDecoy?: boolean;
  attachments?: AttachmentRecord[];
  ciphertext: string;
  iv: string;
  salt: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}
