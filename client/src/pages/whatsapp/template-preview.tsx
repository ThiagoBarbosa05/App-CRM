import {
  FileText,
  Image as ImageIcon,
  Video,
  MapPin,
  Reply,
  ExternalLink,
  Phone,
  Copy,
} from "lucide-react";
import { applyExamples, type MetaTemplateForm } from "./template-schema";

// ── Conversão do markdown do WhatsApp para HTML ─────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Converte *negrito*, _itálico_, ~tachado~, ```mono``` e quebras de linha. */
function whatsappMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/```([\s\S]+?)```/g, "<code>$1</code>");
  html = html.replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$|[.,!?])/g, "$1<strong>$2</strong>");
  html = html.replace(/(^|\s)_(\S[^_]*?)_(?=\s|$|[.,!?])/g, "$1<em>$2</em>");
  html = html.replace(/(^|\s)~(\S[^~]*?)~(?=\s|$|[.,!?])/g, "$1<del>$2</del>");
  html = html.replace(/\n/g, "<br/>");
  return html;
}

function MediaPlaceholder({ format }: { format: MetaTemplateForm["headerFormat"] }) {
  const map = {
    IMAGE: ImageIcon,
    VIDEO: Video,
    DOCUMENT: FileText,
    LOCATION: MapPin,
  } as const;
  const Icon = map[format as keyof typeof map] ?? ImageIcon;
  return (
    <div className="mb-1.5 -mx-2 -mt-1 flex h-28 items-center justify-center rounded-md bg-black/20">
      <Icon className="h-10 w-10 text-white/40" strokeWidth={1.5} />
    </div>
  );
}

const BUTTON_ICON = {
  QUICK_REPLY: Reply,
  URL: ExternalLink,
  PHONE_NUMBER: Phone,
  COPY_CODE: Copy,
  OTP: Copy,
} as const;

/** Pré-visualização ao vivo estilo WhatsApp, espelhando o builder do Umbler. */
export function TemplatePreview({ values }: { values: MetaTemplateForm }) {
  const {
    headerFormat,
    headerText,
    headerTextExamples,
    headerMediaPreviewUrl,
    bodyText,
    bodyExamples,
    footerText,
    buttons,
    category,
    codeExpirationMinutes,
  } = values;

  const isAuth = category === "AUTHENTICATION";

  const bodyResolved = whatsappMarkdown(applyExamples(bodyText ?? "", bodyExamples));
  const headerResolved =
    headerFormat === "TEXT"
      ? whatsappMarkdown(applyExamples(headerText ?? "", headerTextExamples))
      : "";

  const footerResolved = isAuth
    ? codeExpirationMinutes
      ? `Este código expira em ${codeExpirationMinutes} minutos.`
      : ""
    : footerText?.trim() ?? "";

  const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col">
      <p className="mb-2 text-sm font-medium text-foreground">Exemplo de visualização</p>
      <div
        className="rounded-xl p-3"
        style={{
          background: "#0b141a",
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.03) 0 1px, transparent 1px), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.03) 0 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      >
        {/* Bolha da mensagem */}
        <div className="max-w-[85%] rounded-lg rounded-tl-none bg-[#202c33] p-2 text-[13px] leading-snug text-[#e9edef] shadow">
          {/* Cabeçalho */}
          {headerFormat !== "NONE" && headerFormat !== "TEXT" && (
            headerMediaPreviewUrl && headerFormat === "IMAGE" ? (
              <img
                src={headerMediaPreviewUrl}
                alt="Cabeçalho"
                className="mb-1.5 -mx-1 -mt-1 h-28 w-[calc(100%+0.5rem)] rounded-md object-cover"
              />
            ) : (
              <MediaPlaceholder format={headerFormat} />
            )
          )}
          {headerFormat === "TEXT" && headerResolved && (
            <p
              className="mb-1 font-semibold text-white"
              dangerouslySetInnerHTML={{ __html: headerResolved }}
            />
          )}

          {/* Corpo */}
          {bodyResolved ? (
            <p dangerouslySetInnerHTML={{ __html: bodyResolved }} />
          ) : (
            <p className="text-white/30 italic">Prévia do corpo da mensagem…</p>
          )}

          {/* Rodapé */}
          {footerResolved && (
            <p className="mt-1.5 text-[11px] text-[#8696a0]">{footerResolved}</p>
          )}

          {/* Hora */}
          <div className="mt-1 flex justify-end">
            <span className="text-[10px] text-[#8696a0]">{time}</span>
          </div>
        </div>

        {/* Botões abaixo da bolha */}
        {buttons.length > 0 && (
          <div className="mt-1.5 max-w-[85%] space-y-0.5">
            {buttons.map((btn, i) => {
              const Icon = BUTTON_ICON[btn.type];
              const label =
                btn.type === "OTP"
                  ? "Copiar código"
                  : "text" in btn && btn.text
                    ? btn.text
                    : "Botão";
              return (
                <div
                  key={i}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-[#202c33] py-2 text-[13px] font-medium text-[#53bdeb]"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
