import { motion } from "framer-motion";
import { Wine, Settings, Target, Factory } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Seller {
  id: string;
  name: string;
  email?: string;
  role: string;
}

interface ProductGoalRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  productId: string;
  productName: string;
  productGoalQty: number;
  achieved: number;
  month: number;
  year: number;
}

interface WineryGoalRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  wineryName: string;
  goalQty: number;
  startDate: string;
  endDate: string;
  achieved: number;
}

interface ProductGoalsTabProps {
  productGoals: ProductGoalRow[];
  wineryGoals: WineryGoalRow[];
  sellers: Seller[];
  isLoading: boolean;
  selectedMonth: number;
  selectedYear: number;
  onManage: (userId: string, userName: string) => void;
  isAdmin: boolean;
}

function getProgressTone(pct: number) {
  if (pct >= 100) return {
    bar: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    badge: "Meta batida 🏆",
  };
  if (pct >= 70) return {
    bar: "bg-amber-400",
    text: "text-amber-600 dark:text-amber-400",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    badge: "Em andamento",
  };
  return {
    bar: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
    badge: "Abaixo da meta",
  };
}

function formatDateBR(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function ProductGoalsTab({
  productGoals,
  wineryGoals,
  sellers,
  isLoading,
  selectedMonth,
  selectedYear,
  onManage,
  isAdmin,
}: ProductGoalsTabProps) {
  const monthLabel = new Date(selectedYear, selectedMonth - 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const vendedores = sellers.filter((s) => s.role === "vendedor");

  // Group product goals by userId
  const goalsByUser = new Map<string, { userName: string; userEmail: string; goals: ProductGoalRow[] }>();
  for (const g of productGoals) {
    if (!goalsByUser.has(g.userId)) {
      goalsByUser.set(g.userId, { userName: g.userName, userEmail: g.userEmail, goals: [] });
    }
    goalsByUser.get(g.userId)!.goals.push(g);
  }

  // Group winery goals by userId
  const wineryGoalsByUser = new Map<string, WineryGoalRow[]>();
  for (const g of wineryGoals) {
    if (!wineryGoalsByUser.has(g.userId)) {
      wineryGoalsByUser.set(g.userId, []);
    }
    wineryGoalsByUser.get(g.userId)!.push(g);
  }

  const sellerIdsWithGoals = new Set([
    ...goalsByUser.keys(),
    ...wineryGoalsByUser.keys(),
  ]);
  const sellersWithoutGoals = vendedores.filter((s) => !sellerIdsWithGoals.has(s.id));

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="rounded-[2rem] border-0 shadow-lg">
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-5 w-32 rounded-xl" />
              <Skeleton className="h-8 w-full rounded-xl" />
              <Skeleton className="h-3 w-full rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (vendedores.length === 0) {
    return (
      <div className="text-center py-24 bg-white/50 dark:bg-slate-900/50 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 dark:bg-slate-800 mb-6 text-slate-300">
          <Wine className="h-10 w-10" />
        </div>
        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Nenhum vendedor</h3>
        <p className="text-slate-500 mt-2 font-medium">Cadastre usuários com perfil de vendedor para definir metas de produto.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header card */}
      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-violet-50/50 to-purple-50/50 dark:from-violet-900/10 dark:to-purple-900/10 border-b border-slate-100 dark:border-slate-800 p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-violet-600 shadow-lg shadow-violet-500/20 rounded-2xl p-3">
                <Wine className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Metas de Produto
                </CardTitle>
                <CardDescription className="text-slate-500 font-medium capitalize">{monthLabel}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center px-4">
                <p className="text-2xl font-black text-violet-600 dark:text-violet-400">{sellerIdsWithGoals.size}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Com meta</p>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
              <div className="text-center px-4">
                <p className="text-2xl font-black text-slate-400">{sellersWithoutGoals.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sem meta</p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Sellers WITH goals */}
      {sellerIdsWithGoals.size > 0 && (
        <div className="space-y-4">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
            Vendedores com meta definida
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {vendedores
              .filter((s) => sellerIdsWithGoals.has(s.id))
              .map((seller, idx) => {
                const pg = goalsByUser.get(seller.id);
                const wg = wineryGoalsByUser.get(seller.id) ?? [];
                const userName = pg?.userName ?? seller.name;
                const userEmail = pg?.userEmail ?? seller.email ?? "";
                const productGoalsList = pg?.goals ?? [];

                const totalGoal =
                  productGoalsList.reduce((s, g) => s + g.productGoalQty, 0) +
                  wg.reduce((s, g) => s + g.goalQty, 0);
                const totalAchieved =
                  productGoalsList.reduce((s, g) => s + g.achieved, 0) +
                  wg.reduce((s, g) => s + g.achieved, 0);
                const overallPct = totalGoal > 0 ? Math.min((totalAchieved / totalGoal) * 100, 100) : 0;
                const tone = getProgressTone(overallPct);

                return (
                  <motion.div
                    key={seller.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06 }}
                  >
                    <Card className="rounded-[2rem] border border-slate-200/80 dark:border-slate-800 shadow-md hover:shadow-xl transition-all duration-300 bg-white dark:bg-slate-950 overflow-hidden group">
                      <CardContent className="p-6 space-y-4">
                        {/* Seller + badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 text-violet-700 dark:text-violet-300 text-xs font-black shadow-sm">
                              {userName?.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-black text-sm uppercase tracking-tight text-slate-900 dark:text-white truncate">
                                {userName}
                              </p>
                              <p className="text-[10px] font-bold text-slate-400 truncate">{userEmail}</p>
                            </div>
                          </div>
                          <Badge className={`shrink-0 text-[9px] font-black uppercase tracking-wide border ${tone.badgeClass} rounded-full px-2.5 py-1`}>
                            {tone.badge}
                          </Badge>
                        </div>

                        {/* Metas por produto */}
                        {productGoalsList.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[9px] font-black uppercase tracking-widest text-violet-400 ml-0.5 flex items-center gap-1">
                              <Wine className="h-2.5 w-2.5" /> Por Produto
                            </p>
                            {productGoalsList.map((g) => {
                              const pct = g.productGoalQty > 0
                                ? Math.min((g.achieved / g.productGoalQty) * 100, 100)
                                : 0;
                              const t = getProgressTone(pct);
                              return (
                                <div key={g.id} className="rounded-xl border border-violet-100 dark:border-violet-900/30 bg-violet-50/50 dark:bg-violet-900/10 px-3 py-2.5 space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Wine className="h-3 w-3 text-violet-500 shrink-0" />
                                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{g.productName}</p>
                                    </div>
                                    <span className={`text-[10px] font-black tabular-nums ${t.text} shrink-0`}>
                                      {g.achieved}/{g.productGoalQty} un
                                    </span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${pct}%` }}
                                      transition={{ duration: 0.8, ease: "easeOut" }}
                                      className={`h-full rounded-full ${t.bar}`}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Metas por vinícola */}
                        {wg.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 ml-0.5 flex items-center gap-1">
                              <Factory className="h-2.5 w-2.5" /> Por Vinícola
                            </p>
                            {wg.map((g) => {
                              const pct = g.goalQty > 0
                                ? Math.min((g.achieved / g.goalQty) * 100, 100)
                                : 0;
                              const t = getProgressTone(pct);
                              return (
                                <div key={g.id} className="rounded-xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2.5 space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Factory className="h-3 w-3 text-amber-500 shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{g.wineryName}</p>
                                        <p className="text-[9px] text-slate-400 font-medium">
                                          {formatDateBR(g.startDate)} → {formatDateBR(g.endDate)}
                                        </p>
                                      </div>
                                    </div>
                                    <span className={`text-[10px] font-black tabular-nums ${t.text} shrink-0`}>
                                      {g.achieved}/{g.goalQty} un
                                    </span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${pct}%` }}
                                      transition={{ duration: 0.8, ease: "easeOut" }}
                                      className={`h-full rounded-full ${t.bar}`}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Manage button */}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onManage(seller.id, userName)}
                            className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Settings className="h-3.5 w-3.5 mr-2" />
                            Gerenciar metas
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
          </div>
        </div>
      )}

      {/* Sellers WITHOUT goals */}
      {sellersWithoutGoals.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
            Vendedores sem meta de produto
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sellersWithoutGoals.map((seller, idx) => (
              <motion.div
                key={seller.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <div className="flex items-center justify-between rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 px-5 py-4 group hover:border-violet-300 dark:hover:border-violet-700 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-black">
                      {seller.name?.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-tight text-slate-600 dark:text-slate-300">
                        {seller.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">Sem produto definido</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onManage(seller.id, seller.name)}
                      className="h-8 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-violet-500 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20 opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-violet-200 dark:hover:border-violet-800"
                    >
                      <Target className="h-3 w-3 mr-1.5" />
                      Definir
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
