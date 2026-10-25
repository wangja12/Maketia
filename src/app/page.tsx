import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { getDb } from "@/db";
import { listActivePlans, planPrice } from "@/server/billing/plans";
import { MobileBar } from "./mobile-bar";

export const metadata: Metadata = {
  title: "Maketia — vends tes e-books et formations en FCFA, sans courir après tes clients",
};

/*
 * Public landing page, reworked from the founder pack's reviews (founder/landing-review/,
 * founder/board.md). Every claim matches what the product does today: the creator confirms
 * each payment, then sends the private link (one tap to WhatsApp); no AI model runs inside
 * Maketia; prices come from the admin-edited plans. Mock-ups are labelled as illustrations.
 */

const STEPS = [
  { title: "Tu ajoutes ton produit", text: "Ton fichier (PDF, vidéo, pack, jusqu’à 50 Mo), ton prix en FCFA et ton lien de paiement SasPay." },
  { title: "Tu montes ta page", text: "Choisis un modèle, remplis les sections, regarde le rendu sur téléphone, publie." },
  { title: "Ton client paie", text: "Il appuie sur « Acheter » et paie avec ton lien SasPay. L’argent arrive sur ton compte, pas chez nous." },
  { title: "Tu confirmes, il télécharge", text: "Tu vois l’argent arriver, tu confirmes la vente, et Maketia crée son lien privé. Un geste pour l’envoyer sur WhatsApp." },
];

const BEFORE_AFTER = [
  ["Tu réexpliques ton produit à chaque « info ? » en message privé.", "Tu envoies un seul lien : ta page explique tout, même la nuit."],
  ["Tu donnes ton numéro et tu attends la capture d’écran du paiement.", "Ton client paie avec ton lien SasPay, directement sur ton compte."],
  ["Tu vérifies des captures, parfois fausses.", "Tu confirmes la vente dans ton espace, une fois l’argent vu sur ton compte."],
  ["Ton PDF part en pièce jointe et circule partout.", "Ton client reçoit un lien privé, limité dans le temps et en téléchargements."],
  ["Tes ventes se perdent dans 200 discussions.", "Tes commandes et tes contacts sont rangés au même endroit."],
];

// Each card answers a creator's problem; the tint gives each its own colour, text stays in ink.
const FEATURES: { title: string; text: string; icon: keyof typeof ICONS; tint: string; wide?: boolean }[] = [
  { title: "Une page qui vend, sans coder", text: "Accroche, ce que contient ton produit, avis de tes vrais clients, prix, questions fréquentes. Tu remplis, tu déplaces, tu publies.", icon: "blocks", tint: "bg-blue-500/10 text-blue-700 dark:text-blue-300", wide: true },
  { title: "Pensée pour le téléphone", text: "Tes clients arrivent depuis WhatsApp, TikTok ou Facebook. Tu vois ta page exactement comme eux.", icon: "phone", tint: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  { title: "Ton argent va chez toi", text: "Ton client paie avec ton lien SasPay, sur ton compte. Pas de portefeuille Maketia, pas de retrait à nous demander, aucune commission.", icon: "card", tint: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { title: "Pas payé, pas de fichier", text: "Ton fichier n’est remis qu’après ta confirmation. Le lien expire et se télécharge un nombre limité de fois : il ne circule pas partout.", icon: "lock", tint: "bg-amber-500/10 text-amber-800 dark:text-amber-300", wide: true },
  { title: "Ton nom de domaine, si tu veux", text: "Ta page a sa propre adresse Maketia, ou ton domaine à toi (tonnom.com).", icon: "globe", tint: "bg-sky-500/10 text-sky-800 dark:text-sky-300" },
  { title: "Tes clients et tes ventes, rangés", text: "Chaque commande et chaque contact au même endroit, avec des statistiques simples sur ta page.", icon: "chart", tint: "bg-rose-500/10 text-rose-700 dark:text-rose-300", wide: true },
];

// Example products, drawn in CSS; titles and prices are invented for the illustration.
const SHOWCASE = [
  { kind: "E-book", title: "Vendre en ligne sans y passer tes nuits", meta: "PDF · 68 pages", price: "5 000 FCFA", cover: "from-[#0c1630] to-[#1d5bd8]", ink: "text-white", tilt: "lg:-rotate-2" },
  { kind: "Formation", title: "Excel pour ton commerce, en 7 jours", meta: "Cahier PDF + exercices", price: "15 000 FCFA", cover: "from-[#f6d7c3] to-[#f29d7a]", ink: "text-[#3b1d10]", tilt: "lg:rotate-[1.5deg]" },
  { kind: "Pack de templates", title: "30 visuels pour tes réseaux", meta: "Canva · PNG", price: "7 500 FCFA", cover: "from-[#1f3b2d] to-[#4f8a6b]", ink: "text-white", tilt: "lg:-rotate-1" },
  { kind: "Guide gratuit", title: "La checklist du premier lancement", meta: "PDF · 6 pages", price: "Gratuit", cover: "from-[#ece7ff] to-[#b9a8ff]", ink: "text-[#22164f]", tilt: "lg:rotate-2" },
  { kind: "Pack audio", title: "Méditations du matin", meta: "MP3 · 10 pistes", price: "3 000 FCFA", cover: "from-[#2b1240] to-[#d9467a]", ink: "text-white", tilt: "lg:-rotate-[1.5deg]" },
];

const FAQ = [
  {
    q: "Combien ça coûte ?",
    a: "Tu peux commencer gratuitement, sans carte bancaire. Les prix des plans payants sont affichés sur cette page dès qu’ils sont ouverts. Dans tous les cas, Maketia ne prend aucun pourcentage sur tes ventes.",
  },
  {
    q: "Maketia encaisse-t-il l’argent de mes ventes ?",
    a: "Non. Ton client paie avec ton lien de paiement SasPay, directement sur ton compte. Maketia ne voit pas passer ton argent et ne te demande jamais ta clé API SasPay.",
  },
  {
    q: "Quand mon client reçoit-il son fichier ?",
    a: "Dès que tu as confirmé son paiement. Tu vois l’argent arriver sur ton compte SasPay, tu confirmes la vente dans ton espace, Maketia crée un lien de téléchargement privé et ouvre WhatsApp avec le message prêt : tu appuies sur « Envoyer ». Le lien n’est affiché qu’une fois ; tu peux aussi le copier pour un SMS ou un e-mail. Aucun fichier ne part sur une simple capture d’écran ou un retour de page.",
  },
  {
    q: "Pourquoi la confirmation n’est-elle pas automatique ?",
    a: "Parce qu’on ne livre jamais un fichier sur une information qu’on ne peut pas vérifier. La confirmation automatique arrivera quand les notifications de paiement SasPay pourront être vérifiées de façon fiable. D’ici là, c’est toi qui gardes la main.",
  },
  {
    q: "Ai-je besoin d’un compte SasPay ?",
    a: "Oui. SasPay est le service de paiement en ligne qui encaisse pour toi : c’est sur ton compte SasPay que ton client paie. Vérifie sur le site de SasPay que ton pays et les moyens de paiement de tes clients sont couverts, crée ton lien de paiement chez SasPay, puis colle-le dans Maketia pour ton produit. Les frais de SasPay s’appliquent à chaque paiement, comme pour tout service de paiement.",
  },
  {
    q: "Faut-il savoir coder ?",
    a: "Non. Tu choisis un modèle, tu remplis les sections, tu regardes l’aperçu sur téléphone et tu publies.",
  },
  {
    q: "Puis-je arrêter quand je veux ?",
    a: "Oui. Tu peux exporter tes contacts et supprimer ton compte toi-même, depuis tes réglages.",
  },
  {
    q: "Puis-je utiliser mon propre nom de domaine ?",
    a: "Oui. Tu ajoutes ton domaine, tu prouves qu’il t’appartient avec un enregistrement DNS, puis tes pages y sont servies. Le nombre de domaines dépend de ton plan.",
  },
  {
    q: "Et l’intelligence artificielle ?",
    a: "Maketia n’intègre aucune IA. Si tu le souhaites, tu peux connecter ton propre assistant (Claude, par exemple) : il peut proposer des modifications de tes pages, et rien n’est publié sans ton accord.",
  },
];

async function activePlans() {
  // The landing page must render even if the database is briefly unreachable.
  try {
    return await listActivePlans(getDb());
  } catch {
    return [];
  }
}

export default async function Home() {
  const plans = await activePlans();
  return (
    <div className="overflow-x-clip bg-bg text-fg">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2">
        Aller au contenu
      </a>
      <Header />
      <main id="contenu">
        <Hero />
        <Showcase />
        <BeforeAfter />
        <Journey />
        <BuyerView />
        <Features />
        <ForWho />
        <Pricing plans={plans} />
        <Faq />
        <FinalCall />
      </main>
      <MobileBar />
    </div>
  );
}

// White call to action on the night panels (not the accent: it must stand out from the blue glow).
const ctaOnNight = `pressable inline-flex h-12 select-none items-center justify-center gap-2 rounded-full bg-white px-6 text-[15px] font-medium whitespace-nowrap text-[#0c1630] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/90`;
const ctaPrimary = buttonClass("primary", "h-12 rounded-full px-6 text-[15px] shadow-[0_10px_24px_-10px_rgb(29_91_216/0.7)]");

function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      maketia<span className="text-accent">.</span>
    </span>
  );
}

function Header() {
  return (
    <header className="z-30 border-b border-border/60 bg-bg sm:sticky sm:top-0 sm:bg-bg/85 sm:backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Maketia, accueil" className="flex h-11 items-center">
          <Logo className="text-xl" />
        </Link>
        <nav aria-label="Sections de la page" className="hidden items-center gap-7 text-sm text-muted md:flex">
          <a href="#comment" className={`[@media(hover:hover)_and_(pointer:fine)]:hover:text-fg`}>Comment ça marche</a>
          <a href="#client" className={`[@media(hover:hover)_and_(pointer:fine)]:hover:text-fg`}>Ce que voit ton client</a>
          <a href="#tarifs" className={`[@media(hover:hover)_and_(pointer:fine)]:hover:text-fg`}>Tarifs</a>
          <a href="#faq" className={`[@media(hover:hover)_and_(pointer:fine)]:hover:text-fg`}>Questions</a>
        </nav>
        <div className="flex items-center gap-1">
          <Link href="/connexion" className={buttonClass("ghost", "h-11 px-3")}>
            Connexion
          </Link>
          <span className="hidden sm:contents">
            <Link href="/inscription" className={buttonClass("primary", "h-11 rounded-full px-5")}>
              Créer ma page
            </Link>
          </span>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative" aria-labelledby="hero-title">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] opacity-50" />
        {/* One soft glow, kept away from the text column (contrast) and cheap on low-end phones. */}
        <div className="absolute top-40 right-[-20%] hidden size-[520px] rounded-full bg-blue-500/20 blur-[90px] lg:block" />
      </div>
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[1.08fr_1fr] lg:pt-20 lg:pb-24">
        <div className="flex flex-col gap-6">
          <p className="rise inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-fg shadow-raised">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            Pour les créateurs payés en FCFA avec SasPay
          </p>
          <h1 id="hero-title" className="text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-[4.25rem] lg:text-[4.6rem]">
            Vends ton e‑book ou ta formation,{" "}
            <span className="font-serif text-[1.06em] font-normal tracking-normal text-accent italic">sans courir après tes clients.</span>
          </h1>
          <p className="rise max-w-xl text-[17px] leading-relaxed text-fg/80 text-pretty [--d:120ms] sm:text-lg">
            Une belle page pour ton produit, ton lien SasPay pour encaisser sur ton compte, et un lien de téléchargement privé
            pour ton client dès que tu as vu l’argent arriver. Pas de code. <strong className="font-semibold text-fg">0 % de commission.</strong>
          </p>
          <div id="hero-cta" className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/inscription" className={ctaPrimary}>
              Créer ma page gratuitement <Arrow />
            </Link>
            <a href="#comment" className={`inline-flex h-12 items-center gap-1 px-2 text-[15px] font-medium text-fg [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent`}>
              Voir comment ça marche <span aria-hidden="true">↓</span>
            </a>
          </div>
          <p className="rise -mt-2 text-[13px] text-muted [--d:220ms]">Plan gratuit · sans carte bancaire · tu publies quand tu es prêt(e)</p>
        </div>
        <HeroMock />
      </div>
    </section>
  );
}

/** The buyer's phone on a blue block (PlutoPay), with the editor window behind on wide screens. */
function HeroMock() {
  return (
    <figure className="rise relative mx-auto w-full max-w-[560px] [--d:240ms] lg:mx-0" aria-label="Illustration : une page de vente Maketia sur téléphone, et l’éditeur">
      <div className="relative h-[430px] sm:h-[470px]" aria-hidden="true">
        {/* Editor window, wide screens only. */}
        <div className="absolute top-0 left-0 hidden w-[78%] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_30px_70px_-30px_rgb(12_22_48/0.45)] sm:block">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-[#ff5f57]" />
              <span className="size-2.5 rounded-full bg-[#febc2e]" />
              <span className="size-2.5 rounded-full bg-[#28c840]" />
            </span>
            <Logo className="text-xs" />
            <span className="ml-auto rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-medium text-accent-fg">Publier</span>
          </div>
          <div className="grid grid-cols-[104px_1fr]">
            <ul className="flex flex-col gap-1 border-r border-border bg-surface-sunken p-2 text-[11px] text-muted">
              <li className="px-2 pt-1 pb-1 text-[10px] font-semibold tracking-wider uppercase">Sections</li>
              {["Accroche", "Contenu", "Avis", "Prix", "Questions"].map((s, i) => (
                <li key={s} className={`rounded-md px-2 py-1.5 ${i === 0 ? "bg-surface font-medium text-fg shadow-raised ring-1 ring-accent/40" : ""}`}>{s}</li>
              ))}
            </ul>
            <div className="flex flex-col gap-2.5 p-4 pr-20">
              <span className="h-2 w-16 rounded-full bg-accent/40" />
              <span className="h-3 w-full rounded bg-fg/80" />
              <span className="h-3 w-4/5 rounded bg-fg/80" />
              <span className="mt-1 h-2 w-full rounded bg-border" />
              <span className="h-2 w-11/12 rounded bg-border" />
              <span className="h-2 w-3/4 rounded bg-border" />
              <span className="mt-2 h-6 w-24 rounded-full bg-accent" />
            </div>
          </div>
        </div>
        {/* Blue block + phone. */}
        <div className="absolute right-[8%] bottom-0 h-[78%] w-[62%] rounded-[32px] bg-accent sm:right-0 sm:w-[48%]" />
        <div className="absolute right-[16%] bottom-6 w-[220px] overflow-hidden rounded-[30px] border-[6px] border-[#0c1630] bg-white shadow-[0_30px_60px_-20px_rgb(12_22_48/0.6)] sm:right-[6%] dark:border-white/20">
          <div className="flex flex-col gap-2 p-3 text-[#1c1b19]">
            <div className="mx-auto h-1 w-12 rounded-full bg-[#e3e0d9]" />
            <BookCover className="mx-auto mt-1 w-[92px]" />
            <p className="text-center text-[10px] font-semibold tracking-wider text-[#1d5bd8] uppercase">E-book · 68 pages</p>
            <p className="text-center text-[15px] leading-tight font-semibold">Vendre en ligne sans y passer tes nuits</p>
            <ul className="flex flex-col gap-1 text-[11px] text-[#55524c]">
              <li>✓ La méthode pas à pas</li>
              <li>✓ 12 modèles de messages</li>
            </ul>
            <p className="text-center text-lg font-semibold tabular-nums">5 000 FCFA</p>
            <span className="rounded-full bg-[#1d5bd8] py-2 text-center text-[12px] font-medium text-white">Acheter</span>
            <p className="text-center text-[10px] text-[#6b6862]">Paiement via SasPay</p>
          </div>
        </div>
        {/* A true event of the product: the creator confirms, the link goes out on WhatsApp. */}
        <div className="absolute top-4 left-0 flex items-center gap-2 rounded-2xl sm:top-auto sm:bottom-10 border border-border bg-surface px-3 py-2.5 shadow-[0_16px_36px_-14px_rgb(12_22_48/0.4)]">
          <span className="grid size-8 place-items-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">{ICONS.check}</span>
          <span className="flex flex-col">
            <span className="text-[13px] font-semibold">Paiement confirmé</span>
            <span className="text-[12px] text-muted">Lien prêt à envoyer sur WhatsApp</span>
          </span>
        </div>
      </div>
      <figcaption className="sr-only">Illustration, produit et prix inventés.</figcaption>
    </figure>
  );
}

function BookCover({ className = "" }: { className?: string }) {
  return (
    <div className={`relative aspect-[3/4] overflow-hidden rounded-[5px] bg-gradient-to-b from-[#0c1630] to-[#1d5bd8] shadow-[6px_8px_18px_-6px_rgb(12_22_48/0.6)] ${className}`}>
      <span className="absolute top-2 left-2 text-[8px] font-semibold tracking-wider text-white/75 uppercase">Guide</span>
      <span className="absolute top-5 right-2 left-2 text-[11px] leading-tight font-semibold text-white">Vendre en ligne</span>
      <svg viewBox="0 0 60 30" className="absolute bottom-0 w-full text-white/85" fill="currentColor">
        <path d="M0 30 18 10l8 8 10-14 24 26z" />
      </svg>
    </div>
  );
}

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return <p className={`text-[13px] font-semibold tracking-[0.14em] uppercase ${dark ? "text-sky-300" : "text-accent"}`}>{children}</p>;
}

function SectionTitle({ id, children, className = "" }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <h2 id={id} className={`reveal text-[2rem] leading-[1.08] font-semibold tracking-[-0.025em] text-balance sm:text-[2.9rem] ${className}`}>
      {children}
    </h2>
  );
}

const serif = "font-serif font-normal tracking-normal italic";

/** What people sell with Maketia: a tilted cover strip that scrolls sideways on phones. */
function Showcase() {
  return (
    <section aria-labelledby="showcase-title" className="border-y border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[260px_1fr] lg:items-center">
        <div className="flex flex-col gap-2">
          <Eyebrow>Ce que tu peux vendre</Eyebrow>
          <h2 id="showcase-title" className="text-2xl font-semibold tracking-tight text-balance">
            Un fichier, une page, <span className={`text-[1.1em] ${serif}`}>une vente.</span>
          </h2>
          <p className="text-[15px] text-muted">Exemples : titres et prix inventés.</p>
        </div>
        <ul
          tabIndex={0}
          aria-label="Exemples de produits, à faire défiler"
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pt-2 pb-3 [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] sm:mx-0 sm:px-0 lg:grid lg:grid-cols-5 lg:overflow-visible"
        >
          {SHOWCASE.map((p) => (
            <li key={p.title} className={`w-44 shrink-0 snap-start transition-transform duration-200 ease-[var(--ease-out)] lg:w-auto ${p.tilt} [@media(hover:hover)_and_(pointer:fine)]:hover:rotate-0 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1`}>
              <div className={`flex aspect-[3/4] flex-col justify-between rounded-xl bg-gradient-to-br p-3.5 shadow-[0_14px_30px_-16px_rgb(12_22_48/0.5)] ${p.cover} ${p.ink}`}>
                <span className="text-[12px] font-semibold tracking-wider uppercase">{p.kind}</span>
                <span className="text-[16px] leading-tight font-semibold">{p.title}</span>
                <span className="text-[12px]">{p.meta}</span>
              </div>
              <p className="mt-2 flex items-center justify-between text-[13px]">
                <span className="font-semibold tabular-nums">{p.price}</span>
                <span className="text-muted">exemple</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function BeforeAfter() {
  return (
    <section aria-labelledby="avant-title" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:py-28">
      <div className="flex max-w-3xl flex-col gap-3">
        <Eyebrow>Avant / avec Maketia</Eyebrow>
        <SectionTitle id="avant-title">
          Vendre sur WhatsApp, tu connais. <span className={serif}>Voilà la différence.</span>
        </SectionTitle>
      </div>
      <div className="reveal mt-10 grid overflow-hidden rounded-[24px] border border-border md:grid-cols-2">
        <div className="bg-surface-sunken p-6 sm:p-8">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-muted">
            <span className="grid size-6 place-items-center rounded-full bg-fg/10 text-[13px]" aria-hidden="true">✕</span>
            Aujourd’hui, à la main
          </h3>
          <ul className="mt-5 flex flex-col gap-4 text-[15px] text-fg/75">
            {BEFORE_AFTER.map(([before]) => <li key={before}>{before}</li>)}
          </ul>
        </div>
        <div className="bg-accent/[0.08] p-6 sm:p-8 dark:bg-accent/15">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold">
            <span className="grid size-6 place-items-center rounded-full bg-accent text-[13px] text-accent-fg" aria-hidden="true">✓</span>
            Avec Maketia
          </h3>
          <ul className="mt-5 flex flex-col gap-4 text-[15px] font-medium">
            {BEFORE_AFTER.map(([, after]) => <li key={after}>{after}</li>)}
          </ul>
        </div>
      </div>
      <p className="mt-5 text-[15px] text-muted">Tu gardes WhatsApp pour discuter. Maketia présente, encaisse sur ton compte et remet le fichier proprement.</p>
    </section>
  );
}

/** Four steps on a timeline inside the night panel, with the honest note about confirmation. */
function Journey() {
  return (
    <section id="comment" aria-labelledby="comment-title" className="scroll-mt-16 px-3 pb-16 sm:px-6 lg:pb-24">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-night px-5 py-14 text-white ring-1 ring-white/10 sm:px-10 lg:px-14 lg:py-20">
        <div aria-hidden="true" className="pointer-events-none absolute -top-40 right-[-10%] hidden size-[460px] rounded-full bg-[#1d5bd8]/40 blur-[100px] lg:block" />
        <div className="relative flex flex-col gap-3">
          <Eyebrow dark>Comment ça marche</Eyebrow>
          <SectionTitle id="comment-title">
            De ton fichier à ta première vente, <span className={`text-sky-300 ${serif}`}>en 4 étapes.</span>
          </SectionTitle>
        </div>
        <ol className="relative mt-12 grid gap-8 border-l border-white/15 pl-6 lg:grid-cols-4 lg:gap-6 lg:border-t lg:border-l-0 lg:pt-8 lg:pl-0">
          {STEPS.map((s, i) => (
            <li key={s.title} className="reveal relative flex flex-col gap-2">
              <span className="absolute top-0.5 -left-[37px] grid size-6 place-items-center rounded-full bg-sky-300 font-mono text-[12px] font-semibold text-[#0c1630] lg:-top-[45px] lg:left-0">
                {i + 1}
              </span>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="text-[15px] text-white/75">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="relative mt-12 rounded-2xl border border-white/15 bg-white/[0.05] p-5 text-[15px] text-white/85">
          <strong className="font-semibold text-white">Aujourd’hui, c’est toi qui confirmes chaque paiement.</strong> C’est voulu : aucun fichier ne
          part sur une simple capture d’écran ou un faux retour de paiement. La confirmation automatique arrivera quand les notifications SasPay
          pourront être vérifiées de façon fiable.
        </div>
        <div className="relative mt-8">
          <Link href="/inscription" className={ctaOnNight}>
            Créer ma page gratuitement <Arrow />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** The buyer's side, from the click to the download (illustrations). */
function BuyerView() {
  const phones = [
    {
      label: "1. Ta page",
      body: (
        <>
          <BookCover className="mx-auto w-16" />
          <p className="text-center text-[12px] leading-tight font-semibold">Vendre en ligne sans y passer tes nuits</p>
          <p className="text-center text-[13px] font-semibold tabular-nums">5 000 FCFA</p>
          <span className="rounded-full bg-[#1d5bd8] py-1.5 text-center text-[11px] font-medium text-white">Acheter</span>
        </>
      ),
    },
    {
      label: "2. Le paiement SasPay",
      body: (
        <>
          <p className="text-center text-[11px] text-[#6b6862]">Paiement par</p>
          <p className="text-center text-[15px] font-semibold">SasPay</p>
          <div className="flex flex-col gap-1.5 rounded-lg border border-[#e3e0d9] p-2">
            <span className="h-2 w-2/3 rounded bg-[#e3e0d9]" />
            <span className="h-6 rounded bg-[#f0eee9]" />
            <span className="h-6 rounded bg-[#f0eee9]" />
          </div>
          <span className="rounded-full bg-[#1c1b19] py-1.5 text-center text-[11px] font-medium text-white">Payer 5 000 FCFA</span>
        </>
      ),
    },
    {
      label: "3. Son lien, sur WhatsApp",
      body: (
        <div className="flex flex-col gap-1.5 rounded-xl bg-[#e7f6e7] p-2 text-[10.5px] leading-snug text-[#14301c]">
          <p>Bonjour Awa,</p>
          <p>merci pour votre achat. Voici votre lien de téléchargement (valable 7 jours) :</p>
          <p className="break-all text-[#1d5bd8] underline">…/telechargement/aB3x…</p>
        </div>
      ),
    },
  ];
  return (
    <section id="client" aria-labelledby="client-title" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16 sm:px-6 lg:py-24">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
        <Eyebrow>Ce que vit ton client</Eyebrow>
        <SectionTitle id="client-title">
          Du clic au téléchargement, <span className={serif}>tout est clair.</span>
        </SectionTitle>
      </div>
      <ol tabIndex={0} aria-label="Les trois étapes de ton client, à faire défiler" className="-mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:mt-12 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]">
        {phones.map((p, i) => (
          <li key={p.label} className="reveal flex shrink-0 snap-center flex-col items-center gap-4">
            <div className={`w-[190px] rounded-[26px] border-[5px] border-[#0c1630] bg-white p-3 shadow-[0_24px_48px_-20px_rgb(12_22_48/0.5)] dark:border-white/20 ${i === 1 ? "sm:-translate-y-4" : ""}`} aria-hidden="true">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#e3e0d9]" />
              <div className="flex min-h-[200px] flex-col justify-center gap-2 text-[#1c1b19]">{p.body}</div>
            </div>
            <p className="text-[15px] font-semibold">{p.label}</p>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-center text-[13px] text-muted">Illustrations. L’écran de paiement est celui de SasPay et peut différer.</p>
    </section>
  );
}

function Features() {
  return (
    <section aria-labelledby="features-title" className="border-y border-border bg-surface-sunken">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:py-28">
        <div className="flex max-w-2xl flex-col gap-3">
          <Eyebrow>Tout ce qu’il faut</Eyebrow>
          <SectionTitle id="features-title">
            Pour vendre un fichier, <span className={serif}>rien de plus.</span>
          </SectionTitle>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className={`reveal flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-6 shadow-raised ${f.wide ? "lg:col-span-2" : ""}`}>
              <span className={`grid size-11 place-items-center rounded-xl ${f.tint}`} aria-hidden="true">
                {ICONS[f.icon]}
              </span>
              <h3 className="text-[17px] font-semibold">{f.title}</h3>
              <p className="text-[15px] text-muted">{f.text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-[15px] text-muted">
          Pour aller plus loin : tests A/B entre deux versions de ta page, et connexion de ton propre assistant IA, avec ton accord avant toute
          publication.
        </p>
      </div>
    </section>
  );
}

function ForWho() {
  const yes = [
    "Tu vends, ou veux vendre, un e-book, une formation, des templates, un pack audio ou vidéo.",
    "Tu encaisses en FCFA et tu as, ou peux ouvrir, un compte SasPay.",
    "Tu en as assez de répéter les mêmes infos en message privé.",
    "Tu veux une page qui inspire confiance sans payer un développeur.",
  ];
  const notYet = [
    "Tu vends des produits physiques à livrer.",
    "Tu veux que tout se fasse seul, sans jamais confirmer un paiement : la confirmation est manuelle pour l’instant.",
    "Tu dois encaisser hors SasPay.",
  ];
  return (
    <section aria-labelledby="pourqui-title" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:py-28">
      <SectionTitle id="pourqui-title" className="max-w-2xl">
        Maketia est fait pour toi <span className={serif}>si…</span>
      </SectionTitle>
      <div className="mt-10 grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="reveal rounded-[20px] border border-border bg-surface p-6 shadow-raised sm:p-8">
          <h3 className="text-[15px] font-semibold text-emerald-700 dark:text-emerald-300">Oui, si</h3>
          <ul className="mt-4 flex flex-col gap-3 text-[15px]">
            {yes.map((t) => <li key={t} className="flex gap-2.5"><Check className="mt-0.5 shrink-0" /> {t}</li>)}
          </ul>
        </div>
        <div className="reveal rounded-[20px] border border-dashed border-border-strong p-6 sm:p-8">
          <h3 className="text-[15px] font-semibold text-muted">Pas encore, si</h3>
          <ul className="mt-4 flex flex-col gap-3 text-[15px] text-fg/75">
            {notYet.map((t) => <li key={t} className="flex gap-2.5"><span aria-hidden="true" className="text-muted">–</span> {t}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

type PlanRow = Awaited<ReturnType<typeof listActivePlans>>[number];

/** "0 %" is the most selling true fact: it gets the page's big typographic moment (GAZU). */
function Pricing({ plans }: { plans: PlanRow[] }) {
  // Only plans whose price is set are shown; a "to be defined" card sells nothing.
  const priced = plans.filter((p) => p.priceMonthly !== null);
  return (
    <section id="tarifs" aria-labelledby="tarifs-title" className="scroll-mt-16 px-3 pb-16 sm:px-6 lg:pb-24">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-night px-5 py-14 text-white ring-1 ring-white/10 sm:px-10 lg:px-14 lg:py-20">
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 left-[-10%] hidden size-[460px] rounded-full bg-[#1d5bd8]/40 blur-[100px] lg:block" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[auto_1fr] lg:gap-14">
          <p className="reveal font-serif text-[7rem] leading-none text-sky-300 italic sm:text-[10rem]" aria-hidden="true">0 %</p>
          <div className="flex flex-col gap-4">
            <Eyebrow dark>Tarifs</Eyebrow>
            <h2 id="tarifs-title" className="reveal text-[2rem] leading-[1.08] font-semibold tracking-[-0.025em] text-balance sm:text-[2.6rem]">
              0 % de commission. <span className={`text-sky-300 ${serif}`}>Tes ventes restent à toi.</span>
            </h2>
            <p className="max-w-xl text-[15px] text-white/75">
              Tu paies l’outil, jamais un pourcentage sur tes ventes. Que tu vendes 1 ou 1 000 e-books, Maketia ne prend rien dessus (seuls les frais de
              ton service de paiement SasPay s’appliquent). Commence gratuitement, sans carte bancaire.
            </p>
            <div>
              <Link href="/inscription" className={ctaOnNight}>
                Commencer gratuitement <Arrow />
              </Link>
            </div>
          </div>
        </div>
        {priced.length > 0 && (
          <ul className="relative mt-12 grid gap-3 md:grid-cols-3">
            {priced.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 rounded-2xl border border-white/15 bg-white/[0.05] p-5">
                <h3 className="font-semibold">{p.name}</h3>
                <p className="text-2xl font-semibold tracking-tight tabular-nums">{planPrice(p)}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="relative mt-8 text-[13px] text-white/70">
          {priced.length > 0
            ? "Le paiement en ligne des abonnements n’est pas encore ouvert : les plans payants sont activés par l’équipe Maketia."
            : "Les prix des plans payants seront affichés ici à leur ouverture."}
        </p>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.5fr] lg:py-24">
        <div className="flex flex-col gap-3">
          <Eyebrow>Questions fréquentes</Eyebrow>
          <SectionTitle id="faq-title">
            Ce que tu te demandes <span className={serif}>sûrement.</span>
          </SectionTitle>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {FAQ.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[16px] font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted transition-transform duration-200 ease-[var(--ease-out)] group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="pb-5 text-[15px] leading-relaxed text-fg/75 text-pretty">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Closing call, with the oversized wordmark bleeding off the bottom (GAZU). */
function FinalCall() {
  return (
    <section aria-labelledby="final-title" className="relative overflow-hidden bg-night pb-20 text-white sm:pb-0">
      <div aria-hidden="true" className="pointer-events-none absolute top-[-30%] left-1/2 hidden size-[640px] -translate-x-1/2 rounded-full bg-[#1d5bd8]/35 blur-[110px] lg:block" />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 pt-24 pb-8 text-center sm:px-6">
        <h2 id="final-title" className="reveal text-[2.4rem] leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-6xl">
          Ton prochain client peut acheter <span className={`text-sky-300 ${serif}`}>ce soir.</span>
        </h2>
        <p className="max-w-md text-[15px] text-white/75">Crée ta page gratuitement, ajoute ton produit et publie quand elle te plaît.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/inscription" className={ctaOnNight}>
            Créer ma page gratuitement <Arrow />
          </Link>
          <Link href="/connexion" className={`pressable inline-flex h-12 items-center rounded-full border border-white/25 px-6 text-[15px] font-medium text-white [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10`}>
            J’ai déjà un compte
          </Link>
        </div>
      </div>
      <p aria-hidden="true" className="relative -mb-[0.2em] bg-gradient-to-b from-white/[0.16] to-transparent bg-clip-text text-center text-[27vw] leading-none font-semibold tracking-[-0.06em] text-transparent select-none">
        maketia.
      </p>
      <footer className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-[13px] text-white/70 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Maketia — pages de vente pour produits numériques.</p>
          <p>Paiements par lien SasPay, sur le compte du créateur.</p>
        </div>
      </footer>
    </section>
  );
}

function Arrow() {
  return <span aria-hidden="true">→</span>;
}

function Check({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`size-4 text-accent ${className}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const svg = (d: string) => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  blocks: svg("M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 16.5h7M16.5 13v7"),
  phone: svg("M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2"),
  card: svg("M3 6h18v12H3zM3 10h18M7 15h3"),
  lock: svg("M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 15v2"),
  globe: svg("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z"),
  chart: svg("M4 20V10M10 20V4M16 20v-7M22 20H2"),
  check: svg("m5 12.5 4.5 4.5L19 7"),
};
