import { db } from "../db";
import { tags, type Tag, type InsertTag } from "../../shared/schema";
import { eq } from "drizzle-orm";

/**
 * Repository responsável por operações de banco de dados relacionadas a tags
 * Tags incluem: categorias, origens e marcadores
 */
class TagsRepository {
  /**
   * Busca todas as tags de um tipo específico
   *
   * @param type - Tipo da tag: "categoria", "origem" ou "marcador"
   * @returns Lista de tags do tipo especificado, ordenadas por data de criação (mais recentes primeiro)
   *
   * @example
   * // Buscar todas as categorias
   * const categories = await repository.getTagsByType("categoria");
   *
   * // Buscar todas as origens
   * const origins = await repository.getTagsByType("origem");
   *
   * // Buscar todos os marcadores
   * const markers = await repository.getTagsByType("marcador");
   *
   * @notes
   * - Retorna lista em ordem reversa de criação (mais recentes primeiro)
   * - Tipos válidos: "categoria", "origem", "marcador"
   */
  async getTagsByType(
    type: "categoria" | "origem" | "marcador"
  ): Promise<Tag[]> {
    const result = await db
      .select()
      .from(tags)
      .where(eq(tags.type, type))
      .orderBy(tags.createdAt);

    return result.reverse();
  }
}

export const tagsRepository = new TagsRepository();
