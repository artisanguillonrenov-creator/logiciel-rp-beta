import fs from 'node:fs';

function lire(path) { return fs.readFileSync(path, 'utf8'); }
function ecrire(path, contenu) { fs.writeFileSync(path, contenu); }
function remplacer(contenu, ancien, nouveau, etiquette) {
  if (!contenu.includes(ancien)) throw new Error(`Patch V9 visuel impossible (${etiquette}) : marqueur introuvable.`);
  return contenu.replace(ancien, nouveau);
}

// 1) Réglage du fournisseur d'images.
{
  const path = 'src/types/index.ts';
  let s = lire(path);
  s = remplacer(
    s,
    `  modeleImagesGratuit?: boolean;\n}`,
    `  modeleImagesGratuit?: boolean;\n  // Fournisseur dédié aux images. Par défaut : ChatGPT si le narrateur est ChatGPT, OpenRouter sinon.\n  fournisseurImages?: 'chatgpt' | 'openrouter';\n}`,
    'AppSettings fournisseurImages',
  );
  ecrire(path, s);
}

// 2) Client ChatGPT : endpoint image de la même session que le narrateur.
{
  const path = 'src/engine/chatgptSubscription.ts';
  let s = lire(path);
  const marqueur = `export async function deconnecterChatGPT(): Promise<void> {`;
  const ajout = `export async function genererImageChatGPT(\n  prompt: string,\n  references: string[] = [],\n  signal?: AbortSignal,\n): Promise<string> {\n  const token = lireSessionChatGPT();\n  if (!token) throw new Error('ChatGPT Plus n’est pas connecté. Ouvre Réglages → IA & connexion.');\n  const response = await fetch(\`${'${CHATGPT_GATEWAY_URL}'}/image\`, {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json', ...headersAvecSession() },\n    body: JSON.stringify({ prompt, references: references.slice(0, 4) }),\n    signal,\n  });\n  if (response.status === 401) {\n    effacerSessionChatGPT();\n    throw new Error('La session ChatGPT a expiré. Reconnecte ton compte dans Réglages.');\n  }\n  const data = await lireJson(response);\n  const dataUrl = data?.dataUrl;\n  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {\n    throw new Error('ChatGPT n’a pas renvoyé d’image exploitable.');\n  }\n  return dataUrl;\n}\n\n`;
  s = remplacer(s, marqueur, ajout + marqueur, 'client /image');
  ecrire(path, s);
}

// 3) Capacités : ChatGPT Images n'a pas besoin de clé OpenRouter.
{
  const path = 'src/automation/capabilities.ts';
  let s = lire(path);
  s = remplacer(
    s,
    `  // La génération d'images utilise actuellement explicitement OpenRouter,\n  // même si le narrateur est Infermatic ou local : cette règle centralisée\n  // évite qu'un bouton prétende être disponible sans la clé requise.\n  const images = settings.genererImagesActive === true && cleOpenRouter;`,
    `  const fournisseurImages = settings.fournisseurImages ?? (fournisseur === 'chatgpt' ? 'chatgpt' : 'openrouter');\n  // ChatGPT Images réutilise la session Codex déjà connectée ; OpenRouter garde\n  // son comportement historique avec clé API. La validité de la session\n  // ChatGPT est vérifiée au moment de l'appel réseau.\n  const images = settings.genererImagesActive === true && (fournisseurImages === 'chatgpt' || cleOpenRouter);`,
    'capacité images multi-provider',
  );
  s = remplacer(
    s,
    `  if (!images) raisons.images = settings.genererImagesActive\n    ? 'La génération d’images nécessite une clé OpenRouter.'\n    : 'La génération d’images est désactivée.';`,
    `  if (!images) raisons.images = settings.genererImagesActive\n    ? (fournisseurImages === 'chatgpt' ? 'Connecte ChatGPT dans Réglages.' : 'La génération d’images nécessite une clé OpenRouter.')\n    : 'La génération d’images est désactivée.';`,
    'raison capacité images',
  );
  ecrire(path, s);
}

// 4) Planning visuel : identité stable par nom + locuteurs nommés détectés localement.
{
  const path = 'src/automation/visualPlanning.ts';
  const contenu = `import type { EntreeLoreEmergent, StoryState } from '../types';\nimport { analyserMessage } from '../engine/messageFormatter';\nimport { calculerRevisionNarrative } from './storyRevision';\n\nexport const ID_AVATAR_JOUEUR_VISUEL = '__joueur__';\n\nconst LOCUTEURS_GENERIQUES = new Set([\n  'narrateur', 'garde', 'gardes', 'courtier', 'notaire', 'commissaire-priseur',\n  'la captive', 'le captif', 'captive', 'captif', 'inconnue', 'inconnu',\n  "l'inconnue", "l'inconnu", 'foule', 'voix', 'homme', 'femme',\n]);\n\nfunction normaliserNom(value: string): string {\n  return value.trim().toLocaleLowerCase('fr').replace(/\\s+/g, ' ');\n}\n\nfunction hashNom(value: string): string {\n  let h = 2166136261;\n  for (let i = 0; i < value.length; i++) {\n    h ^= value.charCodeAt(i);\n    h = Math.imul(h, 16777619);\n  }\n  return (h >>> 0).toString(36);\n}\n\nfunction titreLisible(value: string): string {\n  return value.toLocaleLowerCase('fr').replace(/(^|[- '’])\\p{L}/gu, (m) => m.toLocaleUpperCase('fr'));\n}\n\nexport function idVisuelPnjDepuisNom(nom: string): string {\n  const normalise = normaliserNom(nom);\n  return \`visual-pnj-\${hashNom(normalise)}\`;\n}\n\nfunction estGenerique(nom: string): boolean {\n  return LOCUTEURS_GENERIQUES.has(normaliserNom(nom));\n}\n\nexport function listerPnjVisuels(story: StoryState): EntreeLoreEmergent[] {\n  const nomJoueur = normaliserNom(story.meta.personnageNom);\n  const parNom = new Map<string, EntreeLoreEmergent>();\n\n  for (const entree of story.loreEmergent.filter((e) => e.categorie === 'pnj')) {\n    const nom = normaliserNom(entree.titre);\n    if (!nom || nom === nomJoueur) continue;\n    parNom.set(nom, { ...entree, id: idVisuelPnjDepuisNom(entree.titre) });\n  }\n\n  story.messages.forEach((message, index) => {\n    if (message.role !== 'assistant') return;\n    for (const segment of analyserMessage(message.content)) {\n      if (segment.type !== 'repliquePersonnage' || !segment.locuteur) continue;\n      const nom = normaliserNom(segment.locuteur);\n      if (!nom || nom === nomJoueur || estGenerique(nom) || parNom.has(nom)) continue;\n      parNom.set(nom, {\n        id: idVisuelPnjDepuisNom(nom),\n        categorie: 'pnj',\n        titre: titreLisible(segment.locuteur),\n        contenu: \`Personnage nommé présent dans le récit. Contexte visuel de sa première détection : \${message.content.slice(0, 700)}\`,\n        statut: 'provisoire',\n        premiereMention: index,\n        dernierAcces: index,\n      });\n    }\n  });\n\n  return [...parNom.values()];\n}\n\nexport function listerIdsPnjVisuels(story: StoryState): string[] {\n  return listerPnjVisuels(story).map((entree) => entree.id);\n}\n\nexport function cleDedupeSynchronisationAvatars(story: StoryState): string {\n  return \`visual.avatars.sync:\${story.meta.id}:\${calculerRevisionNarrative(story)}\`;\n}\n\nexport function cleDedupeAvatar(storyId: string, assetId: string, forceToken?: string): string {\n  return forceToken\n    ? \`visual.avatar.generate:\${storyId}:\${assetId}:\${forceToken}\`\n    : \`visual.avatar.generate:\${storyId}:\${assetId}\`;\n}\n\nexport function cleDedupeScene(story: StoryState, forceToken?: string): string {\n  const revision = calculerRevisionNarrative(story);\n  return forceToken\n    ? \`visual.scene.generate:\${story.meta.id}:\${revision}:\${forceToken}\`\n    : \`visual.scene.generate:\${story.meta.id}:\${revision}\`;\n}\n`;
  ecrire(path, contenu);
}

// 5) Hook UI : même liste visuelle (lore + locuteurs nommés instantanément).
{
  const path = 'src/automation/useVisualAutomation.ts';
  let s = lire(path);
  s = remplacer(
    s,
    `import { ID_AVATAR_JOUEUR_VISUEL } from './visualPlanning';`,
    `import { ID_AVATAR_JOUEUR_VISUEL, listerPnjVisuels } from './visualPlanning';`,
    'import listerPnjVisuels',
  );
  s = remplacer(
    s,
    `function filtrerPnj(story: StoryState | null): EntreeLoreEmergent[] {\n  if (!story) return [];\n  const nomJoueur = story.meta.personnageNom.trim().toLowerCase();\n  return story.loreEmergent.filter(\n    (entree) => entree.categorie === 'pnj' && entree.titre.trim().toLowerCase() !== nomJoueur,\n  );\n}`,
    `function filtrerPnj(story: StoryState | null): EntreeLoreEmergent[] {\n  return story ? listerPnjVisuels(story) : [];\n}`,
    'liste PNJ visuels',
  );
  ecrire(path, s);
}

// 6) Orchestrateur visuel : références canoniques et détection via prompt visuel + narration.
{
  const path = 'src/automation/visualRoutines.ts';
  let s = lire(path);
  s = remplacer(
    s,
    `  listerIdsPnjVisuels,\n} from './visualPlanning';`,
    `  listerIdsPnjVisuels,\n  listerPnjVisuels,\n} from './visualPlanning';`,
    'import liste PNJ visuels routines',
  );
  s = s.replace(`const MAX_PNJ_REFERENCE_SCENE = 2;`, `const MAX_PNJ_REFERENCE_SCENE = 3;`);
  s = remplacer(
    s,
    `  const pnj = story.loreEmergent.find((entree) => entree.id === assetId && entree.categorie === 'pnj');`,
    `  const pnj = listerPnjVisuels(story).find((entree) => entree.id === assetId);`,
    'résolution avatar visuel',
  );
  s = remplacer(
    s,
    `  const texteSceneMinuscule = (dernierMessageNarrateur?.content ?? story.meta.pointDeDepart).toLowerCase();\n\n  const refsPnj: string[] = [];\n  for (const pnj of story.loreEmergent\n    .filter((entree) => entree.categorie === 'pnj')\n    .filter((entree) => pnjMentionneDansTexte(entree, texteSceneMinuscule))) {`,
    `  // La description visuelle produite par le narrateur est ajoutée à la\n  // détection : elle rétablit souvent le nom d'un personnage que la prose\n  // venait de désigner seulement par son rôle, sa race ou un pronom.\n  const texteSceneMinuscule = \`${'${dernierMessageNarrateur?.content ?? story.meta.pointDeDepart}'}\\n${'${prompt}'}\`.toLowerCase();\n\n  const refsPnj: string[] = [];\n  for (const pnj of listerPnjVisuels(story)\n    .filter((entree) => pnjMentionneDansTexte(entree, texteSceneMinuscule))) {`,
    'détection PNJ présents étendue',
  );
  s = remplacer(
    s,
    `  const dataUrl = await genererImageScene(\n    settings.openRouterApiKey,\n    prompt,\n    settings.modeleImagesGratuit,\n    [portraitReference, avatarJoueur, ...refsPnj],\n  );`,
    `  // Une seule identité canonique pour le joueur : l'avatar personnel\n  // généré prime ; le portrait race/sexe ne sert que de repli.\n  const referenceJoueur = avatarJoueur || portraitReference;\n  const dataUrl = await genererImageScene(\n    settings,\n    prompt,\n    [referenceJoueur, ...refsPnj],\n  );`,
    'références canoniques scène',
  );
  ecrire(path, s);
}

// 7) Routage image ChatGPT/OpenRouter en conservant la signature historique pour les tests/anciens appels.
{
  const path = 'src/engine/images.ts';
  let s = lire(path);
  s = remplacer(
    s,
    `import { obtenirPortrait } from '../data/portraits';`,
    `import { obtenirPortrait } from '../data/portraits';\nimport { genererImageChatGPT } from './chatgptSubscription';`,
    'import générateur ChatGPT Image',
  );
  const ancienScene = `export async function genererImageScene(\n  apiKey: string,\n  prompt: string,\n  gratuit?: boolean,\n  imagesReference?: (string | null | undefined)[]\n): Promise<string> {\n  const images = (imagesReference ?? []).filter((u): u is string => !!u).slice(0, MAX_IMAGES_REFERENCE_SCENE);\n  return appellerModeleImage(apiKey, prompt, gratuit, images.length > 0 ? images : undefined);\n}`;
  const nouveauScene = `export async function genererImageScene(\n  settingsOuCle: AppSettings | string,\n  prompt: string,\n  gratuitOuReferences?: boolean | (string | null | undefined)[],\n  imagesReference?: (string | null | undefined)[]\n): Promise<string> {\n  const references = Array.isArray(gratuitOuReferences) ? gratuitOuReferences : imagesReference;\n  const images = (references ?? []).filter((u): u is string => !!u).slice(0, MAX_IMAGES_REFERENCE_SCENE);\n  if (typeof settingsOuCle === 'string') {\n    return appellerModeleImageOpenRouter(\n      settingsOuCle,\n      prompt,\n      typeof gratuitOuReferences === 'boolean' ? gratuitOuReferences : undefined,\n      images.length > 0 ? images : undefined,\n    );\n  }\n  return appellerModeleImageSelonSettings(settingsOuCle, prompt, images.length > 0 ? images : undefined);\n}`;
  s = remplacer(s, ancienScene, nouveauScene, 'genererImageScene multi-provider');
  s = s.replaceAll(
    `const url = await appellerModeleImage(appSettings.openRouterApiKey, prompt, appSettings.modeleImagesGratuit);`,
    `const url = await appellerModeleImageSelonSettings(appSettings, prompt);`,
  );
  const marqueur = `async function appellerModeleImage(\n  apiKey: string,`;
  const wrapper = `async function appellerModeleImageSelonSettings(\n  appSettings: AppSettings,\n  prompt: string,\n  imagesReference?: string[],\n): Promise<string> {\n  const fournisseur = appSettings.fournisseurImages ?? (appSettings.moteurInference === 'chatgpt' ? 'chatgpt' : 'openrouter');\n  if (fournisseur === 'chatgpt') {\n    const references = await Promise.all((imagesReference ?? []).slice(0, MAX_IMAGES_REFERENCE_SCENE).map(preparerImageReference));\n    return genererImageChatGPT(prompt, references);\n  }\n  return appellerModeleImageOpenRouter(appSettings.openRouterApiKey, prompt, appSettings.modeleImagesGratuit, imagesReference);\n}\n\nasync function appellerModeleImageOpenRouter(\n  apiKey: string,`;
  s = remplacer(s, marqueur, wrapper, 'wrapper fournisseur image');
  ecrire(path, s);
}

// 8) Stockage avatars : IndexedDB persistant sur Netlify/Web, fichiers sur natif.
{
  const path = 'src/storage/pnjAvatarsStore.ts';
  const contenu = `import { Platform } from 'react-native';\nimport { Directory, File, Paths } from 'expo-file-system';\nimport { ecrireVisuelWeb, lireVisuelWeb, supprimerVisuelWeb, supprimerVisuelsWebOrphelins, supprimerVisuelsWebParPrefixe } from './visualBinaryStore';\n\nconst DOSSIER_AVATARS = 'pnj-avatars';\nconst PREFIXE_WEB = 'avatar:';\n\nfunction nettoyerSegment(value: string): string { return value.replace(/[^a-zA-Z0-9_-]/g, '_'); }\nfunction prefixeHistoire(storyId: string): string { return \`${'${nettoyerSegment(storyId)}'}_\`; }\nfunction nomFichier(storyId: string, pnjId: string): string { return \`${'${nettoyerSegment(`${storyId}_${pnjId}`)}'}.png\`; }\nfunction cleWeb(storyId: string, pnjId: string): string { return \`${'${PREFIXE_WEB}${prefixeHistoire(storyId)}${nettoyerSegment(pnjId)}'}\`; }\nfunction prefixeWebHistoire(storyId: string): string { return \`${'${PREFIXE_WEB}${prefixeHistoire(storyId)}'}\`; }\nfunction extraireBase64(dataUrl: string): string { const virgule = dataUrl.indexOf(','); return virgule === -1 ? dataUrl : dataUrl.slice(virgule + 1); }\n\nexport async function obtenirAvatarPnj(storyId: string, pnjId: string): Promise<string | null> {\n  if (Platform.OS === 'web') return lireVisuelWeb(cleWeb(storyId, pnjId));\n  const fichier = new File(Paths.document, DOSSIER_AVATARS, nomFichier(storyId, pnjId));\n  return fichier.exists ? fichier.uri : null;\n}\n\nexport async function enregistrerAvatarPnj(storyId: string, pnjId: string, dataUrl: string): Promise<string> {\n  if (Platform.OS === 'web') return ecrireVisuelWeb(cleWeb(storyId, pnjId), dataUrl);\n  const dossier = new Directory(Paths.document, DOSSIER_AVATARS);\n  if (!dossier.exists) dossier.create({ intermediates: true });\n  const fichier = new File(dossier, nomFichier(storyId, pnjId));\n  fichier.create({ overwrite: true });\n  fichier.write(extraireBase64(dataUrl), { encoding: 'base64' });\n  return fichier.uri;\n}\n\nexport async function preparerImageReference(uri: string): Promise<string> {\n  if (uri.startsWith('data:image/')) return uri;\n  if (uri.startsWith('file:')) { const fichier = new File(uri); return \`data:image/png;base64,${'${await fichier.base64()}'}\`; }\n  return uri;\n}\n\nexport async function supprimerAvatarPnj(storyId: string, pnjId: string): Promise<void> {\n  if (Platform.OS === 'web') { await supprimerVisuelWeb(cleWeb(storyId, pnjId)); return; }\n  const fichier = new File(Paths.document, DOSSIER_AVATARS, nomFichier(storyId, pnjId));\n  if (fichier.exists) fichier.delete();\n}\n\nexport async function supprimerAvatarsHistoire(storyId: string): Promise<void> {\n  if (Platform.OS === 'web') { await supprimerVisuelsWebParPrefixe(prefixeWebHistoire(storyId)); return; }\n  const dossier = new Directory(Paths.document, DOSSIER_AVATARS);\n  if (!dossier.exists) return;\n  const prefixe = prefixeHistoire(storyId);\n  for (const entree of dossier.list()) if (entree instanceof File && entree.name.startsWith(prefixe)) entree.delete();\n}\n\nexport async function supprimerAvatarsOrphelins(storyIdsValides: readonly string[]): Promise<number> {\n  if (Platform.OS === 'web') return supprimerVisuelsWebOrphelins(PREFIXE_WEB, storyIdsValides.map(prefixeWebHistoire));\n  const dossier = new Directory(Paths.document, DOSSIER_AVATARS);\n  if (!dossier.exists) return 0;\n  const prefixesValides = storyIdsValides.map(prefixeHistoire);\n  let supprimes = 0;\n  for (const entree of dossier.list()) {\n    if (!(entree instanceof File) || prefixesValides.some((prefixe) => entree.name.startsWith(prefixe))) continue;\n    entree.delete(); supprimes++;\n  }\n  return supprimes;\n}\n`;
  ecrire(path, contenu);
}

// 9) Stockage scènes : même persistance IndexedDB sur Web.
{
  const path = 'src/storage/sceneImagesStore.ts';
  const contenu = `import { Platform } from 'react-native';\nimport { Directory, File, Paths } from 'expo-file-system';\nimport { ecrireVisuelWeb, lireVisuelWeb, supprimerVisuelsWebOrphelins, supprimerVisuelsWebParPrefixe } from './visualBinaryStore';\n\nconst DOSSIER_SCENES = 'scene-images';\nconst PREFIXE_WEB = 'scene:';\nfunction nettoyerSegment(value: string): string { return value.replace(/[^a-zA-Z0-9_-]/g, '_'); }\nfunction prefixeHistoire(storyId: string): string { return \`${'${nettoyerSegment(storyId)}'}_\`; }\nfunction nomFichier(storyId: string, revision: string): string { return \`${'${prefixeHistoire(storyId)}${nettoyerSegment(revision)}'}.png\`; }\nfunction cleWeb(storyId: string, revision: string): string { return \`${'${PREFIXE_WEB}${prefixeHistoire(storyId)}${nettoyerSegment(revision)}'}\`; }\nfunction prefixeWebHistoire(storyId: string): string { return \`${'${PREFIXE_WEB}${prefixeHistoire(storyId)}'}\`; }\nfunction extraireBase64(dataUrl: string): string { const virgule = dataUrl.indexOf(','); return virgule === -1 ? dataUrl : dataUrl.slice(virgule + 1); }\n\nexport async function obtenirIllustrationScene(storyId: string, revision: string): Promise<string | null> {\n  if (Platform.OS === 'web') return lireVisuelWeb(cleWeb(storyId, revision));\n  const fichier = new File(Paths.document, DOSSIER_SCENES, nomFichier(storyId, revision));\n  return fichier.exists ? fichier.uri : null;\n}\n\nexport async function enregistrerIllustrationScene(storyId: string, revision: string, dataUrl: string): Promise<string> {\n  if (Platform.OS === 'web') {\n    const cible = cleWeb(storyId, revision);\n    await supprimerVisuelsWebParPrefixe(prefixeWebHistoire(storyId), cible);\n    return ecrireVisuelWeb(cible, dataUrl);\n  }\n  const dossier = new Directory(Paths.document, DOSSIER_SCENES);\n  if (!dossier.exists) dossier.create({ intermediates: true });\n  const prefixe = prefixeHistoire(storyId);\n  const cible = nomFichier(storyId, revision);\n  for (const entree of dossier.list()) if (entree instanceof File && entree.name.startsWith(prefixe) && entree.name !== cible) entree.delete();\n  const fichier = new File(dossier, cible);\n  fichier.create({ overwrite: true });\n  fichier.write(extraireBase64(dataUrl), { encoding: 'base64' });\n  return fichier.uri;\n}\n\nexport async function supprimerIllustrationsHistoire(storyId: string): Promise<void> {\n  if (Platform.OS === 'web') { await supprimerVisuelsWebParPrefixe(prefixeWebHistoire(storyId)); return; }\n  const dossier = new Directory(Paths.document, DOSSIER_SCENES);\n  if (!dossier.exists) return;\n  const prefixe = prefixeHistoire(storyId);\n  for (const entree of dossier.list()) if (entree instanceof File && entree.name.startsWith(prefixe)) entree.delete();\n}\n\nexport async function supprimerIllustrationsOrphelines(storyIdsValides: readonly string[]): Promise<number> {\n  if (Platform.OS === 'web') return supprimerVisuelsWebOrphelins(PREFIXE_WEB, storyIdsValides.map(prefixeWebHistoire));\n  const dossier = new Directory(Paths.document, DOSSIER_SCENES);\n  if (!dossier.exists) return 0;\n  const prefixesValides = storyIdsValides.map(prefixeHistoire);\n  let supprimees = 0;\n  for (const entree of dossier.list()) {\n    if (!(entree instanceof File) || prefixesValides.some((prefixe) => entree.name.startsWith(prefixe))) continue;\n    entree.delete(); supprimees++;\n  }\n  return supprimees;\n}\n`;
  ecrire(path, contenu);
}

// 10) Réglages UI : choix ChatGPT Plus / OpenRouter pour les images.
{
  const path = 'src/screens/SettingsScreen.tsx';
  let s = lire(path);
  s = remplacer(
    s,
    `  const [genererImagesActive, setGenererImagesActive] = useState(false);\n  const [modeleImagesGratuit, setModeleImagesGratuit] = useState(false);`,
    `  const [genererImagesActive, setGenererImagesActive] = useState(false);\n  const [modeleImagesGratuit, setModeleImagesGratuit] = useState(false);\n  const [fournisseurImages, setFournisseurImages] = useState<'chatgpt' | 'openrouter'>('openrouter');`,
    'state fournisseur images',
  );
  s = remplacer(
    s,
    `      setGenererImagesActive(settings.genererImagesActive ?? false);\n      setModeleImagesGratuit(settings.modeleImagesGratuit ?? false);`,
    `      setGenererImagesActive(settings.genererImagesActive ?? false);\n      setModeleImagesGratuit(settings.modeleImagesGratuit ?? false);\n      setFournisseurImages(settings.fournisseurImages ?? (settings.moteurInference === 'chatgpt' ? 'chatgpt' : 'openrouter'));`,
    'chargement fournisseur images',
  );
  s = remplacer(
    s,
    `        genererImagesActive,\n        modeleImagesGratuit,`,
    `        genererImagesActive,\n        modeleImagesGratuit,\n        fournisseurImages,`,
    'sauvegarde fournisseur images',
  );
  s = remplacer(
    s,
    `  const illustrationsPretes = genererImagesActive && !!apiKey.trim();\n  const etatIllustrations = !genererImagesActive\n    ? t('Désactivées')\n    : illustrationsPretes\n      ? t('Prêtes')\n      : t('Clé OpenRouter requise');`,
    `  const illustrationsPretes = genererImagesActive && (fournisseurImages === 'chatgpt' ? chatgptConnecte : !!apiKey.trim());\n  const etatIllustrations = !genererImagesActive\n    ? t('Désactivées')\n    : illustrationsPretes\n      ? (fournisseurImages === 'chatgpt' ? t('ChatGPT Plus · prête') : t('OpenRouter · prête'))\n      : fournisseurImages === 'chatgpt'\n        ? t('Connexion ChatGPT requise')\n        : t('Clé OpenRouter requise');`,
    'état illustrations',
  );
  s = remplacer(
    s,
    `              <Text style={styles.aide}>{t('Quand elle est active et qu’une clé OpenRouter est configurée, l’action « Illustrer cette scène » apparaît dans le récit. Les illustrations sont conservées localement pour l’histoire et supprimées avec elle.')}</Text>`,
    `              <Text style={styles.aide}>{t('Quand elle est active, l’action « Illustrer cette scène » apparaît dans le récit. Les portraits et illustrations restent enregistrés localement et servent de références visuelles aux scènes suivantes.')}</Text>`,
    'aide illustrations',
  );
  const ancienBloc = `              {genererImagesActive && (\n                <View style={styles.blocFournisseur}>\n                  {moteurInference !== 'openrouter' && (\n                    <Champ\n                      label={t('Clé OpenRouter pour les images')}\n                      value={apiKey}\n                      onChangeText={setApiKey}\n                      placeholder="sk-or-v1-…"\n                      secureTextEntry\n                      autoCapitalize="none"\n                      autoCorrect={false}\n                      conteneurStyle={styles.champConteneur}\n                    />\n                  )}\n                  {!apiKey.trim() && (\n                    <Text style={[styles.aide, { color: couleurs.danger }]}>{t('Une clé API OpenRouter est requise pour les illustrations et les portraits générés, même si le narrateur utilise Infermatic ou un modèle local.')}</Text>\n                  )}\n                  <Text style={styles.label}>{t("Mode d'images")}</Text>\n                  <View style={styles.rangeeMoteur}>\n                    <Pressable\n                      style={[styles.optionMoteur, !modeleImagesGratuit && styles.optionMoteurActive]}\n                      onPress={() => setModeleImagesGratuit(false)}\n                    >\n                      <Text style={[styles.texteOptionMoteur, !modeleImagesGratuit && styles.texteOptionMoteurActif]}>{t('Payant · fiable')}</Text>\n                    </Pressable>\n                    <Pressable\n                      style={[styles.optionMoteur, modeleImagesGratuit && styles.optionMoteurActive]}\n                      onPress={() => setModeleImagesGratuit(true)}\n                    >\n                      <Text style={[styles.texteOptionMoteur, modeleImagesGratuit && styles.texteOptionMoteurActif]}>{t('Gratuit · limité')}</Text>\n                    </Pressable>\n                  </View>\n                  <Text style={styles.aide}>{t('La génération d’images utilise actuellement OpenRouter, indépendamment du fournisseur choisi pour le narrateur.')}</Text>\n                </View>\n              )}`;
  const nouveauBloc = `              {genererImagesActive && (\n                <View style={styles.blocFournisseur}>\n                  <Text style={styles.label}>{t("Fournisseur d'images")}</Text>\n                  <View style={styles.rangeeMoteur}>\n                    <Pressable\n                      style={[styles.optionMoteur, fournisseurImages === 'chatgpt' && styles.optionMoteurActive]}\n                      onPress={() => setFournisseurImages('chatgpt')}\n                    >\n                      <Text style={[styles.texteOptionMoteur, fournisseurImages === 'chatgpt' && styles.texteOptionMoteurActif]}>ChatGPT Plus</Text>\n                    </Pressable>\n                    <Pressable\n                      style={[styles.optionMoteur, fournisseurImages === 'openrouter' && styles.optionMoteurActive]}\n                      onPress={() => setFournisseurImages('openrouter')}\n                    >\n                      <Text style={[styles.texteOptionMoteur, fournisseurImages === 'openrouter' && styles.texteOptionMoteurActif]}>OpenRouter</Text>\n                    </Pressable>\n                  </View>\n\n                  {fournisseurImages === 'chatgpt' ? (\n                    <>\n                      <Text style={styles.aide}>{t('Réutilise la même connexion ChatGPT/Codex que le narrateur. La génération intégrée utilise GPT Image et consomme le quota inclus de ton compte ChatGPT.')}</Text>\n                      {!chatgptConnecte && <Text style={[styles.aide, { color: couleurs.danger }]}>{t('Connecte d’abord ChatGPT Plus dans la section Narrateur.')}</Text>}\n                    </>\n                  ) : (\n                    <>\n                      {moteurInference !== 'openrouter' && (\n                        <Champ\n                          label={t('Clé OpenRouter pour les images')}\n                          value={apiKey}\n                          onChangeText={setApiKey}\n                          placeholder="sk-or-v1-…"\n                          secureTextEntry\n                          autoCapitalize="none"\n                          autoCorrect={false}\n                          conteneurStyle={styles.champConteneur}\n                        />\n                      )}\n                      {!apiKey.trim() && <Text style={[styles.aide, { color: couleurs.danger }]}>{t('Une clé API OpenRouter est requise pour ce fournisseur d’images.')}</Text>}\n                      <Text style={styles.label}>{t("Mode d'images OpenRouter")}</Text>\n                      <View style={styles.rangeeMoteur}>\n                        <Pressable style={[styles.optionMoteur, !modeleImagesGratuit && styles.optionMoteurActive]} onPress={() => setModeleImagesGratuit(false)}>\n                          <Text style={[styles.texteOptionMoteur, !modeleImagesGratuit && styles.texteOptionMoteurActif]}>{t('Payant · fiable')}</Text>\n                        </Pressable>\n                        <Pressable style={[styles.optionMoteur, modeleImagesGratuit && styles.optionMoteurActive]} onPress={() => setModeleImagesGratuit(true)}>\n                          <Text style={[styles.texteOptionMoteur, modeleImagesGratuit && styles.texteOptionMoteurActif]}>{t('Gratuit · limité')}</Text>\n                        </Pressable>\n                      </View>\n                    </>\n                  )}\n                </View>\n              )}`;
  s = remplacer(s, ancienBloc, nouveauBloc, 'UI fournisseur images');
  ecrire(path, s);
}

// 11) Version V9.
{
  const path = 'src/version.ts';
  let s = lire(path);
  s = s.replace(/VERSION_APP = '[^']+'/, "VERSION_APP = '1.32.0-visual-identity-chatgpt-image-beta'");
  ecrire(path, s);
}

console.log('V9 : fournisseur ChatGPT Image, identité visuelle persistante et références canoniques appliqués.');
