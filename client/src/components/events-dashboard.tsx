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
import { CalendarIcon, MapPinIcon, UsersIcon, ClockIcon } from "lucide-react";
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
  {
    value: "planejado",
    label: "Planejado",
    color: "bg-blue-100 text-blue-800",
  },
  { value: "ativo", label: "Ativo", color: "bg-green-100 text-green-800" },
  {
    value: "finalizado",
    label: "Finalizado",
    color: "bg-gray-100 text-gray-800",
  },
  { value: "cancelado", label: "Cancelado", color: "bg-red-100 text-red-800" },
];

export default function EventsDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = EVENT_STATUS.find((s) => s.value === status);
    return <Badge className={statusConfig?.color}>{statusConfig?.label}</Badge>;
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
          inscrito: "PAGO",
          confirmado: "CONVIDADO",
          presente: "PENDENTE",
          ausente: "PAGAR NA HORA",
          cancelado: "CANCELADO",
        };
        return statusMap[status] || status;
      };

      // Função para obter status do evento
      const getEventStatusLabel = (status: string) => {
        const statusConfig = EVENT_STATUS.find((s) => s.value === status);
        return statusConfig?.label || status;
      };

      // Gerar linhas da tabela
      const participantRows =
        participants.length > 0
          ? participants
              .map(
                (participant: any) => `
            <tr>
              <td>${participant.clientName || "N/A"}</td>
              <td>${participant.clientPhone || "N/A"}</td>
              <td style="text-align: center; font-weight: bold;">${
                participant.numberOfParticipants || 1
              }</td>
              <td><span class="status-badge status-${
                participant.status
              }">${getStatusLabel(participant.status)}</span></td>
              <td>${formatDate(participant.registrationDate)}</td>
              <td>${participant.notes || ""}</td>
            </tr>
          `
              )
              .join("")
          : '<tr><td colspan="6" style="text-align: center; font-style: italic;">Nenhum participante cadastrado</td></tr>';

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
    .status-ausente { background-color: #fed7aa; color: #ea580c; }
    .status-cancelado { background-color: #fee2e2; color: #dc2626; }
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
          <span class="info-label">Valor por Pessoa:</span> ${formatCurrency(
            parseFloat(event.pricePerPerson)
          )}
        </div>
        <div class="info-item">
          <span class="info-label">Capacidade:</span> ${
            event.maxCapacity
              ? `${event.participantCount}/${event.maxCapacity}`
              : event.participantCount
          }
        </div>
        <div class="info-item">
          <span class="info-label">Status:</span> ${getEventStatusLabel(
            event.status
          )}
        </div>
      </div>
    </div>
    ${
      event.description
        ? `<div class="info-item"><span class="info-label">Descrição:</span> ${event.description}</div>`
        : ""
    }
  </div>

  <table>
    <thead>
      <tr>
        <th>Nome do Cliente</th>
        <th>Telefone</th>
        <th>Nº Participantes</th>
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
    <p>Lista gerada em ${new Date().toLocaleDateString(
      "pt-BR"
    )} às ${new Date().toLocaleTimeString("pt-BR")}</p>
    <p>Total de participantes: ${participants.reduce(
      (total: number, p: any) => total + (p.numberOfParticipants || 1),
      0
    )}</p>
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
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
      } else {
        toast({
          title: "Erro",
          description:
            "Não foi possível abrir a janela de impressão. Verifique se pop-ups estão bloqueados.",
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
    .filter((event) => {
      const daysUntil = getDaysUntilEvent(event.eventDate);
      return (
        (event.status === "planejado" || event.status === "ativo") &&
        daysUntil >= 0 &&
        daysUntil <= 30
      );
    })
    .sort(
      (a, b) =>
        new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    )
    .slice(0, 10);

  if (isLoading) {
    return <div>Carregando eventos...</div>;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <Card className="shadow-none border-0 bg-transparent">
        <CardHeader className="pb-6 px-6 pt-6">
          <CardTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900">
            <div className="p-2 bg-purple-50 rounded-lg">
              <CalendarIcon className="h-5 w-5 text-purple-600 shrink-0" />
            </div>
            <span className="truncate">Próximos Eventos</span>
          </CardTitle>
          <CardDescription className="text-sm text-gray-600 mt-2">
            Eventos planejados e ativos dos próximos 30 dias para acompanhamento
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {upcomingEvents.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="bg-purple-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <CalendarIcon className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum evento próximo
              </h3>
              <p className="text-gray-500">
                Não há eventos programados para os próximos 30 dias
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {upcomingEvents.map((event) => {
                const daysUntil = getDaysUntilEvent(event.eventDate);
                const isToday = daysUntil === 0;
                const isTomorrow = daysUntil === 1;

                return (
                  <div
                    key={event.id}
                    className="group relative bg-white border border-gray-200 rounded-md p-6 hover:border-gray-300 hover:shadow-md transition-all duration-200 ease-in-out"
                  >
                    {/* Indicador de urgência lateral */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${
                        isToday
                          ? "bg-red-500"
                          : isTomorrow
                          ? "bg-orange-400"
                          : daysUntil <= 7
                          ? "bg-yellow-400"
                          : "bg-purple-400"
                      }`}
                    />

                    {/* Header do Card */}
                    <div className="pl-2">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg text-gray-900 mb-3 overflow-hidden text-ellipsis">
                            {event.name}
                          </h3>
                          <div className="flex flex-wrap gap-2 mb-4">
                            <Badge
                              className={`${
                                EVENT_STATUS.find(
                                  (s) => s.value === event.status
                                )?.color
                              } border-0 font-medium px-3 py-1 text-xs`}
                            >
                              {
                                EVENT_STATUS.find(
                                  (s) => s.value === event.status
                                )?.label
                              }
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-xs font-medium px-2 py-1 bg-gray-50 text-gray-700 border-gray-200"
                            >
                              {event.category}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Informações principais com ícones semânticos */}
                      <div className="space-y-3 mb-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              isToday
                                ? "bg-red-50"
                                : isTomorrow
                                ? "bg-orange-50"
                                : "bg-blue-50"
                            }`}
                          >
                            <CalendarIcon
                              className={`h-4 w-4 ${
                                isToday
                                  ? "text-red-600"
                                  : isTomorrow
                                  ? "text-orange-600"
                                  : "text-blue-600"
                              }`}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {formatDate(event.eventDate)}
                            </div>
                            <div className="text-sm">
                              {isToday && (
                                <span className="text-red-600 font-bold">
                                  🔴 Hoje!
                                </span>
                              )}
                              {isTomorrow && (
                                <span className="text-orange-600 font-bold">
                                  🟠 Amanhã
                                </span>
                              )}
                              {!isToday && !isTomorrow && daysUntil > 0 && (
                                <span className="text-blue-600">
                                  📅 Em {daysUntil} dias
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-50 rounded-lg">
                            <MapPinIcon className="h-4 w-4 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {event.location}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-50 rounded-lg">
                            <UsersIcon className="h-4 w-4 text-purple-600" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {event.participantCount} participante(s)
                              {event.maxCapacity && ` / ${event.maxCapacity}`}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-50 rounded-lg">
                            <ClockIcon className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-bold text-emerald-700">
                              {formatCurrency(parseFloat(event.pricePerPerson))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Descrição */}
                      {event.description && (
                        <div className="mb-4">
                          <div
                            className="text-sm text-gray-600 leading-relaxed overflow-hidden text-ellipsis rich-text-content"
                            dangerouslySetInnerHTML={{
                              __html: event.description,
                            }}
                          />
                        </div>
                      )}

                      {/* Deadline de inscrição */}
                      {event.registrationDeadline && (
                        <div className="mb-4">
                          <div className="text-xs bg-orange-50 text-orange-800 p-3 rounded-lg border-l-4 border-orange-400">
                            <div className="font-semibold">
                              ⏰ Prazo de inscrição
                            </div>
                            <div className="mt-1">
                              {formatDate(event.registrationDeadline)}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Botão de ação */}
                      <div className="pt-4 border-t border-gray-100">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePrintParticipants(event)}
                          data-testid="button-print-participants"
                          className="w-full hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-colors font-medium"
                        >
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          Ver Detalhes do Evento
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
