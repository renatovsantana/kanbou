import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
});

export async function suggestTags(clientName: string, clientAbout: string, clientNotes: string, existingTags: string[]): Promise<string[]> {
  const prompt = `Você é um especialista em marketing digital e redes sociais no Brasil.
Com base nas informações do cliente abaixo, sugira 10 hashtags/tags relevantes para uso em redes sociais.
As tags devem ser em português do Brasil, sem o símbolo #, em minúsculas.
Foque em termos populares e relevantes para o segmento do cliente.
${existingTags.length > 0 ? `Tags já existentes (não repita): ${existingTags.join(", ")}` : ""}

Cliente: ${clientName}
${clientAbout ? `Sobre: ${clientAbout.replace(/<[^>]*>/g, '')}` : ""}
${clientNotes ? `Notas: ${clientNotes}` : ""}

Responda APENAS com as tags separadas por vírgula, sem numeração ou explicação.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5-nano",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 200,
    temperature: 0.7,
  });

  const text = response.choices[0]?.message?.content?.trim() || "";
  return text.split(",").map(t => t.trim().toLowerCase()).filter(t => t && !existingTags.includes(t));
}

export async function suggestMarketTags(clientName: string, clientAbout: string, clientNotes: string, existingTags: string[]): Promise<string[]> {
  const prompt = `Você é um especialista em posicionamento de mercado e branding no Brasil.
Com base nas informações do cliente abaixo, sugira 8 termos de posicionamento de mercado relevantes.
Os termos devem ser em português do Brasil, em minúsculas, representando nichos, tendências e diferenciais competitivos.
${existingTags.length > 0 ? `Termos já existentes (não repita): ${existingTags.join(", ")}` : ""}

Cliente: ${clientName}
${clientAbout ? `Sobre: ${clientAbout.replace(/<[^>]*>/g, '')}` : ""}
${clientNotes ? `Notas: ${clientNotes}` : ""}

Responda APENAS com os termos separados por vírgula, sem numeração ou explicação.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5-nano",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 200,
    temperature: 0.7,
  });

  const text = response.choices[0]?.message?.content?.trim() || "";
  return text.split(",").map(t => t.trim().toLowerCase()).filter(t => t && !existingTags.includes(t));
}
