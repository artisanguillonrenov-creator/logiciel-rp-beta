// Distingue narration/action (*entre astérisques*) et dialogue ("entre
// guillemets") dans le texte brut d'un message — convention d'écriture RP
// standard que le narrateur suit déjà naturellement dans ses réponses, mais
// jamais mise en forme visuellement jusqu'ici (ni en conversation, ni à
// l'export). Un seul analyseur, réutilisé par la bulle de message et par
// les générateurs PDF/EPUB, pour que les deux restent cohérents.
export type TypeSegmentMessage = 'action' | 'dialogue' | 'texte' | 'repliquePersonnage';

export interface SegmentMessage {
  type: TypeSegmentMessage;
  contenu: string;
  // Nom du PNJ (segment 'repliquePersonnage' uniquement) — voir le format
  // "NOM : « réplique »" demandé au narrateur dans le bloc [STYLE] de
  // promptBuilder.ts. Sert à retrouver son avatar déjà généré (voir
  // TexteMessageFormate) sans recourir à une détection approximative.
  locuteur?: string;
}

const GUILLEMETS = ['"', '«', '»', '“', '”'];

// "NOM : « réplique »" sur sa propre ligne — nom en MAJUSCULES (accents
// compris) pour distinguer sans ambiguïté une étiquette de personnage d'une
// phrase de narration qui contiendrait incidemment un ":". Une seule ligne
// (pas de guillemet multi-lignes ici) : la réplique elle-même peut être
// vide, mais pas franchir un saut de ligne.
const REGLE_REPLIQUE_NOMMEE = /^[ \t]*([A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ][A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ' -]{1,29}?)[ \t]*:[ \t]*«([^»\n]*)»[ \t]*$/gm;

function analyserSegmentsSansLocuteur(texte: string): SegmentMessage[] {
  const segments: SegmentMessage[] = [];
  let i = 0;
  let tampon = '';

  function flush() {
    if (tampon) {
      segments.push({ type: 'texte', contenu: tampon });
      tampon = '';
    }
  }

  while (i < texte.length) {
    const c = texte[i];
    if (c === '*') {
      const fin = texte.indexOf('*', i + 1);
      if (fin > i) {
        flush();
        segments.push({ type: 'action', contenu: texte.slice(i + 1, fin) });
        i = fin + 1;
        continue;
      }
    }
    if (GUILLEMETS.includes(c) && (c === '"' || c === '«' || c === '“')) {
      const fermeture = c === '«' ? '»' : c === '“' ? '”' : '"';
      const fin = texte.indexOf(fermeture, i + 1);
      if (fin > i) {
        flush();
        segments.push({ type: 'dialogue', contenu: texte.slice(i, fin + 1) });
        i = fin + 1;
        continue;
      }
    }
    tampon += c;
    i++;
  }
  flush();
  return segments;
}

export function analyserMessage(texte: string): SegmentMessage[] {
  const segments: SegmentMessage[] = [];
  let curseur = 0;
  REGLE_REPLIQUE_NOMMEE.lastIndex = 0;
  let correspondance: RegExpExecArray | null;
  while ((correspondance = REGLE_REPLIQUE_NOMMEE.exec(texte))) {
    if (correspondance.index > curseur) {
      segments.push(...analyserSegmentsSansLocuteur(texte.slice(curseur, correspondance.index)));
    }
    segments.push({
      type: 'repliquePersonnage',
      contenu: correspondance[2].trim(),
      locuteur: correspondance[1].trim(),
    });
    curseur = correspondance.index + correspondance[0].length;
  }
  if (curseur < texte.length) {
    segments.push(...analyserSegmentsSansLocuteur(texte.slice(curseur)));
  }
  return segments.length > 0 ? segments : [{ type: 'texte', contenu: texte }];
}
