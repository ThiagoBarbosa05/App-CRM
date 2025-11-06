
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClientExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: any[];
  selectedClients: any[];
  users?: any[];
  filters?: any;
  searchQuery?: string;
  userId?: string;
  userRole?: string;
}

const AVAILABLE_FIELDS = [
  { key: 'name', label: 'Nome', defaultChecked: true },
  { key: 'phone', label: 'Celular', defaultChecked: true },
  { key: 'fixedPhone', label: 'Telefone Fixo', defaultChecked: true },
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

export default function ClientExportModal({ 
  open, 
  onOpenChange, 
  clients, 
  selectedClients,
  users = [],
  filters = {},
  searchQuery = "",
  userId,
  userRole
}: ClientExportModalProps) {
  const { toast } = useToast();
  const [selectedFields, setSelectedFields] = useState<string[]>(
    AVAILABLE_FIELDS.filter(field => field.defaultChecked).map(field => field.key)
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "excel">("csv");

  const toggleField = (fieldKey: string) => {
    setSelectedFields(prev => 
      prev.includes(fieldKey)
        ? prev.filter(key => key !== fieldKey)
        : [...prev, fieldKey]
    );
  };

  const formatSelectedClientData = (clientsList: any[]) => {
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
            formattedData['Celular'] = client.phone || '';
            break;
          case 'fixedPhone':
            formattedData['Telefone Fixo'] = client.fixedPhone || '';
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

    setIsExporting(true);
    try {
      // Se houver clientes selecionados, exportar apenas eles
      if (selectedClients.length > 0) {
        const formattedData = formatSelectedClientData(selectedClients);
        
        if (exportFormat === "csv") {
          const { exportToCSV } = await import("@/lib/csv-export");
          await exportToCSV(formattedData, `clientes_selecionados_${new Date().toISOString().split('T')[0]}`);
        } else {
          const { exportToExcel } = await import("@/lib/excel-export");
          await exportToExcel(formattedData, `clientes_selecionados_${new Date().toISOString().split('T')[0]}`);
        }

        toast({
          title: "Exportação concluída",
          description: `${selectedClients.length} clientes selecionados foram exportados com sucesso`,
        });
      } else {
        // Exportar com filtros aplicados usando o endpoint do backend
        const params = new URLSearchParams();
        params.append("format", exportFormat);
        
        // Adicionar userId e userRole para autorização (se não for admin)
        if (userRole !== "admin" && userId) {
          params.append("userId", userId);
        }
        if (userRole !== "admin" && userRole) {
          params.append("userRole", userRole);
        }
        
        // Adicionar busca
        if (searchQuery) {
          params.append("search", searchQuery);
        }
        
        // Adicionar campos selecionados
        params.append("fields", selectedFields.join(","));
        
        // Adicionar demais filtros
        Object.entries(filters).forEach(([key, value]) => {
          if (value && value !== "all") {
            params.append(key, String(value));
          }
        });

        const response = await fetch(`/api/clients/export?${params.toString()}`);
        if (!response.ok) throw new Error("Erro ao exportar");
        
        if (exportFormat === "csv") {
          // CSV: download direto do backend
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          toast({
            title: "Exportação concluída",
            description: "Os clientes foram exportados em CSV com sucesso",
          });
        } else {
          // Excel: buscar dados e exportar no frontend
          const clientsData = await response.json();
          const formattedData = formatSelectedClientData(clientsData);
          
          const { exportToExcel } = await import("@/lib/excel-export");
          await exportToExcel(formattedData, `clientes_${new Date().toISOString().split('T')[0]}`);

          toast({
            title: "Exportação concluída",
            description: `${clientsData.length} clientes foram exportados em Excel com sucesso`,
          });
        }
      }
      
      onOpenChange(false);
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

  const selectAll = () => {
    setSelectedFields(AVAILABLE_FIELDS.map(field => field.key));
  };

  const deselectAll = () => {
    setSelectedFields([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Selecionar Campos para Exportação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="format">Formato de exportação</Label>
            <Select value={exportFormat} onValueChange={(value: "csv" | "excel") => setExportFormat(value)}>
              <SelectTrigger id="format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV (separado por vírgula)</SelectItem>
                <SelectItem value="excel">Excel (XLSX)</SelectItem>
              </SelectContent>
            </Select>
          </div>

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

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {AVAILABLE_FIELDS.map(field => (
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

          <div className="flex justify-between items-center pt-4 border-t">
            <span className="text-sm text-gray-600">
              {selectedFields.length} campos selecionados
            </span>
            <Button 
              onClick={handleExport} 
              disabled={isExporting || selectedFields.length === 0}
              className="bg-primary hover:bg-primary-dark"
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? "Exportando..." : "Exportar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
