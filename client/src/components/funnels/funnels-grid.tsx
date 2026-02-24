import { motion } from "framer-motion";
import { FunnelCard } from "./funnel-card";
import { SalesFunnel } from "../funnels-management";
import { Card, CardContent } from "@/components/ui/card";
import { GitBranch, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FunnelsGridProps {
  funnels: SalesFunnel[];
  currentUser: { id: string; role: string } | null;
  onViewBoard: (funnel: SalesFunnel) => void;
  onManageStages: (funnel: SalesFunnel) => void;
  onEdit: (funnel: SalesFunnel) => void;
  onDelete: (funnel: SalesFunnel) => void;
  onNewFunnelClick: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function FunnelsGrid({
  funnels,
  currentUser,
  onViewBoard,
  onManageStages,
  onEdit,
  onDelete,
  onNewFunnelClick,
}: FunnelsGridProps) {
  if (!funnels || funnels.length === 0) {
    return (
      <Card className="border-dashed border-2 py-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl">
        <CardContent className="flex flex-col items-center justify-center text-center">
          <div className="h-16 w-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-5">
            <GitBranch className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Nenhum funil encontrado
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-8 leading-relaxed">
            Parece que você ainda não criou nenhum funil de vendas. 
            Comece configurando seu primeiro pipeline.
          </p>
          <Button 
            onClick={onNewFunnelClick}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 rounded-xl h-11"
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar Primeiro Funil
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    >
      {funnels.map((funnel) => (
        <motion.div key={funnel.id} variants={itemVariants}>
          <FunnelCard
            funnel={funnel}
            currentUser={currentUser}
            onViewBoard={onViewBoard}
            onManageStages={onManageStages}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
