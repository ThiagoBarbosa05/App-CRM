import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { TopClient } from "@/hooks/use-bling-orders";
import { Crown, Medal, Award, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TopClientsPanelProps {
  data?: TopClient[];
  isLoading: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), "dd/MM/yy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-white shadow">
      <Crown className="h-3.5 w-3.5" />
    </span>
  );
  if (rank === 2) return (
    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-400 text-white shadow">
      <Medal className="h-3.5 w-3.5" />
    </span>
  );
  if (rank === 3) return (
    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-600 text-white shadow">
      <Award className="h-3.5 w-3.5" />
    </span>
  );
  return (
    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold">
      {rank}
    </span>
  );
}

export function TopClientsPanel({ data, isLoading }: TopClientsPanelProps) {
  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-[200px]" />
          <Skeleton className="h-4 w-[280px] mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-violet-600" />
            Top 20 Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-muted-foreground text-sm">
            Nenhum dado disponível para o período selecionado
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxValue = data[0]?.totalValue ?? 1;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-violet-600" />
          Top 20 Clientes
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Clientes com maior volume de compras no período
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-2.5 text-left font-black text-[10px] uppercase tracking-widest text-slate-400 w-10">#</th>
                <th className="px-3 py-2.5 text-left font-black text-[10px] uppercase tracking-widest text-slate-400">Cliente</th>
                <th className="px-3 py-2.5 text-center font-black text-[10px] uppercase tracking-widest text-slate-400">Pedidos</th>
                <th className="px-3 py-2.5 text-center font-black text-[10px] uppercase tracking-widest text-slate-400">Ticket Médio</th>
                <th className="px-3 py-2.5 text-right font-black text-[10px] uppercase tracking-widest text-slate-400">Total</th>
                <th className="px-3 py-2.5 text-right font-black text-[10px] uppercase tracking-widest text-slate-400 hidden sm:table-cell">Última Compra</th>
              </tr>
            </thead>
            <tbody>
              {data.map((client) => {
                const barWidth = Math.max(4, (client.totalValue / maxValue) * 100);
                return (
                  <tr
                    key={client.contactId}
                    className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="px-4 py-2.5">
                      <RankBadge rank={client.rank} />
                    </td>
                    <td className="px-3 py-2.5 min-w-[180px]">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[220px]" title={client.contactName}>
                          {client.contactName}
                        </span>
                        <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              client.rank === 1 ? "bg-amber-400" :
                              client.rank === 2 ? "bg-slate-400" :
                              client.rank === 3 ? "bg-amber-600" :
                              "bg-violet-400"
                            }`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge variant="secondary" className="text-[10px] font-bold px-2">
                        {client.totalOrders}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {formatCurrency(client.avgValue)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`text-xs font-black ${
                        client.rank <= 3 ? "text-violet-600 dark:text-violet-400" : "text-slate-700 dark:text-slate-300"
                      }`}>
                        {formatCurrency(client.totalValue)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[11px] text-slate-400 font-medium hidden sm:table-cell">
                      {formatDate(client.lastOrder)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
