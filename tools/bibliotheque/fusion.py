"""Fusionne les lots enrichis de la bibliothèque universelle en un catalogue unique, dédoublonné.

usage : python3 -I tools/bibliotheque/fusion.py SOURCE/actions.fr.json DOSSIER_DES_LOTS src/prax/bibliotheque/catalogue.json --strict

SOURCE : data/actions.fr.json de la bibliothèque d origine ; lots : lot1.json … lot7.json au format
de tools/bibliotheque/SCHEMA_ENRICHISSEMENT.md. Sans --strict, les actions non enrichies sont omises.
"""
import json, sys, glob, os, re, unicodedata, collections

src_path, lots_dir, out_path = sys.argv[1:4]
strict = '--strict' in sys.argv

FAMILLES = {'parole', 'requete', 'information', 'influence', 'transaction', 'objet', 'deplacement', 'repos', 'observation',
            'conflit', 'furtivite', 'justice', 'institution', 'fabrication', 'soin', 'magie', 'expression', 'hors_scene'}
ROLES = {'marchand', 'garde', 'juge', 'pretre', 'guerisseur', 'mage', 'maitresse_guilde', 'receptionniste', 'taverniere',
         'forgeronne', 'passeuse', 'souverain', 'fonctionnaire', 'noble', 'ombre', 'membre_guilde'}
EXISTANTS = {'saluer', 'converser', 'interroger', 'complimenter', 'remercier', 'menacer', 'insulter', 'attaquer', 'voler',
             'aider', 'payer', 's_excuser', 'se_rendre', 'attendre', 'demander', 'marchander'}
RISQUES = {'nul', 'faible', 'moyen', 'eleve'}
AXES = {'affection', 'respect', 'confiance', 'peur', 'hostilite'}
CIBLES = {'personne', 'objet', 'lieu', 'aucune'}
SLOTS = {'cible', 'objet', 'montant', 'destination', 'sujet', 'offre'}

avert = []
def warn(m):
    avert.append(m)

source = {a['id']: a for a in json.load(open(src_path, encoding='utf-8'))}
lots = {}
for f in sorted(glob.glob(os.path.join(lots_dir, 'lot*.json'))):
    for e in json.load(open(f, encoding='utf-8')):
        if e['id'] not in source:
            warn(f'{f}: id inconnu {e["id"]}')
            continue
        if e['id'] in lots:
            warn(f'{f}: id en double {e["id"]}')
        lots[e['id']] = e

manquants = sorted(set(source) - set(lots))
if manquants:
    msg = f'{len(manquants)} actions non enrichies (ex. {manquants[:5]})'
    if strict:
        sys.exit(msg)
    warn(msg)

def norm_expr(s):
    s = s.lower().replace('’', ' ').replace("'", ' ')
    s = re.sub(r'[^\w\s-]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def sans_accents(s):
    return unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode()

def clamp(v, lo, hi, d):
    try:
        v = int(round(float(v)))
    except (TypeError, ValueError):
        return d
    return max(lo, min(hi, v))

# --- nettoyage champ par champ
for i, e in lots.items():
    if e.get('famille') not in FAMILLES:
        warn(f'{i}: famille {e.get("famille")} -> expression'); e['famille'] = 'expression'
    if e.get('equivalentPrax') not in EXISTANTS:
        if e.get('equivalentPrax'): warn(f'{i}: equivalentPrax inconnu {e["equivalentPrax"]}')
        e['equivalentPrax'] = None
    if e.get('risque') not in RISQUES: e['risque'] = 'faible'
    if e.get('axe') not in AXES: e['axe'] = None
    if e.get('cible') not in CIBLES: e['cible'] = 'aucune'
    e['slots'] = [s for s in e.get('slots') or [] if s in SLOTS]
    for k in ('roleCible', 'autoriteActeur'):
        bad = [r for r in e.get(k) or [] if r not in ROLES]
        if bad: warn(f'{i}: {k} hors liste {bad}')
        e[k] = [r for r in e.get(k) or [] if r in ROLES]
    e['valence'] = clamp(e.get('valence'), -3, 3, 0)
    e['fatigue'] = clamp(e.get('fatigue'), 0, 3, 0)
    e['duree'] = clamp(e.get('duree'), 1, 48, 1)
    p = e.get('prixIndicatif')
    e['prixIndicatif'] = clamp(p, 1, 10**7, None) if p not in (None, 0) else None
    for k in ('competence', 'lieuRequis', 'produit', 'statutCible', 'statutActeur'):
        if not e.get(k): e[k] = None
    for k in ('recitJoueur', 'recitReussite', 'recitEchec', 'notesLore'):
        e[k] = e.get(k) or ''
    e['observable'] = bool(e.get('observable', True))
    e['illegal'] = bool(e.get('illegal', False))
    ex = []
    for x in e.get('expressions') or []:
        n = norm_expr(x)
        if n and n not in ex: ex.append(n)
    e['expressions'] = ex

# --- doublons : chaque action pointe vers sa racine conservée, sans cycle
def cible_doublon(i):
    d = lots[i].get('doublonDe')
    return d if d and d != i and d in lots else None

racine = {}
for i in lots:
    chemin, cur = [], i
    while cur is not None and cur not in racine and cur not in chemin:
        chemin.append(cur)
        cur = cible_doublon(cur)
    if cur is None or cur in racine:
        fin = None if cur is None else racine[cur]
        # la dernière du chemin sans cible est racine d'elle-même
        if fin is None:
            fin = chemin[-1]
        for c in chemin: racine[c] = fin
    else:
        # cycle : on garde le membre le plus « fort » (équivalent Prax, puis plus d'expressions, puis id)
        cycle = chemin[chemin.index(cur):]
        garde = sorted(cycle, key=lambda c: (lots[c]['equivalentPrax'] is None, -len(lots[c]['expressions']), c))[0]
        warn(f'cycle de doublons {cycle} -> on garde {garde}')
        for c in chemin: racine[c] = garde

gardees = {i: e for i, e in lots.items() if racine[i] == i}
fusion = collections.defaultdict(list)
for i, r in racine.items():
    if r != i: fusion[r].append(i)

# --- sens des transactions et effet des objets
def sens_de(e):
    i = e['id'].split('.', 1)[1]
    if re.search(r'accepter', i): return 'accepter'
    if re.search(r'refuser|decliner', i): return 'refuser'
    if re.search(r'annuler|retirer_offre|rompre', i): return 'annuler'
    if re.search(r'contre_offre|marchander|negocier_prix', i): return 'contre'
    if re.search(r'emprunter|facturer|percevoir|reclamer|fixer|negocier|signer|resilier|consigner|rendre_monnaie|liberation|assurer|organiser_vente', i): return 'requete'
    if re.search(r'vendre|ceder|revendre|liquider|brader|mettre_en|engager', i): return 'vente'
    if re.search(r'payer|rembourser|verser|regler|don|pourboire|preter|acompte|cotis|aumone|financer|soudoyer|corrompre|indemniser|offrande', i): return 'paiement'
    return 'achat'

EFFETS = [
    (r'deverrouill', 'deverrouiller'), (r'verrouill', 'verrouiller'), (r'desequip|retirer|enlever|rengain|oter', 'desequiper'),
    (r'equip|enfiler|porter|brandir|degainer|revetir|mettre', 'equiper'), (r'ouvrir', 'ouvrir'), (r'fermer', 'fermer'),
    (r'allumer', 'allumer'), (r'eteindre', 'eteindre'), (r'examiner|inspecter|observer|evaluer', 'examiner'),
    (r'briser|casser|detruire|fracasser', 'briser'), (r'donner|offrir|remettre|tendre|preter_objet', 'donner'),
    (r'poser|deposer|jeter|lacher|abandonner|ranger', 'poser'), (r'prendre|ramasser|saisir|recuperer|cueillir_objet', 'prendre'),
]
def effet_de(e):
    i = e['id'].split('.', 1)[1]
    for pat, eff in EFFETS:
        if re.search(pat, i): return eff
    return 'manipuler'

# --- expressions : celles des fusionnées rejoignent la gardée ; une expression n'appartient qu'à une action
propres = {i: list(e['expressions']) for i, e in gardees.items()}
for r, fs in fusion.items():
    for f in fs:
        for x in lots[f]['expressions']:
            if x not in gardees[r]['expressions']: gardees[r]['expressions'].append(x)

def mots_id(i):
    return {sans_accents(w)[:5] for w in re.split(r'[._]', i) if len(w) > 2}

def score(i, x):
    s = 10 if x in propres[i] else 0
    toks = {sans_accents(w)[:5] for w in x.split() if len(w) > 2}
    s += 5 * len(toks & mots_id(i))
    return s

proprio = collections.defaultdict(list)
for i, e in gardees.items():
    for x in e['expressions']: proprio[x].append(i)
partagees = 0
for x, ids in proprio.items():
    if len(ids) < 2: continue
    partagees += 1
    garde = sorted(ids, key=lambda i: (-score(i, x), len(gardees[i]['expressions']), i))[0]
    for i in ids:
        if i != garde and len(gardees[i]['expressions']) > 1:
            gardees[i]['expressions'].remove(x)

def slug(i):
    return re.sub(r'[^a-z0-9]+', '_', i.lower())

sortie = []
for i in sorted(gardees):
    e, s = gardees[i], source[i]
    o = {
        'id': i, 'slug': slug(i), 'domaine': s['domaine'], 'libelle': s['libelle'], 'famille': e['famille'],
        'equivalentPrax': e['equivalentPrax'] or next((lots[f]['equivalentPrax'] for f in fusion.get(i, []) if lots[f]['equivalentPrax'] and lots[f]['famille'] == e['famille']), None),
        'fusionnees': sorted(fusion.get(i, [])), 'expressions': e['expressions'], 'slots': e['slots'], 'cible': e['cible'],
        'roleCible': e['roleCible'], 'autoriteActeur': e['autoriteActeur'], 'valence': e['valence'], 'axe': e['axe'],
        'risque': e['risque'], 'duree': e['duree'], 'fatigue': e['fatigue'], 'prixIndicatif': e['prixIndicatif'],
        'competence': e['competence'], 'lieuRequis': e['lieuRequis'], 'produit': e['produit'], 'statutCible': e['statutCible'],
        'statutActeur': e['statutActeur'], 'observable': e['observable'], 'illegal': e['illegal'],
        'recitJoueur': e['recitJoueur'], 'recitReussite': e['recitReussite'], 'recitEchec': e['recitEchec'], 'notesLore': e['notesLore'],
    }
    if o['famille'] == 'transaction': o['sens'] = sens_de(o)
    if o['famille'] == 'objet': o['effetObjet'] = effet_de(o)
    sortie.append(o)

with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(sortie, f, ensure_ascii=False, indent=1)
    f.write('\n')

print(f'source {len(source)} / enrichies {len(lots)} / gardées {len(sortie)} / fusionnées {sum(len(v) for v in fusion.values())} / expressions partagées résolues {partagees}')
print('familles', dict(collections.Counter(o['famille'] for o in sortie)))
for m in avert: print('!', m)
