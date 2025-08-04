import { Upload, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useCreateTrainingForm } from "@/hooks/use-training-form";
import {
  CreateTrainingData,
  createTrainingSchema,
  InsertTraining,
  insertTrainingSchema,
} from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { TrainingVideo } from "./learning-images-management";

interface CreateTrainingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTrainingVideo: TrainingVideo | null;
}

export function CreateTrainingForm({
  open,
  onOpenChange,
  editingTrainingVideo,
}: CreateTrainingFormProps) {
  // const {
  //   register,
  //   handleSubmit,
  //   control,
  //   formState: { errors },
  //   watch,
  //   setValue,
  // } = useCreateTrainingForm();

  // const selectedTrainingType = watch("trainingType");
  // const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  // const [documentFiles, setDocumentFiles] = useState<File[]>([]);

  // const onSubmit = (data: CreateTrainingData) => {
  //   const files = data.files ? Array.from(data.files) : [];

  //   console.log(data);

  //   const formData = new FormData();
  //   formData.append("title", data.title);
  //   formData.append("description", data.description);
  //   formData.append("category", data.category);
  //   if (data.level) formData.append("level", data.level);
  //   formData.append("trainingType", data.trainingType);

  //   if (data.trainingType === "video" && data.videoUrl) {
  //     formData.append("videoUrl", data.videoUrl);
  //   }

  //   files.forEach((file) => {
  //     formData.append("files", file as File);
  //   });
  // };

  // function removeImage(index: number) {
  //   setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  //   const updatedFiles = (watch("files") || []).filter(
  //     (_: any, i: number) => i !== index
  //   );
  //   setValue("files", updatedFiles);
  // }

  // function removeDocument(index: number) {
  //   setDocumentFiles((prev) => prev.filter((_, i) => i !== index));
  //   const updatedFiles = (watch("files") || []).filter(
  //     (_: any, i: number) => i !== index
  //   );
  //   setValue("files", updatedFiles);
  // }

  const createTrainingMutation = useMutation({
    mutationFn: async (data: CreateTrainingData) => {
      const response = await fetch("/api/trainings/video", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trainings"] });
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
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CreateTrainingData) => {
      const response = await fetch(
        `/api/trainings/video/${editingTrainingVideo?.id}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trainings"] });
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
    },
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateTrainingData>({
    resolver: zodResolver(createTrainingSchema),
    defaultValues: {
      title: editingTrainingVideo?.title || "",
      description: editingTrainingVideo?.description || "",
      category: editingTrainingVideo?.category || "",
      level: editingTrainingVideo?.level || "",
      videoUrl: editingTrainingVideo?.videoUrl || "",
      type: editingTrainingVideo?.type || "",
    },
  });

  useEffect(() => {
    if (!open) return;

    if (editingTrainingVideo) {
      reset({
        title: editingTrainingVideo.title,
        description: editingTrainingVideo.description,
        category: editingTrainingVideo.category,
        level: editingTrainingVideo.level || "",
        videoUrl: editingTrainingVideo.videoUrl || "",
        type: editingTrainingVideo.type || "video",
      });
    } else {
      reset({
        title: "",
        description: "",
        category: "",
        level: "",
        videoUrl: "",
        type: "video",
      });
    }
  }, [open, editingTrainingVideo, reset]);

  async function onSubmit(data: CreateTrainingData) {
    if (editingTrainingVideo) {
      await updateMutation.mutateAsync(data);
    } else {
      await createTrainingMutation.mutateAsync(data);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-auto">
        <DialogHeader>
          <DialogTitle>Criar novo treinamento</DialogTitle>
          <DialogDescription>
            Adicione um novo treinamento para seus usuários
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-5">
          {/* Título */}
          <div>
            <Label>Título *</Label>
            <Input
              type="text"
              required
              placeholder="Título do treinamento"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-red-500 text-sm">{errors.title.message}</p>
            )}
          </div>

          {/* Descrição */}
          <div>
            <Label>Descrição *</Label>
            <Textarea
              required
              placeholder="Descrição do treinamento"
              {...register("description")}
            />
            {errors.description && (
              <p className="text-red-500 text-sm">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Categoria */}
          <div>
            <Label>Categoria *</Label>
            <Input
              required
              type="text"
              placeholder="Ex: Vendas, atendimento ao cliente..."
              {...register("category")}
            />
            {errors.category && (
              <p className="text-red-500 text-sm">{errors.category.message}</p>
            )}
          </div>

          {/* Nível */}
          <div>
            <Label>Nível do treinamento</Label>
            <Controller
              name="level"
              control={control}
              render={({ field }) => (
                <Select
                  required
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o nível do treinamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="básico">Básico</SelectItem>
                    <SelectItem value="intermediário">Intermediário</SelectItem>
                    <SelectItem value="avançado">Avançado</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Tipo */}
          {/* <div>
            <Label>Tipo do treinamento *</Label>
            <Controller
              name="trainingType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo do treinamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="images">Imagens</SelectItem>
                    <SelectItem value="documents">Documentos</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.trainingType && (
              <p className="text-red-500 text-sm">
                {errors.trainingType.message}
              </p>
            )}
          </div> */}

          {/* Vídeo */}

          <input type="hidden" value={"video"} {...register("type")} />

          <div>
            <Label>Url do Vídeo *</Label>
            <Input
              type="url"
              placeholder="https://www.youtube.com/video"
              {...register("videoUrl")}
            />
            {errors.videoUrl && (
              <p className="text-red-500 text-sm">{errors.videoUrl.message}</p>
            )}
          </div>

          {/* Imagens */}
          {/* {selectedTrainingType === "images" && (
            <div>
              <span className="text-sm font-medium">Adicionar imagens *</span>
              <Label
                htmlFor="image-upload"
                className="bg-primary text-white p-2 rounded-md flex items-center gap-2 cursor-pointer mt-1"
              >
                <Upload className="size-5" />
                Escolher arquivos
              </Label>

              <Input
                id="image-upload"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setImagePreviews((prev) => [
                    ...prev,
                    ...files.map((file) => URL.createObjectURL(file)),
                  ]);
                  setValue("files", [...(watch("files") || []), ...files]);
                }}
              />

              <div className="flex items-center flex-wrap gap-2 mt-5">
                {imagePreviews.map((image, index) => (
                  <div
                    className="relative w-32 h-32 border border-[#7c3aed] rounded-md"
                    key={index}
                  >
                    <img
                      className="object-cover w-full h-full rounded-md"
                      src={image}
                      alt="Preview"
                    />
                    <Button
                      type="button"
                      size="icon"
                      className="absolute top-1 right-1 bg-red-500 text-white"
                      onClick={() => removeImage(index)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )} */}

          {/* Documentos */}
          {/* {selectedTrainingType === "documents" && (
            <div>
              <span className="text-sm font-medium">
                Adicionar documentos *
              </span>
              <Label
                htmlFor="document-upload"
                className="bg-primary text-white p-2 rounded-md flex items-center gap-2 cursor-pointer mt-1"
              >
                <Upload className="size-5" />
                Escolher arquivos
              </Label>

              <Input
                id="document-upload"
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setDocumentFiles((prev) => [...prev, ...files]);
                  setValue("files", [...(watch("files") || []), ...files]);
                }}
              />

              <ul className="mt-2 ml-4 list-disc text-sm">
                {documentFiles.map((file, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between gap-2"
                  >
                    {file.name}
                    <Button
                      type="button"
                      size="icon"
                      className="bg-red-500 text-white"
                      onClick={() => removeDocument(index)}
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )} */}

          {/* Botões */}
          <div className="flex gap-2">
            <Button
              disabled={
                createTrainingMutation.isPending || updateMutation.isPending
              }
              type="submit"
            >
              {createTrainingMutation.isPending ? "Enviando..." : "Enviar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
