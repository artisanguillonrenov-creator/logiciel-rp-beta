import { CONFIG_CLOUD } from './configCloud';
import { stockageSession } from './sessionStore';
import { creerClientCloud } from './supabaseRest';

export interface ConfigurationRuntimeElyndor {
  runpodUrl: string;
  modele: string;
  apiKey: string;
}

// Client séparé et minimal : il partage le même stockage de session que le
// service cloud principal, mais ne dépend pas du moteur narratif ni du stockage
// des histoires. Cela évite une dépendance circulaire au démarrage.
const clientRuntime = creerClientCloud(CONFIG_CLOUD, stockageSession);

/**
 * Charge la configuration d'inférence privée appartenant à l'utilisateur
 * connecté. La clé RunPod reste dans Supabase (RLS) et n'est jamais commise
 * dans le dépôt GitHub ni embarquée en clair dans le code source.
 */
export async function chargerConfigurationRuntimeElyndor(): Promise<ConfigurationRuntimeElyndor | null> {
  const session = await clientRuntime.sessionValide().catch(() => null);
  if (!session) return null;

  const filtre = new URLSearchParams({
    select: 'runpod_api_key,runpod_url,model',
    user_id: `eq.${session.utilisateur.id}`,
    limit: '1',
  });

  let response: Response;
  try {
    response = await fetch(`${CONFIG_CLOUD.url}/rest/v1/runtime_config?${filtre.toString()}`, {
      headers: {
        apikey: CONFIG_CLOUD.cle,
        Authorization: `Bearer ${session.accessToken}`,
        Accept: 'application/json',
      },
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;
  const lignes = await response.json().catch(() => []);
  const config = Array.isArray(lignes) ? lignes[0] : null;
  const apiKey = typeof config?.runpod_api_key === 'string' ? config.runpod_api_key.trim() : '';
  const runpodUrl = typeof config?.runpod_url === 'string' ? config.runpod_url.trim() : '';
  const modele = typeof config?.model === 'string' ? config.model.trim() : '';
  if (!apiKey || !runpodUrl || !modele) return null;

  return { apiKey, runpodUrl, modele };
}
