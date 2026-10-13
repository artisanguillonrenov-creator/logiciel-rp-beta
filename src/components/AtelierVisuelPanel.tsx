import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CONSIGNE_EXTRACTION_PAR_DEFAUT } from '../engine/extracteurVisuel';
import { capacitesGenerateurCourant } from '../engine/serviceVisuel';
import type { CapacitesGenerateur } from '../engine/fournisseursImages';
import {
  anciennesConsignesArchivees, motsClesStyle, reglagesVisuelsInitiaux, restaurerStyleParDefaut, validerReglagesVisuels,
  TAILLES_PORTRAIT, TAILLES_SCENE,
  type CadrageIllustration, type PrioriteIllustration, type ReferencesActivees, type ReglagesVisuels,
} from '../concepteur/reglagesVisuels';
import { enregistrerReglagesVisuels, lireReglagesVisuels, remigrerDepuisAncienneConfiguration } from '../concepteur/reglagesVisuelsStore';
import { couleurs, espacement, polices } from '../theme/theme';
import Bouton from './Bouton';
import AtelierApercuImage from './AtelierApercuImage';

const CADRAGES: Array<{ id: CadrageIllustration; titre: string; detail: string }> = [
  { id: 'automatique', titre: 'Automatique selon la scène', detail: 'Prise de vue déduite du type de scène relevé (dialogue, combat, paysage…).' },
  { id: 'moyen', titre: 'Plan moyen', detail: 'Personnages et interactions avec un décor identifiable.' },
  { id: 'large', titre: 'Plan large — recommandé', detail: 'Scène entière et personnages intégrés à leur environnement.' },
  { id: 'ensemble', titre: 'Très grand plan d’ensemble', detail: 'Décor monumental, personnages plus petits dans l’image.' },
];
const PRIORITES: Array<{ id: PrioriteIllustration; titre: string; detail: string }> = [
  { id: 'equilibree', titre: 'Équilibrée', detail: 'Même importance aux personnages et au décor.' },
  { id: 'decor', titre: 'Décor et mise en scène', detail: 'Architecture, espace, lumière et profondeur en priorité.' },
  { id: 'action', titre: 'Action et interactions', detail: 'Gestes et actions du récit avec leur environnement.' },
];
const REFERENCES: Array<{ id: keyof ReferencesActivees; titre: string; detail: string }> = [
  { id: 'personnages', titre: 'Portraits des personnages visibles (scènes)', detail: 'Aident à garder les visages ; selon le générateur, peuvent resserrer le cadrage. Les portraits utilisent toujours le visage du sujet.' },
  { id: 'races', titre: 'Portraits de races', detail: 'Allure et carnation canoniques des races (portraits prédéfinis fiables).' },
  { id: 'lieux', titre: 'Images du lorebook', detail: 'Lieux, bâtiments et objets rattachés aux fiches, seulement pour le lieu actuel.' },
  { id: 'scenePrecedente', titre: 'Scène précédente', detail: 'Seulement si elle se passe au même lieu (sinon écartée, avec la raison au diagnostic).' },
];
const SECTIONS = [
  '01 — Identité artistique globale',
  '02 — Consignes et mots-clés universels',
  '03 — Composition et cadrage',
  '04 — Références et continuité',
  '05 — Paramètres techniques compatibles',
  '06 — Aperçu et diagnostic',
] as const;

const erreurTexte = (e: unknown) => (e instanceof Error ? e.message : 'Enregistrement impossible.');
const nombreOuNull = (t: string): number | null => {
  const n = Number(t.replace(',', '.'));
  return t.trim() === '' || !Number.isFinite(n) ? null : n;
};

export default function AtelierVisuelPanel() {
  const [edite, setEdite] = useState<ReglagesVisuels>(reglagesVisuelsInitiaux());
  const [initial, setInitial] = useState<ReglagesVisuels | null>(null);
  const [charge, setCharge] = useState(true);
  const [operation, setOperation] = useState(false);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [ouverte, setOuverte] = useState<number>(0);
  const [capacites, setCapacites] = useState<CapacitesGenerateur | null>(null);
  const [raisonCapacites, setRaisonCapacites] = useState('');
  const [nomModule, setNomModule] = useState('');

  useEffect(() => {
    let actif = true;
    lireReglagesVisuels().then((v) => { if (actif) { setEdite(v); setInitial(v); } })
      .catch((e) => { if (actif) setErreur(erreurTexte(e)); })
      .finally(() => { if (actif) setCharge(false); });
    // Lecture des capacités : aucune génération, aucun démarrage de pod.
    capacitesGenerateurCourant().then((c) => { if (actif) setCapacites(c); })
      .catch((e) => { if (actif) setRaisonCapacites(erreurTexte(e)); });
    return () => { actif = false; };
  }, []);

  const changements = !!initial && JSON.stringify(initial) !== JSON.stringify(edite);
  const changer = (patch: Partial<ReglagesVisuels>) => setEdite((v) => ({ ...v, ...patch }));

  async function sauvegarder(valeur: ReglagesVisuels, succes = 'Réglages actifs pour toutes les prochaines images (scènes, portraits, aperçus). Les images existantes ne changent pas.') {
    setOperation(true); setMessage(''); setErreur('');
    try {
      const config = await enregistrerReglagesVisuels(validerReglagesVisuels(valeur));
      setEdite(config); setInitial(config); setMessage(succes);
    } catch (e) { setErreur(erreurTexte(e)); } finally { setOperation(false); }
  }

  const nonPrisEnCharge = (supporte: boolean | undefined) => capacites && !supporte
    ? <Text style={styles.alerte}>Non pris en charge par {capacites.nom} : ne sera pas envoyé.</Text> : null;

  const choix = <T extends string>(liste: Array<{ id: T; titre: string; detail: string }>, valeur: T, appliquer: (v: T) => void) =>
    liste.map((x) => <Pressable key={x.id} disabled={operation} accessibilityRole="radio" accessibilityState={{ checked: valeur === x.id }}
      onPress={() => appliquer(x.id)} style={[styles.choix, valeur === x.id && styles.actif]}>
      <Text style={styles.nom}>{valeur === x.id ? '● ' : '○ '}{x.titre}</Text>
      <Text style={styles.aide}>{x.detail}</Text>
    </Pressable>);

  const champTexte = (titre: string, valeur: string, appliquer: (t: string) => void, max: number, aide?: string, hauteur = 90) => <View>
    <Text style={styles.label}>{titre}</Text>
    {aide ? <Text style={styles.aide}>{aide}</Text> : null}
    <TextInput value={valeur} onChangeText={appliquer} multiline maxLength={max} textAlignVertical="top"
      style={[styles.champ, { minHeight: hauteur }]} placeholderTextColor={couleurs.texteFaible} placeholder="(vide)" />
  </View>;

  const numerique = (titre: string, valeur: number | null, appliquer: (n: number | null) => void, supporte: boolean | undefined) => <View>
    <View style={styles.poids}>
      <Text style={[styles.aide, { flex: 1 }]}>{titre}</Text>
      <TextInput style={[styles.champ, { minHeight: 42, width: 95, textAlign: 'center' }]} keyboardType="numeric"
        value={valeur === null ? '' : String(valeur)} placeholder="Défaut" placeholderTextColor={couleurs.texteFaible}
        onChangeText={(t) => appliquer(nombreOuNull(t))} />
    </View>
    {valeur !== null ? nonPrisEnCharge(supporte) : null}
  </View>;

  const modules = (titre: string, valeur: Record<string, number>, appliquer: (m: Record<string, number>) => void) => <View>
    <Text style={styles.label}>{titre}</Text>
    {Object.keys(valeur).length ? null : <Text style={styles.aide}>Aucun module : rien n’est demandé au générateur.</Text>}
    {Object.entries(valeur).map(([nom, poids]) => <View key={nom} style={styles.poids}>
      <Text style={[styles.aide, { flex: 1 }]}>{nom}</Text>
      <Bouton titre="−" variante="secondaire" onPress={() => appliquer({ ...valeur, [nom]: Math.max(0, Number((poids - 0.1).toFixed(2))) })} />
      <Text style={styles.nom}>{poids.toFixed(2)}</Text>
      <Bouton titre="+" variante="secondaire" onPress={() => appliquer({ ...valeur, [nom]: Math.min(1.5, Number((poids + 0.1).toFixed(2))) })} />
      <Bouton titre="✕" variante="secondaire" onPress={() => { const suite = { ...valeur }; delete suite[nom]; appliquer(suite); }} />
    </View>)}
    <TextInput style={[styles.champ, { minHeight: 42 }]} value={nomModule} onChangeText={setNomModule}
      placeholder="Nom d’un module installé sur le générateur" autoCapitalize="none" placeholderTextColor={couleurs.texteFaible} />
    <Bouton titre="Ajouter ce module (0,5)" variante="secondaire" onPress={() => {
      const nom = nomModule.trim();
      if (/^[a-z0-9_-]{1,40}$/i.test(nom)) { appliquer({ ...valeur, [nom]: 0.5 }); setNomModule(''); }
    }} />
    {Object.keys(valeur).length ? nonPrisEnCharge(capacites?.modules) : null}
  </View>;

  const tailles = (titre: string, options: readonly string[], valeur: string, appliquer: (t: string) => void, format: '16:9' | '3:4') => <View>
    <Text style={styles.label}>{titre}</Text>
    <View style={styles.ligneChoix}>{options.map((t) => <Pressable key={t} style={[styles.choix, valeur === t && styles.actif]} onPress={() => appliquer(t)}>
      <Text style={styles.nom}>{valeur === t ? '● ' : '○ '}{t}</Text></Pressable>)}</View>
    {capacites && capacites.tailles === null ? <Text style={styles.alerte}>{capacites.nom} impose ses dimensions : ce réglage ne sera pas envoyé.</Text>
      : capacites?.tailles && !capacites.tailles[format].includes(valeur) ? <Text style={styles.alerte}>Taille refusée par {capacites.nom}.</Text> : null}
  </View>;

  const section = (index: number, contenu: React.ReactNode) => <View key={index} style={styles.section}>
    <Pressable onPress={() => setOuverte(ouverte === index ? -1 : index)} accessibilityRole="button" accessibilityState={{ expanded: ouverte === index }}>
      <Text style={styles.titreSection}>{ouverte === index ? '▾ ' : '▸ '}{SECTIONS[index]}</Text>
    </Pressable>
    {ouverte === index ? <View style={styles.contenu}>{contenu}</View> : null}
  </View>;

  const archives = anciennesConsignesArchivees(edite);
  const notesMigration = edite.archives.flatMap((a) => a.notes);

  return <View>
    <Text style={styles.titre}>Atelier visuel</Text>
    <Text style={styles.aide}>Une seule configuration pour toutes les images : illustrations, portraits, aperçus et futures images. Le narrateur ne fournit que des mots-clés factuels ; le style vient d’ici.</Text>
    {capacites ? <Text style={styles.aide}>Générateur actuel : {capacites.nom} (capacités {capacites.source}).</Text>
      : raisonCapacites ? <Text style={styles.alerte}>Générateur : {raisonCapacites}</Text> : null}
    {charge ? <ActivityIndicator color={couleurs.accent} /> : <>
      {section(0, <>
        <Text style={styles.aide}>Le même style s’applique à toutes les images ; scène et portrait ne diffèrent que par le format et le cadrage.</Text>
        {champTexte('Nom du style', edite.style.nom, (t) => changer({ style: { ...edite.style, nom: t } }), 80, undefined, 44)}
        {champTexte('Mots-clés du style (anglais, séparés par des virgules)', edite.style.motsCles, (t) => changer({ style: { ...edite.style, motsCles: t } }), 600,
          'Ajoutés par l’application après la description de la scène.', 110)}
        {champTexte('Description', edite.style.description, (t) => changer({ style: { ...edite.style, description: t } }), 600, undefined, 70)}
        <Text style={styles.label}>Intensité du style</Text>
        <View style={styles.ligne}>
          <Bouton titre="−" variante="secondaire" desactive={operation || edite.intensite <= 0.7}
            onPress={() => changer({ intensite: Math.max(0.7, Number((edite.intensite - 0.1).toFixed(2))) })} />
          <Text style={styles.nom}>{edite.intensite.toFixed(1)} ×</Text>
          <Bouton titre="+" variante="secondaire" desactive={operation || edite.intensite >= 1.3}
            onPress={() => changer({ intensite: Math.min(1.3, Number((edite.intensite + 0.1).toFixed(2))) })} />
        </View>
        <Text style={styles.aide}>Mots de style ajoutés : {motsClesStyle(edite).join(', ')}</Text>
        <Bouton titre="Restaurer le style par défaut" variante="secondaire" desactive={operation}
          onPress={() => Alert.alert('Restaurer le style par défaut ?', 'Seuls le style et son intensité reviennent à « Cinéma façon Quentin Tarantino ». Tous les autres réglages, images, histoires et paramètres sont conservés.', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Restaurer', onPress: () => void sauvegarder(restaurerStyleParDefaut(edite), 'Style par défaut restauré ; le reste est inchangé.') },
          ])} style={styles.bouton} />
      </>)}
      {section(1, <>
        {champTexte('Consigne d’extraction du narrateur (toutes les images)', edite.consigneExtraction ?? CONSIGNE_EXTRACTION_PAR_DEFAUT,
          (t) => changer({ consigneExtraction: t }), 8000,
          'Une seule consigne pour scènes, portraits et futurs sujets. Le narrateur y relève des mots-clés factuels ; il ne choisit jamais le style. Le format de réponse (JSON) est fixe et ajouté automatiquement.', 240)}
        <Bouton titre="Restaurer la consigne d’origine" variante="secondaire" desactive={operation} onPress={() => changer({ consigneExtraction: null })} />
        {champTexte('Positif global (ajouté à toutes les images)', edite.positif, (t) => changer({ positif: t }), 500)}
        {champTexte('Négatif global (exclusions de toutes les images)', edite.negatif, (t) => changer({ negatif: t }), 700,
          'Les protections du profil Grand public s’ajoutent toujours, séparément ; elles ne sont jamais remplacées.')}
        {nonPrisEnCharge(capacites?.negatif)}
        {archives.length ? <>
          <Text style={styles.label}>Anciennes consignes archivées (non utilisées)</Text>
          {archives.map((a, i) => <View key={i} style={styles.choix}>
            <Text style={styles.nom}>{a.titre}</Text>
            <Text style={styles.aide} selectable numberOfLines={8}>{a.texte}</Text>
            <Bouton titre="Copier dans la consigne universelle" variante="secondaire" onPress={() => changer({ consigneExtraction: a.texte })} />
          </View>)}
        </> : null}
        {notesMigration.length ? <>
          <Text style={styles.label}>Migration vers l’Atelier V3</Text>
          {notesMigration.map((n, i) => <Text key={i} style={styles.aide}>• {n}</Text>)}
        </> : null}
      </>)}
      {section(2, <>
        <Text style={styles.label}>Cadrage des illustrations de scène (16:9)</Text>
        {choix(CADRAGES, edite.cadrageIllustration, (v) => changer({ cadrageIllustration: v }))}
        <Text style={styles.label}>Priorité de composition</Text>
        {choix(PRIORITES, edite.prioriteIllustration, (v) => changer({ prioriteIllustration: v }))}
        <Text style={styles.label}>Éviter les portraits dans les scènes</Text>
        <Pressable disabled={operation} accessibilityRole="switch" accessibilityState={{ checked: edite.eviterPortraitScene }}
          onPress={() => changer({ eviterPortraitScene: !edite.eviterPortraitScene })} style={[styles.choix, edite.eviterPortraitScene && styles.actif]}>
          <Text style={styles.nom}>{edite.eviterPortraitScene ? 'Activé — scènes en priorité' : 'Désactivé — gros plans autorisés'}</Text>
          <Text style={styles.aide}>Évite les cadrages tête/buste dans les illustrations. Les portraits (3:4) gardent leur cadrage.</Text>
        </Pressable>
        <Text style={styles.aide}>Une régénération garde la scène enregistrée et ne change que la prise de vue demandée.</Text>
      </>)}
      {section(3, <>
        {REFERENCES.map((r) => <Pressable key={r.id} disabled={operation} accessibilityRole="switch" accessibilityState={{ checked: edite.references[r.id] }}
          onPress={() => changer({ references: { ...edite.references, [r.id]: !edite.references[r.id] } })}
          style={[styles.choix, edite.references[r.id] && styles.actif]}>
          <Text style={styles.nom}>{edite.references[r.id] ? '● ' : '○ '}{r.titre}</Text>
          <Text style={styles.aide}>{r.detail}</Text>
        </Pressable>)}
        {capacites ? <Text style={capacites.references.supportees ? styles.aide : styles.alerte}>
          {capacites.references.supportees
            ? `${capacites.nom} accepte jusqu’à ${capacites.references.max} images (${capacites.references.maxVisages} visages)${capacites.references.roles.length ? '' : ', sans distinguer leur rôle'}.`
            : `${capacites.nom} n’accepte pas d’images de référence : seule la description canonique est transmise.`}
        </Text> : null}
        <Text style={styles.aide}>Changer ces réglages ne lance aucune génération. Le diagnostic de chaque image liste les références disponibles, retenues et écartées.</Text>
      </>)}
      {section(4, <>
        <Text style={styles.aide}>Réglages techniques par format (jamais un second style). Un paramètre que le générateur ne prend pas en charge n’est pas envoyé.</Text>
        {modules('Modules communs (tous formats)', edite.modules, (m) => changer({ modules: m }))}
        <Text style={styles.label}>Format scène 16:9</Text>
        {tailles('Résolution', TAILLES_SCENE, edite.scene.taille, (t) => changer({ scene: { ...edite.scene, taille: t as ReglagesVisuels['scene']['taille'] } }), '16:9')}
        {numerique('Étapes (1–80)', edite.scene.pas, (n) => changer({ scene: { ...edite.scene, pas: n } }), capacites?.pas)}
        {numerique('Guidance (0,1–20)', edite.scene.guidance, (n) => changer({ scene: { ...edite.scene, guidance: n } }), capacites?.guidance)}
        {numerique('Graine fixe (vide = aléatoire)', edite.scene.graine, (n) => changer({ scene: { ...edite.scene, graine: n } }), capacites?.graine)}
        {champTexte('Précision positive du format scène', edite.scene.positif, (t) => changer({ scene: { ...edite.scene, positif: t } }), 500, undefined, 56)}
        {champTexte('Précision négative du format scène', edite.scene.negatif, (t) => changer({ scene: { ...edite.scene, negatif: t } }), 500, undefined, 56)}
        {modules('Modules du format scène', edite.scene.modules, (m) => changer({ scene: { ...edite.scene, modules: m } }))}
        <Text style={styles.label}>Format portrait 3:4</Text>
        {tailles('Résolution', TAILLES_PORTRAIT, edite.portrait.taille, (t) => changer({ portrait: { ...edite.portrait, taille: t as ReglagesVisuels['portrait']['taille'] } }), '3:4')}
        {numerique('Étapes (1–80)', edite.portrait.pas, (n) => changer({ portrait: { ...edite.portrait, pas: n } }), capacites?.pas)}
        {numerique('Guidance (0,1–20)', edite.portrait.guidance, (n) => changer({ portrait: { ...edite.portrait, guidance: n } }), capacites?.guidance)}
        {numerique('Graine fixe (vide = aléatoire)', edite.portrait.graine, (n) => changer({ portrait: { ...edite.portrait, graine: n } }), capacites?.graine)}
        {numerique('Poids de la référence de race (0–1,5)', edite.portrait.poidsReferenceRace, (n) => changer({ portrait: { ...edite.portrait, poidsReferenceRace: n } }), capacites?.poidsReference)}
        {champTexte('Précision positive du format portrait', edite.portrait.positif, (t) => changer({ portrait: { ...edite.portrait, positif: t } }), 500, undefined, 56)}
        {champTexte('Précision négative du format portrait', edite.portrait.negatif, (t) => changer({ portrait: { ...edite.portrait, negatif: t } }), 500, undefined, 56)}
        {modules('Modules du format portrait', edite.portrait.modules, (m) => changer({ portrait: { ...edite.portrait, modules: m } }))}
      </>)}
      <Bouton titre="Enregistrer les réglages visuels" desactive={operation || !changements} onPress={() => void sauvegarder(edite)} style={styles.bouton} />
      {changements ? <Text style={styles.aide}>Modifications non enregistrées : l’aperçu utilise les réglages enregistrés.</Text> : null}
      <Bouton titre="Réinitialiser les préférences visuelles" variante="secondaire" desactive={operation}
        onPress={() => Alert.alert('Réinitialiser les préférences visuelles ?', 'Seuls les réglages de cet Atelier reviennent aux valeurs d’origine (les archives de migration sont gardées). Histoires, images, avatars, lorebook, pod et narrateur ne sont pas touchés.', [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Réinitialiser', onPress: () => void sauvegarder({ ...reglagesVisuelsInitiaux(), archives: edite.archives }) },
        ])} style={styles.bouton} />
      {edite.archives.length ? <Bouton titre="Refaire la migration depuis l’ancienne configuration" variante="secondaire" desactive={operation}
        onPress={() => Alert.alert('Revenir à la configuration migrée ?', 'Les réglages V3 actuels seront remplacés par la conversion de l’ancienne configuration (toujours conservée sur l’appareil).', [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Refaire', onPress: () => { setOperation(true); remigrerDepuisAncienneConfiguration().then((v) => { setEdite(v); setInitial(v); setMessage('Configuration migrée restaurée.'); }).catch((e) => setErreur(erreurTexte(e))).finally(() => setOperation(false)); } },
        ])} style={styles.bouton} /> : null}
      {section(5, <AtelierApercuImage />)}
    </>}
    {operation ? <ActivityIndicator color={couleurs.accent} /> : null}
    {message ? <Text style={styles.succes}>{message}</Text> : null}
    {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  titre: { color: couleurs.texte, fontFamily: polices.titre, fontSize: 21, marginBottom: espacement.sm },
  titreSection: { color: couleurs.doreClair, fontFamily: polices.corpsMedium, fontSize: 17, paddingVertical: 10 },
  section: { borderBottomWidth: 1, borderBottomColor: couleurs.bordureSubtile },
  contenu: { paddingBottom: 12, gap: 4 },
  label: { color: couleurs.doreClair, fontFamily: polices.corpsMedium, fontSize: 15, marginTop: espacement.md, marginBottom: 6 },
  aide: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 14, lineHeight: 20 },
  alerte: { color: couleurs.danger, fontFamily: polices.corps, fontSize: 13, lineHeight: 18 },
  nom: { color: couleurs.texte, fontFamily: polices.corpsMedium, fontSize: 16 },
  choix: { borderWidth: 1, borderColor: couleurs.bordureSubtile, borderRadius: 10, padding: 12, marginVertical: 4, gap: 4 },
  ligneChoix: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actif: { borderColor: couleurs.dore, backgroundColor: couleurs.fondCarte },
  ligne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginVertical: 6 },
  champ: { minHeight: 90, padding: 12, borderWidth: 1, borderColor: couleurs.bordureSubtile, borderRadius: 10, color: couleurs.texte, backgroundColor: couleurs.fondChampSaisie },
  poids: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6, borderBottomWidth: 1, borderBottomColor: couleurs.bordureSubtile, paddingVertical: 6 },
  bouton: { marginVertical: 8 },
  succes: { color: couleurs.succes, marginVertical: 6 },
  erreur: { color: couleurs.danger, marginVertical: 6 },
});
