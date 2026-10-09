import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getSettings, saveSettings } from '../storage/storage';
import { viderCacheEmbeddings } from '../storage/embeddingsStore';
import { couleurs, espacement, polices, stylePetitesCapitales } from '../theme/theme';
import Bouton from '../components/Bouton';
import FondAtmospherique from '../components/FondAtmospherique';
import Panneau from '../components/Panneau';
import StorageExplorer from '../components/StorageExplorer';
import AtelierConfigurationPanel from '../components/AtelierConfigurationPanel';
import AtelierDiagnosticPanel from '../components/AtelierDiagnosticPanel';
import AtelierRunpodPanel from '../components/AtelierRunpodPanel';
import LorebookPanel from '../components/LorebookPanel';
import { RESPONSABILITES_NARRATIVES } from '../engine/narrativeBehaviorKernel';
import { VERSION_APP } from '../version';
import { useAutomationDiagnostics } from '../automation/useAutomationDiagnostics';
import { retryFailedAutomationJobs } from '../automation/kernel';

type Props = NativeStackScreenProps<RootStackParamList, 'ReglagesConcepteur' | 'ModuleConcepteur'>;

const IMAGE_CONCEPTEUR = require('../../assets/scenes/accueil.png');
type ModuleAtelier = 'tableau' | 'modeles' | 'runpod' | 'narration' | 'metamoteurs' |
  'recherche' | 'lorebook' | 'visuel' | 'stockage' | 'diagnostics' | 'maintenance' |
  'commercial' | 'profils' | 'instantanes';
const MODULES: ReadonlyArray<{ id: ModuleAtelier; titre: string; detail: string; pret: boolean }> = [
  { id: 'tableau', titre: 'Tableau de bord', detail: "État du noyau, services et version", pret: true },
  { id: 'modeles', titre: 'Modèles IA', detail: 'Correction de température, fournisseur', pret: true },
  { id: 'runpod', titre: 'RunPod et Cloud', detail: 'Pod, connexion et migration sans GitHub', pret: true },
  { id: 'narration', titre: 'Narration', detail: 'Température et marge de réponse', pret: true },
  { id: 'metamoteurs', titre: '15 méta-moteurs', detail: 'Responsabilités codées V2.1', pret: true },
  { id: 'recherche', titre: 'Recherche et mémoire', detail: 'Budget lore et nombre de souvenirs', pret: true },
  { id: 'lorebook', titre: 'Lorebook', detail: 'Bibliothèque, édition, IA et publication', pret: true },
  { id: 'visuel', titre: 'Atelier visuel', detail: 'Préréglages images à développer', pret: false },
  { id: 'stockage', titre: 'Stockage', detail: 'Explorateur, export et nettoyage', pret: true },
  { id: 'diagnostics', titre: 'Diagnostics', detail: 'Cache, traces et erreurs', pret: true },
  { id: 'maintenance', titre: 'Maintenance', detail: 'Versions et mises à jour avancées', pret: false },
  { id: 'commercial', titre: 'Administration commerciale', detail: 'Gestion des abonnements, plus tard', pret: false },
  { id: 'profils', titre: 'Profils de configuration', detail: 'Production, Test, Benchmark', pret: true },
  { id: 'instantanes', titre: 'Instantanés et historique', detail: 'Exporter, importer, restaurer', pret: true },
];
const COMMIT_BUNDLE = process.env.EXPO_PUBLIC_GIT_SHA || 'non renseigné';

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

export default function DesignerSettingsScreen({ navigation, route }: Props) {
  const estModule = route.name === 'ModuleConcepteur';
  const section: ModuleAtelier = estModule ? (route.params as RootStackParamList['ModuleConcepteur']).section : 'tableau';
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
      setMessageCache('Cache des embeddings vidé. Les prochains vecteurs seront recalculés si nécessaire.');
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
            <Text style={styles.titre}>{estModule ? MODULES.find(m => m.id === section)?.titre : 'Réglages concepteur'}</Text>
            <Text style={styles.aide}>
              {estModule ? 'Module indépendant : retour au centre de contrôle avec la flèche Android.' :
                'Outils de test et de diagnostic destinés à la construction d’Elyndor. Ces options n’appartiennent pas au parcours normal du joueur.'}
            </Text>
          </View>

          {!estModule ? <Panneau style={[styles.bloc, modeConcepteur && styles.blocActif]}>
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
          </Panneau> : null}


          {modeConcepteur && !estModule ? (
            <Panneau style={styles.bloc}>
              <Text style={styles.label}>CENTRE DE CONTRÔLE</Text>
              <Text style={styles.titreBloc}>Modules de l'atelier</Text>
              <Text style={styles.texteBloc}>Choisis un module. Les outils effectifs et les modules prévus sont distincts.</Text>
              <View style={styles.menuModules}>
                {MODULES.map((module) => (
                  <Pressable key={module.id} onPress={() => navigation.navigate('ModuleConcepteur', { section: module.id })}
                    accessibilityRole="button" accessibilityLabel={'Ouvrir ' + module.titre}
                    style={[styles.moduleCarte, section === module.id && styles.moduleActif]}>
                    <Text style={styles.moduleTitre}>{module.titre}</Text>
                    <Text style={styles.moduleDetail}>{module.detail}</Text>
                    <Text style={[styles.moduleStatut, !module.pret && styles.moduleNonPret]}>
                      {module.pret ? 'FONCTION PRÉSENTE' : 'À DÉVELOPPER'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Panneau>
          ) : null}

          {modeConcepteur && estModule && (section === 'profils' || section === 'modeles' ||
            section === 'narration' || section === 'recherche' || section === 'instantanes') ? (
            <Panneau style={styles.bloc}>
              <Text style={styles.label}>CONFIGURATION VERSIONNÉE</Text>
              <Text style={styles.titreBloc}>{MODULES.find((m) => m.id === section)?.titre}</Text>
              <AtelierConfigurationPanel section={section} />
              {section === 'instantanes' ? <AtelierDiagnosticPanel mode="instantanes" /> : null}
            </Panneau>
          ) : null}

          {modeConcepteur && estModule && section === 'runpod' ? (
            <Panneau style={styles.bloc}>
              <Text style={styles.label}>CONFIGURATION RUNPOD</Text>
              <Text style={styles.titreBloc}>Pod Elyndor Cloud</Text>
              <AtelierRunpodPanel />
            </Panneau>
          ) : null}

          {modeConcepteur && estModule && section === 'metamoteurs' ? (
            <Panneau style={styles.bloc}>
              <Text style={styles.label}>NOYAU NARRATIF V2.1</Text>
              <Text style={styles.titreBloc}>15 responsabilités codées</Text>
              <Text style={styles.texteBloc}>
                Chaque responsabilité est sélectionnée selon la scène par narrativeBehaviorKernel.ts,
                puis ajoutée au contrat narratif. Leur déclenchement effectif est consigné dans le
                diagnostic du tour ; cela ne signifie pas que 15 sous-moteurs autonomes existent déjà.
              </Text>
              {RESPONSABILITES_NARRATIVES.map((m) => (
                <View key={m.id} style={styles.ligneEtat}>
                  <Text style={styles.nomEtat}>{m.id} — {m.nom}</Text>
                  <Text style={styles.moduleStatut}>CONTRAT V2.1</Text>
                </View>
              ))}
              <AtelierDiagnosticPanel mode="metamoteurs" />
              <Text style={styles.texteBloc}>Le diagnostic montre les responsabilités mobilisées, pas 15 sous-moteurs indépendants. Le réglage interne de chaque moteur reste à développer.</Text>
            </Panneau>
          ) : null}

          {modeConcepteur && estModule && section === 'lorebook' ? (
            <Panneau style={styles.bloc}>
              <Text style={styles.label}>BIBLIOTHÈQUE CANONIQUE</Text>
              <LorebookPanel />
            </Panneau>
          ) : null}

          {modeConcepteur && estModule && MODULES.some((m) => m.id === section && !m.pret) ? (
            <Panneau style={styles.bloc}>
              <Text style={styles.label}>FONCTION EN PRÉPARATION</Text>
              <Text style={styles.titreBloc}>{MODULES.find((m) => m.id === section)?.titre}</Text>
              <Text style={styles.texteBloc}>
                Ce module est prévu dans le cahier des charges mais n'est pas encore relié
                au système de production. Aucun bouton fictif n'est proposé.
                Les secrets RunPod et Elyndor Cloud resteront gérés côté serveur.
              </Text>
            </Panneau>
          ) : null}

          {modeConcepteur && estModule && section === 'tableau' ? (
          <Panneau style={styles.bloc}>
            <Text style={styles.label}>AUTOMATISMES</Text>
            <Text style={styles.texteBloc}>Version application : {VERSION_APP} · commit du bundle JS : {COMMIT_BUNDLE.slice(0, 12)}</Text>
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
                <EtatLigne label="Fournisseur" ok={caps.narration} detail="Elyndor Cloud" />
              </View>
            ) : (
              <Text style={styles.statut}>Capacités en cours d’initialisation…</Text>
            )}

            {automation.failedJobs > 0 ? (
              <Bouton titre="Relancer les routines en erreur" variante="secondaire" onPress={relancerJobs} style={styles.boutonAction} />
            ) : null}
            {messageJobs ? <Text style={styles.statut}>{messageJobs}</Text> : null}
          </Panneau>
          ) : null}

          {modeConcepteur && estModule && section === 'stockage' ? (
            <Panneau style={styles.bloc}>
              <Text style={styles.label}>DIAGNOSTIC STOCKAGE</Text>
              <Text style={styles.titreBloc}>Fichiers et espace disque</Text>
              <StorageExplorer />
            </Panneau>
          ) : null}

          {modeConcepteur && estModule && section === 'diagnostics' ? (
          <Panneau style={styles.bloc}>
            <Text style={styles.label}>MAINTENANCE SÉMANTIQUE</Text>
            <Text style={styles.titreBloc}>Cache de recherche vectorielle</Text>
            <Text style={styles.texteBloc}>
              Efface les embeddings mis en cache dans AsyncStorage. Ils pourront être recalculés lors
              des prochaines recherches avec Elyndor Cloud. Cette action ne vide pas la base ObjectBox.
            </Text>
            <Bouton
              titre="Vider le cache des embeddings"
              variante="secondaire"
              onPress={() => Alert.alert(
                'Vider le cache des embeddings ?',
                'Le cache local sera effacé et pourra être recalculé lors de la prochaine recherche. Les histoires ne seront pas supprimées.',
                [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Vider le cache', style: 'destructive', onPress: () => { void viderCache(); } },
                ],
              )}
              style={styles.boutonAction}
            />
            {messageCache ? <Text style={styles.statut}>{messageCache}</Text> : null}
            <AtelierDiagnosticPanel mode="diagnostics" />
          </Panneau>
          ) : null}

          <Panneau style={styles.note}>
            <Text style={styles.noteTitre}>Accès temporairement direct</Text>
            <Text style={styles.texteBloc}>
              Pendant la phase de test, cet écran reste accessible sans code. Un verrouillage pourra être ajouté
              plus tard sans modifier les fonctions de diagnostic elles-mêmes.
            </Text>
          </Panneau>

          <Bouton
            titre={estModule ? 'Retour aux modules' : 'Retour aux réglages'}
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
    paddingBottom: espacement.xxl,
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
  menuModules: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: espacement.md },
  moduleCarte: { borderWidth: 1, borderRadius: 12, borderColor: couleurs.bordureSubtile,
    backgroundColor: couleurs.fondCarteDense, padding: 10, minWidth: 135, flexBasis: '46%', flexGrow: 1,
    minHeight: 88, justifyContent: 'center' },
  moduleActif: { borderColor: couleurs.dore, backgroundColor: couleurs.fondCarte },
  moduleTitre: { color: couleurs.texte, fontFamily: polices.corpsMedium, fontSize: 16 },
  moduleDetail: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 12 },
  moduleStatut: { color: couleurs.succes, fontFamily: polices.corpsMedium, fontSize: 10, marginTop: 6 },
  moduleNonPret: { color: couleurs.texteFaible },
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
