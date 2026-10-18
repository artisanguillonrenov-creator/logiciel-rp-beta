import type { EntreeLoreEmergent, StoryState } from '../types';
import { classerLexical } from './rechercheLexicale';
import { contientExpression, normaliserTexte } from './texteRecherche';
import { synchroniserMemoireNarrative } from './memoireNarrative';

export interface SouvenirPnj {
  evenementId: string;
  messageIds: string[];
  /** Empreinte des messages source : invalide le souvenir après réécriture à IDs constants. */
  empreinteSource?: string;
  resume: string;
  source: 'vecu' | 'appris';
  lieu?: string;
  date?: string;
  importance: number;
}
export interface FicheRegistrePnj {
  id: string;
  entreeId: string;
  nom: string;
  alias: string[];
  origine: 'invente' | 'canon';
  sourceCanonId?: string;
  souvenirs: SouvenirPnj[];
}
export interface RegistrePnj {
  version: 1;
  fiches: FicheRegistrePnj[];
}
export const registrePnjVide = (): RegistrePnj => ({ version: 1, fiches: [] });

// Signature déterministe du texte source, indépendante des IDs conservés par une régénération.
function empreinteMessages(messages: { id: string; content: string }[], messageIds: string[]): string | undefined {
  const parId = new Map(messages.map(m => [m.id, m.content]));
  if (!messageIds.length || messageIds.some(id => !parId.has(id))) return undefined;
  let hash = 0x811c9dc5;
  for (const id of messageIds) {
    for (const caractere of id + '\\u0000' + parId.get(id)! + '\\u0001') {
      hash ^= caractere.charCodeAt(0);
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return (hash >>> 0).toString(36);
}

function correspond(nom: string, fiche: FicheRegistrePnj, fiches: FicheRegistrePnj[]): boolean {
  const cle = normaliserTexte(nom);
  if (!cle) return false;
  // « Marcus » ne prouve pas lequel des deux Marcus était témoin.
  const correspondances = fiches.filter(f => [f.nom, ...f.alias].some(v => normaliserTexte(v) === cle));
  return correspondances.length === 1 && correspondances[0].id === fiche.id;
}

function prenomUsuel(nom: string): string | undefined {
  // Pas d'alias de prénom pour les noms culturels à un seul élément.
  const morceaux = nom.trim().split(/\s+/);
  return morceaux.length >= 2 && !nom.includes('(') ? morceaux[0] : undefined;
}
function entite(story: StoryState, fiche: FicheRegistrePnj): EntreeLoreEmergent | undefined {
  return story.loreEmergent.find(e => e.id === fiche.entreeId || e.alias?.includes(fiche.entreeId));
}
/** Réconcilie les fiches avec les PNJ réellement présents dans le lore de CETTE histoire. */
export function consoliderRegistrePnj(story: StoryState): RegistrePnj {
  const precedent = story.pnjLorebook ?? registrePnjVide();
  const entrees = story.loreEmergent.filter(e => e.categorie === 'pnj'
    && normaliserTexte(e.titre) !== normaliserTexte(story.meta.personnageNom));
  const ids = new Set(story.messages.map(m => m.id));
  const fiches = entrees.map(e => {
    const ancien = precedent.fiches.find(f => f.entreeId === e.id || e.alias?.includes(f.entreeId));
    return {
      id: ancien?.id ?? e.id,
      entreeId: e.id,
      nom: e.titre,
      alias: [...new Set([
        ...(ancien?.alias ?? []),
        ...(prenomUsuel(e.titre) ? [prenomUsuel(e.titre)!] : []),
        ...(e.alias ?? []).filter(x => !x.startsWith('emergent-')),
      ])],
      origine: ancien?.origine ?? 'invente',
      sourceCanonId: ancien?.sourceCanonId,
      souvenirs: (ancien?.souvenirs ?? []).filter(s => s.messageIds.every(id => ids.has(id)) &&
        !!s.empreinteSource && s.empreinteSource === empreinteMessages(story.messages, s.messageIds)),
    } satisfies FicheRegistrePnj;
  });
  const evenements = synchroniserMemoireNarrative({ ...story, loreEmergent: entrees });
  for (const fiche of fiches) {
    const existing = new Set(fiche.souvenirs.map(s => s.evenementId));
    for (const e of evenements) {
      if (existing.has(e.id)) continue;
      // Les simples citations ne constituent PAS des souvenirs vécus.
      // Pour les anciennes histoires sans registre, seule une réplique explicite
      // du PNJ est une preuve minimale de sa présence.
      const presentRegistre = e.fiabilitePresence === 'registre' &&
        e.participants.some(p => correspond(p, fiche, fiches));
      const priseDeParole = e.messageIds.some(id => {
        const texte = story.messages.find(m => m.id === id)?.content ?? '';
        return texte.split('\n').some(l => {
          const match = /^\s*([\p{L}][\p{L}'’ -]{1,50})\s*:\s*[«"]/u.exec(l);
          return !!match && correspond(match[1], fiche, fiches);
        });
      });
      if (!presentRegistre && !priseDeParole) continue;
      fiche.souvenirs.push({
        evenementId: e.id, messageIds: e.messageIds,
        empreinteSource: empreinteMessages(story.messages, e.messageIds), resume: e.resultat,
        source: 'vecu', lieu: e.lieu, date: e.temps ?? e.dateChronique,
        importance: 1,
      });
      existing.add(e.id);
    }
  }
  return { version: 1, fiches };
}

export interface ResultatRecherchePnj {
  fiche: FicheRegistrePnj;
  profil: EntreeLoreEmergent | undefined;
  texte: string;
  souvenirsRetenus: SouvenirPnj[];
}
/** Troisième voie lexicale : ancrage par nom/alias puis recherche par mots dans la mémoire personnelle. */
export function rechercherPnjLexical(story: StoryState, requete: string, maxPnj = 3): ResultatRecherchePnj[] {
  const registre = story.pnjLorebook;
  if (!registre || !requete.trim()) return [];
  const groupes = new Map<string, FicheRegistrePnj[]>();
  for (const fiche of registre.fiches) {
    for (const cle of new Set([fiche.nom, ...fiche.alias].map(normaliserTexte).filter(Boolean))) {
      groupes.set(cle, [...(groupes.get(cle) ?? []), fiche]);
    }
  }
  const retenus = registre.fiches.filter(f => [f.nom, ...f.alias].some(alias => {
    const cle = normaliserTexte(alias);
    return cle && groupes.get(cle)?.length === 1 && contientExpression(requete, alias);
  })).slice(0, maxPnj);
  return retenus.map(fiche => {
    const profil = entite(story, fiche);
    const memories = classerLexical({
      requete,
      items: fiche.souvenirs,
      titreDe: s => s.lieu ?? '',
      texteDe: s => s.resume,
      budget: { maxResultats: 3, maxCaracteres: 900, maxCaracteresParResultat: 300 },
    }).map(r => r.item);
    const souvenirsRetenus = memories.length ? memories : fiche.souvenirs.slice(-2);
    const p = profil?.profilPnj;
    const traits = p ? [
      p.race && 'Race : ' + p.race, p.ageApparent && 'Âge apparent : ' + p.ageApparent,
      p.apparence && 'Apparence de référence : ' + p.apparence,
      p.personnalite && 'Personnalité : ' + p.personnalite,
      p.profession && 'Profession : ' + p.profession,
      p.particularites && 'Particularités : ' + p.particularites,
    ].filter(Boolean).join('. ') : '';
    const relations = story.social.relations.filter(r => normaliserTexte(r.nom) === normaliserTexte(fiche.nom))
      .map(r => 'Relation actuelle : confiance ' + r.confiance + ', respect ' + r.respect + ', affection ' + r.affection + ', hostilité ' + r.hostilite).join('. ');
    const texte = [
      'PNJ ' + fiche.nom + ' — fiche de cette histoire.',
      profil?.contenu, traits, relations,
      souvenirsRetenus.length && ('Souvenirs personnels (ne sait pas les scènes auxquelles il n’a pas assisté) : ' +
        souvenirsRetenus.map(s => s.resume).join(' ; ')),
    ].filter(Boolean).join('\n');
    return { fiche, profil, souvenirsRetenus, texte };
  });
}
