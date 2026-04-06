import { ArrowRight, GitBranch, Layers3, PlusCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

interface ClientFunnelsTabProps {
  clientId: string;
  clientName: string;
  isOpen: boolean;
  onCreateDeal: (funnelId: string) => void;
}

interface FunnelSummary {
  id: string;
  name: string;
  description?: string | null;
}

export function ClientFunnelsTab({
  clientId,
  clientName,
  isOpen,
  onCreateDeal,
}: ClientFunnelsTabProps) {
  const { data: clientFunnels = [] } = useQuery<FunnelSummary[]>({
    queryKey: [`/api/clients/${clientId}/funnels`],
    enabled: !!clientId && isOpen,
  });

  const { data: allFunnels = [] } = useQuery<FunnelSummary[]>({
    queryKey: ["/api/funnels"],
    enabled: !!clientId && isOpen,
  });

  const hasActiveFunnels = Array.isArray(clientFunnels) && clientFunnels.length > 0;
  const hasAvailableFunnels = Array.isArray(allFunnels) && allFunnels.length > 0;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border border-slate-200/80 bg-white shadow-[0_20px_60px_-38px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-950">
        <CardHeader className="relative overflow-hidden border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_28%),linear-gradient(135deg,#f7f8ff_0%,#ffffff_46%,#f4f6ff_100%)] px-6 py-6 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.24),transparent_26%),linear-gradient(135deg,rgba(15,23,42,0.98)_0%,rgba(15,23,42,0.92)_60%,rgba(30,33,58,0.96)_100%)]">
          <div className="absolute -right-10 top-0 h-36 w-36 rounded-full bg-indigo-200/50 blur-3xl dark:bg-indigo-500/20" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-white/70 bg-white/80 shadow-[0_18px_40px_-26px_rgba(79,70,229,0.45)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/75">
                <GitBranch className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-indigo-700 shadow-sm hover:bg-indigo-50 dark:border-indigo-800/70 dark:bg-indigo-500/10 dark:text-indigo-300">
                    Gestão de Funis
                  </Badge>
                  <Badge className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 shadow-sm hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {clientName}
                  </Badge>
                </div>
                <CardTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Negócios e oportunidades
                </CardTitle>
                <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400">
                  Visualize onde este cliente já está ativo e escolha rapidamente um funil para iniciar uma nova negociação.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
              <SummaryTile
                label="Negócios ativos"
                value={String(clientFunnels.length)}
                tone={hasActiveFunnels ? "indigo" : "slate"}
              />
              <SummaryTile
                label="Funis disponíveis"
                value={String(allFunnels.length)}
                tone={hasAvailableFunnels ? "emerald" : "slate"}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {hasActiveFunnels && (
        <Card className="overflow-hidden border border-slate-200/80 bg-white shadow-[0_18px_50px_-40px_rgba(15,23,42,0.32)] dark:border-slate-800 dark:bg-slate-950">
          <CardHeader className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(238,242,255,0.9),rgba(255,255,255,1))] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(49,46,129,0.2),rgba(15,23,42,0.92))]">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-indigo-100 p-2.5 dark:bg-indigo-900/40">
                <Layers3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <CardTitle className="text-lg font-black text-slate-900 dark:text-white">
                  Negócios Ativos
                </CardTitle>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Funis onde este cliente já possui oportunidades em andamento.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              {clientFunnels.map((funnel) => (
                <FunnelActionCard
                  key={`active-funnel-${funnel.id}`}
                  funnel={funnel}
                  variant="active"
                  ctaLabel="Adicionar ao funil"
                  onClick={() => onCreateDeal(funnel.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border border-slate-200/80 bg-white shadow-[0_18px_50px_-40px_rgba(15,23,42,0.32)] dark:border-slate-800 dark:bg-slate-950">
        <CardHeader className="border-b border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-100 p-2.5 dark:bg-emerald-900/40">
              <PlusCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-black text-slate-900 dark:text-white">
                Novo Negócio
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Escolha um funil para abrir uma nova negociação com{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {clientName}
                </span>
                .
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {hasAvailableFunnels ? (
            <div className="grid gap-4 md:grid-cols-2">
              {allFunnels.map((funnel) => (
                <FunnelActionCard
                  key={`all-funnel-${funnel.id}`}
                  funnel={funnel}
                  variant="available"
                  ctaLabel="Criar negócio"
                  onClick={() => onCreateDeal(funnel.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/45">
              <div className="mb-4 rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-800">
                <GitBranch className="h-6 w-6 text-slate-400 dark:text-slate-500" />
              </div>
              <h4 className="text-lg font-black text-slate-900 dark:text-slate-100">
                Nenhum funil disponível
              </h4>
              <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                Configure funis de vendas no sistema para poder abrir novos negócios para este cliente.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "indigo" | "emerald" | "slate";
}) {
  const toneClass = {
    indigo:
      "border-indigo-200 bg-indigo-50/90 text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-500/10 dark:text-indigo-300",
    emerald:
      "border-emerald-200 bg-emerald-50/90 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-500/10 dark:text-emerald-300",
    slate:
      "border-slate-200 bg-white/85 text-slate-700 dark:border-slate-700 dark:bg-slate-900/75 dark:text-slate-300",
  }[tone];

  return (
    <div
      className={cn(
        "rounded-[20px] border px-4 py-3 shadow-sm backdrop-blur-sm",
        toneClass,
      )}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">
        {label}
      </p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function FunnelActionCard({
  funnel,
  variant,
  ctaLabel,
  onClick,
}: {
  funnel: FunnelSummary;
  variant: "active" | "available";
  ctaLabel: string;
  onClick: () => void;
}) {
  const styles = {
    active: {
      wrapper:
        "border-indigo-200/80 bg-[linear-gradient(135deg,rgba(238,242,255,0.95),rgba(255,255,255,1))] shadow-[0_18px_38px_-34px_rgba(79,70,229,0.32)] dark:border-indigo-800/50 dark:bg-[linear-gradient(135deg,rgba(49,46,129,0.18),rgba(15,23,42,0.92))]",
      iconWrap: "bg-indigo-100 dark:bg-indigo-900/35",
      icon: "text-indigo-600 dark:text-indigo-400",
      button:
        "bg-indigo-600 text-white hover:bg-indigo-700 shadow-[0_14px_28px_-18px_rgba(79,70,229,0.6)]",
      badge:
        "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-500/10 dark:text-indigo-300",
    },
    available: {
      wrapper:
        "border-slate-200/80 bg-white shadow-[0_18px_35px_-35px_rgba(15,23,42,0.38)] dark:border-slate-800 dark:bg-slate-900/75",
      iconWrap: "bg-emerald-100 dark:bg-emerald-900/35",
      icon: "text-emerald-600 dark:text-emerald-400",
      button:
        "bg-gradient-to-r from-emerald-600 to-green-500 text-white hover:from-emerald-700 hover:to-green-600 shadow-[0_14px_28px_-18px_rgba(22,163,74,0.55)]",
      badge:
        "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
    },
  }[variant];

  return (
    <div
      className={cn(
        "rounded-[24px] border p-5 transition-all duration-300 hover:-translate-y-0.5",
        styles.wrapper,
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
            styles.iconWrap,
          )}
        >
          <GitBranch className={cn("h-5 w-5", styles.icon)} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                styles.badge,
              )}
            >
              {variant === "active" ? "Em andamento" : "Disponível"}
            </Badge>
          </div>

          <p className="text-base font-black text-slate-900 dark:text-white">
            {funnel.name}
          </p>

          <p className="mt-2 min-h-[40px] text-sm text-slate-500 dark:text-slate-400">
            {funnel.description || "Funil pronto para receber um novo negócio deste cliente."}
          </p>

          <Button
            onClick={onClick}
            className={cn(
              "mt-5 h-11 rounded-xl px-4 text-sm font-bold transition-all hover:translate-y-[-1px]",
              styles.button,
            )}
          >
            {variant === "active" ? (
              <Sparkles className="mr-2 h-4 w-4" />
            ) : (
              <PlusCircle className="mr-2 h-4 w-4" />
            )}
            {ctaLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
