import { usersRepository } from "../repositories/users.repository";
import type { User, InsertUser } from "../../shared/schema";

/**
 * Service responsável pela lógica de negócio de usuários
 *
 * Esta classe contém toda a lógica de negócio relacionada a usuários,
 * validações, processamento de parâmetros e coordenação entre diferentes camadas.
 */
export class UsersService {
  private usersRepository = usersRepository;

  /**
   * Busca todos os usuários
   * Remove o campo password da resposta por segurança
   * @returns Promise com lista de usuários sem senhas
   */
  async getUsers(): Promise<any[]> {
    try {
      const users = await this.usersRepository.getUsers();

      // Remove passwords from response for security
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);

      return usersWithoutPasswords;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao buscar usuários");
    }
  }

  /**
   * Cria um novo usuário
   * Faz hash da senha antes de salvar e remove a senha da resposta
   * @param userData - Dados do usuário a ser criado
   * @returns Promise com usuário criado sem senha
   */
  async createUser(userData: InsertUser): Promise<Omit<User, "password">> {
    try {
      // Hash password before saving
      if (userData.password) {
        const bcrypt = await import("bcrypt");
        userData.password = await bcrypt.hash(userData.password, 10);
      }

      const user = await this.usersRepository.createUser(userData);

      // Remove password from response for security
      const { password, ...userWithoutPassword } = user;

      return userWithoutPassword;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao criar usuário");
    }
  }

  /**
   * Atualiza um usuário existente
   * Faz hash da senha se fornecida e remove a senha da resposta
   * @param id - ID do usuário a ser atualizado
   * @param updateData - Dados parciais para atualização
   * @returns Promise com usuário atualizado sem senha ou null se não encontrado
   */
  async updateUser(
    id: string,
    updateData: Partial<InsertUser>
  ): Promise<Omit<User, "password"> | null> {
    try {
      // Hash password if provided
      if (updateData.password) {
        const bcrypt = await import("bcrypt");
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }

      const user = await this.usersRepository.updateUser(id, updateData);

      if (!user) {
        return null;
      }

      // Remove password from response for security
      const { password, ...userWithoutPassword } = user;

      return userWithoutPassword;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao atualizar usuário");
    }
  }

  /**
   * Exclui um usuário
   * @param id - ID do usuário a ser excluído
   * @returns Promise<boolean> - true se excluído com sucesso, false se não encontrado
   */
  async deleteUser(id: string): Promise<boolean> {
    try {
      return await this.usersRepository.deleteUser(id);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao excluir usuário");
    }
  }

  /**
   * Alterna o status ativo/inativo de um usuário
   * @param id - ID do usuário
   * @param isActive - Novo status ("true" ou "false")
   * @returns Promise com usuário atualizado sem senha ou null se não encontrado
   */
  async toggleUserStatus(
    id: string,
    isActive: string
  ): Promise<Omit<User, "password"> | null> {
    try {
      const user = await this.usersRepository.updateUser(id, { isActive });

      if (!user) {
        return null;
      }

      // Remove password from response for security
      const { password, ...userWithoutPassword } = user;

      return userWithoutPassword;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao atualizar status do usuário");
    }
  }
}

// Instância singleton do service
export const usersService = new UsersService();
