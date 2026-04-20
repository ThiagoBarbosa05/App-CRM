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
  registeredBy: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
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
    notes: "",
  });

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
        `/api/clients?search=${encodeURIComponent(debouncedClientSearchTerm)}`
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
      participants.map((p: EventParticipant) => p.clientId)
    );
    return clients.filter(
      (client: Client) => !participantClientIds.has(client.id)
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

  // Mutation para atualizar participante
  const updateParticipantMutation = useMutation({
    mutationFn: async (data: { status: string; notes: string; numberOfParticipants: number; customPrice: string | null }) => {
      const response = await fetch(
        `/api/events/${event?.id}/participants/${editingParticipant?.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        }
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
          headers: {
          },
        }
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
    mutationFn: async ({ participantId, attended }: { participantId: string; attended: boolean | null }) => {
      const response = await fetch(
        `/api/events/${event?.id}/participants/${participantId}/attendance`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attended }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao atualizar presença");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", event?.id, "participants"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
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

  const handleUpdateParticipant = (status: string, notes: string, numberOfParticipants: number, customPrice: string | null) => {
    updateParticipantMutation.mutate({ status, notes, numberOfParticipants, customPrice });
  };

  if (!event) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5" />
              Participantes - {event.name}
            </DialogTitle>
            <DialogDescription>
              Gerencie os participantes do evento ({formatDate(event.eventDate)}{" "}
              - {event.location})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Cabeçalho com filtros e botão adicionar */}
            <div className="flex justify-between items-center">
              <div className="flex gap-4 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Buscar participantes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filtrar por status" />
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
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {participants.reduce(
                    (total, p) => total + (p.numberOfParticipants || 1),
                    0
                  )}
                  {event.maxCapacity && ` / ${event.maxCapacity}`} participantes
                </span>
                {user?.role === "admin" && (
                  <Button onClick={() => setIsAddModalOpen(true)}>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Adicionar Participante
                  </Button>
                )}
              </div>
            </div>

            {/* Tabela de participantes */}
            {isLoadingParticipants ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-8 ml-auto" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))}
              </div>
            ) : filteredParticipants.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <UsersIcon className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">Nenhum participante encontrado</p>
                <p className="text-sm mt-1">
                  {searchTerm || statusFilter !== "all"
                    ? "Ajuste os filtros para ver os participantes."
                    : "Ainda não há participantes neste evento."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                    <TableHead className="font-semibold">Cliente</TableHead>
                    <TableHead className="font-semibold">Contato</TableHead>
                    <TableHead className="font-semibold text-center">Nº Pessoas</TableHead>
                    <TableHead className="font-semibold text-right">Valor</TableHead>
                    <TableHead className="font-semibold">Status Pgto.</TableHead>
                    <TableHead className="font-semibold text-center">Presença</TableHead>
                    <TableHead className="font-semibold">Inscrição</TableHead>
                    <TableHead className="font-semibold">Responsável</TableHead>
                    {user?.role === "admin" && (
                      <TableHead className="font-semibold">Ações</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParticipants.map((participant) => (
                    <TableRow
                      key={participant.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <TableCell>
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {participant.clientName || (
                            <span className="text-gray-400 italic">
                              Cliente removido
                            </span>
                          )}
                        </div>
                        {participant.notes && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {participant.notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="text-slate-700 dark:text-slate-300">{participant.clientPhone || "—"}</div>
                          {participant.clientEmail && (
                            <div className="text-gray-500 text-xs">
                              {participant.clientEmail}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold text-base text-slate-800 dark:text-slate-200">
                          {participant.numberOfParticipants}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const eventPrice = parseFloat(event.pricePerPerson || "0") || 0;
                          const unitPrice = participant.customPrice ? parseFloat(participant.customPrice) : eventPrice;
                          const total = unitPrice * participant.numberOfParticipants;
                          return (
                            <div className="text-sm">
                              <span className={`font-semibold ${participant.customPrice ? "text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-slate-300"}`}>
                                {formatCurrency(total)}
                              </span>
                              {participant.customPrice && eventPrice !== unitPrice && (
                                <div className="text-xs text-slate-400 line-through">
                                  {formatCurrency(eventPrice * participant.numberOfParticipants)}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(participant.status, participant.attended)}
                      </TableCell>
                      <TableCell className="text-center">
                        {user?.role === "admin" ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => updateAttendanceMutation.mutate({
                                participantId: participant.id,
                                attended: participant.attended === true ? null : true,
                              })}
                              title="Marcar como presente"
                              className={`p-1 rounded-full transition-colors ${
                                participant.attended === true
                                  ? "text-green-600 bg-green-100 dark:bg-green-900/30"
                                  : "text-slate-300 hover:text-green-500 dark:text-slate-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                              }`}
                            >
                              <CheckCircle2 className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => updateAttendanceMutation.mutate({
                                participantId: participant.id,
                                attended: participant.attended === false ? null : false,
                              })}
                              title="Marcar como ausente"
                              className={`p-1 rounded-full transition-colors ${
                                participant.attended === false
                                  ? "text-red-600 bg-red-100 dark:bg-red-900/30"
                                  : "text-slate-300 hover:text-red-500 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              }`}
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                          </div>
                        ) : (
                          <span className="flex justify-center">
                            {participant.attended === true ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : participant.attended === false ? (
                              <XCircle className="h-5 w-5 text-red-500" />
                            ) : (
                              <MinusCircle className="h-5 w-5 text-slate-300" />
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                        {formatDate(participant.registrationDate)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                        {participant.registeredByName}
                      </TableCell>
                      {user?.role === "admin" && (
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingParticipant(participant)}
                              className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 gap-1.5"
                            >
                              <EditIcon className="h-3.5 w-3.5" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setParticipantToDelete(participant)}
                              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 gap-1.5"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                              Remover
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para adicionar participante */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
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
                      parseInt(e.target.value) || 1
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
                  setNewParticipant((prev) => ({ ...prev, status: value }))
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
        <DialogContent>
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
                      prev ? { ...prev, status: value as any } : null
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

              <div>
                <Label>Número de Participantes</Label>
                <Input
                  type="number"
                  min="1"
                  value={editingParticipant.numberOfParticipants}
                  onChange={(e) =>
                    setEditingParticipant((prev) =>
                      prev ? { 
                        ...prev, 
                        numberOfParticipants: Math.max(1, parseInt(e.target.value) || 1) 
                      } : null
                    )
                  }
                  placeholder="Quantos participantes..."
                  data-testid="input-edit-number-participants"
                />
              </div>

              <div>
                <Label>Valor (R$)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingParticipant.customPrice ?? ""}
                    onChange={(e) =>
                      setEditingParticipant((prev) =>
                        prev ? { ...prev, customPrice: e.target.value === "" ? null : e.target.value } : null
                      )
                    }
                    placeholder={`Padrão: R$ ${parseFloat(event?.pricePerPerson || "0").toFixed(2).replace(".", ",")}`}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Deixe vazio para usar o valor padrão do evento. Preencha apenas se houver desconto ou condição especial.
                </p>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={editingParticipant.notes || ""}
                  onChange={(e) =>
                    setEditingParticipant((prev) =>
                      prev ? { ...prev, notes: e.target.value } : null
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
                  editingParticipant.customPrice || null
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
