import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getSettings, saveSettings } from '../storage/storage';
import { viderCacheEmbeddings } from '../storage/embeddingsStore';
import { couleurs, espacement, polices, stylePetitesCapitales } from '../theme/theme';
import Bouton from '../components/Bouton';
import FondAtmospherique from '../components/FondAtmospherique';
import Panneau from '../components/Panneau';
import { useAutomationDiagnostics } from '../automation/useAutomationDiagnostics';
import { retryFailedAutomationJobs } from '../automation/kernel';

type Props = NativeStackScreenProps<RootStackParamList, 'ReglagesConcepteur'>;

const IMAGE_CONCEPTEUR = require('../../assets/scenes/accueil.png');

function EtatLigne({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <View style={styles.ligneEtat}>
      <Text style={styles.nomEtat}>{label}</Text>
      <View style={styles.etatTexteBloc}>
        <Text style={[styles.valeurEtat, ok ? styles.valeurEtatOk : styles.valeurEtatKo]}>{ok ? 'PRÊT' : 'INDISPONIBLE'}</Text>
        {detail ? <Text style={styles.detailEtat}>{detail}</Text> : null}
      </View>
    </View>
  );
}

export default function DesignerSettingsScreen({ navigation }: Props) {
  const [modeConcepteur, setModeConcepteur] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState('');
  const [messageCache, setMessageCache] = useState('');
  const [messageJobs, setMessageJobs] = useState('');
  const [messageMode, setMessageMode] = useState('');
  const automation = useAutomationDiagnostics();

  function charger() {
    setChargement(true);
    setErreurChargement('');
    getSettings().then((settings) => {
      setModeConcepteur(!!settings.modeConcepteur);
    }).catch((e) => {
      setErreurChargement(e instanceof Error ? e.message : 'Impossible de lire les réglages concepteur.');
    }).finally(() => setChargement(false));
  }

  useEffect(charger, []);

  async function basculerModeConcepteur() {
    const nouvelleValeur = !modeConcepteur;
    setMessageMode('');
    try {
      const settingsActuelles = await getSettings();
      await saveSettings({ ...settingsActuelles, modeConcepteur: nouvelleValeur });
      setModeConcepteur(nouvelleValeur);
      setMessageMode(nouvelleValeur ? 'Mode concepteur activé.' : 'Mode concepteur désactivé.');
    } catch (e) {
      setMessageMode(e instanceof Error ? e.message : 'Impossible d’enregistrer le mode concepteur.');
    }
    setTimeout(() => setMessageMode(''), 4000);
  }

  async function viderCache() {
    setMessageCache('');
    try {
      await viderCacheEmbeddings();
      setMessageCache('Cache d’embeddings vidé — recalcul complet au prochain tour.');
    } catch (e) {
      setMessageCache(e instanceof Error ? e.message : 'Impossible de vider le cache d’embeddings.');
    }
    setTimeout(() => setMessageCache(''), 4000);
  }

  async function relancerJobs() {
    setMessageJobs('');
    try {
      const nombre = await retryFailedAutomationJobs();
      setMessageJobs(nombre > 0 ? `${nombre} routine(s) remise(s) en attente.` : 'Aucune routine en erreur à relancer.');
    } catch (e) {
      setMessageJobs(e instanceof Error ? e.message : 'Impossible de relancer les routines en erreur.');
    }
    setTimeout(() => setMessageJobs(''), 4000);
  }

  if (chargement) {
    return (
      <View style={styles.chargement}>
        <ActivityIndicator color={couleurs.accent} />
      </View>
    );
  }

  if (erreurChargement) {
    return (
      <View style={styles.chargement}>
        <Text style={styles.erreur}>{erreurChargement}</Text>
        <Bouton titre="Réessayer" onPress={charger} style={styles.boutonAction} />
        <Bouton titre="Retour" variante="secondaire" onPress={() => navigation.goBack()} style={styles.boutonAction} />
      </View>
    );
  }

  const caps = automation.capabilities;

  return (
    <FondAtmospherique style={{ flex: 1 }} densiteEtoiles="discrete" imageFond={IMAGE_CONCEPTEUR}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.largeur}>
          <View style={styles.entete}>
            <Text style={styles.surtitre}>ATELIER INTERNE</Text>
            <Text style={styles.titre}>Réglages concepteur</Text>
            <Text style={styles.aide}>
              Outils de test et de diagnostic destinés à la construction d’Elyndor. Ces options n’appartiennent
              pas au parcours normal du joueur.
            </Text>
          </View>

          <Panneau style={[styles.bloc, modeConcepteur && styles.blocActif]}>
            <View style={styles.enteteBloc}>
              <View style={styles.enteteBlocTexte}>
                <Text style={styles.label}>MODE CONCEPTEUR</Text>
                <Text style={styles.titreBloc}>{modeConcepteur ? 'Actif' : 'Inactif'}</Text>
              </View>
              <Text style={[styles.etat, modeConcepteur && styles.etatActif]}>
                {modeConcepteur ? 'DIAGNOSTIC OUVERT' : 'PARCOURS JOUEUR'}
              </Text>
            </View>
            <Text style={styles.texteBloc}>
              Quand il est actif, une histoire ouverte donne accès à l’état brut du moteur : mémoire, directeur
              narratif, monde, relations, prompt système, mise à jour forcée des pipelines et paramètres de modèle
              propres à l’histoire.
            </Text>
            <Bouton
              titre={modeConcepteur ? 'Désactiver le mode concepteur' : 'Activer le mode concepteur'}
              variante={modeConcepteur ? 'principal' : 'secondaire'}
              onPress={basculerModeConcepteur}
              style={styles.boutonAction}
            />
            {messageMode ? <Text style={styles.statut}>{messageMode}</Text> : null}
          </Panneau>

          <Panneau style={styles.bloc}>
            <Text style={styles.label}>AUTOMATISMES</Text>
            <Text style={styles.titreBloc}>État du noyau</Text>
            <Text style={styles.texteBloc}>
              Une source unique de réglages alimente maintenant les capacités et la file persistante de routines.
              Les tâches interrompues sont restaurées au prochain démarrage au lieu d’être perdues silencieusement.
            </Text>

            <View style={styles.resumeJobs}>
              <Text style={styles.compteurJobs}>En attente {automation.pendingJobs}</Text>
              <Text style={styles.compteurJobs}>En cours {automation.runningJobs}</Text>
              <Text style={[styles.compteurJobs, automation.failedJobs > 0 && styles.compteurErreur]}>Erreurs {automation.failedJobs}</Text>
              <Text style={styles.compteurJobs}>Terminées {automation.completedJobs}</Text>
            </View>
            {automation.recoveredJobs > 0 ? (
              <Text style={styles.statut}>{automation.recoveredJobs} routine(s) interrompue(s) restaurée(s) au démarrage.</Text>
            ) : null}
            {automation.lastKernelError ? <Text style={styles.erreur}>{automation.lastKernelError}</Text> : null}

            {caps ? (
              <View style={styles.capacites}>
                <EtatLigne label="Narration" ok={caps.narration} detail={caps.raisons.narration} />
                <EtatLigne label="Embeddings" ok={caps.embeddings} detail={caps.raisons.embeddings} />
                <EtatLigne label="Images & portraits" ok={caps.images} detail={caps.raisons.images} />
                <EtatLigne label="Traduction" ok={caps.traduction} detail={caps.raisons.traduction} />
                {caps.fournisseur === 'local' ? (
                  <EtatLigne label="Modèle local" ok={caps.inferenceLocale} detail={caps.raisons.inferenceLocale} />
                ) : null}
              </View>
            ) : (
              <Text style={styles.statut}>Capacités en cours d’initialisation…</Text>
            )}

            {automation.failedJobs > 0 ? (
              <Bouton titre="Relancer les routines en erreur" variante="secondaire" onPress={relancerJobs} style={styles.boutonAction} />
            ) : null}
            {messageJobs ? <Text style={styles.statut}>{messageJobs}</Text> : null}
          </Panneau>

          <Panneau style={styles.bloc}>
            <Text style={styles.label}>MAINTENANCE SÉMANTIQUE</Text>
            <Text style={styles.titreBloc}>Cache d’embeddings</Text>
            <Text style={styles.texteBloc}>
              Efface les vecteurs de lore calculés localement. À utiliser après une modification importante du
              contenu lorsque vous voulez forcer une reconstruction complète de la sélection sémantique.
            </Text>
            <Bouton
              titre="Vider le cache d’embeddings"
              variante="secondaire"
              onPress={viderCache}
              style={styles.boutonAction}
            />
            {messageCache ? <Text style={styles.statut}>{messageCache}</Text> : null}
          </Panneau>

          <Panneau style={styles.note}>
            <Text style={styles.noteTitre}>Accès temporairement direct</Text>
            <Text style={styles.texteBloc}>
              Pendant la phase de test, cet écran reste accessible sans code. Un verrouillage pourra être ajouté
              plus tard sans modifier les fonctions de diagnostic elles-mêmes.
            </Text>
          </Panneau>

          <Bouton
            titre="Retour aux réglages"
            variante="secondaire"
            onPress={() => navigation.goBack()}
            style={styles.retour}
          />
        </View>
      </ScrollView>
    </FondAtmospherique>
  );
}

const styles = StyleSheet.create({
  chargement: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.fond,
    padding: espacement.lg,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: espacement.lg,
    paddingTop: espacement.lg,
    paddingBottom: 120,
  },
  largeur: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
  },
  entete: {
    marginBottom: espacement.lg,
  },
  surtitre: {
    ...stylePetitesCapitales,
    color: couleurs.dore,
    fontSize: 10,
    letterSpacing: 2.2,
    marginBottom: 4,
  },
  titre: {
    color: couleurs.texte,
    fontFamily: polices.display,
    fontSize: 30,
    letterSpacing: 1.1,
  },
  aide: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 15,
    lineHeight: 21,
    marginTop: espacement.xs,
  },
  bloc: {
    marginBottom: espacement.md,
    padding: espacement.lg,
    backgroundColor: couleurs.fondCarteDense,
  },
  blocActif: {
    borderColor: couleurs.bordureDoree,
  },
  enteteBloc: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: espacement.md,
    marginBottom: espacement.sm,
  },
  enteteBlocTexte: {
    flex: 1,
  },
  label: {
    ...stylePetitesCapitales,
    color: couleurs.dore,
    fontSize: 10,
    letterSpacing: 1.8,
    marginBottom: 3,
  },
  titreBloc: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 21,
  },
  texteBloc: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 15,
    lineHeight: 21,
  },
  etat: {
    ...stylePetitesCapitales,
    color: couleurs.texteFaible,
    borderWidth: 1,
    borderColor: couleurs.bordureSubtile,
    paddingHorizontal: espacement.sm,
    paddingVertical: 5,
    fontSize: 9,
  },
  etatActif: {
    color: couleurs.doreClair,
    borderColor: couleurs.bordureDoree,
  },
  boutonAction: {
    marginTop: espacement.md,
  },
  statut: {
    color: couleurs.accentClair,
    fontFamily: polices.corpsMedium,
    fontSize: 14,
    marginTop: espacement.sm,
  },
  erreur: {
    color: couleurs.danger,
    fontFamily: polices.corpsMedium,
    fontSize: 14,
    marginTop: espacement.sm,
    textAlign: 'center',
  },
  resumeJobs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacement.sm,
    marginTop: espacement.md,
  },
  compteurJobs: {
    ...stylePetitesCapitales,
    color: couleurs.texteAtténué,
    borderWidth: 1,
    borderColor: couleurs.bordureSubtile,
    paddingHorizontal: espacement.sm,
    paddingVertical: 5,
    fontSize: 9,
  },
  compteurErreur: {
    color: couleurs.danger,
    borderColor: couleurs.danger,
  },
  capacites: {
    marginTop: espacement.md,
    borderTopWidth: 1,
    borderTopColor: couleurs.bordureSubtile,
  },
  ligneEtat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: espacement.md,
    paddingVertical: espacement.sm,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bordureSubtile,
  },
  nomEtat: {
    color: couleurs.texte,
    fontFamily: polices.corpsMedium,
    fontSize: 14,
    flex: 1,
  },
  etatTexteBloc: {
    flex: 1.5,
    alignItems: 'flex-end',
  },
  valeurEtat: {
    ...stylePetitesCapitales,
    fontSize: 9,
  },
  valeurEtatOk: {
    color: couleurs.succes,
  },
  valeurEtatKo: {
    color: couleurs.danger,
  },
  detailEtat: {
    color: couleurs.texteFaible,
    fontFamily: polices.corps,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 2,
  },
  note: {
    marginBottom: espacement.md,
    padding: espacement.md,
    borderColor: couleurs.bordureSubtile,
    backgroundColor: 'rgba(4, 10, 18, 0.58)',
  },
  noteTitre: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 17,
    marginBottom: espacement.xs,
  },
  retour: {
    marginTop: espacement.sm,
  },
});
