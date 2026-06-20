import { GoogleGenerativeAI } from "@google/generative-ai";

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI | null {
  if (!process.env.GOOGLE_AI_API_KEY) return null;
  if (!client) client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  return client;
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const ai = getClient();
  if (!ai) return null;
  try {
    const model = ai.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text.slice(0, 8000));
    return result.embedding.values ?? null;
  } catch {
    return null;
  }
}
