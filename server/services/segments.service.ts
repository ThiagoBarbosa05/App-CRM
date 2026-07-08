import { ClientsRepository } from "../repositories/clients.repository";
import type { ClientFilters } from "../storage";

/**
 * Segmentação da base de clientes.
 *
 * Cada segmento define um conjunto de `filters` no MESMO formato aceito pela
 * listagem de clientes (`GET /api/clients`). A contagem é feita reusando
 * `ClientsRepository.getClientsCount`, garantindo que o número exibido no card
 * seja idêntico ao que o usuário vê ao clicar em "Ver clientes" (paridade total).
 *
 * A página é de uso administrativo/gestor, portanto as contagens são sobre a
 * base inteira (sem escopo por vendedor).
 */

export interface SegmentDefinition {
  id: string;
  label: string;
  description: string;
  /** Filtros no formato da listagem de clientes (deep-link e contagem). */
  filters: Partial<ClientFilters>;
}

export interface SegmentGroup {
  id: string;
  title: string;
  description: string;
  segments: SegmentDefinition[];
}

export interface SegmentWithCount extends SegmentDefinition {
  count: number;
}

export interface SegmentGroupWithCounts extends Omit<SegmentGroup, "segments"> {
  segments: SegmentWithCount[];
}

/** Definição estática dos grupos e segmentos exibidos na página. */
export const SEGMENT_GROUPS: SegmentGroup[] = [
  {
    id: "rfm",
    title: "Comportamento de compra (RFM)",
    description:
      "Baseado em recência, frequência e valor das compras já calculados. Ideal para retenção e aumento de ticket.",
    segments: [
      {
        id: "campiao",
        label: "Campeões",
        description: "Compram com frequência, valor alto e recentemente. Sua elite.",
        filters: { rfmSegment: "campiao" },
      },
      {
        id: "fiel",
        label: "Fiéis",
        description: "Clientes recorrentes e engajados. Bons para upsell e clube.",
        filters: { rfmSegment: "fiel" },
      },
      {
        id: "promissor",
        label: "Promissores",
        description: "Começaram bem e têm potencial. Vale um empurrão para fidelizar.",
        filters: { rfmSegment: "promissor" },
      },
      {
        id: "em_risco",
        label: "Em risco",
        description: "Já compraram bem, mas estão esfriando. Reativação urgente.",
        filters: { rfmSegment: "em_risco" },
      },
      {
        id: "hibernando",
        label: "Hibernando",
        description: "Sem comprar há bastante tempo. Ofereça um motivo para voltar.",
        filters: { rfmSegment: "hibernando" },
      },
      {
        id: "perdido",
        label: "Perdidos",
        description: "Inativos há muito tempo. Última tentativa de resgate.",
        filters: { rfmSegment: "perdido" },
      },
    ],
  },
  {
    id: "lifecycle",
    title: "Ciclo de vida",
    description:
      "Onde o cliente está na jornada. Foco em converter a base de leads e ativar cadastros.",
    segments: [
      {
        id: "sem_compra",
        label: "Leads não convertidos",
        description: "Cadastrados que ainda não compraram. Maior oportunidade da base.",
        filters: { rfmSegment: "sem_compra" },
      },
      {
        id: "novo",
        label: "Clientes novos",
        description: "Fizeram a primeira compra recentemente. Foco na segunda compra.",
        filters: { rfmSegment: "novo" },
      },
      {
        id: "pending",
        label: "Cadastro pendente",
        description: "Ainda não confirmaram o cadastro. Ative para liberar comunicação.",
        filters: { status: "pending" },
      },
    ],
  },
  {
    id: "product",
    title: "Preferência de produto",
    description:
      "Baseado nos marcadores de gosto e comportamento. Ótimo para ofertas temáticas.",
    segments: [
      {
        id: "tintos",
        label: "Amantes de tinto",
        description: "Marcados com interesse em vinhos tintos.",
        filters: { markers: "TINTOS" },
      },
      {
        id: "malbec",
        label: "Malbec",
        description: "Interesse específico em Malbec.",
        filters: { markers: "MALBEC" },
      },
      {
        id: "espumantes",
        label: "Espumantes",
        description: "Gostam de espumantes. Bom para datas comemorativas.",
        filters: { markers: "ESPUMANTES" },
      },
      {
        id: "roses",
        label: "Rosés",
        description: "Interesse em vinhos rosés.",
        filters: { markers: "ROSES" },
      },
      {
        id: "degustacao",
        label: "Degustação / Experiências",
        description: "Participaram de degustações e do 'Desvendando o Vinho'.",
        filters: { markers: "DEGUSTAÇÃO,DESVENDANDO O VINHO" },
      },
      {
        id: "black",
        label: "Comprou na Black",
        description: "Compraram em promoção de Black Friday. Alta resposta a ofertas.",
        filters: { markers: "COMPROU NA BLACK" },
      },
    ],
  },
  {
    id: "wine_profile",
    title: "Perfil de gosto (IA)",
    description:
      "Baseado na análise do histórico de compras via IA. Permite ações ultra-segmentadas por país, uva e tipo de vinho.",
    segments: [
      {
        id: "wp_chile",
        label: "Apreciadores de Chile",
        description: "Perfil de gosto com regiões chilenas. Ideal para lançamentos e promoções de vinhos chilenos.",
        filters: { wineRegion: "Chile" },
      },
      {
        id: "wp_argentina",
        label: "Apreciadores de Argentina",
        description: "Perfil com regiões argentinas (Mendoza, Salta, Patagônia etc.).",
        filters: { wineRegion: "Argentin" },
      },
      {
        id: "wp_portugal",
        label: "Apreciadores de Portugal",
        description: "Perfil com regiões portuguesas. Bom para Alentejo, Douro e Vinho Verde.",
        filters: { wineRegion: "Portugal" },
      },
      {
        id: "wp_italia",
        label: "Apreciadores de Itália",
        description: "Perfil com regiões italianas (Toscana, Piemonte, Veneto etc.).",
        filters: { wineRegion: "Itália" },
      },
      {
        id: "wp_franca",
        label: "Apreciadores de França",
        description: "Perfil com regiões francesas (Bordeaux, Borgonha, Champagne etc.).",
        filters: { wineRegion: "França" },
      },
      {
        id: "wp_tempranillo",
        label: "Fãs de Tempranillo",
        description: "Uva favorita Tempranillo no perfil de gosto. Clientes de vinhos espanhóis e alguns portugueses.",
        filters: { wineGrape: "Tempranillo" },
      },
      {
        id: "wp_malbec",
        label: "Fãs de Malbec",
        description: "Uva favorita Malbec. Muito ligados à Argentina.",
        filters: { wineGrape: "Malbec" },
      },
      {
        id: "wp_cabernet",
        label: "Fãs de Cabernet Sauvignon",
        description: "Uva favorita Cabernet Sauvignon. Perfil encorpado e clássico.",
        filters: { wineGrape: "Cabernet" },
      },
      {
        id: "wp_espumante",
        label: "Amantes de espumante",
        description: "Tipo preferido é espumante no perfil de gosto.",
        filters: { wineType: "ESPUMANTE" },
      },
      {
        id: "wp_branco",
        label: "Preferência por branco",
        description: "Tipo preferido é branco. Bom para lançamentos de Chardonnay, Sauvignon Blanc etc.",
        filters: { wineType: "BRANCO" },
      },
    ],
  },
  {
    id: "events",
    title: "Relacionamento & eventos",
    description:
      "Clientes ligados a eventos e experiências presenciais. Bom para convites e recompra por produtor.",
    segments: [
      {
        id: "event_participants",
        label: "Participantes de eventos",
        description: "Já participaram de algum evento cadastrado.",
        filters: { isEventParticipant: true },
      },
      {
        id: "categoria_evento",
        label: "Categoria Evento",
        description: "Clientes classificados na categoria EVENTO.",
        filters: { categoria: "EVENTO" },
      },
      {
        id: "evento_rocca",
        label: "Evento Rocca",
        description: "Marcados no evento Rocca.",
        filters: { markers: "Evento ROCCA" },
      },
      {
        id: "evento_vallado",
        label: "Evento Vallado",
        description: "Marcados no evento Vallado.",
        filters: { markers: "Evento VALLADO" },
      },
      {
        id: "evento_siegel",
        label: "Evento Siegel",
        description: "Marcados no evento Siegel.",
        filters: { markers: "Evento Siegel" },
      },
      {
        id: "evento_matarromera",
        label: "Evento Matarromera",
        description: "Marcados no evento Matarromera.",
        filters: { markers: "Evento MATARROMERA" },
      },
    ],
  },
];

export class SegmentsService {
  constructor(private clientsRepository = new ClientsRepository()) {}

  /**
   * Retorna todos os grupos de segmentos com a contagem de clientes de cada um,
   * sobre a base inteira (visão gestor).
   */
  async getOverview(): Promise<{
    total: number;
    groups: SegmentGroupWithCounts[];
  }> {
    const total = await this.clientsRepository.getClientsCount(
      undefined,
      "admin",
      {},
    );

    const groups = await Promise.all(
      SEGMENT_GROUPS.map(async (group) => {
        const segments = await Promise.all(
          group.segments.map(async (segment) => {
            const count = await this.clientsRepository.getClientsCount(
              undefined,
              "admin",
              segment.filters,
            );
            return { ...segment, count };
          }),
        );
        return { ...group, segments };
      }),
    );

    return { total, groups };
  }
}

export const segmentsService = new SegmentsService();
