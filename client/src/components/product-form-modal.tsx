import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
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
import { Wine, Building2, Globe, Ruler, Tag, DollarSign, Image } from "lucide-react";

interface ProductCategory {
  id: string;
  name: string;
}

const productSchema = z
  .object({
    name: z.string().min(1, "Nome do vinho é obrigatório"),
    winery: z.string().optional(),
    category: z.string().min(1, "Categoria é obrigatória"),
    country: z.string().optional(),
    volume: z.enum(["187ml", "375ml", "750ml", "1500ml"]).optional(),
    type: z
      .enum(["ESPUMANTE", "BRANCO", "ROSE", "TINTO", "PÓS-REFEIÇÃO"])
      .optional(),
    negotiatedPrice: z.string().min(1, "Valor de tabela é obrigatório"),
    imageUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const isVinho = data.category
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .startsWith("VINHO");

    if (isVinho) {
      if (!data.country) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "País é obrigatório", path: ["country"] });
      }
      if (!data.volume) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Volume é obrigatório", path: ["volume"] });
      }
      if (!data.type) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Tipo é obrigatório", path: ["type"] });
      }
    }
  });

type ProductFormData = z.infer<typeof productSchema>;

interface Product {
  id: string;
  name: string;
  winery?: string | null;
  category?: string;
  country: string;
  volume: string;
  type: string;
  negotiatedPrice: string;
  imageUrl?: string | null;
}

interface ProductFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}

const TYPE_COLORS: Record<string, string> = {
  TINTO: "bg-rose-50 text-rose-700 border-rose-200",
  BRANCO: "bg-amber-50 text-amber-700 border-amber-200",
  ROSE: "bg-pink-50 text-pink-700 border-pink-200",
  ESPUMANTE: "bg-blue-50 text-blue-700 border-blue-200",
  "PÓS-REFEIÇÃO": "bg-violet-50 text-violet-700 border-violet-200",
};

function FieldSection({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      {children}
    </div>
  );
}

export function ProductFormModal({ open, onOpenChange, product }: ProductFormModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isEditing = !!product;

  const { data: productCategories = [] } = useQuery<ProductCategory[]>({
    queryKey: ["/api/product-categories"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: countries = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/tags/countries"],
    staleTime: 5 * 60 * 1000,
  });

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      winery: "",
      category: "",
      country: "BRASIL",
      volume: "750ml",
      type: "TINTO",
      negotiatedPrice: "",
      imageUrl: "",
    },
  });

  const watchedCategory = form.watch("category");
  const watchedType = form.watch("type");
  const isWine = watchedCategory
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .startsWith("VINHO") ?? false;

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        winery: product.winery ?? "",
        category: product.category || "",
        country: (product.country as any) || undefined,
        volume: product.volume as any,
        type: (product.type as any) || undefined,
        negotiatedPrice: product.negotiatedPrice,
        imageUrl: product.imageUrl ?? "",
      });
    } else {
      form.reset({
        name: "",
        winery: "",
        category: "",
        country: "BRASIL",
        volume: "750ml",
        type: "TINTO",
        negotiatedPrice: "",
        imageUrl: "",
      });
    }
  }, [product, open]);


  const productMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const url = isEditing ? `/api/products/${product.id}` : "/api/products";
      const method = isEditing ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Erro ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/statistics"] });
      toast({
        title: isEditing ? "Produto atualizado" : "Produto criado",
        description: isEditing ? "As informações foram atualizadas." : "Produto cadastrado com sucesso.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: ProductFormData) => {
    const convertPrice = (price: string): string =>
      price.replace(/\./g, "").replace(",", ".");

    productMutation.mutate({
      ...data,
      negotiatedPrice: convertPrice(data.negotiatedPrice),
      imageUrl: data.imageUrl || undefined,
      winery: data.winery || undefined,
    });
  };

  const handlePriceChange = (value: string, field: any) => {
    const numericValue = value.replace(/\D/g, "");
    if (!numericValue) { field.onChange(""); return; }
    const formatted = (parseInt(numericValue) / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    field.onChange(formatted);
  };

  const typeColorClass = watchedType ? TYPE_COLORS[watchedType] ?? "" : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-[2rem] border-0 shadow-2xl overflow-hidden p-0">
        {/* Header */}
        <div className="bg-gradient-to-br from-wine-700 to-wine-900 p-8 text-white relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #7c2d3e 0%, #4a1525 100%)" }}>
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-36 h-36 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 -ml-6 -mb-6 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
          <DialogHeader className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur-sm">
                <Wine className="h-5 w-5 text-white" />
              </div>
              {isEditing && watchedType && (
                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${typeColorClass}`}>
                  {watchedType}
                </span>
              )}
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">
              {isEditing ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
            <p className="text-white/60 text-sm font-medium mt-1">
              {isEditing ? "Atualize as informações do produto." : "Preencha os dados para cadastrar."}
            </p>
          </DialogHeader>
        </div>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-8 space-y-5 max-h-[68vh] overflow-y-auto">

            {/* Nome */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FieldSection icon={Wine} label="Nome do produto">
                    <FormControl>
                      <Input
                        placeholder="Ex: Cabernet Sauvignon Reserva"
                        className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-semibold focus:ring-2 focus:ring-wine-500/20 focus:border-wine-500 outline-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FieldSection>
                </FormItem>
              )}
            />

            {/* Vinícola */}
            <FormField
              control={form.control}
              name="winery"
              render={({ field }) => (
                <FormItem>
                  <FieldSection icon={Building2} label="Vinícola">
                    <FormControl>
                      <Input
                        placeholder="Ex: Miolo, Salton, Don Melchor..."
                        className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-semibold focus:ring-2 focus:ring-wine-500/20 focus:border-wine-500 outline-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FieldSection>
                </FormItem>
              )}
            />

            {/* Categoria */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FieldSection icon={Tag} label="Categoria">
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-semibold">
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(productCategories as ProductCategory[]).map((cat) => (
                          <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FieldSection>
                </FormItem>
              )}
            />

            {/* País + Volume */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FieldSection icon={Globe} label="País de origem">
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-semibold">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(countries as { id: string; name: string }[]).map((c) => (
                            <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FieldSection>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="volume"
                render={({ field }) => (
                  <FormItem>
                    <FieldSection icon={Ruler} label="Volume">
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-semibold">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="187ml">187 ml</SelectItem>
                          <SelectItem value="375ml">375 ml</SelectItem>
                          <SelectItem value="750ml">750 ml</SelectItem>
                          <SelectItem value="1500ml">1500 ml</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FieldSection>
                  </FormItem>
                )}
              />
            </div>

            {/* Tipo */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FieldSection icon={Wine} label="Tipo de vinho">
                        <div className="grid grid-cols-5 gap-2">
                          {(["ESPUMANTE", "BRANCO", "ROSE", "TINTO", "PÓS-REFEIÇÃO"] as const).map((t) => {
                            const labels: Record<string, string> = {
                              ESPUMANTE: "Espumante", BRANCO: "Branco", ROSE: "Rosé",
                              TINTO: "Tinto", "PÓS-REFEIÇÃO": "Pós-ref.",
                            };
                            const isSelected = field.value === t;
                            const colorMap: Record<string, string> = {
                              TINTO: isSelected ? "bg-rose-600 text-white border-rose-600" : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100",
                              BRANCO: isSelected ? "bg-amber-500 text-white border-amber-500" : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
                              ROSE: isSelected ? "bg-pink-500 text-white border-pink-500" : "bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100",
                              ESPUMANTE: isSelected ? "bg-blue-600 text-white border-blue-600" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
                              "PÓS-REFEIÇÃO": isSelected ? "bg-violet-600 text-white border-violet-600" : "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100",
                            };
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => field.onChange(t)}
                                className={`h-10 rounded-xl border text-[10px] font-black uppercase tracking-wide transition-all ${colorMap[t]}`}
                              >
                                {labels[t]}
                              </button>
                            );
                          })}
                        </div>
                        <FormControl>
                          <input type="hidden" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FieldSection>
                    </FormItem>
                  )}
                />

            {/* Valor de tabela */}
            <FormField
              control={form.control}
              name="negotiatedPrice"
              render={({ field }) => (
                <FormItem>
                  <FieldSection icon={DollarSign} label="Valor de tabela">
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                        <Input
                          placeholder="0,00"
                          value={field.value}
                          onChange={(e) => handlePriceChange(e.target.value, field)}
                          className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold pl-10 focus:ring-2 focus:ring-wine-500/20 focus:border-wine-500 outline-none"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FieldSection>
                </FormItem>
              )}
            />

            {/* Imagem (URL) */}
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FieldSection icon={Image} label="URL da imagem (opcional)">
                    <FormControl>
                      <Input
                        placeholder="https://..."
                        className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-medium focus:ring-2 focus:ring-wine-500/20 focus:border-wine-500 outline-none"
                        {...field}
                      />
                    </FormControl>
                    {field.value && (
                      <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 h-24 bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                        <img
                          src={field.value}
                          alt="Preview"
                          className="h-full object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                    )}
                    <FormMessage />
                  </FieldSection>
                </FormItem>
              )}
            />

            {/* Ações */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="h-12 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-slate-600"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={productMutation.isPending}
                className="h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest text-white shadow-lg transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #7c2d3e 0%, #9b3a50 100%)" }}
              >
                {productMutation.isPending
                  ? "Salvando..."
                  : isEditing ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
