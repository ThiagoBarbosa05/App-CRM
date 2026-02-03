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
import { CalendarIcon, FilterX, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import {
  useAvailableSellers,
  useAvailableStores,
  useAvailableSituations,
} from "@/hooks/use-bling-orders";

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
  isLoading,
}: OrdersFiltersProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Fetch filter options
  const { data: sellers } = useAvailableSellers();
  const { data: stores } = useAvailableStores();
  const { data: situations } = useAvailableSituations();

  const handleClearFilters = () => {
    // Default to last 90 days
    const today = new Date();
    const last90Days = new Date();
    last90Days.setDate(today.getDate() - 90);

    onDateRangeChange({
      from: last90Days,
      to: today,
    });
    onContactNameChange("");
    onSellerIdChange(undefined);
    onStoreIdChange(undefined);
    onSituationIdChange(undefined);
  };

  const hasActiveFilters =
    contactName ||
    sellerId ||
    storeId ||
    situationId;

  return (
    <Card className="border-none shadow-none bg-muted/40 md:bg-background md:border md:shadow-sm">
      <CardContent className="p-0 md:p-4 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" />
            <span>Filtros</span>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-8 px-2 lg:px-3 text-muted-foreground hover:text-foreground"
              disabled={isLoading}
            >
              <FilterX className="mr-2 h-4 w-4" />
              Limpar filtros
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {/* Date Picker */}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal bg-background",
                  !dateRange && "text-muted-foreground"
                )}
                disabled={isLoading}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "dd/MM/yyyy")} -{" "}
                      {format(dateRange.to, "dd/MM/yyyy")}
                    </>
                  ) : (
                    format(dateRange.from, "dd/MM/yyyy")
                  )
                ) : (
                  <span>Selecione um período</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={(range) => {
                  onDateRangeChange(range);
                }}
                numberOfMonths={2}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          {/* Client Name Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={contactName || ""}
              onChange={(e) => onContactNameChange(e.target.value)}
              className="w-full pl-9 bg-background"
              disabled={isLoading}
            />
          </div>

          {/* Seller Select */}
          <Select
            value={sellerId || "all"}
            onValueChange={(value) =>
              onSellerIdChange(value === "all" ? undefined : value)
            }
            disabled={isLoading}
          >
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder="Todos os Vendedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Vendedores</SelectItem>
              {sellers?.map((seller) => (
                <SelectItem
                  key={seller.sellerId || "unknown"}
                  value={seller.sellerId || "unknown"}
                >
                  {seller.sellerName || "Sem nome"} ({seller.orderCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Store Select */}
          <Select
            value={storeId || "all"}
            onValueChange={(value) =>
              onStoreIdChange(value === "all" ? undefined : value)
            }
            disabled={isLoading}
          >
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder="Todas as Lojas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Lojas</SelectItem>
              {stores?.map((store) => (
                <SelectItem key={store.storeId} value={store.storeId}>
                  Loja {store.storeId} ({store.orderCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Situation Select */}
          <Select
            value={situationId || "all"}
            onValueChange={(value) =>
              onSituationIdChange(value === "all" ? undefined : value)
            }
            disabled={isLoading}
          >
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder="Todas as Situações" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Situações</SelectItem>
              {situations?.map((situation) => (
                <SelectItem
                  key={situation.situationId || "unknown"}
                  value={situation.situationId || "unknown"}
                >
                  {situation.situationValue || "Sem status"} ({situation.orderCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

