import { motion, AnimatePresence } from "framer-motion";
import { 
  Video, 
  Clock, 
  ArrowUp, 
  ArrowDown, 
  MoreVertical, 
  Play,
  PlayCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { getYouTubeEmbedUrl } from "@/lib/get-embed-youtube";
import { Training } from "@/components/learning-images-management";

interface VideoTabProps {
  videos: Training[];
  selectedVideo: Training | null;
  setSelectedVideo: (video: Training | null) => void;
  isAdmin: boolean;
  moveTraining: (id: string, direction: "up" | "down", type: string) => void;
}

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    vendas: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800",
    produto: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100 dark:border-blue-800",
    sistema: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 border-purple-100 dark:border-purple-800",
    atendimento: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border-amber-100 dark:border-amber-800",
  };
  return colors[category.toLowerCase()] || "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-100 dark:border-slate-800";
};

const getLevelColor = (level: string) => {
  const colors: Record<string, string> = {
    básico: "bg-emerald-500/10 text-emerald-500",
    intermediário: "bg-amber-500/10 text-amber-500",
    avançado: "bg-rose-500/10 text-rose-500",
  };
  return colors[level.toLowerCase()] || "bg-slate-500/10 text-slate-500";
};

export function VideoTab({ videos, selectedVideo, setSelectedVideo, isAdmin, moveTraining }: VideoTabProps) {
  if (selectedVideo) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Button
            variant="ghost"
            onClick={() => setSelectedVideo(null)}
            className="group px-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <span className="text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">←</span>
            <span className="ml-2 font-black text-[10px] uppercase tracking-widest text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Voltar para a Galeria</span>
          </Button>

          <div className="flex gap-2">
            <Badge className={`${getCategoryColor(selectedVideo.category)} uppercase text-[9px] font-black tracking-widest px-3 py-1 rounded-full border`}>
              {selectedVideo.category}
            </Badge>
            {selectedVideo.level && (
              <Badge variant="outline" className={`${getLevelColor(selectedVideo.level)} border-none uppercase text-[9px] font-black tracking-widest px-3 py-1 rounded-full`}>
                {selectedVideo.level}
              </Badge>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <div className="aspect-video w-full bg-slate-950">
            <iframe
              src={
                selectedVideo.attachmentUrl?.includes("www.youtube.com") && !selectedVideo.attachmentUrl.includes("embed")
                  ? getYouTubeEmbedUrl(selectedVideo.attachmentUrl)
                  : selectedVideo.attachmentUrl || ""
              }
              title={selectedVideo.title}
              className="w-full h-full"
              allowFullScreen
            />
          </div>
          <div className="p-8 md:p-10 space-y-4">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              {selectedVideo.title}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-base md:text-lg leading-relaxed font-medium">
              {selectedVideo.description}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      <AnimatePresence mode="popLayout">
        {videos.map((video, index) => (
          <motion.div
            key={video.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            {isAdmin && (
              <div className="absolute top-4 right-4 z-20">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 bg-white/20 dark:bg-black/20 backdrop-blur-md text-white hover:bg-white/40 border border-white/20 rounded-xl"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-xl">
                    <DropdownMenuItem onClick={() => moveTraining(video.id, "up", "video")} className="text-xs font-bold uppercase tracking-widest p-3">
                      <ArrowUp className="mr-2 h-4 w-4 text-blue-500" /> Mover para cima
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => moveTraining(video.id, "down", "video")} className="text-xs font-bold uppercase tracking-widest p-3 text-rose-500">
                      <ArrowDown className="mr-2 h-4 w-4" /> Mover para baixo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            <div 
              onClick={() => setSelectedVideo(video)}
              className="relative aspect-video cursor-pointer overflow-hidden group-hover:brightness-110 transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 opacity-60 group-hover:opacity-40 transition-opacity" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 z-20 transition-all scale-75 group-hover:scale-100">
                <div className="bg-white/20 backdrop-blur-md p-4 rounded-full ring-4 ring-white/30">
                  <PlayCircle className="h-10 w-10 text-white fill-white" />
                </div>
              </div>
              
              <iframe
                className="w-full h-full pointer-events-none scale-110 group-hover:scale-100 transition-transform duration-500"
                src={
                  video.attachmentUrl?.includes("www.youtube.com") && !video.attachmentUrl.includes("embed")
                    ? getYouTubeEmbedUrl(video.attachmentUrl)
                    : video.attachmentUrl || ""
                }
                title={video.title}
              />
            </div>

            <div 
              onClick={() => setSelectedVideo(video)}
              className="p-6 space-y-4 cursor-pointer"
            >
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Badge className={`${getCategoryColor(video.category)} uppercase text-[8px] font-black tracking-widest px-2 py-0 border ring-0`}>
                    {video.category}
                  </Badge>
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {video.title}
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {video.description}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-50 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400">
                   <Play className="h-3 w-3" />
                   <span className="text-[10px] font-bold uppercase tracking-widest">Assistir agora</span>
                </div>
                {video.level && (
                  <span className={`text-[9px] font-black uppercase tracking-widest ${getLevelColor(video.level).replace('bg-', 'text-').replace('/10', '')}`}>
                    • {video.level}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
