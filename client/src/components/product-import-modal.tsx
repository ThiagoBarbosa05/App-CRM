import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Download,
  Settings,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import * as XLSX from "xlsx";

interface ProductImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportResult {
  success: number;
  errors: Array<{ row: number; error: string; data?: any }>;
  total: number;
}

export default function ProductImportModal({
  open,
  onOpenChange,
}: ProductImportModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: countries = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/tags/countries"],
    staleTime: 5 * 60 * 1000,
  });

  const [file, setFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<
    "upload" | "preview" | "field-mapping" | "importing" | "result"
  >("upload");
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>(
    {},
  );
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

      // Detectar campos disponíveis automaticamente e marcar os principais como selecionados
      if (data.length > 0) {
        const availableFields = Object.keys(data[0]);
        const initialFieldSelection: Record<string, boolean> = {};

        availableFields.forEach((field) => {
          const fieldLower = field.toLowerCase();
          // Marcar campos essenciais como selecionados por padrão
          initialFieldSelection[field] =
            fieldLower.includes("nome") ||
            fieldLower.includes("name") ||
            fieldLower.includes("vinho") ||
            fieldLower.includes("país") ||
            fieldLower.includes("pais") ||
            fieldLower.includes("country") ||
            fieldLower.includes("volume") ||
            fieldLower.includes("tipo") ||
            fieldLower.includes("type") ||
            fieldLower.includes("valor") ||
            fieldLower.includes("price") ||
            fieldLower.includes("preço");
        });

        setSelectedFields(initialFieldSelection);
      }

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

  const importProductsMutation = useMutation({
    mutationFn: async (products: any[]) => {
      const results: ImportResult = {
        success: 0,
        errors: [],
        total: products.length,
      };

      const validCountries = countries.map((c) => c.name.toUpperCase());

      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        setProgress(((i + 1) / products.length) * 100);

        try {
          // Extrair e validar dados do produto
          const name =
            product["Nome do Vinho"] ||
            product.nome ||
            product.name ||
            product["Nome"];
          if (!name || !String(name).trim()) {
            results.errors.push({
              row: i + 2,
              error: "Nome do produto é obrigatório",
              data: product,
            });
            continue;
          }

          const country = String(
            product["País"] || product.pais || product.country || "BRASIL",
          ).toUpperCase();
          const volume = String(product["Volume"] || product.volume || "750ml");
          const type = String(
            product["Tipo"] || product.tipo || product.type || "TINTO",
          ).toUpperCase();

          // Processar preço
          let negotiatedPrice = "0.00";
          const priceField =
            product["Valor de Tabela"] ||
            product["Valor Negociado"] ||
            product.valor ||
            product.price ||
            product["Preço"] ||
            "0";
          if (priceField) {
            const numericPrice = parseFloat(
              String(priceField)
                .replace(/[^\d,]/g, "")
                .replace(",", "."),
            );
            if (!isNaN(numericPrice) && numericPrice > 0) {
              negotiatedPrice = numericPrice.toFixed(2);
            }
          }

          // Validar valores permitidos
          const validVolumes = ["187ml", "375ml", "750ml", "1500ml"];
          const validTypes = [
            "ESPUMANTE",
            "BRANCO",
            "ROSE",
            "TINTO",
            "PÓS-REFEIÇÃO",
          ];

          const finalCountry = validCountries.includes(country)
            ? country
            : "OUTROS";
          const finalVolume = validVolumes.includes(volume) ? volume : "750ml";
          const finalType = validTypes.includes(type) ? type : "TINTO";

          const productData = {
            name: String(name).trim(),
            country: finalCountry,
            volume: finalVolume,
            type: finalType,
            negotiatedPrice,
          };

          // Criar produto
          const response = await fetch("/api/products", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(productData),
          });

          if (response.ok) {
            results.success++;
          } else {
            const errorText = await response.text();
            console.error(`Linha ${i + 1}: Erro ao criar produto:`, errorText);
            results.errors.push({
              row: i + 2,
              error: `Erro ao criar produto: ${errorText}`,
              data: product,
            });
          }
        } catch (error) {
          console.error(`Linha ${i + 1}: Erro inesperado:`, error);
          results.errors.push({
            row: i + 2,
            error: `Erro inesperado: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
            data: product,
          });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      setImportResult(results);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });

      toast({
        title: "Importação concluída",
        description: `${results.success} produtos importados com sucesso${results.errors.length > 0 ? `. ${results.errors.length} erros encontrados.` : "."}`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha na importação dos produtos.",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      processFileMutation.mutate(selectedFile);
    }
  };

  const handleImport = () => {
    const selectedData = importData.filter((_, index) => {
      // Filtrar apenas linhas que tenham pelo menos o nome do produto
      const row = importData[index];
      const name = row["Nome do Vinho"] || row.nome || row.name || row["Nome"];
      return name && String(name).trim();
    });

    if (selectedData.length === 0) {
      toast({
        title: "Erro",
        description: "Nenhum produto válido encontrado para importar.",
        variant: "destructive",
      });
      return;
    }

    setStep("importing");
    importProductsMutation.mutate(selectedData);
  };

  const handleClose = () => {
    setFile(null);
    setImportData([]);
    setImportResult(null);
    setStep("upload");
    setSelectedFields({});
    setProgress(0);
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        "Nome do Vinho": "Vinho Tinto Exemplo",
        País: "BRASIL",
        Volume: "750ml",
        Tipo: "TINTO",
        "Valor de Tabela": "45,99",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Produtos");

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(data);
    link.download = "template_produtos.xlsx";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Importar Produtos
            {step !== "upload" &&
              ` - ${
                step === "preview"
                  ? "Visualizar Dados"
                  : step === "field-mapping"
                    ? "Mapear Campos"
                    : step === "importing"
                      ? "Importando..."
                      : "Resultado"
              }`}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-wine-100 rounded-full flex items-center justify-center">
                <Upload className="h-8 w-8 text-wine-600 dark:text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 dark:text-slate-200">
                Selecione um arquivo Excel
              </h3>
              <p className="text-gray-600 mb-4 dark:text-slate-400">
                Carregue um arquivo .xlsx ou .xls com os dados dos produtos
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="file">Arquivo Excel</Label>
                <Input
                  id="file"
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={processFileMutation.isPending}
                />
              </div>

              {processFileMutation.isPending && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wine-600 dark:border-slate-700 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    Processando arquivo...
                  </p>
                </div>
              )}
            </div>

            <div className="border-t dark:border-slate-700 pt-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium dark:text-slate-200">
                  Precisa de um modelo?
                </h4>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Template
                </Button>
              </div>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">
                Use nosso template para garantir que os dados estejam no formato
                correto.
              </p>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-6">
            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertDescription>
                Encontrados {importData.length} registros no arquivo. Verifique
                os dados abaixo antes de continuar.
              </AlertDescription>
            </Alert>

            {importData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Prévia dos Dados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 dark:border-slate-700">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-800">
                          {Object.keys(importData[0]).map((header) => (
                            <th
                              key={header}
                              className="border border-gray-300 dark:border-slate-700 px-2 py-1 text-left text-xs"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importData.slice(0, 5).map((row, index) => (
                          <tr key={index}>
                            {Object.values(row).map((value, cellIndex) => (
                              <td
                                key={cellIndex}
                                className="border border-gray-300 dark:border-slate-700 px-2 py-1 text-xs"
                              >
                                {String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importData.length > 5 && (
                    <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">
                      Mostrando apenas as primeiras 5 linhas de{" "}
                      {importData.length} registros.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Voltar
              </Button>
              <Button onClick={handleImport} variant={"default"}>
                Importar Produtos
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-6 text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-wine-10 dark:bg-slate-800 rounded-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wine-600 dark:border-slate-700"></div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Importando produtos...
              </h3>
              <p className="text-gray-600 dark:text-slate-400 mb-4">
                Por favor, aguarde enquanto processamos os dados.
              </p>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">
                {Math.round(progress)}% concluído
              </p>
            </div>
          </div>
        )}

        {step === "result" && importResult && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-green-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold dark:text-slate-200 mb-2">
                Importação Concluída
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="text-center py-4">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {importResult.success}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-slate-400">
                    Sucessos
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-center py-4">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {importResult.errors.length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-slate-400">
                    Erros
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-center py-4">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {importResult.total}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-slate-400">
                    Total
                  </div>
                </CardContent>
              </Card>
            </div>

            {importResult.errors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Erros Encontrados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {importResult.errors.map((error, index) => (
                      <div
                        key={index}
                        className="border border-red-200 dark:border-red-700 rounded p-2 bg-red-50 dark:bg-red-900"
                      >
                        <div className="font-medium text-red-800 dark:text-red-400">
                          Linha {error.row}: {error.error}
                        </div>
                        {error.data && (
                          <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                            Dados: {JSON.stringify(error.data)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
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
