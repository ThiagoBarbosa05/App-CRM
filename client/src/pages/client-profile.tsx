import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AppTabs,
  UnderlineTabsList,
  UnderlineTabsTrigger,
} from "@/components/app-tabs";
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
  Sparkles,
  Phone,
  Edit,
  GitBranch,
  ShoppingBag,
  Users,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { type Client } from "@shared/schema";
import { PageHeader } from "@/components/page-header";
import ClientInteractionsTab from "@/components/client-interactions-tab";
import { ClientCashbackTab } from "@/components/client-cashback-tab";
import { ClientInfoTab } from "@/components/clients/client-info-tab";
import { ClientFunnelsTab } from "@/components/clients/client-funnels-tab";
import { ClientWhatsAppTab } from "@/components/clients/client-whatsapp-tab";
import { ClientPurchasesTab } from "@/components/clients/client-purchases-tab";
import { ClientEventsTab } from "@/components/clients/client-events-tab";
import { ClientWineProfileTab } from "@/components/clients/client-wine-profile-tab";
import { ClientTelemarketingTab } from "@/components/clients/client-telemarketing-tab";
import { ClientReferralsTab } from "@/components/clients/client-referrals-tab";
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
  const { toast } = useToast();

  const syncBlingMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${id}/sync-bling`),
    onSuccess: () => {
      toast({ title: "Sincronizado com sucesso", description: "Cliente enviado para o Bling." });
    },
    onError: () => {
      toast({ title: "Erro ao sincronizar", description: "Verifique a conexão com o Bling.", variant: "destructive" });
    },
  });

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
    const lastPurchaseDate = (client as any)?.lastPurchaseDate as
      | string
      | null
      | undefined;
    const days = parseInt(systemSettings?.purchase_status_days ?? "60", 10);
    if (!lastPurchaseDate) return "inativo";
    const last = new Date(lastPurchaseDate + "T00:00:00");
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);
    return last >= threshold ? "ativo" : "inativo";
  })();

  const clientInitials = client
    ? client.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "";

  const whatsappUrl = client?.phone
    ? `https://wa.me/55${client.phone.replace(/\D/g, "")}`
    : null;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 pb-10">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm px-5 py-5 overflow-hidden">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-7 w-20 rounded-lg" />
              <Skeleton className="h-12 w-12 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-44 rounded" />
                <Skeleton className="h-3.5 w-32 rounded" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28 rounded-lg hidden md:block" />
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5">
          <Skeleton className="h-10 w-full rounded-lg mb-6" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Erro ───────────────────────────────────────────────────────────────────
  if (isError || !client) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center px-6">
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
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10">
      {/* ── Cabeçalho ── */}
      <PageHeader>
        {/* Esquerda: breadcrumb + identidade */}
        <PageHeader.Info className="flex-col sm:flex-row items-start sm:items-center">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/clientes")}
              className="shrink-0 h-9 w-9 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            {/* Avatar com iniciais */}
            <div className="shrink-0 h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-base shadow-sm select-none">
              {clientInitials}
            </div>
          </div>

          <PageHeader.Text>
            <div className="flex items-center gap-2.5 flex-wrap">
              <PageHeader.Title>{client.name}</PageHeader.Title>
              {purchaseStatus === "inativo" && (
                <Badge
                  variant="outline"
                  className="inline-flex items-center gap-1 border-red-200 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/60 text-[10px] font-semibold uppercase tracking-wide shrink-0"
                >
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Inativo
                </Badge>
              )}
            </div>
            <PageHeader.Description>
              Informações completas, funis e interações
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>

        {/* Direita: ações rápidas */}
        <PageHeader.Actions className="flex-wrap sm:flex-nowrap justify-end mt-4 md:mt-0">
          {whatsappUrl && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 dark:border-emerald-800/60 dark:text-emerald-400 dark:hover:bg-emerald-900/20 font-medium w-full sm:w-auto"
              asChild
            >
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <FaWhatsapp className="h-4 w-4" />
                WhatsApp
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncBlingMutation.mutate()}
            disabled={syncBlingMutation.isPending}
            className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 dark:border-blue-800/60 dark:text-blue-400 dark:hover:bg-blue-900/20 font-medium w-full sm:w-auto"
          >
            {syncBlingMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sincronizar Bling
          </Button>
          <Button
            size="sm"
            onClick={() => setEditModalOpen(true)}
            className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm w-full sm:w-auto"
          >
            <Edit className="h-4 w-4" />
            Editar
          </Button>
        </PageHeader.Actions>
      </PageHeader>

      {/* ── Tabs + Conteúdo ── */}
      <div className="space-y-0">
        <AppTabs value={activeTab} onValueChange={setActiveTab}>
          {/* Tab bar: scrollável no mobile */}
          <div className="overflow-x-auto scrollbar-hide">
            <UnderlineTabsList className="w-max sm:w-full">
              <UnderlineTabsTrigger value="info" color="blue">
                <User className="h-3.5 w-3.5" />
                Informações
              </UnderlineTabsTrigger>

              <UnderlineTabsTrigger value="whatsapp" color="green">
                <FaWhatsapp className="h-3.5 w-3.5" />
                WhatsApp
              </UnderlineTabsTrigger>

              <UnderlineTabsTrigger value="negocio" color="indigo">
                <GitBranch className="h-3.5 w-3.5" />
                Funis
              </UnderlineTabsTrigger>

              <UnderlineTabsTrigger value="interactions" color="purple">
                <MessageSquare className="h-3.5 w-3.5" />
                Interações
              </UnderlineTabsTrigger>

              <UnderlineTabsTrigger value="compras" color="teal">
                <ShoppingBag className="h-3.5 w-3.5" />
                Compras
              </UnderlineTabsTrigger>

              <UnderlineTabsTrigger value="eventos" color="orange">
                <PartyPopper className="h-3.5 w-3.5" />
                Eventos
              </UnderlineTabsTrigger>

              <UnderlineTabsTrigger value="cashback" color="amber">
                <Wallet className="h-3.5 w-3.5" />
                Cashback
              </UnderlineTabsTrigger>

              <UnderlineTabsTrigger value="gosto" color="purple">
                <Sparkles className="h-3.5 w-3.5" />
                Perfil de Gosto
              </UnderlineTabsTrigger>

              <UnderlineTabsTrigger value="telemarketing" color="red">
                <Phone className="h-3.5 w-3.5" />
                Telemarketing
              </UnderlineTabsTrigger>

              <UnderlineTabsTrigger value="indicacoes" color="indigo">
                <Users className="h-3.5 w-3.5" />
                Indicações
              </UnderlineTabsTrigger>
            </UnderlineTabsList>
          </div>

          <div className="min-h-[400px] pt-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
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

                {activeTab === "gosto" && (
                  <ClientWineProfileTab client={client as any} />
                )}

                {activeTab === "telemarketing" && (
                  <ClientTelemarketingTab clientId={client.id} />
                )}

                {activeTab === "indicacoes" && (
                  <ClientReferralsTab clientId={client.id} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </AppTabs>
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
