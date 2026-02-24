import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { motion } from "framer-motion";

interface SalesStatisticsCardsProps {
  totalOrders?: number;
  totalValue?: number;
  averageValue?: number;
  ordersChange?: number;
  valueChange?: number;
  averageChange?: number;
  isLoading: boolean;
}

function ChangeIndicator({ change, color }: { change?: number; color: string }) {
  if (change === undefined || change === 0) {
    return (
      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
        <Minus className="h-3 w-3" />
        <span>Sem variação</span>
      </div>
    );
  }

  const isPositive = change > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  
  return (
    <div className={`flex items-center gap-1 text-xs font-black ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>
        {isPositive ? "+" : ""}{change.toFixed(1)}% <span className="font-medium opacity-70">vs anterior</span>
      </span>
    </div>
  );
}

export function SalesStatisticsCards({
  totalOrders = 0,
  totalValue = 0,
  averageValue = 0,
  ordersChange,
  valueChange,
  averageChange,
  isLoading,
}: SalesStatisticsCardsProps) {
  const stats = [
    {
      title: "Volume de Pedidos",
      value: totalOrders,
      change: ordersChange,
      icon: <Package className="h-5 w-5" />,
      color: "blue",
      isCurrency: false,
    },
    {
      title: "Faturamento Total",
      value: totalValue,
      change: valueChange,
      icon: <DollarSign className="h-5 w-5" />,
      color: "emerald",
      isCurrency: true,
    },
    {
      title: "Ticket Médio",
      value: averageValue,
      change: averageChange,
      icon: <TrendingUp className="h-5 w-5" />,
      color: "purple",
      isCurrency: true,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-3xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ y: -5 }}
        >
          <Card className={`group relative overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 rounded-3xl bg-white dark:bg-slate-900 border-b-4 border-b-${stat.color}-500`}>
            <div className={`absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-125 transition-all duration-500 text-${stat.color}-500`}>
              {stat.icon}
            </div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-xl bg-${stat.color}-50 dark:bg-${stat.color}-900/30 text-${stat.color}-600 dark:text-${stat.color}-400 shadow-inner group-hover:scale-110 transition-transform`}>
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-black text-slate-900 dark:text-white mb-2`}>
                {stat.isCurrency ? formatCurrency(stat.value) : stat.value}
              </div>
              <ChangeIndicator change={stat.change} color={stat.color} />
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
