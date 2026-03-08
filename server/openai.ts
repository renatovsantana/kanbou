/**
 * @module server/openai
 * Integração com a API da OpenAI para sugestão inteligente de tags e termos de mercado.
 * Utiliza GPT para gerar hashtags relevantes e termos de posicionamento de mercado
 * com base nas informações do cliente.
 */

import OpenAI from "openai";

/**
 * Instância do cliente OpenAI configurada com a chave de API.
 * Prioriza AI_INTEGRATIONS_OPENAI_API_KEY e fallback para OPENAI_API_KEY.
 */
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

const openai = apiKey ? new OpenAI({ apiKey }) : null;

/**
 * Sugere hashtags/tags relevantes para redes sociais com base nas informações do cliente.
 * Usa a OpenAI para gerar até 10 tags em português do Brasil, sem repetir tags existentes.
 * @param clientName - Nome do cliente
 * @param clientAbout - Descrição/sobre do cliente (pode conter HTML, que será removido)
 * @param clientNotes - Notas adicionais sobre o cliente
 * @param existingTags - Lista de tags já existentes para evitar duplicatas
 * @returns Lista de novas tags sugeridas em minúsculas, sem o símbolo #
 */
export async function suggestTags(clientName: string, clientAbout: string, clientNotes: string, existingTags: string[]): Promise<string[]> {
  if (!openai) return [];

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
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 200,
    temperature: 0.7,
  });

  const text = response.choices[0]?.message?.content?.trim() || "";
  return text.split(",").map(t => t.trim().toLowerCase()).filter(t => t && !existingTags.includes(t));
}

/**
 * Sugere termos de posicionamento de mercado com base nas informações do cliente.
 * Usa a OpenAI para gerar até 8 termos em português do Brasil representando
 * nichos, tendências e diferenciais competitivos.
 * @param clientName - Nome do cliente
 * @param clientAbout - Descrição/sobre do cliente (pode conter HTML, que será removido)
 * @param clientNotes - Notas adicionais sobre o cliente
 * @param existingTags - Lista de termos já existentes para evitar duplicatas
 * @returns Lista de novos termos de mercado sugeridos em minúsculas
 */
export async function suggestMarketTags(clientName: string, clientAbout: string, clientNotes: string, existingTags: string[]): Promise<string[]> {
  if (!openai) return [];

  const prompt = `Você é um especialista em posicionamento de mercado e branding no Brasil.
Com base nas informações do cliente abaixo, sugira 8 termos de posicionamento de mercado relevantes.
Os termos devem ser em português do Brasil, em minúsculas, representando nichos, tendências e diferenciais competitivos.
${existingTags.length > 0 ? `Termos já existentes (não repita): ${existingTags.join(", ")}` : ""}

Cliente: ${clientName}
${clientAbout ? `Sobre: ${clientAbout.replace(/<[^>]*>/g, '')}` : ""}
${clientNotes ? `Notas: ${clientNotes}` : ""}

Responda APENAS com os termos separados por vírgula, sem numeração ou explicação.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 200,
    temperature: 0.7,
  });

  const text = response.choices[0]?.message?.content?.trim() || "";
  return text.split(",").map(t => t.trim().toLowerCase()).filter(t => t && !existingTags.includes(t));
}
