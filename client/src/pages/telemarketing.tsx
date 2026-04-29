import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Radio, History } from "lucide-react";
import { Dialer } from "@/components/telemarketing/dialer";
import { CampaignsList } from "@/components/telemarketing/campaigns-list";
import { CallsHistory } from "@/components/telemarketing/calls-history";

export default function TelemarketingPage() {
  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Telemarketing</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Discador WebRTC, campanhas com IA e histórico de chamadas.
        </p>
      </div>

      <Tabs defaultValue="dialer" className="space-y-6">
        <TabsList className="h-auto p-1.5 bg-slate-100 dark:bg-slate-800/60 rounded-2xl">
          <TabsTrigger
            value="dialer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all
              data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900
              data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400
              data-[state=active]:shadow-sm"
          >
            <Phone className="size-4" />
            Discador
          </TabsTrigger>
          <TabsTrigger
            value="campaigns"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all
              data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900
              data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400
              data-[state=active]:shadow-sm"
          >
            <Radio className="size-4" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all
              data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900
              data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400
              data-[state=active]:shadow-sm"
          >
            <History className="size-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dialer">
          <Dialer />
        </TabsContent>

        <TabsContent value="campaigns">
          <CampaignsList />
        </TabsContent>

        <TabsContent value="history">
          <CallsHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
