import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, MapPin, Tag, Users, PartyPopper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/utils";

interface ClientEventsTabProps {
  clientId: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  inscrito: { label: "Inscrito", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  confirmado: { label: "Confirmado", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
  presente: { label: "Presente", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  ausente: { label: "Ausente", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  cancelado: { label: "Cancelado", className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
};

export function ClientEventsTab({ clientId }: ClientEventsTabProps) {
  const { data: clientEvents, isLoading } = useQuery<Array<{
    participantId: string;
    status: string;
    registrationDate: string | Date | null;
    numberOfParticipants: number;
    notes: string | null;
    event: {
      id: string;
      name: string;
      eventDate: string;
      location: string;
      category: string;
      pricePerPerson: string;
    };
  }>>({
    queryKey: ["/api/events/client", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/events/client/${clientId}`);
      if (!res.ok) throw new Error("Erro ao buscar eventos");
      return res.json();
    },
    enabled: !!clientId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!clientEvents || clientEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className="rounded-full bg-purple-100 dark:bg-purple-900/30 p-4">
          <PartyPopper className="h-8 w-8 text-purple-500" />
        </div>
        <p className="text-base font-medium text-slate-700 dark:text-slate-300">
          Nenhum evento registrado
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Este cliente ainda não participou de nenhum evento.
        </p>
      </div>
    );
  }

  const attended = clientEvents.filter((e) => e.status === "presente").length;
  const total = clientEvents.length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{total}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Total de eventos</p>
        </div>
        <div className="rounded-xl border border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/20 p-4 text-center">
          <p className="text-2xl font-bold text-green-700 dark:text-green-400">{attended}</p>
          <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">Presenças confirmadas</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {total > 0 ? Math.round((attended / total) * 100) : 0}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Taxa de presença</p>
        </div>
      </div>

      {/* Event list */}
      <div className="space-y-3">
        {clientEvents.map((item) => {
          const statusConfig = STATUS_CONFIG[item.status] ?? { label: item.status, className: "" };
          return (
            <div
              key={item.participantId}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {item.event.name}
                    </p>
                    <Badge className={cn("text-xs font-medium border-0 px-2 py-0.5", statusConfig.className)}>
                      {statusConfig.label}
                    </Badge>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {format(new Date(item.event.eventDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {item.event.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5" />
                      {item.event.category}
                    </span>
                    {item.numberOfParticipants > 1 && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {item.numberOfParticipants} pessoas
                      </span>
                    )}
                  </div>

                  {item.notes && (
                    <p className="mt-2 text-xs text-slate-400 dark:text-slate-500 italic">
                      {item.notes}
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {formatCurrency(parseFloat(item.event.pricePerPerson) * item.numberOfParticipants)}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {item.numberOfParticipants} × {formatCurrency(parseFloat(item.event.pricePerPerson))}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
