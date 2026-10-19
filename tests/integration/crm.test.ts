import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { contactEvents, events, orders, workspaceMembers } from "@/db/schema";
import {
  contactFacets,
  createSegment,
  deleteContact,
  exportContactsCsv,
  getContact,
  listContacts,
  listSegments,
  setContactStatus,
  setContactTags,
} from "@/server/crm/contacts";
import { LeadError, LEADS_LIMIT_PER_10_MIN, submitLead } from "@/server/crm/leads";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { createFunnel } from "@/server/funnels";
import { addSection, createPage } from "@/server/pages";
import { platformSettings } from "@/db/schema";
import { confirmOrderPaidManually, createProduct, setProductPaymentLink, startCheckout } from "@/server/payments/service";
import { publishPage } from "@/server/publishing";
import { db, makeUser } from "./db";

beforeAll(() => {
  process.env.PAYMENT_SECRETS_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.APP_URL = "https://app.tunnels.test";
});

/** A published funnel with a contact form on "/" and an order form on "/achat". */
async function site(phone: "hidden" | "optional" | "required" = "optional") {
  const u = await makeUser();
  await db.update(platformSettings).set({ saspayLinkHosts: ["pay.saspay-test.example"] });
  const product = await createProduct(db, u.userId, u.workspaceId, { name: "Formation", price: "15000", currency: "XOF" });
  await setProductPaymentLink(db, u.userId, product.id, { url: "https://pay.saspay-test.example/l/f", price: "15000", currency: "XOF", confirmed: true });
  const funnel = await createFunnel(db, u.userId, u.workspaceId, { name: "Formation" });
  const optin = await createPage(db, { userId: u.userId }, funnel.id, { name: "Inscription", kind: "landing" });
  await addSection(db, { userId: u.userId }, optin.id, 1, { id: "contact", type: "lead_form", title: "Être rappelé", phone, buttonLabel: "Envoyer", successMessage: "Merci !" });
  await publishPage(db, u.userId, optin.id, { path: "", reviewConfirmed: true });
  const sales = await createPage(db, { userId: u.userId }, funnel.id, { name: "Achat", kind: "sales" });
  await addSection(db, { userId: u.userId }, sales.id, 1, { id: "commande", type: "checkout", productId: product.id, buttonLabel: "Payer" });
  await publishPage(db, u.userId, sales.id, { path: "achat", reviewConfirmed: true });
  const target = { subdomain: "formation" };
  const lead = (fields: Record<string, string>, ip = "10.1.0.1", visitorId: string | null = null) =>
    submitLead(db, { site: target, path: "", sectionId: "contact", fields, ip, visitorId });
  const buy = (c: Record<string, string>) => startCheckout(db, { site: target, path: "achat", sectionId: "commande", customer: c, ip: "10.2.0.1" });
  return { ...u, funnel, optin, sales, lead, buy };
}

const awa = { firstName: "Awa", email: "Awa@Exemple.test", phone: "+225 07 00 00 00 01", consent: "on" };

describe("contacts from published pages (scenario 15)", () => {
  it("records a lead with its origin, requires consent, and merges by e-mail", async () => {
    const s = await site();
    await expect(s.lead({ ...awa, consent: "" })).rejects.toMatchObject({ code: "invalid", fieldErrors: { consent: expect.any(String) } });
    await expect(s.lead({ ...awa, email: "pas-un-email" })).rejects.toBeInstanceOf(LeadError);

    const { contactId } = await s.lead(awa, "10.1.0.1", "visitor-1");
    const again = await s.lead({ ...awa, firstName: "Awa D.", phone: "" });
    expect(again.contactId).toBe(contactId);

    const { contact, history, origin } = await getContact(db, s.userId, contactId);
    expect(contact).toMatchObject({ email: "awa@exemple.test", firstName: "Awa", phone: "+2250700000001", status: "lead", variantLabel: "A" });
    expect(contact.consentAt).not.toBeNull();
    expect(origin).toEqual({ funnelName: "Formation", pageName: "Inscription" });
    expect(history.map((h) => h.kind)).toEqual(["lead_submitted", "lead_submitted"]);
    // Measured once per contact and page, for statistics and A/B goals.
    const measured = await db.select().from(events).where(eq(events.type, "lead_submitted"));
    expect(measured).toHaveLength(1);
  });

  it("asks for the phone only as configured, and limits submissions per IP", async () => {
    const s = await site("required");
    await expect(s.lead({ ...awa, phone: "" })).rejects.toMatchObject({ fieldErrors: { phone: expect.any(String) } });
    for (let i = 0; i < LEADS_LIMIT_PER_10_MIN; i++) await s.lead({ ...awa, email: `p${i}@exemple.test` }, "10.9.9.9");
    await expect(s.lead({ ...awa, email: "trop@exemple.test" }, "10.9.9.9")).rejects.toMatchObject({ code: "rate_limited" });
    await expect(s.lead({ ...awa, email: "autre@exemple.test" }, "10.9.9.8")).resolves.toBeTruthy();
  });

  it("refuses forms that are not live", async () => {
    const s = await site();
    await expect(submitLead(db, { site: { subdomain: "formation" }, path: "", sectionId: "nope", fields: awa, ip: null })).rejects.toMatchObject({ code: "unavailable" });
    await expect(submitLead(db, { site: { subdomain: "inconnu" }, path: "", sectionId: "contact", fields: awa, ip: null })).rejects.toMatchObject({ code: "unavailable" });
    expect((await listContacts(db, s.userId, s.workspaceId)).total).toBe(0);
  });

  it("links orders to the contact and turns them into a customer only once the payment is confirmed", async () => {
    const s = await site();
    const { contactId } = await s.lead(awa);
    const { orderId } = await s.buy({ firstName: "Awa", lastName: "Diop", email: "awa@exemple.test", phone: "" });
    let { contact, orders: bought } = await getContact(db, s.userId, contactId);
    expect(contact.status).toBe("lead");
    expect(contact.lastName).toBe("Diop");
    expect(bought).toMatchObject([{ id: orderId, status: "pending", amount: 15000 }]);

    await confirmOrderPaidManually(db, s.userId, orderId, { attested: true });
    await expect(confirmOrderPaidManually(db, s.userId, orderId, { attested: true })).rejects.toThrow(); // no double counting
    ({ contact, orders: bought } = await getContact(db, s.userId, contactId));
    expect(contact.status).toBe("customer");
    expect(bought[0].status).toBe("paid");
    const paidEvents = await db.select().from(contactEvents).where(eq(contactEvents.kind, "order_paid"));
    expect(paidEvents).toHaveLength(1);
  });
});

describe("CRM features", () => {
  it("searches, filters, tags, segments and changes status with history", async () => {
    const s = await site();
    const a = (await s.lead(awa)).contactId;
    const b = (await s.lead({ ...awa, firstName: "Moussa", email: "moussa@exemple.test" }, "10.1.0.2")).contactId;
    await s.lead({ ...awa, firstName: "Fatou", email: "fatou_100@exemple.test" }, "10.1.0.3");

    expect((await listContacts(db, s.userId, s.workspaceId, { q: "mous" })).rows.map((r) => r.contact.id)).toEqual([b]);
    // LIKE wildcards in the search are literal.
    expect((await listContacts(db, s.userId, s.workspaceId, { q: "_1" })).total).toBe(1);
    expect((await listContacts(db, s.userId, s.workspaceId, { q: "%" })).total).toBe(0);

    await setContactTags(db, s.userId, a, { add: " VIP " });
    await setContactTags(db, s.userId, a, { add: "abidjan" });
    await expect(setContactTags(db, s.userId, a, { add: "=cmd()" })).rejects.toBeInstanceOf(ValidationError);
    await setContactTags(db, s.userId, b, { add: "vip" });
    await setContactTags(db, s.userId, b, { remove: "vip" });
    expect((await listContacts(db, s.userId, s.workspaceId, { tag: "vip" })).rows.map((r) => r.contact.id)).toEqual([a]);
    expect((await contactFacets(db, s.userId, s.workspaceId)).tags).toEqual(["abidjan", "vip"]);

    await setContactStatus(db, s.userId, b, "lost");
    await expect(setContactStatus(db, s.userId, b, "gagne")).rejects.toBeInstanceOf(ValidationError);
    expect((await listContacts(db, s.userId, s.workspaceId, { status: "lost" })).total).toBe(1);
    // Unknown or malformed filters are ignored rather than widening or breaking the query.
    expect((await listContacts(db, s.userId, s.workspaceId, { status: "nimporte", funnelId: "x" })).total).toBe(3);

    const seg = await createSegment(db, s.userId, s.workspaceId, { name: "VIP", filters: { tag: "vip", q: "" } });
    expect(seg.filters).toEqual({ tag: "vip" });
    await expect(createSegment(db, s.userId, s.workspaceId, { name: "Vide", filters: {} })).rejects.toBeInstanceOf(ValidationError);
    expect((await listSegments(db, s.userId, s.workspaceId)).map((x) => [x.name, x.size])).toEqual([["VIP", 1]]);
    // Dynamic: a newly tagged contact joins the segment.
    await setContactTags(db, s.userId, b, { add: "vip" });
    expect((await listSegments(db, s.userId, s.workspaceId))[0].size).toBe(2);

    const { history } = await getContact(db, s.userId, b);
    expect(history.map((h) => h.kind)).toEqual(["tags_changed", "status_changed", "tags_changed", "tags_changed", "lead_submitted"]);
  });

  it("exports CSV safely, for owners and admins only", async () => {
    const s = await site();
    await s.lead({ ...awa, firstName: "=HYPERLINK(\"x\")", email: "csv@exemple.test" });
    const { csv, count } = await exportContactsCsv(db, s.userId, s.workspaceId);
    expect(count).toBe(1);
    expect(csv.startsWith("﻿prenom,nom,email")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);

    const editor = await makeUser("Editeur");
    await db.insert(workspaceMembers).values({ workspaceId: s.workspaceId, userId: editor.userId, role: "editor" });
    await expect(exportContactsCsv(db, editor.userId, s.workspaceId)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await listContacts(db, editor.userId, s.workspaceId)).total).toBe(1);
  });

  it("deletes a person and strips their details from orders", async () => {
    const s = await site();
    const { contactId } = await s.lead(awa);
    const { orderId } = await s.buy({ firstName: "Awa", lastName: "Diop", email: "awa@exemple.test", phone: "+2250700000001" });
    await deleteContact(db, s.userId, contactId);
    await expect(getContact(db, s.userId, contactId)).rejects.toBeInstanceOf(NotFoundError);
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(order).toMatchObject({ customerFirstName: "Contact supprimé", customerEmail: "", customerPhone: null, contactId: null, amount: 15000 });
  });

  it("isolates workspaces", async () => {
    const s = await site();
    const { contactId } = await s.lead(awa);
    const other = await makeUser("Autre");
    await expect(getContact(db, other.userId, contactId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listContacts(db, other.userId, s.workspaceId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(setContactTags(db, other.userId, contactId, { add: "x" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteContact(db, other.userId, contactId)).rejects.toBeInstanceOf(NotFoundError);
    expect((await listContacts(db, other.userId, other.workspaceId)).total).toBe(0);
  });
});
