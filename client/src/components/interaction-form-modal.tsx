import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ClientInteraction, insertClientInteractionSchema, baseInsertClientInteractionSchema } from "@shared/schema";
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
import { X, Clock, Phone, Mail, MessageSquare, Users, MapPin, StickyNote, Navigation } from "lucide-react";
import { z } from "zod";
import { useEffect, useState } from "react";

// Extends the base schema for form-specific validation
const interactionFormSchema = baseInsertClientInteractionSchema.extend({
  date: z.string().min(1, "Data é obrigatória"),
  subject: z.string().min(1, "Assunto é obrigatório"),
  description: z.string().min(1, "Descrição é obrigatória"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  address: z.string().optional(),
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
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);


  const form = useForm<InteractionFormData>({
    resolver: zodResolver(interactionFormSchema),
    defaultValues: {
      clientId: target?.type === 'client' ? target.id : undefined,
      companyId: target?.type === 'company' ? target.id : undefined,
      userId: user?.id || "",
      type: "note",
      subject: "",
      description: "",
      date: new Date().toISOString().slice(0, 16),
      callResult: undefined,
      status: "completed",
      attachments: [],
      latitude: undefined,
      longitude: undefined,
      address: undefined,
    },
  });


  // Effect to update form when interaction or target changes
  useEffect(() => {
    if (open) {
      const defaultDate = new Date().toISOString().slice(0, 16);
      form.reset({
        clientId: target?.type === 'client' ? target.id : undefined,
        companyId: target?.type === 'company' ? target.id : undefined,
        userId: user?.id || "",
        type: interaction?.type || "note",
        subject: interaction?.subject || "",
        description: interaction?.description || "",
        date: interaction?.date ? new Date(interaction.date).toISOString().slice(0, 16) : defaultDate,
        callResult: interaction?.callResult || undefined,
        status: interaction?.status || "completed",
        attachments: interaction?.attachments || [],
        latitude: interaction?.latitude ? Number(interaction.latitude) : undefined,
        longitude: interaction?.longitude ? Number(interaction.longitude) : undefined,
        address: interaction?.address || undefined,
      });
    }
  }, [open, interaction, target, user, form]);

  const handleMutationSuccess = (isUpdate: boolean) => {
    // Invalidate relevant queries
    if (target?.type === 'client') {
      queryClient.invalidateQueries({ queryKey: ['interactions', 'client', target.id] });
      queryClient.invalidateQueries({ queryKey: ['clients', target.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", target.id, "interactions"] });
    } else if (target?.type === 'company') {
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
        latitude: data.latitude || undefined,
        longitude: data.longitude || undefined,
        address: data.address || undefined,
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

  const getCurrentLocation = async () => {
    try {
      if (!navigator.geolocation) {
        setLocationError("Geolocalização não é suportada por este navegador.");
        return;
      }

      setIsGettingLocation(true);
      setLocationError(null);

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      });

      const { latitude, longitude } = position.coords;
      form.setValue("latitude", latitude);
      form.setValue("longitude", longitude);

      // Tentar obter o endereço usando reverse geocoding
      try {
        // Verificar se existe API key configurada
        const apiKey = import.meta.env.VITE_OPENCAGE_API_KEY;
        
        if (apiKey && apiKey !== 'YOUR_API_KEY') {
          const response = await fetch(
            `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${apiKey}&language=pt&no_annotations=1`
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
              const address = data.results[0].formatted;
              form.setValue("address", address);
            } else {
              // Se não há resultados, usar coordenadas
              form.setValue("address", `Lat: ${latitude.toFixed(6)}, Long: ${longitude.toFixed(6)}`);
            }
          } else {
            throw new Error('Falha na API de geocoding');
          }
        } else {
          // Se não há API key, usar as coordenadas como endereço
          console.log("API key do OpenCage não configurada, usando coordenadas como endereço");
          form.setValue("address", `Localização: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        }
      } catch (geocodingError) {
        console.log("Erro ao obter endereço:", geocodingError);
        // Define um endereço genérico com as coordenadas
        form.setValue("address", `Localização: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      }

      toast({
        title: "Localização capturada",
        description: "Localização atual foi registrada com sucesso.",
      });

    } catch (error: any) {
      let errorMessage = "Erro ao obter localização.";
      
      if (error.code) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Permissão de localização negada pelo usuário.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Informações de localização não estão disponíveis.";
            break;
          case error.TIMEOUT:
            errorMessage = "Tempo limite para obter localização excedido.";
            break;
        }
      }
      
      setLocationError(errorMessage);
      toast({
        title: "Erro de localização",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsGettingLocation(false);
    }
  };

  const clearLocation = () => {
    form.setValue("latitude", undefined);
    form.setValue("longitude", undefined);
    form.setValue("address", undefined);
    setLocationError(null);
  };

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
            <input type="hidden" {...form.register("clientId")} />
            <input type="hidden" {...form.register("companyId")} />
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

              {form.watch("type") === "visit" && (
                <div className="md:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900">Localização da Visita</h4>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={getCurrentLocation}
                        disabled={isGettingLocation}
                        className="text-sm"
                      >
                        <Navigation className="h-4 w-4 mr-1" />
                        {isGettingLocation ? "Obtendo..." : "Capturar Localização"}
                      </Button>
                      {(form.watch("latitude") || form.watch("longitude")) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={clearLocation}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Limpar
                        </Button>
                      )}
                    </div>
                  </div>

                  {locationError && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {locationError}
                    </div>
                  )}

                  {form.watch("address") && (
                    <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                      <strong>Endereço:</strong> {form.watch("address")}
                    </div>
                  )}

                  {(form.watch("latitude") && form.watch("longitude")) && (
                    <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                      <strong>Coordenadas:</strong> {form.watch("latitude")?.toFixed(6)}, {form.watch("longitude")?.toFixed(6)}
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endereço (opcional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Digite o endereço manualmente se necessário..."
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
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