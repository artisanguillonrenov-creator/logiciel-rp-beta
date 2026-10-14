# Performances de Prax pour Elyndor

Mesures faites le 14 octobre 2026 dans le conteneur de développement :
processeur Intel Xeon à 2,1 GHz, Node 22.22, un seul fil. Le Rust de
référence est le binaire `prax-oracle` du dépôt Prax, compilé en mode
`release`.

## 1. Parties de 24 tours avec planificateur (profondeur 2)

Même monde, mêmes réglages et même sortie des deux côtés. Pour le
TypeScript, le temps comprend en plus la relecture de la trace de référence
et la comparaison ligne à ligne : c'est un léger désavantage.

| Monde | Rust | TypeScript (Node) | Rapport |
|---|---|---|---|
| feud, intrigue, play, audience | 4 à 8 ms | 10 à 20 ms | ≈ 2 à 3 |
| bar | 59 ms | 190 ms | ≈ 3,2 |
| **village** (6 personnages) | **9,1 s** | **23,3 s** | **≈ 2,6** |

Dans les deux langages, la sortie est identique à la trace de référence.
Le monde vampire à l'échelle réelle (1 154 tours, 9 233 tours de
personnage) se joue en 8,1 s en TypeScript.

**Ce que cela veut dire pour le jeu :** dans le village, un personnage met
environ 1 s à décider sous Node, contre 0,4 s en Rust. Les petits mondes
décident instantanément. Sur téléphone, Hermes sera plus lent que Node.
C'est la principale question à trancher avant l'intégration (voir § 5).

Le village concentre l'essentiel du coût. Six personnages y planifient en
anticipant les réactions des autres, et l'état du monde est le plus gros
(rumeurs, témoins, réputation, faim, marché).

## 2. Où passe le temps

Temps mesuré sur la partie de village de 24 tours (≈ 23 s au total) :

| Poste | Temps | Part |
|---|---|---|
| Recalcul complet de la fermeture logique (après un retrait, ou un ajout exclusif `!` qui remplace une valeur) | ≈ 10,8 s | ≈ 47 % |
| Prolongement incrémental (après un ajout simple) | ≈ 8,7 s | ≈ 38 % |
| Reste (planificateur, conditions, copies, ramasse-miettes) | ≈ 3,5 s | ≈ 15 % |

La fermeture logique déduit les faits dérivés après chaque action simulée.
Dans les deux premières lignes, le temps se répartit surtout entre
l'unification des motifs dans le trie, l'évaluation des conditions et la
copie de chemin du trie persistant.

Sur la partie de village de 24 tours, le planificateur déclenche environ 55 000
fermetures complètes et 246 000 prolongements.

## 3. Optimisations faites, sans aucun changement de résultat

Chacune a été validée sur les 3 142 parties de référence (rejeu identique,
notes du planificateur comparées au bit près).

- **Rencontres transitoires** : pendant une fermeture, les nœuds créés par
  cette fermeture sont modifiés sur place au lieu d'être recopiés à chaque
  fait dérivé. Seuls les nœuds hérités sont copiés, une fois.
- **Dédoublonnage des liaisons par clé** (règles et disjonctions) : un
  ensemble indexé remplace la comparaison deux à deux. Une règle à une seule
  position de jointure n'est pas dédoublonnée du tout, car l'ensemble des
  têtes s'en charge déjà.

## 4. Piste essayée puis écartée

**Mémoriser les fermetures par contenu.** Près de la moitié des fermetures
portent sur une base déjà vue. Une empreinte par nœud, suivie d'une
vérification exacte, retrouvait bien ces cas. Le gain réel n'était pourtant
que d'environ 3 s sur 23, et seulement avec une mémoire sans limite. Avec une
limite raisonnable, il n'y avait plus de gain du tout. Les doublons sont
surtout des fermetures bon marché. J'ai abandonné la piste pour garder un
moteur simple et une mémoire bornée.

## 5. Pistes pour la suite

1. **Retrait incrémental** (algorithme « DRed ») : il éviterait le recalcul
   complet après un retrait ou un remplacement, qui représente 47 % du temps. C'est le gain le
   plus important possible, mais il faudra prouver qu'il produit exactement
   le même modèle, contradiction comprise.
2. **Réglages de jeu** plutôt que du code : profondeur 1 pour les
   personnages secondaires, portée de prédiction réduite
   (`setPredictionScope`). Ces deux réglages existent déjà.
3. **Mesurer sur téléphone** : Hermes n'a pas de compilation à la volée.
   L'écart avec Node se mesurera sur appareil, au moment de l'intégration,
   avant de choisir entre les pistes 1 et 2.

## 6. Durée des tests

| Commande | Contenu | Durée |
|---|---|---|
| `npm test` (partie Prax) | <!-- NB_DEFAUT --> | <!-- T_DEFAUT --> |
| `PRAX_LONG=1` | ajoute les longues trajectoires du village (≈ 100 pas libres et ≈ 105 pas après le vol), le réveil v37, la règle de faim et 3 longues parties de référence | <!-- T_LONG --> |
| `PRAX_REAL_SCALE=1` | ajoute le monde vampire à l'échelle réelle | inclus ci-dessus |
| `npm run prax:conformance -- --prax <dépôt Prax>` | les 3 142 parties de référence | ≈ 2 min 30 s |
