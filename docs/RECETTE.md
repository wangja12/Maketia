# Recette : critères d'acceptation

Chaque critère du cahier des charges, avec la preuve automatisée qui le vérifie.
« Vérifié » signifie : un test automatisé passe sur la version actuelle (bureau et mobile pour
les tests e2e, sauf mention). Les limites réelles sont indiquées sans les masquer.

Commandes : `pnpm test` (unitaires et intégration, PostgreSQL), `pnpm build && pnpm test:e2e`
(Playwright, build de production).

| # | Critère | État | Preuve |
| --- | --- | --- | --- |
| 1 | Créer un compte | Vérifié | `e2e/funnels.spec` (inscription), `integration/auth.test` |
| 2 | Créer un projet (tunnel) | Vérifié | `e2e/funnels.spec` |
| 3 | Décrire son offre | Vérifié | `e2e/mcp.spec` (fiche de l'offre), `integration/pages.test` |
| 4 | Un agent IA externe crée une page via MCP | Vérifié | `e2e/mcp.spec` (client MCP réel en HTTP) ; Claude Code CLI connecté manuellement |
| 5 | Variantes indépendantes | Vérifié | `integration/pages.test`, `integration/mcp.test`, `e2e/analytics.spec` |
| 6 | Modifier texte et couleur dans l'éditeur | Vérifié | `e2e/editor.spec` |
| 7 | Modifications persistantes après rechargement | Vérifié | `e2e/editor.spec` |
| 8 | Prévisualiser une version | Vérifié | `e2e/editor.spec`, `e2e/mcp.spec` (aperçu bureau/tablette/mobile) |
| 9 | Publier une page | Vérifié | `e2e/publish.spec` (sous-domaine réel `*.localhost`) |
| 10 | Connecter un domaine (infrastructure configurée) | Partiel | `e2e/publish.spec` : instructions et vérification DNS réelles ; HTTPS d'un vrai domaine non testé (aucun hébergeur) |
| 11 | Coller un lien SasPay sans clé API, payer en test | Partiel | `e2e/payments.spec` : lien collé, prix confirmé, acheteur redirigé vers le lien du vendeur ; **page SasPay et paiement réel non testés** (pas de compte, documentation inaccessible) |
| 12 | Un paiement confirmé met à jour la commande | Partiel | Confirmation **manuelle** du vendeur testée (`integration/payments.test`, `e2e/payments.spec`) ; confirmation par webhook **bloquée** (format de signature et payload non vérifiés, voir PAIEMENTS.md) |
| 13 | Visites et conversions mesurées | Vérifié | `e2e/analytics.spec`, `integration/experiments.test` |
| 14 | Tests A/B comparant des variantes | Vérifié | `e2e/analytics.spec`, `unit/stats.test` |
| 15 | Contacts dans le CRM | Vérifié | `e2e/crm.spec`, `integration/crm.test` |
| 16 | Données isolées entre utilisateurs | Vérifié | `e2e/funnels.spec`, tests d'isolation de chaque module d'intégration |
| 17 | Erreurs des services externes gérées proprement | Vérifié | `integration/payments.test` (échec d'initialisation, refus), `e2e/payments.spec` (paiement refusé), `e2e/publish.spec` (DNS) |
| 18 | Clavier et mobile | Vérifié | `e2e/quality.spec` (axe WCAG 2.1 AA sur 17 écrans, 360 px sans défilement horizontal), `e2e/editor.spec` (raccourcis clavier), projet mobile |
| 19 | Animations et réduction des mouvements | Vérifié | `e2e/quality.spec` (mouvement supprimé avec `prefers-reduced-motion`) |
| 20 | Aucune relance commerciale par e-mail | Vérifié | `integration/architecture.test` (aucune bibliothèque d'e-mail, aucun SDK d'IA) |

## Cahier des charges SasPay / livraison (20/10/2026)

| Critère | État | Preuve |
| --- | --- | --- |
| 18. Fichier non accessible par une URL durable ou devinable ; lien sécurisé pour l'acheteur autorisé | Vérifié | `integration/files.test`, `e2e/payments.spec` |
| 19. E-mails de livraison envoyés une fois avec reprises | **Bloqué** : aucun prestataire d'e-mails ; le vendeur transmet le lien lui-même | — |
| 25. Outils MCP soumis aux confirmations | Vérifié | `integration/mcp.test`, `e2e/mcp.spec` |
| 26. Skill de design versionnée et lisible via MCP | Vérifié (1.1.0) | `integration/mcp.test`, `e2e/mcp.spec` |

## Sécurité (phase 8)

| Contrôle | Preuve |
| --- | --- |
| CSP par nonce, en-têtes de sécurité, aucune violation CSP en usage | `e2e/quality.spec` |
| Limites de tentatives de connexion (par compte et par IP) | `integration/auth.test` |
| Liens et images de page : pas de `javascript:`, `data:`, `//hôte` | `unit/security.test` |
| Texte des pages rendu comme texte (pas d'injection HTML) | `unit/security.test` |
| Pas de redirection ouverte après un formulaire public | `unit/security.test` |
| Export CSV protégé contre l'injection de formules | `integration/crm.test` |
| Configuration de production dangereuse refusée | `unit/security.test`, `pnpm check:prod` |
| Administration invisible et refusée aux utilisateurs | `integration/admin.test`, `e2e/crm.spec` |
| Quotas impossibles à contourner par un agent | `integration/mcp.test` |
| Dépendances de production sans vulnérabilité connue | `pnpm audit --prod` (2 alertes en outils de développement uniquement : `esbuild` via drizzle-kit, `braces` via eslint, non livrés) |

## Performance

`e2e/quality.spec` impose des budgets sur le build de production : temps de réponse serveur
< 500 ms, taille du HTML et du JavaScript. Mesure actuelle de la page publiée : ~460 Ko de
JavaScript décodé (~175 Ko gzip), presque entièrement l'exécution de Next.js et React.
Pour les connexions mobiles lentes, une piste est de servir les pages publiées en HTML
statique sans hydratation ; non réalisée.
