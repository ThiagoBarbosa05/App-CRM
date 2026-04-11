import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CohortData } from "@/hooks/use-bling-orders";
import { useCohortClients } from "@/hooks/use-bling-orders";
import {
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  Download,
  ExternalLink,
} from "lucide-react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocation } from "wouter";
import { exportToExcel } from "@/lib/excel-export";

interface CohortAnalysisTableProps {
  data?: CohortData;
  isLoading: boolean;
  isFetching?: boolean;
  startDate: string;
  endDate: string;
}

interface SelectedCell {
  cohortMonth: string;
  cohortSize: number;
  monthOffset: number;
  percentage: number;
  count: number;
}

function getHeatmapColor(value: number | null): string {
  if (value === null)
    return "bg-slate-50 dark:bg-slate-800/30 text-slate-300 dark:text-slate-600";
  if (value >= 80) return "bg-emerald-600 text-white";
  if (value >= 60) return "bg-emerald-500 text-white";
  if (value >= 40) return "bg-emerald-400 text-white";
  if (value >= 25)
    return "bg-emerald-300 text-emerald-900 dark:text-emerald-950";
  if (value >= 15) return "bg-amber-300 text-amber-900 dark:text-amber-950";
  if (value >= 10) return "bg-amber-200 text-amber-800 dark:text-amber-900";
  if (value >= 5) return "bg-orange-200 text-orange-800 dark:text-orange-900";
  if (value > 0) return "bg-rose-100 text-rose-700 dark:text-rose-800";
  return "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500";
}

function formatCohortMonth(yearMonth: string): string {
  const date = parse(yearMonth, "yyyy-MM", new Date());
  return format(date, "MMM/yyyy", { locale: ptBR });
}

/** Calcula o maior offset disponível para um cohort dado o endDate do período */
function maxAvailableOffset(cohortMonth: string, endDate: string): number {
  const [cy, cm] = cohortMonth.split("-").map(Number);
  const [ey, em] = endDate.substring(0, 7).split("-").map(Number);
  return (ey - cy) * 12 + (em - cm);
}

function CohortClientsDialog({
  open,
  onClose,
  selected,
  startDate,
  endDate,
}: {
  open: boolean;
  onClose: () => void;
  selected: SelectedCell | null;
  startDate: string;
  endDate: string;
}) {
  const [, navigate] = useLocation();
  const { data: clients, isLoading, isError } = useCohortClients(
    startDate,
    endDate,
    selected?.cohortMonth ?? null,
    selected?.monthOffset ?? null,
  );

  const retainedClients = clients?.filter((c) => c.retained) ?? [];
  const lostClients = clients?.filter((c) => !c.retained) ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-violet-600" />
            {selected
              ? `${formatCohortMonth(selected.cohortMonth)} — Mês ${selected.monthOffset}`
              : "Clientes"}
          </DialogTitle>
          {selected && (
            <p className="text-sm text-muted-foreground">
              {selected.count} de {selected.cohortSize} clientes retidos (
              {selected.percentage}%)
            </p>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center py-10 text-sm text-rose-500 font-medium">
            Falha ao carregar clientes. Tente novamente.
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-4 pr-1">
            {retainedClients.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Retidos ({retainedClients.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {retainedClients.map((client) => (
                    <div
                      key={client.contactId}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20"
                    >
                      {client.appClientId ? (
                        <button
                          onClick={() => {
                            onClose();
                            navigate(`/clientes/${client.appClientId}`);
                          }}
                          className="text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline flex-1 text-left flex items-center gap-1"
                        >
                          {client.contactName}
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                        </button>
                      ) : (
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1">
                          {client.contactName}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className="text-[10px] border-emerald-300 text-emerald-700 dark:text-emerald-400"
                      >
                        retido
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lostClients.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-4 w-4 text-rose-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Não retornaram ({lostClients.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {lostClients.map((client) => (
                    <div
                      key={client.contactId}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40"
                    >
                      {client.appClientId ? (
                        <button
                          onClick={() => {
                            onClose();
                            navigate(`/clientes/${client.appClientId}`);
                          }}
                          className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:underline flex-1 text-left flex items-center gap-1"
                        >
                          {client.contactName}
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                        </button>
                      ) : (
                        <span className="text-sm text-slate-500 dark:text-slate-400 flex-1">
                          {client.contactName}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CohortAnalysisTable({
  data,
  isLoading,
  isFetching = false,
  startDate,
  endDate,
}: CohortAnalysisTableProps) {
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCellClick = (
    cohortMonth: string,
    cohortSize: number,
    monthOffset: number,
    percentage: number | null,
    count: number | null,
  ) => {
    if (percentage === null || count === null) return;
    setSelectedCell({ cohortMonth, cohortSize, monthOffset, percentage, count });
    setDialogOpen(true);
  };

  const handleExport = () => {
    if (!data) return;
    const rows = data.cohorts.map((cohort) => {
      const row: Record<string, string | number> = {
        Cohort: formatCohortMonth(cohort.cohortMonth),
        Clientes: cohort.cohortSize,
      };
      cohort.retention.forEach((slot, idx) => {
        row[`Mês ${idx}`] =
          slot.percentage !== null ? `${slot.percentage}%` : "—";
      });
      return row;
    });
    exportToExcel(
      rows,
      `cohort_${startDate}_${endDate}.xlsx`,
      "Cohort",
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-violet-50 dark:bg-violet-900/30 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-3 w-64 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="px-6 pb-6">
          <Skeleton className="h-[300px] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data || data.cohorts.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
            <Users className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Análise de Cohort
          </h3>
        </div>
        <div className="flex h-[200px] items-center justify-center text-slate-400 dark:text-slate-500 text-sm font-medium">
          Nenhum dado de cohort disponível para o período selecionado
        </div>
      </div>
    );
  }

  const monthHeaders = Array.from(
    { length: data.maxMonthOffset + 1 },
    (_, i) => i,
  );

  // Médias por coluna (apenas slots com dados)
  const columnAverages = monthHeaders.map((offset) => {
    const slots = data.cohorts
      .map((c) => c.retention[offset]?.percentage)
      .filter((p): p is number => p !== null && p !== undefined);
    if (slots.length === 0) return null;
    return Math.round((slots.reduce((a, b) => a + b, 0) / slots.length) * 10) / 10;
  });

  return (
    <>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-2xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
              <Users className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Análise de Cohort
                </h3>
                {isFetching && (
                  <Loader2 className="h-3 w-3 animate-spin text-violet-400 shrink-0" />
                )}
              </div>
              <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                Retenção agrupada pelo mês da primeira compra · clique para
                detalhes
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="gap-1.5 rounded-xl h-8 px-3 font-bold text-xs border-slate-200 dark:border-slate-700 shrink-0"
          >
            <Download className="h-3 w-3" />
            Exportar
          </Button>
        </div>

        <div className="overflow-x-auto px-4 pb-5">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white dark:bg-slate-900 text-left px-3 py-2.5 font-black text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 min-w-[110px]">
                  Cohort
                </th>
                <th className="px-3 py-2.5 font-black text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 text-center min-w-[60px]">
                  Clientes
                </th>
                {monthHeaders.map((month) => (
                  <th
                    key={month}
                    className="px-2 py-2.5 font-black text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 text-center min-w-[72px]"
                  >
                    {month === 0 ? "Mês 0" : `Mês ${month}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cohorts.map((cohort) => {
                const availableOffset = maxAvailableOffset(
                  cohort.cohortMonth,
                  endDate,
                );
                return (
                  <tr
                    key={cohort.cohortMonth}
                    className="border-b border-slate-50 dark:border-slate-800/50"
                  >
                    <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-3 py-2 font-bold text-xs text-slate-700 dark:text-slate-300 capitalize whitespace-nowrap">
                      {formatCohortMonth(cohort.cohortMonth)}
                    </td>
                    <td className="px-3 py-2 text-center font-bold text-xs text-slate-600 dark:text-slate-400">
                      {cohort.cohortSize}
                    </td>
                    {cohort.retention.map((slot, idx) => {
                      const isFuture = idx > availableOffset;
                      const isClickable =
                        !isFuture &&
                        slot.percentage !== null &&
                        slot.count !== null;
                      return (
                        <td key={idx} className="px-1 py-1.5 text-center">
                          {isFuture ? (
                            <div className="rounded-lg px-2 py-1.5 bg-slate-50/50 dark:bg-slate-800/10 border border-dashed border-slate-200 dark:border-slate-700/50">
                              <span className="text-[10px] text-slate-300 dark:text-slate-600 font-medium">
                                n/d
                              </span>
                            </div>
                          ) : (
                            <div
                              onClick={() =>
                                handleCellClick(
                                  cohort.cohortMonth,
                                  cohort.cohortSize,
                                  idx,
                                  slot.percentage,
                                  slot.count,
                                )
                              }
                              className={`rounded-lg px-2 py-1.5 transition-all ${getHeatmapColor(slot.percentage)} ${
                                isClickable
                                  ? "cursor-pointer hover:opacity-80 hover:scale-105 hover:shadow-sm"
                                  : "cursor-default"
                              }`}
                            >
                              {slot.percentage !== null ? (
                                <div className="flex flex-col items-center leading-tight">
                                  <span className="text-[11px] font-black">
                                    {slot.percentage}%
                                  </span>
                                  <span className="text-[9px] font-semibold opacity-80">
                                    ({slot.count})
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[11px] font-black">—</span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                <td className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-900/80 px-3 py-2 font-black text-[10px] uppercase tracking-widest text-slate-400 whitespace-nowrap">
                  Média
                </td>
                <td className="px-3 py-2 text-center font-bold text-xs text-slate-400">
                  —
                </td>
                {columnAverages.map((avg, idx) => (
                  <td key={idx} className="px-1 py-1.5 text-center">
                    {avg !== null ? (
                      <div
                        className={`rounded-lg px-2 py-1.5 ${getHeatmapColor(avg)}`}
                      >
                        <span className="text-[11px] font-black">{avg}%</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-300 dark:text-slate-600 font-black">
                        —
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap items-center gap-3 px-6 pb-5">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Escala:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { color: "bg-rose-100", label: "<5%" },
              { color: "bg-orange-200", label: "5%" },
              { color: "bg-amber-200", label: "10%" },
              { color: "bg-amber-300", label: "15%" },
              { color: "bg-emerald-300", label: "25%" },
              { color: "bg-emerald-400", label: "40%" },
              { color: "bg-emerald-500", label: "60%" },
              { color: "bg-emerald-600", label: "80%+" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded ${item.color}`} />
                <span className="text-[9px] text-slate-400 font-medium">
                  {item.label}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-1 ml-1">
              <div className="w-3 h-3 rounded border border-dashed border-slate-300" />
              <span className="text-[9px] text-slate-400 font-medium">n/d</span>
            </div>
          </div>
        </div>
      </div>

      <CohortClientsDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedCell(null);
        }}
        selected={selectedCell}
        startDate={startDate}
        endDate={endDate}
      />
    </>
  );
}
