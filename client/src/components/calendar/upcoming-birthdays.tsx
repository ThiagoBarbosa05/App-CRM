import { Gift, Calendar as CalendarIcon, User } from "lucide-react";
import { parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { formatDate } from "@/lib/utils";

interface UpcomingBirthdaysProps {
  upcomingBirthdays: any[];
  users: any[];
}

export function UpcomingBirthdays({
  upcomingBirthdays,
  users,
}: UpcomingBirthdaysProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border-t-4 border-t-blue-500">
      <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
        <CardTitle className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <Gift className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              Próximos Aniversários
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 font-normal">
              Próximos 30 dias
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 max-h-[500px] overflow-y-auto">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {upcomingBirthdays.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="h-16 w-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <Gift className="h-8 w-8 text-slate-200 dark:text-slate-700" />
              </div>
              <p className="text-slate-500 dark:text-slate-400">Nenhum aniversário nos próximos 30 dias.</p>
            </div>
          ) : (
            upcomingBirthdays.slice(0, 15).map((client, index) => (
              <UpcomingBirthdayItem
                key={client.id}
                client={client}
                users={users}
                index={index}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function UpcomingBirthdayItem({ client, users, index }: { client: any; users: any[]; index: number }) {
  const birthdayDate = parseISO(client.birthday);
  const age = new Date().getFullYear() - birthdayDate.getFullYear();
  const daysUntil = Math.ceil(
    (new Date(client.nextBirthday).getTime() - new Date().getTime()) / 
    (1000 * 60 * 60 * 24)
  );
  const responsible = users.find(u => u.id === client.responsavelId)?.name || 'Não atribuído';

  const getStatusBadge = () => {
    if (daysUntil === 0) return { label: "🎉 Hoje!", className: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" };
    if (daysUntil === 1) return { label: "🎂 Amanhã", className: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300" };
    return { label: `⏰ ${daysUntil} dias`, className: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" };
  };

  const status = getStatusBadge();

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group"
    >
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
          <Gift className="h-5 w-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
              {client.name}
            </h4>
            <Badge className={`${status.className} border-none px-2 py-0 h-5 text-[10px] whitespace-nowrap`}>
              {status.label}
            </Badge>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              {formatDate(client.birthday)} ({age} anos)
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <User className="h-3 w-3" />
              {responsible}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
