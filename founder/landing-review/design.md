# Revue design (séduction visuelle)
Note: 6,5/10 | Verdict: VALIDÉ SI

Base propre, honnête et cohérente. Elle a le niveau d'un bon template SaaS 2024, mais pas celui d'une page dont on se souvient. Le hero tient. À partir de la section 3, la page retombe dans la grille de cartes identiques. La section Tarifs, avec une seule carte « Tarif à définir », casse la confiance au pire endroit.

## Ce qui est beau

- **Le titre du hero.** Geist semibold serré (`tracking-[-0.03em]`) suivi de « dix minutes. » en Instrument Serif italique bleu : le duo fonctionne. Le serif est assez grand (`1.08em`), la couleur suffit à signer la marque. C'est la meilleure chose de la page.
- **La retenue de la palette.** Neutres chauds (`#f7f6f3`), un seul accent `#1d5bd8` et le bleu nuit `#0c1630`. Aucune couleur parasite, le sérieux attendu par quelqu'un qui confie ses ventes.
- **Le panneau nuit « Le parcours ».** Grand rayon (28px), lueur bleue en haut à droite, cercle fantôme, numéros en mono sky-300 : le clin d'œil PlutoPay est réussi. C'est le seul vrai changement de rythme de la page.
- **La bande « Ce que tu peux vendre ».** Les couvertures en dégradés CSS (nuit, pêche, vert forêt, lavande, prune) donnent enfin de la couleur et du concret. C'est le bon esprit Kit créateur.
- **Le final GAZU.** Le mot-symbole `maketia.` en 25vw, coupé en bas sur la bande nuit, est une bonne idée de clôture.
- **L'hygiène.** Hover limité à `(hover:hover) and (pointer:fine)`, press `scale(0.97)` en ease-out, `text-balance` et `text-pretty`, mock-ups étiquetés « illustration ». Pas de faux logos ni de faux témoignages. C'est rare et précieux.

## Ce qui casse l'effet (top 5)

1. **La section Tarifs est vide et défensive.** Une seule carte de 400px, alignée à gauche, intitulée « Tarif à définir », avec 7 lignes « illimité » et un bouton secondaire gris, plus une note sur les abonnements « pas encore ouverts ». Sur la capture desktop, c'est un trou blanc de 900px. Une page de séduction ne montre jamais un chantier, surtout juste avant la FAQ et le CTA final.
2. **Deux sections sont des grilles de 6 cartes identiques.** « Le parcours » (6 cartes) et « Tout ce dont tu as besoin » (6 cartes icône + titre + texte) se suivent. Sur mobile, cela fait 12 cartes empilées, environ 3 500px de défilement sans aucun visuel. C'est le cœur de la monotonie, et ça fait template.
3. **Le mock-up du hero est trop petit et trop vide.** La fenêtre éditeur fait environ 540px avec du texte en 9,5–11px, la moitié droite du canvas est blanche, et le téléphone recouvre le contenu. Sur mobile, le téléphone est masqué (`hidden sm:block`) alors que « l'aperçu mobile » est l'argument central. Sur mobile encore, le mock arrive sous la ligne de flottaison, après 2 boutons pleine largeur et 3 puces. Le premier écran mobile n'est que du texte.
4. **La carte « Conversion 4,8 % » et la légende « Illustration — chiffres d'exemple. »** C'est le seul chiffre de performance de la page, et il est inventé. La légende qui s'excuse attire l'œil sur le problème. Elle contredit la promesse « rien n'est présenté comme fait ».
5. **La section « L'éditeur » n'a pas de visuel.** La colonne de droite est une liste de 7 pilules grises (« 01 Accroche ⋮⋮ »). Pour la section qui vend l'outil, c'est le visuel le plus faible de la page. NIVO montre l'éditeur ; ici on montre une liste.

À noter aussi :
- **Mode sombre.**
  - Un artefact apparaît derrière le téléphone : un bloc « GUIDE » déborde en haut à gauche, vers x≈1160 et y≈350 sur la capture.
  - La bordure du téléphone (`#0c1630`) disparaît sur un fond `#1c1c1a`.
  - Le bouton principal passe en pastel `#7aa2ff` avec un texte nuit : il perd toute autorité.
  - Le panneau nuit et la bande finale se confondent avec le fond `#141412`.
- **Le H1 desktop est sage.** 4rem (64px) dans une colonne de 50 %, loin des références GAZU (80–110px).
- **Le rythme vertical est uniforme.** Chaque section reprend `py-20 lg:py-24/28` + eyebrow + H2 2.75rem + grille dans `max-w-6xl`. Aucune section ne sort du cadre, sauf le panneau nuit.
- **Le mot-symbole final est trop pâle.** `text-white/[0.06]` est quasi invisible en capture. L'effet GAZU demande une présence réelle.

## Propositions concrètes (avec valeurs: tailles, couleurs, espacements, classes Tailwind si utile)

**Hero**
- H1 : `text-[2.75rem] sm:text-[4.5rem] lg:text-[5.25rem] leading-[0.98] tracking-[-0.035em]`. Grille `lg:grid-cols-[1.05fr_1fr]`, pour que le titre prenne la place et que le mock déborde à droite.
- Mock : `max-w-[640px]`, avec `lg:-mr-16 xl:-mr-24` pour qu'il sorte du conteneur.
  - Canvas éditeur : texte minimum 11px.
  - Remplir le vide du canvas avec une vraie mini-page sous l'accroche : une rangée de 3 bénéfices en lignes grises `h-1.5 rounded bg-border`, puis un bloc prix.
- **Bloc bleu derrière le téléphone (PlutoPay).** Un rectangle `absolute right-0 bottom-6 h-[78%] w-[46%] rounded-[28px] bg-accent` derrière le téléphone. Le téléphone passe à `w-[170px]`, `border-[6px] border-[#0c1630] dark:border-white/15`. Cela remplace avantageusement les 2 halos flous et donne une forme mémorable.
- **Retirer la carte « Conversion 4,8 % » et la légende.** La remplacer par une puce vraie et vérifiable, par exemple `✓ Paiement confirmé · lien envoyé` (bg-surface, icône emerald, `text-[11px]`). Elle illustre la livraison, qui est la vraie promesse.
- **Mobile.**
  - Afficher une version compacte du mock (téléphone seul, centré, `w-[220px]`, sur bloc bleu `rounded-3xl`) juste après le H1 et la phrase, avant les boutons.
  - Ou placer les CTA côte à côte : `grid grid-cols-[1fr_auto]`, avec le secondaire en lien texte « Comment ça marche → ».
  - Les 3 puces passent en une ligne de chips `text-xs` défilable.
- Réduire `pb-20 lg:pb-28` à `pb-16 lg:pb-20` : il reste ≈100px morts sous les puces.

**Showcase (Kit créateur)**
- Couvertures desktop à `w-[200px]` avec un léger chevauchement et une rotation alternée : `rotate-[-2deg]`, `rotate-[1.5deg]`, etc. Garder une seule ligne et laisser déborder à droite en carrousel, même sur desktop (`overflow-x-auto`, masque `[mask-image:linear-gradient(to_right,black_85%,transparent)]`).
- Ajouter sous chaque couverture le prix d'exemple à côté d'un mini-bouton (`9 900 FCFA · Acheter`). C'est l'idée « prix à côté du CTA » de la référence, toujours étiquetée exemple dans le titre de section.

**Le parcours (panneau nuit)**
- Remplacer la grille 3×2 par une **frise horizontale** : 6 pastilles numérotées reliées par une ligne `h-px bg-white/15`, titres dessous, `lg:grid-cols-6`. Sur mobile : liste verticale avec une ligne à gauche (`border-l border-white/15 pl-5`), sans cartes. Cela divise la hauteur mobile par environ 2.
- Ajouter dans le panneau un visuel « cartes qui se chevauchent » (PlutoPay) : 3 cartes blanches empilées et décalées (`rotate-[-4deg] translate-x-4`). Contenus : *Paiement reçu → Confirmé → Lien envoyé*.

**Fonctionnalités**
- Passer en **bento** : `lg:grid-cols-6`.
  - « Éditeur par sections » en `lg:col-span-4` avec mini-visuel.
  - « Aperçu mobile » en `lg:col-span-2 lg:row-span-2` avec un téléphone.
  - Les 4 autres en `col-span-3` ou `col-span-2`.
- Les tints actuels sont bons ; les étendre au fond de la carte entière pour 2 cartes : `bg-violet-500/[0.06]`, `bg-emerald-500/[0.06]`.
- Sur mobile, n'afficher que 4 cartes et masquer les 2 plus techniques derrière un « Voir tout ».

**L'éditeur**
- Remplacer la liste de pilules par un **vrai fragment d'éditeur** : la liste des sections à gauche (`w-40`) et, à droite, la section « Bénéfices » ouverte avec 2 champs remplis et un historique « v12 · restaurer ».
- Fond de section `bg-surface-sunken`. Garder `sm:translate-x-3` sur l'élément « soulevé » : c'est un joli détail.

**Tarifs (bloquant)**
- Tant qu'aucun prix public n'existe, **ne pas rendre la grille**. Remplacer la section par une bande pleine largeur `bg-night text-white rounded-[28px]`, avec :
  - un gros chiffre vrai : « **0 %** » (`font-serif italic text-[7rem] text-sky-300`) ;
  - le texte « de commission sur tes ventes. Abonnement à l'outil, tarifs publiés à l'ouverture. » ;
  - un CTA unique.
  Le fait vrai le plus vendeur devient le moment typographique GAZU de la page.
- Quand il y aura 2–3 plans : grille centrée `md:grid-cols-3`, plan mis en avant en `bg-night text-white`, prix en `text-5xl tracking-tight tabular-nums`. Afficher 4 quotas maximum, pas 7 lignes « illimité ».

**Couleur et mode sombre**
- Dark :
  - Garder un accent plus saturé pour les boutons, `--accent: #4d7dff`, avec `--accent-fg: #ffffff` (contraste ≈4,6:1 sur `#4d7dff`).
  - Réserver `#7aa2ff` aux textes et liens.
  - Bandes nuit en dark : `--night: #0b1530` avec `ring-1 ring-white/10`, pour qu'elles se détachent du `#141412`.
- Supprimer l'artefact « GUIDE » derrière le téléphone en dark : vérifier `BookCover` (overflow, ou ombre portée qui déborde) et ajouter `overflow-hidden` au cadre du téléphone.
- Mot-symbole final : `text-white/[0.09]` et un dégradé `bg-gradient-to-b from-white/15 to-transparent bg-clip-text text-transparent`, `text-[28vw]`.

**Rythme**
- Alterner les gabarits : hero (split), showcase (bande pleine largeur qui déborde), parcours (panneau nuit), bento, éditeur (fond enfoncé), 0 % (panneau nuit), FAQ, final nuit.
- Espacement de section : `py-24 lg:py-32` pour les sections clés, `py-16` pour les bandes. Aujourd'hui tout est à `py-20` : un rythme sans respiration.

## Animations recommandées (lesquelles, durée, easing, et lesquelles éviter)

Principe : l'animation sert l'entrée en scène et la compréhension. Rien sur les actions fréquentes. Tout passe par `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, transform et opacity uniquement.

**À faire**
1. **Entrée du hero, une seule fois au chargement.**
   - Badge, puis H1, puis paragraphe, puis CTA : `opacity 0→1`, `translateY(8px)→0`, `filter: blur(4px)→0`. Durée 600ms, décalage 60ms. CSS pur (`@keyframes` + `animation-delay`), sans JS.
   - Le mot « dix minutes. » arrive en dernier, 120ms après le H1.
   - Le mock : `translateY(16px) scale(0.98)→1`, 700ms, délai 200ms.
   - Le téléphone arrive 150ms après la fenêtre, avec un `translateY(24px)` : c'est l'effet « chevauchement ».
2. **Révélations au scroll, une fois par section, discrètes.**
   - `opacity 0→1` + `translateY(12px)`, 500ms ease-out.
   - Utiliser `animation-timeline: view()` avec `animation-range: entry 0% entry 30%`, derrière `@supports (animation-timeline: view())`. Sinon, un IntersectionObserver qui ajoute `data-inview` une seule fois.
   - Seuls les titres de section et les blocs visuels sont animés, pas chaque paragraphe.
3. **Frise du parcours.** La ligne se trace (`scaleX 0→1`, `transform-origin: left`, 900ms ease-out) quand le panneau entre. Les pastilles apparaissent avec un décalage de 70ms.
4. **Showcase.** Au survol desktop seulement, la couverture se redresse (`rotate→0`, `translateY(-4px)`, 200ms ease-out). Aucun mouvement automatique.
5. **FAQ.** Ouverture fluide de la hauteur avec `interpolate-size: allow-keywords` et `details::details-content { transition: height 250ms var(--ease-out), content-visibility 250ms allow-discrete; }`. Garder la rotation du « + », déjà bonne.
6. **Cartes bento.** Au survol (pointer fine), seulement la bordure `border-border-strong` et l'ombre, 150ms. Pas de lift sur 6 cartes.

**`prefers-reduced-motion: reduce`**
- Supprimer translate, scale, blur et le tracé de ligne.
- Garder seulement l'opacité, sur 200ms ou moins, ou tout afficher directement.
- Les éléments doivent être visibles par défaut : l'état initial caché ne s'applique que si l'animation tourne. Sinon, avec JS désactivé ou des captures, la page apparaît vide.

**À éviter**
- Compteur animé sur un chiffre (4,8 %, 0 %) : cela met en scène une métrique et fait « growth hack ».
- Marquee ou défilement automatique du carrousel ; effet machine à écrire sur « dix minutes » (gadget, et ça retarde la lecture du titre).
- Parallaxe sur les halos ou le mock, scroll-jacking, sections épinglées.
- Toute animation sur le header sticky, les liens de nav, les boutons au survol (au-delà de la couleur) ou le press, qui reste à `scale(0.97)` 140ms.
- Les animations répétées à chaque passage : `once` partout.
- Le flou animé sur de grandes surfaces (halos de 520px) : coût GPU élevé sur mobile milieu de gamme.

## Conditions pour VALIDÉ

1. **Tarifs.** Plus aucune carte « Tarif à définir » ni de grille vide. Une bande « 0 % de commission » le remplace jusqu'à la publication des prix.
2. **Hero.**
   - Retirer la carte « Conversion 4,8 % » et la légende d'excuse ; les remplacer par une puce de livraison vraie.
   - Agrandir le mock (≥ 600px) et y ajouter le bloc bleu derrière le téléphone.
   - H1 desktop à 72px minimum.
3. **Mobile.** Le téléphone apparaît dans le premier ou le deuxième écran. Les 12 cartes Parcours + Fonctionnalités sont réduites (frise verticale + 4 cartes). Hauteur mobile totale −25 % environ, de ~14 900px à ~11 000px.
4. **Monotonie.** Au moins un gabarit casse la grille de 6 cartes : bento pour Fonctionnalités, ou frise pour Parcours, idéalement les deux.
5. **Mode sombre.** Corriger l'artefact « GUIDE » derrière le téléphone, rendre visible le cadre du téléphone, garder un bouton principal saturé avec texte blanc, et faire détacher les bandes nuit du fond.
6. **Animations.** Entrée du hero et révélations au scroll livrées en `once`, avec fallback `prefers-reduced-motion` et contenu visible sans JS.
