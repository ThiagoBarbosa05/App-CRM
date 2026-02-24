import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, FilterX, Search, SlidersHorizontal, Briefcase, Store, Activity, CreditCard } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import {
  useAvailableSellers,
  useAvailableStores,
  useAvailableSituations,
  useAvailablePaymentMethods,
} from "@/hooks/use-bling-orders";
import { motion, AnimatePresence } from "framer-motion";

interface OrdersFiltersProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (dateRange: DateRange | undefined) => void;

  contactName?: string;
  onContactNameChange: (name: string) => void;

  sellerId?: string;
  onSellerIdChange: (id: string | undefined) => void;

  storeId?: string;
  onStoreIdChange: (id: string | undefined) => void;

  situationId?: string;
  onSituationIdChange: (id: string | undefined) => void;

  minValue?: number;
  onMinValueChange: (value: number | undefined) => void;

  maxValue?: number;
  onMaxValueChange: (value: number | undefined) => void;

  paymentMethodId?: string;
  onPaymentMethodIdChange: (id: string | undefined) => void;

  isLoading?: boolean;
}

export function OrdersFilters({
  dateRange,
  onDateRangeChange,
  contactName,
  onContactNameChange,
  sellerId,
  onSellerIdChange,
  storeId,
  onStoreIdChange,
  situationId,
  onSituationIdChange,
  minValue,
  onMinValueChange,
  maxValue,
  onMaxValueChange,
  paymentMethodId,
  onPaymentMethodIdChange,
  isLoading,
}: OrdersFiltersProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Fetch filter options
  const { data: sellers, isLoading: isSellersLoading } = useAvailableSellers();
  const { data: stores, isLoading: isStoresLoading } = useAvailableStores();
  const { data: situations, isLoading: isSituationsLoading } = useAvailableSituations();
  const { data: paymentMethods, isLoading: isPaymentMethodsLoading } = useAvailablePaymentMethods();

  const handleClearFilters = () => {
    const today = new Date();
    const last90Days = new Date();
    last90Days.setDate(today.getDate() - 90);

    onDateRangeChange({ from: last90Days, to: today });
    onContactNameChange("");
    onSellerIdChange(undefined);
    onStoreIdChange(undefined);
    onSituationIdChange(undefined);
    onMinValueChange(undefined);
    onMaxValueChange(undefined);
    onPaymentMethodIdChange(undefined);
  };

  const hasActiveFilters =
    contactName ||
    sellerId ||
    storeId ||
    situationId ||
    minValue !== undefined ||
    maxValue !== undefined ||
    paymentMethodId;

  return (
    <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
      <CardContent className="p-5 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-xl text-blue-600 dark:text-blue-400">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
              Filtros Avançados
            </h3>
          </div>
          
          <AnimatePresence>
            {hasActiveFilters && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-9 px-3 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl font-bold transition-all"
                  disabled={isLoading}
                >
                  <FilterX className="mr-2 h-4 w-4" />
                  Limpar todos
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Picker */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Período</label>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-bold h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 rounded-xl px-4 transition-all hover:border-blue-400 dark:hover:border-blue-500",
                    !dateRange && "text-slate-400"
                  )}
                  disabled={isLoading}
                >
                  <CalendarIcon className="mr-3 h-4 w-4 text-blue-500" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <span className="truncate">
                        {format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}
                      </span>
                    ) : (
                      format(dateRange.from, "dd/MM/yy")
                    )
                  ) : (
                    <span>Selecione um período</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-slate-200 dark:border-slate-800" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={(range) => onDateRangeChange(range)}
                  numberOfMonths={2}
                  locale={ptBR}
                  className="rounded-2xl"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Client Name Search */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Cliente</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Nome ou CPF/CNPJ..."
                value={contactName || ""}
                onChange={(e) => onContactNameChange(e.target.value)}
                className="w-full pl-11 h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 rounded-xl font-medium focus-visible:ring-blue-500"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Seller Select */}
          <FilterSelect
            label="Vendedor"
            icon={<Briefcase className="h-4 w-4 text-emerald-500" />}
            value={sellerId}
            onValueChange={onSellerIdChange}
            options={sellers?.map(s => ({ value: s.sellerId, label: s.sellerName, count: s.orderCount }))}
            placeholder="Todos os Vendedores"
            isLoading={isSellersLoading || isLoading}
          />

          {/* Store Select */}
          <FilterSelect
            label="Loja"
            icon={<Store className="h-4 w-4 text-indigo-500" />}
            value={storeId}
            onValueChange={onStoreIdChange}
            options={stores?.map(s => ({ value: s.storeId, label: `Loja ${s.storeId}`, count: s.orderCount }))}
            placeholder="Todas as Lojas"
            isLoading={isStoresLoading || isLoading}
          />

          {/* Situation Select */}
          <FilterSelect
            label="Situação"
            icon={<Activity className="h-4 w-4 text-amber-500" />}
            value={situationId}
            onValueChange={onSituationIdChange}
            options={situations?.map(s => ({ value: s.situationId, label: s.situationValue, count: s.orderCount }))}
            placeholder="Todas as Situações"
            isLoading={isSituationsLoading || isLoading}
          />

          {/* Payment Method Select */}
          <FilterSelect
            label="Pagamento"
            icon={<CreditCard className="h-4 w-4 text-rose-500" />}
            value={paymentMethodId}
            onValueChange={onPaymentMethodIdChange}
            options={paymentMethods?.map(p => ({ value: p.paymentMethodId, label: p.paymentMethodName, count: p.orderCount }))}
            placeholder="Todas as Formas"
            isLoading={isPaymentMethodsLoading || isLoading}
          />

          {/* Range de Valor */}
          <div className="space-y-1.5 md:col-span-2 lg:col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Range de Valor (R$)</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">DE</span>
                <Input
                  type="number"
                  placeholder="0,00"
                  value={minValue ?? ""}
                  onChange={(e) => onMinValueChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="w-full pl-10 h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 rounded-xl font-bold"
                  disabled={isLoading}
                />
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">ATÉ</span>
                <Input
                  type="number"
                  placeholder="∞"
                  value={maxValue ?? ""}
                  onChange={(e) => onMaxValueChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="w-full pl-10 h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 rounded-xl font-bold"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({ label, icon, value, onValueChange, options, placeholder, isLoading }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{label}</label>
      <Select
        value={value || "all"}
        onValueChange={(val) => onValueChange(val === "all" ? undefined : val)}
        disabled={isLoading}
      >
        <SelectTrigger className="w-full h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 rounded-xl px-4 font-bold transition-all hover:border-slate-300 dark:hover:border-slate-600">
          <div className="flex items-center gap-3">
            {icon}
            <SelectValue placeholder={isLoading ? "Carregando..." : placeholder} />
          </div>
        </SelectTrigger>
        <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800">
          <SelectItem value="all" className="rounded-xl font-bold">{placeholder}</SelectItem>
          {options?.map((opt: any) => (
            <SelectItem key={opt.value || "no-val"} value={opt.value || "no-val"} className="rounded-xl">
              <div className="flex items-center justify-between w-full min-w-[150px]">
                <span className="font-medium">{opt.label || "Não definido"}</span>
                <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md text-[10px] font-black text-slate-500 ml-2">
                  {opt.count}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
