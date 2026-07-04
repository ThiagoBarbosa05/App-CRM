import { useState } from "react";
import {
  AppTabs,
  PillTabsList,
  PillTabsTrigger,
  AppTabsContent,
} from "@/components/app-tabs";
import BlingAccountsManagement from "@/components/bling-accounts-management";
import { TelephonyAISettings } from "@/components/telephony-ai-settings";
import { WhatsappSettingsManagement } from "@/components/whatsapp-settings-management";
import { useQuery } from "@tanstack/react-query";
import { useBlingAccounts } from "@/hooks/use-bling-accounts";
import { useWhatsappStatus } from "@/hooks/use-whatsapp-settings";
import { useAssertivaStatus } from "@/hooks/use-assertiva-status";
import { AssertivaIntegrationManagement } from "@/components/assertiva-integration-management";
import { cn } from "@/lib/utils";

interface TelephonyStatus {
  twilio: boolean;
  elevenlabs: boolean;
  voiceSdk: boolean;
}

interface LogoImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackText: string;
}

function LogoImage({ src, alt, className, fallbackText }: LogoImageProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );

  return (
    <span className="relative inline-flex items-center">
      {status === "loading" && (
        <span className="absolute inset-0 animate-pulse rounded bg-current opacity-10" />
      )}
      {status === "error" ? (
        <span className="text-[0.65rem] font-bold leading-none tracking-tight">
          {fallbackText}
        </span>
      ) : (
        <img
          src={src}
          alt={alt}
          className={cn(className, status === "loading" && "opacity-0")}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      )}
    </span>
  );
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

  const { data: waStatus } = useWhatsappStatus();
  const { data: assertivaStatus } = useAssertivaStatus();

  const blingConnected = blingConnections.some((c) => c.status === "connected");
  const twilioActive = telephonyStatus?.twilio ?? false;
  const elevenLabsActive = telephonyStatus?.elevenlabs ?? false;
  const waActive = (waStatus?.enabled && waStatus?.configured) ?? false;
  const assertivaActive = assertivaStatus?.connected ?? false;

  return (
    <div className="space-y-6">
      <AppTabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <PillTabsList>
          <PillTabsTrigger
            value="bling"
            color="green"
            className="gap-2.5 px-4 py-2.5"
            title="Bling"
          >
            <LogoImage
              src="/bling.svg"
              alt="Bling"
              className="h-4 w-auto"
              fallbackText="Bling"
            />
            <StatusDot active={blingConnected} />
          </PillTabsTrigger>

          <PillTabsTrigger
            value="twilio"
            color="red"
            className="gap-2.5 px-4 py-2.5"
            title="Twilio"
          >
            <LogoImage
              src="/twilio-login-logo.svg"
              alt="Twilio"
              className="h-3.5 w-auto"
              fallbackText="Twilio"
            />
            <StatusDot active={twilioActive} />
          </PillTabsTrigger>

          <PillTabsTrigger
            value="elevenlabs"
            color="teal"
            className="gap-2.5 px-4 py-2.5"
            title="ElevenLabs"
          >
            <LogoImage
              src="/elevenlabs-logo-black.svg"
              alt="ElevenLabs"
              className="h-3 w-auto dark:invert"
              fallbackText="ElevenLabs"
            />
            <StatusDot active={elevenLabsActive} />
          </PillTabsTrigger>

          <PillTabsTrigger
            value="whatsapp"
            color="green"
            className="gap-2.5 px-4 py-2.5"
            title="WhatsApp"
          >
            <LogoImage
              src="/whatsapp-logo.svg"
              alt="WhatsApp"
              className="h-4 w-auto"
              fallbackText="WhatsApp"
            />
            <StatusDot active={waActive} />
          </PillTabsTrigger>

          <PillTabsTrigger
            value="assertiva"
            color="amber"
            className="gap-2.5 px-4 py-2.5"
            title="Assertiva"
          >
            <span className="text-[0.8rem] font-bold leading-none tracking-tight">
              Assertiva
            </span>
            <StatusDot active={assertivaActive} />
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

        <AppTabsContent value="whatsapp" className="mt-0">
          <WhatsappSettingsManagement />
        </AppTabsContent>

        <AppTabsContent value="assertiva" className="mt-0">
          <AssertivaIntegrationManagement />
        </AppTabsContent>
      </AppTabs>
    </div>
  );
}
