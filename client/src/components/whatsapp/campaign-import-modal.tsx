import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { normalizePhoneE164 } from "@shared/phone";
import * as XLSX from "xlsx";

/**
 * Import de uma planilha de contatos (nome + telefone) direto no passo
 * "Clientes" do wizard de campanha. Os contatos viram clientes do CRM e o modal
 * devolve os `clientIds`, que entram na audiência `explicit` como se tivessem
 * sido escolhidos a dedo na lista.
 *
 * O parsing acontece no cliente, com SheetJS — é o padrão dos outros
 * importadores do projeto (client-import-modal, product-import-modal), e evita
 * subir o arquivo para o servidor só para lê-lo.
 */

interface Tag {
  id: string;
  name: string;
}

type ImportRowIssue =
  | "missingName"
  | "missingPhone"
  | "invalidPhone"
  | "duplicateInFile"
  | "createFailed";

interface RejectedRow {
  rowNumber: number;
  name: string;
  phone: string;
  reason: ImportRowIssue;
  message?: string;
}

interface ImportAudienceResponse {
  clientIds: string[];
  created: number;
  matched: number;
  optedOut: number;
  rejected: RejectedRow[];
}

const ISSUE_LABELS: Record<ImportRowIssue, string> = {
  missingName: "Sem nome",
  missingPhone: "Sem telefone",
  invalidPhone: "Telefone inválido",
  duplicateInFile: "Repetido na planilha",
  createFailed: "Falha ao cadastrar",
};

/** Marcador aplicado a todo cliente criado por aqui, para dar rastreabilidade. */
const IMPORT_MARKER = "importacao-campanha";

const NAME_HINTS = ["nome", "name", "contato", "cliente", "razao"];
const PHONE_HINTS = ["celular", "telefone", "phone", "whatsapp", "numero", "número", "fone"];

/**
 * Escolhe a coluna cujo cabeçalho bate com alguma das dicas. A planilha típica
 * do time vem com "Nome" e "Celular", que casam direto; quando não casa, o
 * usuário escolhe nos selects do passo de preview.
 */
function detectColumn(headers: string[], hints: string[]): string {
  const found = headers.find((header) => {
    const normalized = header.toLowerCase().trim();
    return hints.some((hint) => normalized.includes(hint));
  });
  return found ?? "";
}

interface ParsedSheet {
  headers: string[];
  /** Linhas como objetos header→valor, na ordem da planilha. */
  rows: Record<string, string>[];
}

/**
 * Lê a primeira aba do arquivo. Usa `header: 1` para pegar o cabeçalho cru — com
 * `sheet_to_json` no modo objeto, colunas com nome repetido ou vazio somem, e o
 * usuário fica sem a opção de mapeá-las.
 */
async function parseSheet(file: File): Promise<ParsedSheet> {
  const isCsv = file.name.toLowerCase().endsWith(".csv");

  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: "string", raw: true })
    : XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("A planilha não tem nenhuma aba.");

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
  });
  if (matrix.length < 2) throw new Error("A planilha não tem linhas de dados.");

  const headers = (matrix[0] ?? []).map((cell, index) =>
    String(cell ?? "").trim() || `Coluna ${index + 1}`,
  );

  const rows = matrix.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = String(cells[index] ?? "").trim();
    });
    return row;
  });

  return { headers, rows };
}

interface CampaignImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (clientIds: string[]) => void;
}

export function CampaignImportModal({
  open,
  onOpenChange,
  onImported,
}: CampaignImportModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [nameColumn, setNameColumn] = useState("");
  const [phoneColumn, setPhoneColumn] = useState("");
  const [categoria, setCategoria] = useState("");
  const [origem, setOrigem] = useState("");
  const [result, setResult] = useState<ImportAudienceResponse | null>(null);

  const { data: categories = [] } = useQuery<Tag[]>({
    queryKey: ["/api/tags/categories"],
    enabled: open,
  });
  const { data: origins = [] } = useQuery<Tag[]>({
    queryKey: ["/api/tags/origins"],
    enabled: open,
  });

  /**
   * Mesmas regras do servidor (`normalizeImportRows`), rodadas aqui só para o
   * usuário ver as contagens antes de confirmar. Ambos os lados usam o
   * `normalizePhoneE164` de `@shared/phone`, então os números batem.
   */
  const preview = useMemo(() => {
    if (!sheet || !nameColumn || !phoneColumn) return null;

    const valid: Array<{ rowNumber: number; name: string; phone: string }> = [];
    const rejected: RejectedRow[] = [];
    const seen = new Set<string>();

    sheet.rows.forEach((row, index) => {
      const rowNumber = index + 2; // +1 pelo cabeçalho, +1 porque planilha é 1-based
      const name = row[nameColumn] ?? "";
      const phone = row[phoneColumn] ?? "";

      if (!name) {
        rejected.push({ rowNumber, name, phone, reason: "missingName" });
        return;
      }
      if (!phone) {
        rejected.push({ rowNumber, name, phone, reason: "missingPhone" });
        return;
      }
      const normalized = normalizePhoneE164(phone);
      if (!normalized) {
        rejected.push({ rowNumber, name, phone, reason: "invalidPhone" });
        return;
      }
      if (seen.has(normalized)) {
        rejected.push({ rowNumber, name, phone, reason: "duplicateInFile" });
        return;
      }
      seen.add(normalized);
      valid.push({ rowNumber, name, phone: normalized });
    });

    return { valid, rejected };
  }, [sheet, nameColumn, phoneColumn]);

  function resetState() {
    setStep("upload");
    setFileName("");
    setSheet(null);
    setNameColumn("");
    setPhoneColumn("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseSheet(file);
      setFileName(file.name);
      setSheet(parsed);
      setNameColumn(detectColumn(parsed.headers, NAME_HINTS));
      setPhoneColumn(detectColumn(parsed.headers, PHONE_HINTS));
      setStep("preview");
    } catch (error) {
      toast({
        title: "Não foi possível ler a planilha",
        description:
          error instanceof Error ? error.message : "Verifique o arquivo e tente novamente.",
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const importMutation = useMutation({
    mutationFn: async (): Promise<ImportAudienceResponse> => {
      const res = await apiRequest("POST", "/api/clients/import-audience", {
        rows: preview!.valid.map((row) => ({
          name: row.name,
          phone: row.phone,
          rowNumber: row.rowNumber,
        })),
        categoria,
        origem,
        markers: [IMPORT_MARKER],
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Erro ao importar contatos.");
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Junta o que o servidor recusou com o que já tinha sido descartado no
      // preview — as linhas sem telefone nem chegam a ser enviadas.
      setResult({
        ...data,
        rejected: [...(preview?.rejected ?? []), ...data.rejected].sort(
          (a, b) => a.rowNumber - b.rowNumber,
        ),
      });
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      onImported(data.clientIds);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canImport =
    !!preview && preview.valid.length > 0 && !!categoria && !!origem;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar contatos de planilha
          </DialogTitle>
          <DialogDescription>
            Os contatos viram clientes no CRM e entram como destinatários desta campanha.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-xl p-8 text-center space-y-3">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Envie um arquivo <strong>.xlsx</strong>, <strong>.xls</strong> ou{" "}
                <strong>.csv</strong> com uma coluna de nome e outra de telefone.
              </p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="max-w-sm mx-auto"
                data-testid="input-campaign-import-file"
              />
            </div>
          </div>
        )}

        {step === "preview" && preview && sheet && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4 shrink-0" />
              <span className="truncate">{fileName}</span>
              <span>·</span>
              <span className="shrink-0">{sheet.rows.length} linhas</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Coluna do nome</Label>
                <Select value={nameColumn} onValueChange={setNameColumn}>
                  <SelectTrigger data-testid="select-name-column">
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {sheet.headers.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Coluna do telefone</Label>
                <Select value={phoneColumn} onValueChange={setPhoneColumn}>
                  <SelectTrigger data-testid="select-phone-column">
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {sheet.headers.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria dos novos clientes</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger data-testid="select-import-categoria">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((tag) => (
                      <SelectItem key={tag.id} value={tag.name}>
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Origem dos novos clientes</Label>
                <Select value={origem} onValueChange={setOrigem}>
                  <SelectTrigger data-testid="select-import-origem">
                    <SelectValue placeholder="Selecione a origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {origins.map((tag) => (
                      <SelectItem key={tag.id} value={tag.name}>
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                {preview.valid.length} válidos
              </Badge>
              {(["missingName", "missingPhone", "invalidPhone", "duplicateInFile"] as const)
                .map((reason) => ({
                  reason,
                  count: preview.rejected.filter((row) => row.reason === reason).length,
                }))
                .filter(({ count }) => count > 0)
                .map(({ reason, count }) => (
                  <Badge key={reason} variant="outline" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {count} {ISSUE_LABELS[reason].toLowerCase()}
                  </Badge>
                ))}
            </div>

            {preview.valid.length === 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhuma linha aproveitável. Confira o mapeamento das colunas.
                </AlertDescription>
              </Alert>
            )}

            {preview.valid.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Nome</th>
                        <th className="text-left px-3 py-2 font-medium">Telefone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.valid.slice(0, 20).map((row) => (
                        <tr key={row.rowNumber} className="border-t">
                          <td className="px-3 py-1.5 truncate max-w-[16rem]">{row.name}</td>
                          <td className="px-3 py-1.5 tabular-nums">{row.phone}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.valid.length > 20 && (
                  <div className="px-3 py-1.5 text-xs text-muted-foreground bg-muted/30 border-t">
                    e mais {preview.valid.length - 20}…
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={resetState}
                disabled={importMutation.isPending}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Trocar arquivo
              </Button>
              <Button
                type="button"
                onClick={() => importMutation.mutate()}
                disabled={!canImport || importMutation.isPending}
                data-testid="button-confirm-campaign-import"
              >
                {importMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                )}
                Importar {preview.valid.length} contatos
              </Button>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                {result.created} criados
              </Badge>
              <Badge variant="secondary">{result.matched} já cadastrados</Badge>
              {result.optedOut > 0 && (
                <Badge variant="outline">{result.optedOut} com opt-out</Badge>
              )}
              {result.rejected.length > 0 && (
                <Badge variant="outline">{result.rejected.length} ignorados</Badge>
              )}
            </div>

            {result.optedOut > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {result.optedOut} contato(s) pediram para não receber mensagens. Eles
                  entram na campanha, mas o envio será suprimido automaticamente.
                </AlertDescription>
              </Alert>
            )}

            {result.rejected.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Linha</th>
                        <th className="text-left px-3 py-2 font-medium">Contato</th>
                        <th className="text-left px-3 py-2 font-medium">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rejected.map((row) => (
                        <tr key={`${row.rowNumber}-${row.reason}`} className="border-t">
                          <td className="px-3 py-1.5 tabular-nums">{row.rowNumber}</td>
                          <td className="px-3 py-1.5 truncate max-w-[12rem]">
                            {row.name || row.phone || "—"}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {row.message ?? ISSUE_LABELS[row.reason]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button type="button" onClick={() => handleClose(false)}>
                Concluir
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
