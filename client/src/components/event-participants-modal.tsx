
import { useState, useMemo } from "react";
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
import {
  PlusIcon,
  SearchIcon,
  TrashIcon,
  EditIcon,
  UsersIcon,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface EventParticipant {
  id: string;
  eventId: string;
  clientId: string;
  registrationDate: string;
  status: "pago" | "pendente" | "convidado" | "pagar na hora" | "cancelado";
  notes: string | null;
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
}

interface EventParticipantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event | null;
}

const PARTICIPANT_STATUS = [
  { value: "pago", label: "PAGO", color: "bg-green-100 text-green-800" },
  { value: "pendente", label: "PENDENTE", color: "bg-yellow-100 text-yellow-800" },
  { value: "convidado", label: "CONVIDADO", color: "bg-blue-100 text-blue-800" },
  { value: "pagar na hora", label: "PAGAR NA HORA", color: "bg-orange-100 text-orange-800" },
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
  const [editingParticipant, setEditingParticipant] = useState<EventParticipant | null>(null);
  const [participantToDelete, setParticipantToDelete] = useState<EventParticipant | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const [newParticipant, setNewParticipant] = useState({
    clientId: "",
    status: "pendente",
    notes: "",
  });
  
  const [clientSearchTerm, setClientSearchTerm] = useState("");

  // Buscar participantes do evento
  const { data: participants = [], isLoading: isLoadingParticipants } = useQuery<EventParticipant[]>({
    queryKey: ["/api/events", event?.id, "participants"],
    enabled: !!event?.id,
  });

  // Buscar todos os clientes para adicionar participantes
  const { data: clientsData } = useQuery<{ data: Client[] }>({
    queryKey: ["/api/clients"],
    enabled: isAddModalOpen,
  });

  const clients = clientsData?.data || [];

  // Filtrar participantes
  const filteredParticipants = useMemo(() => {
    return participants.filter((participant) => {
      const matchesSearch = 
        participant.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        participant.clientPhone.includes(searchTerm) ||
        (participant.clientEmail && participant.clientEmail.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === "all" || participant.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [participants, searchTerm, statusFilter]);

  // Clientes disponíveis (não já inscritos) e filtrados pela busca
  const availableClients = useMemo(() => {
    const participantClientIds = participants.map(p => p.clientId);
    return clients
      .filter(client => !participantClientIds.includes(client.id))
      .filter(client => {
        if (!clientSearchTerm) return true;
        const searchLower = clientSearchTerm.toLowerCase();
        return client.name.toLowerCase().includes(searchLower) || 
               client.phone.includes(clientSearchTerm) ||
               (client.email && client.email.toLowerCase().includes(searchLower));
      });
  }, [clients, participants, clientSearchTerm]);

  // Mutation para adicionar participante
  const addParticipantMutation = useMutation({
    mutationFn: async (participantData: typeof newParticipant) => {
      const response = await fetch(`/api/events/${event?.id}/participants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "",
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
      queryClient.invalidateQueries({ queryKey: ["/api/events", event?.id, "participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setIsAddModalOpen(false);
      setNewParticipant({ clientId: "", status: "pendente", notes: "" });
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
    mutationFn: async (data: { status: string; notes: string }) => {
      const response = await fetch(`/api/events/${event?.id}/participants/${editingParticipant?.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao atualizar participante");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", event?.id, "participants"] });
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
      const response = await fetch(`/api/events/${event?.id}/participants/${participantId}`, {
        method: "DELETE",
        headers: {
          "x-user-id": user?.id || "",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao remover participante");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", event?.id, "participants"] });
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

  const getStatusBadge = (status: string) => {
    const statusConfig = PARTICIPANT_STATUS.find(s => s.value === status);
    return (
      <Badge className={statusConfig?.color}>
        {statusConfig?.label}
      </Badge>
    );
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

  const handleUpdateParticipant = (status: string, notes: string) => {
    updateParticipantMutation.mutate({ status, notes });
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
              Gerencie os participantes do evento ({formatDate(event.eventDate)} - {event.location})
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
                  {participants.length}
                  {event.maxCapacity && ` / ${event.maxCapacity}`} participantes
                </span>
                <Button onClick={() => setIsAddModalOpen(true)}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Adicionar Participante
                </Button>
              </div>
            </div>

            {/* Tabela de participantes */}
            {isLoadingParticipants ? (
              <div>Carregando participantes...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data de Inscrição</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParticipants.map((participant) => (
                    <TableRow key={participant.id}>
                      <TableCell>
                        <div className="font-medium">{participant.clientName}</div>
                        {participant.notes && (
                          <div className="text-sm text-gray-500">{participant.notes}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{participant.clientPhone}</div>
                          {participant.clientEmail && (
                            <div className="text-gray-500">{participant.clientEmail}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(participant.status)}
                      </TableCell>
                      <TableCell>
                        {formatDate(participant.registrationDate)}
                      </TableCell>
                      <TableCell>
                        {participant.registeredByName}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingParticipant(participant)}
                          >
                            <EditIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setParticipantToDelete(participant)}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
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
                <Input
                  placeholder="Buscar cliente por nome, telefone ou email..."
                  value={clientSearchTerm}
                  onChange={(e) => setClientSearchTerm(e.target.value)}
                  className="w-full"
                />
                <Select
                  value={newParticipant.clientId}
                  onValueChange={(value) => setNewParticipant(prev => ({ ...prev, clientId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClients.length > 0 ? (
                      availableClients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name} - {client.phone}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-gray-500">
                        {clientSearchTerm ? "Nenhum cliente encontrado" : "Carregando clientes..."}
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {clientSearchTerm && (
                  <p className="text-sm text-gray-500">
                    {availableClients.length} cliente(s) encontrado(s)
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label>Status</Label>
              <Select
                value={newParticipant.status}
                onValueChange={(value) => setNewParticipant(prev => ({ ...prev, status: value }))}
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
                onChange={(e) => setNewParticipant(prev => ({ ...prev, notes: e.target.value }))}
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
      <Dialog open={!!editingParticipant} onOpenChange={() => setEditingParticipant(null)}>
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
                  onValueChange={(value) => setEditingParticipant(prev => prev ? { ...prev, status: value as any } : null)}
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
                  value={editingParticipant.notes || ""}
                  onChange={(e) => setEditingParticipant(prev => prev ? { ...prev, notes: e.target.value } : null)}
                  placeholder="Observações sobre a participação..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingParticipant(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => editingParticipant && handleUpdateParticipant(editingParticipant.status, editingParticipant.notes || "")}
              disabled={updateParticipantMutation.isPending}
            >
              Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão */}
      <Dialog open={!!participantToDelete} onOpenChange={() => setParticipantToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Remoção</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover "{participantToDelete?.clientName}" do evento?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setParticipantToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => participantToDelete && removeParticipantMutation.mutate(participantToDelete.id)}
              disabled={removeParticipantMutation.isPending}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
