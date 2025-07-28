
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type User } from "@shared/schema";
import { User as UserIcon, Mail, Key } from "lucide-react";

interface VendorProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  onUpdate: (updatedUser: User) => void;
}

const vendorProfileSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.newPassword && data.newPassword !== data.confirmPassword) {
    return false;
  }
  if (data.newPassword && !data.currentPassword) {
    return false;
  }
  return true;
}, {
  message: "Senhas não coincidem ou senha atual não informada",
  path: ["confirmPassword"],
});

type VendorProfileData = z.infer<typeof vendorProfileSchema>;

export default function VendorProfileModal({ open, onOpenChange, user, onUpdate }: VendorProfileModalProps) {
  const { toast } = useToast();

  const form = useForm<VendorProfileData>({
    resolver: zodResolver(vendorProfileSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name,
        email: user.email,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    }
  }, [user, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: VendorProfileData) => {
      const updateData: any = {
        name: data.name,
        email: data.email,
      };

      // Se uma nova senha foi fornecida, inclui as senhas no update
      if (data.newPassword) {
        updateData.currentPassword = data.currentPassword;
        updateData.password = data.newPassword;
      }

      const response = await apiRequest(`/api/users/${user.id}/profile`, "PUT", updateData);
      return response;
    },
    onSuccess: (updatedUser) => {
      toast({
        title: "Sucesso",
        description: "Perfil atualizado com sucesso",
      });
      onUpdate(updatedUser);
      onOpenChange(false);
      form.reset({
        name: updatedUser.name,
        email: updatedUser.email,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: VendorProfileData) => {
    updateProfileMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-wine-600" />
            Meu Perfil
          </DialogTitle>
          <DialogDescription>
            Atualize suas informações pessoais e senha.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    Nome Completo
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Digite seu nome completo" {...field} />
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
                  <FormLabel className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    E-mail
                  </FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="seu@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Key className="h-4 w-4" />
                Alterar Senha (opcional)
              </h4>
              
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha Atual</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Digite sua senha atual" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nova Senha</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Nova senha" {...field} />
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
                          <Input type="password" placeholder="Confirme a nova senha" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateProfileMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
