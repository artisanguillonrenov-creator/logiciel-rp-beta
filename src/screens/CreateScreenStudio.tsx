import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type {
  Creativite,
  LiberteJoueur,
  Longueur,
  NiveauQuatre,
  NiveauViolence,
  Persona,
  ProfilContenu,
  RythmeHistoire,
  TonHistoire,
} from '../types';
import { MONDES } from '../data/mondes';
import { RACES_ELYNDOR } from '../data/races';
import { obtenirPortrait } from '../data/portraits';
import { LIEUX_DEPART } from '../data/lieuxDepart';
import { SITUATIONS_PAR_LIEU } from '../data/situationsDepart';
import elyndorLoreRaw from '../data/elyndorLore.json';
import { chargerLoreElyndor } from '../engine/loreLoader';
import { genererScenarioDepart } from '../engine/scenarioGenerator';
import { genererMessageOuverture } from '../engine/openingGenerator';
import { creerNouvelleHistoire } from '../engine/story';
import { getPersonas, getSettings, savePersona, saveStory } from '../storage/storage';
import { validerEntreeUtilisateur, valeursAutoriseesRomance, valeursAutoriseesViolence } from '../engine/contenuAdulte';
import { couleurs, espacement, interfaceV2, interlettrage, polices, rayon, stylePetitesCapitales } from '../theme/theme';
import Bouton from '../components/Bouton';
import Champ from '../components/Champ';
import FondAtmospherique from '../components/FondAtmospherique';
import IndicateurEtapes from '../components/IndicateurEtapes';
import Separateur from '../components/Separateur';
import { useLangue } from '../i18n/LangueProvider';

const IMAGES_ETAPES = [
  require('../../assets/scenes/creation-histoire.png'),
  require('../../assets/scenes/creation-personnage.png'),
  require('../../assets/scenes/creation-point-depart.png'),
  require('../../assets/scenes/creation-preferences.png'),
  require('../../assets/scenes/accueil.png'),
];

const LORE_ELYNDOR = chargerLoreElyndor(elyndorLoreRaw as any);
const ETAPES = ['Monde', 'Personnage', 'Départ', 'Style', 'Résumé'] as const;

type Props = NativeStackScreenProps<RootStackParamList, 'Creation'>;
type Option<T extends string> = { valeur: T; label: string };

const OPTIONS_SEXE: Option<string>[] = [
  { valeur: 'Homme', label: 'Homme' },
  { valeur: 'Femme', label: 'Femme' },
  { valeur: 'Autre', label: 'Androgyne' },
];
const OPTIONS_CREATIVITE: Option<Creativite>[] = [
  { valeur: 'faible', label: 'Précise' },
  { valeur: 'moyenne', label: 'Équilibrée' },
  { valeur: 'elevee', label: 'Imprévisible' },
];
const OPTIONS_LONGUEUR: Option<Longueur>[] = [
  { valeur: 'courte', label: 'Courte' },
  { valeur: 'moyenne', label: 'Moyenne' },
  { valeur: 'longue', label: 'Longue' },
];
const OPTIONS_RYTHME: Option<RythmeHistoire>[] = [
  { valeur: 'lent', label: 'Lent' },
  { valeur: 'normal', label: 'Normal' },
  { valeur: 'rapide', label: 'Rapide' },
];
const OPTIONS_LIBERTE: Option<LiberteJoueur>[] = [
  { valeur: 'faible', label: 'Guidée' },
  { valeur: 'moderee', label: 'Souple' },
  { valeur: 'elevee', label: 'Libre' },
  { valeur: 'totale', label: 'Totale' },
];
const OPTIONS_VIOLENCE: Option<NiveauViolence>[] = [
  { valeur: 'faible', label: 'Faible' },
  { valeur: 'modere', label: 'Modérée' },
  { valeur: 'eleve', label: 'Élevée' },
  { valeur: 'extreme', label: 'Extrême' },
];
const OPTIONS_ROMANCE: Option<NiveauQuatre>[] = [
  { valeur: 'aucun', label: 'Aucune' },
  { valeur: 'faible', label: 'Faible' },
  { valeur: 'modere', label: 'Modérée' },
  { valeur: 'eleve', label: 'Élevée' },
];
const OPTIONS_HUMOUR: Option<NiveauQuatre>[] = [
  { valeur: 'aucun', label: 'Aucun' },
  { valeur: 'faible', label: 'Faible' },
  { valeur: 'modere', label: 'Modéré' },
  { valeur: 'eleve', label: 'Élevé' },
];

const STYLES_RECIT: { valeur: TonHistoire; titre: string; description: string; image: number }[] = [
  {
    valeur: 'heroique_epique',
    titre: 'Cinématique',
    description: 'Scènes fortes, descriptions visuelles et progression soutenue.',
    image: IMAGES_ETAPES[0],
  },
  {
    valeur: 'sombre_realiste',
    titre: 'Immersif',
    description: 'Un monde crédible, plus dense, plus sombre et plus sensoriel.',
    image: IMAGES_ETAPES[3],
  },
  {
    valeur: 'mysterieux_intrigant',
    titre: 'Libre',
    description: 'Secrets, exploration et davantage d’espace laissé à tes initiatives.',
    image: IMAGES_ETAPES[2],
  },
  {
    valeur: 'leger_aventureux',
    titre: 'Aventure',
    description: 'Rythme plus léger, découverte et sentiment de voyage.',
    image: IMAGES_ETAPES[4],
  },
];

function genererIdPersona(): string {
  return `persona-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function GroupeOptions<T extends string>({
  options,
  valeur,
  onChange,
  autorisees,
}: {
  options: Option<T>[];
  valeur: T;
  onChange: (v: T) => void;
  autorisees?: T[];
}) {
  const { t } = useLangue();
  return (
    <View style={styles.groupeOptions}>
      {options.map((option) => {
        const bloque = !!autorisees && !autorisees.includes(option.valeur);
        const actif = valeur === option.valeur && !bloque;
        return (
          <Pressable
            key={option.valeur}
            disabled={bloque}
            onPress={() => onChange(option.valeur)}
            style={({ pressed }) => [
              styles.puceOption,
              actif && styles.puceOptionActive,
              bloque && styles.puceOptionBloquee,
              pressed && !bloque && styles.presse,
            ]}
          >
            <Text style={[styles.textePuceOption, actif && styles.textePuceOptionActif]}>{t(option.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TitreEtape({ index, titre, sousTitre }: { index: number; titre: string; sousTitre: string }) {
  const { t } = useLangue();
  return (
    <View style={styles.enteteEtape}>
      <View style={styles.ligneTitreEtape}>
        <Text style={styles.runeTitre}>✦</Text>
        <Text style={styles.titreEtape}>{t(titre)}</Text>
        <Text style={styles.numeroEtape}>{index + 1} / {ETAPES.length}</Text>
      </View>
      <Text style={styles.sousTitreEtape}>{t(sousTitre)}</Text>
    </View>
  );
}

export default function CreateScreenStudio({ navigation }: Props) {
  const { t } = useLangue();
  const { width } = useWindowDimensions();
  const tablette = width >= 900;

  const [etape, setEtape] = useState(0);
  const [profilContenu, setProfilContenu] = useState<ProfilContenu | undefined>(undefined);
  const [mondeSelectionne, setMondeSelectionne] = useState(MONDES[0]?.id ?? '');
  const [nom, setNom] = useState('');
  const [sexe, setSexe] = useState('Femme');
  const [raceOrigine, setRaceOrigine] = useState(RACES_ELYNDOR[0]?.nom ?? '');
  const [age, setAge] = useState('');
  const [apparence, setApparence] = useState('');
  const [description, setDescription] = useState('');
  const [lieu, setLieu] = useState('');
  const [situationDepart, setSituationDepart] = useState('');
  const [scenario, setScenario] = useState('');
  const [generationEnCours, setGenerationEnCours] = useState(false);
  const [erreurGeneration, setErreurGeneration] = useState('');
  const [ton, setTon] = useState<TonHistoire>('sombre_realiste');
  const [creativite, setCreativite] = useState<Creativite>('moyenne');
  const [longueur, setLongueur] = useState<Longueur>('moyenne');
  const [violence, setViolence] = useState<NiveauViolence>('modere');
  const [romance, setRomance] = useState<NiveauQuatre>('modere');
  const [humour, setHumour] = useState<NiveauQuatre>('faible');
  const [liberteJoueur, setLiberteJoueur] = useState<LiberteJoueur>('elevee');
  const [rythme, setRythme] = useState<RythmeHistoire>('normal');
  const [avancesOuverts, setAvancesOuverts] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [modalPersonasOuvert, setModalPersonasOuvert] = useState(false);
  const [messagePersona, setMessagePersona] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    getSettings().then((settings) => setProfilContenu(settings.profilContenu)).catch(() => {});
    getPersonas().then(setPersonas).catch(() => {});
  }, []);

  const mondeActif = MONDES.find((m) => m.id === mondeSelectionne) ?? MONDES[0];
  const raceActive = RACES_ELYNDOR.find((r) => r.nom === raceOrigine) ?? RACES_ELYNDOR[0];
  const portraitActif = obtenirPortrait(raceActive?.id, sexe);
  const lieuActif = LIEUX_DEPART.find((l) => l.nom === lieu);
  const situationsDisponibles = lieuActif ? SITUATIONS_PAR_LIEU[lieuActif.id] ?? [] : [];
  const situationActive = situationsDisponibles.find((s) => s.nom === situationDepart);
  const violenceAutorisee = valeursAutoriseesViolence(profilContenu);
  const romanceAutorisee = valeursAutoriseesRomance(profilContenu);

  useEffect(() => {
    if (profilContenu !== 'grand_public') return;
    setViolence((v) => (violenceAutorisee.includes(v) ? v : violenceAutorisee[violenceAutorisee.length - 1]));
    setRomance((v) => (romanceAutorisee.includes(v) ? v : romanceAutorisee[romanceAutorisee.length - 1]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilContenu]);

  const etapeValide = useMemo(() => {
    if (etape === 0) return !!mondeActif;
    if (etape === 1) return !!nom.trim() && !!raceOrigine.trim() && !!description.trim();
    if (etape === 2) return !!lieu.trim();
    return true;
  }, [etape, mondeActif, nom, raceOrigine, description, lieu]);

  function choisirPersona(persona: Persona) {
    setNom(persona.nom);
    setDescription(persona.description);
    setSexe(persona.sexe ?? 'Femme');
    setRaceOrigine(persona.raceOrigine ?? RACES_ELYNDOR[0]?.nom ?? '');
    setAge(persona.age ?? '');
    setApparence(persona.apparence ?? '');
    setModalPersonasOuvert(false);
  }

  async function enregistrerPersonaDansBibliotheque() {
    if (!nom.trim() || !description.trim()) return;
    const controle = validerEntreeUtilisateur([nom, apparence, description].join('\n'), profilContenu);
    if (!controle.ok) {
      setMessagePersona(controle.motif);
      return;
    }
    const persona: Persona = {
      id: genererIdPersona(),
      nom: nom.trim(),
      description: description.trim(),
      createdAt: Date.now(),
      sexe: sexe || undefined,
      raceOrigine: raceOrigine || undefined,
      age: age.trim() || undefined,
      apparence: apparence.trim() || undefined,
    };
    await savePersona(persona);
    setPersonas((prev) => [...prev, persona]);
    setMessagePersona(t('Personnage enregistré dans la bibliothèque.'));
  }

  function choisirLieu(nomLieu: string) {
    setLieu(nomLieu);
    setSituationDepart('');
  }

  function composerDescriptionPersonnage(): string {
    return [
      sexe ? `Sexe : ${sexe}` : '',
      raceOrigine ? `Race / origine : ${raceOrigine}` : '',
      age.trim() ? `Âge : ${age.trim()}` : '',
      apparence.trim() ? `Apparence : ${apparence.trim()}` : '',
      description.trim(),
    ].filter(Boolean).join('\n');
  }

  function composerPointDeDepart(): string {
    if (scenario.trim()) return scenario.trim();
    const morceauLieu = lieuActif
      ? `à ${lieuActif.nom}${lieuActif.description ? ` (${lieuActif.description.replace(/\.$/, '')})` : ''}`
      : '';
    const morceauSituation = situationActive ? `pour ${situationActive.nom.toLowerCase()}` : '';
    return [`${nom.trim() || 'Le personnage'} arrive ${morceauLieu}`.trim(), morceauSituation].filter(Boolean).join(', ') + '.';
  }

  async function genererScenario() {
    if (generationEnCours || !lieuActif) return;
    setGenerationEnCours(true);
    setErreurGeneration('');
    try {
      const settings = await getSettings();
      const extraitLore = LORE_ELYNDOR.find((e) => e.titre.toLowerCase() === lieuActif.nom.toLowerCase())?.contenu;
      const texte = await genererScenarioDepart({
        appSettings: settings,
        mondeNom: mondeActif?.nom,
        mondeDescription: mondeActif?.description,
        personnageNom: nom.trim(),
        sexe: sexe || undefined,
        raceNom: raceActive?.nom,
        raceDescription: raceActive?.description,
        age: age.trim() || undefined,
        apparence: apparence.trim() || undefined,
        description: description.trim() || undefined,
        lieuNom: lieuActif.nom,
        lieuDescription: lieuActif.description,
        situationNom: situationActive?.nom,
        situationDescription: situationActive?.description,
        extraitLore,
      });
      setScenario(texte);
    } catch (e) {
      setErreurGeneration(e instanceof Error ? e.message : t('Échec de la génération.'));
    } finally {
      setGenerationEnCours(false);
    }
  }

  function texteLibreEtape(index: number): string {
    if (index === 1) return [nom, apparence, description].join('\n');
    if (index === 2) return scenario;
    return '';
  }

  function suivant() {
    if (!etapeValide) return;
    const controle = validerEntreeUtilisateur(texteLibreEtape(etape), profilContenu);
    if (!controle.ok) {
      setErreur(controle.motif);
      return;
    }
    setErreur('');
    setEtape((v) => Math.min(v + 1, ETAPES.length - 1));
  }

  async function valider() {
    if (enregistrement) return;
    const controle = validerEntreeUtilisateur([nom, apparence, description, scenario].join('\n'), profilContenu);
    if (!controle.ok) {
      setErreur(controle.motif);
      return;
    }
    setEnregistrement(true);
    setErreur('');
    try {
      const histoire = creerNouvelleHistoire({
        personnageNom: nom.trim(),
        personnageDescription: composerDescriptionPersonnage(),
        pointDeDepart: composerPointDeDepart(),
        contexte: {
          lieu: lieu.trim(),
          ambiance: mondeActif?.genre ?? '',
          dateChronique: '',
          objectifs: '',
        },
        settings: { ton, creativite, longueur, violence, romance, humour, liberteJoueur, rythme },
        raceOrigineId: raceActive?.id,
        sexe: sexe || undefined,
      });
      try {
        const settings = await getSettings();
        const ouverture = await genererMessageOuverture(histoire, settings);
        histoire.messages.push(ouverture);
      } catch {
        // L'ouverture assistée reste facultative : une panne réseau ne bloque jamais la création.
      }
      await saveStory(histoire);
      navigation.replace('Conversation', { storyId: histoire.meta.id });
    } catch {
      setErreur(t("Impossible d'enregistrer l'histoire. Réessaie."));
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <FondAtmospherique style={styles.ecran} densiteEtoiles="discrete" imageFond={IMAGES_ETAPES[etape]}>
      <View style={styles.voile} pointerEvents="none" />
      <View style={styles.page}>
        <View style={styles.barreSuperieure}>
          <Pressable onPress={() => etape === 0 ? navigation.goBack() : setEtape((v) => Math.max(0, v - 1))} style={styles.retourCompact}>
            <Text style={styles.texteRetour}>‹ {etape === 0 ? t('Accueil') : t('Retour')}</Text>
          </Pressable>
          <Text style={styles.marqueMini}>ELYNDOR</Text>
          <View style={styles.espaceBarre} />
        </View>

        <View style={styles.progression}>
          <IndicateurEtapes total={ETAPES.length} actif={etape} />
          <View style={styles.libellesEtapes}>
            {ETAPES.map((nomEtape, index) => (
              <Text key={nomEtape} style={[styles.libelleEtape, index === etape && styles.libelleEtapeActif]}>{t(nomEtape)}</Text>
            ))}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.contenu, tablette && styles.contenuTablette]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {etape === 0 && (
            <View>
              <TitreEtape index={0} titre="Choisis ton monde" sousTitre="Une porte d’entrée visuelle, pas un formulaire." />
              <View style={[styles.deuxColonnes, !tablette && styles.colonneUnique]}>
                <View style={styles.colonneIllustration}>
                  <Image source={mondeActif?.image ?? IMAGES_ETAPES[0]} style={styles.imageHero} resizeMode="cover" />
                  <View style={styles.cartoucheHero}>
                    <Text style={styles.nomHero}>{mondeActif?.nom ?? 'Elyndor'}</Text>
                    <Text style={styles.metaHero}>{t(mondeActif?.genre ?? '')}</Text>
                  </View>
                </View>
                <View style={styles.colonneChoix}>
                  {MONDES.map((monde) => (
                    <Pressable
                      key={monde.id}
                      onPress={() => setMondeSelectionne(monde.id)}
                      style={[styles.carteChoixLarge, monde.id === mondeSelectionne && styles.carteChoixActive]}
                    >
                      <Image source={monde.image} style={styles.miniatureCarteLarge} resizeMode="cover" />
                      <View style={styles.texteCarteLarge}>
                        <Text style={styles.titreCarteLarge}>{monde.nom}</Text>
                        <Text style={styles.descriptionCarteLarge}>{t(monde.description)}</Text>
                        <View style={styles.tags}>
                          {monde.tags.slice(0, 4).map((tag) => <Text key={tag} style={styles.tag}>{t(tag)}</Text>)}
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          )}

          {etape === 1 && (
            <View>
              <TitreEtape index={1} titre="Crée ton personnage" sousTitre="Un visage, une origine et quelques lignes suffisent pour commencer." />
              <View style={[styles.deuxColonnes, !tablette && styles.colonneUnique]}>
                <View style={styles.colonnePortrait}>
                  {portraitActif ? (
                    <Image source={portraitActif} style={styles.portrait} resizeMode="cover" />
                  ) : (
                    <View style={[styles.portrait, styles.portraitVide]}><Text style={styles.runePortrait}>✦</Text></View>
                  )}
                  <View style={styles.cartouchePortrait}>
                    <Text style={styles.nomHero}>{raceActive?.nom ?? t('Personnage')}</Text>
                    <Text style={styles.metaHero}>{raceActive?.sousTitre ? t(raceActive.sousTitre) : t('Choisis une origine')}</Text>
                  </View>
                </View>

                <View style={styles.colonneChoix}>
                  {personas.length > 0 && (
                    <Bouton titre={t('Mes personnages')} variante="secondaire" onPress={() => setModalPersonasOuvert(true)} />
                  )}

                  <Text style={styles.label}>{t('Sexe')}</Text>
                  <GroupeOptions options={OPTIONS_SEXE} valeur={sexe} onChange={setSexe} />

                  <Text style={styles.label}>{t('Race / origine')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.racesHorizontales}>
                    {RACES_ELYNDOR.map((race) => {
                      const miniature = obtenirPortrait(race.id, sexe || 'Femme');
                      const actif = race.nom === raceOrigine;
                      return (
                        <Pressable key={race.id} onPress={() => setRaceOrigine(race.nom)} style={[styles.carteRace, actif && styles.carteRaceActive]}>
                          {miniature ? <Image source={miniature} style={styles.imageRace} resizeMode="cover" /> : <View style={styles.imageRaceVide} />}
                          <Text style={styles.nomRace} numberOfLines={1}>{t(race.nom)}</Text>
                          <Text style={styles.sousTitreRace} numberOfLines={1}>{t(race.sousTitre)}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <Champ label={t('Nom du personnage')} value={nom} onChangeText={setNom} placeholder={t('Ex : Aelis Corvenn')} conteneurStyle={styles.espaceChamp} />
                  <View style={styles.deuxPetitsChamps}>
                    <Champ label={t('Âge')} value={age} onChangeText={setAge} keyboardType="number-pad" placeholder={t('Ex : 29')} conteneurStyle={styles.petitChamp} />
                    <View style={styles.petitChamp} />
                  </View>
                  <Champ label={t('Apparence')} value={apparence} onChangeText={setApparence} multiligne placeholder={t('Silhouette, visage, tenue, signes distinctifs…')} conteneurStyle={styles.espaceChamp} />
                  <Champ label={t('Personnalité et passé')} value={description} onChangeText={setDescription} multiligne placeholder={t('Ce qui définit ton personnage et ce qui le pousse à avancer…')} conteneurStyle={styles.espaceChamp} />
                  <Bouton
                    titre={t('Enregistrer dans mes personnages')}
                    variante="secondaire"
                    onPress={enregistrerPersonaDansBibliotheque}
                    desactive={!nom.trim() || !description.trim()}
                    style={{ marginTop: espacement.sm }}
                  />
                  {messagePersona ? <Text style={styles.aide}>{messagePersona}</Text> : null}
                </View>
              </View>
            </View>
          )}

          {etape === 2 && (
            <View>
              <TitreEtape index={2} titre="Choisis ton point de départ" sousTitre="L’histoire commence dans un lieu, avec une situation immédiatement jouable." />
              <Image source={IMAGES_ETAPES[2]} style={styles.banniereDepart} resizeMode="cover" />

              <Text style={styles.label}>{t('Lieu de départ')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lieuxHorizontaux}>
                {LIEUX_DEPART.map((option, index) => {
                  const actif = lieu === option.nom;
                  const symboles = ['✦', '◇', '△', '☾', '⚔'];
                  return (
                    <Pressable key={option.id} onPress={() => choisirLieu(option.nom)} style={[styles.carteLieu, actif && styles.carteLieuActive]}>
                      <Text style={styles.symboleLieu}>{symboles[index % symboles.length]}</Text>
                      <Text style={styles.nomLieu}>{t(option.nom)}</Text>
                      {!!option.description && <Text style={styles.descriptionLieu} numberOfLines={2}>{t(option.description)}</Text>}
                    </Pressable>
                  );
                })}
              </ScrollView>

              {!!lieuActif && (
                <>
                  <Text style={styles.label}>{t('Situation initiale')}</Text>
                  <View style={styles.grilleSituations}>
                    {situationsDisponibles.map((option) => {
                      const actif = situationDepart === option.nom;
                      return (
                        <Pressable key={option.id} onPress={() => setSituationDepart(option.nom)} style={[styles.carteSituation, actif && styles.carteSituationActive]}>
                          <Text style={styles.titreSituation}>{t(option.nom)}</Text>
                          <Text style={styles.descriptionSituation}>{t(option.description)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              <View style={styles.blocScenario}>
                <View style={styles.ligneLabelScenario}>
                  <View>
                    <Text style={styles.labelSansMarge}>{t('Personnaliser cette ouverture')}</Text>
                    <Text style={styles.aide}>{t('Facultatif — tu peux commencer sans écrire de scénario.')}</Text>
                  </View>
                  <Text style={styles.compteur}>{scenario.length}/600</Text>
                </View>
                <Champ value={scenario} onChangeText={(v) => setScenario(v.slice(0, 600))} multiligne maxLength={600} placeholder={t("Ajoute un détail précis, une dette, une rencontre ou un objectif d'ouverture…")} />
                <Bouton
                  titre={generationEnCours ? t('Génération…') : t('✦ Générer une ouverture')}
                  variante="arcane"
                  onPress={genererScenario}
                  desactive={generationEnCours || !lieuActif}
                  style={{ marginTop: espacement.sm }}
                />
                {erreurGeneration ? <Text style={styles.erreur}>{t(erreurGeneration)}</Text> : null}
              </View>
            </View>
          )}

          {etape === 3 && (
            <View>
              <TitreEtape index={3} titre="Donne un style au récit" sousTitre="Commence simplement. Les réglages détaillés restent optionnels." />
              <View style={styles.grilleStyles}>
                {STYLES_RECIT.map((styleRecit) => {
                  const actif = ton === styleRecit.valeur;
                  return (
                    <Pressable key={styleRecit.valeur} onPress={() => setTon(styleRecit.valeur)} style={[styles.carteStyle, actif && styles.carteStyleActive]}>
                      <Image source={styleRecit.image} style={styles.imageStyle} resizeMode="cover" />
                      <View style={styles.voileStyle} />
                      <View style={styles.texteStyleCarte}>
                        <Text style={styles.titreStyle}>{t(styleRecit.titre)}</Text>
                        <Text style={styles.descriptionStyle}>{t(styleRecit.description)}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable style={styles.ligneAvancee} onPress={() => setAvancesOuverts((v) => !v)}>
                <View>
                  <Text style={styles.titreAvance}>{t('Affiner les réglages')}</Text>
                  <Text style={styles.aide}>{t('Créativité, longueur, rythme, liberté et intensité du contenu.')}</Text>
                </View>
                <Text style={styles.chevronAvance}>{avancesOuverts ? '▴' : '▾'}</Text>
              </Pressable>

              {avancesOuverts && (
                <View style={styles.blocAvance}>
                  <Text style={styles.label}>{t('Créativité')}</Text>
                  <GroupeOptions options={OPTIONS_CREATIVITE} valeur={creativite} onChange={setCreativite} />
                  <Text style={styles.label}>{t('Longueur')}</Text>
                  <GroupeOptions options={OPTIONS_LONGUEUR} valeur={longueur} onChange={setLongueur} />
                  <Text style={styles.label}>{t('Rythme')}</Text>
                  <GroupeOptions options={OPTIONS_RYTHME} valeur={rythme} onChange={setRythme} />
                  <Text style={styles.label}>{t('Liberté du joueur')}</Text>
                  <GroupeOptions options={OPTIONS_LIBERTE} valeur={liberteJoueur} onChange={setLiberteJoueur} />
                  <Text style={styles.label}>{t('Violence')}</Text>
                  <GroupeOptions options={OPTIONS_VIOLENCE} valeur={violence} onChange={setViolence} autorisees={violenceAutorisee} />
                  <Text style={styles.label}>{t('Romance')}</Text>
                  <GroupeOptions options={OPTIONS_ROMANCE} valeur={romance} onChange={setRomance} autorisees={romanceAutorisee} />
                  <Text style={styles.label}>{t('Humour')}</Text>
                  <GroupeOptions options={OPTIONS_HUMOUR} valeur={humour} onChange={setHumour} />
                  {profilContenu === 'grand_public' ? <Text style={styles.aide}>{t('Certains niveaux sont limités par le profil Grand public de cet appareil.')}</Text> : null}
                </View>
              )}
            </View>
          )}

          {etape === 4 && (
            <View>
              <TitreEtape index={4} titre="Ton histoire est prête" sousTitre="Vérifie l’essentiel, puis entre dans Elyndor." />
              <View style={[styles.deuxColonnes, !tablette && styles.colonneUnique]}>
                <View style={styles.colonnePortrait}>
                  {portraitActif ? <Image source={portraitActif} style={styles.portraitRecap} resizeMode="cover" /> : <Image source={mondeActif?.image ?? IMAGES_ETAPES[4]} style={styles.portraitRecap} resizeMode="cover" />}
                </View>
                <View style={styles.ficheRecap}>
                  <Text style={styles.recapNom}>{nom || t('Personnage sans nom')}</Text>
                  <Text style={styles.recapMeta}>{[raceOrigine, sexe, age.trim() ? `${age.trim()} ${t('ans')}` : ''].filter(Boolean).join(' · ')}</Text>
                  {!!description.trim() && <Text style={styles.recapDescription}>{description.trim()}</Text>}
                  <Separateur style={{ marginVertical: espacement.md }} />
                  <Text style={styles.recapLabel}>{t('Départ')}</Text>
                  <Text style={styles.recapValeur}>{lieu || t('Non défini')}</Text>
                  {!!situationActive && <Text style={styles.recapSecondaire}>{t(situationActive.nom)}</Text>}
                  <Text style={[styles.recapDescription, { marginTop: espacement.sm }]}>{composerPointDeDepart()}</Text>
                  <Separateur style={{ marginVertical: espacement.md }} />
                  <Text style={styles.recapLabel}>{t('Style')}</Text>
                  <Text style={styles.recapValeur}>{t(STYLES_RECIT.find((s) => s.valeur === ton)?.titre ?? 'Immersif')}</Text>
                  <Text style={styles.recapSecondaire}>{t('Créativité')} : {t(OPTIONS_CREATIVITE.find((o) => o.valeur === creativite)?.label ?? '')} · {t('Rythme')} : {t(OPTIONS_RYTHME.find((o) => o.valeur === rythme)?.label ?? '')}</Text>
                </View>
              </View>
            </View>
          )}

          {erreur ? <Text style={styles.erreur}>{t(erreur)}</Text> : null}

          <View style={styles.navigationBas}>
            {etape > 0 ? <Bouton titre={t('Précédent')} variante="secondaire" onPress={() => setEtape((v) => Math.max(0, v - 1))} style={styles.boutonNav} /> : <View style={styles.boutonNav} />}
            {etape < ETAPES.length - 1 ? (
              <Bouton titre={t('Suivant →')} onPress={suivant} desactive={!etapeValide} style={styles.boutonNav} />
            ) : (
              <Bouton titre={enregistrement ? t('Création…') : t('Entrer dans Elyndor')} onPress={valider} desactive={enregistrement} style={styles.boutonNav} />
            )}
          </View>
        </ScrollView>
      </View>

      <Modal visible={modalPersonasOuvert} animationType="slide" onRequestClose={() => setModalPersonasOuvert(false)}>
        <View style={styles.modalPersonas}>
          <Text style={styles.titreModal}>{t('Mes personnages')}</Text>
          <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
            {personas.map((persona) => (
              <Pressable key={persona.id} onPress={() => choisirPersona(persona)} style={styles.personaLigne}>
                <Text style={styles.personaNom}>{persona.nom}</Text>
                <Text style={styles.personaMeta}>{[persona.raceOrigine, persona.sexe, persona.age].filter(Boolean).join(' · ')}</Text>
                <Text style={styles.personaDescription} numberOfLines={2}>{persona.description}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Bouton titre={t('Fermer')} variante="secondaire" onPress={() => setModalPersonasOuvert(false)} />
        </View>
      </Modal>
    </FondAtmospherique>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1 },
  voile: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3, 10, 18, 0.70)' },
  page: { flex: 1 },
  barreSuperieure: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bordureSubtile,
    paddingHorizontal: espacement.md,
    backgroundColor: 'rgba(4, 10, 18, 0.82)',
  },
  retourCompact: { minWidth: 90, minHeight: interfaceV2.cibleTactileMin, justifyContent: 'center' },
  texteRetour: { color: couleurs.doreClair, fontFamily: polices.corpsMedium, fontSize: 15 },
  marqueMini: { flex: 1, textAlign: 'center', color: couleurs.dore, fontFamily: polices.displaySemiGras, letterSpacing: interlettrage.labelSection, fontSize: 13 },
  espaceBarre: { minWidth: 90 },
  progression: {
    paddingHorizontal: espacement.lg,
    paddingTop: espacement.md,
    paddingBottom: espacement.sm,
    backgroundColor: couleurs.fondBarre,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bordureSubtile,
  },
  libellesEtapes: { flexDirection: 'row', justifyContent: 'space-between', maxWidth: 560, width: '100%', alignSelf: 'center', marginTop: 6 },
  libelleEtape: { ...stylePetitesCapitales, color: couleurs.texteFaible, fontSize: 9 },
  libelleEtapeActif: { color: couleurs.doreClair },
  contenu: { width: '100%', maxWidth: 1180, alignSelf: 'center', padding: espacement.md, paddingBottom: 120 },
  contenuTablette: { paddingHorizontal: espacement.xl },
  enteteEtape: { marginBottom: espacement.lg },
  ligneTitreEtape: { flexDirection: 'row', alignItems: 'center', gap: espacement.sm },
  runeTitre: { color: couleurs.dore, fontSize: 18 },
  titreEtape: { flex: 1, color: couleurs.doreClair, fontFamily: polices.displaySemiGras, letterSpacing: interlettrage.titreEcran, fontSize: 22 },
  numeroEtape: { ...stylePetitesCapitales, color: couleurs.texteAtténué, fontSize: 10 },
  sousTitreEtape: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 15, marginTop: 4, marginLeft: 28 },
  deuxColonnes: { flexDirection: 'row', alignItems: 'flex-start', gap: espacement.lg },
  colonneUnique: { flexDirection: 'column' },
  colonneIllustration: { flex: 0.85, alignSelf: 'flex-start', borderWidth: 1, borderColor: couleurs.bordureDoree, backgroundColor: couleurs.fondCarteDense, overflow: 'hidden', borderRadius: rayon.lg },
  colonnePortrait: { flex: 0.72, minWidth: 0, alignSelf: 'flex-start' },
  colonneChoix: { flex: 1.28, minWidth: 0 },
  imageHero: { width: '100%', aspectRatio: 3 / 4, maxHeight: 420 },
  cartoucheHero: { padding: espacement.md, backgroundColor: couleurs.fondCarteDense },
  nomHero: { color: couleurs.doreClair, fontFamily: polices.displaySemiGras, letterSpacing: interlettrage.nomPersonnage, fontSize: 16 },
  metaHero: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 13, marginTop: 2 },
  carteChoixLarge: { borderWidth: 1, borderColor: couleurs.bordureSubtile, backgroundColor: couleurs.fondCarte, overflow: 'hidden', borderRadius: rayon.lg },
  carteChoixActive: { borderColor: couleurs.dore },
  miniatureCarteLarge: { width: '100%', height: 170 },
  texteCarteLarge: { padding: espacement.md },
  titreCarteLarge: { color: couleurs.doreClair, fontFamily: polices.displaySemiGras, letterSpacing: interlettrage.nomPersonnage, fontSize: 15 },
  descriptionCarteLarge: { color: couleurs.texte, fontFamily: polices.corps, fontSize: 15, lineHeight: 21, marginTop: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: espacement.sm },
  tag: { ...stylePetitesCapitales, color: couleurs.texteAtténué, fontSize: 9, borderWidth: 1, borderColor: couleurs.bordureSubtile, borderRadius: rayon.pilule, paddingHorizontal: 7, paddingVertical: 3 },
  portrait: { width: '100%', aspectRatio: 3 / 4, maxHeight: 420, borderWidth: 1, borderColor: couleurs.bordureDoree, borderRadius: rayon.lg, backgroundColor: couleurs.fondCarteDense },
  portraitVide: { alignItems: 'center', justifyContent: 'center' },
  runePortrait: { color: couleurs.dore, fontSize: 42 },
  cartouchePortrait: { marginTop: espacement.sm, padding: espacement.md, borderWidth: 1, borderColor: couleurs.bordureSubtile, backgroundColor: couleurs.fondCarte, borderRadius: rayon.lg },
  label: { ...stylePetitesCapitales, color: couleurs.texteAtténué, fontSize: 10, marginTop: espacement.md, marginBottom: 6 },
  labelSansMarge: { ...stylePetitesCapitales, color: couleurs.texteAtténué, fontSize: 10 },
  groupeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  puceOption: { minHeight: 42, minWidth: 92, flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: espacement.sm, borderWidth: 1, borderColor: couleurs.bordureSubtile, backgroundColor: couleurs.fondChampSaisie, borderRadius: rayon.sm },
  puceOptionActive: { borderColor: couleurs.dore, backgroundColor: 'rgba(201, 164, 92, 0.12)' },
  puceOptionBloquee: { opacity: 0.32 },
  textePuceOption: { color: couleurs.texteAtténué, fontFamily: polices.corpsMedium, fontSize: 13 },
  textePuceOptionActif: { color: couleurs.doreClair },
  presse: { opacity: 0.75 },
  racesHorizontales: { gap: espacement.sm, paddingBottom: 2 },
  carteRace: { width: 126, borderWidth: 1, borderColor: couleurs.bordureSubtile, backgroundColor: couleurs.fondCarte, overflow: 'hidden', borderRadius: rayon.lg },
  carteRaceActive: { borderColor: couleurs.dore, backgroundColor: 'rgba(201,164,92,0.08)' },
  imageRace: { width: '100%', height: 108 },
  imageRaceVide: { width: '100%', height: 108, backgroundColor: couleurs.fondCarteDense },
  nomRace: { color: couleurs.doreClair, fontFamily: polices.displaySemiGras, letterSpacing: interlettrage.nomPersonnage, fontSize: 12, paddingHorizontal: 8, paddingTop: 8 },
  sousTitreRace: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 12, paddingHorizontal: 8, paddingBottom: 7 },
  espaceChamp: { marginTop: espacement.sm },
  deuxPetitsChamps: { flexDirection: 'row', gap: espacement.sm },
  petitChamp: { flex: 1, marginTop: espacement.sm },
  aide: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 12, lineHeight: 17, marginTop: 3 },
  banniereDepart: { width: '100%', aspectRatio: 16 / 9, maxHeight: 230, borderWidth: 1, borderColor: couleurs.bordureDoree, borderRadius: rayon.lg, marginBottom: espacement.sm, overflow: 'hidden' },
  lieuxHorizontaux: { gap: espacement.sm, paddingBottom: 2 },
  carteLieu: { width: 180, minHeight: 130, padding: espacement.md, borderWidth: 1, borderColor: couleurs.bordureSubtile, backgroundColor: couleurs.fondCarte, borderRadius: rayon.lg },
  carteLieuActive: { borderColor: couleurs.dore, backgroundColor: 'rgba(201,164,92,0.08)' },
  symboleLieu: { color: couleurs.dore, fontSize: 22, marginBottom: espacement.sm },
  nomLieu: { color: couleurs.doreClair, fontFamily: polices.displaySemiGras, letterSpacing: interlettrage.nomPersonnage, fontSize: 14 },
  descriptionLieu: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 13, lineHeight: 17, marginTop: 3 },
  grilleSituations: { flexDirection: 'row', flexWrap: 'wrap', gap: espacement.sm },
  carteSituation: { minWidth: 220, flexGrow: 1, flexBasis: '31%', padding: espacement.md, borderWidth: 1, borderColor: couleurs.bordureSubtile, backgroundColor: couleurs.fondCarte, borderRadius: rayon.lg },
  carteSituationActive: { borderColor: couleurs.dore, backgroundColor: 'rgba(201,164,92,0.08)' },
  titreSituation: { color: couleurs.doreClair, fontFamily: polices.displaySemiGras, letterSpacing: interlettrage.nomPersonnage, fontSize: 14 },
  descriptionSituation: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 13, lineHeight: 18, marginTop: 3 },
  blocScenario: { marginTop: espacement.lg, padding: espacement.md, borderWidth: 1, borderColor: couleurs.bordureSubtile, backgroundColor: couleurs.fondCarte, borderRadius: rayon.lg },
  ligneLabelScenario: { flexDirection: 'row', justifyContent: 'space-between', gap: espacement.md, marginBottom: espacement.sm },
  compteur: { color: couleurs.texteFaible, fontFamily: polices.corps, fontSize: 11 },
  erreur: { color: couleurs.danger, fontFamily: polices.corps, fontSize: 13, marginTop: espacement.sm },
  grilleStyles: { flexDirection: 'row', flexWrap: 'wrap', gap: espacement.md },
  carteStyle: { minWidth: 220, flexGrow: 1, flexBasis: '45%', height: 230, overflow: 'hidden', borderWidth: 1, borderColor: couleurs.bordureSubtile, borderRadius: rayon.lg, position: 'relative' },
  carteStyleActive: { borderColor: couleurs.dore },
  imageStyle: { ...StyleSheet.absoluteFill, width: undefined, height: undefined },
  voileStyle: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3, 9, 16, 0.48)' },
  texteStyleCarte: { position: 'absolute', left: espacement.md, right: espacement.md, bottom: espacement.md },
  titreStyle: { color: couleurs.doreClair, fontFamily: polices.displaySemiGras, letterSpacing: interlettrage.nomPersonnage, fontSize: 16 },
  descriptionStyle: { color: couleurs.texte, fontFamily: polices.corps, fontSize: 13, lineHeight: 18, marginTop: 4 },
  ligneAvancee: { marginTop: espacement.lg, minHeight: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacement.md, padding: espacement.md, borderWidth: 1, borderColor: couleurs.bordureSubtile, backgroundColor: couleurs.fondCarte, borderRadius: rayon.lg },
  titreAvance: { color: couleurs.dore, fontFamily: polices.titre, fontSize: 18 },
  chevronAvance: { color: couleurs.dore, fontSize: 20 },
  blocAvance: { padding: espacement.md, borderWidth: 1, borderColor: couleurs.bordureSubtile, backgroundColor: couleurs.fondCarte, borderRadius: rayon.lg, marginTop: espacement.sm },
  portraitRecap: { width: '100%', aspectRatio: 3 / 4, maxHeight: 420, borderWidth: 1, borderColor: couleurs.bordureDoree, borderRadius: rayon.lg },
  ficheRecap: { flex: 1.28, padding: espacement.lg, borderWidth: 1, borderColor: couleurs.bordureSubtile, backgroundColor: couleurs.fondCarteDense, borderRadius: rayon.lg },
  recapNom: { color: couleurs.doreClair, fontFamily: polices.displaySemiGras, letterSpacing: interlettrage.nomPersonnage, fontSize: 22 },
  recapMeta: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 14, marginTop: 2 },
  recapDescription: { color: couleurs.texte, fontFamily: polices.corps, fontSize: 15, lineHeight: 21, marginTop: espacement.sm },
  recapLabel: { ...stylePetitesCapitales, color: couleurs.dore, fontSize: 10 },
  recapValeur: { color: couleurs.texte, fontFamily: polices.titre, fontSize: 20, marginTop: 2 },
  recapSecondaire: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 13, marginTop: 2 },
  navigationBas: { flexDirection: 'row', gap: espacement.sm, marginTop: espacement.xl, paddingTop: espacement.md, borderTopWidth: 1, borderTopColor: couleurs.bordureSubtile },
  boutonNav: { flex: 1 },
  modalPersonas: { flex: 1, backgroundColor: couleurs.fond, padding: espacement.lg, paddingTop: Platform.OS === 'ios' ? 64 : 40 },
  titreModal: { color: couleurs.doreClair, fontFamily: polices.displaySemiGras, letterSpacing: interlettrage.titreEcran, fontSize: 22, marginBottom: espacement.md },
  personaLigne: { paddingVertical: espacement.md, borderBottomWidth: 1, borderBottomColor: couleurs.bordureSubtile },
  personaNom: { color: couleurs.doreClair, fontFamily: polices.displaySemiGras, letterSpacing: interlettrage.nomPersonnage, fontSize: 16 },
  personaMeta: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 12, marginTop: 2 },
  personaDescription: { color: couleurs.texte, fontFamily: polices.corps, fontSize: 14, lineHeight: 19, marginTop: 4 },
});
