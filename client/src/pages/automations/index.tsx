import { Shield, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { AutomationRulesTab } from "./automation-rules-tab";
import { MessageTemplatesTab } from "./message-templates-tab";
import { AutomationMonitoringTab } from "./automation-monitoring-tab";

export default function AutomationsPage() {
  const { user } = useAuth();

  if (user?.role !== "admin") {
    return (
      <div className="flex h-[70vh] items-center justify-center p-6">
        <Card className="max-w-md border-0 shadow-2xl rounded-[2rem] overflow-hidden">
          <div className="h-2 bg-rose-500" />
          <CardHeader className="p-10 text-center">
            <div className="mx-auto w-20 h-20 bg-rose-50 dark:bg-rose-900/20 rounded-3xl flex items-center justify-center mb-6 ring-8 ring-rose-50/50 dark:ring-rose-900/10">
              <Shield className="h-10 w-10 text-rose-500" />
            </div>
            <CardTitle className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Acesso Restrito
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 font-medium mt-4 text-balance">
              A área de Automações é exclusiva para administradores. Se você
              acredita que deveria ter acesso, entre em contato com o suporte.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon icon={Sparkles} />
          <PageHeader.Text>
            <PageHeader.Title>Automações</PageHeader.Title>
            <PageHeader.Description>
              Configure regras e modelos de mensagem para automações de SMS e
              e-mail disparadas por eventos do sistema.
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
      </PageHeader>

      <Tabs defaultValue="regras" className="space-y-4">
        <TabsList>
          <TabsTrigger value="regras">Regras</TabsTrigger>
          <TabsTrigger value="modelos">Modelos de Mensagem</TabsTrigger>
          <TabsTrigger value="monitoramento">Monitoramento</TabsTrigger>
        </TabsList>
        <TabsContent value="regras">
          <AutomationRulesTab />
        </TabsContent>
        <TabsContent value="modelos">
          <MessageTemplatesTab />
        </TabsContent>
        <TabsContent value="monitoramento">
          <AutomationMonitoringTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
