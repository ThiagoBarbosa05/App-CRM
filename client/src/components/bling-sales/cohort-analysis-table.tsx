import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CohortData } from "@/hooks/use-bling-orders";
import { Users } from "lucide-react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CohortAnalysisTableProps {
  data?: CohortData;
  isLoading: boolean;
}

function getHeatmapColor(value: number | null): string {
  if (value === null) return "bg-slate-50 dark:bg-slate-800/30 text-slate-300 dark:text-slate-600";
  if (value >= 80) return "bg-emerald-600 text-white";
  if (value >= 60) return "bg-emerald-500 text-white";
  if (value >= 40) return "bg-emerald-400 text-white";
  if (value >= 25) return "bg-emerald-300 text-emerald-900 dark:text-emerald-950";
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

export function CohortAnalysisTable({ data, isLoading }: CohortAnalysisTableProps) {
  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-[250px]" />
          <Skeleton className="h-4 w-[350px] mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.cohorts.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-violet-600" />
            Análise de Cohort
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            Nenhum dado de cohort disponível para o período selecionado
          </div>
        </CardContent>
      </Card>
    );
  }

  const monthHeaders = Array.from({ length: data.maxMonthOffset + 1 }, (_, i) => i);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-violet-600" />
          Análise de Cohort
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Retenção de clientes agrupados pelo mês da primeira compra
        </p>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white dark:bg-slate-900 text-left px-3 py-2.5 font-black text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 min-w-[120px]">
                  Cohort
                </th>
                <th className="px-3 py-2.5 font-black text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 text-center min-w-[60px]">
                  Clientes
                </th>
                {monthHeaders.map((month) => (
                  <th
                    key={month}
                    className="px-2 py-2.5 font-black text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 text-center min-w-[65px]"
                  >
                    {month === 0 ? "Mês 0" : `Mês ${month}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cohorts.map((cohort) => (
                <tr key={cohort.cohortMonth} className="border-b border-slate-50 dark:border-slate-800/50">
                  <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-3 py-2 font-bold text-xs text-slate-700 dark:text-slate-300 capitalize whitespace-nowrap">
                    {formatCohortMonth(cohort.cohortMonth)}
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-xs text-slate-600 dark:text-slate-400">
                    {cohort.cohortSize}
                  </td>
                  {cohort.retention.map((value, idx) => (
                    <td key={idx} className="px-1 py-1.5 text-center">
                      <div
                        className={`rounded-lg px-2 py-1.5 text-[11px] font-black transition-all ${getHeatmapColor(value)}`}
                      >
                        {value !== null ? `${value}%` : "—"}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-4 mt-4 px-3 pb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Escala:</span>
          <div className="flex items-center gap-1.5">
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
                <span className="text-[9px] text-slate-400 font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
