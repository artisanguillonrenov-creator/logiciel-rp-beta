import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import { Platform } from 'react-native';
import type { Message, StoryState } from '../types';
import { analyserMessage } from './messageFormatter';

// Trois formats proposés au moment du téléchargement (boutons simples, pas
// de menu déroulant) — texte brut par défaut, PDF pour l'universalité,
// EPUB pour lire sa propre histoire comme un livre. Les trois réutilisent
// analyserMessage() pour distinguer narration/dialogue, plutôt qu'un export
// plat sans mise en forme.
export type FormatExport = 'texte' | 'pdf' | 'epub';

function nomAuteur(story: StoryState, role: Message['role']): string {
  return role === 'user' ? story.meta.personnageNom || 'Joueur' : 'Narrateur';
}

function echapperHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function segmentsVersHtml(texte: string): string {
  return analyserMessage(texte)
    .map((seg) => {
      const contenu = echapperHtml(seg.contenu);
      if (seg.type === 'action') return `<em class="action">${contenu}</em>`;
      if (seg.type === 'dialogue') return `<span class="dialogue">${contenu}</span>`;
      return contenu;
    })
    .join('');
}

function nomFichier(story: StoryState, extension: string): string {
  const base = (story.meta.titre || story.meta.personnageNom || 'histoire')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${base || 'histoire'}.${extension}`;
}

function genererTexteBrut(story: StoryState): string {
  const lignes: string[] = [];
  const titre = story.meta.titre || story.meta.personnageNom;
  lignes.push(titre, '='.repeat(titre.length), '');
  for (const m of story.messages) {
    lignes.push(`${nomAuteur(story, m.role)} :`);
    lignes.push(m.content);
    lignes.push('');
  }
  return lignes.join('\n');
}

function genererCorpsHtml(story: StoryState): { titre: string; messages: string } {
  const titre = echapperHtml(story.meta.titre || story.meta.personnageNom);
  const messages = story.messages
    .map((m) => {
      const auteur = echapperHtml(nomAuteur(story, m.role));
      const classe = m.role === 'user' ? 'joueur' : 'narrateur';
      return `<p class="message ${classe}"><span class="auteur">${auteur}</span><br/>${segmentsVersHtml(m.content)}</p>`;
    })
    .join('\n');
  return { titre, messages };
}

const STYLE_EXPORT = `
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; line-height: 1.6; padding: 24px; }
  h1 { font-size: 24px; margin-bottom: 24px; }
  p.message { margin-bottom: 18px; }
  .auteur { font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; }
  .action { font-style: italic; color: #555; }
  .dialogue { color: #7a5c1e; }
`;

// --- Écriture + partage natif (Android/iOS) : fichier temporaire dans le
// cache, puis feuille de partage système. Sur web, expo-file-system n'a
// qu'un shim vide (pas de vraie écriture disque) — voir branche web
// dédiée plus bas pour chaque format.

async function ecrireEtPartagerNatif(nom: string, contenu: string | Uint8Array, mimeType: string): Promise<void> {
  const fichier = new File(Paths.cache, nom);
  fichier.create({ overwrite: true });
  fichier.write(contenu);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fichier.uri, { mimeType, dialogTitle: 'Exporter la conversation' });
  }
}

function telechargerWeb(nom: string, contenu: string | Uint8Array, mimeType: string): void {
  const morceau = typeof contenu === 'string' ? contenu : new Uint8Array(contenu);
  const blob = new Blob([morceau], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}

async function exporterTexte(story: StoryState): Promise<void> {
  const contenu = genererTexteBrut(story);
  const nom = nomFichier(story, 'txt');
  if (Platform.OS === 'web') {
    telechargerWeb(nom, contenu, 'text/plain');
    return;
  }
  await ecrireEtPartagerNatif(nom, contenu, 'text/plain');
}

async function exporterPdf(story: StoryState): Promise<void> {
  const { titre, messages } = genererCorpsHtml(story);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${STYLE_EXPORT}</style></head><body><h1>${titre}</h1>${messages}</body></html>`;

  if (Platform.OS === 'web') {
    // expo-print n'a pas d'équivalent web pour générer un vrai fichier PDF ;
    // on ouvre le contenu formaté dans un nouvel onglet et on déclenche
    // l'impression du navigateur (qui propose "Enregistrer en PDF").
    const fenetre = window.open('', '_blank');
    if (fenetre) {
      fenetre.document.write(html);
      fenetre.document.close();
      fenetre.focus();
      fenetre.print();
    }
    return;
  }

  const resultat = await Print.printToFileAsync({ html });
  const cible = new File(Paths.cache, nomFichier(story, 'pdf'));
  const source = new File(resultat.uri);
  await source.copy(cible, { overwrite: true });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(cible.uri, { mimeType: 'application/pdf', dialogTitle: 'Exporter la conversation' });
  }
}

async function genererEpubOctets(story: StoryState): Promise<Uint8Array> {
  const { titre, messages } = genererCorpsHtml(story);
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  const metaInf = zip.folder('META-INF')!;
  metaInf.file(
    'container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  const oebps = zip.folder('OEBPS')!;
  const uid = story.meta.id;

  oebps.file(
    'chapitre.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${titre}</title><style>${STYLE_EXPORT}</style></head>
<body><h1>${titre}</h1>${messages}</body>
</html>`,
  );

  oebps.file(
    'toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${uid}"/></head>
  <docTitle><text>${titre}</text></docTitle>
  <navMap>
    <navPoint id="chapitre1" playOrder="1">
      <navLabel><text>${titre}</text></navLabel>
      <content src="chapitre.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`,
  );

  oebps.file(
    'content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${titre}</dc:title>
    <dc:language>fr</dc:language>
    <dc:identifier id="BookId">${uid}</dc:identifier>
  </metadata>
  <manifest>
    <item id="chapitre" href="chapitre.xhtml" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="chapitre"/>
  </spine>
</package>`,
  );

  return zip.generateAsync({ type: 'uint8array' });
}

async function exporterEpub(story: StoryState): Promise<void> {
  const octets = await genererEpubOctets(story);
  const nom = nomFichier(story, 'epub');
  if (Platform.OS === 'web') {
    telechargerWeb(nom, octets, 'application/epub+zip');
    return;
  }
  await ecrireEtPartagerNatif(nom, octets, 'application/epub+zip');
}

export async function exporterConversation(story: StoryState, format: FormatExport): Promise<void> {
  if (format === 'texte') return exporterTexte(story);
  if (format === 'pdf') return exporterPdf(story);
  return exporterEpub(story);
}
