import type { StoryState } from '../types';
import type { RapportValidation, ResultatCheck } from './validator';

// Pas d'import à l'exécution de validator.ts : il tire le moteur natif
// (LiteRT) via openrouter.ts, et ces contrôles doivent rester testables.
const rapportOk = (): RapportValidation => ({ ok: true, checks: [] });

// Contrôles locaux de la V13, sans appel réseau : ils tournent à chaque
// tour et décident si l'appel de validation au modèle vaut la peine.

function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9à-ÿ' ]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MOTS_VIDES = new Set([
  'avec', 'dans', 'pour', 'mais', 'plus', 'comme', 'tout', 'elle', 'elles', 'leur', 'leurs', 'nous', 'vous', 'cette', 'ceci',
  'cela', 'sans', 'sous', 'alors', 'encore', 'entre', 'apres', 'avant', 'vers', 'dont', 'tres', 'bien', 'fait', 'faire', 'etre',
  'avait', 'sont', 'sera', 'ses', 'son', 'sur', 'une', 'des', 'les', 'que', 'qui', 'aux', 'par', 'pas',
]);

function motsSignificatifs(texte: string): Set<string> {
  return new Set(normaliser(texte).split(' ').filter((m) => m.length >= 4 && !MOTS_VIDES.has(m)));
}

// Similarité de Jaccard sur les mots significatifs.
function similarite(a: string, b: string): number {
  const A = motsSignificatifs(a);
  const B = motsSignificatifs(b);
  if (!A.size || !B.size) return 0;
  let communs = 0;
  for (const m of A) if (B.has(m)) communs += 1;
  const union = A.size + B.size - communs;
  return union ? communs / union : 0;
}

/** Paragraphe répété dans la réponse, ou réponse qui recopie l'une des deux précédentes. */
export function validerRepetitionHeuristique(reponse: string, story: StoryState): RapportValidation {
  const paragraphes = reponse.split(/\n{2,}/).map(normaliser).filter((p) => p.length >= 45);
  const vus = new Set<string>();
  for (const p of paragraphes) {
    if (vus.has(p)) {
      return { ok: false, checks: [{ nom: 'repetition_contradiction', ok: false, gravite: 'modere', raison: 'Un paragraphe est répété presque à l’identique dans la même réponse.' }] };
    }
    vus.add(p);
  }
  for (const precedente of story.messages.filter((m) => m.role === 'assistant').slice(-2)) {
    if (precedente.content.length >= 180 && reponse.length >= 180 && similarite(reponse, precedente.content) >= 0.78) {
      return { ok: false, checks: [{ nom: 'repetition_contradiction', ok: false, gravite: 'modere', raison: 'La nouvelle réponse répète fortement une réponse récente au lieu de faire avancer la scène.' }] };
    }
  }
  return rapportOk();
}

// Formules typiques d'un retournement qui défait un fait établi.
const FORMULES_CONTRADICTION = [
  'en realite il n avait jamais',
  'en realite elle n avait jamais',
  'contrairement a ce qui avait ete etabli',
  'revenu d entre les morts',
  'revenue d entre les morts',
  'n etait finalement pas mort',
  'n etait finalement pas morte',
  'tout ce qui precedait etait une illusion',
];

/** Vrai si la réponse semble contredire des faits établis : seul cas où la validation par le modèle est appelée. */
export function contradictionProbable(reponse: string, story: StoryState): boolean {
  if (story.memoire.faits.length === 0) return false;
  const texte = normaliser(reponse);
  return FORMULES_CONTRADICTION.some((f) => texte.includes(f));
}

/** Tout ce qui fait autorité sur les noms propres : lore, lore émergent, faits, échanges récents, message du joueur. */
export function corpusCanon(story: StoryState, messageJoueur: string, lore: { titre: string; contenu: string }[]): string {
  return normaliser(
    [
      ...lore.map((e) => `${e.titre} ${e.contenu}`),
      ...story.loreEmergent.map((e) => `${e.titre} ${e.contenu}`),
      ...story.memoire.faits.map((f) => f.texte),
      ...story.messages.slice(-80).map((m) => m.content),
      messageJoueur,
    ].filter(Boolean).join('\n'),
  );
}

const NOM = "([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’\\-]{2,}(?:\\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’\\-]{2,}){0,2})";
const ENTITES_MAJEURES: { remplacement: string; motif: string }[] = [
  {
    remplacement: 'autorité locale',
    motif: `\\b(?:Royaume|royaume|Empire|empire|Couronne|couronne|Sultanat|sultanat|Principauté|principauté|Duché|duché|République|république|Confédération|confédération|Califat|califat)\\s+(?:(?:de la|des|du|de)\\s+|d['’]\\s*)?${NOM}`,
  },
  {
    remplacement: 'souverain local',
    motif: `\\b(?:Roi|roi|Reine|reine|Empereur|empereur|Impératrice|impératrice|Sultan|sultan|Sultane|sultane|Calife|calife)\\s+${NOM}`,
  },
  {
    remplacement: 'institution locale',
    motif: `\\b(?:Guilde|guilde|Ordre|ordre|Église|église|Culte|culte)\\s+(?:(?:de la|des|du|de)\\s+|d['’]\\s*)${NOM}`,
  },
];

/**
 * Royaume, souverain, guilde ou culte nommé qui n'existe nulle part dans le
 * canon : le modèle l'a inventé. Contrôle grave (régénération complète) et
 * patchable en dernier recours par un terme générique.
 */
export function verifierEntitesCanoniques(reponse: string, corpus: string): RapportValidation {
  const checks: ResultatCheck[] = [];
  const signales = new Set<string>();
  for (const { remplacement, motif } of ENTITES_MAJEURES) {
    const regex = new RegExp(motif, 'g');
    for (let m = regex.exec(reponse); m; m = regex.exec(reponse)) {
      const nom = normaliser(m[1]?.trim() ?? '');
      if (!nom || nom.length < 3 || corpus.includes(nom)) continue;
      const expression = m[0].trim();
      const cle = normaliser(expression);
      if (signales.has(cle)) continue;
      signales.add(cle);
      checks.push({
        nom: 'canon',
        ok: false,
        gravite: 'grave',
        raison: `Entité majeure non vérifiée dans le canon : « ${expression} ». N'invente pas de royaume, souverain, guilde majeure ou religion nommée : utilise une entité présente dans le lore pertinent ou reste générique.`,
        nomIncorrect: expression,
        nomCorrect: remplacement,
      });
    }
  }
  return checks.length ? { ok: false, checks } : rapportOk();
}
