# Atelier concepteur — Traces réelles et audit technique V1

Ajout à la refonte de la console (PR #84) :

- Bouton **Analyser la dernière histoire** dans les modules Méta-moteurs et Diagnostics.
- Charge uniquement à la demande l'histoire la plus récemment modifiée, sans modifier sa sauvegarde.
- Recherche un **diagnostic du tour enregistré** et inspecte la trace \`Méta-moteurs V2.1 — contrat narratif\`.
- Rend pour chaque M01–M15 : mobilisé, non mobilisé, ou **non mesuré**. Ce dernier état ne doit jamais être interprété comme une panne ou une activation absente.
- Affiche les étapes du pipeline, les durées de mesure et les totaux de tokens des appels IA lorsque disponibles.
- Depuis Instantanés, crée un **audit technique JSON partageable** avec version, commit JS, profil et configuration, nombre total d'histoires, étapes et mobilisations du dernier tour.
- Ne transmet aucun texte d'histoire, titre, nom, ID de récit, clé API, URL privée, prompt système ni détails de recherche contenant du lore. Les raisons/étapes des traces techniques sont réduites aux métadonnées non narratives.
- Les diagnostics peuvent être absents sur les histoires anciennes ou si la dernière partie n'a pas encore été jouée depuis l'instrumentation.

Ce module ne mesure pas encore l'exécution indépendante de chacun des sous-systèmes M01–M15 : le contrat V2.1 est une couche de sélection codée de responsabilités. L'atelier présente explicitement cette distinction.

Vérifications : npm test, TypeScript, compilation web puis APK après fusion.
