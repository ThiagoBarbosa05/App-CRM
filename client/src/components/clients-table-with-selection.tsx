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
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { formatDate } from "@/lib/utils";
import ClientFormModal from "./client-form-modal";
import ClientDetailsModal from "./client-details-modal";
import SaleFormModal from "./sale-form-modal";
import ConfirmClientModal from "./confirm-client-modal";
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

interface ClientsTableWithSelectionProps {
  clients: Client[];
  onSelectionChange?: (
    selectedIds: string[],
    selectedClients: Client[]
  ) => void;
  currentPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
  hasNextPage: boolean;
}

export default function ClientsTableWithSelection({
  clients,
  onSelectionChange,
  currentPage,
  setCurrentPage,
  hasNextPage,
}: ClientsTableWithSelectionProps) {
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [saleClient, setSaleClient] = useState<Client | null>(null);
  const [confirmingClient, setConfirmingClient] = useState<Client | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [tagsModalClient, setTagsModalClient] = useState<Client | null>(null);
  const [sortField, setSortField] = useState<"name" | "categoria" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const { toast } = useToast();
  const { user } = useAuth();

  const isAdmin = user?.role === "administrador" || user?.role === "admin";

  const { data: users = [] } = useQuery<
    { id: string; name: string; email: string }[]
  >({
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
        body: JSON.stringify({ clientIds }),
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
      const currentPageIds = clients.map((client) => client.id);
      setSelectedClientIds((prev) => {
        const newSelected = [...prev];
        currentPageIds.forEach((id) => {
          if (!newSelected.includes(id)) {
            newSelected.push(id);
          }
        });
        return newSelected;
      });
    } else {
      const currentPageIds = clients.map((client) => client.id);
      setSelectedClientIds((prev) =>
        prev.filter((id) => !currentPageIds.includes(id))
      );
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

  const handleSort = (field: "name" | "categoria") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Aplicar ordenação aos clientes
  const sortedClients = [...clients].sort((a, b) => {
    if (!sortField) return 0;

    let aValue: string;
    let bValue: string;

    if (sortField === "name") {
      aValue = a.name.toLowerCase();
      bValue = b.name.toLowerCase();
    } else if (sortField === "categoria") {
      aValue = a.categoria?.toLowerCase() || "";
      bValue = b.categoria?.toLowerCase() || "";
    } else {
      return 0;
    }

    if (sortDirection === "asc") {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  });

  useEffect(() => {
    if (onSelectionChange) {
      const selectedClients = clients.filter((client) =>
        selectedClientIds.includes(client.id)
      );
      onSelectionChange(selectedClientIds, selectedClients);
    }
  }, [selectedClientIds, clients, onSelectionChange]);

  const allCurrentPageSelected =
    clients.length > 0 &&
    clients.every((client) => selectedClientIds.includes(client.id));

  return (
    <div className="space-y-6">
      {selectedClientIds.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <User className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <span className="font-semibold text-blue-900">
                {selectedClientIds.length} cliente(s) selecionado(s)
              </span>
              <p className="text-xs text-blue-700 mt-1">
                Use as ações em lote para gerenciar os clientes selecionados
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={deleteClientsMutation.isPending}
              title="Excluir clientes selecionados (apenas administradores)"
              className="bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all duration-200"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Excluir Selecionados</span>
              <span className="sm:hidden">Excluir</span>
            </Button>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-slate-50 border-b-2 border-gray-200">
                <th className="p-4 text-left w-12">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={allCurrentPageSelected}
                      onCheckedChange={handleSelectAll}
                      className="border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                  </div>
                </th>
                <th className="p-4 text-left font-semibold text-gray-700 min-w-[250px]">
                  <button
                    onClick={() => handleSort("name")}
                    className="flex items-center gap-2 hover:text-blue-600 transition-colors duration-200 group"
                  >
                    <User className="h-4 w-4 text-gray-500 group-hover:text-blue-600" />
                    Cliente
                    {sortField === "name" && (
                      <div className="p-1 bg-blue-100 rounded-full">
                        {sortDirection === "asc" ? (
                          <ChevronUp className="h-3 w-3 text-blue-600" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-blue-600" />
                        )}
                      </div>
                    )}
                  </button>
                </th>
                {/* <th className="p-4 text-left font-semibold text-gray-700 min-w-[120px]">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-gray-500" />
                    Status
                  </div>
                </th> */}
                <th className="p-4 text-left font-semibold text-gray-700 min-w-[180px]">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    Contato
                  </div>
                </th>
                <th className="p-4 text-left font-semibold text-gray-700 min-w-[150px]">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    Responsável
                  </div>
                </th>
                <th className="p-4 text-left font-semibold text-gray-700 min-w-[120px]">
                  <button
                    onClick={() => handleSort("categoria")}
                    className="flex items-center gap-2 hover:text-blue-600 transition-colors duration-200 group"
                  >
                    <Tag className="h-4 w-4 text-gray-500 group-hover:text-blue-600" />
                    Categoria
                    {sortField === "categoria" && (
                      <div className="p-1 bg-blue-100 rounded-full">
                        {sortDirection === "asc" ? (
                          <ChevronUp className="h-3 w-3 text-blue-600" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-blue-600" />
                        )}
                      </div>
                    )}
                  </button>
                </th>
                <th className="p-4 text-left font-semibold text-gray-700 min-w-[130px]">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-gray-500" />
                    Marcadores
                  </div>
                </th>
                <th className="p-4 text-left font-semibold text-gray-700 min-w-[150px]">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-gray-500" />
                    Tags (Umbler)
                  </div>
                </th>
                <th className="p-4 text-left font-semibold text-gray-700 min-w-[130px]">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    Aniversário
                  </div>
                </th>
                <th className="p-4 text-left font-semibold text-gray-700 w-28">
                  <div className="flex items-center gap-2">
                    <Edit className="h-4 w-4 text-gray-500" />
                    Ações
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedClients.map((client, index) => (
                <tr
                  key={client.id}
                  className={`
                    group hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 
                    cursor-pointer transition-all duration-200 ease-in-out
                    ${index % 2 === 0 ? "bg-white" : "bg-gray-50/30"}
                    ${
                      selectedClientIds.includes(client.id)
                        ? "bg-blue-50 border-l-4 border-l-blue-500"
                        : ""
                    }
                  `}
                  onClick={(e) => {
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
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={selectedClientIds.includes(client.id)}
                        onCheckedChange={(checked) =>
                          handleSelectClient(client.id, checked as boolean)
                        }
                        className="border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="p-1 rounded-md bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center border border-blue-200 shadow-sm">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-gray-900 truncate text-base group-hover:text-blue-700 transition-colors">
                          {client.name}
                        </div>
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                          <MapPin className="h-3 w-3 mr-1 shrink-0 text-gray-400" />
                          <span className="truncate">
                            {client.city}, {client.state}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  {/* <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    {client.status === "pending" ? (
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="bg-yellow-50 border-yellow-300 text-yellow-800 font-medium px-3 py-1"
                        >
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Pendente
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmingClient(client)}
                          className="h-7 px-2 text-xs hover:bg-yellow-100 text-yellow-700 hover:text-yellow-800 transition-colors"
                          title="Confirmar cadastro"
                        >
                          Confirmar
                        </Button>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-green-50 border-green-300 text-green-800 font-medium px-3 py-1"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Confirmado
                      </Badge>
                    )}
                  </td> */}
                  <td className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <div className="p-1 bg-green-100 rounded-md mr-2">
                          <Phone className="h-3 w-3 text-green-600" />
                        </div>
                        <a
                          href={`tel:${client.phone}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium transition-colors"
                          title="Clique para ligar"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {client.phone}
                        </a>
                      </div>
                      {client.email && (
                        <div className="flex items-center text-sm text-gray-600">
                          <div className="p-1 bg-gray-100 rounded-md mr-2">
                            <Mail className="h-3 w-3 text-gray-500" />
                          </div>
                          <span className="truncate" title={client.email}>
                            {client.email}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-purple-100 rounded-md">
                        <User className="h-3 w-3 text-purple-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {(() => {
                          const user = users.find(
                            (u) => u.id === client.responsavelId
                          );
                          return user
                            ? user.name
                            : client.responsavelId
                            ? "Usuário não encontrado"
                            : "Não atribuído";
                        })()}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge
                      variant="outline"
                      className="capitalize bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200 text-orange-800 font-medium px-3 py-1"
                    >
                      {client.categoria}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1 max-w-[120px]">
                      {client.markers && client.markers.length > 0 ? (
                        client.markers.slice(0, 2).map((marker, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="text-xs bg-gradient-to-r from-violet-100 to-purple-100 border-violet-200 text-violet-800 px-2 py-1"
                          >
                            <Tag className="h-3 w-3 mr-1" />
                            {marker}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400 italic">
                          Sem marcadores
                        </span>
                      )}
                      {client.markers && client.markers.length > 2 && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-gray-100 text-gray-600"
                        >
                          +{client.markers.length - 2}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <div
                      className="flex flex-wrap gap-1 max-w-[140px] cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() =>
                        client.tags &&
                        client.tags.length > 0 &&
                        setTagsModalClient(client)
                      }
                      title={
                        client.tags && client.tags.length > 0
                          ? "Clique para ver todas as tags"
                          : undefined
                      }
                    >
                      {client.tags && client.tags.length > 0 ? (
                        client.tags
                          .slice(0, 2)
                          .map((tag: any, index: number) => (
                            <Badge
                              key={tag.id || index}
                              variant="outline"
                              className="text-xs bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-300 text-emerald-800 px-2 py-1"
                              title={`ID: ${tag.externalId}`}
                            >
                              {tag.emoji && (
                                <span className="mr-1">{tag.emoji}</span>
                              )}
                              {tag.externalTagName || tag.name || "Tag"}
                            </Badge>
                          ))
                      ) : (
                        <span className="text-sm text-gray-400 italic">
                          Sem tags
                        </span>
                      )}
                      {client.tags && client.tags.length > 2 && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                          title={`${
                            client.tags.length - 2
                          } tags adicionais - Clique para ver todas`}
                        >
                          +{client.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center text-sm">
                      <div className="p-1 bg-blue-100 rounded-md mr-2">
                        <Calendar className="h-3 w-3 text-blue-600" />
                      </div>
                      <span className="font-medium text-gray-700">
                        {client.birthday
                          ? formatDate(client.birthday)
                          : "Não informado"}
                      </span>
                    </div>
                  </td>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSaleClient(client)}
                        className="h-8 w-8 p-0 rounded-lg hover:bg-green-100 text-green-600 hover:text-green-700 transition-colors shadow-sm"
                        title="Lançar Venda"
                      >
                        <DollarSign className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingClient(client)}
                        className="h-8 w-8 p-0 rounded-lg hover:bg-blue-100 text-blue-600 hover:text-blue-700 transition-colors shadow-sm"
                        title="Editar Cliente"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-16 text-center">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="p-4 bg-gray-100 rounded-full">
                        <User className="h-8 w-8 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Nenhum cliente encontrado
                        </h3>
                        <p className="text-gray-500">
                          Tente ajustar os filtros ou adicione novos clientes
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(currentPage > 1 || hasNextPage) && (
        <div className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-900">
                  Mostrando {clients.length} clientes
                </span>
                <span className="text-gray-500 ml-2">
                  • Página {currentPage}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                title="Primeira página"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="hover:bg-blue-50 hover:border-blue-300 transition-colors shadow-sm"
              >
                <ChevronsLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Primeira</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                title="Página anterior"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="hover:bg-blue-50 hover:border-blue-300 transition-colors shadow-sm"
              >
                <ChevronLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Anterior</span>
              </Button>

              <div className="px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
                <span className="text-sm font-medium text-gray-700">
                  Página {currentPage}
                </span>
              </div>

              <Button
                variant="outline"
                title="Próxima página"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!hasNextPage}
                className="hover:bg-blue-50 hover:border-blue-300 transition-colors shadow-sm"
              >
                <span className="hidden sm:inline">Próxima</span>
                <ChevronRight className="h-4 w-4 sm:ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {editingClient && (
        <ClientFormModal
          open={!!editingClient}
          onOpenChange={(open) => !open && setEditingClient(null)}
          client={editingClient}
        />
      )}

      <ClientDetailsModal
        client={viewingClient}
        isOpen={!!viewingClient}
        onClose={() => setViewingClient(null)}
        onEdit={(client) => {
          setViewingClient(null);
          setEditingClient(client);
        }}
      />

      <SaleFormModal
        client={saleClient}
        open={!!saleClient}
        onOpenChange={(open) => !open && setSaleClient(null)}
      />

      {confirmingClient && (
        <ConfirmClientModal
          open={!!confirmingClient}
          onOpenChange={(open) => !open && setConfirmingClient(null)}
          clientId={confirmingClient.id}
          clientName={confirmingClient.name}
        />
      )}

      {tagsModalClient && (
        <AlertDialog
          open={!!tagsModalClient}
          onOpenChange={(open) => !open && setTagsModalClient(null)}
        >
          <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg">
                  <Tag className="h-5 w-5 text-emerald-700" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    Tags do Umbler
                  </div>
                  <div className="text-sm font-normal text-gray-500 mt-1">
                    {tagsModalClient.name}
                  </div>
                </div>
              </AlertDialogTitle>
            </AlertDialogHeader>

            <div className="mt-4">
              {tagsModalClient.tags && tagsModalClient.tags.length > 0 ? (
                <>
                  <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 text-sm text-blue-800">
                      <Tag className="h-4 w-4" />
                      <span className="font-semibold">
                        {tagsModalClient.tags.length} tag(s) encontrada(s)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {tagsModalClient.tags.map((tag: any, index: number) => (
                      <div
                        key={tag.id || index}
                        className="group p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl hover:shadow-md hover:border-emerald-300 transition-all duration-200"
                      >
                        <div className="flex items-start gap-3">
                          {tag.emoji ? (
                            <div className="text-3xl flex-shrink-0">
                              {tag.emoji}
                            </div>
                          ) : (
                            <div className="p-2 bg-emerald-200 rounded-lg flex-shrink-0">
                              <Tag className="h-5 w-5 text-emerald-700" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 text-base mb-2 truncate">
                              {tag.externalTagName ||
                                tag.name ||
                                "Tag sem nome"}
                            </div>
                            {tag.externalId && (
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <Badge
                                  variant="outline"
                                  className="bg-white border-emerald-300 text-emerald-800 font-mono"
                                >
                                  ID: {tag.externalId}
                                </Badge>
                              </div>
                            )}
                            {tag.color && (
                              <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                                <div
                                  className="w-4 h-4 rounded border-2 border-gray-300 shadow-sm"
                                  style={{ backgroundColor: tag.color }}
                                  title={`Cor: ${tag.color}`}
                                />
                                <span className="font-mono text-xs text-gray-500">
                                  {tag.color}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <Tag className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhuma tag encontrada
                  </h3>
                  <p className="text-gray-500">
                    Este cliente ainda não possui tags do Umbler
                  </p>
                </div>
              )}
            </div>

            <AlertDialogFooter className="mt-6">
              <AlertDialogCancel className="bg-gray-100 hover:bg-gray-200">
                Fechar
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

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
