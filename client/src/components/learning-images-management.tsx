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

  const categories = [
    "Vendas",
    "Produtos",
    "Sistema",
    "Atendimento",
    "Processos",
    "Geral",
  ];

  const { data: trainingVideos } = useQuery<Training[]>({
    queryKey: ["/api/trainings?type=video"],
    queryFn: async () => {
      const response = await fetch("/api/trainings?type=video");
      if (!response.ok) throw new Error("Failed to fetch training videos");
      return response.json();
    },
  });

  const { data: trainingDocument, isLoading: isLoadingDocuments } = useQuery<Training[]>({
    queryKey: ["/api/trainings?type=document"],
    queryFn: async () => {
      const response = await fetch("/api/trainings?type=document");
      if (!response.ok) throw new Error("Failed to fetch training videos");
      return response.json();
    },
  });

  const { data: scripts } = useQuery<Training[]>({
    queryKey: ["/api/trainings?type=script"],
    queryFn: async () => {
      const response = await fetch("/api/trainings?type=script");

      if (!response.ok) throw new Error("Failed to fetch training videos");

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

  const moveTraining = async (trainingId: string, direction: 'up' | 'down', type: string) => {
    try {
      const response = await fetch(`/api/trainings/${trainingId}/order`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ direction, type }),
      });

      if (!response.ok) {
        throw new Error('Failed to update training order');
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
        description: `Item movido para ${direction === 'up' ? 'cima' : 'baixo'} com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao atualizar ordem:", error);
      toast({
        title: "Erro ao atualizar ordem",
        description: "Ocorreu um erro ao atualizar a ordem. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const formRef = useRef<HTMLDivElement>(null);

  const documentsTrainings = trainingDocument; // Alias for clarity

  return (
    <div>
      <Separator className="bg-gray-200" />
      <div className="p-2 md:p-5">
        <div className="flex flex-col md:flex-row items-start gap-2 mb-5 justify-between">
          <div className="space-y-2">
            <h2 className="flex text-2xl font-semibold items-center gap-2">
              <GraduationCap className="h-6 w-6" /> Gerenciar treinamentos
            </h2>
            <p className="text-sm md:ml-8">
              Gerencie e crie seus treinamentos de vídeo, upload de documentos e
              manuais, etc.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <Tabs defaultValue="videos">
            <TabsList className="w-full flex-col sm:flex-row justify-evenly">
              <TabsTrigger className="w-full" value="videos">
                Vídeos
              </TabsTrigger>
              <TabsTrigger className="w-full" value="documents">
                Documentos e manuais
              </TabsTrigger>
              <TabsTrigger className="w-full" value="scripts">
                Script de vendas
              </TabsTrigger>
            </TabsList>

            <TabsContent className="w-full" value="videos">
              <div className="flex flex-col items-center gap-4">
                {trainingVideos &&
                  trainingVideos.map((training) => (
                    <div
                      className="rounded-md flex flex-col md:flex-row items-start gap-4 p-5 bg-white w-full shadow-lg"
                      key={training.id}
                    >
                      <div className="flex-1 w-full">
                        <h4 className="text-primary font-semibold text-lg">
                          {training.title}
                        </h4>
                        <p className="text-sm">{training.description}</p>

                        <div className="flex gap-2 mt-4 flex-wrap">
                          <Badge>{training.category}</Badge>
                          <Badge className="bg-orange-300">
                            {training.level}
                          </Badge>
                        </div>

                        <div className="flex gap-2 mt-6 flex-wrap">
                          <Button
                            onClick={() => {
                              setEditingTraining(training);
                              setOpenCreateTrainingModal(true);
                            }}
                            variant="outline"
                            size="sm"
                          >
                            <Pencil className="size-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            className="bg-red-500 text-white"
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setTrainingToDelete(training.id);
                              setOpenDeleteDialog(true);
                            }}
                          >
                            <Trash className="size-4 mr-1" />
                            Deletar
                          </Button>
                        </div>
                      </div>
                      <div className="w-full md:w-auto">
                        {training.attachmentUrl && (
                          <iframe
                            className="rounded-lg w-full md:w-[400px] h-auto aspect-video"
                            src={
                              training.attachmentUrl?.includes(
                                "www.youtube.com",
                              ) && !training.attachmentUrl.includes("embed")
                                ? getYouTubeEmbedUrl(training.attachmentUrl)
                                : training.attachmentUrl || ""
                            }
                            title={training.title}
                            allowFullScreen
                          />
                        )}
                      </div>
                    </div>
                  ))}
                {trainingVideos && trainingVideos.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    Nenhum Treinamento encontrado.
                  </div>
                )}

                <Button
                  type="button"
                  onClick={() => {
                    setEditingTraining(null);
                    setOpenCreateTrainingModal(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Criar Treinamento
                </Button>
              </div>
            </TabsContent>

            <TabsContent className="w-full" value="documents">
              <div className="flex flex-col gap-4 items-start">
                <section className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trainingDocument &&
                    trainingDocument.map((training) => (
                      <div
                        className="bg-white w-full min-h-56 p-5 shadow-lg rounded-md"
                        key={training.id}
                      >
                        <div className="h-full flex flex-col justify-between">
                          <div className="flex gap-4">
                            <File className="size-10 text-red-500 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-xl font-medium">
                                {training.title}
                              </p>
                              <p className="text-sm text-gray-500 pt-1">
                                {training.description}
                              </p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="rounded-full border-gray-300"
                                  size={"icon"}
                                >
                                  <EllipsisVertical className="size-4 text-gray-600" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="w-56" align="end">
                                <DropdownMenuItem className="p-0">
                                  <Button
                                    variant="ghost"
                                    className="w-full justify-start hover:bg-gray-100"
                                    onClick={() => {
                                      setOpenDocumentForm(true);
                                      setTrainingEditFile(null);
                                      setEditingTraining(training);
                                    }}
                                  >
                                    <Pencil className="mr-2" />
                                    Editar
                                  </Button>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="p-0">
                                  <Button
                                    variant="ghost"
                                    className="w-full justify-start hover:bg-gray-100"
                                    onClick={() => {
                                      setOpenDocumentForm(true);
                                      setEditingTraining(null);
                                      setTrainingEditFile(training.id);
                                    }}
                                  >
                                    <Upload className="mr-2" />
                                    Editar arquivo
                                  </Button>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="p-0">
                                  <Button
                                    variant="ghost"
                                    className="w-full text-red-500 justify-start hover:text-red-500 hover:bg-gray-100"
                                    disabled={
                                      deleteDocumentTrainingMutation.isPending
                                    }
                                    onClick={() =>
                                      deleteDocumentTrainingMutation.mutateAsync(
                                        training.id,
                                      )
                                    }
                                  >
                                    <Trash2 className="mr-2" />
                                    {deleteDocumentTrainingMutation.isPending
                                      ? "Deletando..."
                                      : "Deletar"}
                                  </Button>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="p-0">
                                  <Button
                                    variant="ghost"
                                    className="w-full justify-start hover:bg-gray-100"
                                    onClick={() => {
                                      const currentIndex = documentsTrainings?.findIndex(d => d.id === training.id) || 0;
                                      moveTraining(training.id, 'up', 'document');
                                    }}
                                  >
                                    <ArrowUp className="mr-2" />
                                    Mover para cima
                                  </Button>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="p-0">
                                  <Button
                                    variant="ghost"
                                    className="w-full justify-start hover:bg-gray-100"
                                    onClick={() => {
                                      const currentIndex = documentsTrainings?.findIndex(d => d.id === training.id) || 0;
                                      moveTraining(training.id, 'down', 'document');
                                    }}
                                  >
                                    <ArrowDown className="mr-2" />
                                    Mover para baixo
                                  </Button>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="flex justify-between items-center mt-4">
                            <div className="flex gap-2">
                              <Badge variant={"outline"}>
                                {training.category}
                              </Badge>
                              <Badge variant={"secondary"}>
                                {(documentsTrainings?.findIndex(d => d.id === training.id) || 0) + 1}º
                              </Badge>
                            </div>
                            <a
                              href={`https://pub-2430b33535154e839fd64049d300b4a4.r2.dev/${training.attachmentUrl}`}
                              className="border flex items-center gap-1 rounded-sm px-3 py-2 text-sm"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <BookOpen className="size-4 mr-1" />
                              Abrir
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                </section>

                <div className="w-full flex justify-center">
                  <Button
                    onClick={() => {
                      setEditingTraining(null);
                      setTrainingEditFile(null);
                      setOpenDocumentForm(true);
                    }}
                  >
                    <Upload className="h-4 w-4 mr-2" /> Enviar documento
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent className="w-full" value="scripts">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scripts?.map((script) => (
                  <div
                    key={script.id}
                    className="bg-white flex flex-col p-5 rounded-md shadow-md"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="flex-shrink-0" />

                      <div className="flex-1">
                        <h4 className="text-xl font-medium">{script.title}</h4>
                        <p className="text-sm">{script.description}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="rounded-full border-gray-300"
                            size={"icon"}
                          >
                            <EllipsisVertical className="size-4 text-gray-600" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end">
                          <DropdownMenuItem className="p-0">
                            <Button
                              variant="ghost"
                              className="w-full justify-start hover:bg-gray-100"
                              onClick={() => {
                                setOpenScriptForm(true);
                                setEditingScript(script);
                              }}
                            >
                              <Pencil className="mr-2" />
                              Editar
                            </Button>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="p-0">
                            <Button
                              variant="ghost"
                              className="w-full justify-start hover:bg-gray-100"
                              onClick={() => {
                                const currentIndex = scripts?.findIndex(s => s.id === script.id) || 0;
                                moveTraining(script.id, 'up', 'script');
                              }}
                            >
                              <ArrowUp className="mr-2" />
                              Mover para cima
                            </Button>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="p-0">
                            <Button
                              variant="ghost"
                              className="w-full justify-start hover:bg-gray-100"
                              onClick={() => {
                                const currentIndex = scripts?.findIndex(s => s.id === script.id) || 0;
                                moveTraining(script.id, 'down', 'script');
                              }}
                            >
                              <ArrowDown className="mr-2" />
                              Mover para baixo
                            </Button>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="p-0">
                            <Button
                              variant="ghost"
                              className="w-full text-red-500 justify-start hover:text-red-500 hover:bg-gray-100"
                              disabled={deleteScriptMutation.isPending}
                              onClick={() => deleteScriptMutation.mutate(script.id)}
                            >
                              <Trash2 className="mr-2" />
                              {deleteScriptMutation.isPending
                                ? "Deletando..."
                                : "Deletar"}
                            </Button>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div
                      style={{
                        backgroundColor: "#202938", // cor de fundo fixa
                        whiteSpace: "normal",
                        wordWrap: "break-word",
                        color: "white",
                      }}
                      className="prose flex-1 p-4 preview-content leading-none max-w-none max-h-96 overflow-x-hidden break-words"
                      dangerouslySetInnerHTML={{
                        __html: script.content || (
                          <p>Nenhum conteúdo encontrado</p>
                        ),
                      }}
                    />

                    <div className="mt-5 flex gap-2 flex-wrap">
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
                        variant={"outline"}
                        size="sm"
                      >
                        <Pencil className="mr-1" /> Editar
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            disabled={deleteMutation.isPending}
                            className="bg-red-500 text-white"
                            size="sm"
                          >
                            <Trash2 className="mr-1" /> Deletar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Deseja excluir esse script?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Essa ação não poderá ser desfeita
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-500 text-white"
                              disabled={deleteMutation.isPending}
                              onClick={() => deleteMutation.mutate(script.id)}
                            >
                              Confirmar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
              <div className="w-full flex justify-center mt-5">
                <Button
                  type="button"
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
                >
                  <Plus className="mr-2 h-4 w-4" /> Adicionar Script
                </Button>
              </div>

              {showEditor && (
                <div ref={formRef}>
                  <ScriptForm
                    scriptToEdit={editingScript}
                    onOpenChange={setShowEditor}
                  />
                </div>
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Deseja excluir esse treinamento?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não poderá ser desfeita
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 text-white"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(trainingToDelete)}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}