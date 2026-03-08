import { Plus } from "lucide-react";
import { Button } from "./ui/button";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import SaleFormModal from "./sale-form-modal";
import { SalesStatsCards } from "./sales-stats-cards";
import { SalesHistory } from "./sales-history";

interface SalesManagementProps {
  isDialogOpen: boolean;
  setIsDialogOpen: (isOpen: boolean) => void;
}

interface SalesStatistics {
  salesCount: number;
  totalSales: number;
  totalCashbackUsed: number;
  totalCashbackGenerated: number;
  netValue: number;
  averageSaleValue: number;
  period: string;
}

export function SalesManagementTab({
  isDialogOpen,
  setIsDialogOpen,
}: SalesManagementProps) {
  const {
    data: salesStatsData,
    isLoading: isSalesStatsLoading,
  } = useQuery<{ success: boolean; data: SalesStatistics }>({
    queryKey: ["/api/sales-statistics"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const salesStats = salesStatsData?.data;

  const formatCurrencyForCards = (value: string | number): string => {
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    return formatCurrency(numValue);
  };

  return (
    <div className="space-y-10 mt-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">
            Gestão de{" "}
            <span className="text-blue-600 dark:text-blue-400">Vendas</span>
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">
            Registre e acompanhe o histórico de transações da loja.
          </p>
        </div>

        <Button
          onClick={() => setIsDialogOpen(true)}
          className="h-14 px-8 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-blue-500/20 transition-all hover:-translate-y-1 active:scale-95"
        >
          <Plus className="h-5 w-5 mr-3" />
          Nova Venda
        </Button>
      </div>

      <SalesStatsCards
        statistics={salesStats}
        isLoading={isSalesStatsLoading}
        formatCurrency={formatCurrencyForCards}
      />

      <SalesHistory />

      <SaleFormModal
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </div>
  );
}
