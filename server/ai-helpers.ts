// Funções auxiliares para integração com IA
import OpenAI from 'openai';

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