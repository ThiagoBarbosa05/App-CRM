import { Megaphone, MessageCircle, Mail, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MarketingSummaryCards } from "@/components/marketing-summary-cards";
import { MarketingWhatsappTab } from "@/components/marketing/whatsapp-tab";
import { MarketingEmailTab } from "@/components/marketing/email-tab";
import { MarketingSmsTab } from "@/components/marketing/sms-tab";
import {
  AppTabs,
  UnderlineTabsList,
  UnderlineTabsTrigger,
  AppTabsContent,
} from "@/components/app-tabs";

export default function Marketing() {
  return (
    <div className="overflow-y-auto h-full p-4 sm:p-5 lg:p-6">
      <div className="space-y-5 pb-10">
        <PageHeader>
          <PageHeader.Info>
            <PageHeader.Icon
              icon={Megaphone}
              color="text-primary"
              bgColor="bg-primary/10"
            />
            <PageHeader.Text>
              <PageHeader.Title>Marketing</PageHeader.Title>
              <PageHeader.Description>
                Envie mensagens para seus clientes por WhatsApp, Email e SMS
              </PageHeader.Description>
            </PageHeader.Text>
          </PageHeader.Info>
        </PageHeader>

        <MarketingSummaryCards />

        <AppTabs defaultValue="whatsapp">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="whatsapp" color="green">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="email" color="blue">
              <Mail className="h-4 w-4" />
              Email
            </UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="sms" color="purple">
              <MessageSquare className="h-4 w-4" />
              SMS
            </UnderlineTabsTrigger>
          </UnderlineTabsList>

          <AppTabsContent value="whatsapp">
            <MarketingWhatsappTab />
          </AppTabsContent>
          <AppTabsContent value="email">
            <MarketingEmailTab />
          </AppTabsContent>
          <AppTabsContent value="sms">
            <MarketingSmsTab />
          </AppTabsContent>
        </AppTabs>
      </div>
    </div>
  );
}
