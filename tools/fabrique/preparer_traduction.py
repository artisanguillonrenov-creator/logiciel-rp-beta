"""Paires anglais -> français familier et vulgaire pour l'entraînement.

Source : Helsinki-NLP/opus-100 (en-fr, majoritairement des sous-titres),
filtrée avec le lexique textdetox/multilingual_toxic_lexicon (français) :
seules les paires dont le français contient une expression grossière sont
gardées. Les insultes racistes ou homophobes sont exclues, ainsi que toute
paire avec un indice de minorité.

Usage : python3 -I preparer_traduction.py <dossier_donnees> <sortie.jsonl> [max=4000]
"""
import json
import os
import random
import re
import sys
import unicodedata

import pyarrow.parquet as pq

# Insultes visant une origine, une religion ou une orientation : jamais
# apprises au narrateur.
INSULTES_HAINEUSES = {
    "bamboula", "bougnoul", "bougnoule", "bicot", "raton", "negro", "nègre", "negre", "négresse", "youpin", "youtre",
    "chinetoque", "bridé", "niakoué", "niakoue", "pédé", "pede", "pédale", "tarlouze", "tapette", "gouine", "enculé de pédé",
    "sale arabe", "sale juif", "sale noir", "bicotte", "melon", "crouille", "rital", "macaroni", "polack", "boche",
    "fiotte", "tantouze", "travelo",
}

INDICES_MINORITE = re.compile(
    r"\b(child|children|kid|kids|minor|underage|teen|teenage|loli|schoolgirl|schoolboy|little girl|little boy|"
    r"enfant|enfants|gamin|gamine|fillette|ado|ados|adolescent|adolescente|mineur|mineure|écolière|collégienne|lycéenne|"
    r"(?:1[0-7]|[1-9]) ?(?:years old|ans))\b",
    re.IGNORECASE,
)


def normaliser(texte: str) -> str:
    return unicodedata.normalize("NFC", texte.lower()).replace("’", "'")


# Le lexique contient aussi des mots ordinaires (« agacer », « andouille »…) :
# seuls les termes construits sur une racine vraiment grossière sont gardés.
RACINES_GROSSIERES = re.compile(
    r"(cul|con\b|conn|merd|putain|pute|bite|couill|chatte|foutr|fout\b|baise|baiser|encul|niqu|salop|branl|chier|chié|"
    r"bordel|nichon|queue|gueule|enfoir|pisse|band|suc|trique|gaule|pine|teub|zob|chibre|foutre|bouffon|ta mère|sa mère|"
    r"bâtard|batard|ordure|fumier|charogne|garce|pétasse|petasse|grognasse|poufiasse|pouffiasse|cochonne|salaud|merdeux)",
    re.IGNORECASE,
)


# Mots seuls qui ont aussi un sens ordinaire (« faire la queue », « la Gaule »).
AMBIGUS = {"queue", "bande", "gaule", "gueule", "pine", "baiser", "con", "ordure", "fumier", "garce", "band", "suce"}


def charger_lexique(dossier: str):
    lignes = pq.read_table(os.path.join(dossier, "lexique", "fr.parquet")).to_pylist()
    termes = set()
    for l in lignes:
        t = normaliser(l["text"]).strip()
        if len(t) < 3 or t in INSULTES_HAINEUSES or any(h in t for h in INSULTES_HAINEUSES) or not RACINES_GROSSIERES.search(t) or t in AMBIGUS:
            continue
        termes.add(t)
    # Une seule expression régulière, termes les plus longs d'abord.
    motif = "|".join(re.escape(t) for t in sorted(termes, key=len, reverse=True))
    return termes, re.compile(rf"(?<![\w-])(?:{motif})(?![\w-])", re.IGNORECASE)


def main():
    dossier, sortie = sys.argv[1], sys.argv[2]
    maximum = int(sys.argv[3]) if len(sys.argv) > 3 else 4000
    termes, motif = charger_lexique(dossier)
    haine = re.compile(r"(?<![\w])(" + "|".join(re.escape(h) for h in INSULTES_HAINEUSES) + r")(?![\w])", re.IGNORECASE)
    table = pq.read_table(os.path.join(dossier, "opus", "en-fr.parquet")).column("translation").to_pylist()
    paires = []
    for p in table:
        en, fr = (p.get("en") or "").strip(), (p.get("fr") or "").strip()
        if not (15 <= len(fr) <= 400) or not (10 <= len(en) <= 400) or en == fr:
            continue
        frn = normaliser(fr)
        if not motif.search(frn) or haine.search(frn) or INDICES_MINORITE.search(en) or INDICES_MINORITE.search(fr):
            continue
        paires.append((en, fr))
    random.Random(3).shuffle(paires)
    retenues = paires[:maximum]
    with open(sortie, "w", encoding="utf-8") as f:
        for en, fr in retenues:
            f.write(json.dumps({"messages": [
                {"role": "system", "content": "Traduis en français familier et cru, comme dans un dialogue de film : garde la vulgarité, les insultes et le ton de l'original, sans adoucir.", "training": False},
                {"role": "user", "content": en, "training": False},
                {"role": "assistant", "content": fr, "training": True},
            ]}, ensure_ascii=False) + "\n")
    print(json.dumps({"termes_lexique": len(termes), "paires_vulgaires": len(paires), "retenues": len(retenues)}))


if __name__ == "__main__":
    main()
