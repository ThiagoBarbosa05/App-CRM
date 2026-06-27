import { useState, useMemo, useEffect, useRef } from "react";
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
import { X, Tag, User, Phone, MapPin, Briefcase, Store, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  DuplicateWarning,
  type DuplicateMatch,
} from "@/components/duplicate-warning";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { TagSelector } from "@/components/ui/tag-selector";

interface ClientFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client;
}

interface BlingSellerMapping {
  connectionId: string;
  connectionName: string;
  connectionStatus: string;
  blingVendedorId: string;
  blingVendedorName: string | null;
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
    queryKey: ["/api/tags/categories"],
  }) as { data: any[] };

  // Buscar origens das configurações
  const { data: origins = [] } = useQuery({
    queryKey: ["/api/tags/origins"],
  }) as { data: any[] };

  // Buscar usuários para administradores e gerentes
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    enabled: user?.role === "admin" || user?.role === "gerente",
  }) as { data: any[] };

  // Buscar marcadores das configurações
  const { data: markers = [] } = useQuery({
    queryKey: ["/api/tags/markers"],
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
      fixedPhone: client?.fixedPhone || "",
      documentType: (client?.documentType as "cpf" | "cnpj") || "cpf",
      cpf: client?.cpf || "",
      nomeFantasia: client?.nomeFantasia || "",
      inscricaoEstadual: client?.inscricaoEstadual || "",
      email: client?.email || "",
      birthday: convertBrazilianDateToISO(client?.birthday || ""),
      cep: client?.cep || "",
      address: client?.address || "",
      number: client?.number || "",
      complement: client?.complement || "",
      neighborhood: client?.neighborhood || "",
      city: client?.city || "",
      state: client?.state || "",
      markers: client?.markers || [],
      responsavelId: client?.responsavelId || user?.id || "",
      categoria: client?.categoria || "",
      origem: client?.origem || "",
      externalTagIds: [],
    },
    mode: "onChange",
  });

  const watchedCpf = form.watch("cpf");
  const watchedName = form.watch("name");
  const watchedPhone = form.watch("phone");
  const watchedEmail = form.watch("email");
  const watchedCep = form.watch("cep");

  // ── Integração Bling (apenas no modo de criação) ──────────────────────────
  const isAdminOrGerente =
    user?.role === "admin" || user?.role === "gerente";
  const [createInBling, setCreateInBling] = useState(false);
  const [blingConnectionId, setBlingConnectionId] = useState("");

  // O vendedor cujo vínculo Bling será usado: o responsável escolhido (admin/
  // gerente) ou o próprio usuário (vendedor).
  const watchedResponsavelId = form.watch("responsavelId");
  const blingSellerUserId = isAdminOrGerente
    ? watchedResponsavelId
    : user?.id;

  const { data: blingMappings } = useQuery<BlingSellerMapping[]>({
    queryKey: isAdminOrGerente
      ? ["/api/bling-accounts/seller-mappings", blingSellerUserId]
      : ["/api/bling-accounts/my-seller-mappings"],
    queryFn: async () => {
      const url = isAdminOrGerente
        ? `/api/bling-accounts/seller-mappings?userId=${blingSellerUserId}`
        : "/api/bling-accounts/my-seller-mappings";
      const res = await apiRequest("GET", url);
      const json = await res.json();
      return (json?.data ?? []) as BlingSellerMapping[];
    },
    enabled:
      open && !client && (isAdminOrGerente ? !!blingSellerUserId : !!user),
  });

  // Apenas contas conectadas e com ID de vendedor vinculado podem receber o cliente.
  const connectedBlingMappings = useMemo(
    () =>
      (blingMappings ?? []).filter(
        (m) => m.connectionStatus === "connected" && m.blingVendedorId,
      ),
    [blingMappings],
  );

  // Auto-seleciona quando há uma única conta; limpa seleção inválida e desliga
  // o toggle quando o vendedor não possui nenhum vínculo.
  useEffect(() => {
    if (connectedBlingMappings.length === 1) {
      setBlingConnectionId(connectedBlingMappings[0].connectionId);
    } else if (
      !connectedBlingMappings.some((m) => m.connectionId === blingConnectionId)
    ) {
      setBlingConnectionId("");
    }
    if (connectedBlingMappings.length === 0) {
      setCreateInBling(false);
    }
  }, [connectedBlingMappings]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reseta o estado Bling ao fechar o modal.
  useEffect(() => {
    if (!open) {
      setCreateInBling(false);
      setBlingConnectionId("");
    }
  }, [open]);

  const blingToggleDisabled =
    (isAdminOrGerente && !blingSellerUserId) ||
    connectedBlingMappings.length === 0;

  const isCnpj = useMemo(() => {
    const digits = (watchedCpf || "").replace(/\D/g, "");
    return digits.length > 11;
  }, [watchedCpf]);

  // Sincroniza documentType quando o campo muda
  const documentType = isCnpj ? "cnpj" : "cpf";
  if (form.getValues("documentType") !== documentType) {
    form.setValue("documentType", documentType);
  }

  const lookupCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
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
      form.setValue("address", data.logradouro || "");
      form.setValue("neighborhood", data.bairro || "");
      form.setValue("city", data.localidade || "");
      form.setValue("state", data.uf || "");
      toast({
        title: "Endereço encontrado",
        description: "Os dados do endereço foram preenchidos automaticamente.",
      });
    } catch {
      toast({
        title: "Erro ao consultar CEP",
        description: "Não foi possível consultar o CEP. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCep(false);
    }
  };

  // Auto-busca de CEP quando 8 dígitos são preenchidos
  useEffect(() => {
    const digits = (watchedCep || "").replace(/\D/g, "");
    if (digits.length === 8) {
      lookupCep(digits);
    }
  }, [watchedCep]);

  // Verificação de duplicatas com debounce
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bloquear submit se houver match exato de CPF ou email (não de nome similar)
  const hasBlockingDuplicate = duplicates.some((d) =>
    d.matchReasons.some((r) => r.includes("CPF") || r.includes("E-mail")),
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const name = watchedName?.trim();
      const phone = watchedPhone?.replace(/\D/g, "");
      const cpf = watchedCpf?.replace(/\D/g, "");
      const email = watchedEmail?.trim();
      if (!name && !phone && !cpf && !email) {
        setDuplicates([]);
        return;
      }
      try {
        const res = await fetch("/api/clients/check-duplicate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            phone,
            cpf,
            email,
            excludeId: client?.id,
          }),
        });
        if (res.ok) setDuplicates(await res.json());
      } catch {
        /* silencioso */
      }
    }, 700);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [watchedName, watchedPhone, watchedCpf, watchedEmail, client?.id]);

  const createClientMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = `/api/clients?userId=${user?.id}&userRole=${user?.role}`;
      const response = await apiRequest("POST", url, data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      // Invalidate marker stats cache to update goal calculations
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          (q.queryKey[0] as string).startsWith("/api/marker-stats"),
      });

      // Verificar se requer confirmação
      if (data.requiresConfirmation) {
        toast({
          title: "Cliente criado com sucesso!",
          description:
            "Um código de confirmação foi enviado para o Umbler. Acesse as notas do contato no Umbler para confirmar o cadastro.",
          duration: 8000,
        });
      } else if (data.bling?.status === "error") {
        // Cliente criado no CRM, mas o envio ao Bling falhou.
        toast({
          title: "Cliente criado (sem envio ao Bling)",
          description: `Cliente adicionado, mas não foi criado no Bling: ${data.bling.message}`,
          variant: "destructive",
          duration: 8000,
        });
      } else if (data.bling?.status === "created") {
        toast({
          title: "Cliente criado",
          description: "Cliente foi adicionado e criado no Bling com sucesso.",
        });
      } else {
        toast({
          title: "Cliente criado",
          description: "Cliente foi adicionado com sucesso.",
        });
      }

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
      const url = `/api/clients/${client!.id}?userId=${user?.id}&userRole=${
        user?.role
      }`;
      const response = await apiRequest("PUT", url, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      // Invalidate marker stats cache to update goal calculations
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          (q.queryKey[0] as string).startsWith("/api/marker-stats"),
      });
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

  const onSubmit = async (data: any) => {
    console.log("Dados do formulário:", data);
    console.log("Erros do formulário:", form.formState.errors);
    setIsSubmitting(true);
    try {
      // Converter campos vazios para null e garantir que responsavelId seja sempre o usuário atual
      const processedData = {
        ...data,
        // CPF é opcional: limpa o valor se estiver vazio ou parcialmente preenchido
        cpf: (() => {
          const digits = (data.cpf || "").replace(/\D/g, "");
          if (digits.length === 11 || digits.length === 14)
            return data.cpf?.trim() || null;
          return null;
        })(),
        phone: data.phone?.replace(/\D/g, "") ? data.phone?.trim() : null,
        documentType: isCnpj ? "cnpj" : "cpf",
        nomeFantasia: isCnpj ? data.nomeFantasia?.trim() || null : null,
        inscricaoEstadual: isCnpj
          ? data.inscricaoEstadual?.trim() || null
          : null,
        email: data.email?.trim() || null,
        cep: data.cep?.trim() || "",
        address: data.address?.trim() || "",
        number: data.number?.trim() || "",
        complement: data.complement?.trim() || "",
        neighborhood: data.neighborhood?.trim() || "",
        city: data.city?.trim() || "",
        state: data.state?.trim() || "",
        responsavelId:
          user?.role === "admin" || user?.role === "gerente"
            ? data.responsavelId
            : user?.id || null, // Admin e gerente podem escolher, outros usam usuário atual
        // Opção de criar o cliente no Bling (apenas na criação). O ID do vendedor
        // Bling é derivado no servidor de (connectionId, responsavelId).
        ...(!client && createInBling && blingConnectionId
          ? {
              bling: { createInBling: true, connectionId: blingConnectionId },
            }
          : {}),
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
      <DialogContent className="w-full max-w-3xl overflow-hidden p-0 bg-slate-50 dark:bg-slate-950 flex flex-col max-h-[90vh]">
        <div className="border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-5 shrink-0 relative z-10 shadow-sm">
          <DialogHeader className="space-y-0">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent rounded-xl shadow-sm border border-border">
                {client ? (
                  <Tag className="h-6 w-6 text-primary" />
                ) : (
                  <Tag className="h-6 w-6 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                  {client ? "Editar Cliente" : "Novo Cliente"}
                </DialogTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {client
                    ? "Atualize as informações do cliente abaixo."
                    : "Preencha as informações para cadastrar um novo cliente."}
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="overflow-y-auto overflow-x-hidden p-6 gap-6 relative flex flex-col h-full scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          <Form {...form}>
            <form
              id="client-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-8"
            >
              <DuplicateWarning matches={duplicates} />

              {/* Integração Bling — apenas na criação */}
              {!client && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <span className="p-1.5 bg-accent rounded-md shrink-0">
                        <Store className="h-4 w-4 text-primary" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Criar também no Bling
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Cadastra este cliente como contato no Bling,
                          vinculado ao vendedor responsável.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={createInBling}
                      onCheckedChange={setCreateInBling}
                      disabled={blingToggleDisabled}
                    />
                  </div>

                  {/* Mensagens de estado / seletor de conta */}
                  {isAdminOrGerente && !blingSellerUserId ? (
                    <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Selecione o responsável atribuído para habilitar o envio ao
                      Bling.
                    </p>
                  ) : connectedBlingMappings.length === 0 ? (
                    <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {isAdminOrGerente
                        ? "Este responsável não possui ID Bling vinculado a nenhuma conta conectada."
                        : "Você não possui ID Bling vinculado; não é possível criar o cliente no Bling."}
                    </p>
                  ) : createInBling ? (
                    connectedBlingMappings.length === 1 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Conta Bling:{" "}
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {connectedBlingMappings[0].connectionName}
                        </span>
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                          Conta Bling
                        </label>
                        <Select
                          value={blingConnectionId}
                          onValueChange={setBlingConnectionId}
                        >
                          <SelectTrigger className="dark:bg-slate-950 focus:ring-purple-500">
                            <SelectValue placeholder="Selecione a conta Bling" />
                          </SelectTrigger>
                          <SelectContent>
                            {connectedBlingMappings.map((m) => (
                              <SelectItem
                                key={m.connectionId}
                                value={m.connectionId}
                              >
                                {m.connectionName}
                                {m.blingVendedorName
                                  ? ` — ${m.blingVendedorName}`
                                  : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  ) : null}
                </div>
              )}

              {/* Seção 1: Dados Pessoais */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                  <span className="p-1.5 bg-accent rounded-md">
                    <User className="h-4 w-4 text-primary" />
                  </span>
                  Dados Pessoais
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel className="text-slate-700 dark:text-slate-300">
                          Nome Completo *
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="dark:bg-slate-950 focus-visible:ring-blue-500"
                            placeholder="Digite o nome completo"
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
                      <FormItem className={isCnpj ? "md:col-span-2" : ""}>
                        <FormLabel className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          {isCnpj ? "CNPJ" : "CPF / CNPJ"}
                          {isCnpj && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 px-2 py-0.5 rounded-full">
                              Pessoa Jurídica
                            </span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="dark:bg-slate-950 focus-visible:ring-blue-500"
                            placeholder={
                              isCnpj ? "00.000.000/0000-00" : "000.000.000-00"
                            }
                            value={field.value}
                            onChange={(e) => {
                              const digits = e.target.value
                                .replace(/\D/g, "")
                                .slice(0, 14);
                              let formatted = digits;
                              if (digits.length <= 11) {
                                // Formato CPF: 000.000.000-00
                                formatted = digits
                                  .replace(/(\d{3})(\d)/, "$1.$2")
                                  .replace(/(\d{3})(\d)/, "$1.$2")
                                  .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
                              } else {
                                // Formato CNPJ: 00.000.000/0000-00
                                formatted = digits
                                  .replace(/(\d{2})(\d)/, "$1.$2")
                                  .replace(/(\d{3})(\d)/, "$1.$2")
                                  .replace(/(\d{3})(\d)/, "$1/$2")
                                  .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
                              }
                              field.onChange(formatted);
                            }}
                            onBlur={field.onBlur}
                            name={field.name}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isCnpj && (
                    <>
                      <FormField
                        control={form.control}
                        name="nomeFantasia"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 dark:text-slate-300">
                              Nome Fantasia
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="dark:bg-slate-950 focus-visible:ring-blue-500"
                                placeholder="Nome fantasia da empresa"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="inscricaoEstadual"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 dark:text-slate-300">
                              Inscrição Estadual
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="dark:bg-slate-950 focus-visible:ring-blue-500"
                                placeholder="Inscrição estadual"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  <FormField
                    control={form.control}
                    name="birthday"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300">
                          Data de Aniversário
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="dark:bg-slate-950 focus-visible:ring-blue-500"
                            type="date"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Seção 2: Contatos */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 dark:bg-emerald-600"></div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-md">
                    <Phone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </span>
                  Contato
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300">
                          Celular WhatsApp
                        </FormLabel>
                        <FormControl>
                          <InputMask
                            mask="(99) 99999-9999"
                            placeholder="(11) 99999-9999"
                            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-950 focus-visible:ring-emerald-500 font-medium"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fixedPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300">
                          Telefone Fixo
                        </FormLabel>
                        <FormControl>
                          <InputMask
                            mask="(99) 9999-9999"
                            placeholder="(11) 1234-5678"
                            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-950 focus-visible:ring-emerald-500"
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
                      <FormItem className="md:col-span-2">
                        <FormLabel className="text-slate-700 dark:text-slate-300">
                          E-mail
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="dark:bg-slate-950 focus-visible:ring-emerald-500"
                            type="email"
                            placeholder="email@exemplo.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Seção 3: Endereço */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 dark:bg-amber-600"></div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                  <span className="p-1.5 bg-amber-50 dark:bg-amber-900/30 rounded-md">
                    <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </span>
                  Endereço
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                  <FormField
                    control={form.control}
                    name="cep"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2 lg:col-span-1">
                        <FormLabel className="text-slate-700 dark:text-slate-300">
                          CEP
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <InputMask
                              mask="99999-999"
                              placeholder="00000-000"
                              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-950 focus-visible:ring-amber-500"
                              {...field}
                            />
                            {isLoadingCep && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-500"></div>
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2 lg:col-span-2">
                        <FormLabel className="text-slate-700 dark:text-slate-300">
                          Logradouro (Rua, Av.)
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="dark:bg-slate-950 focus-visible:ring-amber-500"
                            placeholder="Ex: Rua das Flores"
                            {...field}
                          />
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
                        <FormLabel className="text-slate-700 dark:text-slate-300">
                          Número
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="dark:bg-slate-950 focus-visible:ring-amber-500"
                            placeholder="123"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="complement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300">
                          Complemento
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="dark:bg-slate-950 focus-visible:ring-amber-500"
                            placeholder="Apto, Sala, Bloco..."
                            {...field}
                          />
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
                        <FormLabel className="text-slate-700 dark:text-slate-300">
                          Bairro
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="dark:bg-slate-950 focus-visible:ring-amber-500"
                            placeholder="Ex: Centro"
                            {...field}
                          />
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
                        <FormLabel className="text-slate-700 dark:text-slate-300">
                          Cidade
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="dark:bg-slate-950 focus-visible:ring-amber-500"
                            placeholder="Ex: São Paulo"
                            {...field}
                          />
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
                        <FormLabel className="text-slate-700 dark:text-slate-300">
                          Estado
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="dark:bg-slate-950 focus:ring-amber-500">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <div className="max-h-[200px] overflow-y-auto">
                              {brazilianStates.map((state) => (
                                <SelectItem
                                  key={state.value}
                                  value={state.value}
                                >
                                  {state.label}
                                </SelectItem>
                              ))}
                            </div>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Seção 4: Comercial e CRM */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 dark:bg-purple-600"></div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                  <span className="p-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-md">
                    <Briefcase className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </span>
                  Gestão Comercial
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <FormField
                    control={form.control}
                    name="categoria"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300">
                          Categoria *
                        </FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="dark:bg-slate-950 focus:ring-purple-500">
                                <SelectValue placeholder="Selecione a categoria" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(categories as any[]).length === 0 ? (
                                <div className="p-2 text-sm text-gray-500 text-center">
                                  Nenhuma categoria encontrada.
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
                        <FormLabel className="text-slate-700 dark:text-slate-300">
                          Origem Principal *
                        </FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="dark:bg-slate-950 focus:ring-purple-500">
                                <SelectValue placeholder="Selecione a origem" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(origins as any[]).length === 0 ? (
                                <div className="p-2 text-sm text-gray-500 text-center">
                                  Nenhuma origem encontrada.
                                </div>
                              ) : (
                                (origins as any[]).map((origin: any) => (
                                  <SelectItem
                                    key={origin.id}
                                    value={origin.name}
                                  >
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

                  {user?.role === "admin" || user?.role === "gerente" ? (
                    <FormField
                      control={form.control}
                      name="responsavelId"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="text-slate-700 dark:text-slate-300">
                            Responsável Atribuído *
                          </FormLabel>
                          <FormControl>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="dark:bg-slate-950 focus:ring-purple-500">
                                  <SelectValue placeholder="Selecione o vendedor responsável" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(users as any[]).length === 0 ? (
                                  <div className="p-2 text-sm text-gray-500 text-center">
                                    Nenhum usuário encontrado.
                                  </div>
                                ) : (
                                  (users as any[]).map((u: any) => (
                                    <SelectItem key={u.id} value={u.id}>
                                      {u.name} -{" "}
                                      {u.role === "admin"
                                        ? "Administrador"
                                        : u.role === "gerente"
                                          ? "Gerente"
                                          : "Vendedor"}
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
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium leading-none text-slate-700 dark:text-slate-300">
                        Responsável
                      </label>
                      <div className="flex h-10 w-full items-center rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-3 py-2 text-sm">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">
                          {user?.name || "Você (Autosselecionado)"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        Como vendedor, este cliente será automaticamente
                        atribuído à sua carteira.
                      </p>
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="markers"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel className="text-slate-700 dark:text-slate-300">
                          Marcadores Adicionais (Tags)
                        </FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={(value) => {
                              const currentMarkers = field.value || [];
                              if (!currentMarkers.includes(value)) {
                                field.onChange([...currentMarkers, value]);
                              }
                            }}
                            value=""
                          >
                            <FormControl>
                              <SelectTrigger className="dark:bg-slate-950 focus:ring-purple-500">
                                <SelectValue placeholder="Selecione marcadores..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {markers.filter((m: any) => m.type === "marcador")
                                .length === 0 ? (
                                <div className="p-2 text-sm text-gray-500 text-center">
                                  Nenhum marcador disponível.
                                </div>
                              ) : (
                                markers
                                  .filter((m: any) => m.type === "marcador")
                                  .map((m: any) => (
                                    <SelectItem key={m.id} value={m.name}>
                                      {m.name}
                                    </SelectItem>
                                  ))
                              )}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        {field.value && field.value.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
                            {field.value.map(
                              (marker: string, index: number) => (
                                <Badge
                                  key={index}
                                  variant="secondary"
                                  className="flex items-center gap-1.5 px-2.5 py-1 text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50 transition-colors"
                                >
                                  {marker}
                                  <X
                                    className="h-3.5 w-3.5 cursor-pointer opacity-70 hover:opacity-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const newMarkers = field.value.filter(
                                        (m: string) => m !== marker,
                                      );
                                      field.onChange(newMarkers);
                                    }}
                                  />
                                </Badge>
                              ),
                            )}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </form>
          </Form>
        </div>

        {/* Footer pegajoso para os botões */}
        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md px-6 py-4 shrink-0 flex items-center justify-end gap-3 rounded-b-lg">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium px-4"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="client-form"
            disabled={isSubmitting || hasBlockingDuplicate}
            title={
              hasBlockingDuplicate
                ? "Resolva a duplicidade de CPF/e-mail antes de salvar"
                : undefined
            }
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm px-6 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-white/20 border-t-white rounded-full" />
                Salvando...
              </span>
            ) : client ? (
              "Atualizar Cliente"
            ) : (
              "Cadastrar Cliente"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
