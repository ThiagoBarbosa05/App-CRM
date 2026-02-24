import { motion } from "framer-motion";
import { Target, Users, DollarSign, Package } from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface AdminGoalsHeaderProps {
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  stats: {
    totalUsers: number;
    metasDefinidas: number;
    metaTotal: number;
    ticketMedio: number;
  };
  onNewGoal: () => void;
  disableNewGoal: boolean;
}

export function AdminGoalsHeader({
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  stats,
  onNewGoal,
  disableNewGoal
}: AdminGoalsHeaderProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const getColorClasses = (color: string) => {
    switch (color) {
      case "blue": 
        return "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 ring-blue-100 dark:ring-blue-900/30";
      case "emerald": 
        return "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 ring-emerald-100 dark:ring-emerald-900/30";
      case "indigo": 
        return "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 ring-indigo-100 dark:ring-indigo-900/30";
      case "amber": 
        return "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 ring-amber-100 dark:ring-amber-900/30";
      default: 
        return "bg-slate-50 dark:bg-slate-900/20 text-slate-600 dark:text-slate-400 ring-slate-100 dark:ring-slate-900/30";
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Section: Title & Date Selectors */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 px-8 py-10 rounded-[2.5rem] shadow-sm"
      >
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-500/5 rounded-full blur-[100px]" />
        
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-xl shadow-blue-500/20 ring-4 ring-blue-50 dark:ring-blue-900/20">
              <Target className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                Administração de <span className="text-blue-600 dark:text-blue-400">Metas</span>
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
                Gestão estratégica de performance comercial e operacional
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl">
              <div className="flex items-center gap-2 pl-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mês</Label>
                <select
                  value={selectedMonth}
                  onChange={(e) => onMonthChange(Number(e.target.value))}
                  className="bg-transparent text-sm font-bold focus:outline-none min-w-[100px]"
                >
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {new Date(0, m - 1).toLocaleDateString("pt-BR", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
              <div className="flex items-center gap-2 pr-4 pl-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ano</Label>
                <select
                  value={selectedYear}
                  onChange={(e) => onYearChange(Number(e.target.value))}
                  className="bg-transparent text-sm font-bold focus:outline-none"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <Button
              onClick={onNewGoal}
              disabled={disableNewGoal}
              className="h-14 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all active:scale-95 gap-2"
            >
              <Target className="h-5 w-5" />
              <span className="font-black uppercase text-xs tracking-widest">Nova Meta</span>
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { 
            label: "Total de Usuários", 
            value: stats.totalUsers, 
            icon: Users, 
            color: "blue",
            sub: "Usuários cadastrados"
          },
          { 
            label: "Metas Definidas", 
            value: stats.metasDefinidas, 
            icon: Target, 
            color: "emerald",
            sub: "Usuários com metas"
          },
          { 
            label: "Meta Total", 
            value: formatCurrency(stats.metaTotal), 
            icon: DollarSign, 
            color: "indigo",
            sub: "Soma das metas"
          },
          { 
            label: "Ticket Médio", 
            value: formatCurrency(stats.ticketMedio), 
            icon: Package, 
            color: "amber",
            sub: "Média do período"
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.1 }}
          >
            <Card className="group relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300">
              <div className={`absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none`}>
                <stat.icon className="h-24 w-24" />
              </div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {stat.label}
                </CardTitle>
                <div className={`p-2.5 rounded-xl ring-1 ${getColorClasses(stat.color)}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {stat.value}
                </div>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight">
                  {stat.sub}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
