# Prix — ce que disent les données (simulées)

Les montants des fichiers `pricing-curve*.md` sont en **FCFA par mois** (l'outil affiche « $ » par défaut).

| Test | Réponses | Zone acceptable | Point « bonne affaire » (IPP) | Prix testé | Verdict |
| --- | ---: | --- | --- | --- | --- |
| Panel v1 (`pricing-curve.md`) | 30 | ≈ 1 000 – 7 000 | ≈ 3 000 | 9 900 | au-dessus de la zone |
| Panel v2 (`pricing-curve-v2.md`) | 20 | ≈ 1 000 – 5 000 | ≈ 2 500 | 4 900 | dedans, à la limite haute |

Le panel v2 voit un pitch plus détaillé (WhatsApp, pas de portefeuille) et ses acheteurs placent la limite plus bas. Le prix seul ne les fait pas acheter : 0 achat sur 50, quel que soit le prix. La première raison reste la confirmation manuelle.

## Comparaison avec les concurrents (`competitors.md`)

Les outils africains prennent 5 à 15 % de commission, sans abonnement. Un abonnement fixe ne devient moins cher qu'à partir d'un certain volume mensuel de ventes (frais SasPay non compris) :

| Abonnement | contre 15 % (Chariow Starter) | contre 10 % (Taliopay, Novakou) | contre 5 % (Maketou) |
| --- | ---: | ---: | ---: |
| 4 900 FCFA | ≈ 33 000 FCFA de ventes | ≈ 49 000 | ≈ 98 000 |
| 9 900 FCFA | ≈ 66 000 | ≈ 99 000 | ≈ 198 000 |

## Recommandation (à décider par le fondateur, rien n'est fixé dans le code)

- **Plan gratuit** : il est indispensable, c'est l'entrée pour la quasi-totalité des acheteurs simulés. Ses limites sont à configurer dans l'administration : aujourd'hui le plan par défaut n'en a aucune.
- **Deux prix à tester auprès de vrais créateurs**, dans la zone : **2 900 FCFA** et **4 900 FCFA** par mois. Méthode : deux variantes de page de pré-inscription, ou une pré-vente à chaque prix.
- **Offre de lancement** possible et honnête : un tarif fondateur garanti à vie pour les N premiers comptes, avec un N réel et une date de fin.
- Pas de faux prix barré, pas de « Le plus choisi » sans données.

Ces réponses viennent d'acheteurs simulés. Elles servent à choisir quoi tester, pas à décider.
