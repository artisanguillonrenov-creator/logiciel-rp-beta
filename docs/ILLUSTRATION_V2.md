# Système d'illustration V2 — continuité visuelle

Objectif : que chaque illustration donne l'impression de **continuer le même film**, au lieu de produire une image indépendante à partir du dernier message.

```text
état narratif + état visuel persistant + personnages réellement visibles
+ décor courant + 2 dernières scènes illustrées + références personnages
        ↓
modèle narratif Elyndor Cloud = directeur artistique (directionArtistique.ts)
        ↓
prompt structuré cinématographique (visualBible.ts)
        ↓
modèle image Elyndor Cloud, format 16:9 (elyndorCloudImages.ts)
        ↓
mise à jour de l'état visuel + historique glissant des 2 dernières scènes
```

## Modules

| Fichier | Rôle |
|---|---|
| `src/engine/visualState.ts` | État visuel persistant (personnages, décor, scènes), critère PNJ unique, validation des changements par le récit, historique glissant, priorité des références. Pur, sans React Native. |
| `src/engine/visualBible.ts` | Bible visuelle Elyndor, 7 profils de cadrage, contraintes négatives structurées, `PromptImageStructure`, mise en forme en sections, variantes de régénération. Pur. |
| `src/engine/directionArtistique.ts` | Appel au modèle narratif (directeur artistique), validation de sa réponse JSON, repli local hors ligne. |
| `src/engine/elyndorCloudImages.ts` | Client du modèle image Elyndor Cloud (contrat `GenerateurImage`, 16:9 / 3:4). |
| `src/engine/images.ts` | Orchestration : collecte des références, génération de scène et de portraits, point d'extension `definirGenerateurImage`. |
| `src/automation/visualRoutines.ts` | Job Kernel `visual.scene.generate` (modes `nouvelle`, `regenerer`, `autre-cadrage`, `autre-angle`, `autre-composition`). |

Le Kernel, la file de jobs, la déduplication, le contrôle de révision, les événements visuels, le cache d'avatars et le nettoyage des fichiers sont inchangés.

## Source de vérité et persistance

- `StoryState.etatVisuel` (optionnel) est la **seule** source de vérité visuelle. Absent, il vaut `etatVisuelVide()` : aucune migration de schéma, `VERSION_SCHEMA_HISTOIRE` reste à 12 pour rester compatible avec le format V13.
- Les fichiers image restent dans `sceneImagesStore` (fichiers sur Android, IndexedDB sur Web) et `pnjAvatarsStore`, indexés par révision ou identifiant.
- `etatVisuel.sequence` est monotone : une sauvegarde de l'écran ne peut pas écraser un état visuel plus récent écrit par le Kernel (`conserverEtatVisuelRecent` dans le dépôt d'histoires).

## Règles

- **Historique glissant** : au plus 2 scènes illustrées (A → A ; B → A+B ; C → B+C ; D → C+D). L'image la plus ancienne est supprimée à l'enregistrement de la nouvelle. Une régénération remplace sa scène en place.
- **Changements visuels** : appliqués seulement s'ils citent un passage du récit (narration, fiche du joueur ou d'un PNJ). Les messages du joueur sont des intentions et n'établissent rien. Un changement de lieu réinitialise l'état propre au lieu mais garde l'heure, la météo et la lumière.
- **Personnages visibles** : décidés par le modèle narratif, qui distingue un personnage mentionné, présent ou visible. Les noms sont résolus en joueur, PNJ ou figurant. La détection par nom ne sert plus que de repli hors ligne.
- **PNJ** : un critère unique, `estPnjVisuel` (catégorie `pnj`, nommé, différent du joueur, `provisoire` ou `permanent`), pour l'avatar, les références et la description. `permanent` ne sert qu'à la priorité.
- **Références**, dans cet ordre : portrait du joueur, avatar du joueur, PNJ principaux, autres PNJ, scène précédente, avant-dernière scène. La limite `MAX_REFERENCES_IMAGE` (6) élimine d'abord les scènes, jamais un visage. Les références ne concernent que les personnages visibles.
- **Régénération** : réutilise la `PromptImageStructure` enregistrée pour la révision. Seule la caméra change, l'état visuel n'est pas réanalysé.

## Serveur Elyndor Cloud (pod Runpod)

- Pod A40 48 Go (`ELYNDOR_CLOUD_POD` dans `src/engine/elyndorCloud.ts`) :
  - narration : llama.cpp + Anubis 70B v1.2 Q3_K_M, port 8000 ;
  - images : Lustify SDXL v4 + IP-Adapter, port 7860.
  - embeddings : bge-m3 sur CPU, `/v1/embeddings` sur le port 7860. Ils alimentent la recherche sémantique ObjectBox, moteur principal du narrateur ; la recherche lexicale prend le relais si le service ne répond pas.
- Tout est installé une seule fois sur le volume réseau `elyndor-cloud` (monté sur `/workspace`, conservé quand le pod s'arrête) par `infra/runpod/install.sh` : venv, llama.cpp, modèles et scripts sous `/workspace/elyndor`.
- La commande de démarrage du pod lance `/workspace/elyndor/boot.sh`, qui démarre les serveurs (`start.sh`, ~3 min) puis `watchdog.sh`.
- `watchdog.sh` arrête le pod après 30 min sans requête de l'app (`ELYNDOR_INACTIVITE_MIN`). Un pod arrêté ne coûte que le stockage du volume. Le fichier `/workspace/elyndor/garder-allume` suspend l'arrêt pendant une maintenance.
- **Consigne permanente** : le modèle image ne voit jamais la conversation. Le modèle narratif rédige tout ce qu'il reçoit, en anglais : le `promptSdxl` des scènes (redemandé s'il est omis) et le prompt de chaque portrait.
- **Références exploitées par le serveur** :
  - le visage du personnage visible le plus prioritaire passe par IP-Adapter « plus-face » (poids 0,6) ;
  - la scène illustrée la plus récente passe par IP-Adapter « plus » (poids 0,3, continuité du décor et de la lumière).
- Hors profil Adulte, un prompt négatif exclut le contenu explicite.

Pour désactiver les images, mettre `ELYNDOR_CLOUD_MODELE_IMAGE` à `null`.

## Limites connues

- IP-Adapter ne guide qu'un seul visage par image. Avec plusieurs personnages, seul le plus prioritaire est ancré par l'image, les autres le sont par le texte. Un placement par masque viendra plus tard.
- L'unique illustration conservée par l'ancienne version, par histoire, n'est pas reprise dans l'historique V2. Elle sera remplacée à la première illustration V2.
- L'état visuel est analysé au moment d'illustrer, pas à chaque tour. Le modèle voit les 10 derniers messages : un changement plus ancien et jamais illustré peut être manqué.
- Une branche copie l'état visuel du parent, mais pas ses fichiers image. Ses premières références de scène sont donc absentes.
- Les adresses du pod sont publiques et sans clé d'accès.
