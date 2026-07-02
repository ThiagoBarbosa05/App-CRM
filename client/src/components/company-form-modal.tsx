import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputMask } from "@/components/ui/input-mask";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { lookupCep } from "@/lib/cep-lookup";

const companyFormSchema = z.object({
  nomeFantasia: z.string().min(1, "Nome Fantasia é obrigatório"),
  razaoSocial: z.string().min(1, "Razão Social é obrigatória"),
  cnpj: z.string().optional(),
  inscricaoEstadual: z.string().optional(),
  nomeComprador: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  fixedPhone: z.string().optional(),
  address: z.string().optional(),
  cep: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  website: z.string().optional(),
  sectorId: z.string().optional(),
  responsavelId: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean().default(true),
  markers: z.array(z.string()).optional(),
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);

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

  // Buscar marcadores das configurações
  const { data: markers = [] } = useQuery({
    queryKey: ["/api/tags/markers"],
    enabled: isOpen,
  }) as { data: any[] };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      nomeFantasia: "",
      razaoSocial: "",
      cnpj: "",
      inscricaoEstadual: "",
      nomeComprador: "",
      email: "",
      phone: "",
      fixedPhone: "",
      address: "",
      cep: "",
      city: "",
      state: "",
      website: "",
      sectorId: "",
      responsavelId: "none",
      notes: "",
      active: true,
      markers: [],
    },
  });

  const activeValue = watch("active");
  const cepValue = watch("cep");

  useEffect(() => {
    if (company) {
      reset({
        nomeFantasia: company.nomeFantasia,
        razaoSocial: company.razaoSocial,
        cnpj: company.cnpj || "",
        inscricaoEstadual: company.inscricaoEstadual || "",
        nomeComprador: company.nomeComprador || "",
        email: company.email || "",
        phone: company.phone || "",
        fixedPhone: company.fixedPhone || "",
        address: company.address || "",
        cep: company.cep || "",
        neighborhood: company.neighborhood || "",
        city: company.city || "",
        state: company.state || "",
        website: company.website || "",
        sectorId: company.sectorId || "",
        responsavelId: company.responsavelId || "none",
        notes: company.notes || "",
        active: company.active,
        markers: company.markers || [],
      });
    } else {
      reset({
        nomeFantasia: "",
        razaoSocial: "",
        cnpj: "",
        inscricaoEstadual: "",
        nomeComprador: "",
        email: "",
        phone: "",
        fixedPhone: "",
        address: "",
        cep: "",
        neighborhood: "",
        city: "",
        state: "",
        website: "",
        sectorId: "",
        notes: "",
        active: true,
        markers: [],
      });
    }
  }, [company, reset]);

  useEffect(() => {
    if (cepValue && cepValue.length === 9) {
      handleCepLookup(cepValue);
    }
  }, [cepValue]);

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

  const handleCepLookup = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    setIsLoadingCep(true);
    try {
      const cepData = await lookupCep(cep);
      if (cepData) {
        setValue("address", cepData.logradouro || "");
        setValue("city", cepData.localidade || "");
        setValue("state", cepData.uf || "");

        toast({
          title: "Endereço encontrado",
          description:
            "Os dados do endereço foram preenchidos automaticamente.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao consultar CEP",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar o CEP.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCep(false);
    }
  };

  const onSubmit = async (data: CompanyFormData) => {
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateMutation.mutateAsync(data);
      } else {
        await createMutation.mutateAsync(data);
      }
    } finally {
      setIsSubmitting(false);
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
                <p className="text-sm text-destructive">
                  {errors.nomeFantasia.message}
                </p>
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
                <p className="text-sm text-destructive">
                  {errors.razaoSocial.message}
                </p>
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
                <p className="text-sm text-destructive">
                  {errors.cnpj.message}
                </p>
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
                <p className="text-sm text-destructive">
                  {errors.inscricaoEstadual.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nomeComprador">Nome do Comprador</Label>
              <Input
                id="nomeComprador"
                {...register("nomeComprador")}
                placeholder="Nome da pessoa responsável pelas compras"
              />
              {errors.nomeComprador && (
                <p className="text-sm text-destructive">
                  {errors.nomeComprador.message}
                </p>
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
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Celular</Label>
              <InputMask
                id="phone"
                mask="(99) 99999-9999"
                placeholder="(11) 99999-9999"
                {...register("phone")}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">
                  {errors.phone.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fixedPhone">Telefone Fixo</Label>
              <InputMask
                id="fixedPhone"
                mask="(99) 9999-9999"
                placeholder="(11) 9999-9999"
                {...register("fixedPhone")}
              />
              {errors.fixedPhone && (
                <p className="text-sm text-destructive">
                  {errors.fixedPhone.message}
                </p>
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
                <p className="text-sm text-destructive">
                  {errors.website.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sectorId">Setor</Label>
              <Select
                onValueChange={(value) => setValue("sectorId", value)}
                value={watch("sectorId")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um setor" />
                </SelectTrigger>
                <SelectContent>
                  {sectors.length === 0 ? (
                    <SelectItem value="no-sectors">
                      Nenhum setor disponível
                    </SelectItem>
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
                <p className="text-sm text-destructive">
                  {errors.sectorId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="responsavelId">Responsável</Label>
              <Select
                onValueChange={(value) =>
                  setValue("responsavelId", value === "none" ? "" : value)
                }
                value={watch("responsavelId") || "none"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um responsável..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum responsável</SelectItem>
                  {(users as any[])
                    .filter((user: any) => user.isActive === "true")
                    .map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} -{" "}
                        {user.role === "admin"
                          ? "Administrador"
                          : user.role === "gerente"
                          ? "Gerente"
                          : "Vendedor"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {errors.responsavelId && (
                <p className="text-sm text-destructive">
                  {errors.responsavelId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="cep"
                  {...register("cep")}
                  placeholder="00000-000"
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={() => handleCepLookup(watch("cep") || "")}
                  disabled={
                    isLoadingCep ||
                    watch("cep")?.replace(/\D/g, "").length !== 8
                  }
                  className="px-3"
                >
                  {isLoadingCep ? (
                    <span className="animate-pulse">...</span>
                  ) : (
                    "Buscar"
                  )}
                </Button>
              </div>
              {errors.cep && (
                <p className="text-sm text-destructive">{errors.cep.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" {...register("city")} placeholder="São Paulo" />
              {errors.city && (
                <p className="text-sm text-destructive">
                  {errors.city.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <Input id="state" {...register("state")} placeholder="SP" />
              {errors.state && (
                <p className="text-sm text-destructive">
                  {errors.state.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input
                id="neighborhood"
                {...register("neighborhood")}
                placeholder="Centro"
              />
              {errors.neighborhood && (
                <p className="text-sm text-destructive">
                  {errors.neighborhood.message}
                </p>
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
              <p className="text-sm text-destructive">
                {errors.address.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="markers">Marcadores</Label>
            <Select
              onValueChange={(value) => {
                const currentMarkers = watch("markers") || [];
                if (!currentMarkers.includes(value)) {
                  setValue("markers", [...currentMarkers, value]);
                }
              }}
              value=""
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione marcadores..." />
              </SelectTrigger>
              <SelectContent>
                {markers.filter((marker: any) => marker.type === "marcador")
                  .length === 0 ? (
                  <SelectItem value="no-markers" disabled>
                    Nenhum marcador disponível
                  </SelectItem>
                ) : (
                  markers
                    .filter((marker: any) => marker.type === "marcador")
                    .map((marker: any) => (
                      <SelectItem key={marker.id} value={marker.name}>
                        {marker.name}
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
            {watch("markers") && watch("markers")!.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {watch("markers")!.map((marker: string, index: number) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="flex items-center gap-1"
                    data-testid={`badge-marker-${index}`}
                  >
                    {marker}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => {
                        const newMarkers = watch("markers")!.filter(
                          (m: string) => m !== marker
                        );
                        setValue("markers", newMarkers);
                      }}
                      data-testid={`button-remove-marker-${index}`}
                    />
                  </Badge>
                ))}
              </div>
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
              disabled={
                isSubmitting ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {isSubmitting ||
              createMutation.isPending ||
              updateMutation.isPending
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
