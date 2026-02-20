import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  MessageSquare,
  Wallet,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { type Client } from "@shared/schema";
import ClientInteractionsTab from "./client-interactions-tab";
import DealFormModal from "./deal-form-modal";
import { ClientCashbackTab } from "./client-cashback-tab";
import { ClientInfoTab } from "./clients/client-info-tab";
import { ClientFunnelsTab } from "./clients/client-funnels-tab";
import { ClientWhatsAppTab } from "./clients/client-whatsapp-tab";
import { AnimatePresence, motion } from "framer-motion";

interface ClientDetailsModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (client: Client) => void;
}

export default function ClientDetailsModal({
  client,
  isOpen,
  onClose,
  onEdit,
}: ClientDetailsModalProps) {
  const [showCreateDealModal, setShowCreateDealModal] = useState(false);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("info");

  const handleCreateDeal = (funnelId: string) => {
    setSelectedFunnelId(funnelId);
    setShowCreateDealModal(true);
  };

  if (!client) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 bg-slate-50 dark:bg-slate-950">
        {/* Header moderno e limpo */}
        <div className="border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-5 sticky top-0 z-20">
          <DialogHeader className="space-y-0">
            <DialogTitle className="flex items-center gap-4 text-xl font-semibold text-gray-900 dark:text-slate-100">
              <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-xl shadow-sm border border-blue-200/50 dark:border-blue-800/50">
                <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <span className="block text-2xl tracking-tight">{client.name}</span>
                <DialogDescription className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                  Informações completas, funis e interações
                </DialogDescription>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Conteúdo do modal */}
        <div className="px-6 py-6 h-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0 sm:pb-0 scrollbar-hide">
              <TabsList className="flex w-max sm:w-full bg-white dark:bg-slate-900 shadow-sm border border-gray-200 dark:border-slate-800 rounded-xl p-1.5 mb-8">
                <TabsTrigger
                  value="info"
                  className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all dark:text-slate-400 dark:data-[state=active]:text-slate-50 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-blue-500/20 dark:data-[state=active]:bg-blue-600"
                >
                  <User className="h-4 w-4" />
                  Informações
                </TabsTrigger>
                <TabsTrigger
                  value="whatsapp"
                  className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all dark:text-slate-400 dark:data-[state=active]:text-slate-50 data-[state=active]:bg-green-50 data-[state=active]:text-green-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-green-500/20 dark:data-[state=active]:bg-green-600"
                >
                  <FaWhatsapp className="h-4 w-4" />
                  WhatsApp
                </TabsTrigger>
                <TabsTrigger
                  value="negocio"
                  className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all dark:text-slate-400 dark:data-[state=active]:text-slate-50 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-indigo-500/20 dark:data-[state=active]:bg-indigo-600"
                >
                  <Wallet className="h-4 w-4" />
                  Funis
                </TabsTrigger>
                <TabsTrigger
                  value="interactions"
                  className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all dark:text-slate-400 dark:data-[state=active]:text-slate-50 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-purple-500/20 dark:data-[state=active]:bg-purple-600"
                >
                  <MessageSquare className="h-4 w-4" />
                  Interações
                </TabsTrigger>
                <TabsTrigger
                  value="cashback"
                  className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all dark:text-slate-400 dark:data-[state=active]:text-slate-50 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-amber-500/20 dark:data-[state=active]:bg-amber-600"
                >
                  <Wallet className="h-4 w-4" />
                  Cashback
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="relative min-h-[400px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                >
                  {activeTab === "info" && (
                    <ClientInfoTab client={client} onEdit={onEdit} onClose={onClose} />
                  )}

                  {activeTab === "whatsapp" && (
                    <ClientWhatsAppTab 
                      clientId={client.id}
                      clientPhone={client.phone}
                      clientName={client.name}
                      clientEmail={client.email || undefined}
                      isOpen={isOpen && activeTab === "whatsapp"}
                    />
                  )}

                  {activeTab === "negocio" && (
                     <ClientFunnelsTab
                      clientId={client.id}
                      clientName={client.name}
                      isOpen={isOpen && activeTab === "negocio"}
                      onCreateDeal={handleCreateDeal}
                    />
                  )}

                  {activeTab === "interactions" && (
                    <ClientInteractionsTab client={client} />
                  )}

                  {activeTab === "cashback" && (
                    <ClientCashbackTab
                      client={client}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </Tabs>
        </div>
      </DialogContent>

      {showCreateDealModal && (
        <DealFormModal
          open={showCreateDealModal}
          onOpenChange={(open) => {
            setShowCreateDealModal(open);
            if (!open) {
              setSelectedFunnelId("");
            }
          }}
          funnelId={selectedFunnelId}
          deal={undefined}
          initialClientId={client.id}
        />
      )}
    </Dialog>
  );
}
