# Rapport — validation de Maketia par les agents du founder pack

Skill utilisé : `founder-skill` (Jakeschincariol, MIT), installé dans `.claude/skills/founder-*`.
Tout ce qui suit vient d'**agents simulés**. Ces résultats servent à trouver les objections et les points faibles, pas à prédire les ventes réelles.

## Les agents mobilisés

| Rôle | Agents | Résultat |
| --- | ---: | --- |
| Conseil (lentilles Offers, Monopoly, Product), deux séances | 3 | 1re séance : 3 FUND IF, moyenne 4,7. 2e séance : 2 FUND IF et 1 PASS, moyenne 4,7 (`board.md`) |
| Éclaireur concurrence | 1 | `competitors.md`. Les concurrents livrent automatiquement mais prennent 5 à 15 % et gardent l'argent. SasPay est la menace n°1. |
| Panel d'acheteurs v1 (9 900 FCFA) | 30 | 0 achat. Les 70 autres buyers ont été coupés par la limite d'usage ; le résultat était déjà sans ambiguïté. |
| Panel d'acheteurs v2 (4 900 FCFA, WhatsApp) | 20 | 0 achat. Les objections passent de « prix et envoi manuel » à « confirmation manuelle et confiance ». |
| Relecteurs de la landing (vente, design, mobile et accessibilité, confiance et marché), deux passes | 4 | voir ci-dessous |

Notes des relecteurs, de la landing v2 à la v3 :

| Relecteur | v2 | v3 | Verdict v3 |
| --- | :-: | :-: | --- |
| Vente (copywriting) | 5 | 8 | VALIDÉ SI |
| Design (séduction) | 6,5 | 7,5 | VALIDÉ SI |
| Mobile et accessibilité | 6 | 8 | VALIDÉ SI |
| Confiance et marché | 5 | 7 | VALIDÉ SI |

Après la v3, leurs conditions qui relevaient du code ont été appliquées (v4, voir la section suivante). Les conditions restantes ne peuvent être remplies que par le fondateur.

## Ce qui a été changé dans le code

**Landing (`src/app/page.tsx`)**
- Promesse : « Vends ton e-book ou ta formation, sans courir après tes clients. » Marché nommé : FCFA, SasPay. « 0 % de commission » mis en avant.
- Avant / avec Maketia, face au vrai substitut : WhatsApp et Mobile Money à la main.
- Quatre étapes, avec la confirmation manuelle dite franchement.
- « Ce que vit ton client » : page, paiement SasPay, lien sur WhatsApp, présentés comme des illustrations.
- Fonctionnalités réécrites à partir des problèmes du créateur ; A/B et IA relégués à une ligne.
- Pour qui / pas encore pour qui.
- Bloc « 0 % » au lieu d'une carte « Tarif à définir ». Les frais SasPay sont mentionnés.
- FAQ des objections d'achat : coût, SasPay, délai de livraison, arrêt et export, IA.
- Retirés : « dix minutes » (non mesuré), « 4,8 % » (inventé), « Le plus choisi » (sans données), toute formulation laissant croire à une livraison automatique.
- Mobile :
  - barre d'appel qui n'apparaît qu'après le hero ;
  - cibles tactiles de 44 px ;
  - texte de 15 à 17 px ;
  - pas de flou coûteux sur téléphone ;
  - bandeaux défilants accessibles au clavier ;
  - lien d'évitement ;
  - titre visible dès le premier rendu.
- Mouvement : entrée du hero et apparitions au défilement en CSS seul, désactivées en mouvement réduit.
- Mode sombre : accent `#3b6cf0`, contraste suffisant avec du texte blanc.

**Produit**
- Commandes : bouton « Envoyer sur WhatsApp ». Il ouvre WhatsApp avec le lien de téléchargement prêt ; rien n'est envoyé par l'app (`src/lib/whatsapp.ts`).
- Page acheteur `/paiement/retour` : elle dit maintenant que le vendeur vérifie le paiement puis envoie le lien, et qu'il faut garder la référence.

**Tests**
- Tests unitaires pour WhatsApp.
- Test de bout en bout pour le lien `wa.me`.
- La landing est ajoutée aux contrôles automatiques WCAG 2.1 AA (axe) et de largeur 360 px.

## Ce qu'il faut améliorer — par priorité

**1. Bloquant : confirmation et livraison automatiques.** C'est la demande n°1 des 50 acheteurs simulés et des trois membres du conseil, et le seul point où tous les concurrents font mieux. Il faut l'accès à `docs.saspay.me` (domaine à autoriser dans l'environnement) pour vérifier la signature des notifications SasPay, puis un fournisseur d'e-mail transactionnel ou l'envoi WhatsApp.

**2. Seul le fondateur peut le fournir.**
- Qui est derrière Maketia : nom ou société, pays, contact, numéro WhatsApp de support.
- Pages légales : mentions légales, CGU, confidentialité.
- Confirmation écrite de SasPay sur les pays, les devises (XOF et XAF) et les moyens de paiement couverts.
- Les prix ; voir `pricing.md`, qui propose de tester 2 900 et 4 900 FCFA. Les limites du plan gratuit à configurer dans l'administration.
- Le paiement en ligne des abonnements.
- Un test réel avec 5 à 20 créateurs de la cible en Côte d'Ivoire ou au Sénégal : une vente de bout en bout, puis une pré-vente à un vrai prix.
- Une politique de sauvegarde des fichiers.

**3. Produit, faisable ensuite sans dépendance.**
- Un seul geste « Confirmer et envoyer », au lieu de Confirmer → Créer les liens → Envoyer.
- Un compteur visible des commandes qui attendent une confirmation.
- Un espace créateur cohérent avec la landing : tutoiement, « page » plutôt que « tunnel », fonctions avancées en retrait.
- Une boucle de distribution : badge « Créé avec Maketia » désactivable sur les plans payants, parrainage.
- Des modèles de pages localisés (exemples d'Abidjan et de Dakar) et un kit de partage WhatsApp.

**4. Landing, quand les éléments ci-dessus existent.**
- Une vraie page d'exemple publiée, de vraies captures, de vrais créateurs.
- La grille des prix.
- Une vidéo d'écran sur téléphone de la création d'une page.

## Skills du pack non lancés, et pourquoi

- `founder-cfo`, `founder-ops` et `founder-plan` ont besoin des vrais coûts : hébergement, temps, budget d'acquisition. Les inventer serait contraire à leur méthode.
- `founder-marketing` exige un segment qui achète. Il n'y en a aucun pour l'instant (0 achat sur 50). La cible proposée par le conseil reste une hypothèse : créateurs établis, Côte d'Ivoire et Sénégal.
- `founder-brand` et `founder-launch` sont à lancer après le test réel. Le lancement doit justement commencer par une pré-vente réelle.
