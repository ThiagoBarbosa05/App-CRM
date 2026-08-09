import { useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type DatePreset =
  | "hoje"
  | "dia"
  | "este-mes"
  | "mes-passado"
  | "periodo";

function presetButtonClass(isSelected: boolean) {
  return `inline-flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-lg text-sm transition-all duration-200 outline-none border ${
    isSelected
      ? "font-semibold text-primary bg-accent border-border"
      : "font-medium text-muted-foreground border-transparent hover:text-foreground hover:bg-accent"
  }`;
}

/**
 * Estado do filtro de período compartilhado pelo Dashboard e pela página de
 * Pedidos: presets rápidos, dia avulso e intervalo customizado, já formatados
 * em `yyyy-MM-dd` para as queries.
 *
 * `dateFilterProps` é feito para ser espalhado direto no `<DateRangeFilter>`.
 */
export function useDateRangeFilter() {
  const [datePreset, setDatePreset] = useState<DatePreset>("este-mes");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [singleDay, setSingleDay] = useState<Date | undefined>();

  const dateRange = useMemo<DateRange>(() => {
    const now = new Date();
    if (datePreset === "hoje")
      return { from: startOfDay(now), to: endOfDay(now) };
    // Sem dia escolhido o preset se comporta como "hoje" — o botão já preenche
    // a data ao ser ativado, então isso é só uma rede de segurança.
    if (datePreset === "dia") {
      const day = singleDay ?? now;
      return { from: startOfDay(day), to: endOfDay(day) };
    }
    if (datePreset === "mes-passado") {
      const prev = subMonths(now, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    if (datePreset === "periodo" && customRange?.from)
      return { from: customRange.from, to: customRange.to ?? customRange.from };
    return { from: startOfMonth(now), to: endOfDay(now) };
  }, [datePreset, customRange, singleDay]);

  const startDate = useMemo(
    () => format(dateRange.from!, "yyyy-MM-dd"),
    [dateRange.from],
  );
  const endDate = useMemo(
    () => format(dateRange.to!, "yyyy-MM-dd"),
    [dateRange.to],
  );

  // Quando o filtro é "Este mês", compara contra o mesmo intervalo do mês anterior
  // (ex: 01/05–13/05 compara com 01/04–13/04, não com 18/04–30/04)
  const { prevStartDate, prevEndDate } = useMemo(() => {
    if (datePreset !== "este-mes")
      return { prevStartDate: undefined, prevEndDate: undefined };
    return {
      prevStartDate: format(subMonths(dateRange.from!, 1), "yyyy-MM-dd"),
      prevEndDate: format(subMonths(dateRange.to!, 1), "yyyy-MM-dd"),
    };
  }, [datePreset, dateRange.from, dateRange.to]);

  return {
    startDate,
    endDate,
    prevStartDate,
    prevEndDate,
    dateFilterProps: {
      datePreset,
      onPresetChange: setDatePreset,
      customRange,
      onCustomRangeChange: setCustomRange,
      singleDay,
      onSingleDayChange: setSingleDay,
    } satisfies DateRangeFilterProps,
  };
}

interface DateRangeFilterProps {
  datePreset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
  customRange: DateRange | undefined;
  onCustomRangeChange: (range: DateRange | undefined) => void;
  singleDay: Date | undefined;
  onSingleDayChange: (day: Date | undefined) => void;
}

export function DateRangeFilter({
  datePreset,
  onPresetChange,
  customRange,
  onCustomRangeChange,
  singleDay,
  onSingleDayChange,
}: DateRangeFilterProps) {
  const [isDayOpen, setIsDayOpen] = useState(false);
  const [isRangeOpen, setIsRangeOpen] = useState(false);

  return (
    <div className="overflow-x-auto max-w-full">
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm min-w-max">
        <button
          onClick={() => onPresetChange("hoje")}
          className={presetButtonClass(datePreset === "hoje")}
        >
          Hoje
        </button>

        {/* Dia avulso — seleção única */}
        <Popover open={isDayOpen} onOpenChange={setIsDayOpen}>
          <PopoverTrigger asChild>
            <button
              onClick={() => {
                onPresetChange("dia");
                if (!singleDay) onSingleDayChange(new Date());
              }}
              className={presetButtonClass(datePreset === "dia")}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {datePreset === "dia" && singleDay
                ? format(singleDay, "dd/MM/yy")
                : "Dia"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarComponent
              initialFocus
              mode="single"
              defaultMonth={singleDay ?? new Date()}
              selected={singleDay}
              onSelect={(day) => {
                if (!day) return;
                onSingleDayChange(day);
                onPresetChange("dia");
                setIsDayOpen(false);
              }}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        <button
          onClick={() => onPresetChange("este-mes")}
          className={presetButtonClass(datePreset === "este-mes")}
        >
          Este mês
        </button>

        <button
          onClick={() => onPresetChange("mes-passado")}
          className={presetButtonClass(datePreset === "mes-passado")}
        >
          Mês passado
        </button>

        {/* Intervalo customizado */}
        <Popover open={isRangeOpen} onOpenChange={setIsRangeOpen}>
          <PopoverTrigger asChild>
            <button
              onClick={() => onPresetChange("periodo")}
              className={presetButtonClass(datePreset === "periodo")}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {datePreset === "periodo" && customRange?.from ? (
                <span>
                  {format(customRange.from, "dd/MM/yy")}
                  {customRange.to &&
                    customRange.to !== customRange.from &&
                    ` — ${format(customRange.to, "dd/MM/yy")}`}
                </span>
              ) : (
                "Período"
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarComponent
              initialFocus
              mode="range"
              defaultMonth={customRange?.from ?? new Date()}
              selected={customRange}
              onSelect={(range) => {
                onCustomRangeChange(range);
                if (range?.from && range?.to) setIsRangeOpen(false);
              }}
              numberOfMonths={2}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
