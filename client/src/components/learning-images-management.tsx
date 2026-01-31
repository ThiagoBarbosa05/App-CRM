import { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast, useToast } from "@/hooks/use-toast";
import {
  Image,
  Upload,
  Trash2,
  Eye,
  Plus,
  GraduationCap,
  Pencil,
  Trash,
  File,
  BookOpen,
  Menu,
  EllipsisVertical,
  FileText,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  Video,
  FileText as FileTextIcon,
  ScrollText,
} from "lucide-react";
import { Separator } from "./ui/separator";
import { CreateTrainingForm } from "./create-training-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getYouTubeEmbedUrl } from "@/lib/get-embed-youtube";
import { queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import ImageUploadForm from "./image-upload-form";
import { DocumentsUploadForm } from "./document-upload-form";
import { Link } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ScriptForm } from "./script-form";
import ReactQuill from "react-quill";

export interface Training {
  id: string;
  title: string;
  description: string;
  type: string;
  duration?: string;
  content?: string;
  category: string;
  level?: string;
  displayOrder?: number;
  createdAt: Date;
  attachmentUrl?: string;
  attachmentFileType?: string;
  attachmentName?: string;
}

interface TrainingDocument {
  id: string;
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  fileType: "pdf" | "doc" | "ppt";
}

interface LearningImage {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  createdAt: Date;
}

export default function LearningImagesManagement() {
  const [openCreateTrainingModal, setOpenCreateTrainingModal] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [editingScript, setEditingScript] = useState<Training | null>(null);

  const [trainingToDelete, setTrainingToDelete] = useState("");

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  const [openDocumentForm, setOpenDocumentForm] = useState(false);
  const [trainingEditFile, setTrainingEditFile] = useState<string | null>("");
  const [showEditor, setShowEditor] = useState(false);
  const [openScriptForm, setOpenScriptForm] = useState(false);

  const [content, setContent] = useState("");

  // Estados para pesquisa e filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isSearching, setIsSearching] = useState(false);

  const categories = [
    "Vendas",
    "Produtos",
    "Sistema",
    "Atendimento",
    "Processos",
    "Geral",
  ];

  const {
    data: trainingVideos,
    isLoading: isLoadingVideos,
    isFetching: isFetchingVideos,
  } = useQuery<Training[]>({
    queryKey: ["/api/trainings?type=video"],
    queryFn: async () => {
      const response = await fetch("/api/trainings?type=video");
      if (!response.ok) throw new Error("Failed to fetch training videos");
      return response.json();
    },
  });

  const {
    data: trainingDocument,
    isLoading: isLoadingDocuments,
    isFetching: isFetchingDocuments,
  } = useQuery<Training[]>({
    queryKey: ["/api/trainings?type=document"],
    queryFn: async () => {
      const response = await fetch("/api/trainings?type=document");
      if (!response.ok) throw new Error("Failed to fetch training documents");
      return response.json();
    },
  });

  const {
    data: scripts,
    isLoading: isLoadingScripts,
    isFetching: isFetchingScripts,
  } = useQuery<Training[]>({
    queryKey: ["/api/trainings?type=script"],
    queryFn: async () => {
      const response = await fetch("/api/trainings?type=script");
      if (!response.ok) throw new Error("Failed to fetch training scripts");
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (trainingId: string) => {
      const response = await fetch(`/api/trainings/${trainingId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/trainings?type=video"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/trainings?type=script"],
      });
      setOpenDeleteDialog(false);
      toast({
        title: "Sucesso",
        description: "Treinamento deletado com sucesso",
        variant: "default",
      });
    },
    onError: (error) => {
      console.error("Error deleting training:", error);
      toast({
        title: "Erro",
        description: "Erro ao deletar treinamento",
        variant: "destructive",
      });
    },
  });

  const deleteDocumentTrainingMutation = useMutation({
    mutationFn: async (trainingId: string) => {
      const response = await fetch(`/api/trainings/documents/${trainingId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/trainings?type=document"],
      });
      setOpenDeleteDialog(false);
      toast({
        title: "Sucesso",
        description: "Treinamento deletado com sucesso",
        variant: "default",
      });
    },
    onError: (error) => {
      console.error("Error deleting training:", error);
      toast({
        title: "Erro",
        description: "Erro ao deletar treinamento",
        variant: "destructive",
      });
    },
  });

  const deleteScriptMutation = useMutation({
    mutationFn: async (trainingId: string) => {
      const response = await fetch(`/api/trainings/${trainingId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao deletar script");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/trainings?type=script"],
      });

      toast({
        title: "Script deletado",
        description: "O script foi deletado com sucesso.",
      });
    },
    onError: (error) => {
      console.error("Erro ao deletar script:", error);
      toast({
        title: "Erro ao deletar script",
        description: "Ocorreu um erro ao deletar o script. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const moveTraining = async (
    trainingId: string,
    direction: "up" | "down",
    type: string,
  ) => {
    try {
      const response = await fetch(`/api/trainings/${trainingId}/order`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ direction, type }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update training order");
      }

      // Invalidar queries para atualizar a lista
      queryClient.invalidateQueries({
        queryKey: ["/api/trainings?type=document"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/trainings?type=video"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/trainings?type=script"],
      });

      toast({
        title: "Ordem atualizada",
        description: `Item movido para ${
          direction === "up" ? "cima" : "baixo"
        } com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao atualizar ordem:", error);
      toast({
        title: "Erro ao atualizar ordem",
        description:
          error instanceof Error
            ? error.message
            : "Ocorreu um erro ao atualizar a ordem. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const formRef = useRef<HTMLDivElement>(null);

  const documentsTrainings = trainingDocument; // Alias for clarity

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50/30 dark:from-slate-900 dark:to-slate-800">
      <div className="p-4 lg:p-6">
        {/* Header com gradiente teal/cyan */}
        <div className="bg-gradient-to-r from-teal-500 to-cyan-600 rounded-xl p-6 mb-6 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-white">
            <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
              <GraduationCap className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                Gerenciar Treinamentos
              </h1>
              <p className="text-teal-100 text-sm lg:text-base">
                Gerencie e crie seus treinamentos de vídeo, upload de
                documentos, manuais e scripts de vendas
              </p>
            </div>
          </div>
        </div>

        {/* Barra de pesquisa e filtros */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar treinamentos..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setIsSearching(!!e.target.value);
                }}
                className="pl-10 border-slate-300 focus:border-teal-400 focus:ring-teal-400 dark:border-slate-600 dark:focus:border-teal-500"
              />
              {isFetchingVideos || isFetchingDocuments || isFetchingScripts ? (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent"></div>
                </div>
              ) : null}
            </div>
            <div className="sm:w-48">
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="border-slate-300 focus:border-teal-400 focus:ring-teal-400 dark:border-slate-600 dark:focus:border-teal-500">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Categorias</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Tabs defaultValue="videos" className="space-y-6">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border-0 shadow-sm">
              <TabsTrigger
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-500 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-200 dark:hover:bg-slate-700 focus-visible:bg-slate-200 dark:focus-visible:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-800 transition-all duration-200 flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300 bg-transparent border-0"
                value="videos"
              >
                <Video className="h-4 w-4" />
                Vídeos
              </TabsTrigger>
              <TabsTrigger
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-500 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-200 dark:hover:bg-slate-700 focus-visible:bg-slate-200 dark:focus-visible:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-800 transition-all duration-200 flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300 bg-transparent border-0"
                value="documents"
              >
                <FileTextIcon className="h-4 w-4" />
                Documentos
              </TabsTrigger>
              <TabsTrigger
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-500 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-200 dark:hover:bg-slate-700 focus-visible:bg-slate-200 dark:focus-visible:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-800 transition-all duration-200 flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300 bg-transparent border-0"
                value="scripts"
              >
                <ScrollText className="h-4 w-4" />
                Scripts
              </TabsTrigger>
            </TabsList>{" "}
            <TabsContent className="w-full space-y-6" value="videos">
              {/* Skeleton Loading para Videos */}
              {isLoadingVideos && (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Card key={index} className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row gap-6">
                          <div className="flex-1 space-y-4">
                            <Skeleton className="h-6 w-3/4" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                            <div className="flex gap-2">
                              <Skeleton className="h-6 w-20" />
                              <Skeleton className="h-6 w-16" />
                            </div>
                            <div className="flex gap-2">
                              <Skeleton className="h-8 w-20" />
                              <Skeleton className="h-8 w-20" />
                            </div>
                          </div>
                          <Skeleton className="w-full lg:w-80 h-44 rounded-lg" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Content para Videos */}
              {!isLoadingVideos && (
                <>
                  <div className="space-y-4">
                    {trainingVideos &&
                      trainingVideos
                        .filter((training) => {
                          const matchesSearch =
                            searchTerm === "" ||
                            training.title
                              .toLowerCase()
                              .includes(searchTerm.toLowerCase()) ||
                            training.description
                              .toLowerCase()
                              .includes(searchTerm.toLowerCase());
                          const matchesCategory =
                            selectedCategory === "all" ||
                            training.category === selectedCategory;
                          return matchesSearch && matchesCategory;
                        })
                        .map((training) => (
                          <Card
                            key={training.id}
                            className="group hover:shadow-lg transition-all duration-300 border-slate-200 dark:border-slate-700 overflow-hidden"
                          >
                            <CardContent className="p-6">
                              <div className="flex flex-col lg:flex-row gap-6">
                                <div className="flex-1 space-y-4">
                                  <div>
                                    <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 group-hover:text-teal-600 transition-colors">
                                      {training.title}
                                    </h3>
                                    <p className="text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                                      {training.description}
                                    </p>
                                  </div>

                                  <div className="flex gap-2 flex-wrap">
                                    <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-800">
                                      {training.category}
                                    </Badge>
                                    {training.level && (
                                      <Badge className="bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800">
                                        {training.level}
                                      </Badge>
                                    )}
                                    {training.duration && (
                                      <Badge
                                        variant="outline"
                                        className="border-slate-300 dark:border-slate-600"
                                      >
                                        {training.duration}
                                      </Badge>
                                    )}
                                  </div>

                                  <div className="flex gap-2 flex-wrap">
                                    <Button
                                      onClick={() => {
                                        setEditingTraining(training);
                                        setOpenCreateTrainingModal(true);
                                      }}
                                      variant="outline"
                                      size="sm"
                                      className="border-teal-300 text-teal-700 hover:bg-teal-50 hover:border-teal-400 dark:border-teal-600 dark:text-teal-300 dark:hover:bg-teal-900/20"
                                    >
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Editar
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setTrainingToDelete(training.id);
                                        setOpenDeleteDialog(true);
                                      }}
                                      className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-900/20"
                                    >
                                      <Trash className="h-4 w-4 mr-2" />
                                      Deletar
                                    </Button>
                                  </div>
                                </div>

                                {training.attachmentUrl && (
                                  <div className="w-full lg:w-80">
                                    <iframe
                                      className="rounded-lg w-full h-44 border-0 shadow-sm"
                                      src={
                                        training.attachmentUrl?.includes(
                                          "www.youtube.com",
                                        ) &&
                                        !training.attachmentUrl.includes(
                                          "embed",
                                        )
                                          ? getYouTubeEmbedUrl(
                                              training.attachmentUrl,
                                            )
                                          : training.attachmentUrl || ""
                                      }
                                      title={training.title}
                                      allowFullScreen
                                    />
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}

                    {trainingVideos &&
                      trainingVideos.length === 0 &&
                      !isLoadingVideos && (
                        <Card className="text-center py-12">
                          <CardContent>
                            <Video className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-600 mb-4" />
                            <p className="text-slate-500 dark:text-slate-400 text-lg font-medium mb-2">
                              Nenhum vídeo encontrado
                            </p>
                            <p className="text-slate-400 dark:text-slate-500 text-sm">
                              Comece criando seu primeiro treinamento em vídeo
                            </p>
                          </CardContent>
                        </Card>
                      )}
                  </div>

                  <div className="flex justify-center">
                    <Button
                      onClick={() => {
                        setEditingTraining(null);
                        setOpenCreateTrainingModal(true);
                      }}
                      className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Treinamento
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
            <TabsContent className="w-full space-y-6" value="documents">
              {/* Skeleton Loading para Documentos */}
              {isLoadingDocuments && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Card key={index} className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4 mb-4">
                          <Skeleton className="h-10 w-10 rounded" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                          </div>
                          <Skeleton className="h-8 w-8 rounded-full" />
                        </div>
                        <div className="flex justify-between items-center mt-6">
                          <div className="flex gap-2">
                            <Skeleton className="h-6 w-16" />
                            <Skeleton className="h-6 w-8" />
                          </div>
                          <Skeleton className="h-8 w-20" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Content para Documentos */}
              {!isLoadingDocuments && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {trainingDocument &&
                      trainingDocument
                        .filter((training) => {
                          const matchesSearch =
                            searchTerm === "" ||
                            training.title
                              .toLowerCase()
                              .includes(searchTerm.toLowerCase()) ||
                            training.description
                              .toLowerCase()
                              .includes(searchTerm.toLowerCase());
                          const matchesCategory =
                            selectedCategory === "all" ||
                            training.category === selectedCategory;
                          return matchesSearch && matchesCategory;
                        })
                        .map((training) => (
                          <Card
                            key={training.id}
                            className="group hover:shadow-lg transition-all duration-300 border-slate-200 dark:border-slate-700 overflow-hidden"
                          >
                            <CardContent className="p-6">
                              <div className="flex items-start gap-4 mb-4">
                                <div className="p-2 bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/30 dark:to-cyan-900/30 rounded-lg">
                                  <File className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-teal-600 transition-colors truncate">
                                    {training.title}
                                  </h3>
                                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                                    {training.description}
                                  </p>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                      <EllipsisVertical className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    className="w-56"
                                    align="end"
                                  >
                                    <DropdownMenuItem className="p-0">
                                      <Button
                                        variant="ghost"
                                        className="w-full justify-start text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                        onClick={() => {
                                          setOpenDocumentForm(true);
                                          setTrainingEditFile(null);
                                          setEditingTraining(training);
                                        }}
                                      >
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Editar
                                      </Button>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="p-0">
                                      <Button
                                        variant="ghost"
                                        className="w-full justify-start text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                        onClick={() => {
                                          setOpenDocumentForm(true);
                                          setEditingTraining(null);
                                          setTrainingEditFile(training.id);
                                        }}
                                      >
                                        <Upload className="mr-2 h-4 w-4" />
                                        Editar arquivo
                                      </Button>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="p-0">
                                      <Button
                                        variant="ghost"
                                        className="w-full justify-start text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/20"
                                        onClick={() =>
                                          moveTraining(
                                            training.id,
                                            "up",
                                            "document",
                                          )
                                        }
                                      >
                                        <ArrowUp className="mr-2 h-4 w-4" />
                                        Mover para cima
                                      </Button>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="p-0">
                                      <Button
                                        variant="ghost"
                                        className="w-full justify-start text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/20"
                                        onClick={() =>
                                          moveTraining(
                                            training.id,
                                            "down",
                                            "document",
                                          )
                                        }
                                      >
                                        <ArrowDown className="mr-2 h-4 w-4" />
                                        Mover para baixo
                                      </Button>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="p-0">
                                      <Button
                                        variant="ghost"
                                        className="w-full text-red-600 dark:text-red-400 justify-start hover:bg-red-50 dark:hover:bg-red-900/20"
                                        disabled={
                                          deleteDocumentTrainingMutation.isPending
                                        }
                                        onClick={() =>
                                          deleteDocumentTrainingMutation.mutateAsync(
                                            training.id,
                                          )
                                        }
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        {deleteDocumentTrainingMutation.isPending
                                          ? "Deletando..."
                                          : "Deletar"}
                                      </Button>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              <div className="flex justify-between items-center mt-6">
                                <div className="flex gap-2">
                                  <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-800">
                                    {training.category}
                                  </Badge>
                                  <Badge
                                    variant="secondary"
                                    className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                  >
                                    {(documentsTrainings?.findIndex(
                                      (d) => d.id === training.id,
                                    ) || 0) + 1}
                                    º
                                  </Badge>
                                </div>
                                <Button
                                  asChild
                                  variant="outline"
                                  size="sm"
                                  className="border-teal-300 text-teal-700 hover:bg-teal-50 hover:border-teal-400 dark:border-teal-600 dark:text-teal-300 dark:hover:bg-teal-900/20"
                                >
                                  <a
                                    href={`https://pub-2430b33535154e839fd64049d300b4a4.r2.dev/${training.attachmentUrl}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <BookOpen className="h-4 w-4 mr-1" />
                                    Abrir
                                  </a>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}

                    {trainingDocument &&
                      trainingDocument.length === 0 &&
                      !isLoadingDocuments && (
                        <div className="col-span-full">
                          <Card className="text-center py-12">
                            <CardContent>
                              <FileTextIcon className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-600 mb-4" />
                              <p className="text-slate-500 dark:text-slate-400 text-lg font-medium mb-2">
                                Nenhum documento encontrado
                              </p>
                              <p className="text-slate-400 dark:text-slate-500 text-sm">
                                Faça upload do seu primeiro documento ou manual
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                  </div>

                  <div className="flex justify-center">
                    <Button
                      onClick={() => {
                        setEditingTraining(null);
                        setTrainingEditFile(null);
                        setOpenDocumentForm(true);
                      }}
                      className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Enviar Documento
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
            <TabsContent className="w-full space-y-6" value="scripts">
              {/* Skeleton Loading para Scripts */}
              {isLoadingScripts && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Card key={index} className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-3 mb-4">
                          <Skeleton className="h-6 w-6" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-full" />
                          </div>
                          <Skeleton className="h-8 w-8 rounded-full" />
                        </div>
                        <Skeleton className="h-48 w-full rounded-lg mb-4" />
                        <div className="flex gap-2">
                          <Skeleton className="h-8 w-16" />
                          <Skeleton className="h-8 w-16" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Content para Scripts */}
              {!isLoadingScripts && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {scripts
                      ?.filter((script) => {
                        const matchesSearch =
                          searchTerm === "" ||
                          script.title
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase()) ||
                          script.description
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase());
                        const matchesCategory =
                          selectedCategory === "all" ||
                          script.category === selectedCategory;
                        return matchesSearch && matchesCategory;
                      })
                      .map((script) => (
                        <Card
                          key={script.id}
                          className="group hover:shadow-lg transition-all duration-300 border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden"
                        >
                          <CardContent className="p-6 flex flex-col h-full">
                            <div className="flex items-start gap-3 mb-4">
                              <div className="p-2 bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/30 dark:to-cyan-900/30 rounded-lg">
                                <ScrollText className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-teal-600 transition-colors">
                                  {script.title}
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                                  {script.description}
                                </p>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                                  >
                                    <EllipsisVertical className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  className="w-56"
                                  align="end"
                                >
                                  <DropdownMenuItem className="p-0">
                                    <Button
                                      variant="ghost"
                                      className="w-full justify-start text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                      onClick={() => {
                                        setOpenScriptForm(true);
                                        setEditingScript(script);
                                      }}
                                    >
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Editar
                                    </Button>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="p-0">
                                    <Button
                                      variant="ghost"
                                      className="w-full justify-start text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/20"
                                      onClick={() =>
                                        moveTraining(script.id, "up", "script")
                                      }
                                    >
                                      <ArrowUp className="mr-2 h-4 w-4" />
                                      Mover para cima
                                    </Button>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="p-0">
                                    <Button
                                      variant="ghost"
                                      className="w-full justify-start text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/20"
                                      onClick={() =>
                                        moveTraining(
                                          script.id,
                                          "down",
                                          "script",
                                        )
                                      }
                                    >
                                      <ArrowDown className="mr-2 h-4 w-4" />
                                      Mover para baixo
                                    </Button>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="p-0">
                                    <Button
                                      variant="ghost"
                                      className="w-full text-red-600 dark:text-red-400 justify-start hover:bg-red-50 dark:hover:bg-red-900/20"
                                      disabled={deleteScriptMutation.isPending}
                                      onClick={() =>
                                        deleteScriptMutation.mutate(script.id)
                                      }
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      {deleteScriptMutation.isPending
                                        ? "Deletando..."
                                        : "Deletar"}
                                    </Button>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            <div className="flex-1 mb-4">
                              <div
                                className="bg-slate-800 dark:bg-slate-900 text-white p-4 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600"
                                style={{
                                  maxHeight: "200px",
                                  overflowY: "auto",
                                }}
                              >
                                <div
                                  className="prose prose-invert prose-sm max-w-none break-words [&>*]:text-white"
                                  dangerouslySetInnerHTML={{
                                    __html:
                                      script.content ||
                                      "<p class='text-slate-400'>Nenhum conteúdo encontrado</p>",
                                  }}
                                />
                              </div>
                            </div>

                            <div className="flex gap-2 flex-wrap mt-auto">
                              <Button
                                onClick={() => {
                                  setTimeout(() => {
                                    formRef.current?.scrollIntoView({
                                      behavior: "smooth",
                                      block: "start",
                                    });
                                  }, 100);
                                  setEditingScript(script);
                                  setShowEditor(true);
                                }}
                                variant="outline"
                                size="sm"
                                className="border-teal-300 text-teal-700 hover:bg-teal-50 hover:border-teal-400 dark:border-teal-600 dark:text-teal-300 dark:hover:bg-teal-900/20"
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    disabled={deleteMutation.isPending}
                                    variant="outline"
                                    size="sm"
                                    className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-900/20"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Deletar
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="sm:max-w-md">
                                  <AlertDialogHeader className="text-center pb-4 border-b border-slate-200 dark:border-slate-700">
                                    <AlertDialogTitle className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400">
                                      <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                                        <Trash2 className="h-5 w-5" />
                                      </div>
                                      Confirmar Exclusão
                                    </AlertDialogTitle>
                                    <AlertDialogDescription className="text-slate-600 dark:text-slate-400 mt-2">
                                      Tem certeza que deseja excluir o script{" "}
                                      <strong>"{script.title}"</strong>?<br />
                                      Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
                                    <AlertDialogCancel className="border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
                                      Cancelar
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-red-500 hover:bg-red-600 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                      disabled={deleteMutation.isPending}
                                      onClick={() =>
                                        deleteMutation.mutate(script.id)
                                      }
                                    >
                                      {deleteMutation.isPending ? (
                                        <div className="flex items-center gap-2">
                                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                          Excluindo...
                                        </div>
                                      ) : (
                                        "Confirmar"
                                      )}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </CardContent>
                        </Card>
                      ))}

                    {scripts && scripts.length === 0 && !isLoadingScripts && (
                      <div className="col-span-full">
                        <Card className="text-center py-12">
                          <CardContent>
                            <ScrollText className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-600 mb-4" />
                            <p className="text-slate-500 dark:text-slate-400 text-lg font-medium mb-2">
                              Nenhum script encontrado
                            </p>
                            <p className="text-slate-400 dark:text-slate-500 text-sm">
                              Crie seu primeiro script de vendas
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-center">
                    <Button
                      onClick={() => {
                        setShowEditor(true);
                        setEditingScript(null);
                        setTimeout(() => {
                          formRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }, 100);
                      }}
                      className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Script
                    </Button>
                  </div>

                  {showEditor && (
                    <div ref={formRef} className="mt-6">
                      <ScriptForm
                        scriptToEdit={editingScript}
                        onOpenChange={setShowEditor}
                      />
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <CreateTrainingForm
        open={openCreateTrainingModal}
        onOpenChange={setOpenCreateTrainingModal}
        editingTrainingVideo={editingTraining}
      />

      <DocumentsUploadForm
        open={openDocumentForm}
        onOpenChange={setOpenDocumentForm}
        editingTraining={editingTraining}
        editFile={{ trainingId: trainingEditFile }}
      />

      <AlertDialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader className="text-center pb-4 border-b border-slate-200 dark:border-slate-700">
            <AlertDialogTitle className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <Trash2 className="h-5 w-5" />
              </div>
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400 mt-2">
              Tem certeza que deseja excluir este treinamento?
              <br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(trainingToDelete)}
            >
              {deleteMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Excluindo...
                </div>
              ) : (
                "Confirmar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
