import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, FilterX } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";

interface OrdersFiltersProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (dateRange: DateRange | undefined) => void;
  isLoading?: boolean;
}

export function OrdersFilters({
  dateRange,
  onDateRangeChange,
  isLoading,
}: OrdersFiltersProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handleClearFilters = () => {
    // Default to last 7 days
    const today = new Date();
    const last7Days = new Date();
    last7Days.setDate(today.getDate() - 7);
    
    onDateRangeChange({
      from: last7Days,
      to: today,
    });
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[260px] justify-start text-left font-normal",
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
                // Don't close immediately to allow selecting the end date
              }}
              numberOfMonths={2}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="h-8 px-2 lg:px-3"
          disabled={isLoading}
        >
          <FilterX className="mr-2 h-4 w-4" />
          Limpar
        </Button>
      </div>
      {/* 
        Future implementation: 
        Add more filters here for Status, Seller, etc. 
      */}
    </div>
  );
}
