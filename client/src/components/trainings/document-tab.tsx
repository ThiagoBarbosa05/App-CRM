import { motion } from "framer-motion";
import { 
  FileText, 
  ArrowUp, 
  ArrowDown, 
  MoreVertical, 
  BookOpen,
  Download,
  FileBadge2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Training } from "@/components/learning-images-management";

interface DocumentTabProps {
  documents: Training[];
  isAdmin: boolean;
  moveTraining: (id: string, direction: "up" | "down", type: string) => void;
}

export function DocumentTab({ documents, isAdmin, moveTraining }: DocumentTabProps) {
  if (!documents || documents.length === 0) {
    return (
      <div className="text-center py-20 bg-white/50 dark:bg-slate-900/50 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 dark:bg-slate-800 mb-6 text-slate-300">
          <FileText className="h-10 w-10" />
        </div>
        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Nenhum documento</h3>
        <p className="text-slate-500 mt-2 font-medium">Os manuais e guias técnicos aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {documents.map((doc, index) => (
        <motion.div
          key={doc.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
        >
          {/* Header Gráfico */}
          <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
            <FileBadge2 className="h-40 w-40 text-blue-600" />
          </div>

          <div className="relative p-8 md:p-10 flex flex-col lg:flex-row lg:items-center gap-8">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
              <FileText className="h-10 w-10 text-white" />
            </div>

            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="secondary" className="bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 font-black uppercase text-[10px] tracking-widest px-3 py-1 rounded-full border-none">
                  Manual #{index + 1}
                </Badge>
                <Badge variant="outline" className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[9px] tracking-widest px-3 py-1 rounded-full border-slate-200 dark:border-slate-800">
                  {doc.category}
                </Badge>
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                {doc.title}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-3xl">
                {doc.description}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                asChild
                className="h-14 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all active:scale-95"
              >
                <a
                  href={`https://pub-2430b33535154e839fd64049d300b4a4.r2.dev/${doc.attachmentUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3"
                >
                  <BookOpen className="h-5 w-5" />
                  <span className="font-black uppercase text-xs tracking-widest">Visualizar</span>
                </a>
              </Button>

              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-14 w-14 rounded-2xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-2xl shadow-xl border-slate-200 dark:border-slate-800">
                    <DropdownMenuItem onClick={() => moveTraining(doc.id, "up", "document")} className="font-bold uppercase text-[10px] tracking-widest p-3">
                       <ArrowUp className="mr-2 h-4 w-4 text-emerald-500" /> Mover para cima
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => moveTraining(doc.id, "down", "document")} className="font-bold uppercase text-[10px] tracking-widest p-3 text-rose-500">
                       <ArrowDown className="mr-2 h-4 w-4" /> Mover para baixo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-800/50 px-8 py-10 border-t border-slate-100 dark:border-slate-800 shadow-inner">
             <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden h-[600px] shadow-sm">
                <iframe
                  src={`https://pub-2430b33535154e839fd64049d300b4a4.r2.dev/${doc.attachmentUrl}`}
                  className="w-full h-full border-0"
                  title={doc.title}
                />
             </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
