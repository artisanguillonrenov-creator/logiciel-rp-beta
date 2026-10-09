import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type GestureResponderEvent } from 'react-native';
import { couleurs, espacement, polices } from '../theme/theme';
import { type EtatAtelier, type ConfigurationAtelier, type ProfilAtelier, PROFILS_ATELIER, LIMITES_ATELIER } from '../concepteur/configuration';
import { lireConfigurationAtelier, enregistrerEtatAtelier } from '../concepteur/depotConfiguration';
import { CLES_SAMPLERS, SAMPLERS_LLAMA_CPP, type CleSampler, type PlagesLongueur, type ReglagesNarrateur } from '../concepteur/reglagesNarrateur';
import type { Longueur, TonHistoire, StorySettings } from '../types';
import { CLES_STYLES, NOMS_STYLES, OPTIONS_DENSITE, OPTIONS_CADENCE, OPTIONS_ACCENT, OPTIONS_AVENTURE, instructionStyle } from '../concepteur/interpretationNarrative';
import { temperaturePourCreativite } from '../engine/promptBuilder';
import { REGLES_IMMUABLES } from '../engine/rules';
import { IDENTITE_NARRATIVE } from '../engine/identiteNarrative';
import { RESPONSABILITES_NARRATIVES } from '../engine/narrativeBehaviorKernel';

type Partie = 'fondamentales' | 'styles' | 'aventures' | 'technique';
const PARTIES: Array<{ id: Partie; nom: string }> = [
  { id: 'fondamentales', nom: 'Règles' },
  { id: 'styles', nom: 'Styles' },
  { id: 'aventures', nom: 'Aventure' },
  { id: 'technique', nom: 'Technique' },
];
const NOMS: Record<ProfilAtelier, string> = { production: 'Production', test: 'Test', benchmark: 'Benchmark' };
const LONGUEURS: Array<{ id: Longueur; nom: string }> = [
  { id: 'courte', nom: 'Court' }, { id: 'moyenne', nom: 'Moyen' }, { id: 'longue', nom: 'Long' },
];
const LIBELLES_AVENTURE: Record<keyof StorySettings, string> = {
  ton: 'Style initial', creativite: 'Créativité', longueur: 'Longueur',
  violence: 'Violence', romance: 'Romance', humour: 'Humour',
  rythme: 'Rythme', liberteJoueur: 'Liberté du joueur',
};
function Selection({ titre, valeur, options, changer, bloque }: {
  titre: string; valeur: string; options: readonly string[];
  changer: (choix: string) => void; bloque: boolean;
}) {
  return <View style={styles.ligne}>
    <Text style={styles.nom}>{titre} : {valeur}</Text>
    <View style={styles.onglets}>
      {options.map(option => <Pressable key={option} accessibilityRole="button"
        disabled={bloque} onPress={() => changer(option)}
        style={[styles.onglet, valeur === option && styles.actif]}>
        <Text style={styles.nom}>{option}</Text>
      </Pressable>)}
    </View>
  </View>;
}
type PlagesSaisie = Record<Longueur, { min: string; max: string }>;
function saisieDepuis(plages: PlagesLongueur): PlagesSaisie {
  return { courte: { min: String(plages.courte.min), max: String(plages.courte.max) },
    moyenne: { min: String(plages.moyenne.min), max: String(plages.moyenne.max) },
    longue: { min: String(plages.longue.min), max: String(plages.longue.max) } };
}
function formatNombre(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

/** Curseur tactile sans dépendance native supplémentaire ; sauvegarde à la fin du geste. */
function Curseur({ nom, valeur, min, max, pas, onChange, bloque }: {
  nom: string; valeur: number; min: number; max: number; pas: number;
  onChange: (valeur: number) => void; bloque: boolean;
}) {
  const [largeur, setLargeur] = useState(1);
  const [brouillon, setBrouillon] = useState<number | null>(null);
  const actuel = brouillon ?? valeur;
  const lirePosition = (ev: GestureResponderEvent) => {
    const ratio = Math.max(0, Math.min(1, ev.nativeEvent.locationX / largeur));
    const result = min + Math.round(((max - min) * ratio) / pas) * pas;
    return Number(Math.max(min, Math.min(max, result)).toFixed(4));
  };
  return <View style={styles.ligne}>
    <View style={styles.ligneEntete}>
      <Text style={styles.nom}>{nom}</Text>
      <Text style={styles.chiffre}>{formatNombre(actuel)}</Text>
    </View>
    <View accessibilityRole="adjustable"
      accessibilityLabel={nom}
      accessibilityValue={{ min, max, now: actuel }}
      onAccessibilityAction={ev => {
        if (bloque) return;
        if (ev.nativeEvent.actionName === 'increment') onChange(Math.min(max, Number((valeur + pas).toFixed(4))));
        if (ev.nativeEvent.actionName === 'decrement') onChange(Math.max(min, Number((valeur - pas).toFixed(4))));
      }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      style={[styles.zoneCurseur, bloque && styles.desactive]}
      onLayout={e => setLargeur(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => !bloque}
      onMoveShouldSetResponder={() => !bloque}
      onResponderGrant={ev => setBrouillon(lirePosition(ev))}
      onResponderMove={ev => setBrouillon(lirePosition(ev))}
      onResponderRelease={ev => { const prochain = lirePosition(ev); setBrouillon(null); if (prochain !== valeur) onChange(prochain); }}
      onResponderTerminate={() => setBrouillon(null)}>
      <View style={styles.piste}>
        <View style={[styles.progression, { width: ((actuel - min) / (max - min)) * largeur }]} />
      </View>
      <View style={[styles.poignee, { left: ((actuel - min) / (max - min)) * largeur }]} />
    </View>
    <View style={styles.bornes}><Text style={styles.aideMini}>{formatNombre(min)}</Text><Text style={styles.aideMini}>{formatNombre(max)}</Text></View>
  </View>;
}

export default function AtelierNarrateurPanel() {
  const [config, setConfig] = useState<ConfigurationAtelier | null>(null);
  const [partie, setPartie] = useState<Partie>('technique');
  const [styleChoisi, setStyleChoisi] = useState<TonHistoire>('heroique_epique');
  const [chargement, setChargement] = useState(true);
  const [operation, setOperation] = useState(false);
  const [info, setInfo] = useState('');
  const [erreur, setErreur] = useState('');
  const [plagesSaisie, setPlagesSaisie] = useState<PlagesSaisie | null>(null);

  useEffect(() => {
    let actif = true;
    lireConfigurationAtelier().then(c => { if (actif) { setConfig(c); setPlagesSaisie(saisieDepuis(c.profils[c.profilActif].narrateur.longueurs)); } })
      .catch(e => { if (actif) setErreur(String(e)); })
      .finally(() => { if (actif) setChargement(false); });
    return () => { actif = false; };
  }, []);

  async function sauver(etat: EtatAtelier, motif: string) {
    if (operation) return;
    setOperation(true); setErreur(''); setInfo('');
    try {
      const suivant = await enregistrerEtatAtelier(etat, motif);
      setConfig(suivant);
      setInfo('Enregistré : effectif au prochain tour narratif de ce profil.');
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)); }
    finally { setOperation(false); }
  }
  const profil: ProfilAtelier = config?.profilActif ?? 'production';
  const valeurs = profil ? config?.profils[profil] : undefined;
  const narrateur = valeurs?.narrateur;

  function changerProfil(prochain: ProfilAtelier) {
    if (!config || operation || config.profilActif === prochain) return;
    setPlagesSaisie(saisieDepuis(config.profils[prochain].narrateur.longueurs));
    void sauver({ profilActif: prochain, profils: config.profils }, 'Profil narrateur ' + prochain);
  }
  function changerNarrateur(prochain: ReglagesNarrateur, motif: string) {
    if (!config || !profil) return;
    void sauver({ profilActif: profil,
      profils: { ...config.profils, [profil]: { ...config.profils[profil], narrateur: prochain } },
    }, motif);
  }
  function enregistrerLongueurs() {
    if (!narrateur || !plagesSaisie) return;
    const nouvelles = {} as PlagesLongueur;
    for (const cle of ['courte', 'moyenne', 'longue'] as Longueur[]) {
      const { min, max } = plagesSaisie[cle];
      if (!/^\d+$/.test(min) || !/^\d+$/.test(max)) { setErreur('Saisis des nombres entiers.'); return; }
      nouvelles[cle] = { min: Number(min), max: Number(max) };
    }
    changerNarrateur({ ...narrateur, longueurs: nouvelles }, 'Fourchettes narrateur');
  }

  if (chargement) return <ActivityIndicator color={couleurs.accent} />;
  if (!config || !narrateur || !valeurs) return <Text style={styles.erreur}>{erreur || 'Configuration indisponible.'}</Text>;

  const groupes = ['Distribution', 'Répétitions', 'DRY', 'Expert'];
  return <View>
    <Text style={styles.titre}>Narrateur IA</Text>
    <Text style={styles.aide}>Réglages propres au pod llama.cpp. Les curseurs sont appliqués à la narration seulement, jamais aux outils. Profil Production utilisé pour les aventures normales de cet appareil.</Text>
    <View style={styles.onglets}>
      {PROFILS_ATELIER.map(p => <Pressable key={p} onPress={() => changerProfil(p)}
        disabled={operation} style={[styles.onglet, p === profil && styles.actif]}>
        <Text style={styles.nom}>{NOMS[p]}</Text>
      </Pressable>)}
    </View>
    <View style={styles.onglets}>
      {PARTIES.map(p => <Pressable key={p.id} onPress={() => setPartie(p.id)}
        style={[styles.onglet, p.id === partie && styles.actif]}>
        <Text style={styles.nom}>{p.nom}</Text>
      </Pressable>)}
    </View>
    {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
    {info ? <Text style={styles.succes}>{info}</Text> : null}
    {partie === 'fondamentales' && <View style={styles.section}>
      <Text style={styles.sousTitre}>Règles fondamentales — code protégé</Text>
      <Text style={styles.aide}>Source d’autorité : rules.ts, identiteNarrative.ts et noyau TypeScript. Ces règles ne sont pas des paramètres utilisateurs. Les profils de styles et d’aventure sont les seules interprétations éditables, sans contourner ces protections.</Text>
      <Text style={styles.nom}>Identité narrative (lecture seule)</Text>
      <Text style={styles.aide}>{IDENTITE_NARRATIVE}</Text>
      <Text style={styles.nom}>Sept règles non négociables (lecture seule)</Text>
      <Text style={styles.aide}>{REGLES_IMMUABLES}</Text>
      <Text style={styles.nom}>Responsabilités natives M01–M15</Text>
      <Text style={styles.aide}>{RESPONSABILITES_NARRATIVES.map(m => m.id + ' ' + m.nom).join('\n')}</Text>
      <Text style={styles.aide}>Priorité : règles immuables → état et canon → choix effectifs du joueur → interprétation éditable du style. Les profils Test/Benchmark ne sont pas publiés pour les joueurs. L’historique et la restauration se trouvent dans « Instantanés et historique ».</Text>
    </View>}
    {partie === 'styles' && <View style={styles.section}>
      <Text style={styles.sousTitre}>Styles narratifs — interprétation effective</Text>
      <Text style={styles.aide}>Quatre styles existants, sans ajouter de prompt parallèle. Chaque réglage remplace la formulation du champ Ton dans le prompt et s'applique au prochain tour ; il ne réécrit pas le passé. « Libre » est un style, pas le réglage de liberté du joueur.</Text>
      <Selection titre="Style à éditer" valeur={NOMS_STYLES[styleChoisi]}
        options={CLES_STYLES.map(k => NOMS_STYLES[k])}
        changer={v => setStyleChoisi(CLES_STYLES.find(k => NOMS_STYLES[k] === v) ?? styleChoisi)} bloque={operation}/>
      <Selection titre="Densité descriptive" valeur={narrateur.styles[styleChoisi].densite}
        options={OPTIONS_DENSITE} bloque={operation}
        changer={v => changerNarrateur({ ...narrateur, styles: { ...narrateur.styles,
          [styleChoisi]: { ...narrateur.styles[styleChoisi], densite: v as typeof OPTIONS_DENSITE[number] } } }, 'Style : densité ' + styleChoisi)}/>
      <Selection titre="Cadence" valeur={narrateur.styles[styleChoisi].cadence}
        options={OPTIONS_CADENCE} bloque={operation}
        changer={v => changerNarrateur({ ...narrateur, styles: { ...narrateur.styles,
          [styleChoisi]: { ...narrateur.styles[styleChoisi], cadence: v as typeof OPTIONS_CADENCE[number] } } }, 'Style : cadence ' + styleChoisi)}/>
      <Selection titre="Focalisation" valeur={narrateur.styles[styleChoisi].accent}
        options={OPTIONS_ACCENT} bloque={operation}
        changer={v => changerNarrateur({ ...narrateur, styles: { ...narrateur.styles,
          [styleChoisi]: { ...narrateur.styles[styleChoisi], accent: v as typeof OPTIONS_ACCENT[number] } } }, 'Style : focalisation ' + styleChoisi)}/>
      <Text style={styles.sousTitre}>Prévisualisation de l'instruction réellement injectée</Text>
      <Text style={styles.aide}>{instructionStyle(styleChoisi, narrateur.styles)}</Text>
      <Text style={styles.aide}>Comparaison A/B sans GPU : change de style ci-dessus pour comparer les formulations. Une comparaison des sorties du modèle requiert une session de test RunPod autorisée.</Text>
    </View>}
    {partie === 'aventures' && <View style={styles.section}>
      <Text style={styles.sousTitre}>Fourchettes de narration (tokens)</Text>
      <Text style={styles.aide}>Deux champs numériques par longueur. Les limites concernent uniquement le texte visible, pas le bloc d'état interne. La clôture naturelle reste prioritaire.</Text>
      {LONGUEURS.map(p => <View key={p.id} style={styles.ligne}>
        <Text style={styles.nom}>{p.nom}</Text>
        <View style={styles.champs}>
          <View style={styles.champ}><Text style={styles.aideMini}>Minimum</Text><TextInput style={styles.saisie} keyboardType="number-pad" selectTextOnFocus
            value={plagesSaisie?.[p.id].min ?? ''} onChangeText={v => setPlagesSaisie(prev => prev && ({ ...prev, [p.id]: { ...prev[p.id], min: v } }))}/></View>
          <View style={styles.champ}><Text style={styles.aideMini}>Maximum</Text><TextInput style={styles.saisie} keyboardType="number-pad" selectTextOnFocus
            value={plagesSaisie?.[p.id].max ?? ''} onChangeText={v => setPlagesSaisie(prev => prev && ({ ...prev, [p.id]: { ...prev[p.id], max: v } }))}/></View>
        </View>
      </View>)}
      <Pressable disabled={operation} onPress={enregistrerLongueurs} style={styles.bouton}><Text style={styles.boutonTexte}>Enregistrer les trois fourchettes</Text></Pressable>
      <Text style={styles.sousTitre}>Valeurs initiales des nouvelles aventures</Text>
      <Text style={styles.aide}>Ces valeurs sont proposées à l’ouverture de la création d’histoire. Le joueur peut les modifier ; ses choix sauvegardés priment ensuite et les histoires existantes ne changent pas. Les seuils du profil Grand public continuent de s’appliquer.</Text>
      {(Object.keys(OPTIONS_AVENTURE) as Array<keyof StorySettings>).map(cle =>
        <Selection key={cle} titre={LIBELLES_AVENTURE[cle]}
          valeur={String(narrateur.aventureDefaut[cle])}
          options={OPTIONS_AVENTURE[cle]}
          bloque={operation}
          changer={v => changerNarrateur({ ...narrateur,
            aventureDefaut: { ...narrateur.aventureDefaut, [cle]: v },
          }, 'Défaut aventure : ' + cle)}/>)}
      <Text style={styles.aide}>Le registre adulte/dark et l'intensité restent fonction de la scène et du profil : aucune intensité maximale permanente. M01/M08/M11 restent dans le noyau, sans interrupteur.</Text>
    </View>}
    {partie === 'technique' && <View style={styles.section}>
      <Text style={styles.sousTitre}>Échantillonnage — llama.cpp</Text>
      <Pressable disabled={operation} onPress={() => changerNarrateur({ ...narrateur, samplersActifs: !narrateur.samplersActifs }, 'Samplers narrateur')}
        style={[styles.bouton, narrateur.samplersActifs && styles.boutonActif]}>
        <Text style={styles.boutonTexte}>{narrateur.samplersActifs ? 'Samplers envoyés (compatibilité à vérifier)' : 'Autoriser l’envoi des samplers au pod'}</Text>
      </Pressable>
      <Text style={styles.aide}>Désactivés : llama.cpp conserve les valeurs de son serveur. Envoi activé : les 19 champs figurent dans la requête JSON, mais leur acceptation ET leur effet sur le modèle actif ne sont pas encore vérifiés sur RunPod. Aucun curseur ci-dessous ne doit être considéré comme certifié.</Text>
      <Curseur nom="Correction de température du joueur" valeur={valeurs.temperatureDelta}
        min={LIMITES_ATELIER.temperatureDelta.min} max={LIMITES_ATELIER.temperatureDelta.max}
        pas={LIMITES_ATELIER.temperatureDelta.pas} bloque={operation}
        onChange={v => void sauver({ profilActif: profil, profils: { ...config.profils,
          [profil]: { ...valeurs, temperatureDelta: v } } }, 'Température narrateur')} />
      {groupes.map(groupe => <View key={groupe}>
        <Text style={styles.sousTitre}>{groupe}</Text>
        {CLES_SAMPLERS.filter(k => SAMPLERS_LLAMA_CPP[k].groupe === groupe).map((cle: CleSampler) => {
          const spec = SAMPLERS_LLAMA_CPP[cle];
          return <Curseur key={cle} nom={spec.nom} valeur={narrateur.samplers[cle]}
            min={spec.min} max={spec.max} pas={spec.pas}
            bloque={operation || !narrateur.samplersActifs}
            onChange={v => changerNarrateur({ ...narrateur, samplers: { ...narrateur.samplers, [cle]: v } }, 'Sampler ' + cle)} />;
        })}
      </View>)}
      <Text style={styles.aide}>Température effective selon la créativité : faible {Math.max(0, Math.min(2, temperaturePourCreativite('faible') + valeurs.temperatureDelta)).toFixed(2)} · moyenne {Math.max(0, Math.min(2, temperaturePourCreativite('moyenne') + valeurs.temperatureDelta)).toFixed(2)} · élevée {Math.max(0, Math.min(2, temperaturePourCreativite('elevee') + valeurs.temperatureDelta)).toFixed(2)}. Chaque valeur est bornée entre 0 et 2.</Text>
      <Text style={styles.aide}>Mirostat peut neutraliser Top-K, Top-P et Typical-P ; certaines combinaisons avec température dynamique restent à tester. Paramètres non exposés : Top-A, TFS, Smoothing, Repeat Slope. Les vérifications en simulation ne prouvent pas la compatibilité du binaire RunPod.</Text>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  titre: { color: couleurs.texte, fontFamily: polices.titre, fontSize: 22, marginBottom: 10 },
  sousTitre: { color: couleurs.doreClair, fontFamily: polices.titre, fontSize: 19, marginVertical: 14 },
  aide: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  aideMini: { color: couleurs.texteAtténué, fontSize: 12 },
  nom: { color: couleurs.texte, fontFamily: polices.corpsMedium, fontSize: 15 },
  chiffre: { color: couleurs.doreClair, fontSize: 15, fontWeight: '600' },
  onglets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  onglet: { borderColor: couleurs.bordureSubtile, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  actif: { borderColor: couleurs.dore, backgroundColor: couleurs.fondCarte },
  section: { marginTop: 10 },
  ligne: { borderBottomColor: couleurs.bordureSubtile, borderBottomWidth: 1, paddingVertical: 12 },
  ligneEntete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  zoneCurseur: { height: 40, justifyContent: 'center', marginHorizontal: 8 },
  piste: { height: 6, backgroundColor: couleurs.fondProfond, borderRadius: 6, overflow: 'hidden' },
  progression: { height: '100%', backgroundColor: couleurs.accent },
  poignee: { position: 'absolute', top: 11, marginLeft: -9, height: 18, width: 18, borderRadius: 9, backgroundColor: couleurs.dore },
  desactive: { opacity: 0.4 },
  bornes: { flexDirection: 'row', justifyContent: 'space-between' },
  champs: { flexDirection: 'row', gap: 12, marginTop: 8 },
  champ: { flex: 1 },
  saisie: { color: couleurs.texte, borderColor: couleurs.bordureDoree, borderWidth: 1, borderRadius: 8, backgroundColor: couleurs.fondChampSaisie, fontSize: 18, padding: 10 },
  bouton: { backgroundColor: couleurs.accentSombre, borderRadius: 10, padding: 13, marginVertical: 12, alignItems: 'center' },
  boutonActif: { backgroundColor: couleurs.doreSombre },
  boutonTexte: { color: couleurs.texte, fontWeight: '600', fontSize: 14 },
  erreur: { color: couleurs.danger, marginBottom: 8 },
  succes: { color: couleurs.succes, marginBottom: 8 },
});
