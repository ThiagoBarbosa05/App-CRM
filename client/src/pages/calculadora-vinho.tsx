import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Beer,
  Calculator,
  FileDown,
  GlassWater,
  Grape,
  Info,
  PartyPopper,
  RotateCcw,
  Wine,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";

// ---------------------------------------------------------------------------
// Tipos e configurações
// ---------------------------------------------------------------------------

type EventType =
  | "casamento"
  | "churrasco"
  | "jantar"
  | "aniversario"
  | "corporativo"
  | "crianca";

type Duration = "2" | "3" | "4" | "5" | "6";
type Profile = "leve" | "moderado" | "intenso";

// Ordem de exibição dos vinhos
const WINE_ORDER = ["espumante", "branco", "rose", "tinto"] as const;
type WineKey = (typeof WINE_ORDER)[number];

interface EventConfig {
  label: string;
  description: string;
  baseBottlesPerPerson: number;
  distribution: Record<WineKey, number>;
}

const EVENT_CONFIGS: Record<EventType, EventConfig> = {
  casamento: {
    label: "Casamento",
    description: "Espumante lidera — brinde, entrada e celebração",
    baseBottlesPerPerson: 0.5,
    distribution: { espumante: 40, branco: 20, rose: 15, tinto: 25 },
  },
  churrasco: {
    label: "Churrasco",
    description: "Tinto domina — harmoniza com carne",
    baseBottlesPerPerson: 0.4,
    distribution: { espumante: 10, branco: 20, rose: 10, tinto: 60 },
  },
  jantar: {
    label: "Jantar Harmonizado",
    description: "Consumo quase 1:1 com convidados — cada prato tem seu vinho",
    baseBottlesPerPerson: 0.9,
    distribution: { espumante: 15, branco: 35, rose: 10, tinto: 40 },
  },
  aniversario: {
    label: "Aniversário Adulto",
    description: "Mix equilibrado com leve preferência por tinto",
    baseBottlesPerPerson: 0.4,
    distribution: { espumante: 15, branco: 25, rose: 20, tinto: 40 },
  },
  corporativo: {
    label: "Festa Corporativa",
    description: "Consumo moderado, espumante e branco em destaque",
    baseBottlesPerPerson: 0.3,
    distribution: { espumante: 30, branco: 30, rose: 15, tinto: 25 },
  },
  crianca: {
    label: "Festa Infantil",
    description: "Adultos presentes bebem pouco — foco nas crianças",
    baseBottlesPerPerson: 0.15,
    distribution: { espumante: 20, branco: 30, rose: 20, tinto: 30 },
  },
};

const DURATION_MULTIPLIERS: Record<Duration, number> = {
  "2": 0.7,
  "3": 1.0,
  "4": 1.2,
  "5": 1.4,
  "6": 1.6,
};

const DURATION_LABELS: Record<Duration, string> = {
  "2": "2 horas",
  "3": "3 horas",
  "4": "4 horas",
  "5": "5 horas",
  "6": "6 horas ou mais",
};

const PROFILE_MULTIPLIERS: Record<Profile, number> = {
  leve: 0.7,
  moderado: 1.0,
  intenso: 1.3,
};

const PROFILE_LABELS: Record<Profile, string> = {
  leve: "Leve",
  moderado: "Moderado",
  intenso: "Intenso",
};

const WINE_META: Record<
  WineKey,
  { label: string; color: string; dot: string; printColor: string }
> = {
  espumante: {
    label: "Espumante",
    color: "text-purple-600 dark:text-purple-400",
    dot: "bg-purple-500",
    printColor: "#7c3aed",
  },
  branco: {
    label: "Branco",
    color: "text-yellow-600 dark:text-yellow-400",
    dot: "bg-yellow-500",
    printColor: "#ca8a04",
  },
  rose: {
    label: "Rosé",
    color: "text-pink-500 dark:text-pink-400",
    dot: "bg-pink-400",
    printColor: "#ec4899",
  },
  tinto: {
    label: "Tinto",
    color: "text-red-700 dark:text-red-400",
    dot: "bg-red-700",
    printColor: "#b91c1c",
  },
};

const EVENT_OBSERVATIONS: Record<EventType, string[]> = {
  casamento: [
    "Separe o espumante para a entrada e o brinde — é o primeiro vinho a ser servido.",
    "Considere ter uma garrafa de tinto na mesa para os convidados que preferem ao longo do jantar.",
  ],
  churrasco: [
    "O tinto vai bem gelado em dias quentes — deixe opções de temperatura variada.",
    "Tintos encorpados (Malbec, Cabernet) harmonizam melhor com carnes vermelhas.",
  ],
  jantar: [
    "Em jantares harmonizados, sirva um vinho por prato — planeje a sequência com o cardápio.",
    "Comece sempre com os mais leves (branco/espumante) e vá para os encorpados (tinto).",
  ],
  aniversario: [
    "Um brinde com espumante no início do evento é prático e bem recebido.",
    "Rosé é uma boa escolha para festas com público misto.",
  ],
  corporativo: [
    "Prefira rótulos versáteis e acessíveis — evite vinhos muito tânicos em eventos corporativos.",
    "Espumante e branco costumam ser os preferidos em happy hours e confraternizações.",
  ],
  crianca: [
    "O foco são as crianças — considere apenas um tipo de vinho para simplificar.",
    "Espumante para o brinde dos adultos é suficiente na maioria dos casos.",
  ],
};

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function CalculadoraVinho() {
  const [eventType, setEventType] = useState<EventType>("casamento");
  const [guests, setGuests] = useState<string>("50");
  const [duration, setDuration] = useState<Duration>("3");
  const [profile, setProfile] = useState<Profile>("moderado");

  const [hasBeer, setHasBeer] = useState(false);
  const [hasDrinks, setHasDrinks] = useState(false);
  const [hasSpirits, setHasSpirits] = useState(false);

  const [wines, setWines] = useState<Record<WineKey, boolean>>({
    espumante: true,
    branco: true,
    rose: true,
    tinto: true,
  });

  const toggleWine = (key: WineKey) => {
    const next = { ...wines, [key]: !wines[key] };
    if (Object.values(next).filter(Boolean).length === 0) return;
    setWines(next);
  };

  const reset = () => {
    setEventType("casamento");
    setGuests("50");
    setDuration("3");
    setProfile("moderado");
    setHasBeer(false);
    setHasDrinks(false);
    setHasSpirits(false);
    setWines({ espumante: true, branco: true, rose: true, tinto: true });
  };

  // -------------------------------------------------------------------------
  // Cálculo
  // -------------------------------------------------------------------------

  const result = useMemo(() => {
    const numGuests = parseInt(guests) || 0;
    if (numGuests <= 0) return null;

    const config = EVENT_CONFIGS[eventType];

    let reducer = 0;
    if (hasBeer) reducer += 0.15;
    if (hasDrinks) reducer += 0.15;
    if (hasSpirits) reducer += 0.1;
    reducer = Math.min(reducer, 0.5);

    const total =
      numGuests *
      config.baseBottlesPerPerson *
      DURATION_MULTIPLIERS[duration] *
      PROFILE_MULTIPLIERS[profile] *
      (1 - reducer);

    const activeDist = WINE_ORDER.reduce(
      (acc, key) => {
        if (wines[key]) acc[key] = config.distribution[key];
        return acc;
      },
      {} as Record<WineKey, number>,
    );

    const totalActivePct = Object.values(activeDist).reduce((a, b) => a + b, 0);

    const perWine = (Object.entries(activeDist) as [WineKey, number][]).reduce(
      (acc, [key, pct]) => {
        const bottles = (total * pct) / totalActivePct;
        acc[key] = {
          bottles: Math.ceil(bottles),
          withMargin: Math.ceil(bottles * 1.1),
          pct: Math.round((pct / totalActivePct) * 100),
        };
        return acc;
      },
      {} as Record<
        WineKey,
        { bottles: number; withMargin: number; pct: number }
      >,
    );

    const totalBottles = Object.values(perWine).reduce(
      (a, b) => a + b.bottles,
      0,
    );
    const totalWithMargin = Object.values(perWine).reduce(
      (a, b) => a + b.withMargin,
      0,
    );

    return {
      perWine,
      totalBottles,
      totalWithMargin,
      reducerPct: Math.round(reducer * 100),
    };
  }, [
    eventType,
    guests,
    duration,
    profile,
    hasBeer,
    hasDrinks,
    hasSpirits,
    wines,
  ]);

  const config = EVENT_CONFIGS[eventType];
  const guestsNum = parseInt(guests) || 0;

  const otherBeverages = [
    hasBeer && "Cerveja",
    hasDrinks && "Bar de drinks",
    hasSpirits && "Destilados",
  ].filter(Boolean);

  const today = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Estilos de impressão */}
      <style>{`
        @media screen {
          #wine-print-area { display: none; }
        }
        @media print {
          #wine-screen-content { display: none !important; }
          #wine-print-area {
            display: block !important;
            padding: 32px;
            background: white;
          }
        }
      `}</style>

      {/* ------------------------------------------------------------------ */}
      {/* ÁREA DE IMPRESSÃO (oculta na tela, visível ao imprimir)             */}
      {/* ------------------------------------------------------------------ */}
      <div id="wine-print-area">
        {result && guestsNum > 0 && (
          <div
            style={{
              fontFamily: "Arial, sans-serif",
              color: "#1e293b",
              maxWidth: 680,
              margin: "0 auto",
            }}
          >
            {/* Cabeçalho */}
            <div
              style={{
                borderBottom: "3px solid #7c3aed",
                paddingBottom: 16,
                marginBottom: 24,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 28 }}>🍷</div>
              <div>
                <div
                  style={{ fontSize: 20, fontWeight: "bold", color: "#7c3aed" }}
                >
                  CRM - Grand Cru
                </div>
                <div style={{ fontSize: 14, color: "#64748b" }}>
                  Previsão de Consumo de Vinhos
                </div>
              </div>
            </div>

            {/* Dados do evento */}
            <div
              style={{
                background: "#f8f5ff",
                border: "1px solid #e9d5ff",
                borderRadius: 8,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: "bold",
                  color: "#7c3aed",
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Dados do Evento
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "6px 24px",
                  fontSize: 13,
                }}
              >
                <div>
                  <span style={{ color: "#64748b" }}>Tipo:</span>{" "}
                  <strong>{config.label}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Convidados:</span>{" "}
                  <strong>{guestsNum} pessoas</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Duração:</span>{" "}
                  <strong>{DURATION_LABELS[duration]}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Perfil:</span>{" "}
                  <strong>{PROFILE_LABELS[profile]}</strong>
                </div>
                {otherBeverages.length > 0 && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <span style={{ color: "#64748b" }}>Outras bebidas:</span>{" "}
                    <strong>{otherBeverages.join(", ")}</strong>
                    {result.reducerPct > 0 && (
                      <span
                        style={{
                          color: "#b45309",
                          fontSize: 12,
                          marginLeft: 6,
                        }}
                      >
                        (redução de {result.reducerPct}% no consumo de vinho)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tabela de vinhos */}
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: "bold",
                  color: "#7c3aed",
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Estimativa por Tipo de Vinho
              </div>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr style={{ background: "#7c3aed", color: "white" }}>
                    <th
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        borderRadius: "4px 0 0 0",
                      }}
                    >
                      Vinho
                    </th>
                    <th style={{ padding: "10px 14px", textAlign: "center" }}>
                      Proporção
                    </th>
                    <th style={{ padding: "10px 14px", textAlign: "center" }}>
                      Mínimo recomendado
                    </th>
                    <th
                      style={{
                        padding: "10px 14px",
                        textAlign: "center",
                        borderRadius: "0 4px 0 0",
                      }}
                    >
                      Com margem +10%
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {WINE_ORDER.filter(
                    (key) => wines[key] && result.perWine[key],
                  ).map((key, i) => {
                    const wine = result.perWine[key];
                    const meta = WINE_META[key];
                    return (
                      <tr
                        key={key}
                        style={{
                          background: i % 2 === 0 ? "#fafafa" : "white",
                        }}
                      >
                        <td
                          style={{
                            padding: "10px 14px",
                            fontWeight: "bold",
                            color: meta.printColor,
                          }}
                        >
                          {meta.label}
                        </td>
                        <td
                          style={{
                            padding: "10px 14px",
                            textAlign: "center",
                            color: "#64748b",
                          }}
                        >
                          {wine.pct}%
                        </td>
                        <td
                          style={{ padding: "10px 14px", textAlign: "center" }}
                        >
                          <strong>{wine.bottles}</strong>{" "}
                          {wine.bottles === 1 ? "garrafa" : "garrafas"}
                        </td>
                        <td
                          style={{
                            padding: "10px 14px",
                            textAlign: "center",
                            color: meta.printColor,
                            fontWeight: "bold",
                          }}
                        >
                          {wine.withMargin}{" "}
                          {wine.withMargin === 1 ? "garrafa" : "garrafas"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr
                    style={{
                      background: "#f0fdf4",
                      borderTop: "2px solid #7c3aed",
                    }}
                  >
                    <td
                      style={{
                        padding: "12px 14px",
                        fontWeight: "bold",
                        fontSize: 14,
                      }}
                    >
                      TOTAL
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        textAlign: "center",
                        color: "#64748b",
                      }}
                    >
                      100%
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        textAlign: "center",
                        fontWeight: "bold",
                        fontSize: 14,
                      }}
                    >
                      {result.totalBottles} garrafas
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        textAlign: "center",
                        fontWeight: "bold",
                        fontSize: 14,
                        color: "#7c3aed",
                      }}
                    >
                      {result.totalWithMargin} garrafas
                    </td>
                  </tr>
                </tbody>
              </table>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                Média: {(result.totalWithMargin / guestsNum).toFixed(2)}{" "}
                garrafas por pessoa (com margem)
              </div>
            </div>

            {/* Observações */}
            <div
              style={{
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 8,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: "bold",
                  color: "#92400e",
                  marginBottom: 8,
                }}
              >
                Observações para {config.label}
              </div>
              {EVENT_OBSERVATIONS[eventType].map((obs, i) => (
                <div
                  key={i}
                  style={{ fontSize: 12, color: "#78350f", marginBottom: 4 }}
                >
                  • {obs}
                </div>
              ))}
            </div>

            {/* Rodapé */}
            <div
              style={{
                borderTop: "1px solid #e2e8f0",
                paddingTop: 12,
                fontSize: 11,
                color: "#94a3b8",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>Gerado em {today} · CRM Grand Cru</span>
              <span>* Estimativas baseadas em médias de mercado.</span>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* INTERFACE PRINCIPAL (visível na tela)                               */}
      {/* ------------------------------------------------------------------ */}
      <div id="wine-screen-content" className="mx-auto space-y-6 pb-5">
        {/* Header */}
        <PageHeader>
          <PageHeader.Info>
            <PageHeader.Icon
              icon={Wine}
              color="text-purple-600 dark:text-purple-400"
              bgColor="bg-purple-50 dark:bg-purple-900/30"
            />
            <PageHeader.Text>
              <PageHeader.Title>Calculadora de Vinho</PageHeader.Title>
              <PageHeader.Description>
                Dimensione o consumo de vinhos para o seu evento
              </PageHeader.Description>
            </PageHeader.Text>
          </PageHeader.Info>
          <PageHeader.Actions>
            {result && guestsNum > 0 && (
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2 text-purple-600 border-purple-200 bg-white hover:bg-purple-50 dark:border-purple-800 dark:bg-slate-950 dark:hover:bg-purple-900/20">
                <FileDown className="h-4 w-4" />
                Gerar PDF
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={reset} className="gap-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
              <RotateCcw className="h-4 w-4" />
              Limpar
            </Button>
          </PageHeader.Actions>
        </PageHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ---------------------------------------------------------------- */}
          {/* COLUNA ESQUERDA — Formulário                                     */}
          {/* ---------------------------------------------------------------- */}
          <div className="space-y-5">
            {/* Dados do evento */}
            <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950">
              <CardHeader className="pb-4 border-b border-gray-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/20">
                    <PartyPopper className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                    Dados do Evento
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                <div className="space-y-1.5 flex flex-col">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Tipo de evento
                  </Label>
                  <Select
                    value={eventType}
                    onValueChange={(v) => setEventType(v as EventType)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EVENT_CONFIGS).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          {cfg.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1 pt-0.5">
                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                    {config.description}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Número de convidados</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      value={guests}
                      onChange={(e) => setGuests(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Ex: 100"
                    />
                    {guestsNum > 0 && (
                      <Badge
                        variant="outline"
                        className="shrink-0 text-purple-600 border-purple-300"
                      >
                        {guestsNum} pessoas
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Duração do evento</Label>
                  <Select
                    value={duration}
                    onValueChange={(v) => setDuration(v as Duration)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.entries(DURATION_LABELS) as [Duration, string][]
                      ).map(([val, label]) => (
                        <SelectItem key={val} value={val}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Perfil de consumo dos convidados</Label>
                  <Select
                    value={profile}
                    onValueChange={(v) => setProfile(v as Profile)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leve">Leve — bebem pouco</SelectItem>
                      <SelectItem value="moderado">
                        Moderado — consumo médio
                      </SelectItem>
                      <SelectItem value="intenso">
                        Intenso — apreciadores de vinho
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Outras bebidas */}
            <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950">
              <CardHeader className="pb-4 border-b border-gray-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/20">
                    <Beer className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                    Outras Bebidas no Evento
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1 mb-4">
                  A presença de outras bebidas reduz o consumo estimado de
                  vinho.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Cerveja
                      </p>
                      <p className="text-xs text-slate-500">
                        Reduz 15% no consumo de vinho
                      </p>
                    </div>
                    <Switch checked={hasBeer} onCheckedChange={setHasBeer} />
                  </div>
                  <Separator className="bg-slate-100 dark:bg-slate-800" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Bar de Drinks / Coquetéis
                      </p>
                      <p className="text-xs text-slate-500">
                        Reduz 15% no consumo de vinho
                      </p>
                    </div>
                    <Switch
                      checked={hasDrinks}
                      onCheckedChange={setHasDrinks}
                    />
                  </div>
                  <Separator className="bg-slate-100 dark:bg-slate-800" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Destilados (whisky, vodka…)
                      </p>
                      <p className="text-xs text-slate-500">
                        Reduz 10% no consumo de vinho
                      </p>
                    </div>
                    <Switch
                      checked={hasSpirits}
                      onCheckedChange={setHasSpirits}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Seleção de vinhos */}
            <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950">
              <CardHeader className="pb-4 border-b border-gray-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/20">
                    <Grape className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                    Vinhos do Evento
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1 mb-4">
                  Desative os vinhos que o cliente não deseja incluir. A
                  proporção é redistribuída automaticamente.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {WINE_ORDER.map((key) => {
                    const meta = WINE_META[key];
                    const isActive = wines[key];
                    const activeCount =
                      Object.values(wines).filter(Boolean).length;
                    const isLastActive = isActive && activeCount === 1;

                    return (
                      <button
                        key={key}
                        onClick={() => toggleWine(key)}
                        disabled={isLastActive}
                        className={cn(
                          "relative flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all duration-200",
                          isActive
                            ? "border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20"
                            : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-50",
                          isLastActive && "cursor-not-allowed",
                          !isLastActive && "hover:scale-[1.02] cursor-pointer",
                        )}
                      >
                        <span
                          className={cn(
                            "w-3 h-3 rounded-full shrink-0",
                            meta.dot,
                          )}
                        />
                        <div>
                          <p
                            className={cn(
                              "text-sm font-semibold",
                              isActive ? meta.color : "text-slate-400",
                            )}
                          >
                            {meta.label}
                          </p>
                          <p className="text-xs text-slate-400">
                            {isActive ? "Incluído" : "Excluído"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* COLUNA DIREITA — Resultado                                       */}
          {/* ---------------------------------------------------------------- */}
          <div className="space-y-5">
            {!result || guestsNum === 0 ? (
              <Card className="h-full flex items-center justify-center min-h-[300px] border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950">
                <div className="text-center space-y-3 p-8">
                  <div className="mx-auto w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
                    <Calculator className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                    Preencha os dados do evento para ver a estimativa de consumo
                  </p>
                </div>
              </Card>
            ) : (
              <>
                {/* Resumo geral */}
                <Card className="border-purple-200 dark:border-purple-800/60 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 shadow-md rounded-xl">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/40">
                        <Wine className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <CardTitle className="text-base font-bold text-purple-900 dark:text-purple-100">
                        Resumo do Evento
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center divide-x divide-purple-200/50 dark:divide-purple-800/50">
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600/70 dark:text-purple-400/70 mb-1">
                          Recomendado
                        </p>
                        <p className="text-3xl font-black text-purple-700 dark:text-purple-300">
                          {result.totalBottles}
                        </p>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600/70 dark:text-indigo-400/70 mb-1">
                          Com margem 10%
                        </p>
                        <p className="text-3xl font-black text-indigo-700 dark:text-indigo-300">
                          {result.totalWithMargin}
                        </p>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600/70 dark:text-slate-400/70 mb-1">
                          Garrafas / Pessoa
                        </p>
                        <p className="text-3xl font-black text-slate-700 dark:text-slate-300">
                          {(result.totalWithMargin / guestsNum).toFixed(1)}
                        </p>
                      </div>
                    </div>

                    {result.reducerPct > 0 && (
                      <div className="mt-5 flex items-center gap-2 text-xs bg-amber-100/50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg px-3 py-2.5 text-amber-700 dark:text-amber-400 font-medium">
                        <Info className="h-4 w-4 shrink-0" />
                        Estimativa reduzida em {result.reducerPct}% pela
                        presença de outras bebidas
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Cards por tipo de vinho — na ordem correta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {WINE_ORDER.filter(
                    (key) => wines[key] && result.perWine[key],
                  ).map((key) => {
                    const val = result.perWine[key];
                    const meta = WINE_META[key];

                    return (
                      <Card
                        key={key}
                        className="border-gray-200 dark:border-slate-800 shadow-sm rounded-xl bg-white dark:bg-slate-950 hover:shadow-md transition-shadow"
                      >
                        <CardContent className="p-4 sm:p-5">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={cn(
                                  "w-3.5 h-3.5 rounded-full shadow-sm",
                                  meta.dot,
                                )}
                              />
                              <span
                                className={cn(
                                  "font-bold text-sm uppercase tracking-wide",
                                  meta.color,
                                )}
                              >
                                {meta.label}
                              </span>
                            </div>
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                            >
                              {val.pct}% DO TOTAL
                            </Badge>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-end justify-between">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                Mínimo Rec.
                              </span>
                              <span className="text-xl font-black text-slate-800 dark:text-slate-200 tabular-nums">
                                {val.bottles}
                                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 ml-1.5 uppercase">
                                  {val.bottles === 1 ? "un" : "uns"}
                                </span>
                              </span>
                            </div>
                            <div className="flex items-end justify-between">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                Com margem
                              </span>
                              <span
                                className={cn(
                                  "text-lg font-black tabular-nums",
                                  meta.color,
                                )}
                              >
                                {val.withMargin}
                                <span
                                  className={cn(
                                    "text-xs font-semibold ml-1.5 uppercase opacity-70",
                                  )}
                                >
                                  {val.withMargin === 1 ? "un" : "uns"}
                                </span>
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                meta.dot,
                              )}
                              style={{ width: `${val.pct}%` }}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Observações */}
                <Card className="border-gray-200 dark:border-slate-800 shadow-sm rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-slate-500" />
                      <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        Observações para este evento
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                    {EVENT_OBSERVATIONS[eventType].map((obs, i) => (
                      <p key={i} className="flex gap-2">
                        <span className="text-slate-400 mt-0.5">•</span>
                        <span>{obs}</span>
                      </p>
                    ))}
                    <p className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800 text-slate-500">
                      * Estimativas baseadas em médias de mercado. Ajuste
                      conforme o perfil real dos convidados.
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
