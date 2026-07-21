import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { PdvUnit } from "@shared/schema";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertUserSchema, type User } from "@shared/schema";
import {
  WhatsappAccessScopeFields,
  type WhatsappAccess,
} from "@/components/whatsapp-access-scope-fields";

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
  const [selectedQrChannelIds, setSelectedQrChannelIds] = useState<number[]>([]);

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
  const showPdvUnit = watchedRole === "garcom";

  const { data: pdvUnits = [] } = useQuery<PdvUnit[]>({
    queryKey: ["/api/restaurant-pdv/units"],
    enabled: showPdvUnit,
  });

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

  const { data: whatsappQrAccess } = useQuery<{ channelIds: number[] }>({
    queryKey: ["/api/users", user?.id, "whatsapp-qr-access"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${user!.id}/whatsapp-qr-access`);
      if (!res.ok) throw new Error("Failed to fetch whatsapp qr access");
      return res.json();
    },
    enabled: open && showAccessScope,
  });

  useEffect(() => {
    if (whatsappQrAccess) {
      setSelectedQrChannelIds(whatsappQrAccess.channelIds);
    } else if (!open) {
      setSelectedQrChannelIds([]);
    }
  }, [whatsappQrAccess, open]);

  const accessMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await apiRequest("PUT", `/api/users/${user.id}/whatsapp-access`, {
        sectorIds: selectedSectorIds,
        channelIds: selectedChannelIds,
      });
    },
  });

  const qrAccessMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await apiRequest("PUT", `/api/users/${user.id}/whatsapp-qr-access`, {
        channelIds: selectedQrChannelIds,
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
          await Promise.all([accessMutation.mutateAsync(), qrAccessMutation.mutateAsync()]);
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
                selectedQrChannelIds={selectedQrChannelIds}
                onChangeSectorIds={setSelectedSectorIds}
                onChangeChannelIds={setSelectedChannelIds}
                onChangeQrChannelIds={setSelectedQrChannelIds}
              />
            )}

            {showPdvUnit && (
              <FormField
                control={form.control}
                name="pdvUnitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade PDV</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a unidade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {pdvUnits.filter((u) => u.isActive).map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                            {u.cnpj ? ` — ${u.cnpj}` : ""}
                          </SelectItem>
                        ))}
                        {pdvUnits.filter((u) => u.isActive).length === 0 && (
                          <SelectItem value="_none" disabled>
                            Nenhuma unidade ativa
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
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
