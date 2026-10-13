import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { TraceIllustration } from '../engine/moteurVisuel';
import { couleurs, polices } from '../theme/theme';

/** Diagnostic lisible d'une image : faits, style, références, requête effective, écarts. */
export default function TraceImage({ trace }: { trace: TraceIllustration }) {
  const r = trace.requete;
  const ligne = (titre: string, valeur: string | undefined | null) =>
    valeur ? <Text style={st.texte} selectable><Text style={st.cle}>{titre} : </Text>{valeur}</Text> : null;
  const liste = (titre: string, valeurs: readonly string[]) =>
    valeurs.length ? <View><Text style={st.cle}>{titre}</Text>{valeurs.map((v, i) => <Text key={i} style={st.texte} selectable>• {v}</Text>)}</View> : null;
  return <View style={st.bloc}>
    <Text style={st.titre}>{trace.statut === 'simulation' ? 'Requête préparée (rien n’a été envoyé)' : trace.statut === 'ok' ? 'Image générée' : 'Échec de la génération'}</Text>
    {ligne('Opération', `${trace.operation} · origine ${trace.origine}${trace.revision ? ` · révision ${trace.revision}` : ''}`)}
    {ligne('Réglages lus', `schéma ${trace.config.schema}, style « ${trace.config.style} »${trace.config.majLe ? `, modifiés le ${new Date(trace.config.majLe).toLocaleString()}` : ''}`)}
    {trace.extraction ? ligne('Relevé', `${trace.extraction.parModele ? 'par le narrateur' : 'local (repli)'}${trace.extraction.erreur ? ` — ${trace.extraction.erreur}` : ''}`) : null}
    {ligne('Générateur', `${trace.capacites.nom} (capacités ${trace.capacites.source})`)}
    {liste('Remarques du générateur', trace.capacites.remarques)}
    {ligne('Lieu', trace.contrat.lieu.join(', '))}
    {ligne('Personnages dessinés', trace.contrat.personnages.join(', ') || 'aucun')}
    {ligne('Hors cadre', trace.contrat.horsCadre.join(', '))}
    {ligne('Simplement mentionnés', trace.contrat.mentionnes.join(', '))}
    {ligne('Éléments obligatoires', trace.contrat.elementsObligatoires.join(', '))}
    {liste('Origine des faits', trace.contrat.provenance)}
    {liste('Corrections et rejets', trace.contrat.rejets)}
    {ligne('Style appliqué', trace.style.join(', '))}
    {ligne('Prompt transmis', r.prompt)}
    {ligne('Négatif transmis', r.negatif)}
    {ligne('Format', `${r.format}${r.size ? ` · ${r.size}` : ''}`)}
    {ligne('Paramètres', [r.steps !== undefined && `étapes ${r.steps}`, r.guidance !== undefined && `guidance ${r.guidance}`,
      r.seed !== undefined && `graine ${r.seed}`, r.poidsRace !== undefined && `poids race ${r.poidsRace}`,
      r.modules && `modules ${Object.entries(r.modules).map(([n, p]) => `${n} ${p}`).join(', ') || 'aucun'}`].filter(Boolean).join(' · '))}
    {liste('Références transmises', trace.references.retenues.map((x) => `${x.libelle} [${x.role}] (${x.id})`))}
    {liste('Références écartées', trace.references.ecartees.map((x) => `${x.libelle} — ${x.raison}`))}
    {liste('Paramètres non transmis', trace.ecartes.map((x) => `${x.parametre} — ${x.raison}`))}
    {liste('Avertissements', trace.avertissements)}
    {ligne('Durée', trace.dureeMs !== undefined ? `${(trace.dureeMs / 1000).toFixed(1)} s` : undefined)}
    {ligne('Destination', trace.destination)}
    {ligne('Erreur', trace.erreur)}
  </View>;
}

const st = StyleSheet.create({
  bloc: { gap: 4, borderWidth: 1, borderColor: couleurs.bordureSubtile, borderRadius: 8, padding: 10, marginTop: 8 },
  titre: { fontFamily: polices.corpsMedium, fontSize: 15, color: couleurs.doreClair },
  cle: { fontFamily: polices.corpsMedium, color: couleurs.doreClair, fontSize: 13 },
  texte: { fontFamily: polices.corps, color: couleurs.texte, fontSize: 13, lineHeight: 18 },
});
