import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  CalendarIcon,
  MapPinIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  UsersIcon,
  SearchIcon,
  UserCheckIcon,
  PrinterIcon,
  Loader2,
  CalendarDays,
  Filter,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/utils";
import EventParticipantsModal from "@/components/event-participants-modal";

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

interface EventFormData {
  name: string;
  description: string;
  eventDate: string;
  registrationDeadline: string;
  location: string;
  pricePerPerson: string;
  maxCapacity: string;
  category: string;
  status: string;
  notes: string;
}

const EVENT_CATEGORIES = [
  "Geral",
  "Degustação",
  "Treinamento",
  "Lançamento",
  "Workshop",
  "Networking",
  "Confraternização",
];

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

// Configuração do editor de texto rico
const quillModules = {
  toolbar: [
    ["bold", "italic", "underline"],
    [{ color: [] }, { background: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    ["clean"],
  ],
};

const quillFormats = [
  "bold",
  "italic",
  "underline",
  "color",
  "background",
  "list",
  "bullet",
];

export default function EventsManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [participantsEvent, setParticipantsEvent] = useState<Event | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [formData, setFormData] = useState<EventFormData>({
    name: "",
    description: "",
    eventDate: "",
    registrationDeadline: "",
    location: "",
    pricePerPerson: "",
    maxCapacity: "",
    category: "Geral",
    status: "planejado",
    notes: "",
  });

  const {
    data: events = [],
    isLoading,
    isFetching,
  } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch =
        event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || event.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [events, searchTerm, statusFilter]);

  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      try {
        const eventData = {
          ...data,
          pricePerPerson: data.pricePerPerson,
          maxCapacity: data.maxCapacity ? parseInt(data.maxCapacity) : null,
          eventDate: new Date(data.eventDate).toISOString(),
          registrationDeadline: data.registrationDeadline
            ? new Date(data.registrationDeadline).toISOString()
            : null,
          createdBy: user?.id,
        };

        console.log("Enviando dados do evento:", eventData);

        const response = await fetch("/api/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user?.id || "",
          },
          body: JSON.stringify(eventData),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = "Erro ao criar evento";

          try {
            const error = JSON.parse(errorText);
            errorMessage = error.message || errorMessage;
          } catch {
            errorMessage = `Erro ${response.status}: ${response.statusText}`;
          }

          throw new Error(errorMessage);
        }

        return response.json();
      } catch (error) {
        console.error("Erro na criação do evento:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setIsCreateModalOpen(false);
      resetForm();
      toast({
        title: "Sucesso",
        description: "Evento criado com sucesso",
      });
    },
    onError: (error: Error) => {
      console.error("Erro na mutation:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro desconhecido ao criar evento",
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      const response = await fetch(`/api/events/${editingEvent?.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "",
        },
        body: JSON.stringify({
          ...data,
          pricePerPerson: data.pricePerPerson,
          maxCapacity: data.maxCapacity ? parseInt(data.maxCapacity) : null,
          eventDate: new Date(data.eventDate),
          registrationDeadline: data.registrationDeadline
            ? new Date(data.registrationDeadline)
            : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao atualizar evento");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setEditingEvent(null);
      resetForm();
      toast({
        title: "Sucesso",
        description: "Evento atualizado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
        headers: {
          "x-user-id": user?.id || "",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao excluir evento");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setEventToDelete(null);
      toast({
        title: "Sucesso",
        description: "Evento excluído com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      eventDate: "",
      registrationDeadline: "",
      location: "",
      pricePerPerson: "",
      maxCapacity: "",
      category: "Geral",
      status: "planejado",
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validações básicas
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome do evento é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!formData.eventDate) {
      toast({
        title: "Erro",
        description: "Data do evento é obrigatória",
        variant: "destructive",
      });
      return;
    }

    if (!formData.location.trim()) {
      toast({
        title: "Erro",
        description: "Local do evento é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!formData.pricePerPerson || parseFloat(formData.pricePerPerson) < 0) {
      toast({
        title: "Erro",
        description: "Valor por pessoa deve ser um número válido",
        variant: "destructive",
      });
      return;
    }

    // Validar se a data do evento não é no passado
    const eventDate = new Date(formData.eventDate);
    const now = new Date();
    if (eventDate < now) {
      toast({
        title: "Erro",
        description: "A data do evento não pode ser no passado",
        variant: "destructive",
      });
      return;
    }

    // Validar se o prazo de inscrição não é após a data do evento
    if (formData.registrationDeadline) {
      const deadline = new Date(formData.registrationDeadline);
      if (deadline > eventDate) {
        toast({
          title: "Erro",
          description:
            "O prazo de inscrição não pode ser após a data do evento",
          variant: "destructive",
        });
        return;
      }
    }

    if (editingEvent) {
      updateEventMutation.mutate(formData);
    } else {
      createEventMutation.mutate(formData);
    }
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setFormData({
      name: event.name,
      description: event.description || "",
      eventDate: new Date(event.eventDate).toISOString().slice(0, 16),
      registrationDeadline: event.registrationDeadline
        ? new Date(event.registrationDeadline).toISOString().slice(0, 16)
        : "",
      location: event.location,
      pricePerPerson: event.pricePerPerson,
      maxCapacity: event.maxCapacity?.toString() || "",
      category: event.category,
      status: event.status,
      notes: event.notes || "",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = EVENT_STATUS.find((s) => s.value === status);
    return <Badge className={statusConfig?.color}>{statusConfig?.label}</Badge>;
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

  return (
    <>
      <div className="flex flex-col h-full">
        <Card className="flex flex-col flex-1 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 dark:from-slate-800 dark:to-slate-900 dark:border-slate-700">
          <CardHeader className="bg-gradient-to-r from-orange-100 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-b border-slate-200 dark:border-slate-700">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-orange-200 to-amber-200 dark:from-orange-700 dark:to-amber-700">
                    <CalendarDays className="h-5 w-5 text-orange-600 dark:text-orange-300" />
                  </div>
                  <span className="bg-gradient-to-r from-orange-600 to-amber-600 dark:from-orange-400 dark:to-amber-400 bg-clip-text text-transparent font-bold">
                    Gestão de Eventos
                  </span>
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400 mt-1">
                  Gerencie eventos, participantes e acompanhe o engajamento da
                  sua empresa
                </CardDescription>
              </div>

              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Novo Evento
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col flex-1 min-h-0 gap-6 p-4 md:p-6">
            {/* Filtros modernos */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Buscar eventos por nome, local ou categoria..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-slate-300 focus:border-orange-400 focus:ring-orange-400 dark:border-slate-600 dark:focus:border-orange-500 bg-white dark:bg-slate-800"
                />
                {isFetching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48 border-slate-300 focus:border-orange-400 focus:ring-orange-400 dark:border-slate-600 dark:focus:border-orange-500">
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {EVENT_STATUS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-4 flex-1">
                {/* Skeleton Items */}
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6"
                  >
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-6 w-6 rounded" />
                          <Skeleton className="h-5 w-48" />
                        </div>
                        <Skeleton className="h-4 w-32" />
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-12 flex-1 flex flex-col items-center justify-center">
                <div className="p-4 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/20 dark:to-amber-900/20 mb-6">
                  <CalendarDays className="h-12 w-12 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  {searchTerm || statusFilter !== "all"
                    ? "Nenhum evento encontrado"
                    : "Nenhum evento cadastrado"}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md text-center">
                  {searchTerm || statusFilter !== "all"
                    ? "Ajuste os filtros para encontrar eventos ou crie um novo evento."
                    : "Comece criando seu primeiro evento para engajar clientes e expandir seu negócio."}
                </p>
                {!searchTerm && statusFilter === "all" ? (
                  <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Criar Primeiro Evento
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchTerm("");
                        setStatusFilter("all");
                      }}
                    >
                      Limpar filtros
                    </Button>
                    <Button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
                    >
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      Novo Evento
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 flex-1">
                {filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200"
                  >
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                      {/* Informações principais */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/20 dark:to-amber-900/20 mt-1">
                            <CalendarIcon className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {event.name}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {event.category}
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            {getStatusBadge(event.status)}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="h-4 w-4" />
                            <span>{formatDate(event.eventDate)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPinIcon className="h-4 w-4" />
                            <span className="truncate max-w-[200px]">
                              {event.location}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              {formatCurrency(parseFloat(event.pricePerPerson))}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <UsersIcon className="h-4 w-4" />
                            <span>
                              {event.participantCount}
                              {event.maxCapacity &&
                                `/${event.maxCapacity}`}{" "}
                              participantes
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setParticipantsEvent(event)}
                          title="Gerenciar Participantes"
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                        >
                          <UserCheckIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePrintParticipants(event)}
                          title="Imprimir Lista"
                          className="text-slate-600 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/20"
                        >
                          <PrinterIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(event)}
                          title="Editar Evento"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                          <EditIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEventToDelete(event)}
                          title="Excluir Evento"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Paginação moderna */}
                {/* {filteredEvents.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Mostrando{" "}
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {filteredEvents.length}
                        </span>{" "}
                        de{" "}
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {events.length}
                        </span>{" "}
                        eventos
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 dark:border-slate-600 dark:hover:border-slate-500 dark:text-slate-300 dark:hover:text-slate-100"
                        >
                          Anterior
                        </Button>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="default"
                            size="sm"
                            className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
                          >
                            1
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 dark:border-slate-600 dark:hover:border-slate-500"
                          >
                            2
                          </Button>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 dark:border-slate-600 dark:hover:border-slate-500 dark:text-slate-300 dark:hover:text-slate-100"
                        >
                          Próximo
                        </Button>
                      </div>
                    </div>
                  </div>
                )} */}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Criação/Edição */}
      <Dialog
        open={isCreateModalOpen || !!editingEvent}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateModalOpen(false);
            setEditingEvent(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <div className="p-2 rounded-lg bg-gradient-to-br from-orange-200 to-amber-200 dark:from-orange-700 dark:to-amber-700">
                {editingEvent ? (
                  <EditIcon className="h-4 w-4 text-orange-600 dark:text-orange-300" />
                ) : (
                  <CalendarDays className="h-4 w-4 text-orange-600 dark:text-orange-300" />
                )}
              </div>
              {editingEvent ? "Editar Evento" : "Novo Evento"}
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              {editingEvent
                ? "Atualize as informações do evento selecionado"
                : "Preencha as informações para criar um novo evento"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label
                  htmlFor="name"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Nome do Evento
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                  className="border-slate-300 focus:border-orange-400 focus:ring-orange-400 dark:border-slate-600 dark:focus:border-orange-500 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <Label
                  htmlFor="category"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Categoria
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger className="border-slate-300 focus:border-orange-400 focus:ring-orange-400 dark:border-slate-600 dark:focus:border-orange-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="description"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Descrição
              </Label>
              <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden focus-within:border-orange-400 focus-within:ring-1 focus-within:ring-orange-400 dark:focus-within:border-orange-500 transition-colors">
                <ReactQuill
                  value={formData.description}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, description: value }))
                  }
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Descrição do evento..."
                  style={{
                    minHeight: "120px",
                    border: "none",
                  }}
                  theme="snow"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label
                  htmlFor="eventDate"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Data do Evento
                </Label>
                <Input
                  id="eventDate"
                  type="datetime-local"
                  value={formData.eventDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      eventDate: e.target.value,
                    }))
                  }
                  required
                  className="border-slate-300 focus:border-orange-400 focus:ring-orange-400 dark:border-slate-600 dark:focus:border-orange-500 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <Label
                  htmlFor="registrationDeadline"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Prazo de Inscrição
                </Label>
                <Input
                  id="registrationDeadline"
                  type="datetime-local"
                  value={formData.registrationDeadline}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      registrationDeadline: e.target.value,
                    }))
                  }
                  className="border-slate-300 focus:border-orange-400 focus:ring-orange-400 dark:border-slate-600 dark:focus:border-orange-500 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <div>
              <Label
                htmlFor="location"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Local
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, location: e.target.value }))
                }
                required
                placeholder="Ex: Auditório Central, Hotel Premium..."
                className="border-slate-300 focus:border-orange-400 focus:ring-orange-400 dark:border-slate-600 dark:focus:border-orange-500 bg-white dark:bg-slate-800"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label
                  htmlFor="pricePerPerson"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Valor por Pessoa (R$)
                </Label>
                <Input
                  id="pricePerPerson"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.pricePerPerson}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      pricePerPerson: e.target.value,
                    }))
                  }
                  required
                  placeholder="0,00"
                  className="border-slate-300 focus:border-orange-400 focus:ring-orange-400 dark:border-slate-600 dark:focus:border-orange-500 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <Label
                  htmlFor="maxCapacity"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Capacidade Máxima
                </Label>
                <Input
                  id="maxCapacity"
                  type="number"
                  min="1"
                  value={formData.maxCapacity}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      maxCapacity: e.target.value,
                    }))
                  }
                  placeholder="Opcional"
                  className="border-slate-300 focus:border-orange-400 focus:ring-orange-400 dark:border-slate-600 dark:focus:border-orange-500 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <Label
                  htmlFor="status"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Status
                </Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger className="border-slate-300 focus:border-orange-400 focus:ring-orange-400 dark:border-slate-600 dark:focus:border-orange-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_STATUS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="notes"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Observações
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={3}
                placeholder="Observações adicionais sobre o evento..."
                className="border-slate-300 focus:border-orange-400 focus:ring-orange-400 dark:border-slate-600 dark:focus:border-orange-500 bg-white dark:bg-slate-800 resize-none"
              />
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingEvent(null);
                  resetForm();
                }}
                className="border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  createEventMutation.isPending || updateEventMutation.isPending
                }
                className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createEventMutation.isPending ||
                updateEventMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    {editingEvent ? "Atualizando..." : "Criando..."}
                  </div>
                ) : (
                  `${editingEvent ? "Atualizar" : "Criar"} Evento`
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog
        open={!!eventToDelete}
        onOpenChange={() => setEventToDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center pb-4 border-b border-slate-200 dark:border-slate-700">
            <DialogTitle className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <TrashIcon className="h-5 w-5" />
              </div>
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400 mt-2">
              Tem certeza que deseja excluir o evento{" "}
              <strong>"{eventToDelete?.name}"</strong>?<br />
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setEventToDelete(null)}
              className="border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                eventToDelete && deleteEventMutation.mutate(eventToDelete.id)
              }
              disabled={deleteEventMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteEventMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Excluindo...
                </div>
              ) : (
                "Excluir"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Gerenciamento de Participantes */}
      <EventParticipantsModal
        isOpen={!!participantsEvent}
        onClose={() => setParticipantsEvent(null)}
        event={participantsEvent}
      />
    </>
  );
}
