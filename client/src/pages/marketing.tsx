import { useState } from "react";
import { useLocation } from "wouter";
import { Megaphone, MessageCircle, Mail, MessageSquare, Layers } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MarketingSummaryCards } from "@/components/marketing-summary-cards";
import { MarketingWhatsappTab } from "@/components/marketing/whatsapp-tab";
import { MarketingEmailTab } from "@/components/marketing/email-tab";
import { MarketingSmsTab } from "@/components/marketing/sms-tab";
import { MarketingSegmentationTab, type SegmentCampaignPayload } from "@/components/marketing/segmentation-tab";
import { MarketingSettingsDialog } from "@/components/marketing/settings-dialog";
import {
  AppTabs,
  UnderlineTabsList,
  UnderlineTabsTrigger,
  AppTabsContent,
} from "@/components/app-tabs";
import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";

export default function Marketing() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = user?.role === "admin" || user?.role === "administrador";

  const [activeTab, setActiveTab] = useState("segmentacao");
  const [emailSegment, setEmailSegment] = useState<SegmentCampaignPayload | null>(null);
  const [smsSegment, setSmsSegment] = useState<SegmentCampaignPayload | null>(null);

  if (user && !isAdmin) return <Redirect to="/dashboard" />;

  function handleCreateCampaign(payload: SegmentCampaignPayload) {
    if (payload.channel === "email") {
      setEmailSegment(payload);
      setActiveTab("email");
    } else if (payload.channel === "sms") {
      setSmsSegment(payload);
      setActiveTab("sms");
    } else if (payload.channel === "whatsapp") {
      navigate("/criar-campanha");
    }
  }

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
          {isAdmin && (
            <div className="flex items-center">
              <MarketingSettingsDialog />
            </div>
          )}
        </PageHeader>

        <MarketingSummaryCards />

        <AppTabs value={activeTab} onValueChange={setActiveTab}>
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="segmentacao" color="amber">
              <Layers className="h-4 w-4" />
              Segmentação
            </UnderlineTabsTrigger>
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

          <AppTabsContent value="segmentacao">
            <MarketingSegmentationTab onCreateCampaign={handleCreateCampaign} />
          </AppTabsContent>
          <AppTabsContent value="whatsapp">
            <MarketingWhatsappTab />
          </AppTabsContent>
          <AppTabsContent value="email">
            <MarketingEmailTab
              prefilledSegment={emailSegment}
              onSegmentConsumed={() => setEmailSegment(null)}
            />
          </AppTabsContent>
          <AppTabsContent value="sms">
            <MarketingSmsTab
              prefilledSegment={smsSegment}
              onSegmentConsumed={() => setSmsSegment(null)}
            />
          </AppTabsContent>
        </AppTabs>
      </div>
    </div>
  );
}
