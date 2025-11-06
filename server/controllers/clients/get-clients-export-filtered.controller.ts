import { Request, Response } from "express";
import { clientsService } from "../../services/clients.service";

/**
 * @route GET /api/clients/export
 * @description Exporta clientes com filtros aplicados em CSV ou Excel
 * @access Private
 * @queryParams Mesmos filtros disponíveis em GET /api/clients
 * @queryParams {string} [format=csv] - Formato de exportação: "csv" ou "excel"
 * @returns CSV ou JSON dependendo do formato solicitado
 */
export const getClientsExportFilteredController = async (
  req: Request,
  res: Response
) => {
  try {
    // Processar parâmetros da requisição
    const params = clientsService.processRequestParams(req);
    const format = (req.query.format as string) || "csv";

    // Buscar clientes com filtros (sem paginação para exportar todos)
    const allParams = {
      ...params,
      page: 1,
      pageSize: 10000, // Exportar todos os clientes que correspondem aos filtros
    };

    const result = await clientsService.getClients(allParams);
    const clients = result.data;

    if (format === "csv") {
      // Gerar CSV
      const csv = generateCSV(clients);
      
      // Definir headers para download de CSV
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="clientes_${new Date().toISOString().split("T")[0]}.csv"`
      );
      
      // Adicionar BOM para suportar UTF-8 no Excel
      res.write("\uFEFF");
      res.send(csv);
    } else {
      // Retornar JSON para o frontend processar como Excel
      res.json(clients);
    }
  } catch (error) {
    console.error("Erro no getClientsExportFilteredController:", error);
    res.status(500).json({
      message: "Erro ao exportar clientes",
    });
  }
};

/**
 * Gera CSV a partir dos dados de clientes
 */
function generateCSV(clients: any[]): string {
  if (clients.length === 0) {
    return "Nenhum cliente encontrado";
  }

  // Definir cabeçalhos das colunas
  const headers = [
    "Nome",
    "Telefone",
    "Telefone Fixo",
    "CPF",
    "E-mail",
    "Data de Nascimento",
    "CEP",
    "Endereço",
    "Número",
    "Bairro",
    "Cidade",
    "Estado",
    "Categoria",
    "Origem",
    "Marcadores",
    "Responsável",
    "Data de Cadastro",
  ];

  // Criar linhas do CSV
  const rows = clients.map((client) => {
    const birthday = client.birthday
      ? new Date(client.birthday).toLocaleDateString("pt-BR")
      : "";
    const createdAt = client.createdAt
      ? new Date(client.createdAt).toLocaleDateString("pt-BR")
      : "";
    const markers = Array.isArray(client.markers)
      ? client.markers.join("; ")
      : client.markers || "";

    return [
      escapeCSV(client.name || ""),
      escapeCSV(client.phone || ""),
      escapeCSV(client.fixedPhone || ""),
      escapeCSV(client.cpf || ""),
      escapeCSV(client.email || ""),
      birthday,
      escapeCSV(client.cep || ""),
      escapeCSV(client.address || ""),
      escapeCSV(client.number || ""),
      escapeCSV(client.neighborhood || ""),
      escapeCSV(client.city || ""),
      escapeCSV(client.state || ""),
      escapeCSV(client.categoria || ""),
      escapeCSV(client.origem || ""),
      escapeCSV(markers),
      escapeCSV(client.responsavelName || ""),
      createdAt,
    ].join(",");
  });

  // Combinar cabeçalhos e linhas
  return [headers.join(","), ...rows].join("\n");
}

/**
 * Escapa valores para CSV (trata vírgulas, aspas e quebras de linha)
 */
function escapeCSV(value: string): string {
  if (!value) return "";
  
  // Se contém vírgula, aspas ou quebra de linha, envolve em aspas duplas
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    // Duplica aspas internas
    return `"${value.replace(/"/g, '""')}"`;
  }
  
  return value;
}
