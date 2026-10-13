# Moteur visuel universel et Atelier visuel — V3

Remplace `ILLUSTRATION_V2.md`. Base de travail : `claude/new-session-glwy6e` au commit `b0f4a46`, c'est-à-dire après la fusion du chantier de recherche lexicale (PR 108). Ce chantier ne modifie pas le code lexical. Avant le chantier, `npm test` donnait 343 réussites et 6 échecs, tous déjà présents sur la branche principale.

## 1. Chemin unique de toute image

```
illustration de scène · avatar · aperçu libre · aperçu de scène · futur module
        │
        ▼
CONTRAT VISUEL FACTUEL (contratVisuel.ts) ── vue dérivée, jamais un second canon
  · scène : relevé du narrateur en MOTS-CLÉS (extracteurVisuel.ts, 1 appel)
            → validation (phrases, mots de style, pondérations écartés)
            → consolidation : présence réelle, canon des races, état visuel,
              lieu de l'état de scène
  · portrait : même consigne appliquée à la fiche du personnage
  · aperçu libre : texte de l'utilisateur
        │
        ▼
MOTEUR VISUEL (moteurVisuel.ts, pur)
  · lit la configuration UNIQUE de l'Atelier (style, positif et négatif globaux,
    cadrage, références, paramètres techniques)
  · construit UN prompt de mots-clés, par ordre de criticité : lieu, action,
    personnages, éléments obligatoires, contexte secondaire, cadrage, style
  · sélectionne et plafonne les références, en donnant la raison de chaque rejet
  · ne garde que les paramètres acceptés par le générateur
        │
        ▼
SERVICE VISUEL (serviceVisuel.ts) : le SEUL point qui appelle un générateur
  · simulation = requête montrée sans envoi
  · trace complète journalisée (sans image ni secret)
        │
        ▼
ADAPTATEURS (fournisseursImages.ts, elyndorCloudImages.ts, openAiImages.ts)
  · capacités déclarées ou détectées ; protocole propre à chaque générateur
  · n'ajoutent aucun style, négatif ou module
```

Un test d'architecture (`tests/architectureVisuelle.test.ts`) vérifie trois choses :

- aucun fichier n'appelle un générateur sans passer par le service ;
- l'aperçu de scène et le jeu partagent la même préparation (`illustrationScene.preparerScene`) ;
- l'ancien « directeur artistique » a disparu du code.

## 2. Sources d'autorité

1. **Lorebook publié** (canon et fiches de l'Atelier) : races, rôles officiels, lieux.
2. **Noyau narratif et état de scène** : lieu courant, personnages présents.
3. **État visuel** (`StoryState.etatVisuel`) : tenue, blessures, objets, décor, heure, météo. C'est une projection. Chaque changement doit citer le récit et reste rattaché au message qui l'établit, dans le **journal**.
4. **Historique des illustrations** : sert de référence de continuité, jamais de preuve.

Comment le canon corrige le relevé du narrateur :

- les traits de race remplacent une carnation ou des cheveux inventés ;
- l'état visuel remplace une tenue inventée ;
- un personnage non cité dans le passage illustré n'est que « mentionné » ;
- un personnage déclaré « hors cadre » n'est jamais dessiné ;
- les figurants anonymes ne sont dessinés que s'ils figurent aussi dans les éléments obligatoires.

**Mémoire visuelle et chronologie.** `projeterEtatVisuel` donne l'état vu depuis la chronologie actuelle, sans appel IA :

- un changement dont le message a disparu (tour édité, régénéré, autre branche) est retiré : le journal est rejoué sans lui ;
- un déplacement relevé par l'état de scène, qui est mis à jour à chaque tour, remplace le décor de l'ancien lieu. L'heure et la météo sont gardées ;
- une scène illustrée hors de la chronologie actuelle ne sert plus de référence.

Les changements de tenue ou de blessure sont relevés au moment de l'illustration suivante. Ce relevé couvre tous les passages narratifs écrits depuis la dernière analyse, dans une fenêtre de 10 messages. Il n'y a donc **aucun appel IA de plus par tour**.

## 3. Atelier visuel V3 (une seule configuration)

Clé `@elyndor/concepteur/visuel-v3`, schéma 3. Le panneau compte six sections.

| Section | Contenu |
|---|---|
| 01 Identité artistique | Style unique, par défaut « Cinéma façon Quentin Tarantino » (mots-clés modifiables), intensité de 0,7 à 1,3 (proportion de mots de style ajoutés), bouton « Restaurer le style par défaut » qui ne touche que le style. |
| 02 Consignes et mots-clés | Une **consigne d'extraction universelle** (scènes, portraits, futurs sujets). Le format JSON est fixe, ajouté par l'application. Positif global, négatif global (par défaut : exclusions d'anatomie et de cohérence, visibles), anciennes consignes archivées avec un bouton « copier », notes de migration. |
| 03 Composition | Automatique, moyen, large, ensemble ; priorité décor, action ou équilibrée ; « éviter les portraits dans les scènes » (seulement s'il y a des personnages). |
| 04 Références | Portraits de personnages (scènes), races, images du lorebook, scène précédente (même lieu seulement), plus ce qu'accepte le générateur actuel. |
| 05 Paramètres techniques | Résolution, étapes, guidance et graine par format ; poids de la référence de race (portrait) ; précisions de format ; modules communs et par format. Une mention « non pris en charge » apparaît selon les capacités. |
| 06 Aperçu et diagnostic | Aperçu libre et aperçu d'une scène Elyndor, sélecteur des références Elyndor, « voir la requête sans générer », trace complète. |

### Migration (schéma 1 vers 3)

La migration est idempotente et non destructive. L'ancienne clé `visuel-v1` n'est **jamais** modifiée : elle reste la sauvegarde pour un retour arrière ou une ancienne APK. Le bouton « Refaire la migration depuis l'ancienne configuration » reconvertit à partir d'elle.

- Les valeurs reprises sont : intensité, cadrage, priorité, éviter portrait, références, tailles, étapes, guidance, graines, poids de race et modules par format.
- Positif et négatif scène/portrait : la partie commune devient le champ global, le reste devient une précision du format. Chaque collision est notée.
- Les consignes narrateur scène et portrait sont **archivées**. Elles ne sont plus utilisées et ne sont jamais concaténées.
- Le préréglage (`elyndor`, `equilibre`, `nerveux`) est archivé avec une note, car il pilotait des modules propres à un générateur.
- Les modules qu'envoyait implicitement l'ancienne version (`peau`, `peau2`, `details`, `mains`, `elyndor`, `tarantino`) sont archivés et ne sont plus envoyés.
- Les anciennes exclusions cachées deviennent visibles dans le négatif global.
- « Réinitialiser les préférences visuelles » ne touche ni aux histoires, ni aux images, ni aux avatars, ni au lorebook, ni au pod, ni au narrateur.

## 4. Format du relevé (narrateur)

```json
{"typeScene":"groupe","lieu":["covered market"],"instant":["daylight"],"eclairage":[],
 "personnagesVisibles":[{"nom":"Sylvana","identite":["35 years old","dark elf","female"],"apparence":[],"tenue":["grey hooded cloak"],"action":["haggling"],"position":[]}],
 "horsCadre":[],"mentionnes":["Maître Kael"],"figurants":["market crowd"],
 "action":[],"elementsObligatoires":["wooden platforms","crowded aisles"],"decor":["stone paving"],
 "interdictionsFactuelles":[],"changementsVisuels":[{"cible":"personnage","nom":"Sylvana","champ":"tenue","operation":"definir","valeur":"grey hooded cloak","evenement":"citation exacte"}]}
```

Les groupes font au plus 8 mots. Sont écartés, avec une trace :

- une phrase à la place de mots-clés ;
- les pondérations comme « (mot)1.2 » ou « (mot:1.3) » ;
- les mots de style (« masterpiece », « cinematic », « film grain »…).

Un âge doit faire au moins 20 ans. Si le JSON est illisible, un second essai est fait. En cas de nouvel échec, un repli local est utilisé, sans aucun fait inventé.

## 5. Capacités des générateurs

| | Elyndor Cloud (déclarées) | OpenAI (déclarées) | OpenRouter (détectées) |
|---|---|---|---|
| Négatif | oui | non | si `negative_prompt` est annoncé |
| Graine, étapes, guidance | oui | non | si annoncé |
| Modules | oui (les modules absents du pod sont ignorés par lui, disponibilité non vérifiée) | non | non |
| Références | 6 images, 4 visages, rôles personnage, race, scène | 4, sans rôle (édition d'image) | si `input_references` est annoncé, 4 |
| Tailles | listes de l'Atelier | imposées par le modèle | non réglables |

Ce qui n'est pas pris en charge n'est jamais envoyé : la trace le liste dans « Paramètres non transmis ». Pour le profil Grand public, quand le générateur ne lit pas les négatifs, la protection est traduite en mots-clés positifs (« safe for work, fully clothed »).

**Ce que « universel » ne veut pas dire.** Un même prompt de mots-clés n'a pas exactement le même effet sur tous les modèles. Un générateur sans conditionnement par image n'utilise pas les références. Un négatif n'a pas le même poids partout.

## 6. Références du lorebook

- Les liens entre une fiche et une image sont stockés dans `@elyndor/concepteur/assets-lore-v1`, sous la forme `{ assetId, rôle, libellé, variante }`. Les images elles-mêmes sont dans le dossier `visual-assets/` (IndexedDB sur le web).
- **Aucune image** n'est mise dans les fiches, les liens, l'export JSON du lorebook ou le contexte du narrateur. Les fiches et leurs identifiants ne changent pas.
- Pour ajouter une image, deux chemins :
  - onglet **Images** de la fiche, puis « Ajouter une image Elyndor existante » (avatar, portrait de création, portrait de race) ;
  - aperçu de l'Atelier, puis « Rattacher cette image à une fiche ».
- Retirer un lien supprime aussi le fichier s'il n'est plus utilisé ailleurs.
- Si une image manque (appareil changé, fichier supprimé), elle est signalée dans la fiche et au diagnostic (« fichier introuvable ») sans rien bloquer. Ces images ne voyagent pas avec l'export JSON : il faut les rattacher à nouveau sur un autre appareil.
- Une image de lieu n'est retenue que si la fiche correspond au lieu **actuel** du contrat.

## 7. Diagnostic

Chaque génération, réussie ou non, écrit une entrée `image` dans le journal de l'histoire (`journalDiagnostic`). Elle contient :

- l'opération, l'origine et la révision ;
- la version des réglages lus ;
- le relevé : brut, par le modèle ou en repli, avec erreurs et rejets ;
- le contrat final et la provenance des faits ;
- le style appliqué et les capacités du générateur ;
- les références retenues (identifiant, rôle, taille) et écartées (raison) ;
- la requête effective et les paramètres non transmis ;
- les avertissements, la durée, l'erreur éventuelle et la destination.

**Aucune image en base64, aucune clé API.** Les aperçus ne sont pas rangés dans une histoire : leur trace s'affiche dans l'Atelier.

## 8. Pod (hors périmètre de ce chantier)

Sur demande explicite (13 octobre 2026), le serveur `infra/runpod/image_server.py` **n'a pas été modifié** et aucun pod n'a été démarré. Côté application :

- un seul `prompt` est envoyé (plus de `prompt_sdxl`) ;
- `modules` est **toujours explicite** (`{}` quand aucun n'est demandé), ce qui empêche le serveur actuel d'appliquer ses modules par défaut.

Le serveur actuel ajoute encore son propre négatif de base (`NEGATIF_BASE`, qui contient des protections « child, minor, underage » à garder) et l'embedding négatif s'il est installé. Un futur patch du serveur devra :

1. ne plus ajouter de négatif esthétique ;
2. garder et signaler la protection de sécurité comme telle ;
3. exposer ses capacités réelles (modules chargés, négatif, références) pour qu'elles soient lues sans génération.

## 9. Tests

`npm test` : 358 tests. Les scénarios V01 à V33 sont dans `tests/moteurVisuelV3.test.ts`, `tests/reglagesVisuels.test.ts` et `tests/architectureVisuelle.test.ts`. Les 6 échecs restants sont ceux d'avant le chantier (`deltaEtatSepare` ×2, `narrateurConcepteur` ×4).

Correspondance des scénarios avec le type de vérification :

- **V14** (même pipeline pour l'aperçu de scène et le jeu) et **V22/V28** (absence d'injection côté pod) : vérifiés par test statique et par le contrat de la requête côté application. Le serveur, lui, n'est pas modifié (section 8).
- **V25** (persistance après redémarrage) : vérifié avec un stockage simulé.

Le rendu réel n'a pas été testé : photoréalisme, ressemblance des visages, effet des références et des négatifs. Ces essais demandent un vrai générateur et ne peuvent pas être validés par des tests avec simulations.
