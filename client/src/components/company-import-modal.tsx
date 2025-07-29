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

interface CompanyImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportResult {
  success: number;
  errors: Array<{ row: number; error: string; data?: any }>;
  total: number;
}

export default function CompanyImportModal({
  open,
  onOpenChange,
}: CompanyImportModalProps) {
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

  const importCompaniesMutation = useMutation({
    mutationFn: async (companies: any[]) => {
      const results: ImportResult = {
        success: 0,
        errors: [],
        total: companies.length,
      };

      for (let i = 0; i < companies.length; i++) {
        const company = companies[i];
        setProgress(((i + 1) / companies.length) * 100);

        try {
          // Mapear campos do Excel para formato esperado
          const companyData = {
            nomeFantasia:
              company["Nome Fantasia"] ||
              company.nomeFantasia ||
              company.name ||
              "",
            razaoSocial:
              company["Razão Social"] ||
              company.razaoSocial ||
              company["Nome Fantasia"] ||
              "",
            cnpj: company.CNPJ || company.cnpj || "",
            inscricaoEstadual:
              (company["Inscrição Estadual"] || company.inscricaoEstadual || "").toString(),
            nomeComprador:
              company["Nome do Comprador"] || company.nomeComprador || "",
            phone: company.Telefone || company.phone || "",
            email: company.Email || company.email || null,
            website: company.Website || company.website || "",
            cep: company.CEP || company.cep || "",
            address: company.Endereco || company.address || "",
            city: company.Cidade || company.city || "",
            state: company.Estado || company.state || "",
            sectorId: "", // Será mapeado posteriormente se necessário
            responsavelId: "", // Será mapeado posteriormente se necessário
            notes: company.Observacoes || company.notes || "",
            active: true,
          };

          // Validações básicas
          if (
            !companyData.nomeFantasia?.trim() ||
            !companyData.razaoSocial?.trim()
          ) {
            results.errors.push({
              row: i + 2, // +2 porque Excel começa em 1 e tem cabeçalho
              error:
                "Campos obrigatórios faltando: Nome Fantasia ou Razão Social",
              data: company,
            });
            continue;
          }

          // Limpar e formatar dados
          companyData.nomeFantasia = companyData.nomeFantasia.trim();
          companyData.razaoSocial = companyData.razaoSocial.trim();
          companyData.email = companyData.email?.trim() || "";

          const response = await apiRequest(
            "/api/companies",
            "POST",
            companyData,
          );
          results.success++;
        } catch (error: any) {
          results.errors.push({
            row: i + 2,
            error: error.message || "Erro desconhecido",
            data: company,
          });
        }
      }

      return results;
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });

      if (result.success > 0) {
        toast({
          title: "Importação concluída",
          description: `${result.success} empresas importadas com sucesso${result.errors.length > 0 ? ` (${result.errors.length} com erro)` : ""}`,
        });
      }
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha na importação das empresas",
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
    importCompaniesMutation.mutate(importData);
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
        "Nome Fantasia": "Exemplo Empresa Ltda",
        "Razão Social": "Exemplo Empresa Limitada",
        CNPJ: "12.345.678/0001-99",
        "Inscrição Estadual": "123456789",
        "Nome do Comprador": "João Silva",
        Telefone: "(11) 99999-9999",
        Email: "contato@empresa.com",
        Website: "https://www.empresa.com",
        CEP: "01234-567",
        Endereco: "Rua das Empresas, 123",
        Cidade: "São Paulo",
        Estado: "SP",
        Observacoes: "Observações sobre a empresa",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(template);
    XLSX.utils.book_append_sheet(wb, ws, "Empresas");
    XLSX.writeFile(wb, "template_empresas.xlsx");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Empresas
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6">
            <div className="text-center">
              <FileSpreadsheet className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium">
                Selecione um arquivo Excel
              </h3>
              <p className="text-gray-500">
                Faça upload de um arquivo .xlsx com os dados das empresas
              </p>
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="file-upload">Arquivo Excel (.xlsx)</Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      className="mt-1"
                    />
                  </div>

                  {file && (
                    <Alert>
                      <FileSpreadsheet className="h-4 w-4" />
                      <AlertDescription>
                        Arquivo selecionado: {file.name}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Baixar Template
              </Button>

              <div className="flex gap-2">
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
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {importData.length} empresas encontradas no arquivo. Revise os
                dados antes de importar.
              </AlertDescription>
            </Alert>

            <div className="max-h-96 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Nome Fantasia</th>
                    <th className="px-3 py-2 text-left">Razão Social</th>
                    <th className="px-3 py-2 text-left">CNPJ</th>
                    <th className="px-3 py-2 text-left">Telefone</th>
                    <th className="px-3 py-2 text-left">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {importData.slice(0, 10).map((company, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-3 py-2">
                        {company["Nome Fantasia"] ||
                          company.nomeFantasia ||
                          "N/A"}
                      </td>
                      <td className="px-3 py-2">
                        {company["Razão Social"] ||
                          company.razaoSocial ||
                          "N/A"}
                      </td>
                      <td className="px-3 py-2">
                        {company.CNPJ || company.cnpj || "N/A"}
                      </td>
                      <td className="px-3 py-2">
                        {company.Telefone || company.phone || "N/A"}
                      </td>
                      <td className="px-3 py-2">
                        {company.Email || company.email || "N/A"}
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
                Importar {importData.length} Empresas
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <h3 className="text-lg font-medium">Importando empresas...</h3>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {importResult.success}
                  </div>
                  <div className="text-sm text-gray-500">
                    Importadas com sucesso
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {importResult.errors.length}
                  </div>
                  <div className="text-sm text-gray-500">Com erro</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {importResult.total}
                  </div>
                  <div className="text-sm text-gray-500">Total processadas</div>
                </CardContent>
              </Card>
            </div>

            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Erros encontrados:</h4>
                <div className="max-h-48 overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left">Linha</th>
                        <th className="px-3 py-2 text-left">Erro</th>
                        <th className="px-3 py-2 text-left">Dados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.errors.map((error, index) => (
                        <tr key={index} className="border-t">
                          <td className="px-3 py-2">{error.row}</td>
                          <td className="px-3 py-2 text-red-600">
                            {error.error}
                          </td>
                          <td className="px-3 py-2 text-xs font-mono">
                            {JSON.stringify(error.data, null, 2).substring(
                              0,
                              100,
                            )}
                            ...
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
