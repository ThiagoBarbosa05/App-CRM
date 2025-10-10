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
  ImageIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  formatCurrency,
  formatDate,
  formatEventDateTime,
  convertUTCToLocalDatetime,
  baseS3Url,
} from "@/lib/utils";
import EventParticipantsModal from "@/components/event-participants-modal";

interface EventAttachment {
  id?: string;
  eventId?: string;
  fileName: string;
  fileUrl: string;
  uploadedAt?: string;
}

interface Event {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
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
  attachments?: EventAttachment[];
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
  imageUrl?: string | null;
  attachments: EventAttachment[];
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
    imageUrl: null,
    attachments: [],
  });

  const [isUploading, setIsUploading] = useState(false);
  const [removingAttachments, setRemovingAttachments] = useState<number[]>([]);

  // Função para upload de imagem do evento
  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo (JPEG, JPG, PNG)
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma imagem JPEG, JPG ou PNG",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (15MB máximo)
    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) {
      toast({
        title: "Erro",
        description: "A imagem deve ter no máximo 15MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);

      const uploadFormData = new FormData();
      uploadFormData.append("image", file);

      const response = await fetch("/api/events/upload-image", {
        method: "POST",
        body: uploadFormData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro no upload da imagem");
      }

      const result = await response.json();
      // Construir URL completa com baseS3Url
      const fullImageUrl = `${baseS3Url}${result.imageUrl}`;
      setFormData((prev) => ({ ...prev, imageUrl: fullImageUrl }));

      toast({
        title: "Sucesso",
        description: "Imagem carregada com sucesso",
      });
    } catch (error) {
      console.error("Erro no upload:", error);
      toast({
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Falha ao fazer upload da imagem",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = () => {
    setFormData((prev) => ({ ...prev, imageUrl: null }));
  };

  // Função para upload de arquivo
  const handleFileUpload = async (file: File) => {
    try {
      setIsUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erro no upload do arquivo");
      }

      const result = await response.json();
      return {
        fileName: file.name,
        fileUrl: result.url,
      };
    } catch (error) {
      console.error("Erro no upload:", error);
      toast({
        title: "Erro",
        description: "Erro ao fazer upload da imagem",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  // Função para adicionar anexo
  const handleAddAttachment = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo (apenas imagens)
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Erro",
        description: "Por favor, selecione apenas arquivos de imagem",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "A imagem deve ter no máximo 5MB",
        variant: "destructive",
      });
      return;
    }

    try {
      const attachment = await handleFileUpload(file);
      setFormData((prev) => ({
        ...prev,
        attachments: [...prev.attachments, attachment],
      }));
    } catch (error) {
      // Erro já tratado na função handleFileUpload
    }

    // Limpar input
    event.target.value = "";
  };

  // Função para remover anexo do S3
  const deleteFileFromS3 = async (fileUrl: string) => {
    try {
      const response = await fetch(`/api/delete-file`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileUrl }),
      });

      if (!response.ok) {
        console.warn("Erro ao deletar arquivo do S3:", fileUrl);
      }
    } catch (error) {
      console.error("Erro ao deletar arquivo do S3:", error);
    }
  };

  // Função para remover anexo
  const handleRemoveAttachment = async (index: number) => {
    const attachment = formData.attachments[index];

    // Adicionar ao estado de loading
    setRemovingAttachments((prev) => [...prev, index]);

    try {
      // Se o anexo já tem ID (existe no banco), remover do banco também
      if (attachment.id && editingEvent) {
        const response = await fetch(
          `/api/events/${editingEvent.id}/attachments/${attachment.id}`,
          {
            method: "DELETE",
            headers: {
              "x-user-id": user?.id || "",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Erro ao remover anexo do banco de dados");
        }
      }

      // Remover arquivo do S3
      await deleteFileFromS3(attachment.fileUrl);

      // Remover do estado local
      setFormData((prev) => ({
        ...prev,
        attachments: prev.attachments.filter((_, i) => i !== index),
      }));

      toast({
        title: "Sucesso",
        description: "Imagem removida com sucesso",
      });
    } catch (error) {
      console.error("Erro ao remover anexo:", error);
      toast({
        title: "Erro",
        description: "Erro ao remover imagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      // Remover do estado de loading
      setRemovingAttachments((prev) => prev.filter((i) => i !== index));
    }
  };

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
          eventDate: data.eventDate, // Enviar como string datetime-local
          registrationDeadline: data.registrationDeadline || null,
          attachments: data.attachments, // Incluir attachments
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
          eventDate: data.eventDate, // Enviar como string datetime-local
          registrationDeadline: data.registrationDeadline || null,
          attachments: data.attachments, // Incluir attachments
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
      imageUrl: null,
      attachments: [],
    });
    setRemovingAttachments([]);
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

    // Validar se a data do evento não é no passado (considerando fuso brasileiro)
    const eventDate = new Date(formData.eventDate + ":00-03:00");
    const now = new Date();
    // Obter hora atual no fuso brasileiro para comparação justa
    const nowInBrasilia = new Date(
      now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
    );

    if (eventDate < nowInBrasilia) {
      toast({
        title: "Erro",
        description: "A data do evento não pode ser no passado",
        variant: "destructive",
      });
      return;
    }

    // Validar se o prazo de inscrição não é após a data do evento
    if (formData.registrationDeadline) {
      const deadline = new Date(formData.registrationDeadline + ":00-03:00");
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
      eventDate: convertUTCToLocalDatetime(event.eventDate),
      registrationDeadline: event.registrationDeadline
        ? convertUTCToLocalDatetime(event.registrationDeadline)
        : "",
      location: event.location,
      pricePerPerson: event.pricePerPerson,
      maxCapacity: event.maxCapacity?.toString() || "",
      category: event.category,
      imageUrl: event.imageUrl || null,
      status: event.status,
      notes: event.notes || "",
      attachments: event.attachments || [],
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
          <span class="info-label">Data:</span> ${formatEventDateTime(
            event.eventDate
          )}
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
            <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center md:justify-between">
              <div className="flex-1 min-w-0">
                <CardTitle className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-orange-200 to-amber-200 dark:from-orange-700 dark:to-amber-700 flex-shrink-0">
                    <CalendarDays className="h-5 w-5 text-orange-600 dark:text-orange-300" />
                  </div>
                  <span className="bg-gradient-to-r from-orange-600 to-amber-600 dark:from-orange-400 dark:to-amber-400 bg-clip-text text-transparent font-bold truncate">
                    Gestão de Eventos
                  </span>
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
                  Gerencie eventos, participantes e acompanhe o engajamento da
                  sua empresa
                </CardDescription>
              </div>

              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200 w-full md:w-auto flex-shrink-0"
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Novo Evento
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col flex-1 min-h-0 gap-6 p-3 md:p-6">
            {/* Filtros modernos */}
            <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row gap-4">
              <div className="relative flex-1 min-w-0">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4 z-10" />
                <Input
                  placeholder="Buscar eventos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-10 border-slate-300 focus:border-orange-400 focus:ring-orange-400 dark:border-slate-600 dark:focus:border-orange-500 bg-white dark:bg-slate-800 w-full"
                />
                {isFetching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 z-10">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Filter className="h-4 w-4 text-slate-500 hidden sm:block" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48 border-slate-300 focus:border-orange-400 focus:ring-orange-400 dark:border-slate-600 dark:focus:border-orange-500">
                    <SelectValue placeholder="Status" />
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
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchTerm("");
                        setStatusFilter("all");
                      }}
                      className="w-full sm:w-auto"
                    >
                      Limpar filtros
                    </Button>
                    <Button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white w-full sm:w-auto"
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
                    className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200"
                  >
                    <div className="p-4 sm:p-6 space-y-4">
                      {/* Header com imagem de capa, título, categoria e status */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Imagem de Capa Retangular Horizontal */}
                          {event.imageUrl && (
                            <div className="w-32 h-20 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900 flex-shrink-0">
                              <img
                                src={event.imageUrl}
                                alt={event.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            </div>
                          )}

                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/20 dark:to-amber-900/20 flex-shrink-0">
                              <CalendarIcon className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base leading-tight">
                                {event.name}
                              </h3>
                              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                {event.category}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {getStatusBadge(event.status)}
                        </div>
                      </div>

                      {/* Informações do evento */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <CalendarIcon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">
                            {formatEventDateTime(event.eventDate)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <MapPinIcon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate" title={event.location}>
                            {event.location}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            Preço:
                          </span>
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {formatCurrency(parseFloat(event.pricePerPerson))}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <UsersIcon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">
                            {event.participantCount}
                            {event.maxCapacity && `/${event.maxCapacity}`}{" "}
                            pessoas
                          </span>
                        </div>
                      </div>

                      {/* Imagens do evento (se houver) */}
                      {event.attachments && event.attachments.length > 0 && (
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                          <span className="text-sm text-slate-500 dark:text-slate-400 flex-shrink-0">
                            {event.attachments.length} imagem
                            {event.attachments.length !== 1 ? "s" : ""}
                          </span>
                          <div className="flex gap-1 overflow-x-auto">
                            {event.attachments
                              .slice(0, 4)
                              .map((attachment, index) => (
                                <div
                                  key={index}
                                  className="w-8 h-8 flex-shrink-0 rounded border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800"
                                >
                                  <img
                                    src={`${baseS3Url}${attachment.fileUrl}`}
                                    alt={attachment.fileName}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target =
                                        e.target as HTMLImageElement;
                                      target.style.display = "none";
                                    }}
                                  />
                                </div>
                              ))}
                            {event.attachments.length > 4 && (
                              <div className="w-8 h-8 flex-shrink-0 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                                +{event.attachments.length - 4}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Ações */}
                      <div className="flex items-center justify-end gap-1 pt-3 border-t border-slate-100 dark:border-slate-700">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setParticipantsEvent(event)}
                          title="Gerenciar Participantes"
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 h-9 w-9 p-0 rounded-lg"
                        >
                          <UserCheckIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePrintParticipants(event)}
                          title="Imprimir Lista"
                          className="text-slate-600 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/20 h-9 w-9 p-0 rounded-lg"
                        >
                          <PrinterIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(event)}
                          title="Editar Evento"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 h-9 w-9 p-0 rounded-lg"
                        >
                          <EditIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEventToDelete(event)}
                          title="Excluir Evento"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 h-9 w-9 p-0 rounded-lg"
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
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader className="pb-6 border-b border-slate-200 dark:border-slate-700">
            <DialogTitle className="flex items-center gap-3 text-slate-800 dark:text-slate-200 text-xl">
              <div className="p-2 rounded-lg bg-gradient-to-br from-orange-200 to-amber-200 dark:from-orange-700 dark:to-amber-700">
                {editingEvent ? (
                  <EditIcon className="h-5 w-5 text-orange-600 dark:text-orange-300" />
                ) : (
                  <CalendarDays className="h-5 w-5 text-orange-600 dark:text-orange-300" />
                )}
              </div>
              {editingEvent ? "Editar Evento" : "Novo Evento"}
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400 mt-2">
              {editingEvent
                ? "Atualize as informações do evento selecionado"
                : "Preencha as informações para criar um novo evento"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-6">
            {/* Informações Básicas */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <div className="h-2 w-2 bg-orange-500 rounded-full"></div>
                Informações Básicas
              </h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="name"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300 required"
                  >
                    Nome do Evento *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    required
                    placeholder="Ex: Workshop de Vinhos Premium"
                    className="border-slate-300 focus:border-orange-400 focus:ring-orange-400 dark:border-slate-600 dark:focus:border-orange-500 bg-white dark:bg-slate-800"
                  />
                </div>
                <div className="space-y-2">
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
            </div>

            {/* Imagem do Evento */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <div className="h-2 w-2 bg-orange-500 rounded-full"></div>
                Imagem do Evento
              </h3>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Imagem de Capa (16:9)
                </Label>
                {formData.imageUrl ? (
                  <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-4">
                    <div className="w-full aspect-video overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900">
                      <img
                        src={formData.imageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={removeImage}
                      className="absolute top-6 right-6"
                      data-testid="button-remove-image"
                    >
                      <XIcon className="h-4 w-4 mr-2" />
                      Remover
                    </Button>
                  </div>
                ) : (
                  <div className="w-full aspect-video border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-center hover:border-orange-400 transition-colors flex items-center justify-center bg-slate-50 dark:bg-slate-900/50">
                    <input
                      type="file"
                      id="image-upload"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={handleImageUpload}
                      className="hidden"
                      data-testid="input-image-upload"
                    />
                    <label
                      htmlFor="image-upload"
                      className="cursor-pointer flex flex-col items-center gap-2 p-8"
                    >
                      {isUploading ? (
                        <Loader2 className="h-12 w-12 text-orange-500 animate-spin" />
                      ) : (
                        <ImageIcon className="h-12 w-12 text-slate-400" />
                      )}
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {isUploading
                          ? "Fazendo upload..."
                          : "Clique para selecionar uma imagem"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        JPEG, JPG ou PNG • Formato 16:9 • Máx. 15MB
                      </p>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <div className="h-2 w-2 bg-orange-500 rounded-full"></div>
                Descrição
              </h3>

              <div className="space-y-2">
                <Label
                  htmlFor="description"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Descrição do Evento
                </Label>
                <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden focus-within:border-orange-400 focus-within:ring-1 focus-within:ring-orange-400 dark:focus-within:border-orange-500 transition-colors">
                  <ReactQuill
                    value={formData.description}
                    onChange={(value) =>
                      setFormData((prev) => ({ ...prev, description: value }))
                    }
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="Descreva os detalhes do evento, agenda, palestrantes..."
                    style={{
                      minHeight: "120px",
                      border: "none",
                    }}
                    theme="snow"
                  />
                </div>
              </div>
            </div>

            {/* Data e Local */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <div className="h-2 w-2 bg-orange-500 rounded-full"></div>
                Data e Local
              </h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="eventDate"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300 required"
                  >
                    Data do Evento *
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
                <div className="space-y-2">
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

              <div className="space-y-2">
                <Label
                  htmlFor="location"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300 required"
                >
                  Local do Evento *
                </Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      location: e.target.value,
                    }))
                  }
                  required
                  placeholder="Ex: Auditório Central, Hotel Premium, Salão de Eventos..."
                  className="border-slate-300 focus:border-orange-400 focus:ring-orange-400 dark:border-slate-600 dark:focus:border-orange-500 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            {/* Configurações do Evento */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <div className="h-2 w-2 bg-orange-500 rounded-full"></div>
                Configurações
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="pricePerPerson"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300 required"
                  >
                    Valor por Pessoa (R$) *
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
                    placeholder="150.00"
                    className="border-slate-300 focus:border-orange-400 focus:ring-orange-400 dark:border-slate-600 dark:focus:border-orange-500 bg-white dark:bg-slate-800"
                  />
                </div>
                <div className="space-y-2">
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
                    placeholder="50"
                    className="border-slate-300 focus:border-orange-400 focus:ring-orange-400 dark:border-slate-600 dark:focus:border-orange-500 bg-white dark:bg-slate-800"
                  />
                </div>
                <div className="space-y-2">
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
            </div>

            {/* Seção de Upload de Imagens */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <div className="h-2 w-2 bg-orange-500 rounded-full"></div>
                    Imagens do Evento
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Adicione imagens para ilustrar seu evento (máx. 5MB cada)
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAddAttachment}
                    disabled={isUploading}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border border-orange-300 rounded-lg cursor-pointer hover:bg-orange-50 dark:border-orange-600 dark:hover:bg-orange-900/20 transition-colors ${
                      isUploading
                        ? "opacity-50 cursor-not-allowed"
                        : "text-orange-600 hover:text-orange-700"
                    }`}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UploadIcon className="h-4 w-4" />
                    )}
                    {isUploading ? "Carregando..." : "Adicionar Imagem"}
                  </label>
                </div>
              </div>

              {/* Lista de imagens anexadas */}
              {formData.attachments.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {formData.attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="relative group border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800 hover:shadow-md transition-shadow"
                    >
                      <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                        <img
                          src={`${baseS3Url}${attachment.fileUrl}`}
                          alt={attachment.fileName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                            target.nextElementSibling?.classList.remove(
                              "hidden"
                            );
                          }}
                        />
                        <div className="hidden flex-col items-center justify-center text-slate-500 dark:text-slate-400 p-4">
                          <ImageIcon className="h-8 w-8 mb-2" />
                          <span className="text-xs text-center">
                            {attachment.fileName}
                          </span>
                        </div>
                      </div>

                      {/* Overlay com ações */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(index)}
                          disabled={removingAttachments.includes(index)}
                          className="opacity-0 group-hover:opacity-100 bg-red-500 hover:bg-red-600 disabled:bg-red-400 disabled:cursor-not-allowed text-white p-2 rounded-full transition-all duration-200 transform scale-90 group-hover:scale-100 shadow-lg"
                          title="Remover imagem"
                        >
                          {removingAttachments.includes(index) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XIcon className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      {/* Nome do arquivo */}
                      <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                        <p
                          className="text-xs text-slate-600 dark:text-slate-400 truncate"
                          title={attachment.fileName}
                        >
                          {attachment.fileName}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Mensagem quando não há imagens */}
              {formData.attachments.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-orange-300 dark:hover:border-orange-600 transition-colors">
                  <ImageIcon className="h-16 w-16 mx-auto text-slate-400 mb-4" />
                  <p className="text-base font-medium text-slate-500 dark:text-slate-400 mb-2">
                    Nenhuma imagem adicionada
                  </p>
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    Clique em "Adicionar Imagem" para incluir fotos do evento
                  </p>
                </div>
              )}
            </div>

            {/* Observações */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <div className="h-2 w-2 bg-orange-500 rounded-full"></div>
                Observações Adicionais
              </h3>

              <div className="space-y-2">
                <Label
                  htmlFor="notes"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Notas do Evento
                </Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  rows={4}
                  placeholder="Adicione observações importantes, requisitos especiais, informações de contato..."
                  className="border-slate-300 focus:border-orange-400 focus:ring-orange-400 dark:border-slate-600 dark:focus:border-orange-500 bg-white dark:bg-slate-800 resize-none"
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t border-slate-200 dark:border-slate-700 mt-8">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingEvent(null);
                  resetForm();
                }}
                className="border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 w-full sm:w-auto px-8"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  createEventMutation.isPending ||
                  updateEventMutation.isPending ||
                  isUploading
                }
                className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto px-8"
              >
                {createEventMutation.isPending ||
                updateEventMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    {editingEvent ? "Atualizando..." : "Criando..."}
                  </div>
                ) : isUploading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Fazendo upload...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {editingEvent ? "Atualizar" : "Criar"} Evento
                  </div>
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
        <DialogContent className="sm:max-w-md mx-4">
          <DialogHeader className="text-center pb-6 border-b border-slate-200 dark:border-slate-700">
            <DialogTitle className="flex items-center justify-center gap-3 text-red-600 dark:text-red-400 text-xl">
              <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                <TrashIcon className="h-6 w-6" />
              </div>
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400 mt-3 text-base">
              Tem certeza que deseja excluir o evento{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                "{eventToDelete?.name}"
              </strong>
              ?
              <br />
              <span className="text-sm">Esta ação não pode ser desfeita.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 pt-6">
            <Button
              variant="outline"
              onClick={() => setEventToDelete(null)}
              className="border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 w-full sm:w-auto px-6"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                eventToDelete && deleteEventMutation.mutate(eventToDelete.id)
              }
              disabled={deleteEventMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto px-6"
            >
              {deleteEventMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Excluindo...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <TrashIcon className="h-4 w-4" />
                  Excluir Evento
                </div>
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
