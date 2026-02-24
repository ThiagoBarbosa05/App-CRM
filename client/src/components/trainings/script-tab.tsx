import { motion } from "framer-motion";
import { 
  FileText, 
  ArrowUp, 
  ArrowDown, 
  MoreVertical,
  ScrollText,
  Copy,
  Terminal,
  ChevronRight
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
import { useToast } from "@/hooks/use-toast";

interface ScriptTabProps {
  scripts: Training[];
  isAdmin: boolean;
  moveTraining: (id: string, direction: "up" | "down", type: string) => void;
}

export function ScriptTab({ scripts, isAdmin, moveTraining }: ScriptTabProps) {
  const { toast } = useToast();

  const handleCopy = (content: string) => {
    // Basic HTML to text conversion for copying
    const temp = document.createElement("div");
    temp.innerHTML = content;
    const text = temp.textContent || temp.innerText || "";
    navigator.clipboard.writeText(text);
    toast({
      title: "Script copiado!",
      description: "O conteúdo foi copiado para sua área de transferência.",
    });
  };

  if (!scripts || scripts.length === 0) {
    return (
      <div className="text-center py-20 bg-white/50 dark:bg-slate-900/50 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800">
        <ScrollText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Nenhum script</h3>
        <p className="text-slate-500 mt-2 font-medium">Os scripts de vendas aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {scripts.map((script, index) => (
        <motion.div
          key={script.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.1 }}
          className="group flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
        >
          <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Terminal className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight truncate max-w-[150px]">
                  {script.title}
                </h4>
                <div className="flex items-center gap-1">
                   <Badge variant="outline" className="h-4 border-none bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[8px] font-black uppercase px-2">
                     {script.category}
                   </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl hover:bg-white dark:hover:bg-slate-800 shadow-sm transition-all"
                onClick={() => handleCopy(script.content || "")}
              >
                <Copy className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              </Button>
              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                      <MoreVertical className="h-4 w-4 text-slate-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-2xl border-slate-200 dark:border-slate-800">
                     <DropdownMenuItem onClick={() => moveTraining(script.id, "up", "script")} className="text-[10px] font-black uppercase tracking-widest p-3">
                       <ArrowUp className="mr-2 h-4 w-4 text-emerald-500" /> Subir
                     </DropdownMenuItem>
                     <DropdownMenuItem onClick={() => moveTraining(script.id, "down", "script")} className="text-[10px] font-black uppercase tracking-widest p-3 text-rose-500">
                       <ArrowDown className="mr-2 h-4 w-4" /> Baixar
                     </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          <div className="p-6 flex-1 flex flex-col">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <ChevronRight className="h-3 w-3 text-indigo-500" /> Descrição
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-6 line-clamp-2">
              {script.description}
            </p>

            <div className="relative flex-1 bg-slate-950 rounded-2xl p-5 shadow-inner group/preview overflow-hidden">
               <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 opacity-40">
                  <span className="text-[8px] font-black text-white/50 uppercase tracking-tighter">Preview</span>
               </div>
               <div 
                 className="prose prose-invert prose-xs max-w-none h-48 overflow-y-auto scrollbar-hide text-[11px] leading-relaxed font-mono"
                 dangerouslySetInnerHTML={{ __html: script.content || "<i>Sem conteúdo</i>" }}
               />
               <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
