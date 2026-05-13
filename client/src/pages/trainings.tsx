import { useState } from "react";
import {
  AppTabs,
  UnderlineTabsList,
  UnderlineTabsTrigger,
  AppTabsContent,
} from "@/components/app-tabs";
import {
  GraduationCap,
  Video,
  FileText,
  ScrollText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Training } from "@/components/learning-images-management";
import { PageHeader } from "@/components/page-header";
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
    <div className="space-y-6 pb-10">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon
            icon={GraduationCap}
            color="text-primary"
            bgColor="bg-accent"
          />
          <PageHeader.Text>
            <PageHeader.Title>Centro de Treinamento</PageHeader.Title>
            <PageHeader.Description>
              Vídeos, documentos e recursos para potencializar sua performance
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
      </PageHeader>

      <AppTabs defaultValue="videos" className="space-y-6">
        <UnderlineTabsList>
          <UnderlineTabsTrigger value="videos" color="wine">
            <Video className="h-3.5 w-3.5" />
            Vídeos
          </UnderlineTabsTrigger>
          <UnderlineTabsTrigger value="documents" color="wine">
            <FileText className="h-3.5 w-3.5" />
            Manuais
          </UnderlineTabsTrigger>
          <UnderlineTabsTrigger value="scripts" color="wine">
            <ScrollText className="h-3.5 w-3.5" />
            Scripts
          </UnderlineTabsTrigger>
        </UnderlineTabsList>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <AppTabsContent value="videos" className="mt-0">
            <VideoTab
              videos={trainingVideos || []}
              selectedVideo={selectedVideo}
              setSelectedVideo={setSelectedVideo}
              isAdmin={isAdmin}
              moveTraining={moveTraining}
            />
          </AppTabsContent>

          <AppTabsContent value="documents" className="mt-0">
            <DocumentTab
              documents={trainingDocument || []}
              isAdmin={isAdmin}
              moveTraining={moveTraining}
            />
          </AppTabsContent>

          <AppTabsContent value="scripts" className="mt-0">
            <ScriptTab
              scripts={scripts || []}
              isAdmin={isAdmin}
              moveTraining={moveTraining}
            />
          </AppTabsContent>
        </motion.div>
      </AppTabs>
    </div>
  );
}
