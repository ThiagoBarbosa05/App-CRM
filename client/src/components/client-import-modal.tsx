import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import * as XLSX from "xlsx";

interface ClientImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportResult {
  success: number;
  errors: Array<{ row: number; error: string; data?: any }>;
  total: number;
}

export default function ClientImportModal({
  open,
  onOpenChange,
}: ClientImportModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<
    "upload" | "preview" | "importing" | "result"
  >("upload");
  const [progress, setProgress] = useState(0);

  const processFileMutation = useMutation({
    mutationFn: async (file: File) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            resolve(jsonData);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
    },
    onSuccess: (data: any) => {
      setImportData(data);
      setStep("preview");
    },
    onError: () => {
      toast({
        title: "Erro",
        description:
          "Falha ao processar o arquivo. Verifique se é um arquivo Excel válido.",
        variant: "destructive",
      });
    },
  });

  const importClientsMutation = useMutation({
    mutationFn: async (clients: any[]) => {
      const results: ImportResult = {
        success: 0,
        errors: [],
        total: clients.length,
      };

      // Buscar lista de usuários, categorias e origens para mapear nomes para IDs
      const [usersResponse, categoriesResponse, originsResponse] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/categories"),
        fetch("/api/origins")
      ]);
      
      const users = usersResponse.ok ? await usersResponse.json() : [];
      const categories = categoriesResponse.ok ? await categoriesResponse.json() : [];
      const origins = originsResponse.ok ? await originsResponse.json() : [];
      
      // Criar mapas de nomes para IDs (case insensitive)
      const userMap = new Map();
      const categoryMap = new Map();
      const originMap = new Map();
      
      users.forEach((user: any) => {
        userMap.set(user.name.toLowerCase().trim(), user.id);
      });
      
      categories.forEach((category: any) => {
        categoryMap.set(category.name.toLowerCase().trim(), category.id);
      });
      
      origins.forEach((origin: any) => {
        originMap.set(origin.name.toLowerCase().trim(), origin.id);
      });

      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        setProgress(((i + 1) / clients.length) * 100);

        try {
          // Mapear responsável por nome para ID
          let responsavelId = null;
          const responsavelName = client.Responsavel || client["Responsável"] || client.responsible;
          console.log(`Linha ${i + 1}: Responsavel original:`, responsavelName);
          
          if (responsavelName && typeof responsavelName === 'string') {
            const cleanName = responsavelName.toLowerCase().trim();
            const foundUserId = userMap.get(cleanName);
            responsavelId = foundUserId || null;
            console.log(`Linha ${i + 1}: Responsavel '${responsavelName}' -> '${cleanName}' -> ${foundUserId ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);
            console.log(`Available users:`, Array.from(userMap.keys()));
          }

          // Mapear categoria por nome (usando o nome da categoria diretamente)
          let categoria = "Regular";
          const categoriaName = client.Categoria || client.categoria;
          if (categoriaName && typeof categoriaName === 'string') {
            const foundCategory = categories.find(cat => 
              cat.name.toLowerCase().trim() === categoriaName.toLowerCase().trim()
            );
            categoria = foundCategory ? foundCategory.name : categoriaName;
          }

          // Mapear origem por nome (usando o nome da origem diretamente)
          let origem = "Importação";
          const origemName = client.Origem || client.origem;
          if (origemName && typeof origemName === 'string') {
            const foundOrigin = origins.find(orig => 
              orig.name.toLowerCase().trim() === origemName.toLowerCase().trim()
            );
            origem = foundOrigin ? foundOrigin.name : origemName;
          }

          // Formatar data de aniversário
          let formattedBirthday = "01/01/1990";
          const birthdayValue = client.Aniversario || client["Aniversário"] || client.birthday;
          console.log(`Linha ${i + 1}: Aniversario original:`, birthdayValue, typeof birthdayValue);
          
          if (birthdayValue) {
            // Se for um número (data do Excel), converter
            if (typeof birthdayValue === 'number') {
              const excelDate = new Date((birthdayValue - 25569) * 86400 * 1000);
              formattedBirthday = excelDate.toLocaleDateString('pt-BR');
              console.log(`Linha ${i + 1}: Data convertida do Excel: ${birthdayValue} -> ${formattedBirthday}`);
            } else if (typeof birthdayValue === 'string') {
              formattedBirthday = birthdayValue.trim();
              console.log(`Linha ${i + 1}: Data como string: ${birthdayValue} -> ${formattedBirthday}`);
            }
          } else {
            console.log(`Linha ${i + 1}: Aniversario não encontrado, usando padrão: ${formattedBirthday}`);
          }

          // Mapear campos do Excel para formato esperado
          const clientData = {
            name: client.Nome || client.name || "",
            phone: (client.Telefone || client.phone || "").toString(),
            cpf: (client.CPF || client.cpf || "").toString(),
            email: client.Email || client.email || null,
            birthday: formattedBirthday,
            cep: client.CEP || client.cep || "00000-000",
            address: client.Endereco || client.address || "Não informado",
            number: (client.Numero || client.number || "S/N").toString(),
            neighborhood: client.Bairro || client.neighborhood || "Não informado",
            city: client.Cidade || client.city || "Não informado",
            state: client.Estado || client.state || "SP",
            categoria: categoria,
            origem: origem,
            markers: client.Marcadores
              ? Array.isArray(client.Marcadores)
                ? client.Marcadores
                : [client.Marcadores.toString()]
              : [],
            responsavelId: responsavelId,
          };

          // Validações básicas
          if (
            !clientData.name?.trim() ||
            !clientData.phone?.trim() ||
            !clientData.cpf?.trim()
          ) {
            results.errors.push({
              row: i + 2, // +2 porque Excel começa em 1 e tem cabeçalho
              error: "Campos obrigatórios faltando: Nome, Telefone ou CPF",
              data: client,
            });
            continue;
          }

          // Limpar e formatar dados
          clientData.name = clientData.name.trim();
          clientData.phone = clientData.phone.trim();
          clientData.cpf = clientData.cpf.trim();
          clientData.email = clientData.email?.trim() || null;

          await apiRequest("/api/clients", "POST", clientData);
          results.success++;
        } catch (error: any) {
          let errorMessage = "Erro desconhecido";

          if (error.message) {
            if (error.message.includes("CPF já cadastrado")) {
              errorMessage = `CPF ${client.CPF || client.cpf || "não informado"} já existe no sistema`;
            } else if (error.message.includes("Telefone já cadastrado")) {
              errorMessage = `Telefone ${client.Telefone || client.phone || "não informado"} já existe no sistema`;
            } else if (error.message.includes("400:")) {
              errorMessage = error.message.replace("400: ", "");
            } else {
              errorMessage = error.message;
            }
          }

          results.errors.push({
            row: i + 2,
            error: errorMessage,
            data: client,
          });
        }
      }

      return results;
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });

      if (result.success > 0) {
        toast({
          title: "Importação concluída",
          description: `${result.success} clientes importados com sucesso${result.errors.length > 0 ? ` (${result.errors.length} com erro)` : ""}`,
        });
      }
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha na importação dos clientes",
        variant: "destructive",
      });
      setStep("preview");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = () => {
    if (file) {
      processFileMutation.mutate(file);
    }
  };

  const handleImport = () => {
    setStep("importing");
    setProgress(0);
    importClientsMutation.mutate(importData);
  };

  const handleClose = () => {
    setFile(null);
    setImportData([]);
    setImportResult(null);
    setStep("upload");
    setProgress(0);
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const template = [
      {
        Nome: "João Silva",
        Telefone: "(11) 99999-9999",
        CPF: "123.456.789-01",
        Email: "joao@email.com",
        Aniversario: "1990-01-15",
        CEP: "01234-567",
        Endereco: "Rua das Flores",
        Numero: "123",
        Bairro: "Centro",
        Cidade: "São Paulo",
        Estado: "SP",
        Categoria: "Premium",
        Origem: "Site",
        Marcadores: "VIP",
        Responsavel: "admin@vinocrm.com",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(template);
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, "template_clientes.xlsx");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Clientes
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Faça upload de um arquivo Excel (.xlsx) com os dados dos
                clientes.
                <Button
                  variant="link"
                  onClick={downloadTemplate}
                  className="p-0 h-auto ml-1"
                >
                  Baixar modelo
                </Button>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="file">Arquivo Excel</Label>
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                ref={fileInputRef}
              />
            </div>

            {file && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!file || processFileMutation.isPending}
              >
                {processFileMutation.isPending
                  ? "Processando..."
                  : "Processar Arquivo"}
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {importData.length} registros encontrados. Revise os dados antes
                de importar.
              </AlertDescription>
            </Alert>

            <div className="max-h-96 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Nome</th>
                    <th className="px-3 py-2 text-left">Telefone</th>
                    <th className="px-3 py-2 text-left">CPF</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Categoria</th>
                  </tr>
                </thead>
                <tbody>
                  {importData.slice(0, 10).map((client, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-3 py-2">
                        {client.Nome || client.name || "N/A"}
                      </td>
                      <td className="px-3 py-2">
                        {client.Telefone || client.phone || "N/A"}
                      </td>
                      <td className="px-3 py-2">
                        {client.CPF || client.cpf || "N/A"}
                      </td>
                      <td className="px-3 py-2">
                        {client.Email || client.email || "N/A"}
                      </td>
                      <td className="px-3 py-2">
                        {client.Categoria || client.categoria || "Regular"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importData.length > 10 && (
                <div className="p-3 text-center text-gray-500 border-t">
                  ... e mais {importData.length - 10} registros
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Voltar
              </Button>
              <Button onClick={handleImport}>
                Importar {importData.length} Clientes
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <h3 className="text-lg font-medium">Importando clientes...</h3>
              <p className="text-gray-500">
                Processando {importData.length} registros
              </p>
            </div>

            <Progress value={progress} className="w-full" />

            <p className="text-center text-sm text-gray-500">
              {Math.round(progress)}% concluído
            </p>
          </div>
        )}

        {step === "result" && importResult && (
          <div className="space-y-4">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium">Importação Concluída</h3>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-green-600">
                    {importResult.success}
                  </div>
                  <p className="text-sm text-gray-500">Sucessos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-red-600">
                    {importResult.errors.length}
                  </div>
                  <p className="text-sm text-gray-500">Erros</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {importResult.total}
                  </div>
                  <p className="text-sm text-gray-500">Total</p>
                </CardContent>
              </Card>
            </div>

            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-red-600">Erros encontrados:</h4>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {importResult.errors.map((error, index) => (
                    <Alert key={index} variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Linha {error.row}:</strong> {error.error}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
