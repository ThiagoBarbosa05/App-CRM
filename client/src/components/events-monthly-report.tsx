/**
 * Setor "Eventos do Mês" da aba Análises.
 *
 * Mostra os eventos do mês navegado e permite gerar o relatório de um período
 * livre em PDF (renderizado no servidor com pdfkit) ou Excel (montado aqui com
 * `xlsx`, como o resto das exportações do CRM).
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addMonths, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { exportToExcel } from "@/lib/excel-export";
import { todayInSaoPaulo } from "@shared/sao-paulo-date";

interface EventsReportRow {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  category: string;
  status: string;
  statusLabel: string;
  pricingType: string;
  eventValue: number;
  maxCapacity: number | null;
  participantCount: number;
  attendedCount: number;
  occupancyPct: number | null;
  eventRevenue: number;
  wineRevenue: number;
  totalRevenue: number;
}

interface EventsReportTotals {
  eventCount: number;
  cancelledCount: number;
  participantCount: number;
  attendedCount: number;
  eventRevenue: number;
  wineRevenue: number;
  totalRevenue: number;
  avgOccupancyPct: number | null;
}

interface EventsReportData {
  from: string;
  to: string;
  events: EventsReportRow[];
  totals: EventsReportTotals;
}

const STATUS_STYLES: Record<string, string> = {
  planejado:
    "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  ativo: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  finalizado:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  cancelado: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

/** Primeiro e último dia civil do mês de `monthIso` (`YYYY-MM`). */
function monthRange(monthIso: string): { from: string; to: string } {
  const first = parseISO(`${monthIso}-01`);
  const last = addMonths(first, 1);
  last.setDate(0);
  return { from: format(first, "yyyy-MM-dd"), to: format(last, "yyyy-MM-dd") };
}

function shiftMonth(monthIso: string, delta: number): string {
  return format(addMonths(parseISO(`${monthIso}-01`), delta), "yyyy-MM");
}

function formatDateBR(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function EventsMonthlyReport() {
  const currentMonth = todayInSaoPaulo().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);

  const range = useMemo(() => monthRange(month), [month]);

  const { data, isLoading, isError } = useQuery<EventsReportData>({
    queryKey: [`/api/events/report?from=${range.from}&to=${range.to}`],
  });

  const monthLabel = format(parseISO(`${month}-01`), "MMMM 'de' yyyy", {
    locale: ptBR,
  });

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base text-slate-700 dark:text-slate-200">
            <CalendarRange className="h-4 w-4 text-orange-500" />
            Eventos do Mês
          </CardTitle>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[9.5rem] text-center text-sm font-medium capitalize text-slate-700 dark:text-slate-200">
                {monthLabel}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {month !== currentMonth && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-orange-600 hover:text-orange-700"
                onClick={() => setMonth(currentMonth)}
              >
                Mês atual
              </Button>
            )}
            <ReportGenerator defaultRange={range} />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
            <span className="ml-2 text-sm">Carregando eventos do mês...</span>
          </div>
        ) : isError || !data ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Não foi possível carregar os eventos do mês.
          </p>
        ) : data.events.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Nenhum evento em {monthLabel}.
          </p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MonthStat label="Eventos" value={String(data.totals.eventCount)} />
              <MonthStat
                label="Participantes"
                value={`${data.totals.participantCount} pessoas`}
              />
              <MonthStat
                label="Ocupação média"
                value={
                  data.totals.avgOccupancyPct === null
                    ? "—"
                    : `${data.totals.avgOccupancyPct}%`
                }
              />
              <MonthStat
                label="Receita do mês"
                value={formatCurrency(data.totals.totalRevenue)}
                highlight
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-3 font-medium">Data</th>
                    <th className="py-2 pr-3 font-medium">Evento</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 text-right font-medium">Pessoas</th>
                    <th className="py-2 pr-3 text-right font-medium">Ocupação</th>
                    <th className="py-2 text-right font-medium">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((event) => (
                    <tr
                      key={event.id}
                      className={`border-b border-slate-100 dark:border-slate-800 ${
                        event.status === "cancelado" ? "opacity-60" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap py-2.5 pr-3 text-slate-500 dark:text-slate-400">
                        {formatDateBR(event.date)}
                        <span className="ml-1 text-xs text-slate-400">
                          {event.time}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {event.name}
                        </span>
                        <span className="block text-xs text-slate-400">
                          {event.location}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_STYLES[event.status] ?? STATUS_STYLES.planejado
                          }`}
                        >
                          {event.statusLabel}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right text-slate-600 dark:text-slate-300">
                        {event.participantCount}
                        {event.maxCapacity ? (
                          <span className="text-slate-400">
                            /{event.maxCapacity}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-slate-600 dark:text-slate-300">
                        {event.occupancyPct === null
                          ? "—"
                          : `${event.occupancyPct}%`}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-slate-800 dark:text-slate-100">
                        {formatCurrency(event.totalRevenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.totals.cancelledCount > 0 && (
              <p className="mt-3 text-xs text-slate-400">
                {data.totals.cancelledCount} evento
                {data.totals.cancelledCount === 1 ? "" : "s"} cancelado
                {data.totals.cancelledCount === 1 ? "" : "s"} no mês — não
                {data.totals.cancelledCount === 1 ? " entra" : " entram"} nos
                totais.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MonthStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight
          ? "border-orange-100 bg-orange-50 dark:border-orange-900/30 dark:bg-orange-900/10"
          : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
      }`}
    >
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className={`text-base font-bold ${
          highlight
            ? "text-orange-700 dark:text-orange-400"
            : "text-slate-800 dark:text-slate-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/** Popover com o período e os dois formatos de saída. */
function ReportGenerator({
  defaultRange,
}: {
  defaultRange: { from: string; to: string };
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [busy, setBusy] = useState<"pdf" | "excel" | null>(null);

  // Cada abertura parte do mês que está na tela: é o período que o usuário
  // acabou de olhar, e ele continua livre para editar antes de baixar.
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setFrom(defaultRange.from);
      setTo(defaultRange.to);
    }
    setOpen(next);
  };

  /** De `monthsBack` meses atrás até o fim do mês corrente. */
  const applyPreset = (monthsBack: number) => {
    const currentMonthStart = parseISO(`${todayInSaoPaulo().slice(0, 7)}-01`);
    const start = addMonths(currentMonthStart, -monthsBack);
    const end = addMonths(currentMonthStart, 1);
    end.setDate(0);
    setFrom(format(start, "yyyy-MM-dd"));
    setTo(format(end, "yyyy-MM-dd"));
  };

  const validate = (): boolean => {
    if (!from || !to) {
      toast({
        title: "Período incompleto",
        description: "Informe a data inicial e a data final.",
        variant: "destructive",
      });
      return false;
    }
    if (from > to) {
      toast({
        title: "Período inválido",
        description: "A data inicial não pode ser posterior à data final.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handlePdf = async () => {
    if (!validate()) return;
    setBusy("pdf");
    try {
      const res = await fetch(
        `/api/events/report/pdf?from=${from}&to=${to}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const message = await res
          .json()
          .then((body) => body?.message)
          .catch(() => null);
        throw new Error(message ?? "Falha ao gerar o PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio-eventos-${from}_${to}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao gerar relatório",
        description:
          error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleExcel = async () => {
    if (!validate()) return;
    setBusy("excel");
    try {
      const res = await fetch(`/api/events/report?from=${from}&to=${to}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const message = await res
          .json()
          .then((body) => body?.message)
          .catch(() => null);
        throw new Error(message ?? "Falha ao buscar os dados do relatório");
      }
      const report: EventsReportData = await res.json();

      if (report.events.length === 0) {
        toast({
          title: "Nenhum evento no período",
          description: "Ajuste as datas e tente de novo.",
        });
        return;
      }

      exportToExcel(
        report.events.map((event) => ({
          Data: formatDateBR(event.date),
          Hora: event.time,
          Evento: event.name,
          Local: event.location,
          Categoria: event.category,
          Status: event.statusLabel,
          "Valor do Evento": event.eventValue,
          "Tipo de Valor":
            event.pricingType === "total" ? "Valor total" : "Por pessoa",
          Participantes: event.participantCount,
          Presentes: event.attendedCount,
          "Capacidade Máxima": event.maxCapacity ?? "",
          "Ocupação (%)": event.occupancyPct ?? "",
          "Receita Evento (R$)": event.eventRevenue,
          "Venda de Vinhos (R$)": event.wineRevenue,
          "Receita Total (R$)": event.totalRevenue,
        })),
        `relatorio-eventos-${from}_${to}`,
        "Eventos",
      );
      setOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao exportar",
        description:
          error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button size="sm" className="h-8 gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Gerar Relatório
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Relatório de eventos
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Escolha o período e o formato do arquivo.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="report-from" className="text-xs">
                De
              </Label>
              <Input
                id="report-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="report-to" className="text-xs">
                Até
              </Label>
              <Input
                id="report-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <PresetButton label="Este mês" onClick={() => applyPreset(0)} />
            <PresetButton
              label="Últimos 3 meses"
              onClick={() => applyPreset(2)}
            />
            <PresetButton
              label="Últimos 6 meses"
              onClick={() => applyPreset(5)}
            />
            <PresetButton
              label="Últimos 12 meses"
              onClick={() => applyPreset(11)}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1 gap-1.5"
              onClick={handlePdf}
              disabled={busy !== null}
            >
              {busy === "pdf" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 text-red-500" />
              )}
              PDF
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-1.5"
              onClick={handleExcel}
              disabled={busy !== null}
            >
              {busy === "excel" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
              )}
              Excel
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PresetButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:border-orange-300 hover:text-orange-600 transition-colors"
    >
      {label}
    </button>
  );
}
