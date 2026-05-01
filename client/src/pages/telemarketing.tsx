import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { History, Phone, Radio } from "lucide-react";
import { Dialer } from "@/components/telemarketing/dialer";
import { CampaignsList } from "@/components/telemarketing/campaigns-list";
import { CallsHistory } from "@/components/telemarketing/calls-history";

const TELEMARKETING_TABS = [
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

export default function TelemarketingPage() {
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

      <Tabs defaultValue="dialer" className="space-y-6">
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

        <TabsContent value="dialer" className="m-0 outline-none">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
            <Dialer />
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="m-0 outline-none">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
            <CampaignsList />
          </div>
        </TabsContent>

        <TabsContent value="history" className="m-0 outline-none">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
            <CallsHistory />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
