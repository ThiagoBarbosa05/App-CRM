import { Badge } from "@/components/ui/badge";
import {
  useCashbackStatistics,
  useCohortAnalysis,
} from "@/hooks/use-bling-orders";
import { CashbackStatisticsCards } from "@/components/bling-sales/cashback-statistics-cards";
import { CohortAnalysisTable } from "@/components/bling-sales/cohort-analysis-table";

function SectionLabel({
  label,
  blingOnly = false,
}: {
  label: string;
  blingOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
        {label}
      </h2>
      {blingOnly && (
        <Badge
          variant="secondary"
          className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-100 dark:border-green-800 h-auto"
        >
          Somente Bling
        </Badge>
      )}
      <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

export function CashbackCohortSection({
  startDate,
  endDate,
  userId,
}: {
  startDate: string;
  endDate: string;
  userId?: string;
}) {
  const { data: cashbackStats, isLoading: isCashbackStatsLoading } =
    useCashbackStatistics(startDate, endDate, userId);
  const { data: cohortData, isLoading: isCohortLoading } = useCohortAnalysis(
    startDate,
    endDate,
    userId,
  );

  return (
    <>
      <section className="space-y-3">
        <SectionLabel label="Cashback & Clientes Vinculados" blingOnly />
        <CashbackStatisticsCards
          data={cashbackStats}
          isLoading={isCashbackStatsLoading}
        />
      </section>

      <section className="space-y-3">
        <SectionLabel label="Análise de Cohort" blingOnly />
        <CohortAnalysisTable
          data={cohortData}
          isLoading={isCohortLoading}
          startDate={startDate}
          endDate={endDate}
        />
      </section>
    </>
  );
}
