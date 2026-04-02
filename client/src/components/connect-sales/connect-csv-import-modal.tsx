import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Upload, FileText, CheckCircle2, AlertCircle, Users, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface CsvRow {
  saleDate: string;
  totalValue: string;
  contactName: string;
  contactCpf: string;
  contactBirthDate: string;
  contactCep: string;
  contactStreet: string;
  contactNumber: string;
  contactNeighborhood: string;
  contactComplement: string;
  contactCity: string;
  sellerNameRaw: string;
  contactPhone: string;
  contactCellphone: string;
}

interface SellerMatch {
  rawName: string;
  matchedUserId: string | null;
  matchedUserName: string | null;
  score: number;
}

interface UserOption {
  id: string;
  name: string;
}

type Step = "upload" | "preview" | "sellers" | "result";

interface ImportResult {
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
  clientsFound: number;
  clientsCreated: number;
  clientsWithoutContact: number;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface ConnectCsvImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parseia as linhas do CSV usando XLSX (já disponível no projeto) */
function parseCsvToRows(fileData: ArrayBuffer): CsvRow[] {
  const workbook = XLSX.read(fileData, { type: "array", raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  // Força leitura sem cabeçalho para mapear por índice
  const raw = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 }) as string[][];

  // Pula linha de cabeçalho
  const dataRows = raw.slice(1);

  return dataRows
    .filter((row) => row.length >= 2 && row[0] && row[1])
    .map((row) => ({
      saleDate: String(row[0] ?? "").trim(),
      totalValue: String(row[1] ?? "").trim(),
      contactName: String(row[2] ?? "").trim(),
      contactCpf: String(row[3] ?? "").trim(),
      contactBirthDate: String(row[4] ?? "").trim(),
      contactCep: String(row[5] ?? "").trim(),
      contactStreet: String(row[6] ?? "").trim(),
      contactNumber: String(row[7] ?? "").trim(),
      contactNeighborhood: String(row[8] ?? "").trim(),
      contactComplement: String(row[9] ?? "").trim(),
      contactCity: String(row[10] ?? "").trim(),
      sellerNameRaw: String(row[11] ?? "").trim(),
      contactPhone: String(row[12] ?? "").trim(),
      contactCellphone: String(row[13] ?? "").trim(),
    }));
}

/** Extrai nomes únicos de vendedores do CSV */
function extractUniqueSellerNames(rows: CsvRow[]): string[] {
  const names = new Set<string>();
  for (const row of rows) {
    if (row.sellerNameRaw) names.add(row.sellerNameRaw);
  }
  return Array.from(names).sort();
}

// ─── Componente principal ────────────────────────────────────────────────────

export function ConnectCsvImportModal({
  open,
  onOpenChange,
  onSuccess,
}: ConnectCsvImportModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [sellerMappings, setSellerMappings] = useState<
    { rawName: string; userId: string | null }[]
  >([]);
  const [sellerSuggestions, setSellerSuggestions] = useState<SellerMatch[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  // Busca usuários ativos para os dropdowns
  const { data: usersData = [] } = useQuery<UserOption[]>({
    queryKey: ["/api/users"],
    select: (data: unknown) => {
      if (!Array.isArray(data)) return [];
      return (data as { id: string; name: string }[]).map((u) => ({
        id: u.id,
        name: u.name,
      }));
    },
  });

  // ── Resetar ao fechar ──────────────────────────────────────────────────────
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setStep("upload");
      setFileName("");
      setRows([]);
      setSellerMappings([]);
      setSellerSuggestions([]);
      setResult(null);
    }
    onOpenChange(v);
  };

  // ── Processar arquivo ──────────────────────────────────────────────────────
  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".csv") && !file.name.endsWith(".CSV")) {
        toast({
          title: "Formato inválido",
          description: "Selecione um arquivo .csv",
          variant: "destructive",
        });
        return;
      }

      const buffer = await file.arrayBuffer();
      try {
        const parsed = parseCsvToRows(buffer);
        if (parsed.length === 0) {
          toast({
            title: "Arquivo vazio",
            description: "Nenhuma linha de dados encontrada.",
            variant: "destructive",
          });
          return;
        }

        setFileName(file.name);
        setRows(parsed);

        // Solicitar sugestões de matching ao servidor
        const uniqueNames = extractUniqueSellerNames(parsed);
        if (uniqueNames.length > 0) {
          try {
            const resp = await fetch(
              `/api/connect-orders/match-sellers?names=${encodeURIComponent(uniqueNames.join(","))}`,
            );
            const json = await resp.json();
            if (json.success) {
              setSellerSuggestions(json.data as SellerMatch[]);
              setSellerMappings(
                (json.data as SellerMatch[]).map((m: SellerMatch) => ({
                  rawName: m.rawName,
                  userId: m.score >= 0.7 ? m.matchedUserId : null,
                })),
              );
            }
          } catch {
            setSellerMappings(uniqueNames.map((n) => ({ rawName: n, userId: null })));
          }
        }

        setStep("preview");
      } catch {
        toast({
          title: "Erro ao ler arquivo",
          description: "Verifique se o arquivo é um CSV válido da Connect.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  // ── Importar ───────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!user?.id) {
      toast({ title: "Não autenticado", variant: "destructive" });
      return;
    }
    setIsImporting(true);
    try {
      const userId = user.id;
      const resp = await fetch("/api/connect-orders/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({ rows, sellerMappings, sourceFile: fileName }),
      });
      const json = await resp.json();
      if (!json.success) throw new Error(json.error ?? "Erro desconhecido");
      setResult(json.data as ImportResult);
      setStep("result");
      onSuccess?.();
    } catch (err) {
      toast({
        title: "Erro na importação",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-500" />
            Importar CSV Connect
          </DialogTitle>
          <DialogDescription>
            Importe vendas da plataforma Connect a partir do arquivo CSV exportado.
          </DialogDescription>
        </DialogHeader>

        {/* Progress steps */}
        <div className="flex items-center gap-1 text-xs text-slate-500 mb-4">
          {(["upload", "preview", "sellers", "result"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && <ArrowRight className="h-3 w-3" />}
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full",
                  step === s
                    ? "bg-violet-100 text-violet-700 font-semibold"
                    : "text-slate-400",
                )}
              >
                {s === "upload" && "Upload"}
                {s === "preview" && "Preview"}
                {s === "sellers" && "Vendedores"}
                {s === "result" && "Resultado"}
              </span>
            </div>
          ))}
        </div>

        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors",
              isDragging
                ? "border-violet-400 bg-violet-50"
                : "border-slate-200 hover:border-violet-300 hover:bg-slate-50",
            )}
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-slate-400" />
            <p className="font-medium text-slate-700">Arraste o arquivo CSV aqui</p>
            <p className="text-sm text-slate-400 mt-1">ou clique para selecionar</p>
            <p className="text-xs text-slate-400 mt-3">
              Formato aceito: .csv exportado da plataforma Connect
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <FileText className="h-4 w-4 text-violet-500" />
                <span className="font-medium">{fileName}</span>
                <Badge variant="secondary">{rows.length} linhas</Badge>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Data</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Valor</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Cliente</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Vendedor</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Cidade</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-700">{row.saleDate}</td>
                      <td className="px-3 py-2 text-slate-700 font-medium">
                        R$ {row.totalValue}
                      </td>
                      <td className="px-3 py-2 text-slate-600 max-w-[160px] truncate">
                        {row.contactName || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {row.sellerNameRaw || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        {row.contactCity || <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 10 && (
                <p className="text-center text-xs text-slate-400 py-2">
                  ... e mais {rows.length - 10} linhas
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Voltar
              </Button>
              <Button
                className="bg-violet-600 hover:bg-violet-700"
                onClick={() => setStep("sellers")}
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Mapeamento de vendedores ── */}
        {step === "sellers" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Users className="h-4 w-4 text-violet-500" />
              <span>
                Vincule cada vendedor do CSV a um usuário do sistema. Sugestões com
                alta confiança já foram preenchidas automaticamente.
              </span>
            </div>

            <div className="space-y-2">
              {sellerMappings.map((mapping, idx) => {
                const suggestion = sellerSuggestions.find(
                  (s) => s.rawName === mapping.rawName,
                );
                const isAutoMatched = (suggestion?.score ?? 0) >= 0.7;

                return (
                  <div
                    key={mapping.rawName}
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {mapping.rawName}
                      </p>
                      {isAutoMatched && suggestion && (
                        <p className="text-xs text-emerald-600">
                          Auto-sugerido ({Math.round(suggestion.score * 100)}% similar)
                        </p>
                      )}
                    </div>
                    <Select
                      value={mapping.userId ?? "none"}
                      onValueChange={(v) => {
                        setSellerMappings((prev) =>
                          prev.map((m, i) =>
                            i === idx
                              ? { ...m, userId: v === "none" ? null : v }
                              : m,
                          ),
                        );
                      }}
                    >
                      <SelectTrigger className="w-52 text-sm">
                        <SelectValue placeholder="Selecionar usuário" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-slate-400">Sem vínculo</span>
                        </SelectItem>
                        {usersData.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {mapping.userId ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("preview")}>
                Voltar
              </Button>
              <Button
                className="bg-violet-600 hover:bg-violet-700"
                disabled={isImporting}
                onClick={handleImport}
              >
                {isImporting ? "Importando..." : `Importar ${rows.length} registros`}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Resultado ── */}
        {step === "result" && result && (
          <div className="space-y-4">
            {/* Pedidos */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
                Pedidos
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{result.inserted}</p>
                  <p className="text-xs text-emerald-600 mt-1">Importados</p>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-center">
                  <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
                  <p className="text-xs text-amber-600 mt-1">Duplicatas ignoradas</p>
                </div>
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-center">
                  <p className="text-2xl font-bold text-rose-700">{result.errors.length}</p>
                  <p className="text-xs text-rose-600 mt-1">Erros</p>
                </div>
              </div>
            </div>

            {/* Clientes */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
                Clientes no App
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-center">
                  <p className="text-2xl font-bold text-blue-700">{result.clientsFound}</p>
                  <p className="text-xs text-blue-600 mt-1">Já existentes</p>
                </div>
                <div className="rounded-lg bg-violet-50 border border-violet-200 p-4 text-center">
                  <p className="text-2xl font-bold text-violet-700">{result.clientsCreated}</p>
                  <p className="text-xs text-violet-600 mt-1">Criados</p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-center">
                  <p className="text-2xl font-bold text-slate-500">{result.clientsWithoutContact}</p>
                  <p className="text-xs text-slate-400 mt-1">Sem contato</p>
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 space-y-1 max-h-40 overflow-y-auto">
                <p className="text-xs font-semibold text-rose-700 mb-1">Detalhes dos erros:</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-rose-600">
                    Linha {e.row}: {e.message}
                  </p>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                className="bg-violet-600 hover:bg-violet-700"
                onClick={() => handleOpenChange(false)}
              >
                Concluir
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
