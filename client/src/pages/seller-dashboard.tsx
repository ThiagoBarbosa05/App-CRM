import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { CalendarIcon, TrendingUp, Upload, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConnectCsvImportModal } from "@/components/connect-sales/connect-csv-import-modal";
import { IndividualSellerView } from "@/components/seller-dashboard/individual-seller-view";
import { AggregateView } from "@/components/seller-dashboard/aggregate-view";
import { CashbackCohortSection } from "@/components/seller-dashboard/cashback-cohort-section";
import { OrdersSection } from "@/components/seller-dashboard/orders-section";

interface UserOption {
  id: string;
  name: string;
  role: string;
  isActive: string;
  blingVendedorId: string | null;
}

export default function SellerDashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "gerente";

  const [selectedSellerId, setSelectedSellerId] = useState<string>("all");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [connectImportOpen, setConnectImportOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const now = new Date();
    return { from: startOfMonth(now), to: endOfMonth(now) };
  });

  const startDate = useMemo(
    () =>
      dateRange?.from
        ? format(dateRange.from, "yyyy-MM-dd")
        : format(startOfMonth(new Date()), "yyyy-MM-dd"),
    [dateRange?.from],
  );
  const endDate = useMemo(
    () => (dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : startDate),
    [dateRange?.to, startDate],
  );

  const { data: usersList = [] } = useQuery<UserOption[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin,
    select: (users) =>
      users
        .filter((u) => u.isActive === "true")
        .sort((a, b) => a.name.localeCompare(b.name)),
  });

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-slate-950 border-b mb-6 border-gray-200 dark:border-slate-800 px-4 sm:px-6 py-4 rounded-lg shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <TrendingUp className="size-6 shrink-0 text-blue-600 dark:text-blue-400" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              Dashboard Vendedor
            </h2>
            <p className="text-gray-600 dark:text-slate-400 mt-1">
              Visão geral de performance e carteira de clientes
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
          {/* Filtro de datas */}
          <div className="flex flex-col items-start gap-1">
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="rounded-lg border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium h-9 px-3"
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <span>
                        {format(dateRange.from, "dd/MM/yy")} —{" "}
                        {format(dateRange.to, "dd/MM/yy")}
                      </span>
                    ) : (
                      format(dateRange.from, "dd/MM/yy")
                    )
                  ) : (
                    <span>Selecione um período</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={(range) => {
                    setDateRange(range);
                    if (range?.from && range?.to) setIsCalendarOpen(false);
                  }}
                  numberOfMonths={2}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-slate-400">
              Afeta gráficos e métricas do período
            </p>
          </div>

          {/* Seletor de vendedor (apenas admin/gerente) */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" />
              <Select
                value={selectedSellerId}
                onValueChange={setSelectedSellerId}
              >
                <SelectTrigger className="w-52 rounded-lg border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium">
                  <SelectValue placeholder="Selecionar vendedor" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="font-semibold">
                    Todos os vendedores
                  </SelectItem>
                  {usersList.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Importar CSV */}
          <Button
            onClick={() => setConnectImportOpen(true)}
            className="gap-2 bg-violet-600 hover:bg-violet-700 rounded-xl h-9 px-4 text-sm font-bold shrink-0"
          >
            <Upload className="h-3.5 w-3.5" />
            Importar CSV
          </Button>
        </div>
      </div>

      <ConnectCsvImportModal
        open={connectImportOpen}
        onOpenChange={setConnectImportOpen}
      />

      {/* Conteúdo principal */}
      {isAdmin ? (
        selectedSellerId === "all" ? (
          <AggregateView startDate={startDate} endDate={endDate} />
        ) : (
          <IndividualSellerView
            sellerId={selectedSellerId}
            isOwnView={selectedSellerId === user?.id}
            startDate={startDate}
            endDate={endDate}
          />
        )
      ) : (
        user && (
          <IndividualSellerView
            sellerId={user.id}
            isOwnView={true}
            startDate={startDate}
            endDate={endDate}
          />
        )
      )}

      {/* Seções migradas do Bling Sales */}
      <CashbackCohortSection startDate={startDate} endDate={endDate} />
      <OrdersSection startDate={startDate} endDate={endDate} />
    </div>
  );
}
