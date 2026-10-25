# Conseil d'administration — synthèse du président

Trois membres, chacun appliquant un seul cadre publié (Offers, Monopoly, Product). Mémos complets dans `founder/board/`.

## Le vote

| Séance | Offers | Monopoly | Product | Moyenne | Vote |
| --- | --- | --- | --- | --- | --- |
| 1re (idée + landing v2) | 5 · FUND IF | 4 · FUND IF | 5 · FUND IF | 4,7 | 3 FUND IF |
| 2e (après panel, concurrence, landing v3, bouton WhatsApp) | 5 · FUND IF | 3 · PASS | 6 · FUND IF | 4,7 | 2 FUND IF, 1 PASS |

Le PASS de la lentille Monopoly redevient FUND IF « le jour où la livraison automatique fonctionne ».

## Les risques soulevés par plus d'un membre (dans l'ordre)

1. **La livraison n'est pas automatique.** Le créateur confirme chaque paiement et envoie le lien. Les concurrents africains (Chariow, Maketou, Selar, Taliopay, Novakou) livrent seuls. Les trois membres et les 50 acheteurs simulés citent ce point en premier.
2. **Aucune preuve réelle.** Il n'y a ni créateur, ni vente, ni témoignage. La confiance est le premier frein pour une partie du panel (« qui est derrière Maketia ? »).
3. **Le prix.** 9 900 FCFA est au-dessus de la zone acceptable des acheteurs simulés. 4 900 FCFA est dedans, mais aucun acheteur simulé ne paie encore.
4. **La dépendance à SasPay.** SasPay est la menace n°1 : ses liens ont déjà une page hébergée. Sa couverture vérifiée se limite à la Côte d'Ivoire, au Sénégal et au Burkina Faso, d'après les extraits du scout.
5. **La distribution.** Il n'y a pas de plan pour les 100 premiers créateurs, ni de boucle intégrée au produit.

## Désaccords à garder

- **Monopoly** passe tant que la livraison n'est pas automatique. **Product** et **Offers** financent sous conditions : ils jugent la confirmation manuelle acceptable si elle tient en un geste et si l'acheteur sait ce qui va se passer.
- **Monopoly** veut viser d'abord les créateurs établis (100 000 FCFA de ventes par mois et plus, en Côte d'Ivoire et au Sénégal). **Offers** voit le gratuit comme l'entrée des débutants.

## Conditions fusionnées (liste à cocher)

- [ ] Confirmation et livraison automatiques (webhooks SasPay vérifiés). Elles sont bloquées par l'accès à la documentation SasPay.
- [x] Envoi du lien en un geste : le bouton « Envoyer sur WhatsApp » est livré et testé.
- [x] Fusionner « Confirmer » → « Créer les liens » → « Envoyer » en une seule action (« Confirmer et envoyer »).
- [x] Signaler au créateur qu'une commande attend sa confirmation (« Paiements (N à confirmer) » dans la navigation).
- [x] Dire à l'acheteur ce qui va se passer après le paiement (page `/paiement/retour` réécrite).
- [x] Retirer de la landing les affirmations non prouvées : « dix minutes », « 4,8 % », « Le plus choisi », « livrer » automatique.
- [x] Nommer le marché, mettre « 0 % » au premier plan, ajouter un avant/après WhatsApp, une section pour qui / pas encore, et la FAQ des objections d'achat.
- [ ] Qui est derrière Maketia : identité, contact WhatsApp, pages légales. Seul le fondateur peut le fournir.
- [ ] Fixer les prix, configurer le plan gratuit en base et ouvrir le paiement en ligne des abonnements.
- [ ] Faire confirmer par écrit à SasPay les pays, les devises (XOF et XAF) et les moyens de paiement couverts.
- [ ] Mener un test réel : 5 à 20 créateurs de la cible, une vente de bout en bout, une pré-vente à un vrai prix.
- [x] Badge « Page créée avec maketia. » sur les pages des plans gratuits, absent sur les plans payants. Parrainage : à faire.
- [x] Dans l'espace créateur : tutoiement, « offre » au lieu de « tunnel » (les pages vues par l'acheteur restent au vouvoiement). Fonctions avancées en retrait : tests A/B et agent IA repliés dans « Outils avancés » sur la page d'une offre, « Agents IA » en dernier dans la navigation.

## La version la plus forte que le conseil voit

Ce n'est pas tout à fait ce qui a été proposé. Il s'agirait de **la page de vente mobile des créateurs qui vendent déjà, en Côte d'Ivoire et au Sénégal, et qui ne veulent plus qu'une plateforme garde leur argent**. L'argent arrive directement sur leur compte SasPay, sans commission ni retrait à demander, et le fichier part automatiquement dès que le paiement est vérifié. Le « 0 % sans portefeuille » répond à la plainte n°1 relevée chez les concurrents (retraits bloqués). Il ne vaut que pour qui vend déjà, et seulement avec la livraison automatique. Les deux problèmes n'en font qu'un.
