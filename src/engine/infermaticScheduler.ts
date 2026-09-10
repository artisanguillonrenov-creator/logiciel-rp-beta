let finFile: Promise<void> = Promise.resolve();

/** File FIFO globale : chat, embeddings et catalogue Infermatic partagent un seul créneau. */
export function planifierInfermatic<T>(operation: () => Promise<T>): Promise<T> {
  const execution = finFile.then(operation, operation);
  finFile = execution.then(() => undefined, () => undefined);
  return execution;
}

const MAX_TENTATIVES_429 = 3;
const BACKOFF_INITIAL_MS = 250;

function attenteRetryAfter(response: Response, tentative: number): number {
  const valeur = response.headers.get('Retry-After');
  if (valeur) {
    const secondes = Number(valeur);
    if (Number.isFinite(secondes)) return Math.max(0, secondes * 1000);
    const date = Date.parse(valeur);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return Math.min(2000, BACKOFF_INITIAL_MS * 2 ** (tentative - 1));
}

function attendre(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry 429 borné, exécuté à l'intérieur du créneau exclusif Infermatic. */
export function fetchInfermatic(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return planifierInfermatic(async () => {
    let derniere: Response | undefined;
    for (let tentative = 1; tentative <= MAX_TENTATIVES_429; tentative++) {
      const response = await fetch(input, init);
      derniere = response;
      if (response.status !== 429 || tentative === MAX_TENTATIVES_429) return response;
      await attendre(attenteRetryAfter(response, tentative));
    }
    return derniere!;
  });
}
