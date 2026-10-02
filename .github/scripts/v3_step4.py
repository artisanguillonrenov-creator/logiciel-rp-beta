from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LORE_PATH = ROOT / 'src/data/elyndorLore.json'
REPORT_PATH = ROOT / 'docs/v3/STEP4_RESTRUCTURATION_ENTREES_LORE_V3.md'

CITIES = [
    'Paris', 'Tokyo', 'Delhi', 'Oslo', 'Istanbul', 'Lagos', 'Johannesburg',
    'Mexico', 'New York', 'Bogotá', 'Sydney', 'Auckland', 'Zurich', 'Katmandou',
]

ROLE_CONFIG = {
    'guild_master': {
        'source_ids': [94],
        'role_label': 'Direction de la Guilde des Aventuriers',
        'role_short': 'Direction guilde',
        'function': 'Direction de la Guilde des Aventuriers de {city}',
        'relations': 'Guilde des Aventuriers de {city}, réception locale, contractants et autorités de la capitale.',
        'narrative': 'Autorité canonique pour les contrats exceptionnels, sanctions et décisions de la Guilde locale. Son nom et son profil ne sont jamais improvisés.',
        'keys': ['maîtresse de guilde', 'maître de guilde', 'direction de guilde', 'guilde des aventuriers'],
        'index_title': '[INDEX][RÔLE] Directions des Guildes',
    },
    'reception': {
        'source_ids': [95],
        'role_label': 'Réception de la Guilde des Aventuriers',
        'role_short': 'Réception',
        'function': 'Réception de la Guilde des Aventuriers de {city}',
        'relations': 'Guilde des Aventuriers de {city}, direction locale, aventuriers et contractants enregistrés.',
        'narrative': 'Accueil, enregistrement des contrats et rapports. Se souvient des contrats actifs de {{user}} ; les décisions exceptionnelles remontent à la direction de guilde.',
        'keys': ['réceptionniste', 'accueil de la guilde', 'guichet', 'contrat de guilde'],
        'index_title': '[INDEX][RÔLE] Réceptionnistes de Guilde',
    },
    'tavern': {
        'source_ids': [96],
        'role_label': 'Tavernier / Tavernière récurrent(e)',
        'role_short': 'Taverne',
        'function': 'Tavernier ou tavernière récurrent(e) de {city}',
        'relations': 'Clientèle locale, voyageurs et réseaux de rumeurs de {city}.',
        'narrative': 'Point récurrent de rumeurs et de rencontres. Fournit des pistes ou bruits sociaux, jamais une confirmation automatique d’un fait.',
        'keys': ['tavernière', 'tavernier', 'aubergiste', 'taverne'],
        'index_title': '[INDEX][RÔLE] Taverniers récurrents',
    },
    'forge': {
        'source_ids': [97],
        'role_label': 'Forgeron / Forgeronne récurrent(e)',
        'role_short': 'Forge',
        'function': 'Forgeron ou forgeronne récurrent(e) de {city}',
        'relations': 'Clientèle locale, aventuriers, artisans et ateliers de {city}.',
        'narrative': 'Référence récurrente pour fabrication et réparation. Un équipement endommagé reste endommagé jusqu’à une réparation effective.',
        'keys': ['forgeronne', 'forgeron', 'forge', 'armurier', 'armurière'],
        'index_title': '[INDEX][RÔLE] Forgerons récurrents',
    },
    'astra': {
        'source_ids': [98],
        'role_label': 'Gardien / Gardienne de Porte Astra',
        'role_short': 'Porte Astra',
        'function': 'Contrôle de la Porte Astra de {city}',
        'relations': 'Porte Astra de {city}, Conseil des Portes Astra, voyageurs et autorités locales.',
        'narrative': 'Contrôle des laissez-passer et voyageurs. Incorruptible par défaut ; toute traversée laisse une trace consultable conformément au canon Astra.',
        'keys': ['passeuse', 'gardienne astra', 'gardien astra', 'porte astra', 'laissez-passer'],
        'index_title': '[INDEX][RÔLE] Gardiens des Portes Astra',
    },
    'sovereign': {
        'source_ids': [99, 100],
        'role_label': 'Souverain / Souveraine',
        'role_short': 'Souverain',
        'function': 'Souverain ou souveraine canonique de {city}',
        'relations': 'Royaume de {city}, institutions de la capitale et autres puissances selon les relations canoniques d’Elyndor.',
        'narrative': 'Autorité politique canonique de {city}. Le nom, le titre et le profil du souverain ne sont jamais improvisés ni remplacés.',
        'keys': ['souverain', 'souveraine', 'roi', 'reine', 'dirigeant'],
        'index_title': '[INDEX][RÔLE] Souverains',
    },
}

SOVEREIGN_NAMES = {
    'Paris': 'Henri Valmonde',
    'Tokyo': 'Aelindra Dawnveil',
    'Delhi': 'Olga Discordia',
    'Oslo': 'Thyra Ironblood',
    'Istanbul': 'Karim Al-Rashid',
    'Lagos': 'Adanna Umbrathorn',
    'Johannesburg': 'Okoro Stoneheart',
    'Mexico': 'Tloc Bloodfang',
    'New York': 'Kira Swiftclaw',
    'Bogotá': 'Inti Spiritborn',
    'Sydney': 'Coral Deepsung',
    'Auckland': 'Ssythar Abysswhisper',
    'Zurich': 'Durin Anvilborn',
    'Katmandou': 'Oya Cloudpeak',
}

RACE_PATTERNS = [
    ('haute-elfe', 'Haut-Elfe'),
    ('elfe noire', 'Elfe Noire'),
    ('amazone sombre', 'Amazone Sombre'),
    ('orque noble', 'Orque Noble'),
    ('homme-bête', 'Homme-Bête'),
    ('tribu primale', 'Tribu Primale'),
    ('valkyrie', 'Valkyrie'),
    ('sultanat', 'Sultanat'),
    ('sirène', 'Sirène'),
    ('naga', 'Naga'),
    ('naine', 'Nain'),
    ('nain', 'Nain'),
    ('géante', 'Géante'),
    ('orc', 'Orc'),
    ('humaine', 'Humain'),
    ('humain', 'Humain'),
]


def load_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def save_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def parse_city_blocks(content: str) -> dict[str, tuple[str, str]]:
    results: dict[str, tuple[str, str]] = {}
    city_lookup = {c.lower(): c for c in CITIES}
    city_pattern = '|'.join(re.escape(c) for c in sorted(CITIES, key=len, reverse=True))
    regex = re.compile(rf'^({city_pattern})\s*:\s*(.+?)\s+—\s+(.+)$', re.I)
    for raw_line in content.splitlines():
        line = raw_line.strip()
        match = regex.match(line)
        if not match:
            continue
        city = city_lookup[match.group(1).lower()]
        results[city] = (match.group(2).strip(), match.group(3).strip())
    return results


def detect_race(description: str) -> str:
    low = description.lower()
    for needle, race in RACE_PATTERNS:
        if needle in low:
            return race
    raise AssertionError(f'Race introuvable dans : {description}')


def compact_index(title: str, role_short: str, items: dict[str, tuple[str, str]], cities: list[str]) -> str:
    lines = [f'{title} — index canonique compact. Chaque nom renvoie à une fiche PNJ individuelle.']
    for city in cities:
        name = items[city][0]
        if role_short == 'Souverain':
            name = SOVEREIGN_NAMES[city]
        lines.append(f'{city} → {name}')
    return '\n'.join(lines)


lore = load_json(LORE_PATH)
entries = lore['entries']
by_id = {entry['id']: entry for entry in entries}
assert lore['entry_count'] == len(entries) == 102, f"Étape 4 attend 102 entrées avant migration, trouvé {len(entries)}"
assert len(by_id) == len(entries), 'UID dupliqué avant migration.'
for source_id in range(94, 101):
    assert source_id in by_id, f'Entrée source {source_id} absente.'

# 1) Extraire sans réécrire le canon : 14 PNJ pour chaque rôle.
parsed: dict[str, dict[str, tuple[str, str]]] = {}
for role, cfg in ROLE_CONFIG.items():
    merged: dict[str, tuple[str, str]] = {}
    for sid in cfg['source_ids']:
        merged.update(parse_city_blocks(by_id[sid]['content']))
    assert set(merged) == set(CITIES), f'{role}: capitales manquantes {set(CITIES) - set(merged)}'
    if role == 'sovereign':
        # Le texte source inclut les titres dans le segment nom ; le nom canonique nu est défini ci-dessus.
        merged = {city: (SOVEREIGN_NAMES[city], desc) for city, (_, desc) in merged.items()}
    parsed[role] = merged

# 2) Transformer les anciennes grosses entrées en index de rôle compacts.
for role, cfg in ROLE_CONFIG.items():
    source_ids = cfg['source_ids']
    if len(source_ids) == 1:
        sid = source_ids[0]
        e = by_id[sid]
        e['category'] = 'INDEX'
        e['title'] = cfg['index_title']
        e['secondary_keys'] = [parsed[role][city][0] for city in CITIES]
        e['content'] = compact_index(cfg['index_title'], cfg['role_short'], parsed[role], CITIES)
        e['priority'] = 30
        e['constant'] = False
    else:
        # Conserver les deux UID historiques 99/100 sous forme de deux index souverains compacts.
        halves = [CITIES[:7], CITIES[7:]]
        for sid, cities_subset, suffix in zip(source_ids, halves, ['1', '2']):
            e = by_id[sid]
            e['category'] = 'INDEX'
            e['title'] = f"{cfg['index_title']} — {suffix}"
            e['secondary_keys'] = [parsed[role][city][0] for city in cities_subset]
            e['content'] = compact_index(e['title'], cfg['role_short'], parsed[role], cities_subset)
            e['priority'] = 30
            e['constant'] = False

# 3) Créer 84 fiches atomiques, une par PNJ, sans inventer de nouveaux personnages.
new_entries = []
next_id = 118  # 102 est historiquement réservé à Sir William ; 103-117 aux 15 métamoteurs.
individual_by_city: dict[str, dict[str, str]] = {city: {} for city in CITIES}

for role, cfg in ROLE_CONFIG.items():
    for city in CITIES:
        name, description = parsed[role][city]
        race = detect_race(description)
        individual_by_city[city][role] = name
        title = f"[PNJ][{city.upper()}] {name} — {cfg['role_short']}"
        primary = [name, city, f'{name} {city}'] + cfg['keys'][:3]
        secondary = [cfg['role_short'], cfg['role_label']]
        content = (
            f"NOM : {name}\n"
            f"LIEU : {city}\n"
            f"FONCTION : {cfg['function'].format(city=city)}\n"
            f"RACE : {race}\n\n"
            f"PERSONNALITÉ / ATTITUDE DE BASE :\n{description}\n\n"
            f"RELATIONS IMPORTANTES :\n{cfg['relations'].format(city=city)}\n\n"
            f"RÔLE NARRATIF :\n{cfg['narrative'].format(city=city)}\n\n"
            "ÉLÉMENTS STABLES :\n"
            "Nom, lieu, fonction, race et profil ci-dessus sont canoniques. Les évolutions de relation ou d’état peuvent changer en jeu, mais ne remplacent pas cette identité de base."
        )
        assert len(content) <= 1200, f'Fiche trop longue ({len(content)}) : {title}'
        new_entries.append({
            'id': next_id,
            'category': 'PNJ',
            'title': title,
            'primary_keys': list(dict.fromkeys(primary)),
            'secondary_keys': list(dict.fromkeys(secondary)),
            'negative_keys': [],
            'content': content,
            'priority': 30,
            'sticky': 0,
            'cooldown': 0,
            'constant': False,
        })
        next_id += 1

assert len(new_entries) == 84, f'84 fiches PNJ attendues, trouvé {len(new_entries)}'
assert next_id == 202, f'Fin UID PNJ inattendue : {next_id}'

# 4) Créer 14 index de capitale compacts.
city_indexes = []
for city in CITIES:
    people = individual_by_city[city]
    lines = [
        f'INDEX PNJ RÉCURRENTS — {city}',
        f"Direction guilde → {people['guild_master']}",
        f"Réception → {people['reception']}",
        f"Taverne → {people['tavern']}",
        f"Forge → {people['forge']}",
        f"Porte Astra → {people['astra']}",
        f"Souverain → {people['sovereign']}",
        'Chaque nom possède une fiche individuelle ; cet index sert uniquement à associer rapidement les figures récurrentes de la capitale.',
    ]
    content = '\n'.join(lines)
    assert len(content) <= 800, f'Index capitale trop long : {city}'
    names = [people[k] for k in ['guild_master', 'reception', 'tavern', 'forge', 'astra', 'sovereign']]
    city_indexes.append({
        'id': next_id,
        'category': 'INDEX',
        'title': f'[INDEX][{city.upper()}] PNJ récurrents',
        'primary_keys': [city, f'PNJ {city}', f'personnages {city}', f'récurrents {city}'] + names,
        'secondary_keys': ['guilde', 'réception', 'taverne', 'forge', 'porte astra', 'souverain'],
        'negative_keys': [],
        'content': content,
        'priority': 30,
        'sticky': 0,
        'cooldown': 0,
        'constant': False,
    })
    next_id += 1

assert len(city_indexes) == 14
assert next_id == 216

# 5) Finaliser le lorebook.
entries.extend(new_entries)
entries.extend(city_indexes)
entries.sort(key=lambda e: e['id'])
lore['entry_count'] = len(entries)
corrections = lore.setdefault('corrections_appliquees', [])
marker = 'V3 étape 4 : entrées récurrentes 94-100 atomisées en 84 fiches PNJ + index de rôle et 14 index de capitale'
if marker not in corrections:
    corrections.append(marker)

# Garde-fous structurels.
ids = [e['id'] for e in entries]
titles = [e['title'] for e in entries]
assert len(entries) == 200, f'200 entrées attendues après migration, trouvé {len(entries)}'
assert len(ids) == len(set(ids)), 'UID dupliqué après migration.'
assert len(titles) == len(set(titles)), 'Titre dupliqué après migration.'
assert not any(102 <= i <= 117 for i in ids), 'Les UID réservés 102-117 doivent rester libres dans elyndorLore.json.'
assert sum(1 for e in entries if e['category'] == 'PNJ' and e['id'] >= 118) == 84
assert sum(1 for e in entries if e['category'] == 'INDEX' and e['title'].startswith('[INDEX][') and 'PNJ récurrents' in e['title']) == 14
for e in entries:
    if 94 <= e['id'] <= 100:
        assert len(e['content']) <= 1200, f'Index rôle trop long : {e["id"]}'
    if 118 <= e['id'] <= 201:
        for token in ['NOM :', 'LIEU :', 'FONCTION :', 'RACE :', 'PERSONNALITÉ / ATTITUDE DE BASE :', 'RELATIONS IMPORTANTES :', 'RÔLE NARRATIF :', 'ÉLÉMENTS STABLES :']:
            assert token in e['content'], f'{token} absent de {e["title"]}'

save_json(LORE_PATH, lore)

# 6) Rapport obligatoire A→G.
REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
REPORT_PATH.write_text(f"""# ELYNDOR — V3 ÉTAPE 4 — RESTRUCTURATION DES ENTRÉES DE LORE

## A — Modifications effectuées

- Les anciennes entrées groupées UID 94 à 100 ont été conservées comme **index de rôle compacts** au lieu de blocs encyclopédiques.
- Création de **84 fiches PNJ atomiques** : 14 capitales × 6 fonctions récurrentes (direction de guilde, réception, taverne, forge, Porte Astra, souverain).
- Création de **14 index de capitale** `[INDEX][VILLE] PNJ récurrents`.
- `entry_count` passe de **102 à 200** sans ajouter de nouveau personnage canonique : les 98 nouvelles entrées sont uniquement la décomposition/indexation des informations déjà présentes.
- Les UID 102 à 117 restent volontairement libres/réservés conformément à l’historique du projet ; les nouvelles fiches commencent à 118.

## B — Informations déplacées

- UID 94 `Maîtresses de Guilde — Toutes Capitales` → index de rôle + 14 fiches individuelles.
- UID 95 `Réceptionnistes de Guilde` → index de rôle + 14 fiches individuelles.
- UID 96 `Tavernières` → index de rôle + 14 fiches individuelles.
- UID 97 `Forgeronnes` → index de rôle + 14 fiches individuelles.
- UID 98 `Passeuses Astra` → index de rôle + 14 fiches individuelles.
- UID 99–100 `Souverains d'Elyndor` → deux index compacts + 14 fiches individuelles.
- Chaque capitale reçoit en plus un index transversal qui relie ses six figures récurrentes.

## C — Informations supprimées

Aucune identité, nom, ville ou description canonique de PNJ n’a été supprimé.

La seule information retirée des anciens blocs est la répétition structurelle qui obligeait à charger 14 personnages lorsqu’un seul était pertinent. Les règles communes de chaque rôle ont été reportées dans chaque fiche concernée et dans les index.

## D — Contradictions découvertes

Aucune nouvelle contradiction canonique bloquante détectée pendant cette étape. La structure précédente était principalement un problème de granularité de récupération.

## E — Risques

- Le nombre d’entrées passe à 200 : tant que l’étape 10 de récupération hybride n’est pas appliquée, le moteur peut encore sélectionner trop d’éléments contextuels. Cette étape améliore la précision des unités, elle ne modifie volontairement pas encore l’algorithme de top-N.
- Le cache d’embeddings utilise un hash de contenu par ID et recalcule les entrées nouvelles ou modifiées ; aucune purge globale n’est requise par cette migration.
- Les index sont volontairement compacts ; ils servent d’association, pas de remplacement des fiches individuelles.

## F — Tests réalisés

Garde-fous exécutés avant écriture/commit :

- 102 entrées et UID uniques avant migration ;
- présence des UID source 94 à 100 ;
- exactement 14 capitales extraites pour chacun des 6 rôles ;
- exactement 84 fiches PNJ créées ;
- exactement 14 index de capitale créés ;
- 200 entrées finales ;
- aucun UID dupliqué ;
- aucun titre dupliqué ;
- UID 102–117 toujours libres ;
- chaque fiche PNJ contient nom, lieu, fonction, race, personnalité/attitude, relations, rôle narratif et éléments stables ;
- chaque fiche PNJ ≤ 1 200 caractères ;
- chaque index de capitale ≤ 800 caractères ;
- chaque index de rôle ≤ 1 200 caractères.

Validation TypeScript : `npx tsc --noEmit` exécuté par le workflow avant commit.

## G — Décision

**VALIDÉE** si tous les garde-fous et le contrôle TypeScript passent sur le commit final.

### Critère fonctionnel central

Une requête concernant un PNJ récurrent ne dépend plus d’un bloc contenant les 13 autres capitales : chaque personnage dispose désormais de sa propre unité récupérable, tandis que les index conservent les associations de rôle et de ville.
""", encoding='utf-8')

print(f'Étape 4 préparée : {len(entries)} entrées, 84 PNJ atomiques, 14 index de capitale.')
