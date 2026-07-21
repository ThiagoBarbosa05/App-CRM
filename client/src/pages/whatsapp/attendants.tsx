import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, Loader2, Users, ShieldCheck, Radio } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  WhatsappAccessScopeFields,
  type WhatsappAccess,
} from "@/components/whatsapp-access-scope-fields";
import { WhatsappActionPermissionsFields } from "@/components/whatsapp-action-permissions-fields";
import { WhatsappQuickRepliesAccessField } from "@/components/whatsapp-quick-replies-access-field";
import type { User } from "@shared/schema";

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

function getRoleBadgeVariant(role: string): "destructive" | "default" | "secondary" | "outline" {
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
}

function getRoleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "Administrador";
    case "gerente":
      return "Gerente";
    case "vendedor":
      return "Vendedor";
    case "garcom":
      return "Garçom";
    default:
      return role;
  }
}

/** Edita o escopo de acesso (setores/canais) de um único atendente sob demanda. */
function AttendantAccessDialog({
  user,
  onOpenChange,
}: {
  user: User | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const open = user !== null;
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>([]);
  const [selectedQrChannelIds, setSelectedQrChannelIds] = useState<number[]>([]);
  const [selectedActionPermissions, setSelectedActionPermissions] = useState<string[]>([]);

  const { data: access, isLoading } = useQuery<WhatsappAccess>({
    queryKey: ["/api/users", user?.id, "whatsapp-access"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${user!.id}/whatsapp-access`);
      if (!res.ok) throw new Error("Failed to fetch whatsapp access");
      return res.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (access) {
      setSelectedSectorIds(access.sectorIds);
      setSelectedChannelIds(access.channelIds);
    } else if (!open) {
      setSelectedSectorIds([]);
      setSelectedChannelIds([]);
    }
  }, [access, open]);

  const { data: qrAccess, isLoading: isQrAccessLoading } = useQuery<{ channelIds: number[] }>({
    queryKey: ["/api/users", user?.id, "whatsapp-qr-access"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${user!.id}/whatsapp-qr-access`);
      if (!res.ok) throw new Error("Failed to fetch whatsapp qr access");
      return res.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (qrAccess) {
      setSelectedQrChannelIds(qrAccess.channelIds);
    } else if (!open) {
      setSelectedQrChannelIds([]);
    }
  }, [qrAccess, open]);

  const { data: actionPermissions, isLoading: isActionPermissionsLoading } = useQuery<{
    permissionKeys: string[];
  }>({
    queryKey: ["/api/users", user?.id, "whatsapp-action-permissions"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${user!.id}/whatsapp-action-permissions`);
      if (!res.ok) throw new Error("Failed to fetch whatsapp action permissions");
      return res.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (actionPermissions) {
      setSelectedActionPermissions(actionPermissions.permissionKeys);
    } else if (!open) {
      setSelectedActionPermissions([]);
    }
  }, [actionPermissions, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await Promise.all([
        apiRequest("PUT", `/api/users/${user.id}/whatsapp-access`, {
          sectorIds: selectedSectorIds,
          channelIds: selectedChannelIds,
        }),
        apiRequest("PUT", `/api/users/${user.id}/whatsapp-qr-access`, {
          channelIds: selectedQrChannelIds,
        }),
        apiRequest("PUT", `/api/users/${user.id}/whatsapp-action-permissions`, {
          permissionKeys: selectedActionPermissions,
        }),
      ]);
    },
    onSuccess: () => {
      toast({
        title: "Acesso atualizado",
        description: `Escopo de acesso de ${user?.name} salvo com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "whatsapp-access"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "whatsapp-qr-access"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/users", user?.id, "whatsapp-action-permissions"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/whatsapp-access-summary"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const isLoadingAny = isLoading || isQrAccessLoading || isActionPermissionsLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Escopo de acesso {user ? `— ${user.name}` : ""}</DialogTitle>
          <DialogDescription>
            Defina quais setores e canais de WhatsApp este atendente pode ver.
          </DialogDescription>
        </DialogHeader>

        {isLoadingAny ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando escopo atual...
          </div>
        ) : (
          <div className="min-w-0 space-y-4">
            <WhatsappAccessScopeFields
              selectedSectorIds={selectedSectorIds}
              selectedChannelIds={selectedChannelIds}
              selectedQrChannelIds={selectedQrChannelIds}
              onChangeSectorIds={setSelectedSectorIds}
              onChangeChannelIds={setSelectedChannelIds}
              onChangeQrChannelIds={setSelectedQrChannelIds}
            />
            <WhatsappQuickRepliesAccessField
              selectedKeys={selectedActionPermissions}
              onChange={setSelectedActionPermissions}
            />
            <WhatsappActionPermissionsFields
              selectedKeys={selectedActionPermissions}
              onChange={setSelectedActionPermissions}
            />
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={isLoadingAny || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
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

/** Escopo de acesso (setores/canais vinculados) de todos os atendentes, obtido em um único request. */
type WhatsappAccessSummary = Record<
  string,
  {
    sectors: { id: string; name: string; color: string }[];
    channels: { id: number; name: string; displayPhone: string | null }[];
  }
>;

export default function WhatsAppAttendantsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [editingAccessUser, setEditingAccessUser] = useState<User | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: accessSummary = {} } = useQuery<WhatsappAccessSummary>({
    queryKey: ["/api/users/whatsapp-access-summary"],
    queryFn: async () => {
      const res = await fetch("/api/users/whatsapp-access-summary");
      if (!res.ok) throw new Error("Failed to fetch whatsapp access summary");
      return res.json();
    },
  });

  const filteredUsers = useMemo(() => {
    if (!debouncedSearchTerm) return users;
    const term = debouncedSearchTerm.toLowerCase();
    return users.filter(
      (u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
    );
  }, [users, debouncedSearchTerm]);

  return (
    <div className="overflow-y-auto h-full p-4 sm:p-5 lg:p-6">
      <div className="space-y-5 pb-10">
        <PageHeader>
          <PageHeader.Info>
            <PageHeader.Icon
              icon={Users}
              color="text-slate-600 dark:text-slate-400"
              bgColor="bg-slate-100 dark:bg-slate-800"
            />
            <PageHeader.Text>
              <PageHeader.Title>Atendentes</PageHeader.Title>
              <PageHeader.Description>
                Veja a equipe e defina quais setores e canais cada vendedor pode acessar.
              </PageHeader.Description>
            </PageHeader.Text>
          </PageHeader.Info>
        </PageHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4 border rounded-xl">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-8 w-28 rounded-md" />
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center justify-center">
            <Users className="h-12 w-12 text-slate-400 mb-4" />
            <p className="text-slate-600 dark:text-slate-400">
              {users.length === 0
                ? "Nenhum usuário cadastrado"
                : `Nenhum usuário encontrado para "${searchTerm}"`}
            </p>
            {users.length > 0 && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setSearchTerm("")}>
                Limpar filtro
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((u) => {
              const scope = accessSummary[u.id];
              return (
              <div
                key={u.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-primary">{getInitials(u.name)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{u.name}</p>
                      <Badge variant={getRoleBadgeVariant(u.role)} className="text-xs">
                        {getRoleLabel(u.role)}
                      </Badge>
                      {u.isActive === "false" && (
                        <Badge variant="secondary" className="text-xs">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{u.email}</p>

                    {u.role === "vendedor" && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {scope && scope.sectors.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            {scope.sectors.map((sector) => (
                              <span
                                key={sector.id}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-300"
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: sector.color }}
                                />
                                {sector.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {scope && scope.channels.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            {scope.channels.map((channel) => (
                              <span
                                key={channel.id}
                                className="inline-flex items-center gap-1 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300"
                              >
                                <Radio className="h-2.5 w-2.5 shrink-0" />
                                {channel.name}
                                {channel.displayPhone ? ` (${channel.displayPhone})` : ""}
                              </span>
                            ))}
                          </div>
                        )}
                        {(!scope || (scope.sectors.length === 0 && scope.channels.length === 0)) && (
                          <span className="text-xs text-muted-foreground italic">
                            Nenhum setor ou canal vinculado
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {u.role === "vendedor" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 shrink-0"
                    onClick={() => setEditingAccessUser(u)}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Gerenciar acesso
                  </Button>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>

      <AttendantAccessDialog
        user={editingAccessUser}
        onOpenChange={(open) => !open && setEditingAccessUser(null)}
      />
    </div>
  );
}
