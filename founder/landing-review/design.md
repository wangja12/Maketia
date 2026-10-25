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

## Revue v3
Note: 7,5/10 | Verdict: VALIDÉ SI

La v3 a franchi le cap principal : le hero séduit maintenant, et plus rien ne sonne faux. La note ne monte pas plus haut pour deux raisons. La page est devenue **longue** : desktop 7 163px contre 5 281px en v2, mobile 20 474px contre 14 894px, soit l'inverse de la condition 3 posée en v2. Et le bleu nuit, répété 4 fois, perd son effet d'événement.

### Ce qui s'est amélioré

- **Hero.**
  - H1 à 4.6rem, avec la ligne serif « sans y passer tes nuits. » sur toute la largeur : c'est enfin un titre d'éditorial, et le meilleur moment de la page.
  - Le bloc bleu `rounded-[32px]` décalé derrière le téléphone donne une forme qu'on retient (PlutoPay réussi).
  - Le téléphone acheteur est lisible : prix, puces, « Acheter ».
  - « Paiement confirmé · Lien envoyé sur WhatsApp » remplace le faux 4,8 %, et c'est vrai.
  - Le CTA secondaire passe en lien texte avec ↓, la hiérarchie est plus nette.
- **0 % de commission.** Le fait vrai le plus vendeur devient le moment typographique. La carte « Tarif à définir » a disparu.
- **Le parcours.** 4 étapes sur une frise : la ligne horizontale sur desktop et la ligne verticale sur mobile sont bien vues. La note honnête sur la confirmation manuelle, dans un encadré, rassure sans s'excuser.
- **Showcase.** Les couvertures inclinées avec prix FCFA et « Acheter » en dessous : idée Kit créateur bien exécutée, et le survol qui redresse la couverture est juste.
- **Avant / avec Maketia.** Le contraste gris enfoncé / nuit est le bon langage pour ce message.
- **Mot-symbole final.** Le dégradé `from-white/[0.16]` est enfin visible, l'effet GAZU fonctionne.
- **Mode sombre.** L'artefact « GUIDE » a disparu. Le téléphone blanc sur bloc bleu ressort très bien sur fond `#141412`.
- **Motion.**
  - Entrée `rise` du hero en CSS pur, en cascade de 60ms.
  - Révélations par `animation-timeline: view()` derrière `@supports`, sans JS, contenu visible si non supporté.
  - Rien ne bouge sous `prefers-reduced-motion`. Conforme.

### Ce qui casse encore l'effet (top 5)

1. **La page est trop longue.** 10 sections en v3 contre 8 en v2. Sur mobile, 20 474px, environ 26 écrans d'iPhone. « Avant/avec », « Fait pour toi si… », « Tout ce qu'il faut » et la FAQ à 9 questions répètent les mêmes arguments : argent sur ton compte, pas de code, fichier protégé. La séduction s'épuise avant le 0 %.
2. **Le bleu nuit est trop répété.** Avant/avec (moitié droite), Parcours, 0 % et Final : 4 masses nuit. Les deux premières se touchent presque (Avant/avec puis Parcours, sans respiration). Dans les références, GAZU et PlutoPay n'utilisent le noir que 1 ou 2 fois : c'est la rareté qui fait l'événement.
3. **Sur mobile, le premier écran est toujours sans visuel, et il contient deux CTA identiques.**
   - Le téléphone n'apparaît qu'à environ 1 450px, coupé par la barre fixe.
   - La barre fixe « Créer ma page gratuitement » est visible en même temps que le bouton identique du hero.
   - Le badge passe sur 2 lignes.
4. **Le mock éditeur du hero est grossier.**
   - Les lignes `bg-fg/80` de 12px ressemblent à du texte caviardé.
   - Le téléphone couvre le tiers droit de la fenêtre, qui ne montre presque rien.
   - En sombre, ces barres deviennent gris clair et attirent l'œil plus que le titre.
5. **Le bento n'a que du texte, et la section « Ce que vit ton client » est trop petite.**
   - Le bento varie les largeurs (`col-span-2`) mais les 6 cartes restent icône + titre + paragraphe. La forme change, la monotonie reste.
   - Les 3 téléphones de « Ce que vit ton client » font 190px dans un conteneur de 1 152px : environ 60 % de vide, et l'écran SasPay n'est qu'un squelette gris.

Défauts techniques à signaler :
- **Contraste du bouton en mode sombre insuffisant.** `--accent: #4d7dff` avec texte `#ffffff` donne environ **3,7:1**, sous 4,5:1 pour du texte de 15px. Ma valeur v2 (« ≈4,6:1 ») était fausse. Je la corrige ci-dessous.
- **Le flou est appliqué au mock entier.** `rise` anime `filter: blur(4px)` aussi sur `HeroMock` (560×470px), ce qui coûte cher sur mobile d'entrée de gamme.
- **Les révélations ne sont pas « une seule fois ».** `.reveal` est liée au scroll avec une timing function `linear`. Elle se rejoue à l'envers quand on remonte, et la sensation est linéaire, pas ease-out.
- **Le 0 % est écrit deux fois côte à côte.** « 0 % » en 10rem, puis le H2 « 0 % de commission. » juste à droite.

### Corrections restantes (valeurs exactes)

**1. Raccourcir (objectif : desktop ≤ 5 800px, mobile ≤ 13 000px)**
- Supprimer la section `ForWho`. Déplacer 2 de ses lignes « Pas encore, si » dans la FAQ, sous la question « Pour qui ce n'est pas fait (encore) ? ».
- FAQ : garder 6 questions. Retirer « Faut-il savoir coder ? » (déjà dit 3 fois) et « Et l'intelligence artificielle ? » (déjà dit sous le bento). Fusionner « Pourquoi la confirmation n'est-elle pas automatique ? » dans « Quand mon client reçoit-il son fichier ? ».
- Avant/avec : passer à 4 lignes en retirant « Tes ventes se perdent… ». Sur mobile, chaque paire s'affiche sur une ligne (avant barré en `text-muted line-through decoration-fg/20 text-[14px]` au-dessus, après en dessous), au lieu de 2 listes de 5 empilées.
- Bento : 4 cartes. Retirer « Ton nom de domaine » et « Pensée pour le téléphone », que la section 3 téléphones prouve déjà.
- Espacements : `py-20 lg:py-28` passe à `py-16 lg:py-24` sur Avant/avec, Bento et FAQ.

**2. Rythme du nuit (2 panneaux + le final, pas plus)**
- Avant/avec : la colonne « Avec Maketia » passe en `bg-accent/[0.06] ring-1 ring-accent/20` avec texte `text-fg`, au lieu de `bg-night`. Coche `bg-accent text-white`.
- Ou déplacer Avant/avec **après** « Ce que vit ton client ». Ordre conseillé : Hero, Showcase, Parcours (nuit), Ce que vit ton client, Avant/avec (clair), Bento, 0 % (nuit), FAQ, Final (nuit).

**3. Hero mobile**
- Sous `sm`, afficher le téléphone avant les CTA : `order-first` sur un bloc mobile dédié, téléphone `w-[200px]` sur bloc bleu `h-[260px] w-[72%] rounded-[28px]`, `mt-2`. Ou réduire le visuel mobile à `h-[320px]` et le placer juste après le paragraphe.
- Barre mobile : masquée tant que le CTA du hero est visible. En CSS, avec `animation-timeline: scroll()` et `animation-range: 0 600px` sur `opacity`/`translateY(100%)`, sous `@supports` ; sans support, garder la barre. Ou IntersectionObserver sur le CTA du hero, avec `data-show` et `transition: transform 220ms var(--ease-out)`.
- Badge mobile court : « Créateurs d'Afrique francophone · FCFA » (`sm:hidden`), la version longue en `hidden sm:inline`.

**4. Mock éditeur du hero**
- Barres titre : `h-2.5 bg-fg/25` au lieu de `h-3 bg-fg/80`. Barres texte : `h-1.5 bg-fg/10`.
- Ajouter dans la zone visible (`pr-[46%]`) une mini-couverture `w-10` + un bloc prix `h-4 w-16 rounded bg-accent/15`, pour que la fenêtre montre « une page », pas des lignes.
- Fenêtre `w-[74%]`, téléphone `right-[4%]` : le chevauchement passe d'environ 1/3 à environ 1/5.
- Mode sombre : barres `dark:bg-white/15` et `dark:bg-white/8`.

**5. « Ce que vit ton client » et bento**
- Téléphones : `w-[220px] sm:w-[240px]`, `min-h-[260px]`, `gap-10`. Relier les 3 par une flèche fine `→` en `text-muted`, entre chaque, desktop seulement.
- Écran 2 : remplacer le squelette par un vrai contenu illustratif neutre (« Montant 5 000 FCFA », « Numéro mobile money », bouton). Garder la mention « L'écran de paiement est celui de SasPay et peut différer. »
- Bento : donner un mini-visuel aux 2 cartes `wide`.
  - « Une page qui vend » : 3 pilules de sections empilées, décalées de `translate-x-2`.
  - « Pas payé, pas de fichier » : un lien `…/telechargement/aB3x` avec « expire dans 7 j · 3 téléchargements restants ».
  - Hauteur minimale de ces cartes `lg:min-h-[240px]`, visuel aligné à droite avec `lg:flex-row`.

**6. 0 %**
- Garder le « 0 % » géant. Le H2 devient : « Tes ventes restent à toi. » en `text-white`, avec « Aucune commission, jamais. » en serif sky-300. On n'écrit plus « 0 % » deux fois.
- Ajouter un léger `text-shadow: 0 0 60px rgb(125 211 252 / 0.35)` sur le 0 %. Pas d'animation de compteur.

**7. Mode sombre**
- `--accent: #3b6cf0`, `--accent-hover: #5580f5`, `--accent-fg: #ffffff`. Contraste du texte blanc sur `#3b6cf0` environ 4,6:1. Pour les liens et le texte accent en sombre, utiliser `text-sky-300` ou un token `--accent-text: #8fb0ff`.
- Bloc bleu du hero en sombre : `dark:bg-[#2f5fe0]`, pour qu'il reste plus sombre que le blanc du téléphone sans paraître fluo.

**8. Motion**
- `rise` : retirer `filter: blur()` de la figure du hero. Garder le flou uniquement sur le badge, le H1 et le paragraphe, ou le retirer partout. Mock : `transform: translateY(16px) scale(0.98)` seulement.
- `.reveal` : ajouter `animation-timing-function: var(--ease-out)` dans la règle `@supports` (la timing function s'applique sur la progression du scroll). Réduire `animation-range: entry 10% entry 60%` pour que l'élément soit pleinement visible avant le milieu de l'écran.
- Accepter le rejeu à la remontée (inhérent à `view()`) ou passer à IntersectionObserver + `data-inview` pour un vrai « une fois ». Les deux sont acceptables ; ne pas cumuler.
- Frise du parcours : ajouter le tracé de ligne `scaleX(0→1)`, `transform-origin: left`, `animation-range: entry 20% cover 40%`, désactivé sous reduced motion. C'est la seule animation « signature » qui manque.

### Conditions pour VALIDÉ (v3)

1. Hauteur mobile ≤ 13 000px et desktop ≤ 5 800px : retrait de `ForWho`, FAQ à 6 questions, bento à 4 cartes, Avant/avec à 4 lignes.
2. Au plus 2 panneaux nuit en plus du final, jamais deux masses nuit consécutives.
3. Mobile : visuel du téléphone dans le premier écran, ou au plus tard 1,2 écran ; barre fixe masquée tant que le CTA du hero est visible.
4. Accent sombre `#3b6cf0` (≥ 4,5:1 avec le blanc).
5. Mock éditeur allégé : barres à 25 % et 10 %, plus de « texte caviardé ».
6. Plus de `blur` animé sur la figure du hero ; `.reveal` en ease-out.
