import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DealWithClient } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import DealCard from "./deal-card";
import { FileText, HelpCircle, Info } from "lucide-react";
import { DealQuestionsTab } from "./deal-questions-tab-improved";

interface DealDetailsModalProps {
  deal: DealWithClient | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (deal: DealWithClient) => void;
  onDelete?: (deal: DealWithClient) => void;
  onClientClick?: (client: any) => void;
  onCompanyClick?: (company: any) => void;
  onAddInteraction?: (deal: DealWithClient) => void;
  onMoveToNextStage?: (deal: DealWithClient) => void;
}

export default function DealDetailsModal({
  deal,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onClientClick,
  onCompanyClick,
  onAddInteraction,
  onMoveToNextStage,
}: DealDetailsModalProps) {
  if (!deal) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b border-gray-100 dark:border-slate-700 dark:bg-slate-800 bg-gray-50 -m-6 mb-0 p-4 sm:p-6 flex-shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900 flex-shrink-0">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-slate-100 truncate">
                Detalhes do Negócio
              </DialogTitle>
              <p className="text-gray-600 dark:text-slate-400 text-xs sm:text-sm mt-1 truncate">
                {deal.title || "Sem título"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="details" className="h-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-slate-800 dark:to-slate-900 p-1 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
              <TabsTrigger
                value="details"
                className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-all duration-200 dark:data-[state=active]:bg-slate-700 data-[state=active]:bg-white dark:data-[state=active]:text-slate-100 data-[state=active]:text-blue-600 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-blue-200 hover:bg-white/50 rounded-md"
              >
                <Info className="h-4 w-4 flex-shrink-0 dark:text-slate-200" />
                <span className="hidden sm:inline dark:text-slate-200">
                  Detalhes
                </span>
                <span className="sm:hidden dark:text-slate-200">Info</span>
              </TabsTrigger>
              <TabsTrigger
                value="questions"
                className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-all duration-200 dark:data-[state=active]:bg-slate-700 data-[state=active]:bg-white dark:data-[state=active]:text-slate-100 data-[state=active]:text-blue-600 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-blue-200 hover:bg-white/50 rounded-md"
              >
                <HelpCircle className="h-4 w-4 flex-shrink-0 dark:text-slate-200" />
                <span className="hidden sm:inline dark:text-slate-200">
                  Questionário
                </span>
                <span className="sm:hidden dark:text-slate-200">FAQ</span>
                <Badge
                  variant="outline"
                  className="ml-1 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700 px-1.5 py-0.5 font-medium"
                >
                  Novo
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="px-6 pb-6">
              <DealCard
                deal={deal}
                onEdit={onEdit}
                onDelete={onDelete}
                onClientClick={onClientClick}
                onCompanyClick={onCompanyClick}
                onAddInteraction={onAddInteraction}
                onMoveToNextStage={onMoveToNextStage}
                className="border-0 shadow-none"
              />
            </TabsContent>

            <TabsContent value="questions" className="px-6 pb-6">
              <DealQuestionsTab dealId={deal.id} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
