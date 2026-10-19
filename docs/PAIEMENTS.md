# Paiements des ventes — liens SasPay manuels

Source de vérité : sections 11 et 29 du cahier des charges. Ce document décrit ce qui est
réellement construit et ce qui reste bloqué.

## Principe

- Le vendeur crée **lui-même** un lien de paiement dans **son** compte SasPay (montant fixe, devise),
  copie l'adresse publique et la colle sur son produit dans Tunnels IA.
- La plateforme **ne demande aucune clé API SasPay**, n'a **aucun bouton « Connecter SasPay »** et
  **n'appelle jamais l'API SasPay** pour les ventes des vendeurs. L'argent va directement sur le
  compte du vendeur ; la plateforme ne l'encaisse ni ne le reverse.
- L'ancienne intégration CinetPay (qui demandait les identifiants API du vendeur) est **retirée du
  code**. Les données existantes (comptes chiffrés, commandes) sont **conservées** en base, sans
  aucun appel ; leur suppression éventuelle demande une autorisation explicite.

## Ce qui fonctionne (testé)

| Élément | Preuve |
| --- | --- |
| Lien collé : HTTPS obligatoire, domaine exact parmi ceux listés par l'administrateur, pas d'identifiants dans l'URL, fragment retiré | `integration/payments.test`, `e2e/payments.spec` |
| Prix et devise attendus + case « je confirme qu'ils sont identiques au lien SasPay » ; tout changement efface la confirmation | `integration/payments.test` |
| Publication bloquée si le produit d'un formulaire n'a pas de lien prêt | `integration/payments.test` |
| Formulaire acheteur (prénom, nom, e-mail, téléphone facultatif ou requis) validé côté serveur, limite par IP | `integration/payments.test`, `e2e/payments.spec` |
| Commande `pending` (produit, prix, devise, page, variante, UTM) puis redirection 303 vers le lien **enregistré sur le produit** (jamais une URL venant du navigateur) | `e2e/payments.spec` |
| Adresse de notification unique par espace (jeton aléatoire de 32 caractères), rotation possible | `integration/payments.test` |
| Secret de signature collé par le vendeur, chiffré (AES-256-GCM), jamais réaffiché ; refus d'une valeur qui ressemble à une clé API `sk_live`/`sk_test` | `integration/payments.test` |
| Notifications reçues : corps brut et en-têtes de signature stockés **avant tout**, doublons (relances) stockés une fois, adresse inconnue → 404 | `integration/payments.test`, `e2e/payments.spec` |
| File « à rapprocher » et confirmation **manuelle** par le propriétaire ou un administrateur de l'espace, avec attestation et trace | `integration/payments.test`, `e2e/payments.spec` |
| Le retour navigateur, un clic ou une notification non vérifiée ne marquent **jamais** une commande payée | `integration/payments.test` |

## Bloqué : vérification et rapprochement automatiques

La documentation officielle (`docs.saspay.me` : webhooks, OpenAPI, liens de paiement) **n'a pas pu être
lue** depuis l'environnement de développement (domaine refusé par la politique réseau). Sans elle :

- le **format de signature** (en-têtes, chaîne signée, encodage, tolérance de temps) est inconnu :
  `SIGNATURE_SCHEME_CONFIRMED = false` dans `src/server/payments/saspay-webhooks.ts`, toute
  notification est marquée `scheme_unconfirmed` ;
- le **contenu exact de `transaction.success`** est inconnu : rien ne permet aujourd'hui de relier une
  transaction à une commande précise (identifiant de lien, métadonnées, e-mail de l'acheteur…).

Conséquences, volontaires : **aucune** commande n'est marquée payée automatiquement, **aucune**
livraison automatique, **aucun** événement Meta `Purchase`. Le vendeur confirme lui-même après
vérification dans son tableau de bord SasPay.

Pour débloquer : autoriser `docs.saspay.me` dans la politique réseau, lire la page Webhooks et
l'OpenAPI, puis tester avec une vraie notification de test (`webhook.test`) et un paiement de test.
Si le payload ne contient ni référence du lien ni métadonnées exploitables, demander à SasPay de
les ajouter ; ne pas contourner par un appel API (interdit).

## Domaine des liens

Le domaine réel des liens SasPay n'a pas pu être confirmé. Aucun domaine n'est codé en dur :
l'administrateur le renseigne dans **Administration → Paramètres** après avoir vérifié l'adresse
d'un vrai lien. Tant qu'il est vide, aucun lien n'est accepté.
