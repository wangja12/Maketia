import { createHash, randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { and, asc, desc, eq, gt, isNull, lt, sql, sum } from "drizzle-orm";
import type { Db } from "@/db";
import { downloadGrants, orders, productFiles, products, type ProductFile } from "@/db/schema";
import { planOf, QuotaExceededError } from "../billing/plans";
import { NotFoundError, ValidationError } from "../errors";
import { siteConfig } from "../site-config";
import { isUuid, requireMembership } from "../workspaces";
import { fileStorage } from "./storage";

/*
 * Files sold with digital products. Rules:
 * - Type decided from the file's first bytes, not from its name or the browser's claim; only a
 *   short list of document, archive, image and media formats is accepted (no HTML, SVG, scripts
 *   or executables).
 * - Never public: members download through an authenticated route; buyers through a grant
 *   (random token, hashed, expiring, capped) issued only for a paid order.
 * - Storage counts against the plan's quota.
 */

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

type FileType = { mime: string; label: string };

const ZIP_FAMILY: Record<string, FileType> = {
  ".zip": { mime: "application/zip", label: "ZIP" },
  ".docx": { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Word" },
  ".xlsx": { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "Excel" },
  ".pptx": { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", label: "PowerPoint" },
  ".epub": { mime: "application/epub+zip", label: "EPUB" },
};

export const ACCEPTED_TYPES = "PDF, ZIP, Word, Excel, PowerPoint, EPUB, PNG, JPEG, MP3, MP4";

/** Magic-byte detection. Returns null for anything not on the list. */
export function detectFileType(head: Buffer, fileName: string): FileType | null {
  const ext = path.extname(fileName).toLowerCase();
  const starts = (...bytes: number[]) => bytes.every((b, i) => head[i] === b);
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return { mime: "application/pdf", label: "PDF" };
  if (starts(0x50, 0x4b, 0x03, 0x04)) return ZIP_FAMILY[ext] ?? ZIP_FAMILY[".zip"];
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { mime: "image/png", label: "PNG" };
  if (starts(0xff, 0xd8, 0xff)) return { mime: "image/jpeg", label: "JPEG" };
  if (starts(0x49, 0x44, 0x33) || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0 && ext === ".mp3")) return { mime: "audio/mpeg", label: "MP3" };
  if (head.subarray(4, 8).toString("latin1") === "ftyp") return ext === ".m4a" ? { mime: "audio/mp4", label: "M4A" } : { mime: "video/mp4", label: "MP4" };
  return null;
}

/** A safe download name: no path, no control or reserved characters, bounded length. */
export function safeFileName(name: string) {
  const base = path.basename(name.replace(/\\/g, "/")).normalize("NFC");
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>:|?*/\\]/g, "_").replace(/^\.+/, "").trim();
  const ext = path.extname(cleaned).slice(0, 10);
  const stem = cleaned.slice(0, cleaned.length - ext.length).slice(0, 100) || "fichier";
  return `${stem}${ext}`;
}

async function requireProductForFiles(db: Db, userId: string, productId: string, permission: "read" | "edit") {
  if (!isUuid(productId)) throw new NotFoundError();
  const [product] = await db.select().from(products).where(eq(products.id, productId));
  if (!product) throw new NotFoundError();
  await requireMembership(db, userId, product.workspaceId, permission);
  return product;
}

async function storageUsed(db: Pick<Db, "select">, workspaceId: string) {
  const [row] = await db.select({ total: sum(productFiles.sizeBytes) }).from(productFiles).where(eq(productFiles.workspaceId, workspaceId));
  return Number(row?.total ?? 0);
}

/** Streams the upload to a temporary file, measuring and hashing it, then validates and stores. */
export async function uploadProductFile(
  db: Db,
  userId: string,
  productId: string,
  input: { fileName: string; title?: string; body: ReadableStream<Uint8Array> | null; replaceFileId?: string },
): Promise<ProductFile> {
  const product = await requireProductForFiles(db, userId, productId, "edit");
  if (product.kind !== "digital_file") throw new ValidationError("Ce produit n’est pas un fichier numérique : change son type avant d’y joindre un fichier.");
  if (!input.body) throw new ValidationError("Fichier vide.");
  const fileName = safeFileName(input.fileName || "fichier");
  const title = (input.title?.trim() || fileName).slice(0, 120);

  const storage = fileStorage();
  const temp = await storage.tempPath();
  const hash = createHash("sha256");
  let size = 0;
  let head = Buffer.alloc(0);
  try {
    const out = createWriteStream(temp);
    const reader = input.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_FILE_BYTES) {
        await reader.cancel();
        throw new ValidationError(`Fichier trop lourd : ${MAX_FILE_BYTES / 1024 / 1024} Mo maximum.`);
      }
      if (head.length < 16) head = Buffer.concat([head, Buffer.from(value.subarray(0, 16 - head.length))]);
      hash.update(value);
      if (!out.write(value)) await new Promise<void>((resolve) => out.once("drain", () => resolve()));
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
    if (size === 0) throw new ValidationError("Fichier vide.");
    const type = detectFileType(head, fileName);
    if (!type) throw new ValidationError(`Type de fichier non accepté. Formats acceptés : ${ACCEPTED_TYPES}.`);

    const plan = await planOf(db, product.workspaceId);
    const limitMb = plan.limits.storageMb;
    if (limitMb !== null && limitMb !== undefined && (await storageUsed(db, product.workspaceId)) + size > limitMb * 1024 * 1024) {
      throw new QuotaExceededError("storageMb", limitMb, plan.name);
    }

    let version = 1;
    if (input.replaceFileId) {
      if (!isUuid(input.replaceFileId)) throw new NotFoundError();
      const [previous] = await db.select().from(productFiles).where(and(eq(productFiles.id, input.replaceFileId), eq(productFiles.productId, product.id)));
      if (!previous) throw new NotFoundError("Fichier à remplacer introuvable");
      version = previous.version + 1;
      await db.update(productFiles).set({ archivedAt: sql`now()` }).where(eq(productFiles.id, previous.id));
    }
    const id = crypto.randomUUID();
    const storageKey = `${product.workspaceId}/${id}`;
    await storage.commit(temp, storageKey);
    const [row] = await db
      .insert(productFiles)
      .values({ id, workspaceId: product.workspaceId, productId: product.id, title, fileName, mimeType: type.mime, sizeBytes: size, sha256: hash.digest("hex"), version, storageKey, uploadedBy: userId })
      .returning();
    return row;
  } finally {
    await rm(temp, { force: true });
  }
}

export async function listProductFiles(db: Db, userId: string, productId: string, includeArchived = false) {
  const product = await requireProductForFiles(db, userId, productId, "read");
  return db
    .select()
    .from(productFiles)
    .where(and(eq(productFiles.productId, product.id), includeArchived ? undefined : isNull(productFiles.archivedAt)))
    .orderBy(asc(productFiles.title), desc(productFiles.version));
}

async function requireFile(db: Db, userId: string, fileId: string, permission: "read" | "edit" | "delete") {
  if (!isUuid(fileId)) throw new NotFoundError();
  const [file] = await db.select().from(productFiles).where(eq(productFiles.id, fileId));
  if (!file) throw new NotFoundError();
  await requireMembership(db, userId, file.workspaceId, permission);
  return file;
}

/** For members of the workspace (preview of what buyers receive). */
export async function openFileForMember(db: Db, userId: string, fileId: string) {
  const file = await requireFile(db, userId, fileId, "read");
  const stream = await fileStorage().read(file.storageKey);
  if (!stream) throw new NotFoundError("Fichier absent du stockage");
  return { file, stream };
}

/** Removes the file and every download grant for it. Irreversible (confirmed in the UI). */
export async function deleteProductFile(db: Db, userId: string, fileId: string) {
  const file = await requireFile(db, userId, fileId, "delete");
  await db.delete(productFiles).where(eq(productFiles.id, file.id));
  await fileStorage().remove(file.storageKey);
}

export async function storageUsage(db: Db, userId: string, workspaceId: string) {
  await requireMembership(db, userId, workspaceId, "read");
  return storageUsed(db, workspaceId);
}

// ── Download grants ─────────────────────────────────────────────────────────

export const GRANT_DEFAULTS = { days: 7, maxDownloads: 5 };
const PAID = ["paid", "delivery_queued", "delivered", "delivery_failed"] as const;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export function downloadUrl(token: string) {
  const base = siteConfig().appUrl;
  return base ? `${base.origin}/api/telechargement/${token}` : `/api/telechargement/${token}`;
}

/**
 * Issues one link per current file of the order's product. Only for a paid order of a digital
 * product, by owners and admins. The links are returned once (only hashes are stored).
 */
export async function createDownloadLinks(db: Db, userId: string, orderId: string, options: { days?: number; maxDownloads?: number } = {}) {
  if (!isUuid(orderId)) throw new NotFoundError();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new NotFoundError();
  await requireMembership(db, userId, order.workspaceId, "delete");
  if (!(PAID as readonly string[]).includes(order.status)) throw new ValidationError("Le paiement de cette commande n’est pas confirmé : aucun lien de téléchargement.");
  if (!order.productId) throw new ValidationError("Produit supprimé : aucun fichier à livrer.");
  const files = await db.select().from(productFiles).where(and(eq(productFiles.productId, order.productId), isNull(productFiles.archivedAt))).orderBy(asc(productFiles.title));
  if (files.length === 0) throw new ValidationError("Aucun fichier n’est joint à ce produit.");
  const days = Math.min(Math.max(Math.trunc(options.days ?? GRANT_DEFAULTS.days), 1), 30);
  const maxDownloads = Math.min(Math.max(Math.trunc(options.maxDownloads ?? GRANT_DEFAULTS.maxDownloads), 1), 20);
  const links = [];
  for (const file of files) {
    const token = randomBytes(32).toString("base64url");
    await db.insert(downloadGrants).values({
      workspaceId: order.workspaceId,
      orderId: order.id,
      fileId: file.id,
      tokenHash: tokenHash(token),
      expiresAt: sql`now() + make_interval(days => ${days})`,
      maxDownloads,
      createdBy: userId,
    });
    links.push({ title: file.title, fileName: file.fileName, url: downloadUrl(token) });
  }
  return { links, days, maxDownloads };
}

export async function listDownloadGrants(db: Db, userId: string, orderId: string) {
  if (!isUuid(orderId)) throw new NotFoundError();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new NotFoundError();
  await requireMembership(db, userId, order.workspaceId, "read");
  return db
    .select({
      id: downloadGrants.id,
      title: productFiles.title,
      expiresAt: downloadGrants.expiresAt,
      maxDownloads: downloadGrants.maxDownloads,
      downloads: downloadGrants.downloads,
      lastDownloadAt: downloadGrants.lastDownloadAt,
      revokedAt: downloadGrants.revokedAt,
    })
    .from(downloadGrants)
    .innerJoin(productFiles, eq(productFiles.id, downloadGrants.fileId))
    .where(eq(downloadGrants.orderId, order.id))
    .orderBy(desc(downloadGrants.createdAt));
}

export async function revokeDownloadGrant(db: Db, userId: string, grantId: string) {
  if (!isUuid(grantId)) throw new NotFoundError();
  const [grant] = await db.select().from(downloadGrants).where(eq(downloadGrants.id, grantId));
  if (!grant) throw new NotFoundError();
  await requireMembership(db, userId, grant.workspaceId, "delete");
  await db.update(downloadGrants).set({ revokedAt: sql`now()` }).where(eq(downloadGrants.id, grant.id));
}

/**
 * Public: counts one download atomically (so the cap holds under concurrent requests) and
 * returns the file. Unknown, expired, revoked and exhausted links all look the same.
 */
export async function redeemDownload(db: Db, token: string) {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
  const [grant] = await db
    .update(downloadGrants)
    .set({ downloads: sql`${downloadGrants.downloads} + 1`, lastDownloadAt: sql`now()` })
    .where(
      and(
        eq(downloadGrants.tokenHash, tokenHash(token)),
        isNull(downloadGrants.revokedAt),
        gt(downloadGrants.expiresAt, sql`now()`),
        lt(downloadGrants.downloads, downloadGrants.maxDownloads),
      ),
    )
    .returning();
  if (!grant) return null;
  const [file] = await db.select().from(productFiles).where(eq(productFiles.id, grant.fileId));
  if (!file) return null;
  const stream = await fileStorage().read(file.storageKey);
  return stream ? { file, stream } : null;
}

/** Headers for serving a stored file: always a download, never rendered by the browser. */
export function fileResponseHeaders(file: Pick<ProductFile, "fileName" | "mimeType" | "sizeBytes">) {
  const ascii = file.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return {
    "content-type": file.mimeType,
    "content-length": String(file.sizeBytes),
    "content-disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; sandbox",
    "cache-control": "private, no-store",
    "referrer-policy": "no-referrer",
  };
}
