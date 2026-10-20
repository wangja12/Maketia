import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { downloadGrants, platformSettings, plans, workspaces } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/server/errors";
import {
  createDownloadLinks,
  deleteProductFile,
  detectFileType,
  fileResponseHeaders,
  listDownloadGrants,
  listProductFiles,
  openFileForMember,
  redeemDownload,
  revokeDownloadGrant,
  safeFileName,
  uploadProductFile,
} from "@/server/files/files";
import { createProduct, confirmOrderPaidManually, setProductPaymentLink, startCheckout } from "@/server/payments/service";
import { createFunnel } from "@/server/funnels";
import { addSection, createPage } from "@/server/pages";
import { publishPage } from "@/server/publishing";
import { db, makeUser } from "./db";

let root = "";
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "tia-files-"));
  process.env.FILES_DIR = root;
  process.env.PAYMENT_SECRETS_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.APP_URL = "https://app.tunnels.test";
});

const PDF = Buffer.from("%PDF-1.7\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const stream = (buf: Buffer) => new Blob([new Uint8Array(buf)]).stream();
const text = async (s: ReadableStream<Uint8Array>) => Buffer.from(await new Response(s).arrayBuffer()).toString();

async function seller() {
  const u = await makeUser();
  const product = await createProduct(db, u.userId, u.workspaceId, { name: "E-book", price: "5000", currency: "XOF", kind: "digital_file" });
  return { ...u, product };
}

describe("private product files", () => {
  it("decides the type from the content, not the name", () => {
    expect(detectFileType(PDF, "livre.pdf")?.mime).toBe("application/pdf");
    expect(detectFileType(Buffer.from("PK\x03\x04rest", "latin1"), "cours.docx")?.label).toBe("Word");
    expect(detectFileType(Buffer.from("<html><script>alert(1)</script>"), "piege.pdf")).toBeNull();
    expect(detectFileType(Buffer.from("MZ\x90\x00", "latin1"), "setup.exe")).toBeNull();
    expect(detectFileType(Buffer.from('<svg onload="x">'), "logo.png")).toBeNull();
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName('C:\\Users\\a\\Mon "livre".pdf')).toBe("Mon _livre_.pdf");
    expect(safeFileName("...")).toBe("fichier");
  });

  it("stores outside any public path, versions replacements, and refuses the wrong product or type", async () => {
    const s = await seller();
    const file = await uploadProductFile(db, s.userId, s.product.id, { fileName: "Guide Excel.pdf", body: stream(PDF) });
    expect(file).toMatchObject({ title: "Guide Excel.pdf", mimeType: "application/pdf", sizeBytes: PDF.length, version: 1 });
    expect(file.storageKey).toBe(`${s.workspaceId}/${file.id}`);
    expect(await readdir(path.join(root, s.workspaceId))).toEqual([file.id]);

    const v2 = await uploadProductFile(db, s.userId, s.product.id, { fileName: "Guide Excel v2.pdf", body: stream(PDF), replaceFileId: file.id });
    expect(v2.version).toBe(2);
    expect((await listProductFiles(db, s.userId, s.product.id)).map((f) => f.id)).toEqual([v2.id]);

    await expect(uploadProductFile(db, s.userId, s.product.id, { fileName: "x.pdf", body: stream(Buffer.from("<html></html>")) })).rejects.toThrow("Type de fichier non accepté");
    const service = await createProduct(db, s.userId, s.workspaceId, { name: "Coaching", price: "1", currency: "XOF", kind: "service" });
    await expect(uploadProductFile(db, s.userId, service.id, { fileName: "a.pdf", body: stream(PDF) })).rejects.toBeInstanceOf(ValidationError);
    // No leftover temporary files after refusals.
    expect(await readdir(path.join(root, ".tmp"))).toEqual([]);

    const other = await makeUser("Autre");
    await expect(uploadProductFile(db, other.userId, s.product.id, { fileName: "a.pdf", body: stream(PDF) })).rejects.toBeInstanceOf(NotFoundError);
    await expect(openFileForMember(db, other.userId, v2.id)).rejects.toBeInstanceOf(NotFoundError);
    const { stream: content } = await openFileForMember(db, s.userId, v2.id);
    expect(await text(content)).toBe(PDF.toString());
  });

  it("counts storage against the plan", async () => {
    const s = await seller();
    const [plan] = await db.insert(plans).values({ code: "mini", name: "Mini", limits: { funnels: null, variantsPerPage: null, customDomains: null, mcpWritesPerMonth: null, analyticsEventsPerMonth: null, storageMb: 0 } }).returning();
    await db.update(workspaces).set({ planId: plan.id }).where(eq(workspaces.id, s.workspaceId));
    await expect(uploadProductFile(db, s.userId, s.product.id, { fileName: "a.pdf", body: stream(PDF) })).rejects.toThrow("Limite du plan « Mini » atteinte");
  });

  it("serves files as downloads only, never rendered", () => {
    const h = fileResponseHeaders({ fileName: "Été <b>.pdf", mimeType: "application/pdf", sizeBytes: 10 });
    expect(h["content-disposition"]).toMatch(/^attachment; filename="_t_ <b>.pdf"; filename\*=UTF-8''%C3%89t%C3%A9%20%3Cb%3E.pdf$/);
    expect(h["content-security-policy"]).toContain("sandbox");
    expect(h["x-content-type-options"]).toBe("nosniff");
  });
});

describe("download links for buyers", () => {
  async function paidOrder() {
    const s = await seller();
    await db.update(platformSettings).set({ saspayLinkHosts: ["pay.saspay-test.example"] });
    await setProductPaymentLink(db, s.userId, s.product.id, { url: "https://pay.saspay-test.example/l/x", price: "5000", currency: "XOF", confirmed: true });
    const file = await uploadProductFile(db, s.userId, s.product.id, { fileName: "Guide.pdf", body: stream(PDF) });
    const funnel = await createFunnel(db, s.userId, s.workspaceId, { name: "Guide" });
    const page = await createPage(db, { userId: s.userId }, funnel.id, { name: "Vente", kind: "sales" });
    await addSection(db, { userId: s.userId }, page.id, 1, { id: "commande", type: "checkout", productId: s.product.id, buttonLabel: "Payer" });
    await publishPage(db, s.userId, page.id, { path: "", reviewConfirmed: true });
    const { orderId } = await startCheckout(db, { site: { subdomain: "guide" }, path: "", sectionId: "commande", customer: { firstName: "Awa", lastName: "Diop", email: "awa@exemple.test" }, ip: null });
    return { ...s, file, orderId };
  }

  it("are refused until the order is paid, then capped, expiring and revocable", async () => {
    const s = await paidOrder();
    await expect(createDownloadLinks(db, s.userId, s.orderId)).rejects.toThrow("n’est pas confirmé");
    await confirmOrderPaidManually(db, s.userId, s.orderId, { attested: true });
    const { links } = await createDownloadLinks(db, s.userId, s.orderId, { maxDownloads: 2 });
    expect(links).toHaveLength(1);
    const token = links[0].url.split("/").pop()!;
    expect(links[0].url).toBe(`https://app.tunnels.test/api/telechargement/${token}`);
    // Only the hash is stored.
    const [stored] = await db.select().from(downloadGrants).where(eq(downloadGrants.orderId, s.orderId));
    expect(stored.tokenHash).not.toContain(token);

    expect(await text((await redeemDownload(db, token))!.stream)).toBe(PDF.toString());
    expect(await redeemDownload(db, token)).not.toBeNull();
    expect(await redeemDownload(db, token)).toBeNull(); // cap reached
    expect(await redeemDownload(db, `${token.slice(0, -1)}A`)).toBeNull();
    expect(await redeemDownload(db, "../../etc/passwd")).toBeNull();

    const second = (await createDownloadLinks(db, s.userId, s.orderId)).links[0].url.split("/").pop()!;
    await db.update(downloadGrants).set({ expiresAt: sql`now() - interval '1 minute'` }).where(eq(downloadGrants.tokenHash, (await import("node:crypto")).createHash("sha256").update(second).digest("hex")));
    expect(await redeemDownload(db, second)).toBeNull(); // expired

    const third = (await createDownloadLinks(db, s.userId, s.orderId)).links[0].url.split("/").pop()!;
    const grants = await listDownloadGrants(db, s.userId, s.orderId);
    await revokeDownloadGrant(db, s.userId, grants[0].id);
    expect(await redeemDownload(db, third)).toBeNull(); // revoked
    expect((await listDownloadGrants(db, s.userId, s.orderId)).map((g) => g.downloads).sort()).toEqual([0, 0, 2]);
  });

  it("are reserved to owners and admins of the order's workspace; deleting the file kills the links", async () => {
    const s = await paidOrder();
    await confirmOrderPaidManually(db, s.userId, s.orderId, { attested: true });
    const other = await makeUser("Autre");
    await expect(createDownloadLinks(db, other.userId, s.orderId)).rejects.toBeInstanceOf(NotFoundError);
    const token = (await createDownloadLinks(db, s.userId, s.orderId)).links[0].url.split("/").pop()!;
    await deleteProductFile(db, s.userId, s.file.id);
    expect(await redeemDownload(db, token)).toBeNull();
    expect(await readdir(path.join(root, s.workspaceId))).toEqual([]);
  });
});
