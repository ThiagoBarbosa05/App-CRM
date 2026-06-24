import { useEffect, useRef } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  Trash2,
  Info,
  ArrowUp,
  ArrowDown,
  Upload,
  Loader2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSubmitMetaTemplate, useUploadTemplateMedia } from "@/hooks/use-whatsapp";
import {
  metaTemplateSchema,
  EMPTY_TEMPLATE,
  buildMetaPayload,
  extractVars,
  META_LIMITS,
  type MetaTemplateForm,
} from "./template-schema";
import { lintTemplate, hasBlockingErrors, type LintField, type LintIssue } from "./template-lint";
import { TemplatePreview } from "./template-preview";

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

function CharCounter({ value, max }: { value: string | undefined; max: number }) {
  const len = value?.length ?? 0;
  const near = len > max * 0.9;
  const over = len > max;
  return (
    <span
      className={cn(
        "text-[11px] tabular-nums",
        over ? "text-red-500 font-medium" : near ? "text-amber-500" : "text-muted-foreground",
      )}
    >
      {len}/{max}
    </span>
  );
}

function IssueLine({ issue }: { issue: LintIssue }) {
  const isError = issue.level === "error";
  const Icon = isError ? XCircle : AlertTriangle;
  return (
    <div
      className={cn(
        "flex items-start gap-1.5 text-xs",
        isError ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400",
      )}
    >
      <Icon className="h-3.5 w-3.5 mt-px shrink-0" />
      <span>{issue.message}</span>
    </div>
  );
}

function InlineIssues({ issues, field }: { issues: LintIssue[]; field: LintField }) {
  const relevant = issues.filter((i) => i.field === field);
  if (!relevant.length) return null;
  return (
    <div className="mt-2 space-y-1">
      {relevant.map((issue, i) => (
        <IssueLine key={i} issue={issue} />
      ))}
    </div>
  );
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
  const uploadMutation = useUploadTemplateMedia();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    defaultValues: EMPTY_TEMPLATE,
  });

  const { fields: buttonFields, append: appendButton, remove: removeButton, swap: swapButton } =
    useFieldArray({ control, name: "buttons" });

  // Estado completo do formulário (reativo) — alimenta preview e lint
  const values = watch();
  const {
    category,
    headerFormat,
    bodyText,
    headerText,
    parameterFormat,
    bodyExamples,
    headerTextExamples,
    footerText,
    buttons,
  } = values;

  const issues = lintTemplate(values);
  const errorCount = issues.filter((i) => i.level === "error").length;
  const warningCount = issues.filter((i) => i.level === "warning").length;
  const blocking = hasBlockingErrors(issues);

  // Auto-sync body variable examples
  useEffect(() => {
    const vars = extractVars(bodyText ?? "");
    const current = getValues("bodyExamples");
    const merged = vars.map(
      (name) => current.find((e) => e.paramName === name) ?? { paramName: name, example: "" },
    );
    if (
      JSON.stringify(merged.map((e) => e.paramName)) !==
      JSON.stringify(current.map((e) => e.paramName))
    ) {
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
    if (
      JSON.stringify(merged.map((e) => e.paramName)) !==
      JSON.stringify(current.map((e) => e.paramName))
    ) {
      setValue("headerTextExamples", merged);
    }
  }, [headerText, headerFormat]);

  const onSubmit = (formValues: MetaTemplateForm) => {
    if (hasBlockingErrors(lintTemplate(formValues))) return;
    submitMutation.mutate(buildMetaPayload(formValues), {
      onSuccess: () => {
        reset(EMPTY_TEMPLATE);
        onClose();
      },
    });
  };

  const handleClose = () => {
    reset(EMPTY_TEMPLATE);
    onClose();
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

  async function handleMediaSelected(file: File | undefined) {
    if (!file) return;
    const result = await uploadMutation.mutateAsync(file);
    setValue("headerMediaHandle", result.handle, { shouldValidate: true });
    if (file.type.startsWith("image/")) {
      setValue("headerMediaPreviewUrl", URL.createObjectURL(file));
    } else {
      setValue("headerMediaPreviewUrl", "");
    }
  }

  const mediaAccept =
    headerFormat === "IMAGE"
      ? "image/*"
      : headerFormat === "VIDEO"
        ? "video/*"
        : "application/pdf";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-4xl sm:w-full max-h-[92vh] sm:max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b shrink-0">
          <DialogTitle>Criar template no Meta</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-[1fr_320px] flex-1 overflow-hidden min-h-0">
          {/* ── Formulário ── */}
          <form
            id="meta-template-form"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6 overflow-y-auto px-4 sm:px-6 py-4"
          >
            {/* ── Básico ── */}
            <div>
              <SectionTitle>Básico</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-1 sm:col-span-2">
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
                  <InlineIssues issues={issues} field="name" />
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
                  <InlineIssues issues={issues} field="category" />
                </div>

                {!isAuth && (
                  <div className="space-y-1.5 col-span-1 sm:col-span-2">
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
                      <Select
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v);
                          setValue("headerMediaHandle", "");
                          setValue("headerMediaPreviewUrl", "");
                        }}
                      >
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
                      <div className="flex items-center justify-between">
                        <Label>Texto do cabeçalho</Label>
                        <CharCounter value={headerText} max={META_LIMITS.headerText} />
                      </div>
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
                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={mediaAccept}
                      className="hidden"
                      onChange={(e) => {
                        handleMediaSelected(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2"
                      disabled={uploadMutation.isPending}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {values.headerMediaHandle
                        ? "Substituir mídia"
                        : `Carregar ${headerFormat === "IMAGE" ? "imagem" : headerFormat === "VIDEO" ? "vídeo" : "documento"}`}
                    </Button>
                    {values.headerMediaHandle && (
                      <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        Mídia carregada — handle pronto para envio.
                      </p>
                    )}
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Colar handle manualmente</summary>
                      <Input
                        {...register("headerMediaHandle")}
                        placeholder="4::AbC123..."
                        className="font-mono text-sm mt-1.5"
                      />
                    </details>
                    <InlineIssues issues={issues} field="header" />
                  </div>
                )}

                {headerFormat === "TEXT" && <InlineIssues issues={issues} field="header" />}
              </div>
            </div>

            {/* ── Corpo ── */}
            <div>
              <SectionTitle>Corpo *</SectionTitle>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Texto</Label>
                    <CharCounter value={bodyText} max={META_LIMITS.body} />
                  </div>
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
                      Use {"{{variavel}}"} para inserir parâmetros. Formatação: *negrito*, _itálico_, ~tachado~.
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
                    <Label htmlFor="security-rec">Adicionar recomendação de segurança</Label>
                  </div>
                )}

                {!isAuth && bodyExamples.length > 0 && (
                  <div className="space-y-2 pl-3 border-l-2 border-muted">
                    <Label className="text-xs text-muted-foreground">Exemplos dos parâmetros</Label>
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

                <InlineIssues issues={issues} field="body" />
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
                  <div className="flex items-center justify-between">
                    <Label>Texto do rodapé</Label>
                    <CharCounter value={footerText} max={META_LIMITS.footer} />
                  </div>
                  <Input {...register("footerText")} placeholder="Responda PARAR para cancelar" />
                  <InlineIssues issues={issues} field="footer" />
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
                    <div key={field.id} className="border rounded-md p-3 space-y-2 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          {btn?.type === "QUICK_REPLY" && "Resposta rápida"}
                          {btn?.type === "URL" && "URL"}
                          {btn?.type === "PHONE_NUMBER" && "Telefone"}
                          {btn?.type === "COPY_CODE" && "Copiar código"}
                          {btn?.type === "OTP" && "OTP"}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={i === 0}
                            onClick={() => swapButton(i, i - 1)}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={i === buttonFields.length - 1}
                            onClick={() => swapButton(i, i + 1)}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
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
                      </div>

                      {(btn?.type === "QUICK_REPLY" ||
                        btn?.type === "URL" ||
                        btn?.type === "PHONE_NUMBER" ||
                        btn?.type === "COPY_CODE") && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Texto do botão</Label>
                            <CharCounter
                              value={"text" in (btn ?? {}) ? (btn as { text: string }).text : ""}
                              max={META_LIMITS.buttonText}
                            />
                          </div>
                          <Input
                            {...register(`buttons.${i}.text` as const)}
                            placeholder="Texto exibido"
                            className="h-7 text-sm"
                          />
                          <FieldError
                            message={
                              (errors.buttons?.[i] as { text?: { message?: string } })?.text?.message
                            }
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

                {buttonFields.length < META_LIMITS.maxButtons && (
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

                <InlineIssues issues={issues} field="buttons" />
              </div>
            </div>
          </form>

          {/* ── Preview ── */}
          <div className="hidden md:block border-l bg-muted/20 overflow-y-auto p-4">
            <div className="sticky top-0">
              <TemplatePreview values={values} />
            </div>
          </div>
        </div>

        {/* ── Resumo + ações ── */}
        <div className="border-t px-4 sm:px-6 py-3 space-y-3 shrink-0">
          {issues.length > 0 && (
            <div
              className={cn(
                "rounded-md border px-3 py-2 space-y-1 max-h-32 overflow-y-auto",
                blocking
                  ? "border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-900/15"
                  : "border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/15",
              )}
            >
              <p className="text-xs font-medium">
                {errorCount > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    {errorCount} {errorCount === 1 ? "erro" : "erros"}
                  </span>
                )}
                {errorCount > 0 && warningCount > 0 && " · "}
                {warningCount > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {warningCount} {warningCount === 1 ? "aviso" : "avisos"}
                  </span>
                )}
              </p>
              {issues.map((issue, i) => (
                <IssueLine key={i} issue={issue} />
              ))}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button
              type="submit"
              form="meta-template-form"
              disabled={submitMutation.isPending || blocking}
              className="w-full sm:w-auto"
            >
              {submitMutation.isPending
                ? "Enviando..."
                : blocking
                  ? `Corrija ${errorCount} ${errorCount === 1 ? "erro" : "erros"}`
                  : "Enviar para aprovação"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
