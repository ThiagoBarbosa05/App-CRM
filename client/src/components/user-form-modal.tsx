import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertUserSchema, type User } from "@shared/schema";

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

  const userMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const { confirmPassword, ...userData } = data;

      if (isEditing) {
        // Se não há nova senha, remove o campo password
        if (!userData.password) {
          delete userData.password;
        }
        await apiRequest("PUT", `/api/users/${user.id}`, userData);
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
