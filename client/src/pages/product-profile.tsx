import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import {
  AppTabs,
  UnderlineTabsList,
  UnderlineTabsTrigger,
  AppTabsContent,
} from "@/components/app-tabs";
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
  ArrowLeft,
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
  Download,
  Phone,
  Mail,
} from "lucide-react";
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

interface ProductData {
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

function isWineCategory(category?: string) {
  return (
    category
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .startsWith("VINHO") ?? false
  );
}

const TYPE_COLORS: Record<string, string> = {
  TINTO: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  BRANCO: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  ESPUMANTE:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  ROSE: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
  "PÓS-REFEIÇÃO":
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

const COUNTRY_FLAGS: Record<string, string> = {
  CHILE: "🇨🇱",
  ARGENTINA: "🇦🇷",
  URUGUAI: "🇺🇾",
  BRASIL: "🇧🇷",
  EUA: "🇺🇸",
  FRANÇA: "🇫🇷",
  ITÁLIA: "🇮🇹",
  PORTUGAL: "🇵🇹",
  ESPANHA: "🇪🇸",
  ALEMANHA: "🇩🇪",
  OUTROS: "🌍",
};

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
    <Card className="border border-border bg-card shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl ${color} shrink-0`}>{icon}</div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {label}
            </p>
            <p className="text-xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">
              {value}
            </p>
            {sub && (
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                {sub}
              </p>
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
    <div className="bg-card border border-border rounded-xl p-3 shadow-xl text-sm">
      <p className="font-bold text-slate-700 dark:text-slate-200 mb-1">
        {label}
      </p>
      <p className="text-primary font-black">
        {formatCurrency(parseFloat(payload[0]?.value ?? "0"))}
      </p>
      <p className="text-slate-500 text-xs">
        {parseFloat(payload[1]?.value ?? "0").toFixed(0)} unid.
      </p>
    </div>
  );
}

const sensoryScale: Record<string, Record<string, number>> = {
  corpo: { leve: 24, médio: 56, medio: 56, encorpado: 88 },
  docura: {
    seco: 18,
    "meio-seco": 42,
    "meio seco": 42,
    "meio-doce": 68,
    "meio doce": 68,
    doce: 90,
  },
  acidez: { baixa: 24, média: 56, media: 56, alta: 88 },
};

const sensoryTheme: Record<
  string,
  {
    gradient: string;
    glow: string;
    accent: string;
    left: string;
    right: string;
  }
> = {
  corpo: {
    gradient: "from-amber-400 via-orange-500 to-red-500",
    glow: "shadow-amber-500/20",
    accent: "text-amber-700 dark:text-amber-300",
    left: "Leve",
    right: "Encorpado",
  },
  docura: {
    gradient: "from-rose-300 via-pink-500 to-fuchsia-600",
    glow: "shadow-pink-500/20",
    accent: "text-pink-700 dark:text-pink-300",
    left: "Seco",
    right: "Doce",
  },
  acidez: {
    gradient: "from-emerald-300 via-lime-500 to-yellow-400",
    glow: "shadow-lime-500/20",
    accent: "text-lime-700 dark:text-lime-300",
    left: "Baixa",
    right: "Alta",
  },
};

function getSensoryValue(type: "corpo" | "docura" | "acidez", value?: string) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return sensoryScale[type][normalized] ?? 50;
}

function SensoryGauge({
  label,
  value,
  type,
}: {
  label: string;
  value?: string;
  type: "corpo" | "docura" | "acidez";
}) {
  const score = getSensoryValue(type, value);
  const needleAngle = Math.PI - (score / 100) * Math.PI;
  const needleX = 90 + Math.cos(needleAngle) * 54;
  const needleY = 88 - Math.sin(needleAngle) * 54;
  const theme = sensoryTheme[type];
  const gradientId = `sensoryGradient-${type}`;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm ${theme.glow}`}
    >
      <div
        className={`absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${theme.gradient} opacity-15 blur-2xl`}
      />
      <div className="relative">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.22em]">
          {label}
        </p>
        <div className="mt-3 flex justify-center">
          <div className="relative h-24 w-44">
            <svg viewBox="0 0 180 100" className="h-full w-full">
              <path
                d="M 22 88 A 68 68 0 0 1 158 88"
                fill="none"
                stroke="currentColor"
                strokeWidth="16"
                strokeLinecap="round"
                className="text-slate-100 dark:text-slate-800"
              />
              <path
                d="M 22 88 A 68 68 0 0 1 158 88"
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${score * 2.14} 214`}
              />
              <line
                x1="90"
                y1="88"
                x2={needleX}
                y2={needleY}
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                className="text-slate-900 dark:text-white drop-shadow-sm"
              />
              <circle
                cx="90"
                cy="88"
                r="8"
                className="fill-white dark:fill-slate-900"
              />
              <circle
                cx="90"
                cy="88"
                r="4.5"
                className="fill-slate-900 dark:fill-white"
              />
              <defs>
                <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
                  <stop
                    offset="0%"
                    stopColor={
                      type === "corpo"
                        ? "#f59e0b"
                        : type === "docura"
                          ? "#f9a8d4"
                          : "#86efac"
                    }
                  />
                  <stop
                    offset="55%"
                    stopColor={
                      type === "corpo"
                        ? "#f97316"
                        : type === "docura"
                          ? "#ec4899"
                          : "#84cc16"
                    }
                  />
                  <stop
                    offset="100%"
                    stopColor={
                      type === "corpo"
                        ? "#ef4444"
                        : type === "docura"
                          ? "#c026d3"
                          : "#facc15"
                    }
                  />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
        <div className="mt-1 text-center">
          <p className={`text-lg font-black capitalize ${theme.accent}`}>
            {value ?? "—"}
          </p>
          <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>{theme.left}</span>
            <span>{theme.right}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("details");
  const { toast } = useToast();
  const [aiProfile, setAiProfile] = React.useState<WineAIProfile | null>(null);

  const { data: product, isLoading: isLoadingProduct } = useQuery<ProductData>({
    queryKey: ["/api/products", id, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${id}/detail`);
      if (!res.ok) throw new Error("Erro ao buscar produto");
      return res.json();
    },
    enabled: !!id,
  });

  React.useEffect(() => {
    if (product?.aiProfile) setAiProfile(product.aiProfile);
  }, [product]);

  const generateAIProfileMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/products/${id}/generate-ai-profile`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Erro ao gerar perfil");
      return res.json();
    },
    onSuccess: (data) => {
      setAiProfile(data.profile);
      toast({
        title: "Perfil gerado",
        description: "O perfil IA do vinho foi atualizado.",
      });
    },
    onError: () =>
      toast({
        title: "Erro",
        description: "Não foi possível gerar o perfil IA.",
        variant: "destructive",
      }),
  });

  const { data: profile, isLoading: isLoadingProfile } = useQuery<ProfileData>({
    queryKey: ["/api/products", id, "profile"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${id}/profile`);
      if (!res.ok) throw new Error("Erro ao buscar perfil");
      return res.json();
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });

  const chartData =
    profile?.monthlyHistory.map((m) => ({
      month: format(parseISO(`${m.month}-01`), "MMM/yy", { locale: ptBR }),
      receita: parseFloat(m.totalRevenue),
      quantidade: parseFloat(m.totalQuantity),
    })) ?? [];

  const typeColor =
    TYPE_COLORS[product?.type ?? ""] ?? "bg-gray-100 text-gray-800";
  const flag = COUNTRY_FLAGS[product?.country ?? ""] ?? "🌍";
  const isWine = isWineCategory(product?.category);

  return (
    <div className="space-y-6 pb-12">
      {/* Back + header */}
      <PageHeader>
        <PageHeader.Info className="flex-col sm:flex-row items-start sm:items-center">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/products")}
              className="shrink-0 h-9 w-9 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            {isLoadingProduct ? (
              <Skeleton className="h-12 w-12 rounded-2xl shrink-0" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl flex-shrink-0 shadow-inner bg-accent border border-border overflow-hidden">
                {product?.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <Wine className="h-6 w-6 text-primary" />
                )}
              </div>
            )}
          </div>

          <PageHeader.Text>
            {isLoadingProduct ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-4 w-40" />
              </div>
            ) : (
              <>
                <PageHeader.Title>{product?.name}</PageHeader.Title>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {product?.country && (
                    <span className="text-sm font-semibold text-slate-500">
                      {flag} {product.country}
                    </span>
                  )}
                  {product?.type && (
                    <Badge
                      className={`text-[10px] font-black uppercase border-0 h-5 px-2 ${typeColor}`}
                    >
                      {product.type}
                    </Badge>
                  )}
                  {product?.volume && (
                    <span className="text-xs font-semibold text-slate-400">
                      {product.volume}
                    </span>
                  )}
                  {product?.category && (
                    <Badge className="text-[10px] font-black uppercase border-0 h-5 px-2 bg-accent text-primary">
                      {product.category}
                    </Badge>
                  )}
                </div>
              </>
            )}
          </PageHeader.Text>
        </PageHeader.Info>
      </PageHeader>

      {/* Summary cards */}
      <div>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">
          Últimos 12 meses
        </p>
        {isLoadingProfile ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4"
          >
            <SummaryCard
              icon={<DollarSign className="h-5 w-5 text-primary" />}
              label="Total faturado"
              value={formatCurrency(profile?.summary.totalRevenue ?? 0)}
              color="bg-accent"
            />
            <SummaryCard
              icon={<Package className="h-5 w-5 text-primary" />}
              label="Garrafas vendidas"
              value={`${(profile?.summary.totalQuantity ?? 0).toFixed(0)} unid.`}
              color="bg-accent"
            />
            <SummaryCard
              icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
              label="Preço médio"
              value={formatCurrency(profile?.summary.averagePrice ?? 0)}
              sub="total R$ ÷ garrafas"
              color="bg-emerald-100 dark:bg-emerald-900/30"
            />
            <SummaryCard
              icon={<ShoppingCart className="h-5 w-5 text-amber-600" />}
              label="Pedidos"
              value={String(profile?.summary.orderCount ?? 0)}
              color="bg-amber-100 dark:bg-amber-900/30"
            />
            <SummaryCard
              icon={<Users className="h-5 w-5 text-pink-600" />}
              label="Compradores únicos"
              value={String(profile?.summary.buyerCount ?? 0)}
              color="bg-pink-100 dark:bg-pink-900/30"
            />
          </motion.div>
        )}
      </div>

      {/* Tabs */}
      <AppTabs value={activeTab} onValueChange={setActiveTab}>
        <UnderlineTabsList>
          <UnderlineTabsTrigger value="details" color="wine">
            Detalhes
          </UnderlineTabsTrigger>
          <UnderlineTabsTrigger
            value="ai-profile"
            color="wine"
            className="flex items-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Perfil IA
          </UnderlineTabsTrigger>
          <UnderlineTabsTrigger value="history" color="wine">
            Histórico
          </UnderlineTabsTrigger>
          <UnderlineTabsTrigger value="buyers" color="wine">
            Compradores
          </UnderlineTabsTrigger>
        </UnderlineTabsList>

        {/* Tab: Detalhes */}
        <AppTabsContent value="details" className="mt-6">
          {isLoadingProduct ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {isWine && (
                <div className="bg-card rounded-2xl p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      País
                    </span>
                  </div>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {flag} {product?.country ?? "—"}
                  </p>
                </div>
              )}

              {isWine && (
                <div className="bg-card rounded-2xl p-4 border border-border">
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
              )}

              {isWine && (
                <div className="bg-card rounded-2xl p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Tipo
                    </span>
                  </div>
                  {product?.type ? (
                    <Badge
                      className={`text-[11px] font-black uppercase border-0 ${typeColor}`}
                    >
                      {product.type}
                    </Badge>
                  ) : (
                    <p className="text-sm text-slate-400">—</p>
                  )}
                </div>
              )}

              <div className="bg-card rounded-2xl p-4 border border-border">
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
                <p className="text-3xl font-extrabold text-emerald-800 dark:text-emerald-300">
                  {formatCurrency(parseFloat(product?.negotiatedPrice ?? "0"))}
                </p>
              </div>

              <div className="bg-card rounded-2xl p-4 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Na carta de
                  </span>
                </div>
                <p className="font-extrabold text-slate-800 dark:text-slate-200 text-2xl">
                  {product?.clientCount ?? 0}
                  <span className="text-xs font-bold text-slate-400 ml-1">
                    clientes
                  </span>
                </p>
              </div>

              <div className="bg-card rounded-2xl p-4 border border-border">
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

              <div className="bg-card rounded-2xl p-4 border border-border col-span-2">
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
          )}
        </AppTabsContent>

        {/* Tab: Perfil IA */}
        <AppTabsContent value="ai-profile" className="mt-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                Perfil gerado por IA
              </p>
              <button
                onClick={() => generateAIProfileMutation.mutate()}
                disabled={generateAIProfileMutation.isPending}
                className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${generateAIProfileMutation.isPending ? "animate-spin" : ""}`}
                />
                {generateAIProfileMutation.isPending
                  ? "Gerando..."
                  : "Regenerar"}
              </button>
            </div>

            {!aiProfile ? (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                <div className="p-5 bg-accent rounded-full">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-slate-700 dark:text-slate-300 text-lg">
                    Perfil ainda não gerado
                  </p>
                  <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                    O perfil é gerado automaticamente ao criar o produto. Clique
                    abaixo para gerar agora.
                  </p>
                </div>
                <button
                  onClick={() => generateAIProfileMutation.mutate()}
                  disabled={generateAIProfileMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {generateAIProfileMutation.isPending
                    ? "Gerando..."
                    : "Gerar perfil IA"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Descrição */}
                <div className="bg-accent/50 dark:bg-accent/10 rounded-2xl p-5 border border-border">
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">
                    "{aiProfile.descricao}"
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <SensoryGauge
                    label="Corpo"
                    value={aiProfile.corpo}
                    type="corpo"
                  />
                  <SensoryGauge
                    label="Doçura"
                    value={aiProfile.docura}
                    type="docura"
                  />
                  <SensoryGauge
                    label="Acidez"
                    value={aiProfile.acidez}
                    type="acidez"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    ...(aiProfile.tanino
                      ? [
                          {
                            label: "Tanino",
                            value: aiProfile.tanino,
                            color:
                              "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
                          },
                        ]
                      : []),
                    {
                      label: "Estilo",
                      value: aiProfile.estilo,
                      color: "bg-accent text-primary",
                    },
                    {
                      label: "Mundo",
                      value: aiProfile.mundo,
                      color: "bg-accent text-slate-700 dark:text-slate-300",
                    },
                  ].map((attr) => (
                    <div
                      key={attr.label}
                      className="bg-card rounded-xl p-4 border border-border"
                    >
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                        {attr.label}
                      </p>
                      <span
                        className={`inline-block text-xs font-bold px-2.5 py-1 rounded-lg capitalize ${attr.color}`}
                      >
                        {attr.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Região e Produtor */}
                {(aiProfile.regiao || aiProfile.produtor) && (
                  <div className="grid grid-cols-2 gap-3">
                    {aiProfile.regiao && (
                      <div className="bg-card rounded-xl p-4 border border-border">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                          Região
                        </p>
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {aiProfile.regiao}
                        </p>
                      </div>
                    )}
                    {aiProfile.produtor && (
                      <div className="bg-card rounded-xl p-4 border border-border">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                          Produtor
                        </p>
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {aiProfile.produtor}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Uvas */}
                {aiProfile.uvas?.length > 0 && (
                  <div className="bg-card rounded-xl p-4 border border-border">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">
                      Uvas
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {aiProfile.uvas.map((uva) => (
                        <span
                          key={uva}
                          className="text-sm font-semibold px-3 py-1 bg-accent text-primary rounded-full"
                        >
                          {uva}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Harmonização */}
                {aiProfile.harmonizacao?.length > 0 && (
                  <div className="bg-card rounded-xl p-4 border border-border">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">
                      Harmonização
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {aiProfile.harmonizacao.map((item) => (
                        <span
                          key={item}
                          className="text-sm font-semibold px-3 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-full"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </AppTabsContent>

        {/* Tab: Histórico */}
        <AppTabsContent value="history" className="mt-6">
          {isLoadingProfile ? (
            <Skeleton className="h-96 rounded-2xl" />
          ) : chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="p-5 bg-accent rounded-full mb-4">
                <BarChart className="h-10 w-10 text-primary" />
              </div>
              <p className="font-semibold text-slate-700 dark:text-slate-300 text-lg">
                Nenhum histórico encontrado
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Sem vendas registradas nos últimos 12 meses
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <Card className="border border-border bg-card shadow-sm">
                <CardContent className="pt-6">
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} barGap={4}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#f1f5f9"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 12, fill: "#94a3b8" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="receita"
                          orientation="left"
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                          width={52}
                        />
                        <YAxis
                          yAxisId="qtd"
                          orientation="right"
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          axisLine={false}
                          tickLine={false}
                          width={36}
                        />
                        <Tooltip content={<CustomBarTooltip />} />
                        <Bar
                          yAxisId="receita"
                          dataKey="receita"
                          fill="#8b1a2c"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={40}
                        />
                        <Bar
                          yAxisId="qtd"
                          dataKey="quantidade"
                          fill="#c4878f"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={24}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center gap-6 justify-center mt-4 text-xs text-slate-400 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-sm bg-primary inline-block" />
                      Receita (R$)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-sm bg-primary/30 inline-block" />
                      Quantidade (unid.)
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                {[...chartData].reverse().map((m) => (
                  <div
                    key={m.month}
                    className="flex items-center justify-between px-5 py-3 rounded-xl bg-card border border-border"
                  >
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 capitalize w-24">
                      {m.month}
                    </span>
                    <div className="flex items-center gap-6">
                      <span className="text-xs font-semibold text-slate-400">
                        {m.quantidade.toFixed(0)} unid.
                      </span>
                      <span className="text-sm font-black text-primary w-28 text-right">
                        {formatCurrency(m.receita)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </AppTabsContent>

        {/* Tab: Compradores */}
        <AppTabsContent value="buyers" className="mt-6">
          {!isLoadingProfile && (profile?.buyers.length ?? 0) > 0 && (
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  const rows = [["Nome", "Celular", "Email"]];
                  profile!.buyers.forEach((b) => {
                    rows.push([
                      b.companyName ?? b.companyId,
                      b.celular ?? "",
                      b.email ?? "",
                    ]);
                  });
                  const csv = rows
                    .map((r) =>
                      r.map((v) => `"${v.replace(/"/g, '""')}"`).join(","),
                    )
                    .join("\n");
                  const blob = new Blob(["﻿" + csv], {
                    type: "text/csv;charset=utf-8;",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `compradores_${product?.name ?? "produto"}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </div>
          )}
          {isLoadingProfile ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : (profile?.buyers.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="p-5 bg-accent rounded-full mb-4">
                <Building2 className="h-10 w-10 text-primary" />
              </div>
              <p className="font-semibold text-slate-700 dark:text-slate-300 text-lg">
                Nenhum comprador encontrado
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Sem compras registradas nos últimos 12 meses
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {profile!.buyers.map((buyer, i) => (
                <motion.div
                  key={buyer.companyId}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-4 px-5 py-4 rounded-xl bg-card border border-border hover:bg-muted/50 transition-colors shadow-sm"
                >
                  <div className="h-9 w-9 rounded-xl bg-accent border border-border flex items-center justify-center text-sm font-black text-primary shrink-0">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {buyer.companyName ?? buyer.companyId}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-slate-400">
                        {parseFloat(buyer.totalQuantity).toFixed(0)} unid.
                      </span>
                      <span className="text-slate-300 text-xs">·</span>
                      <span className="text-xs text-slate-400">
                        {buyer.orderCount} pedido
                        {buyer.orderCount !== 1 ? "s" : ""}
                      </span>
                      <span className="text-slate-300 text-xs">·</span>
                      <span className="text-xs text-slate-400">
                        última compra{" "}
                        {format(parseISO(buyer.lastPurchase), "dd/MM/yyyy")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {buyer.celular || "Celular não informado"}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        {buyer.email || "E-mail não informado"}
                      </span>
                    </div>
                  </div>
                  <span className="text-base font-black text-primary shrink-0">
                    {formatCurrency(parseFloat(buyer.totalRevenue))}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </AppTabsContent>
      </AppTabs>
    </div>
  );
}
