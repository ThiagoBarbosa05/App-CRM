import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

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

export function formatClientDataForExport(clients: any[]) {
  return clients.map(client => ({
    'Nome': client.name || '',
    'Telefone': client.phone || '',
    'CPF': client.cpf || '',
    'E-mail': client.email || '',
    'Endereço': `${client.address || ''} ${client.addressNumber || ''} ${client.neighborhood || ''} ${client.city || ''} ${client.state || ''}`.trim(),
    'CEP': client.cep || '',
    'Data de Nascimento': client.birthday ? new Date(client.birthday).toLocaleDateString('pt-BR') : '',
    'Categoria': client.categoria || '',
    'Origem': client.origem || '',
    'Marcadores': client.markers || '',
    'Responsável': client.responsible || '',
    'Data de Cadastro': client.createdAt ? new Date(client.createdAt).toLocaleDateString('pt-BR') : '',
    'Última Atualização': client.updatedAt ? new Date(client.updatedAt).toLocaleDateString('pt-BR') : ''
  }));
}