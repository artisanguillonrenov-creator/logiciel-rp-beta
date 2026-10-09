import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getStoriesIndex, getStory } from '../storage/storage';
import { lireConfigurationAtelier } from '../concepteur/depotConfiguration';
import { resumerDiagnosticAtelier, type ResumeDiagnosticAtelier } from '../concepteur/auditAtelier';
import { couleurs, polices } from '../theme/theme';
import AtelierConfigurationPanel from './AtelierConfigurationPanel';
import { analyserSeriesContexte } from '../concepteur/statistiquesContexte';
import type { ConfigurationAtelier } from '../concepteur/configuration';
import type { DiagnosticTour, StoryState } from '../types';

const NOMBRE_VIDE = 'Non mesuré';

function sommeDurations(d: DiagnosticTour | undefined) {
  return {
    ia: (d?.appelsIA ?? []).reduce((n, a) => n + a.dureeMs, 0),
    embeddings: (d?.embeddings ?? []).reduce((n, a) => n + a.dureeMs, 0),
  };
}
function Ligne({ titre, valeur, detail }: { titre: string; valeur: string | number; detail?: string }) {
  return <View style={styles.ligne}>
    <Text style={styles.libelle}>{titre}</Text>
    <Text style={styles.valeur}>{valeur}</Text>
    {detail ? <Text style={styles.aide}>{detail}</Text> : null}
  </View>;
}

/** Lecture de traces sauvegardées uniquement : aucun appel au pod RunPod. */
export default function AtelierContexteMemoirePanel() {
  const [lecture, setLecture] = useState(false);
  const [erreur, setErreur] = useState('');
  const [charge, setCharge] = useState(false);
  const [story, setStory] = useState<StoryState | null>(null);
  const [config, setConfig] = useState<ConfigurationAtelier | null>(null);
  const [resume, setResume] = useState<ResumeDiagnosticAtelier | null>(null);

  async function examiner() {
    setLecture(true); setErreur('');
    try {
      const [index, configuration] = await Promise.all([getStoriesIndex(), lireConfigurationAtelier()]);
      const recente = [...index].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      const histoire = recente ? await getStory(recente.id) : null;
      setStory(histoire); setConfig(configuration);
      setResume(resumerDiagnosticAtelier(histoire));
      setCharge(true);
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)); }
    finally { setLecture(false); }
  }

  const last = story?.messages.slice().reverse().find(m => m.role === 'assistant' && m.diagnosticTour);
  const d = last?.diagnosticTour;
  const temps = sommeDurations(d);
  const longueurs = d?.etapes.find(e => e.nom === 'Contrôle final des longueurs');
  const texteMesure = longueurs?.raison ?? NOMBRE_VIDE;
  const params = config?.profils.production;
  const noyau = story?.narrativeCore;
  const serie = analyserSeriesContexte(story);
  const journal = (d?.etapes ?? []).filter(e => /recherche|contexte|mémoire|tokens|longueur|narratif/i.test(
    e.categorie + ' ' + e.nom));
  const statutUsage = d?.appelsIA.every(a => a.usageComplet) ? 'Données reçues sur chaque appel' :
    'Mesures partielles : certains appels ne donnent pas leur usage';

  return <View>
    <Text style={styles.titre}>Contexte et mémoire</Text>
    <Text style={styles.aide}>Panneau réservé au concepteur. Les mesures ci-dessous viennent des appels et diagnostics réellement enregistrés sur cet appareil. Aucune consultation n’allume le pod.</Text>
    <Pressable accessibilityRole="button" disabled={lecture}
      onPress={() => { void examiner(); }} style={styles.bouton}>
      <Text style={styles.libelle}>Analyser la dernière histoire enregistrée</Text>
    </Pressable>
    {lecture ? <ActivityIndicator color={couleurs.accent}/> : null}
    {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
    {charge && !story ? <Text style={styles.aide}>Aucune histoire enregistrée.</Text> : null}
    {charge && story && <>
      <Text style={styles.sousTitre}>Contexte et mémoire conservés</Text>
      <Ligne titre="Historique sauvegardé" valeur={story.messages.length + ' messages'}
        detail="La quantité réellement transmise dépend du budget d'entrée et de la sélection des messages récents."/>
      <Ligne titre="Résumé persistant" valeur={(story.memoire.resume ?? '').length + ' caractères'}/>
      <Ligne titre="Faits en mémoire" valeur={story.memoire.faits.length}/>
      <Ligne titre="Lore émergent" valeur={story.loreEmergent.length + ' entrées'}/>
      <Ligne titre="Événements au journal du noyau" valeur={noyau?.ledger?.length ?? NOMBRE_VIDE}/>
      <Ligne titre="Engagements / fils encore ouverts"
        valeur={noyau?.debts?.filter(x => x.status === 'open').length ?? NOMBRE_VIDE}
        detail="Nombre sauvegardé, pas une décision de suppression automatique."/>
      {resume?.disponible && d ? <>
        <Text style={styles.sousTitre}>Budget d'entrée et recherche</Text>
        <Text style={styles.aide}>Les budgets du prompt sont des caractères. Les tokens exacts ne peuvent être affirmés qu'avec un tokenizer réel ; les données d'usage viennent des réponses serveur.</Text>
        {journal.map((e, i) => <View key={i} style={styles.ligne}>
          <Text style={styles.libelle}>{e.nom} — {e.statut}</Text>
          <Text style={styles.aide}>Durée : {e.dureeMs ?? NOMBRE_VIDE} ms</Text>
          {e.raison ? <Text style={styles.aide}>Cause : {e.raison}</Text> : null}
          {(e.details ?? []).map((detail, j) => <Text key={j} style={styles.aide}>• {detail}</Text>)}
        </View>)}
        <Text style={styles.sousTitre}>Consommation et temps du tour</Text>
        <Ligne titre="Appels au narrateur et aux vérificateurs" valeur={d.appelsIA.length}/>
        <Ligne titre="Tokens d'entrée déclarés" valeur={resume.tokensEntree}
          detail="Somme des usages API déclarés ; peut être partielle."/>
        <Ligne titre="Tokens de sortie déclarés" valeur={resume.tokensSortie}
          detail="Tous les appels additionnés : ce n'est pas le nombre de tokens visibles de la réponse."/>
        <Ligne titre="Total d'usage déclaré" valeur={resume.tokensTotal}/>
        <Ligne titre="Fiabilité d'usage" valeur={statutUsage}/>
        <Ligne titre="Dernier contrôle de texte visible" valeur={texteMesure}
          detail={longueurs?.statut === 'ok' ? 'Contrôle validé dans le code ; tokenizer réel à vérifier sur pod.' : 'Fourchette non garantie.'}/>
        <Ligne titre="Temps total du tour" valeur={d.dureeTotaleMs + ' ms'}/>
        <Ligne titre="Temps cumulé des appels IA" valeur={temps.ia + ' ms'}/>
        <Ligne titre="Temps cumulé embeddings" valeur={temps.embeddings + ' ms'}
          detail="Ces durées peuvent se chevaucher avec d'autres étapes parallèles."/>
        {d.appelsIA.map((a,i) => <Ligne key={i} titre={a.composant}
          valeur={a.dureeMs + ' ms'}
          detail={a.inputTokens + ' tokens entrée / ' + a.outputTokens + ' sortie ; ' +
            (a.usageComplet ? 'usage fourni' : 'usage indisponible ou partiel')}/>)}
        <Text style={styles.aide}>Coût monétaire RunPod : non mesuré. L'hébergement peut être facturé même hors génération ; aucun tarif n'est déduit arbitrairement des tokens.</Text>
        <Text style={styles.sousTitre}>Fiabilité sur les tours enregistrés</Text>
        <Ligne titre="Échantillon réel" valeur={serie.echantillon + ' tours'}
          detail="Au plus les 120 derniers tours avec un diagnostic persistant ; aucune scène synthétique comptée."/>
        <Ligne titre="Latence P50" valeur={serie.p50Ms === null ? NOMBRE_VIDE : serie.p50Ms + ' ms'}/>
        <Ligne titre="Latence P95" valeur={serie.p95Ms === null ? NOMBRE_VIDE : serie.p95Ms + ' ms'}/>
        <Ligne titre="Tours avec comptage exact enregistré" valeur={serie.toursAvecComptageExact}/>
        <Ligne titre="Tours non certifiés ou non mesurés" valeur={serie.toursNonVerifies}/>
        <Ligne titre="Tours avec au moins un repli" valeur={serie.toursAvecRepli}/>
        <Text style={styles.sousTitre}>Mobilisation des responsabilités M01–M15</Text>
        <Text style={styles.aide}>Ce sont des responsabilités du noyau codé, pas quinze agents autonomes.</Text>
        {resume.moteurs.map(m => <Ligne key={m.id} titre={m.id + ' — ' + m.nom}
          valeur={m.dernierTour === 'mobilise' ? 'Mobilisée' : m.dernierTour === 'non_mobilise' ? 'Non mobilisée' : 'Non mesurée'}
          detail={m.raison}/>)}
      </> : <Text style={styles.aide}>
        Aucun diagnostic de tour enregistré. Les budgets configurés ci-dessous existent,
        mais leur application à une ancienne histoire ne peut être reconstruite sans trace.
      </Text>}
    </>}
    <Text style={styles.sousTitre}>Réglages de sélection — profil versionné</Text>
    <Text style={styles.aide}>Source unique des réglages de recherche. Budget lore en caractères et nombre de souvenirs maximum ; ni pourcentage d'utilisation de contexte inventé, ni compteur de tokens fictif.</Text>
    <AtelierConfigurationPanel section="recherche"/>
    <Text style={styles.aide}>Pour partager un diagnostic technique anonymisé, utilise « Instantanés et historique ». Les textes privés des histoires ne sont jamais inclus automatiquement. Comparaison A/B sur le vrai modèle et mesure de latence P50/P95 demandent des tests de génération distincts.</Text>
    {params ? <Text style={styles.aide}>Réglages Production : {params.budgetLorePassages} caractères lore · {params.maxSouvenirs} souvenirs · marge état {params.margeTokensEtat} tokens (plafond de sortie, pas mémoire d'entrée).</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  titre: { color: couleurs.doreClair, fontFamily: polices.titre, fontSize: 22, marginBottom: 12 },
  sousTitre: { color: couleurs.doreClair, fontFamily: polices.titre, fontSize: 18, marginVertical: 12 },
  libelle: { color: couleurs.texte, fontFamily: polices.corpsMedium, fontSize: 14 },
  valeur: { color: couleurs.doreClair, fontSize: 14, marginTop: 3 },
  aide: { color: couleurs.texteAtténué, fontSize: 13, marginVertical: 4, lineHeight: 19 },
  ligne: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: couleurs.bordureSubtile },
  bouton: { padding: 14, borderRadius: 10, backgroundColor: couleurs.accentSombre, marginVertical: 10, alignItems: 'center' },
  erreur: { color: couleurs.danger, fontSize: 14, marginVertical: 7 },
});
