import { useState } from "react";
import { Redirect } from "wouter";
import {
  AppTabs,
  UnderlineTabsList,
  UnderlineTabsTrigger,
  AppTabsContent,
} from "@/components/app-tabs";
import { Activity, BarChart2, History, Phone, Radio } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { TwilioDeviceProvider } from "@/contexts/twilio-device-context";
import { DashboardTabContent } from "@/components/telemarketing/tabs/dashboard-tab";
import { DialerTabContent } from "@/components/telemarketing/tabs/dialer-tab";
import { CampaignsTabContent } from "@/components/telemarketing/tabs/campaigns-tab";
import { HistoryTabContent } from "@/components/telemarketing/tabs/history-tab";
import { MonitorTabContent } from "@/components/telemarketing/tabs/monitor-tab";
import { useAuth } from "@/hooks/useAuth";


// ─── Sub-componentes ──────────────────────────────────────────────────────────

function TabPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
      {children}
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function TelemarketingPage() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");

  if (isLoading) return null;

  const hasAccess =
    user?.role === "admin" ||
    user?.role === "administrador" ||
    user?.role === "gerente";

  if (!hasAccess) return <Redirect to="/" />;

  return (
    <TwilioDeviceProvider>
      <div className="space-y-6 pb-10">
        {/* Cabeçalho */}
        <PageHeader>
          <PageHeader.Info>
            <PageHeader.Icon icon={Phone} />
            <PageHeader.Text>
              <PageHeader.Title>Telemarketing</PageHeader.Title>
              <PageHeader.Description>
                Discador WebRTC, campanhas de voz e histórico de chamadas em um único fluxo
              </PageHeader.Description>
            </PageHeader.Text>
          </PageHeader.Info>
          <PageHeader.Actions>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">WebRTC</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">Campanhas com IA</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">Histórico centralizado</span>
          </PageHeader.Actions>
        </PageHeader>

        {/* Tabs */}
        <AppTabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="dashboard" color="indigo">
              <BarChart2 className="h-3.5 w-3.5" />
              Dashboard
            </UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="dialer" color="blue">
              <Phone className="h-3.5 w-3.5" />
              Discador
            </UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="campaigns" color="purple">
              <Radio className="h-3.5 w-3.5" />
              Campanhas
            </UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="history" color="green">
              <History className="h-3.5 w-3.5" />
              Histórico
            </UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="monitor" color="red">
              <Activity className="h-3.5 w-3.5" />
              Monitor
            </UnderlineTabsTrigger>
          </UnderlineTabsList>

          <AppTabsContent value="dashboard" className="mt-0">
            <TabPanel>
              <DashboardTabContent />
            </TabPanel>
          </AppTabsContent>

          <AppTabsContent value="dialer" className="mt-0">
            <TabPanel>
              <DialerTabContent />
            </TabPanel>
          </AppTabsContent>

          <AppTabsContent value="campaigns" className="mt-0">
            <TabPanel>
              <CampaignsTabContent />
            </TabPanel>
          </AppTabsContent>

          <AppTabsContent value="history" className="mt-0">
            <TabPanel>
              <HistoryTabContent />
            </TabPanel>
          </AppTabsContent>

          <AppTabsContent value="monitor" className="mt-0">
            <TabPanel>
              <MonitorTabContent />
            </TabPanel>
          </AppTabsContent>
        </AppTabs>
      </div>
    </TwilioDeviceProvider>
  );
}
