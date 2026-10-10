import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { couleurs, espacement, polices } from '../theme/theme';
import Bouton from './Bouton';
import { VERSION_APP } from '../version';
import {
  analyserInstantaneAtelier, creerInstantaneAtelier, LIMITES_ATELIER, PROFILS_ATELIER,
  type ConfigurationAtelier, type EtatAtelier, type ParametresAtelier, type ProfilAtelier, type CleParametreSimple,
} from '../concepteur/configuration';
import {
  enregistrerEtatAtelier, importerConfigurationAtelier, lireConfigurationAtelier,
  restaurerConfigurationAtelier,
} from '../concepteur/depotConfiguration';

export type SectionConfiguration = 'profils' | 'modeles' | 'narration' | 'recherche' | 'instantanes';

const NOMS: Record<ProfilAtelier, string> = { production: 'Production', test: 'Test', benchmark: 'Benchmark' };
const CHAMPS: Record<CleParametreSimple, { nom: string; aide: string }> = {
  budgetLorePassages: { nom: 'Budget du lore', aide: 'Caractères des passages remontés par la recherche.' },
  maxSouvenirs: { nom: 'Nombre de souvenirs', aide: 'Nombre maximal de messages anciens pertinents retenus.' },
  temperatureDelta: { nom: 'Correction de température', aide: "Ajustement de la température choisie pour l'histoire." },
};
const COMMIT_BUNDLE = process.env.EXPO_PUBLIC_GIT_SHA || 'non renseigné';
const erreurTexte = (e: unknown) => e instanceof Error ? e.message : 'Opération impossible.';
const valeurTexte = (v: number, cle: CleParametreSimple) =>
  cle === 'temperatureDelta' ? (v > 0 ? '+' : '') + v.toFixed(2) : String(v);

export default function AtelierConfigurationPanel({ section }: { section: SectionConfiguration }) {
  const [config, setConfig] = useState<ConfigurationAtelier | null>(null);
  const [chargement, setChargement] = useState(true);
  const [operation, setOperation] = useState(false);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let actif = true;
    lireConfigurationAtelier().then((v) => { if (actif) setConfig(v); })
      .catch((e) => { if (actif) setErreur(erreurTexte(e)); })
      .finally(() => { if (actif) setChargement(false); });
    return () => { actif = false; };
  }, []);

  async function sauvegarder(etat: EtatAtelier, raison: string) {
    setOperation(true); setMessage(''); setErreur('');
    try {
      setConfig(await enregistrerEtatAtelier(etat, raison));
      setMessage('Sauvegardé. Ce réglage sera utilisé au prochain tour lorsque le mode concepteur est actif.');
    } catch (e) { setErreur(erreurTexte(e)); }
    finally { setOperation(false); }
  }

  function changerProfil(profil: ProfilAtelier) {
    if (config && !operation) void sauvegarder({ profilActif: profil, profils: config.profils }, 'Profil ' + profil);
  }
  function changerValeur(cle: CleParametreSimple, sens: -1 | 1) {
    if (!config || operation) return;
    const p = config.profilActif, limites = LIMITES_ATELIER[cle];
    const valeur = config.profils[p][cle];
    const prochaine = Math.max(limites.min, Math.min(limites.max,
      Number((valeur + sens * limites.pas).toFixed(3))));
    void sauvegarder({
      profilActif: p,
      profils: { ...config.profils, [p]: { ...config.profils[p], [cle]: prochaine } },
    }, 'Modifier ' + cle + ' (' + p + ')');
  }

  async function exporter() {
    if (!config || operation) return;
    setOperation(true); setErreur(''); setMessage('');
    try {
      const texte = JSON.stringify(creerInstantaneAtelier(config, VERSION_APP, COMMIT_BUNDLE), null, 2);
      if (await Sharing.isAvailableAsync() && FileSystem.documentDirectory) {
        const chemin = FileSystem.documentDirectory + 'Elyndor-Configuration-' +
          new Date().toISOString().slice(0, 10) + '.json';
        await FileSystem.writeAsStringAsync(chemin, texte, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(chemin, { mimeType: 'application/json', dialogTitle: 'Partager la configuration Elyndor' });
        setMessage("Instantané prêt dans le partage Android. Choisis un emplacement pour l'enregistrer.");
      } else {
        await Clipboard.setStringAsync(texte);
        setMessage('Instantané copié dans le presse-papier.');
      }
    } catch (e) { setErreur(erreurTexte(e)); }
    finally { setOperation(false); }
  }

  async function examinerImport() {
    if (operation) return;
    setOperation(true); setErreur(''); setMessage('');
    try {
      const texte = await Clipboard.getStringAsync();
      const etat = analyserInstantaneAtelier(texte);
      Alert.alert('Importer cet instantané ?',
        'Profil actif : ' + NOMS[etat.profilActif] +
        '. Les réglages des trois profils seront remplacés. Une révision précédente sera sauvegardée.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Importer', onPress: () => { void effectuerImport(texte); } },
        ]);
    } catch (e) { setErreur('Import refusé : ' + erreurTexte(e)); }
    finally { setOperation(false); }
  }

  async function effectuerImport(texte: string) {
    setOperation(true); setErreur(''); setMessage('');
    try {
      setConfig(await importerConfigurationAtelier(texte));
      setMessage('Configuration importée et sauvegardée.');
    } catch (e) { setErreur(erreurTexte(e)); }
    finally { setOperation(false); }
  }

  function confirmerRestauration(numero: number) {
    Alert.alert('Restaurer cette révision ?', 'La configuration actuelle sera conservée dans l’historique.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Restaurer', onPress: () => { void restaurer(numero); } },
    ]);
  }
  async function restaurer(numero: number) {
    setOperation(true); setErreur(''); setMessage('');
    try {
      setConfig(await restaurerConfigurationAtelier(numero));
      setMessage('Configuration restaurée.');
    } catch (e) { setErreur(erreurTexte(e)); }
    finally { setOperation(false); }
  }

  const profil = config?.profilActif;
  const valeurs = profil ? config?.profils[profil] : null;
  const champs: CleParametreSimple[] = section === 'recherche'
    ? ['budgetLorePassages', 'maxSouvenirs'] : ['temperatureDelta'];

  return <View>
    {chargement ? <ActivityIndicator color={couleurs.accent} /> : null}
    {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
    {message ? <Text style={styles.succes}>{message}</Text> : null}
    {config && <>
      {section !== 'instantanes' && <View>
        <Text style={styles.titre}>Profil actif : {NOMS[config.profilActif]}</Text>
        <Text style={styles.aide}>Chaque profil a ses propres réglages. Révision {config.numero}.</Text>
        <View style={styles.profils}>
          {PROFILS_ATELIER.map((v) => <Pressable key={v} onPress={() => changerProfil(v)}
            disabled={operation} accessibilityRole="button"
            style={[styles.profil, v === profil && styles.actif]}>
            <Text style={styles.nomProfil}>{NOMS[v]}</Text>
          </Pressable>)}
        </View>
      </View>}
      {(section === 'modeles' || section === 'narration' || section === 'recherche') &&
        <View>
          <Text style={styles.titre}>{section === 'recherche' ? 'Mémoire et recherche' : 'Réglages du narrateur'}</Text>
          <Text style={styles.aide}>Ces valeurs influencent effectivement le prochain tour en mode concepteur. Les parties existantes ne sont pas modifiées. Le budget d'état interne est indépendant des fourchettes narratives strictes.</Text>
          {champs.map((cle) => {
            const limites = LIMITES_ATELIER[cle];
            return <View style={styles.ligne} key={cle}>
              <Text style={styles.nom}>{CHAMPS[cle].nom}</Text>
              <Text style={styles.aide}>{CHAMPS[cle].aide}</Text>
              <View style={styles.reglage}>
                <Pressable disabled={operation || !valeurs || valeurs[cle] <= limites.min}
                  onPress={() => changerValeur(cle, -1)} accessibilityRole="button"
                  accessibilityLabel={'Diminuer ' + CHAMPS[cle].nom} style={styles.action}>
                  <Text style={styles.touche}>−</Text>
                </Pressable>
                <Text style={styles.valeur}>{valeurs ? valeurTexte(valeurs[cle], cle) : '—'}</Text>
                <Pressable disabled={operation || !valeurs || valeurs[cle] >= limites.max}
                  onPress={() => changerValeur(cle, 1)} accessibilityRole="button"
                  accessibilityLabel={'Augmenter ' + CHAMPS[cle].nom} style={styles.action}>
                  <Text style={styles.touche}>+</Text>
                </Pressable>
              </View>
            </View>;
          })}
          {section === 'modeles' && <Text style={styles.aide}>Elyndor Cloud reste le seul fournisseur joueur. Changer le modèle RunPod nécessite encore un service d'administration sécurisé.</Text>}
        </View>}
      {section === 'instantanes' && <>
        <Text style={styles.titre}>Exporter la configuration</Text>
        <Text style={styles.aide}>Les trois profils, la version et le commit JS sont exportés, sans clés API, secrets ni conversations.</Text>
        <Text style={styles.aide}>Version {VERSION_APP} · commit du bundle {COMMIT_BUNDLE.slice(0, 12)}</Text>
        <Bouton titre="Enregistrer / partager le JSON" onPress={() => void exporter()}
          desactive={operation} style={styles.bouton}/>
        <Text style={styles.aide}>Importation : copie le JSON d'un instantané dans le presse-papier, puis vérifie-le avant de l'appliquer.</Text>
        <Bouton titre="Examiner et importer le presse-papier" variante="secondaire"
          onPress={() => void examinerImport()} desactive={operation} style={styles.bouton}/>
        <Text style={styles.titre}>Historique</Text>
        {config.historique.length === 0 && <Text style={styles.aide}>Aucune révision antérieure.</Text>}
        {[...config.historique].reverse().slice(0, 10).map((v) =>
          <Pressable key={v.numero} accessibilityRole="button" disabled={operation}
            onPress={() => confirmerRestauration(v.numero)} style={styles.ligne}>
            <Text style={styles.nom}>Révision {v.numero} · {new Date(v.date).toLocaleString('fr-FR')}</Text>
            <Text style={styles.aide}>{v.motif} · toucher pour restaurer</Text>
          </Pressable>)}
      </>}
    </>}
  </View>;
}
const styles = StyleSheet.create({
  titre: { color: couleurs.texte, fontFamily: polices.titre, fontSize: 20, marginVertical: espacement.sm },
  aide: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 14, lineHeight: 20, marginBottom: espacement.sm },
  profils: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: espacement.sm },
  profil: { borderWidth: 1, borderColor: couleurs.bordureSubtile, borderRadius: 10, padding: 12, minHeight: 48, justifyContent: 'center' },
  actif: { borderColor: couleurs.dore, backgroundColor: couleurs.fondCarte },
  nomProfil: { color: couleurs.doreClair, fontFamily: polices.corpsMedium, fontSize: 14 },
  ligne: { paddingVertical: 12, borderBottomColor: couleurs.bordureSubtile, borderBottomWidth: 1 },
  nom: { color: couleurs.texte, fontFamily: polices.corpsMedium, fontSize: 16 },
  reglage: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 7 },
  action: { borderWidth: 1, borderColor: couleurs.bordureDoree, borderRadius: 8, paddingHorizontal: 15, minHeight: 46, justifyContent: 'center' },
  touche: { color: couleurs.doreClair, fontSize: 23, textAlign: 'center' },
  valeur: { color: couleurs.texte, fontFamily: polices.corpsMedium, fontSize: 17, minWidth: 70, textAlign: 'center' },
  bouton: { marginVertical: espacement.sm },
  erreur: { color: couleurs.danger, fontSize: 14, marginVertical: 8 },
  succes: { color: couleurs.succes, fontSize: 14, marginVertical: 8 },
});
