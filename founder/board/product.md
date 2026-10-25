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
