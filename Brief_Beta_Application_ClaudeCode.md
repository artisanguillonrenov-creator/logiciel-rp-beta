# Brief de développement — Bêta application (à donner à Claude Code)

## Contexte pour Claude Code

Ce projet a une spécification complète (r13, 1125 lignes de JSON) issue de plusieurs mois de conception. Ce brief n'est **pas** cette spécification : c'est une version délibérément réduite, pour construire une bêta testable rapidement, avant d'investir dans la version PC complète décrite dans le schéma d'origine. Le but de cette bêta : vérifier que le principe central fonctionne réellement en pratique, avec de vraies personnes, avant d'aller plus loin.

**Fichier requis en complément de ce brief** : `Metamoteurs_Universels_15_COMPLET.json` — le lorebook contenant le texte complet des règles des 15 métamoteurs (ce brief ne donne que leurs noms et rôles ; les règles détaillées à charger dans le moteur vivent dans ce fichier séparé, à fournir à Claude Code en même temps que ce brief).

---

## 1. Ce qu'on garde absolument (le cœur à tester)

C'est la seule partie non négociable, parce que c'est littéralement ce que la bêta doit prouver :

- **Le principe fondateur** : le logiciel porte l'autorité (règles, mémoire, monde), le modèle ne fournit que le langage.
- **Les 7 règles immuables** : autonomie du joueur stricte, canon géré par le logiciel, état du monde géré par le logiciel, PNJ à connaissance limitée, aucune invention du modèle validée directement en canon, contradictions interdites, IA qui ne contrôle jamais le joueur.
- **Les 15 métamoteurs** (contenu dans le fichier séparé) : chargés et sélectionnés par pertinence de scène, pas injectés tous systématiquement à chaque tour.
- **Une mémoire persistante réelle** — simplifiée par rapport au schéma complet (voir section 3), mais qui doit exister : sans ça, le test ne vérifie rien du problème qu'on cherche à résoudre.
- **Une validation de sortie minimale** : au moins continuité, respect du canon, et absence de contradiction. C'est ce qui distingue ce logiciel d'un simple chatbot avec prompt système.

## 2. Ce qu'on retire pour cette version

Tout ce qui suit est utile pour le produit final, pas pour tester l'hypothèse centrale :

- Détection matérielle et paliers de modèle (inutile : la bêta appelle une API, pas de modèle local)
- Contrôle d'âge, licence/anti-piratage, mises à jour, extensions/plugins
- Identité visuelle travaillée (bleu nuit, typographie élégante) — interface strictement fonctionnelle pour l'instant
- Portraits par émotion, musique d'ambiance, voix/lecture, génération d'images
- Bibliothèque de personas, branches de conversation multiples
- Couche de traduction (bêta en français uniquement)
- Le parcours de création en 5 étapes — remplacé par un écran unique simplifié

## 3. Stack technique recommandée

**React Native + Expo.** C'est le choix le plus adapté à la situation : un seul code pour Android (et iOS plus tard si besoin), et surtout, **Expo Go permet de tester en direct sur une tablette via QR code pendant le développement**, sans build ni compte développeur ni store — exactement ce qu'il faut pour un test avec un petit groupe de proches, avant de penser publication.

**Appel modèle** : API OpenRouter, clé fournie par l'utilisateur dans un champ de configuration à l'intérieur de l'app (jamais codée en dur dans le projet, jamais commitée). Modèle sélectionnable parmi les options OpenRouter, pas de modèle unique imposé à ce stade bêta.

**Mémoire simplifiée** : pas besoin de reconstruire tout de suite les six méthodes de récupération (sémantique, mots-clés, temporelle, relationnelle, entité, causale) du schéma complet. Pour la bêta : un résumé glissant de la conversation (régénéré tous les N messages) + une liste de faits clés extraits (personnages rencontrés, lieux, promesses faites) consultée à chaque tour. Moins sophistiqué que la version finale, mais suffisant pour vérifier concrètement si l'oubli et les contradictions disparaissent par rapport aux plateformes existantes.

**Lore Elyndor** : dès que le lorebook sera prêt, récupération par mots-clés simples (le personnage, lieu ou objet mentionné déclenche l'entrée correspondante) — la recherche sémantique complète peut attendre la version finale.

## 4. Écrans minimums

1. **Démarrage** — Nouvelle histoire / Continuer.
2. **Création rapide** — un seul écran : nom, courte description du personnage, point de départ en une phrase. Pas de sliders élaborés ; garder seulement créativité et longueur de réponse en réglages simples.
3. **Conversation** — liste de messages, zone de saisie, un bouton régénérer basique. C'est l'écran qui compte vraiment.
4. **Réglages** — clé API OpenRouter, choix du modèle.

## 5. Flux de génération simplifié

Joueur écrit → sélection des métamoteurs pertinents à la scène → construction du contexte (résumé + faits clés + lore Elyndor pertinent + règles immuables) → appel API → vérification basique de la réponse (continuité, contradiction, pas de contrôle du joueur) → affichage. Pas de réparation automatique sophistiquée à ce stade : si une violation grave est détectée, une simple nouvelle tentative suffit pour la bêta.

## 6. Ce que la bêta doit permettre de mesurer

Avec les testeurs de ton entourage, les questions concrètes à observer : est-ce que le personnage oublie des détails établis 20-30 messages plus tôt ? Est-ce que l'IA impose des actions au joueur sans qu'il les ait initiées ? Est-ce que le ton et la personnalité des PNJ restent stables ? C'est le retour sur ces points précis qui dira si l'architecture (pas seulement le modèle choisi) fait vraiment la différence.
