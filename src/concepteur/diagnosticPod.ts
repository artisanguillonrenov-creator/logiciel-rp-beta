import { validerIdentifiantPod } from './podStore';

export type StatutService = 'pret' | 'indisponible';
export interface ServicePod {
  service: 'narration' | 'images' | 'embeddings';
  statut: StatutService;
  dureeMs: number;
  details: string;
}
export interface DiagnosticPod { id: string; date: number; services: ServicePod[]; }

/**
 * Tests uniquement sur les routes canoniques *.proxy.runpod.net.
 * Trois GET sans prompt, génération d'image ni appel payant au modèle.
 * L'accès HTTP à un pod peut néanmoins être facturé par l'hébergeur.
 */
export async function diagnostiquerPod(
  candidat: string,
  lecteur: typeof fetch = fetch,
  delaiMs = 8500,
): Promise<DiagnosticPod> {
  const id = validerIdentifiantPod(candidat);
  const imageBase = `https://${id}-7860.proxy.runpod.net`;
  const narrationBase = `https://${id}-8000.proxy.runpod.net`;

  async function lire(url: string): Promise<{ ok: boolean; json: any; ms: number; code: number }> {
    const controller = new AbortController();
    const minuteur = setTimeout(() => controller.abort(), delaiMs);
    const start = Date.now();
    try {
      const response = await lecteur(url, { method: 'GET', signal: controller.signal });
      const json = response.ok ? await response.json().catch(() => null) : null;
      return { ok: response.ok, json, ms: Date.now() - start, code: response.status };
    } catch {
      return { ok: false, json: null, ms: Date.now() - start, code: 0 };
    } finally { clearTimeout(minuteur); }
  }

  const [narration, health, images] = await Promise.all([
    lire(`${narrationBase}/v1/models`),
    lire(`${imageBase}/health`),
    lire(`${imageBase}/v1/models`),
  ]);
  const modelsNarration = Array.isArray(narration.json?.data)
    ? narration.json.data.map((m: any) => String(m?.id ?? '')).filter(Boolean).slice(0, 10) : [];
  const modelsImage = Array.isArray(images.json?.data)
    ? images.json.data.map((m: any) => String(m?.id ?? '')).filter(Boolean).slice(0, 10) : [];
  const pretNarration = narration.ok && modelsNarration.length > 0;
  const pretImages = images.ok && modelsImage.length > 0 && health.ok && health.json?.status === 'ok';
  const pretEmbeddings = health.ok && health.json?.embeddings === true;
  return {
    id, date: Date.now(),
    services: [
      { service: 'narration', statut: pretNarration ? 'pret' : 'indisponible',
        dureeMs: narration.ms,
        details: pretNarration ? modelsNarration.join(', ') : `Modèles indisponibles (HTTP ${narration.code || 'réseau'}).` },
      { service: 'images', statut: pretImages ? 'pret' : 'indisponible',
        dureeMs: Math.max(health.ms, images.ms),
        details: pretImages ? modelsImage.join(', ') : `Images indisponibles (HTTP ${images.code || health.code || 'réseau'}).` },
      { service: 'embeddings', statut: pretEmbeddings ? 'pret' : 'indisponible',
        dureeMs: health.ms, details: pretEmbeddings ? 'Service annoncé prêt par /health.' : 'Service embeddings non déclaré prêt.' },
    ],
  };
}
