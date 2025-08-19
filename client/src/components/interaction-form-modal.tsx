import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
import { X, Calendar, Clock, Phone, Mail, MessageSquare, Users, MapPin, StickyNote } from "lucide-react";
import { z } from "zod";

const interactionFormSchema = insertClientInteractionSchema.extend({
  date: z.string().min(1, "Data é obrigatória"),
});

interface InteractionFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
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
  clientId, 
  interaction 
}: InteractionFormModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    resolver: zodResolver(interactionFormSchema),
    defaultValues: {
      clientId,
      userId: user?.id || "", // Use authenticated user's ID
      type: interaction?.type || "note",
      subject: interaction?.subject || "",
      description: interaction?.description || "",
      date: interaction?.date ? new Date(interaction.date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      callResult: interaction?.callResult || "",
      status: interaction?.status || "completed",
      attachments: interaction?.attachments || [],
    },
  });

  const createInteractionMutation = useMutation({
    mutationFn: async (data: any) => {
      // Convert date string to ISO timestamp
      const payload = {
        ...data,
        date: new Date(data.date).toISOString(),
      };
      const response = await apiRequest("/api/interactions", "POST", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "interactions"] });

      // Invalidate telemarketing stats if it's a telemarketing interaction
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      queryClient.invalidateQueries({
        queryKey: [`/api/telemarketing-stats/${currentMonth}/${currentYear}`],
      });

      toast({
        title: "Interação criada",
        description: "Interação foi adicionada com sucesso.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar a interação.",
        variant: "destructive",
      });
    },
  });

  const updateInteractionMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        date: new Date(data.date).toISOString(),
      };
      const response = await apiRequest(`/api/interactions/${interaction!.id}`, "PUT", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "interactions"] });

      // Invalidate telemarketing stats if it's a telemarketing interaction
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      queryClient.invalidateQueries({
        queryKey: [`/api/telemarketing-stats/${currentMonth}/${currentYear}`],
      });

      toast({
        title: "Interação atualizada",
        description: "A interação foi atualizada com sucesso.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar a interação.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      if (interaction) {
        await updateInteractionMutation.mutateAsync(data);
      } else {
        await createInteractionMutation.mutateAsync(data);
      }
    } finally {
      setIsSubmitting(false);
    }
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                      <FormLabel>Resultado da Chamada *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary-dark text-white"
              >
                {isSubmitting ? "Salvando..." : interaction ? "Atualizar Interação" : "Salvar Interação"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}