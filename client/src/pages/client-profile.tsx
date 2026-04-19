import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence, motion } from "framer-motion";
import {
  User,
  MessageSquare,
  Wallet,
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  PartyPopper,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { type Client } from "@shared/schema";
import ClientInteractionsTab from "@/components/client-interactions-tab";
import { ClientCashbackTab } from "@/components/client-cashback-tab";
import { ClientInfoTab } from "@/components/clients/client-info-tab";
import { ClientFunnelsTab } from "@/components/clients/client-funnels-tab";
import { ClientWhatsAppTab } from "@/components/clients/client-whatsapp-tab";
import { ClientPurchasesTab } from "@/components/clients/client-purchases-tab";
import { ClientEventsTab } from "@/components/clients/client-events-tab";
import ClientFormModal from "@/components/client-form-modal";
import { useAuth } from "@/hooks/useAuth";

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    const currentTab = new URLSearchParams(window.location.search).get("tab");
    return currentTab || "compras";
  });
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    const nextTab =
      new URLSearchParams(window.location.search).get("tab") || "compras";
    setActiveTab(nextTab);
  }, [location, id]);

  useEffect(() => {
    const currentTab =
      new URLSearchParams(window.location.search).get("tab") || "compras";
    if (currentTab !== activeTab) {
      const url = new URL(window.location.href);
      if (activeTab === "compras") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", activeTab);
      }
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    }
  }, [activeTab]);

  const {
    data: client,
    isLoading,
    isError,
    refetch,
  } = useQuery<Client>({
    queryKey: ["/api/clients", id],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${id}`);
      if (!res.ok) throw new Error("Cliente não encontrado");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: systemSettings } = useQuery<Record<string, string>>({
    queryKey: ["/api/system-settings"],
  });

  const purchaseStatus = (() => {
    const lastPurchaseDate = (client as any)?.lastPurchaseDate as string | null | undefined;
    const days = parseInt(systemSettings?.purchase_status_days ?? "60", 10);
    if (!lastPurchaseDate) return "inativo";
    const last = new Date(lastPurchaseDate + "T00:00:00");
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);
    return last >= threshold ? "ativo" : "inativo";
  })();

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !client) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
            Cliente não encontrado
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            O cliente com o ID informado não existe ou foi removido.
          </p>
          <Button variant="outline" onClick={() => navigate("/clientes")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Clientes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className=" pb-10">
      {/* Header */}
      <div className="border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-5">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/clientes")}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Clientes
          </Button>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-xl shadow-sm border border-blue-200/50 dark:border-blue-800/50">
              <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-slate-100">
                  {client.name}
                </h1>
                {purchaseStatus === "inativo" && (
                  <div className="relative inline-flex items-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                    <Badge className="relative inline-flex items-center gap-1 bg-red-600 hover:bg-red-600 text-white border-0 text-xs font-bold uppercase tracking-wider px-2.5 py-1 shadow-lg shadow-red-500/30">
                      <AlertTriangle className="h-3 w-3" />
                      Cliente Inativo
                    </Badge>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Informações completas, funis e interações
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs + Content */}
      <div className="px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0 sm:pb-0 scrollbar-hide">
            <TabsList className="flex w-max sm:w-full bg-white dark:bg-slate-900 shadow-sm border border-gray-200 dark:border-slate-800 rounded-xl p-1.5 mb-8">
              <TabsTrigger
                value="info"
                className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all dark:text-slate-400 dark:data-[state=active]:text-slate-50 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-blue-500/20 dark:data-[state=active]:bg-blue-600"
              >
                <User className="h-4 w-4" />
                Informações
              </TabsTrigger>
              <TabsTrigger
                value="whatsapp"
                className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all dark:text-slate-400 dark:data-[state=active]:text-slate-50 data-[state=active]:bg-green-50 data-[state=active]:text-green-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-green-500/20 dark:data-[state=active]:bg-green-600"
              >
                <FaWhatsapp className="h-4 w-4" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger
                value="negocio"
                className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all dark:text-slate-400 dark:data-[state=active]:text-slate-50 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-indigo-500/20 dark:data-[state=active]:bg-indigo-600"
              >
                <Wallet className="h-4 w-4" />
                Funis
              </TabsTrigger>
              <TabsTrigger
                value="interactions"
                className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all dark:text-slate-400 dark:data-[state=active]:text-slate-50 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-purple-500/20 dark:data-[state=active]:bg-purple-600"
              >
                <MessageSquare className="h-4 w-4" />
                Interações
              </TabsTrigger>
              <TabsTrigger
                value="compras"
                className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all dark:text-slate-400 dark:data-[state=active]:text-slate-50 data-[state=active]:bg-cyan-50 data-[state=active]:text-cyan-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-cyan-500/20 dark:data-[state=active]:bg-cyan-600"
              >
                <Wallet className="h-4 w-4" />
                Compras
              </TabsTrigger>
              <TabsTrigger
                value="eventos"
                className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all dark:text-slate-400 dark:data-[state=active]:text-slate-50 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-purple-500/20 dark:data-[state=active]:bg-purple-600"
              >
                <PartyPopper className="h-4 w-4" />
                Eventos
              </TabsTrigger>
              <TabsTrigger
                value="cashback"
                className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all dark:text-slate-400 dark:data-[state=active]:text-slate-50 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-amber-500/20 dark:data-[state=active]:bg-amber-600"
              >
                <Wallet className="h-4 w-4" />
                Cashback
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="relative min-h-[400px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                {activeTab === "info" && (
                  <ClientInfoTab
                    client={client}
                    onEdit={() => setEditModalOpen(true)}
                    onClose={() => navigate("/clientes")}
                  />
                )}

                {activeTab === "whatsapp" && (
                  <ClientWhatsAppTab
                    clientId={client.id}
                    clientPhone={client.phone}
                    clientName={client.name}
                    clientEmail={client.email || undefined}
                    isOpen={activeTab === "whatsapp"}
                  />
                )}

                {activeTab === "negocio" && (
                  <ClientFunnelsTab
                    clientId={client.id}
                    clientName={client.name}
                    isOpen={activeTab === "negocio"}
                    onCreateDeal={() => {}}
                  />
                )}

                {activeTab === "interactions" && (
                  <ClientInteractionsTab client={client} />
                )}

                {activeTab === "compras" && (
                  <ClientPurchasesTab client={client} />
                )}

                {activeTab === "eventos" && (
                  <ClientEventsTab clientId={client.id} />
                )}

                {activeTab === "cashback" && (
                  <ClientCashbackTab client={client} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </Tabs>
      </div>

      {editModalOpen && (
        <ClientFormModal
          open={editModalOpen}
          onOpenChange={(open) => {
            setEditModalOpen(open);
            if (!open) refetch();
          }}
          client={client}
        />
      )}
    </div>
  );
}
