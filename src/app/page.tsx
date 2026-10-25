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
 * The editor mock-up is labelled as an example; its figures are not real data.
 */

const STEPS = [
  { title: "Produit", text: "Dépose le fichier, le prix et la devise." },
  { title: "Page", text: "Assemble les sections dans l’éditeur." },
  { title: "Publication", text: "La page est en ligne à son adresse, ou sur ton domaine." },
  { title: "Paiement", text: "Ton lien SasPay encaisse, sans intermédiaire." },
  { title: "Confirmation", text: "Le paiement est confirmé avant toute livraison." },
  { title: "Livraison", text: "L’acheteur reçoit un lien de téléchargement privé et limité." },
];

const FEATURES: { title: string; text: string; icon: keyof typeof ICONS }[] = [
  { title: "Éditeur par sections", text: "Accroche, bénéfices, contenu inclus, témoignages, prix, FAQ, appel à l’action. Tu réordonnes, tu modifies, tu publies.", icon: "blocks" },
  { title: "Aperçu mobile réel", text: "La page se regarde d’abord sur téléphone, parce que c’est là que tes acheteurs arrivent.", icon: "phone" },
  { title: "Ton lien SasPay", text: "L’acheteur paie sur ton compte. Maketia ne touche jamais ton argent et ne demande jamais ta clé API.", icon: "card" },
  { title: "Livraison après contrôle", text: "Aucun fichier n’est envoyé avant une confirmation fiable du paiement. Les cas douteux restent à rapprocher.", icon: "file" },
  { title: "Tests A/B honnêtes", text: "Plusieurs variantes, répartition du trafic, et un avertissement clair quand l’échantillon est trop petit pour conclure.", icon: "flask" },
  { title: "Agents IA, sous ton contrôle", text: "Claude ou un autre agent peut modifier tes pages via MCP. Publier reste ta décision : rien n’est en ligne sans ton accord.", icon: "plug" },
];

const SECTION_FAMILIES = ["Accroche", "Bénéfices", "Contenu inclus", "Témoignages", "Prix", "FAQ", "Paiement"];

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
    <div className="bg-bg text-fg">
      <Header />
      <main>
        <Hero />
        <Journey />
        <Features />
        <EditorSection />
        <Pricing plans={plans} />
        <Faq />
        <FinalCall />
      </main>
      <footer className="bg-night text-white/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Maketia — pages de vente pour produits numériques.</p>
          <p>Paiements par lien SasPay, sur le compte du vendeur.</p>
        </div>
      </footer>
    </div>
  );
}

function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`text-lg font-semibold tracking-tight ${className}`}>
      maketia<span className="text-accent">.</span>
    </span>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Maketia, accueil">
          <Logo />
        </Link>
        <nav aria-label="Sections de la page" className="hidden items-center gap-6 text-sm text-muted md:flex">
          <a href="#parcours" className="hover:text-fg">Le parcours</a>
          <a href="#editeur" className="hover:text-fg">L’éditeur</a>
          <a href="#tarifs" className="hover:text-fg">Tarifs</a>
          <a href="#faq" className="hover:text-fg">FAQ</a>
        </nav>
        <div className="flex items-center gap-1">
          <Link href="/connexion" className={buttonClass("ghost", "hidden sm:inline-flex")}>
            Se connecter
          </Link>
          <Link href="/inscription" className={buttonClass("primary")}>
            Créer ma page <Arrow />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Faint grid, fading out toward the bottom. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)] opacity-60"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24 lg:pb-28">
        <div className="flex flex-col gap-6">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase shadow-raised">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Pour créateurs de produits numériques
          </p>
          <h1 className="text-[2.6rem] leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
            Ta page de vente, montée en dix minutes.
          </h1>
          <p className="max-w-xl text-base text-muted text-pretty sm:text-lg">
            E-books, formations, templates, packs : construis ta landing page, branche ton lien de paiement SasPay et
            laisse Maketia livrer le fichier après confirmation du paiement. Sans code, sans développeur.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/inscription" className={buttonClass("primary", "h-11 px-5 text-[15px]")}>
              Créer ma première page <Arrow />
            </Link>
            <a href="#parcours" className={buttonClass("secondary", "h-11 px-5 text-[15px]")}>
              Voir le parcours
            </a>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
            <li className="flex items-center gap-1.5"><Check /> Paiement sur ton compte SasPay</li>
            <li className="flex items-center gap-1.5"><Check /> Aucune compétence technique</li>
            <li className="flex items-center gap-1.5"><Check /> {SECTION_FAMILIES.length} familles de sections</li>
          </ul>
        </div>
        <EditorMock />
      </div>
    </section>
  );
}

/** Static illustration of the editor. Labelled as an example: none of these figures are real. */
function EditorMock() {
  return (
    <figure className="relative mx-auto w-full max-w-xl lg:mx-0" aria-label="Exemple d’éditeur Maketia (illustration)">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_60px_-20px_rgb(12_22_48/0.35)]">
        <div className="flex items-center justify-between bg-night px-4 py-2.5 text-[11px] text-white/80">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2 rounded-full bg-white/25" />
            <span className="size-2 rounded-full bg-white/25" />
            <span className="size-2 rounded-full bg-white/25" />
          </span>
          <span>Éditeur · Guide Vendre en ligne</span>
          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-semibold text-emerald-300">Publiée</span>
        </div>
        <div className="grid grid-cols-[96px_1fr] sm:grid-cols-[120px_1fr]">
          <ul className="flex flex-col gap-1 border-r border-border bg-surface-sunken p-2 text-[11px] text-muted" aria-hidden="true">
            <li className="px-2 pt-1 pb-1.5 text-[10px] tracking-wide uppercase">Sections</li>
            {["Accroche", "Bénéfices", "Produit", "Témoignages", "FAQ"].map((s, i) => (
              <li key={s} className={`rounded-md px-2 py-1.5 ${i === 0 ? "bg-surface font-medium text-fg shadow-raised" : ""}`}>{s}</li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 p-4 sm:p-5" aria-hidden="true">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-accent uppercase">Guide PDF · 68 pages</p>
            <p className="text-lg leading-tight font-semibold tracking-tight sm:text-xl">Vendre en ligne sans y passer tes nuits.</p>
            <p className="text-xs text-muted">La méthode complète pour lancer ta première offre numérique.</p>
            <span className="w-fit rounded-md bg-accent px-3 py-1.5 text-[11px] font-medium text-accent-fg">Obtenir le guide →</span>
            <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border pt-3 text-[10px] text-muted">
              {["Offre", "Paiement", "Livraison"].map((s) => (
                <div key={s} className="flex flex-col gap-1">
                  <span className="h-1 w-6 rounded-full bg-accent/70" />
                  {s}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-3 rounded-xl border border-border bg-surface px-3 py-2 shadow-[0_12px_30px_-12px_rgb(12_22_48/0.35)] sm:-left-6" aria-hidden="true">
        <p className="text-[10px] tracking-wide text-muted uppercase">Conversion</p>
        <p className="text-xl font-semibold tabular-nums">4,8 %</p>
        <p className="text-[10px] text-muted">mesurée sur tes visites</p>
      </div>
      <figcaption className="mt-8 text-right text-[11px] text-muted">Illustration — chiffres d’exemple.</figcaption>
    </figure>
  );
}

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return <p className={`text-xs font-semibold tracking-[0.14em] uppercase ${dark ? "text-sky-300" : "text-accent"}`}>{children}</p>;
}

function Journey() {
  return (
    <section id="parcours" aria-labelledby="parcours-title" className="scroll-mt-14 bg-night bg-[radial-gradient(ellipse_at_top_right,var(--night-2),transparent_60%)] text-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3">
            <Eyebrow dark>Le parcours</Eyebrow>
            <h2 id="parcours-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              De l’idée au fichier livré, six étapes.
            </h2>
          </div>
          <p className="max-w-xs text-sm text-white/65">
            Chaque étape est visible dans ton espace. Rien n’est présenté comme fait tant que ce n’est pas configuré.
          </p>
        </div>
        <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-2 border-t border-white/15 pt-5">
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
    <section aria-labelledby="features-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      <div className="flex max-w-2xl flex-col gap-3">
        <Eyebrow>Fonctionnalités</Eyebrow>
        <h2 id="features-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Tout ce qu’il faut pour vendre un fichier, rien de plus.
        </h2>
      </div>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <li key={f.title} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6 shadow-raised">
            <span className="grid size-9 place-items-center rounded-lg bg-accent/10 text-accent" aria-hidden="true">
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
    <section id="editeur" aria-labelledby="editeur-title" className="scroll-mt-14 border-y border-border bg-surface">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-24">
        <div className="flex flex-col gap-4">
          <Eyebrow>L’éditeur</Eyebrow>
          <h2 id="editeur-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Un éditeur manuel, pas une boîte noire.
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
          <Link href="/inscription" className="mt-2 w-fit text-sm font-medium text-accent hover:underline">
            Ouvrir mon espace <span aria-hidden="true">→</span>
          </Link>
        </div>
        <ol className="flex flex-col gap-2" aria-label="Exemple d’ordre des sections">
          {SECTION_FAMILIES.map((s, i) => (
            <li key={s} className="flex items-center gap-3 rounded-xl border border-border bg-bg px-4 py-3 text-sm">
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
    <section id="tarifs" aria-labelledby="tarifs-title" className="mx-auto max-w-6xl scroll-mt-14 px-4 py-20 sm:px-6 lg:py-28">
      <div className="flex max-w-2xl flex-col gap-3">
        <Eyebrow>Tarifs</Eyebrow>
        <h2 id="tarifs-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Un abonnement pour l’outil. Tes ventes restent à toi.
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
                <Link href="/inscription" className={buttonClass(top ? "primary" : "secondary", "mt-auto")}>
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

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-14 border-t border-border">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:py-24">
        <Eyebrow>FAQ</Eyebrow>
        <h2 id="faq-title" className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Les questions qu’on nous pose vraiment.
        </h2>
        <div className="mt-10 divide-y divide-border border-y border-border">
          {FAQ.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="text-xl leading-none text-muted transition-transform duration-200 ease-[var(--ease-out)] group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="pb-5 text-sm text-muted text-pretty">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCall() {
  return (
    <section aria-labelledby="final-title" className="bg-night bg-[radial-gradient(ellipse_at_bottom,var(--night-2),transparent_70%)] text-white">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 py-24 text-center sm:px-6">
        <h2 id="final-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
          Ta première page est à dix minutes d’ici.
        </h2>
        <p className="max-w-md text-white/65">Crée ton espace, ajoute ton produit et publie ta page quand elle te plaît.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/inscription" className={buttonClass("primary", "h-11 px-5 text-[15px]")}>
            Créer mon compte <Arrow />
          </Link>
          <Link href="/connexion" className="pressable inline-flex h-11 items-center rounded-control border border-white/20 px-5 text-[15px] font-medium text-white [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10">
            Se connecter
          </Link>
        </div>
      </div>
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
  <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
};
