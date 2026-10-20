# Source de wang-design-engineering

| Élément | Valeur |
| --- | --- |
| Dépôt officiel | https://github.com/emilkowalski/skills (`emilkowalski/skill` pointe sur le même commit) |
| Commit consulté | `2d228630ba1446365f614a108cb8252f1feda202` (11/10/2026) |
| Date de consultation | 18/10/2026 ; revérifié le 20/10/2026 (`git ls-remote` : HEAD toujours `2d22863`) |
| Licence | MIT, © 2026 Emil Kowalski |
| Installation vérifiée | `npx skills add emilkowalski/skill` : copie locale identique au commit ci-dessus |

## Fichiers réellement lus

| Skill officielle | Utilisation |
| --- | --- |
| `skills/emil-design-eng/SKILL.md` | Lu en entier. Sections 3 et 5 de notre skill. |
| `skills/animate/SKILL.md` et `RECIPES.md` (recette « Modal ») | Lus en entier. Section 4. |
| `skills/review-animations/SKILL.md` | « The Ten Non-Negotiable Standards » lus. Section 4. |
| `skills/animation-performance/SKILL.md` | Lu en entier (v1.1.0). Section 4, « Performance du mouvement ». |
| `skills/break-ui/SKILL.md` | Lu en entier (v1.1.0). Section 5 bis. `CATALOG.md` non lu. |
| `skills/mobile-native/SKILL.md` | « Symptom Table », « Baseline » et « Never Ship » lus (v1.1.0). Section 5, « Mobile ». |
| `skills/pick-ui-library/SKILL.md` | Lu en entier. Ne s'active que sur demande explicite ; mentionnée en section 1, aucune règle imposée. |
| `skills/improve-animations`, `skills/find-animation-opportunities` | Règles « Hard Rules » lues : ce sont des audits en lecture seule ; non repris comme règles. |

Aucun fichier du dépôt tiers n'est copié dans ce projet : notre skill reformule les principes
et renvoie à la source. Les autres skills du dépôt (`animate-expo`, `write-swift`,
`apple-design`, …) ne s'appliquent pas à ce produit web.

## Limites

- Le serveur ne peut pas obliger un client IA tiers à suivre une instruction. Il exige
  `skill_version` sur les outils d'écriture (preuve que la skill a été récupérée, pas qu'elle a
  été appliquée), valide ce qui est objectif et laisse une revue humaine pour le reste.
- Le format de page v1 n'a pas d'animation : les règles de mouvement concernent le code de
  l'interface du produit.

## Procédure de mise à jour

1. `git ls-remote https://github.com/emilkowalski/skills HEAD` pour connaître le dernier commit.
2. Lire le diff entre `2d22863` et ce commit pour les skills listées ci-dessus, et vérifier la
   licence.
3. Reporter les changements pertinents dans `SKILL.md`. Augmenter `version` (majeure si une
   règle bloquante change) et mettre à jour `source_commit` et ce fichier.
4. Mettre à jour `DESIGN_SKILL_VERSION` dans `src/server/design-skill.ts`, puis lancer
   `pnpm test` : les tests vérifient que les deux versions concordent.
