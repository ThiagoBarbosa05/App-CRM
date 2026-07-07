import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Mail, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ChannelSummary {
  sent: number;
  failed: number;
  pending: number;
}

interface MarketingSummary {
  whatsapp: ChannelSummary;
  email: ChannelSummary;
  sms: ChannelSummary;
}

const CHANNELS: {
  key: keyof MarketingSummary;
  label: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}[] = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    iconBg: "bg-green-50 dark:bg-green-950/40",
    iconColor: "text-green-600 dark:text-green-400",
  },
  {
    key: "email",
    label: "Email",
    icon: Mail,
    iconBg: "bg-blue-50 dark:bg-blue-950/40",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    key: "sms",
    label: "SMS",
    icon: MessageSquare,
    iconBg: "bg-purple-50 dark:bg-purple-950/40",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
];

export function MarketingSummaryCards() {
  const { data, isLoading } = useQuery<MarketingSummary>({
    queryKey: ["/api/marketing/summary"],
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {CHANNELS.map((channel, index) => {
        const stats = data?.[channel.key];
        return (
          <motion.div
            key={channel.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground">
                  {channel.label}
                </CardTitle>
                <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", channel.iconBg)}>
                  <channel.icon className={cn("h-4.5 w-4.5", channel.iconColor)} />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                ) : (
                  <>
                    <div className="text-2xl font-bold tabular-nums">{stats?.sent ?? 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      enviados nos últimos 30 dias
                      {stats && stats.failed > 0 && (
                        <span className="text-red-500 ml-1.5">· {stats.failed} falha(s)</span>
                      )}
                      {stats && stats.pending > 0 && (
                        <span className="text-amber-500 ml-1.5">· {stats.pending} pendente(s)</span>
                      )}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
