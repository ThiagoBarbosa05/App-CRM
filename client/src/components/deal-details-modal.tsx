import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DealWithClient } from "@shared/schema";
import DealCard from "./deal-card";
import { FileText } from "lucide-react";

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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b border-gray-100 bg-gray-50 -m-6 mb-0 p-4 sm:p-6 flex-shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-md bg-blue-100 flex-shrink-0">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                Detalhes do Negócio
              </DialogTitle>
              <p className="text-gray-600 text-xs sm:text-sm mt-1 truncate">
                {deal.title || "Sem título"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-4">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
