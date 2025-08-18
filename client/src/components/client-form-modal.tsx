import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Client, insertClientSchema } from "@shared/schema";
import { clientValidationSchema } from "@/lib/validations";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { InputMask } from "@/components/ui/input-mask";
import { X, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

interface ClientFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client;
}

const brazilianStates = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },
  { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" },
];

export default function ClientFormModal({
  open,
  onOpenChange,
  client,
}: ClientFormModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newMarker, setNewMarker] = useState("");
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const { user } = useAuth();

  // Buscar categorias das configurações
  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
  }) as { data: any[] };

  // Buscar origens das configurações
  const { data: origins = [] } = useQuery({
    queryKey: ["/api/origins"],
  }) as { data: any[] };

  // Buscar usuários para administradores
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    enabled: user?.role === "admin",
  }) as { data: any[] };

  // Buscar marcadores das configurações
  const { data: markers = [] } = useQuery({
    queryKey: ["/api/markers"],
  }) as { data: any[] };

  // Função para converter data brasileira para ISO
  const convertBrazilianDateToISO = (dateStr: string) => {
    if (!dateStr) return "";

    // Se já está no formato ISO (YYYY-MM-DD), retorna como está
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }

    // Se está no formato brasileiro (DD/MM/YYYY), converte para ISO
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split("/");
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    // Se é um número (formato Excel), converte para data
    if (/^\d+\.?\d*$/.test(dateStr)) {
      try {
        const excelDate = parseFloat(dateStr);
        const jsDate = new Date((excelDate - 25569) * 86400 * 1000);
        const year = jsDate.getFullYear();
        const month = String(jsDate.getMonth() + 1).padStart(2, "0");
        const day = String(jsDate.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      } catch (error) {
        console.error("Erro ao converter data do Excel:", error);
        return "";
      }
    }

    return dateStr;
  };

  const form = useForm({
    resolver: zodResolver(clientValidationSchema),
    defaultValues: {
      name: client?.name || "",
      phone: client?.phone || "",
      cpf: client?.cpf || "",
      email: client?.email || "",
      birthday: convertBrazilianDateToISO(client?.birthday || ""),
      cep: client?.cep || "",
      address: client?.address || "",
      number: client?.number || "",
      neighborhood: client?.neighborhood || "",
      city: client?.city || "",
      state: client?.state || "",
      markers: client?.markers || [],
      responsavelId: client?.responsavelId || user?.id || "",
      categoria: client?.categoria || "",
      origem: client?.origem || "",
    },
    mode: "onChange",
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = `/api/clients?userId=${user?.id}&userRole=${user?.role}`;
      const response = await apiRequest(url, "POST", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Cliente criado",
        description: "Cliente foi adicionado com sucesso.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar o cliente.",
        variant: "destructive",
      });
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = `/api/clients/${client!.id}?userId=${user?.id}&userRole=${user?.role}`;
      const response = await apiRequest(url, "PUT", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Cliente atualizado",
        description: "Cliente foi atualizado com sucesso.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar o cliente.",
        variant: "destructive",
      });
    },
  });

  const addMarker = (marker: string) => {
    if (marker.trim() && !form.getValues("markers")?.includes(marker.trim())) {
      const currentMarkers = form.getValues("markers") || [];
      form.setValue("markers", [...currentMarkers, marker.trim()]);
      setNewMarker("");
    }
  };

  const removeMarker = (markerToRemove: string) => {
    const currentMarkers = form.getValues("markers") || [];
    form.setValue(
      "markers",
      currentMarkers.filter((marker) => marker !== markerToRemove),
    );
  };

  const lookupCep = async (cep: string) => {
    // Remove non-numeric characters
    const cleanCep = cep.replace(/\D/g, "");

    // Check if CEP has 8 digits
    if (cleanCep.length !== 8) {
      return;
    }

    setIsLoadingCep(true);

    try {
      const response = await fetch(
        `https://viacep.com.br/ws/${cleanCep}/json/`,
      );
      const data = await response.json();

      if (data.erro) {
        toast({
          title: "CEP não encontrado",
          description: "O CEP informado não foi encontrado.",
          variant: "destructive",
        });
        return;
      }

      // Fill the address fields
      form.setValue("address", data.logradouro || "");
      form.setValue("neighborhood", data.bairro || "");
      form.setValue("city", data.localidade || "");
      form.setValue("state", data.uf || "");

      toast({
        title: "Endereço encontrado",
        description: "Os dados do endereço foram preenchidos automaticamente.",
      });
    } catch (error) {
      toast({
        title: "Erro ao consultar CEP",
        description: "Não foi possível consultar o CEP. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCep(false);
    }
  };

  const onSubmit = async (data: any) => {
    console.log("Dados do formulário:", data);
    console.log("Erros do formulário:", form.formState.errors);
    setIsSubmitting(true);
    try {
      // Converter campos vazios para null e garantir que responsavelId seja sempre o usuário atual
      const processedData = {
        ...data,
        cpf: data.cpf?.trim() || null,
        email: data.email?.trim() || null,
        cep: data.cep?.trim() || "",
        address: data.address?.trim() || "",
        number: data.number?.trim() || "",
        neighborhood: data.neighborhood?.trim() || "",
        city: data.city?.trim() || "",
        state: data.state?.trim() || "",
        responsavelId:
          user?.role === "admin" ? data.responsavelId : user?.id || null, // Admin pode escolher, outros usam usuário atual
      };

      if (client) {
        await updateClientMutation.mutateAsync(processedData);
      } else {
        await createClientMutation.mutateAsync(processedData);
      }
    } catch (error) {
      console.error("Erro no submit:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {client ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nome Completo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Digite o nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Celular *</FormLabel>
                    <FormControl>
                      <InputMask
                        mask="(99) 99999-9999"
                        placeholder="(11) 99999-9999"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <InputMask
                        mask="999.999.999-99"
                        placeholder="000.000.000-00"
                        {...field}
                      />
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
                name="birthday"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Aniversário</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Campo responsável - selecionável para admin, informativo para outros */}
              {user?.role === "admin" ? (
                <FormField
                  control={form.control}
                  name="responsavelId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsável *</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o responsável" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(users as any[]).length === 0 ? (
                              <div className="p-2 text-sm text-gray-500 text-center">
                                Nenhum usuário encontrado.
                              </div>
                            ) : (
                              (users as any[]).map((user: any) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.name} -{" "}
                                  {user.role === "admin"
                                    ? "Administrador"
                                    : user.role === "gerente"
                                      ? "Gerente"
                                      : user.role === "vendedor"
                                        ? "Vendedor"
                                        : "Usuário"}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Responsável
                  </label>
                  <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
                    <span className="text-muted-foreground">
                      {user?.name || "Usuário atual"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Clientes são automaticamente atribuídos a você como
                    responsável
                  </p>
                </div>
              )}

              <FormField
                control={form.control}
                name="categoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria *</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a categoria" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(categories as any[]).length === 0 ? (
                            <div className="p-2 text-sm text-gray-500 text-center">
                              Nenhuma categoria encontrada. Crie categorias na
                              página Configurações.
                            </div>
                          ) : (
                            (categories as any[]).map((category: any) => (
                              <SelectItem
                                key={category.id}
                                value={category.name}
                              >
                                {category.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="origem"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origem *</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a origem" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(origins as any[]).length === 0 ? (
                            <div className="p-2 text-sm text-gray-500 text-center">
                              Nenhuma origem encontrada. Crie origens na página
                              Configurações.
                            </div>
                          ) : (
                            (origins as any[]).map((origin: any) => (
                              <SelectItem key={origin.id} value={origin.name}>
                                {origin.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="markers"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Marcadores</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) => {
                          // Para permitir múltiplos marcadores, vamos apenas adicionar ao array
                          const currentMarkers = field.value || [];
                          if (!currentMarkers.includes(value)) {
                            field.onChange([...currentMarkers, value]);
                          }
                        }}
                        value=""
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione marcadores..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {markers
                            .filter((marker: any) => marker.type === 'marcador')
                            .length === 0 ? (
                            <div className="p-2 text-sm text-gray-500 text-center">
                              Nenhum marcador encontrado. Crie marcadores na
                              página Configurações.
                            </div>
                          ) : (
                            markers
                              .filter((marker: any) => marker.type === 'marcador')
                              .map((marker: any) => (
                                <SelectItem key={marker.id} value={marker.name}>
                                  {marker.name}
                                </SelectItem>
                              ))
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    {/* Mostrar marcadores selecionados */}
                    {field.value && field.value.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {field.value.map((marker: string, index: number) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="flex items-center gap-1"
                          >
                            {marker}
                            <X
                              className="h-3 w-3 cursor-pointer"
                              onClick={() => {
                                const newMarkers = field.value.filter(
                                  (m: string) => m !== marker
                                );
                                field.onChange(newMarkers);
                              }}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <InputMask
                          mask="99999-999"
                          placeholder="00000-000"
                          {...field}
                          onBlur={(e) => {
                            field.onBlur();
                            const cep = e.target.value;
                            if (cep && cep.length === 9) {
                              // CEP with mask has 9 characters
                              lookupCep(cep);
                            }
                          }}
                        />
                        {isLoadingCep && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      O endereço será preenchido automaticamente ao digitar o
                      CEP
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Logradouro</FormLabel>
                    <FormControl>
                      <Input placeholder="Rua, avenida, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl>
                      <Input placeholder="123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="neighborhood"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro</FormLabel>
                    <FormControl>
                      <Input placeholder="Centro" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input placeholder="São Paulo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {brazilianStates.map((state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 bg-white">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-purple-700 hover:bg-purple-800 text-white border-0"
                style={{ backgroundColor: "#7c3aed", color: "white" }}
              >
                {isSubmitting
                  ? "Salvando..."
                  : client
                    ? "Atualizar Cliente"
                    : "Salvar Cliente"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
