import type { CSSProperties } from "react";
import type { PageContent, Section } from "@/server/page-schema";
import { onAccent, PAGE_BACKGROUNDS } from "@/server/page-validation";

/*
 * Renders page content (schema v1) as a published page would look.
 * Everything is plain text through React, so content can never inject markup or script.
 * No animation: the v1 format has none, and a sales page reads best when nothing moves.
 */

const currencyFormat = (price: number, currency: string) => {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(price);
  } catch {
    return `${price} ${currency}`;
  }
};

export function PageRenderer({ content }: { content: PageContent }) {
  const { accent, background, font } = content.theme;
  const dark = background === "dark";
  const style = {
    "--p-accent": accent,
    "--p-on-accent": onAccent(accent),
    "--p-bg": PAGE_BACKGROUNDS[background],
    "--p-fg": dark ? "#f2f2f0" : "#141414",
    "--p-muted": dark ? "#a8a8a3" : "#5c5c58",
    "--p-border": dark ? "#2c2c2a" : "#e6e5e1",
    "--p-soft": dark ? "#1b1b19" : "#f6f5f2",
    fontFamily: font === "serif" ? "ui-serif, Georgia, 'Times New Roman', serif" : "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  } as CSSProperties;

  if (content.sections.length === 0) {
    return (
      <div style={style} className="flex min-h-dvh items-center justify-center bg-[var(--p-bg)] p-8 text-center text-[var(--p-muted)]">
        Cette page ne contient encore aucune section.
      </div>
    );
  }
  return (
    <div style={style} className="min-h-dvh bg-[var(--p-bg)] text-[var(--p-fg)] [overflow-wrap:anywhere]">
      {content.sections.map((s) => (
        <SectionView key={s.id} section={s} />
      ))}
    </div>
  );
}

function Cta({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      className="pressable inline-flex min-h-12 items-center justify-center rounded-[10px] bg-[var(--p-accent)] px-6 text-base font-semibold text-[var(--p-on-accent)]"
    >
      {label}
    </a>
  );
}

function Shell({ id, children, narrow = false, soft = false }: { id: string; children: React.ReactNode; narrow?: boolean; soft?: boolean }) {
  return (
    <section id={id} className={soft ? "bg-[var(--p-soft)]" : undefined}>
      <div className={`mx-auto px-5 py-14 sm:py-20 ${narrow ? "max-w-2xl" : "max-w-4xl"}`}>{children}</div>
    </section>
  );
}

function Title({ children }: { children?: string }) {
  if (!children) return null;
  return <h2 className="mb-8 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{children}</h2>;
}

function SectionView({ section: s }: { section: Section }) {
  switch (s.type) {
    case "hero":
      return (
        <section id={s.id}>
          <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-16 sm:py-24 md:grid-cols-[1.1fr_1fr]">
            <div className={s.image ? "" : "md:col-span-2 md:max-w-3xl"}>
              {s.eyebrow && <p className="mb-3 text-sm font-semibold tracking-wide text-[var(--p-accent)] uppercase">{s.eyebrow}</p>}
              <h1 className="text-[2rem] leading-[1.15] font-bold tracking-tight text-balance sm:text-5xl">{s.headline}</h1>
              {s.subheadline && <p className="mt-5 text-lg text-[var(--p-muted)] text-pretty">{s.subheadline}</p>}
              {s.cta && (
                <div className="mt-8">
                  <Cta {...s.cta} />
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
        <Shell id={s.id} soft>
          <Title>{s.title}</Title>
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {s.items.map((item, i) => (
              <div key={i}>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-[var(--p-muted)]">{item.body}</p>
              </div>
            ))}
          </div>
        </Shell>
      );
    case "benefits":
      return (
        <Shell id={s.id} narrow>
          <Title>{s.title}</Title>
          <ul className="flex flex-col gap-3">
            {s.items.map((item, i) => (
              <li key={i} className="flex gap-3">
                <svg viewBox="0 0 20 20" className="mt-1 size-4 shrink-0 text-[var(--p-accent)]" aria-hidden="true">
                  <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Shell>
      );
    case "testimonials":
      return (
        <Shell id={s.id} soft>
          <Title>{s.title}</Title>
          <div className="grid gap-6 sm:grid-cols-2">
            {s.items.map((t, i) => (
              <figure key={i} className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-bg)] p-6">
                <blockquote className="text-pretty">« {t.quote} »</blockquote>
                <figcaption className="mt-4 text-sm">
                  <span className="font-semibold">{t.author}</span>
                  {t.role && <span className="text-[var(--p-muted)]"> · {t.role}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        </Shell>
      );
    case "pricing":
      return (
        <Shell id={s.id} narrow>
          <div className="rounded-2xl border border-[var(--p-border)] p-6 sm:p-10">
            {s.title && <h2 className="text-xl font-semibold">{s.title}</h2>}
            <p className="mt-3 text-4xl font-bold tracking-tight">
              {currencyFormat(s.price, s.currency)}
              {s.period && <span className="ml-1 text-base font-normal text-[var(--p-muted)]">/ {s.period}</span>}
            </p>
            {s.features.length > 0 && (
              <ul className="mt-6 flex flex-col gap-2 text-[var(--p-muted)]">
                {s.features.map((f, i) => (
                  <li key={i}>— {f}</li>
                ))}
              </ul>
            )}
            <div className="mt-8">
              <Cta {...s.cta} />
            </div>
          </div>
        </Shell>
      );
    case "faq":
      return (
        <Shell id={s.id} narrow>
          <Title>{s.title}</Title>
          <div className="divide-y divide-[var(--p-border)] border-y border-[var(--p-border)]">
            {s.items.map((q, i) => (
              // Native disclosure: keyboard and screen readers work without script; no animation for a reading task.
              <details key={i} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {q.question}
                  <span aria-hidden="true" className="text-[var(--p-muted)] group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-[var(--p-muted)]">{q.answer}</p>
              </details>
            ))}
          </div>
        </Shell>
      );
    case "cta":
      return (
        <Shell id={s.id} narrow>
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{s.headline}</h2>
            {s.body && <p className="mt-3 text-[var(--p-muted)]">{s.body}</p>}
            <div className="mt-8">
              <Cta {...s.cta} />
            </div>
          </div>
        </Shell>
      );
    case "text":
      return (
        <Shell id={s.id} narrow>
          <Title>{s.title}</Title>
          <div className="flex flex-col gap-4 text-pretty">
            {s.body.split(/\n{2,}/).map((p, i) => (
              <p key={i} className="whitespace-pre-line">{p}</p>
            ))}
          </div>
        </Shell>
      );
    case "image":
      return (
        <Shell id={s.id}>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element -- user-provided remote URL, any host */}
            <img src={s.image.url} alt={s.image.alt} className="w-full rounded-2xl" loading="lazy" />
            {s.caption && <figcaption className="mt-3 text-center text-sm text-[var(--p-muted)]">{s.caption}</figcaption>}
          </figure>
        </Shell>
      );
  }
}
