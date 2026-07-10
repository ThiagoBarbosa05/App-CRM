import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutomationRulesTab } from "./automation-rules-tab";
import { MessageTemplatesTab } from "./message-templates-tab";
import { AutomationMonitoringTab } from "./automation-monitoring-tab";

export default function AutomationsPage() {
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
