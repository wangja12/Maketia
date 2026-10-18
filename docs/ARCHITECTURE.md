# Architecture — Tunnels IA

## Vue d'ensemble

Une seule application Next.js 16 (App Router, TypeScript) contient l'interface et le serveur.
Toute règle métier vit dans `src/server/` : l'interface web et le serveur MCP appellent ces
mêmes fonctions. Aucune voie ne contourne les autorisations.

**Aucune IA n'est intégrée.** Le SaaS n'appelle aucun fournisseur de modèles et ne demande
aucune clé d'API d'IA. L'IA est celle du client MCP de l'utilisateur (voir [MCP.md](MCP.md)).
Le test `tests/integration/architecture.test.ts` échoue si un SDK ou une API de modèle
apparaît dans le code ou les dépendances.

```
src/
  app/                 Pages, layouts et Server Actions (couche fine : session → service → réponse)
    (auth)/            Inscription, connexion, déconnexion
    app/[workspaceId]/ Espace : tunnels, fiche, pages (aperçu, historique), agents IA
    api/mcp/           Point d'entrée MCP (Streamable HTTP, jeton porteur)
    preview/[pageId]/  Aperçu privé d'une version de page (rendu réel, iframe responsive)
    s/[site]/, d/[host]/  Pages publiées (sous-domaine, domaine vérifié), sans compte
  server/              Services métier, sans dépendance à Next (testables directement)
    accounts.ts        Inscription, vérification des identifiants (argon2id)
    sessions.ts        Sessions en base (jeton aléatoire, seul son SHA-256 est stocké)
    workspaces.ts      Appartenance et rôles : requireMembership() est le point de contrôle unique
    funnels.ts         CRUD des tunnels et fiche de l'offre, toujours filtrés par espace
    page-schema.ts     Format de page v1 (zod) : thème + sections, texte brut, URL sûres
    pages.ts           Pages, versions immuables, conflits, sections, variantes (4 max)
    page-validation.ts Contrôles déterministes avant publication + revue humaine
    mcp/server.ts      Outils MCP : quota, droits, skill obligatoire, audit à chaque appel
    mcp-tokens.ts      Jetons MCP (hachés, révocables), limite de débit, journal
    design-skill.ts    Lecture de la skill versionnée wang-design-engineering
    publishing.ts      Publication (instantané d'une version), historique, sous-domaines, résolution publique
    domains.ts         Domaines personnalisés : vérification DNS réelle (TXT + CNAME/A)
    site-config.ts     APP_URL, PUBLIC_ROOT_DOMAIN, PUBLIC_DOMAIN_TARGET
  db/                  Schéma Drizzle et connexion PostgreSQL
  components/ui/       Système de design (boutons, champs, dialogue, badges)
  components/page-renderer.tsx  Rendu des pages, partagé par l'aperçu et l'éditeur (container queries)
  editor/              Éditeur visuel : état pur (annuler/rétablir), texte éditable, panneaux, blocs
  lib/                 Glue Next : cookies de session, conversion des erreurs en état de formulaire
  proxy.ts             Routage par nom d'hôte vers les sites publiés + redirection optimiste vers /connexion
skills/wang-design-engineering/  Skill obligatoire pour les agents (source : emilkowalski/skills)
drizzle/               Migrations SQL versionnées
tests/integration/     Vitest sur une vraie base PostgreSQL
tests/e2e/             Playwright (bureau + mobile) sur le build de production
```

### Choix et raisons

| Choix | Raison |
| --- | --- |
| Next.js 16, Server Actions | Une seule base de code ; les mutations passent par le serveur. `cacheComponents` désactivé : tout le tableau de bord dépend de l'utilisateur, le rendu dynamique classique est plus simple. |
| PostgreSQL + Drizzle | Schéma typé, migrations SQL lisibles, pas de moteur binaire supplémentaire. |
| Sessions en base (modèle Lucia), argon2id | Révocables immédiatement (déconnexion, suspension), aucun fournisseur externe nécessaire. Le cookie est `httpOnly`, `SameSite=Lax`, `Secure` en production. |
| Isolation au niveau service | Chaque fonction de `src/server/` reçoit `userId` et vérifie l'appartenance. Un non-membre reçoit « introuvable » (404), jamais « interdit », pour ne pas révéler l'existence d'un espace. |
| Pas de bibliothèque de composants | La phase 1 n'a besoin que de 6 composants ; le `<dialog>` natif fournit piège à focus, Escape et arrière-plan inerte. |

## Schéma initial

| Table | Colonnes clés | Contraintes |
| --- | --- | --- |
| `users` | id (uuid), email (unique, minuscules), name, password_hash | |
| `sessions` | id = SHA-256 du jeton, user_id, expires_at | cascade sur suppression utilisateur |
| `workspaces` | id, name | |
| `workspace_members` | workspace_id, user_id, role (`owner`/`admin`/`editor`/`viewer`) | clé primaire composée |
| `funnels` | id, workspace_id, name, slug, status (`draft`/`published`/`archived`), brief (jsonb validé), subdomain, updated_at | slug unique par espace ; subdomain unique sur la plateforme |
| `pages` | id, funnel_id, name, kind, variant_group_id, variant_label (A–D), current_version | label unique par groupe ; 4 pages max par groupe (verrou consultatif) |
| `page_versions` | page_id, version, content (jsonb v1), author_kind (`user`/`agent`), author_user_id, mcp_token_id, note | immuable, clé (page_id, version) |
| `mcp_tokens` | id, workspace_id, user_id, name, token_hash (SHA-256), access (`read`/`write`), last_used_at, revoked_at | |
| `publications` | funnel_id, page_id, version, path, published_by, created_at, unpublished_at | jamais supprimée (historique) ; une seule ligne en ligne par (tunnel, adresse) via index partiel |
| `domains` | workspace_id, funnel_id, hostname, verification_token, status (`pending`/`verified`/`misconfigured`), last_error, last_checked_at | un seul espace peut détenir un nom vérifié (index partiel) |
| `mcp_audit_log` | token_id, workspace_id, user_id, tool, resource_id, ok, error, created_at | sert aussi au calcul de la limite de débit |

Rôles : `viewer` lit ; `editor` lit et modifie ; `owner`/`admin` peuvent aussi supprimer.

Tables prévues pour les phases suivantes (non créées) : `experiments`,
`events`, `contacts`, `orders`, `payments`, `payment_providers`, `domains`, `plans`,
`subscriptions`, `usage`.

## Système de design

Défini dans `src/app/globals.css`. Les règles sont formalisées dans la skill versionnée
[`skills/wang-design-engineering/SKILL.md`](../skills/wang-design-engineering/SKILL.md),
tirée de `emilkowalski/skills` (commit `2d22863`, MIT) ; sources et procédure de mise à jour
dans [SOURCE.md](../skills/wang-design-engineering/SOURCE.md). Elle s'impose au code du
produit et aux agents MCP :

- Couleurs : neutres chauds et un seul accent vert ; variantes sombres via `prefers-color-scheme`.
  Un statut a toujours un libellé texte, jamais une couleur seule.
- Typographie : échelle 1.2 autour d'un corps de 15 px ; champs en 16 px sur mobile (pas de zoom iOS).
- Rayons : 8 px (contrôles), 12 px (cartes), 14 px (fenêtres).
- Mouvement : `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`.
  - Appui sur un bouton : `scale(0.97)`, 140 ms, `transform` uniquement (retour d'action).
  - Fenêtre modale : opacité + `scale(0.96 → 1)`, 260 ms en entrée, 160 ms en sortie, origine centrée.
  - Aucune animation sur la liste des tunnels : vue des dizaines de fois par jour.
  - Survols limités à `(hover: hover) and (pointer: fine)` ; `prefers-reduced-motion` retire les
    mouvements et garde les fondus.

## Intégrations externes et dépendances

| Intégration | Phase | Nécessite |
| --- | --- | --- |
| Clients IA externes via MCP | 2 | Rien côté SaaS (jeton porteur) ; OAuth 2.1 pour les connecteurs claude.ai / ChatGPT |
| Stockage objet compatible S3 (logos, images) | 3 | Bucket et identifiants |
| Hébergement, sous-domaines, domaines personnalisés, SSL | 4 | Domaine du produit, compte Vercel ou équivalent |
| CinetPay / PayDunya (paiements des clients finaux) | 5 | Comptes marchands, vérification pays, devises, webhooks |
| Abonnements du SaaS | 7 | Prestataire disponible dans le pays d'exploitation |
| PostHog ou équivalent | 6 | Projet et clé, politique de consentement |

Aucune de ces intégrations n'est simulée. Elles seront construites derrière une interface commune
(adaptateurs) quand les comptes seront disponibles.

Exclusion permanente : aucun e-mail marketing, aucune relance commerciale par e-mail.

## Plan priorisé

1. **Fondations** — livrée.
2. **Serveur MCP et pages structurées** — livrée.
3. **Éditeur visuel** — livrée.
4. **Publication** (cette livraison) — voir l'état ci-dessous.
5. Paiements : premier prestataire africain éligible, commandes, webhooks vérifiés.
6. Analytics et tests A/B (2 à 4 variantes).
7. CRM, abonnements, quotas, administration, suivi de l'usage MCP.
8. Qualité et lancement.

## État des fonctionnalités

### Terminées et vérifiées

**Phase 4 — Publication**

- Publication d'une version précise à une adresse du site (accueil ou /mot) ; instantané : les modifications suivantes ne changent rien en ligne avant republication.
- Garde-fous : contrôles bloquants (schéma, contraste) et revue humaine cochée point par point, vérifiés côté serveur ; un agent MCP ne peut pas publier.
- Historique complet des publications ; republier une ancienne version (retour arrière) ; dépublier avec confirmation (404 ensuite) ; une page en ligne ne peut pas être supprimée.
- Sous-domaine unique attribué à la première publication (`<sous-domaine>.PUBLIC_ROOT_DOMAIN`), modifiable, mots réservés refusés ; routage réel par nom d'hôte dans `proxy.ts`. Sans DNS générique : pages servies sous `/s/<sous-domaine>`.
- Domaines personnalisés : instructions TXT + CNAME, vérification DNS réelle à la demande, statut et erreur exacts, domaine servi seulement une fois vérifié et rétrogradé si le DNS change ; un nom vérifié appartient à un seul espace.
- MCP : `get_publication_status` et `preview_page` (lecture seule).
- Vérifié par : 10 tests d'intégration (résolveur DNS simulé dans les tests uniquement), 2 tests e2e dont publication réelle sur `*.localhost` et vérification DNS réelle d'un domaine inexistant.

**Phase 3 — Éditeur visuel (sans IA)**

- Modification directe des textes en cliquant dans l'aperçu (titres, paragraphes, listes, boutons, questions, témoignages).
- Panneau de propriétés selon le type de section : textes, listes (ajout, retrait, ordre), boutons et liens, images par URL, prix, devise.
- Thème : couleur d'accent (sélecteur + hexadécimal, contraste calculé en direct), fond clair/sombre, police.
- Alignement (gauche/centré) et espacement (serré/normal/aéré) par section.
- Sections : bibliothèque de 9 blocs, ajout après la sélection, duplication, suppression, déplacement par boutons, glisser-déposer ou Alt + ↑/↓.
- Aperçu bureau / tablette / mobile dans l'éditeur (container queries) et mode aperçu sans contrôles.
- Annuler / Rétablir (boutons et Ctrl/Cmd + Z, Ctrl/Cmd + Maj + Z, Ctrl + Y), frappes regroupées par champ.
- Sauvegarde automatique après 800 ms, statut réel (enregistré · vN, en attente, enregistrement, erreur avec réessai), Ctrl/Cmd + S, alerte avant de quitter avec des changements non enregistrés.
- Validation en direct avec le schéma du serveur : champ fautif signalé, sauvegarde suspendue tant qu'il reste une erreur.
- Version enregistrée ailleurs (agent MCP, autre onglet) : annoncée par un bandeau, jamais appliquée d'office ; conflit proposé (« garder ma version » ou « charger la leur »), rien n'est écrasé.
- Seules les sections modifiées se re-rendent (sections mémoïsées, mises à jour immuables).
- Vérifié par : 7 tests unitaires de l'état de l'éditeur, 5 tests e2e de l'éditeur (bureau et mobile), dont l'édition concurrente par un agent MCP réel.

**Phase 2 — MCP et pages**

- Fiche de l'offre (formulaire guidé + description libre), validée et lue par les agents.
- Pages structurées (schéma v1 validé côté serveur, sans HTML ni code) créées depuis un modèle sans IA.
- Versions immuables, historique avec auteur (utilisateur ou agent), restauration, conflit détecté au lieu d'écraser.
- Variantes indépendantes A–D, 4 maximum, message explicite à la 5e, sûr en concurrence.
- Aperçu privé réel en bureau / tablette / mobile ; contrôles automatiques et revue humaine affichés.
- Serveur MCP : 23 outils, ressource de skill, jetons hachés révocables, droits plafonnés par le rôle, un espace par jeton, limite de débit, journal consultable.
- Skill `wang-design-engineering` 1.0.0 versionnée, exposée via MCP, exigée par les outils de conception ; absence de la skill signalée et bloquante.
- Aucun SDK ni appel de fournisseur d'IA (test automatique), aucun module d'e-mail marketing.
- Vérifié par : 41 tests d'intégration, 12 tests de bout en bout (dont un client MCP réel en HTTP), Claude Code CLI connecté (« √ Connected »).

**Phase 1 — Fondations**

- Inscription (nom, e-mail, mot de passe ≥ 10 caractères) avec création d'un espace dont l'utilisateur est propriétaire.
- Connexion, déconnexion, sessions en base, expiration à 30 jours, accès à `/app` refusé sans session.
- Isolation des espaces : lecture, création, renommage et suppression refusés hors de son espace (404).
- Rôles `owner`/`admin`/`editor`/`viewer` appliqués côté serveur.
- Tableau de bord : créer, renommer, supprimer (avec confirmation) un tunnel ; slug unique par espace.
- Système de design : jetons, boutons avec états (survol, appui, focus, chargement, désactivé), champs avec erreurs accessibles, dialogue modal clavier.
- Vérifié par : 12 tests d'intégration (Vitest + PostgreSQL), 8 tests de bout en bout (Playwright, bureau et mobile), `tsc`, ESLint, build de production.

### En cours

- Rien : la phase 4 est fermée. Prochaine : phase 5, paiements (premier prestataire africain éligible).

### Bloquées ou à décider

- Limitation du nombre de tentatives de connexion : à ajouter avant la mise en production (phase 8, ou plus tôt si l'application est exposée publiquement).
- Suppression de compte, profil, invitation de membres : écrans non construits (le modèle de rôles est prêt).
- Connecteurs claude.ai et ChatGPT : nécessitent OAuth 2.1 côté serveur MCP (non construit).
- Import de logos et d'images : nécessite un stockage S3 (images par URL https en attendant).
- Choix de police au-delà de « avec / sans empattement » : à décider (polices web hébergées, poids des pages).
- **Mise en ligne réelle** : domaine du produit, DNS générique `*.domaine`, hébergeur. À configurer : `APP_URL`, `PUBLIC_ROOT_DOMAIN`, `PUBLIC_DOMAIN_TARGET`.
- **HTTPS des domaines personnalisés** : délivré par l'hébergeur (ex. API Domains de Vercel). Non intégré tant que l'hébergeur n'est pas choisi ; l'interface ne le présente jamais comme actif.
- **Vérification DNS automatique périodique** : aujourd'hui à la demande (bouton) ; une tâche planifiée est à prévoir avec l'hébergement.
- Comptes CinetPay / PayDunya : nécessaires pour la phase 5.
