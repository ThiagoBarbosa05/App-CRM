import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Company, Sector } from "@shared/schema";

const companyFormSchema = z.object({
  nomeFantasia: z.string().min(1, "Nome Fantasia é obrigatório"),
  razaoSocial: z.string().min(1, "Razão Social é obrigatória"),
  cnpj: z.string().optional(),
  inscricaoEstadual: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  cep: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  website: z.string().optional(),
  sectorId: z.string().optional(),
  responsavelId: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean().default(true),
});

type CompanyFormData = z.infer<typeof companyFormSchema>;

interface CompanyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  company?: Company | null;
}

export default function CompanyFormModal({
  isOpen,
  onClose,
  company,
}: CompanyFormModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!company;

  // Buscar setores disponíveis
  const { data: sectors = [] } = useQuery<Sector[]>({
    queryKey: ["/api/sectors"],
    enabled: isOpen,
  });

  // Buscar usuários para o campo responsável
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    enabled: isOpen,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      nomeFantasia: "",
      razaoSocial: "",
      cnpj: "",
      inscricaoEstadual: "",
      email: "",
      phone: "",
      address: "",
      cep: "",
      city: "",
      state: "",
      website: "",
      sectorId: "",
      responsavelId: "",
      notes: "",
      active: true,
    },
  });

  const activeValue = watch("active");

  useEffect(() => {
    if (company) {
      reset({
        nomeFantasia: company.nomeFantasia,
        razaoSocial: company.razaoSocial,
        cnpj: company.cnpj || "",
        inscricaoEstadual: company.inscricaoEstadual || "",
        email: company.email || "",
        phone: company.phone || "",
        address: company.address || "",
        cep: company.cep || "",
        city: company.city || "",
        state: company.state || "",
        website: company.website || "",
        sectorId: company.sectorId || "",
        responsavelId: company.responsavelId || "",
        notes: company.notes || "",
        active: company.active,
      });
    } else {
      reset({
        nomeFantasia: "",
        razaoSocial: "",
        cnpj: "",
        inscricaoEstadual: "",
        email: "",
        phone: "",
        address: "",
        cep: "",
        city: "",
        state: "",
        website: "",
        sectorId: "",
        notes: "",
        active: true,
      });
    }
  }, [company, reset]);

  const createMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create company");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Empresa criada",
        description: "A empresa foi criada com sucesso.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao criar a empresa.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      const response = await fetch(`/api/companies/${company!.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update company");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Empresa atualizada",
        description: "A empresa foi atualizada com sucesso.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao atualizar a empresa.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CompanyFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Empresa" : "Nova Empresa"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize as informações da empresa."
              : "Adicione uma nova empresa ao sistema."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nomeFantasia">Nome Fantasia *</Label>
              <Input
                id="nomeFantasia"
                {...register("nomeFantasia")}
                placeholder="Nome fantasia da empresa"
              />
              {errors.nomeFantasia && (
                <p className="text-sm text-destructive">{errors.nomeFantasia.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="razaoSocial">Razão Social *</Label>
              <Input
                id="razaoSocial"
                {...register("razaoSocial")}
                placeholder="Razão social da empresa"
              />
              {errors.razaoSocial && (
                <p className="text-sm text-destructive">{errors.razaoSocial.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                {...register("cnpj")}
                placeholder="00.000.000/0000-00"
              />
              {errors.cnpj && (
                <p className="text-sm text-destructive">{errors.cnpj.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="inscricaoEstadual">Inscrição Estadual</Label>
              <Input
                id="inscricaoEstadual"
                {...register("inscricaoEstadual")}
                placeholder="Somente números"
                type="tel"
              />
              {errors.inscricaoEstadual && (
                <p className="text-sm text-destructive">{errors.inscricaoEstadual.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="contato@empresa.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                {...register("phone")}
                placeholder="(11) 99999-9999"
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                {...register("website")}
                placeholder="https://www.empresa.com"
              />
              {errors.website && (
                <p className="text-sm text-destructive">{errors.website.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sectorId">Setor</Label>
              <Select onValueChange={(value) => setValue("sectorId", value)} value={watch("sectorId")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um setor" />
                </SelectTrigger>
                <SelectContent>
                  {sectors.length === 0 ? (
                    <SelectItem value="no-sectors">Nenhum setor disponível</SelectItem>
                  ) : (
                    sectors.map((sector) => (
                      <SelectItem key={sector.id} value={sector.id}>
                        {sector.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {errors.sectorId && (
                <p className="text-sm text-destructive">{errors.sectorId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="responsavelId">Responsável</Label>
              <Select onValueChange={(value) => setValue("responsavelId", value)} value={watch("responsavelId")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um responsável..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum responsável</SelectItem>
                  {(users as any[]).filter((user: any) => user.isActive === "true").map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} - {user.role === "admin" ? "Administrador" : user.role === "gerente" ? "Gerente" : "Vendedor"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.responsavelId && (
                <p className="text-sm text-destructive">{errors.responsavelId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                {...register("cep")}
                placeholder="00000-000"
              />
              {errors.cep && (
                <p className="text-sm text-destructive">{errors.cep.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                {...register("city")}
                placeholder="São Paulo"
              />
              {errors.city && (
                <p className="text-sm text-destructive">{errors.city.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <Input
                id="state"
                {...register("state")}
                placeholder="SP"
              />
              {errors.state && (
                <p className="text-sm text-destructive">{errors.state.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              {...register("address")}
              placeholder="Rua, número, bairro"
            />
            {errors.address && (
              <p className="text-sm text-destructive">{errors.address.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Informações adicionais sobre a empresa"
              className="min-h-[80px]"
            />
            {errors.notes && (
              <p className="text-sm text-destructive">{errors.notes.message}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="active"
              checked={activeValue}
              onCheckedChange={(checked) => setValue("active", checked)}
            />
            <Label htmlFor="active">Empresa ativa</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
            >
              {isSubmitting || createMutation.isPending || updateMutation.isPending
                ? "Salvando..."
                : isEditing
                ? "Atualizar"
                : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}