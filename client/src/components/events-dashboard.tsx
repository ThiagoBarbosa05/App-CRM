
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarIcon,
  MapPinIcon,
  UsersIcon,
  ClockIcon,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Event {
  id: string;
  name: string;
  description: string | null;
  eventDate: string;
  registrationDeadline: string | null;
  location: string;
  pricePerPerson: string;
  maxCapacity: number | null;
  category: string;
  status: "planejado" | "ativo" | "finalizado" | "cancelado";
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  creatorName: string;
  participantCount: number;
}

const EVENT_STATUS = [
  { value: "planejado", label: "Planejado", color: "bg-blue-100 text-blue-800" },
  { value: "ativo", label: "Ativo", color: "bg-green-100 text-green-800" },
  { value: "finalizado", label: "Finalizado", color: "bg-gray-100 text-gray-800" },
  { value: "cancelado", label: "Cancelado", color: "bg-red-100 text-red-800" },
];

export default function EventsDashboard() {
  const { user } = useAuth();

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = EVENT_STATUS.find(s => s.value === status);
    return (
      <Badge className={statusConfig?.color}>
        {statusConfig?.label}
      </Badge>
    );
  };

  const getDaysUntilEvent = (eventDate: string) => {
    const today = new Date();
    const event = new Date(eventDate);
    const diffTime = event.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Filtrar eventos próximos (próximos 30 dias) e ativos
  const upcomingEvents = events
    .filter(event => {
      const daysUntil = getDaysUntilEvent(event.eventDate);
      return (event.status === "planejado" || event.status === "ativo") && daysUntil >= 0 && daysUntil <= 30;
    })
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
    .slice(0, 10);

  if (isLoading) {
    return <div>Carregando eventos...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          Próximos Eventos
        </CardTitle>
        <CardDescription>
          Eventos dos próximos 30 dias
        </CardDescription>
      </CardHeader>
      <CardContent>
        {upcomingEvents.length === 0 ? (
          <div className="text-center py-8">
            <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Nenhum evento próximo</p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingEvents.map((event) => {
              const daysUntil = getDaysUntilEvent(event.eventDate);
              const isToday = daysUntil === 0;
              const isTomorrow = daysUntil === 1;
              
              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">{event.name}</h3>
                      {getStatusBadge(event.status)}
                      <Badge variant="outline" className="text-xs">
                        {event.category}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        <span>
                          {formatDate(event.eventDate)}
                          {isToday && <span className="text-red-600 font-medium ml-1">(Hoje!)</span>}
                          {isTomorrow && <span className="text-orange-600 font-medium ml-1">(Amanhã)</span>}
                          {!isToday && !isTomorrow && daysUntil > 0 && (
                            <span className="text-blue-600 ml-1">({daysUntil} dias)</span>
                          )}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <MapPinIcon className="h-4 w-4" />
                        <span>{event.location}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <UsersIcon className="h-4 w-4" />
                        <span>
                          {event.participantCount} participante(s)
                          {event.maxCapacity && ` / ${event.maxCapacity}`}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <ClockIcon className="h-4 w-4" />
                        <span>{formatCurrency(parseFloat(event.pricePerPerson))}</span>
                      </div>
                    </div>

                    {event.description && (
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                        {event.description}
                      </p>
                    )}

                    {event.registrationDeadline && (
                      <div className="text-xs text-orange-600 mt-2">
                        Inscrições até: {formatDate(event.registrationDeadline)}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Navegar para configurações apenas se for admin
                        if (user?.role === "admin") {
                          window.open(`/configurations?tab=events`, '_blank')
                        } else {
                          // Para outros usuários, mostrar uma mensagem ou ação alternativa
                          alert("Acesso restrito. Somente administradores podem gerenciar eventos.");
                        }
                      }}
                    >
                      Ver Detalhes
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
