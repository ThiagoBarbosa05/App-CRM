import { ClientsRepository } from "server/repositories/clients.repository";
import { storage, ClientFilters } from "../storage";
import { insertClientSchema } from "@shared/schema";
import { z } from "zod";

export interface GetClientsParams {
  userId?: string;
  userRole?: string;
  filters?: ClientFilters;
  page?: number;
  pageSize?: number;
}

export interface GetClientsResponse {
  data: any[];
  currentPage: number;
  hasNextPage: boolean;
  totalPages: number;
  totalItems: null | number;
}

export interface CreateClientParams {
  userId?: string;
  userRole?: string;
  clientData: any;
}

export interface UpdateClientParams {
  clientId: string;
  userId?: string;
  userRole?: string;
  updateData: any;
}

export interface DeleteClientParams {
  clientId: string;
}

export interface DeleteClientsBulkParams {
  userId?: string;
  userRole?: string;
  clientIds: string[];
}

export class ClientsService {
  constructor(private clientsRepository = new ClientsRepository()) {}
  /**
   * Busca clientes com filtros, paginação e controle de acesso baseado em role
   */
  async getClients(params: GetClientsParams): Promise<GetClientsResponse> {
    const { userId, userRole, filters = {}, page = 1, pageSize = 100 } = params;

    // Validação de parâmetros
    if (page < 1) {
      throw new Error("Página deve ser maior que 0");
    }

    if (pageSize < 1 || pageSize > 1000) {
      throw new Error("Tamanho da página deve estar entre 1 e 1000");
    }

    try {
      // Buscar clientes e contagem total em paralelo
      const [clients, totalItems] = await Promise.all([
        this.clientsRepository.getClients(userId, userRole, filters, page, pageSize),
        this.clientsRepository.countClients(userId, userRole, filters),
      ]);

      const totalPages = Math.ceil(totalItems / pageSize);

      // Formatação da resposta conforme esperado pela API
      return {
        data: clients,
        currentPage: page,
        hasNextPage: page < totalPages,
        totalPages: totalPages,
        totalItems: totalItems,
      };
    } catch (error) {
      console.error("Erro no ClientsService.getClients:", error);
      throw new Error("Erro ao buscar clientes");
    }
  }

  /**
   * Valida e normaliza os filtros de entrada
   */
  private normalizeFilters(rawFilters: any): ClientFilters {
    const filters: ClientFilters = {};

    if (rawFilters.search && typeof rawFilters.search === "string") {
      filters.search = rawFilters.search;
    }
    if (rawFilters.name && typeof rawFilters.name === "string") {
      filters.name = rawFilters.name;
    }
    if (rawFilters.phone && typeof rawFilters.phone === "string") {
      filters.phone = rawFilters.phone;
    }
    if (rawFilters.cpf && typeof rawFilters.cpf === "string") {
      filters.cpf = rawFilters.cpf;
    }
    if (
      rawFilters.responsavelId &&
      typeof rawFilters.responsavelId === "string"
    ) {
      filters.responsavelId = rawFilters.responsavelId;
    }
    if (rawFilters.categoria && typeof rawFilters.categoria === "string") {
      filters.categoria = rawFilters.categoria;
    }
    if (rawFilters.origem && typeof rawFilters.origem === "string") {
      filters.origem = rawFilters.origem;
    }
    if (rawFilters.markers && typeof rawFilters.markers === "string") {
      filters.markers = rawFilters.markers;
    }

    return filters;
  }

  /**
   * Busca cliente específico por número de telefone
   */
  async getClientByPhone(phone: string): Promise<any> {
    // Validação de entrada
    if (!phone || typeof phone !== "string" || phone.trim().length === 0) {
      throw new Error("Número de telefone é obrigatório");
    }

    try {
      // Buscar cliente através do storage
      const client = await this.clientsRepository.getClientByPhone(phone);

      if (!client) {
        return null; // Retorna null se não encontrado (será tratado no controller)
      }

      return client;
    } catch (error) {
      console.error("Erro no ClientsService.getClientByPhone:", error);
      throw new Error("Erro ao buscar cliente por telefone");
    }
  }

  /**
   * Busca clientes sem contato recente
   */
  async getClientsWithoutRecentContact(
    userId?: string,
    userRole?: string,
    days: number = 1
  ): Promise<any[]> {
    // Validação de entrada
    if (days < 1 || days > 365) {
      throw new Error("Número de dias deve estar entre 1 e 365");
    }

    try {
      // Buscar clientes através do repositório
      const clients =
        await this.clientsRepository.getClientsWithoutRecentContact(
          userId,
          userRole,
          days
        );

      return clients;
    } catch (error) {
      console.error(
        "Erro no ClientsService.getClientsWithoutRecentContact:",
        error
      );
      throw new Error("Erro ao buscar clientes sem contato recente");
    }
  }

  /**
   * Exporta todos os clientes do sistema (apenas para administradores)
   */
  async getAllClientsForExport(userRole?: string): Promise<any[]> {
    // Validação de permissão
    if (userRole !== "admin" && userRole !== "administrador") {
      throw new Error(
        "Acesso negado. Apenas administradores podem exportar todos os dados."
      );
    }

    try {
      // Buscar todos os clientes através do repositório
      const clients = await this.clientsRepository.getAllClientsForExport();

      return clients;
    } catch (error) {
      console.error("Erro no ClientsService.getAllClientsForExport:", error);
      throw new Error("Erro ao buscar dados para exportação");
    }
  }

  /**
   * Cria um novo cliente no sistema
   */
  async createClient(params: CreateClientParams): Promise<any> {
    const { userId, userRole, clientData } = params;

    try {
      // Processar e normalizar dados de entrada
      const processedData = this.processClientData(
        clientData,
        userId,
        userRole
      );

      // Validar dados usando o schema Zod
      const validatedData = insertClientSchema.parse(processedData);

      // Criar cliente através do repositório
      const client = await this.clientsRepository.createClient(validatedData);

      return client;
    } catch (error) {
      console.error("Erro no ClientsService.createClient:", error);

      // Re-throw erros de validação Zod para serem tratados no controller
      if (error instanceof z.ZodError) {
        throw error;
      }

      // Re-throw erros de banco (telefone duplicado, etc.)
      if (error && error.toString().includes("clients_phone_unique")) {
        throw new Error(
          "Este número de telefone já está cadastrado para outro cliente."
        );
      }

      throw new Error("Erro ao criar cliente");
    }
  }

  /**
   * Atualiza um cliente existente no sistema
   */
  async updateClient(params: UpdateClientParams): Promise<any> {
    const { clientId, userId, userRole, updateData } = params;

    // Validação básica do ID do cliente
    if (!clientId || typeof clientId !== "string") {
      throw new Error("ID do cliente é obrigatório");
    }

    try {
      // Processar e normalizar dados de entrada para atualização
      const processedData = this.processUpdateClientData(
        updateData,
        userId,
        userRole
      );

      // Validar dados usando o schema Zod (partial para permitir atualizações parciais)
      const validatedData = insertClientSchema.partial().parse(processedData);

      // Atualizar cliente através do repositório
      const client = await this.clientsRepository.updateClient(
        clientId,
        validatedData
      );

      // Verificar se o cliente foi encontrado
      if (!client) {
        throw new Error("CLIENT_NOT_FOUND");
      }

      return client;
    } catch (error) {
      console.error("Erro no ClientsService.updateClient:", error);

      // Re-throw erros de validação Zod para serem tratados no controller
      if (error instanceof z.ZodError) {
        throw error;
      }

      // Re-throw erro específico de cliente não encontrado
      if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") {
        throw error;
      }

      // Re-throw erros de banco (telefone duplicado, etc.)
      if (error && error.toString().includes("clients_phone_unique")) {
        throw new Error(
          "Este número de telefone já está cadastrado para outro cliente."
        );
      }

      throw new Error("Erro ao atualizar cliente");
    }
  }

  /**
   * Processa e normaliza dados do cliente antes da validação (para criação)
   */
  private processClientData(
    clientData: any,
    userId?: string,
    userRole?: string
  ): any {
    // Converter strings vazias em null para campos opcionais
    let processedData = {
      ...clientData,
      responsavelId:
        clientData.responsavelId === "" ? null : clientData.responsavelId,
      cpf: clientData.cpf === "" ? null : clientData.cpf,
      email: clientData.email === "" ? null : clientData.email,
      categoria: clientData.categoria || "Geral",
      origem: clientData.origem || "Website",
    };

    // Se não for admin e não foi especificado um responsável, usar o usuário atual
    if (userRole !== "admin" && !processedData.responsavelId && userId) {
      processedData.responsavelId = userId;
    }

    return processedData;
  }

  /**
   * Processa e normaliza dados do cliente antes da validação (para atualização)
   */
  private processUpdateClientData(
    updateData: any,
    userId?: string,
    userRole?: string
  ): any {
    // Converter strings vazias em null para campos opcionais (sem defaults para atualização)
    let processedData = {
      ...updateData,
      responsavelId:
        updateData.responsavelId === "" ? null : updateData.responsavelId,
      cpf: updateData.cpf === "" ? null : updateData.cpf,
      email: updateData.email === "" ? null : updateData.email,
    };

    // Se não for admin e não foi especificado um responsável, usar o usuário atual
    if (userRole !== "admin" && !processedData.responsavelId && userId) {
      processedData.responsavelId = userId;
    }

    return processedData;
  }

  /**
   * Exclui um cliente existente do sistema
   */
  async deleteClient(params: DeleteClientParams): Promise<boolean> {
    const { clientId } = params;

    // Validação básica do ID do cliente
    if (!clientId || typeof clientId !== "string") {
      throw new Error("ID do cliente é obrigatório");
    }

    try {
      // Excluir cliente através do repositório
      const success = await this.clientsRepository.deleteClient(clientId);

      // Verificar se o cliente foi encontrado e excluído
      if (!success) {
        throw new Error("CLIENT_NOT_FOUND");
      }

      return success;
    } catch (error) {
      console.error("Erro no ClientsService.deleteClient:", error);

      // Re-throw erro específico de cliente não encontrado
      if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") {
        throw error;
      }

      throw new Error("Erro ao excluir cliente");
    }
  }

  /**
   * Exclui múltiplos clientes
   * @param params - Parâmetros de exclusão em lote
   * @returns Promise<any> - Resultado da operação
   */
  async deleteClientsBulk(params: DeleteClientsBulkParams): Promise<any> {
    try {
      const { clientIds, userId, userRole } = params;

      // Validação de permissão: apenas admin pode excluir em lote
      if (userRole !== "admin") {
        throw new Error(
          "Acesso negado: apenas administradores podem realizar exclusões em lote"
        );
      }

      if (!clientIds || clientIds.length === 0) {
        throw new Error("Lista de IDs de clientes é obrigatória");
      }

      // Verifica se todos os IDs são válidos
      const invalidIds = clientIds.filter(
        (id) => !id || typeof id !== "string"
      );
      if (invalidIds.length > 0) {
        throw new Error("IDs de clientes inválidos encontrados");
      }

      return await this.clientsRepository.deleteClients(clientIds);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao excluir clientes em lote");
    }
  }

  /**
   * Processa parâmetros para exclusão em lote de clientes
   */
  processDeleteClientsBulkParams(req: any): DeleteClientsBulkParams {
    const userId = req.user?.id || req.user?.userId || req.userId;
    const userRole = req.user?.role || req.user?.userRole || req.userRole;
    const { clientIds } = req.body;

    return {
      clientIds,
      userId,
      userRole,
    };
  }

  /**
   * Processa parâmetros específicos para a rota without-contact
   */
  processWithoutContactParams(req: any): {
    userId?: string;
    userRole?: string;
    days: number;
  } {
    const userId =
      (req.query.userId as string) || (req.headers["x-user-id"] as string);
    const userRole =
      (req.query.userRole as string) || (req.headers["x-user-role"] as string);
    const days = parseInt(req.query.days as string) || 1;

    return { userId, userRole, days };
  }

  /**
   * Processa parâmetros específicos para a rota export-all
   */
  processExportAllParams(req: any): { userRole?: string } {
    const userRole = req.headers["x-user-role"] as string;
    return { userRole };
  }

  /**
   * Processa parâmetros específicos para a rota POST (criar cliente)
   */
  processCreateClientParams(req: any): CreateClientParams {
    const userId =
      (req.query.userId as string) || (req.headers["x-user-id"] as string);
    const userRole =
      (req.query.userRole as string) || (req.headers["x-user-role"] as string);
    const clientData = req.body;

    return { userId, userRole, clientData };
  }

  /**
   * Processa parâmetros específicos para a rota PUT (atualizar cliente)
   */
  processUpdateClientParams(req: any): UpdateClientParams {
    const clientId = req.params.id;
    const userId =
      (req.query.userId as string) || (req.headers["x-user-id"] as string);
    const userRole =
      (req.query.userRole as string) || (req.headers["x-user-role"] as string);
    const updateData = req.body;

    return { clientId, userId, userRole, updateData };
  }

  /**
   * Processa parâmetros específicos para a rota DELETE (excluir cliente)
   */
  processDeleteClientParams(req: any): DeleteClientParams {
    const clientId = req.params.id;
    return { clientId };
  }

  /**
   * Método auxiliar para processar parâmetros de query/headers
   */
  processRequestParams(req: any): GetClientsParams {
    // Pegar informações do usuário logado da query string ou headers
    const userId =
      (req.query.userId as string) || (req.headers["x-user-id"] as string);
    const userRole =
      (req.query.userRole as string) || (req.headers["x-user-role"] as string);

    // Extrair paginação da query string
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 100;

    // Extrair e normalizar filtros da query string
    const filters = this.normalizeFilters({
      search: req.query.search,
      name: req.query.name,
      phone: req.query.phone,
      cpf: req.query.cpf,
      responsavelId: req.query.responsavelId,
      categoria: req.query.categoria,
      origem: req.query.origem,
      markers: req.query.markers,
    });

    return {
      userId,
      userRole,
      filters,
      page,
      pageSize,
    };
  }
}

// Exporta uma instância singleton do service
export const clientsService = new ClientsService();
