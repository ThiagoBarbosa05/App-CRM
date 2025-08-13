
import { saveAs } from 'file-saver';

export interface ExportData {
  [key: string]: any;
}

export function exportToCSV(data: ExportData[], filename: string) {
  try {
    if (data.length === 0) {
      throw new Error('Nenhum dado para exportar');
    }

    // Obter cabeçalhos
    const headers = Object.keys(data[0]);
    
    // Criar conteúdo CSV
    const csvContent = [
      // Cabeçalhos
      headers.join(';'),
      // Dados
      ...data.map(row => 
        headers.map(header => {
          let value = row[header];
          
          // Tratar valores nulos/undefined
          if (value === null || value === undefined) {
            value = '';
          }
          
          // Converter para string e escapar aspas
          value = String(value).replace(/"/g, '""');
          
          // Envolver em aspas se contém vírgula, ponto e vírgula, quebra de linha ou aspas
          if (value.includes(';') || value.includes(',') || value.includes('\n') || value.includes('"')) {
            value = `"${value}"`;
          }
          
          return value;
        }).join(';')
      )
    ].join('\n');

    // Adicionar BOM para UTF-8 (para compatibilidade com Excel)
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;

    // Criar blob e fazer download
    const blob = new Blob([csvWithBOM], { 
      type: 'text/csv;charset=utf-8;' 
    });
    
    saveAs(blob, `${filename}.csv`);
    
    return true;
  } catch (error) {
    console.error('Erro ao exportar para CSV:', error);
    throw new Error('Falha ao exportar dados para CSV');
  }
}

export function formatClientDataForCSV(clients: any[], users: any[] = []) {
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
