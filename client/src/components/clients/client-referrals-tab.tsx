import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Gift,
  MessageSquare,
  Plus,
  Check,
  Clock,
  ShoppingBag,
  Users,
  ExternalLink,
  Trash2,
  PackageCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputMask } from "@/components/ui/input-mask";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

interface ClientReferralsTabProps {
  clientId: string;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
      <div
        className={cn(
          "h-2 rounded-full transition-all",
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

  const { data, isLoading } = useQuery<ReferralWithStats>({
    queryKey: [`/api/clients/${clientId}/referrals`],
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
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/referrals`] });
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
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/referrals`] });
      setConfirmDeleteId(null);
      toast({ title: "Indicação removida" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });

  const deliverBenefitMutation = useMutation({
    mutationFn: async (level: 1 | 2) => {
      const res = await fetch(
        `/api/clients/${clientId}/referrals/benefits/${level}/deliver`,
        { method: "POST", credentials: "include" },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Erro ao marcar benefício");
      }
    },
    onSuccess: (_data, level) => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/referrals`] });
      toast({ title: `Benefício ${level} marcado como entregue` });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/referrals`] });
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
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  const stats = data?.stats;
  const referrals = data?.referrals ?? [];

  return (
    <div className="space-y-6">
      {/* Benefícios */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Benefício 1 */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Benefício 1
              </span>
            </div>
            {stats?.benefit1DeliveredAt ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400">
                <PackageCheck className="h-3 w-3 mr-1" />
                Entregue em {formatDeliveredAt(stats.benefit1DeliveredAt)}
              </Badge>
            ) : stats?.benefit1Granted ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400">
                <Check className="h-3 w-3 mr-1" /> Conquistado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-500 text-xs">
                Pendente
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Indique 3 amigos e ganhe um desconto especial
          </p>
          <ProgressBar value={stats?.totalReferred ?? 0} max={3} />
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              {stats?.totalReferred ?? 0} / 3 indicados
            </p>
            {stats?.benefit1Granted && !stats.benefit1DeliveredAt && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs gap-1"
                disabled={deliverBenefitMutation.isPending}
                onClick={() => deliverBenefitMutation.mutate(1)}
              >
                <PackageCheck className="h-3 w-3" />
                Marcar entregue
              </Button>
            )}
          </div>
        </div>

        {/* Benefício 2 */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                <Gift className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Benefício 2
              </span>
            </div>
            {stats?.benefit2DeliveredAt ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400">
                <PackageCheck className="h-3 w-3 mr-1" />
                Entregue em {formatDeliveredAt(stats.benefit2DeliveredAt)}
              </Badge>
            ) : stats?.benefit2Granted ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400">
                <Check className="h-3 w-3 mr-1" /> Conquistado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-500 text-xs">
                Pendente
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            3 indicados realizando uma compra — brinde especial
          </p>
          <ProgressBar value={stats?.totalPurchased ?? 0} max={3} />
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              {stats?.totalPurchased ?? 0} / 3 compraram
            </p>
            {stats?.benefit2Granted && !stats.benefit2DeliveredAt && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs gap-1"
                disabled={deliverBenefitMutation.isPending}
                onClick={() => deliverBenefitMutation.mutate(2)}
              >
                <PackageCheck className="h-3 w-3" />
                Marcar entregue
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Lista de indicados */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Indicados
          </h3>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8 text-xs"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </Button>
        </div>

        {showForm && (
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do indicado</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">WhatsApp</Label>
                <InputMask
                  mask="(99) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(21) 99999-9999"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => {
                  setShowForm(false);
                  setName("");
                  setPhone("");
                }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={!name || !phone || addMutation.isPending}
                onClick={() => addMutation.mutate()}
              >
                {addMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
            {addMutation.isError && (
              <p className="text-xs text-red-500">{(addMutation.error as Error).message}</p>
            )}
          </div>
        )}

        {referrals.length === 0 ? (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">
            Nenhum indicado ainda. Clique em "Adicionar" para começar.
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 font-semibold text-slate-600 dark:text-slate-300 text-sm">
                    {r.referredName[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {r.referredName}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                      {formatPhone(r.referredPhone)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {r.hasPurchased ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 text-xs gap-1">
                      <ShoppingBag className="h-3 w-3" /> Comprou
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-400 text-xs gap-1">
                      <Clock className="h-3 w-3" /> Ainda não comprou
                    </Badge>
                  )}

                  {r.referredClientId && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => navigate(`/clientes/${r.referredClientId}`)}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ver perfil
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant={r.messageSent ? "outline" : "default"}
                    className={cn(
                      "h-7 text-xs gap-1",
                      r.messageSent && "text-slate-400",
                    )}
                    disabled={sendingId === r.id}
                    onClick={() => sendMessage(r.id)}
                  >
                    <MessageSquare className="h-3 w-3" />
                    {sendingId === r.id
                      ? "Enviando..."
                      : r.messageSent
                        ? "Reenviar"
                        : "Enviar msg"}
                  </Button>

                  {confirmDeleteId === r.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(r.id)}
                      >
                        {deleteMutation.isPending ? "..." : "Confirmar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
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
    </div>
  );
}
