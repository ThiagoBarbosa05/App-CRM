import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

const productSchema = z.object({
  name: z.string().min(1, "Nome do vinho é obrigatório"),
  country: z.enum([
    "CHILE",
    "ARGENTINA",
    "URUGUAI",
    "BRASIL",
    "EUA",
    "FRANÇA",
    "ITÁLIA",
    "PORTUGAL",
    "ESPANHA",
    "ALEMANHA",
    "OUTROS",
  ]),
  volume: z.enum(["187ml", "375ml", "750ml", "1500ml"]),
  type: z.enum(["ESPUMANTE", "BRANCO", "ROSE", "TINTO", "PÓS-REFEIÇÃO"]),
  negotiatedPrice: z.string().min(1, "Valor negociado é obrigatório"),
});

type ProductFormData = z.infer<typeof productSchema>;

interface Product {
  id: string;
  name: string;
  country: string;
  volume: string;
  type: string;
  negotiatedPrice: string;
}

interface ProductFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}

export function ProductFormModal({
  open,
  onOpenChange,
  product,
}: ProductFormModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isEditing = !!product;

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      country: "BRASIL",
      volume: "750ml",
      type: "TINTO",
      negotiatedPrice: "",
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        country: product.country as any,
        volume: product.volume as any,
        type: product.type as any,
        negotiatedPrice: product.negotiatedPrice,
      });
    } else {
      form.reset({
        name: "",
        country: "BRASIL",
        volume: "750ml",
        type: "TINTO",
        negotiatedPrice: "",
      });
    }
  }, [product, form]);

  const productMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const url = isEditing ? `/api/products/${product.id}` : "/api/products";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorMessage = "Erro ao salvar produto";
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch {
          // Se a resposta não é JSON válido, usar mensagem padrão
          errorMessage = `Erro ${response.status}: ${response.statusText || "Falha na requisição"}`;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: isEditing ? "Produto atualizado" : "Produto criado",
        description: isEditing
          ? "O produto foi atualizado com sucesso."
          : "O produto foi criado com sucesso.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProductFormData) => {
    // Converter preços formatados para números
    const convertPrice = (price: string): string => {
      if (!price) return "0";
      // Remove todos os pontos (separadores de milhares) e substitui vírgula por ponto decimal
      return price.replace(/\./g, "").replace(",", ".");
    };

    const processedData = {
      ...data,
      negotiatedPrice: convertPrice(data.negotiatedPrice),
    };

    console.log("Dados processados para envio:", processedData);
    productMutation.mutate(processedData);
  };

  const formatCurrency = (value: string) => {
    const numericValue = value.replace(/\D/g, "");
    const formattedValue = (parseInt(numericValue) / 100).toLocaleString(
      "pt-BR",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    );
    return formattedValue;
  };

  const handlePriceChange = (value: string, field: any) => {
    const numericValue = value.replace(/\D/g, "");
    const formattedValue = formatCurrency(numericValue);
    field.onChange(formattedValue);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize as informações do produto."
              : "Preencha as informações do novo produto."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Vinho</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Cabernet Sauvignon Reserva"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>País</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CHILE">🇨🇱 Chile</SelectItem>
                        <SelectItem value="ARGENTINA">🇦🇷 Argentina</SelectItem>
                        <SelectItem value="URUGUAI">🇺🇾 Uruguai</SelectItem>
                        <SelectItem value="BRASIL">🇧🇷 Brasil</SelectItem>
                        <SelectItem value="EUA">🇺🇸 EUA</SelectItem>
                        <SelectItem value="FRANÇA">🇫🇷 França</SelectItem>
                        <SelectItem value="ITÁLIA">🇮🇹 Itália</SelectItem>
                        <SelectItem value="PORTUGAL">🇵🇹 Portugal</SelectItem>
                        <SelectItem value="ESPANHA">🇪🇸 Espanha</SelectItem>
                        <SelectItem value="ALEMANHA">🇩🇪 Alemanha</SelectItem>
                        <SelectItem value="OUTROS">🌍 Outros</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="volume"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Volume</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="187ml">187ml</SelectItem>
                        <SelectItem value="375ml">375ml</SelectItem>
                        <SelectItem value="750ml">750ml</SelectItem>
                        <SelectItem value="1500ml">1500ml</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ESPUMANTE">Espumante</SelectItem>
                      <SelectItem value="BRANCO">Branco</SelectItem>
                      <SelectItem value="ROSE">Rosé</SelectItem>
                      <SelectItem value="TINTO">Tinto</SelectItem>
                      <SelectItem value="PÓS-REFEIÇÃO">Pós-refeição</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="negotiatedPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor de Tabela</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0,00"
                      value={field.value}
                      onChange={(e) => handlePriceChange(e.target.value, field)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={productMutation.isPending}
                className="bg-wine-600 hover:bg-wine-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white"
              >
                {productMutation.isPending
                  ? "Salvando..."
                  : isEditing
                    ? "Atualizar"
                    : "Criar Produto"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
