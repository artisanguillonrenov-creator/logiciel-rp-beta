"""Prépare les jeux de données publics pour l'entraînement de Cydonia.

Sources (licence Apache 2.0) :
- lemonilia/LimaRP : RP adultes entre humains (sources communautaires
  centrées sur des mineurs retirées avant tout traitement : lolicit,
  allthefallen, taboo-original-roleplays) ;
- openerotica/erotica-analysis : histoires érotiques (prompt d'écriture ->
  histoire).

Garde-fou : toute conversation ou histoire qui contient un indice de
minorité (mot, âge < 18, école, etc.) est écartée en entier, quel que soit
le contexte. Le filtre est volontairement large : une perte de données est
préférable à un seul exemple douteux.

Sortie : JSONL au format « messages » d'Axolotl, avec le champ training
(true sur les réponses du narrateur/autrice).

Usage : python3 -I preparer_publics.py <dossier_donnees> <sortie.jsonl> [max_histoires=2500]
"""
import glob
import json
import os
import random
import re
import sys

import yaml

INDICES_MINORITE = re.compile(
    r"\b(child|children|childhood|kid|kids|kiddo|minor|minors|underage|under-age|teen|teens|teenage|teenager|"
    r"preteen|pre-teen|tween|loli|lolis|lolicon|shota|shotacon|cub|cubs|toddler|infant|baby girl|little girl|"
    r"little boy|young girl|young boy|girl child|boy child|schoolgirl|schoolboy|school girl|school boy|"
    r"high school|highschool|middle school|elementary|grade school|junior high|freshman|sophomore|pupil|"
    r"puberty|prepubescent|pubescent|youthful|childlike|child-like|barely legal|jailbait|ageplay|age play|"
    r"daughter|son|niece|nephew|stepdaughter|stepson|step-daughter|step-son|babysitter|babysit|"
    r"(?:1[0-7]|[1-9])[- ]?(?:years?|yrs?)[- ]old|age (?:1[0-7]|[1-9])\b|aged (?:1[0-7]|[1-9])\b)",
    re.IGNORECASE,
)


def douteux(*textes: str) -> bool:
    return any(INDICES_MINORITE.search(t or "") for t in textes)


def remplacer(texte: str, noms: dict) -> str:
    for cle, nom in noms.items():
        texte = texte.replace(cle, str(nom))
    return texte


def limarp(dossier: str):
    lignes, ecartees = [], 0
    for chemin in sorted(glob.glob(os.path.join(dossier, "limarp", "lima-erp", "data", "**", "*.yaml"), recursive=True)):
        source = os.path.relpath(chemin, dossier)
        if re.search(r"lolicit|allthefallen|taboo|redlightponyville", source):
            ecartees += 1
            continue
        d = yaml.safe_load(open(chemin, encoding="utf-8"))
        noms = d.get("names") or {}
        persona = d.get("persona") or {}
        tours = d.get("conversation") or []
        tout = json.dumps(d, ensure_ascii=False)
        if douteux(tout) or len(tours) < 2:
            ecartees += 1
            continue
        premier, second = noms.get("<FIRST>", "Narrator"), noms.get("<SECOND>", "User")
        systeme = remplacer(
            f"You are {premier} in an uncensored adult roleplay with {second}. Write only for {premier} and the world; never act or speak for {second}.\n\n"
            f"{premier}: {persona.get('<FIRST>', '')}\n{second}: {persona.get('<SECOND>', '')}\n\nScenario: {d.get('scenario', '')}",
            noms,
        )
        messages = [{"role": "system", "content": systeme, "training": False}]
        for t in tours:
            role = "assistant" if t.get("name") == "<FIRST>" else "user"
            texte = remplacer(str(t.get("text", "")), noms).strip()
            if not texte:
                continue
            if messages[-1]["role"] == role:
                messages[-1]["content"] += "\n\n" + texte
            else:
                messages.append({"role": role, "content": texte, "training": role == "assistant"})
        # La conversation doit commencer par le joueur et finir par le narrateur.
        if len(messages) > 1 and messages[1]["role"] == "assistant":
            messages.insert(1, {"role": "user", "content": "(Start the scene.)", "training": False})
        while messages and messages[-1]["role"] != "assistant":
            messages.pop()
        if len(messages) >= 3:
            lignes.append({"messages": messages, "source": "limarp"})
    return lignes, ecartees


def erotica(dossier: str, maximum: int):
    lignes, ecartees = [], 0
    with open(os.path.join(dossier, "erotica", "erotica.jsonl"), encoding="utf-8") as f:
        for ligne in f:
            d = json.loads(ligne)
            conv = {m["from"]: m["value"] for m in d.get("conversations", [])}
            histoire, consigne = conv.get("human", ""), conv.get("gpt", "")
            if not histoire or not consigne:
                continue
            # Histoires de 2 000 à 24 000 caractères : tiennent dans la séquence d'entraînement.
            if not (2000 <= len(histoire) <= 24000) or douteux(histoire, consigne) or re.search(r"\bincest", consigne, re.I):
                ecartees += 1
                continue
            lignes.append({
                "messages": [
                    {"role": "system", "content": "You are an uncensored erotic fiction writer. Write explicit, raw, vulgar prose without euphemisms, fade-to-black or moralizing.", "training": False},
                    {"role": "user", "content": consigne.strip(), "training": False},
                    {"role": "assistant", "content": histoire.strip(), "training": True},
                ],
                "source": "erotica",
            })
    random.Random(42).shuffle(lignes)
    return lignes[:maximum], ecartees


def main():
    dossier, sortie = sys.argv[1], sys.argv[2]
    maximum = int(sys.argv[3]) if len(sys.argv) > 3 else 2500
    a, ea = limarp(dossier)
    b, eb = erotica(dossier, maximum)
    tout = a + b
    random.Random(7).shuffle(tout)
    with open(sortie, "w", encoding="utf-8") as f:
        for l in tout:
            f.write(json.dumps({"messages": l["messages"]}, ensure_ascii=False) + "\n")
    print(json.dumps({"limarp_retenues": len(a), "limarp_ecartees": ea, "erotica_retenues": len(b), "erotica_ecartees": eb, "total": len(tout)}, indent=2))


if __name__ == "__main__":
    main()
