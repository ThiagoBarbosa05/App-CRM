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

import { useState } from "react";

import { Controller } from "react-hook-form";
import {
  CreateTrainingData,
  useCreateTrainingForm,
} from "@/hooks/use-training-form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";

interface CreateTrainingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTrainingForm({
  open,
  onOpenChange,
}: CreateTrainingFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    watch,
  } = useCreateTrainingForm();

  const selectedTrainingType = watch("trainingType");

  const [multipleFiles, setMultipleFiles] = useState<string[]>([]);

  const onSubmit = (data: CreateTrainingData) => {
    const files = data.files ? Array.from(data.files) : [];

    const formData = new FormData();
    formData.append("title", data.title);
    formData.append("description", data.description);
    formData.append("category", data.category);
    if (data.level) formData.append("level", data.level);
    formData.append("trainingType", data.trainingType);

    if (data.trainingType === "video" && data.videoUrl) {
      formData.append("videoUrl", data.videoUrl);
    }

    files.forEach((file) => {
      formData.append("files", file as File);
    });

    // Exemplo: envio para API
    fetch("/api/trainings", {
      method: "POST",
      body: formData,
    });

    console.log("Enviado:", formData);
  };

  function removeImage(index: number) {
    setMultipleFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[1200px] h-full overflow-auto ">
        <SheetHeader>
          <SheetTitle>Criar novo treinamento</SheetTitle>
          <SheetDescription>
            Adicione um novo treinamento para seus usuários
          </SheetDescription>
        </SheetHeader>

        <form
          className="space-y-4 w-full mt-5 rounded-lg"
          onSubmit={handleSubmit(onSubmit)}
        >
          <div>
            <Label>Título *</Label>
            <Input
              type="text"
              placeholder="Título do treinamento"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-red-500 text-sm">{errors.title.message}</p>
            )}
          </div>

          <div>
            <Label>Descrição *</Label>
            <Textarea
              placeholder="Descrição do treinamento"
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
              placeholder="Ex: Vendas, atendimento ao cliente..."
              {...register("category")}
            />
            {errors.category && (
              <p className="text-red-500 text-sm">{errors.category.message}</p>
            )}
          </div>

          <div>
            <Label>Nível do treinamento</Label>
            <Controller
              name="level"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o nível do treinamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Básico</SelectItem>
                    <SelectItem value="intermediate">Intermediário</SelectItem>
                    <SelectItem value="advanced">Avançado</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div>
            <Label>Tipo do treinamento *</Label>
            <Controller
              name="trainingType"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => field.onChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo do treinamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="images">Imagens</SelectItem>
                    <SelectItem value="documents">Documento</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.trainingType && (
              <p className="text-red-500 text-sm">
                {errors.trainingType.message}
              </p>
            )}
          </div>

          {selectedTrainingType === "video" && (
            <div>
              <Label>Url do Vídeo *</Label>
              <Input
                type="url"
                placeholder="https://www.youtube.com/video"
                {...register("videoUrl")}
              />
              {errors.videoUrl && (
                <p className="text-red-500 text-sm">
                  {errors.videoUrl.message}
                </p>
              )}
            </div>
          )}

          {selectedTrainingType === "images" && (
            <div>
              <span className="text-sm font-medium">Adicionar imagens *</span>
              <Label
                htmlFor="image-upload"
                className="bg-primary cursor-pointer mt-1 flex items-center gap-2 justify-center p-2 rounded-md text-white"
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
                {...register("files")}
                onChange={(e) => {
                  if (e.target.files) {
                    const imageArray = Array.from(e.target.files).map((file) =>
                      URL.createObjectURL(file),
                    );
                    setMultipleFiles((prev) => [...prev, ...imageArray]);
                  }
                }}
              />
              {/* {errors.files && (
                <p className="text-red-500 text-sm">{errors.files.message}</p>
              )} */}

              <div className="flex items-center flex-wrap gap-2 mt-5">
                {multipleFiles.map((image, index) => (
                  <div
                    className="w-full relative h-48 border border-[#7c3aed]  rounded-md"
                    key={index}
                  >
                    <img
                      className="object-contain w-full h-full"
                      src={image}
                      alt="Uploaded"
                    />
                    <Button
                      className="bg-red-500 absolute top-2 right-2 text-white"
                      size="icon"
                      onClick={() => removeImage(index)}
                      type="button"
                    >
                      <X />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedTrainingType === "documents" && (
            <div>
              <span className="text-sm font-medium">
                Adicionar documentos *
              </span>
              <Label
                htmlFor="document-upload"
                className="bg-primary cursor-pointer mt-1 flex items-center gap-2 justify-center p-2 rounded-md text-white"
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
                {...register("files")}
              />
              {/* {errors.files && (
                <p className="text-red-500 text-sm">{errors.files.message}</p>
              )} */}
              {watch("files") && (
                <ul className="text-sm mt-2 list-disc ml-4">
                  {Array.from(watch("files") || []).map((file, index) => (
                    <li key={index}>{(file as File).name}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit">Criar</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
