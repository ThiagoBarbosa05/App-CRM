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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
} from "./ui/alert-dialog";
import ImageUploadForm from "./image-upload-form";
import { DocumentsUploadForm } from "./document-upload-form";
import { Link } from "wouter";

export interface Training {
  id: string;
  title: string;
  description: string;
  category: string;
  type: string;
  level: string | null;
  attachmentUrl: string | null;
  createdAt: Date;
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
// Mock data - em produção, isso viria da API
// const trainingVideos: TrainingVideo[] = [
//   {
//     id: "1",
//     title: "Introdução ao VinoCRM",
//     description:
//       "Aprenda os conceitos básicos do sistema e como navegar pela interface",
//     duration: "15:30",
//     category: "sistema",
//     level: "básico",
//     videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
//     thumbnail:
//       "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=300&h=200&fit=crop",
//   },
//   {
//     id: "2",
//     title: "Técnicas de Venda Consultiva",
//     description:
//       "Domine as técnicas de venda consultiva para melhorar seus resultados",
//     duration: "25:45",
//     category: "vendas",
//     level: "intermediário",
//     videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
//     thumbnail:
//       "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=300&h=200&fit=crop",
//   },
//   {
//     id: "3",
//     title: "Conhecimento dos Produtos",
//     description: "Conheça em detalhes os produtos e suas características",
//     duration: "20:15",
//     category: "produto",
//     level: "básico",
//     videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
//     thumbnail:
//       "https://images.unsplash.com/photo-1506377585622-bedcbb027afc?w=300&h=200&fit=crop",
//   },
//   {
//     id: "4",
//     title: "Atendimento ao Cliente Excelente",
//     description: "Como proporcionar uma experiência excepcional aos clientes",
//     duration: "18:20",
//     category: "atendimento",
//     level: "intermediário",
//     videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
//     thumbnail:
//       "https://images.unsplash.com/photo-1556745757-8d76bdb6984b?w=300&h=200&fit=crop",
//   },
// ];

// const trainingDocuments: TrainingDocument[] = [
//   {
//     id: "1",
//     title: "Manual do Usuário VinoCRM",
//     description: "Guia completo de uso do sistema",
//     category: "Sistema",
//     fileUrl: "https://exemplo.com/seu-documento.pdf",
//     fileType: "pdf",
//   },
//   {
//     id: "2",
//     title: "Catálogo de Produtos 2024",
//     description: "Catálogo completo com todos os produtos disponíveis",
//     category: "Produtos",
//     fileUrl: "#",
//     fileType: "pdf",
//   },
//   {
//     id: "3",
//     title: "Scripts de Vendas",
//     description: "Roteiros prontos para diferentes situações de venda",
//     category: "Vendas",
//     fileUrl: "#",
//     fileType: "doc",
//   },
//   {
//     id: "4",
//     title: "Política de Vendas",
//     description: "Diretrizes e políticas para o time de vendas",
//     category: "Vendas",
//     fileUrl: "#",
//     fileType: "pdf",
//   },
// ];

// Mock data para imagens de aprendizado - em produção viria da API
// const mockLearningImages: LearningImage[] = [
//   {
//     id: "1",
//     title: "Processo de Venda Consultiva",
//     description: "Fluxograma do processo de venda consultiva",
//     category: "Vendas",
//     imageUrl:
//       "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&h=300&fit=crop",
//     createdAt: new Date(),
//   },
//   {
//     id: "2",
//     title: "Características dos Vinhos",
//     description: "Infográfico sobre características dos vinhos",
//     category: "Produtos",
//     imageUrl:
//       "https://images.unsplash.com/photo-1506377585622-bedcbb027afc?w=500&h=300&fit=crop",
//     createdAt: new Date(),
//   },
//   {
//     id: "3",
//     title: "Interface do Sistema",
//     description: "Tutorial visual da interface do VinoCRM",
//     category: "Sistema",
//     imageUrl:
//       "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&h=300&fit=crop",
//     createdAt: new Date(),
//   },
// ];

export default function LearningImagesManagement() {
  // const [images, setImages] = useState<LearningImage[]>([]);
  // const [isUploading, setIsUploading] = useState(false);
  // const [showAddModal, setShowAddModal] = useState(false);

  const [openCreateTrainingModal, setOpenCreateTrainingModal] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);

  const [trainingToDelete, setTrainingToDelete] = useState("");

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  const [openDocumentForm, setOpenDocumentForm] = useState(false);

  // const [formData, setFormData] = useState({
  //   title: "",
  //   description: "",
  //   category: "Vendas",
  // });

  // const fileInputRef = useRef<HTMLInputElement>(null);
  // const { toast } = useToast();

  const categories = [
    "Vendas",
    "Produtos",
    "Sistema",
    "Atendimento",
    "Processos",
    "Geral",
  ];

  // const handleFileUpload = async (file: File) => {
  //   if (!file.type.startsWith("image/")) {
  //     toast({
  //       title: "Erro",
  //       description: "Por favor, selecione apenas arquivos de imagem.",
  //       variant: "destructive",
  //     });
  //     return;
  //   }

  //   if (file.size > 5 * 1024 * 1024) {
  //     // 5MB
  //     toast({
  //       title: "Erro",
  //       description: "A imagem deve ter no máximo 5MB.",
  //       variant: "destructive",
  //     });
  //     return;
  //   }

  //   setIsUploading(true);

  //   try {
  //     const formDataUpload = new FormData();
  //     formDataUpload.append("file", file);
  //     formDataUpload.append("title", formData.title);
  //     formDataUpload.append("description", formData.description);
  //     formDataUpload.append("category", formData.category);

  //     const response = await fetch("/api/learning-images", {
  //       method: "POST",
  //       body: formDataUpload,
  //     });

  //     if (!response.ok) {
  //       throw new Error("Erro no upload da imagem");
  //     }

  //     const newImage = await response.json();
  //     setImages((prev) => [newImage, ...prev]);

  //     toast({
  //       title: "Sucesso!",
  //       description: "Imagem de aprendizado adicionada com sucesso.",
  //     });

  //     setShowAddModal(false);
  //     setFormData({
  //       title: "",
  //       description: "",
  //       category: "Vendas",
  //     });
  //   } catch (error) {
  //     console.error("Erro no upload:", error);
  //     toast({
  //       title: "Erro",
  //       description: "Erro ao fazer upload da imagem. Tente novamente.",
  //       variant: "destructive",
  //     });
  //   } finally {
  //     setIsUploading(false);
  //   }
  // };

  // const handleDeleteImage = async (id: string) => {
  //   try {
  //     const response = await fetch(`/api/learning-images/${id}`, {
  //       method: "DELETE",
  //     });

  //     if (!response.ok) {
  //       throw new Error("Erro ao deletar imagem");
  //     }

  //     setImages((prev) => prev.filter((img) => img.id !== id));

  //     toast({
  //       title: "Sucesso!",
  //       description: "Imagem deletada com sucesso.",
  //     });
  //   } catch (error) {
  //     console.error("Erro ao deletar:", error);
  //     toast({
  //       title: "Erro",
  //       description: "Erro ao deletar a imagem. Tente novamente.",
  //       variant: "destructive",
  //     });
  //   }
  // };

  // const handleSubmit = () => {
  //   if (!formData.title.trim()) {
  //     toast({
  //       title: "Erro",
  //       description: "Por favor, insira um título para a imagem.",
  //       variant: "destructive",
  //     });
  //     return;
  //   }

  //   fileInputRef.current?.click();
  // };

  const { data: trainingVideos } = useQuery<Training[]>({
    queryKey: ["/api/trainings?type=video"],
    queryFn: async () => {
      const response = await fetch("/api/trainings?type=video");
      if (!response.ok) throw new Error("Failed to fetch training videos");
      return response.json();
    },
  });

  const { data: trainingDocument } = useQuery<Training[]>({
    queryKey: ["/api/trainings?type=document"],
    queryFn: async () => {
      const response = await fetch("/api/trainings?type=document");
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

  return (
    // <Card>
    //   <CardHeader>
    //     <div className="flex items-center justify-between">
    //       <div>
    //         <CardTitle className="flex items-center gap-2">
    //           <Image className="h-5 w-5 text-wine-600" />
    //           Imagens de Aprendizado
    //         </CardTitle>
    //         <CardDescription>
    //           Gerencie as imagens que aparecem na aba "Aprendizado" da página de
    //           Treinamentos
    //         </CardDescription>
    //       </div>

    //       <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
    //         <DialogTrigger asChild>
    //           <Button>
    //             <Plus className="h-4 w-4 mr-2" />
    //             Adicionar Imagem
    //           </Button>
    //         </DialogTrigger>
    //         <DialogContent className="sm:max-w-md">
    //           <DialogHeader>
    //             <DialogTitle>Adicionar Nova Imagem</DialogTitle>
    //             <DialogDescription>
    //               Preencha as informações e selecione uma imagem para upload
    //             </DialogDescription>
    //           </DialogHeader>

    //           <div className="space-y-4">
    //             <div>
    //               <Label htmlFor="title">Título</Label>
    //               <Input
    //                 id="title"
    //                 value={formData.title}
    //                 onChange={(e) =>
    //                   setFormData((prev) => ({
    //                     ...prev,
    //                     title: e.target.value,
    //                   }))
    //                 }
    //                 placeholder="Digite o título da imagem"
    //               />
    //             </div>

    //             <div>
    //               <Label htmlFor="description">Descrição</Label>
    //               <Textarea
    //                 id="description"
    //                 value={formData.description}
    //                 onChange={(e) =>
    //                   setFormData((prev) => ({
    //                     ...prev,
    //                     description: e.target.value,
    //                   }))
    //                 }
    //                 placeholder="Digite uma descrição para a imagem"
    //                 rows={3}
    //               />
    //             </div>

    //             <div>
    //               <Label htmlFor="category">Categoria</Label>
    //               <Select
    //                 value={formData.category}
    //                 onValueChange={(value) =>
    //                   setFormData((prev) => ({ ...prev, category: value }))
    //                 }
    //               >
    //                 <SelectTrigger>
    //                   <SelectValue />
    //                 </SelectTrigger>
    //                 <SelectContent>
    //                   {categories.map((category) => (
    //                     <SelectItem key={category} value={category}>
    //                       {category}
    //                     </SelectItem>
    //                   ))}
    //                 </SelectContent>
    //               </Select>
    //             </div>
    //           </div>

    //           <DialogFooter>
    //             <Button onClick={handleSubmit} disabled={isUploading}>
    //               {isUploading ? (
    //                 <>
    //                   <Upload className="h-4 w-4 mr-2 animate-spin" />
    //                   Enviando...
    //                 </>
    //               ) : (
    //                 <>
    //                   <Upload className="h-4 w-4 mr-2" />
    //                   Selecionar Arquivo
    //                 </>
    //               )}
    //             </Button>
    //           </DialogFooter>
    //         </DialogContent>
    //       </Dialog>
    //     </div>
    //   </CardHeader>

    //   <CardContent>
    //     <input
    //       ref={fileInputRef}
    //       type="file"
    //       accept="image/*"
    //       className="hidden"
    //       onChange={(e) => {
    //         const file = e.target.files?.[0];
    //         if (file) {
    //           handleFileUpload(file);
    //         }
    //       }}
    //     />

    //     {images.length === 0 ? (
    //       <div className="text-center py-8">
    //         <Image className="h-12 w-12 text-gray-400 mx-auto mb-4" />
    //         <h3 className="text-lg font-medium text-gray-900 mb-2">
    //           Nenhuma imagem cadastrada
    //         </h3>
    //         <p className="text-gray-600">
    //           Adicione imagens para aparecerem na aba "Aprendizado" dos
    //           treinamentos.
    //         </p>
    //       </div>
    //     ) : (
    //       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    //         {images.map((image) => (
    //           <Card key={image.id} className="overflow-hidden">
    //             <div className="relative">
    //               <img
    //                 src={image.imageUrl}
    //                 alt={image.title}
    //                 className="w-full h-32 object-cover"
    //               />
    //               <div className="absolute top-2 right-2 flex gap-1">
    //                 <Button
    //                   size="sm"
    //                   variant="secondary"
    //                   onClick={() => window.open(image.imageUrl, "_blank")}
    //                 >
    //                   <Eye className="h-3 w-3" />
    //                 </Button>
    //                 <Button
    //                   size="sm"
    //                   variant="destructive"
    //                   onClick={() => handleDeleteImage(image.id)}
    //                 >
    //                   <Trash2 className="h-3 w-3" />
    //                 </Button>
    //               </div>
    //             </div>
    //             <div className="p-3">
    //               <h4 className="font-medium text-sm mb-1">{image.title}</h4>
    //               <p className="text-xs text-gray-600 mb-2 line-clamp-2">
    //                 {image.description}
    //               </p>
    //               <div className="flex justify-between items-center">
    //                 <Badge variant="outline" className="text-xs">
    //                   {image.category}
    //                 </Badge>
    //                 <span className="text-xs text-gray-500">
    //                   {image.createdAt.toLocaleDateString()}
    //                 </span>
    //               </div>
    //             </div>
    //           </Card>
    //         ))}
    //       </div>
    //     )}
    //   </CardContent>
    // </Card>
    <>
      <Separator className="bg-gray-200" />
      <div className="p-5">
        <div className="flex items-start gap-2 mb-5 justify-between">
          <div className="space-y-2">
            <h2 className="flex text-2xl font-semibold items-center gap-2 ">
              <GraduationCap className="h-6 w-6" /> Gerenciar treinamentos
            </h2>
            <p className="text-sm ml-8">
              Gerencie e crie seus treinamentos de vídeo, upload de documentos e
              manuais, etc.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <Tabs defaultValue="videos">
            <TabsList className="w-full justify-evenly">
              <TabsTrigger className="w-full" value="videos">
                Vídeos
              </TabsTrigger>
              <TabsTrigger className="w-full" value="documents">
                Documentos e manuais
              </TabsTrigger>
              <TabsTrigger className="w-full" value="learning">
                Script de vendas
              </TabsTrigger>
            </TabsList>

            <TabsContent className="w-full" value="videos">
              <div className="flex flex-col items-center gap-4">
                {trainingVideos &&
                  trainingVideos.map((training) => (
                    <div
                      className="rounded-md flex items-start gap-2 p-5 bg-white w-full shadow-lg"
                      key={training.id}
                    >
                      <div className="flex-1">
                        <h4 className="text-primary font-semibold text-lg">
                          {training.title}
                        </h4>
                        <p className="text-sm">{training.description}</p>

                        <div className="flex gap-2 mt-4">
                          <Badge>{training.category}</Badge>
                          <Badge className="bg-orange-300">
                            {training.level}
                          </Badge>
                          {/* <Badge className="bg-green-300">
                          {training.duration}
                        </Badge> */}
                        </div>

                        <div className="flex gap-2 mt-6">
                          <Button
                            onClick={() => {
                              setEditingTraining(training);
                              setOpenCreateTrainingModal(true);
                            }}
                            variant="outline"
                          >
                            <Pencil className="size-4" />
                            Editar
                          </Button>
                          <Button
                            className="bg-red-500 text-white"
                            variant="destructive"
                            onClick={() => {
                              setTrainingToDelete(training.id);
                              setOpenDeleteDialog(true);
                            }}
                          >
                            <Trash className="size-4" />
                            Deletar
                          </Button>
                        </div>
                      </div>
                      <div>
                        {training.attachmentUrl && (
                          <iframe
                            className="rounded-lg"
                            src={
                              training.attachmentUrl?.includes(
                                "www.youtube.com"
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
                  <Plus className="h-4 w-4" />
                  Criar Treinamento
                </Button>
              </div>
            </TabsContent>

            <TabsContent className="w-full" value="documents">
              <div className="flex flex-col gap-4 items-start ">
                <section className="grid w-full grid-cols-3 gap-4">
                  {trainingDocument &&
                    trainingDocument.map((training) => (
                      <div
                        className="bg-white w-full min-h-56 p-5 shadow-lg rounded-md"
                        key={training.id}
                      >
                        <div className="h-full flex flex-col justify-between">
                          <div className="flex  justify-between">
                            <div>
                              <p className="text-xl font-medium">
                                {training.title}
                              </p>
                              <p className="text-sm text-gray-500 pt-1">
                                {training.description}
                              </p>
                            </div>
                            <File className="size-10 text-red-500" />
                          </div>
                          <div className=" flex justify-between items-center">
                            <Badge variant={"outline"}>
                              {training.category}
                            </Badge>
                            <a
                              href={`https://pub-2430b33535154e839fd64049d300b4a4.r2.dev/${training.attachmentUrl}`}
                              className="border flex items-center gap-1 rounded-sm px-3 py-2"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <BookOpen className="size-4 text-sm " />
                              Abrir
                            </a>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                setOpenDocumentForm(true);
                                setEditingTraining(training);
                              }}
                              variant={"outline"}
                            >
                              <Pencil className="size-4" />
                              Editar
                            </Button>
                            <Button className="bg-red-500 text-white">
                              <Trash className="size-4" />
                              Deletar
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                </section>

                <div className="w-full flex justify-center">
                  <Button
                    onClick={() => {
                      setEditingTraining(null);

                      setOpenDocumentForm(true);
                    }}
                  >
                    <Upload className="h-4 w-4 mr-2" /> Enviar documento
                  </Button>
                </div>
              </div>
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
    </>
  );
}
