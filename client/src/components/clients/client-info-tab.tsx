import { useState } from "react";
import {
  User,
  Phone,
  Mail,
  CreditCard,
  Calendar,
  MapPin,
  Building,
  Tag,
  FileText,
  Edit,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ShoppingCart,
  Users,
  UserCheck,
  UserPlus,
  TrendingUp,
  Loader2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

const RFM_LABELS: Record<string, string> = {
  campiao: "Campeão",
  fiel: "Fiel",
  promissor: "Promissor",
  em_risco: "Em Risco",
  perdido: "Perdido",
  novo: "Novo",
  hibernando: "Hibernando",
  sem_compra: "Sem Compra",
};

const RFM_COLORS: Record<string, string> = {
  campiao: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700",
  fiel: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700",
  promissor: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  em_risco: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700",
  perdido: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
  novo: "bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700",
  hibernando: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600",
  sem_compra: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600",
};

const RFM_DESCRIPTIONS: Record<string, string> = {
  campiao: "Compra com frequência, recentemente e em alto valor",
  fiel: "Cliente regular com bom histórico de compras",
  promissor: "Comprou recentemente — tem potencial de crescimento",
  em_risco: "Costumava comprar bem, mas está há muito tempo sem comprar",
  perdido: "Fez compras no passado mas sumiu há muito tempo",
  novo: "Realizou apenas uma compra até agora",
  hibernando: "Compras esparsas e sem padrão definido",
  sem_compra: "Ainda não realizou nenhuma compra",
};
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ReactNode } from "react";
import { type Client } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

interface ClientInfoTabProps {
  client: Client;
  onEdit?: (client: Client) => void;
  onClose: () => void;
}

export function ClientInfoTab({ client, onEdit, onClose }: ClientInfoTabProps) {
  const [cpfVerify, setCpfVerify] = useState<{
    status: "idle" | "loading" | "success" | "error";
    nome?: string;
    dataNascimento?: string;
    message?: string;
  }>({ status: "idle" });

  async function handleVerifyCpf() {
    setCpfVerify({ status: "loading" });
    try {
      const res = await fetch(`/api/clients/${client.id}/verify-cpf`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) {
        setCpfVerify({ status: "error", message: json.message ?? "Erro na consulta" });
        return;
      }
      setCpfVerify({
        status: "success",
        nome: json?.nome ?? json?.data?.nome ?? "—",
        dataNascimento: json?.dataNascimento ?? json?.data?.dataNascimento ?? json?.data?.data_nascimento ?? "—",
      });
    } catch {
      setCpfVerify({ status: "error", message: "Erro ao conectar com a Assertiva" });
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date =
        typeof dateString === "string"
          ? parseISO(dateString)
          : new Date(dateString);
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const formatBirthday = (dateString: string) => {
    try {
      return format(parseISO(dateString), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "Não informado";
    }
  };

  const formatPhone = (phone: string | null | undefined) => {
    if (!phone) return "—";
    let digits = phone.replace(/\D/g, "");
    // Remove código do país Brasil (55) quando presente
    if (digits.length === 13 && digits.startsWith("55")) digits = digits.slice(2);
    if (digits.length === 12 && digits.startsWith("55")) digits = digits.slice(2);
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const formatCPF = (cpf: string) => {
    if (!cpf) return "Não informado";
    const cleanCPF = cpf.replace(/\D/g, "");
    if (cleanCPF.length === 11) {
      return `${cleanCPF.slice(0, 3)}.${cleanCPF.slice(3, 6)}.${cleanCPF.slice(
        6,
        9,
      )}-${cleanCPF.slice(9)}`;
    }
    return cpf;
  };

  const { data: systemSettings } = useQuery<Record<string, string>>({
    queryKey: ["/api/system-settings"],
  });

  const { data: referrer } = useQuery<{ id: string; name: string } | null>({
    queryKey: [`/api/clients/${client.id}/referrer`],
  });

  const { data: referralsData } = useQuery<{ referrals: { id: string }[]; stats: { totalReferred: number } }>({
    queryKey: [`/api/clients/${client.id}/referrals`],
  });
  const purchaseStatusDays = parseInt(systemSettings?.purchase_status_days ?? "60", 10);
  const lastPurchaseDate = (client as any).lastPurchaseDate as string | null | undefined;

  const purchaseStatus = (() => {
    if (!lastPurchaseDate) return "inativo";
    const last = new Date(lastPurchaseDate + "T00:00:00");
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - purchaseStatusDays);
    return last >= threshold ? "ativo" : "inativo";
  })();

  const clientInitial = client.name.trim().charAt(0).toUpperCase();
  const hasCommercialInfo = Boolean(
    client.categoria || client.origem || (client.markers && client.markers.length > 0),
  );

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border border-slate-200/80 bg-white shadow-[0_20px_60px_-38px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-950">
        <CardHeader className="relative overflow-hidden border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_28%),linear-gradient(135deg,#f8fbff_0%,#ffffff_46%,#f3f7ff_100%)] px-6 py-6 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_26%),linear-gradient(135deg,rgba(15,23,42,0.98)_0%,rgba(15,23,42,0.92)_60%,rgba(30,41,59,0.96)_100%)]">
          <div className="absolute -right-10 top-0 h-36 w-36 rounded-full bg-blue-200/40 blur-3xl dark:bg-blue-500/20" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-white/70 bg-white/80 text-xl font-black text-blue-700 shadow-[0_18px_40px_-26px_rgba(37,99,235,0.45)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/75 dark:text-blue-300">
                {clientInitial}
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-blue-700 shadow-sm hover:bg-blue-50 dark:border-blue-800/70 dark:bg-blue-500/10 dark:text-blue-300">
                    Perfil do Cliente
                  </Badge>
                  {client.categoria && (
                    <Badge className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-violet-700 shadow-sm hover:bg-violet-50 dark:border-violet-800/70 dark:bg-violet-500/10 dark:text-violet-300">
                      {client.categoria}
                    </Badge>
                  )}
                  {(client as any).rfmSegment && (
                    <Badge className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] shadow-sm inline-flex items-center gap-1 ${RFM_COLORS[(client as any).rfmSegment] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>
                      <TrendingUp className="h-2.5 w-2.5" />
                      {RFM_LABELS[(client as any).rfmSegment] ?? (client as any).rfmSegment}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {client.name}
                </CardTitle>
                <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400">
                  Visual completo com dados pessoais, contexto comercial e identificadores do cadastro.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900/60">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
                  <UserCheck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    Indicado por
                  </p>
                  {referrer ? (
                    <a
                      href={`/clientes/${referrer.id}`}
                      className="text-sm font-bold text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {referrer.name}
                    </a>
                  ) : (
                    <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">
                      Nenhum
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900/60">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                  <UserPlus className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    Indicações feitas
                  </p>
                  {(referralsData?.stats.totalReferred ?? 0) > 0 ? (
                    <a
                      href={`/clientes/${client.id}?tab=referrals`}
                      className="text-sm font-bold text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      {referralsData!.stats.totalReferred}{" "}
                      {referralsData!.stats.totalReferred === 1 ? "cliente" : "clientes"}
                    </a>
                  ) : (
                    <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">
                      Nenhuma ainda
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={() => {
                if (onEdit) {
                  onEdit(client);
                }
              }}
              className="h-11 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 px-5 text-sm font-bold text-white shadow-[0_16px_30px_-18px_rgba(225,29,72,0.6)] transition-all hover:translate-y-[-1px] hover:from-rose-700 hover:to-red-600"
              size="sm"
            >
              <Edit className="mr-2 h-4 w-4" />
              Editar cadastro
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <InfoTile
              icon={Phone}
              accent="blue"
              label="Telefone"
              value={formatPhone(client.phone)}
              href={`tel:${client.phone}`}
              interactive
            />
            {/* CPF / CNPJ tile com botão Assertiva */}
            <div className="group rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_35px_-34px_rgba(15,23,42,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-34px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900/75">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 shadow-inner dark:bg-slate-800">
                  <CreditCard className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {client.documentType === "cnpj" ? "CNPJ" : "CPF"}
                    </p>
                    {client.documentType !== "cnpj" && client.cpf && (
                      <button
                        type="button"
                        onClick={handleVerifyCpf}
                        disabled={cpfVerify.status === "loading"}
                        title="Consultar na Assertiva"
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-amber-700 dark:hover:bg-amber-900/20 dark:hover:text-amber-400"
                      >
                        {cpfVerify.status === "loading" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-3 w-3" />
                        )}
                        Assertiva
                      </button>
                    )}
                  </div>
                  <p className="mt-2 break-words text-base font-black text-slate-900 dark:text-slate-100">
                    {formatCPF(client.cpf || "")}
                  </p>
                  {cpfVerify.status === "success" && (
                    <div className="mt-2 space-y-0.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800/40 dark:bg-emerald-900/20">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                        Receita Federal
                      </p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{cpfVerify.nome}</p>
                      {cpfVerify.dataNascimento && cpfVerify.dataNascimento !== "—" && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Nasc. {cpfVerify.dataNascimento}</p>
                      )}
                    </div>
                  )}
                  {cpfVerify.status === "error" && (
                    <div className="mt-2 flex items-start gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-800/40 dark:bg-rose-900/20">
                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-rose-500" />
                      <p className="text-[11px] text-rose-700 dark:text-rose-400">{cpfVerify.message}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <InfoTile
              icon={Calendar}
              accent="amber"
              label="Aniversário"
              value={client.birthday ? formatBirthday(client.birthday) : "Não informado"}
            />
            <InfoTile
              icon={Mail}
              accent="emerald"
              label="E-mail"
              value={client.email || "Não informado"}
            />
            <div
              className={cn(
                "flex flex-col gap-2 rounded-2xl border p-4 transition-all",
                purchaseStatus === "ativo"
                  ? "border-green-200 bg-green-50/60 dark:border-green-800/60 dark:bg-green-900/10"
                  : "border-red-200 bg-red-50/60 dark:border-red-800/60 dark:bg-red-900/10",
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  purchaseStatus === "ativo"
                    ? "bg-green-100 dark:bg-green-900/40"
                    : "bg-red-100 dark:bg-red-900/40",
                )}
              >
                <ShoppingCart
                  className={cn(
                    "h-4 w-4",
                    purchaseStatus === "ativo"
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400",
                  )}
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Status de Compra
                </p>
                <Badge
                  className={cn(
                    "mt-1 font-black uppercase tracking-wider",
                    purchaseStatus === "ativo"
                      ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700"
                      : "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
                  )}
                >
                  {purchaseStatus === "ativo" ? "ATIVO" : "INATIVO"}
                </Badge>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {lastPurchaseDate
                    ? `Última compra: ${format(new Date(lastPurchaseDate + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}`
                    : "Nenhuma compra registrada"}
                </p>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      {(client.address || client.cep) && (
        <Card className="overflow-hidden border border-slate-200/80 bg-white shadow-[0_18px_50px_-40px_rgba(15,23,42,0.32)] dark:border-slate-800 dark:bg-slate-950">
          <CardHeader className="border-b border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50">
            <CardTitle className="flex items-center gap-3 text-lg font-black text-slate-800 dark:text-slate-200">
              <div className="rounded-xl bg-amber-100 p-2.5 dark:bg-amber-900/40">
                <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              Endereço
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              {client.address && (
                <AddressTile label="Endereço">
                  <span className="font-semibold text-slate-900 dark:text-slate-200">
                    {client.address}
                    {client.number && `, ${client.number}`}
                  </span>
                </AddressTile>
              )}

              {client.neighborhood && (
                <AddressTile label="Bairro">{client.neighborhood}</AddressTile>
              )}

              {client.city && (
                <AddressTile label="Cidade">
                  {client.city}
                  {client.state && ` - ${client.state}`}
                </AddressTile>
              )}

              {client.cep && (
                <AddressTile label="CEP">{client.cep}</AddressTile>
              )}
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const addressParts = [
                    client.address,
                    client.number && `${client.number}`,
                    client.neighborhood,
                    client.city,
                    client.state,
                    client.cep && `CEP: ${client.cep}`,
                  ].filter(Boolean);

                  const fullAddress = addressParts.join(", ");
                  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    fullAddress,
                  )}`;
                  window.open(mapsUrl, "_blank");
                }}
                className="h-10 rounded-xl border-slate-200 bg-white px-4 font-semibold shadow-sm transition-all hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-amber-700 dark:hover:bg-amber-900/20 dark:hover:text-amber-300"
              >
                <MapPin className="mr-2 h-4 w-4" />
                Ver no Mapa
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border border-slate-200/80 bg-white shadow-[0_18px_50px_-40px_rgba(15,23,42,0.32)] dark:border-slate-800 dark:bg-slate-950">
        <CardHeader className="border-b border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50">
          <CardTitle className="flex items-center gap-3 text-lg font-black text-slate-800 dark:text-slate-200">
            <div className="rounded-xl bg-violet-100 p-2.5 dark:bg-violet-900/40">
              <Building className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            Informações Comerciais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {client.documentType === "cnpj" && (client.nomeFantasia || client.inscricaoEstadual) && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mb-6">
              {client.nomeFantasia && (
                <CommercialTile label="Nome Fantasia">
                  <span className="font-semibold text-slate-900 dark:text-slate-200">{client.nomeFantasia}</span>
                </CommercialTile>
              )}
              {client.inscricaoEstadual && (
                <CommercialTile label="Inscrição Estadual">
                  <span className="font-semibold text-slate-900 dark:text-slate-200">{client.inscricaoEstadual}</span>
                </CommercialTile>
              )}
            </div>
          )}

          {hasCommercialInfo || referrer ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {client.categoria && (
                <CommercialTile label="Categoria">
                  <Badge
                    variant="secondary"
                    className="rounded-full border-none bg-violet-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-violet-800 hover:bg-violet-100 dark:bg-violet-900/50 dark:text-violet-300"
                  >
                    {client.categoria}
                  </Badge>
                </CommercialTile>
              )}

              {client.origem && (
                <CommercialTile label="Origem">
                  <Badge
                    variant="outline"
                    className="rounded-full border-slate-300 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                  >
                    {client.origem}
                  </Badge>
                </CommercialTile>
              )}

              {referrer && (
                <CommercialTile label="Indicado por">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                      <Users className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <a
                      href={`/clientes/${referrer.id}`}
                      className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {referrer.name}
                    </a>
                  </div>
                </CommercialTile>
              )}

              {(client as any).rfmSegment && (
                <CommercialTile label="Segmento RFM">
                  <div className="flex flex-col gap-1.5">
                    <span className={`inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${RFM_COLORS[(client as any).rfmSegment] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>
                      <TrendingUp className="h-3 w-3" />
                      {RFM_LABELS[(client as any).rfmSegment] ?? (client as any).rfmSegment}
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
                      {RFM_DESCRIPTIONS[(client as any).rfmSegment] ?? ""}
                    </p>
                  </div>
                </CommercialTile>
              )}
            </div>
          ) : (
            <EmptyState
              icon={Building}
              title="Sem dados comerciais"
              description="Categoria, origem e marcadores ainda não foram preenchidos para este cliente."
            />
          )}

          {client.markers && client.markers.length > 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/45">
              <p className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                <Tag className="h-4 w-4" />
                Marcadores
              </p>
              <div className="flex flex-wrap gap-2">
                {client.markers.map((marker, index) => (
                  <Badge
                    key={index}
                    variant="default"
                    className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-white shadow-sm hover:bg-slate-900 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100"
                  >
                    {marker}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border border-slate-200/80 bg-white shadow-[0_18px_50px_-40px_rgba(15,23,42,0.32)] dark:border-slate-800 dark:bg-slate-950">
        <CardHeader className="border-b border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50">
          <CardTitle className="flex items-center gap-3 text-lg font-black text-slate-800 dark:text-slate-200">
            <div className="rounded-xl bg-emerald-100 p-2.5 dark:bg-emerald-900/40">
              <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            Informações do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <SystemTile label="Data de cadastro">
              <span className="font-semibold text-slate-900 dark:text-slate-200">
                {formatDate(String(client.createdAt))}
              </span>
            </SystemTile>
            <SystemTile label="ID do cliente">
              <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-md text-slate-700 dark:text-slate-300">
                {client.id}
              </span>
            </SystemTile>
            <SystemTile label="Bling">
              {client.blingContactId ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Sincronizado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 dark:text-slate-500">
                  <XCircle className="h-4 w-4" />
                  Não sincronizado
                </span>
              )}
            </SystemTile>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type TileAccent = "blue" | "slate" | "amber" | "emerald";

const tileAccentStyles: Record<
  TileAccent,
  { iconWrap: string; icon: string; link: string }
> = {
  blue: {
    iconWrap: "bg-blue-100 dark:bg-blue-900/30",
    icon: "text-blue-600 dark:text-blue-400",
    link: "text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200",
  },
  slate: {
    iconWrap: "bg-slate-100 dark:bg-slate-800",
    icon: "text-slate-600 dark:text-slate-300",
    link: "text-slate-900 dark:text-slate-100",
  },
  amber: {
    iconWrap: "bg-amber-100 dark:bg-amber-900/30",
    icon: "text-amber-600 dark:text-amber-400",
    link: "text-slate-900 dark:text-slate-100",
  },
  emerald: {
    iconWrap: "bg-emerald-100 dark:bg-emerald-900/30",
    icon: "text-emerald-600 dark:text-emerald-400",
    link: "text-slate-900 dark:text-slate-100",
  },
};

function InfoTile({
  icon: Icon,
  accent,
  label,
  value,
  href,
  interactive = false,
}: {
  icon: typeof User;
  accent: TileAccent;
  label: string;
  value: string;
  href?: string;
  interactive?: boolean;
}) {
  const styles = tileAccentStyles[accent];

  return (
    <div className="group rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_35px_-34px_rgba(15,23,42,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-34px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900/75">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-inner",
            styles.iconWrap,
          )}
        >
          <Icon className={cn("h-4 w-4", styles.icon)} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            {label}
          </p>
          {href ? (
            <a
              href={href}
              className={cn(
                "mt-2 block truncate text-base font-black transition-colors",
                interactive ? styles.link : "text-slate-900 dark:text-slate-100",
              )}
              title={value}
            >
              {value}
            </a>
          ) : (
            <p className="mt-2 break-words text-base font-black text-slate-900 dark:text-slate-100">
              {value}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function AddressTile({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_16px_30px_-34px_rgba(15,23,42,0.42)] dark:border-slate-800 dark:bg-slate-900/75">
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <div className="text-sm text-slate-900 dark:text-slate-100">{children}</div>
    </div>
  );
}

function CommercialTile({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_35px_-35px_rgba(15,23,42,0.4)] dark:border-slate-800 dark:bg-slate-900/75">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function SystemTile({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_30px_-36px_rgba(15,23,42,0.4)] dark:border-slate-800 dark:bg-slate-900/75">
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Building;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/45">
      <div className="mb-4 rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-800">
        <Icon className="h-5 w-5 text-slate-400 dark:text-slate-500" />
      </div>
      <p className="text-base font-black text-slate-800 dark:text-slate-100">
        {title}
      </p>
      <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}
