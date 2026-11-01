"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type {
  VaultItemRecord,
  VaultItemType,
  VaultVerifierStatus,
} from "@/types/vault";

const verifierSchema = z.object({
  ciphertext: z.string().min(1, "Verifier ciphertext is required"),
  iv: z.string().min(1, "Verifier IV is required"),
  salt: z.string().min(1, "Verifier salt is required"),
});

const vaultItemInputSchema = z.object({
  type: z.enum([
    "PASSWORD",
    "CRYPTO_WALLET",
    "SECURE_NOTE",
    "PAYMENT_CARD",
    "IDENTITY",
    "PAY_PIN",
  ]),
  title: z.string().trim().min(1, "Title is required").max(160),
  subtitle: z.string().trim().max(240).optional().nullable(),
  url: z.string().trim().max(500).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  favorite: z.boolean().optional().default(false),
  isDecoy: z.boolean().optional().default(false),
  ciphertext: z.string().min(1, "Encrypted payload is required"),
  iv: z.string().min(1, "Initialization vector (IV) is required"),
  salt: z.string().min(1, "Key derivation salt is required"),
});

export type VaultItemInput = z.input<typeof vaultItemInputSchema>;

async function requireAuth() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return session;
}

export async function getVaultStatus(): Promise<VaultVerifierStatus> {
  const session = await requireAuth();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      vaultVerifierCipher: true,
      vaultVerifierIv: true,
      vaultVerifierSalt: true,
      duressEnabled: true,
      duressVerifierCipher: true,
      duressVerifierIv: true,
      duressVerifierSalt: true,
    },
  });

  const isConfigured = Boolean(
    user?.vaultVerifierCipher &&
      user?.vaultVerifierIv &&
      user?.vaultVerifierSalt
  );

  return {
    isConfigured,
    vaultVerifierCipher: user?.vaultVerifierCipher ?? null,
    vaultVerifierIv: user?.vaultVerifierIv ?? null,
    vaultVerifierSalt: user?.vaultVerifierSalt ?? null,
    duressEnabled: user?.duressEnabled ?? false,
    duressVerifierCipher: user?.duressVerifierCipher ?? null,
    duressVerifierIv: user?.duressVerifierIv ?? null,
    duressVerifierSalt: user?.duressVerifierSalt ?? null,
  };
}

export async function saveVaultVerifier(data: {
  ciphertext: string;
  iv: string;
  salt: string;
}): Promise<VaultVerifierStatus> {
  const session = await requireAuth();
  const parsed = verifierSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "Invalid master verifier payload."
    );
  }

  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { vaultVerifierCipher: true },
  });

  if (existing?.vaultVerifierCipher) {
    throw new Error("Master vault verifier is already initialized.");
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      vaultVerifierCipher: parsed.data.ciphertext,
      vaultVerifierIv: parsed.data.iv,
      vaultVerifierSalt: parsed.data.salt,
    },
    select: {
      vaultVerifierCipher: true,
      vaultVerifierIv: true,
      vaultVerifierSalt: true,
    },
  });

  revalidatePath("/vault");

  return {
    isConfigured: true,
    vaultVerifierCipher: updated.vaultVerifierCipher,
    vaultVerifierIv: updated.vaultVerifierIv,
    vaultVerifierSalt: updated.vaultVerifierSalt,
  };
}

export async function getVaultItems(): Promise<VaultItemRecord[]> {
  const session = await requireAuth();

  const items = await prisma.vaultItem.findMany({
    where: { userId: session.user.id },
    include: { attachments: true },
    orderBy: [{ favorite: "desc" }, { updatedAt: "desc" }],
  });

  return items;
}

export async function createVaultItem(
  input: VaultItemInput
): Promise<VaultItemRecord> {
  const session = await requireAuth();
  const parsed = vaultItemInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "Invalid vault item input."
    );
  }

  const item = await prisma.vaultItem.create({
    data: {
      userId: session.user.id,
      type: parsed.data.type,
      title: parsed.data.title,
      subtitle: parsed.data.subtitle || null,
      url: parsed.data.url || null,
      category: parsed.data.category || null,
      tags: parsed.data.tags || [],
      favorite: parsed.data.favorite ?? false,
      isDecoy: parsed.data.isDecoy ?? false,
      ciphertext: parsed.data.ciphertext,
      iv: parsed.data.iv,
      salt: parsed.data.salt,
    },
    include: { attachments: true },
  });

  revalidatePath("/vault");
  return item;
}

export async function updateVaultItem(
  id: string,
  input: VaultItemInput
): Promise<VaultItemRecord> {
  const session = await requireAuth();
  const cleanId = z.string().min(1).parse(id);
  const parsed = vaultItemInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "Invalid vault item input."
    );
  }

  const existing = await prisma.vaultItem.findFirst({
    where: {
      id: cleanId,
      userId: session.user.id,
    },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Vault item not found or access denied.");
  }

  const updated = await prisma.vaultItem.update({
    where: { id: existing.id },
    data: {
      type: parsed.data.type,
      title: parsed.data.title,
      subtitle: parsed.data.subtitle || null,
      url: parsed.data.url || null,
      category: parsed.data.category || null,
      tags: parsed.data.tags || [],
      favorite: parsed.data.favorite ?? false,
      isDecoy: parsed.data.isDecoy ?? false,
      ciphertext: parsed.data.ciphertext,
      iv: parsed.data.iv,
      salt: parsed.data.salt,
    },
    include: { attachments: true },
  });

  revalidatePath("/vault");
  return updated;
}

export async function toggleFavoriteItem(id: string): Promise<VaultItemRecord> {
  const session = await requireAuth();
  const cleanId = z.string().min(1).parse(id);

  const existing = await prisma.vaultItem.findFirst({
    where: {
      id: cleanId,
      userId: session.user.id,
    },
    select: { id: true, favorite: true },
  });

  if (!existing) {
    throw new Error("Vault item not found or access denied.");
  }

  const updated = await prisma.vaultItem.update({
    where: { id: existing.id },
    data: { favorite: !existing.favorite },
    include: { attachments: true },
  });

  revalidatePath("/vault");
  return updated;
}

export async function deleteVaultItem(
  id: string
): Promise<{ success: boolean }> {
  const session = await requireAuth();
  const cleanId = z.string().min(1).parse(id);

  // Soft delete (move to Trash)
  const updated = await prisma.vaultItem.updateMany({
    where: {
      id: cleanId,
      userId: session.user.id,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  if (updated.count === 0) {
    throw new Error("Vault item not found or access denied.");
  }

  revalidatePath("/vault");
  return { success: true };
}

export async function restoreVaultItem(
  id: string
): Promise<{ success: boolean }> {
  const session = await requireAuth();
  const cleanId = z.string().min(1).parse(id);

  const restored = await prisma.vaultItem.updateMany({
    where: {
      id: cleanId,
      userId: session.user.id,
    },
    data: {
      deletedAt: null,
    },
  });

  if (restored.count === 0) {
    throw new Error("Vault item not found or access denied.");
  }

  revalidatePath("/vault");
  return { success: true };
}

export async function permanentDeleteVaultItem(
  id: string
): Promise<{ success: boolean }> {
  const session = await requireAuth();
  const cleanId = z.string().min(1).parse(id);

  const deleted = await prisma.vaultItem.deleteMany({
    where: {
      id: cleanId,
      userId: session.user.id,
    },
  });

  if (deleted.count === 0) {
    throw new Error("Vault item not found or access denied.");
  }

  revalidatePath("/vault");
  return { success: true };
}

export async function emptyTrash(): Promise<{ count: number }> {
  const session = await requireAuth();

  const deleted = await prisma.vaultItem.deleteMany({
    where: {
      userId: session.user.id,
      deletedAt: { not: null },
    },
  });

  revalidatePath("/vault");
  return { count: deleted.count };
}

export async function batchCreateVaultItems(
  items: VaultItemInput[]
): Promise<VaultItemRecord[]> {
  const session = await requireAuth();

  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const createdItems: VaultItemRecord[] = [];

  for (const itemInput of items) {
    const parsed = vaultItemInputSchema.parse(itemInput);
    const item = await prisma.vaultItem.create({
      data: {
        userId: session.user.id,
        type: parsed.type,
        title: parsed.title,
        subtitle: parsed.subtitle || null,
        url: parsed.url || null,
        category: parsed.category || null,
        tags: parsed.tags || [],
        favorite: parsed.favorite ?? false,
        ciphertext: parsed.ciphertext,
        iv: parsed.iv,
        salt: parsed.salt,
      },
      include: { attachments: true },
    });
    createdItems.push(item);
  }

  revalidatePath("/vault");
  return createdItems;
}

export async function rotateMasterPassphrase(data: {
  verifier: { ciphertext: string; iv: string; salt: string };
  reencryptedItems: { id: string; ciphertext: string; iv: string; salt: string }[];
}): Promise<{ success: boolean }> {
  const session = await requireAuth();

  const parsedVerifier = verifierSchema.parse(data.verifier);

  await prisma.$transaction(async (tx) => {
    // 1. Update master verifier
    await tx.user.update({
      where: { id: session.user.id },
      data: {
        vaultVerifierCipher: parsedVerifier.ciphertext,
        vaultVerifierIv: parsedVerifier.iv,
        vaultVerifierSalt: parsedVerifier.salt,
      },
    });

    // 2. Update all re-encrypted items
    for (const item of data.reencryptedItems) {
      await tx.vaultItem.updateMany({
        where: { id: item.id, userId: session.user.id },
        data: {
          ciphertext: item.ciphertext,
          iv: item.iv,
          salt: item.salt,
        },
      });
    }
  });

  revalidatePath("/vault");
  return { success: true };
}

// ============================================
// ENCRYPTED FILE ATTACHMENTS (CLIENT-SIDE AES-GCM)
// ============================================

export async function addVaultAttachment(
  vaultItemId: string,
  data: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    ciphertext: string;
    iv: string;
    salt: string;
  }
) {
  const session = await requireAuth();

  const item = await prisma.vaultItem.findFirst({
    where: { id: vaultItemId, userId: session.user.id },
    select: { id: true },
  });

  if (!item) {
    throw new Error("Vault item not found or access denied.");
  }

  const attachment = await prisma.vaultAttachment.create({
    data: {
      vaultItemId: item.id,
      fileName: data.fileName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      ciphertext: data.ciphertext,
      iv: data.iv,
      salt: data.salt,
    },
  });

  revalidatePath("/vault");
  return attachment;
}

export async function deleteVaultAttachment(attachmentId: string) {
  const session = await requireAuth();

  const attachment = await prisma.vaultAttachment.findFirst({
    where: {
      id: attachmentId,
      vaultItem: { userId: session.user.id },
    },
    select: { id: true },
  });

  if (!attachment) {
    throw new Error("Attachment not found or access denied.");
  }

  await prisma.vaultAttachment.delete({
    where: { id: attachment.id },
  });

  revalidatePath("/vault");
  return { success: true };
}

// ============================================
// EPHEMERAL ZERO-KNOWLEDGE SEND ("ARZUR SEND")
// ============================================

export async function createVaultSend(data: {
  title: string;
  ciphertext: string;
  iv: string;
  salt?: string;
  burnOnRead: boolean;
  maxViews: number;
  hoursToExpire: number;
  passwordProtected: boolean;
  passwordSalt?: string;
}) {
  const session = await requireAuth();

  const expiresAt = new Date(Date.now() + (data.hoursToExpire || 24) * 60 * 60 * 1000);

  const sendRecord = await prisma.vaultSend.create({
    data: {
      userId: session.user.id,
      title: data.title || "Secure Shared Secret",
      ciphertext: data.ciphertext,
      iv: data.iv,
      salt: data.salt || null,
      burnOnRead: data.burnOnRead ?? true,
      maxViews: data.maxViews || 1,
      viewCount: 0,
      expiresAt,
      passwordProtected: data.passwordProtected ?? false,
      passwordSalt: data.passwordSalt || null,
    },
  });

  revalidatePath("/vault");
  return sendRecord;
}

export async function getPublicVaultSend(id: string) {
  const send = await prisma.vaultSend.findUnique({
    where: { id },
  });

  if (!send) {
    return { error: "Secret link expired or burned." };
  }

  // Check expiration
  if (new Date() > new Date(send.expiresAt)) {
    await prisma.vaultSend.delete({ where: { id } }).catch(() => {});
    return { error: "Secret link has expired." };
  }

  // If already reached max views
  if (send.viewCount >= send.maxViews) {
    await prisma.vaultSend.delete({ where: { id } }).catch(() => {});
    return { error: "Secret has been burned after reading." };
  }

  // Increment view count
  const updated = await prisma.vaultSend.update({
    where: { id },
    data: { viewCount: { increment: 1 } },
  });

  // If burnOnRead or reached max views, clean up
  if (updated.burnOnRead || updated.viewCount >= updated.maxViews) {
    setTimeout(() => {
      prisma.vaultSend.delete({ where: { id } }).catch(() => {});
    }, 3000);
  }

  return {
    title: send.title,
    ciphertext: send.ciphertext,
    iv: send.iv,
    salt: send.salt,
    passwordProtected: send.passwordProtected,
    passwordSalt: send.passwordSalt,
    burnOnRead: send.burnOnRead,
    viewsRemaining: Math.max(0, send.maxViews - updated.viewCount),
  };
}

export async function listUserVaultSends() {
  const session = await requireAuth();

  const sends = await prisma.vaultSend.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return sends;
}

export async function deleteVaultSend(id: string) {
  const session = await requireAuth();

  await prisma.vaultSend.deleteMany({
    where: { id, userId: session.user.id },
  });

  revalidatePath("/vault");
  return { success: true };
}

// ============================================
// DURESS / DECOY VAULT CONFIGURATION
// ============================================

export async function configureDuressVault(data: {
  enabled: boolean;
  verifier?: {
    ciphertext: string;
    iv: string;
    salt: string;
  };
  decoyItems?: {
    title: string;
    subtitle?: string;
    url?: string;
    category?: string;
    type: VaultItemType;
    ciphertext: string;
    iv: string;
    salt: string;
  }[];
}): Promise<{ success: boolean; duressEnabled: boolean }> {
  const session = await requireAuth();

  if (!data.enabled) {
    // Disable Duress mode: clear verifier and delete all decoy items
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          duressEnabled: false,
          duressVerifierCipher: null,
          duressVerifierIv: null,
          duressVerifierSalt: null,
        },
      }),
      prisma.vaultItem.deleteMany({
        where: {
          userId: session.user.id,
          isDecoy: true,
        },
      }),
    ]);

    revalidatePath("/vault");
    return { success: true, duressEnabled: false };
  }

  if (!data.verifier) {
    throw new Error("Duress verifier is required to enable duress mode.");
  }

  // Enable duress mode: save verifier, clear old decoy items, insert new decoy items
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: session.user.id },
      data: {
        duressEnabled: true,
        duressVerifierCipher: data.verifier!.ciphertext,
        duressVerifierIv: data.verifier!.iv,
        duressVerifierSalt: data.verifier!.salt,
      },
    });

    await tx.vaultItem.deleteMany({
      where: {
        userId: session.user.id,
        isDecoy: true,
      },
    });

    if (data.decoyItems && data.decoyItems.length > 0) {
      await tx.vaultItem.createMany({
        data: data.decoyItems.map((item) => ({
          userId: session.user.id,
          type: item.type,
          title: item.title,
          subtitle: item.subtitle || null,
          url: item.url || null,
          category: item.category || null,
          tags: ["decoy"],
          favorite: false,
          isDecoy: true,
          ciphertext: item.ciphertext,
          iv: item.iv,
          salt: item.salt,
        })),
      });
    }
  });

  revalidatePath("/vault");
  return { success: true, duressEnabled: true };
}
