# Monopoly lens

Score: 4/10 | Vote: FUND IF

Lecture en une phrase : le produit est soigné et honnête, mais aujourd'hui c'est un « constructeur de pages de vente » de plus, dans une catégorie où la page de vente est une commodité. Le seul angle défendable que je vois est étroit : **devenir la couche de vente native de SasPay pour les créateurs francophones d'Afrique de l'Ouest et du Centre**, avec livraison automatique. Tant que cette brique (webhooks SasPay plus livraison automatique) n'existe pas, il n'y a ni rupture technique, ni effet de réseau, ni raison de rester.

## What is strong

- **Un petit marché nommé et précis.** « Créateurs francophones, sur téléphone, payés en FCFA via SasPay » : c'est le bon réflexe du Monopoly lens. On commence par un marché assez petit pour le dominer, pas par « tous les créateurs du monde ».
- **Une position de confiance rare.** Maketia ne touche jamais l'argent, ne demande jamais la clé API et ne prend aucune commission. C'est une promesse simple à répéter. Dans un marché où (hypothèse à vérifier) la méfiance envers les plateformes qui encaissent pour le vendeur est forte, cela peut devenir une marque.
- **Un savoir-faire de « vérité ».** Livraison seulement après paiement confirmé, liens privés expirants et plafonnés, tests A/B qui avouent un échantillon trop petit. Ce n'est pas encore un monopole. C'est le début d'une marque (« l'outil qui ne ment pas »), et la marque est l'un des quatre fossés possibles.
- **Pas de commission = pas de conflit avec le créateur qui grossit.** Les gros vendeurs ont intérêt à rester, au lieu de fuir une commission qui grossit avec leurs ventes. C'est un argument de rétention, si le prix fixe reste bas.
- **Coût de construction très bas** (fondateur seul plus assistant de code). On peut tenir longtemps sur un petit marché sans lever, ce qui laisse le temps de le dominer.

## What would kill it (the top 3, most dangerous first)

1. **Pas de rupture « 10x », donc pas de raison de changer d'outil.** Aujourd'hui le créateur colle son lien SasPay, confirme chaque paiement à la main, puis envoie lui-même le lien de téléchargement à l'acheteur. Il fait donc à la main ce que la page promet d'automatiser. Face à un PDF envoyé sur WhatsApp après capture d'écran du paiement (le substitut probable, à vérifier), Maketia n'est pas 10 fois mieux. C'est un peu plus joli. La seule vraie rupture possible est **paiement SasPay confirmé automatiquement, puis fichier livré automatiquement, sans que le créateur touche son téléphone**. Elle est bloquée (format de signature des webhooks non documenté). Si elle reste bloquée, il n'y a pas d'entreprise.
2. **Dépendance totale à un seul partenaire de paiement : le risque de plateforme.** Tout le positionnement repose sur SasPay. Si SasPay lance sa propre page produit avec livraison de fichier, Maketia disparaît en un trimestre. Même chose si SasPay change ses liens, refuse les webhooks ou perd sa place face à d'autres moyens de paiement. Personne n'a encore vérifié ce que SasPay propose déjà ou prépare. Rien n'empêche non plus un copieur de faire la même intégration au mois six. Le fossé n'existe que si Maketia obtient un accès privilégié (partenariat, webhooks officiels, référencement dans SasPay).
3. **Distribution inexistante.** Il n'y a ni budget communiqué, ni e-mails marketing, ni paiement en ligne des abonnements : un admin active chaque plan payant à la main. Le canal d'arrivée des 100 premiers créateurs n'est pas nommé, et leur coût d'acquisition encore moins. Le Monopoly lens est formel : un bon produit sans distribution n'est pas une entreprise. Les créateurs africains francophones se trouvent probablement sur WhatsApp, Facebook et TikTok (hypothèse à vérifier). Maketia n'a encore aucun mécanisme pour y être présent.

Risque secondaire : le marché est sans doute déjà occupé. Plusieurs outils de vente de produits numériques visent l'Afrique francophone, avec Mobile Money et paiement intégré. Le scout concurrence doit en confirmer les noms, les prix et les commissions. S'ils livrent déjà automatiquement, Maketia arrive en retard avec un produit moins complet, et « 0 % de commission » devient son seul différenciateur, donc une guerre de prix.

## The questions I would ask the founder

1. **Le secret.** Que sais-tu de ces créateurs que les autres outils ignorent ? Par exemple : pourquoi ils ne vendent pas encore en ligne, comment ils livrent aujourd'hui, ce qui les a déjà fait arnaquer. Réponds en une phrase.
2. **Le substitut réel.** Aujourd'hui, comment un créateur ivoirien vend-il son e-book ? Lien SasPay plus WhatsApp ? Un concurrent africain ? Gumroad ou Systeme.io ? Combien de temps et d'argent cela lui coûte-t-il ? (Question ouverte pour le scout concurrence.)
3. **SasPay.** As-tu un contact chez SasPay ? Peux-tu obtenir la documentation des webhooks, un statut de partenaire ou une place dans leur annuaire ? SasPay a-t-il déjà, ou prévoit-il, une page produit avec livraison de fichier ? Combien de marchands SasPay vendent des produits numériques ? (Chiffre inconnu.)
4. **Le petit marché à dominer.** Quel est le premier sous-marché exact : un pays, une ville, une niche (formateurs Excel d'Abidjan, coachs business de Dakar) ? Combien de créateurs y vendent déjà ? Quelle part peux-tu prendre en 12 mois ?
5. **Les 100 premiers.** D'où arrivent-ils, nommément (communautés, influenceurs, groupes WhatsApp, SasPay), et combien coûte chacun ?
6. **Pourquoi maintenant ?** Qu'est-ce qui a changé récemment (adoption de SasPay, explosion des formations en ligne locales, coût des outils en euros ou en dollars) pour que ce marché s'ouvre aujourd'hui et pas il y a trois ans ?
7. **Dans dix ans.** Qu'est-ce qui s'accumule chez Maketia et ne part pas avec le créateur s'il change d'outil : ses acheteurs, son historique, un réseau d'acheteurs commun, sa réputation ?
8. **Pourquoi MCP et agents IA ?** Tes clients sont non techniques et sur téléphone. Qui, parmi eux, branche un agent par MCP ? Est-ce une fonctionnalité pour toi ou pour eux ?

## If FUND IF: the conditions

1. **Livraison automatique de bout en bout** : webhook SasPay vérifié, puis lien de téléchargement envoyé à l'acheteur sans action du créateur. Il faut pour cela un fournisseur d'e-mails transactionnels ou, mieux, la livraison par WhatsApp ou SMS (à étudier). C'est la seule rupture « 10x » en vue. Sans elle, je passe.
2. **Un accord écrit ou un canal officiel avec SasPay** (documentation des webhooks, référencement, ou au minimum une preuve qu'ils ne construisent pas la même chose). C'est ce qui transforme la dépendance en fossé.
3. **Un sous-marché nommé et chiffré**, avec la part visée. Exemple de forme attendue : « X créateurs de formations payés par SasPay en Côte d'Ivoire, objectif Y % en 12 mois ». Les chiffres restent à établir, ne pas les inventer.
4. **Un plan des 100 premiers créateurs** avec canal et coût par créateur. Il doit inclure une boucle de distribution intégrée au produit : un badge « Page créée avec Maketia » sur chaque page publiée, et du parrainage entre créateurs. Chaque acheteur qui voit une page est un prospect gratuit.
5. **La vérification concurrentielle** par le scout : outils africains francophones de vente de produits numériques, leurs prix, leurs commissions, livrent-ils automatiquement ? Si l'un d'eux fait déjà la livraison automatique avec Mobile Money sans commission, je repasse le dossier en PASS.
6. **Un abonnement payable en ligne** (idéalement via SasPay lui-même). Sans encaissement automatique, il n'y a pas d'entreprise mesurable.

## The landing page through this lens (what to change so it sells; concrete)

La page est belle et honnête. À travers le Monopoly lens, elle a deux défauts : elle ne dit pas **pour qui exactement** elle est faite (donc pas de petit marché visible), et elle ne montre pas **pourquoi Maketia plutôt qu'autre chose** (donc pas de différence défendable).

1. **Nommer le marché dès le hero.** Le badge « Pour les créateurs de produits numériques » est générique : il pourrait être sur n'importe quelle page de n'importe quel pays. Remplacer par quelque chose comme « Pour les créateurs d'Afrique de l'Ouest et du Centre, payés en FCFA via SasPay ». Dire « FCFA », « SasPay » et les pays dans les 3 premières secondes. Un créateur d'Abidjan doit se dire « c'est pour moi », et un visiteur français doit sentir que ce n'est pas pour lui. C'est voulu.
2. **Corriger la promesse du hero, qui dépasse le produit actuel.** « Laisse Maketia livrer le fichier après confirmation du paiement » fait croire à une livraison automatique. Or aujourd'hui le créateur confirme à la main et envoie lui-même le lien. Le fondateur veut zéro fausse affirmation. Écrire par exemple « Tu confirmes le paiement en un geste, Maketia crée le lien de téléchargement privé ». Ajouter « Livraison automatique : bientôt » seulement une fois la date connue. Même correction pour l'étape 06 « L'acheteur reçoit un lien… » : préciser qui l'envoie.
3. **Faire de « 0 % de commission » l'argument principal, pas une ligne de la section Tarifs.** C'est la différence la plus nette et vérifiable. Le mettre dans le hero ou juste dessous : « 0 % sur tes ventes. L'argent arrive directement sur ton compte SasPay. » Ne pas comparer chiffres à l'appui avec des concurrents tant que le scout n'a pas vérifié leurs commissions.
4. **Montrer le substitut et le battre.** Ajouter une section « Avant / avec Maketia » : avant, capture d'écran du paiement, vérification, envoi du PDF sur WhatsApp, fichier partagé à tout le monde ; avec Maketia, une page, un lien privé limité qui ne se partage pas. C'est là que se voit le gain : liens expirants et plafonnés contre le piratage du PDF. Si c'est un vrai problème des créateurs (à vérifier auprès du panel), c'est un angle « 10x » sur la protection du fichier.
5. **Retirer ou déplacer la carte « Agents IA via MCP ».** Pour un créateur non technique sur téléphone, c'est du bruit, et cela dilue le message. La mettre en FAQ ou sur une page « Pour les avancés ». Elle prend une place sur six dans la grille des fonctionnalités.
6. **Rendre la section Tarifs vendeuse même sans prix.** « Les tarifs seront publiés ici prochainement » et « activés par l'équipe » donnent l'impression d'un produit pas prêt. Tant que les prix ne sont pas fixés, transformer la section en accès anticipé : « Plan gratuit ouvert : 1 page, 1 produit. Plans payants : rejoins la liste et garde le prix de lancement. » Cela capte aussi les 100 premiers. Retirer le badge « Le plus choisi » tant qu'aucune donnée ne le prouve : c'est une affirmation non vérifiée.
7. **Ajouter une boucle de distribution visible.** Une ligne dans le hero ou la fin de page : « Chaque page publiée porte un petit lien Maketia (désactivable sur les plans payants) ». Puis, quand il existe, un programme de parrainage. Le Monopoly lens veut voir la distribution intégrée au produit, pas seulement le produit.
8. **Preuve locale, dès qu'elle existe.** Les couvertures sont inventées et honnêtement étiquetées : bien. Prévoir dès maintenant l'emplacement de 2 ou 3 vrais créateurs locaux (nom, pays, produit), à remplir seulement avec de vrais cas. Une seule page réelle d'un créateur d'Abidjan vend plus que cinq couvertures d'exemple.
9. **Le CTA mobile.** Sur mobile, l'illustration de l'éditeur arrive après un long scroll et montre une interface de bureau. Pour ce public, montrer d'abord **la page de vente vue par l'acheteur sur téléphone** (l'aperçu mobile, avec le prix en FCFA et le bouton SasPay). C'est ce que le créateur veut obtenir, pas l'éditeur.

## Deuxième séance

Score: 3/10 | Vote: PASS (révisable en FUND IF le jour où la livraison automatique fonctionne)

Pourquoi je baisse d'un point et je passe de FUND IF à PASS : lors de la première séance, j'avais écrit que sans livraison automatique, je passe. Elle n'existe toujours pas. Les nouvelles pièces confirment que c'est le point qui décide de tout. Ces outils africains livrent tous automatiquement : Chariow, Maketou, Selar, Taliopay et Novakou. Le panel simulé donne 0 achat sur 30. Dans la liste « ce qui ferait changer d'avis », presque chaque acheteur cite la confirmation et la livraison automatiques. Sur la carte des concurrents, Maketia n'a aujourd'hui aucune rupture « 10x ». Elle n'est pas en avance : elle est **en retard** sur la fonction que le marché tient pour acquise. Le bouton « Envoyer sur WhatsApp » réduit l'effort d'envoi. Il ne supprime ni la confirmation manuelle ni le téléphone à surveiller, ce que les acheteurs reprochent (« babysit my phone », « je confirme chaque paiement à la main »).

Ce qui a changé en bien, et c'est réel : la carte des concurrents montre **un quadrant vide**. Il réunit l'adaptation locale (FCFA, français, téléphone) et l'argent qui va directement au créateur, sans wallet de plateforme. Seuls s'y trouvent des substituts sans page ni livraison : le lien SasPay seul et WhatsApp avec un lien Wave. Les plaintes n°1 contre les concurrents sont les retraits bloqués, retenus ou jamais reçus. Ce sont exactement celles que le modèle Maketia rend impossibles. C'est un vrai début de secret : « dans ce marché, la peur n°1 du créateur n'est pas le prix, c'est que la plateforme garde son argent ». À confirmer avec de vrais créateurs, car les thèmes de plaintes sont marqués « minces » par le scout.

### Conditions de la première séance : remplies ou non

| # | Condition | État | Commentaire |
| --- | --- | --- | --- |
| 1 | Livraison automatique de bout en bout | **Non remplie** | Le bouton WhatsApp est un progrès d'ergonomie, pas l'automatisation. Le panel le dit en toutes lettres. C'est toujours la condition bloquante. |
| 2 | Accord ou canal officiel avec SasPay | **Non remplie, et le risque est confirmé** | Le scout désigne SasPay comme la menace n°1. Ses liens de paiement ont déjà une page hébergée, un montant fixe en XOF, un pixel Facebook et un plugin WooCommerce. Il lui manque une vitrine et la livraison de fichier pour couvrir l'essentiel de Maketia. Question ouverte : la documentation publique docs.saspay.me décrit-elle des webhooks signés ? Si oui, le blocage de la condition 1 est peut-être levable sans partenariat. |
| 3 | Sous-marché nommé et chiffré | **À moitié** | Il est nommé sur la landing (« Afrique francophone · SasPay en FCFA »). Il n'est pas chiffré : le nombre de créateurs reste inconnu. Il y a aussi une incohérence. Selon le scout, la couverture affichée par SasPay est la Côte d'Ivoire, le Sénégal et le Burkina Faso. Le brief cite aussi le Cameroun, le Bénin et le Togo, non couverts. |
| 4 | Plan des 100 premiers et boucle de distribution | **Non remplie** | Aucun canal ni coût par créateur. La landing n'annonce ni badge « Créé avec Maketia » ni parrainage. |
| 5 | Vérification concurrentielle | **Remplie** (avec réserve) | Elle est faite, à partir des extraits de l'index de recherche seulement, à revérifier dans un navigateur. Résultat : les concurrents livrent automatiquement, mais **tous** prennent 5 à 15 % et détiennent l'argent. Ce n'est donc pas le cas « livraison automatique sans commission et sans wallet » qui m'aurait fait passer à PASS à lui seul. C'est l'absence de livraison automatique chez Maketia qui me fait passer. |
| 6 | Abonnement payable en ligne | **Non remplie** | La landing dit encore que les plans payants sont activés par l'équipe. Il n'y a toujours pas de revenu mesurable. |

Bilan : 1 condition remplie, 1 à moitié, 4 non remplies, dont la condition bloquante.

### Le petit marché à posséder d'abord, vu la carte

Les débutants ne sont pas le bon marché. Sous environ 66 000 à 198 000 FCFA de ventes par mois, une commission de 5 à 15 % coûte moins cher que 9 900 FCFA fixes (calcul du scout). Le panel le confirme : chez les débutants, 0 % d'achat, et c'est le prix qui fait refuser. Maketou à 5 % les gardera.

**Le premier marché à dominer :**
- les créateurs et formateurs qui **vendent déjà** des produits numériques, au-dessus du seuil de rentabilité (environ 100 000 FCFA par mois et plus) ;
- **en Côte d'Ivoire et au Sénégal d'abord**, là où SasPay est disponible ;
- qui veulent **échapper au wallet de plateforme** : par exemple des déçus d'un retrait bloqué ou retardé, ou des vendeurs de formations à prix élevé, pour qui 10 à 15 % représentent une vraie somme.

Pour eux, « l'argent arrive chez toi, 0 % » vaut de l'argent chaque mois, et la confiance compte plus que le prix. Il y a une réserve importante : ces créateurs établis vendent souvent assez pour que la confirmation manuelle soit un vrai fardeau. Le scout cite environ 50 commandes par mois comme seuil de pénibilité, chiffre d'une agence intéressée. Ce marché n'est donc prenable **qu'avec** la livraison automatique. Les deux problèmes n'en font qu'un.

Questions ouvertes pour chiffrer ce marché (à ne pas inventer) :
- Combien de créateurs, en Côte d'Ivoire et au Sénégal, dépassent 100 000 FCFA de ventes numériques par mois ?
- Combien sont déjà marchands SasPay ?
- Combien ont déjà eu un retrait bloqué ou retardé ?

Expansion ensuite : les autres pays couverts par SasPay, puis d'autres moyens de paiement versés directement au créateur (liens Wave ou Orange Money du créateur ?). C'est aussi la seule façon de réduire la dépendance à SasPay. La faisabilité technique reste à vérifier.

### Verdict sur la landing v3

**Nettement meilleure à travers le Monopoly lens : de 4/10 à 7/10 pour la page seule.** Elle a fait ce que je demandais :
- le marché est nommé dès le badge (« Afrique francophone · SasPay en FCFA ») ;
- « 0 % de commission » est dans le hero et devient le grand moment typographique des tarifs ;
- une section « Avant / avec Maketia » attaque le vrai substitut (captures d'écran, PDF qui circule, 200 discussions) ;
- la promesse de livraison est corrigée (« dès que tu as vu l'argent arriver », « Tu confirmes, il télécharge ») ;
- les agents IA sont relégués en FAQ ;
- la section « Ce n'est pas pour toi si… » dit honnêtement que la confirmation est manuelle ;
- le badge « Le plus choisi » a disparu.

Ce qui manque encore pour qu'elle vende **contre la carte des concurrents** :
1. **Nommer l'ennemi sans le nommer : le wallet.** L'argument le plus fort que révèle la carte n'est pas « 0 % ». C'est « pas de retrait à attendre, personne ne peut bloquer ton argent ». La carte « Ton argent va chez toi » le dit, en petit. Le mettre au niveau du hero ou de l'« Avant / avec », par exemple « Pas de portefeuille, pas de retrait à demander, pas d'argent bloqué ». Ne citer aucun concurrent nommément et ne reprendre aucune plainte comme un fait tant qu'elle n'est pas vérifiée.
2. **Être honnête sur le « 0 % ».** Les frais SasPay (dès 1,75 % + 100 FCFA par transaction selon le scout) restent dus. « 0 % de commission Maketia » est vrai. « Que tu vendes 1 ou 1 000 e-books, Maketia ne prend rien dessus » est vrai aussi. Ajouter près du grand « 0 % » une ligne : « Seuls les frais SasPay de ton compte s'appliquent ». Sinon un concurrent ou un acheteur méfiant pourra dire que c'est trompeur.
3. **Parler au bon segment.** Le hero, le CTA « gratuitement » et l'exemple à 5 000 FCFA visent le débutant, que le calcul donne perdant face à Maketou. Ajouter un bloc pour le vendeur établi, sans chiffre inventé : « Tu vends déjà ? Compare ce que te coûte ta commission actuelle à un forfait fixe », avec un petit calculateur (ventes du mois × taux saisi par le créateur, comparé au forfait). Ce bloc n'a de sens qu'une fois les prix fixés.
4. **Mettre les pays au bon endroit.** « Afrique francophone » promet plus que SasPay ne couvre, d'après le scout. Écrire « Côte d'Ivoire, Sénégal, Burkina Faso » (après vérification sur saspay.me), ou ajouter une ligne « disponible là où SasPay l'est ». C'est aussi plus fort pour dominer un petit marché.
5. **Une boucle de distribution, toujours absente.** Annoncer le lien « Créé avec Maketia » sur les pages publiées, et un parrainage dès qu'il existe.
6. **Ne rien changer à la mention de la confirmation manuelle** tant que l'automatisation n'est pas livrée. Elle protège la confiance, qui est le seul actif de marque aujourd'hui. Le jour où les webhooks fonctionnent, « livré automatiquement, argent direct chez toi, 0 % » devient le hero. Ce sera la seule phrase de la page qu'aucun concurrent de la carte ne peut écrire.
