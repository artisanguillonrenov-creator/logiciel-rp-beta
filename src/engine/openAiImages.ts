import type { RequeteImage, GenerateurImage } from './elyndorCloudImages';
import { ErreurImagesIndisponibles, extraireImageReponse } from './elyndorCloudImages';
import { journaliser, resumerReferences } from './journalDiagnostic';

const API = 'https://api.openai.com/v1';
export const MODELE_IMAGE_OPENAI_DEFAUT = 'gpt-image-1-mini';
export const MODELES_IMAGES_OPENAI_SUGGERES = [
  'gpt-image-2.5-sunburst',
  'gpt-image-2.5-flare',
  'gpt-image-2',
  'gpt-image-1.5',
  'gpt-image-1-mini',
  'gpt-image-1',
] as const;

export function estModeleImageOpenAI(id: string): boolean {
  return /^gpt-image-[a-z0-9][a-z0-9._-]*$/i.test(id);
}

export async function listerModelesImagesOpenAI(cleApi: string): Promise<Array<{id:string;nom:string}>> {
  if (!cleApi.trim()) throw new ErreurImagesIndisponibles('Renseigne ta clé API OpenAI.');
  const reponse = await fetch(API + '/models', {
    headers: { Authorization: 'Bearer ' + cleApi.trim() },
  });
  if (!reponse.ok) throw new ErreurImagesIndisponibles(
    reponse.status === 401 ? 'Clé API OpenAI refusée (401).' : 'Catalogue des modèles image OpenAI indisponible (' + reponse.status + ').',
  );
  const donnees = await reponse.json() as { data?: Array<{ id?: unknown }> };
  return (Array.isArray(donnees.data) ? donnees.data : [])
    .filter((x): x is {id:string} => typeof x.id === 'string' && estModeleImageOpenAI(x.id))
    .map(x => ({ id: x.id, nom: x.id }))
    .sort((a,b) => b.id.localeCompare(a.id, undefined, { numeric: true }));
}

/** Les paramètres RunPod (LoRA, seed, negative_prompt, SDXL...) ne sont jamais transmis à OpenAI. */
export function construireCorpsImageOpenAI(req: RequeteImage, modele: string) {
  const versionRecente = /^gpt-image-(?:2(?:\.|-|$))/i.test(modele);
  const taille = versionRecente
    ? (req.format === '16:9' ? '1536x864' : '960x1280')
    : (req.format === '16:9' ? '1536x1024' : '1024x1536');
  return {
    model: modele,
    prompt: req.prompt,
    n: 1,
    size: taille,
    output_format: 'png',
    quality: 'medium',
  };
}

async function preparerReferences(references: RequeteImage['references']): Promise<{ formulaire: FormData; nettoyer: () => void }> {
  const formulaire = new FormData();
  const fichiersTemporaires: Array<{ delete: () => void }> = [];
  try {
    // React Native attend un fichier local {uri, type, name} pour le multipart.
    // Le navigateur accepte les Blobs. Toutes les références arrivent en data URL.
    const { Platform } = await import('react-native');
    if (Platform.OS !== 'web') {
      const { Directory, File, Paths } = await import('expo-file-system');
      const dir = new Directory(Paths.cache, 'openai-image-references');
      if (!dir.exists) dir.create({ intermediates: true });
      for (const [index, ref] of references.slice(0, 4).entries()) {
        const matche = /^data:image\/(png|jpeg|webp);base64,([\s\S]+)$/i.exec(ref.image);
        if (!matche) throw new ErreurImagesIndisponibles('Référence d’image OpenAI non prise en charge.');
        const ext = matche[1].toLowerCase() === 'jpeg' ? 'jpg' : matche[1].toLowerCase();
        const nom = 'reference-' + Date.now() + '-' + index + '-' + Math.random().toString(36).slice(2) + '.' + ext;
        const fichier = new File(dir, nom);
        fichier.create();
        fichiersTemporaires.push(fichier);
        fichier.write(matche[2], { encoding: 'base64' });
        formulaire.append('image[]', { uri: fichier.uri, type: 'image/' + matche[1].toLowerCase(), name: nom } as unknown as Blob);
      }
    } else {
      for (const [index, ref] of references.slice(0, 4).entries()) {
        if (!ref.image.startsWith('data:image/')) throw new ErreurImagesIndisponibles('Référence d’image OpenAI invalide.');
        const blob = await (await fetch(ref.image)).blob();
        formulaire.append('image[]', blob, 'reference-' + index + '.png');
      }
    }
    return {
      formulaire,
      nettoyer: () => { for (const f of fichiersTemporaires) { try { f.delete(); } catch {} } },
    };
  } catch (erreur) {
    for (const f of fichiersTemporaires) { try { f.delete(); } catch {} }
    throw erreur;
  }
}

async function detailErreur(response: Response): Promise<string> {
  try {
    const data = await response.json() as { error?: { message?: string } };
    return typeof data.error?.message === 'string' ? data.error.message.slice(0, 350) : '';
  } catch { return ''; }
}

/** Utilise /images/edits en présence de références pour préserver les visages et décors. */
export function genererImageOpenAI(cleApi: string, modele: string): GenerateurImage {
  if (!cleApi.trim()) throw new ErreurImagesIndisponibles('Clé API OpenAI manquante pour les images.');
  if (!estModeleImageOpenAI(modele)) throw new ErreurImagesIndisponibles('Choisis un modèle GPT Image valide.');
  return async (req, signal) => {
    const debut = Date.now();
    const corps = construireCorpsImageOpenAI(req, modele);
    let nettoyage: (() => void) | undefined;
    try {
      let options: RequestInit;
      let url: string;
      if (req.references.some(r => !!r.image)) {
        const refs = await preparerReferences(req.references.filter(r => !!r.image));
        nettoyage = refs.nettoyer;
        for (const [k, v] of Object.entries(corps)) refs.formulaire.append(k, String(v));
        url = API + '/images/edits';
        options = { method: 'POST', headers: { Authorization: 'Bearer ' + cleApi.trim() }, body: refs.formulaire, signal };
      } else {
        url = API + '/images/generations';
        options = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cleApi.trim() },
          body: JSON.stringify(corps), signal,
        };
      }
      const reponse = await fetch(url, options);
      if (!reponse.ok) {
        const detail = await detailErreur(reponse);
        throw new ErreurImagesIndisponibles('OpenAI Images HTTP ' + reponse.status + (detail ? ' : ' + detail : ''));
      }
      const image = extraireImageReponse(await reponse.json());
      if (!image) throw new ErreurImagesIndisponibles('OpenAI ne renvoie aucune image exploitable.');
      journaliser('image', { modele, fournisseur: 'openai', format: req.format,
        references: resumerReferences(req.references), statut: 'ok', dureeMs: Date.now() - debut }, req.storyId);
      return image;
    } catch (erreur) {
      journaliser('image', { modele, fournisseur: 'openai', format: req.format,
        statut: 'erreur', dureeMs: Date.now() - debut,
        raison: erreur instanceof Error ? erreur.message : String(erreur) }, req.storyId);
      if (erreur instanceof ErreurImagesIndisponibles) throw erreur;
      if (signal?.aborted) throw new ErreurImagesIndisponibles('Génération d’image OpenAI annulée.');
      throw new ErreurImagesIndisponibles('Connexion aux images OpenAI impossible : ' + (erreur instanceof Error ? erreur.message : String(erreur)));
    } finally {
      nettoyage?.();
    }
  };
}
