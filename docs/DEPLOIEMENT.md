# Déploiement en production

Ce document décrit une mise en ligne réelle. Rien ici n'a encore été exécuté sur une
infrastructure de production : il n'existe ni domaine, ni hébergeur, ni compte marchand
configurés à ce jour. Chaque étape indique ce qui doit être vérifié sur place.

## 1. Prérequis

| Élément | Pourquoi |
| --- | --- |
| Node.js 22 et pnpm 10 | Build et exécution (`next start`) |
| PostgreSQL 16, sauvegardé | Toutes les données, y compris les sessions et la mesure d'audience |
| Un domaine pour l'application, ex. `app.exemple.com` | `APP_URL`, HTTPS obligatoire |
| Un domaine pour les pages publiées, ex. `pages-exemple.com`, avec un DNS générique `*.pages-exemple.com` vers l'hébergeur | `PUBLIC_ROOT_DOMAIN` |
| Un nom cible pour les domaines des clients, ex. `cname.pages-exemple.com` | `PUBLIC_DOMAIN_TARGET` (CNAME des clients) |
| HTTPS automatique pour le domaine générique et pour chaque domaine client vérifié | Délivré par l'hébergeur (non intégré dans l'application) |
| Un compte marchand CinetPay par pays (bac à sable puis production) | Paiements (voir [PAIEMENTS.md](PAIEMENTS.md)) |

Un domaine distinct pour les pages publiées est recommandé : les pages des clients ne
partagent alors aucun cookie avec l'application.

## 2. Variables d'environnement

| Variable | Obligatoire | Valeur |
| --- | --- | --- |
| `DATABASE_URL` | oui | URL PostgreSQL de production |
| `APP_URL` | oui | `https://app.exemple.com` (sans `/` final) |
| `PUBLIC_ROOT_DOMAIN` | recommandé | `pages-exemple.com` |
| `PUBLIC_DOMAIN_TARGET` | recommandé | `cname.pages-exemple.com` |
| `PAYMENT_SECRETS_KEY` | pour les paiements | `openssl rand -base64 32` — **à sauvegarder** : sans elle, les identifiants marchands enregistrés sont illisibles |
| `ANALYTICS_SECRET` | pour la mesure | `openssl rand -base64 48` |
| `NODE_ENV` | oui | `production` (active la CSP et HSTS) |

Interdites en production (le contrôle les refuse) : `ALLOW_PROVIDER_BASE_URL_OVERRIDE`,
`CINETPAY_BASE_URL`, et un `TEST_DATABASE_URL` égal à `DATABASE_URL`.

Aucune clé d'API d'IA n'est nécessaire ni lue : la plateforme n'exécute aucun modèle.

## 3. Mise en ligne

Dans l'ordre :

```bash
pnpm install --frozen-lockfile
pnpm db:migrate                 # applique drizzle/*.sql sur DATABASE_URL
pnpm build
pnpm check:prod                 # doit afficher « Configuration de production valide. »
pnpm start                      # derrière le proxy HTTPS de l'hébergeur
```

Puis, une seule fois, après avoir créé votre compte sur `/inscription` :

```bash
pnpm admin:grant vous@exemple.com
```

Dans l'administration (`/admin/plans`), définissez les plans, leurs prix et leurs limites.
Le plan par défaut créé par la migration est illimité et sans prix.

`pnpm check:prod` sort en erreur (code 1) si la configuration est dangereuse ou incomplète,
si des migrations manquent, ou s'il n'y a pas de plan par défaut. Au démarrage, le serveur
écrit les mêmes erreurs et avertissements dans ses journaux (`[config] …`).

## 4. Proxy, IP des clients et en-têtes

- Les limites anti-abus (connexion, formulaires de commande et de contact) utilisent l'IP lue
  dans `X-Forwarded-For`. **Le proxy de l'hébergeur doit remplacer cet en-tête**, pas le
  compléter avec la valeur envoyée par le client ; sinon un attaquant peut le falsifier et
  contourner les limites. À vérifier chez l'hébergeur choisi.
- L'application envoie elle-même : une Content-Security-Policy avec nonce par requête,
  `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Permissions-Policy` et `Strict-Transport-Security` (sans `includeSubDomains`, car des
  domaines de clients sont servis). Ne les supprimez pas au niveau du proxy.
- Toutes les pages sont rendues à la demande (nécessaire à la CSP par nonce) : un cache CDN
  ne doit pas mettre en cache le HTML.

## 5. Paiements

- Webhook à déclarer chez CinetPay : `https://app.exemple.com/api/webhooks/cinetpay`.
- Retour du client : `https://app.exemple.com/paiement/retour`.
- Commencer en bac à sable, suivre la procédure de [PAIEMENTS.md](PAIEMENTS.md) avant de
  passer un compte en production. L'intégration n'a pas encore été testée contre CinetPay réel.

## 6. Surveillance

- `GET /api/health` : `200 {"status":"ok"}` si la base répond, `503` sinon. À brancher sur la
  surveillance de disponibilité de l'hébergeur.
- Administration → MCP : appels des agents, erreurs, durées. → Diagnostics : domaines non
  vérifiés, erreurs de paiement.
- Journaux du serveur : erreurs inattendues (`console.error`), problèmes de configuration.

## 7. Sauvegardes et retour arrière

- Sauvegarde quotidienne de PostgreSQL au minimum, conservée hors de l'hébergeur ; tester une
  restauration avant le lancement.
- Sauvegarder `PAYMENT_SECRETS_KEY` séparément de la base (coffre de secrets).
- Retour arrière applicatif : redéployer la version précédente. Les migrations n'ont pas de
  script de retour : avant chaque migration, sauvegarde de la base ; en cas de problème,
  restauration de cette sauvegarde et redéploiement de la version précédente.

## 8. Vérifications après déploiement

1. `pnpm check:prod` sans erreur, `GET /api/health` → 200.
2. Créer un compte, un tunnel, une page ; la publier ; l'ouvrir sur `<sous-domaine>.PUBLIC_ROOT_DOMAIN` en HTTPS.
3. Vérifier dans les outils du navigateur : en-tête `Content-Security-Policy` présent, aucune
   violation CSP dans la console.
4. Formulaire de contact : un envoi apparaît dans Contacts.
5. Domaine client de test : instructions DNS, vérification, HTTPS délivré par l'hébergeur.
6. Paiement en bac à sable CinetPay de bout en bout (PAIEMENTS.md).
7. Connecter un client MCP (Claude Code ou autre) avec un jeton de l'espace (MCP.md).
8. Fermer puis rouvrir les inscriptions depuis `/admin/parametres`.
