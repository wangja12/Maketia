# Revue mobile et accessibilité

Note: 6/10 | Verdict: VALIDÉ SI

Contexte retenu : visiteurs sur Android d'entrée de gamme (écran de 360 px, GPU faible), en 3G/4G, qui arrivent depuis le navigateur intégré de WhatsApp, TikTok ou Facebook. Dans ces navigateurs, la zone visible fait environ 360 × 560 px.

Sources lues :
- les captures `v2/v2-mobile.png`, `v2/v2-mobile-haut.png`, `v2/v2-ordinateur*.png` et `v2/v2-sombre-haut.png` ;
- les fichiers `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/ui/button.tsx` et `tests/e2e/quality.spec.ts`.

Les contrastes ont été calculés avec la formule WCAG 2.1, sur les couleurs des jetons et sur des pixels relevés dans la capture.

## Ce qui va bien

- **Langue et zoom.** `<html lang="fr">` est présent. Le viewport ne bloque pas le zoom (`interactiveWidget: "resizes-content"`, sans `maximum-scale`). `themeColor` est réglé pour le thème clair et le thème sombre.
- **Structure.** Il y a un seul `h1`. Chaque section a un `h2` relié par `aria-labelledby`, et les `h3` sont dans les cartes. L'ordre des titres est correct. On trouve `header`, `nav aria-label`, `main` et des `section` nommées. Le parcours en étapes est une vraie liste `<ol>`.
- **Décor masqué.** Les éléments décoratifs sont masqués aux lecteurs d'écran : halos, grille, maquette de l'éditeur, mot-symbole géant et flèches `→` (tous en `aria-hidden`). La maquette est un `figure` avec un `aria-label` et une légende « Illustration — chiffres d'exemple. ».
- **Focus visible.** Un style global `:focus-visible` dessine un contour de 2 px en `--focus`, décalé de 2 px. Il est lisible sur les fonds clairs et sombres de la page.
- **FAQ.** La FAQ utilise `<details>/<summary>` natifs : rôle, état ouvert/fermé et clavier fonctionnent sans JavaScript. L'icône « + » est en `aria-hidden`, et chaque ligne fait plus de 60 px de haut (`py-5`), donc la cible est confortable.
- **Gros boutons du haut.** Les CTA du hero (« Créer ma première page », « Voir comment ça marche ») et du bas (« Créer mon compte », « Connexion ») font 48 px de haut (`h-12`). Ils passent l'un sous l'autre à 360 px. Le premier CTA se voit sans faire défiler, vers y ≈ 470 px.
- **Survol.** Le survol est réservé aux appareils qui le gèrent vraiment (`@media (hover:hover) and (pointer:fine)`). On ne voit donc pas d'état « hover » qui reste collé après un toucher. `touch-action: manipulation` supprime le délai de 300 ms.
- **Mouvement réduit.** L'effet d'appui (`scale(0.97)`) est coupé quand le mouvement réduit est demandé, et c'est testé (`quality.spec.ts`). Il n'y a ni animation de défilement ni carrousel automatique.
- **Contrastes principaux conformes (AA).**

  | Texte | Fond | Contraste |
  |---|---|---|
  | `--muted` #6b6862 | `--bg` | 5,1:1 |
  | `--muted` #6b6862 | blanc | 5,6:1 |
  | `--accent` | `--bg` | 5,5:1 |
  | `text-white/65` | bleu nuit #0c1630 | 8,0:1 |
  | `text-white/55` (pied de page) | bleu nuit | 6,1:1 |
  | `text-sky-300` | bleu nuit | 10,7:1 |
  | `--muted` (sombre) | `--bg` (sombre) | 7,1:1 |
  | `--accent` (sombre) | `--bg` (sombre) | 7,4:1 |

- **Mise en page stable.** Il n'y a aucune image matricielle : les couvertures sont dessinées en CSS. Les tarifs sont rendus côté serveur et un texte de repli s'affiche si la base ne répond pas. Il n'y a donc rien qui fasse bouger la page au chargement. `next/font` héberge les polices et prévoit des polices de repli ajustées.
- **Pas de débordement horizontal.** `overflow-x-clip` est posé sur la racine. Le bandeau de produits défile dans son propre conteneur.

## Problèmes (top 8, le plus grave d'abord, avec l'élément exact et le correctif)

1. **Halos `blur()` géants et `backdrop-blur` sur l'en-tête collant : c'est le principal risque de saccades sur Android d'entrée de gamme.**
   - Éléments concernés :
     - `Hero` : `size-[520px] … blur-[110px]` et `size-[300px] … blur-[100px]` ;
     - `Journey` : `size-[520px] … blur-[120px]` ;
     - `FinalCall` : `size-[700px] … blur-[140px]` ;
     - `Header` : `sticky … bg-bg/80 backdrop-blur-md`.
   - Pourquoi c'est coûteux : un `filter: blur()` de plus de 100 px sur une surface de 500 à 700 px se calcule par passes successives sur le GPU. Le `backdrop-filter` de l'en-tête collant est recalculé à chaque image pendant le défilement, sur tout ce qui passe dessous.
   - Effet attendu : sur un Mali ou PowerVR bas de gamme, défilement à 20–40 images/s et batterie qui chauffe. Certains navigateurs intégrés désactivent aussi l'effet, ce qui donne un rendu différent.
   - Correctif : remplacer chaque halo par un dégradé radial, sans filtre, avec un rendu presque identique. Par exemple `bg-[radial-gradient(closest-side,rgb(29_91_216/0.25),transparent)]` sur le même `div`, sans `blur-*`. Pour l'en-tête, utiliser `bg-bg/95` sans `backdrop-blur-md`, ou bien `backdrop-blur-md` uniquement à partir de `md:`.

2. **La page d'accueil n'est couverte par aucun test qualité.**
   - Élément : `tests/e2e/quality.spec.ts`. `publicScreens` ne contient que `/connexion` et `/inscription`, et `screens` ne contient pas `/`.
   - Conséquence : ni axe (WCAG 2.1 AA), ni le test « pas de défilement horizontal à 360 px », ni les budgets de performance ne s'exécutent sur la landing.
   - Correctif : ajouter `{ name: "accueil", url: "/" }` à `publicScreens`, et une ligne `budgets` pour `/` (par exemple `maxHtml: 60_000`). Ajouter aussi un test axe en `colorScheme: "dark"`.

3. **Le texte gris du hero est posé sur le halo bleu, avec un contraste insuffisant.**
   - Élément : `Hero > p.max-w-xl.text-base.text-muted`, le paragraphe « E-books, formations… », et la liste `ul.text-sm.text-muted` (« Aucune compétence technique »…).
   - Mesure : le fond relevé dans la capture va de #c3d0f8 à #d4dff6. Le contraste de #6b6862 sur ce fond va de 3,6:1 à 4,2:1. Il faut 4,5:1 pour du texte de 13 à 15 px.
   - Pourquoi les tests ne le voient pas : axe ne sait pas mesurer un fond flouté. Il classe ce cas « à vérifier », pas « violation », donc il passera même après le correctif n° 2.
   - Correctif : utiliser `text-fg/80` (ou un `--muted` plus foncé, #57544f) sur ces deux éléments. Autre option : déplacer les halos vers la droite, derrière la maquette, et les sortir de la colonne de texte sur mobile (`hidden lg:block` sur le second halo).

4. **Le bandeau horizontal « Ce que tu peux vendre » n'est utilisable ni au clavier ni au lecteur d'écran, et ses petits textes manquent de contraste.**
   - Élément : `Showcase > ul.flex.snap-x.overflow-x-auto [scrollbar-width:none]`.
   - Clavier et lecteur d'écran : la zone défile mais ne contient aucun élément focalisable. axe lèvera `scrollable-region-focusable` (sérieux) dès que la page sera testée. La barre de défilement est masquée : le seul indice est la carte coupée à droite. C'est suffisant au doigt, mais aucun libellé n'annonce la liste.
   - Contraste : les textes `text-[10px] opacity-75` (« Canva · PNG », « MP3 · 10 pistes ») et `opacity-80` (genre) sont blancs sur #4f8a6b (3,0:1) et sur #d9467a (3,0:1). C'est sous 4,5:1, et en 10 px.
   - Correctif :
     - ajouter `tabIndex={0}` et `aria-label="Exemples de produits"` sur le `ul`, plus un style focus sur ce `ul` ;
     - ou passer en `grid grid-cols-2` sous `sm`, sans défilement, avec 5 cartes plus petites ;
     - supprimer les `opacity-75/80` et passer les métadonnées en `text-xs` (12 px) minimum.

5. **Cibles tactiles sous 44 px.**
   - Éléments trop petits :

     | Élément | Hauteur |
     |---|---|
     | En-tête « Commencer » (`h-10`) | 40 px |
     | Boutons « Commencer » des tarifs (`buttonClass` de base `h-9`) | 36 px |
     | Lien texte « Ouvrir mon espace → » (`text-sm`, sans padding) | ≈ 20 px |
     | Lien logo (`text-xl`, sans padding) | ≈ 28 px |

   - Correctif : passer à `h-11` (44 px) pour le bouton de l'en-tête et les boutons des tarifs. Sur « Ouvrir mon espace », ajouter `inline-flex min-h-11 items-center`, ou en faire un bouton secondaire. Sur le lien logo, ajouter `inline-flex min-h-11 items-center`.

6. **Aucune barre d'action collée en bas sur mobile : le seul CTA permanent est en haut, loin du pouce.**
   - Élément : `Header`. L'en-tête collant de 64 px garde « Commencer » en haut à droite, la zone la plus difficile à atteindre d'une main. Il prend aussi environ 11 % des 560 px visibles dans le navigateur de WhatsApp.
   - Entre le hero et le bloc final, il y a environ 6 000 px de défilement mobile avec un seul CTA dans le contenu (« Ouvrir mon espace », un lien texte).
   - Correctif :
     - ajouter, sous `md`, une barre `fixed inset-x-0 bottom-0` avec « Créer ma première page » (`h-12`, pleine largeur) ;
     - l'afficher seulement après le hero (`IntersectionObserver` sur le CTA du hero, ou `position: sticky` en fin de `main`) ;
     - prévoir `padding-bottom: env(safe-area-inset-bottom)` et un `pb-20` sur le contenu pour ne rien masquer ;
     - garder l'en-tête non collant sur mobile (`md:sticky`).

7. **Texte trop petit pour la lecture courante sur 360 px.**
   - Éléments :
     - descriptions des fonctionnalités `Features li p.text-sm` (13 px) ;
     - réponses de la FAQ `details p.text-sm` (13 px) ;
     - étapes du parcours `Journey li p.text-sm` (13 px) ;
     - liste de l'éditeur, liste des tarifs ;
     - mention des tarifs `text-xs` (12 px) ;
     - légende `figcaption text-[11px]`.
   - Pourquoi c'est gênant : le corps de texte de base est déjà à 15 px (`--text-base: 0.9375rem`). Sur des écrans de faible qualité, en plein soleil, 13 px en gris coûte beaucoup en lisibilité, surtout pour la FAQ, qui répond aux objections d'achat.
   - Correctif : utiliser `text-base` (15 px) pour les réponses de la FAQ et les descriptions, et `text-sm` (13 px) au minimum pour la mention des tarifs et la légende.

8. **Libellés de liens ambigus, et pied de page qui n'est pas reconnu comme tel.**
   - Libellés : il y a 3 à 4 liens identiques « Commencer » (en-tête et chaque carte de tarif) qui mènent tous à `/inscription`, sans distinguer le plan. Dans la liste des liens d'un lecteur d'écran, ils sont impossibles à départager. Correctif : `aria-label={`Commencer avec le plan ${p.name}`}`, ou un `<span className="sr-only"> avec le plan {p.name}</span>`.
   - Pied de page : `<footer>` est placé à l'intérieur de `section` dans `main`, donc il n'est pas exposé comme `contentinfo`. Correctif : sortir le `footer` de `FinalCall` et de `main`, comme frère de `main`.
   - Lien d'évitement : il n'y en a pas (« Aller au contenu »). C'est mineur, puisque l'en-tête n'a que 2 liens sur mobile.

Points mineurs, hors top 8 :
- **Rotation de l'icône de la FAQ.** La rotation de 45° (`transition-transform duration-200`) n'est pas coupée en mouvement réduit. Ajouter `motion-reduce:transition-none`.
- **Focus sur fond bleu nuit.** L'anneau de focus #2563eb sur #0c1630 donne 3,5:1. C'est conforme (3:1 requis), mais limite. En section nuit, `--focus` pourrait passer à `sky-300`.
- **Capture mobile et code divergent.** La capture `v2-mobile-haut.png` montre « Connexion » dans l'en-tête à 390 px, alors que le code le masque sous `sm` (`hidden sm:inline-flex`). Refaire la capture après correctifs pour s'assurer qu'elle correspond au code.
- **Aperçu de lien (Open Graph) absent.** Il manque `openGraph`/`twitter` et une image d'aperçu (`opengraph-image`). Pour un trafic qui vient de WhatsApp et Facebook, l'aperçu du lien est la première chose que le visiteur voit. Sans lui, le lien s'affiche nu, et le taux de clic baisse.

## Performance sur téléphone d'entrée de gamme

- **Rendu GPU (le vrai problème).**
  - 4 halos `blur()` de 300 à 700 px, de 100 à 140 px de rayon. Les 2 plus gros sont visibles dès le premier écran mobile.
  - Un `backdrop-filter` sur un en-tête collant.
  - Une grille de fond avec `mask-image` en dégradé radial, qui s'étend sur tout le hero.
  - Effet : sur un appareil avec 2 Go de RAM et un GPU Mali-G52 ou moins, il faut s'attendre à un défilement saccadé et à un premier affichage retardé. Les grandes couches floutées doivent être rastérisées.
  - Correctif : supprimer tous les `blur-*` au profit de `radial-gradient`, et retirer le `backdrop-blur` sur mobile. Gain estimé : la plus grosse part du coût de rendu de la page, sans perte visuelle notable.
- **Ombres.** Il y a beaucoup de `shadow-[…]` larges, de 30 à 80 px de flou, sur la maquette, les cartes et les tarifs. Elles restent acceptables, car elles sont statiques et non animées. Il faut éviter d'en ajouter.
- **Polices.** Il y a 3 familles : Geist variable, Geist Mono et Instrument Serif italique. `next/font` les sert en local, en `latin` uniquement, avec préchargement. C'est correct.
  - Geist Mono ne sert qu'aux numéros « 01–07 » : c'est un fichier en trop sur 3G. Remplacer par `font-sans tabular-nums` et supprimer `Geist_Mono` du layout si l'app ne l'utilise pas ailleurs.
  - Instrument Serif est préchargée pour quelques mots. On peut la garder, c'est l'identité visuelle. On pourrait aussi la passer en `preload: false` pour prioriser Geist.
- **JavaScript.** La page est un composant serveur, sans `"use client"`, mais charge quand même le runtime Next.js (≈ 175 Ko gzip mesurés sur la page publiée). C'est acceptable en 4G, et environ 2 à 3 s en 3G lente. Ajouter un budget pour `/` (voir le problème n° 2).
- **Mise en page.** Aucune image, pas d'insertion tardive. Le seul risque de décalage est l'échange de police, déjà compensé par `next/font`. Le CLS attendu est proche de 0.
- **Serveur.** `await headers()` force un rendu à chaque requête (pour le nonce CSP), et `listActivePlans` interroge la base à chaque visite. Le TTFB dépend donc de la base pour chaque visiteur venu d'un lien viral. À surveiller : mettre la liste des plans en cache (par exemple pendant 60 s) pour que les pics de trafic WhatsApp ne frappent pas la base.
- **Thème sombre.** Il est géré par les jetons, et les sections nuit sont identiques dans les deux thèmes. Il n'y a pas de test axe dédié. Les teintes `dark:text-*-300` sur `*-500/10` sont lisibles dans la capture.

## Conditions pour VALIDÉ

1. Remplacer les 4 halos `blur-[100–140px]` par des `radial-gradient` sans filtre, et retirer `backdrop-blur-md` de l'en-tête sous `md`.
2. Ajouter `/` aux tests axe, 360 px et budgets de `tests/e2e/quality.spec.ts` (thème clair et sombre), et obtenir 0 violation.
3. Atteindre au moins 4,5:1 pour le paragraphe et la liste du hero sur le halo (texte plus foncé, ou halo déplacé hors de la colonne de texte).
4. Bandeau de produits : `tabIndex={0}` et `aria-label` (ou grille sur mobile), et métadonnées des cartes sans opacité réduite, en 12 px minimum.
5. Toutes les cibles tactiles à 44 px ou plus : bouton de l'en-tête, boutons des tarifs, « Ouvrir mon espace », logo.
6. Barre CTA collée en bas sur mobile, affichée après le hero, avec `safe-area-inset-bottom`.
7. Réponses de la FAQ et descriptions en 15 px, et libellés « Commencer » des tarifs distincts par plan.
