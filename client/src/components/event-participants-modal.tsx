import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PlusIcon,
  SearchIcon,
  TrashIcon,
  EditIcon,
  UsersIcon,
  Plus,
  CheckCircle2,
  XCircle,
  MinusCircle,
  FileText,
  DollarSign,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import ClientFormModal from "./client-form-modal";

interface EventParticipant {
  id: string;
  eventId: string;
  clientId: string;
  registrationDate: string;
  status: "pago" | "convidado" | "pendente" | "pagar_na_hora" | "cancelado";
  numberOfParticipants: number;
  customPrice: string | null;
  notes: string | null;
  attended: boolean | null;
  paymentMethod: string | null;
  paymentDate: string | null;
  registeredBy: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  clientBirthDate: string | null;
  registeredByName: string;
}

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

interface Event {
  id: string;
  name: string;
  eventDate: string;
  location: string;
  maxCapacity: number | null;
  pricePerPerson?: string | null;
  category?: string;
  status?: string;
}

interface EventParticipantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event | null;
}

const PARTICIPANT_STATUS = [
  { value: "pago", label: "PAGO", color: "bg-blue-100 text-blue-800" },
  {
    value: "convidado",
    label: "CONVIDADO",
    color: "bg-green-100 text-green-800",
  },
  {
    value: "pendente",
    label: "PENDENTE",
    color: "bg-emerald-100 text-emerald-800",
  },
  {
    value: "pagar_na_hora",
    label: "PAGAR NA HORA",
    color: "bg-orange-100 text-orange-800",
  },
  { value: "cancelado", label: "CANCELADO", color: "bg-red-100 text-red-800" },
];

export default function EventParticipantsModal({
  isOpen,
  onClose,
  event,
}: EventParticipantsModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] =
    useState<EventParticipant | null>(null);
  const [participantToDelete, setParticipantToDelete] =
    useState<EventParticipant | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);

  const [newParticipant, setNewParticipant] = useState({
    clientId: "",
    status: "pago",
    numberOfParticipants: 1,
    customPrice: "",
    paymentMethod: "",
    paymentDate: "",
    notes: "",
  });

  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");

  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [debouncedClientSearchTerm, setDebouncedClientSearchTerm] =
    useState("");
  const [selectedClientDisplay, setSelectedClientDisplay] = useState<{
    name: string;
    phone: string;
  } | null>(null);

  // Debounce do input de busca de cliente
  useEffect(() => {
    // Se um cliente já foi selecionado, não faz a busca
    if (selectedClientDisplay) {
      setDebouncedClientSearchTerm("");
      return;
    }
    const handler = setTimeout(() => {
      setDebouncedClientSearchTerm(clientSearchTerm);
    }, 300); // Aguarda 300ms após o usuário parar de digitar

    return () => {
      clearTimeout(handler);
    };
  }, [clientSearchTerm, selectedClientDisplay]);

  // Buscar participantes do evento
  const { data: participants = [], isLoading: isLoadingParticipants } =
    useQuery<EventParticipant[]>({
      queryKey: ["/api/events", event?.id, "participants"],
      enabled: !!event?.id,
    });

  // Buscar clientes para adicionar ao evento (com debounce e busca no servidor)
  const { data: clientsData, isLoading: isLoadingClients } = useQuery<{
    data: Client[];
  }>({
    queryKey: ["/api/clients", { search: debouncedClientSearchTerm }],
    queryFn: async () => {
      const response = await fetch(
        `/api/clients?search=${encodeURIComponent(debouncedClientSearchTerm)}`,
      );
      if (!response.ok) {
        throw new Error("Erro ao buscar clientes");
      }
      return response.json();
    },
    // A busca só é ativada se o modal estiver aberto e o usuário tiver digitado ao menos 2 caracteres.
    enabled: isAddModalOpen && debouncedClientSearchTerm.trim().length > 1,
    staleTime: 1000 * 60 * 5, // Cache de 5 minutos para os resultados
  });

  const clients = clientsData?.data || [];

  // Filtrar participantes
  const filteredParticipants = useMemo(() => {
    return participants.filter((participant) => {
      // Se não houver busca, mostrar todos os participantes
      const matchesSearch =
        searchTerm.trim() === "" ||
        (participant.clientName &&
          participant.clientName
            .toLowerCase()
            .includes(searchTerm.toLowerCase())) ||
        (participant.clientPhone &&
          participant.clientPhone.includes(searchTerm)) ||
        (participant.clientEmail &&
          participant.clientEmail
            .toLowerCase()
            .includes(searchTerm.toLowerCase()));

      const matchesStatus =
        statusFilter === "all" || participant.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [participants, searchTerm, statusFilter]);

  // Clientes disponíveis para adição (resultados da busca que ainda não estão no evento)
  const availableClients = useMemo(() => {
    if (!clients) return [];
    const participantClientIds = new Set(
      participants.map((p: EventParticipant) => p.clientId),
    );
    return clients.filter(
      (client: Client) => !participantClientIds.has(client.id),
    );
  }, [clients, participants]);

  // Mutation para adicionar participante
  const addParticipantMutation = useMutation({
    mutationFn: async (participantData: typeof newParticipant) => {
      const response = await fetch(`/api/events/${event?.id}/participants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(participantData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao adicionar participante");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/events", event?.id, "participants"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setIsAddModalOpen(false);
      setNewParticipant({
        clientId: "",
        status: "pago",
        numberOfParticipants: 1,
        customPrice: "",
        paymentMethod: "",
        paymentDate: "",
        notes: "",
      });
      setClientSearchTerm("");
      toast({
        title: "Sucesso",
        description: "Participante adicionado com sucesso",
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

  // Mutation para salvar preço customizado inline
  const updatePriceMutation = useMutation({
    mutationFn: async ({
      participantId,
      customPrice,
    }: {
      participantId: string;
      customPrice: string | null;
    }) => {
      const response = await fetch(
        `/api/events/${event?.id}/participants/${participantId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customPrice }),
        },
      );
      if (!response.ok) throw new Error("Erro ao salvar valor");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/events", event?.id, "participants"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setEditingValueId(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar o valor.",
        variant: "destructive",
      });
    },
  });

  const commitPrice = (participantId: string) => {
    const val = editingValue.trim();
    updatePriceMutation.mutate({
      participantId,
      customPrice: val === "" ? null : val,
    });
  };

  // Mutation para atualizar participante
  const updateParticipantMutation = useMutation({
    mutationFn: async (data: {
      status: string;
      notes: string;
      numberOfParticipants: number;
      customPrice: string | null;
      paymentMethod: string | null;
      paymentDate: string | null;
    }) => {
      const response = await fetch(
        `/api/events/${event?.id}/participants/${editingParticipant?.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao atualizar participante");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/events", event?.id, "participants"],
      });
      setEditingParticipant(null);
      toast({
        title: "Sucesso",
        description: "Participante atualizado com sucesso",
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

  // Mutation para remover participante
  const removeParticipantMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const response = await fetch(
        `/api/events/${event?.id}/participants/${participantId}`,
        {
          method: "DELETE",
          headers: {},
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao remover participante");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/events", event?.id, "participants"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setParticipantToDelete(null);
      toast({
        title: "Sucesso",
        description: "Participante removido com sucesso",
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

  // Mutation para confirmar/negar presença
  const updateAttendanceMutation = useMutation({
    mutationFn: async ({
      participantId,
      attended,
    }: {
      participantId: string;
      attended: boolean | null;
    }) => {
      const response = await fetch(
        `/api/events/${event?.id}/participants/${participantId}/attendance`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attended }),
        },
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao atualizar presença");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/events", event?.id, "participants"],
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

  const getStatusBadge = (status: string, attended?: boolean | null) => {
    if (attended === false) {
      return <Badge className="bg-red-100 text-red-800">AUSENTE</Badge>;
    }
    const statusConfig = PARTICIPANT_STATUS.find((s) => s.value === status);
    return <Badge className={statusConfig?.color}>{statusConfig?.label}</Badge>;
  };

  const handleAddParticipant = () => {
    if (!newParticipant.clientId) {
      toast({
        title: "Erro",
        description: "Selecione um cliente",
        variant: "destructive",
      });
      return;
    }

    addParticipantMutation.mutate(newParticipant);
  };

  const handleUpdateParticipant = (
    status: string,
    notes: string,
    numberOfParticipants: number,
    customPrice: string | null,
    paymentMethod: string | null,
    paymentDate: string | null,
  ) => {
    updateParticipantMutation.mutate({
      status,
      notes,
      numberOfParticipants,
      customPrice,
      paymentMethod,
      paymentDate,
    });
  };

  const escapeHtml = (text: string) => {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  };

  const openPrintWindow = (html: string) => {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      toast({
        title: "Erro",
        description:
          "Não foi possível abrir a janela. Verifique se pop-ups estão bloqueados.",
        variant: "destructive",
      });
    }
  };

  const STATUS_LABELS: Record<string, string> = {
    pago: "PAGO",
    convidado: "CONVIDADO",
    pendente: "PENDENTE",
    pagar_na_hora: "PAGAR NA HORA",
    cancelado: "CANCELADO",
  };

  const STATUS_COLORS: Record<string, string> = {
    pago: "background:#dbeafe;color:#1e40af",
    convidado: "background:#dcfce7;color:#15803d",
    pendente: "background:#d1fae5;color:#047857",
    pagar_na_hora: "background:#fed7aa;color:#ea580c",
    cancelado: "background:#fee2e2;color:#dc2626",
  };

  const formatBirthDate = (birthday: string | null) => {
    if (!birthday) return "—";
    const parts = birthday.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return birthday;
  };

  const handleExportParticipants = () => {
    if (participants.length === 0) {
      toast({
        title: "Aviso",
        description: "Nenhum participante para exportar.",
      });
      return;
    }

    const totalParticipants = participants.reduce(
      (sum, p) => sum + (p.numberOfParticipants || 1),
      0,
    );

    const logoUrl = `${window.location.origin}/logo-grand-cru-red%20(1).webp`;

    const formatRegistrationDate = (date: string | null) => {
      if (!date) return "";
      const d = new Date(date);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    const rows = participants
      .map((p, i) => {
        const displayStatus = p.status === "convidado" ? "pago" : p.status;
        const rowBg = i % 2 === 0 ? "#ffffff" : "#fdf6f7";
        return `
      <tr style="background:${rowBg};">
        <td class="col-name">${escapeHtml(p.clientName || "")}</td>
        <td>${escapeHtml(p.clientPhone || "")}</td>
        <td class="center">${formatBirthDate(p.clientBirthDate) === "—" ? "" : formatBirthDate(p.clientBirthDate)}</td>
        <td class="center fw6">${p.numberOfParticipants || 1}</td>
        <td class="center"><span class="badge b-${displayStatus}">${STATUS_LABELS[displayStatus] || displayStatus.toUpperCase()}</span></td>
        <td class="center">${formatRegistrationDate(p.registrationDate)}</td>
      </tr>`;
      })
      .join("");

    const now = new Date();
    const eventStatusLabels: Record<string, string> = {
      planejado: "Planejado",
      ativo: "Ativo",
      finalizado: "Finalizado",
      cancelado: "Cancelado",
    };
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Lista de Participantes — ${escapeHtml(event.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Inter', Arial, sans-serif;
      font-size: 13px;
      color: #111;
      background: #fff;
      padding: 28px 36px;
      line-height: 1.5;
    }

    /* ─── Topo: logo + título ─── */
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .page-header img { height: 36px; object-fit: contain; }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 22px;
      font-weight: 700;
      color: #8b1a2c;
      text-align: center;
      flex: 1;
    }
    .title-rule {
      border: none;
      border-top: 2px solid #8b1a2c;
      margin-bottom: 18px;
    }

    /* ─── Info do evento ─── */
    .event-name {
      font-family: 'Outfit', sans-serif;
      font-size: 15px;
      font-weight: 700;
      color: #6b1428;
      margin-bottom: 10px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 40px;
      margin-bottom: 18px;
    }
    .info-row { font-size: 12px; color: #374151; }
    .info-row strong { font-weight: 700; color: #111; }

    /* ─── Tabela ─── */
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th {
      border: 1px solid #6b1428;
      background: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 7px 10px;
      text-align: left;
      vertical-align: bottom;
      color: #111;
    }
    td {
      border: 1px solid #d1d5db;
      font-size: 12px;
      padding: 8px 10px;
      vertical-align: middle;
      color: #111;
    }
    tr:nth-child(odd)  td { background: #fff; }
    tr:nth-child(even) td { background: #fdf6f7; }
    .col-name { font-weight: 600; }
    .center { text-align: center; }
    .fw6    { font-weight: 600; }

    .badge {
      display: inline-block;
      padding: 2px 9px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .2px;
      white-space: nowrap;
    }
    .b-pago         { background:#dbeafe; color:#1e40af; }
    .b-pendente     { background:#fef9c3; color:#854d0e; }
    .b-pagar_na_hora{ background:#ffedd5; color:#c2410c; }
    .b-cancelado    { background:#fee2e2; color:#991b1b; }

    /* ─── Rodapé ─── */
    footer {
      text-align: center;
      font-size: 10px;
      color: #6b7280;
      border-top: 1px solid #d1d5db;
      padding-top: 8px;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 18px 28px; }
      @page { margin: 0; size: A4 portrait; }
    }
  </style>
</head>
<body>

  <div class="page-header">
    <img src="${logoUrl}" alt="Grand Cru" />
    <h1>Lista de Participantes</h1>
    <div style="width:80px"></div>
  </div>
  <hr class="title-rule" />

  <div class="event-name">${escapeHtml(event.name)}</div>

  <div class="info-grid">
    <div class="info-row"><strong>Data:</strong> ${formatDate(event.eventDate)}</div>
    ${event.pricePerPerson ? `<div class="info-row"><strong>Valor por Pessoa:</strong> ${formatCurrency(parseFloat(event.pricePerPerson))}</div>` : "<div></div>"}
    <div class="info-row"><strong>Local:</strong> ${escapeHtml(event.location)}</div>
    ${event.maxCapacity ? `<div class="info-row"><strong>Capacidade:</strong> ${totalParticipants} / ${event.maxCapacity}</div>` : "<div></div>"}
    ${event.category ? `<div class="info-row"><strong>Categoria:</strong> ${escapeHtml(event.category)}</div>` : "<div></div>"}
    ${event.status ? `<div class="info-row"><strong>Status:</strong> ${eventStatusLabels[event.status] || event.status}</div>` : "<div></div>"}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:18%">Nome do<br>Cliente</th>
        <th style="width:13%">Telefone</th>
        <th style="width:13%" class="center">Data de Aniversário</th>
        <th style="width:7%"  class="center">Nº<br>Participantes</th>
        <th style="width:9%"  class="center">Status</th>
        <th style="width:13%" class="center">Data de<br>Inscrição</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <footer>
    <div>Lista gerada em: ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}</div>
    <div>Total de participantes: ${totalParticipants}</div>
  </footer>

  <script>window.onload = function() { setTimeout(function() { window.print(); }, 800); };</script>
</body>
</html>`;

    openPrintWindow(html);
  };

  const handleExportFinancial = () => {
    if (participants.length === 0) {
      toast({
        title: "Aviso",
        description: "Nenhum participante para exportar.",
      });
      return;
    }

    let totalPago = 0;
    let totalPendente = 0;
    let totalGeral = 0;

    const logoUrl = `${window.location.origin}/logo-grand-cru-red%20(1).webp`;

    const totalPessoas = participants.reduce(
      (sum, p) => sum + (p.numberOfParticipants || 1),
      0,
    );

    const rows = participants
      .map((p, i) => {
        const qty = p.numberOfParticipants || 1;
        const total = p.customPrice ? parseFloat(p.customPrice) : 0;
        if (p.status === "pago" || p.status === "convidado") totalPago += total;
        else if (p.status === "pendente" || p.status === "pagar_na_hora")
          totalPendente += total;
        if (p.status !== "cancelado") totalGeral += total;
        const paymentDateStr = p.paymentDate
          ? new Date(p.paymentDate).toLocaleDateString("pt-BR", {
              timeZone: "UTC",
            })
          : "—";
        const presencaText =
          p.attended === true
            ? "Presente"
            : p.attended === false
              ? "Ausente"
              : "—";
        const presencaColor =
          p.attended === true
            ? "#15803d"
            : p.attended === false
              ? "#b91c1c"
              : "#94a3b8";
        const rowBg = i % 2 === 0 ? "#ffffff" : "#fdf6f7";
        return `
        <tr style="background:${rowBg};">
          <td class="col-name">${escapeHtml(p.clientName || "")}</td>
          <td class="center fw6">${qty}</td>
          <td class="center" style="color:${presencaColor};font-weight:600;">${presencaText}</td>
          <td><span class="badge-status s-${p.status}">${STATUS_LABELS[p.status] || p.status}</span></td>
          <td>${escapeHtml(p.paymentMethod || "—")}</td>
          <td class="center">${paymentDateStr}</td>
          <td class="right fw6 wine">${formatCurrency(total)}</td>
          <td class="obs">${escapeHtml(p.notes || "")}</td>
        </tr>`;
      })
      .join("");

    const now = new Date();
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório Financeiro — ${escapeHtml(event.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700&display=swap" rel="stylesheet">
  <style>
    *  { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
      font-size: 11.5px;
      color: #1e293b;
      background: #fff;
      line-height: 1.5;
    }

    /* ─── Cabeçalho ─────────────────────────── */
    header {
      background: #8b1a2c;
      padding: 16px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    header img { height: 36px; object-fit: contain; filter: brightness(0) invert(1); }
    header .doc-label {
      font-family: 'Outfit', sans-serif;
      font-size: 15px;
      font-weight: 700;
      color: #faf7f5;
      letter-spacing: .3px;
    }

    /* ─── Faixa do evento ────────────────────── */
    .event-bar {
      border-bottom: 1px solid #f4cdd3;
      padding: 12px 28px;
      display: flex;
      gap: 28px;
      flex-wrap: wrap;
      align-items: baseline;
      background: #fdf6f7;
    }
    .event-bar h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 15px;
      font-weight: 700;
      color: #6b1428;
      width: 100%;
      margin-bottom: 4px;
    }
    .info-pill { font-size: 11.5px; color: #475569; }
    .info-pill span { font-weight: 600; color: #1e293b; }

    /* ─── Cards de resumo ────────────────────── */
    .summary-row { display:flex; border-bottom: 2px solid #e2e8f0; }
    .summary-card {
      flex: 1;
      padding: 14px 0;
      text-align: center;
      border-right: 1px solid #e2e8f0;
    }
    .summary-card:last-child { border-right: none; }
    .summary-card .s-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .6px; color: #64748b; }
    .summary-card .s-value { font-family: 'Outfit', sans-serif; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.1; margin-top: 3px; }
    .summary-card.wine  .s-value { color: #8b1a2c; }
    .summary-card.amber .s-value { color: #b45309; }

    /* ─── Tabela ─────────────────────────────── */
    .table-wrap { padding: 18px 28px 24px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #8b1a2c; }
    th {
      color: #faf7f5;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .5px;
      padding: 9px 10px;
      text-align: left;
      white-space: nowrap;
    }
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
      color: #334155;
    }
    .totals-row td {
      background: #fdf6f7;
      border-top: 2px solid #f4cdd3;
      border-bottom: none;
      font-weight: 700;
      color: #0f172a;
      padding: 10px 10px;
    }

    /* helpers */
    .col-name  { font-weight: 600; color: #0f172a; }
    .center    { text-align: center; }
    .right     { text-align: right; }
    .fw6       { font-weight: 600; }
    .wine      { color: #8b1a2c; }
    .obs       { color: #64748b; font-size: 11px; }
    .custom-tag{ font-size: 9px; font-weight: 700; color: #b45309; background:#fef3c7; padding:1px 4px; border-radius:3px; vertical-align:middle; }

    /* badges */
    .badge-status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 99px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .3px;
      white-space: nowrap;
    }
    .s-pago          { background:#dbeafe; color:#1e40af; }
    .s-convidado     { background:#dcfce7; color:#15803d; }
    .s-pendente      { background:#fef9c3; color:#854d0e; }
    .s-pagar_na_hora { background:#ffedd5; color:#c2410c; }
    .s-cancelado     { background:#fee2e2; color:#991b1b; }

    /* ─── Rodapé ─────────────────────────────── */
    footer {
      border-top: 1px solid #e2e8f0;
      padding: 9px 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #94a3b8;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { margin: 0; size: A4 landscape; }
    }
  </style>
</head>
<body>

  <header>
    <img src="${logoUrl}" alt="Grand Cru" />
    <span class="doc-label">Relatório Financeiro</span>
  </header>

  <div class="event-bar">
    <h2>${escapeHtml(event.name)}</h2>
    <div class="info-pill">Data &nbsp;<span>${formatDate(event.eventDate)}</span></div>
    <div class="info-pill">Local &nbsp;<span>${escapeHtml(event.location)}</span></div>
    <div class="info-pill">Inscrições &nbsp;<span>${participants.length}</span></div>
    <div class="info-pill">Total de Pessoas &nbsp;<span>${totalPessoas}</span></div>
  </div>

  <div class="summary-row">
    <div class="summary-card wine">
      <div class="s-label">Total Recebido</div>
      <div class="s-value">${formatCurrency(totalPago)}</div>
    </div>
    <div class="summary-card amber">
      <div class="s-label">Total Pendente</div>
      <div class="s-value">${formatCurrency(totalPendente)}</div>
    </div>
    <div class="summary-card">
      <div class="s-label">Total Geral</div>
      <div class="s-value">${formatCurrency(totalGeral)}</div>
    </div>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Nome</th>
          <th class="center">Nº Pessoas</th>
          <th class="center">Presença</th>
          <th>Status</th>
          <th>Forma de Pgto.</th>
          <th class="center">Data Pgto.</th>
          <th class="right">Valor Total</th>
          <th>Observações</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="totals-row">
          <td colspan="7" style="text-align:right; padding-right:10px;">Total geral (excl. cancelados)</td>
          <td class="right wine" style="font-size:13px;">${formatCurrency(totalGeral)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>

  <footer>
    <span>Gerado em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}</span>
    <span>${escapeHtml(event.name)} · Relatório Financeiro · Uso restrito ao setor financeiro</span>
  </footer>

  <script>window.onload = function() { setTimeout(function() { window.print(); }, 800); };</script>
</body>
</html>`;

    openPrintWindow(html);
  };

  if (!event) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl w-full max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-3 shrink-0 border-b bg-slate-50/60">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <UsersIcon className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="truncate">Participantes — {event.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 truncate mt-0.5">
              {formatDate(event.eventDate)} · {event.location}
            </DialogDescription>
          </DialogHeader>

          {/* Barra de ferramentas */}
          <div className="px-4 py-2.5 shrink-0 space-y-2 border-b bg-white">
            {/* Linha 1: busca + filtro */}
            <div className="flex flex-wrap gap-2">
              <div className="relative w-56 shrink-0">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5 pointer-events-none" />
                <Input
                  placeholder="Buscar participantes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-8 text-xs shrink-0">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {PARTICIPANT_STATUS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Linha 2: contagem + ações */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-gray-500 shrink-0">
                <span className="font-semibold text-gray-700">
                  {participants.reduce(
                    (t, p) => t + (p.numberOfParticipants || 1),
                    0,
                  )}
                </span>
                {event.maxCapacity && (
                  <span className="text-gray-400"> / {event.maxCapacity}</span>
                )}{" "}
                participantes
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportParticipants}
                  className="h-7 px-2.5 text-xs gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Lista
                </Button>
                {(user?.role === "admin" || user?.role === "gerente") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportFinancial}
                    className="h-7 px-2.5 text-xs gap-1.5"
                  >
                    <DollarSign className="h-3.5 w-3.5" />
                    Financeiro
                  </Button>
                )}
                {user?.role === "admin" && (
                  <Button
                    size="sm"
                    onClick={() => setIsAddModalOpen(true)}
                    className="h-7 px-2.5 text-xs gap-1.5"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Adicionar
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto min-h-0">
            {/* Tabela de participantes */}
            {isLoadingParticipants ? (
              <div className="space-y-2 px-4 py-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 border rounded-lg"
                  >
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-8 ml-auto" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-8 w-14" />
                  </div>
                ))}
              </div>
            ) : filteredParticipants.length === 0 ? (
              <div className="text-center py-12 text-gray-500 px-4">
                <UsersIcon className="h-12 w-12 mx-auto mb-3 text-gray-200" />
                <p className="font-medium text-sm">
                  Nenhum participante encontrado
                </p>
                <p className="text-xs mt-1 text-gray-400">
                  {searchTerm || statusFilter !== "all"
                    ? "Ajuste os filtros para ver os participantes."
                    : "Ainda não há participantes neste evento."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="text-sm min-w-[640px]">
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                      <TableHead className="font-semibold py-2 w-[180px]">
                        Cliente
                      </TableHead>
                      <TableHead className="font-semibold py-2 w-[120px]">
                        Contato
                      </TableHead>
                      <TableHead className="font-semibold py-2 text-center w-[50px]">
                        Pax
                      </TableHead>
                      <TableHead className="font-semibold py-2 text-right w-[100px]">
                        Valor
                      </TableHead>
                      <TableHead className="font-semibold py-2 w-[100px]">
                        Status
                      </TableHead>
                      <TableHead className="font-semibold py-2 text-center w-[70px]">
                        Presença
                      </TableHead>
                      <TableHead className="font-semibold py-2 w-[140px]">
                        Inscrição / Resp.
                      </TableHead>
                      {user?.role === "admin" && (
                        <TableHead className="font-semibold py-2 w-[80px]">
                          Ações
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParticipants.map((participant) => (
                      <TableRow
                        key={participant.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <TableCell className="py-2">
                          <div className="font-medium text-slate-900 dark:text-slate-100 leading-tight">
                            {participant.clientName || (
                              <span className="text-gray-400 italic text-xs">
                                Cliente removido
                              </span>
                            )}
                          </div>
                          {participant.notes && (
                            <div
                              className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]"
                              title={participant.notes}
                            >
                              {participant.notes}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="text-slate-700 dark:text-slate-300 text-xs leading-tight">
                            {participant.clientPhone || "—"}
                          </div>
                          {participant.clientEmail && (
                            <div
                              className="text-gray-400 text-xs truncate max-w-[120px]"
                              title={participant.clientEmail}
                            >
                              {participant.clientEmail}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-2 text-center">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {participant.numberOfParticipants}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {user?.role === "admin" &&
                          editingValueId === participant.id ? (
                            <div className="flex items-center gap-1 justify-end">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                autoFocus
                                value={editingValue}
                                onChange={(e) =>
                                  setEditingValue(e.target.value)
                                }
                                onBlur={() => commitPrice(participant.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    commitPrice(participant.id);
                                  if (e.key === "Escape")
                                    setEditingValueId(null);
                                }}
                                className="w-24 text-right text-sm border border-blue-400 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-slate-800 dark:text-slate-100"
                              />
                            </div>
                          ) : (
                            <div
                              className={`text-sm cursor-pointer group ${user?.role === "admin" ? "hover:bg-slate-100 dark:hover:bg-slate-700 rounded px-1 py-0.5" : ""}`}
                              title={
                                user?.role === "admin"
                                  ? "Clique para editar o valor"
                                  : undefined
                              }
                              onClick={() => {
                                if (user?.role !== "admin") return;
                                const displayed = participant.customPrice
                                  ? parseFloat(participant.customPrice).toFixed(
                                      2,
                                    )
                                  : "";
                                setEditingValue(displayed);
                                setEditingValueId(participant.id);
                              }}
                            >
                              {(() => {
                                const customTotal = participant.customPrice
                                  ? parseFloat(participant.customPrice)
                                  : null;
                                return (
                                  <span
                                    className={`font-semibold ${customTotal !== null ? "text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-slate-300"}`}
                                  >
                                    {formatCurrency(customTotal ?? 0)}
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          {getStatusBadge(
                            participant.status,
                            participant.attended,
                          )}
                        </TableCell>
                        <TableCell className="py-2 text-center">
                          {user?.role === "admin" ? (
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                onClick={() =>
                                  updateAttendanceMutation.mutate({
                                    participantId: participant.id,
                                    attended:
                                      participant.attended === true
                                        ? null
                                        : true,
                                  })
                                }
                                title="Marcar como presente"
                                className={`p-1 rounded-full transition-colors ${
                                  participant.attended === true
                                    ? "text-green-600 bg-green-100 dark:bg-green-900/30"
                                    : "text-slate-300 hover:text-green-500 dark:text-slate-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                                }`}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() =>
                                  updateAttendanceMutation.mutate({
                                    participantId: participant.id,
                                    attended:
                                      participant.attended === false
                                        ? null
                                        : false,
                                  })
                                }
                                title="Marcar como ausente"
                                className={`p-1 rounded-full transition-colors ${
                                  participant.attended === false
                                    ? "text-red-600 bg-red-100 dark:bg-red-900/30"
                                    : "text-slate-300 hover:text-red-500 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                }`}
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="flex justify-center">
                              {participant.attended === true ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : participant.attended === false ? (
                                <XCircle className="h-4 w-4 text-red-500" />
                              ) : (
                                <MinusCircle className="h-4 w-4 text-slate-300" />
                              )}
                            </span>
                          )}
                        </TableCell>
                        {/* Inscrição + Responsável numa única célula */}
                        <TableCell className="py-2">
                          <div className="text-xs text-slate-600 dark:text-slate-400 leading-tight">
                            {formatDate(participant.registrationDate)}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            {participant.registeredByName}
                          </div>
                        </TableCell>
                        {user?.role === "admin" && (
                          <TableCell className="py-2">
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setEditingParticipant(participant)
                                }
                                className="h-7 w-7 p-0 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                                title="Editar"
                              >
                                <EditIcon className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setParticipantToDelete(participant)
                                }
                                className="h-7 w-7 p-0 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                                title="Remover"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para adicionar participante */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md w-full max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Participante</DialogTitle>
            <DialogDescription>
              Selecione um cliente para adicionar ao evento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Cliente</Label>
              <div className="space-y-2">
                {selectedClientDisplay ? (
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                    <div>
                      <p className="font-medium">
                        {selectedClientDisplay.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {selectedClientDisplay.phone}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSelectedClientDisplay(null);
                        setNewParticipant((prev) => ({
                          ...prev,
                          clientId: "",
                        }));
                      }}
                    >
                      Alterar
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Buscar por nome, telefone ou email..."
                        value={clientSearchTerm}
                        onChange={(e) => setClientSearchTerm(e.target.value)}
                        className="flex-1"
                        data-testid="input-client-search"
                      />
                    </div>
                    <div className="border rounded-md max-h-60 overflow-y-auto">
                      {isLoadingClients ? (
                        <div className="p-3 text-sm text-center text-gray-500">
                          Buscando...
                        </div>
                      ) : availableClients.length > 0 ? (
                        <div>
                          {availableClients.map((client: Client) => (
                            <div
                              key={client.id}
                              className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                              onClick={() => {
                                setNewParticipant((prev) => ({
                                  ...prev,
                                  clientId: client.id,
                                }));
                                setSelectedClientDisplay({
                                  name: client.name,
                                  phone: client.phone,
                                });
                                setClientSearchTerm("");
                              }}
                            >
                              <p className="font-medium">{client.name}</p>
                              <p className="text-sm text-gray-500">
                                {client.phone}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center pb-4">
                          <div className="p-3 text-sm text-center text-gray-500">
                            {debouncedClientSearchTerm.trim().length < 2
                              ? "Digite ao menos 2 caracteres para buscar."
                              : clients.length > 0 &&
                                  availableClients.length === 0
                                ? "Todos os clientes encontrados já participam do evento."
                                : "Nenhum cliente encontrado."}
                          </div>

                          <Button
                            onClick={() => setShowCreateClientModal(true)}
                            size={"sm"}
                            variant={"outline"}
                          >
                            <Plus />
                            Novo cliente
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <Label>Número de Participantes</Label>
              <Input
                type="number"
                min="1"
                value={newParticipant.numberOfParticipants}
                onChange={(e) =>
                  setNewParticipant((prev) => ({
                    ...prev,
                    numberOfParticipants: Math.max(
                      1,
                      parseInt(e.target.value) || 1,
                    ),
                  }))
                }
                placeholder="Quantos participantes..."
                data-testid="input-number-participants"
              />
            </div>

            <div>
              <Label>Status</Label>
              <Select
                value={newParticipant.status}
                onValueChange={(value) =>
                  setNewParticipant((prev) => ({
                    ...prev,
                    status: value,
                    customPrice: "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTICIPANT_STATUS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {newParticipant.status === "pago" && (
              <div>
                <Label>Valor pago (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={newParticipant.customPrice}
                  onChange={(e) =>
                    setNewParticipant((prev) => ({
                      ...prev,
                      customPrice: e.target.value,
                    }))
                  }
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Forma de Pagamento</Label>
                <Select
                  value={newParticipant.paymentMethod}
                  onValueChange={(value) =>
                    setNewParticipant((prev) => ({
                      ...prev,
                      paymentMethod: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="Link">Link</SelectItem>
                    <SelectItem value="Cartão de Crédito">
                      Cartão de Crédito
                    </SelectItem>
                    <SelectItem value="Cartão de Débito">
                      Cartão de Débito
                    </SelectItem>
                    <SelectItem value="Transferência Bancária">
                      Transferência Bancária
                    </SelectItem>
                    <SelectItem value="Boleto">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de Pagamento</Label>
                <Input
                  type="date"
                  value={newParticipant.paymentDate}
                  onChange={(e) =>
                    setNewParticipant((prev) => ({
                      ...prev,
                      paymentDate: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={newParticipant.notes}
                onChange={(e) =>
                  setNewParticipant((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                placeholder="Observações sobre a participação..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddParticipant}
              disabled={addParticipantMutation.isPending}
            >
              Adicionar Participante
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para editar participante */}
      <Dialog
        open={!!editingParticipant}
        onOpenChange={() => setEditingParticipant(null)}
      >
        <DialogContent className="max-w-md w-full max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Participante</DialogTitle>
            <DialogDescription>
              Altere o status e observações do participante
            </DialogDescription>
          </DialogHeader>

          {editingParticipant && (
            <div className="space-y-4">
              <div>
                <Label>Cliente</Label>
                <Input value={editingParticipant.clientName} disabled />
              </div>

              <div>
                <Label>Status</Label>
                <Select
                  value={editingParticipant.status}
                  onValueChange={(value) =>
                    setEditingParticipant((prev) =>
                      prev ? { ...prev, status: value as any } : null,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTICIPANT_STATUS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {editingParticipant.status === "pago" && (
                <div>
                  <Label>Valor pago (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={editingParticipant.customPrice ?? ""}
                    onChange={(e) =>
                      setEditingParticipant((prev) =>
                        prev
                          ? { ...prev, customPrice: e.target.value || null }
                          : null,
                      )
                    }
                  />
                </div>
              )}

              <div>
                <Label>Número de Participantes</Label>
                <Input
                  type="number"
                  min="1"
                  value={editingParticipant.numberOfParticipants}
                  onChange={(e) =>
                    setEditingParticipant((prev) =>
                      prev
                        ? {
                            ...prev,
                            numberOfParticipants: Math.max(
                              1,
                              parseInt(e.target.value) || 1,
                            ),
                          }
                        : null,
                    )
                  }
                  placeholder="Quantos participantes..."
                  data-testid="input-edit-number-participants"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Forma de Pagamento</Label>
                  <Select
                    value={editingParticipant.paymentMethod || ""}
                    onValueChange={(value) =>
                      setEditingParticipant((prev) =>
                        prev ? { ...prev, paymentMethod: value || null } : null,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="Link">Link</SelectItem>
                      <SelectItem value="Cartão de Crédito">
                        Cartão de Crédito
                      </SelectItem>
                      <SelectItem value="Cartão de Débito">
                        Cartão de Débito
                      </SelectItem>
                      <SelectItem value="Transferência Bancária">
                        Transferência Bancária
                      </SelectItem>
                      <SelectItem value="Boleto">Boleto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data de Pagamento</Label>
                  <Input
                    type="date"
                    value={
                      editingParticipant.paymentDate
                        ? new Date(
                            editingParticipant.paymentDate,
                          ).toLocaleDateString("en-CA", {
                            timeZone: "UTC",
                          })
                        : ""
                    }
                    onChange={(e) =>
                      setEditingParticipant((prev) =>
                        prev
                          ? { ...prev, paymentDate: e.target.value || null }
                          : null,
                      )
                    }
                  />
                </div>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={editingParticipant.notes || ""}
                  onChange={(e) =>
                    setEditingParticipant((prev) =>
                      prev ? { ...prev, notes: e.target.value } : null,
                    )
                  }
                  placeholder="Observações sobre a participação..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingParticipant(null)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() =>
                editingParticipant &&
                handleUpdateParticipant(
                  editingParticipant.status,
                  editingParticipant.notes || "",
                  editingParticipant.numberOfParticipants,
                  editingParticipant.customPrice || null,
                  editingParticipant.paymentMethod || null,
                  editingParticipant.paymentDate || null,
                )
              }
              disabled={updateParticipantMutation.isPending}
            >
              Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão */}
      <Dialog
        open={!!participantToDelete}
        onOpenChange={() => setParticipantToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Remoção</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover "{participantToDelete?.clientName}"
              do evento? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setParticipantToDelete(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                participantToDelete &&
                removeParticipantMutation.mutate(participantToDelete.id)
              }
              disabled={removeParticipantMutation.isPending}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClientFormModal
        open={showCreateClientModal}
        onOpenChange={setShowCreateClientModal}
      />
    </>
  );
}
