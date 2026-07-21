import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { RestaurantPdvSettings, PdvUnit } from "@shared/schema";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2,
  Percent,
  Save,
  Receipt,
  PlusCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBlingAccounts } from "@/hooks/use-bling-accounts";

const SETTINGS_KEY = ["/api/restaurant-pdv/settings"];
const UNITS_KEY = ["/api/restaurant-pdv/units"];

const formSchema = z.object({
  companyName: z.string().min(1, "Informe o nome da empresa"),
  companyCnpj: z.string().optional(),
  companyAddress: z.string().optional(),
  companyPhone: z.string().optional(),
  companyFooterMessage: z.string().optional(),
  defaultServiceFeePercent: z
    .string()
    .regex(/^\d+([.,]\d{1,2})?$/, "Informe um percentual válido (ex: 10 ou 10.00)"),
  waiterCommissionPercent: z
    .string()
    .regex(/^\d+([.,]\d{1,2})?$/, "Informe um percentual válido (ex: 0 ou 5.00)"),
});
type FormValues = z.infer<typeof formSchema>;

const unitFormSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  cnpj: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  footerMessage: z.string().optional(),
  blingConnectionId: z.string().optional(),
  defaultServiceFeePercent: z
    .string()
    .regex(/^\d+([.,]\d{1,2})?$/, "Percentual inválido")
    .optional()
    .default("10.00"),
  waiterCommissionPercent: z
    .string()
    .regex(/^\d+([.,]\d{1,2})?$/, "Percentual inválido")
    .optional()
    .default("0.00"),
});
type UnitFormValues = z.infer<typeof unitFormSchema>;

function normalizePercent(val: string) {
  return val.replace(",", ".");
}

function UnitDialog({
  unit,
  open,
  onOpenChange,
}: {
  unit: PdvUnit | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEditing = !!unit;
  const { data: blingAccounts = [] } = useBlingAccounts();
  const connectedAccounts = blingAccounts.filter((a) => a.status === "connected");

  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitFormSchema),
    values: {
      name: unit?.name ?? "",
      cnpj: unit?.cnpj ?? "",
      phone: unit?.phone ?? "",
      address: unit?.address ?? "",
      footerMessage: unit?.footerMessage ?? "",
      blingConnectionId: unit?.blingConnectionId ?? "",
      defaultServiceFeePercent: unit?.defaultServiceFeePercent ?? "10.00",
      waiterCommissionPercent: unit?.waiterCommissionPercent ?? "0.00",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: UnitFormValues) => {
      const payload = {
        ...data,
        cnpj: data.cnpj || null,
        phone: data.phone || null,
        address: data.address || null,
        footerMessage: data.footerMessage || null,
        blingConnectionId: data.blingConnectionId || null,
        defaultServiceFeePercent: normalizePercent(data.defaultServiceFeePercent ?? "10.00"),
        waiterCommissionPercent: normalizePercent(data.waiterCommissionPercent ?? "0.00"),
      };
      if (isEditing) {
        await apiRequest("PUT", `/api/restaurant-pdv/units/${unit.id}`, payload);
      } else {
        await apiRequest("POST", "/api/restaurant-pdv/units", payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: UNITS_KEY });
      toast({ title: isEditing ? "Unidade atualizada" : "Unidade criada" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Unidade" : "Nova Unidade PDV"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da unidade</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Restaurante Matriz" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ</FormLabel>
                    <FormControl>
                      <Input placeholder="00.000.000/0001-00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input placeholder="(00) 00000-0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input placeholder="Rua, número, bairro..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="footerMessage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mensagem de rodapé</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ex: Obrigado pela preferência!"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="blingConnectionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catálogo Bling</FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sem catálogo Bling" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Sem catálogo Bling</SelectItem>
                      {connectedAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.blingAccountName ?? a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Produtos importados do Bling para esta unidade
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="defaultServiceFeePercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Taxa de serviço (%)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="10.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="waiterCommissionPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comissão garçom (%)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando..." : isEditing ? "Salvar" : "Criar unidade"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function PdvSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [unitDialog, setUnitDialog] = useState<{ open: boolean; unit: PdvUnit | null }>({
    open: false,
    unit: null,
  });

  /* ── Unidades ─────────────────────────────────────────────────────────── */
  const { data: units = [] } = useQuery<PdvUnit[]>({ queryKey: UNITS_KEY });

  const deactivateUnit = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/restaurant-pdv/units/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: UNITS_KEY });
      toast({ title: "Unidade desativada" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  /* ── Configurações da unidade atual (via header X-PDV-Unit-Id) ─────────── */
  const { data: settings, isLoading } = useQuery<RestaurantPdvSettings>({
    queryKey: SETTINGS_KEY,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      companyName: settings?.companyName ?? "",
      companyCnpj: settings?.companyCnpj ?? "",
      companyAddress: settings?.companyAddress ?? "",
      companyPhone: settings?.companyPhone ?? "",
      companyFooterMessage: settings?.companyFooterMessage ?? "",
      defaultServiceFeePercent: settings?.defaultServiceFeePercent ?? "10.00",
      waiterCommissionPercent: settings?.waiterCommissionPercent ?? "0.00",
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      await apiRequest("PUT", "/api/restaurant-pdv/settings", {
        companyName: data.companyName,
        companyCnpj: data.companyCnpj || null,
        companyAddress: data.companyAddress || null,
        companyPhone: data.companyPhone || null,
        companyFooterMessage: data.companyFooterMessage || null,
        defaultServiceFeePercent: normalizePercent(data.defaultServiceFeePercent),
        waiterCommissionPercent: normalizePercent(data.waiterCommissionPercent),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SETTINGS_KEY });
      toast({ title: "Configurações salvas", description: "As alterações foram gravadas." });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Configurações do PDV</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie as unidades e configurações do ponto de venda.
        </p>
      </div>

      {/* ── Unidades PDV ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-orange-500" />
                Unidades PDV
              </CardTitle>
              <CardDescription className="mt-1">
                Cada unidade tem seu próprio CNPJ, cardápio, mesas e caixa.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => setUnitDialog({ open: true, unit: null })}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Nova unidade
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {units.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma unidade cadastrada.
            </p>
          )}
          {units.map((unit) => (
            <div
              key={unit.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{unit.name}</span>
                  {!unit.isActive && (
                    <Badge variant="secondary" className="text-xs">
                      inativa
                    </Badge>
                  )}
                </div>
                {unit.cnpj && (
                  <span className="text-xs text-muted-foreground">{unit.cnpj}</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setUnitDialog({ open: true, unit })}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {unit.isActive && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    disabled={deactivateUnit.isPending}
                    onClick={() => {
                      if (confirm(`Desativar "${unit.name}"?`)) {
                        deactivateUnit.mutate(unit.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Configurações da unidade selecionada ─────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Carregando configurações...
        </div>
      ) : (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))}
            className="space-y-6"
          >
            {/* Dados da empresa */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-orange-500" />
                  Dados da unidade atual
                </CardTitle>
                <CardDescription>
                  Aparecem no cabeçalho da conta impressa para o cliente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da empresa</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Grand Cru Restaurante" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="companyCnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ</FormLabel>
                        <FormControl>
                          <Input placeholder="00.000.000/0001-00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="companyPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input placeholder="(00) 00000-0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="companyAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua, número, bairro..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="companyFooterMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mensagem de rodapé</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Ex: Obrigado pela preferência! Volte sempre."
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Taxas */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Percent className="h-4 w-4 text-orange-500" />
                  Taxas e comissões
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="defaultServiceFeePercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Taxa de serviço</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input className="w-32" inputMode="decimal" placeholder="10.00" {...field} />
                        </FormControl>
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                      <FormDescription>
                        Percentual cobrado do cliente. Use 0 para desativar.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Separator />
                <FormField
                  control={form.control}
                  name="waiterCommissionPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Comissão do garçom
                        <Badge variant="outline" className="text-xs font-normal">
                          controle interno
                        </Badge>
                      </FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input className="w-32" inputMode="decimal" placeholder="0.00" {...field} />
                        </FormControl>
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                      <FormDescription>
                        Não aparece na conta do cliente.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Prévia */}
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
                  <Receipt className="h-4 w-4" />
                  Prévia do cabeçalho da conta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/30 rounded-lg p-4 font-mono text-sm text-center space-y-1">
                  <p className="font-bold text-base">{form.watch("companyName") || "Nome da empresa"}</p>
                  {form.watch("companyCnpj") && (
                    <p className="text-xs text-muted-foreground">CNPJ: {form.watch("companyCnpj")}</p>
                  )}
                  {form.watch("companyAddress") && (
                    <p className="text-xs text-muted-foreground">{form.watch("companyAddress")}</p>
                  )}
                  {form.watch("companyPhone") && (
                    <p className="text-xs text-muted-foreground">Tel: {form.watch("companyPhone")}</p>
                  )}
                  <p className="text-xs text-muted-foreground pt-1">─────────────────────</p>
                  <p className="text-xs text-muted-foreground">Mesa 5 · 2 pessoa(s)</p>
                  <p className="text-xs text-muted-foreground">21/07/2026 às 20:30</p>
                </div>
                {form.watch("companyFooterMessage") && (
                  <p className="text-center font-mono text-xs text-muted-foreground mt-2 italic">
                    {form.watch("companyFooterMessage")}
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={saveMutation.isPending} className="gap-2">
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? "Salvando..." : "Salvar configurações"}
              </Button>
            </div>
          </form>
        </Form>
      )}

      <UnitDialog
        open={unitDialog.open}
        unit={unitDialog.unit}
        onOpenChange={(v) => setUnitDialog((s) => ({ ...s, open: v }))}
      />
    </div>
  );
}
