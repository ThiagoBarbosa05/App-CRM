import { useState } from "react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { TopClient } from "@/hooks/use-bling-orders";
import {
  Crown,
  Medal,
  Award,
  TrendingUp,
  Loader2,
  ExternalLink,
} from "lucide-react";
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
  if (rank === 1)
    return (
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-white shadow">
        <Crown className="h-3.5 w-3.5" />
      </span>
    );
  if (rank === 2)
    return (
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-400 text-white shadow">
        <Medal className="h-3.5 w-3.5" />
      </span>
    );
  if (rank === 3)
    return (
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
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loadingContactId, setLoadingContactId] = useState<string | null>(null);

  const handleClientClick = async (client: TopClient) => {
    if (loadingContactId) return;

    if (client.appClientId) {
      navigate(`/clientes/${client.appClientId}?tab=compras`);
      return;
    }

    setLoadingContactId(client.contactId);

    try {
      const params = new URLSearchParams({
        search: client.contactName,
        pageSize: "5",
      });
      const res = await fetch(`/api/clients?${params.toString()}`);
      if (!res.ok) throw new Error("Erro na busca");

      const json = await res.json();
      const clients: Array<{ id: string; name: string }> =
        json.clients ?? json.data ?? json ?? [];

      if (!Array.isArray(clients) || clients.length === 0) {
        toast({
          title: "Cliente não encontrado no CRM",
          description: `"${client.contactName}" não possui cadastro vinculado no CRM.`,
          variant: "destructive",
        });
        return;
      }

      const normalizedTarget = client.contactName.toLowerCase().trim();
      const exactMatch = clients.find(
        (c) => c.name.toLowerCase().trim() === normalizedTarget,
      );
      const bestMatch = exactMatch ?? clients[0];
      navigate(`/clientes/${bestMatch.id}?tab=compras`);
    } catch {
      toast({
        title: "Erro ao buscar cliente",
        description: "Não foi possível localizar o cliente no CRM.",
        variant: "destructive",
      });
    } finally {
      setLoadingContactId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-violet-50 dark:bg-violet-900/30 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-36 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-3 w-52 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="px-6 pb-6 space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Top 20 Clientes
          </h3>
        </div>
        <div className="flex h-[200px] items-center justify-center text-slate-400 dark:text-slate-500 text-sm font-medium">
          Nenhum dado disponível para o período selecionado
        </div>
      </div>
    );
  }

  const maxValue = data[0]?.totalValue ?? 1;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Top 20 Clientes
            </h3>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">
              Clique para ver o perfil no CRM
            </p>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <th className="px-4 py-2.5 text-left font-black text-[10px] uppercase tracking-widest text-slate-400 w-10">
                #
              </th>
              <th className="px-3 py-2.5 text-left font-black text-[10px] uppercase tracking-widest text-slate-400">
                Cliente
              </th>
              <th className="px-3 py-2.5 text-center font-black text-[10px] uppercase tracking-widest text-slate-400">
                Pedidos
              </th>
              <th className="px-3 py-2.5 text-center font-black text-[10px] uppercase tracking-widest text-slate-400 hidden md:table-cell">
                Ticket Médio
              </th>
              <th className="px-3 py-2.5 text-right font-black text-[10px] uppercase tracking-widest text-slate-400">
                Total
              </th>
              <th className="px-3 py-2.5 text-right font-black text-[10px] uppercase tracking-widest text-slate-400 hidden sm:table-cell">
                Última Compra
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((client) => {
              const barWidth = Math.max(
                4,
                (client.totalValue / maxValue) * 100,
              );
              const isRowLoading = loadingContactId === client.contactId;
              return (
                <tr
                  key={client.contactId}
                  onClick={() => handleClientClick(client)}
                  className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group cursor-pointer"
                  title={`Ver perfil de ${client.contactName}`}
                >
                  <td className="px-4 py-2.5">
                    {isRowLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                    ) : (
                      <RankBadge rank={client.rank} />
                    )}
                  </td>
                  <td className="px-3 py-2.5 min-w-[180px]">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px] group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors"
                          title={client.contactName}
                        >
                          {client.contactName}
                        </span>
                        <ExternalLink className="h-3 w-3 text-slate-300 group-hover:text-violet-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100" />
                      </div>
                      <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            client.rank === 1
                              ? "bg-amber-400"
                              : client.rank === 2
                                ? "bg-slate-400"
                                : client.rank === 3
                                  ? "bg-amber-600"
                                  : "bg-violet-400"
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-bold px-2"
                    >
                      {client.totalOrders}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs text-slate-500 dark:text-slate-400 font-medium hidden md:table-cell">
                    {formatCurrency(client.avgValue)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={`text-xs font-black ${
                        client.rank <= 3
                          ? "text-violet-600 dark:text-violet-400"
                          : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
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
    </div>
  );
}
