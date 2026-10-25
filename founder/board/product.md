# Product lens
Score: 5/10 | Vote: FUND IF

## Ce qui est fort

- **Une phrase claire existe déjà.** « Un fichier, une page, une vente. » C'est la bonne promesse et elle tient en une ligne. Le produit sait ce qu'il est : une page de vente pour un fichier numérique, payée en FCFA via SasPay.
- **Bonne cible, bon point de départ.** Créateurs francophones d'Afrique de l'Ouest et centrale, non techniques, sur téléphone. La landing et l'éditeur pensent mobile d'abord (aperçu mobile, bande de produits qui défile sur téléphone).
- **Honnêteté intégrée au produit.** Les détails invisibles sont soignés : la page de retour acheteur (`/paiement/retour`) n'affirme jamais « payé » sur une simple visite. Les liens de téléchargement expirent et ont un nombre limité d'usages. Les tests A/B préviennent quand l'échantillon est trop petit. Une publication demandée par un agent attend une approbation humaine. Les maquettes sont marquées « Illustration — chiffres d'exemple ». C'est du soin là où le client ne regarde pas. C'est rare et c'est un actif.
- **Modèle de confiance simple.** Maketia ne touche pas l'argent, ne demande pas la clé API SasPay et ne prend aucune commission. Pour un créateur méfiant, c'est rassurant et facile à dire.
- **La landing a du goût.** Hiérarchie nette, typographie soignée (sans-serif + italique serif), mode sombre, rythme des sections. Elle a l'air d'un produit sérieux.

## Ce qui le tuerait (top 3, du plus dangereux au moins dangereux)

1. **La rupture au moment qui compte : après le paiement.** Aujourd'hui, l'acheteur paie sur SasPay. Il revient sur « Paiement en cours de vérification… vous pouvez fermer cette page ». Ensuite le créateur doit voir le paiement dans SasPay, le confirmer à la main dans Maketia, puis envoyer lui-même le lien de téléchargement, puisqu'il n'y a pas d'e-mail transactionnel. Dans le parcours, ce moment compte plus que tous les autres : l'acheteur vient de payer et attend son fichier. Il passe aujourd'hui par trois personnes ou systèmes, avec une attente humaine au milieu. Un créateur qui dort, c'est un acheteur qui croit s'être fait arnaquer. La promesse de la landing (« laisse Maketia livrer le fichier ») n'est pas encore vraie de bout en bout.
2. **Trop de choses pour la cible.** Le brief liste CRM, analytics, tests A/B, domaines personnalisés, versions, MCP pour agents IA, et des tunnels avec plusieurs pages. Une créatrice d'Abidjan sur téléphone veut une seule chose : que son e-book soit acheté et livré. Chaque fonction en plus ajoute du vocabulaire (« tunnel », « variante », « MCP ») et de la charge. Pendant ce temps, la seule fonction vitale, la livraison automatique, reste bloquée.
3. **Des coutures dans l'expérience.** La landing tutoie (« Ta page de vente »). L'espace vouvoie (« Créez votre premier tunnel »). La landing vend une « page de vente ». L'espace commence par « Tunnels de vente ». Il demande d'abord un nom de tunnel, pas le fichier ni le prix. Le texte d'état vide parle de « générer ses pages », alors que la landing affirme « pas de génération automatique ». L'enregistrement des liens SasPay peut aussi être bloqué tant qu'un administrateur n'a pas réglé le domaine SasPay. Enfin, les abonnements payants sont activés à la main par l'équipe. Chaque couture est petite. Ensemble, elles montrent un produit pensé depuis le code et pas encore depuis l'expérience.

## Les questions que je poserais au fondateur

1. **En une phrase : quelle est la seule chose que Maketia doit faire de façon brillante ?** Si c'est « vendre et livrer un fichier depuis un téléphone », pourquoi les tests A/B et le MCP sont-ils prêts alors que la livraison automatique ne l'est pas ?
2. **Avez-vous chronométré un vrai créateur non technique, sur téléphone ?** Il part de l'inscription et va jusqu'à une page publiée avec un lien SasPay collé. Combien de minutes ? Le titre promet « dix minutes ».
3. **Que vit l'acheteur entre son paiement et son fichier, minute par minute,** quand le créateur n'est pas devant son écran ? Combien de temps attend-il, et par quel canal reçoit-il le lien (WhatsApp, e-mail, SMS) ?
4. **SasPay accepte-t-il d'expliquer ses webhooks ?** Avez-vous un plan B (vérification par référence, relevé, autre prestataire) si le format de signature reste inconnu ?
5. **Pourquoi le mot « tunnel » ?** Votre cible parle-t-elle de « tunnel de vente » ou simplement de « ma page » ?
6. **Combien de créateurs réels ont utilisé l'outil ?** La FAQ s'intitule « Les questions qu'on nous pose vraiment », mais il n'y a pas encore de mise en production.

## Si FUND IF : les conditions

1. **Fermer la boucle de livraison avant le lancement.** Il faut une confirmation de paiement automatique (webhooks SasPay ou autre méthode vérifiable) et un envoi automatique du lien à l'acheteur (e-mail transactionnel au minimum). Le message d'attente de l'acheteur doit aussi dire quand et comment il recevra son fichier. Sans cela, le produit ne tient pas sa promesse centrale.
2. **Couper ou cacher ce qui ne sert pas le premier fichier vendu.** Retirer de la première expérience les tests A/B, MCP/agents, CRM, statistiques avancées et le multi-tunnel. Ils restent dans le code, derrière un menu « avancé » ou un plan supérieur. Le premier écran après inscription dit : « Ajoute ton fichier et ton prix. »
3. **Un seul parcours, un seul vocabulaire, une seule voix.** Inscription, fichier et prix, modèle pré-rempli, lien SasPay, aperçu mobile, publication. Tutoiement partout, ou vouvoiement partout. « Page », pas « tunnel ». Le réglage du domaine SasPay ne doit jamais bloquer un créateur.
4. **Prouver les « dix minutes »** avec au moins cinq créateurs réels de la cible, sur téléphone, avant de garder le chiffre dans le titre. Sinon, changer le titre.
5. **Fixer les prix avant d'ouvrir la page publique.** « Tarif à définir » sur une page de vente est une porte fermée.

## La landing page à travers cette lentille

**Les cinq premières minutes d'un visiteur (créatrice sur téléphone, venue d'un lien WhatsApp ou d'un post) :**

- *0–10 s.* Le titre « Ta page de vente, montée en dix minutes » est clair et beau. Le sous-titre est long (quatre lignes sur mobile) et cite un mot technique, « landing page ». Les deux boutons empilés poussent l'illustration sous le pli. Sur mobile, la visiteuse ne voit donc ni un produit ni un prix en FCFA.
- *10–60 s.* Elle descend. « Ce que tu peux vendre » parle bien (couvertures, FCFA). Puis viennent six étapes, puis six fonctions. C'est le même message deux fois. Sur mobile, cela fait un long mur de cartes (voir `v2-mobile.png`).
- *1–3 min.* Elle tombe sur « Tests A/B honnêtes » et « Agents IA, sous ton contrôle… via MCP ». Pour une cible non technique, ce sont des mots qui font peur, et ils contredisent « Aucune compétence technique ».
- *3–5 min.* Tarifs : « Plan par défaut — Tarif à définir », avec une liste de quotas tous « illimité ». Puis : « Le paiement en ligne des abonnements n'est pas encore ouvert ». La séduction s'arrête ici. Elle ne sait pas combien cela coûte ni si elle peut payer. Dans la FAQ, elle découvre que c'est *elle* qui confirme le paiement à la main, ce que le hero laissait entendre autrement.

**À couper :**
- La carte « Agents IA, sous ton contrôle » et la question FAQ sur les agents IA. Elles visent une autre cible. Les garder pour une page « développeurs » ou une doc.
- La carte « Tests A/B honnêtes » sur la page d'accueil. C'est une fonction de plan supérieur, pas un argument pour un premier achat.
- Fusionner « Le parcours » (six étapes) et « Tout ce dont tu as besoin » (six fonctions) en une seule section de trois étapes : **Dépose ton fichier → Publie ta page → Encaisse sur ton SasPay et livre.** Trois étapes se retiennent, six ne se retiennent pas.
- La bulle « Conversion 4,8 % » de la maquette. Même étiquetée « exemple », un chiffre de performance inventé dans le hero est une promesse implicite. La remplacer par quelque chose de vrai, par exemple « 9 900 FCFA » ou « Lien SasPay vérifié ».
- La section Tarifs tant que les prix ne sont pas fixés. Il vaut mieux une ligne honnête comme « Gratuit pour ta première page, prix des plans bientôt » qu'une carte « Tarif à définir » avec un bouton « Commencer ».
- Dans le code, le badge « Le plus choisi » s'affiche automatiquement sur le 2e plan dès qu'il y a plus de deux plans. C'est une affirmation que rien ne prouve aujourd'hui. Le retirer jusqu'à ce que des données la justifient.
- Le titre FAQ « Les questions qu'on nous pose *vraiment* » tant qu'il n'y a pas de clients. Écrire plutôt « Questions fréquentes ».

**À affûter :**
- **Hero : un sous-titre d'une ligne.** Par exemple : « Ton e-book, ta formation ou ton pack : une page, ton lien SasPay, ton fichier livré. » Retirer « landing page » et retirer « laisse Maketia livrer » tant que la livraison n'est pas automatique. Une forme vraie aujourd'hui : « …et ton acheteur reçoit un lien de téléchargement privé dès que tu confirmes son paiement. »
- **Sur mobile, montrer le produit avant le deuxième bouton.** Mettre l'aperçu téléphone (la page de vente vue par l'acheteur, avec le prix en FCFA) juste sous le titre. Garder un seul bouton principal et faire de « Voir comment ça marche » un simple lien texte.
- **Montrer le moment de vérité.** Ajouter une seule image de ce que voit l'acheteur après avoir payé : le lien de téléchargement et le fichier. C'est l'expérience que le créateur achète. Aujourd'hui, la landing montre l'éditeur, c'est-à-dire l'outil, pas le résultat.
- **Rendre la confirmation manuelle visible et rassurante, pas cachée en FAQ.** Par exemple : « Aujourd'hui, tu valides chaque paiement en un tap, puis le lien part. Bientôt, ce sera automatique. » Dit franchement, c'est un argument de contrôle. Découvert tard, c'est une déception.
- **Le chiffre « dix minutes ».** Le garder seulement s'il est mesuré sur de vrais créateurs (condition 4). C'est la meilleure accroche de la page, à condition qu'elle soit vraie.
- **Une seule voix de la landing à l'app.** Le tutoiement de la landing est chaleureux. L'espace doit le garder, et parler de « ta page », pas de « tunnel ».

## Deuxième séance

Score: 6/10 | Vote: FUND IF

La landing a beaucoup progressé : elle est plus honnête, plus ciblée et plus belle. Le produit, lui, n'a presque pas bougé là où il casse. Le panel (simulé) le dit clairement : 0 achat sur 30 réponses valides. Les 70 autres acheteurs n'ont pas de réponse exploitable. La première raison de refus est la confirmation à la main et l'envoi du lien par le créateur. Le bouton WhatsApp réduit l'effort, mais il ne retire pas l'humain du chemin. Pour la lentille Produit, c'est le même défaut sous une meilleure lumière. D'où +1 point, pas plus.

### Conditions : tenues / pas tenues

| # | Condition (première séance) | État | Constat |
| --- | --- | --- | --- |
| 1 | Fermer la boucle de livraison (confirmation et envoi automatiques) | **Pas tenue** (progrès partiel) | Le créateur doit toujours confirmer, ouvrir « Liens de téléchargement », toucher « Créer les liens », puis « Envoyer sur WhatsApp », puis « Envoyer » dans WhatsApp. C'est mieux que copier-coller, mais il faut encore quatre à cinq gestes et un humain éveillé. Côté acheteur, `/paiement/retour` dit toujours « vous pouvez fermer cette page » sans dire *quand* ni *par où* le fichier arrivera. |
| 2 | Couper ce qui ne sert pas le premier fichier vendu | **Tenue sur la landing, pas dans l'app** | Sur la landing, A/B et MCP sont relégués à une ligne « Pour aller plus loin », et la carte « Agents IA » a disparu. Dans l'espace, la navigation et l'accueil restent organisés autour des « Tunnels ». |
| 3 | Un seul parcours, un seul vocabulaire, une seule voix | **Pas tenue** | La landing tutoie. L'espace vouvoie toujours (« Créez votre premier tunnel ») et dit toujours « tunnel ». Le message WhatsApp envoyé à l'acheteur vouvoie, ce qui est juste, car il parle au client du créateur. |
| 4 | Prouver les « dix minutes » ou changer le titre | **Tenue** | Le chiffre a disparu du titre. Le nouveau titre, « Vends ton e-book ou ta formation, sans y passer tes nuits », ne promet pas de durée. Voir toutefois la tension relevée plus bas. |
| 5 | Fixer les prix avant d'ouvrir la page | **Pas tenue, mais bien gérée** | Les prix ne sont toujours pas fixés. La landing ne montre plus de carte « Tarif à définir » : elle vend « 0 % de commission » et « commence gratuitement ». C'est honnête, mais le visiteur ne sait toujours pas combien coûtera la suite. |

Ce qui est corrigé depuis la première séance : la bulle « Conversion 4,8 % » a disparu, le badge « Le plus choisi » n'existe plus dans le code, et la FAQ s'intitule « Ce que tu te demandes sûrement ». La confirmation manuelle est dite franchement : elle est dans les étapes, dans le bandeau des quatre étapes et dans une question de FAQ dédiée. La landing montre enfin ce que vit l'acheteur, avec la section « Du clic au téléchargement » : page, paiement SasPay, lien sur WhatsApp.

### Les cinq premières minutes d'un visiteur sur la nouvelle landing

Le visiteur type est une créatrice sur téléphone, arrivée depuis un lien WhatsApp.

- *0–10 s.* « Vends ton e-book ou ta formation, *sans y passer tes nuits*. » Elle se reconnaît. Le sous-titre est concret : une page, son lien SasPay, un lien privé « dès que tu as vu l'argent arriver », « 0 % de commission ». Il y a un seul bouton principal, et la barre fixe en bas garde « Créer ma page gratuitement » à portée de pouce. C'est le bon premier écran.
- *10–60 s.* Les couvertures avec des prix en FCFA (5 000, 15 000, 3 000) parlent son langage. Ensuite, « Vendre sur WhatsApp, tu connais. Voilà la différence. » est la meilleure section de la page. Elle part de sa vie réelle : les « info ? », les captures d'écran parfois fausses, le PDF qui circule. Elle montre le changement ligne par ligne.
- *1–3 min.* Les quatre étapes, avec l'encadré « Aujourd'hui, c'est toi qui confirmes chaque paiement ». Elle comprend qu'elle devra rester sur son téléphone. La promesse du titre, « sans y passer tes nuits », se fissure ici. Si un client paie à 23 h, c'est elle qui devra confirmer et envoyer, ou bien le client attendra jusqu'au matin. La page ne ment pas, mais le titre promet une liberté que le produit ne donne pas encore.
- *3–5 min.* « Pour vendre un fichier, rien de plus », puis « Maketia est fait pour toi si… » et un grand « 0 % ». Elle veut savoir combien coûte la suite après le gratuit. La réponse est « affichés à leur ouverture ». La FAQ lui apprend aussi qu'il faut un compte SasPay. Si elle est au Cameroun, au Bénin ou au Togo, rien sur la page ne lui dit si SasPay fonctionne chez elle. La carte des concurrents relève que SasPay n'affiche que la Côte d'Ivoire, le Sénégal et le Burkina Faso. La pastille « créateurs d'Afrique francophone » promet donc plus large que ce qui est vérifié.

**Verdict landing :** belle, honnête, à la bonne personne. Elle ne peut plus être beaucoup améliorée tant que le produit derrière ne change pas. Il reste trois retouches :
1. Retirer ou nuancer « sans y passer tes nuits » tant que la confirmation est manuelle. Par exemple : « Vends ton e-book ou ta formation, sans courir après tes clients » (c'est déjà le titre de l'onglet, `metadata.title`).
2. Remplacer « Afrique francophone » par les pays où SasPay est vérifié, ou ajouter une ligne « Disponible là où SasPay l'est : CI, SN, BF… ».
3. Dans la carte « Paiement confirmé · Lien envoyé sur WhatsApp » de l'illustration du hero, le mot « envoyé » laisse croire à un envoi automatique. Écrire plutôt « Lien prêt à envoyer sur WhatsApp ».

### Quoi couper ou affûter ensuite, dans le produit lui-même

1. **Le moment de vérité, en un seul geste.** Fusionner « Confirmer le paiement », « Créer les liens » et « Envoyer sur WhatsApp » en une seule action : **« Confirmer et envoyer »**. Elle crée les liens et ouvre WhatsApp avec le message prêt. Plus de boîte de dialogue intermédiaire ni de bouton « Créer les liens ». La confirmation reste manuelle, ce qui garde l'honnêteté, mais elle tient en un tap.
2. **Avertir le créateur qu'un client attend.** C'est le vrai problème de « sans y passer tes nuits ». Une commande en attente doit être visible tout de suite, par exemple avec un compteur en tête de l'espace, en attendant mieux. Sinon, la confirmation manuelle devient de l'oubli.
3. **Dire à l'acheteur ce qui va se passer.** Sur `/paiement/retour`, remplacer « vous pouvez fermer cette page » par : « [Prénom du créateur] vérifie ton paiement et t'envoie ton lien sur WhatsApp, au numéro que tu as donné. » Ajouter aussi un bouton « Écrire au vendeur sur WhatsApp ». Aujourd'hui, l'acheteur qui vient de payer repart les mains vides, sans savoir quoi attendre. C'est le pire moment pour un silence.
4. **Continuer à pousser la livraison automatique** (webhooks SasPay ou vérification par référence). C'est la demande n°1 du panel et le seul point où tous les concurrents directs font mieux. Tant qu'elle manque, Maketia reste « WhatsApp avec une plus belle page ».
5. **Couper « tunnel » dans l'espace.** Le premier écran après inscription doit dire « Ta page » et demander le fichier et le prix, pas un nom de tunnel. Passer l'espace au tutoiement, comme la landing.
6. **Ne jamais laisser un réglage admin bloquer un créateur.** Le domaine des liens SasPay doit être préconfiguré avant l'ouverture.
7. **Garder hors de la première expérience** les tests A/B, le MCP et le multi-pages. La landing les a mis à leur place. L'app doit faire de même, avec une zone « avancé ».

**Les conditions pour passer à FUND :** les points 1, 2 et 3 ci-dessus livrés, plus le point 4 ou une date crédible pour lui. Il faut aussi un test réel, et pas un panel simulé, avec au moins cinq créateurs de la cible, dans un pays où SasPay est vérifié, qui vendent un fichier de bout en bout.
