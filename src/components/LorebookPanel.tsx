import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import loreBrut from '../data/elyndorLore.json';
import { LORE_CORE } from '../data/loreCore';
import { chargerLoreElyndor } from '../engine/loreLoader';
import { construirePassages, selectionnerPassages } from '../engine/passagesLore';
import { infererScopeLore, type ScopeLore } from '../engine/loreScoring';
import { getStoriesIndex, getStory } from '../storage/storage';
import { couleurs, espacement, polices } from '../theme/theme';
import Bouton from './Bouton';
import {
  abandonnerBrouillonLore, appliquerLorePublie, analyserImportLore, creerExportLore, creerEtatLore,
  enregistrerFicheLore, ficheOrigine, listerFichesLore, publierBrouillonLore, restaurerRevisionLore,
  signalerDoublonsLore, supprimerAjoutLore, validerFiche,
  type EtatLore, type FicheEditable, type FicheAffichee,
} from '../concepteur/lorebookModele';
import { dossiersNavigationLore } from '../concepteur/navigationLore';
import { assisterFicheLore, type ActionAI, type TailleAI, type FideliteAI, type PropositionLoreIA } from '../concepteur/lorebookAssistant';
import { importerLoreAtelier, lireLoreAtelier, modifierLoreAtelier, restaurerLoreAtelier } from '../concepteur/lorebookStore';

const BASE = chargerLoreElyndor(loreBrut as any);
const SCOPES: ScopeLore[] = ['GLOBAL', 'CONTINENT', 'REGION', 'CITY', 'FACTION', 'CHARACTER', 'SCENE'];
const MODES: Array<{ id: ActionAI; titre: string }> = [
  { id: 'creer', titre: 'Créer' }, { id: 'enrichir', titre: 'Enrichir' },
  { id: 'reecrire', titre: 'Réécrire' }, { id: 'coherence', titre: 'Vérifier le canon' },
];
const erreurTexte = (e: unknown) => e instanceof Error ? e.message : 'Opération impossible.';
const separer = (v: string) => v.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
const dossierFiche = (f: FicheAffichee) => dossiersNavigationLore(f);
type Onglet = 'contenu' | 'activation' | 'avance' | 'diagnostic';
interface LoreProposition { id: string; titre: string; contenu: string; categorie: string; origine: string; }

export default function LorebookPanel() {
  const [etat, setEtat] = useState<EtatLore | null>(null);
  const [charge, setCharge] = useState(true);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [recherche, setRecherche] = useState('');
  const [categorie, setCategorie] = useState('Toutes');
  const [dossier, setDossier] = useState('');
  const [statut, setStatut] = useState('Toutes');
  const [id, setId] = useState<string | null>(null);
  const [edition, setEdition] = useState<FicheEditable | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('contenu');
  const [proposition, setProposition] = useState<PropositionLoreIA | null>(null);
  const [modeIA, setModeIA] = useState<ActionAI>('creer');
  const [taille, setTaille] = useState<TailleAI>('detaille');
  const [fidelite, setFidelite] = useState<FideliteAI>('strict');
  const [simulation, setSimulation] = useState('');
  const [resultats, setResultats] = useState<string[] | null>(null);
  const [emergents, setEmergents] = useState<LoreProposition[] | null>(null);
  const [voirCore, setVoirCore] = useState(false);
  const [bruts, setBruts] = useState({ primaire: '', secondaire: '', negatif: '', dossiers: '' });
  function preparerChamps(v: FicheEditable) {
    setBruts({ primaire: v.primaryKeys.join(', '), secondaire: v.secondaryKeys.join(', '),
      negatif: v.negativeKeys.join(', '), dossiers: v.dossiers.join(', ') });
  }

  useEffect(() => {
    let present = true;
    lireLoreAtelier().then(v => { if (present) setEtat(v); })
      .catch(e => { if (present) setErreur(erreurTexte(e)); })
      .finally(() => { if (present) setCharge(false); });
    return () => { present = false; };
  }, []);

  const fiches = useMemo(() => etat ? listerFichesLore(BASE, etat) : [], [etat]);
  const courante = useMemo(() => fiches.find(f => f.id === id), [fiches, id]);
  const originales = useMemo(() => id ? BASE.find(f => f.id === id) : undefined, [id]);
  const baseEdition = useMemo(() => {
    if (!id || !etat) return null;
    return etat.brouillons[id] ?? courante ?? null;
  }, [id, etat, courante]);
  const modifie = !!edition && (!baseEdition || JSON.stringify(edition) !== JSON.stringify({
    titre: baseEdition.titre, contenu: baseEdition.contenu, category: baseEdition.category,
    priority: baseEdition.priority, constant: baseEdition.constant, scope: baseEdition.scope,
    primaryKeys: baseEdition.primaryKeys, secondaryKeys: baseEdition.secondaryKeys,
    negativeKeys: baseEdition.negativeKeys, dossiers: baseEdition.dossiers, actif: baseEdition.actif,
  }));
  const categories = useMemo(() => ['Toutes', ...new Set(fiches.map(f => f.category))].sort(), [fiches]);
  const dossiers = useMemo(() => {
    const cheminements = new Set<string>();
    fiches.forEach(f => dossierFiche(f).forEach(chemin => {
      const parties = chemin.split('/').filter(Boolean);
      parties.forEach((_, i) => cheminements.add(parties.slice(0, i + 1).join('/')));
    }));
    return [...cheminements].sort();
  }, [fiches]);
  const visibles = useMemo(() => fiches.filter(f => {
    const trouve = (f.titre + ' ' + f.contenu + ' ' + f.category + ' ' +
      [...f.primaryKeys, ...f.secondaryKeys, ...f.negativeKeys].join(' ')).toLowerCase()
      .includes(recherche.toLowerCase().trim());
    const bonneCategorie = categorie === 'Toutes' || f.category === categorie;
    const bonDossier = !dossier || dossierFiche(f).some(path => path === dossier || path.startsWith(dossier + '/'));
    const bonStatut = statut === 'Toutes' || (statut === 'Brouillons' && f.brouillon) ||
      (statut === 'Permanentes' && f.constant) || (statut === 'Conditionnelles' && !f.constant) ||
      (statut === 'Modifiées' && f.modifiee);
    return trouve && bonneCategorie && bonDossier && bonStatut;
  }), [fiches, recherche, categorie, dossier, statut]);

  function choisir(idSuivant: string | null) {
    const ouvrir = () => {
      setId(idSuivant); setOnglet('contenu'); setProposition(null); setResultats(null); setErreur(''); setMessage('');
      if (!idSuivant || !etat) { setEdition(null); return; }
      const valeur = etat.brouillons[idSuivant] ?? fiches.find(f => f.id === idSuivant);
      if (valeur) preparerChamps(valeur);
      setEdition(valeur ? {
        titre: valeur.titre, contenu: valeur.contenu, category: valeur.category,
        priority: valeur.priority, constant: valeur.constant, scope: valeur.scope,
        primaryKeys: [...valeur.primaryKeys], secondaryKeys: [...valeur.secondaryKeys],
        negativeKeys: [...valeur.negativeKeys], dossiers: [...valeur.dossiers], actif: valeur.actif,
      } : null);
    };
    if (modifie) {
      Alert.alert('Modifications non enregistrées',
        'Quitter cette fiche fera perdre les modifications en cours.',
        [{ text: 'Rester', style: 'cancel' }, { text: 'Quitter sans enregistrer', style: 'destructive', onPress: ouvrir }]);
    } else ouvrir();
  }
  function creerFiche(source?: Partial<FicheEditable>) {
    if (!etat) return;
    const ouvrir = () => {
      const nouveauId = 'atelier-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      setId(nouveauId); setOnglet('contenu'); setProposition(null); setResultats(null);
      const nouvelle: FicheEditable = {
        titre: source?.titre ?? 'Nouvelle fiche', contenu: source?.contenu ?? 'Description à développer.',
        category: source?.category ?? 'MONDE', priority: source?.priority ?? 50,
        constant: source?.constant ?? false, scope: source?.scope ?? 'GLOBAL',
        primaryKeys: source?.primaryKeys ?? [], secondaryKeys: source?.secondaryKeys ?? [],
        negativeKeys: source?.negativeKeys ?? [], dossiers: source?.dossiers ?? [], actif: source?.actif ?? true,
      };
      preparerChamps(nouvelle);
      setEdition(nouvelle);
    };
    if (modifie) Alert.alert('Édition en cours', 'Abandonner les modifications ?',
      [{ text: 'Annuler', style: 'cancel' }, { text: 'Continuer', onPress: ouvrir }]);
    else ouvrir();
  }
  const renseigner = <K extends keyof FicheEditable>(nom: K, valeur: FicheEditable[K]) => {
    setEdition(ancien => ancien ? { ...ancien, [nom]: valeur } : ancien);
    setProposition(null);
  };
  async function transaction(action: (avant: EtatLore) => EtatLore, succes: string): Promise<boolean> {
    setOccupe(true); setErreur(''); setMessage('');
    try { setEtat(await modifierLoreAtelier(action)); setMessage(succes); return true; }
    catch (e) { setErreur(erreurTexte(e)); return false; }
    finally { setOccupe(false); }
  }
  async function sauvegarder() {
    if (!edition || !id || !etat) return;
    let valide: FicheEditable;
    try { valide = validerFiche(edition); }
    catch (e) { setErreur(erreurTexte(e)); return; }
    const doublons = signalerDoublonsLore(valide, fiches, id);
    const proteger = courante?.protegee ?? false;
    const nouveau = !courante;
    const faire = async () => {
      const ok = await transaction(v => enregistrerFicheLore(v, BASE, id, valide),
        proteger || nouveau ? 'Brouillon enregistré, publication à confirmer.' : 'Fiche publiée. Le narrateur l’utilisera au prochain tour.');
      if (ok) setEdition(valide);
    };
    if (doublons.length) Alert.alert('Doublon potentiel',
      'Même titre que : ' + doublons.slice(0, 3).join(', ') + '. Vérifie avant de continuer.',
      [{ text: 'Annuler', style: 'cancel' }, { text: 'Enregistrer', onPress: () => { void faire(); } }]);
    else await faire();
  }
  function confirmerPublication() {
    if (!id || !etat?.brouillons[id]) return;
    Alert.alert('Publier dans le Lorebook ?',
      'Cette fiche sera accessible à la recherche du narrateur dès le prochain tour sur cet appareil. Vérifie la cohérence avec le canon avant de publier.',
      [{ text: 'Annuler', style: 'cancel' }, { text: 'Publier', onPress: () => {
        void transaction(v => publierBrouillonLore(v, id), 'Brouillon publié.');
      } }]);
  }
  function confirmerSuppression() {
    if (!id || !id.startsWith('atelier-')) return;
    Alert.alert('Supprimer la fiche ajoutée ?', 'Suppression réversible par une restauration de révision tant que cette révision reste dans l’historique.',
      [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: () => {
        void (async () => {
          if (await transaction(v => supprimerAjoutLore(v, id), 'Fiche ajoutée supprimée.')) {
            setId(null); setEdition(null);
          }
        })();
      } }]);
  }
  async function lancerIA(action: ActionAI) {
    if (!edition || !id) return;
    setOccupe(true); setErreur(''); setMessage(''); setProposition(null);
    try {
      const resultat = await assisterFicheLore(edition, action, taille, fidelite,
        appliquerLorePublie(BASE, etat ?? creerEtatLore()), id);
      setProposition(resultat);
      setMessage(action === 'coherence'
        ? 'Avis IA disponible (non exhaustif, ne garantit pas le canon).'
        : 'Proposition disponible : ton texte actuel est conservé jusqu’à acceptation.');
    } catch (e) { setErreur(erreurTexte(e)); }
    finally { setOccupe(false); }
  }
  function simuler() {
    if (!etat || !simulation.trim()) return;
    try {
      const passages = construirePassages(appliquerLorePublie(BASE, etat));
      const resultat = selectionnerPassages(passages, simulation, { requeteMessage: simulation });
      setResultats(resultat.map(e => e.titre + ' — ' + e.id));
    } catch (e) { setErreur(erreurTexte(e)); }
  }
  async function exporter() {
    if (!etat) return;
    setOccupe(true); setErreur('');
    try {
      const texte = creerExportLore(etat);
      if (await Sharing.isAvailableAsync() && FileSystem.documentDirectory) {
        const chemin = FileSystem.documentDirectory + 'Elyndor-Lorebook-' + new Date().toISOString().slice(0, 10) + '.json';
        await FileSystem.writeAsStringAsync(chemin, texte, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(chemin, { mimeType: 'application/json', dialogTitle: 'Exporter le Lorebook' });
        setMessage('Export proposé dans le partage Android.');
      } else {
        await Clipboard.setStringAsync(texte); setMessage('Export copié dans le presse-papier.');
      }
    } catch (e) { setErreur(erreurTexte(e)); }
    finally { setOccupe(false); }
  }
  async function examinerImport() {
    try {
      const texte = await Clipboard.getStringAsync();
      const importe = analyserImportLore(texte);
      Alert.alert('Importer les fiches en brouillon ?',
        Object.keys(importe.changements).length + ' modifications et ' +
        Object.keys(importe.ajouts).length + ' ajouts. Aucune publication automatique.',
        [{ text: 'Annuler', style: 'cancel' }, { text: 'Importer', onPress: () => {
          void (async () => {
            setOccupe(true);
            try { setEtat(await importerLoreAtelier(texte)); setMessage('Import réussi : vérifie les brouillons.'); }
            catch (e) { setErreur(erreurTexte(e)); }
            finally { setOccupe(false); }
          })();
        } }]);
    } catch (e) { setErreur('Import refusé : ' + erreurTexte(e)); }
  }
  async function chargerEmergents() {
    setOccupe(true); setErreur('');
    try {
      const index = await getStoriesIndex();
      const trouvés: LoreProposition[] = [];
      for (const h of index.slice(0, 30)) {
        const story = await getStory(h.id);
        for (const fiche of story?.loreEmergent ?? []) {
          if (fiche.statut === 'permanent') trouvés.push({
            id: fiche.id, titre: fiche.titre, contenu: fiche.contenu,
            categorie: fiche.categorie.toUpperCase(), origine: h.titre ?? h.personnageNom,
          });
        }
      }
      setEmergents(trouvés);
      setMessage('Lore émergent analysé sur ' + Math.min(30, index.length) + ' histoire(s) locales.');
    } catch (e) { setErreur(erreurTexte(e)); }
    finally { setOccupe(false); }
  }

  if (charge) return <ActivityIndicator color={couleurs.accent}/>;
  if (!etat) return <View><Text style={styles.erreur}>{erreur || 'Lecture du Lorebook impossible.'}</Text>
    <Text style={styles.aide}>Aucune fiche originale n’a été effacée. Ne réinitialise pas les données de l’application.</Text></View>;
  return <View>
    {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
    {message ? <Text style={styles.succes}>{message}</Text> : null}
    {occupe ? <ActivityIndicator color={couleurs.accent}/> : null}
    {id && edition ? <View>
      <Bouton titre="← Bibliothèque" variante="secondaire" onPress={() => choisir(null)} style={styles.bouton}/>
      <Text style={styles.titre}>{edition.titre}</Text>
      {courante?.protegee ? <Text style={styles.aide}>Canon protégé : toute modification devient un brouillon jusqu’à publication confirmée.</Text> : null}
      {etat.brouillons[id] ? <Text style={styles.avertissement}>Brouillon non publié</Text> : null}
      <View style={styles.onglets}>
        {(['contenu', 'activation', 'avance', 'diagnostic'] as Onglet[]).map(o =>
          <Pressable key={o} onPress={() => setOnglet(o)} style={[styles.puce, o === onglet && styles.puceActive]}>
            <Text style={styles.nomPuce}>{({contenu:'Contenu',activation:'Activation',avance:'Avancé',diagnostic:'Diagnostic'})[o]}</Text>
          </Pressable>)}
      </View>
      {onglet === 'contenu' ? <View>
        <Text style={styles.label}>Titre de la fiche</Text>
        <TextInput style={styles.champ} value={edition.titre} onChangeText={v => renseigner('titre', v)}/>
        <Text style={styles.label}>Contenu narratif</Text>
        <TextInput style={[styles.champ, styles.long]} multiline textAlignVertical="top"
          value={edition.contenu} onChangeText={v => renseigner('contenu', v)}/>
        <Text style={styles.aide}>Tu peux écrire quelques mots : l’assistant IA proposera une rédaction compatible avec le lore.</Text>
        <Text style={styles.label}>Assistant IA — action</Text>
        <View style={styles.onglets}>{MODES.map(m => <Pressable key={m.id} onPress={() => setModeIA(m.id)}
          style={[styles.puce, modeIA === m.id && styles.puceActive]}>
          <Text style={styles.nomPuce}>{m.titre}</Text>
        </Pressable>)}</View>
        <Text style={styles.label}>Longueur</Text>
        <View style={styles.onglets}>{(['court','detaille','encyclopedique'] as TailleAI[]).map(v => <Pressable key={v}
          style={[styles.puce, taille === v && styles.puceActive]} onPress={() => setTaille(v)}>
          <Text style={styles.nomPuce}>{v}</Text></Pressable>)}</View>
        <Text style={styles.label}>Créativité</Text>
        <View style={styles.onglets}>{(['strict','creatif'] as FideliteAI[]).map(v => <Pressable key={v}
          style={[styles.puce, fidelite === v && styles.puceActive]} onPress={() => setFidelite(v)}>
          <Text style={styles.nomPuce}>{v === 'strict' ? 'Canon strict' : 'Enrichissement compatible'}</Text></Pressable>)}</View>
        <Bouton titre="✦ Assistant IA : proposer" onPress={() => void lancerIA(modeIA)}
          desactive={occupe} style={styles.bouton}/>
        {proposition ? <View style={styles.proposition}>
          <Text style={styles.titre}>Proposition IA — non publiée</Text>
          {proposition.commentaire ? <Text style={styles.aide}>{proposition.commentaire}</Text> : null}
          {proposition.fiche ? <>
            <Text selectable style={styles.texte}>{proposition.fiche.contenu}</Text>
            <Text style={styles.aide}>Champs proposés : {proposition.fiche.primaryKeys.length} mots-clés principaux · {proposition.fiche.secondaryKeys.length} secondaires · {proposition.fiche.negativeKeys.length} exclusions · catégorie {proposition.fiche.category} · priorité {proposition.fiche.priority} · portée {proposition.fiche.scope}.</Text>
            <Text style={styles.aide}>« Accepter dans le formulaire » remplira aussi Activation et Avancé. Aucune sauvegarde ni publication automatique.</Text>
          </> : null}
          <Text style={styles.aide}>Sources consultées (extraits, vérification non exhaustive) : {proposition.sources.join(' · ')}</Text>
          {proposition.fiche ? <Bouton titre="Accepter dans le formulaire" onPress={() => {
            if (proposition.fiche) { setEdition(proposition.fiche); preparerChamps(proposition.fiche); }
            setProposition(null);
            setMessage('Proposition placée dans le formulaire. Enregistre pour continuer.');
          }} style={styles.bouton}/> : null}
          <Bouton titre="Régénérer" variante="secondaire" onPress={() => void lancerIA(modeIA)}
            desactive={occupe} style={styles.bouton}/>
          <Bouton titre="Écarter la proposition" variante="secondaire" onPress={() => setProposition(null)} style={styles.bouton}/>
        </View> : null}
      </View> : null}
      {onglet === 'activation' ? <View>
        <View style={styles.ligne}><Text style={styles.label}>Fiche activée</Text>
          <Switch value={edition.actif} onValueChange={v => renseigner('actif', v)}/></View>
        <View style={styles.ligne}><Text style={styles.label}>Activation permanente (bonus de pertinence)</Text>
          <Switch value={edition.constant} onValueChange={v => renseigner('constant', v)}/></View>
        <Text style={styles.aide}>Le mode permanent augmente la pertinence des passages, sans garantir l’injection intégrale de la fiche.</Text>
        <Text style={styles.label}>Mots-clés principaux (séparés par virgule)</Text>
        <TextInput multiline style={styles.champ} value={bruts.primaire}
          onChangeText={v => { setBruts(x => ({...x, primaire:v})); renseigner('primaryKeys', separer(v)); }}/>
        <Text style={styles.label}>Mots-clés secondaires</Text>
        <TextInput multiline style={styles.champ} value={bruts.secondaire}
          onChangeText={v => { setBruts(x => ({...x, secondaire:v})); renseigner('secondaryKeys', separer(v)); }}/>
        <Text style={styles.label}>Mots-clés d’exclusion</Text>
        <TextInput multiline style={styles.champ} value={bruts.negatif}
          onChangeText={v => { setBruts(x => ({...x, negatif:v})); renseigner('negativeKeys', separer(v)); }}/>
      </View> : null}
      {onglet === 'avance' ? <View>
        <Text style={styles.label}>Catégorie technique</Text>
        <TextInput style={styles.champ} value={edition.category} onChangeText={v => renseigner('category', v)}/>
        <Text style={styles.label}>Dossiers (séparés par virgule, sous-dossiers avec /)</Text>
        <TextInput multiline style={styles.champ} value={bruts.dossiers}
          onChangeText={v => { setBruts(x => ({...x, dossiers:v})); renseigner('dossiers', separer(v)); }} placeholder="Monde/Europe/France/Paris"/>
        <Text style={styles.label}>Priorité (0 = priorité plus haute, 100 = plus basse)</Text>
        <TextInput style={styles.champ} keyboardType="numeric" value={String(edition.priority)}
          onChangeText={v => renseigner('priority', Number(v))}/>
        <Text style={styles.label}>Portée géographique et sémantique</Text>
        <View style={styles.onglets}>{SCOPES.map(v => <Pressable key={v}
          style={[styles.puce, edition.scope === v && styles.puceActive]} onPress={() => renseigner('scope', v)}>
          <Text style={styles.nomPuce}>{v}</Text></Pressable>)}</View>
        <Text style={styles.aide}>Les dossiers ne dupliquent pas les fiches. Leur catégorie, portée et priorité servent au classement et au moteur de recherche.</Text>
      </View> : null}
      {onglet === 'diagnostic' ? <View>
        <Text style={styles.label}>Essai de recherche lexicale</Text>
        <TextInput style={styles.champ} value={simulation} onChangeText={setSimulation}
          placeholder="Ex : je rejoins la Guilde des Aventuriers à Paris"/>
        <Bouton titre="Simuler la sélection des passages" onPress={simuler} style={styles.bouton}/>
        <Text style={styles.aide}>Simulation lexicale avec le même sélecteur de passages que le narrateur. Ce n’est pas une mesure d’injection réelle : embeddings, scène et autres contraintes peuvent modifier le résultat final.</Text>
        {resultats?.length === 0 ? <Text style={styles.aide}>Aucun passage retenu.</Text> : null}
        {resultats?.map((v, i) => <Text key={i} style={styles.texte}>{i + 1}. {v}</Text>)}
        {signalerDoublonsLore(edition, fiches, id).map(v => <Text key={v} style={styles.avertissement}>Doublon de titre potentiel : {v}</Text>)}
      </View> : null}
      <Bouton titre={courante?.protegee || !courante ? 'Enregistrer en brouillon' : 'Enregistrer la fiche'}
        onPress={() => void sauvegarder()} desactive={occupe} style={styles.bouton}/>
      {etat.brouillons[id] && !modifie ? <>
        <Bouton titre="Publier le brouillon validé" onPress={confirmerPublication} desactive={occupe} style={styles.bouton}/>
        <Bouton titre="Abandonner le brouillon" variante="secondaire" onPress={() =>
          Alert.alert('Abandonner ce brouillon ?', 'La version actuellement publiée sera conservée.', [
            { text:'Annuler', style:'cancel' },
            { text:'Abandonner', style:'destructive', onPress: () => {
              void transaction(v => abandonnerBrouillonLore(v, id), 'Brouillon abandonné.');
              choisir(null);
            } },
          ])} style={styles.bouton}/>
      </> : null}
      <Bouton titre="Dupliquer cette fiche dans un brouillon" variante="secondaire"
        onPress={() => creerFiche({ ...edition, titre: edition.titre + ' (copie)' })} style={styles.bouton}/>
      {id.startsWith('atelier-') && <Bouton titre="Supprimer cette fiche ajoutée" variante="secondaire"
        onPress={confirmerSuppression} style={styles.bouton}/>}
      {originales && <Text style={styles.aide}>Fiche d’origine conservée dans l’application. ID : {id}.</Text>}
    </View> : <View>
      <Text style={styles.titre}>Bibliothèque d'Elyndor</Text>
      <Bouton titre={voirCore ? 'Masquer le Lore Core protégé' : 'Consulter le Lore Core protégé'}
        variante="secondaire" onPress={() => setVoirCore(!voirCore)} style={styles.bouton}/>
      {voirCore && <View style={styles.proposition}>
        <Text style={styles.label}>LORE CORE — LECTURE SEULE</Text>
        <Text selectable style={styles.texte}>{LORE_CORE}</Text>
        <Text style={styles.aide}>Ce texte appartient au noyau du logiciel et ne peut pas être modifié ici.</Text>
      </View>}
      <Text style={styles.aide}>{BASE.length} fiches canoniques d’origine · {Object.keys(etat.ajouts).length} ajout(s) publié(s) · {Object.keys(etat.brouillons).length} brouillon(s) · révision {etat.numero}.</Text>
      <Bouton titre="+ Créer une fiche" onPress={() => creerFiche()} style={styles.bouton}/>
      <TextInput style={styles.champ} value={recherche} onChangeText={setRecherche}
        placeholder="Rechercher dans titres, mots-clés, contenus..." placeholderTextColor={couleurs.texteFaible}/>
      <Text style={styles.label}>Statut</Text>
      <View style={styles.onglets}>{['Toutes','Brouillons','Permanentes','Conditionnelles','Modifiées'].map(v =>
        <Pressable key={v} onPress={() => setStatut(v)} style={[styles.puce, statut === v && styles.puceActive]}>
          <Text style={styles.nomPuce}>{v}</Text></Pressable>)}</View>
      <Text style={styles.label}>Catégories</Text>
      <View style={styles.onglets}>{categories.map(v =>
        <Pressable key={v} onPress={() => setCategorie(v)} style={[styles.puce, categorie === v && styles.puceActive]}>
          <Text style={styles.nomPuce}>{v}</Text></Pressable>)}</View>
      <Text style={styles.label}>Dossiers et sous-dossiers</Text>
      {dossier ? <Bouton titre={'← Remonter : ' + dossier} variante="secondaire"
        onPress={() => setDossier(dossier.includes('/') ? dossier.slice(0, dossier.lastIndexOf('/')) : '')}
        style={styles.bouton}/> : null}
      <View style={styles.onglets}>
        {!dossier && <Text style={styles.aide}>Racine de la bibliothèque</Text>}
        {dossiers.filter(v => (dossier ? v.startsWith(dossier + '/') : true) &&
          v.split('/').length === (dossier ? dossier.split('/').length + 1 : 1)).map(v =>
          <Pressable key={v} style={styles.dossier} onPress={() => setDossier(v)}>
            <Text style={styles.nomPuce}>▸ {v.split('/').slice(-1)[0]}</Text></Pressable>)}
      </View>
      <Bouton titre="Tous les dossiers" variante="secondaire" onPress={() => setDossier('')}
        style={styles.bouton}/>
      <Text style={styles.label}>{visibles.length} fiche(s) trouvée(s)</Text>
      {visibles.slice(0, 120).map(f => <Pressable key={f.id} onPress={() => choisir(f.id)} style={styles.entree}>
        <View style={{ flex: 1 }}>
          <Text style={styles.nomEntree}>{f.titre}</Text>
          <Text style={styles.aide}>{f.category} · {f.protegee ? 'canon protégé' : f.origine === 'ajout' ? 'création' : 'canon'}{f.brouillon ? ' · BROUILLON' : ''}{f.actif ? '' : ' · désactivée'}</Text>
        </View><Text style={styles.nomPuce}>›</Text>
      </Pressable>)}
      {visibles.length > 120 ? <Text style={styles.aide}>Affichage limité aux 120 premiers résultats ; affine les filtres.</Text> : null}
      <Text style={styles.titre}>Lore émergent</Text>
      <Text style={styles.aide}>Une création d'histoire doit être proposée et vérifiée avant d'entrer dans le canon général.</Text>
      <Bouton titre="Explorer les créations des histoires" variante="secondaire"
        onPress={() => void chargerEmergents()} desactive={occupe} style={styles.bouton}/>
      {emergents?.map(x => <Pressable key={x.id + x.origine} style={styles.entree} onPress={() =>
        creerFiche({ titre: x.titre, contenu: x.contenu, category: x.categorie,
          scope: infererScopeLore(x.categorie), dossiers: ['Lore émergent/À valider'], actif: false })}>
        <View style={{ flex: 1 }}><Text style={styles.nomEntree}>{x.titre}</Text>
          <Text style={styles.aide}>{x.origine} · toucher pour proposer au canon</Text></View>
      </Pressable>)}
      <Text style={styles.titre}>Sauvegardes et historique</Text>
      <Text style={styles.aide}>Export des modifications de cet appareil. Aucun secret, conversation ni contenu original intégral du dépôt.</Text>
      <Bouton titre="Exporter / partager le Lorebook JSON" variante="secondaire"
        onPress={() => void exporter()} desactive={occupe} style={styles.bouton}/>
      <Bouton titre="Examiner l'import JSON du presse-papier" variante="secondaire"
        onPress={() => void examinerImport()} desactive={occupe} style={styles.bouton}/>
      {[...etat.historique].reverse().map(r => <Pressable key={r.numero} style={styles.entree} onPress={() =>
        Alert.alert('Restaurer la révision ' + r.numero + ' ?',
          'La configuration actuelle sera conservée dans l’historique.',
          [{ text:'Annuler',style:'cancel' },{ text:'Restaurer',onPress:()=>{
            void (async()=>{setOccupe(true);try{setEtat(await restaurerLoreAtelier(r.numero));setMessage('Révision restaurée.');}
              catch(e){setErreur(erreurTexte(e));}finally{setOccupe(false);}})();
          }}])}>
        <Text style={styles.texte}>Révision {r.numero} · {new Date(r.date).toLocaleString('fr-FR')} · {r.motif}</Text>
      </Pressable>)}
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  titre: { color: couleurs.texte, fontFamily: polices.titre, fontSize: 23, marginVertical: espacement.sm },
  aide: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 14, lineHeight: 20, marginTop: 5 },
  texte: { color: couleurs.texte, fontFamily: polices.corps, fontSize: 15, lineHeight: 21, marginVertical: 5 },
  label: { color: couleurs.doreClair, fontFamily: polices.corpsMedium, fontSize: 15, marginTop: espacement.md },
  champ: { marginTop: 6, backgroundColor: couleurs.fondChampSaisie, borderWidth: 1,
    borderColor: couleurs.bordureSubtile, borderRadius: 10, padding: 12, minHeight: 48,
    color: couleurs.texte, fontFamily: polices.corps, fontSize: 16 },
  long: { minHeight: 230 },
  onglets: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginVertical: 10 },
  puce: { borderWidth: 1, borderColor: couleurs.bordureSubtile, borderRadius: 10,
    minHeight: 43, paddingHorizontal: 12, justifyContent: 'center' },
  puceActive: { borderColor: couleurs.dore, backgroundColor: couleurs.fondCarte },
  nomPuce: { color: couleurs.doreClair, fontFamily: polices.corpsMedium, fontSize: 14 },
  bouton: { marginVertical: 8 },
  entree: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: couleurs.bordureSubtile, gap: 12 },
  nomEntree: { color: couleurs.texte, fontFamily: polices.corpsMedium, fontSize: 17 },
  dossier: { padding: 12, minHeight: 47, borderRadius: 9, borderWidth: 1, borderColor: couleurs.bordureSubtile },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  proposition: { borderWidth: 1, borderColor: couleurs.bordureDoree, padding: 12, marginVertical: 12, borderRadius: 12 },
  erreur: { color: couleurs.danger, fontFamily: polices.corps, fontSize: 14, marginVertical: 6 },
  succes: { color: couleurs.succes, fontFamily: polices.corps, fontSize: 14, marginVertical: 6 },
  avertissement: { color: couleurs.doreClair, fontFamily: polices.corpsMedium, fontSize: 14, marginVertical: 6 },
});
