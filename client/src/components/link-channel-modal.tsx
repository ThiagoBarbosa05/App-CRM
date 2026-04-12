import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import z from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { User } from "@shared/schema";
import { FaWhatsapp } from "react-icons/fa";
import { Button } from "./ui/button";
import { queryClient } from "@/lib/queryClient";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

interface LinkChannelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User & {
    serviceChannel?: {
      id: string;
      name: string;
      phoneNumber?: string | null;
    } | null;
  };
}

type UmblerChannel = {
  id: string;
  name: string;
  phoneNumber: string;
};

const userServiceChannelFormSchema = z.object({
  userId: z.string().min(1, "ID do usuário é obrigatório"),
  serviceChannelId: z
    .string()
    .min(1, "Selecione um canal do Umbler para o usuário"),
});

type UserServiceChannelFormData = z.infer<typeof userServiceChannelFormSchema>;

export function LinkChannelModal({
  onOpenChange,
  open,
  user,
}: LinkChannelModalProps) {
  const userServiceChannelForm = useForm<UserServiceChannelFormData>({
    resolver: zodResolver(userServiceChannelFormSchema),
    defaultValues: {
      userId: user.id,
      serviceChannelId: user.serviceChannel?.id || "",
    },
  });

  const { user: userAuthenticated, updateUserAuthenticated } = useAuth();

  useEffect(() => {
    userServiceChannelForm.reset({
      userId: user.id,
      serviceChannelId: user.serviceChannel?.id || "",
    });
  }, [user, userServiceChannelForm]);

  const { data: umblerChannels, isLoading: isLoadingUmblerChannels } = useQuery<
    UmblerChannel[]
  >({
    queryKey: ["/api/umbler/channels"],
    queryFn: async () => {
      const response = await fetch("/api/umbler/channels");
      if (!response.ok) throw new Error("Failed to fetch umbler channels");
      return response.json();
    },
    enabled: !!open,
  });

  const linkChannelMutation = useMutation({
    mutationFn: async (data: UserServiceChannelFormData) => {
      const response = await fetch("/api/users/channel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Não foi possível vincular o canal");

      return response.json();
    },

    onSuccess: (data: { channelId: string }) => {
      toast({
        title: "Canal vinculado com sucesso",
        description: "O canal foi vinculado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      updateUserAuthenticated({
        ...user,
        serviceChannelId: data.channelId,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  async function onSubmit(data: UserServiceChannelFormData) {
    linkChannelMutation.mutate(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FaWhatsapp className="w-5 h-5 text-blue-600" />
            Vincular Canal Umbler
          </DialogTitle>
          <DialogDescription>
            Vincule um canal do Umbler ao usuário <strong>{user.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={userServiceChannelForm.handleSubmit(onSubmit)}
          className="space-y-3"
        >
          {isLoadingUmblerChannels ? (
            <div className="p-2 text-sm text-gray-500">
              Carregando canais...
            </div>
          ) : (
            <div>
              <Controller
                control={userServiceChannelForm.control}
                name="serviceChannelId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o canal" />
                    </SelectTrigger>
                    <SelectContent>
                      {umblerChannels?.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          {channel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {userServiceChannelForm.formState.errors.serviceChannelId && (
                <div className="p-2 text-sm text-red-500">
                  {
                    userServiceChannelForm.formState.errors.serviceChannelId
                      .message
                  }
                </div>
              )}
            </div>
          )}

          <Button type="submit" disabled={linkChannelMutation.isPending}>
            {linkChannelMutation.isPending ? "Vinculando..." : "Vincular"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
