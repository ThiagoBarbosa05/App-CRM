import { lazy, Suspense, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BarChart2, History, Phone, Radio } from "lucide-react";

const Dialer = lazy(() =>
  import("@/components/telemarketing/dialer").then((module) => ({
    default: module.Dialer,
  })),
);

const CampaignsList = lazy(() =>
  import("@/components/telemarketing/campaigns-list").then((module) => ({
    default: module.CampaignsList,
  })),
);

const CallsHistory = lazy(() =>
  import("@/components/telemarketing/calls-history").then((module) => ({
    default: module.CallsHistory,
  })),
);

const DashboardMetrics = lazy(() =>
  import("@/components/telemarketing/dashboard-metrics").then((module) => ({
    default: module.DashboardMetrics,
  })),
);

const TELEMARKETING_TABS = [
  {
    value: "dashboard",
    label: "Dashboard",
    icon: BarChart2,
    accent:
      "data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300 data-[state=active]:border-indigo-200 dark:data-[state=active]:border-indigo-900/70 data-[state=active]:bg-indigo-50/70 dark:data-[state=active]:bg-indigo-950/30",
    iconAccent:
      "group-data-[state=active]:bg-indigo-100 group-data-[state=active]:text-indigo-700 dark:group-data-[state=active]:bg-indigo-950/60 dark:group-data-[state=active]:text-indigo-300",
  },
  {
    value: "dialer",
    label: "Discador",
    icon: Phone,
    accent:
      "data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:border-blue-200 dark:data-[state=active]:border-blue-900/70 data-[state=active]:bg-blue-50/70 dark:data-[state=active]:bg-blue-950/30",
    iconAccent:
      "group-data-[state=active]:bg-blue-100 group-data-[state=active]:text-blue-700 dark:group-data-[state=active]:bg-blue-950/60 dark:group-data-[state=active]:text-blue-300",
  },
  {
    value: "campaigns",
    label: "Campanhas",
    icon: Radio,
    accent:
      "data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-300 data-[state=active]:border-violet-200 dark:data-[state=active]:border-violet-900/70 data-[state=active]:bg-violet-50/70 dark:data-[state=active]:bg-violet-950/30",
    iconAccent:
      "group-data-[state=active]:bg-violet-100 group-data-[state=active]:text-violet-700 dark:group-data-[state=active]:bg-violet-950/60 dark:group-data-[state=active]:text-violet-300",
  },
  {
    value: "history",
    label: "Histórico",
    icon: History,
    accent:
      "data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-200 dark:data-[state=active]:border-emerald-900/70 data-[state=active]:bg-emerald-50/70 dark:data-[state=active]:bg-emerald-950/30",
    iconAccent:
      "group-data-[state=active]:bg-emerald-100 group-data-[state=active]:text-emerald-700 dark:group-data-[state=active]:bg-emerald-950/60 dark:group-data-[state=active]:text-emerald-300",
  },
] as const;

type TelemarketingTabValue = (typeof TELEMARKETING_TABS)[number]["value"];

const INITIAL_TAB_READY_STATE: Record<TelemarketingTabValue, boolean> = {
  dashboard: false,
  dialer: false,
  campaigns: false,
  history: false,
};

function DialerTabSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(340px,400px)_minmax(0,1fr)] xl:gap-6 2xl:grid-cols-[400px_minmax(0,1fr)]">
      <div className="space-y-5">
        <Skeleton className="h-[52px] rounded-2xl" />
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="space-y-5">
            <Skeleton className="h-14 rounded-2xl" />
            <div className="grid grid-cols-3 gap-3 sm:gap-3.5">
              {Array.from({ length: 12 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-14 rounded-2xl sm:h-[58px]"
                />
              ))}
            </div>
            <div className="flex justify-center border-t border-slate-100 pt-5 dark:border-slate-800">
              <Skeleton className="h-16 w-16 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="space-y-4 border-b border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/70 sm:p-5">
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-11 rounded-2xl" />
        </div>
        <div className="p-4 sm:p-5">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-2 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-20 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CampaignsTabSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32 rounded-lg" />
          <Skeleton className="h-4 w-40 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-32 rounded-2xl" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-2xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28 rounded-lg" />
                    <Skeleton className="h-3 w-24 rounded-lg" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-px w-full rounded-none" />
              <div className="space-y-2">
                <Skeleton className="h-9 rounded-xl" />
                <Skeleton className="h-9 rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryTabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40 rounded-lg" />
          <Skeleton className="h-4 w-48 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-full rounded-2xl sm:w-52" />
      </div>

      <div className="space-y-2">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-16 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function TelemarketingTabPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
      {children}
    </div>
  );
}

export default function TelemarketingPage() {
  const [activeTab, setActiveTab] = useState<TelemarketingTabValue>("dashboard");
  const [readyTabs, setReadyTabs] = useState(INITIAL_TAB_READY_STATE);

  useEffect(() => {
    if (readyTabs[activeTab]) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setReadyTabs((currentReadyTabs) => ({
        ...currentReadyTabs,
        [activeTab]: true,
      }));
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [activeTab, readyTabs]);

  return (
    <div className="space-y-6 pb-10">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40">
              <Phone className="size-6 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Telemarketing
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                Discador WebRTC, campanhas de voz e historico de chamadas em um
                unico fluxo operacional.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:max-w-[420px] lg:justify-end">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              WebRTC
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              Campanhas com IA
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              Historico centralizado
            </span>
          </div>
        </div>
      </section>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TelemarketingTabValue)}
        className="space-y-6"
      >
        <div className="overflow-x-auto no-scrollbar">
          <TabsList className="flex h-auto w-max min-w-full items-center justify-start gap-2 bg-transparent p-0">
            {TELEMARKETING_TABS.map((tab) => {
              const Icon = tab.icon;

              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-xl border border-transparent px-4 py-3 text-sm font-bold text-slate-500 transition-all duration-200 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/70 dark:hover:text-slate-100 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900",
                    tab.accent,
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors dark:bg-slate-900 dark:text-slate-400",
                      tab.iconAccent,
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                  </span>
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent
          value="dashboard"
          forceMount
          className="m-0 outline-none data-[state=inactive]:hidden"
        >
          <TelemarketingTabPanel>
            {readyTabs.dashboard ? (
              <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />}>
                <DashboardMetrics />
              </Suspense>
            ) : (
              <div className="h-96 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
            )}
          </TelemarketingTabPanel>
        </TabsContent>

        <TabsContent
          value="dialer"
          forceMount
          className="m-0 outline-none data-[state=inactive]:hidden"
        >
          <TelemarketingTabPanel>
            {readyTabs.dialer ? (
              <Suspense fallback={<DialerTabSkeleton />}>
                <Dialer />
              </Suspense>
            ) : (
              <DialerTabSkeleton />
            )}
          </TelemarketingTabPanel>
        </TabsContent>

        <TabsContent
          value="campaigns"
          forceMount
          className="m-0 outline-none data-[state=inactive]:hidden"
        >
          <TelemarketingTabPanel>
            {readyTabs.campaigns ? (
              <Suspense fallback={<CampaignsTabSkeleton />}>
                <CampaignsList />
              </Suspense>
            ) : (
              <CampaignsTabSkeleton />
            )}
          </TelemarketingTabPanel>
        </TabsContent>

        <TabsContent
          value="history"
          forceMount
          className="m-0 outline-none data-[state=inactive]:hidden"
        >
          <TelemarketingTabPanel>
            {readyTabs.history ? (
              <Suspense fallback={<HistoryTabSkeleton />}>
                <CallsHistory />
              </Suspense>
            ) : (
              <HistoryTabSkeleton />
            )}
          </TelemarketingTabPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
