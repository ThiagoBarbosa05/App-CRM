import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Video, 
  FileText, 
  ScrollText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Training } from "@/components/learning-images-management";
import { TrainingsHeader } from "@/components/trainings/trainings-header";
import { VideoTab } from "@/components/trainings/video-tab";
import { DocumentTab } from "@/components/trainings/document-tab";
import { ScriptTab } from "@/components/trainings/script-tab";
import { motion } from "framer-motion";

export default function Trainings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedVideo, setSelectedVideo] = useState<Training | null>(null);

  const { data: trainingVideos, isLoading: isLoadingVideos } = useQuery<Training[]>({
    queryKey: ["/api/trainings?type=video"],
    queryFn: async () => {
      const response = await fetch("/api/trainings?type=video");
      if (!response.ok) throw new Error("Failed to fetch training videos");
      const videos = await response.json();
      return videos.sort((a: Training, b: Training) => {
        const orderA = a.displayOrder ?? 999999;
        const orderB = b.displayOrder ?? 999999;
        return orderA !== orderB ? orderA - orderB : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    },
  });

  const { data: trainingDocument, isLoading: isLoadingDocuments } = useQuery<Training[]>({
    queryKey: ["/api/trainings?type=document"],
    queryFn: async () => {
      const response = await fetch("/api/trainings?type=document");
      if (!response.ok) throw new Error("Failed to fetch training documents");
      const documents = await response.json();
      return documents.sort((a: Training, b: Training) => {
        const orderA = a.displayOrder ?? 999999;
        const orderB = b.displayOrder ?? 999999;
        return orderA !== orderB ? orderA - orderB : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    },
  });

  const { data: scripts, isLoading: isLoadingScripts } = useQuery<Training[]>({
    queryKey: ["/api/trainings?type=script"],
    queryFn: async () => {
      const response = await fetch("/api/trainings?type=script");
      if (!response.ok) throw new Error("Failed to fetch scripts");
      const data = await response.json();
      return data.sort((a: Training, b: Training) => {
        const orderA = a.displayOrder ?? 999999;
        const orderB = b.displayOrder ?? 999999;
        return orderA !== orderB ? orderA - orderB : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    },
  });

  const isAdmin = user?.role === "admin";

  const moveTraining = async (trainingId: string, direction: "up" | "down", type: string) => {
    try {
      const response = await fetch(`/api/trainings/${trainingId}/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, type }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update training order");
      }

      toast({
        title: "Ordem atualizada",
        description: `Item movido para ${direction === "up" ? "cima" : "baixo"} com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao atualizar ordem:", error);
      toast({
        title: "Erro ao atualizar ordem",
        description: error instanceof Error ? error.message : "Erro desconhecido.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-10">
      <TrainingsHeader />

      <Tabs defaultValue="videos" className="space-y-8">
        <div className="flex justify-center">
          <TabsList className="h-16 p-2 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl shrink-0 shadow-sm">
            <TabsTrigger 
              value="videos" 
              className="px-8 rounded-2xl data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/20 transition-all gap-2"
            >
              <Video className="h-4 w-4" />
              <span className="font-black uppercase text-[10px] tracking-widest px-1">Vídeos</span>
            </TabsTrigger>
            <TabsTrigger 
              value="documents" 
              className="px-8 rounded-2xl data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/20 transition-all gap-2"
            >
              <FileText className="h-4 w-4" />
              <span className="font-black uppercase text-[10px] tracking-widest px-1">Manuais</span>
            </TabsTrigger>
            <TabsTrigger 
              value="scripts" 
              className="px-8 rounded-2xl data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/20 transition-all gap-2"
            >
              <ScrollText className="h-4 w-4" />
              <span className="font-black uppercase text-[10px] tracking-widest px-1">Scripts</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <TabsContent value="videos" className="mt-0 outline-none">
            <VideoTab 
              videos={trainingVideos || []} 
              selectedVideo={selectedVideo}
              setSelectedVideo={setSelectedVideo}
              isAdmin={isAdmin}
              moveTraining={moveTraining}
            />
          </TabsContent>

          <TabsContent value="documents" className="mt-0 outline-none">
            <DocumentTab 
              documents={trainingDocument || []}
              isAdmin={isAdmin}
              moveTraining={moveTraining}
            />
          </TabsContent>

          <TabsContent value="scripts" className="mt-0 outline-none">
            <ScriptTab 
              scripts={scripts || []}
              isAdmin={isAdmin}
              moveTraining={moveTraining}
            />
          </TabsContent>
        </motion.div>
      </Tabs>
    </div>
  );
}
