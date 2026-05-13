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
  Users,
  Shield,
  UserCheck,
  Settings,
  Store,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { LinkBlingVendorModal } from "./link-bling-vendor-modal";

// Estende o tipo User para incluir serviceChannel
type UserWithChannel = UserType & {
  serviceChannel?: {
    id: string;
    name: string;
    phoneNumber?: string | null;
  } | null;
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export default function UsersManagement() {
  const [editingUser, setEditingUser] = useState<UserWithChannel | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithChannel | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [userToLinkChannel, setUserToLinkChannel] =
    useState<UserWithChannel | null>(null);
  const [userToLinkBlingVendor, setUserToLinkBlingVendor] =
    useState<UserWithChannel | null>(null);
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
  } = useQuery<UserWithChannel[]>({
    queryKey: ["/api/users"],
  });


  const filteredUsers = useMemo(() => {
    if (!debouncedSearchTerm) return users;
    return (users || []).filter(
      (user: UserWithChannel) =>
        user.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
  }, [users, debouncedSearchTerm]);

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/users/${userId}`);
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
      return await apiRequest("PATCH", `/api/users/${userId}/toggle-status`, {
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

  const handleToggleStatus = (user: UserWithChannel) => {
    const newStatus = user.isActive === "true" ? false : true;
    toggleUserStatusMutation.mutate({ userId: user.id, isActive: newStatus });
  };

  return (
    <div className="flex flex-col h-full">
      <Card className="flex flex-col flex-1 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 dark:from-slate-800 dark:to-slate-900 dark:border-slate-700">
        <CardHeader className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <div className="p-2 rounded-lg bg-slate-200 dark:bg-slate-700">
                  <Users className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                Usuários do Sistema
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Gerencie os usuários que têm acesso ao sistema CRM
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all duration-200"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 min-h-0 gap-6 p-4 md:p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-slate-300 focus:border-slate-400 focus:ring-slate-400 dark:border-slate-600 dark:focus:border-slate-500 bg-white dark:bg-slate-800"
            />
            {isFetching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-4 flex-1">
              {/* Skeleton Items */}
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-8 rounded" />
                      <Skeleton className="h-8 w-8 rounded" />
                    </div>
                  </div>
                </div>
              ))}

              {/* Skeleton Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Skeleton className="h-5 w-32" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
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
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
              {filteredUsers.map((user: UserWithChannel) => (
                <div
                  key={user.id}
                  className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Avatar e informações principais */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-12 w-12 border-2 border-slate-200 dark:border-slate-600">
                        <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center">
                          <span className="text-sm font-semibold text-primary">
                            {getInitials(user.name)}
                          </span>
                        </div>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3
                            className="font-semibold text-slate-900 dark:text-slate-100 truncate"
                            title={user.name}
                          >
                            {user.name}
                          </h3>
                          <Badge
                            variant={getRoleBadgeVariant(user.role)}
                            className="text-xs font-medium"
                          >
                            {getRoleLabel(user.role)}
                          </Badge>
                          {user.isActive === "false" && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                            >
                              Inativo
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-1">
                          <Mail className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate" title={user.email}>
                            {user.email}
                          </span>
                        </div>

                        {user.serviceChannel && (
                          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 mb-1">
                            <FaWhatsapp className="h-4 w-4 flex-shrink-0" />
                            <span
                              className="truncate font-medium"
                              title={`${user.serviceChannel.name} - ${user.serviceChannel.phoneNumber}`}
                            >
                              {user.serviceChannel.name}
                              {user.serviceChannel.phoneNumber &&
                                ` - ${user.serviceChannel.phoneNumber}`}
                            </span>
                          </div>
                        )}

                        {user.blingVendedorId && (
                          <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400 mb-1">
                            <Store className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate font-medium">
                              {user.blingVendedorName ?? user.blingVendedorId}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
                          <UserCheck className="h-3 w-3" />
                          <span>
                            Cadastrado em{" "}
                            {new Date(user.createdAt).toLocaleDateString(
                              "pt-BR"
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2 justify-end lg:justify-start">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setUserToLinkChannel(user)}
                        className="bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                      >
                        <FaWhatsapp className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Vincular Canal</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setUserToLinkBlingVendor(user)}
                        title={user.blingVendedorId ? `Vendedor Bling vinculado: ${user.blingVendedorId}` : "Vincular ao vendedor Bling"}
                        className={user.blingVendedorId
                          ? "bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100 hover:border-orange-400 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/30"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                        }
                      >
                        <Store className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Bling</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleStatus(user)}
                        disabled={toggleUserStatusMutation.isPending}
                        title={
                          user.isActive === "true"
                            ? "Desativar usuário"
                            : "Ativar usuário"
                        }
                        className={`${
                          user.isActive === "true"
                            ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                            : "text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        {user.isActive === "true" ? (
                          <ToggleRight className="h-4 w-4" />
                        ) : (
                          <ToggleLeft className="h-4 w-4" />
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingUser(user)}
                        title="Editar usuário"
                        className="text-primary hover:text-primary/80 hover:bg-accent"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setUserToDelete(user)}
                        title="Excluir usuário"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paginação moderna */}
          {/* {!isLoading && filteredUsers.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Mostrando{" "}
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {Math.min(filteredUsers.length, 10)}
                  </span>{" "}
                  de{" "}
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {filteredUsers.length}
                  </span>{" "}
                  usuários
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
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 dark:border-slate-600 dark:hover:border-slate-500"
                    >
                      3
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

      {userToLinkBlingVendor && (
        <LinkBlingVendorModal
          user={userToLinkBlingVendor}
          open={!!userToLinkBlingVendor}
          onOpenChange={(open) => !open && setUserToLinkBlingVendor(null)}
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
