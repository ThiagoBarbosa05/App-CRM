import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/page-header";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
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
  TrendingUpIcon,
  CircleDollarSignIcon,
  ClockIcon,
  BarChart2Icon,
  Link2Icon,
  GlobeIcon,
  ClipboardCopyIcon,
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
import EventsAnalytics from "@/components/events-analytics";

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
  wineRevenue: string | null;
  slug: string | null;
  landingPageHtmlKey: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  creatorName: string;
  participantCount: number;
  paidParticipants: number;
  pendingParticipants: number;
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
  wineRevenue: string;
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

  const [activeView, setActiveView] = useState<"eventos" | "analises">(
    "eventos",
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [participantsEvent, setParticipantsEvent] = useState<Event | null>(
    null,
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
    wineRevenue: "",
    imageUrl: null,
    attachments: [],
  });

  const [isUploading, setIsUploading] = useState(false);
  const [removingAttachments, setRemovingAttachments] = useState<number[]>([]);

  // Estados da landing page
  const [landingPageEvent, setLandingPageEvent] = useState<Event | null>(null);
  const [landingPageSlug, setLandingPageSlug] = useState("");
  const [landingPageFile, setLandingPageFile] = useState<File | null>(null);
  const [isUploadingLanding, setIsUploadingLanding] = useState(false);
  const [isDeletingLanding, setIsDeletingLanding] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<
    "detalhes" | "landing-page"
  >("detalhes");
  const [createdLpUrl, setCreatedLpUrl] = useState<string | null>(null);

  const openLandingPageModal = (event: Event) => {
    setLandingPageEvent(event);
    setLandingPageSlug(event.slug ?? "");
    setLandingPageFile(null);
  };

  const handleLandingPageUpload = async () => {
    if (!landingPageEvent || !landingPageFile || !landingPageSlug.trim())
      return;
    try {
      setIsUploadingLanding(true);
      const fd = new FormData();
      fd.append("html", landingPageFile);
      fd.append("slug", landingPageSlug.trim());
      const res = await fetch(
        `/api/events/${landingPageEvent.id}/landing-page`,
        {
          method: "POST",
          body: fd,
          credentials: "include",
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro no upload");
      toast({
        title: "Landing page publicada!",
        description: `Acessível em /lp/${data.slug}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setLandingPageEvent(null);
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Falha no upload",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLanding(false);
    }
  };

  const handleLandingPageUploadModal = async () => {
    if (!editingEvent || !landingPageFile || !landingPageSlug.trim()) return;
    try {
      setIsUploadingLanding(true);
      const fd = new FormData();
      fd.append("html", landingPageFile);
      fd.append("slug", landingPageSlug.trim());
      const res = await fetch(`/api/events/${editingEvent.id}/landing-page`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro no upload");
      toast({
        title: "Landing page publicada!",
        description: `Acessível em /lp/${data.slug}`,
      });
      // Atualizar editingEvent localmente para refletir o novo slug/key
      setEditingEvent((prev) =>
        prev
          ? {
              ...prev,
              slug: data.slug,
              landingPageHtmlKey: data.landingPageHtmlKey,
            }
          : prev,
      );
      setLandingPageFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Falha no upload",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLanding(false);
    }
  };

  const handleLandingPageDeleteModal = async () => {
    if (!editingEvent) return;
    try {
      setIsDeletingLanding(true);
      const res = await fetch(`/api/events/${editingEvent.id}/landing-page`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro ao remover");
      toast({ title: "Landing page removida" });
      setEditingEvent((prev) =>
        prev ? { ...prev, slug: null, landingPageHtmlKey: null } : prev,
      );
      setLandingPageSlug("");
      setLandingPageFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Falha ao remover",
        variant: "destructive",
      });
    } finally {
      setIsDeletingLanding(false);
    }
  };

  const handleLandingPageDelete = async () => {
    if (!landingPageEvent) return;
    try {
      setIsDeletingLanding(true);
      const res = await fetch(
        `/api/events/${landingPageEvent.id}/landing-page`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro ao remover");
      toast({ title: "Landing page removida" });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setLandingPageEvent(null);
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Falha ao remover",
        variant: "destructive",
      });
    } finally {
      setIsDeletingLanding(false);
    }
  };

  // Função para upload de imagem do evento
  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
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
        credentials: "include",
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
        credentials: "include",
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
    event: React.ChangeEvent<HTMLInputElement>,
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
        credentials: "include",
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
            credentials: "include",
          },
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
          },
          body: JSON.stringify(eventData),
          credentials: "include",
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
    onSuccess: async (newEvent: { id: number; name: string }) => {
      // Se há landing page para publicar, faz upload automaticamente após criar o evento
      if (landingPageFile && landingPageSlug.trim()) {
        try {
          setIsUploadingLanding(true);
          const fd = new FormData();
          fd.append("html", landingPageFile);
          fd.append("slug", landingPageSlug.trim());
          const res = await fetch(`/api/events/${newEvent.id}/landing-page`, {
            method: "POST",
            body: fd,
            credentials: "include",
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast({
              title: "Evento criado, mas houve um erro na landing page",
              description:
                (data as { message?: string }).message ??
                "Tente publicar a LP novamente na edição do evento.",
              variant: "destructive",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/events"] });
            setIsCreateModalOpen(false);
            resetForm();
          } else {
            // Sucesso: manter modal aberto e exibir URL para compartilhar
            const slug = landingPageSlug.trim();
            setCreatedLpUrl(`${window.location.origin}/lp/${slug}`);
            queryClient.invalidateQueries({ queryKey: ["/api/events"] });
          }
        } catch (err) {
          console.error("Erro ao publicar landing page:", err);
          toast({
            title: "Evento criado, mas houve um erro na landing page",
            description: "Tente publicar a LP novamente na edição do evento.",
            variant: "destructive",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/events"] });
          setIsCreateModalOpen(false);
          resetForm();
        } finally {
          setIsUploadingLanding(false);
        }
      } else {
        toast({ title: "Sucesso", description: "Evento criado com sucesso" });
        queryClient.invalidateQueries({ queryKey: ["/api/events"] });
        setIsCreateModalOpen(false);
        resetForm();
      }
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
        },
        body: JSON.stringify({
          ...data,
          pricePerPerson: data.pricePerPerson,
          maxCapacity: data.maxCapacity ? parseInt(data.maxCapacity) : null,
          eventDate: data.eventDate,
          registrationDeadline: data.registrationDeadline || null,
          attachments: data.attachments,
        }),
        credentials: "include",
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
        credentials: "include",
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
      wineRevenue: "",
      imageUrl: null,
      attachments: [],
    });
    setRemovingAttachments([]);
    setLandingPageSlug("");
    setLandingPageFile(null);
    setActiveModalTab("detalhes");
    setCreatedLpUrl(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Quando estiver na aba landing-page (criação), os campos de detalhes
    // têm defaults no backend — pular validações obrigatórias do formulário
    const skipDetailValidation =
      !editingEvent && activeModalTab === "landing-page";
    console.debug(
      "[handleSubmit] activeModalTab:",
      activeModalTab,
      "| editingEvent:",
      !!editingEvent,
      "| skipDetailValidation:",
      skipDetailValidation,
    );

    // Validações básicas
    if (!skipDetailValidation && !formData.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome do evento é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!skipDetailValidation && !formData.eventDate) {
      toast({
        title: "Erro",
        description: "Data do evento é obrigatória",
        variant: "destructive",
      });
      return;
    }

    if (!skipDetailValidation && !formData.location.trim()) {
      toast({
        title: "Erro",
        description: "Local do evento é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (
      !skipDetailValidation &&
      (!formData.pricePerPerson || parseFloat(formData.pricePerPerson) < 0)
    ) {
      toast({
        title: "Erro",
        description: "Valor por pessoa deve ser um número válido",
        variant: "destructive",
      });
      return;
    }

    const eventDate = formData.eventDate
      ? new Date(formData.eventDate + ":00-03:00")
      : new Date();

    // Validar se a data do evento não é no passado (apenas na criação, com campos preenchidos)
    if (!editingEvent && !skipDetailValidation) {
      const now = new Date();
      const nowInBrasilia = new Date(
        now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
      );

      if (eventDate < nowInBrasilia) {
        toast({
          title: "Erro",
          description: "A data do evento não pode ser no passado",
          variant: "destructive",
        });
        return;
      }
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
    } else if (skipDetailValidation) {
      // Criação via aba Landing Page: preencher defaults para campos obrigatórios não informados
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 30);
      const defaultDateStr = defaultDate.toISOString().slice(0, 16);
      createEventMutation.mutate({
        ...formData,
        name:
          formData.name.trim() ||
          (landingPageSlug
            ? landingPageSlug
                .replace(/-/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())
            : "Novo Evento"),
        location: formData.location.trim() || "A definir",
        eventDate: formData.eventDate || defaultDateStr,
        pricePerPerson: formData.pricePerPerson || "0",
        category: formData.category || "Geral",
      });
    } else {
      createEventMutation.mutate(formData);
    }
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setLandingPageSlug(event.slug ?? "");
    setLandingPageFile(null);

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
      wineRevenue: event.wineRevenue || "",
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
        headers: {},
      });

      if (!response.ok) {
        throw new Error("Erro ao buscar participantes");
      }

      const participants = await response.json();

      // Função para converter status
      const getStatusLabel = (status: string) => {
        const statusMap: { [key: string]: string } = {
          pago: "PAGO",
          convidado: "CONVIDADO",
          pendente: "PENDENTE",
          pagar_na_hora: "PAGAR NA HORA",
          cancelado: "CANCELADO",
        };
        return statusMap[status] || status;
      };

      // Função para obter status do evento
      const getEventStatusLabel = (status: string) => {
        const statusConfig = EVENT_STATUS.find((s) => s.value === status);
        return statusConfig?.label || status;
      };

      // Função para escapar HTML
      const escapeHtml = (text: string) => {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
      };

      // Gerar linhas da tabela
      const participantRows =
        participants.length > 0
          ? participants
              .map(
                (participant: any) => `
            <tr>
              <td>${escapeHtml(participant.clientName || "N/A")}</td>
              <td>${escapeHtml(participant.clientPhone || "N/A")}</td>
              <td></td>
              <td style="text-align: center; font-weight: bold;">${
                participant.numberOfParticipants || 1
              }</td>
              <td><span class="status-badge status-${
                participant.status
              }">${getStatusLabel(participant.status)}</span></td>
              <td>${formatDate(participant.registrationDate)}</td>
              <td>${escapeHtml(participant.notes || "")}</td>
            </tr>
          `,
              )
              .join("")
          : '<tr><td colspan="7" style="text-align: center; font-style: italic;">Nenhum participante cadastrado</td></tr>';

      // Calcular total de participantes
      const totalParticipants = participants.reduce(
        (total: number, p: any) => total + (p.numberOfParticipants || 1),
        0,
      );

      // Gerar HTML para impressão
      const printContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lista de Participantes - ${escapeHtml(event.name)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Arial, sans-serif; 
      margin: 15px;
      color: #333;
      line-height: 1.4;
    }
    .header { 
      text-align: center; 
      margin-bottom: 20px;
      border-bottom: 2px solid #333;
      padding-bottom: 12px;
    }
    .header h1 {
      font-size: 22px;
      color: #333;
      font-weight: bold;
    }
    .event-info { 
      margin-bottom: 20px; 
    }
    .event-info h2 { 
      color: #2563eb; 
      margin-bottom: 12px;
      font-size: 18px;
      font-weight: bold;
    }
    .event-details { 
      display: grid; 
      grid-template-columns: 1fr 1fr; 
      gap: 15px; 
      margin-bottom: 15px;
    }
    .info-item { 
      margin-bottom: 6px;
      font-size: 13px;
      line-height: 1.4;
    }
    .info-label { 
      font-weight: bold; 
      color: #333;
      display: inline-block;
      min-width: 110px;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 10px;
      font-size: 12px;
    }
    th, td { 
      border: 1px solid #999; 
      padding: 8px 10px; 
      text-align: left;
      vertical-align: top;
      line-height: 1.3;
    }
    th { 
      background-color: #f0f0f0; 
      font-weight: bold;
      color: #000;
      font-size: 12px;
    }
    th:nth-child(3), td:nth-child(3) {
      width: 140px;
      min-width: 140px;
    }
    .status-badge {
      display: inline-block;
      padding: 3px 7px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: bold;
      white-space: nowrap;
    }
    .status-pago { background-color: #dbeafe; color: #1e40af; }
    .status-convidado { background-color: #dcfce7; color: #15803d; }
    .status-pendente { background-color: #d1fae5; color: #047857; }
    .status-pagar_na_hora { background-color: #fed7aa; color: #ea580c; }
    .status-cancelado { background-color: #fee2e2; color: #dc2626; }
    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 11px;
      color: #666;
      border-top: 1px solid #999;
      padding-top: 10px;
    }
    .footer p {
      margin: 3px 0;
    }
    @media print {
      body { margin: 8px; }
      .no-print { display: none; }
      @page { 
        margin: 0.8cm;
        size: A4 portrait;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Lista de Participantes</h1>
  </div>

  <div class="event-info">
    <h2>${escapeHtml(event.name)}</h2>
    <div class="event-details">
      <div>
        <div class="info-item">
          <span class="info-label">Data:</span> ${formatEventDateTime(event.eventDate)}
        </div>
        <div class="info-item">
          <span class="info-label">Local:</span> ${escapeHtml(event.location)}
        </div>
        <div class="info-item">
          <span class="info-label">Categoria:</span> ${escapeHtml(event.category)}
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
  </div>

  <table>
    <thead>
      <tr>
        <th>Nome do Cliente</th>
        <th>Telefone</th>
        <th>Data de Aniversário</th>
        <th style="text-align: center;">Nº Participantes</th>
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
    <p><strong>Lista gerada em:</strong> ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</p>
    <p><strong>Total de participantes:</strong> ${totalParticipants}</p>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 800);
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
      <div className="space-y-6">
        <PageHeader>
          <PageHeader.Info>
            <PageHeader.Icon
              icon={CalendarDays}
              color="text-orange-600 dark:text-orange-400"
              bgColor="bg-orange-50 dark:bg-orange-900/30"
            />
            <PageHeader.Text>
              <PageHeader.Title>Gestão de Eventos</PageHeader.Title>
              <PageHeader.Description>
                Gerencie eventos, participantes e acompanhe o engajamento da sua empresa
              </PageHeader.Description>
            </PageHeader.Text>
          </PageHeader.Info>
          <PageHeader.Actions>
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 gap-1">
              <button
                onClick={() => setActiveView("eventos")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeView === "eventos"
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Eventos
              </button>
              <button
                onClick={() => setActiveView("analises")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeView === "analises"
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                <BarChart2Icon className="h-3.5 w-3.5" />
                Análises
              </button>
            </div>
            {user?.role === "admin" && (
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Novo Evento
              </Button>
            )}
          </PageHeader.Actions>
        </PageHeader>

        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 dark:from-slate-800 dark:to-slate-900 dark:border-slate-700">

          {activeView === "analises" ? (
            <CardContent className="p-3 md:p-6">
              <EventsAnalytics />
            </CardContent>
          ) : (
            <CardContent className="flex flex-col gap-6 p-3 md:p-6">
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

              {/* Cards de receita — apenas admin */}
              {user?.role === "admin" &&
                !isLoading &&
                filteredEvents.length > 0 &&
                (() => {
                  const price = (e: Event) => parseFloat(e.pricePerPerson) || 0;
                  const confirmed = filteredEvents.reduce(
                    (acc, e) => acc + e.paidParticipants * price(e),
                    0,
                  );
                  const potential = filteredEvents.reduce(
                    (acc, e) => acc + e.pendingParticipants * price(e),
                    0,
                  );
                  const totalPeople = filteredEvents.reduce(
                    (acc, e) => acc + e.participantCount,
                    0,
                  );
                  const activeEvents = filteredEvents.filter(
                    (e) => e.status === "ativo",
                  ).length;

                  return (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <CircleDollarSignIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="text-xs font-medium text-green-700 dark:text-green-400">
                            Receita Confirmada
                          </span>
                        </div>
                        <p className="text-lg font-bold text-green-800 dark:text-green-300">
                          {formatCurrency(confirmed)}
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
                          Pagos + pagar na hora
                        </p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <ClockIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                            Receita Potencial
                          </span>
                        </div>
                        <p className="text-lg font-bold text-amber-800 dark:text-amber-300">
                          {formatCurrency(potential)}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                          Pendentes de confirmação
                        </p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUpIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                            Receita Total
                          </span>
                        </div>
                        <p className="text-lg font-bold text-blue-800 dark:text-blue-300">
                          {formatCurrency(confirmed + potential)}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">
                          Confirmada + potencial
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <UsersIcon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-400">
                            Participantes
                          </span>
                        </div>
                        <p className="text-lg font-bold text-slate-800 dark:text-slate-200">
                          {totalPeople}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                          {activeEvents} evento{activeEvents !== 1 ? "s" : ""}{" "}
                          ativo{activeEvents !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  );
                })()}

              {isLoading ? (
                <div className="space-y-4">
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
                <div className="text-center py-12 flex flex-col items-center justify-center">
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
                  {!searchTerm &&
                  statusFilter === "all" &&
                  user?.role === "admin" ? (
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
                      {user?.role === "admin" && (
                        <Button
                          onClick={() => setIsCreateModalOpen(true)}
                          className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white w-full sm:w-auto"
                        >
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          Novo Evento
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredEvents.map((event) => (
                    <div
                      key={event.id}
                      className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden hover:shadow-md hover:border-orange-200 dark:hover:border-orange-900/50 transition-all duration-200 flex"
                    >
                      {/* Acento lateral esquerdo */}
                      <div className="w-1 flex-shrink-0 bg-gradient-to-b from-orange-500 to-amber-400" />

                      <div className="flex-1 p-4 sm:p-5 min-w-0">
                        {/* ── HEADER ── */}
                        <div className="flex items-start gap-3">
                          {event.imageUrl && (
                            <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 ring-1 ring-slate-200 dark:ring-slate-600">
                              <img
                                src={event.imageUrl}
                                alt={event.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-orange-500 dark:text-orange-400 uppercase tracking-wider">
                                  {event.category}
                                </span>
                                <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg leading-tight mt-0.5 truncate">
                                  {event.name}
                                </h3>
                              </div>
                              <div className="flex-shrink-0 mt-0.5 flex items-center gap-1.5">
                                {event.landingPageHtmlKey && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                    <GlobeIcon className="h-3 w-3" />
                                    LP
                                  </span>
                                )}
                                {getStatusBadge(event.status)}
                              </div>
                            </div>

                            {/* Chips de info */}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="h-3.5 w-3.5 text-orange-400" />
                                {formatEventDateTime(event.eventDate)}
                              </span>
                              <span className="flex items-center gap-1 truncate">
                                <MapPinIcon className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                                <span
                                  className="truncate"
                                  title={event.location}
                                >
                                  {event.location}
                                </span>
                              </span>
                              <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                                <CircleDollarSignIcon className="h-3.5 w-3.5 text-orange-400" />
                                {formatCurrency(
                                  parseFloat(event.pricePerPerson),
                                )}{" "}
                                / pessoa
                              </span>
                            </div>
                            {event.landingPageHtmlKey && event.slug && (
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <GlobeIcon className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                                <a
                                  href={`/lp/${event.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-mono text-emerald-600 dark:text-emerald-400 hover:underline truncate"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {window.location.origin}/lp/{event.slug}
                                </a>
                                <button
                                  type="button"
                                  title="Copiar URL"
                                  className="flex-shrink-0 text-slate-400 hover:text-emerald-600 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(
                                      `${window.location.origin}/lp/${event.slug}`,
                                    );
                                    toast({ title: "URL copiada!" });
                                  }}
                                >
                                  <ClipboardCopyIcon className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ── PARTICIPANTES ── */}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 rounded-full px-2.5 py-1">
                            <UsersIcon className="h-3.5 w-3.5" />
                            <span>
                              {event.participantCount}
                              {event.maxCapacity
                                ? `/${event.maxCapacity}`
                                : ""}{" "}
                              total
                            </span>
                          </div>
                          {(event as any).paidParticipants > 0 && (
                            <span className="text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 px-2.5 py-1 rounded-full font-medium">
                              {(event as any).paidParticipants} pagantes
                            </span>
                          )}
                          {(event as any).convidadoCount > 0 && (
                            <span className="text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 px-2.5 py-1 rounded-full font-medium">
                              {(event as any).convidadoCount} convidados
                            </span>
                          )}
                          {(event as any).absentCount > 0 && (
                            <span className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 px-2.5 py-1 rounded-full font-medium">
                              {(event as any).absentCount} ausentes
                            </span>
                          )}
                          {(event as any).pendingParticipants > 0 && (
                            <span className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 px-2.5 py-1 rounded-full font-medium">
                              {(event as any).pendingParticipants} pendentes
                            </span>
                          )}
                        </div>

                        {/* ── RECEITA (admin only) ── */}
                        {user?.role === "admin" &&
                          (() => {
                            const price = parseFloat(event.pricePerPerson) || 0;
                            const eventRev =
                              parseFloat(
                                String((event as any).eventRevenue ?? 0),
                              ) || (event as any).paidParticipants * price;
                            const wineRev =
                              parseFloat(event.wineRevenue || "0") || 0;
                            const totalRev = eventRev + wineRev;
                            const potential =
                              (event as any).pendingParticipants * price;
                            const hasWine = wineRev > 0;
                            return (
                              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 rounded-lg px-3 py-2">
                                  <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-500 uppercase tracking-wide">
                                    Receita Evento
                                  </p>
                                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                                    {formatCurrency(eventRev)}
                                  </p>
                                </div>
                                {hasWine ? (
                                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/40 rounded-lg px-3 py-2">
                                    <p className="text-[10px] font-medium text-purple-600 dark:text-purple-500 uppercase tracking-wide">
                                      Venda Vinho
                                    </p>
                                    <p className="text-sm font-bold text-purple-700 dark:text-purple-400 mt-0.5">
                                      {formatCurrency(wineRev)}
                                    </p>
                                  </div>
                                ) : null}
                                {hasWine ? (
                                  <div className="bg-slate-900 dark:bg-slate-100/10 border border-slate-700 dark:border-slate-600 rounded-lg px-3 py-2">
                                    <p className="text-[10px] font-medium text-slate-300 dark:text-slate-400 uppercase tracking-wide">
                                      Receita Total
                                    </p>
                                    <p className="text-sm font-bold text-white dark:text-slate-100 mt-0.5">
                                      {formatCurrency(totalRev)}
                                    </p>
                                  </div>
                                ) : null}
                                {potential > 0 ? (
                                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 rounded-lg px-3 py-2">
                                    <p className="text-[10px] font-medium text-amber-600 dark:text-amber-500 uppercase tracking-wide">
                                      Potencial
                                    </p>
                                    <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                                      {formatCurrency(potential)}
                                    </p>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })()}

                        {/* ── RODAPÉ: thumbnails + ações ── */}
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
                          {/* Thumbnails */}
                          <div className="flex items-center gap-1.5">
                            {event.attachments &&
                            event.attachments.length > 0 ? (
                              <>
                                {event.attachments
                                  .slice(0, 4)
                                  .map((attachment, index) => (
                                    <div
                                      key={index}
                                      className="w-7 h-7 flex-shrink-0 rounded-md border border-slate-200 dark:border-slate-600 overflow-hidden bg-slate-100 dark:bg-slate-700"
                                    >
                                      <img
                                        src={`${baseS3Url}${attachment.fileUrl}`}
                                        alt={attachment.fileName}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          (
                                            e.target as HTMLImageElement
                                          ).style.display = "none";
                                        }}
                                      />
                                    </div>
                                  ))}
                                {event.attachments.length > 4 && (
                                  <span className="text-xs text-slate-400 dark:text-slate-500">
                                    +{event.attachments.length - 4}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span />
                            )}
                          </div>

                          {/* Botões de ação */}
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setParticipantsEvent(event)}
                              className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:border-orange-300 dark:border-orange-800/60 dark:hover:bg-orange-900/20 gap-1.5 h-8 text-xs rounded-lg"
                            >
                              <UserCheckIcon className="h-3.5 w-3.5" />
                              Participantes
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePrintParticipants(event)}
                              title="Imprimir lista"
                              className="h-8 w-8 p-0 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              <PrinterIcon className="h-4 w-4" />
                            </Button>
                            {(user?.role === "admin" ||
                              user?.role === "gerente") && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openLandingPageModal(event)}
                                  title="Landing Page"
                                  className={`h-8 w-8 p-0 rounded-lg ${
                                    event.landingPageHtmlKey
                                      ? "text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                      : "text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                                  }`}
                                >
                                  <GlobeIcon className="h-4 w-4" />
                                </Button>
                                {(user?.role === "admin" ||
                                  user?.role === "gerente") && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(event)}
                                    title="Editar evento"
                                    className="h-8 w-8 p-0 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                  >
                                    <EditIcon className="h-4 w-4" />
                                  </Button>
                                )}
                                {user?.role === "admin" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEventToDelete(event)}
                                    title="Excluir evento"
                                    className="h-8 w-8 p-0 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
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
          )}
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

          <form onSubmit={handleSubmit} noValidate className="space-y-6 mt-6">
            {/* Seletor de Abas — apenas admin e gerente */}
            {(user?.role === "admin" || user?.role === "gerente") && (
              <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-800/50">
                <button
                  type="button"
                  onClick={() => setActiveModalTab("detalhes")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeModalTab === "detalhes"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  <CalendarDays className="h-4 w-4" />
                  Detalhes do Evento
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab("landing-page")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeModalTab === "landing-page"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  <GlobeIcon className="h-4 w-4" />
                  Landing Page
                  {(landingPageFile || editingEvent?.landingPageHtmlKey) && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                  )}
                </button>
              </div>
            )}

            {/* ── Aba: Detalhes do Evento ── */}
            {
              activeModalTab === "detalhes" && (
                <>
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
                            setFormData((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
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
                            setFormData((prev) => ({
                              ...prev,
                              category: value,
                            }))
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
                            setFormData((prev) => ({
                              ...prev,
                              description: value,
                            }))
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
                          htmlFor="wineRevenue"
                          className="text-sm font-medium text-slate-700 dark:text-slate-300"
                        >
                          Receita Venda de Vinhos (R$)
                        </Label>
                        <Input
                          id="wineRevenue"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.wineRevenue}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              wineRevenue: e.target.value,
                            }))
                          }
                          placeholder="0.00"
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
                              <SelectItem
                                key={status.value}
                                value={status.value}
                              >
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
                          Adicione imagens para ilustrar seu evento (máx. 5MB
                          cada)
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAddAttachment}
                          disabled={isUploading}
                          className="hidden"
                          id="attachment-upload"
                        />
                        <label
                          htmlFor="attachment-upload"
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
                                    "hidden",
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
                          Clique em "Adicionar Imagem" para incluir fotos do
                          evento
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
                          setFormData((prev) => ({
                            ...prev,
                            notes: e.target.value,
                          }))
                        }
                        rows={4}
                        placeholder="Adicione observações importantes, requisitos especiais, informações de contato..."
                        className="border-slate-300 focus:border-orange-400 focus:ring-orange-400 dark:border-slate-600 dark:focus:border-orange-500 bg-white dark:bg-slate-800 resize-none"
                      />
                    </div>
                  </div>
                </>
              ) /* fim aba Detalhes */
            }

            {/* ── Aba: Landing Page ── */}
            {activeModalTab === "landing-page" && (
              <div className="space-y-6 py-2">
                {/* Aviso para novo evento */}
                {!editingEvent && (
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Novo evento:</strong> A landing page será
                      publicada automaticamente após você criar o evento.
                      Configure o slug e selecione o arquivo HTML abaixo.
                    </p>
                  </div>
                )}

                {/* URL atual (apenas edição) */}
                {editingEvent?.landingPageHtmlKey && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <GlobeIcon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <span className="text-xs font-mono text-emerald-700 dark:text-emerald-300 truncate flex-1">
                      {window.location.origin}/lp/{editingEvent.slug}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 flex-shrink-0 text-emerald-600 hover:text-emerald-800"
                      title="Copiar URL"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/lp/${editingEvent.slug}`,
                        );
                        toast({ title: "URL copiada!" });
                      }}
                    >
                      <ClipboardCopyIcon className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isDeletingLanding}
                      onClick={handleLandingPageDeleteModal}
                      className="h-6 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
                    >
                      {isDeletingLanding ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <TrashIcon className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Slug */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="lp-slug-tab"
                      className="text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      URL amigável (slug)
                    </Label>
                    <Input
                      id="lp-slug-tab"
                      value={landingPageSlug}
                      onChange={(e) =>
                        setLandingPageSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, ""),
                        )
                      }
                      placeholder="ex: jantar-harmonizacao-jun"
                      className="font-mono text-sm border-slate-300 focus:border-emerald-400 focus:ring-emerald-400 dark:border-slate-600"
                    />
                    {landingPageSlug && (
                      <p className="text-[11px] text-slate-400 font-mono truncate">
                        /lp/{landingPageSlug}
                      </p>
                    )}
                  </div>

                  {/* Arquivo HTML */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Arquivo HTML
                    </Label>
                    <label
                      htmlFor="lp-file-tab"
                      className="flex flex-col items-center justify-center gap-1.5 w-full h-[74px] border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors"
                    >
                      {landingPageFile ? (
                        <>
                          <GlobeIcon className="h-5 w-5 text-emerald-500" />
                          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 truncate px-2 max-w-full">
                            {landingPageFile.name}
                          </span>
                        </>
                      ) : (
                        <>
                          <UploadIcon className="h-5 w-5 text-slate-400" />
                          <span className="text-xs text-slate-500">
                            Selecionar arquivo .html
                          </span>
                        </>
                      )}
                    </label>
                    <input
                      id="lp-file-tab"
                      type="file"
                      accept=".html,text/html"
                      className="hidden"
                      onChange={(e) =>
                        setLandingPageFile(e.target.files?.[0] ?? null)
                      }
                    />
                  </div>
                </div>

                {/* Botão Publicar — apenas para evento existente */}
                {editingEvent && (
                  <Button
                    type="button"
                    onClick={handleLandingPageUploadModal}
                    disabled={
                      isUploadingLanding ||
                      !landingPageFile ||
                      !landingPageSlug.trim()
                    }
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isUploadingLanding ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        Publicando...
                      </>
                    ) : (
                      <>
                        <UploadIcon className="h-4 w-4 mr-1.5" />
                        {editingEvent.landingPageHtmlKey
                          ? "Substituir Landing Page"
                          : "Publicar Landing Page"}
                      </>
                    )}
                  </Button>
                )}

                {/* URL publicada com sucesso */}
                {createdLpUrl ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700">
                      <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-800">
                        <GlobeIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-0.5">
                          Landing Page publicada!
                        </p>
                        <p className="text-sm font-mono text-emerald-800 dark:text-emerald-300 truncate">
                          {createdLpUrl}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 gap-1.5"
                        onClick={() => {
                          navigator.clipboard.writeText(createdLpUrl);
                          toast({
                            title: "URL copiada!",
                            description: "Compartilhe com seus clientes.",
                          });
                        }}
                      >
                        <ClipboardCopyIcon className="h-4 w-4" />
                        Copiar URL
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 gap-1.5"
                        onClick={() => window.open(createdLpUrl, "_blank")}
                      >
                        <GlobeIcon className="h-4 w-4" />
                        Abrir página
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Preview da URL para novo evento */
                  !editingEvent &&
                  landingPageFile &&
                  landingPageSlug.trim() && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                      <GlobeIcon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">
                        Será publicada em{" "}
                        <span className="font-mono font-medium">
                          /lp/{landingPageSlug}
                        </span>{" "}
                        ao criar o evento.
                      </p>
                    </div>
                  )
                )}
              </div>
            )}

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t border-slate-200 dark:border-slate-700 mt-8">
              {createdLpUrl ? (
                <Button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingEvent(null);
                    resetForm();
                  }}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium shadow-lg w-full sm:w-auto px-8"
                >
                  Fechar
                </Button>
              ) : (
                <>
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
                </>
              )}
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

      {/* Modal de Landing Page */}
      <Dialog
        open={!!landingPageEvent}
        onOpenChange={(open) => {
          if (!open) setLandingPageEvent(null);
        }}
      >
        <DialogContent className="sm:max-w-lg mx-4">
          <DialogHeader className="pb-4 border-b border-slate-200 dark:border-slate-700">
            <DialogTitle className="flex items-center gap-3 text-slate-800 dark:text-slate-100 text-lg">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <GlobeIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              Landing Page — {landingPageEvent?.name}
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              Faça o upload de um arquivo HTML para publicar a landing page do
              evento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Slug */}
            <div className="space-y-1.5">
              <Label
                htmlFor="lp-slug"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                URL amigável (slug)
              </Label>
              <Input
                id="lp-slug"
                value={landingPageSlug}
                onChange={(e) =>
                  setLandingPageSlug(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  )
                }
                placeholder="ex: jantar-harmonizacao-junho"
                className="font-mono text-sm"
              />
              {landingPageSlug && (
                <p className="text-xs text-slate-400 font-mono">
                  {window.location.origin}/lp/{landingPageSlug}
                </p>
              )}
            </div>

            {/* Upload do HTML */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Arquivo HTML
              </Label>
              <label
                htmlFor="lp-file"
                className="flex flex-col items-center justify-center gap-2 w-full h-28 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors"
              >
                {landingPageFile ? (
                  <>
                    <GlobeIcon className="h-6 w-6 text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      {landingPageFile.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {(landingPageFile.size / 1024).toFixed(1)} KB
                    </span>
                  </>
                ) : (
                  <>
                    <UploadIcon className="h-6 w-6 text-slate-400" />
                    <span className="text-sm text-slate-500">
                      Clique para selecionar o arquivo .html
                    </span>
                  </>
                )}
              </label>
              <input
                id="lp-file"
                type="file"
                accept=".html,text/html"
                className="hidden"
                onChange={(e) =>
                  setLandingPageFile(e.target.files?.[0] ?? null)
                }
              />
            </div>

            {/* URL atual se já existe */}
            {landingPageEvent?.landingPageHtmlKey && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <GlobeIcon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span className="text-xs font-mono text-emerald-700 dark:text-emerald-300 truncate">
                  {window.location.origin}/lp/{landingPageEvent.slug}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 ml-auto flex-shrink-0 text-emerald-600 hover:text-emerald-800"
                  title="Copiar URL"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/lp/${landingPageEvent.slug}`,
                    );
                    toast({ title: "URL copiada!" });
                  }}
                >
                  <ClipboardCopyIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            {landingPageEvent?.landingPageHtmlKey && (
              <Button
                variant="outline"
                onClick={handleLandingPageDelete}
                disabled={isDeletingLanding}
                className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 w-full sm:w-auto"
              >
                {isDeletingLanding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TrashIcon className="h-4 w-4 mr-1.5" />
                )}
                Remover
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setLandingPageEvent(null)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleLandingPageUpload}
              disabled={
                isUploadingLanding ||
                !landingPageFile ||
                !landingPageSlug.trim()
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
            >
              {isUploadingLanding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Publicando...
                </>
              ) : (
                <>
                  <UploadIcon className="h-4 w-4 mr-1.5" />
                  Publicar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
