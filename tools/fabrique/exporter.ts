/**
 * Convertit les parties fabriquées en jeu d'entraînement (JSONL, format
 * « messages » d'Axolotl) et en jeu de test.
 *
 * Seuls les échantillons qui ont passé tous les contrôles sont gardés. Les
 * réponses de l'historique servent de contexte (training: false) ; seule la
 * réponse finale est apprise (training: true).
 *
 * Usage : node .fabrique-dist/tools/fabrique/exporter.js <dossierParties> <sortie.jsonl> [partTest=0.05]
 */
import fs from 'node:fs';
import path from 'node:path';

interface Echantillon {
  tour: number;
  type: 'ouverture' | 'tour';
  messages: { role: string; content: string }[];
  reponse: string;
  ok: boolean;
}

interface Partie {
  id: string;
  monde: string;
  echantillons: Echantillon[];
}

export function versLigne(e: Echantillon) {
  return {
    messages: [
      ...e.messages.map((m) => ({ role: m.role, content: m.content, training: false })),
      { role: 'assistant', content: e.reponse, training: true },
    ],
  };
}

export function main() {
  const [dossier, sortie, partTexte = '0.05'] = process.argv.slice(2);
  const partTest = Number(partTexte);
  const parties: Partie[] = fs.readdirSync(dossier).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dossier, f), 'utf8')));
  // Le test se fait sur des parties entières jamais vues à l'entraînement.
  const nbTest = Math.max(1, Math.round(parties.length * partTest));
  const test = parties.slice(0, nbTest);
  const entrainement = parties.slice(nbTest);
  const ecrire = (fichier: string, liste: Partie[]) => {
    const lignes = liste.flatMap((p) => p.echantillons.filter((e) => e.ok).map((e) => JSON.stringify(versLigne(e))));
    fs.writeFileSync(fichier, `${lignes.join('\n')}\n`);
    return lignes.length;
  };
  const nbEntrainement = ecrire(sortie, entrainement);
  const nbLignesTest = ecrire(sortie.replace(/\.jsonl$/, '.test.jsonl'), test);
  const total = parties.reduce((n, p) => n + p.echantillons.length, 0);
  const retenus = parties.reduce((n, p) => n + p.echantillons.filter((e) => e.ok).length, 0);
  const parMonde = new Map<string, number>();
  for (const p of parties) parMonde.set(p.monde, (parMonde.get(p.monde) ?? 0) + p.echantillons.filter((e) => e.ok).length);
  console.log(JSON.stringify({ parties: parties.length, echantillons: total, retenus, entrainement: nbEntrainement, test: nbLignesTest, parMonde: Object.fromEntries(parMonde) }, null, 2));
}

if (require.main === module) main();
