// Gemini Embedding 2 (Google AI) — free tier, 768 dims for pgvector compat
// Uses 768 dimensions to match the actual DB schema (VECTOR(768)) after migration 00003_vector_768.sql
// outputDimensionality=768 keeps index compatibility and reduces storage/query cost

const EMBEDDING_MODEL = "gemini-embedding-2";
const OUTPUT_DIMS = 768;

function getApiKey(): string {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new Error("GOOGLE_AI_API_KEY is not configured");
  return key;
}

async function embedOne(text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${getApiKey()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: OUTPUT_DIMS,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini embedding error ${res.status}: ${(err as { error?: { message?: string } }).error?.message ?? res.statusText}`);
  }
  const data = await res.json() as { embedding: { values: number[] } };
  return data.embedding.values;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  return embedOne(text);
}

export async function generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(embedOne));
}
