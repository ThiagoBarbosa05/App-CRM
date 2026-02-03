import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { BlingOrder } from '@/hooks/use-bling-orders';

export interface ExportData {
  [key: string]: any;
}

export function exportToExcel(data: ExportData[], filename: string, sheetName: string = 'Dados') {
  try {
    // Criar workbook e worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Configurar largura das colunas automaticamente
    const columnWidths = data.length > 0 ? Object.keys(data[0]).map(key => {
      const maxLength = Math.max(
        key.length,
        ...data.map(row => String(row[key] || '').length)
      );
      return { wch: Math.min(maxLength + 2, 50) }; // Máximo de 50 caracteres de largura
    }) : [];
    
    worksheet['!cols'] = columnWidths;

    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Gerar buffer do arquivo Excel
    const excelBuffer = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'array',
      compression: true
    });

    // Criar blob e fazer download
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    saveAs(blob, `${filename}.xlsx`);
    
    return true;
  } catch (error) {
    console.error('Erro ao exportar para Excel:', error);
    throw new Error('Falha ao exportar dados para Excel');
  }
}

export function formatClientDataForExport(clients: any[], users: any[] = []) {
  // Criar mapa de responsáveis para busca rápida
  const usersMap = users.reduce((map, user) => {
    map[user.id] = user.name;
    return map;
  }, {} as Record<string, string>);

  return clients.map(client => ({
    'Nome': client.name || '',
    'Telefone': client.phone || '',
    'CPF': client.cpf || '',
    'E-mail': client.email || '',
    'Endereço': `${client.address || ''} ${client.number || ''} ${client.neighborhood || ''} ${client.city || ''} ${client.state || ''}`.trim(),
    'CEP': client.cep || '',
    'Data de Nascimento': client.birthday ? new Date(client.birthday).toLocaleDateString('pt-BR') : '',
    'Categoria': client.categoria || '',
    'Origem': client.origem || '',
    'Marcadores': Array.isArray(client.markers) ? client.markers.join(', ') : client.markers || '',
    'Responsável': client.responsavelId ? (usersMap[client.responsavelId] || 'Usuário não encontrado') : '',
    'Data de Cadastro': client.createdAt ? new Date(client.createdAt).toLocaleDateString('pt-BR') : '',
    'Última Atualização': client.updatedAt ? new Date(client.updatedAt).toLocaleDateString('pt-BR') : ''
  }));
}

export function exportCompaniesToExcel(companies: any[], users: any[] = []) {
  try {
    // Criar mapa de responsáveis para busca rápida
    const usersMap = users.reduce((map, user) => {
      map[user.id] = user.name;
      return map;
    }, {});

    // Preparar dados das empresas para exportação
    const formattedData = companies.map(company => ({
      'Nome Fantasia': company.nomeFantasia || '',
      'Razão Social': company.razaoSocial || '',
      'CNPJ': company.cnpj || '',
      'Inscrição Estadual': company.inscricaoEstadual || '',
      'Nome do Comprador': company.nomeComprador || '',
      'Telefone': company.phone || '',
      'E-mail': company.email || '',
      'Website': company.website || '',
      'CEP': company.cep || '',
      'Endereço': company.address || '',
      'Cidade': company.city || '',
      'Estado': company.state || '',
      'Setor': company.sector?.name || '',
      'Responsável': usersMap[company.responsavelId] || '',
      'Observações': company.notes || '',
      'Status': company.active ? 'Ativo' : 'Inativo',
      'Data de Cadastro': company.createdAt ? new Date(company.createdAt).toLocaleDateString('pt-BR') : '',
      'Última Atualização': company.updatedAt ? new Date(company.updatedAt).toLocaleDateString('pt-BR') : ''
    }));

    // Exportar para Excel
    exportToExcel(formattedData, `empresas_${new Date().toISOString().split('T')[0]}`, 'Empresas');
  } catch (error) {
    console.error('Erro ao exportar empresas:', error);
    throw error;
  }
}

/**
 * Exporta pedidos do Bling para Excel com dados completos
 */
export function exportBlingOrdersToExcel(orders: BlingOrder[]) {
  try {
    // Formatar dados principais dos pedidos
    const ordersData = orders.map(order => ({
      'Número do Pedido': order.orderNumber || '',
      'ID Bling': order.blingOrderId || '',
      'Data da Venda': order.saleDate ? new Date(order.saleDate).toLocaleDateString('pt-BR') : '',
      'Cliente': order.contactName || '',
      'CPF/CNPJ': order.contactDocument || '',
      'Tipo': order.contactType || '',
      'Vendedor': order.sellerName || 'Sem vendedor',
      'Loja': order.storeId || '',
      'Situação': order.situationName || order.situationValue || order.situationId || '',
      'Valor Total': parseFloat(order.totalValue || '0'),
      'Observações': order.observations || '',
      'Obs. Internas': order.internalObservations || '',
      'Data Saída': order.departureDate ? new Date(order.departureDate).toLocaleDateString('pt-BR') : '',
      'Previsão Entrega': order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString('pt-BR') : '',
    }));

    // Criar workbook com múltiplas abas
    const workbook = XLSX.utils.book_new();

    // Aba 1: Pedidos
    const ordersSheet = XLSX.utils.json_to_sheet(ordersData);
    ordersSheet['!cols'] = [
      { wch: 15 }, // Número do Pedido
      { wch: 20 }, // ID Bling
      { wch: 12 }, // Data da Venda
      { wch: 30 }, // Cliente
      { wch: 18 }, // CPF/CNPJ
      { wch: 10 }, // Tipo
      { wch: 25 }, // Vendedor
      { wch: 10 }, // Loja
      { wch: 20 }, // Situação
      { wch: 15 }, // Valor Total
      { wch: 40 }, // Observações
      { wch: 40 }, // Obs. Internas
      { wch: 12 }, // Data Saída
      { wch: 15 }, // Previsão Entrega
    ];
    XLSX.utils.book_append_sheet(workbook, ordersSheet, 'Pedidos');

    // Aba 2: Itens (se houver pedidos com itens)
    const itemsData: any[] = [];
    orders.forEach(order => {
      if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
          itemsData.push({
            'Número do Pedido': order.orderNumber,
            'Código do Produto': item.productCode || '',
            'Descrição': item.description || '',
            'Quantidade': parseFloat(item.quantity || '0'),
            'Valor Unitário': parseFloat(item.value || '0'),
            'Desconto': parseFloat(item.discount || '0'),
            'Total Item': parseFloat(item.quantity || '0') * parseFloat(item.value || '0'),
          });
        });
      }
    });

    if (itemsData.length > 0) {
      const itemsSheet = XLSX.utils.json_to_sheet(itemsData);
      itemsSheet['!cols'] = [
        { wch: 15 }, // Número do Pedido
        { wch: 20 }, // Código do Produto
        { wch: 50 }, // Descrição
        { wch: 12 }, // Quantidade
        { wch: 15 }, // Valor Unitário
        { wch: 12 }, // Desconto
        { wch: 15 }, // Total Item
      ];
      XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Itens');
    }

    // Aba 3: Parcelas (se houver pedidos com parcelas)
    const installmentsData: any[] = [];
    orders.forEach(order => {
      if (order.installments && order.installments.length > 0) {
        order.installments.forEach(installment => {
          installmentsData.push({
            'Número do Pedido': order.orderNumber,
            'Vencimento': installment.dueDate ? new Date(installment.dueDate).toLocaleDateString('pt-BR') : '',
            'Valor': parseFloat(installment.value || '0'),
            'Observações': installment.observations || '',
          });
        });
      }
    });

    if (installmentsData.length > 0) {
      const installmentsSheet = XLSX.utils.json_to_sheet(installmentsData);
      installmentsSheet['!cols'] = [
        { wch: 15 }, // Número do Pedido
        { wch: 12 }, // Vencimento
        { wch: 15 }, // Valor
        { wch: 40 }, // Observações
      ];
      XLSX.utils.book_append_sheet(workbook, installmentsSheet, 'Parcelas');
    }

    // Gerar e fazer download
    const excelBuffer = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'array',
      compression: true
    });

    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    const filename = `vendas-bling_${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(blob, filename);
    
    return true;
  } catch (error) {
    console.error('Erro ao exportar pedidos Bling:', error);
    throw new Error('Falha ao exportar pedidos para Excel');
  }
}