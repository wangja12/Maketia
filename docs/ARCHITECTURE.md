# Architecture — Tunnels IA

## Vue d'ensemble

Une seule application Next.js 16 (App Router, TypeScript) contient l'interface et le serveur.
Toute règle métier vit dans `src/server/` : l'interface web, les futures routes API et le futur
serveur MCP appellent ces mêmes fonctions. Aucune voie ne contourne les autorisations.

```
src/
  app/                 Pages, layouts et Server Actions (couche fine : session → service → réponse)
    (auth)/            Inscription, connexion, déconnexion
    app/[workspaceId]/ Espace de travail : tableau de bord des tunnels
  server/              Services métier, sans dépendance à Next (testables directement)
    accounts.ts        Inscription, vérification des identifiants (argon2id)
    sessions.ts        Sessions en base (jeton aléatoire, seul son SHA-256 est stocké)
    workspaces.ts      Appartenance et rôles : requireMembership() est le point de contrôle unique
    funnels.ts         CRUD des tunnels, toujours filtré par espace de travail
  db/                  Schéma Drizzle et connexion PostgreSQL
  components/ui/       Système de design (boutons, champs, dialogue, badges)
  lib/                 Glue Next : cookies de session, conversion des erreurs en état de formulaire
  proxy.ts             Redirection optimiste vers /connexion (sans base ; chaque page revérifie)
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
| `funnels` | id, workspace_id, name, slug, status (`draft`/`published`/`archived`), updated_at | slug unique par espace |

Rôles : `viewer` lit ; `editor` lit et modifie ; `owner`/`admin` peuvent aussi supprimer.

Tables prévues pour les phases suivantes (non créées) : `pages`, `page_versions` (structure JSON
validée et versionnée), `variants`, `experiments`, `events`, `contacts`, `orders`, `payments`,
`payment_providers`, `domains`, `plans`, `subscriptions`, `usage`, `audit_log`, `mcp_tokens`.

## Système de design

Défini dans `src/app/globals.css`, appliqué avec les principes du skill `emil-design-eng`
(Emil Kowalski) et du skill `animate`, lus depuis `emilkowalski/skill` :

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
| Fournisseur IA (génération structurée) | 2 | Clé API et choix du fournisseur |
| Stockage objet compatible S3 | 2–3 | Bucket et identifiants |
| Hébergement, sous-domaines, domaines personnalisés, SSL | 4 | Domaine du produit, compte Vercel ou équivalent |
| CinetPay / PayDunya (paiements des clients finaux) | 5 | Comptes marchands, vérification pays, devises, webhooks |
| Abonnements du SaaS | 7 | Prestataire disponible dans le pays d'exploitation |
| PostHog ou équivalent | 6 | Projet et clé, politique de consentement |

Aucune de ces intégrations n'est simulée. Elles seront construites derrière une interface commune
(adaptateurs) quand les comptes seront disponibles.

Exclusion permanente : aucun e-mail marketing, aucune relance commerciale par e-mail.

## Plan priorisé

1. **Fondations** (cette livraison) — voir l'état ci-dessous.
2. Génération IA : formulaire guidé, schéma de page versionné et validé (zod), 2 à 4 variantes, aperçu.
3. Éditeur visuel : édition directe, sections, annuler/rétablir, sauvegarde automatique, historique.
4. Publication : sous-domaine, aperçu privé, versions publiées, domaines et DNS.
5. Paiements : premier prestataire africain éligible, commandes, webhooks vérifiés.
6. Analytics et tests A/B (2 à 4 variantes).
7. CRM, abonnements, quotas, administration, coûts IA, serveur MCP.
8. Qualité et lancement.

## État des fonctionnalités

### Terminées et vérifiées

- Inscription (nom, e-mail, mot de passe ≥ 10 caractères) avec création d'un espace dont l'utilisateur est propriétaire.
- Connexion, déconnexion, sessions en base, expiration à 30 jours, accès à `/app` refusé sans session.
- Isolation des espaces : lecture, création, renommage et suppression refusés hors de son espace (404).
- Rôles `owner`/`admin`/`editor`/`viewer` appliqués côté serveur.
- Tableau de bord : créer, renommer, supprimer (avec confirmation) un tunnel ; slug unique par espace.
- Système de design : jetons, boutons avec états (survol, appui, focus, chargement, désactivé), champs avec erreurs accessibles, dialogue modal clavier.
- Vérifié par : 12 tests d'intégration (Vitest + PostgreSQL), 8 tests de bout en bout (Playwright, bureau et mobile), `tsc`, ESLint, build de production.

### En cours

- Rien : la phase 1 est fermée.

### Bloquées ou à décider

- Limitation du nombre de tentatives de connexion : à ajouter avant la mise en production (phase 8, ou plus tôt si l'application est exposée publiquement).
- Suppression de compte, profil, invitation de membres : écrans non construits (le modèle de rôles est prêt).
- Choix du fournisseur IA et clé API : nécessaires pour démarrer la phase 2.
- Domaine du produit, hébergeur, comptes CinetPay / PayDunya : nécessaires pour les phases 4 et 5.
