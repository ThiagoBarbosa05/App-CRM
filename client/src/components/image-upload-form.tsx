import React from "react";
import { useForm } from "react-hook-form";

type FormData = {
  file: FileList;
};

export default function ImageUploadForm() {
  const { register, handleSubmit, reset } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    const formData = new FormData();
    formData.append("file", data.file[0]); // Apenas o primeiro arquivo

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        alert("Upload concluído!");
        reset();
      } else {
        alert("Erro no upload");
      }
    } catch (error) {
      console.error("Erro ao enviar:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="file" {...register("file", { required: true })} />

      <button
        type="submit"
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Enviar Imagem
      </button>
    </form>
  );
}
