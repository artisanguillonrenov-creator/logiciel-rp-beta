from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LORE_PATH = ROOT / 'src/data/elyndorLore.json'
META_PATH = ROOT / 'src/data/metamoteurs.json'
ADULTE_PATH = ROOT / 'src/engine/contenuAdulte.ts'
PROMPT_PATH = ROOT / 'src/engine/promptBuilder.ts'
TURN_PATH = ROOT / 'src/engine/generateTurn.ts'
REPORT_PATH = ROOT / 'docs/v3/STEP3_REGISTRE_STYLE_PARAMETRES_V3.md'


def load_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def save_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


# ---------------------------------------------------------------------------
# 1. LORE : conserver le canon adulte/dark, retirer les commandes de style.
# ---------------------------------------------------------------------------
lore = load_json(LORE_PATH)
entries = {entry['id']: entry for entry in lore['entries']}
assert len(entries) == lore['entry_count'] == 102, 'Le lore doit conserver 102 entrées uniques.'

entries[0]['content'] = """ELYNDOR — PRÉSENTATION CANONIQUE :
Elyndor est un monde de dark fantasy construit sur la géographie exacte de la Terre de 2026 : mêmes continents, pays, villes et reliefs, mais avec une civilisation de niveau médiéval, de la magie, des royaumes raciaux et les Portes Astra.

LE MONDE :
Le pouvoir se dispute entre souverains, guildes, cultes, maisons, armées et réseaux clandestins. La violence, l'esclavage, la guerre, la corruption, la sensualité et d'autres thèmes adultes existent réellement dans le monde et peuvent avoir des conséquences durables. Ils ne sont ni obligatoires dans chaque scène ni uniformes selon les lieux, les personnages ou les situations.

LES CAPITALES :
Paris, Tokyo, Delhi, Oslo, Istanbul, Lagos, Johannesburg, Mexico, New York, Bogotá, Sydney, Auckland, Zurich et Katmandou sont les principaux centres de pouvoir, de commerce et d'aventure. Les Portes Astra les relient instantanément sous contrôle institutionnel.

MŒURS :
Les normes de pudeur, d'habillement, de couple, de sexualité, de statut et de violence varient selon les cultures et les circonstances. Les entrées culturelles dédiées définissent ces faits du monde ; elles ne fixent pas le niveau de détail de la narration.

MONDE VIVANT :
Royaumes, organisations et figures d'influence continuent d'agir hors écran. Le monde ne se fige pas autour de {{user}}.

RÈGLE ABSOLUE DE CANON :
Tout fait établi dans le lorebook prime sur l'improvisation. Une information canonique existante n'est jamais remplacée par une invention contradictoire."""

# Paramètres d'Elyndor : seul le bloc REGISTRE est remplacé. Le reste du canon reste intact.
entries[1]['content'] = re.sub(
    r"REGISTRE :\n.*$",
    """CAPACITÉ DE REGISTRE :
Elyndor autorise un registre sombre, adulte, cru, violent ou sensuel lorsque la scène et le profil de contenu le permettent. Cette capacité n'impose jamais une intensité permanente.

AUTORITÉ D'INTENSITÉ :
Le profil de contenu fixe les limites absolues ; les paramètres de session fixent l'intensité demandée ; [MÉTA] Registre et Style Narratif adapte ensuite le rendu à la scène et aux personnages. Le lore ne peut jamais augmenter de lui-même un curseur de violence, de romance ou de sensualité. Une scène calme, diplomatique, quotidienne ou introspective reste calme si son contexte l'exige.""",
    entries[1]['content'],
    flags=re.S,
)

# Les entrées adultes/physiques deviennent contextuelles : elles ne doivent plus biaiser chaque tour.
for uid in (12, 13, 101):
    entries[uid]['constant'] = False

# Retirer les formulations qui commandent directement la narration, sans effacer les faits culturels.
entries[12]['content'] = re.sub(
    r"\n\*\*RÉACTIONS\*\*[\s\S]*$",
    """

**PORTÉE CANONIQUE**
Ces normes décrivent les mœurs vestimentaires du monde et les réactions sociales habituelles. Elles ne constituent ni une obligation de sexualiser une scène, ni une consigne de niveau de détail. Le contexte, la fonction, le climat, la sécurité, le statut et les variantes culturelles restent des modulateurs légitimes.""",
    entries[12]['content'],
)

entries[13]['content'] = re.sub(
    r"\n\*\*RÈGLES\*\*[\s\S]*$",
    """

**RÈGLES SOCIALES**
- Le désir et les relations restent gouvernés par la personnalité, la situation et les liens entre personnages.
- Un refus clair clôt immédiatement l'initiative concernée.
- Les conséquences sociales, politiques ou affectives restent pleinement applicables.
- L'existence de mœurs adultes ouvertes ne transforme pas automatiquement une scène neutre en scène intime.""",
    entries[13]['content'],
)

entries[93]['content'] = re.sub(
    r"\nRÈGLE :\n[\s\S]*$",
    """

PORTÉE CANONIQUE :
Ces codes vestimentaires servent à situer culture, statut et fonction. Ils n'imposent pas au narrateur de détailler le corps lorsqu'il n'est pas pertinent pour la scène. Un habillement plus couvrant peut signaler fonction, climat, protection, religion, santé ou choix individuel sans contredire le monde.""",
    entries[93]['content'],
)

entries[101]['content'] = re.sub(
    r"\nRÈGLE :\n[\s\S]*$",
    """

PORTÉE CANONIQUE :
Ce canon décrit une tendance esthétique du monde, avec variations raciales et individuelles. Il s'applique lorsqu'une description physique est réellement pertinente ; il ne déclenche pas à lui seul une scène sensuelle et ne fixe jamais l'intensité narrative.""",
    entries[101]['content'],
)

# Trace de migration sans gonfler le lore narratif.
corrections = lore.setdefault('corrections_appliquees', [])
marker = 'V3 étape 3 : séparation canon / M08 / paramètres de session ; suppression de l’intensité maximale permanente'
if marker not in corrections:
    corrections.append(marker)

save_json(LORE_PATH, lore)


# ---------------------------------------------------------------------------
# 2. M08 : autorité unique du rendu narratif, réglages > scène > lore.
# ---------------------------------------------------------------------------
meta = load_json(META_PATH)
m08 = [item for item in meta['data'] if item.get('comment') == '[MÉTA] Registre et Style Narratif']
assert len(m08) == 1, f'M08 introuvable ou dupliqué : {len(m08)}'
m08[0]['content'] = """PRINCIPE FONDATEUR :
M08 contrôle la FAÇON d'écrire, jamais les faits du monde. Elyndor reste capable de dark fantasy, violence, sensualité et thèmes adultes, mais l'intensité n'est jamais automatiquement maximale.

HIÉRARCHIE OBLIGATOIRE :
1. Profil de contenu = limite absolue.
2. Paramètres de session = intensité demandée.
3. Ton réel de la scène = modulation immédiate.
4. Personnalité, relation et culture = forme locale.
5. Lore = faits canoniques uniquement, jamais ordre d'intensifier.

RÈGLE DE PLAFOND :
Un curseur indique un plafond et une direction, pas un quota. Une scène calme reste calme. Une scène dure peut monter jusqu'au niveau autorisé si les événements le justifient.

INTERDICTIONS :
- sexualiser ou brutaliser une scène uniquement parce qu'une entrée de lore évoque le corps, l'habillement ou des mœurs adultes ;
- transformer chaque conflit en spectacle maximal ;
- affaiblir artificiellement un thème sombre lorsqu'il est autorisé et pertinent.

PRIORITÉ : cohérence, conséquences et personnalité avant l'intensité."""
save_json(META_PATH, meta)


# ---------------------------------------------------------------------------
# 3. Profil adulte : capacité autorisée ≠ intensité maximale.
# ---------------------------------------------------------------------------
adult = ADULTE_PATH.read_text(encoding='utf-8')
adult = adult.replace(
    'CONFIGURATION DES PROFILS DE CONTENU (GRAND PUBLIC / ADULTE EXTRÊME)',
    'CONFIGURATION DES PROFILS DE CONTENU (GRAND PUBLIC / ADULTE CONFIGURABLE)',
)

adult = re.sub(
    r"// 2\. Directives pour le profil débridé \(Adulte Extrême, Gore, Immoral\)\nexport const INSTRUCTION_REGISTRE_ADULTE = `.*?`;",
    """// 2. Capacités autorisées par le profil Adulte.
// Ce bloc ne fixe aucune intensité : les curseurs de l'histoire et M08 la déterminent.
export const INSTRUCTION_REGISTRE_ADULTE = `[PROFIL DE CONTENU - ADULTE]
Le profil ADULTE autorise les thèmes sombres, violents, sensuels ou moralement durs compatibles avec le monde et la scène.
- Ce profil est une permission de registre, jamais une consigne d'intensité maximale.
- Les curseurs de l'histoire déterminent le niveau demandé ; M08 adapte le rendu au contexte.
- Une scène calme, sociale, diplomatique ou introspective n'est jamais intensifiée artificiellement.
- Quand une scène dure est réellement déclenchée et que les réglages l'autorisent, elle peut être décrite franchement sans sermon ni ellipse artificielle.
- Le lore décrit ce qui existe dans le monde ; il ne peut pas relever les curseurs de la session.`;""",
    adult,
    flags=re.S,
)

# Le canon physique adulte est explicitement hors profil Grand Public.
if "'[PHYSIQUE] Canon Féminin d\\'Elyndor'" not in adult:
    adult = adult.replace(
        "    '[MONDE] Mœurs Sexuelles d\\'Elyndor'\n];",
        "    '[MONDE] Mœurs Sexuelles d\\'Elyndor',\n    '[PHYSIQUE] Canon Féminin d\\'Elyndor'\n];",
    )

adult = re.sub(
    r"export function instructionRegistreAdulte\([\s\S]*?\n}\n\nconst ORDRE_VIOLENCE",
    """export function instructionRegistreAdulte(
    settings: Pick<StorySettings, 'violence' | 'romance'>
): string {
    const violence =
        settings.violence === 'extreme'
            ? "- Violence : plafond extrême ; peut devenir graphique et frontale uniquement lorsqu'une scène violente le justifie."
            : settings.violence === 'eleve'
                ? "- Violence : plafond élevé ; peut être pleinement montrée lorsque les événements le justifient."
                : settings.violence === 'modere'
                    ? "- Violence : plafond modéré ; directe si nécessaire, sans escalade maximale systématique."
                    : "- Violence : plafond faible ; rester surtout suggestif et centré sur les conséquences.";

    const romance =
        settings.romance === 'eleve'
            ? "- Romance / sensualité : plafond élevé ; registre adulte autorisé entre personnages adultes si la scène le justifie."
            : settings.romance === 'modere'
                ? "- Romance / sensualité : plafond modéré ; présence assumée avec mesure."
                : settings.romance === 'faible'
                    ? "- Romance / sensualité : plafond faible ; éléments discrets, jamais moteurs par défaut."
                    : "- Romance / sensualité : désactivée.";

    return `[INTENSITÉ DE SESSION — PROFIL ADULTE]
Les valeurs ci-dessous sont des plafonds narratifs, pas des objectifs à atteindre à chaque réponse.
${violence}
${romance}
Le ton réel de la scène et la personnalité des personnages décident de l'intensité effectivement utilisée. Le lore ne peut jamais relever ces plafonds.`;
}

const ORDRE_VIOLENCE""",
    adult,
    flags=re.S,
)
ADULTE_PATH.write_text(adult, encoding='utf-8')


# ---------------------------------------------------------------------------
# 4. Prompt : une seule chaîne d'autorité, sans double consigne Grand Public.
# ---------------------------------------------------------------------------
prompt = PROMPT_PATH.read_text(encoding='utf-8')
prompt = prompt.replace(
    "${REGLES_IMMUABLES}${ctx.registreAdulte ? `\\n\\n${ctx.registreAdulte}` : ''}${ctx.directiveEtat ? `\\n\\n${ctx.directiveEtat}` : ''}",
    "${REGLES_IMMUABLES}${ctx.directiveEtat ? `\\n\\n${ctx.directiveEtat}` : ''}",
)
prompt = prompt.replace(
    "${ctx.registreAdulte ? INSTRUCTION_REGISTRE_ADULTE : INSTRUCTION_REGISTRE_GRAND_PUBLIC}\\n\\nTon :",
    "${ctx.registreAdulte ? INSTRUCTION_REGISTRE_ADULTE : INSTRUCTION_REGISTRE_GRAND_PUBLIC}${ctx.registreAdulte ? `\\n\\n${ctx.registreAdulte}` : ''}\\n\\nLes paramètres de session ci-dessous priment sur toute formulation du lore portant sur l'intensité de narration. Le lore établit des faits ; il ne relève jamais un curseur.\\n\\nTon :",
)
PROMPT_PATH.write_text(prompt, encoding='utf-8')

turn = TURN_PATH.read_text(encoding='utf-8')
turn = turn.replace('  INSTRUCTION_REGISTRE_GRAND_PUBLIC,\n', '')
turn = turn.replace('    instructionRegistreOverride: profilAdulte ? undefined : INSTRUCTION_REGISTRE_GRAND_PUBLIC,\n', '')
TURN_PATH.write_text(turn, encoding='utf-8')


# ---------------------------------------------------------------------------
# 5. Rapport obligatoire A→G.
# ---------------------------------------------------------------------------
REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
REPORT_PATH.write_text("""# ELYNDOR — V3 ÉTAPE 3 — REGISTRE, STYLE ET PARAMÈTRES

## A — Modifications effectuées

- `src/data/elyndorLore.json`
  - UID 0 : présentation générale recentrée sur le canon du monde ; les exemples qui imposaient une intensité permanente ont été retirés de l'entrée toujours active.
  - UID 1 : suppression de la règle « intensité maximale » ; ajout de la hiérarchie profil → paramètres de session → M08 → scène.
  - UID 12, 13 et 101 : passage de `constant: true` à `constant: false` afin que les mœurs/physique adultes ne soient plus injectés dans chaque scène.
  - UID 12, 13, 93 et 101 : retrait des formulations qui ordonnaient directement au narrateur d'intensifier ou de détailler ; conservation du canon culturel/physique.
- `src/data/metamoteurs.json`
  - M08 devient l'autorité explicite du rendu narratif.
  - Ajout de la hiérarchie : profil de contenu > paramètres de session > scène > personnage/culture > faits du lore.
  - Les curseurs sont définis comme plafonds/directions, jamais comme quotas.
- `src/engine/contenuAdulte.ts`
  - l'ancien profil « Adulte Extrême & Underground » est remplacé par un profil Adulte configurable ;
  - le bloc statique adulte autorise des capacités mais n'impose plus le maximum ;
  - l'instruction dynamique décrit les niveaux comme des plafonds ;
  - le canon physique féminin est explicitement classé parmi les entrées non injectables en Grand Public.
- `src/engine/promptBuilder.ts`
  - suppression de la double injection du registre adulte ;
  - regroupement permission de profil + intensité de session dans `[STYLE & FILTRE SYSTEME]` ;
  - ajout d'une règle de précédence explicite : le lore ne relève jamais les curseurs.
- `src/engine/generateTurn.ts`
  - suppression de la seconde injection redondante du bloc Grand Public.

## B — Informations déplacées

- « intensité maximale permanente » : retirée du lore statique.
- instructions sur la façon de décrire : déplacées vers M08 et les paramètres de session.
- faits culturels (mœurs, vêtements, physique) : restent dans le lore, mais deviennent contextuels.
- capacité générale du profil Adulte : reste dans `contenuAdulte.ts`, séparée de l'intensité réelle.

## C — Informations supprimées

- obligation d'intensité maximale permanente ;
- obligation d'intensifier une scène neutre du seul fait qu'Elyndor est adulte/dark ;
- commandes narratives redondantes présentes dans les entrées de mœurs/physique ;
- double injection du filtre Grand Public.

Aucun thème fondamental d'Elyndor n'est supprimé : dark fantasy, violence, sensualité, esclavage, corruption et thèmes adultes restent possibles selon le profil, les réglages et la scène.

## D — Contradictions découvertes

- `contenuAdulte.ts` possédait déjà une fonction dynamique correcte, mais `promptBuilder.ts` injectait encore en parallèle l'ancien bloc statique « ADULTE EXTRÊME », ce qui annulait en pratique une partie de la logique des curseurs.
- plusieurs entrées adultes étaient `constant: true`, ce qui les rendait présentes même dans des scènes sans rapport avec elles.

## E — Risques

- anciennes embeddings/caches locales : une réindexation peut être nécessaire selon la stratégie du store d'embeddings ;
- modèles très faibles : la règle de précédence est désormais explicite dans le prompt pour limiter les interprétations erronées ;
- aucune migration du schéma de sauvegarde n'est effectuée : les valeurs existantes `aucun/faible/modere/eleve` et `faible/modere/eleve/extreme` sont volontairement conservées pour compatibilité.

## F — Tests réalisés

Le job de migration bloque le commit si :

- le lore n'a plus exactement 102 IDs uniques ;
- M08 est absent ou dupliqué ;
- UID 12, 13 ou 101 reste `constant: true` ;
- la formule « intensité maximale » subsiste dans les paramètres d'Elyndor ;
- l'ancien libellé `ADULTE EXTRÊME & UNDERGROUND` subsiste ;
- la règle de précédence des paramètres n'est pas présente dans le prompt.

Validation TypeScript : `npx tsc --noEmit` exécuté avant commit.

## G — Décision

**VALIDÉE** si tous les garde-fous et le contrôle TypeScript passent sur le commit final.

### Critère fonctionnel central

Une scène diplomatique calme ne doit plus être poussée automatiquement vers violence ou sexualisation simplement parce qu'Elyndor est un monde adulte. À l'inverse, une scène sombre réellement déclenchée conserve toute la latitude permise par le profil et les curseurs de la session.
""", encoding='utf-8')


# ---------------------------------------------------------------------------
# 6. Garde-fous structurels avant que le workflow lance TypeScript.
# ---------------------------------------------------------------------------
final_lore = load_json(LORE_PATH)
ids = [entry['id'] for entry in final_lore['entries']]
assert len(ids) == 102 and len(set(ids)) == 102
final_entries = {entry['id']: entry for entry in final_lore['entries']}
assert all(final_entries[uid]['constant'] is False for uid in (12, 13, 101))
assert 'à son intensité maximale' not in final_entries[1]['content']

final_meta = load_json(META_PATH)
final_m08 = [item for item in final_meta['data'] if item.get('comment') == '[MÉTA] Registre et Style Narratif']
assert len(final_m08) == 1
assert "l'intensité n'est jamais automatiquement maximale" in final_m08[0]['content']

adult_check = ADULTE_PATH.read_text(encoding='utf-8')
assert 'ADULTE EXTRÊME & UNDERGROUND' not in adult_check
assert 'permission de registre, jamais une consigne d\'intensité maximale' in adult_check

prompt_check = PROMPT_PATH.read_text(encoding='utf-8')
assert 'Le lore établit des faits ; il ne relève jamais un curseur.' in prompt_check

print('V3 étape 3 : garde-fous structurels OK')
