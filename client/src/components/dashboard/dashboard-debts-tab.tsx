import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, CheckCircle, DollarSign, Calendar, User, AlertTriangle, Phone, Mail } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ClientDebt } from "@/types/dashboard";
import { motion } from "framer-motion";

interface DashboardDebtsTabProps {
  pendingDebts: ClientDebt[];
  setSelectedClient: (client: any) => void;
}

export function DashboardDebtsTab({
  pendingDebts,
  setSelectedClient,
}: DashboardDebtsTabProps) {
  const getDebtStatusColor = (status: string, dueDate: string) => {
    if (status === "paid") return "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200";
    if (status === "overdue" || new Date(dueDate) < new Date())
      return "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200";
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200";
  };

  const getDebtStatusText = (status: string, dueDate: string) => {
    if (status === "paid") return "Pago";
    if (status === "overdue" || new Date(dueDate) < new Date())
      return "Vencida";
    return "Pendente";
  };

  const getOverdueDays = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  return (
    <Card className="shadow-none border-0 bg-transparent">
      <CardHeader className="pb-6 px-6 pt-6">
        <CardTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900 dark:text-slate-100">
          <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg">
            <CreditCard className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
          </div>
          <span>Dívidas Pendentes dos Clientes</span>
        </CardTitle>
        <CardDescription className="text-sm text-gray-600 dark:text-slate-400 mt-2">
          Dívidas que ainda não foram quitadas e requerem acompanhamento
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {pendingDebts.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12 px-4"
          >
            <div className="bg-green-50 dark:bg-green-900/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">
              Nenhuma dívida pendente
            </h3>
            <p className="text-gray-500 dark:text-slate-400">
              Todas as cobranças estão em dia!
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
            {pendingDebts.map((debt) => (
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 }
                }}
                key={debt.id}
                className="group relative flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg hover:border-gray-300 dark:hover:border-slate-700 hover:shadow-lg transition-all duration-300 ease-in-out hover:-translate-y-1"
              >
                {/* Indicador de status lateral */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg ${
                    new Date(debt.dueDate) < new Date()
                      ? "bg-red-500"
                      : "bg-yellow-400"
                  }`}
                />

                <div className="flex-1 min-w-0 w-full sm:w-auto pl-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-slate-100">
                      {debt.client.name}
                    </h3>
                    <Badge
                      className={`${getDebtStatusColor(
                        debt.status,
                        debt.dueDate
                      )} w-fit shrink-0 font-medium px-3 py-1 text-xs border-0`}
                    >
                      {getDebtStatusText(debt.status, debt.dueDate)}
                    </Badge>
                  </div>

                  <p className="text-sm text-gray-700 dark:text-slate-300 mb-3 overflow-hidden text-ellipsis leading-relaxed">
                    {debt.description}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                        <span className="font-medium text-gray-900 dark:text-slate-100">
                          {formatCurrency(parseFloat(debt.amount))}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="text-gray-600 dark:text-slate-400">
                          {formatDate(debt.dueDate)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {debt.client.responsibleName && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                          <span className="text-gray-600 dark:text-slate-400">
                            {debt.client.responsibleName}
                          </span>
                        </div>
                      )}
                      {new Date(debt.dueDate) < new Date() && (
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-md">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span className="text-sm font-medium">
                            {getOverdueDays(debt.dueDate)} dias em atraso
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 xs:flex-none hover:bg-green-50 dark:hover:bg-green-900/30 hover:border-green-200 dark:hover:border-green-800 hover:text-green-700 dark:hover:text-green-300 transition-colors"
                    onClick={() =>
                      window.open(`tel:${debt.client.phone}`, "_self")
                    }
                    title="Ligar para cliente"
                  >
                    <Phone className="h-4 w-4" />
                    <span className="ml-2 hidden sm:inline-block">Ligar</span>
                  </Button>
                  {debt.client.email && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 xs:flex-none hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-200 dark:hover:border-blue-700 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                      onClick={() =>
                        window.open(`mailto:${debt.client.email}`, "_blank")
                      }
                      title="Enviar email"
                    >
                      <Mail className="h-4 w-4" />
                      <span className="sm:inline-block hidden">Email</span>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 xs:flex-none hover:bg-gray-50 dark:hover:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600 transition-colors"
                    onClick={() => setSelectedClient(debt.client)}
                  >
                    <User className="h-4 w-4 xs:mr-2" />
                    <span className="sm:inline-block hidden">Ver Cliente</span>
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
