import { normalizePhoneE164 } from "@shared/phone";

/**
 * Normaliza um telefone em duas formas comparáveis: `digits` (só dígitos, com
 * DDI se houver) e `withoutCountry` (sem o DDI 55 quando presente). Comparar por
 * ambas evita falsos negativos quando um lado está cadastrado com o `55` e o
 * outro sem — ex.: `displayPhone` de canal salvo como `21989014965` vs. o JID do
 * WhatsApp que sempre traz `5521989014965`.
 *
 * Não cobre a variação do 9º dígito de celular (`21988887777` vs.
 * `2188887777`) — para isso use `phoneVariants`/`canonicalPhone`.
 */
export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const withoutCountry =
    digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  return { digits, withoutCountry };
}

/**
 * Forma canônica de um telefone: só dígitos, sempre com DDI 55 e sempre com o
 * 9º dígito nos celulares (`5521988887777`). É o valor gravado em
 * `whatsapp_conversations.phone_normalized`, que forma a chave de unicidade da
 * conversa junto com o canal.
 *
 * Delega ao `normalizePhoneE164` de `@shared/phone` (fonte de verdade da
 * normalização BR, já usada por clientes, campanhas e Umbler) e cai para os
 * dígitos crus quando a entrada não é um número brasileiro reconhecível — assim
 * um contato internacional continua tendo uma chave estável, ainda que sem
 * canonicalização.
 */
export function canonicalPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return normalizePhoneE164(phone)?.slice(1) ?? phone.replace(/\D/g, "");
}

/**
 * Todas as formas sob as quais o mesmo telefone pode estar gravado no banco:
 * com/sem DDI 55 e com/sem o 9º dígito de celular. Usada nas comparações SQL de
 * telefone (conversas e clientes) para que o mesmo contato não gere duas
 * conversas só porque um cadastro antigo veio sem o 9.
 *
 * Sempre inclui os dígitos crus da entrada, garantindo que a comparação nunca
 * fique pior do que a de `normalizePhone`.
 */
export function phoneVariants(phone: string | null | undefined): string[] {
  if (!phone) return [];
  const { digits, withoutCountry } = normalizePhone(phone);
  if (!digits) return [];

  const variants = new Set<string>([digits, withoutCountry, `55${withoutCountry}`]);

  const canonical = canonicalPhone(phone);
  if (canonical) {
    variants.add(canonical);
    const local = canonical.startsWith("55") ? canonical.slice(2) : canonical;
    variants.add(local);

    // Variante legada sem o 9º dígito (DDD + 8 dígitos), para casar cadastros
    // antigos: "5521988887777" → "552188887777" / "2188887777".
    if (local.length === 11 && local[2] === "9") {
      const legacy = `${local.slice(0, 2)}${local.slice(3)}`;
      variants.add(legacy);
      variants.add(`55${legacy}`);
    }
  }

  return Array.from(variants).filter(Boolean);
}

/**
 * Forma canônica **local** de um telefone: DDD + número, sem o DDI e sempre com
 * o 9º dígito de celular (`21999961728`). É a chave de agrupamento do detector
 * de duplicatas (`duplicate-detection.service.ts`).
 *
 * Diferente de `canonicalPhone`, que mantém o `55`. E, diferente das outras
 * funções deste arquivo, é implementada passo a passo em vez de delegar a
 * `normalizePhoneE164`: precisa espelhar exatamente o `phoneNormSql` abaixo,
 * inclusive nos números que não são telefones brasileiros válidos. Se as duas
 * divergirem, o aviso em tempo real do formulário de cliente e a varredura em
 * lote da tela de duplicatas passam a discordar sobre o que é duplicata.
 *
 * A versão anterior desta normalização só removia o `55`, e por isso a tela de
 * duplicatas enxergava `3199910141` e `31999910141` como clientes diferentes —
 * justamente o par que ela existe para mostrar, e que o `phoneVariants` acima
 * (usado pelo lookup das integrações) sempre casou.
 */
export function canonicalLocalPhone(phone: string): string {
  return phone
    .replace(/\D/g, "")
    .replace(/^55(?=\d{10,}$)/, "") // DDI, só quando sobram 10+ dígitos
    .replace(/^0/, "") // zero de operadora/DDD
    // 9º dígito. Replacer em função, e não `"$19$2"`: a string faria o TS/JS
    // hesitarem entre o grupo 19 e "grupo 1 seguido de 9".
    .replace(/^(\d{2})([6-9]\d{7})$/, (_, ddd: string, num: string) => `${ddd}9${num}`);
}

/**
 * Equivalente SQL de `canonicalLocalPhone` — mesmos quatro passos, na mesma
 * ordem. Recebe o nome qualificado da coluna (ex.: `"c.phone"`).
 *
 * `regexp_replace` encadeado em vez de `CASE` aninhado de propósito: cada `CASE`
 * teria de repetir a expressão inteira do passo anterior nos seus ramos, e o
 * custo explodiria numa varredura agrupada sobre toda a tabela `clients`.
 */
export function phoneNormSql(col: string): string {
  return `
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(COALESCE(${col}, ''), '[^0-9]', '', 'g'),
          '^55(?=[0-9]{10,}$)', ''
        ),
        '^0', ''
      ),
      '^([0-9]{2})([6-9][0-9]{7})$', '\\19\\2'
    )
  `.trim();
}

/**
 * Confere se um número recebido é um auto-echo do MESMO canal que o recebeu —
 * ex.: dispositivo vinculado via Evolution/Baileys espelhando de volta uma
 * mensagem que o próprio número do canal enviou. Compara só contra o canal que
 * recebeu o evento, nunca contra os demais canais da empresa: um canal
 * diferente mandando mensagem de verdade para este número é uma conversa
 * legítima, não um eco. Puro (sem DB) para ser testável isoladamente.
 */
export function isSameChannelPhone(
  channelDisplayPhone: string | null | undefined,
  phone: string,
): boolean {
  if (!channelDisplayPhone) return false;
  const a = phoneVariants(channelDisplayPhone);
  if (a.length === 0) return false;
  const b = new Set(phoneVariants(phone));
  return a.some((v) => b.has(v));
}
