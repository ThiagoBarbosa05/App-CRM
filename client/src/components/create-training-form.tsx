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
import { Training } from "./learning-images-management";

interface CreateTrainingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTrainingVideo: Training | null;
}

export function CreateTrainingForm({
  open,
  onOpenChange,
  editingTrainingVideo,
}: CreateTrainingFormProps) {
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
      queryClient.invalidateQueries({
        queryKey: ["/api/trainings?type=video"],
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
      queryClient.invalidateQueries({
        queryKey: ["/api/trainings?type=video"],
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
      videoUrl: editingTrainingVideo?.attachmentUrl || "",
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
        videoUrl: editingTrainingVideo.attachmentUrl || "",
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

          {/* Botões */}
          <div className="flex gap-2">
            <Button
              disabled={
                createTrainingMutation.isPending || updateMutation.isPending
              }
              type="submit"
            >
              {createTrainingMutation.isPending || updateMutation.isPending
                ? "Enviando..."
                : "Enviar"}
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
