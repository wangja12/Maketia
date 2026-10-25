import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { getDb } from "@/db";
import { count } from "@/lib/format";
import { listActivePlans, planPrice, QUOTA_LABELS, type QuotaKey } from "@/server/billing/plans";

export const metadata: Metadata = {
  title: "Maketia — ta page de vente, montée en dix minutes",
};

/*
 * Public landing page. Every claim matches what the product does today: delivery waits for a
 * confirmed payment, no AI model runs inside Maketia, prices come from the admin-edited plans.
 * Mock-ups are illustrations, labelled as such; their figures are not real data.
 */

const STEPS = [
  { title: "Produit", text: "Dépose le fichier, le prix et la devise." },
  { title: "Page", text: "Assemble les sections dans l’éditeur." },
  { title: "Publication", text: "La page est en ligne à son adresse, ou sur ton domaine." },
  { title: "Paiement", text: "Ton lien SasPay encaisse, sans intermédiaire." },
  { title: "Confirmation", text: "Le paiement est confirmé avant toute livraison." },
  { title: "Livraison", text: "L’acheteur reçoit un lien de téléchargement privé et limité." },
];

// Each feature gets its own tint, as in the reference designs; text stays in the ink colors.
const FEATURES: { title: string; text: string; icon: keyof typeof ICONS; tint: string }[] = [
  { title: "Éditeur par sections", text: "Accroche, bénéfices, contenu inclus, témoignages, prix, FAQ, appel à l’action. Tu réordonnes, tu modifies, tu publies.", icon: "blocks", tint: "bg-blue-500/10 text-blue-600 dark:text-blue-300" },
  { title: "Aperçu mobile réel", text: "La page se regarde d’abord sur téléphone, parce que c’est là que tes acheteurs arrivent.", icon: "phone", tint: "bg-violet-500/10 text-violet-600 dark:text-violet-300" },
  { title: "Paiement sur ton compte", text: "L’acheteur paie avec ton lien SasPay. Maketia ne touche jamais ton argent et ne demande jamais ta clé API.", icon: "card", tint: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { title: "Livraison après contrôle", text: "Aucun fichier n’est envoyé avant une confirmation fiable du paiement. Les cas douteux restent à rapprocher.", icon: "file", tint: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { title: "Tests A/B honnêtes", text: "Plusieurs variantes, répartition du trafic, et un avertissement clair quand l’échantillon est trop petit pour conclure.", icon: "flask", tint: "bg-rose-500/10 text-rose-600 dark:text-rose-300" },
  { title: "Agents IA, sous ton contrôle", text: "Claude ou un autre agent peut modifier tes pages via MCP. Publier reste ta décision : rien n’est en ligne sans ton accord.", icon: "plug", tint: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
];

const SECTION_FAMILIES = ["Accroche", "Bénéfices", "Contenu inclus", "Témoignages", "Prix", "FAQ", "Paiement"];

// What people sell with Maketia. Covers are drawn in CSS; titles are invented examples.
const SHOWCASE = [
  { kind: "E-book", title: "Vendre en ligne sans y passer tes nuits", meta: "PDF · 68 pages", cover: "from-[#0c1630] to-[#1d5bd8]", ink: "text-white" },
  { kind: "Formation", title: "Excel pour ton commerce, en 7 jours", meta: "12 vidéos", cover: "from-[#f6d7c3] to-[#f29d7a]", ink: "text-[#3b1d10]" },
  { kind: "Pack de templates", title: "30 visuels pour tes réseaux", meta: "Canva · PNG", cover: "from-[#1f3b2d] to-[#4f8a6b]", ink: "text-white" },
  { kind: "Guide gratuit", title: "La checklist du premier lancement", meta: "PDF · 6 pages", cover: "from-[#ece7ff] to-[#b9a8ff]", ink: "text-[#22164f]" },
  { kind: "Pack audio", title: "Méditations du matin", meta: "MP3 · 10 pistes", cover: "from-[#2b1240] to-[#d9467a]", ink: "text-white" },
];

const FAQ = [
  {
    q: "Maketia encaisse-t-il l’argent de mes ventes ?",
    a: "Non. L’acheteur paie avec ton lien de paiement SasPay, directement sur ton compte. Maketia ne prend aucun pourcentage et ne te demande jamais ta clé API SasPay.",
  },
  {
    q: "Quand l’acheteur reçoit-il son fichier ?",
    a: "Une fois le paiement confirmé, jamais avant. Aujourd’hui, tu confirmes le paiement reçu dans ton espace, et Maketia crée un lien de téléchargement privé, limité dans le temps et en nombre de téléchargements. Un retour sur une page de succès ne suffit pas à valider une vente.",
  },
  {
    q: "Faut-il savoir coder ?",
    a: "Non. Tu choisis un modèle, tu remplis les sections, tu vérifies l’aperçu sur téléphone et tu publies.",
  },
  {
    q: "Les agents IA sont-ils intégrés au produit ?",
    a: "Non, Maketia n’exécute aucun modèle d’IA. Tu peux connecter ton propre agent par MCP : il travaille avec tes droits, chaque modification devient une version que tu peux restaurer, et une publication demandée par un agent attend ton approbation.",
  },
  {
    q: "Puis-je utiliser mon propre domaine ?",
    a: "Oui. Tu ajoutes ton domaine, tu prouves qu’il t’appartient avec un enregistrement DNS, puis tes pages y sont servies. Le nombre de domaines dépend de ton plan.",
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
      <Header />
      <main>
        <Hero />
        <Showcase />
        <Journey />
        <Features />
        <EditorSection />
        <Pricing plans={plans} />
        <Faq />
        <FinalCall />
      </main>
    </div>
  );
}

const hover = "[@media(hover:hover)_and_(pointer:fine)]:hover";

function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      maketia<span className="text-accent">.</span>
    </span>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Maketia, accueil">
          <Logo className="text-xl" />
        </Link>
        <nav aria-label="Sections de la page" className="hidden items-center gap-7 text-sm text-muted md:flex">
          <a href="#parcours" className={`${hover}:text-fg`}>Le parcours</a>
          <a href="#editeur" className={`${hover}:text-fg`}>L’éditeur</a>
          <a href="#tarifs" className={`${hover}:text-fg`}>Tarifs</a>
          <a href="#faq" className={`${hover}:text-fg`}>FAQ</a>
        </nav>
        <div className="flex items-center gap-1">
          <Link href="/connexion" className={buttonClass("ghost", "hidden sm:inline-flex")}>
            Connexion
          </Link>
          <Link href="/inscription" className={buttonClass("primary", "h-10 rounded-full px-4")}>
            Commencer <Arrow />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative">
      {/* Soft color glow behind the mock-up (Enblox), plus a faint grid fading downward. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] opacity-50" />
        <div className="absolute top-24 right-[-10%] size-[520px] rounded-full bg-blue-500/25 blur-[110px] lg:right-[2%]" />
        <div className="absolute top-72 right-[20%] size-[300px] rounded-full bg-violet-400/20 blur-[100px]" />
      </div>
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pt-12 pb-20 sm:px-6 lg:grid-cols-[1fr_1.08fr] lg:pt-20 lg:pb-28">
        <div className="flex flex-col gap-6">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1 text-xs font-medium text-muted shadow-raised">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            Pour les créateurs de produits numériques
          </p>
          <h1 className="text-[2.7rem] leading-[1.02] font-semibold tracking-[-0.03em] text-balance sm:text-[4rem]">
            Ta page de vente, montée en{" "}
            <span className="font-serif text-[1.08em] font-normal tracking-normal text-accent italic">dix minutes.</span>
          </h1>
          <p className="max-w-xl text-base text-muted text-pretty sm:text-lg">
            E-books, formations, templates, packs : construis ta landing page, branche ton lien de paiement SasPay et
            laisse Maketia livrer le fichier après confirmation du paiement. Sans code, sans développeur.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/inscription" className={buttonClass("primary", "h-12 rounded-full px-6 text-[15px] shadow-[0_10px_24px_-10px_rgb(29_91_216/0.7)]")}>
              Créer ma première page <Arrow />
            </Link>
            <a href="#parcours" className={buttonClass("secondary", "h-12 rounded-full px-6 text-[15px]")}>
              Voir comment ça marche
            </a>
          </div>
          <ul className="mt-2 grid gap-3 text-sm text-muted sm:grid-cols-3">
            <li className="flex items-start gap-2"><Mini icon="spark" /> Aucune compétence technique</li>
            <li className="flex items-start gap-2"><Mini icon="shield" /> Paiement sur ton compte SasPay</li>
            <li className="flex items-start gap-2"><Mini icon="file" /> Livraison après confirmation</li>
          </ul>
        </div>
        <HeroMock />
      </div>
    </section>
  );
}

/** Editor window with an overlapping phone preview (NIVO). Illustration only. */
function HeroMock() {
  return (
    <figure className="relative mx-auto w-full max-w-[600px] pb-10 lg:mx-0" aria-label="Illustration de l’éditeur Maketia, avec l’aperçu mobile">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_40px_80px_-30px_rgb(12_22_48/0.45)]" aria-hidden="true">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </span>
          <Logo className="text-sm" />
          <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">Aperçu</span>
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-medium text-accent-fg">Publier</span>
        </div>
        <div className="grid grid-cols-[92px_1fr] sm:grid-cols-[118px_1fr]">
          <ul className="flex flex-col gap-1 border-r border-border bg-surface-sunken p-2 text-[10.5px] text-muted">
            <li className="px-2 pt-1 pb-1.5 text-[9.5px] font-semibold tracking-wider uppercase">Sections</li>
            {["Accroche", "Bénéfices", "Contenu", "Avis", "Prix", "FAQ"].map((s, i) => (
              <li key={s} className={`rounded-md px-2 py-1.5 ${i === 0 ? "bg-surface font-medium text-fg shadow-raised ring-1 ring-accent/40" : ""}`}>{s}</li>
            ))}
          </ul>
          <div className="flex items-center gap-4 p-4 sm:p-6">
            <div className="flex min-w-0 flex-1 flex-col gap-2.5 sm:pr-32">
              <p className="text-[9.5px] font-semibold tracking-[0.14em] text-accent uppercase">Guide PDF · 68 pages</p>
              <p className="text-[15px] leading-tight font-semibold tracking-tight sm:text-lg">Vendre en ligne sans y passer tes nuits.</p>
              <p className="text-[11px] text-muted">La méthode complète pour lancer ta première offre.</p>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-accent px-3 py-1.5 text-[10.5px] font-medium text-accent-fg">Obtenir le guide</span>
                <span className="text-[11px] font-semibold">9 900 FCFA</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Phone preview, overlapping the window's corner. */}
      <div className="absolute right-[-6px] bottom-0 hidden w-[132px] sm:block rounded-[26px] border-[5px] border-[#0c1630] bg-surface p-2 shadow-[0_30px_60px_-20px_rgb(12_22_48/0.55)] sm:right-[-26px] sm:w-[150px]" aria-hidden="true">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
        <BookCover className="mx-auto w-16" />
        <p className="mt-2 text-center text-[10px] leading-tight font-semibold">Vendre en ligne sans y passer tes nuits.</p>
        <span className="mt-2 block rounded-full bg-accent py-1 text-center text-[9px] font-medium text-accent-fg">Obtenir le guide</span>
        <p className="mt-1.5 text-center text-[8.5px] text-muted">Paiement sécurisé SasPay</p>
      </div>
      <div className="absolute bottom-3 left-[-8px] rounded-xl border border-border bg-surface px-3 py-2 shadow-[0_16px_36px_-14px_rgb(12_22_48/0.4)] sm:left-[-28px]" aria-hidden="true">
        <p className="text-[9.5px] tracking-wider text-muted uppercase">Conversion</p>
        <p className="text-lg font-semibold tabular-nums">4,8 %</p>
      </div>
      <figcaption className="absolute -bottom-6 left-0 text-[11px] text-muted">Illustration — chiffres d’exemple.</figcaption>
    </figure>
  );
}

function BookCover({ className = "" }: { className?: string }) {
  return (
    <div className={`relative aspect-[3/4] overflow-hidden rounded-[4px] bg-gradient-to-b from-[#0c1630] to-[#1d5bd8] shadow-[6px_8px_18px_-6px_rgb(12_22_48/0.6)] ${className}`}>
      <span className="absolute top-2 left-2 text-[7px] font-semibold tracking-wider text-white/70 uppercase">Guide</span>
      <span className="absolute top-5 left-2 right-2 text-[9px] leading-tight font-semibold text-white">Vendre en ligne</span>
      <svg viewBox="0 0 60 30" className="absolute bottom-0 w-full text-white/85" fill="currentColor">
        <path d="M0 30 18 10l8 8 10-14 24 26z" />
      </svg>
    </div>
  );
}

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return <p className={`text-xs font-semibold tracking-[0.16em] uppercase ${dark ? "text-sky-300" : "text-accent"}`}>{children}</p>;
}

/** What people sell with Maketia (Kit créateur's template strip). Scrolls sideways on phones. */
function Showcase() {
  return (
    <section aria-labelledby="showcase-title" className="border-y border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[280px_1fr] lg:items-center">
        <div className="flex flex-col gap-2">
          <Eyebrow>Ce que tu peux vendre</Eyebrow>
          <h2 id="showcase-title" className="text-2xl font-semibold tracking-tight text-balance">
            Un fichier, une page, <span className="font-serif text-[1.1em] font-normal italic">une vente.</span>
          </h2>
          <p className="text-sm text-muted">Exemples de produits. Couvertures et titres inventés pour l’illustration.</p>
        </div>
        <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:grid lg:grid-cols-5 lg:overflow-visible">
          {SHOWCASE.map((p) => (
            <li key={p.title} className="w-40 shrink-0 snap-start lg:w-auto">
              <div className={`flex aspect-[3/4] flex-col justify-between rounded-xl bg-gradient-to-br p-3.5 shadow-[0_14px_30px_-16px_rgb(12_22_48/0.5)] ${p.cover} ${p.ink}`}>
                <span className="text-[10px] font-semibold tracking-wider uppercase opacity-80">{p.kind}</span>
                <span className="text-[15px] leading-tight font-semibold">{p.title}</span>
                <span className="text-[10px] opacity-75">{p.meta}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The six steps, in a rounded night panel (PlutoPay). */
function Journey() {
  return (
    <section id="parcours" aria-labelledby="parcours-title" className="scroll-mt-16 px-3 py-16 sm:px-6 lg:py-24">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-night px-5 py-14 text-white sm:px-10 lg:px-14 lg:py-20">
        <div aria-hidden="true" className="pointer-events-none absolute -top-40 right-[-10%] size-[520px] rounded-full bg-[#1d5bd8]/45 blur-[120px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/2 size-[640px] -translate-x-1/2 rounded-full border border-white/5" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3">
            <Eyebrow dark>Le parcours</Eyebrow>
            <h2 id="parcours-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-[2.75rem] sm:leading-[1.1]">
              De l’idée au fichier livré, <span className="font-serif font-normal text-sky-300 italic">six étapes.</span>
            </h2>
          </div>
          <p className="max-w-xs text-sm text-white/65">
            Chaque étape est visible dans ton espace. Rien n’est présenté comme fait tant que ce n’est pas configuré.
          </p>
        </div>
        <ol className="relative mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <span className="font-mono text-xs text-sky-300 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="text-sm text-white/65">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section aria-labelledby="features-title" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:pb-28">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
        <Eyebrow>Tout ce dont tu as besoin</Eyebrow>
        <h2 id="features-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-[2.75rem] sm:leading-[1.1]">
          Tout ce qu’il faut pour vendre un fichier, <span className="font-serif font-normal italic">rien de plus.</span>
        </h2>
      </div>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <li key={f.title} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6 shadow-raised">
            <span className={`grid size-10 place-items-center rounded-xl ${f.tint}`} aria-hidden="true">
              {ICONS[f.icon]}
            </span>
            <h3 className="font-semibold">{f.title}</h3>
            <p className="text-sm text-muted">{f.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EditorSection() {
  return (
    <section id="editeur" aria-labelledby="editeur-title" className="scroll-mt-16 border-y border-border bg-surface">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-24">
        <div className="flex flex-col gap-4">
          <Eyebrow>L’éditeur</Eyebrow>
          <h2 id="editeur-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-[2.75rem] sm:leading-[1.1]">
            Un éditeur manuel, <span className="font-serif font-normal italic">pas une boîte noire.</span>
          </h2>
          <p className="text-muted text-pretty">
            Pas de génération automatique, pas de prompt à écrire. Tu ajoutes une section, tu la remplis, tu la déplaces.
            Ce que tu vois est ce que l’acheteur verra.
          </p>
          <ul className="flex flex-col gap-2.5 text-sm">
            {[
              "Sections prêtes à remplir : bénéfices, produit, contenu, avis, FAQ, paiement",
              "Aperçu ordinateur et mobile en un clic",
              "Chaque modification crée une version que tu peux restaurer",
              "Une revue avant publication : rien ne part en ligne par accident",
            ].map((t) => (
              <li key={t} className="flex gap-2.5"><Check className="mt-0.5 shrink-0" /> {t}</li>
            ))}
          </ul>
          <Link href="/inscription" className={`mt-2 w-fit text-sm font-medium text-accent ${hover}:underline`}>
            Ouvrir mon espace <span aria-hidden="true">→</span>
          </Link>
        </div>
        <ol className="flex flex-col gap-2" aria-label="Exemple d’ordre des sections">
          {SECTION_FAMILIES.map((s, i) => (
            <li key={s} className={`flex items-center gap-3 rounded-xl border bg-bg px-4 py-3 text-sm ${i === 1 ? "border-accent/50 shadow-[0_10px_24px_-14px_rgb(29_91_216/0.6)] sm:translate-x-3" : "border-border"}`}>
              <span className="font-mono text-xs text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-medium">{s}</span>
              <span className="ml-auto text-muted" aria-hidden="true">⋮⋮</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

type PlanRow = Awaited<ReturnType<typeof listActivePlans>>[number];

function Pricing({ plans }: { plans: PlanRow[] }) {
  const highlighted = plans.length > 2 ? plans[1].id : null;
  return (
    <section id="tarifs" aria-labelledby="tarifs-title" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 sm:px-6 lg:py-28">
      <div className="flex max-w-2xl flex-col gap-3">
        <Eyebrow>Tarifs</Eyebrow>
        <h2 id="tarifs-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-[2.75rem] sm:leading-[1.1]">
          Un abonnement pour l’outil. <span className="font-serif font-normal italic">Tes ventes restent à toi.</span>
        </h2>
        <p className="text-muted">
          Maketia ne prend aucun pourcentage sur tes ventes : les paiements arrivent directement sur ton compte SasPay.
        </p>
      </div>
      {plans.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-border bg-surface p-6 text-sm text-muted">Les tarifs seront publiés ici prochainement.</p>
      ) : (
        <ul className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => {
            const top = p.id === highlighted;
            return (
              <li key={p.id} className={`relative flex flex-col gap-4 rounded-2xl border bg-surface p-6 ${top ? "border-accent shadow-[0_20px_50px_-24px_rgb(29_91_216/0.5)]" : "border-border shadow-raised"}`}>
                {top && <span className="absolute -top-3 left-6 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-accent-fg">Le plus choisi</span>}
                <h3 className="font-semibold">{p.name}</h3>
                <p className="text-2xl font-semibold tracking-tight">{planPrice(p)}</p>
                <ul className="flex flex-col gap-1.5 text-sm text-muted">
                  {(Object.keys(QUOTA_LABELS) as QuotaKey[]).map((k) => (
                    <li key={k} className="flex gap-2">
                      <Check className="mt-0.5 shrink-0" />
                      {QUOTA_LABELS[k]} : {p.limits[k] === null || p.limits[k] === undefined ? "illimité" : count(p.limits[k]!)}
                    </li>
                  ))}
                </ul>
                <Link href="/inscription" className={buttonClass(top ? "primary" : "secondary", "mt-auto rounded-full")}>
                  Commencer
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-6 text-xs text-muted">
        Le paiement en ligne des abonnements n’est pas encore ouvert : les plans payants sont activés par l’équipe Maketia.
      </p>
    </section>
  );
}

/** Heading on the left, questions on the right (Kit créateur). */
function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16 border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.5fr] lg:py-24">
        <div className="flex flex-col gap-3">
          <Eyebrow>FAQ</Eyebrow>
          <h2 id="faq-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-[2.75rem] sm:leading-[1.1]">
            Les questions qu’on nous pose <span className="font-serif font-normal italic">vraiment.</span>
          </h2>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {FAQ.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-muted transition-transform duration-200 ease-[var(--ease-out)] group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="pb-5 text-sm text-muted text-pretty">{item.a}</p>
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
    <section aria-labelledby="final-title" className="relative overflow-hidden bg-night text-white">
      <div aria-hidden="true" className="pointer-events-none absolute top-[-30%] left-1/2 size-[700px] -translate-x-1/2 rounded-full bg-[#1d5bd8]/35 blur-[140px]" />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 pt-24 pb-10 text-center sm:px-6">
        <h2 id="final-title" className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Ta première page est à <span className="font-serif font-normal text-sky-300 italic">dix minutes</span> d’ici.
        </h2>
        <p className="max-w-md text-white/65">Crée ton espace, ajoute ton produit et publie ta page quand elle te plaît.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/inscription" className={buttonClass("primary", "h-12 rounded-full px-6 text-[15px]")}>
            Créer mon compte <Arrow />
          </Link>
          <Link href="/connexion" className={`pressable inline-flex h-12 items-center rounded-full border border-white/20 px-6 text-[15px] font-medium text-white ${hover}:bg-white/10`}>
            Connexion
          </Link>
        </div>
      </div>
      <p aria-hidden="true" className="relative -mb-[0.22em] text-center text-[25vw] leading-none font-semibold tracking-[-0.06em] text-white/[0.06] select-none">
        maketia.
      </p>
      <footer className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Maketia — pages de vente pour produits numériques.</p>
          <p>Paiements par lien SasPay, sur le compte du vendeur.</p>
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

function Mini({ icon }: { icon: keyof typeof ICONS }) {
  return <span className="mt-[-1px] shrink-0 text-accent [&_svg]:size-[17px]" aria-hidden="true">{ICONS[icon]}</span>;
}

const svg = (d: string) => (
  <svg viewBox="0 0 24 24" className="size-[19px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  blocks: svg("M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 16.5h7M16.5 13v7"),
  phone: svg("M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2"),
  card: svg("M3 6h18v12H3zM3 10h18M7 15h3"),
  file: svg("M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zM14 3v4h4M12 11v6M9.5 14.5 12 17l2.5-2.5"),
  flask: svg("M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3M7.5 15h9"),
  plug: svg("M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"),
  shield: svg("M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6zM9 12l2 2 4-4"),
  spark: svg("M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"),
};
