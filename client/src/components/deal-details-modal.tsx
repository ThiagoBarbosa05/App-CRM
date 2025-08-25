
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DealWithClient } from "@shared/schema";
import DealCard from "./deal-card";

interface DealDetailsModalProps {
  deal: DealWithClient | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (deal: DealWithClient) => void;
  onDelete?: (deal: DealWithClient) => void;
  onClientClick?: (client: any) => void;
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
  onAddInteraction,
  onMoveToNextStage,
}: DealDetailsModalProps) {
  if (!deal) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes do Negócio</DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <DealCard
            deal={deal}
            onEdit={onEdit}
            onDelete={onDelete}
            onClientClick={onClientClick}
            onAddInteraction={onAddInteraction}
            onMoveToNextStage={onMoveToNextStage}
            className="border-0 shadow-none"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
