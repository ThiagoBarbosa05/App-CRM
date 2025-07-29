
// Funções auxiliares para integração com IA
import OpenAI from 'openai';

interface AIResponse {
  content: string;
  tokens?: number;
}

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

export async function generateAIResponse(message: string, context: string, aiConfig?: any): Promise<string> {
  // Try to use OpenAI API if available
  if (openai) {
    try {
      const systemPrompt = getSystemPrompt(context, aiConfig);
      
      const completion = await openai.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        model: "gpt-3.5-turbo",
        max_tokens: aiConfig?.maxTokens || 500,
        temperature: aiConfig?.temperature || 0.7,
      });

      return completion.choices[0].message.content || "Desculpe, não consegui processar sua pergunta.";
    } catch (error) {
      console.error("Erro da API OpenAI:", error);
      // Fall back to local responses
    }
  }

  // Simulação melhorada baseada no contexto
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('harmoniza') || lowerMessage.includes('combina')) {
    return `Para harmonizar vinhos, considere essas dicas importantes:

🍷 **Vinhos Tintos**: 
- Carnes vermelhas (boi, cordeiro)
- Queijos maturados
- Pratos com molhos encorpados

🍾 **Vinhos Brancos**:
- Peixes e frutos do mar
- Aves (frango, peru)
- Queijos frescos e saladas

🥂 **Espumantes**:
- Aperitivos e canapés
- Comida japonesa
- Sobremesas à base de frutas

A regra básica é equilibrar a intensidade do prato com a do vinho. Quer dicas mais específicas sobre algum tipo de harmonização?`;
  }

  if (lowerMessage.includes('temperatura')) {
    return `🌡️ **Temperaturas Ideais para Servir Vinhos:**

**Vinhos Tintos:**
- Tintos jovens e frutados: 14-16°C
- Tintos médios: 16-18°C  
- Tintos encorpados e taninos: 18-20°C

**Vinhos Brancos:**
- Brancos leves e frescos: 8-10°C
- Brancos aromáticos: 10-12°C
- Brancos encorpados: 12-14°C

**Espumantes:**
- Todos os tipos: 6-8°C

**Dica importante:** Retire da geladeira 10-15 minutos antes de servir brancos, e coloque tintos na geladeira por 30 minutos se estiver muito quente!`;
  }

  if (lowerMessage.includes('guarda') || lowerMessage.includes('armazen')) {
    return `🏠 **Como Guardar Vinhos Adequadamente:**

**Condições Ideais:**
- Temperatura: 12-14°C (constante)
- Umidade: 60-70%
- Sem luz direta
- Sem vibrações
- Ventilação adequada

**Posição:**
- Garrafas com rolha: deitadas
- Garrafas com tampa de rosca: em pé ou deitadas

**Locais apropriados:**
- Adega climatizada (ideal)
- Porão ou local fresco
- Armário longe de janelas
- Evitar: cozinha, lavanderia, sótão

**Tempo de guarda:**
- Vinhos do dia a dia: 1-3 anos
- Vinhos de guarda: 5-20+ anos

Precisa de dicas para um vinho específico?`;
  }

  // Resposta genérica mais inteligente
  return `Olá! Sou especialista em vinhos e estou aqui para ajudar! 🍷

Posso te auxiliar com:
- 🥂 Harmonizações (que vinho combina com cada prato)
- 🌡️ Temperaturas de serviço
- 🏠 Armazenamento e guarda
- 🗺️ Regiões vinícolas
- 🍇 Tipos de uva e estilos
- 💰 Sugestões por faixa de preço

Sobre o que gostaria de saber mais? Fique à vontade para perguntar!`;
}

export async function generateAIMessage(prompt: string, aiConfig?: any): Promise<string> {
  // Try to use OpenAI API if available
  if (openai && aiConfig) {
    try {
      const systemPrompt = getMessageGenerationPrompt(aiConfig);
      
      const completion = await openai.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        model: "gpt-3.5-turbo",
        max_tokens: aiConfig.maxTokens || 500,
        temperature: aiConfig.temperature || 0.7,
      });

      return completion.choices[0].message.content || "Não foi possível gerar a mensagem.";
    } catch (error) {
      console.error("Erro da API OpenAI:", error);
      // Fall back to local templates
    }
  }

  // Fallback para templates estáticos melhorados baseados na configuração
  
  const templates = {
    prospeccao: (name: string) => `Olá ${name}! 🍷

Espero que esteja bem! Sou [Seu Nome], especialista em vinhos, e trabalho ajudando pessoas a descobrirem rótulos excepcionais que marcam momentos especiais.

Percebi que você tem interesse em vinhos de qualidade, e gostaria de apresentar nossa curadoria exclusiva. Temos desde vinhos para o dia a dia até rótulos premium para ocasiões especiais.

O que acha de agendarmos uma conversa rápida para conhecer seu perfil e preferências? Tenho certeza que posso sugerir opções que vão surpreender você!

Um brinde aos bons momentos! 🥂
[Seu Nome]`,

    followup: (name: string, context?: string) => `Oi ${name}! 😊

Como você está? Espero que tenha aproveitado nossa última conversa sobre vinhos!

${context ? `Lembro que você demonstrou interesse em ${context}, e ` : ''}Tenho algumas novidades que podem te interessar:

✨ Chegaram rótulos únicos de pequenos produtores
🎯 Condições especiais para clientes especiais
📚 Curso online gratuito sobre degustação

Que tal marcarmos um bate-papo? Adoraria saber como está sua jornada no mundo dos vinhos!

Abraço,
[Seu Nome]`,

    oferta: (name: string, context?: string) => `${name}, oportunidade imperdível! 🌟

Temos uma seleção limitada de vinhos premium com condições exclusivas apenas para você:

🍷 Descontos especiais de até 30%
📦 Frete grátis para todo o Brasil
🎁 Kit degustação de cortesia
⭐ Garantia de satisfação 100%

${context ? `Sabendo do seu interesse por ${context}, ` : ''}Separei pessoalmente algumas opções que sei que vão te encantar!

Esta oferta é por tempo limitado. Vamos conversar ainda hoje?

Saúde! 🥂
[Seu Nome]`,

    aniversario: (name: string) => `🎉 Parabéns, ${name}! 🎉

Que alegria saber que é seu aniversário! Um brinde à sua vida e aos momentos especiais que estão por vir! 🍷

Para celebrar essa data única, que tal brindar com algo excepcional? Tenho sugestões perfeitas:

🥂 Espumantes de safras especiais
🍾 Vinhos de regiões nobres
🎁 Embalagem gift exclusiva
✨ Desconto especial de aniversário

Seu dia merece um brinde à altura! Vamos escolher juntos o vinho perfeito para sua comemoração?

Feliz aniversário e vida longa! 🎂🍷
[Seu Nome]`
  };

  // Análise simples do prompt para determinar o tipo
  const promptLower = prompt.toLowerCase();
  let messageType = 'prospeccao';
  
  if (promptLower.includes('follow') || promptLower.includes('acompanhamento')) {
    messageType = 'followup';
  } else if (promptLower.includes('oferta') || promptLower.includes('promoção')) {
    messageType = 'oferta';
  } else if (promptLower.includes('aniversário') || promptLower.includes('parabéns')) {
    messageType = 'aniversario';
  }

  // Extração simples do nome (melhorar com regex mais robusta)
  const nameMatch = prompt.match(/Cliente:\s*([^\\n]+)/);
  const name = nameMatch ? nameMatch[1].trim() : 'Cliente';

  const contextMatch = prompt.match(/Contexto adicional:\s*([^\\n]+)/);
  const context = contextMatch ? contextMatch[1].trim() : '';

  return templates[messageType as keyof typeof templates](name, context);
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
      vendas: "Sempre inclua sugestões de produtos e oportunidades de venda.",
      educativo: "Priorize ensinar e educar sobre vinhos de forma didática."
    };
    basePrompt += ` ${styleMap[aiConfig.responseStyle as keyof typeof styleMap] || ''}`;
  }

  // Emojis
  if (aiConfig?.useEmojis === false) {
    basePrompt += " Não use emojis nas respostas.";
  } else {
    basePrompt += " Use emojis moderadamente para tornar as respostas mais expressivas.";
  }

  // Tamanho da mensagem
  if (aiConfig?.messageLength) {
    const lengthMap = {
      curto: "Mantenha suas respostas concisas e diretas (50-100 palavras).",
      medio: "Forneça respostas equilibradas (100-200 palavras).",
      longo: "Dê respostas detalhadas e completas (200+ palavras)."
    };
    basePrompt += ` ${lengthMap[aiConfig.messageLength as keyof typeof lengthMap] || ''}`;
  }

  // Prompt personalizado
  if (aiConfig?.customPrompt) {
    basePrompt += ` ${aiConfig.customPrompt}`;
  }

  basePrompt += " Responda sempre em português brasileiro de forma clara e útil.";

  return basePrompt;
}

function getMessageGenerationPrompt(aiConfig: any): string {
  let prompt = `Você é um especialista em marketing e vendas de vinhos. Gere mensagens personalizadas para clientes.`;

  // Aplicar configurações similares
  if (aiConfig.personality === 'profissional') {
    prompt += " Use tom profissional e respeitoso.";
  } else if (aiConfig.personality === 'amigavel') {
    prompt += " Use tom amigável e caloroso.";
  }

  if (aiConfig.messageLength === 'curto') {
    prompt += " Mantenha as mensagens concisas e diretas.";
  } else if (aiConfig.messageLength === 'longo') {
    prompt += " Crie mensagens detalhadas e elaboradas.";
  }

  if (aiConfig.useEmojis) {
    prompt += " Inclua emojis apropriados.";
  } else {
    prompt += " Não use emojis.";
  }

  if (aiConfig.customPrompt) {
    prompt += ` ${aiConfig.customPrompt}`;
  }

  return prompt;
}
