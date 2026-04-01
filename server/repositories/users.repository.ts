import { db } from "../db";
import {
  users,
  userServiceChannel,
  serviceChannels,
  type User,
  type InsertUser,
} from "../../shared/schema";
import { eq } from "drizzle-orm";

/**
 * Repository responsável pelo acesso a dados de usuários
 *
 * Esta classe encapsula todas as operações de banco de dados relacionadas a usuários,
 * seguindo o padrão Repository para separar a lógica de acesso a dados da lógica de negócio.
 */
export class UsersRepository {
  private db = db;

  /**
   * Busca todos os usuários com seus canais de atendimento
   * @returns Promise com lista de usuários e seus canais
   */
  async getUsers(): Promise<any[]> {
    try {
      const result = await this.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          password: users.password,
          role: users.role,
          isActive: users.isActive,
          blingVendedorId: users.blingVendedorId,
          blingVendedorName: users.blingVendedorName,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          serviceChannel: {
            id: serviceChannels.id,
            name: serviceChannels.name,
            phoneNumber: serviceChannels.phoneNumber,
          },
        })
        .from(users)
        .leftJoin(userServiceChannel, eq(users.id, userServiceChannel.userId))
        .leftJoin(
          serviceChannels,
          eq(userServiceChannel.serviceChannelId, serviceChannels.id)
        )
        .orderBy(users.createdAt);

      return result.reverse();
    } catch (error) {
      console.error("Error fetching users:", error);
      throw error;
    }
  }

  /**
   * Cria um novo usuário
   * Nota: A senha deve ser hashada antes de chamar este método
   * @param userData - Dados do usuário a ser criado
   * @returns Promise<User> - Usuário criado
   */
  async createUser(userData: InsertUser): Promise<User> {
    try {
      const [user] = await this.db.insert(users).values(userData).returning();
      return user;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  /**
   * Atualiza um usuário existente
   * Nota: Se a senha estiver presente, deve ser hashada antes de chamar este método
   * @param id - ID do usuário a ser atualizado
   * @param updateData - Dados parciais para atualização
   * @returns Promise<User | undefined> - Usuário atualizado ou undefined se não encontrado
   */
  async updateUser(
    id: string,
    updateData: Partial<InsertUser>
  ): Promise<User | undefined> {
    try {
      const [user] = await this.db
        .update(users)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return user || undefined;
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  }

  /**
   * Exclui um usuário
   * @param id - ID do usuário a ser excluído
   * @returns Promise<boolean> - true se excluído com sucesso, false se não encontrado
   */
  async deleteUser(id: string): Promise<boolean> {
    try {
      const result = await this.db.delete(users).where(eq(users.id, id));
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting user:", error);
      throw error;
    }
  }
}

// Instância singleton do repository
export const usersRepository = new UsersRepository();
