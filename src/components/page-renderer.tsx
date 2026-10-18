import { createElement, memo, type ComponentType, type CSSProperties, type ReactNode } from "react";
import type { PageContent, Section } from "@/server/page-schema";
import { onAccent, PAGE_BACKGROUNDS } from "@/server/page-validation";

/*
 * Renders page content (schema v1). Shared by the private preview (server) and the visual
 * editor (client), so what you edit is exactly what you get.
 *
 * - Plain text through React only: content can never inject markup or script.
 * - Container queries, not media queries: the page adapts to the width of its frame, so the
 *   editor can show desktop / tablet / mobile without an iframe.
 * - No animation: the v1 format has none, and a sales page reads best when nothing moves.
 */

type TextTag = "h1" | "h2" | "h3" | "p" | "span" | "blockquote";

export type TextSlotProps = {
  sectionId: string;
  path: (string | number)[];
  value: string;
  label: string;
  as: TextTag;
  className?: string;
  multiline?: boolean;
};

/** Injected by the editor; absent in preview and published pages. */
export type EditHooks = {
  Text: ComponentType<TextSlotProps>;
  Section: ComponentType<{ section: Section; children: ReactNode }>;
};

const currencyFormat = (price: number, currency: string) => {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(price);
  } catch {
    return `${price} ${currency}`;
  }
};

export function themeStyle(theme: PageContent["theme"]): CSSProperties {
  const dark = theme.background === "dark";
  return {
    "--p-accent": theme.accent,
    "--p-on-accent": onAccent(theme.accent),
    "--p-bg": PAGE_BACKGROUNDS[theme.background],
    "--p-fg": dark ? "#f2f2f0" : "#141414",
    "--p-muted": dark ? "#a8a8a3" : "#5c5c58",
    "--p-border": dark ? "#2c2c2a" : "#e6e5e1",
    "--p-soft": dark ? "#1b1b19" : "#f6f5f2",
    fontFamily: theme.font === "serif" ? "ui-serif, Georgia, 'Times New Roman', serif" : "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  } as CSSProperties;
}

export type ProductInfo = { name: string; price: number; currency: string; active: boolean };

/** Present only on a live published page: makes order forms submit for real. */
export type CheckoutTarget = {
  site: string;
  siteKind: "subdomain" | "domain";
  path: string;
  error?: { sectionId: string; message: string; fields?: Record<string, string> };
};

type RenderContext = { edit?: EditHooks; products: Record<string, ProductInfo>; checkout?: CheckoutTarget };

export function PageRenderer({
  content,
  edit,
  products = {},
  checkout,
  className = "min-h-dvh",
}: {
  content: PageContent;
  edit?: EditHooks;
  products?: Record<string, ProductInfo>;
  checkout?: CheckoutTarget;
  className?: string;
}) {
  return (
    <div style={themeStyle(content.theme)} className={`@container bg-[var(--p-bg)] text-[var(--p-fg)] [overflow-wrap:anywhere] ${className}`}>
      {content.sections.length === 0 ? (
        <p className="p-12 text-center text-[var(--p-muted)]">Cette page ne contient encore aucune section.</p>
      ) : (
        content.sections.map((s) => (
          <SectionView key={s.id} section={s} edit={edit} products={s.type === "checkout" ? products : NO_PRODUCTS} checkout={s.type === "checkout" ? checkout : undefined} />
        ))
      )}
    </div>
  );
}

const NO_PRODUCTS: Record<string, ProductInfo> = {};

const SectionView = memo(function SectionView({ section, ...ctx }: { section: Section } & RenderContext) {
  const body = section.type === "checkout" ? <CheckoutForm s={section} {...ctx} /> : <SectionBody s={section} edit={ctx.edit} />;
  const edit = ctx.edit;
  return edit ? <edit.Section section={section}>{body}</edit.Section> : body;
});

/** Text that becomes directly editable inside the editor. */
function T({ edit, ...slot }: TextSlotProps & { edit?: EditHooks }) {
  if (edit) return <edit.Text {...slot} />;
  return createElement(slot.as, { className: slot.className }, slot.value);
}

const PAD = { compact: "py-8 @min-[640px]:py-10", normal: "py-14 @min-[640px]:py-20", airy: "py-20 @min-[640px]:py-32" };

function Shell({ s, children, narrow = false, soft = false }: { s: Section; children: ReactNode; narrow?: boolean; soft?: boolean }) {
  const center = s.layout?.align === "center";
  return (
    <section id={s.id} className={soft ? "bg-[var(--p-soft)]" : undefined}>
      <div className={`mx-auto px-5 ${PAD[s.layout?.spacing ?? "normal"]} ${narrow ? "max-w-2xl" : "max-w-4xl"} ${center ? "text-center" : ""}`}>
        {children}
      </div>
    </section>
  );
}

function Cta({ s, path, cta, edit }: { s: Section; path: (string | number)[]; cta: { label: string; href: string }; edit?: EditHooks }) {
  const className =
    "pressable inline-flex min-h-12 items-center justify-center rounded-[10px] bg-[var(--p-accent)] px-6 text-base font-semibold text-[var(--p-on-accent)]";
  // In the editor the button is text to edit, not a link to follow.
  if (edit) {
    return (
      <span className={className}>
        <T edit={edit} sectionId={s.id} path={[...path, "label"]} value={cta.label} label="Libellé du bouton" as="span" />
      </span>
    );
  }
  return (
    <a href={cta.href} className={className}>
      {cta.label}
    </a>
  );
}

function SectionTitle({ s, value, edit }: { s: Section; value?: string; edit?: EditHooks }) {
  if (!value) return null;
  return <T edit={edit} sectionId={s.id} path={["title"]} value={value} label="Titre de section" as="h2" className="mb-8 text-2xl font-semibold tracking-tight text-balance @min-[640px]:text-3xl" />;
}

function SectionBody({ s, edit }: { s: Section; edit?: EditHooks }) {
  const center = s.layout?.align === "center";
  switch (s.type) {
    case "hero":
      return (
        <section id={s.id}>
          <div className={`mx-auto grid max-w-5xl items-center gap-10 px-5 ${s.layout?.spacing ? PAD[s.layout.spacing] : "py-16 @min-[640px]:py-24"} ${s.image ? "@min-[768px]:grid-cols-[1.1fr_1fr]" : ""}`}>
            <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
              {s.eyebrow && <T edit={edit} sectionId={s.id} path={["eyebrow"]} value={s.eyebrow} label="Surtitre" as="p" className="mb-3 text-sm font-semibold tracking-wide text-[var(--p-accent)] uppercase" />}
              <T edit={edit} sectionId={s.id} path={["headline"]} value={s.headline} label="Titre principal" as="h1" className="text-[2rem] leading-[1.15] font-bold tracking-tight text-balance @min-[640px]:text-5xl" />
              {s.subheadline && <T edit={edit} sectionId={s.id} path={["subheadline"]} value={s.subheadline} label="Sous-titre" as="p" multiline className="mt-5 text-lg text-[var(--p-muted)] text-pretty" />}
              {s.cta && (
                <div className="mt-8">
                  <Cta s={s} path={["cta"]} cta={s.cta} edit={edit} />
                </div>
              )}
            </div>
            {s.image && (
              // eslint-disable-next-line @next/next/no-img-element -- user-provided remote URL, any host
              <img src={s.image.url} alt={s.image.alt} className="w-full rounded-2xl object-cover" loading="eager" />
            )}
          </div>
        </section>
      );
    case "features":
      return (
        <Shell s={s} soft>
          <SectionTitle s={s} value={s.title} edit={edit} />
          <div className={`grid gap-x-8 gap-y-6 @min-[640px]:grid-cols-2 ${center ? "text-left" : ""}`}>
            {s.items.map((item, i) => (
              <div key={i}>
                <T edit={edit} sectionId={s.id} path={["items", i, "title"]} value={item.title} label={`Titre de l’élément ${i + 1}`} as="h3" className="font-semibold" />
                <T edit={edit} sectionId={s.id} path={["items", i, "body"]} value={item.body} label={`Texte de l’élément ${i + 1}`} as="p" multiline className="mt-1.5 text-[var(--p-muted)]" />
              </div>
            ))}
          </div>
        </Shell>
      );
    case "benefits":
      return (
        <Shell s={s} narrow>
          <SectionTitle s={s} value={s.title} edit={edit} />
          <ul className={`flex flex-col gap-3 ${center ? "mx-auto w-fit text-left" : ""}`}>
            {s.items.map((item, i) => (
              <li key={i} className="flex gap-3">
                <svg viewBox="0 0 20 20" className="mt-1 size-4 shrink-0 text-[var(--p-accent)]" aria-hidden="true">
                  <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <T edit={edit} sectionId={s.id} path={["items", i]} value={item} label={`Bénéfice ${i + 1}`} as="span" />
              </li>
            ))}
          </ul>
        </Shell>
      );
    case "testimonials":
      return (
        <Shell s={s} soft>
          <SectionTitle s={s} value={s.title} edit={edit} />
          <div className="grid gap-6 text-left @min-[640px]:grid-cols-2">
            {s.items.map((t, i) => (
              <figure key={i} className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-bg)] p-6">
                <T edit={edit} sectionId={s.id} path={["items", i, "quote"]} value={t.quote} label={`Témoignage ${i + 1}`} as="blockquote" multiline className="text-pretty" />
                <figcaption className="mt-4 text-sm">
                  <T edit={edit} sectionId={s.id} path={["items", i, "author"]} value={t.author} label={`Auteur du témoignage ${i + 1}`} as="span" className="font-semibold" />
                  {t.role && <span className="text-[var(--p-muted)]"> · {t.role}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        </Shell>
      );
    case "pricing":
      return (
        <Shell s={s} narrow>
          <div className="rounded-2xl border border-[var(--p-border)] p-6 @min-[640px]:p-10">
            {s.title && <T edit={edit} sectionId={s.id} path={["title"]} value={s.title} label="Titre de l’offre" as="h2" className="text-xl font-semibold" />}
            <p className="mt-3 text-4xl font-bold tracking-tight">
              {currencyFormat(s.price, s.currency)}
              {s.period && <span className="ml-1 text-base font-normal text-[var(--p-muted)]">/ {s.period}</span>}
            </p>
            {s.features.length > 0 && (
              <ul className={`mt-6 flex flex-col gap-2 text-[var(--p-muted)] ${center ? "mx-auto w-fit text-left" : ""}`}>
                {s.features.map((f, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span aria-hidden="true">—</span>
                    <T edit={edit} sectionId={s.id} path={["features", i]} value={f} label={`Inclus ${i + 1}`} as="span" />
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-8">
              <Cta s={s} path={["cta"]} cta={s.cta} edit={edit} />
            </div>
          </div>
        </Shell>
      );
    case "faq":
      return (
        <Shell s={s} narrow>
          <SectionTitle s={s} value={s.title} edit={edit} />
          <div className="divide-y divide-[var(--p-border)] border-y border-[var(--p-border)] text-left">
            {s.items.map((q, i) =>
              edit ? (
                // Answers stay visible while editing.
                <div key={i} className="py-4">
                  <T edit={edit} sectionId={s.id} path={["items", i, "question"]} value={q.question} label={`Question ${i + 1}`} as="p" className="font-medium" />
                  <T edit={edit} sectionId={s.id} path={["items", i, "answer"]} value={q.answer} label={`Réponse ${i + 1}`} as="p" multiline className="mt-3 text-[var(--p-muted)]" />
                </div>
              ) : (
                // Native disclosure: keyboard and screen readers work without script.
                <details key={i} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {q.question}
                    <span aria-hidden="true" className="text-[var(--p-muted)] group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-[var(--p-muted)]">{q.answer}</p>
                </details>
              ),
            )}
          </div>
        </Shell>
      );
    case "cta":
      return (
        <Shell s={s} narrow>
          <div className={s.layout?.align === "left" ? "" : "text-center"}>
            <T edit={edit} sectionId={s.id} path={["headline"]} value={s.headline} label="Titre" as="h2" className="text-2xl font-semibold tracking-tight text-balance @min-[640px]:text-3xl" />
            {s.body && <T edit={edit} sectionId={s.id} path={["body"]} value={s.body} label="Texte" as="p" multiline className="mt-3 text-[var(--p-muted)]" />}
            <div className="mt-8">
              <Cta s={s} path={["cta"]} cta={s.cta} edit={edit} />
            </div>
          </div>
        </Shell>
      );
    case "text":
      return (
        <Shell s={s} narrow>
          <SectionTitle s={s} value={s.title} edit={edit} />
          {edit ? (
            <T edit={edit} sectionId={s.id} path={["body"]} value={s.body} label="Texte" as="p" multiline className="whitespace-pre-wrap text-pretty" />
          ) : (
            <div className="flex flex-col gap-4 text-pretty">
              {s.body.split(/\n{2,}/).map((p, i) => (
                <p key={i} className="whitespace-pre-line">{p}</p>
              ))}
            </div>
          )}
        </Shell>
      );
    case "checkout":
      return null;
    case "image":
      return (
        <Shell s={s}>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element -- user-provided remote URL, any host */}
            <img src={s.image.url} alt={s.image.alt} className="w-full rounded-2xl" loading="lazy" />
            {s.caption && <T edit={edit} sectionId={s.id} path={["caption"]} value={s.caption} label="Légende" as="p" className="mt-3 text-center text-sm text-[var(--p-muted)]" />}
          </figure>
        </Shell>
      );
  }
}

const FIELDS = [
  { name: "first_name", key: "firstName", label: "Prénom", type: "text", autoComplete: "given-name", required: true },
  { name: "last_name", key: "lastName", label: "Nom", type: "text", autoComplete: "family-name", required: true },
  { name: "email", key: "email", label: "E-mail", type: "email", autoComplete: "email", required: true },
  { name: "phone", key: "phone", label: "Téléphone (facultatif, ex. +225…)", type: "tel", autoComplete: "tel", required: false },
] as const;

/**
 * Order form. Real only on a live publication (posts to /api/checkout, works without
 * JavaScript); in preview and editor it is shown disabled. The price shown is the product's.
 */
function CheckoutForm({ s, edit, products, checkout }: { s: Extract<Section, { type: "checkout" }> } & RenderContext) {
  const product = products[s.productId];
  const live = Boolean(checkout && !edit && product?.active);
  const error = checkout?.error?.sectionId === s.id ? checkout.error : undefined;
  const input =
    "h-12 w-full rounded-[10px] border border-[var(--p-border)] bg-[var(--p-bg)] px-3 text-[16px] text-[var(--p-fg)] disabled:opacity-60 aria-invalid:border-red-600";
  const body = (
    <>
      {FIELDS.map((f) => (
        <div key={f.name} className="flex flex-col gap-1.5 text-left">
          <label htmlFor={`${s.id}-${f.name}`} className="text-sm font-medium">{f.label}</label>
          <input
            id={`${s.id}-${f.name}`}
            name={f.name}
            type={f.type}
            autoComplete={f.autoComplete}
            required={f.required}
            disabled={!live}
            aria-invalid={error?.fields?.[f.key] ? true : undefined}
            className={input}
          />
          {error?.fields?.[f.key] && <p className="text-sm text-red-600">{error.fields[f.key]}</p>}
        </div>
      ))}
      {error && <p role="alert" className="rounded-[10px] bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</p>}
      <button
        type={live ? "submit" : "button"}
        disabled={!live && !edit}
        className="pressable mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-[10px] bg-[var(--p-accent)] px-6 text-base font-semibold text-[var(--p-on-accent)] disabled:opacity-60"
      >
        <T edit={edit} sectionId={s.id} path={["buttonLabel"]} value={s.buttonLabel} label="Libellé du bouton de paiement" as="span" />
      </button>
      <p className="text-xs text-[var(--p-muted)]">
        Vos coordonnées servent uniquement à traiter cette commande. Paiement sécurisé chez notre prestataire ; la commande est confirmée après vérification du paiement.
      </p>
      {!live && (
        <p className="text-xs text-[var(--p-muted)]">
          {product && !product.active ? "Produit désactivé : formulaire inactif." : "Aperçu : le formulaire devient actif une fois la page publiée."}
        </p>
      )}
    </>
  );
  return (
    <Shell s={s} narrow>
      <SectionTitle s={s} value={s.title} edit={edit} />
      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--p-border)] p-6 @min-[640px]:p-8">
        {product ? (
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-left">
            <span className="font-semibold">{product.name}</span>
            <span className="text-2xl font-bold">{currencyFormat(product.price, product.currency)}</span>
          </div>
        ) : (
          <p className="text-sm text-red-600">Produit à choisir dans les réglages de la section.</p>
        )}
        {s.note && <T edit={edit} sectionId={s.id} path={["note"]} value={s.note} label="Note" as="p" multiline className="text-sm text-[var(--p-muted)]" />}
        {live && checkout ? (
          <form action="/api/checkout" method="post" className="flex flex-col gap-4">
            <input type="hidden" name="site" value={checkout.site} />
            <input type="hidden" name="site_kind" value={checkout.siteKind} />
            <input type="hidden" name="path" value={checkout.path} />
            <input type="hidden" name="section" value={s.id} />
            {body}
          </form>
        ) : (
          <div className="flex flex-col gap-4">{body}</div>
        )}
      </div>
    </Shell>
  );
}
