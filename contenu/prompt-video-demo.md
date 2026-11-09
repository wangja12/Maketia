# Prompt vidéo de démo (Claude Code seul)

À coller dans Claude Code, lancé **depuis le dossier du jeu « Les 7 sauts du Dahomey »**.

```text
On fait une vidéo TikTok/Facebook de démo : on te voit, toi Claude Code, travailler sur ce jeu, puis on voit le jeu tourner.

1. ENREGISTREMENT
- Lance un enregistrement de tout l'écran avec ffmpeg en arrière-plan (30 i/s, H.264) dans `videos-demo/rec.mkv`.
  Windows : -f gdigrab -i desktop. Mac : -f avfoundation -i "1:none" (vérifie le numéro d'écran, et demande-moi d'autoriser l'enregistrement si besoin).
- Mets ta fenêtre de terminal en plein écran, avec une grosse police.

2. TRAVAIL RÉEL SUR LE JEU (filmé)
Pendant l'enregistrement, réalise vraiment ces 3 demandes sur ce jeu, en montrant ta réflexion et le code que tu écris :
- P1 : « Explique en 3 lignes ce qu'est ce jeu, puis ajoute un effet visuel quand le joueur réussit un saut (particules aux couleurs du Dahomey). »
- P2 : « Ajoute à l'écran un compteur "Saut 1/7 … 7/7" bien visible. »
- P3 : « Lance le jeu dans le navigateur. »
Arrête l'enregistrement du terminal quand le jeu s'ouvre.

3. GAMEPLAY
- Avec Playwright (recordVideo 1920x1080), joue 60 à 90 s : réussis plusieurs sauts, montre le nouveau compteur et l'effet de saut. Si ta partie a l'air robotique, enregistre l'écran et demande-moi de jouer 60 s.

4. MONTAGE (ffmpeg), vertical 1080x1920, 45 à 60 s
- 0–3 s : le meilleur saut du gameplay + texte « J'ai demandé à une IA d'améliorer mon jeu vidéo 3D 🇧🇯 ».
- Le terminal recadré pour être lisible sur téléphone, attentes accélérées x4 à x8, étiquettes « Prompt 1/2/3 ».
- Carton 1,5 s : « Quelques minutes plus tard… »
- Gameplay : 20 à 30 s, sur fond flou si la capture est horizontale.
- Fin, 3 s : « Jeu créé avec l'IA en moins de 24 h » puis « Commente JEU pour recevoir 5 jeux à tester gratuitement ».
- Texte avec contour noir, hors des 250 px du bas et du bord droit (interface TikTok). Pas de musique (je l'ajoute dans TikTok).
- Exporte `videos-demo/demo-7-sauts.mp4` (H.264/AAC, 30 i/s, moins de 200 Mo) et une miniature PNG.

5. VÉRIFIER ET LIVRER
- Extrais une image toutes les 3 s, regarde-les, et corrige le texte illisible ou les écrans noirs.
- Écris `videos-demo/legendes.md` avec une légende TikTok (150 caractères maximum), une légende Facebook (3 à 5 lignes) et 5 hashtags.
- Si le MCP Zernio est connecté : envoie la vidéo et crée un BROUILLON TikTok (@wangjagueli) et un BROUILLON Facebook (WANG). Ne publie rien.
- Résume-moi ce qui a marché, ce qui a échoué, et où sont les fichiers.
```
