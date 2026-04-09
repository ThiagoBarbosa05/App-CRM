import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useClientReports, useGeneralReports } from "@/hooks/useReports";
import {
  useSalesStatistics,
  useTopSellers,
  useTopProducts,
} from "@/hooks/use-bling-orders";

// Components
import { ReportsHeader } from "@/components/reports/reports-header";
import { ReportsStatistics } from "@/components/reports/reports-statistics";
import { ReportsBirthdayList } from "@/components/reports/reports-birthday-list";
import { ClientReportsGrid } from "@/components/reports/client-reports-grid";
import { ReportsDataCoverage } from "@/components/reports/reports-data-coverage";
import { ReportsSalesOverview } from "@/components/reports/reports-sales-overview";

export default function Reports() {
  const today = new Date();
  const startDate = format(startOfMonth(today), "yyyy-MM-dd");
  const endDate = format(endOfMonth(today), "yyyy-MM-dd");
  const monthLabel = format(today, "MMMM 'de' yyyy", { locale: ptBR });

  const { data: clientReports, isLoading: isClientReportsLoading } =
    useClientReports();
  const { data: generalReports, isLoading: isGeneralReportsLoading } =
    useGeneralReports();

  const { data: salesStats, isLoading: isSalesLoading } = useSalesStatistics(
    startDate,
    endDate,
  );
  const { data: topSellers, isLoading: isTopSellersLoading } = useTopSellers(
    startDate,
    endDate,
    5,
  );
  const { data: topProducts, isLoading: isTopProductsLoading } = useTopProducts(
    startDate,
    endDate,
    5,
  );

  const isSalesDataLoading =
    isSalesLoading || isTopSellersLoading || isTopProductsLoading;

  if (isClientReportsLoading || isGeneralReportsLoading) {
    return (
      <div className="space-y-6 animate-pulse p-6">
        <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl"
            />
          ))}
        </div>
        <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <ReportsHeader />

      <ReportsStatistics
        totalClients={clientReports?.totalClients ?? 0}
        upcomingBirthdaysCount={clientReports?.upcomingBirthdays.length ?? 0}
        newClientsThisMonth={
          generalReports?.recentStats.newClientsThisMonth ?? 0
        }
        totalInteractionsThisMonth={
          generalReports?.recentStats.totalInteractionsThisMonth ?? 0
        }
        clientGrowthPercent={
          generalReports?.growthStats.clientGrowthPercent ?? 0
        }
        interactionGrowthPercent={
          generalReports?.growthStats.interactionGrowthPercent ?? 0
        }
      />

      <div className="grid grid-cols-1 gap-8">
        <ClientReportsGrid
          clientsByCategory={clientReports?.clientsByCategory ?? []}
          clientsByOrigin={clientReports?.clientsByOrigin ?? []}
          clientsByUser={clientReports?.clientsByUser ?? []}
          clientsByMarkers={clientReports?.clientsByMarkers ?? []}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ReportsDataCoverage
            totalClients={clientReports?.totalClients ?? 0}
            clientsWithEmail={clientReports?.clientsWithEmail ?? 0}
            clientsWithPhone={clientReports?.clientsWithPhone ?? 0}
            clientsWithCPF={clientReports?.clientsWithCPF ?? 0}
            clientsWithAddress={clientReports?.clientsWithAddress ?? 0}
          />
          <ReportsBirthdayList
            upcomingBirthdays={clientReports?.upcomingBirthdays ?? []}
          />
        </div>

        <ReportsSalesOverview
          salesStats={salesStats}
          topSellers={topSellers}
          topProducts={topProducts}
          isLoading={isSalesDataLoading}
          monthLabel={monthLabel}
        />
      </div>
    </div>
  );
}
