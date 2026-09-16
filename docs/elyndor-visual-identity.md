# Charte graphique — Elyndor Premium

Ce document fixe l'identité visuelle utilisée pour les supports **du dépôt**
(README, documentation, assets marketing dans `/assets/branding/`). Il ne
modifie pas l'interface de l'application elle-même : le thème réellement
rendu dans l'app vit dans `src/theme/theme.ts` (direction « grimoire
illuminé », déjà en production) et reste la seule source de vérité pour les
écrans. La table de correspondance en fin de document explique comment les
deux palettes se rejoignent.

## 1. Palette

| Nom | Hex | Usage |
|---|---|---|
| **Abyssal Black** | `#0A0A0A` | Fond principal des supports (README, docs, bannières) |
| **Parchment Gold** | `#E8D5B7` | Texte courant sur fond sombre, sous-titres |
| **Tarnished Gold** | `#C9A66B` | Accent principal — titres, liserés, icônes, liens de section |
| **Emerald Depth** | `#1A3C34` | Accent secondaire froid — bordures, séparateurs, table des matières |
| **Arcane Purple** | `#4B2E5E` | Accent rare — éléments mystiques, glow, badges spéciaux |
| **Blood Accent** | `#9A2C2C` | Alerte discrète, ponctuation visuelle, jamais en grande surface |

Règles d'usage :

- **Abyssal Black** est toujours le fond. On ne l'utilise jamais comme texte.
- **Tarnished Gold** est la couleur de titre par défaut ; **Parchment Gold**
  sert au corps de texte long pour rester lisible sans fatiguer l'œil.
- **Emerald Depth** et **Arcane Purple** ne se mélangent pas sur un même
  élément (pas de dégradé émeraude → violet) ; ils marquent chacun un rôle
  distinct (froid/stable vs. mystique/rare).
- **Blood Accent** est réservé à de très petites surfaces (puce, point,
  soulignement d'une phrase clé) — jamais un fond, jamais un bloc de texte.
- Contraste minimum : le texte courant (Parchment Gold ou blanc cassé) sur
  fond Abyssal Black doit rester ≥ 4.5:1 (déjà le cas avec les valeurs
  ci-dessus).

## 2. Typographie

Les supports du dépôt (README, docs) restent en Markdown : la typographie
n'y est donc pas contrôlable directement, à l'exception des **assets SVG**
(`assets/branding/*.svg`), qui utilisent une police serif système
(`Georgia, "Times New Roman", serif`) pour rester lisibles sans dépendance
à une police web externe.

Dans l'**application** (hors périmètre de cette charte, pour référence
seulement), l'identité typographique réelle est :

- **Cinzel** (`Cinzel_700Bold` / `Cinzel_600SemiBold`) — titres d'écran,
  nom du monde.
- **Cormorant Garamond** (`CormorantGaramond_400Regular` /
  `_500Medium` / `_600SemiBold`) — texte courant et titres de section.

Si des visuels futurs (bannière PNG haute résolution, slides) sont produits
hors dépôt, réutiliser cette même paire Cinzel / Cormorant Garamond pour
rester cohérent avec l'app.

## 3. Assets

| Fichier | Usage |
|---|---|
| `assets/branding/elyndor-logo.svg` | Emblème rond, utilisable en avatar/favicon de dépôt |
| `assets/branding/elyndor-banner.svg` | Bannière hero du README |
| `assets/branding/icons/*.svg` | Icônes de section (règles, mémoire, lore, métamoteurs, validation, agentivité) |
| `assets/branding/exemple-conversation.svg` | Reconstitution schématique de l'écran Conversation pour la section « Exemples » — **pas une capture d'écran réelle**, à remplacer par de vraies captures dès que possible |

Tous les assets sont des SVG vectoriels écrits à la main (pas d'image
générée par IA ni de photo) : ils restent légers, éditables en texte, et ne
dépendent d'aucune police externe non garantie sur GitHub.

## 4. Ce que cette charte ne couvre pas

- Elle ne change rien au comportement ni au code de l'application.
- Elle ne remplace pas `src/theme/theme.ts`, qui reste piloté séparément
  par la direction artistique de l'app (voir les commentaires en tête de
  ce fichier).
- Les captures d'écran de la section « Exemples » du README sont pour
  l'instant des reconstitutions schématiques par manque d'accès à un
  environnement d'exécution avec rendu graphique dans cette session ; les
  remplacer par de vraies captures est une amélioration ouverte (voir
  `CONTRIBUTING.md`).

## 5. Table de correspondance avec le thème in-app

Pour éviter toute confusion entre les deux palettes :

| Rôle | Palette dépôt (ce document) | Palette in-app (`theme.ts`) |
|---|---|---|
| Fond | `#0A0A0A` Abyssal Black | `#0A0D1A` |
| Texte/accent chaud | `#E8D5B7` / `#C9A66B` | `#D8DCE8` (texte) / `#E4D3A0` (or) |
| Accent froid | `#1A3C34` Emerald Depth | `#5AACFF` (bleu) |
| Accent rare | `#4B2E5E` Arcane Purple | — (pas d'équivalent actuel) |
| Alerte | `#9A2C2C` Blood Accent | `#E3707D` |

Les deux systèmes partagent la même intention (grimoire sombre, accents
précieux, aucune couleur criarde) sans être identiques pixel pour pixel —
c'est voulu : le dépôt (marketing, documentation) peut se permettre une
palette plus riche que l'interface, qui privilégie la lisibilité prolongée
en session de jeu.
