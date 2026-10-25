import { describe, expect, it } from "vitest";
import { addDomain, listDomains, removeDomain, verifyDomain, txtValue, type DnsResolver } from "@/server/domains";
import { NotFoundError, ValidationError } from "@/server/errors";
import { createFunnel, getFunnel } from "@/server/funnels";
import { createPage, createVariant, deletePage, updateSection, updateTheme } from "@/server/pages";
import {
  listPublications,
  publishPage,
  resolvePublishedPage,
  setSubdomain,
  unpublishPage,
} from "@/server/publishing";
import type { SiteConfig } from "@/server/site-config";
import { db, makeUser } from "./db";

async function setup(name = "Awa") {
  const u = await makeUser(name);
  const funnel = await createFunnel(db, u.userId, u.workspaceId, { name: "Excel facile" });
  const page = await createPage(db, { userId: u.userId }, funnel.id, { name: "Accueil", kind: "landing" });
  return { ...u, funnel, page };
}

const headline = (c: { sections: { type: string }[] }) => (c.sections[0] as unknown as { headline: string }).headline;

describe("publishing", () => {
  it("publishes a snapshot at a path of the funnel's subdomain", async () => {
    const { userId, funnel, page } = await setup();
    await updateSection(db, { userId }, page.id, 1, "hero", { headline: "Excel en 7 jours" });
    await publishPage(db, userId, page.id, { path: "", reviewConfirmed: true });

    const f = await getFunnel(db, userId, funnel.id);
    expect(f.subdomain).toBe("excel-facile");
    expect(f.status).toBe("published");
    const live = await resolvePublishedPage(db, { subdomain: "excel-facile" }, "");
    expect(live && headline(live.content)).toBe("Excel en 7 jours");
    expect(live?.title).toBe("Excel en 7 jours");

    // Editing after publishing does not change what is live.
    await updateSection(db, { userId }, page.id, 2, "hero", { headline: "Brouillon suivant" });
    expect(headline((await resolvePublishedPage(db, { subdomain: "excel-facile" }, ""))!.content)).toBe("Excel en 7 jours");
  });

  it("refuses publication without review or with blocking errors", async () => {
    const { userId, page } = await setup();
    await expect(publishPage(db, userId, page.id, { path: "", reviewConfirmed: false })).rejects.toThrow("revue humaine");
    await updateTheme(db, { userId }, page.id, 1, { accent: "#777777" });
    await expect(publishPage(db, userId, page.id, { path: "", reviewConfirmed: true })).rejects.toThrow("Contraste");
    await expect(publishPage(db, userId, page.id, { path: "Mauvais Chemin", reviewConfirmed: true, version: 1 })).rejects.toBeInstanceOf(ValidationError);
  });

  it("keeps history, replaces a path, rolls back and unpublishes", async () => {
    const { userId, funnel, page } = await setup();
    await publishPage(db, userId, page.id, { path: "", reviewConfirmed: true });
    await updateSection(db, { userId }, page.id, 1, "hero", { headline: "Deuxième" });
    await publishPage(db, userId, page.id, { path: "", reviewConfirmed: true });
    expect(headline((await resolvePublishedPage(db, { subdomain: "excel-facile" }, ""))!.content)).toBe("Deuxième");

    // Roll back to version 1.
    await publishPage(db, userId, page.id, { path: "", version: 1, reviewConfirmed: true });
    expect(headline((await resolvePublishedPage(db, { subdomain: "excel-facile" }, ""))!.content)).toBe("Votre promesse principale, en une phrase");

    // Moving the page to another path frees the old one.
    await publishPage(db, userId, page.id, { path: "offre", reviewConfirmed: true });
    expect(await resolvePublishedPage(db, { subdomain: "excel-facile" }, "")).toBeNull();
    expect(await resolvePublishedPage(db, { subdomain: "excel-facile" }, "offre")).not.toBeNull();

    const history = await listPublications(db, userId, funnel.id);
    expect(history.map((h) => [h.version, h.path, h.unpublishedAt === null])).toEqual([
      [2, "offre", true], [1, "", false], [2, "", false], [1, "", false],
    ]);

    await unpublishPage(db, userId, page.id);
    expect(await resolvePublishedPage(db, { subdomain: "excel-facile" }, "offre")).toBeNull();
    expect((await getFunnel(db, userId, funnel.id)).status).toBe("draft");
    await expect(unpublishPage(db, userId, page.id)).rejects.toBeInstanceOf(ValidationError);
  });

  it("serves one variant of a group per path", async () => {
    const { userId, page } = await setup();
    const b = await createVariant(db, { userId }, page.id);
    await updateSection(db, { userId }, b.id, 1, "hero", { headline: "Variante B" });
    await publishPage(db, userId, page.id, { path: "", reviewConfirmed: true });
    await publishPage(db, userId, b.id, { path: "", reviewConfirmed: true });
    expect(headline((await resolvePublishedPage(db, { subdomain: "excel-facile" }, ""))!.content)).toBe("Variante B");
  });

  it("allocates unique subdomains and validates manual ones", async () => {
    const a = await setup("A");
    const b = await setup("B");
    await publishPage(db, a.userId, a.page.id, { path: "", reviewConfirmed: true });
    await publishPage(db, b.userId, b.page.id, { path: "", reviewConfirmed: true });
    expect((await getFunnel(db, b.userId, b.funnel.id)).subdomain).toBe("excel-facile-2");

    await expect(setSubdomain(db, b.userId, b.funnel.id, "excel-facile")).rejects.toThrow("déjà pris");
    await expect(setSubdomain(db, b.userId, b.funnel.id, "www")).rejects.toThrow("réservé");
    await expect(setSubdomain(db, b.userId, b.funnel.id, "-x")).rejects.toBeInstanceOf(ValidationError);
    await setSubdomain(db, b.userId, b.funnel.id, "Coaching-Kofi");
    expect(await resolvePublishedPage(db, { subdomain: "coaching-kofi" }, "")).not.toBeNull();
    expect(await resolvePublishedPage(db, { subdomain: "excel-facile-2" }, "")).toBeNull();
  });

  it("isolates workspaces and protects live pages from deletion", async () => {
    const a = await setup("A");
    const intruder = await makeUser("Intrus");
    await expect(publishPage(db, intruder.userId, a.page.id, { path: "", reviewConfirmed: true })).rejects.toBeInstanceOf(NotFoundError);
    await publishPage(db, a.userId, a.page.id, { path: "", reviewConfirmed: true });
    await expect(unpublishPage(db, intruder.userId, a.page.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(setSubdomain(db, intruder.userId, a.funnel.id, "vol")).rejects.toBeInstanceOf(NotFoundError);
    await expect(deletePage(db, { userId: a.userId }, a.page.id)).rejects.toThrow("dépublie-la");
  });
});

function fakeDns(records: { txt?: Record<string, string[][]>; cname?: Record<string, string[]>; a?: Record<string, string[]> }): DnsResolver {
  const lookup = <T>(table: Record<string, T> | undefined, name: string) => {
    const v = table?.[name];
    if (v === undefined) return Promise.reject(Object.assign(new Error("not found"), { code: "ENOTFOUND" }));
    return Promise.resolve(v);
  };
  return {
    resolveTxt: (n) => lookup(records.txt, n),
    resolveCname: (n) => lookup(records.cname, n),
    resolve4: (n) => lookup(records.a, n),
  };
}

const config: SiteConfig = { appUrl: null, rootDomain: "tunnels.app", domainTarget: "cname.tunnels.app" };

describe("custom domains", () => {
  it("verifies ownership and routing, then serves the funnel", async () => {
    const { userId, funnel, page } = await setup();
    await publishPage(db, userId, page.id, { path: "", reviewConfirmed: true });
    const d = await addDomain(db, userId, funnel.id, "https://WWW.Excel-Facile.com/", config);
    expect(d.hostname).toBe("www.excel-facile.com");
    expect(d.status).toBe("pending");

    // Nothing in DNS yet.
    let checked = await verifyDomain(db, userId, d.id, fakeDns({}), config);
    expect(checked.status).toBe("pending");
    expect(checked.lastError).toContain("introuvable");
    expect(await resolvePublishedPage(db, { hostname: "www.excel-facile.com" }, "")).toBeNull();

    // Ownership proven, but pointing elsewhere.
    const txt = { "_tunnels-ia.www.excel-facile.com": [[txtValue(d.verificationToken)]] };
    checked = await verifyDomain(db, userId, d.id, fakeDns({ txt, a: { "www.excel-facile.com": ["1.1.1.1"], "cname.tunnels.app": ["2.2.2.2"] } }), config);
    expect(checked.status).toBe("misconfigured");
    expect(checked.lastError).toContain("CNAME vers cname.tunnels.app");

    // Both right.
    checked = await verifyDomain(db, userId, d.id, fakeDns({ txt, cname: { "www.excel-facile.com": ["cname.tunnels.app."] } }), config);
    expect(checked.status).toBe("verified");
    expect(await resolvePublishedPage(db, { hostname: "WWW.excel-facile.com" }, "")).not.toBeNull();

    // DNS changed later: the domain stops serving.
    checked = await verifyDomain(db, userId, d.id, fakeDns({ txt }), config);
    expect(checked.status).toBe("misconfigured");
    expect(await resolvePublishedPage(db, { hostname: "www.excel-facile.com" }, "")).toBeNull();
  });

  it("never claims a domain is active without a configured platform target", async () => {
    const { userId, funnel } = await setup();
    const d = await addDomain(db, userId, funnel.id, "client.com", config);
    const txt = { "_tunnels-ia.client.com": [[txtValue(d.verificationToken)]] };
    const checked = await verifyDomain(db, userId, d.id, fakeDns({ txt }), { ...config, domainTarget: null });
    expect(checked.status).toBe("misconfigured");
    expect(checked.lastError).toContain("PUBLIC_DOMAIN_TARGET");
  });

  it("validates hostnames and keeps verified ownership exclusive", async () => {
    const a = await setup("A");
    const b = await setup("B");
    for (const bad of ["localhost", "1.2.3.4", "-x.com", "a..com", "shop.tunnels.app"]) {
      await expect(addDomain(db, a.userId, a.funnel.id, bad, config), bad).rejects.toBeInstanceOf(ValidationError);
    }
    const da = await addDomain(db, a.userId, a.funnel.id, "shop.com", config);
    await expect(addDomain(db, a.userId, a.funnel.id, "shop.com", config)).rejects.toThrow("déjà ajouté");
    const db_ = await addDomain(db, b.userId, b.funnel.id, "shop.com", config);

    const dnsA = fakeDns({ txt: { "_tunnels-ia.shop.com": [[txtValue(da.verificationToken)]] }, cname: { "shop.com": ["cname.tunnels.app"] } });
    expect((await verifyDomain(db, a.userId, da.id, dnsA, config)).status).toBe("verified");
    // B cannot verify: the TXT record holds A's token.
    expect((await verifyDomain(db, b.userId, db_.id, dnsA, config)).status).toBe("pending");

    await expect(verifyDomain(db, b.userId, da.id, dnsA, config)).rejects.toBeInstanceOf(NotFoundError);
    await expect(removeDomain(db, b.userId, da.id)).rejects.toBeInstanceOf(NotFoundError);
    await removeDomain(db, a.userId, da.id);
    expect(await listDomains(db, a.userId, a.funnel.id)).toEqual([]);
  });
});
