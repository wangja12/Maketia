---
name: wang-design-engineering
version: 1.1.0
description: Règles obligatoires de design engineering pour tout agent qui crée ou modifie une page, un composant, une interaction ou une animation de Tunnels IA, y compris via le serveur MCP. Fondée sur emilkowalski/skills (commit 2d22863).
source: https://github.com/emilkowalski/skills
source_commit: 2d228630ba1446365f614a108cb8252f1feda202
---

# wang-design-engineering

Version **1.1.0**. Cette skill est obligatoire. Elle traduit en règles de travail les principes
des skills officielles de [emilkowalski/skills](https://github.com/emilkowalski/skills)
(licence MIT, commit `2d22863`, consulté le 18/10/2026 et revérifié le 20/10/2026). Le détail de la source, des fichiers lus
et de la procédure de mise à jour est dans [SOURCE.md](SOURCE.md).

Tunnels IA n'exécute aucun modèle d'IA. C'est vous, l'agent externe, qui lisez cette skill et
l'appliquez. Le serveur vérifie ce qui est objectif (schéma, liens, contraste, limites) et refuse
ce qui est dangereux. Il ne prétend pas juger le goût : une personne relit avant publication.

## 1. Avant toute opération

1. Lisez cette skill en entier. Les outils MCP qui écrivent exigent `skill_version: "1.1.0"`.
   Ne transmettez cette valeur qu'après avoir lu le texte.
2. Si votre client a accès aux skills officielles, lisez aussi `emil-design-eng`, et `animate`
   pour toute animation. Selon la tâche, lisez `review-animations`, `animation-performance`,
   `mobile-native` ou `break-ui` (`pick-ui-library` seulement si l'utilisateur la demande).
   Si vous n'y avez pas accès, dites-le dans votre plan : n'inventez pas leur contenu.
3. Dans votre plan d'action, écrivez : « J'applique wang-design-engineering 1.1.0 », puis la
   liste des règles de cette skill qui concernent la tâche.
4. Lisez la fiche de l'offre (`get_funnel`, champ `brief`) avant d'écrire un texte.

## 2. Contenu et honnêteté (bloquant)

- N'inventez jamais un témoignage, une statistique, une certification, une garantie, un prix
  ou un nombre de clients. Utilisez uniquement ce que l'utilisateur a fourni dans la fiche.
- Une section `testimonials` exige `providedByUser: true`. Ne mettez cette valeur que si les
  témoignages viennent mot pour mot de l'utilisateur.
- S'il manque une information, demandez-la à l'utilisateur ou laissez un texte d'instruction
  explicite (« Indiquez ici votre garantie »), jamais une affirmation plausible inventée.
- Paiement : un achat passe par une section `checkout` liée à un produit ; n'écrivez jamais un
  lien de paiement dans un bouton. N'affirmez pas que la livraison est immédiate ou automatique :
  la confirmation des paiements peut être manuelle (voir `get_integrations_status`).

## 3. Qualité de page (emil-design-eng)

Le goût s'entraîne : chaque détail invisible s'additionne. Pour une page de vente :

- **Une seule promesse principale.** Une section `hero`, en premier, avec un titre de moins de
  90 caractères qui dit le résultat pour le client, pas le nom du produit.
- **Chaque élément sert la compréhension ou l'action.** Pas de section décorative. Une section
  `text` de plus de 3 paragraphes se découpe ou se raccourcit.
- **Appel à l'action explicite.** Le libellé dit ce qui se passe au clic (« Télécharger
  l'e-book », pas « Cliquez ici »). Un seul appel principal par écran.
- **Bons réglages par défaut plutôt qu'options.** Gardez le thème existant sauf demande
  contraire. Changez une chose à la fois et dites pourquoi.
- **Couleur d'accent lisible.** Le serveur refuse un accent dont le texte des boutons est sous
  4.5:1 de contraste. Choisissez une couleur foncée sur fond clair, claire sur fond sombre.
- **Mobile d'abord.** Relisez la page à 360 px de large : titres courts, listes de 3 à 6
  éléments, pas de mot très long sans espace.
- **Images.** URL `https://` uniquement, texte alternatif qui décrit l'image réelle.

## 4. Mouvement (animate, review-animations)

Le format de page v1 ne contient aucune animation. N'en simulez pas avec du texte. Si vous
écrivez du code d'interface pour le produit lui-même, appliquez dans cet ordre :

1. **Faut-il animer ?** Action au clavier ou vue plus de 100 fois par jour : aucune animation.
   Vue des dizaines de fois par jour : quasi imperceptible ou rien.
2. **Pourquoi ?** Nommez le but : retour d'action, cohérence spatiale, indication d'état,
   éviter un changement brutal, explication. « C'est joli » ne suffit pas.
3. **Propriétés :** `transform` et `opacity` uniquement. Jamais `scale(0)` : partez de
   `scale(0.95)` avec `opacity: 0`. Popovers depuis leur déclencheur ; modales centrées.
4. **Courbe et durée :** jetons du projet (`--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`,
   `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`). Jamais `ease-in` sur l'interface.
   Moins de 300 ms ; appui 100–160 ms, modale 200–300 ms ; la sortie plus rapide que l'entrée.
5. **Interruption :** transitions CSS plutôt que keyframes pour ce qui se déclenche souvent.
6. **Accessibilité :** `prefers-reduced-motion` livré avec l'animation (garder les fondus,
   retirer les déplacements) ; survols limités à `@media (hover: hover) and (pointer: fine)`.
7. Jamais `transition: all`. Jamais bloquer une action en attendant la fin d'une animation.

### Performance du mouvement (animation-performance)

- Budget : 16,7 ms par image à 60 Hz, **8 ms à 120 Hz** (la plupart des téléphones) : visez le
  plus petit. La référence est un téléphone milieu de gamme, pas votre ordinateur.
- Propriétés par coût : `transform`/`opacity` (composition) avant `box-shadow`, `border-radius`,
  `color` (repeinture) avant `width`, `height`, `padding`, `margin`, `top`, `left` (mise en page).
  Remplacements : taille → `scale()`, position → `translate()`, `display` → `opacity`,
  ombre animée → `filter: drop-shadow()`.
- Pas d'état React mis à jour à chaque image (écrivez `ref.current.style.transform`). Pas de
  variable CSS héritée animée sur un parent. `blur()` animé sous 20 px.
- Une animation qui joue pendant une navigation ou un chargement : en CSS ou WAAPI, pas dans
  une boucle `requestAnimationFrame`.
- `will-change` seulement après avoir constaté un décalage ou des images perdues, sur l'élément
  animé uniquement.
- Nommez la cause avant toute correction, et dites ce qui est vérifié dans le code et ce qui
  demande un enregistrement sur un vrai appareil.

## 5. Interface du produit (code)

- États de chaque contrôle : normal, survol, appui (`scale(0.97)`), focus visible, chargement,
  désactivé, erreur. Jamais une information portée par la seule couleur ou la seule animation.
- Champs à 16 px sur mobile (pas de zoom iOS). Ne jamais désactiver le zoom.
- Clavier : tout est atteignable, Escape ferme, le focus revient au déclencheur.
- Réutilisez les jetons de `src/app/globals.css` ; n'ajoutez pas de système parallèle.

### Mobile (mobile-native)

- Survols uniquement sous `@media (hover: hover) and (pointer: fine)` ; retour d'appui sur
  `:active`, pas au `click`. `touch-action: manipulation` sur les contrôles.
- `100dvh` pour une interface plein écran, `100svh` pour un visuel d'accueil ; jamais `100vh`.
- Champs à 16 px minimum ; jamais `user-scalable=no` ni `maximum-scale=1`.
- `user-select: none` seulement sur les contrôles, jamais sur le texte.
- `env(safe-area-inset-*)` seulement avec `viewport-fit=cover` ; une `theme-color` par thème.
- Décidez selon les capacités (`hover`, `pointer`), jamais selon l'agent utilisateur.
- L'émulation ne prouve rien pour l'appui, le défilement élastique ou le clavier : dites si le
  rendu a été vu sur un vrai téléphone.

## 5 bis. Données extrêmes (break-ui)

Avant de déclarer une page ou un composant prêt, essayez-le avec des valeurs réalistes extrêmes,
pas du charabia : un nom très long, un e-mail sans coupure possible, un nom d'une lettre, un
champ facultatif vide, 0, 1 et beaucoup d'éléments, un prix à 7 chiffres, des accents et des
émojis. Corrections habituelles :

- `min-width: 0` sur la colonne de texte (`minmax(0, 1fr)` en grille), `flex-shrink: 0` sur
  les icônes, badges et actions de fin de ligne ; `overflow-wrap: anywhere` pour e-mails et URL.
- Chiffres en `tabular-nums`, formatés avec `Intl.NumberFormat` ; pluriels avec
  `Intl.PluralRules` (jamais « 1 membres »).
- Ne tronquez jamais un montant, une date ou ce que l'utilisateur compare. Tronquer un texte
  impose un moyen de le lire en entier.
- Un état vide explique la prochaine action ; un champ manquant n'affiche pas un « — » orphelin.

## 6. Avant de demander une publication

1. Appelez `validate_page`. Corrigez toutes les erreurs ; traitez ou justifiez chaque
   avertissement.
2. Passez la liste `review` à l'utilisateur. Ne la cochez pas à sa place.
3. Dites quels contrôles vous avez faits et lesquels vous n'avez pas pu faire.
4. Ne contournez jamais une permission, une validation, un aperçu ou une confirmation pour
   appliquer cette skill. Si une règle vous bloque, arrêtez-vous et expliquez pourquoi.

## 7. Modifications limitées

Modifiez seulement ce qui est demandé. Pour changer un texte, utilisez
`update_page_section` ; ne réécrivez pas la page entière. Toute écriture crée une nouvelle
version ; rien n'est écrasé. Passez la version lue (`base_version`) : si la page a changé
entre-temps, relisez-la au lieu de réessayer à l'aveugle.
