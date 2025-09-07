import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Plus,
  Edit,
  Trash2,
  User,
  Mail,
  ToggleLeft,
  ToggleRight,
  Search,
  Loader2,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import UserFormModal from "./user-form-modal";
import { type User as UserType } from "@shared/schema";
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
import { formatDate } from "@/lib/utils";
import { LinkChannelModal } from "./link-channel-modal";

export default function UsersManagement() {
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [userToLinkChannel, setUserToLinkChannel] = useState<UserType | null>(
    null
  );
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [searchTerm]);

  const {
    data: users = [],
    isLoading,
    isFetching,
  } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const filteredUsers = useMemo(() => {
    if (!debouncedSearchTerm) return users;
    return (users || []).filter(
      (user: UserType) =>
        user.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
  }, [users, debouncedSearchTerm]);

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest(`/api/users/${userId}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Usuário excluído com sucesso",
      });
      setUserToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({
      userId,
      isActive,
    }: {
      userId: string;
      isActive: boolean;
    }) => {
      return await apiRequest(`/api/users/${userId}/toggle-status`, "PATCH", {
        isActive: isActive ? "true" : "false",
      });
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Status do usuário atualizado com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "gerente":
        return "default";
      case "vendedor":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrador";
      case "gerente":
        return "Gerente";
      case "vendedor":
        return "Vendedor";
      default:
        return role;
    }
  };

  const handleToggleStatus = (user: UserType) => {
    const newStatus = user.isActive === "true" ? false : true;
    toggleUserStatusMutation.mutate({ userId: user.id, isActive: newStatus });
  };

  return (
    <div className="flex flex-col h-full">
      <Card className="flex flex-col flex-1 overflow-hidden">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Usuários do Sistema
              </CardTitle>
              <CardDescription>
                Gerencie os usuários que têm acesso ao sistema
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="w-full md:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 min-h-0 gap-4 p-4 md:p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              Carregando usuários...
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 flex-1 flex flex-col items-center justify-center">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Nenhum usuário cadastrado</p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Primeiro Usuário
              </Button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 flex-1 flex flex-col items-center justify-center">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">
                Nenhum usuário encontrado para "{searchTerm}"
              </p>
              <Button variant="outline" onClick={() => setSearchTerm("")}>
                Limpar filtro
              </Button>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto -mx-4 px-4 space-y-3">
              {filteredUsers.map((user: UserType) => (
                <div
                  key={user.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg hover:bg-gray-50/50 transition-colors gap-3"
                >
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-wine-100 flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-wine-600" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3
                          className="font-medium text-gray-900 truncate"
                          title={user.name}
                        >
                          {user.name}
                        </h3>
                        <Badge
                          variant={getRoleBadgeVariant(user.role)}
                          className="text-xs whitespace-nowrap"
                        >
                          {getRoleLabel(user.role)}
                        </Badge>
                        {user.isActive === "false" && (
                          <Badge
                            variant="outline"
                            className="text-xs text-red-600 whitespace-nowrap border-red-200"
                          >
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <p className="truncate" title={user.email}>
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center self-end sm:self-center space-x-1">
                    <Button
                      title="Vincular Canal Umbler"
                      className="border-none bg-green-100 hover:bg-green-200"
                      onClick={() => {
                        setUserToLinkChannel(user);
                      }}
                      type="button"
                      size="sm"
                      variant={"outline"}
                    >
                      <FaWhatsapp className="h-4 text-green-600 w-4" />
                      <span>
                        {user.serviceChannel
                          ? user.serviceChannel.name
                          : "Vincular Canal"}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleStatus(user)}
                      disabled={toggleUserStatusMutation.isPending}
                      title={
                        user.isActive === "true"
                          ? "Desativar usuário"
                          : "Ativar usuário"
                      }
                      className="h-8 w-8"
                    >
                      {user.isActive === "true" ? (
                        <ToggleRight className="h-5 w-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-gray-400" />
                      )}
                      {/* <span className="sr-only">
                        {user.isActive === "true" ? "Desativar" : "Ativar"}
                      </span> */}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingUser(user)}
                      title="Editar usuário"
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                      {/* <span className="sr-only">Editar</span> */}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setUserToDelete(user)}
                      className="text-red-600 hover:text-red-700 h-8 w-8"
                      title="Excluir usuário"
                    >
                      <Trash2 className="h-4 w-4" />
                      {/* <span className="sr-only">Excluir</span> */}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <UserFormModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        user={null}
      />

      {editingUser && (
        <UserFormModal
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          user={editingUser}
        />
      )}

      {userToLinkChannel && (
        <LinkChannelModal
          user={userToLinkChannel}
          open={!!userToLinkChannel}
          onOpenChange={(open) => !open && setUserToLinkChannel(null)}
        />
      )}

      <AlertDialog
        open={!!userToDelete}
        onOpenChange={() => setUserToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário "{userToDelete?.name}"?
              Esta ação não pode ser desfeita e o usuário perderá acesso ao
              sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                userToDelete && deleteUserMutation.mutate(userToDelete.id)
              }
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}