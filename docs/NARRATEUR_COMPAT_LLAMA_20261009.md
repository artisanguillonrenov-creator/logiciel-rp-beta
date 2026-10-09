# Narrateur IA — matrice de compatibilité llama.cpp (09/10/2026)

**Statut : contrôle du code et tests unitaires, PAS test du pod réel.** Aucune session RunPod n'a été lancée pour ce chantier. Le modèle visé est Cydonia 24B v4.3 sur llama-server, mais le modèle/binaire effectivement chargé est inconnu tant qu'il n'est pas interrogé.

Le profil Production garde `samplersActifs: false` par défaut. Quand le concepteur active les samplers, `samplersPourRequete` prépare les 19 champs et `elyndorCloudClient.ts` les intègre au JSON des appels de narration. Cela **ne démontre ni leur acceptation, ni leur effet** par le serveur. L'interface avertit explicitement de cette limite.

| Champ | Présent dans le code | Support sur RunPod | Effet vérifié |
| --- | --- | --- | --- |
| `top_p` | Oui, transmis si activé | Non testé | Non testé |
| `top_k` | Oui, transmis si activé | Non testé | Non testé |
| `min_p` | Oui, transmis si activé | Non testé | Non testé |
| `typical_p` | Oui, transmis si activé | Non testé | Non testé |
| `repeat_penalty` | Oui, transmis si activé | Non testé | Non testé |
| `repeat_last_n` | Oui, transmis si activé | Non testé | Non testé |
| `frequency_penalty` | Oui, transmis si activé | Non testé | Non testé |
| `presence_penalty` | Oui, transmis si activé | Non testé | Non testé |
| `dry_multiplier` | Oui, transmis si activé | Non testé | Non testé |
| `dry_base` | Oui, transmis si activé | Non testé | Non testé |
| `dry_allowed_length` | Oui, transmis si activé | Non testé | Non testé |
| `dry_penalty_last_n` | Oui, transmis si activé | Non testé | Non testé |
| `xtc_probability` | Oui, transmis si activé | Non testé | Non testé |
| `xtc_threshold` | Oui, transmis si activé | Non testé | Non testé |
| `dynatemp_range` | Oui, transmis si activé | Non testé | Non testé |
| `dynatemp_exponent` | Oui, transmis si activé | Non testé | Non testé |
| `mirostat` | Oui, transmis si activé | Non testé | Non testé |
| `mirostat_tau` | Oui, transmis si activé | Non testé | Non testé |
| `mirostat_eta` | Oui, transmis si activé | Non testé | Non testé |

`temperatureDelta` n'est pas un sampler supplémentaire : il modifie la température issue de la créativité de l'histoire, bornée par le moteur dans `generateTurn.ts`. Le comportement avec température dynamique ne pourra être confirmé qu'en testant le serveur réel.

## Tokenisation

Le code utilise `/tokenize` du même serveur que `/v1/chat/completions`, avec `add_special: false` et `parse_special: false`. Des **mocks** couvrent réponse acceptée, Unicode, réponse invalide, absence d'endpoint et erreur réseau. Le tokenizer/format exact du pod actif n'a pas été confirmé. Le nombre visible compté n'est pas la consommation globale du tour.

## Protocole minimal à autoriser explicitement avant une session GPU

1. Relever le modèle chargé, son tokenizer, la version du binaire et la configuration réellement active ; ne pas utiliser les commentaires de scripts comme preuve.
2. Vérifier `/tokenize` sur une phrase française avec accents, guillemets et emoji.
3. Pour chaque sampler, sonder avec un appel court : accepté, rejeté (HTTP 400/422), ignoré ou dépendant d'un autre paramètre ; conserver requête, réponse, version du binaire et mesure.
4. Contrôler les conflits Mirostat / Top-K / Top-P / Typical-P, température dynamique et pénalités multiples. N'activer individuellement que les champs confirmés.
5. Relever durée, consommation totale, longueur du texte visible et cohérence narrative ; arrêter immédiatement le pod à l'issue de la session autorisée.

**Ne pas annoncer de compatibilité ou de garantie de longueur sans ces preuves.** Le prochain développement P0.3 doit ajouter la capacité de neutraliser individuellement les champs non compatibles, au lieu de l'interrupteur global actuel.
