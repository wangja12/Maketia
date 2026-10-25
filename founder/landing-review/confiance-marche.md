# Revue confiance et adéquation au marché

Note: 5/10 | Verdict: VALIDÉ SI

Sources lues : `founder/idea.md`, `src/app/page.tsx`, captures `founder/landing-review/v2/*.png`, arborescence `src/app/`.

La page est déjà plus honnête que la moyenne. La FAQ dit clairement que le créateur confirme le paiement à la main. Elle dit aussi que l'IA n'est pas intégrée et que le paiement des abonnements n'est pas ouvert. Mais le titre, le sous-titre et l'étape 6 promettent encore une livraison automatique qui n'existe pas. Et la page ne dit nulle part qui est derrière Maketia. Pour un public souvent arnaqué, c'est l'objection n° 1, et elle reste sans réponse.

## Affirmations vérifiées (OK / À corriger, avec le texte exact)

| Texte exact sur la page | Statut | Constat (idea.md) | Correction proposée |
|---|---|---|---|
| « Ta page de vente, montée en dix minutes. » (titre, `<title>`, et « Ta première page est à dix minutes d'ici. ») | À corriger | Aucune mesure ne le prouve. Il faut aussi compter le compte SasPay, le lien de paiement, le fichier, les textes et la vérification du domaine. Un débutant sur téléphone ne tiendra pas dix minutes, et il se sentira trompé dès la première session. | « Ta page de vente, sans code, depuis ton téléphone. » Ou alors chronométrer 5 vrais créateurs et afficher le temps médian mesuré. |
| « …et laisse Maketia livrer le fichier après confirmation du paiement. » (sous-titre) | À corriger (grave) | Faux aujourd'hui. Pas de webhook SasPay, pas de confirmation automatique, pas d'e-mail transactionnel. Le créateur confirme à la main, puis il **envoie lui-même** le lien à l'acheteur. | « …tu confirmes le paiement reçu et Maketia crée un lien de téléchargement privé à envoyer à ton acheteur. » |
| Étape 6 « Livraison — L'acheteur reçoit un lien de téléchargement privé et limité. » | À corriger | Ce n'est pas Maketia qui lui envoie le lien. C'est le créateur, par WhatsApp ou par e-mail. | « Livraison — Tu envoies à l'acheteur son lien privé (WhatsApp, e-mail). Le lien expire et le nombre de téléchargements est limité. » |
| Étape 5 « Le paiement est confirmé avant toute livraison. » | À préciser | C'est vrai, mais la phrase ne dit pas par qui. | « Tu confirmes le paiement dans ton espace avant toute livraison. » |
| « Livraison après contrôle — Aucun fichier n'est envoyé avant une confirmation fiable du paiement. Les cas douteux restent à rapprocher. » | À corriger | « Confirmation fiable » laisse croire à un contrôle technique. En réalité, c'est le créateur qui clique. « Rapprocher » est du jargon de comptable. | « Tu vérifies le paiement sur ton compte SasPay, tu le confirmes, puis le lien est créé. Un simple retour sur la page de succès ne suffit pas. » |
| Puce du héros « Livraison après confirmation » | À préciser | Elle donne la même impression d'automatisme. | « Lien de téléchargement après ta confirmation ». |
| Badge « Conversion 4,8 % » dans l'illustration | À corriger | C'est un chiffre inventé. La légende « Illustration — chiffres d'exemple » est minuscule (11 px) et sort du cadre sur mobile. Un chiffre de conversion se lit comme une promesse de résultat. | Supprimer le badge, ou mettre « Conversion — mesurée dans ton espace » sans aucun chiffre. |
| Libellé « Le plus choisi » (tarifs, plan du milieu dès qu'il y a 3 plans ou plus) | À corriger | Il n'y a aucun client et aucune donnée. Le libellé s'afficherait automatiquement dès que 3 plans seront créés, ce qui en fait une fausse preuve sociale. | Supprimer le libellé. Si besoin, mettre « Recommandé pour vendre » (choix éditorial assumé). |
| Prix « 9 900 FCFA » dans la maquette du héros | OK | C'est le prix d'un produit d'exemple, pas d'un abonnement. Il est plausible. | Garder. Pour éviter la confusion avec le plan Créateur au même prix, mettre plutôt 5 000 FCFA. |
| Tarifs : en capture, une seule carte « Plan par défaut — Tarif à définir » | À corriger | C'est honnête, puisque les prix ne sont pas décidés, mais une carte « Plan par défaut » paraît inachevée. Le vocabulaire « Tunnels », « Événements mesurés », « MCP » ne parle pas à ce public. | Afficher « Gratuit pendant la phase de lancement », avec les vraies limites, et « les prix seront annoncés au moins 30 jours avant ». Renommer « Tunnels » en « Pages de vente ». Cacher la ligne MCP. |
| « Maketia ne prend aucun pourcentage… » / « ne te demande jamais ta clé API SasPay » | OK | Conforme à idea.md. | Garder. C'est un vrai argument de confiance. |
| « Paiement sur ton compte — Maketia ne touche jamais ton argent » | OK | Conforme. | Garder. |
| « Le paiement en ligne des abonnements n'est pas encore ouvert : les plans payants sont activés par l'équipe Maketia. » | OK | Conforme. Il manque seulement le moyen de joindre « l'équipe ». | Ajouter un contact (voir plus bas). |
| FAQ « Quand l'acheteur reçoit-il son fichier ? » | OK | C'est le passage le plus honnête de la page. Il contredit le sous-titre, et c'est le sous-titre qu'il faut aligner sur la FAQ. | Ajouter « …et tu lui envoies ce lien ». |
| « Paiement sécurisé SasPay » (maquette téléphone) | À vérifier | « Sécurisé » engage SasPay, pas Maketia. On n'a aucune vérification ni accord de marque. | « Paiement par SasPay ». |
| « Les questions qu'on nous pose vraiment. » | À corriger | Le produit n'est pas déployé et n'a pas d'utilisateurs. Ces questions sont anticipées, pas réellement posées. | « Les questions que tu te poses sûrement. » |
| « Aperçu mobile réel », « Tests A/B honnêtes », « Chaque modification crée une version… », « Une revue avant publication », « domaine… enregistrement DNS », « Agents IA… attend ton approbation » | OK | Conforme à « What exists today ». | Garder. Sortir MCP et A/B de la vitrine principale : ils ne parlent pas à ce public (voir la section marché). |
| « Dépose le fichier, le prix et la devise. » | OK | La limite de 50 Mo par fichier n'est indiquée nulle part. Une formation vidéo dépasse 50 Mo. | Ajouter « (jusqu'à 50 Mo par fichier) ». Ne pas présenter « Formation · 12 vidéos » comme exemple sans cette précision. |
| « La page est en ligne à son adresse, ou sur ton domaine. » | OK | Conforme. Il n'y a pas encore de déploiement en production. | Ne publier la landing qu'avec la production en service. |

## Ce qui manque pour inspirer confiance (top 6)

1. **Qui est derrière Maketia.** Aujourd'hui la page n'a ni nom, ni pays, ni société, ni adresse, ni contact. Le pied de page dit seulement « © Maketia — pages de vente pour produits numériques ». Il faut ajouter :
   - le nom et le visage du fondateur ;
   - la ville et le pays ;
   - le statut juridique, s'il existe (RCCM, ou « en cours d'immatriculation », dit honnêtement) ;
   - un e-mail de contact ;
   - **un numéro WhatsApp de support**, avec des horaires réalistes.

   Pour ce public, un numéro WhatsApp qui répond vaut plus que n'importe quel badge.
2. **Les pages légales n'existent pas.** `src/app/` n'a aucune route `mentions-legales`, `cgu`, `confidentialite` ou `cgv`. Le pied de page n'a aucun lien. Il faut créer au minimum :
   - les mentions légales (éditeur, hébergeur, contact) ;
   - les CGU (y compris le contenu interdit et la responsabilité du vendeur envers ses acheteurs) ;
   - une politique de confidentialité.

   Le Sénégal, la Côte d'Ivoire, le Bénin, le Burkina Faso et le Cameroun ont des lois sur les données personnelles et des autorités comme la CDP ou l'ARTCI. Faites-les relire par un juriste local. Ne pas affirmer de conformité tant que ce n'est pas vérifié.
3. **Le sort de mes fichiers et de mes données.** La page n'en dit rien. Ce qui est vrai et peut s'écrire :
   - les fichiers sont privés, et servis seulement par lien expirant et limité en téléchargements ;
   - la limite est de 50 Mo par fichier ;
   - l'export CSV des contacts existe (`contacts/export`) ;
   - la suppression du compte existe (Compte, puis Supprimer).

   Il faut aussi dire où les fichiers sont stockés (pays de l'hébergeur) et s'il y a des sauvegardes. Les fichiers sont aujourd'hui sur disque local, sans S3. Il faut une politique de sauvegarde avant de promettre quoi que ce soit. Ajouter une ligne : « Tu peux exporter tes contacts et supprimer ton compte à tout moment. »
4. **SasPay expliqué.** La page cite SasPay 8 fois sans jamais dire ce que c'est. Il faut expliquer :
   - ce que c'est ;
   - qui l'opère ;
   - comment ouvrir un compte (avec un lien officiel) ;
   - les délais de validation ;
   - les frais de SasPay (ce ne sont pas ceux de Maketia).

   Ajouter une FAQ « Je n'ai pas de compte SasPay, je fais comment ? ». Sans compte SasPay, le créateur ne peut rien vendre : c'est le premier point de blocage.
5. **La sécurité côté acheteur.** L'acheteur qui paie un PDF à un inconnu a besoin de voir plusieurs choses :
   - que le paiement passe par SasPay et non par un numéro personnel ;
   - qu'il recevra un lien après la confirmation du vendeur, et dans quel délai indicatif (fixé par le vendeur) ;
   - qui contacter en cas de problème (le vendeur, dont le contact figure sur sa page) ;
   - que Maketia n'est pas le vendeur.

   Proposer une section « Contact du vendeur » et « Délai de livraison annoncé » sur les pages publiées. Rappeler au créateur que c'est lui qui livre.
6. **Une preuve réelle, même petite.** Aujourd'hui il n'y a ni témoignage, ni page publiée réelle, ni chiffre réel. Avant le lancement :
   - montrer 2 ou 3 pages de vrais créateurs bêta, avec leur accord, leur nom et leur pays ;
   - montrer une capture réelle de l'espace au lieu d'une maquette stylisée ;
   - montrer une courte vidéo écran (60 s, depuis un téléphone) de la création d'une page.

   Ne jamais inventer de témoignage.

## Adaptation au marché (langue, exemples, moyens de paiement, canaux)

- **Tu ou vous.** Le tutoiement est cohérent sur toute la page, et il fonctionne pour les jeunes créateurs sur Instagram et TikTok. Mais une partie de la cible (formateurs, consultants, entrepreneurs de plus de 30 ans) attend le vouvoiement d'un service qui touche à leur argent. Le tutoiement venant d'une marque inconnue peut aussi paraître familier, voire « arnaque ». Il y a une incohérence à corriger : la page tutoie, mais le produit vouvoie (« Changez de plan ou libérez de la place » dans `plans.ts`). Choisir un seul registre. Recommandation : **vous** sur la landing, les pages légales et le support. Garder un ton chaleureux. À défaut, tester les deux versions auprès de 10 créateurs réels.
- **Vocabulaire.** Retirer ou reléguer le jargon :
  - « landing page » : dire « page de vente » ;
  - « Tunnels » ;
  - « MCP » ;
  - « Tests A/B » ;
  - « échantillon » ;
  - « DNS » ;
  - « rapprocher ».

  Les agents IA par MCP ne sont pas un argument pour ce public : les mettre en bas ou dans une page « Avancé ».
- **Exemples locaux.** Les exemples actuels sont génériques et européens (« Excel pour ton commerce », « Méditations du matin »). Remplacer par des produits qui se vendent vraiment dans la zone :
  - guide « Réussir le concours de la fonction publique » ;
  - formation « Vendre sur WhatsApp Business » ;
  - recettes (attiéké, thiéboudienne, ndolé) ;
  - pack de modèles de CV ou de business plan ;
  - cours de couture ou de tresses ;
  - e-book « Gérer sa tontine ».

  Afficher les prix en FCFA réalistes (2 000 à 15 000 FCFA). Indiquer qu'il s'agit d'exemples.
- **Moyens de paiement.** **Non vérifié** : nous ne savons pas si SasPay accepte Orange Money, Wave, MTN MoMo, Moov Money ou la carte, ni dans quels pays. Ne rien écrire là-dessus avant une confirmation écrite de SasPay ou sa documentation officielle. Si c'est confirmé, c'est l'argument le plus fort de la page. Il faudra alors l'afficher dans le héros, pays par pays (« Tes clients paient par Wave, Orange Money… »). Préciser aussi la devise : XOF (UEMOA) ou XAF (Cameroun, CEMAC). La page dit « FCFA » partout, alors que le Cameroun utilise le XAF : vérifier que SasPay et le produit gèrent les deux.
- **Mobile et données.** La page est déjà mobile-first, c'est bien. Mais la capture mobile fait environ 14 900 px de haut : c'est long et lourd en 3G. Il faut :
  - raccourcir ;
  - vérifier le poids de la page ;
  - éviter les flous CSS lourds sur les téléphones d'entrée de gamme.
- **Canaux.** Ajouter un bouton WhatsApp flottant (support et démo), des liens vers les réseaux (Facebook, Instagram, TikTok) et un parrainage entre créateurs, car le bouche-à-oreille est le canal de confiance n° 1. Rappeler sur la page que le lien de la page de vente se partage dans le statut WhatsApp et la bio TikTok.
- **Livraison manuelle, présentée comme une force.** Tant que la livraison n'est pas automatique, assumez-le : « Tu gardes le contrôle : tu vérifies chaque paiement avant d'envoyer le fichier. » Beaucoup de créateurs font déjà ainsi sur WhatsApp. Maketia leur apporte le lien privé et limité, qui empêche le PDF de circuler partout.

## Conditions pour VALIDÉ

1. Réécrire le sous-titre, l'étape 5, l'étape 6, la carte « Livraison après contrôle » et la puce du héros. Ils doivent dire que **le créateur confirme le paiement et envoie lui-même le lien**.
2. Supprimer « dix minutes » (titre, `<title>`, appel final), sauf si un temps mesuré sur de vrais utilisateurs le justifie.
3. Supprimer le badge « 4,8 % » et le libellé « Le plus choisi ». Remplacer « qu'on nous pose vraiment » et « Paiement sécurisé SasPay ».
4. Ajouter un bloc « Qui sommes-nous » et un pied de page. Ils doivent donner le nom du fondateur, le pays, le statut juridique (ou son absence, dite clairement), l'e-mail et le WhatsApp de support.
5. Créer et relier les pages Mentions légales, CGU et Confidentialité (elles n'existent pas aujourd'hui), relues pour le droit local.
6. Ajouter une FAQ « Qu'est-ce que SasPay et comment ouvrir un compte ? », avec un lien officiel. Ajouter une FAQ « Mes fichiers et mes données » : stockage, 50 Mo, export des contacts, suppression du compte.
7. Ne citer aucun moyen de paiement mobile (Orange Money, Wave, MTN, Moov) sans confirmation écrite de SasPay. Vérifier XOF et XAF.
8. Remplacer « Plan par défaut — Tarif à définir » par une offre claire pendant le lancement, et simplifier les libellés de quotas.
9. Trancher entre tu et vous, et l'appliquer à la landing et au produit.
10. Remplacer les exemples de produits par des exemples locaux. Ne publier la landing qu'une fois la production déployée.
