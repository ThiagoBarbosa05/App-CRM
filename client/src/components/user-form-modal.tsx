import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertUserSchema, type User, type WhatsappSector } from "@shared/schema";

type WhatsappAccessChannel = {
  id: number;
  name: string;
  displayPhone: string | null;
  provider: string;
};

type WhatsappAccess = { sectorIds: string[]; channelIds: number[] };

/**
 * Multi-select de setores/canais de WhatsApp para o "Escopo de acesso" do
 * usuário — só faz sentido para role "vendedor", cuja visibilidade de
 * conversas é escopada por whatsapp_sector_members + whatsapp_channel_members
 * (ver vendorScopeCondition em server/services/whatsapp-conversations.service.ts).
 */
function WhatsappAccessScopeFields({
  selectedSectorIds,
  selectedChannelIds,
  onChangeSectorIds,
  onChangeChannelIds,
}: {
  selectedSectorIds: string[];
  selectedChannelIds: number[];
  onChangeSectorIds: (ids: string[]) => void;
  onChangeChannelIds: (ids: number[]) => void;
}) {
  const { data: sectors = [], isLoading: sectorsLoading } = useQuery<WhatsappSector[]>({
    queryKey: ["/api/whatsapp/sectors"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/sectors");
      if (!res.ok) throw new Error("Failed to fetch sectors");
      return res.json();
    },
  });

  const { data: channels = [], isLoading: channelsLoading } = useQuery<WhatsappAccessChannel[]>({
    queryKey: ["/api/whatsapp/channels"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/channels");
      if (!res.ok) throw new Error("Failed to fetch channels");
      return res.json();
    },
  });

  function toggle(list: string[], id: string, onChange: (ids: string[]) => void) {
    onChange(list.includes(id) ? list.filter((v) => v !== id) : [...list, id]);
  }

  function toggleNumber(list: number[], id: number, onChange: (ids: number[]) => void) {
    onChange(list.includes(id) ? list.filter((v) => v !== id) : [...list, id]);
  }

  return (
    <div className="space-y-4 rounded-lg border dark:border-slate-700 p-4">
      <div>
        <h4 className="text-sm font-medium">Escopo de acesso</h4>
        <p className="text-xs text-muted-foreground dark:text-slate-400">
          O atendente só verá as conversas dos setores e canais selecionados abaixo.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Acesso aos setores</Label>
        {sectorsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando setores...
          </div>
        ) : sectors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum setor cadastrado.</p>
        ) : (
          <div className="max-h-36 overflow-y-auto space-y-1 rounded-md border dark:border-slate-700 p-2">
            {sectors.map((sector) => (
              <label
                key={sector.id}
                className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Checkbox
                  checked={selectedSectorIds.includes(sector.id)}
                  onCheckedChange={() => toggle(selectedSectorIds, sector.id, onChangeSectorIds)}
                />
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: sector.color }}
                />
                <span className="text-sm truncate">{sector.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Acesso aos canais</Label>
        {channelsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando canais...
          </div>
        ) : channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum canal cadastrado.</p>
        ) : (
          <div className="max-h-36 overflow-y-auto space-y-1 rounded-md border dark:border-slate-700 p-2">
            {channels.map((channel) => (
              <label
                key={channel.id}
                className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Checkbox
                  checked={selectedChannelIds.includes(channel.id)}
                  onCheckedChange={() => toggleNumber(selectedChannelIds, channel.id, onChangeChannelIds)}
                />
                <span className="text-sm truncate">
                  {channel.name}
                  {channel.displayPhone ? ` (${channel.displayPhone})` : ""}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface UserFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

const userFormSchema = insertUserSchema
  .extend({
    password: z
      .string()
      .min(6, "Senha deve ter pelo menos 6 caracteres")
      .optional(),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.password && data.password !== data.confirmPassword) {
        return false;
      }
      return true;
    },
    {
      message: "Senhas não coincidem",
      path: ["confirmPassword"],
    },
  );

type UserFormData = z.infer<typeof userFormSchema>;

export default function UserFormModal({
  open,
  onOpenChange,
  user,
}: UserFormModalProps) {
  const { toast } = useToast();
  const isEditing = !!user;
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>([]);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "vendedor",
      isActive: "true",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        password: "",
        confirmPassword: "",
      });
    } else {
      form.reset({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        role: "vendedor",
        isActive: "true",
      });
    }
  }, [user, form]);

  const watchedRole = form.watch("role");
  const showAccessScope = isEditing && watchedRole === "vendedor";

  const { data: whatsappAccess } = useQuery<WhatsappAccess>({
    queryKey: ["/api/users", user?.id, "whatsapp-access"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${user!.id}/whatsapp-access`);
      if (!res.ok) throw new Error("Failed to fetch whatsapp access");
      return res.json();
    },
    enabled: open && showAccessScope,
  });

  useEffect(() => {
    if (whatsappAccess) {
      setSelectedSectorIds(whatsappAccess.sectorIds);
      setSelectedChannelIds(whatsappAccess.channelIds);
    } else if (!open) {
      setSelectedSectorIds([]);
      setSelectedChannelIds([]);
    }
  }, [whatsappAccess, open]);

  const accessMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await apiRequest("PUT", `/api/users/${user.id}/whatsapp-access`, {
        sectorIds: selectedSectorIds,
        channelIds: selectedChannelIds,
      });
    },
  });

  const userMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const { confirmPassword, ...userData } = data;

      if (isEditing) {
        // Se não há nova senha, remove o campo password
        if (!userData.password) {
          delete userData.password;
        }
        await apiRequest("PUT", `/api/users/${user.id}`, userData);
        if (showAccessScope) {
          await accessMutation.mutateAsync();
        }
      } else {
        await apiRequest("POST", "/api/users", userData);
      }
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: isEditing
          ? "Usuário atualizado com sucesso"
          : "Usuário cadastrado com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UserFormData) => {
    // Validação adicional para senha em criação
    if (!isEditing && !data.password) {
      form.setError("password", {
        message: "Senha é obrigatória para novos usuários",
      });
      return;
    }

    userMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Usuário" : "Novo Usuário"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize as informações do usuário. Deixe a senha em branco para mantê-la inalterada."
              : "Preencha os dados para criar um novo usuário no sistema."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Digite o nome completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="email@exemplo.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Perfil de Usuário</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o perfil" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="gerente">Gerente</SelectItem>
                      <SelectItem value="vendedor">Vendedor</SelectItem>
                      <SelectItem value="garcom">Garçom</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showAccessScope && (
              <WhatsappAccessScopeFields
                selectedSectorIds={selectedSectorIds}
                selectedChannelIds={selectedChannelIds}
                onChangeSectorIds={setSelectedSectorIds}
                onChangeChannelIds={setSelectedChannelIds}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {isEditing ? "Nova Senha (opcional)" : "Senha"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Digite a senha"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Confirme a senha"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg dark:border-slate-700 border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Usuário Ativo</FormLabel>
                    <div className="text-sm text-muted-foreground dark:text-slate-400">
                      Usuários inativos não podem acessar o sistema
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value === "true"}
                      onCheckedChange={(checked) =>
                        field.onChange(checked ? "true" : "false")
                      }
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={userMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={userMutation.isPending}>
                {userMutation.isPending
                  ? isEditing
                    ? "Atualizando..."
                    : "Cadastrando..."
                  : isEditing
                    ? "Atualizar"
                    : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
