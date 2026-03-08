import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Client } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
  useUmblerCashbackAutomation,
  useSyncUmblerCustomer,
  useCreateUmblerChat,
} from "@/hooks/use-umbler";
import { formatCurrency, cn } from "@/lib/utils";
import {
  ArrowRight,
  Bot,
  CalendarIcon,
  DollarSign,
  Hash,
  Info,
  Loader2,
  MessageSquareMore,
  Percent,
  Plus,
  Receipt,
  RefreshCcw,
  Search,
  Trash2,
  User,
} from "lucide-react";
import { motion } from "framer-motion";
import ClientFormModal from "./client-form-modal";

interface SaleFormModalProps {
  /** Quando passado, o cliente fica pré-selecionado (uso na tabela de clientes) */
  client?: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SaleFormState {
  clientId: string;
  date: string;
  grossValue: string;
  notes: string;
  invoiceNumber: string;
}

const ORGANIZATION_ID = "aGx7Jh43-au36EGi";

export default function SaleFormModal({
  client: preselectedClient,
  open,
  onOpenChange,
}: SaleFormModalProps) {
  const { user } = useAuth();

  const [saleForm, setSaleForm] = useState<SaleFormState>({
    clientId: preselectedClient?.id ?? "",
    date: new Date().toISOString().split("T")[0],
    grossValue: "",
    notes: "",
    invoiceNumber: "",
  });
  const [loading, setLoading] = useState(false);
  const [useCashback, setUseCashback] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(
    preselectedClient ?? null,
  );
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [debouncedClientSearch, setDebouncedClientSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Client[]>([]);
  const [selectedClientBalance, setSelectedClientBalance] = useState(0);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  const umblerCashbackAutomation = useUmblerCashbackAutomation(
    user?.id,
    user?.role,
  );
  const syncCustomer = useSyncUmblerCustomer(user?.id, user?.role);
  const createChatMutation = useCreateUmblerChat(user?.id, user?.role);

  const { data: settings = [] } = useQuery<any[]>({
    queryKey: ["/api/cashback-settings"],
  });

  // Sincronizar cliente pré-selecionado quando a prop muda
  useEffect(() => {
    if (preselectedClient) {
      setSelectedClient(preselectedClient);
      setSaleForm((prev) => ({ ...prev, clientId: preselectedClient.id }));
      loadClientBalance(preselectedClient.id);
    }
  }, [preselectedClient?.id]);

  // Resetar estado ao fechar
  useEffect(() => {
    if (!open) {
      const resetClient = preselectedClient ?? null;
      setSelectedClient(resetClient);
      setSaleForm({
        clientId: resetClient?.id ?? "",
        date: new Date().toISOString().split("T")[0],
        grossValue: "",
        notes: "",
        invoiceNumber: "",
      });
      setSelectedClientBalance(0);
      setClientSearchQuery("");
      setDebouncedClientSearch("");
      setSearchResults([]);
      setUseCashback(true);
    }
  }, [open]);

  // Debounce da busca de clientes
  useEffect(() => {
    const handler = setTimeout(
      () => setDebouncedClientSearch(clientSearchQuery),
      300,
    );
    return () => clearTimeout(handler);
  }, [clientSearchQuery]);

  // Buscar clientes quando a query mudar (só quando sem cliente pré-selecionado)
  useEffect(() => {
    if (!preselectedClient && debouncedClientSearch.trim()) {
      searchClients(debouncedClientSearch);
    } else if (!debouncedClientSearch.trim()) {
      setSearchResults([]);
    }
  }, [debouncedClientSearch, preselectedClient]);

  // Queries do Umbler (só quando o diálogo está aberto e há cliente selecionado)
  const { data: umblerContact, isLoading: isLoadingUmblerContact } = useQuery<{
    id: string;
  } | null>({
    queryKey: ["umblerContactByPhone", selectedClient?.phone],
    queryFn: async () => {
      if (!selectedClient?.phone) return null;
      const res = await fetch(`/api/umbler/contacts/${selectedClient.phone}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch Umbler contact");
      return res.json();
    },
    enabled: !!selectedClient && open,
  });

  const { data: contactChat, isLoading: isLoadingChats } = useQuery({
    queryKey: ["contactChat", selectedClient?.phone],
    queryFn: async () => {
      if (!selectedClient?.phone) return null;
      const res = await fetch(
        `/api/umbler/chats?customerPhone=${selectedClient.phone}&userId=${user?.id}`,
        {
          headers: {
            "x-user-id": user?.id ?? "",
            "x-user-role": user?.role ?? "",
          },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch chat");
      return res.json();
    },
    enabled: !!selectedClient?.phone && open,
  });

  const contactId = umblerContact?.id;
  const isUmblerReady = !!contactId && !!contactChat?.items?.[0]?.id;

  const searchClients = async (query: string) => {
    try {
      const params = new URLSearchParams({ search: query, pageSize: "50" });
      const res = await fetch(`/api/clients?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.data || []);
      }
    } catch (err) {
      console.error("Erro ao buscar clientes:", err);
    }
  };

  const loadClientBalance = async (clientId: string) => {
    if (!clientId) {
      setSelectedClientBalance(0);
      return;
    }
    try {
      const res = await fetch(`/api/cashback-balances/${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedClientBalance(parseFloat(data.currentBalance) || 0);
      }
    } catch {
      setSelectedClientBalance(0);
    }
  };

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setSaleForm((prev) => ({ ...prev, clientId: client.id }));
    setClientSearchQuery("");
    setSearchResults([]);
    loadClientBalance(client.id);
  };

  const handleClearClient = () => {
    setSelectedClient(null);
    setSaleForm((prev) => ({ ...prev, clientId: "" }));
    setSelectedClientBalance(0);
    setClientSearchQuery("");
  };

  const calculateValues = () => {
    const grossValue = parseFloat(saleForm.grossValue) || 0;
    let cashbackUsed = 0;
    if (useCashback && selectedClientBalance > 0) {
      cashbackUsed = Math.min(selectedClientBalance, grossValue * 0.5);
    }
    const netValue = grossValue - cashbackUsed;
    const activeSetting = settings.find((s: any) => s.isActive === "true");
    let cashbackRate = 0;
    let cashbackGenerated = 0;
    if (activeSetting) {
      const min = parseFloat(activeSetting.minimumPurchase || "0");
      if (netValue >= min) {
        cashbackRate = parseFloat(activeSetting.percentageRate) / 100;
        cashbackGenerated = netValue * cashbackRate;
        const max = parseFloat(activeSetting.maximumCashback || "0");
        if (max > 0) cashbackGenerated = Math.min(cashbackGenerated, max);
      }
    }
    return {
      grossValue,
      cashbackUsed,
      netValue,
      cashbackGenerated,
      actualRate: activeSetting ? parseFloat(activeSetting.percentageRate) : 0,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !saleForm.date || !saleForm.grossValue) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
        variant: "destructive",
      });
      return;
    }
    const grossValue = parseFloat(saleForm.grossValue);
    if (grossValue <= 0) {
      toast({
        title: "Erro",
        description: "Valor da venda deve ser maior que zero",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: saleForm.clientId,
          date: saleForm.date,
          grossValue,
          notes: saleForm.notes,
          invoiceNumber: saleForm.invoiceNumber,
          userId: user?.id,
          useCashback,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao registrar venda");
      }
      const saleResult = await res.json();

      toast({ title: "Sucesso", description: "Venda registrada com sucesso!" });

      // Automação Umbler em paralelo — não bloqueia nem falha a venda
      umblerCashbackAutomation.mutate({
        client: {
          id: selectedClient.id,
          name: selectedClient.name,
          phone: selectedClient.phone,
          email: selectedClient.email ?? undefined,
        },
        newBalance: saleResult.clientCurrentBalance ?? 0,
        organizationId: ORGANIZATION_ID,
      });

      queryClient.invalidateQueries({ queryKey: ["sales-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-statistics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashback-balances"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/cashback-transactions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/cashback-reports/30-days"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });

      onOpenChange(false);
    } catch (err) {
      console.error("Erro ao registrar venda:", err);
      toast({
        title: "Erro",
        description:
          err instanceof Error ? err.message : "Erro ao registrar venda",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const preview = calculateValues();
  const canSubmit =
    !loading &&
    !!selectedClient &&
    !!saleForm.grossValue &&
    parseFloat(saleForm.grossValue) > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl bg-white/95 dark:bg-slate-900/95 p-0 backdrop-blur-2xl border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none" />

          {/* Header */}
          <div className="relative px-10 py-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30">
            <div className="flex items-center gap-4">
              <div className="bg-blue-500/10 rounded-2xl p-3 text-blue-600">
                <Receipt className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Registrar{" "}
                  <span className="text-blue-600 dark:text-blue-400">
                    Nova Venda
                  </span>
                </DialogTitle>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {preselectedClient
                    ? `Cliente: ${preselectedClient.name}`
                    : "Preencha os dados abaixo para computar o cashback."}
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-6 px-10 py-8 overflow-y-auto max-h-[80vh]"
          >
            {/* Seleção de Cliente (apenas quando não há pré-selecionado) */}
            {!preselectedClient && (
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Cliente *
                </Label>
                <div className="space-y-3 relative">
                  {!saleForm.clientId ? (
                    <>
                      <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <Input
                          placeholder="Buscar por nome, CPF ou telefone..."
                          value={clientSearchQuery}
                          onChange={(e) => setClientSearchQuery(e.target.value)}
                          className="pl-12 h-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/5 font-bold transition-all"
                        />
                      </div>
                      {clientSearchQuery.trim() && searchResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                          {searchResults.map((c) => (
                            <div
                              key={c.id}
                              className="p-4 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-slate-50 dark:border-slate-800 last:border-0 transition-colors"
                              onClick={() => handleClientSelect(c)}
                            >
                              <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">
                                {c.name}
                              </p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                {c.cpf} • {c.phone}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                      {clientSearchQuery.trim() &&
                        searchResults.length === 0 && (
                          <div className="border border-slate-100 dark:border-slate-800 rounded-2xl p-6 text-center bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex flex-col items-center space-y-4">
                              <Search className="h-8 w-8 text-slate-300" />
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                Nenhum cliente encontrado
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setIsClientModalOpen(true)}
                                className="h-10 px-6 rounded-xl border-blue-200 text-blue-600 font-black uppercase tracking-widest text-[10px] hover:bg-blue-50"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Cadastrar Novo
                              </Button>
                            </div>
                          </div>
                        )}
                      <Button
                        type="button"
                        variant="link"
                        onClick={() => setIsClientModalOpen(true)}
                        className="p-0 h-auto text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700"
                      >
                        + Novo Cadastro
                      </Button>
                    </>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-between p-5 bg-blue-500/5 border border-blue-500/10 rounded-2xl"
                    >
                      <div className="flex items-center gap-4">
                        <div className="bg-blue-500/10 p-2.5 rounded-xl">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                            Cliente Selecionado
                          </p>
                          <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm mt-1">
                            {selectedClient?.name}
                          </p>
                          {selectedClientBalance > 0 && (
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">
                              Saldo: {formatCurrency(selectedClientBalance)}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearClient}
                        className="h-9 w-9 p-0 rounded-full hover:bg-red-500/10 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* Quando cliente pré-selecionado, mostrar saldo se houver */}
            {preselectedClient && selectedClientBalance > 0 && (
              <div className="flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                <Percent className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                    Saldo de Cashback
                  </p>
                  <p className="font-black text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(selectedClientBalance)}
                  </p>
                </div>
              </div>
            )}

            {/* Data + Valor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label
                  htmlFor="date"
                  className="text-[10px] font-black uppercase tracking-widest text-slate-400"
                >
                  Data da Venda *
                </Label>
                <div className="relative group">
                  <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <Input
                    id="date"
                    type="date"
                    value={saleForm.date}
                    onChange={(e) =>
                      setSaleForm((p) => ({ ...p, date: e.target.value }))
                    }
                    className="pl-12 h-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/5 font-bold transition-all"
                    required
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label
                  htmlFor="invoiceNumber"
                  className="text-[10px] font-black uppercase tracking-widest text-slate-400"
                >
                  Número da Nota Fiscal
                </Label>
                <div className="relative group">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <Input
                    id="invoiceNumber"
                    type="text"
                    placeholder="Ex: 123456"
                    value={saleForm.invoiceNumber}
                    onChange={(e) =>
                      setSaleForm((p) => ({
                        ...p,
                        invoiceNumber: e.target.value,
                      }))
                    }
                    className="pl-12 h-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/5 font-bold transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Valor Bruto */}
            <div className="space-y-3">
              <Label
                htmlFor="grossValue"
                className="text-[10px] font-black uppercase tracking-widest text-slate-400"
              >
                Valor da Venda *
              </Label>
              <div className="relative group">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                <Input
                  id="grossValue"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={saleForm.grossValue}
                  onChange={(e) =>
                    setSaleForm((p) => ({ ...p, grossValue: e.target.value }))
                  }
                  className="pl-12 h-14 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-emerald-500/5 font-black text-xl transition-all"
                  required
                />
              </div>
            </div>

            {/* Toggle de uso de cashback */}
            {saleForm.clientId && selectedClientBalance > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-6 rounded-[2rem] border transition-all duration-300",
                  useCashback
                    ? "bg-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5"
                    : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-60",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "p-3 rounded-2xl transition-colors",
                        useCashback
                          ? "bg-emerald-500/20 text-emerald-600"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-400",
                      )}
                    >
                      <Percent className="h-6 w-6" />
                    </div>
                    <div>
                      <p
                        className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          useCashback ? "text-emerald-600" : "text-slate-400",
                        )}
                      >
                        Cashback Disponível
                      </p>
                      <p className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">
                        {formatCurrency(selectedClientBalance)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        useCashback ? "text-emerald-600" : "text-slate-400",
                      )}
                    >
                      {useCashback ? "Aplicado" : "Não usar"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setUseCashback(!useCashback)}
                      className={cn(
                        "relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none",
                        useCashback
                          ? "bg-emerald-500"
                          : "bg-slate-200 dark:bg-slate-800",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-6 w-6 transform rounded-full bg-white transition-transform",
                          useCashback ? "translate-x-7" : "translate-x-1",
                        )}
                      />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Status Umbler */}
            {selectedClient && (
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-blue-800 dark:text-blue-200">
                    <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Automação de Cashback via WhatsApp
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingUmblerContact || isLoadingChats ? (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Verificando status...</span>
                    </div>
                  ) : !umblerContact ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-blue-800 text-sm">
                        <Info className="h-4 w-4" />
                        <span className="font-medium">
                          Contato não sincronizado na Umbler
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          syncCustomer.mutate({
                            phoneNumber: selectedClient.phone,
                            name: selectedClient.name,
                            organizationId: ORGANIZATION_ID,
                          })
                        }
                        disabled={syncCustomer.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <RefreshCcw
                          className={cn(
                            "size-4 mr-2",
                            syncCustomer.isPending && "animate-spin",
                          )}
                        />
                        {syncCustomer.isPending
                          ? "Sincronizando..."
                          : "Sincronizar com Umbler"}
                      </Button>
                    </div>
                  ) : !contactChat || contactChat.items?.length === 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-amber-800 text-sm">
                        <Info className="h-4 w-4" />
                        <span className="font-medium">
                          Chat no WhatsApp ainda não iniciado
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={createChatMutation.isPending || !contactId}
                        onClick={() =>
                          createChatMutation.mutate(
                            { contactId: contactId! },
                            {
                              onSuccess: () => {
                                queryClient.invalidateQueries({
                                  queryKey: [
                                    "contactChat",
                                    selectedClient.phone,
                                  ],
                                });
                                queryClient.invalidateQueries({
                                  queryKey: [
                                    "umblerContactByPhone",
                                    selectedClient.phone,
                                  ],
                                });
                              },
                            },
                          )
                        }
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        {createChatMutation.isPending ? (
                          <Loader2 className="size-4 mr-2 animate-spin" />
                        ) : (
                          <MessageSquareMore className="size-4 mr-2" />
                        )}
                        {createChatMutation.isPending
                          ? "Criando chat..."
                          : "Criar chat no WhatsApp"}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                      <div className="h-2.5 w-2.5 bg-green-500 rounded-full animate-pulse" />
                      Bot de cashback será disparado automaticamente após a
                      venda.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Observações */}
            <div className="space-y-3">
              <Label
                htmlFor="notes"
                className="text-[10px] font-black uppercase tracking-widest text-slate-400"
              >
                Observações
              </Label>
              <Input
                id="notes"
                type="text"
                placeholder="Detalhes adicionais sobre a venda..."
                value={saleForm.notes}
                onChange={(e) =>
                  setSaleForm((p) => ({ ...p, notes: e.target.value }))
                }
                className="h-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/5 transition-all"
              />
            </div>

            {/* Resumo da venda */}
            {saleForm.clientId && saleForm.grossValue && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-50/50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-7 space-y-4 shadow-inner"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Subtotal
                  </span>
                  <span className="font-bold text-slate-600 dark:text-slate-400 tabular-nums">
                    {formatCurrency(preview.grossValue)}
                  </span>
                </div>
                {useCashback && preview.cashbackUsed > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                      Cashback Utilizado
                    </span>
                    <span className="font-black text-emerald-600 tabular-nums">
                      -{formatCurrency(preview.cashbackUsed)}
                    </span>
                  </div>
                )}
                <div className="h-px bg-slate-200 dark:bg-slate-800" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
                    Total Líquido
                  </span>
                  <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter tabular-nums">
                    {formatCurrency(preview.netValue)}
                  </span>
                </div>
                <div className="bg-blue-500/10 px-5 py-4 rounded-2xl flex items-center justify-between border border-blue-500/10">
                  <div className="flex items-center gap-3">
                    <ArrowRight className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                        Recompensa
                      </p>
                      <p className="text-[10px] font-bold text-blue-500/70 uppercase">
                        Taxa: {preview.actualRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <span className="text-xl font-black text-blue-600 tabular-nums">
                    +{formatCurrency(preview.cashbackGenerated)}
                  </span>
                </div>
              </motion.div>
            )}

            {/* Ações */}
            <div className="flex flex-col sm:flex-row gap-4 pb-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-400 hover:text-slate-600 transition-all"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="flex-1 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-blue-500/20 transition-all hover:-translate-y-1 active:scale-95"
              >
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-5 w-5 mr-3" />
                    Registrar Venda
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ClientFormModal
        open={isClientModalOpen}
        onOpenChange={(isOpen) => {
          setIsClientModalOpen(isOpen);
          if (!isOpen && clientSearchQuery.trim())
            searchClients(clientSearchQuery);
        }}
      />
    </>
  );
}
