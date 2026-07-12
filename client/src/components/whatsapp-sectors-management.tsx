import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Search, Loader2, Headset, Users } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { WhatsappSector } from "@shared/schema";

type SectorMember = { userId: string; name: string; email: string; role: string };
type UserOption = { id: string; name: string; email: string; role: string };

const sectorFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  color: z.string().min(1, "Cor é obrigatória"),
});
type SectorFormData = z.infer<typeof sectorFormSchema>;

const SECTORS_QUERY_KEY = ["/api/whatsapp/sectors", "all"];

function SectorFormModal({
  isOpen,
  onClose,
  sector,
}: {
  isOpen: boolean;
  onClose: () => void;
  sector?: WhatsappSector | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!sector;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SectorFormData>({
    resolver: zodResolver(sectorFormSchema),
    defaultValues: {
      name: sector?.name || "",
      color: sector?.color || "#3B82F6",
    },
  });

  const colorValue = watch("color");

  useEffect(() => {
    reset({ name: sector?.name || "", color: sector?.color || "#3B82F6" });
  }, [sector, reset]);

  const createMutation = useMutation({
    mutationFn: async (data: SectorFormData) => {
      const res = await fetch("/api/whatsapp/sectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create sector");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/sectors"] });
      toast({ title: "Setor criado", description: "O setor de atendimento foi criado com sucesso." });
      onClose();
      reset();
    },
    onError: () => {
      toast({ title: "Erro", description: "Ocorreu um erro ao criar o setor.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SectorFormData) => {
      const res = await fetch(`/api/whatsapp/sectors/${sector!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update sector");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/sectors"] });
      toast({ title: "Setor atualizado", description: "O setor de atendimento foi atualizado com sucesso." });
      onClose();
    },
    onError: () => {
      toast({ title: "Erro", description: "Ocorreu um erro ao atualizar o setor.", variant: "destructive" });
    },
  });

  const onSubmit = (data: SectorFormData) => {
    if (isEditing) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Setor de Atendimento" : "Novo Setor de Atendimento"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize as informações do setor."
              : "Setores agrupam atendentes para organizar a transferência de conversas do WhatsApp."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Setor</Label>
            <Input id="name" {...register("name")} placeholder="Ex: Suporte, Comercial, Financeiro" />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Cor do Setor</Label>
            <div className="flex items-center gap-3">
              <Input
                id="color"
                type="color"
                value={colorValue}
                onChange={(e) => setValue("color", e.target.value, { shouldDirty: true, shouldValidate: true })}
                className="w-12 h-10 rounded-lg cursor-pointer bg-transparent"
              />
              <Input
                value={colorValue}
                onChange={(e) => setValue("color", e.target.value, { shouldDirty: true, shouldValidate: true })}
                placeholder="#3B82F6"
                className="flex-1 font-mono"
              />
            </div>
            {errors.color && <p className="text-sm text-destructive">{errors.color.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEditing ? "Atualizando..." : "Criando..."}
                </>
              ) : isEditing ? (
                "Atualizar Setor"
              ) : (
                "Criar Setor"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SectorMembersModal({
  isOpen,
  onClose,
  sector,
}: {
  isOpen: boolean;
  onClose: () => void;
  sector: WhatsappSector | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[] | null>(null);

  const { data: users = [], isLoading: usersLoading } = useQuery<UserOption[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: isOpen,
  });

  const membersQueryKey = ["/api/whatsapp/sectors", sector?.id, "members"];
  const { data: members = [], isLoading: membersLoading } = useQuery<SectorMember[]>({
    queryKey: membersQueryKey,
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/sectors/${sector!.id}/members`);
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
    enabled: isOpen && !!sector,
  });

  useEffect(() => {
    if (!isOpen) {
      setSelectedUserIds(null);
      setSearch("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && selectedUserIds === null && !membersLoading) {
      setSelectedUserIds(members.map((m) => m.userId));
    }
  }, [isOpen, selectedUserIds, membersLoading, members]);

  const saveMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      const res = await fetch(`/api/whatsapp/sectors/${sector!.id}/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds }),
      });
      if (!res.ok) throw new Error("Failed to update members");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersQueryKey });
      toast({ title: "Membros atualizados", description: "A lista de atendentes do setor foi atualizada." });
      onClose();
    },
    onError: () => {
      toast({ title: "Erro", description: "Ocorreu um erro ao atualizar os membros.", variant: "destructive" });
    },
  });

  function toggleUser(userId: string) {
    setSelectedUserIds((prev) => {
      const current = prev ?? [];
      return current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
    });
  }

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  const isLoading = usersLoading || membersLoading || selectedUserIds === null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atendentes do setor{sector ? ` "${sector.name}"` : ""}</DialogTitle>
          <DialogDescription>
            Escolha quais atendentes fazem parte deste setor. Só eles aparecerão como opção ao
            transferir uma conversa para este setor.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Buscar atendente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-1 -mx-2 px-2">
            {filteredUsers.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
                Nenhum atendente encontrado.
              </p>
            )}
            {filteredUsers.map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Checkbox
                  checked={(selectedUserIds ?? []).includes(u.id)}
                  onCheckedChange={() => toggleUser(u.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.email}</p>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                  {u.role}
                </Badge>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={isLoading || saveMutation.isPending}
            onClick={() => saveMutation.mutate(selectedUserIds ?? [])}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function WhatsappSectorsManagement() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSector, setSelectedSector] = useState<WhatsappSector | null>(null);
  const [membersSector, setMembersSector] = useState<WhatsappSector | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: sectors = [],
    isLoading,
    isFetching,
  } = useQuery<WhatsappSector[]>({
    queryKey: SECTORS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/sectors?includeInactive=true");
      if (!res.ok) throw new Error("Failed to fetch sectors");
      return res.json();
    },
  });

  const filteredSectors = sectors.filter((s) => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/whatsapp/sectors/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete sector");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/sectors"] });
      toast({ title: "Setor excluído", description: "O setor de atendimento foi excluído com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Ocorreu um erro ao excluir o setor.", variant: "destructive" });
    },
  });

  const handleEdit = (sector: WhatsappSector) => {
    setSelectedSector(sector);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este setor de atendimento?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedSector(null);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <Headset className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base">Setores de Atendimento</CardTitle>
                <CardDescription className="mt-0.5">
                  Agrupe atendentes por setor para organizar a transferência de conversas entre eles.
                </CardDescription>
              </div>
            </div>

            <Button size="sm" onClick={() => setIsFormOpen(true)} className="gap-1.5 shrink-0">
              <Plus className="h-3.5 w-3.5" />
              Novo Setor
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input
              placeholder="Buscar setor por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            {isFetching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              </div>
            )}
          </div>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredSectors.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center justify-center">
                <Headset className="h-12 w-12 text-slate-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {sectors.length === 0 ? "Nenhum setor cadastrado" : "Nenhum setor encontrado"}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">
                  {sectors.length === 0
                    ? "Crie setores para organizar a transferência de conversas do WhatsApp entre atendentes."
                    : `Não encontramos setores com o termo "${searchTerm}"`}
                </p>
                {sectors.length === 0 && (
                  <Button onClick={() => setIsFormOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeiro Setor
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSectors.map((sector) => (
                  <div
                    key={sector.id}
                    className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-lg transition-all duration-200"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-6 h-6 rounded-lg border-2 shrink-0"
                            style={{ backgroundColor: sector.color, borderColor: sector.color }}
                          />
                          <h3 className="font-medium truncate">{sector.name}</h3>
                          {!sector.isActive && (
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              Inativo
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setMembersSector(sector)}
                            title="Gerenciar atendentes"
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(sector)} title="Editar setor">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(sector.id)}
                            title="Excluir setor"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setMembersSector(sector)}
                        className="text-xs text-left text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 flex items-center gap-1.5"
                      >
                        <Users className="h-3 w-3" />
                        Gerenciar atendentes
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </CardContent>
      </Card>

      <SectorFormModal isOpen={isFormOpen} onClose={handleFormClose} sector={selectedSector} />
      <SectorMembersModal
        isOpen={!!membersSector}
        onClose={() => setMembersSector(null)}
        sector={membersSector}
      />
    </>
  );
}
