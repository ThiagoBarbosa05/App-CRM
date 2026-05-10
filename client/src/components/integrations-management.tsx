import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plug } from "lucide-react";
import BlingAccountsManagement from "@/components/bling-accounts-management";
import { TelephonyAISettings } from "@/components/telephony-ai-settings";
import { useQuery } from "@tanstack/react-query";
import { useBlingAccounts } from "@/hooks/use-bling-accounts";

interface TelephonyStatus {
  twilio: boolean;
  elevenlabs: boolean;
  voiceSdk: boolean;
}

function IntegrationTab({
  value,
  activeValue,
  logo,
  label,
  statusDot,
}: {
  value: string;
  activeValue: string;
  logo: React.ReactNode;
  label: string;
  statusDot?: boolean | null;
}) {
  const isActive = value === activeValue;

  return (
    <TabsTrigger
      value={value}
      className="flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-200
        data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900
        data-[state=active]:shadow-md
        data-[state=inactive]:bg-transparent
        text-slate-500 dark:text-slate-400
        hover:text-slate-800 dark:hover:text-slate-200
        hover:bg-white/60 dark:hover:bg-slate-800/60
        border border-transparent data-[state=active]:border-slate-200/80 dark:data-[state=active]:border-slate-700/80
        h-auto group"
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 group-data-[state=active]:bg-slate-50 dark:group-data-[state=active]:bg-slate-700/60 transition-colors shrink-0">
        {logo}
      </div>
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-data-[state=inactive]:text-slate-500">
        {label}
      </span>
      {statusDot !== undefined && statusDot !== null && (
        <div
          className={`ml-auto shrink-0 w-2 h-2 rounded-full transition-colors ${statusDot ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
        />
      )}
    </TabsTrigger>
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
  const telephonyActive = twilioActive || elevenLabsActive;

  return (
    <div className="space-y-6">
      {/* Cabeçalho da seção */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 shrink-0">
          <Plug className="size-5 text-slate-600 dark:text-slate-300" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Integrações</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gerencie as conexões do CRM com serviços externos.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {blingConnected && (
            <Badge variant="outline" className="border-[#5ac782]/40 bg-[#5ac782]/10 text-[#3a9960] dark:text-[#5ac782] text-xs">
              Bling ativo
            </Badge>
          )}
          {twilioActive && (
            <Badge variant="outline" className="border-[#F22F46]/30 bg-[#F22F46]/5 text-[#F22F46] text-xs">
              Twilio ativo
            </Badge>
          )}
          {elevenLabsActive && (
            <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 text-xs">
              ElevenLabs ativo
            </Badge>
          )}
        </div>
      </div>

      {/* Sub-navegação e conteúdo */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="p-1.5 bg-slate-100/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
          <TabsList className="flex flex-wrap gap-1.5 h-auto bg-transparent p-0 w-full">
            <IntegrationTab
              value="bling"
              activeValue={activeTab}
              label="Bling"
              statusDot={blingConnected}
              logo={<img src="/bling.svg" alt="Bling" className="h-4 w-auto" />}
            />
            <IntegrationTab
              value="telephony"
              activeValue={activeTab}
              label="Twilio & ElevenLabs"
              statusDot={telephonyActive}
              logo={
                <div className="flex items-center gap-1.5">
                  <img src="/twilio-login-logo.svg" alt="Twilio" className="h-3 w-auto" />
                  <span className="text-slate-300 dark:text-slate-600 text-[10px]">·</span>
                  <img src="/elevenlabs-logo-black.svg" alt="ElevenLabs" className="h-2.5 w-auto dark:invert" />
                </div>
              }
            />
          </TabsList>
        </div>

        <TabsContent value="bling" className="mt-0">
          <BlingAccountsManagement />
        </TabsContent>

        <TabsContent value="telephony" className="mt-0">
          <TelephonyAISettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
