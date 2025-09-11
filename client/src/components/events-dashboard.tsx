
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
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();

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

  const handlePrintParticipants = async (event: Event) => {
    try {
      // Buscar participantes do evento
      const response = await fetch(`/api/events/${event.id}/participants`, {
        headers: {
          "x-user-id": user?.id || "",
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao buscar participantes");
      }

      const participants = await response.json();

      // Função para converter status
      const getStatusLabel = (status: string) => {
        const statusMap: { [key: string]: string } = {
          'inscrito': 'Inscrito',
          'confirmado': 'Confirmado', 
          'presente': 'Presente',
          'ausente': 'Ausente',
          'cancelado': 'Cancelado'
        };
        return statusMap[status] || status;
      };

      // Função para obter status do evento
      const getEventStatusLabel = (status: string) => {
        const statusConfig = EVENT_STATUS.find(s => s.value === status);
        return statusConfig?.label || status;
      };

      // Gerar linhas da tabela
      const participantRows = participants.length > 0 
        ? participants.map((participant: any) => `
            <tr>
              <td>${participant.clientName || 'N/A'}</td>
              <td>${participant.clientPhone || 'N/A'}</td>
              <td><span class="status-badge status-${participant.status}">${getStatusLabel(participant.status)}</span></td>
              <td>${formatDate(participant.registrationDate)}</td>
              <td>${participant.notes || ''}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="5" style="text-align: center; font-style: italic;">Nenhum participante inscrito</td></tr>';

      // Gerar HTML para impressão
      const printContent = `<!DOCTYPE html>
<html>
<head>
  <title>Lista de Participantes - ${event.name}</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      margin: 20px;
      color: #333;
    }
    .header { 
      text-align: center; 
      margin-bottom: 30px;
      border-bottom: 2px solid #ccc;
      padding-bottom: 20px;
    }
    .event-info { 
      margin-bottom: 30px; 
    }
    .event-info h2 { 
      color: #2563eb; 
      margin-bottom: 10px;
    }
    .event-details { 
      display: grid; 
      grid-template-columns: 1fr 1fr; 
      gap: 20px; 
      margin-bottom: 20px;
    }
    .info-item { 
      margin-bottom: 8px; 
    }
    .info-label { 
      font-weight: bold; 
      color: #666;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 20px;
    }
    th, td { 
      border: 1px solid #ddd; 
      padding: 12px; 
      text-align: left; 
    }
    th { 
      background-color: #f5f5f5; 
      font-weight: bold;
      color: #333;
    }
    .status-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }
    .status-inscrito { background-color: #dbeafe; color: #1e40af; }
    .status-confirmado { background-color: #dcfce7; color: #15803d; }
    .status-presente { background-color: #d1fae5; color: #047857; }
    .status-ausente { background-color: #fee2e2; color: #dc2626; }
    .status-cancelado { background-color: #f3f4f6; color: #374151; }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 20px;
    }
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Lista de Participantes</h1>
  </div>
  
  <div class="event-info">
    <h2>${event.name}</h2>
    <div class="event-details">
      <div>
        <div class="info-item">
          <span class="info-label">Data:</span> ${formatDate(event.eventDate)}
        </div>
        <div class="info-item">
          <span class="info-label">Local:</span> ${event.location}
        </div>
        <div class="info-item">
          <span class="info-label">Categoria:</span> ${event.category}
        </div>
      </div>
      <div>
        <div class="info-item">
          <span class="info-label">Valor por Pessoa:</span> ${formatCurrency(parseFloat(event.pricePerPerson))}
        </div>
        <div class="info-item">
          <span class="info-label">Capacidade:</span> ${event.maxCapacity ? `${event.participantCount}/${event.maxCapacity}` : event.participantCount}
        </div>
        <div class="info-item">
          <span class="info-label">Status:</span> ${getEventStatusLabel(event.status)}
        </div>
      </div>
    </div>
    ${event.description ? `<div class="info-item"><span class="info-label">Descrição:</span> ${event.description}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>Nome do Cliente</th>
        <th>Telefone</th>
        <th>Status</th>
        <th>Data de Inscrição</th>
        <th>Observações</th>
      </tr>
    </thead>
    <tbody>
      ${participantRows}
    </tbody>
  </table>

  <div class="footer">
    <p>Lista gerada em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
    <p>Total de participantes: ${participants.length}</p>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`;

      // Abrir nova janela e imprimir
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível abrir a janela de impressão. Verifique se pop-ups estão bloqueados.",
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error("Erro ao imprimir lista:", error);
      toast({
        title: "Erro",
        description: "Erro ao gerar lista de participantes para impressão",
        variant: "destructive",
      });
    }
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
                      onClick={() => handlePrintParticipants(event)}
                      data-testid="button-print-participants"
                    >
                      Detalhes do Evento
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
