import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Creativite, Longueur, LiberteJoueur, NiveauQuatre, NiveauViolence, Persona, ProfilContenu, RythmeHistoire, TonHistoire } from '../types';
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
import { getPersonas, getSettings, saveStory, savePersona } from '../storage/storage';
import { validerEntreeUtilisateur, valeursAutoriseesRomance, valeursAutoriseesViolence } from '../engine/contenuAdulte';
import { couleurs, espacement, ombresLueur, polices, stylePetitesCapitales } from '../theme/theme';
import Bouton from '../components/Bouton';
import Champ from '../components/Champ';
import FondAtmospherique from '../components/FondAtmospherique';
import IndicateurEtapes from '../components/IndicateurEtapes';
import Panneau from '../components/Panneau';
import Separateur from '../components/Separateur';
import { useLangue } from '../i18n/LangueProvider';

// Une illustration par étape (brief Phase 2) — la dernière (Récapitulatif)
// reprend celle de l'accueil pour boucler le parcours visuellement.
const IMAGES_ETAPES = [
  require('../../assets/scenes/creation-histoire.png'),
  require('../../assets/scenes/creation-personnage.png'),
  require('../../assets/scenes/creation-point-depart.png'),
  require('../../assets/scenes/creation-preferences.png'),
  require('../../assets/scenes/accueil.png'),
];

function genererIdPersona(): string {
  return `persona-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Lore Elyndor chargé une fois — sert à retrouver l'entrée dédiée au lieu de
// départ choisi (même titre, voir src/data/lieuxDepart.ts) pour la fournir
// au générateur de scénario par IA.
const LORE_ELYNDOR = chargerLoreElyndor(elyndorLoreRaw as any);

type Props = NativeStackScreenProps<RootStackParamList, 'Creation'>;

// Parcours de création en 5 étapes (brief Phase 2) : Histoire → Personnage
// → Point de départ → Préférences → Récapitulatif — remplace l'écran
// unique de la bêta.
const ETAPES = ['Histoire', 'Personnage', 'Point de départ', 'Préférences', 'Récapitulatif'] as const;

const OPTIONS_CREATIVITE: { valeur: Creativite; label: string }[] = [
  { valeur: 'faible', label: 'Faible' },
  { valeur: 'moyenne', label: 'Moyenne' },
  { valeur: 'elevee', label: 'Élevée' },
];

const OPTIONS_LONGUEUR: { valeur: Longueur; label: string }[] = [
  { valeur: 'courte', label: 'Courte' },
  { valeur: 'moyenne', label: 'Moyenne' },
  { valeur: 'longue', label: 'Longue' },
];

const OPTIONS_VIOLENCE: { valeur: NiveauViolence; label: string }[] = [
  { valeur: 'faible', label: 'Faible' },
  { valeur: 'modere', label: 'Modéré' },
  { valeur: 'eleve', label: 'Élevé' },
  { valeur: 'extreme', label: 'Extrême' },
];

const OPTIONS_ROMANCE: { valeur: NiveauQuatre; label: string }[] = [
  { valeur: 'aucun', label: 'Aucun' },
  { valeur: 'faible', label: 'Faible' },
  { valeur: 'modere', label: 'Modéré' },
  { valeur: 'eleve', label: 'Élevé' },
];

const OPTIONS_HUMOUR: { valeur: NiveauQuatre; label: string }[] = OPTIONS_ROMANCE;

const OPTIONS_LIBERTE: { valeur: LiberteJoueur; label: string }[] = [
  { valeur: 'faible', label: 'Faible' },
  { valeur: 'moderee', label: 'Modérée' },
  { valeur: 'elevee', label: 'Élevée' },
  { valeur: 'totale', label: 'Totale' },
];

const OPTIONS_RYTHME: { valeur: RythmeHistoire; label: string }[] = [
  { valeur: 'lent', label: 'Lent' },
  { valeur: 'normal', label: 'Normal' },
  { valeur: 'rapide', label: 'Rapide' },
];

// Fonctionnalités montrées dans la maquette d'origine mais pas encore
// construites (aucune génération d'image, d'audio, de streaming ou de
// synthèse vocale dans le moteur actuel) — affichées désactivées plutôt que
// masquées, pour ne rien faire croire de faux tout en montrant la direction.
const OPTIONS_FONCTIONNALITES_A_VENIR = [
  'Images de scène',
  "Musique d'ambiance",
  'Streaming des réponses',
  'Voix / lecture',
] as const;

const OPTIONS_TON: { valeur: TonHistoire; label: string; description: string }[] = [
  { valeur: 'sombre_realiste', label: 'Sombre et réaliste', description: 'Une ambiance immersive, dure et crédible.' },
  { valeur: 'heroique_epique', label: 'Héroïque et épique', description: 'Des aventures grandioses et inspirantes.' },
  { valeur: 'mysterieux_intrigant', label: 'Mystérieux et intrigant', description: "Secrets, complots et révélations au cœur de l'histoire." },
  { valeur: 'leger_aventureux', label: 'Léger et aventureux', description: 'Une histoire plus détendue, axée sur l’exploration et la découverte.' },
];

const OPTIONS_SEXE: { valeur: string; label: string }[] = [
  { valeur: 'Homme', label: 'Homme' },
  { valeur: 'Femme', label: 'Femme' },
  { valeur: 'Autre', label: 'Autre' },
];

function RangeeOptions<T extends string>({
  options,
  valeur,
  onChange,
  autorisees,
}: {
  options: { valeur: T; label: string }[];
  valeur: T;
  onChange: (v: T) => void;
  // Contrôle d'âge (audit sécurité) : quand fourni, les valeurs absentes de
  // cet ensemble restent visibles mais désactivées — l'interface doit
  // montrer honnêtement ce que le profil actuel autorise plutôt que
  // proposer un choix que le moteur plafonnerait ensuite en silence (voir
  // plafonnerCurseurs dans contenuAdulte.ts).
  autorisees?: T[];
}) {
  const { t } = useLangue();
  return (
    <View style={styles.rangeeOptions}>
      {options.map((opt) => {
        const bloque = !!autorisees && !autorisees.includes(opt.valeur);
        return (
          <Pressable
            key={opt.valeur}
            style={[styles.option, valeur === opt.valeur && !bloque && styles.optionActive, bloque && styles.optionBloquee]}
            onPress={() => !bloque && onChange(opt.valeur)}
            disabled={bloque}
          >
            <Text
              style={[
                styles.texteOption,
                valeur === opt.valeur && !bloque && styles.texteOptionActive,
                bloque && styles.texteOptionBloquee,
              ]}
            >
              {t(opt.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Carte sélectionnable d'un monde, dans la liste de gauche de l'étape
// "Choisir l'histoire" — un seul monde pour l'instant (Elyndor) mais le
// composant est prévu pour une liste qui grandira plus tard.
function CarteMonde({ monde, selectionne, onPress }: { monde: (typeof MONDES)[number]; selectionne: boolean; onPress: () => void }) {
  const { t } = useLangue();
  return (
    <Pressable onPress={onPress} style={[styles.carteMonde, selectionne && styles.carteMondeActive]}>
      <Image source={monde.image} style={styles.imageCarteMonde} resizeMode="cover" />
      <View style={styles.infoCarteMonde}>
        <Text style={styles.nomMonde}>{monde.nom}</Text>
        <Text style={styles.genreMonde}>{t(monde.genre)}</Text>
      </View>
    </Pressable>
  );
}

// Bloc de texte à hauteur bornée avec défilement interne — un pavé tapé
// librement par le joueur (description, apparence, scénario...) ne doit
// pas gonfler toute la page du récapitulatif, contrairement à un simple
// <Text> qui grandit avec son contenu.
function ZoneTexteDefilante({ texte, style, hauteurMax = 130 }: { texte: string; style?: object; hauteurMax?: number }) {
  if (!texte.trim()) return null;
  return (
    <ScrollView style={[styles.zoneTexteDefilante, { maxHeight: hauteurMax }]} nestedScrollEnabled>
      <Text style={style ?? styles.recapTexte}>{texte}</Text>
    </ScrollView>
  );
}

// Une ligne icône + label + valeur choisie, pour la grille à deux colonnes
// des préférences narratives dans le récapitulatif final.
function LignePreferenceRecap({ icone, label, valeur }: { icone: string; label: string; valeur?: string }) {
  const { t } = useLangue();
  return (
    <View style={styles.lignePreferenceRecap}>
      <Text style={styles.iconePreferenceRecap}>{icone}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.labelPreferenceRecap}>{t(label)}</Text>
        <Text style={styles.valeurPreferenceRecap}>{valeur ? t(valeur) : valeur}</Text>
      </View>
    </View>
  );
}

interface OptionSelection {
  id: string;
  nom: string;
  sousTitre?: string;
  description?: string;
}

// Champ "curseur" : un bouton qui ouvre une liste de choix en plein écran,
// avec un encadré de présentation de l'élément retenu juste en dessous —
// même mécanique pour la Race/origine (races d'Elyndor) et le Lieu de
// départ (factions/institutions), donc factorisée ici plutôt que dupliquée.
function ChampSelection({
  label,
  placeholder,
  options,
  valeur,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: OptionSelection[];
  valeur: string;
  onChange: (nom: string) => void;
}) {
  const { t } = useLangue();
  const [ouvert, setOuvert] = useState(false);
  const actif = options.find((o) => o.nom === valeur);

  return (
    <View style={styles.champConteneur}>
      <Text style={styles.label}>{t(label)}</Text>
      <Pressable style={styles.selecteur} onPress={() => setOuvert(true)}>
        <Text style={[styles.texteSelecteur, !valeur && styles.texteSelecteurPlaceholder]} numberOfLines={1}>
          {valeur ? t(valeur) : t(placeholder)}
        </Text>
        <Text style={styles.chevronSelecteur}>▾</Text>
      </Pressable>

      {actif && (actif.sousTitre || actif.description) && (
        <Panneau style={styles.presentationSelection}>
          <Text style={styles.nomSelection}>{t(actif.nom)}</Text>
          {actif.sousTitre ? <Text style={styles.sousTitreSelection}>{t(actif.sousTitre)}</Text> : null}
          {actif.description ? <Text style={styles.descriptionSelection}>{t(actif.description)}</Text> : null}
        </Panneau>
      )}

      <Modal visible={ouvert} animationType="slide" onRequestClose={() => setOuvert(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.titre}>{t(label)}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={styles.ligneOptionListe}
                onPress={() => {
                  onChange(item.nom);
                  setOuvert(false);
                }}
              >
                <Text style={styles.nomOptionListe}>{t(item.nom)}</Text>
                {item.sousTitre ? <Text style={styles.sousTitreOptionListe}>{t(item.sousTitre)}</Text> : null}
              </Pressable>
            )}
          />
          <Bouton titre={t('Fermer')} variante="secondaire" onPress={() => setOuvert(false)} style={{ marginTop: espacement.md }} />
        </View>
      </Modal>
    </View>
  );
}

export default function CreateScreen({ navigation }: Props) {
  const { t } = useLangue();
  const [etape, setEtape] = useState(0);

  // Contrôle d'âge (audit sécurité) : les champs libres de ce parcours
  // (personnage, scénario, contexte...) n'étaient filtrés par aucun profil
  // — chargé une fois ici et revérifié à chaque transition d'étape plutôt
  // qu'à la toute fin seulement, pour ne pas laisser le joueur avancer sur
  // 4 étapes avant de découvrir le blocage.
  const [profilContenu, setProfilContenu] = useState<ProfilContenu | undefined>(undefined);

  useEffect(() => {
    getSettings().then((s) => setProfilContenu(s.profilContenu));
  }, []);

  // Étape 1 — Histoire (choix du monde + panneau Contexte de l'Histoire,
  // brief Phase 2)
  const [mondeSelectionne, setMondeSelectionne] = useState(MONDES[0]?.id ?? '');
  const [lieu, setLieu] = useState('');

  // Étape 2 — Personnage
  const [nom, setNom] = useState('');
  const [sexe, setSexe] = useState('');
  const [raceOrigine, setRaceOrigine] = useState('');
  const [age, setAge] = useState('');
  const [apparence, setApparence] = useState('');
  const [description, setDescription] = useState('');

  // Bibliothèque de personas (brief Phase 2) : réutiliser {{user}} d'une
  // histoire à l'autre sans ressaisir nom/description à chaque fois.
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [modalPersonasOuvert, setModalPersonasOuvert] = useState(false);
  const [messagePersona, setMessagePersona] = useState('');

  useEffect(() => {
    getPersonas().then(setPersonas);
  }, []);

  function choisirPersona(persona: Persona) {
    setNom(persona.nom);
    setDescription(persona.description);
    setSexe(persona.sexe ?? '');
    setRaceOrigine(persona.raceOrigine ?? '');
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
      sexe: sexe || undefined,
      raceOrigine: raceOrigine.trim() || undefined,
      age: age.trim() || undefined,
      apparence: apparence.trim() || undefined,
      createdAt: Date.now(),
    };
    await savePersona(persona);
    setPersonas((prev) => [...prev, persona]);
    setMessagePersona(t('Personnage enregistré dans la bibliothèque.'));
  }

  // Compose la description finale envoyée au moteur : les champs structurés
  // (sexe, race/origine, âge, apparence) en tête, suivis de la description
  // libre — personnageDescription reste un simple texte côté moteur (prompt,
  // validateur, suggestions…), donc pas besoin d'y toucher pour ce nouveau
  // niveau de détail.
  function composerDescriptionPersonnage(): string {
    const lignes: string[] = [];
    if (sexe) lignes.push(`Sexe : ${sexe}`);
    if (raceOrigine.trim()) lignes.push(`Race / origine : ${raceOrigine.trim()}`);
    if (age.trim()) lignes.push(`Âge : ${age.trim()}`);
    if (apparence.trim()) lignes.push(`Apparence : ${apparence.trim()}`);
    if (description.trim()) lignes.push(description.trim());
    return lignes.join('\n');
  }

  // Étape 3 — Point de départ (le lieu de départ, choisi ici plutôt qu'à
  // l'étape Personnage, détermine aussi la liste des situations proposées)
  const [situationDepart, setSituationDepart] = useState('');
  const [scenario, setScenario] = useState('');
  const [generationEnCours, setGenerationEnCours] = useState(false);
  const [erreurGeneration, setErreurGeneration] = useState('');

  const lieuDepartActif = LIEUX_DEPART.find((l) => l.nom === lieu);
  const situationsDisponibles = lieuDepartActif ? SITUATIONS_PAR_LIEU[lieuDepartActif.id] ?? [] : [];
  const situationActive = situationsDisponibles.find((s) => s.nom === situationDepart);
  const raceActive = RACES_ELYNDOR.find((r) => r.nom === raceOrigine);
  const portraitActif = obtenirPortrait(raceActive?.id, sexe);

  function choisirLieuDepart(nomLieu: string) {
    setLieu(nomLieu);
    setSituationDepart(''); // la liste de situations change avec le lieu
  }

  // Compose la phrase de point de départ effectivement envoyée au moteur : le
  // scénario (tapé ou généré par IA) s'il existe, sinon un repli minimal à
  // partir du lieu/situation choisis — affichée aussi dans le panneau
  // "Résumé de la situation".
  function composerPointDeDepart(): string {
    if (scenario.trim()) return scenario.trim();
    const lieuTexte = lieuDepartActif
      ? `à ${lieuDepartActif.nom}${lieuDepartActif.description ? ` (${lieuDepartActif.description.replace(/\.$/, '')})` : ''}`
      : '';
    const phrase = [`${nom.trim() || 'Le personnage'} arrive${lieuTexte ? ' ' + lieuTexte : ''}`, situationActive ? `pour ${situationActive.nom.toLowerCase()}` : '']
      .filter(Boolean)
      .join(', ');
    return `${phrase}.`;
  }

  async function genererScenario() {
    if (generationEnCours) return;
    setGenerationEnCours(true);
    setErreurGeneration('');
    try {
      const settings = await getSettings();
      const extraitLore = lieuDepartActif
        ? LORE_ELYNDOR.find((e) => e.titre.toLowerCase() === lieuDepartActif.nom.toLowerCase())?.contenu
        : undefined;
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
        lieuNom: lieuDepartActif?.nom,
        lieuDescription: lieuDepartActif?.description,
        situationNom: situationActive?.nom,
        situationDescription: situationActive?.description,
        extraitLore,
      });
      setScenario(texte);
    } catch (e) {
      setErreurGeneration(e instanceof Error ? e.message : 'Échec de la génération.');
    } finally {
      setGenerationEnCours(false);
    }
  }

  // Étape 4 — Préférences
  const [ton, setTon] = useState<TonHistoire>('sombre_realiste');
  const [creativite, setCreativite] = useState<Creativite>('moyenne');
  const [longueur, setLongueur] = useState<Longueur>('moyenne');
  const [violence, setViolence] = useState<NiveauViolence>('modere');
  const [romance, setRomance] = useState<NiveauQuatre>('modere');
  const [humour, setHumour] = useState<NiveauQuatre>('faible');
  const [liberteJoueur, setLiberteJoueur] = useState<LiberteJoueur>('elevee');
  const [rythme, setRythme] = useState<RythmeHistoire>('normal');

  // Contrôle d'âge (audit sécurité) : l'interface affichait jusqu'ici tous
  // les niveaux de violence/romance quel que soit le profil, alors que le
  // moteur les plafonnait déjà en silence à la génération — un choix
  // "Extrême" restait affiché tel quel dans le récapitulatif tout en étant
  // réellement traité comme "Faible". Les valeurs non permises sont donc
  // maintenant désactivées à l'écran (plutôt que masquées, pour que le
  // joueur comprenne pourquoi), et l'état est ramené dans les clous dès que
  // le profil est connu.
  const violenceAutorisee = valeursAutoriseesViolence(profilContenu);
  const romanceAutorisee = valeursAutoriseesRomance(profilContenu);

  useEffect(() => {
    if (profilContenu !== 'grand_public') return;
    setViolence((v) => (violenceAutorisee.includes(v) ? v : violenceAutorisee[violenceAutorisee.length - 1]));
    setRomance((r) => (romanceAutorisee.includes(r) ? r : romanceAutorisee[romanceAutorisee.length - 1]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilContenu]);

  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState('');

  const mondeActif = MONDES.find((m) => m.id === mondeSelectionne);

  const etapeValide = [
    true,
    nom.trim().length > 0 && description.trim().length > 0,
    lieu.trim().length > 0,
    true,
    true,
  ][etape];

  // Contrôle d'âge (audit sécurité) : les champs libres de chaque étape
  // n'étaient jusqu'ici filtrés par aucun profil — vérifiés ici avant de
  // laisser le joueur avancer, avec le même filtre centralisé que la
  // conversation (validerEntreeUtilisateur), pour ne pas avoir un contrôle
  // différent (donc potentiellement moins complet) par écran.
  function texteLibreEtape(e: number): string {
    if (e === 1) return [nom, apparence, description].join('\n');
    if (e === 2) return scenario;
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
    setEtape((e) => Math.min(e + 1, ETAPES.length - 1));
  }

  function precedent() {
    setErreur('');
    setEtape((e) => Math.max(e - 1, 0));
  }

  async function valider() {
    if (enregistrement) return;
    // Filet de sécurité final : revalide l'ensemble des champs libres,
    // couvrant aussi le cas d'un persona chargé depuis la bibliothèque
    // (donc jamais passé par le contrôle étape par étape).
    const controleFinal = validerEntreeUtilisateur(
      [nom, apparence, description, scenario].join('\n'),
      profilContenu,
    );
    if (!controleFinal.ok) {
      setErreur(controleFinal.motif);
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
          // Ambiance/date/objectifs ne sont plus saisis à la création — le
          // monde choisi porte déjà son ton (genre, description, tags) ;
          // ces champs restent éditables ensuite depuis le panneau Contexte
          // de l'Histoire, en conversation.
          ambiance: mondeActif?.genre ?? '',
          dateChronique: '',
          objectifs: '',
        },
        settings: { ton, creativite, longueur, violence, romance, humour, liberteJoueur, rythme },
      });
      // Enrichissement automatique et invisible de l'ouverture (chantier 3) :
      // génère la scène d'ouverture avant même que le joueur n'arrive sur
      // l'écran de conversation, en piochant du lore lié au lieu de départ.
      // Aucun réglage visible — si la génération échoue (hors-ligne, pas de
      // clé...), on enregistre simplement l'histoire sans message d'ouverture
      // plutôt que de bloquer la création.
      try {
        const settings = await getSettings();
        const messageOuverture = await genererMessageOuverture(histoire, settings);
        histoire.messages.push(messageOuverture);
      } catch {
        // dégradation silencieuse — le joueur démarre alors sur l'écran vide habituel
      }
      await saveStory(histoire);
      navigation.replace('Conversation', { storyId: histoire.meta.id });
    } catch (e) {
      setErreur(t("Impossible d'enregistrer l'histoire. Réessaie."));
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <FondAtmospherique style={{ flex: 1 }} densiteEtoiles="discrete" imageFond={IMAGES_ETAPES[etape]}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.etapeIndicateur}>{t(ETAPES[etape])}</Text>
        <IndicateurEtapes total={ETAPES.length} actif={etape} />
        <Separateur style={{ marginBottom: espacement.lg }} />

        {etape === 0 && (
          <>
            <Text style={styles.titre}>{t("Choisir l'histoire")}</Text>

            <Text style={styles.label}>{t('Monde')}</Text>
            <View style={styles.rangeeChoixMonde}>
              <View style={styles.listeMondes}>
                {MONDES.map((monde) => (
                  <CarteMonde
                    key={monde.id}
                    monde={monde}
                    selectionne={monde.id === mondeSelectionne}
                    onPress={() => setMondeSelectionne(monde.id)}
                  />
                ))}
              </View>

              {mondeActif && (
                <Panneau style={styles.presentationMonde}>
                  <Text style={styles.labelPresentation}>{t('Présentation')}</Text>
                  <Separateur style={{ width: 60, marginTop: espacement.xs, marginBottom: espacement.md, alignSelf: 'center' }} />
                  <Image source={mondeActif.image} style={styles.imagePresentationMonde} resizeMode="cover" />
                  <Text style={styles.descriptionMonde}>{t(mondeActif.description)}</Text>
                  <View style={styles.rangeeTagsMonde}>
                    {mondeActif.tags.map((tag) => (
                      <View key={tag} style={styles.tagMonde}>
                        <Text style={styles.texteTagMonde}>{t(tag).toUpperCase()}</Text>
                      </View>
                    ))}
                  </View>
                </Panneau>
              )}
            </View>
          </>
        )}

        {etape === 1 && (
          <>
            <Text style={styles.titre}>{t('Personnage')}</Text>
            {personas.length > 0 && (
              <Bouton
                titre={t('Choisir depuis la bibliothèque')}
                variante="secondaire"
                onPress={() => setModalPersonasOuvert(true)}
                style={styles.boutonAction}
              />
            )}
            <Champ
              label={t('Nom du personnage')}
              value={nom}
              onChangeText={(v) => {
                setNom(v);
                setMessagePersona('');
              }}
              placeholder={t('Ex : Aelis Corvenn')}
              conteneurStyle={styles.champConteneur}
            />

            <Text style={styles.label}>{t('Sexe')}</Text>
            <RangeeOptions options={OPTIONS_SEXE} valeur={sexe} onChange={setSexe} />

            <ChampSelection
              label={t('Race / origine')}
              placeholder={t('Choisir une race')}
              options={RACES_ELYNDOR}
              valeur={raceOrigine}
              onChange={setRaceOrigine}
            />
            {portraitActif && (
              <Image source={portraitActif} style={styles.portraitPersonnage} resizeMode="cover" />
            )}
            <Champ
              label={t('Âge')}
              value={age}
              onChangeText={setAge}
              placeholder={t('Ex : 29')}
              keyboardType="number-pad"
              conteneurStyle={styles.champConteneur}
            />
            <Champ
              label={t('Apparence')}
              value={apparence}
              onChangeText={setApparence}
              placeholder={t('Silhouette, visage, tenue, signes distinctifs…')}
              multiligne
              conteneurStyle={styles.champConteneur}
            />
            <Champ
              label={t('Description')}
              value={description}
              onChangeText={(v) => {
                setDescription(v);
                setMessagePersona('');
              }}
              placeholder={t('Personnalité, passé, ce qui le pousse à avancer…')}
              multiligne
              conteneurStyle={styles.champConteneur}
            />
            <Bouton
              titre={t('Enregistrer dans la bibliothèque')}
              variante="secondaire"
              onPress={enregistrerPersonaDansBibliotheque}
              desactive={!nom.trim() || !description.trim()}
              style={styles.boutonAction}
            />
            {messagePersona ? <Text style={styles.aide}>{messagePersona}</Text> : null}
          </>
        )}

        {etape === 2 && (
          <>
            <Text style={styles.titre}>{t('Point de départ')}</Text>

            <ChampSelection
              label={t('Lieu de départ')}
              placeholder={t('Choisir un lieu de départ')}
              options={LIEUX_DEPART}
              valeur={lieu}
              onChange={choisirLieuDepart}
            />
            <ChampSelection
              label={t('Situation de départ')}
              placeholder={t(lieuDepartActif ? 'Choisir une situation' : "Choisir d'abord un lieu de départ")}
              options={situationsDisponibles}
              valeur={situationDepart}
              onChange={setSituationDepart}
            />
            <View style={styles.champConteneur}>
              <View style={styles.rangeeLabelCompteur}>
                <Text style={[styles.label, { marginTop: 0 }]}>{t('Scénario')}</Text>
                <Text style={styles.compteurCaracteres}>{scenario.length}/600</Text>
              </View>
              <Champ
                value={scenario}
                onChangeText={(v) => setScenario(v.slice(0, 600))}
                placeholder={t("Écris le scénario d'ouverture, ou génère-le avec l'IA à partir de ce que tu as déjà rempli…")}
                multiligne
                maxLength={600}
              />
              <Bouton
                titre={generationEnCours ? t('Génération…') : t("Générer avec l'IA")}
                variante="secondaire"
                onPress={genererScenario}
                desactive={generationEnCours || !lieuDepartActif}
                style={styles.boutonAction}
              />
              {erreurGeneration ? <Text style={styles.erreur}>{t(erreurGeneration)}</Text> : null}
            </View>

            {(lieuDepartActif || situationActive || scenario.trim()) && (
              <Panneau style={styles.presentationMonde}>
                <Text style={styles.labelPresentation}>{t('Résumé de la situation')}</Text>
                <Separateur style={{ width: 60, marginTop: espacement.xs, marginBottom: espacement.md, alignSelf: 'center' }} />
                <Image source={IMAGES_ETAPES[2]} style={styles.imagePresentationMonde} resizeMode="cover" />
                <ZoneTexteDefilante texte={composerPointDeDepart()} style={styles.descriptionMonde} />
              </Panneau>
            )}
          </>
        )}

        {etape === 3 && (
          <>
            <Text style={styles.titre}>{t('Préférences narratives')}</Text>

            <Text style={styles.label}>{t('Ton général')}</Text>
            <RangeeOptions options={OPTIONS_TON} valeur={ton} onChange={setTon} />
            <Text style={styles.aideTon}>{t(OPTIONS_TON.find((o) => o.valeur === ton)?.description ?? '')}</Text>

            <Text style={styles.label}>{t('Créativité')}</Text>
            <RangeeOptions options={OPTIONS_CREATIVITE} valeur={creativite} onChange={setCreativite} />
            <Text style={styles.label}>{t('Longueur de réponse')}</Text>
            <RangeeOptions options={OPTIONS_LONGUEUR} valeur={longueur} onChange={setLongueur} />
            <Text style={styles.label}>{t("Rythme de l'histoire")}</Text>
            <RangeeOptions options={OPTIONS_RYTHME} valeur={rythme} onChange={setRythme} />
            <Text style={styles.label}>{t('Liberté du joueur')}</Text>
            <RangeeOptions options={OPTIONS_LIBERTE} valeur={liberteJoueur} onChange={setLiberteJoueur} />
            <Text style={styles.label}>{t('Niveau de violence')}</Text>
            <RangeeOptions options={OPTIONS_VIOLENCE} valeur={violence} onChange={setViolence} autorisees={violenceAutorisee} />
            <Text style={styles.label}>{t('Niveau de romance')}</Text>
            <RangeeOptions options={OPTIONS_ROMANCE} valeur={romance} onChange={setRomance} autorisees={romanceAutorisee} />
            {profilContenu === 'grand_public' && (
              <Text style={styles.aide}>
                {t('Disponible avec le profil Adulte (Réglages).')}
              </Text>
            )}
            <Text style={styles.label}>{t('Humour')}</Text>
            <RangeeOptions options={OPTIONS_HUMOUR} valeur={humour} onChange={setHumour} />
            <Text style={styles.aide}>
              {t(
                "Violence et romance sont plafonnées par le profil de contenu de l'appareil (Réglages) s'il est configuré en Grand public.",
              )}
            </Text>

            <Separateur style={{ marginVertical: espacement.lg }} />

            <Text style={styles.label}>{t('À venir')}</Text>
            {OPTIONS_FONCTIONNALITES_A_VENIR.map((f) => (
              <View key={f} style={styles.rangeeFonctionnaliteAVenir}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.texteFonctionnaliteAVenir}>{t(f)}</Text>
                  <Text style={styles.aideFonctionnaliteAVenir}>{t('Bientôt disponible')}</Text>
                </View>
                <Switch value={false} disabled trackColor={{ false: couleurs.bordure, true: couleurs.bordure }} />
              </View>
            ))}
          </>
        )}

        {etape === 4 && (
          <>
            <Text style={styles.titre}>{t('Récapitulatif')}</Text>
            <View style={styles.rangeeRecap}>
              <View style={styles.colonneRecapChamps}>
                <Panneau style={styles.recapBloc}>
                  <View style={styles.enteteRecap}>
                    <Text style={styles.iconeRecap}>📖</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recapLabel}>{t('Histoire')}</Text>
                      <Text style={styles.recapTitreBloc}>{mondeActif?.nom}</Text>
                      {mondeActif?.genre ? <Text style={styles.recapSousTitre}>{t(mondeActif.genre)}</Text> : null}
                    </View>
                  </View>
                </Panneau>

                <Panneau style={styles.recapBloc}>
                  <View style={styles.enteteRecap}>
                    <Text style={styles.iconeRecap}>👤</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recapLabel}>{t('Personnage')}</Text>
                      <Text style={styles.recapTitreBloc}>{nom}</Text>
                      {(sexe || raceOrigine || age) ? (
                        <Text style={styles.recapSousTitre}>
                          {[sexe ? t(sexe) : '', raceOrigine.trim(), age.trim() ? `${age.trim()} ${t('ans')}` : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <ZoneTexteDefilante texte={[apparence.trim(), description].filter(Boolean).join('\n\n')} />
                </Panneau>

                <Panneau style={styles.recapBloc}>
                  <View style={styles.enteteRecap}>
                    <Text style={styles.iconeRecap}>📍</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recapLabel}>{t('Point de départ')}</Text>
                      <Text style={styles.recapTitreBloc}>{lieuDepartActif?.nom ? t(lieuDepartActif.nom) : lieu}</Text>
                      {situationActive ? <Text style={styles.recapSousTitre}>{t(situationActive.nom)}</Text> : null}
                    </View>
                  </View>
                  <ZoneTexteDefilante texte={composerPointDeDepart()} />
                </Panneau>

                <Panneau style={styles.recapBloc}>
                  <View style={styles.enteteRecap}>
                    <Text style={styles.iconeRecap}>🎭</Text>
                    <Text style={styles.recapLabel}>{t('Préférences narratives')}</Text>
                  </View>
                  <View style={styles.grilleRecapPrefs}>
                    <View style={styles.colonneRecapPrefs}>
                      <LignePreferenceRecap icone="🎭" label="Ton général" valeur={OPTIONS_TON.find((o) => o.valeur === ton)?.label} />
                      <LignePreferenceRecap icone="⚔️" label="Niveau de violence" valeur={OPTIONS_VIOLENCE.find((o) => o.valeur === violence)?.label} />
                      <LignePreferenceRecap icone="💗" label="Niveau de romance" valeur={OPTIONS_ROMANCE.find((o) => o.valeur === romance)?.label} />
                      <LignePreferenceRecap icone="😄" label="Humour" valeur={OPTIONS_HUMOUR.find((o) => o.valeur === humour)?.label} />
                    </View>
                    <View style={styles.colonneRecapPrefs}>
                      <LignePreferenceRecap icone="🧭" label="Liberté du joueur" valeur={OPTIONS_LIBERTE.find((o) => o.valeur === liberteJoueur)?.label} />
                      <LignePreferenceRecap icone="⏳" label="Rythme de l'histoire" valeur={OPTIONS_RYTHME.find((o) => o.valeur === rythme)?.label} />
                      <LignePreferenceRecap icone="🎨" label="Créativité" valeur={OPTIONS_CREATIVITE.find((o) => o.valeur === creativite)?.label} />
                      <LignePreferenceRecap icone="📏" label="Longueur" valeur={OPTIONS_LONGUEUR.find((o) => o.valeur === longueur)?.label} />
                    </View>
                  </View>
                </Panneau>
              </View>

              <Panneau style={styles.presentationMonde}>
                <Text style={styles.labelPresentation}>{t('Aperçu')}</Text>
                <Image source={mondeActif?.image ?? IMAGES_ETAPES[4]} style={styles.imagePresentationMonde} resizeMode="cover" />
                <ZoneTexteDefilante texte={mondeActif?.description ? t(mondeActif.description) : ''} style={styles.descriptionMonde} />
              </Panneau>
            </View>
          </>
        )}

        {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

        <Separateur style={{ marginTop: espacement.lg, marginBottom: espacement.sm }} />
        <View style={styles.rangeeNavigation}>
          {etape > 0 && <Bouton titre={t('Précédent')} variante="secondaire" onPress={precedent} style={{ flex: 1 }} />}
          {etape < ETAPES.length - 1 ? (
            <Bouton titre={t('Suivant')} onPress={suivant} desactive={!etapeValide} style={{ flex: 1 }} />
          ) : (
            <Bouton
              titre={enregistrement ? t('Création…') : t("Commencer l'histoire")}
              onPress={valider}
              desactive={enregistrement}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </ScrollView>

      <Modal visible={modalPersonasOuvert} animationType="slide" onRequestClose={() => setModalPersonasOuvert(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.titre}>{t('Bibliothèque de personnages')}</Text>
          <FlatList
            data={personas}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable style={styles.lignePersona} onPress={() => choisirPersona(item)}>
                <Text style={styles.nomPersona}>{item.nom}</Text>
                {(item.sexe || item.raceOrigine || item.age) ? (
                  <Text style={styles.descriptionPersona}>
                    {[item.sexe ? t(item.sexe) : '', item.raceOrigine, item.age ? `${item.age} ${t('ans')}` : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                ) : null}
                <Text style={styles.descriptionPersona} numberOfLines={2}>
                  {item.description}
                </Text>
              </Pressable>
            )}
          />
          <Bouton titre={t('Fermer')} variante="secondaire" onPress={() => setModalPersonasOuvert(false)} style={{ marginTop: espacement.md }} />
        </View>
      </Modal>
    </KeyboardAvoidingView>
    </FondAtmospherique>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: espacement.lg,
    paddingTop: espacement.xl,
  },
  etapeIndicateur: {
    ...stylePetitesCapitales,
    color: couleurs.accentClair,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: espacement.md,
  },
  titre: {
    color: couleurs.dore,
    fontFamily: polices.titre,
    fontSize: 24,
    marginBottom: espacement.md,
  },
  label: {
    ...stylePetitesCapitales,
    color: couleurs.texteAtténué,
    fontSize: 12,
    marginTop: espacement.md,
    marginBottom: espacement.xs,
  },
  champConteneur: {
    marginTop: espacement.md,
  },
  portraitPersonnage: {
    width: '100%',
    aspectRatio: 3 / 4,
    marginTop: espacement.md,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: couleurs.bordure,
  },
  rangeeLabelCompteur: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  compteurCaracteres: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 12,
  },
  rangeeChoixMonde: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: espacement.md,
  },
  listeMondes: {
    flex: 1,
    gap: espacement.sm,
  },
  carteMonde: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: couleurs.bordure,
    backgroundColor: 'rgba(10, 13, 26, 0.55)',
    overflow: 'hidden',
  },
  carteMondeActive: {
    borderColor: couleurs.accent,
    ...ombresLueur,
  },
  imageCarteMonde: {
    width: 96,
    height: 76,
  },
  infoCarteMonde: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: espacement.sm,
  },
  nomMonde: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 18,
  },
  genreMonde: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 13,
    marginTop: 2,
  },
  presentationMonde: {
    flex: 1.4,
  },
  labelPresentation: {
    ...stylePetitesCapitales,
    color: couleurs.dore,
    fontSize: 13,
    textAlign: 'center',
  },
  imagePresentationMonde: {
    width: '100%',
    height: 140,
    marginBottom: espacement.sm,
  },
  descriptionMonde: {
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 15,
    lineHeight: 21,
  },
  rangeeTagsMonde: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacement.xs,
    marginTop: espacement.sm,
  },
  tagMonde: {
    borderWidth: 1,
    borderColor: couleurs.bordure,
    paddingHorizontal: espacement.sm,
    paddingVertical: 4,
  },
  texteTagMonde: {
    ...stylePetitesCapitales,
    color: couleurs.texteAtténué,
    fontSize: 10,
  },
  rangeeOptions: {
    flexDirection: 'row',
    gap: espacement.sm,
  },
  option: {
    flex: 1,
    paddingVertical: espacement.sm,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    alignItems: 'center',
  },
  optionActive: {
    borderColor: couleurs.accent,
    backgroundColor: 'rgba(90, 172, 255, 0.10)',
  },
  texteOption: {
    ...stylePetitesCapitales,
    color: couleurs.texteAtténué,
    fontSize: 12,
  },
  texteOptionActive: {
    color: couleurs.accentClair,
  },
  optionBloquee: {
    opacity: 0.35,
  },
  texteOptionBloquee: {
    color: couleurs.texteAtténué,
  },
  aide: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 13,
    marginTop: espacement.md,
  },
  aideTon: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 13,
    marginTop: espacement.xs,
  },
  rangeeFonctionnaliteAVenir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: espacement.sm,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bordure,
  },
  texteFonctionnaliteAVenir: {
    color: couleurs.texte,
    fontFamily: polices.corpsMedium,
    fontSize: 15,
  },
  aideFonctionnaliteAVenir: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 12,
    marginTop: 2,
  },
  boutonAction: {
    marginTop: espacement.md,
  },
  rangeeRecap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacement.md,
  },
  colonneRecapChamps: {
    flex: 1.4,
    gap: espacement.sm,
  },
  recapBloc: {
    marginBottom: 0,
  },
  enteteRecap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacement.sm,
    marginBottom: espacement.xs,
  },
  iconeRecap: {
    fontSize: 20,
    marginTop: 2,
  },
  recapLabel: {
    ...stylePetitesCapitales,
    color: couleurs.accentClair,
    fontSize: 12,
    marginBottom: 2,
  },
  recapTitreBloc: {
    color: couleurs.dore,
    fontFamily: polices.titre,
    fontSize: 18,
  },
  recapSousTitre: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 13,
    marginTop: 2,
  },
  recapTexte: {
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 16,
    lineHeight: 22,
  },
  zoneTexteDefilante: {
    borderWidth: 1,
    borderColor: couleurs.bordure,
    padding: espacement.sm,
    marginTop: espacement.xs,
  },
  grilleRecapPrefs: {
    flexDirection: 'row',
    gap: espacement.md,
  },
  colonneRecapPrefs: {
    flex: 1,
    gap: espacement.sm,
  },
  lignePreferenceRecap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacement.xs,
  },
  iconePreferenceRecap: {
    fontSize: 15,
  },
  labelPreferenceRecap: {
    ...stylePetitesCapitales,
    color: couleurs.texteAtténué,
    fontSize: 10,
  },
  valeurPreferenceRecap: {
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 14,
  },
  erreur: {
    color: couleurs.danger,
    fontFamily: polices.corps,
    marginTop: espacement.md,
  },
  rangeeNavigation: {
    flexDirection: 'row',
    gap: espacement.sm,
    marginBottom: espacement.xl,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: couleurs.fond,
    padding: espacement.lg,
    paddingTop: espacement.xl,
  },
  lignePersona: {
    paddingVertical: espacement.sm,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bordure,
  },
  nomPersona: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 17,
  },
  descriptionPersona: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 14,
    marginTop: 2,
  },
  selecteur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: couleurs.fondChampSaisie,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    paddingHorizontal: espacement.sm,
    paddingVertical: espacement.sm,
  },
  texteSelecteur: {
    flex: 1,
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 16,
  },
  texteSelecteurPlaceholder: {
    color: couleurs.texteAtténué,
  },
  chevronSelecteur: {
    color: couleurs.texteAtténué,
    marginLeft: espacement.sm,
  },
  presentationSelection: {
    marginTop: espacement.sm,
  },
  nomSelection: {
    color: couleurs.dore,
    fontFamily: polices.titre,
    fontSize: 17,
  },
  sousTitreSelection: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 13,
    marginTop: 2,
  },
  descriptionSelection: {
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 15,
    lineHeight: 21,
    marginTop: espacement.xs,
  },
  ligneOptionListe: {
    paddingVertical: espacement.sm,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bordure,
  },
  nomOptionListe: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 17,
  },
  sousTitreOptionListe: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 13,
    marginTop: 2,
  },
});
