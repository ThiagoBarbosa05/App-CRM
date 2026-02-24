import { Gift, Phone, Mail } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

interface Client {
  id: string;
  name: string;
  email?: string;
  phone: string;
  birthday?: string;
}

interface ReportsBirthdayListProps {
  clients: Client[];
}

export function ReportsBirthdayList({ clients }: ReportsBirthdayListProps) {
  const getDaysUntil = (birthdayStr: string) => {
    const today = startOfDay(new Date());
    const birthday = parseISO(birthdayStr);
    const currentYear = today.getFullYear();

    const thisYearBirthday = new Date(
      currentYear,
      birthday.getMonth(),
      birthday.getDate()
    );

    const nextBirthday =
      thisYearBirthday < today
        ? new Date(currentYear + 1, birthday.getMonth(), birthday.getDate())
        : thisYearBirthday;

    return Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const upcomingBirthdays = clients
    .filter((client) => client.birthday)
    .map((client) => ({
      ...client,
      daysUntil: getDaysUntil(client.birthday!),
    }))
    .filter((client) => client.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return (
    <Card className="group border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border-t-4 border-t-amber-500">
      <CardHeader className="pb-4 border-b border-slate-50 dark:border-slate-800 bg-amber-50/30 dark:bg-amber-900/10">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 dark:bg-amber-900/30 rounded-xl p-2.5">
            <Gift className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
              Próximos Aniversários
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Clientes que fazem aniversário nos próximos 30 dias
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {upcomingBirthdays.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 px-6"
              >
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-slate-200 dark:border-slate-700">
                  <Gift className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium italic">
                  Nenhum aniversário nos próximos 30 dias
                </p>
              </motion.div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-800">
                {upcomingBirthdays.map((client, index) => (
                  <motion.div
                    key={client.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group/item flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-full flex items-center justify-center border border-amber-100 dark:border-amber-800/30 flex-shrink-0 group-hover/item:scale-110 transition-transform">
                        <Gift className="h-5 w-5 text-amber-500" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 dark:text-white truncate">
                          {client.name}
                        </h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                          {client.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                              <Phone className="h-3 w-3" />
                              <a href={`tel:${client.phone}`} className="hover:text-amber-600 transition-colors">
                                {client.phone}
                              </a>
                            </div>
                          )}
                          {client.email && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                              <Mail className="h-3 w-3" />
                              <span className="truncate max-w-[150px]">{client.email}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 mt-3 sm:mt-0 w-full sm:w-auto">
                      <div className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <span className="text-xs font-black text-slate-600 dark:text-slate-300">
                          {format(parseISO(client.birthday!), "dd/MM", { locale: ptBR })}
                        </span>
                      </div>
                      <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        client.daysUntil === 0 
                          ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" 
                          : client.daysUntil === 1 
                          ? "bg-amber-100 text-amber-600" 
                          : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                      }`}>
                        {client.daysUntil === 0 ? "HOJE" : client.daysUntil === 1 ? "AMANHÃ" : `EM ${client.daysUntil} DIAS`}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
