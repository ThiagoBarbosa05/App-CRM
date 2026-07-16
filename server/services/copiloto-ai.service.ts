import OpenAI from "openai";
import { z } from "zod";

import type { CopilotoSignalType } from "@shared/schema";

/**
 * COPILOTO — camada de redação.
 *
 * A IA NÃO decide para quem ligar nem descobre nada: isso é trabalho do SQL
 * determinístico em copiloto.service.ts. Aqui ela só traduz fatos já apurados
 * em uma mensagem de WhatsApp e um motivo em linguagem de vendedor.
 *
 * A separação é deliberada. O vendedor confia na fila porque vê o número que a
 * gerou; a IA existe para poupar os 2 minutos de redigir a mensagem, não para
 * opinar sobre o cliente. Todo fato no prompt vem do payload do sinal.
 */

/**
 * `motivo` não é persistido nem exibido: o motivo determinístico do sinal
 * ("Comprava X (6x, 251 grf) e parou há 118 dias") é sempre mais específico que
 * a versão da IA. Ele fica no schema porque pedir o raciocínio antes da
 * mensagem faz o modelo se ancorar nos fatos em vez de sair escrevendo.
 */
const suggestionSchema = z.object({
  motivo: z.string().min(1).max(300),
  mensagem: z.string().min(1).max(600),
});

export type CopilotoSuggestion = z.infer<typeof suggestionSchema>;

export interface SuggestionInput {
  clientName: string;
  sellerName: string;
  type: CopilotoSignalType;
  reason: string;
  payload: Record<string, unknown>;
}

/** Fatos que cada tipo de sinal expõe, já formatados para o prompt. */
function describeFacts(input: SuggestionInput): string {
  const p = input.payload;
  const facts: string[] = [];

  switch (input.type) {
    case "ciclo_vencido":
      facts.push(`Compra em média a cada ${p.cycleDays} dias`);
      facts.push(`Está há ${p.daysSince} dias sem comprar (${p.daysLate} além do normal)`);
      facts.push(`Já fez ${p.orderCount} pedidos`);
      break;
    case "produto_abandonado":
      facts.push(`Comprava o produto "${p.product}" com recorrência`);
      facts.push(`Levou ${p.timesBought} vezes, ${Math.round(Number(p.totalQty ?? 0))} garrafas no total`);
      facts.push(`Parou de comprar esse produto há ${p.daysSince} dias`);
      break;
    case "aniversario":
      facts.push(
        Number(p.daysAhead) === 0
          ? "Faz aniversário hoje"
          : `Faz aniversário em ${p.daysAhead} dia(s)`,
      );
      if (Number(p.orderCount ?? 0) > 0) facts.push(`Já fez ${p.orderCount} pedidos`);
      break;
    case "campeao_silencioso":
      facts.push("É um cliente campeão (top RFM da carteira)");
      facts.push(`Já comprou ${p.orderCount} vezes`);
      facts.push(
        p.daysSinceContact === null
          ? "Nunca teve contato registrado"
          : `Sem contato registrado há ${p.daysSinceContact} dias`,
      );
      break;
  }

  return facts.map((fact) => `- ${fact}`).join("\n");
}

const SYSTEM_PROMPT = `Você ajuda vendedores de uma loja de vinhos brasileira a retomar contato com clientes.

Escreva SEMPRE em português do Brasil, no tom de uma pessoa real mandando WhatsApp: caloroso, direto, sem formalidade corporativa.

REGRAS RÍGIDAS — quebrar qualquer uma torna a resposta inútil:
1. Use SOMENTE os fatos listados. Não invente vinho, safra, preço, desconto, promoção, brinde, estoque ou evento.
2. NUNCA prometa condição comercial ("desconto", "frete grátis", "preço especial"). O vendedor não autorizou nada disso.
3. NUNCA cite números internos: dias de atraso, ciclo médio, quantidade de pedidos, RFM, "sistema", "análise", "detectamos". O cliente não pode perceber que foi sinalizado por software.
4. Não trate ausência como cobrança. Nada de "faz tempo que você não compra".
5. Mensagem curta: 2 a 3 frases, no máximo ~350 caracteres. Sem assinatura, sem "Att".
6. Trate o cliente pelo primeiro nome.

Responda APENAS um JSON válido, nesta ordem:
{
  "motivo": "1 frase, uso interno: por que vale falar com este cliente agora, citando os fatos",
  "mensagem": "a mensagem de WhatsApp pronta para enviar ao cliente, seguindo as regras acima"
}`;

/**
 * Redige mensagem + motivo para um card. Lança em caso de falha — quem chama
 * decide se degrada para o texto determinístico (é o que a varredura faz).
 */
export async function generateCardSuggestion(
  input: SuggestionInput,
): Promise<CopilotoSuggestion> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const userPrompt = `Cliente: ${input.clientName}
Vendedor: ${input.sellerName}

Fatos apurados sobre este cliente:
${describeFacts(input)}

Escreva a mensagem de WhatsApp que o vendedor vai enviar para reabrir a conversa.`;

  const completion = await openaiClient.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 400,
  });

  const content = completion.choices[0]?.message?.content ?? "{}";
  const parsed = suggestionSchema.safeParse(JSON.parse(content));
  if (!parsed.success) {
    throw new Error(
      `Sugestão da IA em formato inválido: ${parsed.error.issues
        .map((issue) => issue.path.join("."))
        .join(", ")}`,
    );
  }

  return parsed.data;
}

/**
 * Redige em lote com concorrência limitada. Um card que falhar volta como null
 * e segue exibindo o motivo determinístico — a fila nunca depende da OpenAI
 * estar de pé.
 */
export async function generateSuggestionsBatch<T extends SuggestionInput>(
  inputs: T[],
  concurrency = 4,
): Promise<Array<CopilotoSuggestion | null>> {
  const results: Array<CopilotoSuggestion | null> = new Array(inputs.length).fill(
    null,
  );
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < inputs.length) {
      const index = cursor++;
      try {
        results[index] = await generateCardSuggestion(inputs[index]);
      } catch (error) {
        console.error(
          `[copiloto-ai] Falha ao redigir card ${index} (${inputs[index].type}):`,
          error instanceof Error ? error.message : error,
        );
        results[index] = null;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, inputs.length) }, () => worker()),
  );

  return results;
}
