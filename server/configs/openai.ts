import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.AI_API_KEY,
});

// Liste de modeles separes par des virgules, du prefere au dernier recours.
// Les endpoints :free sont limites en nombre de requetes, donc on bascule
// sur le suivant des que le fournisseur repond 429.
export const AI_MODELS = (process.env.AI_MODEL || 'google/gemma-4-31b-it:free')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

export const AI_MODEL = AI_MODELS[0];

// Les modeles a raisonnement renvoient leur texte dans `reasoning` et laissent
// `content` vide. On coupe le raisonnement.
export const AI_EXTRA = { reasoning: { exclude: true } } as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Codes qui justifient de tenter le modele suivant plutot que d'abandonner.
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Appelle OpenRouter en parcourant AI_MODELS. Deux passages sur la liste,
 * avec une pause entre les deux, ce qui suffit pour absorber un 429 passager.
 */
export async function aiChat(params: any): Promise<any> {
  let lastError: any;

  for (let round = 0; round < 2; round++) {
    for (const model of AI_MODELS) {
      try {
        return await openai.chat.completions.create({ ...params, model, ...AI_EXTRA });
      } catch (error: any) {
        lastError = error;
        const status = error?.status ?? error?.response?.status;
        console.log(`[ai] ${model} a repondu ${status || error.message}`);
        if (status === 404) continue; // slug supprime chez le fournisseur
        if (!RETRYABLE.has(status)) throw error;
      }
    }
    if (round === 0) await sleep(3000);
  }

  throw new Error(
    `Tous les modeles ont echoue (${AI_MODELS.join(', ')}). Derniere erreur : ${lastError?.message}`
  );
}

export default openai;
