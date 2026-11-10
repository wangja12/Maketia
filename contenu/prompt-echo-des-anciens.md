# Prompt : transformer une copie des 7 sauts en « L'Écho des Anciens » (filmé)

À coller dans Claude Code, lancé **depuis le dossier du jeu « Les 7 sauts du Dahomey »**.
Avant de lancer, mets le fichier `BIBLE.md` (la bible du jeu) dans ce dossier.

```text
Mission : créer un nouveau jeu, « L'Écho des Anciens », à partir d'une COPIE de ce jeu, et filmer ton travail pour une vidéo TikTok/Facebook.

## 0. Règles
- Ne modifie JAMAIS le jeu d'origine. Tu travailles uniquement sur la copie.
- Lis entièrement BIBLE.md avant de coder. C'est la référence pour l'histoire, les noms, les couleurs, l'interface et les interdits :
  - 95 % de lumière, 5 % de tension ;
  - le thème rejeté par la note de direction de la bible n'apparaît NULLE PART ;
  - aucune figure sacrée réelle ;
  - une mythologie entièrement fictive.
- Note l'heure exacte de début et de fin : la vidéo affichera la durée réelle.

## 1. Copie
1. Copie tout le projet dans un dossier frère `echo-des-anciens/`, sans `node_modules`, `.git`, `dist` ni les caches. Réinstalle ensuite les dépendances dans la copie.
2. Vérifie que la copie se lance à l'identique avant de la modifier.

## 2. Enregistrement (pendant tout le travail)
- Lance en arrière-plan un enregistrement de tout l'écran avec ffmpeg (30 i/s, H.264) dans `echo-des-anciens/videos-demo/rec-travail.mkv`.
  Windows : -f gdigrab -i desktop. Mac : -f avfoundation -i "1:none" (vérifie le numéro d'écran, et demande-moi d'autoriser l'enregistrement si besoin).
- Ton terminal reste en plein écran, avec une grosse police : on doit voir ta réflexion et le code s'écrire.

## 3. Transformation : périmètre = PROLOGUE jouable (pas le RPG complet)
Garde le moteur, la caméra et les sauts du jeu d'origine. Remplace l'identité et ajoute le minimum pour un vrai prologue :
1. Titre et écran d'accueil : « L'Écho des Anciens — Prologue : Terre des Brumes ».
2. Personnage : Aklé, éclaireur de Kétou-Nova (silhouette athlétique, équipement pratique, détails textiles et métalliques). Remplace le modèle et les couleurs du héros. Utilise des formes simples en Three.js si tu n'as pas de modèle 3D.
3. Décor : Terre des Brumes. Collines vertes, rizières, cascades, routes de terre rouge, ciel lumineux. Palette : vert émeraude, ocre, turquoise, or doux. Aucun filtre gris, aucun ciel noir.
4. Objectif : les 7 sauts deviennent 7 « Ancrages » lumineux à réactiver, de plateforme en plateforme. Compteur « Ancrage 1/7 … 7/7 ».
5. Témi : courtes bulles de dialogue au début, au 4e Ancrage et à la fin (ton vif et drôle, voir la bible).
6. Un pouvoir : Sogbé (Foudre), « Pas d'orage », un dash court avec un effet d'éclair. Touche dédiée, plus un bouton tactile.
7. Ennemis légers : 2 ou 3 soldats de la Ligue du Trône qui patrouillent. Attaque rapide pour les repousser. Aucune violence graphique.
8. Fin : un court face-à-face avec le Héraut d'Azur (silhouette aérienne bleue), puis l'écran « À suivre… Saison 1 : Les Routes de la Dérive ».
9. HUD (style de la bible : ivoire, bleu nuit, accents or et turquoise) : vie, jauge de Courant, compteur d'Ancrages.
10. Mobile : joystick virtuel à gauche, boutons saut, attaque et dash à droite. Ça doit se jouer sur téléphone.
11. Remplace tous les textes, titres, crédits et métadonnées du jeu d'origine (titre de l'onglet, favicon, README).

## 4. Tester
- Lance le jeu et teste-le toi-même avec Playwright, sur ordinateur et en vue mobile (390x844). Corrige les erreurs de la console.
- Vérifie qu'on peut finir le prologue du début à la fin.

## 5. Vidéo (après le travail)
1. Arrête l'enregistrement de l'écran.
2. Enregistre 60 à 90 s de gameplay avec Playwright (recordVideo 1920x1080) : Aklé, les Ancrages, le dash éclair, un soldat repoussé, les dialogues de Témi. Si ta partie a l'air robotique, enregistre l'écran et demande-moi de jouer 60 s.
3. Montage ffmpeg, vertical 1080x1920, 45 à 60 s :
   - 0–3 s : le plus beau plan du gameplay + texte « J'ai transformé mon jeu vidéo en un tout nouveau jeu avec l'IA 🇧🇯 » ;
   - le travail dans le terminal : recadré et lisible, accéléré x4 à x8, étiquettes des étapes (« Nouveau héros », « Nouveau monde »…) ;
   - carton de 1,5 s avec la durée réelle : « Quelques minutes plus tard… » ou « Quelques heures plus tard… » ;
   - gameplay de 20 à 30 s ;
   - fin de 3 s : « L'Écho des Anciens — créé avec l'IA en [durée réelle] », puis « Commente JEU pour recevoir 5 jeux à tester gratuitement » ;
   - texte avec contour noir, hors des 250 px du bas et du bord droit, pas de musique.
4. Exporte `videos-demo/echo-des-anciens.mp4` (H.264/AAC, 30 i/s, moins de 200 Mo) et une miniature PNG.
5. Extrais une image toutes les 3 s, regarde-les et corrige ce qui ne va pas.

## 6. Livraison
- Écris `videos-demo/legendes.md` avec une légende TikTok (150 caractères maximum), une légende Facebook (3 à 5 lignes) et 5 hashtags.
- Si le MCP Zernio est connecté : envoie la vidéo et crée un BROUILLON TikTok (@wangjagueli) et un BROUILLON Facebook (WANG). Ne publie rien.
- Résume-moi :
  - ce qui a été fait ;
  - la durée réelle ;
  - ce qui manque par rapport à la bible (pour les prochains épisodes) ;
  - où sont les fichiers ;
  - la commande pour lancer le jeu.
```
