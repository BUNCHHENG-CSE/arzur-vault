import type {
  PasswordSecretPayload,
  PaymentCardSecretPayload,
  SecureNoteSecretPayload,
  VaultItemRecord,
  VaultItemType,
} from "@/types/vault";

export interface ArzurEncryptedBackup {
  app: "arzur-vault";
  version: 1;
  exportedAt: string;
  items: {
    type: VaultItemType;
    title: string;
    subtitle: string | null;
    url: string | null;
    category: string | null;
    favorite: boolean;
    ciphertext: string;
    iv: string;
    salt: string;
  }[];
}

export interface ImportedParsedItem {
  type: VaultItemType;
  title: string;
  subtitle?: string;
  url?: string;
  category?: string;
  favorite?: boolean;
  secretPayload:
    | PasswordSecretPayload
    | SecureNoteSecretPayload
    | PaymentCardSecretPayload;
}

/**
 * Creates an encrypted backup file from the user's existing encrypted vault records.
 */
export function generateEncryptedBackup(items: VaultItemRecord[]): string {
  const backup: ArzurEncryptedBackup = {
    app: "arzur-vault",
    version: 1,
    exportedAt: new Date().toISOString(),
    items: items
      .filter((i) => !i.deletedAt)
      .map((item) => ({
        type: item.type,
        title: item.title,
        subtitle: item.subtitle,
        url: item.url,
        category: item.category,
        favorite: item.favorite,
        ciphertext: item.ciphertext,
        iv: item.iv,
        salt: item.salt,
      })),
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Simple CSV parser that handles quotes and commas correctly.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses uploaded CSV / JSON content from Bitwarden, 1Password, Chrome, or Arzur Vault.
 */
export function parseImportData(rawContent: string): {
  source: "Bitwarden" | "1Password" | "Chrome" | "ArzurVault" | "Unknown";
  items: ImportedParsedItem[];
} {
  const trimmed = rawContent.trim();

  // Try JSON first
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.app === "arzur-vault" && Array.isArray(parsed.items)) {
        // Encrypted Arzur backup cannot be decrypted without key directly in parse, but we return notice
        return { source: "ArzurVault", items: [] };
      }
    } catch {
      // not JSON
    }
  }

  // Parse CSV
  const rows = parseCSV(trimmed);
  if (rows.length < 2) {
    return { source: "Unknown", items: [] };
  }

  const headers = rows[0].map((h) => h.toLowerCase());

  // 1. Bitwarden CSV format detection
  // folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp
  if (headers.includes("login_username") && headers.includes("login_password")) {
    const nameIdx = headers.indexOf("name");
    const userIdx = headers.indexOf("login_username");
    const passIdx = headers.indexOf("login_password");
    const uriIdx = headers.indexOf("login_uri");
    const totpIdx = headers.indexOf("login_totp");
    const notesIdx = headers.indexOf("notes");
    const favIdx = headers.indexOf("favorite");

    const parsedItems: ImportedParsedItem[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const title = row[nameIdx] || "Imported Login";
      const username = row[userIdx] || "";
      const password = row[passIdx] || "";
      const url = uriIdx !== -1 ? row[uriIdx] : "";
      const totpSecret = totpIdx !== -1 ? row[totpIdx] : "";
      const notes = notesIdx !== -1 ? row[notesIdx] : "";
      const favorite = favIdx !== -1 ? row[favIdx] === "1" || row[favIdx]?.toLowerCase() === "true" : false;

      parsedItems.push({
        type: "PASSWORD",
        title,
        subtitle: username,
        url: url || undefined,
        favorite,
        secretPayload: {
          username,
          password,
          totpSecret: totpSecret || undefined,
          notes: notes || undefined,
        },
      });
    }

    return { source: "Bitwarden", items: parsedItems };
  }

  // 2. Google Chrome Passwords CSV detection
  // name,url,username,password,note
  if (headers.includes("name") && headers.includes("url") && headers.includes("username") && headers.includes("password")) {
    const nameIdx = headers.indexOf("name");
    const urlIdx = headers.indexOf("url");
    const userIdx = headers.indexOf("username");
    const passIdx = headers.indexOf("password");
    const noteIdx = headers.indexOf("note");

    const parsedItems: ImportedParsedItem[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const title = row[nameIdx] || "Chrome Login";
      const username = row[userIdx] || "";
      const password = row[passIdx] || "";
      const url = row[urlIdx] || "";
      const notes = noteIdx !== -1 ? row[noteIdx] : "";

      parsedItems.push({
        type: "PASSWORD",
        title,
        subtitle: username,
        url: url || undefined,
        secretPayload: {
          username,
          password,
          notes: notes || undefined,
        },
      });
    }

    return { source: "Chrome", items: parsedItems };
  }

  // 3. 1Password CSV detection
  // Title,Url,Username,Password,Notes
  if (headers.includes("title") && headers.includes("password")) {
    const titleIdx = headers.indexOf("title");
    const urlIdx = headers.indexOf("url");
    const userIdx = headers.indexOf("username");
    const passIdx = headers.indexOf("password");
    const notesIdx = headers.indexOf("notes");

    const parsedItems: ImportedParsedItem[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const title = row[titleIdx] || "1Password Login";
      const username = userIdx !== -1 ? row[userIdx] : "";
      const password = row[passIdx] || "";
      const url = urlIdx !== -1 ? row[urlIdx] : "";
      const notes = notesIdx !== -1 ? row[notesIdx] : "";

      parsedItems.push({
        type: "PASSWORD",
        title,
        subtitle: username,
        url: url || undefined,
        secretPayload: {
          username,
          password,
          notes: notes || undefined,
        },
      });
    }

    return { source: "1Password", items: parsedItems };
  }

  return { source: "Unknown", items: [] };
}
