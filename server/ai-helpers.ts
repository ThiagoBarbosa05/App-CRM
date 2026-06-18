// Funções auxiliares para integração com IA
import OpenAI from 'openai';
import type { ConditionBranch } from '@shared/schema';

export interface WineAIProfile {
  corpo: string;
  docura: string;
  acidez: string;
  tanino: string | null;
  mundo: string;
  regiao: string;
  produtor: string;
  uvas: string[];
  estilo: string;
  harmonizacao: string[];
  descricao: string;
}

export interface ClientWineProfile {
  resumo: string;
  tipos_preferidos: string[];
  perfil_sensorial: {
    corpo: string;
    docura: string;
    tanino: string | null;
  };
  regioes_favoritas: string[];
  uvas_favoritas: string[];
  faixa_de_preco: { min: number; max: number };
  sugestao_abordagem: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

interface MessageTemplate {
  [key: string]: (name: string, context?: string) => string;
}

const messageTemplates: MessageTemplate = {
  prospeccao: (name: string, context?: string) => 
    `Olá ${name}! 🍷\n\nSou especialista em vinhos e gostaria de apresentar nossa seleção exclusiva de rótulos premium. ${context ? `Considerando seu interesse em ${context}, ` : ''}Temos opções que se adequam a diferentes paladares e ocasiões especiais.\n\nPodemos agendar uma conversa para conhecer suas preferências? Tenho certeza que encontraremos o vinho perfeito para você!\n\nUm brinde aos bons momentos! 🥂`,

  followup: (name: string, context?: string) => 
    `Oi ${name}! 😊\n\nEspero que esteja aproveitando o vinho que adquiriu conosco! Como foi a experiência?\n\n${context ? `Lembrei que você mencionou interesse em ${context}, ` : ''}Tenho algumas novidades que podem te interessar:\n\n🍷 Novos rótulos chegaram\n🎯 Ofertas especiais para clientes fiéis\n📚 Dicas de harmonização\n\nQue tal conversarmos sobre suas próximas escolhas?`,

  oferta: (name: string, context?: string) => 
    `${name}, oportunidade especial! 🌟\n\nTemos uma seleção limitada de vinhos premium com condições exclusivas:\n\n🍷 Descontos especiais\n📦 Frete grátis para compras acima de R$ 200\n🎁 Brinde surpresa\n\n${context ? `Considerando seu gosto por ${context}, ` : ''}Separei algumas opções que vão te surpreender!\n\nOferta válida por tempo limitado. Vamos conversar?`,

  aniversario: (name: string, context?: string) => 
    `Parabéns, ${name}! 🎉🍷\n\nUm brinde ao seu dia especial! Para celebrar esta data única, que tal um vinho excepcional?\n\nTenho sugestões perfeitas para tornar sua comemoração ainda mais especial:\n\n🥂 Espumantes premium\n🍾 Vinhos de safras especiais\n🎁 Embalagem gift exclusiva\n\nSeu aniversário merece um brinde à altura! Vamos escolher juntos?`
};

export async function generateAIResponse(message: string, context: string = 'wine_expert', aiConfig?: any): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const systemPrompt = getSystemPrompt(context, aiConfig);

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      temperature: aiConfig?.temperature || 0.7,
      max_tokens: aiConfig?.maxTokens || 500,
    });

    return completion.choices[0]?.message?.content || "Desculpe, não consegui processar sua pergunta.";
  } catch (error) {
    console.error('Error generating AI response:', error);
    throw error;
  }
}

export async function generateAIMessage(prompt: string, aiConfig?: any): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const systemPrompt = getSystemPrompt('wine_business', aiConfig);

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Gere uma mensagem personalizada baseada nos seguintes dados:\n${prompt}` }
      ],
      temperature: aiConfig?.temperature || 0.7,
      max_tokens: aiConfig?.maxTokens || 500,
    });

    return completion.choices[0]?.message?.content || generateFallbackMessage(prompt);
  } catch (error) {
    console.error('Error generating AI message:', error);
    return generateFallbackMessage(prompt);
  }
}

function generateFallbackMessage(prompt: string): string {
  const nameMatch = prompt.match(/Cliente:\s*([^\n]+)/);
  const typeMatch = prompt.match(/Tipo:\s*([^\n]+)/);
  const contextMatch = prompt.match(/Contexto adicional:\s*([^\n]+)/);

  const name = nameMatch ? nameMatch[1].trim() : 'Cliente';
  const messageType = typeMatch ? typeMatch[1].trim() : 'prospeccao';
  const context = contextMatch ? contextMatch[1].trim() : '';

  return messageTemplates[messageType as keyof typeof messageTemplates](name, context);
}

function getSystemPrompt(context: string, aiConfig?: any): string {
  let basePrompt = `Você é um especialista em vinhos brasileiro com vasta experiência no mercado nacional e internacional.`;

  // Personalidade
  if (aiConfig?.personality) {
    const personalityMap = {
      profissional: "Mantenha sempre um tom profissional e técnico.",
      amigavel: "Seja caloroso, amigável e próximo ao cliente.",
      formal: "Use linguagem formal e respeitosa.",
      casual: "Use linguagem descontraída e informal."
    };
    basePrompt += ` ${personalityMap[aiConfig.personality as keyof typeof personalityMap] || ''}`;
  }

  // Nível de expertise
  if (aiConfig?.wineExpertise) {
    const expertiseMap = {
      iniciante: "Use linguagem simples e evite termos muito técnicos.",
      intermediario: "Use linguagem acessível mas inclua alguns termos técnicos.",
      especialista: "Use linguagem técnica detalhada e termos específicos do mundo do vinho."
    };
    basePrompt += ` ${expertiseMap[aiConfig.wineExpertise as keyof typeof expertiseMap] || ''}`;
  }

  // Estilo de resposta
  if (aiConfig?.responseStyle) {
    const styleMap = {
      consultivo: "Foque em orientar e aconselhar o cliente com base em suas necessidades.",
      vendas: "Sempre inclua sugestões de produtos e incentive a compra de forma sutil.",
      educativo: "Priorize ensinar e educar sobre vinhos, compartilhando conhecimento técnico."
    };
    basePrompt += ` ${styleMap[aiConfig.responseStyle as keyof typeof styleMap] || ''}`;
  }

  // Tamanho da mensagem
  if (aiConfig?.messageLength) {
    const lengthMap = {
      curto: "Mantenha respostas concisas e diretas (50-100 palavras).",
      medio: "Use respostas de tamanho médio (100-200 palavras).",
      longo: "Forneça respostas detalhadas e completas (200+ palavras)."
    };
    basePrompt += ` ${lengthMap[aiConfig.messageLength as keyof typeof lengthMap] || ''}`;
  }

  // Emojis
  if (aiConfig?.useEmojis) {
    basePrompt += " Use emojis para tornar as mensagens mais expressivas e amigáveis.";
  } else {
    basePrompt += " Evite usar emojis, mantenha um estilo mais formal.";
  }

  // Prompt personalizado
  if (aiConfig?.customPrompt) {
    basePrompt += ` Instruções adicionais: ${aiConfig.customPrompt}`;
  }

  if (context === 'wine_expert') {
    basePrompt += ` Você deve responder perguntas sobre vinhos, harmonizações, temperaturas de serviço, regiões produtoras, métodos de produção e tudo relacionado ao mundo do vinho. Seja sempre preciso e útil.`;
  } else if (context === 'wine_business') {
    basePrompt += ` Você está criando mensagens comerciais para um negócio de vinhos. Foque em gerar conteúdo persuasivo mas não invasivo, que demonstre conhecimento e crie conexão com o cliente.`;
  }

  return basePrompt;
}

export async function generateWineProductProfile(
  product: {
    name: string;
    type?: string | null;
    country?: string | null;
    volume?: string | null;
    category?: string;
  },
  customInstructions?: string | null,
): Promise<WineAIProfile> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI API key not configured');

  const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const extraInstructions = customInstructions?.trim()
    ? `\n\nOrientações adicionais: ${customInstructions.trim()}`
    : '';

  const prompt = `Você é um sommelier especialista. Analise o vinho abaixo e retorne um JSON com o perfil completo.${extraInstructions}

Vinho: "${product.name}"
Tipo: ${product.type ?? 'não informado'}
País: ${product.country ?? 'não informado'}
Volume: ${product.volume ?? 'não informado'}
Categoria: ${product.category ?? 'não informado'}

Retorne APENAS um JSON válido com exatamente estas chaves:
{
  "corpo": "leve" | "médio" | "encorpado",
  "docura": "seco" | "meio-seco" | "meio-doce" | "doce",
  "acidez": "baixa" | "média" | "alta",
  "tanino": "baixo" | "médio" | "alto" | null (null se não for tinto),
  "mundo": "Velho Mundo" | "Novo Mundo",
  "regiao": "nome da região produtora específica",
  "produtor": "nome da vinícola/produtor se puder inferir do nome, senão string vazia",
  "uvas": ["array com as uvas principais"],
  "estilo": "clássico" | "moderno" | "natural" | "orgânico" | "biodinâmico",
  "harmonizacao": ["array com 3-4 sugestões de harmonização em português"],
  "descricao": "2-3 frases em português descrevendo o vinho, seu perfil e características marcantes"
}`;

  const completion = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 600,
  });

  const content = completion.choices[0]?.message?.content ?? '{}';
  return JSON.parse(content) as WineAIProfile;
}

export async function generateClientWineProfile(
  clientName: string,
  topProducts: Array<{
    name: string;
    type?: string | null;
    country?: string | null;
    quantity: number;
    totalValue: number;
    aiProfile?: WineAIProfile | null;
  }>,
): Promise<ClientWineProfile> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI API key not configured');

  const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const productsDesc = topProducts
    .map((p, i) => {
      const profile = p.aiProfile
        ? ` | corpo: ${p.aiProfile.corpo}, uvas: ${p.aiProfile.uvas.join(', ')}, região: ${p.aiProfile.regiao}`
        : '';
      return `${i + 1}. ${p.name} (${p.type ?? ''}, ${p.country ?? ''}) — ${p.quantity} compras, R$${p.totalValue.toFixed(2)}${profile}`;
    })
    .join('\n');

  const prompt = `Você é um sommelier especialista em CRM de vinhos. Analise o histórico de compras do cliente abaixo e gere um perfil de gosto detalhado em JSON.

Cliente: ${clientName}
Histórico de compras (top produtos):
${productsDesc}

Retorne APENAS um JSON válido com exatamente estas chaves:
{
  "resumo": "2-3 frases em português descrevendo o perfil de gosto do cliente de forma natural e comercialmente útil para um vendedor",
  "tipos_preferidos": ["array dos tipos preferidos em ordem, ex: TINTO, ESPUMANTE"],
  "perfil_sensorial": {
    "corpo": "leve" | "médio" | "encorpado",
    "docura": "seco" | "meio-seco" | "meio-doce" | "doce",
    "tanino": "baixo" | "médio" | "alto" | null
  },
  "regioes_favoritas": ["regiões mais compradas, máx 3"],
  "uvas_favoritas": ["uvas mais frequentes, máx 4"],
  "faixa_de_preco": { "min": numero, "max": numero },
  "sugestao_abordagem": "1-2 frases práticas para o vendedor usar na próxima abordagem com este cliente"
}`;

  const completion = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: 700,
  });

  const content = completion.choices[0]?.message?.content ?? '{}';
  return JSON.parse(content) as ClientWineProfile;
}

/**
 * Classifica uma mensagem de cliente contra os ramos de um nó Condição.
 * Retorna o `handle` do ramo correspondente, ou null se nenhum for adequado.
 */
export async function classifyMessageIntent(
  messageText: string,
  branches: ConditionBranch[],
): Promise<string | null> {
  const branchList = branches
    .map((b, i) => `${i + 1}. handle="${b.handle}" label="${b.label}" keywords=[${b.keywords.join(', ')}]`)
    .join('\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'Você é um classificador de intenção para um chatbot de WhatsApp. ' +
          'Dada uma mensagem do cliente e uma lista de ramos de condição, ' +
          'retorne APENAS o valor do handle do ramo mais adequado, ou "none" se nenhum se aplicar. ' +
          'Responda somente com o handle, sem explicações.',
      },
      {
        role: 'user',
        content: `Mensagem do cliente: "${messageText}"\n\nRamos disponíveis:\n${branchList}\n\nQual é o handle mais adequado?`,
      },
    ],
    temperature: 0,
    max_tokens: 50,
  });

  const answer = completion.choices[0]?.message?.content?.trim() ?? 'none';
  if (answer === 'none' || !branches.find((b) => b.handle === answer)) return null;
  return answer;
}

/**
 * Verifica se uma mensagem de cliente corresponde à intenção descrita no prompt do trigger.
 * Retorna true se a mensagem deve ativar o bot.
 */
export async function classifyBotTriggerIntent(
  messageText: string,
  triggerPrompt: string,
): Promise<boolean> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'Você é um classificador binário de intenção para um chatbot de WhatsApp. ' +
          'Responda apenas com "sim" ou "nao" (sem acento), sem qualquer outra palavra.',
      },
      {
        role: 'user',
        content: `Mensagem do cliente: "${messageText}"\n\nCritério de ativação: ${triggerPrompt}\n\nA mensagem corresponde ao critério?`,
      },
    ],
    temperature: 0,
    max_tokens: 5,
  });

  const answer = completion.choices[0]?.message?.content?.trim().toLowerCase() ?? 'nao';
  return answer === 'sim';
}