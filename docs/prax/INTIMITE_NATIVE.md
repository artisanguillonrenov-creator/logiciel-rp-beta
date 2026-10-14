# Prax — intégration native adulte, phase 1

Cette contribution **n'ajoute aucun moteur externe**. Elle fournit 54 actions Prax (6 étapes par catégorie) sur 9 catégories techniques : étreinte, baiser, caresses, intimité privée, manuel, oral, vaginal, anal, accessoire.

Chaque proposition a une acceptation indépendante, un refus, un démarrage, une fin et un retrait de consentement. La majorité doit être établie dans le canon, les personnes captives et incapables ne peuvent participer, l'accord est spécifique à l'action.

Installation dans le monde Prax existant : importer installNativeAdultPractices de src/prax/vocab/intimacy puis l'appeler lors de la construction d'un State. Le planificateur Prax décide. Pas de deuxième base de données. Pas de générateur de pornographie ; les catégories d'actions sont techniques.

**Limites** : c'est la première incorporation native, pas encore l'intégralité des 96 actions du prototype ni une simulation physiologique exhaustive. Les limites culturelles, la vérification de l'âge, l'interpréteur du français et les réactions émotionnelles demandent un raccord au lore et au noyau de Prax. Un narrateur ne doit jamais transformer une simple demande en accord du PNJ.

Sources conceptuelles : Prax BSD-3, Heartmorrow Unlicense, BRING Apache-2 ; AIF GPL-2, LifePlay AGPL-3, Sexbound GPL-3 et Lilith's Throne restreint ont été consultés pour l'architecture mais **aucune portion de leur code ou de leurs textes n'est reprise**.

Fichiers inclus : src/prax/vocab/intimacy.ts et tests/praxIntimacy.test.ts.