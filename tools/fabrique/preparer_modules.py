"""Télécharge et convertit les jeux publics des deux modules (dossier maître
Cortana v3) au format « messages » d'Axolotl, avec le champ training.

Module RP (Elyndor, s'ajoute à preparer_publics.py et preparer_traduction.py) :
  Novelist (fr/en), ArcANE (sft), BeyondDialogue (EN), multi_engagement (en),
  story_writing_benchmark (meilleures histoires).
Module agent (Cortana) :
  When2Call, Hermes Function Calling, ToolACE, SWE-Gym, SWE-smith, SWE-Hero,
  AgentInstruct (remplace les jeux Android/Web à captures d'écran : Cydonia
  ne lit que du texte), ragbench, stepgame, ExploreToM (remplace
  tom-benchmark, illisible).

Seuls les premiers fichiers parquet des gros jeux sont téléchargés. Toute
conversation trop longue pour la séquence d'entraînement est écartée. Côté
RP, le filtre anti-minorité de preparer_publics.py s'applique.

Usage : python3 -I preparer_modules.py <dossier_donnees> <rp|agent> <sortie.jsonl>
"""
import json
import os
import random
import re
import sys
import urllib.request

import pyarrow.parquet as pq

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from preparer_publics import douteux  # noqa: E402

# Filtre anti-minorité pour les textes français : le filtre anglais repère
# « son » (fils) dans « son épée ».
INDICES_MINORITE_FR = re.compile(
    r"(?<!\w)(enfants?|gamine?s?|fillettes?|garçonnets?|adolescente?s?|ados?|mineure?s?|puberté|collégienne?s?|lycéenne?s?|"
    r"écolière?s?|écoliers?|bébés?|nourrissons?|(?:1[0-7]|[1-9]) ans)(?!\w)",
    re.IGNORECASE,
)


def douteux_fr(texte: str) -> bool:
    return bool(INDICES_MINORITE_FR.search(texte or ""))


MAX_CARACTERES = 36000  # ~10 000 jetons : tient dans sequence_len 12288


def telecharger(dossier, ident, config, split, max_fichiers=1):
    liste = json.load(urllib.request.urlopen(f"https://huggingface.co/api/datasets/{ident}/parquet/{config}/{split}", timeout=60))
    # max_fichiers : nombre de premiers fichiers, ou liste d'indices précis.
    indices = max_fichiers if isinstance(max_fichiers, list) else range(min(max_fichiers, len(liste)))
    chemins = []
    for i in indices:
        url = liste[i]
        chemin = os.path.join(dossier, "brut", ident.replace("/", "__"), config, split, f"{i}.parquet")
        if not os.path.exists(chemin):
            os.makedirs(os.path.dirname(chemin), exist_ok=True)
            urllib.request.urlretrieve(url, chemin + ".partiel")
            os.replace(chemin + ".partiel", chemin)
        chemins.append(chemin)
    return chemins


def lignes(dossier, ident, config, split, max_fichiers=1, colonnes=None):
    for chemin in telecharger(dossier, ident, config, split, max_fichiers):
        for l in pq.read_table(chemin, columns=colonnes).to_pylist():
            yield l


def msg(role, contenu, appris=False):
    return {"role": role, "content": contenu, "training": appris}


def valide(messages):
    """Alternance user/assistant après le système, fin sur l'assistant, longueur bornée."""
    if not messages or sum(len(m["content"]) for m in messages) > MAX_CARACTERES:
        return None
    sortie = []
    for m in messages:
        if not m["content"].strip():
            continue
        if sortie and sortie[-1]["role"] == m["role"] and m["role"] != "system":
            sortie[-1]["content"] += "\n\n" + m["content"]
            sortie[-1]["training"] = sortie[-1]["training"] or m["training"]
        else:
            sortie.append(dict(m))
    if sortie and sortie[0]["role"] == "system" and len(sortie) > 1 and sortie[1]["role"] == "assistant":
        sortie.insert(1, msg("user", "(Commence.)"))
    while sortie and sortie[-1]["role"] != "assistant":
        sortie.pop()
    return sortie if len(sortie) >= 2 and any(m["training"] for m in sortie) else None


def depuis_sharegpt(conversations, systeme=None, appris_si=lambda m: True):
    roles = {"system": "system", "human": "user", "user": "user", "gpt": "assistant", "assistant": "assistant",
             "tool": "user", "function_response": "user", "observation": "user", "function_call": "assistant"}
    messages = [msg("system", systeme)] if systeme else []
    for m in conversations:
        role = roles.get(m.get("from") or m.get("role"), "user")
        contenu = m.get("value") if "value" in m else m.get("content")
        if isinstance(contenu, (dict, list)):
            contenu = json.dumps(contenu, ensure_ascii=False)
        if (m.get("from") or m.get("role")) in ("tool", "function_response", "observation"):
            contenu = f"<tool_response>\n{contenu}\n</tool_response>"
        if m.get("tool_calls"):
            contenu = (contenu or "") + "".join(f"\n<tool_call>\n{json.dumps(t, ensure_ascii=False)}\n</tool_call>" for t in m["tool_calls"])
        messages.append(msg(role, str(contenu or ""), role == "assistant" and appris_si(m)))
    return messages


def charger_json(valeur):
    return json.loads(valeur) if isinstance(valeur, str) else valeur


# ------------------------------------------------------------------ RP

def rp(d):
    sortie = []

    # Novelist : récits traduits en français (fichiers 5 à 8) et scènes
    # anglaises (fichier 9) ; les fichiers 0 à 4 sont des livres entiers ou
    # des fiches d'évaluation.
    n = 0
    for l in lignes(d, "Dxniz/Novelist", "default", "train", [5, 6, 7, 8, 9], ["language_code", "record_type", "answer_text", "text", "genre", "tone", "pov"]):
        texte = l.get("answer_text") or l.get("text") or ""
        filtre = douteux_fr if l.get("language_code") == "fr" else douteux
        if l.get("language_code") not in ("fr", "en") or texte.lstrip().startswith("{") or len(texte) < 1500 or filtre(texte):
            continue
        consigne = f"Écris la suite de ce récit : genre {l.get('genre') or 'libre'}, ton {l.get('tone') or 'libre'}, point de vue {l.get('pov') or 'libre'}." if l["language_code"] == "fr" else \
            f"Write the next scene of this story. Genre: {l.get('genre') or 'free'}; tone: {l.get('tone') or 'free'}; POV: {l.get('pov') or 'free'}."
        m = valide([msg("user", consigne), msg("assistant", texte, True)])
        if m and n < (1200 if l["language_code"] == "en" else 1e9):
            sortie.append(("novelist", m)); n += l["language_code"] == "en"

    # ArcANE : RP de personnages qui évoluent (SFT).
    for l in lignes(d, "holi-lab/ArcANE-Data", "sft", "train"):
        m = valide(depuis_sharegpt(l["messages"]))
        if m and not douteux(json.dumps(m, ensure_ascii=False)):
            sortie.append(("arcane", m))

    # BeyondDialogue : partie anglaise.
    for l in lignes(d, "xtanqn/BeyondDialogue", "default", "Role_playing_Dialogue_EN"):
        messages = [msg("system", l.get("system") or "")]
        for q, r in (l.get("history") or []):
            messages += [msg("user", q), msg("assistant", r, True)]
        messages += [msg("user", l.get("instruction") or ""), msg("assistant", l.get("output") or "", True)]
        m = valide(messages)
        if m and not douteux(json.dumps(m, ensure_ascii=False)):
            sortie.append(("beyond", m))

    # multi_engagement : dialogues anglais, le personnage IA parle en second.
    for l in lignes(d, "limloop/multi_engagement_roleplay_corpus", "default", "train"):
        if l.get("language") != "en":
            continue
        systeme = f"Scene: {l.get('scenario_context')}\nYou play: {l.get('ai_character_description')}\nThe user plays: {l.get('user_character_description')}"
        messages = [msg("system", systeme)]
        for i, replique in enumerate(l.get("dialog") or []):
            messages.append(msg("user", replique) if i % 2 == 0 else msg("assistant", replique, True))
        m = valide(messages)
        if m and not douteux(json.dumps(m, ensure_ascii=False)):
            sortie.append(("engagement", m))

    # story_writing_benchmark : histoires anglaises les mieux notées (moyenne des juges).
    notes = []
    for l in lignes(d, "lars1234/story_writing_benchmark", "average", "train"):
        q = [v for k, v in l.items() if re.fullmatch(r"q\d+", k) and isinstance(v, (int, float))]
        if l.get("language") == "en" and q and not douteux(l.get("story_text", "")):
            notes.append((sum(q) / len(q), l))
    notes.sort(key=lambda x: -x[0])
    for _, l in notes[:800]:
        m = valide([msg("user", l["prompt"]), msg("assistant", l["story_text"], True)])
        if m:
            sortie.append(("histoires", m))
    return sortie


# ------------------------------------------------------------------ agent

def agent(d):
    sortie = []
    for l in lignes(d, "nvidia/When2Call", "train_sft", "train"):
        outils = "\n".join(l.get("tools") or [])
        m = valide(depuis_sharegpt(l["messages"], f"You can call these tools:\n<tools>\n{outils}\n</tools>" if outils else None))
        if m:
            sortie.append(("when2call", m))
    for config in ("func_calling", "func_calling_singleturn", "json_mode_agentic"):
        for l in lignes(d, "NousResearch/hermes-function-calling-v1", config, "train"):
            m = valide(depuis_sharegpt(l["conversations"]))
            if m:
                sortie.append(("hermes", m))
    for l in lignes(d, "Team-ACE/ToolACE", "default", "train"):
        m = valide(depuis_sharegpt(l["conversations"], l.get("system")))
        if m:
            sortie.append(("toolace", m))
    for l in lignes(d, "SWE-Gym/OpenHands-SFT-Trajectories", "default", "train.success.oss"):
        m = valide(depuis_sharegpt(charger_json(l["messages"])))
        if m:
            sortie.append(("swe-gym", m))
    for l in lignes(d, "SWE-bench/SWE-smith-trajectories", "default", "tool", 1):
        if l.get("resolved"):
            m = valide(depuis_sharegpt(charger_json(l["messages"])))
            if m:
                sortie.append(("swe-smith", m))
    for l in lignes(d, "nvidia/SWE-Hero-openhands-trajectories", "default", "train", 1):
        m = valide(depuis_sharegpt(charger_json(l["trajectory"])))
        if m:
            sortie.append(("swe-hero", m))
    for split in ("os", "db", "alfworld", "webshop", "kg", "mind2web"):
        for l in lignes(d, "zai-org/AgentInstruct", "default", split):
            m = valide(depuis_sharegpt(l["conversations"], appris_si=lambda x: x.get("loss") is not False))
            if m:
                sortie.append(("agentinstruct-" + split, m))
    for config in ("covidqa", "expertqa", "finqa", "emanual", "techqa", "hotpotqa", "msmarco"):
        try:
            for l in lignes(d, "galileo-ai/ragbench", config, "train"):
                if l.get("adherence_score") is True:
                    docs = "\n\n".join(l.get("documents") or [])
                    m = valide([msg("system", "Answer only from the documents below and say when they don't contain the answer.\n\n" + docs),
                                msg("user", l["question"]), msg("assistant", l["response"], True)])
                    if m:
                        sortie.append(("ragbench", m))
        except Exception:
            continue
    for i, l in enumerate(lignes(d, "tasksource/stepgame", "default", "train")):
        if i >= 3000:
            break
        sortie.append(("stepgame", [msg("user", f"{l['story']}\n\n{l['question']}"), msg("assistant", str(l["label"]), True)]))
    for l in lignes(d, "facebook/ExploreToM", "default", "train"):
        m = valide([msg("user", f"{l.get('infilled_story') or l.get('story_structure')}\n\n{l['question']}"), msg("assistant", str(l["expected_answer"]), True)])
        if m:
            sortie.append(("exploretom", m))
    return sortie


PLAFONDS = {
    # Équilibre des catégories (le dossier maître demande de garder les capacités séparées).
    "when2call": 3000, "hermes": 3000, "toolace": 3000, "swe-gym": 500, "swe-smith": 1500, "swe-hero": 1500,
    "ragbench": 1500, "stepgame": 1000, "exploretom": 1000,
    "novelist": 2000, "arcane": 1500, "beyond": 1000, "engagement": 1500, "histoires": 800,
}


def main():
    dossier, module, sortie = sys.argv[1], sys.argv[2], sys.argv[3]
    exemples = rp(dossier) if module == "rp" else agent(dossier)
    random.Random(11).shuffle(exemples)
    comptes, gardes = {}, []
    for source, m in exemples:
        if comptes.get(source, 0) >= PLAFONDS.get(source, 10 ** 9):
            continue
        comptes[source] = comptes.get(source, 0) + 1
        gardes.append(m)
    with open(sortie, "w", encoding="utf-8") as f:
        for m in gardes:
            f.write(json.dumps({"messages": m}, ensure_ascii=False) + "\n")
    print(json.dumps({"module": module, "total": len(gardes), "par_source": comptes}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
