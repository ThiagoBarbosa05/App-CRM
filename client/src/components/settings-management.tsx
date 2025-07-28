import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, 
  Users, 
  Tags, 
  MapPin, 
  Star, 
  Edit2, 
  Trash2, 
  Shield,
  ShieldCheck,
  Crown 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Schemas de validação
const userSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().optional(),
  role: z.enum(["admin", "gerente", "vendedor"]),
});

const userCreateSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  role: z.enum(["admin", "gerente", "vendedor"]),
});

const tagSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["marcador", "origem", "categoria"]),
  color: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;
type TagFormData = z.infer<typeof tagSchema>;

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "gerente" | "vendedor";
  isActive: string;
  createdAt: string;
}

interface Tag {
  id: string;
  name: string;
  type: "marcador" | "origem" | "categoria";
  color?: string;
}

export default function SettingsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagType, setTagType] = useState<"marcador" | "origem" | "categoria">("marcador");

  // Buscar usuários
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Buscar tags (marcadores, origens, categorias)
  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
  });

  // Formulário de usuário
  const userForm = useForm<UserFormData>({
    resolver: zodResolver(editingUser ? userSchema : userCreateSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "vendedor",
    },
  });

  // Formulário de tag
  const tagForm = useForm<TagFormData>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      name: "",
      color: "#6B7280",
    },
  });

  // Mutação para criar/editar usuário
  const userMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      if (editingUser) {
        // Para edição, remove password se estiver vazio
        const updateData = { ...data };
        if (!updateData.password || updateData.password.trim() === "") {
          delete updateData.password;
        }
        return apiRequest(`/api/users/${editingUser.id}`, "PUT", updateData);
      } else {
        return apiRequest("/api/users", "POST", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsUserModalOpen(false);
      setEditingUser(null);
      userForm.reset();
      toast({
        title: "Sucesso",
        description: editingUser ? "Usuário atualizado com sucesso" : "Usuário criado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar usuário",
        variant: "destructive",
      });
    },
  });

  // Mutação para deletar usuário
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/users/${userId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Sucesso",
        description: "Usuário removido com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover usuário",
        variant: "destructive",
      });
    },
  });

  // Mutação para criar/editar tag
  const tagMutation = useMutation({
    mutationFn: async (data: TagFormData & { type: string }) => {
      if (editingTag) {
        return apiRequest(`/api/tags/${editingTag.id}`, "PUT", data);
      } else {
        return apiRequest("/api/tags", "POST", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setIsTagModalOpen(false);
      setEditingTag(null);
      tagForm.reset();
      toast({
        title: "Sucesso",
        description: editingTag ? "Item atualizado com sucesso" : "Item criado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar item",
        variant: "destructive",
      });
    },
  });

  // Mutação para deletar tag
  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      return apiRequest(`/api/tags/${tagId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      toast({
        title: "Sucesso",
        description: "Item removido com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover item",
        variant: "destructive",
      });
    },
  });

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    // Reset form with new resolver for editing
    userForm.reset({
      name: user.name,
      email: user.email,
      password: "", // Não pré-preenchemos a senha por segurança
      role: user.role,
    });
    setIsUserModalOpen(true);
  };

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setTagType(tag.type);
    tagForm.reset({
      name: tag.name,
      color: tag.color || "#6B7280",
    });
    setIsTagModalOpen(true);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Administrador";
      case "gerente": return "Gerente";
      case "vendedor": return "Vendedor";
      default: return role;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin": return <Crown className="h-4 w-4" />;
      case "gerente": return <ShieldCheck className="h-4 w-4" />;
      case "vendedor": return <Shield className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-red-100 text-red-800";
      case "gerente": return "bg-blue-100 text-blue-800";
      case "vendedor": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getTagTypeLabel = (type: string) => {
    switch (type) {
      case "marcador": return "Marcador";
      case "origem": return "Origem";
      case "categoria": return "Categoria";
      default: return type;
    }
  };

  const filterTagsByType = (type: string) => {
    return tags.filter(tag => tag.type === type);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-600 mt-2">Gerencie usuários e configurações do sistema</p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="markers" className="flex items-center gap-2">
            <Tags className="h-4 w-4" />
            Marcadores
          </TabsTrigger>
          <TabsTrigger value="origins" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Origens
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            Categorias
          </TabsTrigger>
        </TabsList>

        {/* Aba de Usuários */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Gerenciar Usuários
                </CardTitle>
                <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingUser(null);
                      userForm.reset({
                        name: "",
                        email: "",
                        password: "",
                        role: "vendedor",
                      });
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Usuário
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingUser ? "Editar Usuário" : "Novo Usuário"}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={userForm.handleSubmit((data) => userMutation.mutate(data))} className="space-y-4">
                      <div>
                        <Label htmlFor="name">Nome</Label>
                        <Input
                          id="name"
                          {...userForm.register("name")}
                        />
                        {userForm.formState.errors.name && (
                          <p className="text-sm text-red-600 mt-1">
                            {userForm.formState.errors.name.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          {...userForm.register("email")}
                        />
                        {userForm.formState.errors.email && (
                          <p className="text-sm text-red-600 mt-1">
                            {userForm.formState.errors.email.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="password">
                          {editingUser ? "Nova Senha (deixe em branco para manter)" : "Senha"}
                        </Label>
                        <Input
                          id="password"
                          type="password"
                          {...userForm.register("password")}
                          required={!editingUser}
                        />
                        {userForm.formState.errors.password && (
                          <p className="text-sm text-red-600 mt-1">
                            {userForm.formState.errors.password.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="role">Perfil</Label>
                        <Select 
                          value={userForm.watch("role")} 
                          onValueChange={(value) => userForm.setValue("role", value as any)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um perfil" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="gerente">Gerente</SelectItem>
                            <SelectItem value="vendedor">Vendedor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setIsUserModalOpen(false)}
                        >
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={userMutation.isPending}>
                          {userMutation.isPending ? "Salvando..." : "Salvar"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge className={`${getRoleBadgeColor(user.role)} flex items-center gap-1 w-fit`}>
                          {getRoleIcon(user.role)}
                          {getRoleLabel(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive === "true" ? "default" : "secondary"}>
                          {user.isActive === "true" ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditUser(user)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteUserMutation.mutate(user.id)}
                            disabled={deleteUserMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Marcadores */}
        <TabsContent value="markers" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Tags className="h-5 w-5" />
                  Gerenciar Marcadores
                </CardTitle>
                <Button onClick={() => { 
                  setEditingTag(null); 
                  setTagType("marcador");
                  tagForm.reset({
                    name: "",
                    color: "#6B7280",
                  });
                  setIsTagModalOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Marcador
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filterTagsByType("marcador").map((tag) => (
                  <div key={tag.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: tag.color || "#6B7280" }}
                      />
                      <span className="font-medium">{tag.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditTag(tag)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteTagMutation.mutate(tag.id)}
                        disabled={deleteTagMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Origens */}
        <TabsContent value="origins" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Gerenciar Origens
                </CardTitle>
                <Button onClick={() => { 
                  setEditingTag(null); 
                  setTagType("origem");
                  tagForm.reset({
                    name: "",
                    color: "#6B7280",
                  });
                  setIsTagModalOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Origem
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filterTagsByType("origem").map((tag) => (
                  <div key={tag.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">{tag.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditTag(tag)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteTagMutation.mutate(tag.id)}
                        disabled={deleteTagMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Categorias */}
        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Gerenciar Categorias
                </CardTitle>
                <Button onClick={() => { 
                  setEditingTag(null); 
                  setTagType("categoria");
                  tagForm.reset({
                    name: "",
                    color: "#6B7280",
                  });
                  setIsTagModalOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Categoria
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filterTagsByType("categoria").map((tag) => (
                  <div key={tag.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">{tag.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditTag(tag)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteTagMutation.mutate(tag.id)}
                        disabled={deleteTagMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Tags - Usado para todos os tipos */}
      <Dialog open={isTagModalOpen} onOpenChange={setIsTagModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTag ? `Editar ${getTagTypeLabel(tagType)}` : `Novo ${getTagTypeLabel(tagType)}`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={tagForm.handleSubmit((data) => tagMutation.mutate({ ...data, type: tagType }))} className="space-y-4">
            <div>
              <Label htmlFor="tagName">Nome</Label>
              <Input
                id="tagName"
                {...tagForm.register("name")}
              />
              {tagForm.formState.errors.name && (
                <p className="text-sm text-red-600 mt-1">
                  {tagForm.formState.errors.name.message}
                </p>
              )}
            </div>
            {tagType === "marcador" && (
              <div>
                <Label htmlFor="tagColor">Cor</Label>
                <Input
                  id="tagColor"
                  type="color"
                  {...tagForm.register("color")}
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsTagModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={tagMutation.isPending}>
                {tagMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}