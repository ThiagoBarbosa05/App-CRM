import { tagsRepository } from "../repositories/tags.repository";
import type { Tag } from "../../shared/schema";

/**
 * Service responsável pela lógica de negócio relacionada a tags
 * Tags são usadas para categorizar clientes (categoria, origem, marcador)
 */
class TagsService {
  /**
   * Busca todas as categorias
   *
   * @returns Lista de tags do tipo "categoria"
   *
   * @example
   * const categories = await service.getCategories();
   * // [
   * //   { id: "1", name: "VIP", type: "categoria", createdAt: "2023-01-01T00:00:00.000Z" },
   * //   { id: "2", name: "Premium", type: "categoria", createdAt: "2023-01-02T00:00:00.000Z" }
   * // ]
   *
   * @notes
   * - Retorna lista ordenada por data de criação (mais recentes primeiro)
   * - Categorias são usadas para classificar clientes
   */
  async getCategories(): Promise<Tag[]> {
    return await tagsRepository.getTagsByType("categoria");
  }

  /**
   * Busca todas as origens
   *
   * @returns Lista de tags do tipo "origem"
   *
   * @example
   * const origins = await service.getOrigins();
   * // [
   * //   { id: "1", name: "Facebook", type: "origem", createdAt: "2023-01-01T00:00:00.000Z" },
   * //   { id: "2", name: "Instagram", type: "origem", createdAt: "2023-01-02T00:00:00.000Z" }
   * // ]
   *
   * @notes
   * - Retorna lista ordenada por data de criação (mais recentes primeiro)
   * - Origens indicam de onde o cliente veio
   */
  async getOrigins(): Promise<Tag[]> {
    return await tagsRepository.getTagsByType("origem");
  }

  /**
   * Busca todos os marcadores
   *
   * @returns Lista de tags do tipo "marcador"
   *
   * @example
   * const markers = await service.getMarkers();
   * // [
   * //   { id: "1", name: "Urgente", type: "marcador", createdAt: "2023-01-01T00:00:00.000Z" },
   * //   { id: "2", name: "Follow-up", type: "marcador", createdAt: "2023-01-02T00:00:00.000Z" }
   * // ]
   *
   * @notes
   * - Retorna lista ordenada por data de criação (mais recentes primeiro)
   * - Marcadores são labels adicionais para organização
   */
  async getMarkers(): Promise<Tag[]> {
    return await tagsRepository.getTagsByType("marcador");
  }

  async getCountries(): Promise<Tag[]> {
    return await tagsRepository.getTagsByType("pais");
  }
}

export const tagsService = new TagsService();
