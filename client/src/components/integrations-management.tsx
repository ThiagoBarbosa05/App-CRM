import { useState } from "react";
import {
  AppTabs,
  PillTabsList,
  PillTabsTrigger,
  AppTabsContent,
} from "@/components/app-tabs";
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
      <AppTabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <PillTabsList>
          <PillTabsTrigger value="bling" color="green" className="gap-2.5 px-4 py-2.5" title="Bling">
            <img src="/bling.svg" alt="Bling" className="h-4 w-auto" />
            <StatusDot active={blingConnected} />
          </PillTabsTrigger>

          <PillTabsTrigger value="twilio" color="red" className="gap-2.5 px-4 py-2.5" title="Twilio">
            <img src="/twilio-login-logo.svg" alt="Twilio" className="h-3.5 w-auto" />
            <StatusDot active={twilioActive} />
          </PillTabsTrigger>

          <PillTabsTrigger value="elevenlabs" color="teal" className="gap-2.5 px-4 py-2.5" title="ElevenLabs">
            <img src="/elevenlabs-logo-black.svg" alt="ElevenLabs" className="h-3 w-auto dark:invert" />
            <StatusDot active={elevenLabsActive} />
          </PillTabsTrigger>
        </PillTabsList>

        <AppTabsContent value="bling" className="mt-0">
          <BlingAccountsManagement />
        </AppTabsContent>

        <AppTabsContent value="twilio" className="mt-0">
          <TelephonyAISettings activeTab="twilio" />
        </AppTabsContent>

        <AppTabsContent value="elevenlabs" className="mt-0">
          <TelephonyAISettings activeTab="elevenlabs" />
        </AppTabsContent>
      </AppTabs>
    </div>
  );
}
