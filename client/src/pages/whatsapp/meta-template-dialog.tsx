import { useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSubmitMetaTemplate, type MetaTemplateCreatePayload } from "@/hooks/use-whatsapp";

// ── Zod schema ────────────────────────────────────────────────────────────────

const varExampleSchema = z.object({
  paramName: z.string(),
  example: z.string(),
});

const buttonSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("QUICK_REPLY"), text: z.string().min(1, "Texto obrigatório") }),
  z.object({
    type: z.literal("URL"),
    text: z.string().min(1, "Texto obrigatório"),
    url: z.string().min(1, "URL obrigatória"),
    urlExample: z.string().optional(),
  }),
  z.object({
    type: z.literal("PHONE_NUMBER"),
    text: z.string().min(1, "Texto obrigatório"),
    phoneNumber: z.string().min(1, "Telefone obrigatório"),
  }),
  z.object({ type: z.literal("COPY_CODE"), text: z.string().min(1, "Texto obrigatório") }),
  z.object({
    type: z.literal("OTP"),
    otpType: z.enum(["COPY_CODE", "ONE_TAP", "ZERO_TAP"]).default("COPY_CODE"),
  }),
]);

const metaTemplateSchema = z.object({
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .regex(/^[a-z0-9_]+$/, "Apenas letras minúsculas, números e _"),
  language: z.string().min(2, "Idioma obrigatório"),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  parameterFormat: z.enum(["NAMED", "POSITIONAL"]).default("NAMED"),
  // Header
  headerFormat: z.enum(["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LOCATION"]).default("NONE"),
  headerText: z.string().optional(),
  headerMediaHandle: z.string().optional(),
  headerTextExamples: z.array(varExampleSchema).default([]),
  // Body
  bodyText: z.string().min(1, "Texto do corpo é obrigatório"),
  bodyExamples: z.array(varExampleSchema).default([]),
  addSecurityRecommendation: z.boolean().default(false),
  // Footer
  footerText: z.string().optional(),
  codeExpirationMinutes: z.coerce.number().optional(),
  // Buttons
  buttons: z.array(buttonSchema).default([]),
});

type MetaTemplateForm = z.infer<typeof metaTemplateSchema>;

const EMPTY: MetaTemplateForm = {
  name: "",
  language: "pt_BR",
  category: "MARKETING",
  parameterFormat: "NAMED",
  headerFormat: "NONE",
  headerText: "",
  headerMediaHandle: "",
  headerTextExamples: [],
  bodyText: "",
  bodyExamples: [],
  addSecurityRecommendation: false,
  footerText: "",
  codeExpirationMinutes: undefined,
  buttons: [],
};

// ── Payload assembly ──────────────────────────────────────────────────────────

function extractVars(text: string): string[] {
  const matches = text.match(/\{\{([^}]+)\}\}/g) ?? [];
  const vars = matches.map((m) => m.slice(2, -2).trim());
  return vars.filter((v, i) => vars.indexOf(v) === i);
}

function buildMetaPayload(v: MetaTemplateForm): MetaTemplateCreatePayload {
  const components: Record<string, unknown>[] = [];

  // Header
  if (v.headerFormat !== "NONE") {
    if (v.headerFormat === "TEXT" && v.headerText) {
      const hasVars = /\{\{/.test(v.headerText);
      const example =
        hasVars && v.headerTextExamples.length
          ? v.parameterFormat === "NAMED"
            ? {
                header_text_named_params: v.headerTextExamples.map((e) => ({
                  param_name: e.paramName,
                  example: e.example,
                })),
              }
            : { header_text: [v.headerTextExamples.map((e) => e.example)] }
          : undefined;
      components.push({
        type: "HEADER",
        format: "TEXT",
        text: v.headerText,
        ...(example ? { example } : {}),
      });
    } else if (v.headerFormat === "LOCATION") {
      components.push({ type: "HEADER", format: "LOCATION" });
    } else {
      components.push({
        type: "HEADER",
        format: v.headerFormat,
        ...(v.headerMediaHandle ? { example: { header_handle: [v.headerMediaHandle] } } : {}),
      });
    }
  }

  // Body
  if (v.category === "AUTHENTICATION") {
    components.push({
      type: "BODY",
      text: v.bodyText,
      add_security_recommendation: v.addSecurityRecommendation,
    });
  } else {
    const hasVars = /\{\{/.test(v.bodyText);
    const example =
      hasVars && v.bodyExamples.length
        ? v.parameterFormat === "NAMED"
          ? {
              body_text_named_params: v.bodyExamples.map((e) => ({
                param_name: e.paramName,
                example: e.example,
              })),
            }
          : { body_text: [v.bodyExamples.map((e) => e.example)] }
        : undefined;
    components.push({ type: "BODY", text: v.bodyText, ...(example ? { example } : {}) });
  }

  // Footer
  if (v.category === "AUTHENTICATION") {
    if (v.codeExpirationMinutes) {
      components.push({ type: "FOOTER", code_expiration_minutes: v.codeExpirationMinutes });
    }
  } else if (v.footerText?.trim()) {
    components.push({ type: "FOOTER", text: v.footerText });
  }

  // Buttons
  if (v.buttons.length) {
    const buttons = v.buttons.map((btn) => {
      if (btn.type === "QUICK_REPLY") return { type: "QUICK_REPLY", text: btn.text };
      if (btn.type === "URL")
        return {
          type: "URL",
          text: btn.text,
          url: btn.url,
          ...(btn.urlExample ? { example: [btn.urlExample] } : {}),
        };
      if (btn.type === "PHONE_NUMBER")
        return { type: "PHONE_NUMBER", text: btn.text, phone_number: btn.phoneNumber };
      if (btn.type === "COPY_CODE") return { type: "COPY_CODE", text: btn.text };
      if (btn.type === "OTP") return { type: "OTP", otp_type: btn.otpType };
      return btn;
    });
    components.push({ type: "BUTTONS", buttons });
  }

  return {
    name: v.name,
    language: v.language,
    category: v.category,
    parameter_format: v.parameterFormat,
    components,
  };
}

// ── Helper sub-components ─────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm font-semibold text-foreground border-b pb-1 mb-3">{children}</div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-500 mt-1">{message}</p>;
}

// ── Main dialog ───────────────────────────────────────────────────────────────

export function MetaTemplateFormDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const submitMutation = useSubmitMetaTemplate();

  const {
    register,
    control,
    watch,
    setValue,
    getValues,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MetaTemplateForm>({
    resolver: zodResolver(metaTemplateSchema),
    defaultValues: EMPTY,
  });

  const { fields: buttonFields, append: appendButton, remove: removeButton } = useFieldArray({
    control,
    name: "buttons",
  });

  const category = watch("category");
  const headerFormat = watch("headerFormat");
  const bodyText = watch("bodyText");
  const headerText = watch("headerText");
  const parameterFormat = watch("parameterFormat");
  const bodyExamples = watch("bodyExamples");
  const headerTextExamples = watch("headerTextExamples");
  const buttons = watch("buttons");

  // Auto-sync body variable examples
  useEffect(() => {
    const vars = extractVars(bodyText ?? "");
    const current = getValues("bodyExamples");
    const merged = vars.map(
      (name) => current.find((e) => e.paramName === name) ?? { paramName: name, example: "" },
    );
    if (JSON.stringify(merged.map((e) => e.paramName)) !== JSON.stringify(current.map((e) => e.paramName))) {
      setValue("bodyExamples", merged);
    }
  }, [bodyText]);

  // Auto-sync header text variable examples
  useEffect(() => {
    if (headerFormat !== "TEXT") return;
    const vars = extractVars(headerText ?? "");
    const current = getValues("headerTextExamples");
    const merged = vars.map(
      (name) => current.find((e) => e.paramName === name) ?? { paramName: name, example: "" },
    );
    if (JSON.stringify(merged.map((e) => e.paramName)) !== JSON.stringify(current.map((e) => e.paramName))) {
      setValue("headerTextExamples", merged);
    }
  }, [headerText, headerFormat]);

  const onSubmit = (values: MetaTemplateForm) => {
    submitMutation.mutate(buildMetaPayload(values), {
      onSuccess: () => {
        reset(EMPTY);
        onClose();
      },
    });
  };

  const isAuth = category === "AUTHENTICATION";

  const BUTTON_TYPES_REGULAR = [
    { value: "QUICK_REPLY", label: "Resposta rápida" },
    { value: "URL", label: "URL" },
    { value: "PHONE_NUMBER", label: "Número de telefone" },
    { value: "COPY_CODE", label: "Copiar código" },
  ] as const;

  function addButton(type: string) {
    if (type === "QUICK_REPLY") appendButton({ type: "QUICK_REPLY", text: "" });
    else if (type === "URL") appendButton({ type: "URL", text: "", url: "", urlExample: "" });
    else if (type === "PHONE_NUMBER") appendButton({ type: "PHONE_NUMBER", text: "", phoneNumber: "" });
    else if (type === "COPY_CODE") appendButton({ type: "COPY_CODE", text: "" });
    else if (type === "OTP") appendButton({ type: "OTP", otpType: "COPY_CODE" });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset(EMPTY);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar template no Meta</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-2">
          {/* ── Básico ── */}
          <div>
            <SectionTitle>Básico</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Nome do template</Label>
                <Input
                  {...register("name")}
                  placeholder="meu_template_marketing"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Apenas letras minúsculas, números e underscore
                </p>
                <FieldError message={errors.name?.message} />
              </div>

              <div className="space-y-1.5">
                <Label>Idioma</Label>
                <Controller
                  control={control}
                  name="language"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt_BR">Português (BR)</SelectItem>
                        <SelectItem value="pt_PT">Português (PT)</SelectItem>
                        <SelectItem value="en_US">English (US)</SelectItem>
                        <SelectItem value="es_ES">Español (ES)</SelectItem>
                        <SelectItem value="es_MX">Español (MX)</SelectItem>
                        <SelectItem value="fr_FR">Français</SelectItem>
                        <SelectItem value="de_DE">Deutsch</SelectItem>
                        <SelectItem value="it_IT">Italiano</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={errors.language?.message} />
              </div>

              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MARKETING">Marketing</SelectItem>
                        <SelectItem value="UTILITY">Utilidade</SelectItem>
                        <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {!isAuth && (
                <div className="space-y-1.5 col-span-2">
                  <Label>Formato dos parâmetros</Label>
                  <Controller
                    control={control}
                    name="parameterFormat"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NAMED">Nomeado — {"{{nome_var}}"}</SelectItem>
                          <SelectItem value="POSITIONAL">Posicional — {"{{1}}, {{2}}"}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── Cabeçalho ── */}
          <div>
            <SectionTitle>Cabeçalho (opcional)</SectionTitle>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Formato</Label>
                <Controller
                  control={control}
                  name="headerFormat"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Nenhum</SelectItem>
                        <SelectItem value="TEXT">Texto</SelectItem>
                        <SelectItem value="IMAGE">Imagem</SelectItem>
                        <SelectItem value="VIDEO">Vídeo</SelectItem>
                        <SelectItem value="DOCUMENT">Documento</SelectItem>
                        <SelectItem value="LOCATION">Localização</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {headerFormat === "TEXT" && (
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label>Texto do cabeçalho</Label>
                    <Input
                      {...register("headerText")}
                      placeholder={`Olá {{${parameterFormat === "NAMED" ? "nome" : "1"}}}`}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use {"{{variavel}}"} para inserir parâmetros dinâmicos
                    </p>
                  </div>
                  {headerTextExamples.length > 0 && (
                    <div className="space-y-2 pl-3 border-l-2 border-muted">
                      <Label className="text-xs text-muted-foreground">
                        Exemplos dos parâmetros
                      </Label>
                      {headerTextExamples.map((_, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground w-24 shrink-0">
                            {`{{${headerTextExamples[i].paramName}}}`}
                          </span>
                          <Input
                            {...register(`headerTextExamples.${i}.example`)}
                            placeholder="Exemplo"
                            className="h-7 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(headerFormat === "IMAGE" ||
                headerFormat === "VIDEO" ||
                headerFormat === "DOCUMENT") && (
                <div className="space-y-1.5">
                  <Label>Handle de mídia (opcional)</Label>
                  <Input
                    {...register("headerMediaHandle")}
                    placeholder="4::AbC123..."
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Obtenha o handle enviando a mídia via API de upload do Meta
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Corpo ── */}
          <div>
            <SectionTitle>Corpo *</SectionTitle>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Texto</Label>
                <Textarea
                  {...register("bodyText")}
                  rows={4}
                  placeholder={
                    isAuth
                      ? "Seu código de verificação é {{1}}. Não compartilhe com ninguém."
                      : `Olá {{${parameterFormat === "NAMED" ? "nome" : "1"}}}, seu pedido {{${parameterFormat === "NAMED" ? "pedido" : "2"}}} está pronto!`
                  }
                />
                {!isAuth && (
                  <p className="text-xs text-muted-foreground">
                    Use {"{{variavel}}"} para inserir parâmetros. Os exemplos serão gerados automaticamente.
                  </p>
                )}
                <FieldError message={errors.bodyText?.message} />
              </div>

              {isAuth && (
                <div className="flex items-center gap-3">
                  <Controller
                    control={control}
                    name="addSecurityRecommendation"
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        id="security-rec"
                      />
                    )}
                  />
                  <Label htmlFor="security-rec">
                    Adicionar recomendação de segurança
                  </Label>
                </div>
              )}

              {!isAuth && bodyExamples.length > 0 && (
                <div className="space-y-2 pl-3 border-l-2 border-muted">
                  <Label className="text-xs text-muted-foreground">
                    Exemplos dos parâmetros
                  </Label>
                  {bodyExamples.map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground w-24 shrink-0">
                        {`{{${bodyExamples[i].paramName}}}`}
                      </span>
                      <Input
                        {...register(`bodyExamples.${i}.example`)}
                        placeholder="Exemplo"
                        className="h-7 text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Rodapé ── */}
          <div>
            <SectionTitle>Rodapé (opcional)</SectionTitle>
            {isAuth ? (
              <div className="space-y-1.5">
                <Label>Expiração do código (minutos)</Label>
                <Input
                  {...register("codeExpirationMinutes")}
                  type="number"
                  min={1}
                  max={90}
                  placeholder="10"
                  className="w-32"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Texto do rodapé</Label>
                <Input
                  {...register("footerText")}
                  placeholder="Responda PARAR para cancelar"
                />
              </div>
            )}
          </div>

          {/* ── Botões ── */}
          <div>
            <SectionTitle>Botões (opcional)</SectionTitle>
            <div className="space-y-3">
              {buttonFields.map((field, i) => {
                const btn = buttons[i];
                return (
                  <div
                    key={field.id}
                    className="border rounded-md p-3 space-y-2 bg-muted/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        {btn?.type === "QUICK_REPLY" && "Resposta rápida"}
                        {btn?.type === "URL" && "URL"}
                        {btn?.type === "PHONE_NUMBER" && "Telefone"}
                        {btn?.type === "COPY_CODE" && "Copiar código"}
                        {btn?.type === "OTP" && "OTP"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => removeButton(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {(btn?.type === "QUICK_REPLY" ||
                      btn?.type === "URL" ||
                      btn?.type === "PHONE_NUMBER" ||
                      btn?.type === "COPY_CODE") && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Texto do botão</Label>
                        <Input
                          {...register(`buttons.${i}.text` as const)}
                          placeholder="Texto exibido"
                          className="h-7 text-sm"
                        />
                        <FieldError
                          message={(errors.buttons?.[i] as { text?: { message?: string } })?.text?.message}
                        />
                      </div>
                    )}

                    {btn?.type === "URL" && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs">URL</Label>
                          <Input
                            {...register(`buttons.${i}.url` as const)}
                            placeholder="https://exemplo.com/{{codigo}}"
                            className="h-7 text-sm font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Exemplo da URL variável (opcional)</Label>
                          <Input
                            {...register(`buttons.${i}.urlExample` as const)}
                            placeholder="ABC123"
                            className="h-7 text-sm"
                          />
                        </div>
                      </>
                    )}

                    {btn?.type === "PHONE_NUMBER" && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Número de telefone</Label>
                        <Input
                          {...register(`buttons.${i}.phoneNumber` as const)}
                          placeholder="+5511999999999"
                          className="h-7 text-sm"
                        />
                      </div>
                    )}

                    {btn?.type === "OTP" && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tipo OTP</Label>
                        <Controller
                          control={control}
                          name={`buttons.${i}.otpType` as const}
                          render={({ field }) => (
                            <Select value={field.value as string} onValueChange={field.onChange}>
                              <SelectTrigger className="h-7 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="COPY_CODE">Copiar código</SelectItem>
                                <SelectItem value="ONE_TAP">One Tap</SelectItem>
                                <SelectItem value="ZERO_TAP">Zero Tap</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {buttonFields.length < 10 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Adicionar botão
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {isAuth ? (
                      <DropdownMenuItem onClick={() => addButton("OTP")}>
                        OTP (código)
                      </DropdownMenuItem>
                    ) : (
                      BUTTON_TYPES_REGULAR.map((t) => (
                        <DropdownMenuItem key={t.value} onClick={() => addButton(t.value)}>
                          {t.label}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset(EMPTY);
                onClose();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitMutation.isPending}>
              {submitMutation.isPending ? "Enviando..." : "Enviar para aprovação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
