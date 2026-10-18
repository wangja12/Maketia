# Paiements

## Principe

- Les clients finaux paient sur le **compte marchand de l'utilisateur** (CinetPay pour l'instant).
  La plateforme n'encaisse pas pour le compte des vendeurs : aucun partage de fonds n'est supposé.
- Le montant vient toujours du **produit** enregistré côté serveur, jamais de la page ni du navigateur.
- Une commande devient **payée** uniquement quand l'API du prestataire (`GET /v1/payment/{id}`)
  répond `SUCCESS`. Une redirection du navigateur ou le contenu d'un webhook ne suffisent jamais.
- Les abonnements au SaaS (phase 7) sont un autre flux, non traité ici.
- Aucun e-mail n'est envoyé aux acheteurs (exclusion des relances commerciales).

## Parcours

1. **Paiements → Prestataire** : pays du compte, environnement (bac à sable / production), `api_key`,
   `api_password`. Chiffrés (AES-256-GCM, `PAYMENT_SECRETS_KEY`), jamais réaffichés.
   **Vérifier la connexion** fait un vrai `POST /v1/oauth/login`.
2. **Produits** : nom, prix entier, devise (XOF, XAF, GNF, CDF).
3. **Éditeur** : section « Commande et paiement », choix du produit.
4. **Publication** : refusée si le produit n'existe pas, est désactivé ou si aucun compte vérifié
   n'encaisse dans sa devise.
5. **Achat** : formulaire HTML (sans JavaScript) → `POST /api/checkout` → commande `pending` +
   `POST /v1/payment` → redirection vers la page de paiement CinetPay.
6. **Notification** : `POST /api/webhooks/cinetpay`. Authentifiée par le `notify_token` reçu à
   l'initialisation (seul son SHA-256 est stocké, comparaison en temps constant), puis contrôle du
   statut par l'API. Rejouer une notification ne change rien ; `paid` n'est jamais rétrogradé.
7. **Retour** : `/paiement/retour?commande=…` relit le statut chez le prestataire ; « Paiement
   confirmé » seulement après `SUCCESS`. Aucune donnée personnelle n'y est affichée.
8. **Tableau de bord** : commandes, statut, historique (`payment_events`), revérification manuelle.

Limites : 10 tentatives de commande par IP (hachée) et par 10 minutes. Remboursements non pris en
charge par l'API utilisée : à faire depuis l'espace marchand.

## État de l'intégration CinetPay

| Élément | État |
| --- | --- |
| Source | SDK PHP officiel `github.com/cinetpay/cinetpay-php-sdk`, commit `422244a` (11/08/2026, MIT) |
| API | `https://api.cinetpay.net` (bac à sable), `https://api.cinetpay.co` (production) ; un compte par pays |
| Client TypeScript | `src/server/payments/cinetpay.ts`, mêmes requêtes, validations et renouvellement de jeton que le SDK |
| Tests | Scénarios du SDK rejoués (`tests/unit/cinetpay.test.ts`) ; parcours complet e2e contre un **simulateur local** (`tests/e2e/mock-cinetpay.mjs`) |
| **Testé contre CinetPay réel** | **Non.** `docs.cinetpay.com` et les API CinetPay étaient inaccessibles depuis l'environnement de développement, et aucun compte marchand n'était disponible. |

### Procédure de test réel (à faire avant la production)

1. Obtenir un compte CinetPay bac à sable pour un pays (ex. Côte d'Ivoire) et son couple `api_key` / `api_password`.
2. Déployer avec `APP_URL` en HTTPS public (CinetPay doit joindre `/api/webhooks/cinetpay`) et `PAYMENT_SECRETS_KEY`.
3. Paiements → enregistrer le compte → **Vérifier la connexion** (doit afficher « Connexion vérifiée »).
4. Créer un produit, une page avec un formulaire de commande, publier.
5. Payer avec un moyen de test CinetPay ; vérifier dans **Commandes** : « Payée (confirmée) » et
   l'événement « Notification reçue (authentifiée) ». Tester aussi un refus.
6. Comparer avec l'espace marchand CinetPay (référence `TIA…` = `merchant_transaction_id`).

## PayDunya

Évalué comme second prestataire possible, **non intégré** : documentation et API inaccessibles
depuis l'environnement de développement, rien n'a donc pu être vérifié. L'interface
`PaymentGateway` (`src/server/payments/gateway.ts`) permet de l'ajouter sans toucher au parcours d'achat.
