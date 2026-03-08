import OpenAI from "openai";
import type { IStorage } from "./storage";

const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

function stripHtml(s: string): string {
  return s ? s.replace(/<[^>]*>/g, "").trim() : "";
}

interface ClientContext {
  name: string;
  about: string;
  notes: string;
  tags: string[];
  marketTags: string[];
  products: { name: string; description: string | null }[];
  services: { name: string; description: string | null }[];
  competitors: { name: string; instagram?: string | null; facebook?: string | null; tiktok?: string | null; linkedin?: string | null; youtube?: string | null; notes?: string | null }[];
  cards: { id: number; title: string; cardType: string | null; columnTitle: string; templateData: string | null; createdAt: any; description: string | null }[];
  columnCounts: Record<string, number>;
  recentInsights: { message: string; createdAt: any }[];
  activities: { action: string; cardTitle: string; fromColumn?: string; toColumn?: string; userName?: string; createdAt: any }[];
  timeEntries: { cardId: number; cardTitle: string; columnTitle: string; totalSeconds: number | null; startedAt: any; endedAt: any | null }[];
}

async function buildClientContext(clientId: number, storage: IStorage): Promise<ClientContext | null> {
  const client = await storage.getClient(clientId);
  if (!client) return null;

  const [products, services, competitors, columns, cards, insights] = await Promise.all([
    storage.getClientProducts(clientId),
    storage.getClientServices(clientId),
    storage.getCompetitorsByClient(clientId),
    storage.getKanbanColumnsByClient(clientId),
    storage.getKanbanCardsByClient(clientId),
    storage.getClientInsights(clientId),
  ]);

  const columnMap = new Map(columns.map(c => [c.id, c.title]));

  const columnCounts: Record<string, number> = {};
  for (const card of cards) {
    const colTitle = columnMap.get(card.columnId) || "Desconhecida";
    columnCounts[colTitle] = (columnCounts[colTitle] || 0) + 1;
  }

  const cardIds = cards.map(c => c.id);
  const timeEntries = cardIds.length > 0 ? await storage.getKanbanTimeEntriesByCardIds(cardIds) : [];
  const cardMap = new Map(cards.map(c => [c.id, c]));

  const allActivities: ClientContext["activities"] = [];
  const users = await storage.getUsers();
  const userMap = new Map(users.map(u => [u.id, u.name]));

  for (const card of cards.slice(0, 50)) {
    const acts = await storage.getKanbanActivity(card.id);
    for (const a of acts.slice(0, 10)) {
      allActivities.push({
        action: a.action,
        cardTitle: card.title,
        fromColumn: a.fromColumnId ? columnMap.get(a.fromColumnId) || "" : undefined,
        toColumn: a.toColumnId ? columnMap.get(a.toColumnId) || "" : undefined,
        userName: a.userId ? userMap.get(a.userId) || "" : undefined,
        createdAt: a.createdAt,
      });
    }
  }

  return {
    name: client.name,
    about: stripHtml(client.about || ""),
    notes: stripHtml(client.notes || ""),
    tags: (client.tags as string[]) || [],
    marketTags: (client.marketTags as string[]) || [],
    products: products.map(p => ({ name: p.name, description: p.description })),
    services: services.map(s => ({ name: s.name, description: s.description })),
    competitors: competitors.map(c => ({
      name: c.name,
      instagram: c.instagram,
      facebook: c.facebook,
      tiktok: c.tiktok,
      linkedin: c.linkedin,
      youtube: c.youtube,
      notes: c.notes,
    })),
    cards: cards.map(c => ({
      id: c.id,
      title: c.title,
      cardType: c.cardType,
      columnTitle: columnMap.get(c.columnId) || "Desconhecida",
      templateData: c.templateData as string | null,
      createdAt: c.createdAt,
      description: c.description,
    })),
    columnCounts,
    recentInsights: insights.slice(0, 5).map(i => ({ message: stripHtml(i.message), createdAt: i.createdAt })),
    activities: allActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 100),
    timeEntries: timeEntries.map(te => ({
      cardId: te.cardId,
      cardTitle: cardMap.get(te.cardId)?.title || "",
      columnTitle: te.columnId ? columnMap.get(te.columnId) || "" : "",
      totalSeconds: te.totalSeconds,
      startedAt: te.startedAt,
      endedAt: te.endedAt,
    })),
  };
}

function contextToPromptBlock(ctx: ClientContext): string {
  let block = `CLIENTE: ${ctx.name}\n`;
  if (ctx.about) block += `SOBRE: ${ctx.about.substring(0, 800)}\n`;
  if (ctx.notes) block += `NOTAS INTERNAS: ${ctx.notes.substring(0, 500)}\n`;
  if (ctx.tags.length) block += `HASHTAGS: ${ctx.tags.join(", ")}\n`;
  if (ctx.marketTags.length) block += `POSICIONAMENTO: ${ctx.marketTags.join(", ")}\n`;
  if (ctx.products.length) block += `PRODUTOS: ${ctx.products.map(p => p.name + (p.description ? ` (${p.description})` : "")).join("; ")}\n`;
  if (ctx.services.length) block += `SERVIÇOS: ${ctx.services.map(s => s.name + (s.description ? ` (${s.description})` : "")).join("; ")}\n`;
  if (ctx.competitors.length) {
    block += `CONCORRENTES:\n`;
    for (const c of ctx.competitors) {
      block += `  - ${c.name}`;
      const socials = [c.instagram && `IG:${c.instagram}`, c.facebook && `FB:${c.facebook}`, c.tiktok && `TT:${c.tiktok}`, c.linkedin && `LI:${c.linkedin}`].filter(Boolean).join(", ");
      if (socials) block += ` (${socials})`;
      if (c.notes) block += ` | Notas: ${c.notes}`;
      block += "\n";
    }
  }
  block += `\nDISTRIBUIÇÃO DE CARDS POR COLUNA:\n`;
  for (const [col, count] of Object.entries(ctx.columnCounts)) {
    block += `  ${col}: ${count} cards\n`;
  }
  return block;
}

function cardsDetailBlock(ctx: ClientContext): string {
  let block = "\nMATERIAIS (CARDS):\n";
  const now = new Date();
  for (const card of ctx.cards.slice(0, 40)) {
    let line = `  - [${card.columnTitle}] "${card.title}" (tipo: ${card.cardType || "geral"})`;
    if (card.templateData) {
      try {
        const td = JSON.parse(card.templateData);
        if (td.publishDate) {
          const pubDate = new Date(td.publishDate);
          line += ` | data: ${td.publishDate}`;
          if (pubDate < now && !["Postados", "Finalizados"].includes(card.columnTitle)) {
            line += " ⚠️ ATRASADO";
          }
        }
        if (td.platform) line += ` | plataforma: ${td.platform}`;
      } catch {}
    }
    block += line + "\n";
  }
  return block;
}

async function callAI(systemPrompt: string, userPrompt: string, maxTokens = 2000): Promise<string> {
  if (!openai) return "⚠️ Chave da OpenAI não configurada. Configure a variável OPENAI_API_KEY no servidor.";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    });
    return response.choices[0]?.message?.content?.trim() || "Sem resposta da IA.";
  } catch (err: any) {
    console.error("AI Agent error:", err);
    return `⚠️ Erro ao consultar IA: ${err.message || "erro desconhecido"}`;
  }
}

export async function clientOverview(clientId: number, storage: IStorage): Promise<string> {
  const ctx = await buildClientContext(clientId, storage);
  if (!ctx) return "Cliente não encontrado.";

  const system = `Você é um analista estratégico de agência de marketing digital no Brasil. Fale em português do Brasil.
Analise os dados do cliente e produza um OVERVIEW COMPLETO E ACIONÁVEL com as seguintes seções:

1. **📋 Resumo Geral** — Situação atual do cliente em 2-3 frases
2. **🚨 Cards Atrasados** — Liste materiais com data de publicação no passado que ainda não foram postados/finalizados. Explique o risco.
3. **⏸️ Cards Parados** — Identifique materiais que parecem estagnados (mesma coluna por muito tempo ou colunas iniciais com muitos cards). Alerte sobre os potencialmente críticos.
4. **🌟 Materiais com Potencial** — Analise os conteúdos em produção que podem performar bem com base no tipo, plataforma e nicho do cliente.
5. **🎨 Linha Criativa** — Avalie a direção criativa atual: coerência com a identidade, variedade de formatos, equilíbrio entre plataformas.
6. **🔄 Gargalos no Fluxo** — Onde os cards estão acumulando? Quais colunas têm desproporcionalidade?
7. **✅ Sugestões de Ação** — Liste 3-5 ações prioritárias imediatas.

Seja direto, use dados concretos dos cards e números. Não invente dados que não existem no contexto.`;

  const user = contextToPromptBlock(ctx) + cardsDetailBlock(ctx);
  return callAI(system, user, 2500);
}

export async function analyzeCompetitors(clientId: number, storage: IStorage): Promise<string> {
  const ctx = await buildClientContext(clientId, storage);
  if (!ctx) return "Cliente não encontrado.";
  if (ctx.competitors.length === 0) return "Nenhum concorrente cadastrado para este cliente. Cadastre concorrentes na página de onboarding.";

  const system = `Você é um especialista em análise competitiva e marketing digital no Brasil. Fale em português do Brasil.
Analise os concorrentes do cliente e produza um relatório com:

1. **🔍 Panorama Competitivo** — Visão geral do posicionamento do cliente vs. concorrentes
2. **📊 Análise por Concorrente** — Para cada concorrente, avalie presença digital (quais redes usa), pontos fortes/fracos baseados nas notas disponíveis
3. **📈 Tendências do Nicho** — Com base no segmento do cliente e seus concorrentes, identifique tendências de conteúdo que estão em alta
4. **💡 Oportunidades de Conteúdo** — Sugira tipos de conteúdo, formatos e temas que o cliente pode explorar baseado no que os concorrentes fazem (ou não fazem)
5. **⚠️ Gaps e Riscos** — Onde o cliente está ficando para trás? O que os concorrentes fazem que ele não faz?
6. **🎯 Recomendações** — 3-5 ações estratégicas baseadas na análise

Use os dados reais dos concorrentes fornecidos. Quando não tiver dados suficientes, sugira o que pesquisar.`;

  const user = contextToPromptBlock(ctx);
  return callAI(system, user, 2500);
}

export async function suggestContent(clientId: number, storage: IStorage, params: { platform?: string; quantity?: number; focus?: string }): Promise<string> {
  const ctx = await buildClientContext(clientId, storage);
  if (!ctx) return "Cliente não encontrado.";

  const qty = params.quantity || 10;
  const platform = params.platform || "todas as plataformas";
  const focus = params.focus || "conteúdo variado";

  const system = `Você é um estrategista de conteúdo para redes sociais no Brasil. Fale em português do Brasil.
Gere ${qty} ideias de conteúdo para o cliente com base em seu nicho, produtos, serviços, concorrentes e posicionamento de mercado.

Para cada ideia, forneça:
- **Título/Tema** da postagem
- **Formato** (carrossel, reels, stories, post estático, vídeo longo, blog, etc.)
- **Plataforma** ideal (${platform})
- **Objetivo** (engajamento, conversão, brand awareness, educação, etc.)
- **Briefing rápido** (2-3 frases descrevendo o conteúdo)

Foque em: ${focus}

Considere tendências atuais do mercado digital brasileiro e o que pode performar bem para o segmento do cliente.
Numere as ideias. Seja criativo mas realista.`;

  const user = contextToPromptBlock(ctx);
  return callAI(system, user, 3000);
}

export async function generateInsight(clientId: number, storage: IStorage, focus?: string): Promise<string> {
  const ctx = await buildClientContext(clientId, storage);
  if (!ctx) return "Cliente não encontrado.";

  const focusText = focus || "estratégia geral de marketing digital";

  const system = `Você é um consultor sênior de marketing digital no Brasil. Fale em português do Brasil.
Gere UM insight estratégico profundo e acionável para o cliente.

O insight deve:
- Ser baseado nos dados reais do cliente (produtos, serviços, concorrentes, materiais em produção)
- Ter uma observação principal clara
- Incluir dados/números quando disponíveis
- Terminar com uma recomendação prática
- Ser escrito de forma profissional, como um conselho de consultor
- Ter entre 3-5 parágrafos

Foco da análise: ${focusText}

NÃO use formato de lista ou bullet points. Escreva em prosa corrida como um texto de consultoria.`;

  const user = contextToPromptBlock(ctx) + cardsDetailBlock(ctx);
  return callAI(system, user, 1500);
}

export async function weeklyReport(clientId: number, storage: IStorage): Promise<string> {
  const ctx = await buildClientContext(clientId, storage);
  if (!ctx) return "Cliente não encontrado.";

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const recentActivities = ctx.activities.filter(a => new Date(a.createdAt) >= oneWeekAgo);
  const recentCards = ctx.cards.filter(c => new Date(c.createdAt) >= oneWeekAgo);

  let activityBlock = `\nATIVIDADES DA ÚLTIMA SEMANA (${recentActivities.length} movimentações):\n`;
  for (const a of recentActivities.slice(0, 50)) {
    activityBlock += `  - ${a.action}: "${a.cardTitle}"`;
    if (a.fromColumn && a.toColumn) activityBlock += ` (${a.fromColumn} → ${a.toColumn})`;
    if (a.userName) activityBlock += ` por ${a.userName}`;
    activityBlock += ` em ${new Date(a.createdAt).toLocaleDateString("pt-BR")}\n`;
  }

  activityBlock += `\nCARDS CRIADOS NA SEMANA: ${recentCards.length}\n`;

  const system = `Você é um gerente de projetos de agência de marketing digital no Brasil. Fale em português do Brasil.
Gere um RELATÓRIO SEMANAL completo com:

1. **📊 Resumo da Semana** — O que aconteceu em números: cards criados, movimentados, aprovados, postados
2. **✅ Conquistas** — O que foi finalizado/postado/aprovado
3. **⏰ Atrasados** — Cards que passaram da data e não foram concluídos
4. **🔄 Em Andamento** — O que está em produção agora
5. **⚠️ Pontos de Atenção** — Gargalos, cards parados, riscos
6. **📋 Próximos Passos** — O que precisa de atenção na próxima semana

Seja objetivo e use números concretos. Este relatório será usado internamente pela equipe.`;

  const user = contextToPromptBlock(ctx) + cardsDetailBlock(ctx) + activityBlock;
  return callAI(system, user, 2000);
}

export async function activityReport(clientId: number, storage: IStorage, period: string = "7d"): Promise<string> {
  const ctx = await buildClientContext(clientId, storage);
  if (!ctx) return "Cliente não encontrado.";

  const days = period === "30d" ? 30 : period === "15d" ? 15 : 7;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const recentActivities = ctx.activities.filter(a => new Date(a.createdAt) >= since);

  let activityBlock = `\nACONTECIMENTOS DOS ÚLTIMOS ${days} DIAS (${recentActivities.length} eventos):\n`;
  for (const a of recentActivities) {
    const date = new Date(a.createdAt).toLocaleDateString("pt-BR");
    activityBlock += `  - [${date}] ${a.action}: "${a.cardTitle}"`;
    if (a.fromColumn && a.toColumn) activityBlock += ` (${a.fromColumn} → ${a.toColumn})`;
    if (a.userName) activityBlock += ` por ${a.userName}`;
    activityBlock += "\n";
  }

  if (ctx.recentInsights.length) {
    activityBlock += "\nINSIGHTS RECENTES:\n";
    for (const i of ctx.recentInsights) {
      activityBlock += `  - [${new Date(i.createdAt).toLocaleDateString("pt-BR")}] ${i.message.substring(0, 200)}\n`;
    }
  }

  const system = `Você é um redator de relatórios de agência de marketing digital no Brasil. Fale em português do Brasil.
Crie um RELATÓRIO DE ACONTECIMENTOS narrativo e profissional dos últimos ${days} dias.

O relatório deve:
- Ser escrito como uma timeline narrada, organizada por data (do mais recente ao mais antigo)
- Agrupar eventos do mesmo dia
- Destacar aprovações, reprovações, revisões, agendamentos e publicações
- Mencionar quem fez cada ação quando disponível
- Identificar padrões (ex: "houve um pico de aprovações na terça-feira")
- Ter um resumo executivo no início
- Ter uma conclusão com perspectivas

Este relatório deve estar pronto para compartilhar com o cliente ou usar em reunião interna.
Escreva de forma profissional e clara.`;

  const user = contextToPromptBlock(ctx) + cardsDetailBlock(ctx) + activityBlock;
  return callAI(system, user, 2500);
}

export async function analyzeProductivity(clientId: number | null, storage: IStorage): Promise<string> {
  let dataBlock = "";

  if (clientId) {
    const ctx = await buildClientContext(clientId, storage);
    if (!ctx) return "Cliente não encontrado.";
    dataBlock = contextToPromptBlock(ctx);

    dataBlock += "\nTEMPOS DE PRODUÇÃO:\n";
    const timeByColumn: Record<string, { total: number; count: number }> = {};
    for (const te of ctx.timeEntries) {
      if (te.totalSeconds && te.columnTitle) {
        if (!timeByColumn[te.columnTitle]) timeByColumn[te.columnTitle] = { total: 0, count: 0 };
        timeByColumn[te.columnTitle].total += te.totalSeconds;
        timeByColumn[te.columnTitle].count++;
      }
    }
    for (const [col, data] of Object.entries(timeByColumn)) {
      const avgHours = (data.total / data.count / 3600).toFixed(1);
      const totalHours = (data.total / 3600).toFixed(1);
      dataBlock += `  ${col}: ${data.count} cards, total ${totalHours}h, média ${avgHours}h por card\n`;
    }

    const openEntries = ctx.timeEntries.filter(te => !te.endedAt);
    if (openEntries.length) {
      dataBlock += `\nTIMERS ABERTOS (cards em produção agora): ${openEntries.length}\n`;
      for (const te of openEntries.slice(0, 10)) {
        const hours = ((Date.now() - new Date(te.startedAt).getTime()) / 3600000).toFixed(1);
        dataBlock += `  - "${te.cardTitle}" em ${te.columnTitle} há ${hours}h\n`;
      }
    }
  } else {
    dataBlock = "ANÁLISE GERAL DE TODOS OS CLIENTES\n";
    const clients = await storage.getClients();
    for (const client of clients.slice(0, 10)) {
      const cards = await storage.getKanbanCardsByClient(client.id);
      const columns = await storage.getKanbanColumnsByClient(client.id);
      const colMap = new Map(columns.map(c => [c.id, c.title]));
      const counts: Record<string, number> = {};
      for (const card of cards) {
        const col = colMap.get(card.columnId) || "?";
        counts[col] = (counts[col] || 0) + 1;
      }
      dataBlock += `\n${client.name}: ${cards.length} cards total\n`;
      for (const [col, count] of Object.entries(counts)) {
        dataBlock += `  ${col}: ${count}\n`;
      }
    }
  }

  const system = `Você é um analista de produtividade de agência de marketing digital no Brasil. Fale em português do Brasil.
Analise os dados de produção e gere um relatório de produtividade com:

1. **⏱️ Tempos por Etapa** — Quanto tempo em média os cards ficam em cada coluna
2. **🔴 Gargalos** — Etapas onde os cards estão demorando mais que o esperado
3. **📊 Carga de Trabalho** — Distribuição de cards ativos e indicadores de sobrecarga
4. **🚨 Alertas** — Cards parados há muito tempo, timers abertos prolongados
5. **💡 Recomendações** — Sugestões para melhorar o fluxo de produção

Use dados concretos e números. Sugira tempos ideais por etapa quando relevante.`;

  return callAI(system, dataBlock, 2000);
}

export async function analyzeErrors(storage: IStorage): Promise<string> {
  const errors = await storage.getErrorReports({ status: "aberto" });
  const inProgress = await storage.getErrorReports({ status: "em_andamento" });
  const allErrors = [...errors, ...inProgress];

  if (allErrors.length === 0) return "✅ Nenhum erro aberto ou em andamento no sistema. Tudo funcionando normalmente!";

  let dataBlock = `ERROS REPORTADOS (${allErrors.length} abertos/em andamento):\n`;
  for (const err of allErrors) {
    dataBlock += `  - [${err.severity?.toUpperCase()}] ${err.status}: "${err.description}"\n`;
    if (err.route) dataBlock += `    Rota: ${err.route}\n`;
    if (err.menu) dataBlock += `    Menu: ${err.menu}\n`;
    if (err.stack) dataBlock += `    Stack: ${err.stack.substring(0, 200)}\n`;
    dataBlock += `    Criado: ${err.createdAt ? new Date(err.createdAt).toLocaleDateString("pt-BR") : "?"}\n`;
  }

  const resolved = await storage.getErrorReports({ status: "resolvido" });
  if (resolved.length) {
    dataBlock += `\nERROS RESOLVIDOS RECENTEMENTE (${resolved.length}):\n`;
    for (const err of resolved.slice(0, 5)) {
      dataBlock += `  - "${err.description}" → Resolução: ${err.resolution || "sem detalhes"}\n`;
    }
  }

  const system = `Você é um analista de qualidade de software. Fale em português do Brasil.
Analise os erros reportados no sistema e produza um relatório com:

1. **📊 Resumo** — Quantidade e distribuição por severidade
2. **🔴 Críticos** — Erros de alta severidade que precisam de atenção imediata
3. **🔍 Padrões** — Identifique padrões (mesma rota, mesmo menu, erros similares)
4. **📋 Priorização** — Ordene os erros por prioridade de resolução com justificativa
5. **💡 Sugestões** — Possíveis causas e sugestões de investigação baseadas nos stack traces e descrições

Seja técnico mas acessível. O relatório será usado pela equipe de desenvolvimento.`;

  return callAI(system, dataBlock, 2000);
}
