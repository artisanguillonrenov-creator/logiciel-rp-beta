# Charte graphique — Elyndor Premium

Cette charte couvre l'identité **documentaire et marketing** du dépôt (README, `/docs`, assets `/assets/brand`) : badges, bannières, logo, pages de présentation. Elle est indépendante des tokens visuels de l'application elle-même (`src/theme/theme.ts`, direction artistique « grimoire illuminé », voir `Direction_Artistique_Elyndor.md`), qui restent la source de vérité pour l'UI in-app et ne sont pas modifiés par cette charte.

## 1. Palette

| Nom | Hex | Usage |
|---|---|---|
| ![#0A0A0A](https://via.placeholder.com/14/0A0A0A/0A0A0A.png) **Abyssal Black** | `#0A0A0A` | Fond principal, base de tous les documents et bannières |
| ![#E8D5B7](https://via.placeholder.com/14/E8D5B7/E8D5B7.png) **Parchment Gold** | `#E8D5B7` | Texte principal sur fond sombre, sous-titres, corps de texte mis en avant |
| ![#C9A66B](https://via.placeholder.com/14/C9A66B/C9A66B.png) **Tarnished Gold** | `#C9A66B` | Titres, liserés, bordures, accents dorés dégradés |
| ![#1A3C34](https://via.placeholder.com/14/1A3C34/1A3C34.png) **Emerald Depth** | `#1A3C34` | Fonds secondaires, dégradés, panneaux, cartes de fonctionnalités |
| ![#4B2E5E](https://via.placeholder.com/14/4B2E5E/4B2E5E.png) **Arcane Purple** | `#4B2E5E` | Éléments mystiques, séparateurs, losanges ornementaux |
| ![#9A2C2C](https://via.placeholder.com/14/9A2C2C/9A2C2C.png) **Blood Accent** | `#9A2C2C` | Alertes, points d'accent rares, validations critiques — toujours en petite quantité |

**Règle d'usage** : Abyssal Black domine toujours (≥ 60 % de la surface). Parchment Gold et Tarnished Gold portent le texte et les ornements. Emerald Depth et Arcane Purple structurent les fonds secondaires. Blood Accent ne doit jamais couvrir plus de quelques points ou traits fins — c'est un accent, pas une couleur de fond.

## 2. Typographie

L'application charge déjà deux familles serif via `@expo-google-fonts` (`App.tsx`, `src/theme/theme.ts`) — la charte documentaire réutilise les mêmes pour rester cohérente avec l'univers Elyndor :

- **Cinzel** (700/600) — titres, noms du monde, bannières, logo. Majuscules, tracking large.
- **Cormorant Garamond** (italique pour les taglines, romain pour le corps) — sous-titres, citations, texte long.
- Repli navigateur/GitHub (README ne charge pas de polices web) : `Georgia, 'Times New Roman', serif`.

Aucune police sans-serif dans les documents de marque : cohérence avec le principe « une seule famille serif » de l'UI in-app.

## 3. Logo et bannière

- `assets/brand/logo.svg` — sceau circulaire, monogramme **E** doré sur fond abyssal, losange émeraude/améthyste central, quatre points cardinaux Blood Accent. Utilisation : favicon de documentation, avatar de dépôt, vignette.
- `assets/brand/banner.svg` — bannière 1600×400, fond dégradé Abyssal → Emerald → Abyssal, titre « ELYNDOR » en Tarnished/Parchment Gold, tagline en italique. Utilisation : en-tête du README, pages `/docs`.
- `assets/brand/icon-*.svg` — jeu de 4 icônes de section (règles, mémoire, lore, validateur), même traitement graphique (cercle abyssal, trait doré, accent émeraude/pourpre/sang selon le sens).

**Règles d'usage** :
- Ne jamais recolorer le logo hors palette ci-dessus.
- Toujours conserver un contraste suffisant (texte doré sur fond abyssal, jamais l'inverse en pleine surface).
- Les icônes de section restent monochromes + un seul accent, pas de dégradés multiples superposés.

## 4. Ton éditorial

Les documents de marque (README, docs) adoptent un registre **haut fantasy sobre** : vocabulaire évocateur (sceau, canon, lore, grimoire) mais sans emphase excessive ni emoji décoratifs en excès. La rigueur technique prime toujours sur l'effet de style — chaque affirmation du README doit rester vérifiable dans le code (`src/engine/`, `src/data/`).
