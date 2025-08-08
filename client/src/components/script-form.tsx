import { Button } from "./ui/button";

import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateScriptData, createScriptSchema } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

interface ScriptFormProps {
  onOpenChange: (open: boolean) => void;
}

export function ScriptForm({ onOpenChange }: ScriptFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateScriptData>({
    resolver: zodResolver(createScriptSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (script: CreateScriptData) => {
      const response = await fetch("/api/trainings/scripts", {
        method: "POST",
        body: JSON.stringify(script),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao criar script");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/trainings?type=script"],
      });
      onOpenChange(false);
      toast({
        title: "Sucesso",
        description: "Script criado com sucesso",
        variant: "default",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar script",
        variant: "destructive",
      });
    },
  });

  async function onSubmit(data: CreateScriptData) {
    await createMutation.mutateAsync(data);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mt-5 bg-white p-5 rounded-md shadow-lg flex flex-col gap-5"
    >
      <div>
        <h3 className="text-2xl font-semibold">Adicionar Novo Script</h3>
        <p className="text-sm text-gray-500">
          Utilize o editor de texto para criar um novo script de vendas para sua
          equipe.
        </p>
      </div>

      <div>
        <Label>Título *</Label>
        <Input placeholder="Título do script" {...register("title")} />
        {errors.title && (
          <p className="text-sm text-red-500">{errors.title.message}</p>
        )}
      </div>

      <div>
        <Label>Descrição *</Label>
        <Textarea placeholder="Título do script" {...register("description")} />
        {errors.description && (
          <p className="text-sm text-red-500">{errors.description.message}</p>
        )}
      </div>

      <div>
        <Label>Categoria *</Label>
        <Input placeholder="Categoria do script" {...register("category")} />
        {errors.category && (
          <p className="text-sm text-red-500">{errors.category.message}</p>
        )}
      </div>

      <div>
        <Label>Conteúdo *</Label>
        <Controller
          name="content"
          control={control}
          render={({ field }) => (
            <ReactQuill
              {...field}
              onChange={field.onChange}
              placeholder="Escreva seu script aqui..."
            />
          )}
        />
        {errors.content && (
          <p className="text-sm text-red-500">{errors.content.message}</p>
        )}
      </div>

      <div className="flex gap-2">
        <Button disabled={createMutation.isPending}>
          {createMutation.isPending ? "Enviando..." : "Enviar"}
        </Button>
        <Button
          onClick={() => {
            onOpenChange(false);
          }}
          type="button"
          variant={"outline"}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
