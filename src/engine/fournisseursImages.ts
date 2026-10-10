import type { AppSettings } from '../types';
import type { GenerateurImage, RequeteImage } from './elyndorCloudImages';
import { genererImageOpenAI } from './openAiImages';
import {
 genererImageElyndorCloud, extraireImageReponse, ErreurImagesIndisponibles,
} from './elyndorCloudImages';

const ORIGIN = 'https://openrouter.ai/api/v1';
export interface CapacitesImages {
  id: string;
  nom: string;
  prisEnCharge: Record<string, unknown>;
  prix: Array<{ billable?:string;unit?:string;cost_usd?:number }>;
}

export async function listerModelesImagesOpenRouter(): Promise<Array<{id:string;nom:string}>> {
  const reponse = await fetch(ORIGIN+'/images/models');
  if (!reponse.ok) throw new ErreurImagesIndisponibles('Catalogue image OpenRouter indisponible.');
  const data=await reponse.json();
  return (Array.isArray(data?.data)?data.data:[])
    .filter((item:any)=>typeof item.id==='string')
    .map((item:any)=>({id:item.id,nom:item.name||item.id}));
}
export async function capacitesImageOpenRouter(id:string):Promise<CapacitesImages> {
  if(!/^[a-z0-9][\w.-]*\/[\w.:-]+$/i.test(id))throw new Error('Identifiant de modèle invalide.');
  const reponse=await fetch(ORIGIN+'/images/models/'+id+'/endpoints');
  if(!reponse.ok)throw new ErreurImagesIndisponibles('Capacités du modèle image indisponibles.');
  const data=await reponse.json();
  const endpoint=Array.isArray(data?.endpoints)?data.endpoints[0]:null;
  if(!endpoint)throw new ErreurImagesIndisponibles('Aucun endpoint image disponible.');
  return {id,nom:id,prisEnCharge:endpoint.supported_parameters||{},prix:endpoint.pricing||[]};
}
/** Aucune conversion silencieuse de champs LoRA/SDXL spécifiques au pod. */
export function requeteOpenRouterImage(
  req:RequeteImage,
  modele:string,
  options:Record<string,unknown>={},
):Record<string,unknown> {
  const autorises=new Set(Object.keys(options));
  const data:Record<string,unknown>={
    model:modele,
    prompt:req.promptCourt||req.prompt,
    n:1,
  };
  if(autorises.has('aspect_ratio'))data.aspect_ratio=req.format;
  if(autorises.has('seed') && typeof req.seed==='number')data.seed=req.seed;
  if(autorises.has('size') && req.size)data.size=req.size;
  if(autorises.has('input_references') && req.references.length){
    data.input_references=req.references.slice(0,4).map(r=>({
      type:'image_url',image_url:{url:r.image},
    }));
  }
  return data;
}
export function genererImageSelonReglages(settings:AppSettings):GenerateurImage {
  if(settings.fournisseurImages==='runpod')return genererImageElyndorCloud;
  if(settings.fournisseurImages==='openai'){
    if(settings.autoriserImagesPayantes!==true)throw new ErreurImagesIndisponibles('Images OpenAI bloquées : autorise explicitement la génération payante.');
    return genererImageOpenAI(settings.openAiApiKey||'',settings.modeleImagesOpenAI||'gpt-image-1-mini');
  }
  if(settings.fournisseurImages!=='openrouter')throw new ErreurImagesIndisponibles('Images désactivées : aucun GPU démarré.');
  const cle=settings.openRouterApiKey||'';
  const modele=settings.modeleImages||'';
  if(!cle||!modele)throw new ErreurImagesIndisponibles('Renseigne une clé et un modèle image OpenRouter.');
  if(settings.autoriserImagesPayantes!==true){
    throw new ErreurImagesIndisponibles('Images OpenRouter bloquées : active volontairement les appels payants.');
  }
  return async (req,signal)=>{
    const capacites=await capacitesImageOpenRouter(modele);
    const body=requeteOpenRouterImage(req,modele,capacites.prisEnCharge);
    const reponse=await fetch(ORIGIN+'/images',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+cle},
      body:JSON.stringify(body),
      signal,
    });
    if(!reponse.ok)throw new ErreurImagesIndisponibles('Erreur image OpenRouter HTTP '+reponse.status);
    const img=extraireImageReponse(await reponse.json());
    if(!img)throw new ErreurImagesIndisponibles('OpenRouter ne renvoie aucune image exploitable.');
    return img;
  };
}
