import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterX, Search, SlidersHorizontal, Briefcase, Store, CheckCircle2, Hash } from "lucide-react";
import { type OrderSource } from "@/hooks/use-unified-orders";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

interface SellerUserOption {
  id: string;
  name: string;
  isActive: string;
}

export type OrderSituation = "all" | "concluido" | "nao_concluido";

interface OrdersFiltersProps {
  contactName?: string;
  onContactNameChange: (name: string) => void;

  orderNumber?: string;
  onOrderNumberChange: (value: string) => void;

  sellerId?: string;
  onSellerIdChange: (id: string | undefined) => void;
  hideSeller?: boolean;

  source?: OrderSource;
  onSourceChange: (source: OrderSource) => void;

  situation?: OrderSituation;
  onSituationChange: (situation: OrderSituation) => void;

  minValue?: number;
  onMinValueChange: (value: number | undefined) => void;

  maxValue?: number;
  onMaxValueChange: (value: number | undefined) => void;

  isLoading?: boolean;
}

export function OrdersFilters({
  contactName,
  onContactNameChange,
  orderNumber,
  onOrderNumberChange,
  sellerId,
  onSellerIdChange,
  hideSeller = false,
  source = "all",
  onSourceChange,
  situation = "all",
  onSituationChange,
  minValue,
  onMinValueChange,
  maxValue,
  onMaxValueChange,
  isLoading,
}: OrdersFiltersProps) {
  const { data: sellers = [], isLoading: isSellersLoading } = useQuery<
    SellerUserOption[]
  >({
    queryKey: ["/api/users"],
    select: (users) =>
      users
        .filter((user) => user.isActive === "true")
        .sort((left, right) => left.name.localeCompare(right.name)),
  });

  const handleClearFilters = () => {
    onContactNameChange("");
    onOrderNumberChange("");
    onSellerIdChange(undefined);
    onSourceChange("all");
    onSituationChange("all");
    onMinValueChange(undefined);
    onMaxValueChange(undefined);
  };

  const hasActiveFilters =
    contactName ||
    orderNumber ||
    sellerId ||
    source !== "all" ||
    situation !== "all" ||
    minValue !== undefined ||
    maxValue !== undefined;

  return (
    <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
      <CardContent className="p-5 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-xl text-blue-600 dark:text-blue-400">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
              Filtros da Tabela
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

        {/* Row 1: Cliente, Nº Pedido, Vendedor, Origem, Situação */}
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${hideSeller ? "lg:grid-cols-4" : "lg:grid-cols-5"}`}>
          {/* Client Name Search */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
              Cliente
            </label>
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

          {/* Order Number Search */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
              Nº Pedido (Bling)
            </label>
            <div className="relative">
              <Hash className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Ex: 12345..."
                value={orderNumber || ""}
                onChange={(e) => onOrderNumberChange(e.target.value)}
                className="w-full pl-11 h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 rounded-xl font-medium focus-visible:ring-blue-500"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Seller Select — oculto quando o vendedor é fixado pelo contexto */}
          {!hideSeller && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                Vendedor
              </label>
              <Select
                value={sellerId || "all"}
                onValueChange={(val) => onSellerIdChange(val === "all" ? undefined : val)}
                disabled={isSellersLoading || isLoading}
              >
                <SelectTrigger className="w-full h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 rounded-xl px-4 font-bold transition-all hover:border-slate-300 dark:hover:border-slate-600">
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-4 w-4 text-emerald-500" />
                    <SelectValue placeholder={isSellersLoading ? "Carregando..." : "Todos os Vendedores"} />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800">
                  <SelectItem value="all" className="rounded-xl font-bold">
                    Todos os Vendedores
                  </SelectItem>
                  {sellers.map((seller) => (
                    <SelectItem
                      key={seller.id}
                      value={seller.id}
                      className="rounded-xl"
                    >
                      <span className="font-medium">{seller.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Origem Select */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
              Origem
            </label>
            <Select
              value={source}
              onValueChange={(val) => onSourceChange(val as OrderSource)}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 rounded-xl px-4 font-bold transition-all hover:border-slate-300 dark:hover:border-slate-600">
                <div className="flex items-center gap-3">
                  <Store className="h-4 w-4 text-violet-500" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800">
                <SelectItem value="all" className="rounded-xl font-bold">Todos</SelectItem>
                <SelectItem value="bling" className="rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-sm bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[9px] font-black">B</span>
                    Bling
                  </div>
                </SelectItem>
                <SelectItem value="connect" className="rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-sm bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 text-[9px] font-black">C</span>
                    Connect
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Situação Select */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
              Situação
            </label>
            <Select
              value={situation}
              onValueChange={(val) => onSituationChange(val as OrderSituation)}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 rounded-xl px-4 font-bold transition-all hover:border-slate-300 dark:hover:border-slate-600">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800">
                <SelectItem value="all" className="rounded-xl font-bold">
                  Todas as situações
                </SelectItem>
                <SelectItem value="concluido" className="rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    Concluídos
                  </div>
                </SelectItem>
                <SelectItem value="nao_concluido" className="rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                    Não concluídos (Bling)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Range de Valor */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
            Range de Valor (R$)
          </label>
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                DE
              </span>
              <Input
                type="number"
                placeholder="0,00"
                value={minValue ?? ""}
                onChange={(e) =>
                  onMinValueChange(
                    e.target.value ? parseFloat(e.target.value) : undefined,
                  )
                }
                className="w-full pl-10 h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 rounded-xl font-bold"
                disabled={isLoading}
              />
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                ATÉ
              </span>
              <Input
                type="number"
                placeholder="∞"
                value={maxValue ?? ""}
                onChange={(e) =>
                  onMaxValueChange(
                    e.target.value ? parseFloat(e.target.value) : undefined,
                  )
                }
                className="w-full pl-10 h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 rounded-xl font-bold"
                disabled={isLoading}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
