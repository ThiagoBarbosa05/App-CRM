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
    const selectedFields = (req.query.fields as string)?.split(",") || [];

    // Buscar clientes em lotes até obter todos
    const allClients: any[] = [];
    let currentPage = 1;
    let hasMore = true;
    const pageSize = 1000;

    while (hasMore) {
      const result = await clientsService.getClients({
        ...params,
        page: currentPage,
        pageSize,
      });

      allClients.push(...result.data);
      hasMore = result.hasNextPage;
      currentPage++;

      // Limite de segurança: máximo 50.000 registros (50 páginas)
      if (currentPage > 50) {
        console.warn(`[Export] Limite de 50.000 registros atingido. Exportação truncada. Total exportado: ${allClients.length}`);
        break;
      }
    }

    const clients = allClients;
    
    if (currentPage > 50) {
      console.log(`[Export] Exportação limitada a ${clients.length} registros devido ao limite de segurança.`);
    } else {
      console.log(`[Export] Exportando ${clients.length} clientes com filtros aplicados.`);
    }

    if (format === "csv") {
      // Gerar CSV com campos selecionados
      const csv = generateCSV(clients, selectedFields);
      
      // Definir headers para download de CSV
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="clientes_${new Date().toISOString().split("T")[0]}.csv"`
      );
      
      // Adicionar BOM para suportar UTF-8 no Excel e enviar CSV
      res.send("\uFEFF" + csv);
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
 * Gera CSV a partir dos dados de clientes com campos selecionados
 */
function generateCSV(clients: any[], selectedFields: string[]): string {
  if (clients.length === 0) {
    return "Nenhum cliente encontrado";
  }

  // Mapeamento de campos para labels e extração de valores
  const fieldConfig: Record<string, { label: string; getValue: (client: any) => string }> = {
    name: {
      label: "Nome",
      getValue: (client) => escapeCSV(client.name || "")
    },
    phone: {
      label: "Celular",
      getValue: (client) => escapeCSV(client.phone || "")
    },
    fixedPhone: {
      label: "Telefone Fixo",
      getValue: (client) => escapeCSV(client.fixedPhone || "")
    },
    cpf: {
      label: "CPF",
      getValue: (client) => escapeCSV(client.cpf || "")
    },
    email: {
      label: "E-mail",
      getValue: (client) => escapeCSV(client.email || "")
    },
    birthday: {
      label: "Data de Nascimento",
      getValue: (client) => client.birthday ? new Date(client.birthday).toLocaleDateString("pt-BR") : ""
    },
    cep: {
      label: "CEP",
      getValue: (client) => escapeCSV(client.cep || "")
    },
    address: {
      label: "Endereço",
      getValue: (client) => {
        const parts = [
          client.address || "",
          client.number || "",
          client.neighborhood || "",
          client.city || "",
          client.state || ""
        ].filter(Boolean);
        return escapeCSV(parts.join(" "));
      }
    },
    categoria: {
      label: "Categoria",
      getValue: (client) => escapeCSV(client.categoria || "")
    },
    origem: {
      label: "Origem",
      getValue: (client) => escapeCSV(client.origem || "")
    },
    markers: {
      label: "Marcadores",
      getValue: (client) => {
        const markers = Array.isArray(client.markers) ? client.markers.join("; ") : client.markers || "";
        return escapeCSV(markers);
      }
    },
    responsible: {
      label: "Responsável",
      getValue: (client) => escapeCSV(client.responsavelName || "")
    },
    createdAt: {
      label: "Data de Cadastro",
      getValue: (client) => client.createdAt ? new Date(client.createdAt).toLocaleDateString("pt-BR") : ""
    },
    updatedAt: {
      label: "Última Atualização",
      getValue: (client) => client.updatedAt ? new Date(client.updatedAt).toLocaleDateString("pt-BR") : ""
    }
  };

  // Se nenhum campo foi selecionado, usar todos os campos
  const fieldsToExport = selectedFields.length > 0 ? selectedFields : Object.keys(fieldConfig);

  // Gerar cabeçalhos baseados nos campos selecionados
  const headers = fieldsToExport
    .filter(field => fieldConfig[field])
    .map(field => fieldConfig[field].label);

  // Criar linhas do CSV
  const rows = clients.map((client) => {
    return fieldsToExport
      .filter(field => fieldConfig[field])
      .map(field => fieldConfig[field].getValue(client))
      .join(",");
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
