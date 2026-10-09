import assert from 'node:assert/strict';
import test from 'node:test';
import { creerNouvelleHistoire } from '../src/engine/story';
import { creerConfigurationAtelier } from '../src/concepteur/configuration';
import { creerRapportAuditAtelier, resumerDiagnosticAtelier } from '../src/concepteur/auditAtelier';

function histoire() {
  return creerNouvelleHistoire({
    personnageNom: 'Personnage secret',
    personnageDescription: 'Secrets très personnels',
    pointDeDepart: 'Lieu secret',
    contexte: { lieu: 'Lieu privé', ambiance: '', dateChronique: '', objectifs: '' },
    settings: { creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste',
      violence: 'modere', romance: 'aucun', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal' },
  });
}
test('audit : aucune histoire ne donne 15 états non mesurés', () => {
  const r = resumerDiagnosticAtelier(null);
  assert.equal(r.disponible, false);
  assert.equal(r.moteurs.length, 15);
  assert.ok(r.moteurs.every((m) => m.dernierTour === 'non_mesure'));
});
test('audit : responsabilités mobilisées vérifiées dans la trace réelle du tour', () => {
  const s = histoire();
  const tour = {
    id: 'diag-secret', startedAt: 100, dureeTotaleMs: 1200,
    etapes: [
      { nom: 'Méta-moteurs V2.1 — contrat narratif', categorie: 'contexte', statut: 'ok' as const, dureeMs: 0,
        details: ['2/15 responsabilités mobilisées', 'M01 Production de la réponse — coordination', 'M02 Continuité — toujours'] },
      { nom: 'Recherche lore et historique', categorie: 'recherche', statut: 'ok' as const, dureeMs: 480,
        details: ['Lore secret introuvable', 'Nom du personnage secret'] },
    ],
    appelsIA: [{ composant: 'Narration', modele: 'modele-test', maxTokens: 100,
      dureeMs: 650, inputTokens: 70, cachedInputTokens: 10, outputTokens: 20,
      reasoningTokens: 0, totalTokens: 90, usageComplet: true, statut: 'ok' as const }],
    embeddings: [],
  };
  s.messages.push({ id: 'u', role: 'user', timestamp: 100, content: 'MESSAGE PERSONNEL PRIVÉ' });
  s.messages.push({ id: 'a', role: 'assistant', timestamp: 100, content: 'RÉPONSE PRIVÉE', diagnosticTour: tour });
  const res = resumerDiagnosticAtelier(s);
  assert.equal(res.disponible, true);
  assert.equal(res.moteurs.find((m) => m.id === 'M01')?.dernierTour, 'mobilise');
  assert.equal(res.moteurs.find((m) => m.id === 'M14')?.dernierTour, 'non_mobilise');
  assert.equal(res.tokensTotal, 90);
  const audit = creerRapportAuditAtelier({ configuration: creerConfigurationAtelier(),
    version: '1.30.0', commitBundle: '123abc', nombreHistoires: 1, dernierTour: res,
    date: new Date('2026-10-09T00:00:00Z') });
  const texte = JSON.stringify(audit);
  assert.equal(audit.format, 'elyndor-audit-technique');
  for (const secret of ['MESSAGE PERSONNEL PRIVÉ', 'RÉPONSE PRIVÉE',
    'Personnage secret', 'Lore secret introuvable', 'Nom du personnage secret']) {
    assert.equal(texte.includes(secret), false, secret);
  }
});
