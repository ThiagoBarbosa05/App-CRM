
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Download, Database, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportToExcel } from "@/lib/excel-export";
import { exportToCSV } from "@/lib/csv-export";
import { apiRequest } from "@/lib/queryClient";

const AVAILABLE_CLIENT_FIELDS = [
  { key: 'name', label: 'Nome', defaultChecked: true },
  { key: 'phone', label: 'Telefone', defaultChecked: true },
  { key: 'cpf', label: 'CPF', defaultChecked: true },
  { key: 'email', label: 'E-mail', defaultChecked: true },
  { key: 'address', label: 'Endereço', defaultChecked: true },
  { key: 'cep', label: 'CEP', defaultChecked: false },
  { key: 'birthday', label: 'Data de Nascimento', defaultChecked: false },
  { key: 'categoria', label: 'Categoria', defaultChecked: true },
  { key: 'origem', label: 'Origem', defaultChecked: true },
  { key: 'markers', label: 'Marcadores', defaultChecked: false },
  { key: 'responsible', label: 'Responsável', defaultChecked: true },
  { key: 'createdAt', label: 'Data de Cadastro', defaultChecked: false },
  { key: 'updatedAt', label: 'Última Atualização', defaultChecked: false }
];

export default function DataExportManagement() {
  const { toast } = useToast();
  const [selectedFields, setSelectedFields] = useState<string[]>(
    AVAILABLE_CLIENT_FIELDS.filter(field => field.defaultChecked).map(field => field.key)
  );
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel');
  const [isExporting, setIsExporting] = useState(false);

  // Buscar clientes
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("/api/clients"),
  });

  // Buscar usuários
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("/api/users"),
  });

  const toggleField = (fieldKey: string) => {
    setSelectedFields(prev => 
      prev.includes(fieldKey)
        ? prev.filter(key => key !== fieldKey)
        : [...prev, fieldKey]
    );
  };

  const selectAll = () => {
    setSelectedFields(AVAILABLE_CLIENT_FIELDS.map(field => field.key));
  };

  const deselectAll = () => {
    setSelectedFields([]);
  };

  const formatClientData = (clientsList: any[]) => {
    // Criar mapa de responsáveis para busca rápida
    const usersMap = users.reduce((map, user) => {
      map[user.id] = user.name;
      return map;
    }, {} as Record<string, string>);

    return clientsList.map(client => {
      const formattedData: any = {};
      
      selectedFields.forEach(fieldKey => {
        switch (fieldKey) {
          case 'name':
            formattedData['Nome'] = client.name || '';
            break;
          case 'phone':
            formattedData['Telefone'] = client.phone || '';
            break;
          case 'cpf':
            formattedData['CPF'] = client.cpf || '';
            break;
          case 'email':
            formattedData['E-mail'] = client.email || '';
            break;
          case 'address':
            formattedData['Endereço'] = `${client.address || ''} ${client.number || ''} ${client.neighborhood || ''} ${client.city || ''} ${client.state || ''}`.trim();
            break;
          case 'cep':
            formattedData['CEP'] = client.cep || '';
            break;
          case 'birthday':
            formattedData['Data de Nascimento'] = client.birthday ? new Date(client.birthday).toLocaleDateString('pt-BR') : '';
            break;
          case 'categoria':
            formattedData['Categoria'] = client.categoria || '';
            break;
          case 'origem':
            formattedData['Origem'] = client.origem || '';
            break;
          case 'markers':
            formattedData['Marcadores'] = Array.isArray(client.markers) ? client.markers.join(', ') : client.markers || '';
            break;
          case 'responsible':
            formattedData['Responsável'] = client.responsavelId ? (usersMap[client.responsavelId] || 'Usuário não encontrado') : '';
            break;
          case 'createdAt':
            formattedData['Data de Cadastro'] = client.createdAt ? new Date(client.createdAt).toLocaleDateString('pt-BR') : '';
            break;
          case 'updatedAt':
            formattedData['Última Atualização'] = client.updatedAt ? new Date(client.updatedAt).toLocaleDateString('pt-BR') : '';
            break;
        }
      });
      
      return formattedData;
    });
  };

  const handleExport = async () => {
    if (selectedFields.length === 0) {
      toast({
        title: "Nenhum campo selecionado",
        description: "Selecione pelo menos um campo para exportar",
        variant: "destructive",
      });
      return;
    }

    if (!clients || clients.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há clientes cadastrados para exportar",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const formattedData = formatClientData(clients);
      const fileName = `clientes_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}_${new Date().toLocaleTimeString('pt-BR').replace(/:/g, '-')}`;

      if (exportFormat === 'excel') {
        await exportToExcel(formattedData, fileName, 'Clientes');
      } else {
        await exportToCSV(formattedData, fileName);
      }

      toast({
        title: "Exportação concluída",
        description: `${clients.length} clientes foram exportados com sucesso em formato ${exportFormat.toUpperCase()}`,
      });
    } catch (error) {
      console.error("Erro na exportação:", error);
      toast({
        title: "Erro na exportação",
        description: "Ocorreu um erro ao exportar os dados dos clientes",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Exportação de Dados
          </CardTitle>
          <CardDescription>
            Exporte todos os dados cadastrados no sistema em diferentes formatos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Seção Clientes */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Base de Clientes</h3>
              <span className="text-sm text-gray-500">({clients.length} registros)</span>
            </div>

            {/* Formato de Exportação */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Formato de Exportação</Label>
              <RadioGroup 
                value={exportFormat} 
                onValueChange={(value) => setExportFormat(value as 'excel' | 'csv')}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="excel" id="excel" />
                  <Label htmlFor="excel">Excel (.xlsx)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="csv" />
                  <Label htmlFor="csv">CSV (.csv)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Seleção de Campos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Campos para Exportação</Label>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={selectAll}
                    className="text-xs"
                  >
                    Selecionar Todos
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={deselectAll}
                    className="text-xs"
                  >
                    Desmarcar Todos
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto p-4 border rounded-lg bg-gray-50">
                {AVAILABLE_CLIENT_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={field.key}
                      checked={selectedFields.includes(field.key)}
                      onCheckedChange={() => toggleField(field.key)}
                    />
                    <Label 
                      htmlFor={field.key} 
                      className="text-sm cursor-pointer flex-1"
                    >
                      {field.label}
                    </Label>
                  </div>
                ))}
              </div>

              <div className="text-sm text-gray-600">
                {selectedFields.length} campos selecionados
              </div>
            </div>

            {/* Botão de Exportação */}
            <div className="flex justify-end pt-4">
              <Button 
                onClick={handleExport} 
                disabled={isExporting || selectedFields.length === 0 || clients.length === 0}
                className="bg-primary hover:bg-primary-dark"
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? "Exportando..." : `Exportar em ${exportFormat.toUpperCase()}`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
