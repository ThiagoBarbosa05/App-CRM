import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Gift,
  MessageSquare,
  Plus,
  Clock,
  ShoppingBag,
  Users,
  ExternalLink,
  Trash2,
  PackageCheck,
  Trophy,
  X,
  UserPlus,
  Share2,
  Check,
  Star,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputMask } from "@/components/ui/input-mask";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn, formatPhone } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Referral {
  id: string;
  referrerId: string;
  referredName: string;
  referredPhone: string;
  referredClientId: string | null;
  messageSent: boolean;
  hasPurchased: boolean;
  purchasedAt: string | null;
  createdAt: string;
}

interface ReferralStats {
  totalReferred: number;
  totalPurchased: number;
  benefit1Granted: boolean;
  benefit2Granted: boolean;
  benefit1DeliveredAt: string | null;
  benefit2DeliveredAt: string | null;
}

interface ReferralWithStats {
  referrals: Referral[];
  stats: ReferralStats;
}

interface CatalogBenefit {
  id: string;
  name: string;
  description: string | null;
  type: string;
  isActive: boolean;
  createdAt: string;
}

const REFERRAL_THRESHOLD = 3;

interface IncentiveItem {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface IncentiveStatus {
  wasReferred: boolean;
  referrerId: string | null;
  referrerName: string | null;
  hasPurchased: boolean;
  delivery: {
    id: string;
    incentiveName: string;
    incentiveDescription: string | null;
    deliveredAt: string;
    deliveredByName: string;
    notes: string | null;
  } | null;
}

interface ClientReferralsTabProps {
  clientId: string;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
      <div
        className={cn(
          "h-1.5 rounded-full transition-all duration-500",
          pct >= 100 ? "bg-emerald-500" : "bg-primary",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function formatDeliveredAt(dateStr: string) {
  return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
}

export function ClientReferralsTab({ clientId }: ClientReferralsTabProps) {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deliveryDialogLevel, setDeliveryDialogLevel] = useState<1 | 2 | null>(null);
  const [selectedBenefitId, setSelectedBenefitId] = useState<string | null>(null);
  const [incentiveDialogOpen, setIncentiveDialogOpen] = useState(false);
  const [selectedIncentiveId, setSelectedIncentiveId] = useState<string | null>(null);
  const [incentiveNotes, setIncentiveNotes] = useState("");

  const { data, isLoading } = useQuery<ReferralWithStats>({
    queryKey: [`/api/clients/${clientId}/referrals`],
  });

  const { data: catalogData } = useQuery<CatalogBenefit[]>({
    queryKey: ["/api/referrals/benefits/catalog"],
  });

  const { data: incentiveStatus } = useQuery<IncentiveStatus>({
    queryKey: [`/api/clients/${clientId}/incentive-status`],
  });

  const { data: incentiveCatalog } = useQuery<IncentiveItem[]>({
    queryKey: ["/api/referrals/incentives/catalog"],
    enabled:
      incentiveStatus?.wasReferred === true && !incentiveStatus?.delivery,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/referrals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ referredName: name, referredPhone: phone }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Erro ao adicionar indicação");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/referrals`],
      });
      setName("");
      setPhone("");
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (referralId: string) => {
      const res = await fetch(`/api/referrals/${referralId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Erro ao remover indicação");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/referrals`],
      });
      setConfirmDeleteId(null);
      toast({ title: "Indicação removida" });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao remover",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deliverIncentiveMutation = useMutation({
    mutationFn: async ({
      incentiveCatalogId,
      notes,
    }: {
      incentiveCatalogId: string;
      notes?: string;
    }) => {
      const res = await fetch("/api/referrals/incentives/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          referredClientId: clientId,
          incentiveCatalogId,
          notes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Erro ao entregar brinde");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/incentive-status`],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/referrals/incentives/deliveries"],
      });
      toast({ title: "Brinde de incentivo entregue com sucesso!" });
      setIncentiveDialogOpen(false);
      setSelectedIncentiveId(null);
      setIncentiveNotes("");
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao entregar brinde",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deliverFromCatalogMutation = useMutation({
    mutationFn: async ({ benefitCatalogId }: { benefitCatalogId: string }) => {
      const res = await fetch("/api/referrals/benefits/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ referrerId: clientId, benefitCatalogId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Erro ao entregar benefício");
      }
    },
    onSuccess: (_data, { benefitCatalogId }) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/referrals`],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/referrals/benefits/deliveries"],
      });
      const benefitName =
        catalogData?.find((b) => b.id === benefitCatalogId)?.name ??
        "Benefício";
      toast({ title: `${benefitName} entregue com sucesso!` });
      setDeliveryDialogLevel(null);
      setSelectedBenefitId(null);
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao entregar benefício",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const sendMessage = async (referralId: string) => {
    setSendingId(referralId);
    try {
      const res = await fetch(`/api/referrals/${referralId}/send-message`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Erro ao enviar mensagem");
      }
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/referrals`],
      });
      toast({ title: "Mensagem enviada com sucesso" });
    } catch (error) {
      toast({
        title: "Erro ao enviar mensagem",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setSendingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }

  const stats = data?.stats;
  const referrals = data?.referrals ?? [];

  return (
    <div className="space-y-6">
      {/* ── Cards de Benefício ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Benefício 1 */}
        <div
          className={cn(
            "relative rounded-2xl p-5 space-y-3 border overflow-hidden transition-shadow duration-200 hover:shadow-md",
            stats?.benefit1DeliveredAt
              ? "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-900/10"
              : stats?.benefit1Granted
                ? "border-primary/30 bg-accent/40 dark:bg-accent/20"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50",
          )}
        >
          {/* Ícone decorativo de fundo */}
          <div className="absolute top-3 right-3 opacity-[0.06] pointer-events-none">
            <Users className="h-16 w-16" />
          </div>

          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "h-9 w-9 rounded-xl flex items-center justify-center shadow-inner",
                  stats?.benefit1Granted
                    ? "bg-accent"
                    : "bg-slate-100 dark:bg-slate-800",
                )}
              >
                <Users
                  className={cn(
                    "h-4 w-4",
                    stats?.benefit1Granted ? "text-primary" : "text-slate-400",
                  )}
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Benefício 1
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide">
                  Desconto especial
                </p>
              </div>
            </div>
            {stats?.benefit1DeliveredAt ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 gap-1 shrink-0">
                <PackageCheck className="h-3 w-3" />
                Entregue
              </Badge>
            ) : stats?.benefit1Granted ? (
              <Badge className="bg-primary/10 text-primary border-primary/20 gap-1 shrink-0">
                <Trophy className="h-3 w-3" />
                Conquistado!
              </Badge>
            ) : null}
          </div>

          <div className="space-y-2 relative">
            <ProgressBar value={stats?.totalReferred ?? 0} max={REFERRAL_THRESHOLD} />
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                  {stats?.totalReferred ?? 0}
                </span>
                <span className="text-slate-400"> / 3 indicações</span>
              </p>
              {stats?.benefit1DeliveredAt ? (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  em {formatDeliveredAt(stats.benefit1DeliveredAt)}
                </p>
              ) : stats?.benefit1Granted ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] gap-1 px-2 border-primary/30 text-primary hover:bg-accent"
                  onClick={() => {
                    setDeliveryDialogLevel(1);
                    setSelectedBenefitId(null);
                  }}
                >
                  <PackageCheck className="h-3 w-3" />
                  Entregar benefício
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Benefício 2 */}
        <div
          className={cn(
            "relative rounded-2xl p-5 space-y-3 border overflow-hidden transition-shadow duration-200 hover:shadow-md",
            stats?.benefit2DeliveredAt
              ? "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-900/10"
              : stats?.benefit2Granted
                ? "border-amber-200 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-900/10"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50",
          )}
        >
          <div className="absolute top-3 right-3 opacity-[0.06] pointer-events-none">
            <Gift className="h-16 w-16" />
          </div>

          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "h-9 w-9 rounded-xl flex items-center justify-center shadow-inner",
                  stats?.benefit2Granted
                    ? "bg-amber-100 dark:bg-amber-900/30"
                    : "bg-slate-100 dark:bg-slate-800",
                )}
              >
                <Gift
                  className={cn(
                    "h-4 w-4",
                    stats?.benefit2Granted
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-slate-400",
                  )}
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Benefício 2
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide">
                  Brinde exclusivo
                </p>
              </div>
            </div>
            {stats?.benefit2DeliveredAt ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 gap-1 shrink-0">
                <PackageCheck className="h-3 w-3" />
                Entregue
              </Badge>
            ) : stats?.benefit2Granted ? (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 gap-1 shrink-0">
                <Trophy className="h-3 w-3" />
                Conquistado!
              </Badge>
            ) : null}
          </div>

          <div className="space-y-2 relative">
            <ProgressBar value={stats?.totalPurchased ?? 0} max={REFERRAL_THRESHOLD} />
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                  {stats?.totalPurchased ?? 0}
                </span>
                <span className="text-slate-400"> / 3 compraram</span>
              </p>
              {stats?.benefit2DeliveredAt ? (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  em {formatDeliveredAt(stats.benefit2DeliveredAt)}
                </p>
              ) : stats?.benefit2Granted ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] gap-1 px-2 border-amber-300 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                  onClick={() => {
                    setDeliveryDialogLevel(2);
                    setSelectedBenefitId(null);
                  }}
                >
                  <PackageCheck className="h-3 w-3" />
                  Entregar benefício
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ── Lista de indicados ── */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Header da lista */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-accent flex items-center justify-center">
              <Share2 className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Indicados
            </h3>
            {referrals.length > 0 && (
              <span className="text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                {referrals.length}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant={showForm ? "ghost" : "outline"}
            className="gap-1.5 h-8 text-xs"
            onClick={() => {
              setShowForm(!showForm);
              setName("");
              setPhone("");
            }}
          >
            {showForm ? (
              <X className="h-3.5 w-3.5" />
            ) : (
              <UserPlus className="h-3.5 w-3.5" />
            )}
            {showForm ? "Cancelar" : "Adicionar"}
          </Button>
        </div>

        {/* Formulário inline */}
        {showForm && (
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Nome do indicado
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  WhatsApp
                </Label>
                <InputMask
                  mask="(99) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(21) 99999-9999"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              {addMutation.isError && (
                <p className="text-xs text-red-500">
                  {(addMutation.error as Error).message}
                </p>
              )}
              <Button
                size="sm"
                className="h-8 text-xs ml-auto gap-1.5"
                disabled={!name || !phone || addMutation.isPending}
                onClick={() => addMutation.mutate()}
              >
                <Plus className="h-3.5 w-3.5" />
                {addMutation.isPending ? "Salvando..." : "Salvar indicação"}
              </Button>
            </div>
          </div>
        )}

        {/* Linhas */}
        {referrals.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 px-6 text-center">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Users className="h-6 w-6 text-slate-400 dark:text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Nenhum indicado ainda
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Clique em "Adicionar" para registrar a primeira indicação
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {referrals.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
              >
                {/* Avatar */}
                <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center shrink-0 font-semibold text-primary text-sm select-none shadow-inner">
                  {r.referredName[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {r.referredName}
                    </p>
                    {r.hasPurchased ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 text-[10px] gap-1 h-4 px-1.5 shrink-0">
                        <ShoppingBag className="h-2.5 w-2.5" /> Comprou
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-slate-400 text-[10px] gap-1 h-4 px-1.5 shrink-0"
                      >
                        <Clock className="h-2.5 w-2.5" /> Pendente
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                      {formatPhone(r.referredPhone)}
                    </p>
                    {r.hasPurchased && r.purchasedAt && (
                      <>
                        <span className="text-slate-200 dark:text-slate-700">
                          ·
                        </span>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0">
                          Compra:{" "}
                          {format(new Date(r.purchasedAt), "dd/MM/yy", {
                            locale: ptBR,
                          })}
                        </p>
                      </>
                    )}
                    {r.messageSent && (
                      <>
                        <span className="text-slate-200 dark:text-slate-700">
                          ·
                        </span>
                        <p className="text-[10px] text-slate-400 flex items-center gap-0.5 shrink-0">
                          <MessageSquare className="h-2.5 w-2.5" /> Msg enviada
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1 shrink-0">
                  {r.referredClientId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-primary"
                      title="Ver perfil do indicado"
                      onClick={() =>
                        navigate(`/clientes/${r.referredClientId}`)
                      }
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    className={cn(
                      "h-7 w-7 p-0",
                      r.messageSent
                        ? "text-slate-300 dark:text-slate-600 hover:text-slate-500"
                        : "text-slate-400 hover:text-primary",
                    )}
                    title={
                      r.messageSent
                        ? "Reenviar mensagem"
                        : "Enviar mensagem de boas-vindas"
                    }
                    disabled={sendingId === r.id}
                    onClick={() => sendMessage(r.id)}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </Button>

                  {confirmDeleteId === r.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs px-2"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(r.id)}
                      >
                        {deleteMutation.isPending ? "..." : "Confirmar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-slate-400"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400"
                      title="Remover indicação"
                      onClick={() => setConfirmDeleteId(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Seção: Brinde de Incentivo (para quem FOI indicado) ── */}
      {incentiveStatus?.wasReferred && (
        <div
          className={cn(
            "rounded-2xl border p-5 space-y-3",
            incentiveStatus.delivery
              ? "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-900/10"
              : incentiveStatus.hasPurchased
                ? "border-primary/30 bg-accent/40 dark:bg-accent/20"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50",
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "h-8 w-8 rounded-xl flex items-center justify-center shrink-0",
                  incentiveStatus.delivery
                    ? "bg-emerald-100 dark:bg-emerald-900/30"
                    : "bg-accent",
                )}
              >
                <Star
                  className={cn(
                    "h-4 w-4",
                    incentiveStatus.delivery
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-primary",
                  )}
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Brinde de Incentivo
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Indicado por{" "}
                  <button
                    className="font-medium text-primary hover:underline"
                    onClick={() =>
                      navigate(`/clientes/${incentiveStatus.referrerId}`)
                    }
                  >
                    {incentiveStatus.referrerName}
                  </button>
                </p>
              </div>
            </div>

            {/* Status badge */}
            {incentiveStatus.delivery ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shrink-0">
                <Check className="h-3 w-3" /> Entregue
              </span>
            ) : incentiveStatus.hasPurchased ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary shrink-0">
                <Gift className="h-3 w-3" /> Elegível
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                <Clock className="h-3 w-3" /> Aguardando compra
              </span>
            )}
          </div>

          {/* Detalhes da entrega */}
          {incentiveStatus.delivery ? (
            <div className="bg-white/70 dark:bg-slate-900/50 rounded-xl p-3 space-y-1">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {incentiveStatus.delivery.incentiveName}
              </p>
              {incentiveStatus.delivery.incentiveDescription && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {incentiveStatus.delivery.incentiveDescription}
                </p>
              )}
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Entregue por{" "}
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {incentiveStatus.delivery.deliveredByName}
                </span>{" "}
                em{" "}
                {formatDeliveredAt(incentiveStatus.delivery.deliveredAt)}
              </p>
              {incentiveStatus.delivery.notes && (
                <p className="text-xs text-slate-400 italic">
                  Obs: {incentiveStatus.delivery.notes}
                </p>
              )}
            </div>
          ) : incentiveStatus.hasPurchased ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Este cliente realizou uma compra e está elegível para receber um
                brinde de incentivo.
              </p>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 shrink-0"
                onClick={() => setIncentiveDialogOpen(true)}
              >
                <Gift className="h-3.5 w-3.5" />
                Entregar Brinde
              </Button>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              O brinde de incentivo estará disponível após o cliente realizar a
              primeira compra.
            </p>
          )}
        </div>
      )}

      {/* ── Dialog de Seleção de Benefício ── */}
      <Dialog
        open={deliveryDialogLevel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeliveryDialogLevel(null);
            setSelectedBenefitId(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-primary" />
              Entregar Benefício{" "}
              {deliveryDialogLevel === 1 ? "1 (B1)" : "2 (B2)"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Selecione qual benefício será entregue ao cliente:
            </p>
            {(() => {
              const typeKey = deliveryDialogLevel === 1 ? "B1" : "B2";
              const options =
                catalogData?.filter(
                  (b) => b.type === typeKey && b.isActive,
                ) ?? [];

              if (!catalogData) {
                return (
                  <div className="text-center py-6 text-slate-400 text-sm">
                    Carregando benefícios...
                  </div>
                );
              }

              if (options.length === 0) {
                return (
                  <div className="text-center py-6 space-y-1">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Nenhum benefício {typeKey} cadastrado no catálogo.
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Peça ao administrador para configurar na aba Benefícios.
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {options.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBenefitId(b.id)}
                      className={cn(
                        "w-full text-left p-3 rounded-xl border transition-all",
                        selectedBenefitId === b.id
                          ? "border-primary bg-accent"
                          : "border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:bg-slate-50 dark:hover:bg-slate-800",
                      )}
                    >
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {b.name}
                      </p>
                      {b.description && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          {b.description}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDeliveryDialogLevel(null);
                setSelectedBenefitId(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={
                !selectedBenefitId || deliverFromCatalogMutation.isPending
              }
              onClick={() =>
                selectedBenefitId &&
                deliverFromCatalogMutation.mutate({
                  benefitCatalogId: selectedBenefitId,
                })
              }
            >
              <PackageCheck className="h-3.5 w-3.5 mr-1.5" />
              {deliverFromCatalogMutation.isPending
                ? "Entregando..."
                : "Confirmar entrega"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Entregar Brinde de Incentivo ── */}
      <Dialog
        open={incentiveDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIncentiveDialogOpen(false);
            setSelectedIncentiveId(null);
            setIncentiveNotes("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              Entregar Brinde de Incentivo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Selecione o brinde de incentivo para este cliente indicado:
            </p>

            {!incentiveCatalog ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                Carregando brindes...
              </div>
            ) : incentiveCatalog.length === 0 ? (
              <div className="text-center py-6 space-y-1">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Nenhum brinde cadastrado no catálogo.
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Peça ao administrador para configurar os brindes de incentivo.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {incentiveCatalog.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedIncentiveId(item.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all",
                      selectedIncentiveId === item.id
                        ? "border-primary bg-accent"
                        : "border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:bg-slate-50 dark:hover:bg-slate-800",
                    )}
                  >
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {item.name}
                    </p>
                    {item.description && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Observação (opcional)
              </Label>
              <Textarea
                value={incentiveNotes}
                onChange={(e) => setIncentiveNotes(e.target.value)}
                placeholder="Alguma observação sobre a entrega..."
                className="text-sm min-h-[60px] resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIncentiveDialogOpen(false);
                setSelectedIncentiveId(null);
                setIncentiveNotes("");
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={
                !selectedIncentiveId || deliverIncentiveMutation.isPending
              }
              onClick={() =>
                selectedIncentiveId &&
                deliverIncentiveMutation.mutate({
                  incentiveCatalogId: selectedIncentiveId,
                  notes: incentiveNotes || undefined,
                })
              }
            >
              <PackageCheck className="h-3.5 w-3.5 mr-1.5" />
              {deliverIncentiveMutation.isPending
                ? "Entregando..."
                : "Confirmar entrega"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
