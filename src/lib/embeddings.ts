import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const ai = getClient();
  if (!ai) return null;
  try {
    const res = await ai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
      dimensions: 1536,
    });
    return res.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}
