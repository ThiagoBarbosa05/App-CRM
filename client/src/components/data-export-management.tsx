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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  Database,
  Users,
  FileSpreadsheet,
  FileText,
  Settings,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportToExcel } from "@/lib/excel-export";
import { exportToCSV } from "@/lib/csv-export";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

const AVAILABLE_CLIENT_FIELDS = [
  { key: "name", label: "Nome", defaultChecked: true },
  { key: "phone", label: "Celular", defaultChecked: true },
  { key: "fixedPhone", label: "Telefone Fixo", defaultChecked: true },
  { key: "cpf", label: "CPF", defaultChecked: true },
  { key: "email", label: "E-mail", defaultChecked: true },
  { key: "address", label: "Endereço", defaultChecked: true },
  { key: "cep", label: "CEP", defaultChecked: false },
  { key: "birthday", label: "Data de Nascimento", defaultChecked: false },
  { key: "categoria", label: "Categoria", defaultChecked: true },
  { key: "origem", label: "Origem", defaultChecked: true },
  { key: "markers", label: "Marcadores", defaultChecked: false },
  { key: "responsible", label: "Responsável", defaultChecked: true },
  { key: "createdAt", label: "Data de Cadastro", defaultChecked: false },
  { key: "updatedAt", label: "Última Atualização", defaultChecked: false },
];

export default function DataExportManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedFields, setSelectedFields] = useState<string[]>(
    AVAILABLE_CLIENT_FIELDS.filter((field) => field.defaultChecked).map(
      (field) => field.key
    )
  );
  const [exportFormat, setExportFormat] = useState<"excel" | "csv">("excel");
  const [isExporting, setIsExporting] = useState(false);
  const [includeCountryCode, setIncludeCountryCode] = useState(false);

  // Buscar todos os clientes para exportação (sem filtros)
  const { data: clients = [], isLoading: loadingClients } = useQuery<any[]>({
    queryKey: ["/api/clients/export-all"],
    queryFn: () =>
      fetch("/api/clients/export-all", {
        headers: {
        },
      }).then((res) => res.json()),
    enabled: !!user,
  });

  // Buscar usuários
  const { data: users = [], isLoading: loadingUsers } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: true,
  });

  const isLoading = loadingClients || loadingUsers;

  const toggleField = (fieldKey: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldKey)
        ? prev.filter((key) => key !== fieldKey)
        : [...prev, fieldKey]
    );
  };

  const selectAll = () => {
    setSelectedFields(AVAILABLE_CLIENT_FIELDS.map((field) => field.key));
  };

  const deselectAll = () => {
    setSelectedFields([]);
  };

  const formatClientData = (clientsList: any[]) => {
    // Criar mapa de responsáveis para busca rápida
    const usersMap = (Array.isArray(users) ? users : []).reduce(
      (map: Record<string, string>, user: any) => {
        map[user.id] = user.name;
        return map;
      },
      {} as Record<string, string>
    );

    return clientsList.map((client) => {
      const formattedData: any = {};

      selectedFields.forEach((fieldKey) => {
        switch (fieldKey) {
          case "name":
            formattedData["Nome"] = client.name || "";
            break;
          case "phone":
            formattedData["Celular"] = client.phone
              ? includeCountryCode && !client.phone.startsWith("+55")
                ? `+55${client.phone}`
                : client.phone
              : "";
            break;
          case "fixedPhone":
            formattedData["Telefone Fixo"] = client.fixedPhone || "";
            break;
          case "cpf":
            formattedData["CPF"] = client.cpf || "";
            break;
          case "email":
            formattedData["E-mail"] = client.email || "";
            break;
          case "address":
            formattedData["Endereço"] = `${client.address || ""} ${
              client.number || ""
            } ${client.neighborhood || ""} ${client.city || ""} ${
              client.state || ""
            }`.trim();
            break;
          case "cep":
            formattedData["CEP"] = client.cep || "";
            break;
          case "birthday":
            formattedData["Data de Nascimento"] = client.birthday
              ? new Date(client.birthday).toLocaleDateString("pt-BR")
              : "";
            break;
          case "categoria":
            formattedData["Categoria"] = client.categoria || "";
            break;
          case "origem":
            formattedData["Origem"] = client.origem || "";
            break;
          case "markers":
            formattedData["Marcadores"] = Array.isArray(client.markers)
              ? client.markers.join(", ")
              : client.markers || "";
            break;
          case "responsible":
            formattedData["Responsável"] = client.responsavelId
              ? usersMap[client.responsavelId] || "Usuário não encontrado"
              : "";
            break;
          case "createdAt":
            formattedData["Data de Cadastro"] = client.createdAt
              ? new Date(client.createdAt).toLocaleDateString("pt-BR")
              : "";
            break;
          case "updatedAt":
            formattedData["Última Atualização"] = client.updatedAt
              ? new Date(client.updatedAt).toLocaleDateString("pt-BR")
              : "";
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

    const clientsArray = Array.isArray(clients) ? clients : [];
    if (clientsArray.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há clientes cadastrados para exportar",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const formattedData = formatClientData(clientsArray);
      const fileName = `clientes_${new Date()
        .toLocaleDateString("pt-BR")
        .replace(/\//g, "-")}_${new Date()
        .toLocaleTimeString("pt-BR")
        .replace(/:/g, "-")}`;

      if (exportFormat === "excel") {
        await exportToExcel(formattedData, fileName, "Clientes");
      } else {
        await exportToCSV(formattedData, fileName);
      }

      toast({
        title: "Exportação concluída",
        description: `${
          clientsArray.length
        } clientes foram exportados com sucesso em formato ${exportFormat.toUpperCase()}`,
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-slate-800">
        <div className="p-4 lg:p-6">
          {/* Header com gradiente blue/indigo */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 mb-6 shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-white">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <Database className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                  Exportação de Dados
                </h1>
                <p className="text-blue-100 text-sm lg:text-base">
                  Carregando dados para exportação...
                </p>
              </div>
            </div>
          </div>

          {/* Skeleton Loading */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full max-w-md" />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-5 w-40" />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <Skeleton key={index} className="h-6 w-full" />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-slate-800">
      <div className="p-4 lg:p-6">
        {/* Header com gradiente blue/indigo */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 mb-6 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-white">
            <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
              <Database className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                Exportação de Dados
              </h1>
              <p className="text-blue-100 text-sm lg:text-base">
                Exporte todos os dados cadastrados no sistema em diferentes
                formatos
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-lg backdrop-blur-sm">
              <Users className="h-5 w-5" />
              <div className="text-sm">
                <span className="font-semibold">
                  {Array.isArray(clients) ? clients.length : 0}
                </span>
                <span className="text-blue-100 ml-1">registros</span>
              </div>
            </div>
          </div>
        </div>

        <Card className="shadow-lg border-slate-200 dark:border-slate-700 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 border-b border-slate-200 dark:border-slate-600">
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              Base de Clientes
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Configure e exporte os dados dos seus clientes
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            {/* Formato de Exportação */}
            <div className="space-y-4">
              <Label className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Formato de Exportação
              </Label>
              <RadioGroup
                value={exportFormat}
                onValueChange={(value: "excel" | "csv") =>
                  setExportFormat(value)
                }
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                <div className="flex items-center space-x-3 p-4 border-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-slate-200 dark:border-slate-600 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:has-[:checked]:bg-blue-900/20">
                  <RadioGroupItem
                    value="excel"
                    id="excel"
                    className="border-blue-500 text-blue-600"
                  />
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                    <Label
                      htmlFor="excel"
                      className="font-medium text-slate-900 dark:text-slate-100 cursor-pointer"
                    >
                      Excel (.xlsx)
                    </Label>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-4 border-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-slate-200 dark:border-slate-600 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:has-[:checked]:bg-blue-900/20">
                  <RadioGroupItem
                    value="csv"
                    id="csv"
                    className="border-blue-500 text-blue-600"
                  />
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <Label
                      htmlFor="csv"
                      className="font-medium text-slate-900 dark:text-slate-100 cursor-pointer"
                    >
                      CSV (.csv)
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Opções Adicionais */}
            <div className="space-y-4">
              <Label className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Opções Adicionais
              </Label>
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="countryCode"
                    checked={includeCountryCode}
                    onCheckedChange={(checked) =>
                      setIncludeCountryCode(checked === true)
                    }
                    className="border-blue-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <Label
                    htmlFor="countryCode"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Incluir código do país (+55) nos telefones
                  </Label>
                </div>
              </div>
            </div>

            {/* Formato de Exportação */}
            <div className="space-y-3">
              <Label className="text-base font-medium">
                Formato de Exportação
              </Label>
              <RadioGroup
                value={exportFormat}
                onValueChange={(value: "excel" | "csv") =>
                  setExportFormat(value)
                }
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

            {/* Opções Adicionais */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Opções Adicionais</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="countryCode"
                  checked={includeCountryCode}
                  onCheckedChange={(checked) =>
                    setIncludeCountryCode(checked === true)
                  }
                />
                <Label htmlFor="countryCode" className="text-sm">
                  Incluir código do país (+55) nos telefones
                </Label>
              </div>
            </div>

            {/* Seleção de Campos */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <Label className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Campos para Exportação
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAll}
                    className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 dark:border-blue-600 dark:text-blue-300 dark:hover:bg-blue-900/20"
                  >
                    Selecionar Todos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAll}
                    className="border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Desmarcar Todos
                  </Button>
                </div>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-800 dark:to-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
                  {AVAILABLE_CLIENT_FIELDS.map((field) => (
                    <div
                      key={field.key}
                      className="flex items-center space-x-3 p-3 rounded-lg hover:bg-white dark:hover:bg-slate-600 transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-700"
                    >
                      <Checkbox
                        id={field.key}
                        checked={selectedFields.includes(field.key)}
                        onCheckedChange={() => toggleField(field.key)}
                        className="border-blue-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                      <Label
                        htmlFor={field.key}
                        className="text-sm cursor-pointer flex-1 font-medium text-slate-700 dark:text-slate-300"
                      >
                        {field.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    {selectedFields.length} campos selecionados
                  </span>
                </div>
                {selectedFields.length === 0 && (
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    Selecione pelo menos um campo
                  </span>
                )}
              </div>
            </div>

            {/* Botão de Exportação */}
            <div className="flex flex-col sm:flex-row justify-end gap-4 pt-6 border-t border-slate-200 dark:border-slate-600">
              <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                <Database className="h-4 w-4 mr-2" />
                Pronto para exportar{" "}
                {Array.isArray(clients) ? clients.length : 0} registros
              </div>
              <Button
                onClick={handleExport}
                disabled={
                  isExporting ||
                  selectedFields.length === 0 ||
                  !Array.isArray(clients) ||
                  clients.length === 0
                }
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                size="lg"
              >
                {isExporting ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Exportando...
                  </div>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar em {exportFormat.toUpperCase()}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
