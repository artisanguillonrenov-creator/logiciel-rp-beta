import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { couleurs, espacement, polices } from '../theme/theme';
import Bouton from './Bouton';
import {
  analyserStockage,
  formatTailleStockage,
  listerDossierStockage,
  evaluerNettoyageDiagnostics,
  nettoyerDiagnostics,
  supprimerFichierStockage,
  enregistrerImageDansGalerie,
  type BilanStockage,
  type EntreeStockage,
  type ListeStockage,
} from '../storage/storageInspector';

function BarreEspace({ part, total }: { part: number; total: number }) {
  const pourcentage = total > 0 ? Math.min(100, Math.max(0, (part / total) * 100)) : 0;
  return (
    <View style={styles.fondBarre}>
      <View style={[styles.barre, { width: (pourcentage.toFixed(1) + '%') as `${number}%` }]} />
    </View>
  );
}

function LigneMesure({ nom, valeur }: { nom: string; valeur: string }) {
  return (
    <View style={styles.ligneMesure}>
      <Text style={styles.texteSecondaire}>{nom}</Text>
      <Text style={styles.valeur}>{valeur}</Text>
    </View>
  );
}

/** Explorateur en lecture seule des fichiers privés de l'application. */
export default function StorageExplorer() {
  const [bilan, setBilan] = useState<BilanStockage | null>(null);
  const [liste, setListe] = useState<ListeStockage | null>(null);
  const [chemin, setChemin] = useState('');
  const [selection, setSelection] = useState<EntreeStockage | null>(null);
  const [chargement, setChargement] = useState(false);
  const [suiteEnCours, setSuiteEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [messageAction, setMessageAction] = useState('');
  const [operationEnCours, setOperationEnCours] = useState(false);
  const demandeCourante = useRef(0);

  async function actualiser() {
    const demande = ++demandeCourante.current;
    setChargement(true);
    setErreur('');
    setSelection(null);
    try {
      const rapport = await analyserStockage();
      const contenu = await listerDossierStockage(chemin);
      if (demande !== demandeCourante.current) return;
      setBilan(rapport);
      setListe(contenu);
    } catch (cause) {
      if (demande === demandeCourante.current) {
        setErreur(cause instanceof Error ? cause.message : 'Impossible de mesurer le stockage.');
      }
    } finally {
      if (demande === demandeCourante.current) setChargement(false);
    }
  }

  async function ouvrirDossier(nouveauChemin: string) {
    const demande = ++demandeCourante.current;
    setChargement(true);
    setErreur('');
    setSelection(null);
    try {
      const contenu = await listerDossierStockage(nouveauChemin);
      if (demande !== demandeCourante.current) return;
      setListe(contenu);
      setChemin(nouveauChemin);
    } catch (cause) {
      if (demande === demandeCourante.current) {
        setErreur(cause instanceof Error ? cause.message : 'Impossible de lire ce dossier.');
      }
    } finally {
      if (demande === demandeCourante.current) setChargement(false);
    }
  }

  async function afficherSuite() {
    if (!liste || liste.nextOffset === null || suiteEnCours) return;
    const dossier = liste.path;
    const position = liste.nextOffset;
    const demande = demandeCourante.current;
    setSuiteEnCours(true);
    setErreur('');
    try {
      const suite = await listerDossierStockage(dossier, position);
      if (demande !== demandeCourante.current) return;
      setListe((actuelle) => actuelle && actuelle.path === dossier
        ? { ...suite, entries: [...actuelle.entries, ...suite.entries] }
        : actuelle);
    } catch (cause) {
      if (demande === demandeCourante.current) {
        setErreur(cause instanceof Error ? cause.message : 'Impossible de charger la suite.');
      }
    } finally {
      if (demande === demandeCourante.current) setSuiteEnCours(false);
    }
  }

  async function effectuerSuppression(cible: EntreeStockage) {
    setOperationEnCours(true);
    setErreur('');
    setMessageAction('');
    try {
      const resultat = await supprimerFichierStockage(cible.path);
      setMessageAction("Fichier supprimé : " + formatTailleStockage(resultat.freedBytes) + " libérés.");
      await actualiser();
      setMessageAction("Fichier supprimé : " + formatTailleStockage(resultat.freedBytes) + " libérés.");
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Suppression impossible.");
    } finally {
      setOperationEnCours(false);
    }
  }

  function demanderSuppression(cible: EntreeStockage) {
    Alert.alert(
      "Supprimer définitivement ce fichier ?",
      cible.name + "\n" + formatTailleStockage(cible.sizeBytes) +
        "\n\nL'opération est irréversible. Les fichiers de récit et les bases restent protégés.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: () => { void effectuerSuppression(cible); } },
      ],
    );
  }

  async function exporterImage(cible: EntreeStockage) {
    setOperationEnCours(true);
    setErreur('');
    setMessageAction('');
    try {
      const resultat = await enregistrerImageDansGalerie(cible.path);
      setMessageAction("Image enregistrée dans " + resultat.destination + " (galerie de la tablette).");
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Export de l'image impossible.");
    } finally {
      setOperationEnCours(false);
    }
  }

  async function demanderNettoyage(joursMinimum: number) {
    setOperationEnCours(true);
    setErreur('');
    setMessageAction('');
    try {
      const apercu = await evaluerNettoyageDiagnostics(joursMinimum);
      if (apercu.count === 0) {
        setMessageAction("Aucun diagnostic à supprimer dans cette catégorie.");
        return;
      }
      Alert.alert(
        "Confirmer le nettoyage des diagnostics",
        String(apercu.count) + " fichier(s) · " + formatTailleStockage(apercu.sizeBytes) +
          "\n" + (joursMinimum === 0 ? "Tous les diagnostics seront supprimés." :
            "Uniquement les diagnostics de plus de " + joursMinimum + " jours seront supprimés.") +
          "\n\nLes conversations, les images et les bases de données sont conservées.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Nettoyer", style: "destructive", onPress: () => { void executerNettoyage(joursMinimum); } },
        ],
      );
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Impossible d'analyser les diagnostics.");
    } finally {
      setOperationEnCours(false);
    }
  }

  async function executerNettoyage(joursMinimum: number) {
    setOperationEnCours(true);
    setErreur('');
    setMessageAction('');
    try {
      const resultat = await nettoyerDiagnostics(joursMinimum);
      await actualiser();
      setMessageAction(resultat.deletedCount + " diagnostic(s) supprimé(s), " +
        formatTailleStockage(resultat.freedBytes) + " libérés." +
        (resultat.failedCount ? " " + resultat.failedCount + " échec(s)." : ""));
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Nettoyage impossible.");
    } finally {
      setOperationEnCours(false);
    }
  }

  const selectionEstImage = !!selection && /^interne\/files\/(scene-images|pnj-avatars)\/[^/]+\.png$/i.test(selection.path);
  const selectionEstDiagnostic = !!selection && /^interne\/files\/diagnostics\/[^/]+\.jsonl$/i.test(selection.path);
  const precedent = chemin.includes('/') ? chemin.slice(0, chemin.lastIndexOf('/')) : '';
  const espaceOccupe = bilan ? Math.max(0, bilan.totalBytes - bilan.availableBytes) : 0;
  const incomplet = !!(bilan?.incomplete || liste?.entries.some((entree) => entree.incomplete));

  return (
    <View>
      <Text style={styles.introduction}>
        Gestion du stockage privé d’Elyndor : consulter l’espace utilisé, enregistrer les images
        dans la galerie, supprimer les diagnostics et les images choisies. Les conversations et bases
        de données restent protégées.
      </Text>
      <Bouton
        titre={bilan ? 'Actualiser le diagnostic' : 'Analyser le stockage'}
        variante="secondaire"
        onPress={actualiser}
        desactive={chargement || suiteEnCours}
        style={styles.bouton}
      />
      {chargement ? <ActivityIndicator style={styles.attente} color={couleurs.accent} /> : null}
      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
      {messageAction ? <Text style={styles.confirmation}>{messageAction}</Text> : null}

      {bilan ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sousTitre}>Disque de la tablette</Text>
            <LigneMesure nom="Capacité totale" valeur={formatTailleStockage(bilan.totalBytes)} />
            <LigneMesure nom="Espace libre" valeur={formatTailleStockage(bilan.availableBytes)} />
            <LigneMesure nom="Utilisé par la tablette" valeur={formatTailleStockage(espaceOccupe)} />
            <BarreEspace part={espaceOccupe} total={bilan.totalBytes} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sousTitre}>Données internes d’Elyndor</Text>
            <Text style={styles.chiffre}>{formatTailleStockage(bilan.appBytes)}</Text>
            <LigneMesure nom="Fichiers" valeur={bilan.fileCount.toLocaleString('fr-FR')} />
            <LigneMesure nom="Dossiers" valeur={bilan.directoryCount.toLocaleString('fr-FR')} />
            {bilan.roots.map((racine) => (
              <Pressable
                key={racine.id}
                onPress={() => void ouvrirDossier(racine.path)}
                accessibilityRole="button"
                style={styles.ligneDossier}
              >
                <View style={styles.description}>
                  <Text style={styles.nomFichier}>▸ {racine.label}</Text>
                  <Text style={styles.texteSecondaire}>{racine.fileCount} fichiers · {racine.directoryCount} dossiers</Text>
                </View>
                <Text style={styles.valeur}>{formatTailleStockage(racine.sizeBytes)}</Text>
              </Pressable>
            ))}
            <Text style={styles.precision}>
              Taille des fichiers mesurés : elle peut différer des « Données » indiquées par Android,
              qui compte aussi certains espaces réservés. Aucun accès aux fichiers des autres applications.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sousTitre}>Nettoyage des diagnostics</Text>
            <Text style={styles.precision}>
              Journaux techniques uniquement. Le nettoyage ne supprime ni histoires,
              ni personnages, ni images. Un nouveau diagnostic peut être créé lors d'une prochaine utilisation.
            </Text>
            <Bouton
              titre="Supprimer les diagnostics de plus de 30 jours"
              variante="secondaire"
              onPress={() => void demanderNettoyage(30)}
              desactive={operationEnCours || chargement}
              style={styles.bouton}
            />
            <Bouton
              titre="Supprimer tous les diagnostics"
              variante="secondaire"
              onPress={() => void demanderNettoyage(0)}
              desactive={operationEnCours || chargement}
              style={styles.bouton}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sousTitre}>Explorateur de fichiers</Text>
            <Text style={styles.chemin}>/{chemin || 'racines'}</Text>
            <View style={styles.actions}>
              <Bouton
                titre="Dossier parent"
                variante="secondaire"
                onPress={() => void ouvrirDossier(precedent)}
                desactive={!chemin || chargement}
                style={styles.boutonNavigation}
              />
              <Bouton
                titre="Racines"
                variante="secondaire"
                onPress={() => void ouvrirDossier('')}
                desactive={chargement}
                style={styles.boutonNavigation}
              />
            </View>
            {liste ? (
              <>
                <Text style={styles.precision}>
                  {liste.totalChildren} élément(s) · dossiers en premier · {liste.entries.length} affiché(s)
                </Text>
                {liste.entries.length === 0 ? <Text style={styles.texteSecondaire}>Dossier vide.</Text> : null}
                {liste.entries.map((entree) => (
                  <Pressable
                    key={entree.path}
                    onPress={() => entree.isDirectory ? void ouvrirDossier(entree.path) : setSelection(entree)}
                    accessibilityRole="button"
                    accessibilityLabel={(entree.isDirectory ? 'Ouvrir le dossier ' : 'Voir les détails du fichier ') + entree.name}
                    style={styles.ligneDossier}
                  >
                    <View style={styles.description}>
                      <Text style={styles.nomFichier} numberOfLines={2}>
                        {entree.isDirectory ? '▸ ' : '• '}{entree.name}
                      </Text>
                      <Text style={styles.texteSecondaire}>
                        {entree.isDirectory ? 'Dossier · ' + entree.fileCount + ' fichiers' : 'Fichier'}
                        {entree.incomplete ? ' · analyse incomplète' : ''}
                      </Text>
                    </View>
                    <Text style={styles.valeur}>{formatTailleStockage(entree.sizeBytes)}</Text>
                  </Pressable>
                ))}
                {liste.nextOffset !== null ? (
                  <Bouton
                    titre={suiteEnCours ? 'Chargement…' : 'Afficher 100 éléments supplémentaires'}
                    variante="secondaire"
                    onPress={() => void afficherSuite()}
                    desactive={suiteEnCours || chargement}
                    style={styles.bouton}
                  />
                ) : null}
              </>
            ) : null}
            {selection ? (
              <View style={styles.details}>
                <Text style={styles.sousTitre}>Détails du fichier</Text>
                <LigneMesure nom="Taille" valeur={formatTailleStockage(selection.sizeBytes)} />
                <Text selectable style={styles.chemin}>/{selection.path}</Text>
                <Text style={styles.texteSecondaire}>
                  Modification : {selection.modifiedAt > 0
                    ? new Date(selection.modifiedAt).toLocaleString('fr-FR')
                    : 'inconnue'}
                </Text>
                {selectionEstImage ? (
                  <Bouton
                    titre="Enregistrer l'image dans la galerie"
                    variante="secondaire"
                    onPress={() => void exporterImage(selection)}
                    desactive={operationEnCours || chargement}
                    style={styles.bouton}
                  />
                ) : null}
                {(selectionEstImage || selectionEstDiagnostic) ? (
                  <Bouton
                    titre="Supprimer ce fichier"
                    variante="secondaire"
                    onPress={() => demanderSuppression(selection)}
                    desactive={operationEnCours || chargement}
                    style={styles.bouton}
                  />
                ) : (
                  <Text style={styles.precision}>Fichier protégé : consultation des métadonnées uniquement.</Text>
                )}
                {selectionEstImage ? (
                  <Text style={styles.precision}>
                    L'export crée une copie dans Images/Elyndor. La suppression efface uniquement
                    le fichier local, et une image encore utilisée dans le récit pourrait disparaître.
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
          {incomplet ? (
            <Text style={styles.erreur}>
              Inventaire partiel : certains dossiers sont inaccessibles ou trop volumineux.
              Les tailles affichées peuvent être sous-estimées.
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  introduction: {
    color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 15, lineHeight: 21,
  },
  bouton: { marginTop: espacement.md },
  attente: { marginTop: espacement.md },
  erreur: { color: couleurs.danger, fontFamily: polices.corpsMedium, marginTop: espacement.sm, fontSize: 14 },
  confirmation: { color: couleurs.succes, fontFamily: polices.corpsMedium, marginTop: espacement.sm, fontSize: 14 },
  section: {
    borderTopWidth: 1, borderTopColor: couleurs.bordureSubtile,
    marginTop: espacement.lg, paddingTop: espacement.md,
  },
  sousTitre: { color: couleurs.doreClair, fontFamily: polices.titre, fontSize: 18, marginBottom: espacement.xs },
  chiffre: { color: couleurs.texte, fontFamily: polices.display, fontSize: 28, marginVertical: espacement.sm },
  ligneMesure: { flexDirection: 'row', justifyContent: 'space-between', gap: espacement.sm, paddingVertical: 3 },
  texteSecondaire: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 13, flexShrink: 1 },
  valeur: { color: couleurs.texte, fontFamily: polices.corpsMedium, fontSize: 14, textAlign: 'right', flexShrink: 0 },
  fondBarre: {
    height: 8, backgroundColor: couleurs.bordureSubtile, overflow: 'hidden',
    borderRadius: 5, marginTop: espacement.sm,
  },
  barre: { height: '100%', backgroundColor: couleurs.dore },
  ligneDossier: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: couleurs.bordureSubtile,
    paddingVertical: espacement.sm, gap: espacement.sm,
  },
  description: { flex: 1 },
  nomFichier: { color: couleurs.texte, fontFamily: polices.corpsMedium, fontSize: 15 },
  precision: { color: couleurs.texteFaible, fontFamily: polices.corps, fontSize: 12, marginTop: espacement.sm },
  chemin: { color: couleurs.doreClair, fontFamily: polices.corps, fontSize: 13, marginVertical: espacement.sm },
  actions: { flexDirection: 'row', gap: espacement.sm, flexWrap: 'wrap' },
  boutonNavigation: { flexGrow: 1, marginTop: espacement.xs },
  details: { marginTop: espacement.md, padding: espacement.md, borderWidth: 1, borderColor: couleurs.bordureDoree },
});
