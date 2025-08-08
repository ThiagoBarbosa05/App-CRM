// import { useForm } from "react-hook-form";
// import { Button } from "./ui/button";
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogHeader,
//   DialogTitle,
// } from "./ui/dialog";
// import { Input } from "./ui/input";
// import { Label } from "./ui/label";

// interface DocumentsUploadFormProps {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
// }

// type FormData = {
//   file: FileList;
//   title: string;
//   description: string;
//   category: string;
// };

// export function DocumentsUploadForm({
//   onOpenChange,
//   open,
// }: DocumentsUploadFormProps) {
//   const {
//     handleSubmit,
//     register,
//     watch,
//     formState: { errors },
//   } = useForm<FormData>();

//   async function onSubmit(data: FormData) {
//     console.log(data);
//   }

//   const file = watch("file");

//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//       <DialogContent>
//         <DialogHeader>
//           <DialogTitle>Upload de documentos e manuais</DialogTitle>
//           <DialogDescription>
//             Envie documentos nos seguintes formatos: .pdf, .csv, .xlsx, .xls,
//             .md, .doc, .docx, .ppt, .pptx, .txt
//           </DialogDescription>
//         </DialogHeader>

//         <form onSubmit={handleSubmit(onSubmit)} action="" className="space-y-4">
//           <div>
//             <Label>Arquivo *</Label>
//             <Input
//               type="file"
//               accept=".pdf, .csv, .xlsx, .xls, .md, .doc, .docx"
//               {...register("file", { required: true })}
//             />
//           </div>

//           <div>
//             <Label>Título *</Label>
//             <Input
//               {...register("title", { required: true })}
//               required
//               disabled={!file}
//               placeholder="Digite o título do documento"
//             />
//           </div>
//           <div>
//             <Label>Descrição *</Label>
//             <Input
//               {...register("description", { required: true })}
//               required
//               disabled={!file}
//               placeholder="Digite uma descrição para o documento"
//             />
//           </div>

//           <div>
//             <Label>Categoria *</Label>
//             <Input
//               {...register("category", { required: true })}
//               required
//               disabled={!file}
//               placeholder="Digite a categoria do documento"
//             />
//           </div>

//           <div className="flex gap-2">
//             <Button>Enviar</Button>
//             <Button
//               variant="outline"
//               type="button"
//               onClick={() => onOpenChange(false)}
//               className="border-red-500 hover:text-red-500 text-red-500"
//             >
//               Cancelar
//             </Button>
//           </div>
//         </form>
//       </DialogContent>
//     </Dialog>
//   );
// }

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { File, Loader, Loader2, LoaderCircle, X } from "lucide-react";
import {
  CreateDocumentTrainingData,
  UpdateDocumentTraining,
} from "@shared/schema";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Training } from "./learning-images-management";

// Schema de validação
const documentSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().min(1, "Descrição é obrigatória"),
  category: z.string().min(1, "Categoria é obrigatória"),
});

type DocumentFormData = z.infer<typeof documentSchema>;

interface DocumentsUploadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTraining: Training | null;
  editFile: {
    trainingId: string | null;
  };
}

export function DocumentsUploadForm({
  onOpenChange,
  open,
  editingTraining,
  editFile,
}: DocumentsUploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DocumentFormData>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      category: editingTraining?.category || "",
      description: editingTraining?.description || "",
      title: editingTraining?.title || "",
    },
  });

  // Mutação de upload do arquivo usando react-query
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erro ao enviar arquivo");
      }

      const data = await response.json();
      return {
        url: data.url,
        fileType: data.fileType,
      } as {
        url: string;
        fileType: string;
      };
    },
    onSuccess: ({ fileType, url }) => {
      setFileUrl(url);
      setFileType(fileType);
    },
    onError: () => {
      alert("Falha ao fazer upload do arquivo");
      setSelectedFile(null);
      setFileUrl(null);
      setFileType(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (training: CreateDocumentTrainingData) => {
      const response = await fetch("/api/trainings/documents", {
        method: "POST",
        body: JSON.stringify(training),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao criar treinamento");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/trainings?type=document"],
      });
      onOpenChange(false);
      toast({
        title: "Sucesso",
        description: "Treinamento criado com sucesso",
        variant: "default",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar treinamento",
        variant: "destructive",
      });
      setSelectedFile(null);
      setFileUrl(null);
      setFileType(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (
      training: UpdateDocumentTraining & { trainingId: string },
    ) => {
      const response = await fetch(
        `/api/trainings/documents/${training.trainingId}`,
        {
          method: "PUT",
          body: JSON.stringify(training),
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Erro ao criar treinamento");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/trainings?type=document"],
      });
      onOpenChange(false);
      toast({
        title: "Sucesso",
        description: "Treinamento atualizado com sucesso",
        variant: "default",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar treinamento",
        variant: "destructive",
      });
      setSelectedFile(null);
      setFileUrl(null);
      setFileType(null);
    },
  });

  const editArchiveMutation = useMutation({
    mutationFn: async ({
      file,
      trainingId,
    }: {
      file: File;
      trainingId: string;
    }) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/trainings/documents/${trainingId}/file`,
        {
          method: "PUT",
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error("Erro ao atualizar arquivo");
      }

      const data = await response.json();

      return {
        url: data.url,
        fileType: data.fileType,
      } as {
        url: string;
        fileType: string;
      };
    },
    onSuccess: ({ fileType, url }) => {
      setFileUrl(null);
      setFileType(null);
      setSelectedFile(null);
      onOpenChange(false);
      toast({
        title: "Sucesso",
        description: "Arquivo atualizado com sucesso",
        variant: "default",
      });

      queryClient.invalidateQueries({
        queryKey: ["/api/trainings?type=document"],
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar arquivo",
        variant: "destructive",
      });
      setSelectedFile(null);
      setFileUrl(null);
      setFileType(null);
    },
  });

  // Seleciona e faz upload do arquivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (editFile.trainingId) {
      editArchiveMutation.mutate({ file, trainingId: editFile.trainingId });
    } else {
      uploadMutation.mutate(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileUrl(null);
  };

  const onSubmit = async (data: DocumentFormData) => {
    if (editingTraining) {
      await updateMutation.mutateAsync({
        category: data.category,
        description: data.description,
        title: data.title,
        trainingId: editingTraining.id,
      });
    } else {
      if (!fileUrl) {
        alert("Você deve enviar um documento antes de criar o treinamento.");
        return;
      }

      await createMutation.mutateAsync({
        category: data.category,
        description: data.description,
        title: data.title,
        documentUrl: fileUrl,
        documentType: fileType!,
      });
    }

    // Enviar para backend...
    reset();
    handleRemoveFile();
  };

  useEffect(() => {
    if (!open) return;
    if (editingTraining) {
      setFileUrl(editingTraining.attachmentUrl);
      reset({
        category: editingTraining?.category,
        description: editingTraining?.description,
        title: editingTraining?.title,
      });
    } else {
      setFileUrl(null);
      reset({
        title: "",
        description: "",
        category: "",
      });
    }
  }, [editingTraining, reset, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload de documentos e manuais</DialogTitle>
          <DialogDescription>
            Envie documentos nos seguintes formatos: .pdf, .csv, .xlsx, .xls,
            .md, .doc, .docx, .ppt, .pptx, .txt
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!editFile.trainingId && (
            <>
              <div>
                <Label>Título *</Label>
                <Input
                  type="text"
                  placeholder="Ex: Treinamento de Atendimento"
                  disabled={!fileUrl}
                  {...register("title")}
                />
                {errors.title && (
                  <p className="text-red-500 text-sm">{errors.title.message}</p>
                )}
              </div>

              <div>
                <Label>Descrição *</Label>
                <Input
                  type="text"
                  placeholder="Breve descrição"
                  disabled={!fileUrl}
                  {...register("description")}
                />
                {errors.description && (
                  <p className="text-red-500 text-sm">
                    {errors.description.message}
                  </p>
                )}
              </div>

              <div>
                <Label>Categoria *</Label>
                <Input
                  type="text"
                  placeholder="Categoria do documento, ex: vendas, produto..."
                  disabled={!fileUrl}
                  {...register("category")}
                />
                {errors.category && (
                  <p className="text-red-500 text-sm">
                    {errors.category.message}
                  </p>
                )}
              </div>
            </>
          )}

          {!editingTraining && (
            <div>
              <Label>Documento (PDF, DOCX, etc.)</Label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.md,.csv,.xlsx"
                onChange={handleFileChange}
                disabled={!!fileUrl || uploadMutation.isPending}
              />
            </div>
          )}

          {uploadMutation.isPending && (
            <div className="flex items-center justify-center gap-2">
              <p className="text-sm text-gray-400">Enviado documento...</p>
              <Loader2 className="animate-spin size-4" />
            </div>
          )}

          {selectedFile && !uploadMutation.isPending && (
            <div className="border relative p-5 rounded bg-gray-50 space-y-2">
              <div className="flex gap-2 items-start ">
                <Button
                  type="button"
                  variant="destructive"
                  className="absolute text-red-500 top-0 right-0"
                  size={"icon"}
                  onClick={handleRemoveFile}
                  title="remover arquivo"
                  disabled={uploadMutation.isPending}
                >
                  <X className="h-6 w-6" />
                </Button>
                <File />

                <div>
                  <strong>Arquivo:</strong> {selectedFile.name}
                  <div>
                    <strong>Tamanho:</strong>{" "}
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </div>
                </div>
              </div>
            </div>
          )}

          {editArchiveMutation.isPending && (
            <div className="w-full flex justify-center items-center mt-5 text-gray-500">
              <p>{"Enviando arquivo..."}</p>
              <Loader2 className="size-4 animate-spin" />
            </div>
          )}

          {!editFile.trainingId && (
            <Button
              type="submit"
              disabled={
                !fileUrl ||
                uploadMutation.isPending ||
                updateMutation.isPending ||
                createMutation.isPending
              }
              className="disabled:bg-black"
            >
              {uploadMutation.isPending ||
              uploadMutation.isPending ||
              updateMutation.isPending ||
              createMutation.isPending
                ? "Enviando..."
                : "Enviar"}
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
