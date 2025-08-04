import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Trash2,
  Edit,
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Tag,
  DollarSign,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { formatDate } from "@/lib/utils";
import ClientFormModal from "./client-form-modal";
import ClientDetailsModal from "./client-details-modal";
import SaleFormModal from "./sale-form-modal";
import { type Client } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableHead, TableHeader, TableRow } from "./ui/table";

interface ClientsTableWithSelectionProps {
  clients: Client[];
  searchQuery?: string;
  filters?: {
    name: string;
    phone: string;
    cpf: string;
    responsavelId: string;
    categoria: string;
    origem: string;
    markers: string;
  };
  onSelectionChange?: (
    selectedIds: string[],
    selectedClients: Client[],
  ) => void;
}

export default function ClientsTableWithSelection({
  clients,
  searchQuery = "",
  filters,
  onSelectionChange,
}: ClientsTableWithSelectionProps) {
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [saleClient, setSaleClient] = useState<Client | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  console.log(clients);
  // Verificar se o usuário é administrador
  const isAdmin = user?.role === "administrador" || user?.role === "admin";

  // Query para buscar usuários (para mostrar o responsável)
  const { data: users = [] } = useQuery<{id: string; name: string; email: string}[]>({
    queryKey: ["/api/users"],
  });

  const deleteClientsMutation = useMutation({
    mutationFn: async (clientIds: string[]) => {
      const response = await fetch("/api/clients", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": user?.email || "",
          "x-user-role": user?.role || "",
        },
        body: JSON.stringify({ ids: clientIds }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao excluir clientes");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sucesso",
        description: data.message,
      });
      setSelectedClientIds([]);
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
    onError: (error: Error) => {
      console.error("Erro na exclusão:", error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClientIds(filteredAndSortedClients.map((client) => client.id));
    } else {
      setSelectedClientIds([]);
    }
  };

  const handleSelectClient = (clientId: string, checked: boolean) => {
    if (checked) {
      setSelectedClientIds((prev) => [...prev, clientId]);
    } else {
      setSelectedClientIds((prev) => prev.filter((id) => id !== clientId));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedClientIds.length === 0) return;
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    deleteClientsMutation.mutate(selectedClientIds);
    setShowDeleteDialog(false);
  };

  // Função para alternar ordenação
  const toggleSort = () => {
    if (sortOrder === null) {
      setSortOrder("asc");
    } else if (sortOrder === "asc") {
      setSortOrder("desc");
    } else {
      setSortOrder(null);
    }
  };

  // Filter and sort clients based on search, filters, and sort order
  const filteredAndSortedClients = clients
    .filter((client) => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchMatch =
          client.name.toLowerCase().includes(query) ||
          client.phone.toLowerCase().includes(query) ||
          (client.email?.toLowerCase() || "").includes(query) ||
          (client.cpf?.toLowerCase() || "").includes(query);

        if (!searchMatch) return false;
      }

      // Advanced filters
      if (filters) {
        if (
          filters.name &&
          !client.name.toLowerCase().includes(filters.name.toLowerCase())
        )
          return false;
        if (
          filters.phone &&
          !client.phone.toLowerCase().includes(filters.phone.toLowerCase())
        )
          return false;
        if (
          filters.cpf &&
          client.cpf &&
          !client.cpf.toLowerCase().includes(filters.cpf.toLowerCase())
        )
          return false;
        if (
          filters.responsavelId &&
          filters.responsavelId !== "all" &&
          client.responsavelId !== filters.responsavelId
        )
          return false;
        if (
          filters.categoria &&
          filters.categoria !== "all" &&
          client.categoria !== filters.categoria
        )
          return false;
        if (
          filters.origem &&
          filters.origem !== "all" &&
          client.origem !== filters.origem
        )
          return false;
        if (
          filters.markers &&
          filters.markers !== "all" &&
          client.markers &&
          !client.markers.some((marker) =>
            marker.toLowerCase().includes(filters.markers.toLowerCase()),
          )
        )
          return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortOrder === null) return 0;

      const comparison = a.name.localeCompare(b.name, "pt-BR", {
        numeric: true,
        sensitivity: "base",
      });

      return sortOrder === "asc" ? comparison : -comparison;
    });

  const allSelected =
    selectedClientIds.length === filteredAndSortedClients.length &&
    filteredAndSortedClients.length > 0;
  const someSelected =
    selectedClientIds.length > 0 &&
    selectedClientIds.length < filteredAndSortedClients.length;

  // Notificar componente pai sobre mudanças na seleção
  useEffect(() => {
    if (onSelectionChange) {
      const selectedClients = clients.filter((client) =>
        selectedClientIds.includes(client.id),
      );
      onSelectionChange(selectedClientIds, selectedClients);
    }
  }, [selectedClientIds, clients, onSelectionChange]);

  return (
    <div className="space-y-4">
      {/* Selection Actions */}
      {selectedClientIds.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm font-medium">
            {selectedClientIds.length} cliente(s) selecionado(s)
          </span>
          {isAdmin && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={deleteClientsMutation.isPending}
              title="Excluir clientes selecionados (apenas administradores)"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Selecionados
            </Button>
          )}
          {!isAdmin && (
            <span className="text-sm text-gray-500 italic">
              Apenas administradores podem excluir clientes
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg">
        <div className="overflow-x-auto rounded-lg shadow-lg">
          <table className="w-full overflow-hidden rounded-lg">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-white">
                <th className="p-4 text-left">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th className="p-4 text-left font-medium text-gray-900">
                  <button
                    onClick={toggleSort}
                    className="flex items-center space-x-1 hover:text-wine-600 transition-colors"
                    title="Clique para ordenar alfabeticamente"
                  >
                    <span>Cliente</span>
                    {sortOrder === null && <ArrowUpDown className="h-4 w-4" />}
                    {sortOrder === "asc" && <ChevronUp className="h-4 w-4" />}
                    {sortOrder === "desc" && (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="p-4 text-left font-medium text-gray-900">
                  Contato
                </th>
                <th className="p-4 text-left font-medium text-gray-900">
                  Responsável
                </th>
                <th className="p-4 text-left font-medium text-gray-900">
                  Categoria
                </th>
                <th className="p-4 text-left font-medium text-gray-900">
                  Marcadores
                </th>
                <th className="p-4 text-left font-medium text-gray-900">
                  Aniversário
                </th>
                <th className="p-4 text-left font-medium text-gray-900">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedClients.map((client) => (
                <tr
                  key={client.id}
                  className="border-b border-gray-300 hover:bg-gray-50 cursor-pointer"
                  onClick={(e) => {
                    // Não abrir modal se clicou no checkbox ou botão de editar
                    if (
                      (e.target as HTMLElement).closest("button") ||
                      (e.target as HTMLElement).closest('[role="checkbox"]')
                    ) {
                      return;
                    }
                    setViewingClient(client);
                  }}
                >
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedClientIds.includes(client.id)}
                      onCheckedChange={(checked) =>
                        handleSelectClient(client.id, checked as boolean)
                      }
                    />
                  </td>
                  <td className="p-4 min-w-[240px]">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-wine-100 flex items-center justify-center">
                          <User className="h-5 w-5 text-wine-600" />
                        </div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {client.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          <MapPin className="inline h-3 w-3 mr-1" />
                          {client.city}, {client.state}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="space-y-1">
                      <div className="flex items-center text-sm">
                        <Phone className="h-3 w-3 mr-2 text-gray-400" />
                        <a
                          href={`tel:${client.phone}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          title="Clique para ligar"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {client.phone}
                        </a>
                      </div>
                      {client.email && (
                        <div className="flex items-center text-sm text-gray-500">
                          <Mail className="h-3 w-3 mr-2 text-gray-400" />
                          {client.email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-gray-900">
                      {(() => {
                        const user = users.find(u => u.id === client.responsavelId);
                        return user ? user.name : (client.responsavelId ? "Usuário não encontrado" : "Não atribuído");
                      })()}
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant="outline" className="capitalize">
                      {client.categoria}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {client.markers && client.markers.length > 0 ? (
                        client.markers.map((marker, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="text-xs"
                          >
                            <Tag className="h-3 w-3 mr-1" />
                            {marker}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center text-sm">
                      <Calendar className="h-3 w-3 mr-2 text-gray-400" />
                      {client.birthday
                        ? formatDate(client.birthday)
                        : "Não informado"}
                    </div>
                  </td>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSaleClient(client)}
                        className="text-green-600 hover:text-green-900"
                        title="Lançar Venda"
                      >
                        <DollarSign className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingClient(client)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAndSortedClients.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    Nenhum cliente encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Client Modal */}
      {editingClient && (
        <ClientFormModal
          open={!!editingClient}
          onOpenChange={(open) => !open && setEditingClient(null)}
          client={editingClient}
        />
      )}

      {/* Client Details Modal */}
      <ClientDetailsModal
        client={viewingClient}
        isOpen={!!viewingClient}
        onClose={() => setViewingClient(null)}
        onEdit={(client) => {
          setViewingClient(null);
          setEditingClient(client);
        }}
      />

      {/* Sale Form Modal */}
      <SaleFormModal
        client={saleClient}
        open={!!saleClient}
        onOpenChange={(open) => !open && setSaleClient(null)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedClientIds.length}{" "}
              cliente(s) selecionado(s)? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
