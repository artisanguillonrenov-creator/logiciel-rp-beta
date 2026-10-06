import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consigneCompletion,
  couperALaDernierePhraseComplete,
  genererReponseComplete,
  refermerBalisesOuvertes,
  retirerPhraseInachevee,
} from '../src/engine/completionReponse';
import type { AppelModeleOptions, ReponseModele } from '../src/engine/elyndorCloudClient';
import { FIN_ETAT, MARQUEUR_ETAT } from '../src/engine/noyauNarratif';
import { INSTRUCTION_FIN_DE_REPONSE, INSTRUCTION_STYLE_JOUEUR, maxTokensPourLongueur } from '../src/engine/promptBuilder';
import { validerAgentiviteHeuristique } from '../src/engine/validator';

const OPTIONS: AppelModeleOptions = {
  apiKey: '',
  model: 'anubis',
  messages: [{ role: 'system', content: 'narrateur' }, { role: 'user', content: 'J’entre.' }],
  temperature: 0.9,
  maxTokens: 650,
};

function appelsSimules(reponses: ReponseModele[]) {
  const recus: AppelModeleOptions[] = [];
  const appeler = async (options: AppelModeleOptions) => {
    recus.push(options);
    const suivante = reponses.shift();
    if (!suivante) throw new Error('appel inattendu');
    return suivante;
  };
  return { appeler, recus };
}

test('la découpe sépare la dernière phrase inachevée de la partie complète', () => {
  const d = couperALaDernierePhraseComplete('La pluie tombe. *Il avance.* KAELEN : « Tu es venu seul. » Puis il se tourne vers');
  assert.equal(d.base, 'La pluie tombe. *Il avance.* KAELEN : « Tu es venu seul. »');
  assert.equal(d.reste, 'Puis il se tourne vers');
  assert.equal(d.separateur, ' ');

  const propre = couperALaDernierePhraseComplete('Tout est dit. Vraiment !');
  assert.equal(propre.reste, '');
  assert.equal(propre.base, 'Tout est dit. Vraiment !');

  const ligne = couperALaDernierePhraseComplete('KAELEN : « Approche »\nLa porte s’ouvre sur');
  assert.equal(ligne.base, 'KAELEN : « Approche »');
  assert.equal(ligne.separateur, '\n');
});

test('une réplique ou une action restée ouverte est refermée', () => {
  assert.equal(refermerBalisesOuvertes('KAELEN : « Tu es venu'), 'KAELEN : « Tu es venu »');
  assert.equal(refermerBalisesOuvertes('*Il recule'), '*Il recule*');
  assert.equal(retirerPhraseInachevee('Il entre. Elle lève les yeux vers'), 'Il entre.');
});

test('une réponse non coupée est rendue telle quelle, en un seul appel', async () => {
  const { appeler, recus } = appelsSimules([{ contenu: 'Fin propre.', coupee: false }]);
  assert.equal(await genererReponseComplete(OPTIONS, appeler), 'Fin propre.');
  assert.equal(recus.length, 1);
});

test('une réponse coupée en pleine phrase est terminée par le modèle, avec le bloc d’état', async () => {
  const etat = `${MARQUEUR_ETAT}{"events":[]}${FIN_ETAT}`;
  const { appeler, recus } = appelsSimules([
    { contenu: 'La taverne se tait. Sylvana pose la main sur la garde de son', coupee: true },
    { contenu: `Sylvana pose la main sur la garde de son épée.\n${etat}`, coupee: false },
  ]);
  const resultat = await genererReponseComplete(OPTIONS, appeler);
  assert.equal(resultat, `La taverne se tait. Sylvana pose la main sur la garde de son épée.\n\n${etat}`);

  assert.equal(recus.length, 2);
  const derniers = recus[1].messages.slice(-2);
  assert.equal(derniers[0].role, 'assistant');
  assert.match(derniers[1].content, /Sylvana pose la main sur la garde de son/);
  assert.match(derniers[1].content, /Réécris UNIQUEMENT cette phrase/);
  assert.equal(recus[1].maxTokens, 520);
});

test('une coupure dans le seul bloc d’état ne relance pas le modèle', async () => {
  const { appeler, recus } = appelsSimules([
    { contenu: `Fin de scène.\n${MARQUEUR_ETAT}{"events":[`, coupee: true },
  ]);
  await genererReponseComplete(OPTIONS, appeler);
  assert.equal(recus.length, 1);
});

test('si la complétion échoue, la phrase inachevée est retirée plutôt que laissée en suspens', async () => {
  const { appeler } = appelsSimules([{ contenu: 'Il entre. Elle lève les yeux vers', coupee: true }]);
  assert.equal(await genererReponseComplete(OPTIONS, appeler), 'Il entre.');
});

test('une complétion qui repart dans l’histoire est bornée à une phrase complète', async () => {
  const longue = `Elle lève les yeux vers lui. ${'Puis une longue suite non demandée continue encore. '.repeat(20)}`;
  const { appeler } = appelsSimules([
    { contenu: 'Il entre. Elle lève les yeux vers', coupee: true },
    { contenu: longue, coupee: false },
  ]);
  const resultat = await genererReponseComplete(OPTIONS, appeler);
  assert.ok(resultat.startsWith('Il entre. Elle lève les yeux vers lui.'));
  assert.ok(resultat.length <= 'Il entre. '.length + 700);
  assert.match(resultat, /[.!?…»*]$/);
});

test('à l’ouverture, sans bloc d’état, seule la phrase coupée est complétée', async () => {
  const { appeler, recus } = appelsSimules([
    { contenu: 'Le vent siffle. Au loin, une cloche', coupee: true },
    { contenu: 'Au loin, une cloche sonne trois coups.', coupee: false },
  ]);
  assert.equal(await genererReponseComplete(OPTIONS, appeler, false), 'Le vent siffle. Au loin, une cloche sonne trois coups.');
  assert.doesNotMatch(recus[1].messages.at(-1)?.content ?? '', /bloc d'état/);
  assert.match(consigneCompletion('x'), new RegExp(MARQUEUR_ETAT.replace(/[<>]/g, '.')));
});

test('le narrateur reçoit une cible en mots cohérente avec le plafond et la consigne de fin', () => {
  assert.deepEqual(
    (['courte', 'moyenne', 'longue'] as const).map(maxTokensPourLongueur),
    [350, 650, 1100],
  );
  assert.match(INSTRUCTION_FIN_DE_REPONSE, /phrase complète/);
});

test('consignes issues des parties réelles : tutoiement, aucun mot inventé, pas d’achat à la place du joueur', () => {
  assert.match(INSTRUCTION_STYLE_JOUEUR, /deuxième personne du singulier/);
  assert.match(INSTRUCTION_STYLE_JOUEUR, /n’invente pas de mots/);
  assert.match(INSTRUCTION_STYLE_JOUEUR, /paiement, une signature/);
  assert.equal(validerAgentiviteHeuristique('Tu paies Marcus et repars avec elle.').ok, false);
  assert.equal(validerAgentiviteHeuristique('Marcus attend ta réponse.').ok, true);
});
