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
  GlassWater,
  Info,
  PartyPopper,
  RotateCcw,
  Wine,
} from "lucide-react";

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

interface EventConfig {
  label: string;
  description: string;
  baseBottlesPerPerson: number;
  distribution: {
    tinto: number;
    branco: number;
    rose: number;
    espumante: number;
  };
}

const EVENT_CONFIGS: Record<EventType, EventConfig> = {
  casamento: {
    label: "Casamento",
    description: "Espumante lidera — brinde, entrada e celebração",
    baseBottlesPerPerson: 0.5,
    distribution: { tinto: 25, branco: 20, rose: 15, espumante: 40 },
  },
  churrasco: {
    label: "Churrasco",
    description: "Tinto domina — harmoniza com carne",
    baseBottlesPerPerson: 0.4,
    distribution: { tinto: 60, branco: 20, rose: 10, espumante: 10 },
  },
  jantar: {
    label: "Jantar Harmonizado",
    description: "Consumo quase 1:1 com convidados — cada prato tem seu vinho",
    baseBottlesPerPerson: 0.9,
    distribution: { tinto: 40, branco: 35, rose: 10, espumante: 15 },
  },
  aniversario: {
    label: "Aniversário Adulto",
    description: "Mix equilibrado com leve preferência por tinto",
    baseBottlesPerPerson: 0.4,
    distribution: { tinto: 40, branco: 25, rose: 20, espumante: 15 },
  },
  corporativo: {
    label: "Festa Corporativa",
    description: "Consumo moderado, espumante e branco em destaque",
    baseBottlesPerPerson: 0.3,
    distribution: { tinto: 25, branco: 30, rose: 15, espumante: 30 },
  },
  crianca: {
    label: "Festa Infantil",
    description: "Adultos presentes bebem pouco — foco nas crianças",
    baseBottlesPerPerson: 0.15,
    distribution: { tinto: 30, branco: 30, rose: 20, espumante: 20 },
  },
};

const DURATION_MULTIPLIERS: Record<Duration, number> = {
  "2": 0.7,
  "3": 1.0,
  "4": 1.2,
  "5": 1.4,
  "6": 1.6,
};

const PROFILE_MULTIPLIERS: Record<Profile, number> = {
  leve: 0.7,
  moderado: 1.0,
  intenso: 1.3,
};

const WINE_LABELS: Record<string, { label: string; color: string; dot: string }> = {
  tinto: { label: "Tinto", color: "text-red-700 dark:text-red-400", dot: "bg-red-700" },
  branco: { label: "Branco", color: "text-yellow-600 dark:text-yellow-400", dot: "bg-yellow-500" },
  rose: { label: "Rosé", color: "text-pink-500 dark:text-pink-400", dot: "bg-pink-400" },
  espumante: { label: "Espumante", color: "text-purple-600 dark:text-purple-400", dot: "bg-purple-500" },
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

  const [wines, setWines] = useState({
    tinto: true,
    branco: true,
    rose: true,
    espumante: true,
  });

  const toggleWine = (key: keyof typeof wines) => {
    const active = Object.values({ ...wines, [key]: !wines[key] }).filter(Boolean).length;
    if (active === 0) return; // pelo menos 1 vinho ativo
    setWines((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const reset = () => {
    setEventType("casamento");
    setGuests("50");
    setDuration("3");
    setProfile("moderado");
    setHasBeer(false);
    setHasDrinks(false);
    setHasSpirits(false);
    setWines({ tinto: true, branco: true, rose: true, espumante: true });
  };

  // -------------------------------------------------------------------------
  // Cálculo
  // -------------------------------------------------------------------------

  const result = useMemo(() => {
    const numGuests = parseInt(guests) || 0;
    if (numGuests <= 0) return null;

    const config = EVENT_CONFIGS[eventType];

    // Redutores de contexto
    let reducer = 0;
    if (hasBeer) reducer += 0.15;
    if (hasDrinks) reducer += 0.15;
    if (hasSpirits) reducer += 0.10;
    reducer = Math.min(reducer, 0.5); // máximo 50% de redução

    // Total de garrafas
    const total =
      numGuests *
      config.baseBottlesPerPerson *
      DURATION_MULTIPLIERS[duration] *
      PROFILE_MULTIPLIERS[profile] *
      (1 - reducer);

    // Redistribuir % entre vinhos ativos
    const activeDist = Object.entries(config.distribution).reduce(
      (acc, [key, pct]) => {
        if (wines[key as keyof typeof wines]) acc[key] = pct;
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalActivePct = Object.values(activeDist).reduce((a, b) => a + b, 0);

    const perWine = Object.entries(activeDist).reduce(
      (acc, [key, pct]) => {
        const bottles = (total * pct) / totalActivePct;
        acc[key] = {
          bottles: Math.ceil(bottles),
          withMargin: Math.ceil(bottles * 1.1),
        };
        return acc;
      },
      {} as Record<string, { bottles: number; withMargin: number }>,
    );

    const totalBottles = Object.values(perWine).reduce((a, b) => a + b.bottles, 0);
    const totalWithMargin = Object.values(perWine).reduce((a, b) => a + b.withMargin, 0);

    return { perWine, totalBottles, totalWithMargin, reducerPct: Math.round(reducer * 100) };
  }, [eventType, guests, duration, profile, hasBeer, hasDrinks, hasSpirits, wines]);

  const config = EVENT_CONFIGS[eventType];
  const guestsNum = parseInt(guests) || 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-purple-100 dark:bg-purple-900/30 rounded-xl p-2.5">
            <Wine className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Calculadora de Vinho
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Dimensione o consumo de vinhos para o seu evento
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={reset} className="gap-2 text-slate-500">
          <RotateCcw className="h-4 w-4" />
          Limpar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ------------------------------------------------------------------ */}
        {/* COLUNA ESQUERDA — Formulário                                        */}
        {/* ------------------------------------------------------------------ */}
        <div className="space-y-5">
          {/* Dados do evento */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PartyPopper className="h-4 w-4 text-purple-500" />
                Dados do Evento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tipo de evento */}
              <div className="space-y-1.5">
                <Label>Tipo de evento</Label>
                <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
                  <SelectTrigger>
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
                {eventType && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1 pt-0.5">
                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                    {config.description}
                  </p>
                )}
              </div>

              {/* Nº de convidados */}
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
                    <Badge variant="outline" className="shrink-0 text-purple-600 border-purple-300">
                      {guestsNum} pessoas
                    </Badge>
                  )}
                </div>
              </div>

              {/* Duração */}
              <div className="space-y-1.5">
                <Label>Duração do evento</Label>
                <Select value={duration} onValueChange={(v) => setDuration(v as Duration)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 horas</SelectItem>
                    <SelectItem value="3">3 horas</SelectItem>
                    <SelectItem value="4">4 horas</SelectItem>
                    <SelectItem value="5">5 horas</SelectItem>
                    <SelectItem value="6">6 horas ou mais</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Perfil de consumo */}
              <div className="space-y-1.5">
                <Label>Perfil de consumo dos convidados</Label>
                <Select value={profile} onValueChange={(v) => setProfile(v as Profile)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leve">Leve — bebem pouco</SelectItem>
                    <SelectItem value="moderado">Moderado — consumo médio</SelectItem>
                    <SelectItem value="intenso">Intenso — apreciadores de vinho</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Outras bebidas no evento */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Beer className="h-4 w-4 text-amber-500" />
                Outras Bebidas no Evento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                A presença de outras bebidas reduz o consumo estimado de vinho.
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Cerveja</p>
                    <p className="text-xs text-slate-400">Reduz 15% no consumo de vinho</p>
                  </div>
                  <Switch checked={hasBeer} onCheckedChange={setHasBeer} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Bar de Drinks / Coquetéis</p>
                    <p className="text-xs text-slate-400">Reduz 15% no consumo de vinho</p>
                  </div>
                  <Switch checked={hasDrinks} onCheckedChange={setHasDrinks} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Destilados (whisky, vodka…)</p>
                    <p className="text-xs text-slate-400">Reduz 10% no consumo de vinho</p>
                  </div>
                  <Switch checked={hasSpirits} onCheckedChange={setHasSpirits} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seleção de vinhos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <GlassWater className="h-4 w-4 text-purple-500" />
                Vinhos do Evento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Desative os vinhos que o cliente não deseja incluir. A proporção é redistribuída automaticamente.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(wines) as (keyof typeof wines)[]).map((key) => {
                  const meta = WINE_LABELS[key];
                  const isActive = wines[key];
                  const activeCount = Object.values(wines).filter(Boolean).length;
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
                      <span className={cn("w-3 h-3 rounded-full shrink-0", meta.dot)} />
                      <div>
                        <p className={cn("text-sm font-semibold", isActive ? meta.color : "text-slate-400")}>
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

        {/* ------------------------------------------------------------------ */}
        {/* COLUNA DIREITA — Resultado                                          */}
        {/* ------------------------------------------------------------------ */}
        <div className="space-y-5">
          {!result || guestsNum === 0 ? (
            <Card className="h-full flex items-center justify-center min-h-[300px]">
              <div className="text-center space-y-3 p-8">
                <Calculator className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-slate-400 dark:text-slate-500 text-sm">
                  Preencha os dados do evento para ver a estimativa
                </p>
              </div>
            </Card>
          ) : (
            <>
              {/* Resumo geral */}
              <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-purple-700 dark:text-purple-300 flex items-center gap-2">
                    <Wine className="h-4 w-4" />
                    Resumo do Evento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                        {result.totalBottles}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">garrafas mínimo</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-indigo-700 dark:text-indigo-300">
                        {result.totalWithMargin}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">com margem +10%</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-slate-700 dark:text-slate-300">
                        {(result.totalWithMargin / guestsNum).toFixed(1)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">garrafas / pessoa</p>
                    </div>
                  </div>

                  {result.reducerPct > 0 && (
                    <div className="mt-4 flex items-center gap-2 text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2 text-amber-700 dark:text-amber-400">
                      <Info className="h-3.5 w-3.5 shrink-0" />
                      Estimativa reduzida em {result.reducerPct}% pela presença de outras bebidas
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Cards por tipo de vinho */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(result.perWine).map(([key, val]) => {
                  const meta = WINE_LABELS[key];
                  const dist = EVENT_CONFIGS[eventType].distribution;
                  const activeDist = Object.entries(dist).reduce((acc, [k, pct]) => {
                    if (wines[k as keyof typeof wines]) acc[k] = pct;
                    return acc;
                  }, {} as Record<string, number>);
                  const totalPct = Object.values(activeDist).reduce((a, b) => a + b, 0);
                  const effectivePct = Math.round(((activeDist[key] ?? 0) / totalPct) * 100);

                  return (
                    <Card key={key} className="border-slate-200 dark:border-slate-700">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className={cn("w-3 h-3 rounded-full", meta.dot)} />
                            <span className={cn("font-semibold text-sm", meta.color)}>
                              {meta.label}
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {effectivePct}% do total
                          </Badge>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-end justify-between">
                            <span className="text-xs text-slate-500">Mínimo recomendado</span>
                            <span className="text-xl font-bold text-slate-800 dark:text-slate-200">
                              {val.bottles}
                              <span className="text-xs font-normal text-slate-400 ml-1">
                                {val.bottles === 1 ? "garrafa" : "garrafas"}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-end justify-between">
                            <span className="text-xs text-slate-500">Com margem de segurança</span>
                            <span className="text-base font-semibold text-purple-600 dark:text-purple-400">
                              {val.withMargin}
                              <span className="text-xs font-normal text-slate-400 ml-1">
                                {val.withMargin === 1 ? "garrafa" : "garrafas"}
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Barra de proporção */}
                        <div className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", meta.dot)}
                            style={{ width: `${effectivePct}%` }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Observações contextuais */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Observações para este evento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
                  {eventType === "casamento" && (
                    <>
                      <p>• Separe o espumante para a entrada e o brinde — é o primeiro vinho a ser servido.</p>
                      <p>• Considere ter uma garrafa de tinto na mesa para os convidados que preferem ao longo do jantar.</p>
                    </>
                  )}
                  {eventType === "churrasco" && (
                    <>
                      <p>• O tinto vai bem gelado em dias quentes — deixe opções de temperatura variada.</p>
                      <p>• Tintos encorpados (Malbec, Cabernet) harmonizam melhor com carnes vermelhas.</p>
                    </>
                  )}
                  {eventType === "jantar" && (
                    <>
                      <p>• Em jantares harmonizados, sirva um vinho por prato — planeje a sequência com o cardápio.</p>
                      <p>• Comece sempre com os mais leves (branco/espumante) e vá para os encorpados (tinto).</p>
                    </>
                  )}
                  {eventType === "aniversario" && (
                    <>
                      <p>• Um brinde com espumante no início do evento é prático e bem recebido.</p>
                      <p>• Rosé é uma boa escolha para festas com público misto.</p>
                    </>
                  )}
                  {eventType === "corporativo" && (
                    <>
                      <p>• Prefira rótulos versáteis e acessíveis — evite vinhos muito tânicos em eventos corporativos.</p>
                      <p>• Espumante e branco costumam ser os preferidos em happy hours e confraternizações.</p>
                    </>
                  )}
                  {eventType === "crianca" && (
                    <>
                      <p>• O foco são as crianças — considere apenas um tipo de vinho para simplificar.</p>
                      <p>• Espumante para o brinde dos adultos é suficiente na maioria dos casos.</p>
                    </>
                  )}
                  <p className="pt-1 text-slate-400">
                    * Estimativas baseadas em médias de mercado. Ajuste conforme o perfil real dos convidados.
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
