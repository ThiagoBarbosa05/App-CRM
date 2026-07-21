import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { RestaurantPdvSettings } from "@shared/schema";
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
  Building2,
  Percent,
  Save,
  Receipt,
  Users,
  Info,
} from "lucide-react";

const SETTINGS_KEY = ["/api/restaurant-pdv/settings"];

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

function normalizePercent(val: string) {
  return val.replace(",", ".");
}

export default function PdvSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery<RestaurantPdvSettings>({
    queryKey: SETTINGS_KEY,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      companyName: settings?.companyName ?? "PDV Restaurante",
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Carregando configurações...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações do PDV</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie as configurações gerais do ponto de venda.
        </p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))}
          className="space-y-6"
        >
          {/* ── Dados da empresa ───────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-orange-500" />
                Dados da empresa
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
                        <Input placeholder="(11) 99999-9999" {...field} />
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
                      <Input placeholder="Rua das Flores, 100 — São Paulo, SP" {...field} />
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
                    <FormDescription>
                      Texto exibido no final da conta impressa.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Financeiro ─────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Percent className="h-4 w-4 text-orange-500" />
                Financeiro
              </CardTitle>
              <CardDescription>
                Percentuais aplicados automaticamente em novas comandas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="defaultServiceFeePercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Taxa de serviço padrão
                      <Badge variant="secondary" className="text-xs font-normal">
                        cobra do cliente
                      </Badge>
                    </FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          className="w-32"
                          inputMode="decimal"
                          placeholder="10.00"
                          {...field}
                        />
                      </FormControl>
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                    <FormDescription>
                      Percentual de taxa de serviço cobrado do cliente em cada comanda.
                      Use 0 para desativar.
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
                        <Input
                          className="w-32"
                          inputMode="decimal"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                    <FormDescription>
                      Percentual de comissão registrado para os garçons. Usado nos
                      relatórios internos e não aparece na conta do cliente.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Prévia da conta ────────────────────────────────────────── */}
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
    </div>
  );
}
