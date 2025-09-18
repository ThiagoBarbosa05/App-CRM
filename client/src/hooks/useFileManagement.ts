import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

export interface FileUploadResponse {
  success: boolean;
  message: string;
  data?: {
    id: string;
    url: string;
    originalName: string;
    contentType: string;
    originalSizeBytes: number;
    fileType: string;
    createdAt: string;
    thumbnail?: string;
  };
  error?: string;
}

export interface FileDeleteResponse {
  success: boolean;
  message: string;
  data?: {
    fileId: string;
    deletedAt: string;
  };
  error?: string;
}

export function useFileUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { file: File; filename?: string; thumbnail?: string }): Promise<FileUploadResponse> => {
      const formData = new FormData();
      formData.append("file", data.file);

      if (data.filename) {
        formData.append("filename", data.filename);
      }

      if (data.thumbnail) {
        formData.append("thumbnail", data.thumbnail);
      }

      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Falha ao fazer upload do arquivo");
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Upload realizado com sucesso",
          description: `Arquivo ${data.data?.originalName} foi enviado com sucesso.`,
        });
        // Invalidar queries relacionadas a arquivos se existirem
        queryClient.invalidateQueries({ queryKey: ["files"] });
      } else {
        toast({
          title: "Erro no upload",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro no upload",
        description: error.message || "Não foi possível fazer upload do arquivo.",
        variant: "destructive",
      });
    },
  });
}

export function useFileDelete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fileId: string): Promise<FileDeleteResponse> => {
      const response = await fetch(`/api/files/${fileId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Falha ao deletar o arquivo");
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Arquivo deletado",
          description: "O arquivo foi removido com sucesso.",
        });
        // Invalidar queries relacionadas a arquivos se existirem
        queryClient.invalidateQueries({ queryKey: ["files"] });
      } else {
        toast({
          title: "Erro ao deletar",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao deletar",
        description: error.message || "Não foi possível deletar o arquivo.",
        variant: "destructive",
      });
    },
  });
}