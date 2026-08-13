import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { resizeImageFile } from "@/lib/image-resize";

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

async function resizeImageFileSafe(file: File): Promise<Blob> {
  try {
    return await resizeImageFile(file);
  } catch {
    throw new Error("Não foi possível processar a imagem. Tente outro arquivo.");
  }
}

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileModal({ open, onOpenChange }: ProfileModalProps) {
  const { user, updateUserAuthenticated } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const blob = await resizeImageFileSafe(file);
      const formData = new FormData();
      formData.append("file", blob, "avatar.jpg");

      const response = await fetch("/api/users/me/avatar", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "Não foi possível enviar a foto");
      }

      return (await response.json()) as { avatarUrl: string | null };
    },
    onSuccess: ({ avatarUrl }) => {
      if (user) updateUserAuthenticated({ ...user, avatarUrl });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Foto atualizada" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/users/me/avatar", {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "Não foi possível remover a foto");
      }
    },
    onSuccess: () => {
      if (user) updateUserAuthenticated({ ...user, avatarUrl: null });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Foto removida" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Zera o input para que escolher o MESMO arquivo de novo volte a disparar o change.
    event.target.value = "";
    if (!file) return;

    if (!ALLOWED_MIMES.includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Envie uma imagem JPEG, PNG ou WebP.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_BYTES) {
      toast({
        title: "Imagem muito grande",
        description: "A imagem deve ter no máximo 5 MB.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setIsProcessing(false);
    }
  };

  const isBusy = isProcessing || uploadMutation.isPending || removeMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Meu perfil</DialogTitle>
          <DialogDescription>
            Sua foto aparece na barra lateral e para a equipe no chat interno.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <Avatar className="h-24 w-24">
            <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.name ?? "Usuário"} />
            <AvatarFallback className="text-xl">
              {initials(user?.name ?? "?")}
            </AvatarFallback>
          </Avatar>

          <div className="text-center">
            <p className="font-medium text-foreground">{user?.name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex gap-2">
            <Button
              type="button"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              {isBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Camera className="mr-2 h-4 w-4" />
              )}
              Alterar foto
            </Button>

            {user?.avatarUrl && (
              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => removeMutation.mutate()}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remover
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
