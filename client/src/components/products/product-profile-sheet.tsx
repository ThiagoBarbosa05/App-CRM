import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Wine,
  DollarSign,
  Package,
  TrendingUp,
  ShoppingCart,
  Users,
  MapPin,
  Ruler,
  Tag,
  Calendar,
  User,
  Building2,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface WineAIProfile {
  corpo: string;
  docura: string;
  acidez: string;
  tanino: string | null;
  mundo: string;
  regiao: string;
  produtor: string;
  uvas: string[];
  estilo: string;
  harmonizacao: string[];
  descricao: string;
}

interface Product {
  id: string;
  name: string;
  category?: string;
  country: string;
  volume: string;
  type: string;
  negotiatedPrice: string;
  createdByName: string;
  createdAt: string;
  clientCount: number;
  imageUrl?: string | null;
  blingProductId?: string | null;
  aiProfile?: WineAIProfile | null;
  aiProfileGeneratedAt?: string | null;
}

interface ProductProfileSheetProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getCountryFlag: (country: string) => string;
  getTypeColor: (type: string) => string;
}

interface ProfileData {
  summary: {
    totalRevenue: number;
    totalQuantity: number;
    averagePrice: number;
    orderCount: number;
    buyerCount: number;
  };
  monthlyHistory: {
    month: string;
    totalRevenue: string;
    totalQuantity: string;
    orderCount: number;
  }[];
  buyers: {
    companyId: string;
    companyName: string | null;
    celular: string | null;
    email: string | null;
    totalRevenue: string;
    totalQuantity: string;
    orderCount: number;
    lastPurchase: string;
  }[];
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl ${color} shrink-0`}>{icon}</div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              {label}
            </p>
            <p className="text-lg font-black text-slate-900 dark:text-white leading-tight mt-0.5">
              {value}
            </p>
            {sub && (
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">{sub}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-xl text-sm">
      <p className="font-bold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
      <p className="text-violet-600 font-black">
        {formatCurrency(parseFloat(payload[0]?.value ?? "0"))}
      </p>
      <p className="text-slate-500 text-xs">
        {parseFloat(payload[1]?.value ?? "0").toFixed(0)} unid.
      </p>
    </div>
  );
}

export function ProductProfileSheet({
  product,
  open,
  onOpenChange,
  getCountryFlag,
  getTypeColor,
}: ProductProfileSheetProps) {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/products", product?.id, "profile"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${product!.id}/profile`);
      if (!res.ok) throw new Error("Erro ao buscar perfil");
      return res.json();
    },
    enabled: !!product?.id && open,
    staleTime: 2 * 60 * 1000,
  });

  const [aiProfile, setAiProfile] = React.useState<WineAIProfile | null>(product?.aiProfile ?? null);

  React.useEffect(() => {
    setAiProfile(product?.aiProfile ?? null);
  }, [product?.id, product?.aiProfile]);

  const generateAIProfileMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/products/${product!.id}/generate-ai-profile`, { method: "POST" });
      if (!res.ok) throw new Error("Erro ao gerar perfil");
      return res.json();
    },
    onSuccess: (data) => {
      setAiProfile(data.profile);
      toast({ title: "Perfil gerado", description: "O perfil IA do vinho foi atualizado." });
    },
    onError: () => toast({ title: "Erro", description: "Não foi possível gerar o perfil IA.", variant: "destructive" }),
  });

  const chartData =
    data?.monthlyHistory.map((m) => ({
      month: format(parseISO(`${m.month}-01`), "MMM/yy", { locale: ptBR }),
      receita: parseFloat(m.totalRevenue),
      quantidade: parseFloat(m.totalQuantity),
    })) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="shrink-0 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <DialogHeader>
            <div className="flex items-center gap-4">
              {product?.imageUrl ? (
                <div className="h-14 w-14 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-contain p-1"
                  />
                </div>
              ) : (
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center border border-violet-100/50 dark:border-slate-700 shrink-0">
                  <Wine className="h-7 w-7 text-violet-500 dark:text-violet-400" />
                </div>
              )}
              <div className="min-w-0">
                <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight truncate">
                  {product?.name}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {product?.country && (
                    <span className="text-xs font-semibold text-slate-500">
                      {getCountryFlag(product.country)} {product.country}
                    </span>
                  )}
                  {product?.type && (
                    <Badge
                      className={`text-[10px] font-black uppercase border-0 h-4 px-1.5 ${getTypeColor(product.type)}`}
                    >
                      {product.type}
                    </Badge>
                  )}
                  {product?.volume && (
                    <span className="text-[11px] font-semibold text-slate-400">
                      {product.volume}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Summary Cards */}
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">
              Últimos 12 meses
            </p>
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <SummaryCard
                  icon={<DollarSign className="h-4 w-4 text-violet-600" />}
                  label="Total faturado"
                  value={formatCurrency(data?.summary.totalRevenue ?? 0)}
                  color="bg-violet-100 dark:bg-violet-900/30"
                />
                <SummaryCard
                  icon={<Package className="h-4 w-4 text-blue-600" />}
                  label="Garrafas vendidas"
                  value={`${(data?.summary.totalQuantity ?? 0).toFixed(0)} unid.`}
                  color="bg-blue-100 dark:bg-blue-900/30"
                />
                <SummaryCard
                  icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
                  label="Preço médio"
                  value={formatCurrency(data?.summary.averagePrice ?? 0)}
                  sub="total R$ ÷ garrafas"
                  color="bg-emerald-100 dark:bg-emerald-900/30"
                />
                <SummaryCard
                  icon={<ShoppingCart className="h-4 w-4 text-amber-600" />}
                  label="Pedidos"
                  value={String(data?.summary.orderCount ?? 0)}
                  color="bg-amber-100 dark:bg-amber-900/30"
                />
                <SummaryCard
                  icon={<Users className="h-4 w-4 text-pink-600" />}
                  label="Compradores únicos"
                  value={String(data?.summary.buyerCount ?? 0)}
                  color="bg-pink-100 dark:bg-pink-900/30"
                />
              </div>
            )}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="details">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="ai-profile" className="flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                Perfil IA
              </TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
              <TabsTrigger value="buyers">Compradores</TabsTrigger>
            </TabsList>

            {/* Tab: Detalhes */}
            <TabsContent value="details" className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      País de origem
                    </span>
                  </div>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {getCountryFlag(product?.country ?? "")} {product?.country ?? "—"}
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-2 mb-2">
                    <Ruler className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Volume
                    </span>
                  </div>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {product?.volume ?? "—"}
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Tipo
                    </span>
                  </div>
                  {product?.type ? (
                    <Badge
                      className={`text-[11px] font-black uppercase border-0 ${getTypeColor(product.type)}`}
                    >
                      {product.type}
                    </Badge>
                  ) : (
                    <p className="text-sm text-slate-400">—</p>
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Categoria
                    </span>
                  </div>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {product?.category ?? "—"}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-4 border border-emerald-100/60 dark:border-emerald-800/40 col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                      Preço de tabela
                    </span>
                  </div>
                  <p className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-300">
                    {formatCurrency(parseFloat(product?.negotiatedPrice ?? "0"))}
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Na carta de
                    </span>
                  </div>
                  <p className="font-extrabold text-slate-800 dark:text-slate-200 text-xl">
                    {product?.clientCount ?? 0}
                    <span className="text-xs font-bold text-slate-400 ml-1">clientes</span>
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Criado por
                    </span>
                  </div>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">
                    {product?.createdByName ?? "Sistema"}
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60 col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Data de criação
                    </span>
                  </div>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {product?.createdAt
                      ? new Date(product.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Tab: Perfil IA */}
            <TabsContent value="ai-profile" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    Perfil gerado por IA
                  </p>
                  <button
                    onClick={() => generateAIProfileMutation.mutate()}
                    disabled={generateAIProfileMutation.isPending}
                    className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${generateAIProfileMutation.isPending ? "animate-spin" : ""}`} />
                    {generateAIProfileMutation.isPending ? "Gerando..." : "Regenerar"}
                  </button>
                </div>

                {!aiProfile ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                    <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-full">
                      <Sparkles className="h-8 w-8 text-violet-400" />
                    </div>
                    <p className="font-semibold text-slate-700 dark:text-slate-300">Perfil ainda não gerado</p>
                    <p className="text-sm text-slate-400">O perfil é gerado automaticamente ao criar o produto, ou clique em Regenerar.</p>
                    <button
                      onClick={() => generateAIProfileMutation.mutate()}
                      disabled={generateAIProfileMutation.isPending}
                      className="mt-1 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
                    >
                      {generateAIProfileMutation.isPending ? "Gerando..." : "Gerar agora"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Descrição */}
                    <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-2xl p-4 border border-violet-100/60 dark:border-violet-800/40">
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">"{aiProfile.descricao}"</p>
                    </div>

                    {/* Atributos sensoriais */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Corpo", value: aiProfile.corpo, color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
                        { label: "Doçura", value: aiProfile.docura, color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" },
                        { label: "Acidez", value: aiProfile.acidez, color: "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300" },
                        ...(aiProfile.tanino ? [{ label: "Tanino", value: aiProfile.tanino, color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" }] : []),
                        { label: "Estilo", value: aiProfile.estilo, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
                        { label: "Mundo", value: aiProfile.mundo, color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300" },
                      ].map((attr) => (
                        <div key={attr.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/60">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{attr.label}</p>
                          <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-lg capitalize ${attr.color}`}>{attr.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Região e Produtor */}
                    {(aiProfile.regiao || aiProfile.produtor) && (
                      <div className="grid grid-cols-2 gap-3">
                        {aiProfile.regiao && (
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/60">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Região</p>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{aiProfile.regiao}</p>
                          </div>
                        )}
                        {aiProfile.produtor && (
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/60">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Produtor</p>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{aiProfile.produtor}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Uvas */}
                    {aiProfile.uvas?.length > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/60">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Uvas</p>
                        <div className="flex flex-wrap gap-1.5">
                          {aiProfile.uvas.map((uva) => (
                            <span key={uva} className="text-xs font-semibold px-2.5 py-1 bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 rounded-full">{uva}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Harmonização */}
                    {aiProfile.harmonizacao?.length > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/60">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Harmonização</p>
                        <div className="flex flex-wrap gap-1.5">
                          {aiProfile.harmonizacao.map((item) => (
                            <span key={item} className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-full">{item}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab: Histórico */}
            <TabsContent value="history" className="mt-4">
              {isLoading ? (
                <Skeleton className="h-64 rounded-xl" />
              ) : chartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full mb-3">
                    <BarChart className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    Nenhum histórico encontrado
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    Sem vendas nos últimos 12 meses
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="receita"
                          orientation="left"
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                          width={48}
                        />
                        <YAxis
                          yAxisId="qtd"
                          orientation="right"
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          axisLine={false}
                          tickLine={false}
                          width={32}
                        />
                        <Tooltip content={<CustomBarTooltip />} />
                        <Bar
                          yAxisId="receita"
                          dataKey="receita"
                          fill="#7c3aed"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={32}
                        />
                        <Bar
                          yAxisId="qtd"
                          dataKey="quantidade"
                          fill="#c4b5fd"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={20}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex items-center gap-4 justify-center text-xs text-slate-400 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-violet-600 inline-block" />
                      Receita (R$)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-violet-300 inline-block" />
                      Quantidade
                    </span>
                  </div>

                  <div className="space-y-2">
                    {[...chartData].reverse().map((m) => (
                      <div
                        key={m.month}
                        className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                      >
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 capitalize">
                          {m.month}
                        </span>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-semibold text-slate-400">
                            {m.quantidade.toFixed(0)} unid.
                          </span>
                          <span className="text-sm font-black text-violet-700 dark:text-violet-300">
                            {formatCurrency(m.receita)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Tab: Compradores */}
            <TabsContent value="buyers" className="mt-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-xl" />
                  ))}
                </div>
              ) : (data?.buyers.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full mb-3">
                    <Building2 className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    Nenhum comprador encontrado
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    Sem compras nos últimos 12 meses
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data!.buyers.map((buyer, i) => (
                    <div
                      key={buyer.companyId}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="h-8 w-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-xs font-black text-slate-500 shrink-0 shadow-sm">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">
                          {buyer.companyName ?? buyer.companyId}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-slate-400">
                            {parseFloat(buyer.totalQuantity).toFixed(0)} unid.
                          </span>
                          <span className="text-[11px] text-slate-300">·</span>
                          <span className="text-[11px] text-slate-400">
                            {buyer.orderCount} pedido{buyer.orderCount !== 1 ? "s" : ""}
                          </span>
                          <span className="text-[11px] text-slate-300">·</span>
                          <span className="text-[11px] text-slate-400">
                            última compra{" "}
                            {format(parseISO(buyer.lastPurchase), "dd/MM/yy")}
                          </span>
                        </div>
                        {(buyer.celular || buyer.email) && (
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {buyer.celular && (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">{buyer.celular}</span>
                            )}
                            {buyer.celular && buyer.email && (
                              <span className="text-[11px] text-slate-300">·</span>
                            )}
                            {buyer.email && (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">{buyer.email}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-black text-violet-700 dark:text-violet-300 shrink-0">
                        {formatCurrency(parseFloat(buyer.totalRevenue))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
