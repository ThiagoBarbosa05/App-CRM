import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, Phone, Clock } from "lucide-react";
import { motion } from "framer-motion";

interface DashboardBirthdaysTabProps {
  upcomingBirthdays: any[];
  setSelectedClient: (client: any) => void;
}

export function DashboardBirthdaysTab({
  upcomingBirthdays,
  setSelectedClient,
}: DashboardBirthdaysTabProps) {
  return (
    <Card className="shadow-none border-0 bg-transparent">
      <CardHeader className="pb-6 px-6 pt-6">
        <CardTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900 dark:text-slate-100">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
          </div>
          <span className="truncate">Próximos Aniversários</span>
        </CardTitle>
        <CardDescription className="text-sm text-gray-600 dark:text-slate-400 mt-2">
          Os próximos 15 aniversariantes para manter relacionamento próximo
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {upcomingBirthdays.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12 px-4"
          >
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Calendar className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">
              Nenhum aniversário próximo
            </h3>
            <p className="text-gray-500 dark:text-slate-400">
              Nenhum cliente fará aniversário nos próximos dias
            </p>
          </motion.div>
        ) : (
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
            }}
            className="space-y-4"
          >
            {upcomingBirthdays.map((client: any) => (
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 }
                }}
                key={client.id}
                className="group relative flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg hover:border-gray-300 dark:hover:border-slate-700 hover:shadow-lg transition-all duration-300 ease-in-out hover:-translate-y-1"
              >
                {/* Indicador de urgência lateral */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg ${
                    client.daysUntil === 0
                      ? "bg-green-500"
                      : client.daysUntil <= 3
                        ? "bg-yellow-400"
                        : "bg-blue-400"
                  }`}
                />

                <div className="flex items-center gap-4 flex-1 min-w-0 w-full sm:w-auto pl-2">
                  <div
                    className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
                      client.daysUntil === 0
                        ? "bg-green-100 dark:bg-green-900/30"
                        : client.daysUntil <= 3
                          ? "bg-yellow-100 dark:bg-yellow-900/30"
                          : "bg-blue-100 dark:bg-blue-900/30"
                    }`}
                  >
                    <Calendar
                      className={`h-6 w-6 ${
                        client.daysUntil === 0
                          ? "text-green-600 dark:text-green-400"
                          : client.daysUntil <= 3
                            ? "text-yellow-600 dark:text-yellow-400"
                            : "text-blue-600 dark:text-blue-400"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-slate-100 truncate mb-2">
                      {client.name}
                    </h3>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400 dark:text-slate-500 shrink-0" />
                        <span className="text-sm text-gray-700 dark:text-slate-300 font-medium">
                          {client.daysUntil === 0
                            ? "🎉 Aniversário hoje!"
                            : client.daysUntil === 1
                              ? "🎂 Aniversário amanhã"
                              : `🗓️ Em ${client.daysUntil} dias`}
                        </span>
                      </div>
                      <Badge
                        className={`w-fit shrink-0 font-medium px-3 py-1 text-xs border-0 ${
                          client.daysUntil === 0
                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                            : client.daysUntil <= 3
                              ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                              : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                        }`}
                      >
                        {client.daysUntil === 0
                          ? "Hoje"
                          : client.daysUntil === 1
                            ? "1 dia"
                            : `${client.daysUntil} dias`}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 xs:flex-none hover:bg-green-50 dark:hover:bg-green-900/30 hover:border-green-200 dark:hover:border-green-700 hover:text-green-700 dark:hover:text-green-300 transition-colors"
                    onClick={() => window.open(`tel:${client.phone}`, "_self")}
                    title="Ligar para cliente"
                  >
                    <Phone className="h-4 w-4" />
                    <span className="ml-2 xs:hidden">Ligar</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 xs:flex-none hover:bg-blue-50 dark:text-white dark:hover:bg-blue-900/30 hover:border-blue-200 dark:hover:border-blue-700 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    onClick={() => setSelectedClient(client)}
                  >
                    <User className="h-4 w-4 xs:mr-2" />
                    <span className="ml-2 xs:ml-0 truncate">Ver Cliente</span>
                  </Button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
