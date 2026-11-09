# Prompt à coller dans Claude Code (sur ton ordinateur)

Remplace d'abord les 3 valeurs entre crochets.

```text
Tu es mon monteur vidéo et mon opérateur technique. Tu travailles sur MON ordinateur.

## Contexte
Je lance une page Facebook + TikTok (Côte d'Ivoire / Afrique francophone) sur un thème : « créer des jeux vidéo avec l'IA, sans savoir coder ».
Objectif de ces vidéos : faire des vues et récupérer des contacts WhatsApp avec l'offre gratuite « 5 jeux créés avec l'IA à tester sur ton téléphone ».
Ton : direct, fier, africain, crédible. Aucune promesse de revenus.
Si les skills `video`, `social`, `content-strategy` et `copywriting` sont installés, utilise-les pour le montage, les accroches et les légendes.

Valeurs :
- Dossier du jeu fini : [CHEMIN_DU_JEU_7_SAUTS]  (jeu « Les 7 sauts du Dahomey », commencé avec OpenCode, terminé avec Claude Code en moins de 24 h)
- Modèle gratuit OpenCode à utiliser : [MODELE_OPENCODE]  (vérifie le nom exact avec `opencode models`)
- Système : [WINDOWS ou MAC]

## Règles d'honnêteté (non négociables)
- On ne montre que ce qui s'est réellement passé à l'écran.
- La transition vers le jeu fini dit « Quelques heures plus tard… », jamais « quelques instants ».
- Le carton final dit exactement : « Créé avec l'IA en moins de 24 h — OpenCode + Claude Code ».

## À produire : 2 vidéos verticales 1080x1920, 30 i/s, 45 à 75 s chacune
- Vidéo A : session OpenCode → « Quelques heures plus tard… » → gameplay des 7 sauts du Dahomey.
- Vidéo B : session Claude Code dans le terminal → Claude Code crée un mini-jeu 3D, le lance et le teste → « Quelques heures plus tard… » → gameplay des 7 sauts du Dahomey.

## Étape 0 — Vérifications (montre-moi le résultat avant de continuer)
1. Vérifie qu'ils sont installés : ffmpeg, node, npx, opencode, claude. Installe ce qui manque, en m'expliquant chaque commande avant de la lancer.
2. Ouvre le dossier du jeu et trouve comment le lancer : `package.json` (npm run dev / build / preview) ou `index.html` (servi avec `npx serve`). Lance-le une fois et vérifie qu'il marche.

## Étape 1 — Enregistrer la session OpenCode (vidéo A)
1. Crée un dossier vide `demo-opencode` sur le Bureau.
2. Ouvre une NOUVELLE fenêtre de terminal en plein écran, thème sombre, police à 20 pt minimum (Windows Terminal ou Terminal.app). Va dans `demo-opencode`.
3. Lance l'enregistrement de l'écran avec ffmpeg, en 30 i/s :
   - Windows : `ffmpeg -f gdigrab -framerate 30 -i desktop -c:v libx264 -preset ultrafast -crf 18 rec-opencode.mkv`
   - Mac : `ffmpeg -f avfoundation -framerate 30 -capture_cursor 1 -i "1:none" -c:v libx264 -preset ultrafast -crf 18 rec-opencode.mkv` (vérifie le numéro d'écran avec `ffmpeg -f avfoundation -list_devices true -i ""`. S'il faut autoriser l'enregistrement de l'écran dans Réglages > Confidentialité, demande-le-moi.)
4. Dans la fenêtre du terminal, lance `opencode -m [MODELE_OPENCODE]`, puis tape les prompts ci-dessous un par un. Attends à chaque fois que la réponse soit finie : on doit voir la réflexion et le code s'écrire.
   - P1 : « Crée un jeu 3D jouable dans le navigateur : "Les 7 sauts du Dahomey". Un jeune guerrier du royaume du Dahomey doit réussir 7 sauts au-dessus du fleuve, de plateforme en plateforme. Utilise Three.js. Flèches pour bouger, espace pour sauter, compteur 1/7 à 7/7 à l'écran. »
   - P2 : « Ajoute des plateformes qui bougent, des couleurs inspirées des tissus et bas-reliefs d'Abomey, et un écran de victoire. »
   - P3 : « Lance le jeu dans le navigateur pour que je le teste. »
5. Laisse tourner jusqu'à ce que le premier aperçu du jeu s'ouvre, puis arrête l'enregistrement proprement (touche q dans ffmpeg).
6. Si le modèle gratuit atteint sa limite, garde ce qui a été enregistré : c'est cohérent avec la suite (« quelques heures plus tard »).

## Étape 2 — Enregistrer la session Claude Code (vidéo B)
Même méthode, dans un dossier vide `demo-claude-code` :
1. Nouvelle fenêtre de terminal, enregistrement ffmpeg (`rec-claude.mkv`), puis lance `claude`.
2. Tape les prompts P1, P2 et P3 ci-dessus, puis P4 : « Teste le jeu toi-même avec Playwright, corrige ce qui ne marche pas, puis relance-le. »
3. On doit voir Claude Code réfléchir, écrire les fichiers, lancer le jeu et le tester. Arrête l'enregistrement quand le jeu tourne.

## Étape 3 — Enregistrer le gameplay des 7 sauts du Dahomey
1. Lance le jeu fini depuis [CHEMIN_DU_JEU_7_SAUTS].
2. Option 1 (automatique) : avec Playwright (`recordVideo`, 1920x1080), joue 60 à 90 s en envoyant les touches et réussis au moins 3 sauts.
3. Option 2 (si la partie automatique a l'air robotique ou échoue) : lance l'enregistrement ffmpeg de l'écran et demande-moi de jouer 60 s. Préviens-moi juste avant de démarrer.
4. Garde les meilleurs moments : un saut réussi, un raté, le compteur qui monte, la victoire si possible.

## Étape 4 — Montage (ffmpeg)
Pour chaque vidéo (A et B), format 1080x1920 :
1. 0–3 s, ACCROCHE : 2 s du meilleur moment de gameplay, avec en gros texte « J'ai demandé à une IA de créer un jeu vidéo 3D 🇧🇯🇨🇮 ».
2. Session terminal : recadre sur la zone du texte pour qu'il soit lisible sur téléphone. Accélère les attentes (x4 à x8) et garde à vitesse normale l'envoi de chaque prompt et le début de chaque réponse. Texte en haut : « Prompt 1 », « Prompt 2 »…
3. Carton noir de 1,5 s : « Quelques heures plus tard… »
4. Gameplay des 7 sauts : 20 à 30 s. Si la capture est horizontale, centre-la sur un fond flou du même plan.
5. Carton final de 3 s : « Créé avec l'IA en moins de 24 h — OpenCode + Claude Code », puis « Commente JEU pour recevoir 5 jeux à tester gratuitement ».
6. Texte incrusté : police lisible, contour noir, jamais dans les 250 px du bas ni sur le côté droit (zones couvertes par l'interface TikTok).
7. Pas de musique protégée : je l'ajouterai dans TikTok.
8. Exporte en H.264, AAC, 30 i/s, moins de 200 Mo : `video-A-opencode.mp4`, `video-B-claude-code.mp4`, plus une miniature PNG pour chacune.

## Étape 5 — Vérification
1. Extrais une image toutes les 3 s de chaque export, regarde-les, et corrige le texte illisible, les coupes brutales ou les écrans noirs.
2. Vérifie la durée, la résolution et le poids avec ffprobe.

## Étape 6 — Livraison
1. Range tout dans `Bureau/videos-demo/` : les 2 vidéos, les miniatures, et un fichier `legendes.md` contenant pour chaque vidéo :
   - une légende TikTok (150 caractères maximum, accroche + appel à l'action « Commente JEU ») ;
   - une légende Facebook (3 à 5 lignes) ;
   - 5 hashtags pertinents (#jeuvideo #IA #CotedIvoire #Benin #createur…).
2. Si le MCP Zernio est connecté : génère un lien d'envoi (media_generate_upload_link), envoie les vidéos, et crée un BROUILLON TikTok (compte @wangjagueli) et un BROUILLON Facebook (page WANG). Ne publie rien directement.
3. Donne-moi un résumé : ce qui a été enregistré, ce qui a échoué, et où sont les fichiers.
```
