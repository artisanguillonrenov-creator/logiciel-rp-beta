// Distingue narration/action (*entre astérisques*) et dialogue ("entre
// guillemets") dans le texte brut d'un message — convention d'écriture RP
// standard que le narrateur suit déjà naturellement dans ses réponses, mais
// jamais mise en forme visuellement jusqu'ici (ni en conversation, ni à
// l'export). Un seul analyseur, réutilisé par la bulle de message et par
// les générateurs PDF/EPUB, pour que les deux restent cohérents.
export type TypeSegmentMessage = 'action' | 'dialogue' | 'texte';

export interface SegmentMessage {
  type: TypeSegmentMessage;
  contenu: string;
}

const GUILLEMETS = ['"', '«', '»', '“', '”'];

export function analyserMessage(texte: string): SegmentMessage[] {
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
  return segments.length > 0 ? segments : [{ type: 'texte', contenu: texte }];
}
