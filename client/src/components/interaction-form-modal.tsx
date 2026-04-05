import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  ClientInteraction,
  insertClientInteractionSchema,
  baseInsertClientInteractionSchema,
} from "@shared/schema";
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
import {
  X,
  Clock,
  Phone,
  Mail,
  MessageSquare,
  Users,
  MapPin,
  StickyNote,
  Navigation,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { z } from "zod";
import { useEffect, useState, useRef, useCallback } from "react";

// Extends the base schema for form-specific validation
const interactionFormSchema = baseInsertClientInteractionSchema.extend({
  date: z.string().min(1, "Data é obrigatória"),
  subject: z.string().min(1, "Assunto é obrigatório"),
  description: z.string().min(1, "Descrição é obrigatória"),
  latitude: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === null || val === undefined || val === "") return undefined;
      const num = typeof val === "string" ? parseFloat(val) : val;
      return isNaN(num) ? undefined : num;
    }),
  longitude: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === null || val === undefined || val === "") return undefined;
      const num = typeof val === "string" ? parseFloat(val) : val;
      return isNaN(num) ? undefined : num;
    }),
  address: z.string().optional(),
});

type InteractionFormData = z.infer<typeof interactionFormSchema>;

interface InteractionFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: {
    id: string;
    type: "client" | "company";
  };
  interaction?: ClientInteraction;
  draft?: Partial<
    Pick<
      InteractionFormData,
      "type" | "subject" | "description" | "status" | "date" | "callResult"
    >
  >;
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
  interaction,
  draft,
}: InteractionFormModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Refs to track form initialization and cache geocoding results
  const formInitialized = useRef(false);
  const addressCache = useRef<Map<string, string>>(new Map());

  const form = useForm<InteractionFormData>({
    resolver: zodResolver(interactionFormSchema),
    defaultValues: {
      clientId: "",
      companyId: "",
      userId: "",
      type: "note",
      subject: "",
      description: "",
      date: "",
      callResult: undefined,
      status: "completed",
      attachments: [],
      latitude: undefined,
      longitude: undefined,
      address: undefined,
    },
  });

  // Memoized function to get default values
  const getDefaultValues = useCallback(
    (
      targetData: typeof target,
      userData: typeof user,
      interactionData?: ClientInteraction
    ) => {
      const defaultDate = new Date().toISOString().slice(0, 16);
      return {
        clientId: targetData?.type === "client" ? targetData.id : undefined,
        companyId: targetData?.type === "company" ? targetData.id : undefined,
        userId: userData?.id || "",
        subject: interactionData?.subject || draft?.subject || "",
        description: interactionData?.description || draft?.description || "",
        date: interactionData?.date
          ? new Date(interactionData.date).toISOString().slice(0, 16)
          : draft?.date ||
            defaultDate,
        callResult: interactionData?.callResult || draft?.callResult || undefined,
        status: interactionData?.status || draft?.status || "completed",
        attachments: interactionData?.attachments || [],
        latitude: interactionData?.latitude
          ? Number(interactionData.latitude)
          : undefined,
        longitude: interactionData?.longitude
          ? Number(interactionData.longitude)
          : undefined,
        address: interactionData?.address || undefined,
        type: interactionData?.type || draft?.type || "note",
      };
    },
    [draft]
  );

  // Effect to initialize form when modal opens
  useEffect(() => {
    if (open && target && user) {
      const defaultValues = getDefaultValues(target, user, interaction);
      form.reset(defaultValues);
      formInitialized.current = true;
      setLocationError(null);
    } else if (!open) {
      formInitialized.current = false;
    }
  }, [
    open,
    target?.id,
    target?.type,
    user?.id,
    interaction?.id,
    draft?.type,
    draft?.subject,
    draft?.description,
    draft?.status,
    draft?.date,
    draft?.callResult,
    form,
    getDefaultValues,
    interaction,
  ]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (!open) {
        setIsGettingLocation(false);
        setLocationError(null);
        formInitialized.current = false;
      }
    };
  }, [open]);

  const handleMutationSuccess = (isUpdate: boolean) => {
    // Invalidate relevant queries
    if (target?.type === "client") {
      queryClient.invalidateQueries({
        queryKey: ["interactions", "client", target.id],
      });
      queryClient.invalidateQueries({ queryKey: ["clients", target.id] });
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", target.id, "interactions"],
      });
    } else if (target?.type === "company") {
      queryClient.invalidateQueries({
        queryKey: ["interactions", "company", target.id],
      });
      queryClient.invalidateQueries({ queryKey: ["companies", target.id] });
      queryClient.invalidateQueries({
        queryKey: ["/api/companies", target.id, "interactions"],
      });
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
      title: `Interação ${isUpdate ? "atualizada" : "criada"}`,
      description: `A interação foi ${
        isUpdate ? "atualizada" : "adicionada"
      } com sucesso.`,
    });
    onOpenChange(false);
  };

  const handleMutationError = (error: any, isUpdate: boolean) => {
    toast({
      title: "Erro",
      description:
        error.message ||
        `Não foi possível ${isUpdate ? "atualizar" : "criar"} a interação.`,
      variant: "destructive",
    });
  };

  const mutation = useMutation({
    mutationFn: async (data: InteractionFormData) => {
      const payload = {
        ...data,
        date: new Date(data.date).toISOString(),
        // Ensure proper handling of optional fields
        callResult: data.callResult || undefined,
        // Convert coordinates to strings for backend compatibility
        latitude:
          data.latitude !== undefined && data.latitude !== null
            ? String(data.latitude)
            : undefined,
        longitude:
          data.longitude !== undefined && data.longitude !== null
            ? String(data.longitude)
            : undefined,
        address: data.address?.trim() || undefined,
      };

      // Remove undefined values to avoid sending them
      Object.keys(payload).forEach((key) => {
        if (payload[key as keyof typeof payload] === undefined) {
          delete payload[key as keyof typeof payload];
        }
      });

      const method = interaction ? "PUT" : "POST";
      const endpoint = interaction
        ? `/api/interactions/${interaction.id}`
        : "/api/interactions";

      const response = await apiRequest(method, endpoint, payload);
      return response.json();
    },
    onSuccess: () => handleMutationSuccess(!!interaction),
    onError: (error: any) => handleMutationError(error, !!interaction),
  });

  const onSubmit = (data: InteractionFormData) => {
    mutation.mutate(data);
  };

  const selectedType = interactionTypes.find(
    (t) => t.value === form.watch("type")
  );

  // Function to get address from coordinates with caching
  // This prevents unnecessary API calls for the same coordinates
  const getAddressFromCoordinates = useCallback(
    async (latitude: number, longitude: number): Promise<string> => {
      const cacheKey = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;

      // Check cache first to avoid redundant API calls
      if (addressCache.current.has(cacheKey)) {
        return addressCache.current.get(cacheKey)!;
      }

      const apiKey = import.meta.env.VITE_OPENCAGE_API_KEY;

      if (!apiKey) {
        console.warn(
          "VITE_OPENCAGE_API_KEY não configurada. Configure para obter endereços reais."
        );
        const fallbackAddress = `Coordenadas: ${latitude.toFixed(
          6
        )}, ${longitude.toFixed(6)}`;
        addressCache.current.set(cacheKey, fallbackAddress);
        return fallbackAddress;
      }

      try {
        const response = await fetch(
          `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${apiKey}&language=pt&no_annotations=1&limit=1`,
          {
            signal: AbortSignal.timeout(8000), // 8 second timeout to prevent hanging
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Validate OpenCage API response format
        if (data.status?.code !== 200) {
          throw new Error(
            `API Error: ${data.status?.message || "Unknown error"}`
          );
        }

        let address: string;
        if (
          data.results &&
          data.results.length > 0 &&
          data.results[0].formatted
        ) {
          address = data.results[0].formatted;
        } else {
          address = `Coordenadas: ${latitude.toFixed(6)}, ${longitude.toFixed(
            6
          )}`;
        }

        // Cache the result for future use
        addressCache.current.set(cacheKey, address);
        return address;
      } catch (error) {
        console.warn("Erro ao obter endereço:", error);
        const fallbackAddress = `Coordenadas: ${latitude.toFixed(
          6
        )}, ${longitude.toFixed(6)}`;
        addressCache.current.set(cacheKey, fallbackAddress);
        return fallbackAddress;
      }
    },
    []
  );

  const getCurrentLocation = useCallback(async () => {
    // Prevent multiple simultaneous location requests to avoid race conditions
    if (isGettingLocation) {
      return;
    }

    try {
      if (!navigator.geolocation) {
        throw new Error("Geolocalização não é suportada por este navegador.");
      }

      setIsGettingLocation(true);
      setLocationError(null);

      // Get current position with enhanced error handling
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error("Tempo limite excedido"));
          }, 15000);

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              clearTimeout(timeoutId);
              resolve(pos);
            },
            (error) => {
              clearTimeout(timeoutId);
              reject(error);
            },
            {
              enableHighAccuracy: true,
              timeout: 12000,
              maximumAge: 60000, // Accept cached position up to 1 minute old for better UX
            }
          );
        }
      );

      const { latitude, longitude } = position.coords;

      // Validate coordinates to ensure they're within valid ranges
      if (
        !isFinite(latitude) ||
        !isFinite(longitude) ||
        Math.abs(latitude) > 90 ||
        Math.abs(longitude) > 180
      ) {
        throw new Error("Coordenadas inválidas recebidas");
      }

      // Update form with coordinates immediately to prevent form reset issues
      form.setValue("latitude", latitude, { shouldValidate: true });
      form.setValue("longitude", longitude, { shouldValidate: true });

      // Get address in background without blocking the UI
      try {
        const address = await getAddressFromCoordinates(latitude, longitude);
        // Only update if form is still mounted and coordinates haven't changed
        // This prevents race conditions when user rapidly clicks location button
        if (
          formInitialized.current &&
          form.getValues("latitude") === latitude &&
          form.getValues("longitude") === longitude
        ) {
          form.setValue("address", address, { shouldValidate: true });
        }
      } catch (addressError) {
        console.warn(
          "Erro ao obter endereço, mas coordenadas foram salvas:",
          addressError
        );
        // Set fallback address if coordinates are still the same
        if (
          formInitialized.current &&
          form.getValues("latitude") === latitude &&
          form.getValues("longitude") === longitude
        ) {
          form.setValue(
            "address",
            `Localização: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            { shouldValidate: true }
          );
        }
      }

      toast({
        title: "Localização capturada",
        description: "Localização atual foi registrada com sucesso.",
      });
    } catch (error: any) {
      let errorMessage = "Erro ao obter localização.";

      // Provide specific error messages based on GeolocationPositionError codes
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
          default:
            errorMessage = error.message || errorMessage;
        }
      } else if (error.message) {
        errorMessage = error.message;
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
  }, [isGettingLocation, form, getAddressFromCoordinates, toast]);

  const clearLocation = useCallback(() => {
    form.setValue("latitude", undefined, { shouldValidate: true });
    form.setValue("longitude", undefined, { shouldValidate: true });
    form.setValue("address", undefined, { shouldValidate: true });
    setLocationError(null);
  }, [form]);

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
                      <Input
                        placeholder="Digite o assunto da interação"
                        {...field}
                      />
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
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                      >
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
                    <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Localização da Visita
                    </h4>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={getCurrentLocation}
                        disabled={isGettingLocation}
                        className="text-sm"
                      >
                        {isGettingLocation ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Obtendo...
                          </>
                        ) : (
                          <>
                            <Navigation className="h-4 w-4 mr-1" />
                            Capturar Localização
                          </>
                        )}
                      </Button>
                      {(form.watch("latitude") || form.watch("longitude")) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={clearLocation}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Limpar
                        </Button>
                      )}
                    </div>
                  </div>

                  {locationError && (
                    <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-md">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium">Erro de localização</div>
                        <div>{locationError}</div>
                      </div>
                    </div>
                  )}

                  {form.watch("latitude") && form.watch("longitude") && (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded-md">
                        <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-medium">
                            Localização capturada com sucesso
                          </div>
                          <div className="text-xs text-green-600 mt-1">
                            Coordenadas: {form.watch("latitude")?.toFixed(6)},{" "}
                            {form.watch("longitude")?.toFixed(6)}
                          </div>
                        </div>
                      </div>

                      {form.watch("address") && (
                        <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 p-3 rounded-md">
                          <div className="font-medium text-gray-900 mb-1">
                            Endereço identificado:
                          </div>
                          <div>{form.watch("address")}</div>
                        </div>
                      )}
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Endereço
                          <span className="text-xs text-gray-500">
                            (opcional - será preenchido automaticamente)
                          </span>
                        </FormLabel>
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
                {mutation.isPending
                  ? "Salvando..."
                  : interaction
                  ? "Atualizar Interação"
                  : "Salvar Interação"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
