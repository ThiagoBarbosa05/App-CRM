import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import BlingAccountsManagement from "@/components/bling-accounts-management";
import { TelephonyAISettings } from "@/components/telephony-ai-settings";
import { useQuery } from "@tanstack/react-query";
import { useBlingAccounts } from "@/hooks/use-bling-accounts";

interface TelephonyStatus {
  twilio: boolean;
  elevenlabs: boolean;
  voiceSdk: boolean;
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <div
      className={`shrink-0 w-2 h-2 rounded-full transition-colors ${active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
    />
  );
}

export function IntegrationsManagement() {
  const [activeTab, setActiveTab] = useState("bling");

  const { data: blingConnections = [] } = useBlingAccounts();
  const { data: telephonyStatus } = useQuery<TelephonyStatus>({
    queryKey: ["/api/telephony-settings/status"],
    queryFn: async () => {
      const res = await fetch("/api/telephony-settings/status", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar status");
      return res.json();
    },
  });

  const blingConnected = blingConnections.some((c) => c.status === "connected");
  const twilioActive = telephonyStatus?.twilio ?? false;
  const elevenLabsActive = telephonyStatus?.elevenlabs ?? false;

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="p-1.5 bg-slate-100/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
          <TabsList className="flex flex-wrap gap-1.5 h-auto bg-transparent p-0 w-full">
            {/* Bling */}
            <TabsTrigger
              value="bling"
              className="flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-200
                data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900
                data-[state=active]:shadow-md data-[state=active]:shadow-[#5ac782]/10
                data-[state=active]:border data-[state=active]:border-[#5ac782]/20 dark:data-[state=active]:border-[#5ac782]/15
                border border-transparent
                text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200
                hover:bg-white/60 dark:hover:bg-slate-800/60 h-auto group"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#5ac782]/10 group-data-[state=active]:bg-[#5ac782]/15 transition-colors shrink-0">
                <img src="/bling.svg" alt="Bling" className="h-4 w-auto" />
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-data-[state=inactive]:text-slate-500">
                Bling
              </span>
              <StatusDot active={blingConnected} />
            </TabsTrigger>

            {/* Twilio */}
            <TabsTrigger
              value="twilio"
              className="flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-200
                data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900
                data-[state=active]:shadow-md data-[state=active]:shadow-red-500/10
                data-[state=active]:border data-[state=active]:border-red-200/60 dark:data-[state=active]:border-red-800/30
                border border-transparent
                text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200
                hover:bg-white/60 dark:hover:bg-slate-800/60 h-auto group"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#F22F46]/10 group-data-[state=active]:bg-[#F22F46]/15 transition-colors shrink-0">
                <img src="/twilio-login-logo.svg" alt="Twilio" className="h-3.5 w-auto" />
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-data-[state=inactive]:text-slate-500">
                Twilio
              </span>
              <StatusDot active={twilioActive} />
            </TabsTrigger>

            {/* ElevenLabs */}
            <TabsTrigger
              value="elevenlabs"
              className="flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-200
                data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900
                data-[state=active]:shadow-md data-[state=active]:shadow-slate-500/10
                data-[state=active]:border data-[state=active]:border-slate-200/60 dark:data-[state=active]:border-slate-700/40
                border border-transparent
                text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200
                hover:bg-white/60 dark:hover:bg-slate-800/60 h-auto group"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 group-data-[state=active]:bg-slate-200/80 dark:bg-slate-800 dark:group-data-[state=active]:bg-slate-700/60 transition-colors shrink-0">
                <img src="/elevenlabs-logo-black.svg" alt="ElevenLabs" className="h-3 w-auto dark:invert" />
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-data-[state=inactive]:text-slate-500">
                ElevenLabs
              </span>
              <StatusDot active={elevenLabsActive} />
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="bling" className="mt-0">
          <BlingAccountsManagement />
        </TabsContent>

        <TabsContent value="twilio" className="mt-0">
          <TelephonyAISettings activeTab="twilio" />
        </TabsContent>

        <TabsContent value="elevenlabs" className="mt-0">
          <TelephonyAISettings activeTab="elevenlabs" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
