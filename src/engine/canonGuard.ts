import elyndorRaw from '../data/elyndorLore.json';
import type { LoreEntry, StoryState } from '../types';
import { chargerLoreElyndor } from './loreLoader';
import type { RapportValidation, ResultatCheck } from './validator';

const LORE_ELYNDOR = chargerLoreElyndor(elyndorRaw as any);

function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9à-ÿ' ]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Les entrées [ROYAUME] liées explicitement à la requête doivent passer
 * avant le classement sémantique ordinaire. Cela évite qu'un modèle reçoive
 * beaucoup de lore proche tout en ratant précisément l'autorité canonique du
 * territoire mentionné.
 */
export function ancresCanoniques(requete: string): LoreEntry[] {
  const requeteNormalisee = normaliser(requete);
  const ancres: LoreEntry[] = [];

  for (const entree of LORE_ELYNDOR) {
    if (!entree.titre.startsWith('[ROYAUME] ')) continue;
    const nom = entree.titre.replace(/^\[[^\]]+\]\s*/, '').split('—')[0].trim();
    const nomNormalise = normaliser(nom);
    if (nomNormalise.length >= 3 && requeteNormalisee.includes(nomNormalise)) {
      ancres.push({ id: entree.id, titre: entree.titre, contenu: entree.contenu, score: 2 });
    }
  }

  return ancres.slice(0, 2);
}

export function prioriserLoreCanon(requete: string, selection: LoreEntry[]): LoreEntry[] {
  const resultat: LoreEntry[] = [];
  const ids = new Set<string>();

  const classes = [
    ...ancresCanoniques(requete),
    ...selection.filter((e) => e.score !== undefined),
    ...selection.filter((e) => e.score === undefined),
  ];

  for (const entree of classes) {
    if (ids.has(entree.id)) continue;
    ids.add(entree.id);
    resultat.push(entree);
  }
  return resultat;
}

function corpusCanon(story: StoryState, messageJoueur: string): string {
  return normaliser([
    ...LORE_ELYNDOR.map((e) => `${e.titre} ${e.contenu}`),
    ...story.loreEmergent.map((e) => `${e.titre} ${e.contenu}`),
    ...story.memoire.faits.map((e) => e.texte),
    ...story.messages.slice(-80).map((e) => e.content),
    messageJoueur,
  ].filter(Boolean).join('\n'));
}

const CATEGORIES = [
  {
    replacement: 'autorité locale',
    regex: /\b(?:Royaume|royaume|Empire|empire|Couronne|couronne|Sultanat|sultanat|Principauté|principauté|Duché|duché|République|république|Confédération|confédération|Califat|califat)\s+(?:(?:de la|des|du|de)\s+|d['’]\s*)?([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{2,}(?:\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{2,}){0,2})/g,
  },
  {
    replacement: 'souverain local',
    regex: /\b(?:Roi|roi|Reine|reine|Empereur|empereur|Impératrice|impératrice|Sultan|sultan|Sultane|sultane|Calife|calife)\s+([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{2,}(?:\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{2,}){0,2})/g,
  },
  {
    replacement: 'institution locale',
    regex: /\b(?:Guilde|guilde|Ordre|ordre|Église|église|Culte|culte)\s+(?:(?:de la|des|du|de)\s+|d['’]\s*)([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{2,}(?:\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{2,}){0,2})/g,
  },
] as const;

/**
 * Filet déterministe contre les inventions de niveau "macro-canon".
 * Un PNJ local mineur peut être improvisé ; un royaume, un souverain, une
 * grande guilde ou une religion nommée doit déjà exister dans le corpus.
 */
export function verifierEntitesCanoniques(
  reponse: string,
  story: StoryState,
  messageJoueur: string,
): RapportValidation {
  const corpus = corpusCanon(story, messageJoueur);
  const checks: ResultatCheck[] = [];
  const dejaSignales = new Set<string>();

  for (const categorie of CATEGORIES) {
    categorie.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = categorie.regex.exec(reponse)) !== null) {
      const nom = match[1]?.trim();
      const nomNormalise = normaliser(nom ?? '');
      if (!nomNormalise || nomNormalise.length < 3 || corpus.includes(nomNormalise)) continue;

      const expression = match[0].trim();
      const cle = normaliser(expression);
      if (dejaSignales.has(cle)) continue;
      dejaSignales.add(cle);

      checks.push({
        nom: 'canon',
        ok: false,
        gravite: 'grave',
        raison: `Entité majeure non vérifiée dans le canon : « ${expression} ». N'invente pas de royaume, souverain, guilde majeure ou religion nommée : utilise une entité présente dans le lore pertinent ou reste générique.`,
        nomIncorrect: expression,
        nomCorrect: categorie.replacement,
      });
    }
  }

  return checks.length ? { ok: false, checks } : { ok: true, checks: [] };
}
