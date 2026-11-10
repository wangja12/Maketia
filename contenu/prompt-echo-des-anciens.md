# Prompt : « L'Écho des Anciens », jeu complet selon la bible (filmé)

À coller dans Claude Code dans ton terminal. Il trouve lui-même le jeu et la bible.

```text
Mission : construire le jeu COMPLET « L'Écho des Anciens » décrit dans la bible, à partir d'une COPIE de mon jeu « Les 7 sauts du Dahomey ». Je ne fais rien : tu fais tout toi-même.

## Préparation (fais-la toi-même, sans me demander)
1. Trouve le dossier de mon jeu « Les 7 sauts du Dahomey » sur cet ordinateur : le dossier courant, ou cherche un dossier dont le nom contient « 7 » et « saut » / « dahomey » dans mon dossier personnel (Bureau, Documents, projets). Si tu en trouves plusieurs, prends le plus récent et dis-moi lequel.
2. Trouve la bible dans mon dossier Téléchargements : un fichier dont le nom commence par « Bible_Jeu_Echo_des_Anciens » (.md). Si plusieurs versions existent, prends la plus récente.
3. Crée le dossier `echo-des-anciens` à côté du dossier des 7 sauts. Copie tout le jeu dedans, sauf `node_modules`, `.git`, `dist` et les caches.
4. Copie la bible dans `echo-des-anciens/BIBLE.md`.
5. Va dans `echo-des-anciens` : c'est là que tu fais TOUT le travail. Puis enchaîne directement avec la suite, sans attendre.

Tu suis la bible (BIBLE.md) entièrement : univers, 7 régions, personnages, 7 Courants et leurs compétences, combat, boss, progression, équipement, forge, 5 saisons et 50 épisodes, quêtes, bestiaire, HUD, commandes tactiles, menus, accessibilité, audio, coopération, sauvegarde.
Tu filmes aussi ton travail pour des vidéos TikTok/Facebook.

## 0. Règles
- Ne modifie JAMAIS le jeu d'origine. Tu travailles uniquement sur la copie.
- Lis BIBLE.md en entier avant de coder. Respecte sa direction :
  - 95 % de lumière, 5 % de tension ;
  - le thème rejeté par la note de direction n'apparaît nulle part ;
  - aucune figure sacrée réelle ;
  - une mythologie fictive ;
  - aucune vente de puissance.
- Plateformes : navigateur PC et mobile (Android/iOS via le navigateur, puis empaquetage si possible). Garde la base technique du jeu d'origine (Three.js, etc.), sauf si un changement est indispensable : explique-le avant.

## 1. Copie et organisation
1. Dans `echo-des-anciens/`, lance `git init`, réinstalle les dépendances et vérifie que la copie se lance.
2. Crée `PROGRESS.md` : la liste de TOUT ce que la bible demande (les 20 systèmes de la section 17.1, les 7 régions, les 50 épisodes, les personnages, les boss, l'UI, l'audio, la coopération), avec une case à cocher pour chaque élément.
3. À chaque élément terminé et testé : coche-le dans PROGRESS.md et fais un commit git.
4. Si la session s'arrête (limite, coupure), au prochain lancement relis PROGRESS.md et reprends exactement là où tu t'étais arrêté. Ne recommence jamais de zéro.
5. Si tu disposes de sous-agents, utilise-les pour travailler en parallèle sur des systèmes indépendants (UI, audio, contenus de quêtes, bestiaire).

## 2. Ordre de construction (section 17.3 de la bible, jusqu'au bout)
1. Socle : contrôleur joueur, caméra hybride, combat (attaque rapide et lourde, esquive, parade, verrouillage), HUD, commandes tactiles, sauvegarde.
2. Les 7 Courants avec toutes leurs compétences, les synergies, les 4 archétypes, les arbres de progression.
3. Inventaire, équipement, familles d'armes, rareté, forge (Déhou).
4. Quêtes, dialogues, états narratifs et conséquences, les 3 fins.
5. Les 7 régions, une par une, chacune avec sa palette, son donjon, son boss et ses activités. Les 50 épisodes des 5 saisons, chacun jouable avec un objectif et une conclusion.
6. Bestiaire complet, IA ennemie, boss à phases avec attaques télégraphiées.
7. Menus (inventaire, carte, quêtes, bestiaire, codex, fabrication, paramètres), accessibilité complète.
8. Audio : sons d'armes, retours d'action, ambiances régionales (sons générés ou libres de droits, jamais de musique sacrée).
9. Coopération jusqu'à 4 joueurs (WebRTC ou serveur WebSocket léger), mise à l'échelle des ennemis.
10. Optimisation mobile : tester en 390x844 et viser 30 i/s minimum sur un téléphone moyen.
Pour les visuels : formes et matériaux procéduraux en Three.js, textures générées. Tout asset externe doit avoir une licence libre, notée dans `CREDITS.md`.

## 3. Tests à chaque étape
- Teste toi-même avec Playwright, sur ordinateur et en vue mobile. Zéro erreur dans la console.
- Joue chaque épisode terminé du début à la fin avant de le cocher.

## 4. Enregistrement et vidéos
- Pendant le travail, enregistre l'écran en arrière-plan avec ffmpeg (30 i/s, H.264), un fichier par grande étape, dans `videos-demo/`.
  Windows : -f gdigrab -i desktop. Mac : -f avfoundation -i "1:none" (vérifie le numéro d'écran, et demande-moi d'autoriser l'enregistrement si besoin).
- Note l'heure de début et de fin de chaque étape.
- À chaque grande étape (socle, chaque région, chaque saison, jeu final), monte une vidéo verticale 1080x1920 de 45 à 60 s :
  - 0–3 s : le plus beau plan du jeu + texte d'accroche ;
  - le travail dans le terminal, recadré et accéléré (x4 à x8) ;
  - carton « Quelques minutes plus tard… » ou « Quelques heures plus tard… », selon la durée RÉELLE ;
  - 20 à 30 s de gameplay enregistré avec Playwright (si ta partie a l'air robotique, demande-moi de jouer) ;
  - fin : « L'Écho des Anciens — créé avec l'IA » + « Commente JEU pour recevoir 5 jeux à tester gratuitement » ;
  - texte avec contour noir, hors des 250 px du bas et du bord droit, pas de musique.
- Exporte en H.264/AAC, 30 i/s, moins de 200 Mo, avec une miniature PNG et une entrée dans `videos-demo/legendes.md` (légende TikTok de 150 caractères maximum, légende Facebook de 3 à 5 lignes, 5 hashtags).
- Si le MCP Zernio est connecté : crée des BROUILLONS TikTok (@wangjagueli) et Facebook (WANG). Ne publie jamais directement.

## 5. Compte rendu
À la fin de chaque session, donne-moi :
- ce qui est fini (avec le % de PROGRESS.md coché) ;
- ce qui reste ;
- les vidéos produites ;
- la commande pour lancer le jeu.
```
