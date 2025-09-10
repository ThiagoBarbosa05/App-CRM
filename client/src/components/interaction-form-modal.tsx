import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ClientInteraction, insertClientInteractionSchema } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { X, Clock, Phone, Mail, MessageSquare, Users, MapPin, StickyNote } from "lucide-react";
import { z } from "zod";
import { useEffect } from "react";

// Extends the base schema for form-specific validation
const interactionFormSchema = insertClientInteractionSchema.extend({
  date: z.string().min(1, "Data é obrigatória"),
});

type InteractionFormData = z.infer<typeof interactionFormSchema>;

interface InteractionFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: {
    id: string;
    type: 'client' | 'company';
  };
  interaction?: ClientInteraction;
}

const interactionTypes = [
  { value: "telemarketing", label: "Ligação", icon: Phone },
  { value: "email", label: "E-mail", icon: Mail },
  { value: "meeting", label: "Reunião", icon: Users },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "visit", label: "Visita", icon: MapPin },
  { value: "note", label: "Anotação", icon: StickyNote },
  { value: "other", label: "Outro", icon: Clock },
];

const statusOptions = [
  { value: "completed", label: "Concluído" },
  { value: "scheduled", label: "Agendado" },
  { value: "cancelled", label: "Cancelado" },
];

const callResultOptions = [
  { value: "COM SUCESSO", label: "COM SUCESSO" },
  { value: "NÃO ATENDIDA", label: "NÃO ATENDIDA" },
  { value: "SEM INTERESSE", label: "SEM INTERESSE" },
  { value: "NÃO LIGAR MAIS", label: "NÃO LIGAR MAIS" },
  { value: "EM OCUPADO", label: "EM OCUPADO" },
  { value: "OUTROS", label: "OUTROS" },
];

export default function InteractionFormModal({ 
  open, 
  onOpenChange, 
  target, 
  interaction 
}: InteractionFormModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<InteractionFormData>({
    resolver: zodResolver(interactionFormSchema),
    defaultValues: {
      clientId: target.type === 'client' ? target.id : undefined,
      companyId: target.type === 'company' ? target.id : undefined,
      userId: user?.id || "",
      type: "note",
      subject: "",
      description: "",
      date: new Date().toISOString().slice(0, 16),
      callResult: undefined,
      status: "completed",
      attachments: [],
    },
  });

  // Effect to update form when interaction or target changes
  useEffect(() => {
    if (open) {
      const defaultDate = new Date().toISOString().slice(0, 16);
      form.reset({
        clientId: target.type === 'client' ? target.id : undefined,
        companyId: target.type === 'company' ? target.id : undefined,
        userId: user?.id || "",
        type: interaction?.type || "note",
        subject: interaction?.subject || "",
        description: interaction?.description || "",
        date: interaction?.date ? new Date(interaction.date).toISOString().slice(0, 16) : defaultDate,
        callResult: interaction?.callResult || undefined,
        status: interaction?.status || "completed",
        attachments: interaction?.attachments || [],
      });
    }
  }, [open, interaction, target, user, form]);

  const handleMutationSuccess = (isUpdate: boolean) => {
    // Invalidate relevant queries
    if (target.type === 'client') {
      queryClient.invalidateQueries({ queryKey: ['interactions', 'client', target.id] });
      queryClient.invalidateQueries({ queryKey: ['clients', target.id] });
    } else {
      queryClient.invalidateQueries({ queryKey: ['interactions', 'company', target.id] });
      queryClient.invalidateQueries({ queryKey: ['companies', target.id] });
    }

    // Invalidate general stats if a call was logged
    if (form.getValues("type") === "telemarketing") {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      queryClient.invalidateQueries({
        queryKey: [`/api/telemarketing-stats/${currentMonth}/${currentYear}`],
      });
    }

    toast({
      title: `Interação ${isUpdate ? 'atualizada' : 'criada'}`,
      description: `A interação foi ${isUpdate ? 'atualizada' : 'adicionada'} com sucesso.`,
    });
    onOpenChange(false);
  };

  const handleMutationError = (error: any, isUpdate: boolean) => {
    toast({
      title: "Erro",
      description: error.message || `Não foi possível ${isUpdate ? 'atualizar' : 'criar'} a interação.`,
      variant: "destructive",
    });
  };

  const mutation = useMutation({
    mutationFn: async (data: InteractionFormData) => {
      const payload = {
        ...data,
        date: new Date(data.date).toISOString(),
        // Ensure empty strings for optional fields are not sent
        callResult: data.callResult || undefined,
      };

      const method = interaction ? "PUT" : "POST";
      const endpoint = interaction ? `/api/interactions/${interaction.id}` : "/api/interactions";

      const response = await apiRequest(method, endpoint, payload);
      return response.json();
    },
    onSuccess: () => handleMutationSuccess(!!interaction),
    onError: (error: any) => handleMutationError(error, !!interaction),
  });

  const onSubmit = (data: InteractionFormData) => {
    mutation.mutate(data);
  };

  const selectedType = interactionTypes.find(t => t.value === form.watch("type"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              {selectedType && <selectedType.icon className="h-5 w-5" />}
              {interaction ? "Editar Interação" : "Nova Interação"}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Interação *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {interactionTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className="h-4 w-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statusOptions.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Assunto *</FormLabel>
                    <FormControl>
                      <Input placeholder="Digite o assunto da interação" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data e Hora *</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch("type") === "telemarketing" && (
                <FormField
                  control={form.control}
                  name="callResult"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resultado da Chamada</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o resultado..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {callResultOptions.map((result) => (
                            <SelectItem key={result.value} value={result.value}>
                              {result.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Descrição *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Descreva os detalhes da interação..."
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="bg-primary hover:bg-primary-dark text-white"
              >
                {mutation.isPending ? "Salvando..." : interaction ? "Atualizar Interação" : "Salvar Interação"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}