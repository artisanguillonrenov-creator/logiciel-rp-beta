# Politique de confidentialité — Elyndor

Dernière mise à jour : 18 septembre 2026.

Elyndor est une application locale de jeu de rôle. Les histoires, réglages, caches et portraits sont enregistrés sur l’appareil ou dans le stockage du navigateur. Le projet ne fournit pas de compte utilisateur ni de serveur applicatif centralisé.

## Données envoyées aux services externes

Lorsque tu configures un fournisseur, l’application lui envoie les éléments nécessaires à la fonction demandée : le prompt narratif, certains messages récents, le résumé, les faits, le lore pertinent et les descriptions de l’histoire. OpenRouter, Infermatic et OpenAI peuvent donc recevoir le contenu de la partie selon le moteur et la clé choisis. La traduction de l’interface ou des messages peut également utiliser le moteur configuré.

Une illustration peut envoyer une description de scène ainsi que des images de référence. La génération d’images est désactivée par défaut. Les clés API ne sont pas envoyées au dépôt GitHub par l’application et sont conservées dans SecureStore sur Android/iOS. Sur le web, la session est conservée dans l’onglet par défaut ; la conservation durable est optionnelle et non chiffrée.

## Données qui restent locales

Les sauvegardes, les packs de contenu importés, les caches d’embeddings et les images générées sont gérés localement par l’application. Le dépôt GitHub contient le code et les ressources publiques, pas les histoires créées dans l’application.

## Contrôle de l’utilisateur

Tu peux retirer tes clés dans **Réglages**, désactiver la conservation web, supprimer une histoire et supprimer les images dérivées. Une clé API est personnelle : utilise uniquement une clé avec les droits et limites que tu acceptes. Évite d’insérer dans une histoire des informations personnelles que tu ne souhaites pas transmettre au fournisseur choisi.

## Limites

Cette application bêta ne garantit pas un chiffrement complet des données locales. Le profil de contenu et son code de déverrouillage sont des garde-fous applicatifs, pas une protection de sécurité. Les politiques des fournisseurs externes s’appliquent aux données qu’ils reçoivent.

Pour demander une évolution de cette politique, ouvre une issue publique sans inclure de clé API ni de contenu privé. Pour signaler une vulnérabilité, utilise la procédure de `SECURITY.md`.
