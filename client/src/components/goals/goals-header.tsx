import { Target, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { useLocation } from "wouter";

interface GoalsHeaderProps {
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  isAdmin?: boolean;
}

export function GoalsHeader({
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  isAdmin,
}: GoalsHeaderProps) {
  const [, navigate] = useLocation();
  const currentDate = new Date();
  const selectedDate = new Date(selectedYear, selectedMonth - 1);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 sm:px-6 py-5 rounded-2xl shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 dark:bg-blue-400/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex-shrink-0 shadow-inner">
            <Target className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
              Análise de Metas
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 truncate">
              Acompanhe o progresso das metas em{" "}
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-wrap items-center gap-4 w-full md:w-auto"
        >
          {isAdmin && (
            <Button
              onClick={() => navigate("/admin-metas")}
              className="h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest gap-2 shadow-sm shadow-blue-500/20 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova Meta
            </Button>
          )}
          <div className="flex items-center gap-3">
            <Label htmlFor="month-select" className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Mês</Label>
            <select
              id="month-select"
              value={selectedMonth}
              onChange={(e) => onMonthChange(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {new Date(0, month - 1).toLocaleDateString("pt-BR", {
                    month: "long",
                  })}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <Label htmlFor="year-select" className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Ano</Label>
            <select
              id="year-select"
              value={selectedYear}
              onChange={(e) => onYearChange(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
            >
              {Array.from(
                { length: 5 },
                (_, i) => currentDate.getFullYear() - 2 + i
              ).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
