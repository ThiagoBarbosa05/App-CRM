import { useState, useEffect, useRef, useCallback } from "react";
import { useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { setActiveWaConversation } from "@/lib/wa-active-conversation";
import { refreshFirstPage } from "@/lib/wa-chat-pagination";
import { useInfiniteScrollSentinel } from "@/hooks/use-infinite-scroll-sentinel";
import { AttachFileDialog } from "@/components/media-library/attach-file-dialog";
import { ContactDetailsSheet } from "@/components/whatsapp/contact-details-sheet";
import type { MediaType } from "@/hooks/use-media-library";
import {
  MessageSquare,
  Search,
  Send,
  Phone,
  ArrowLeft,
  CheckCheck,
  AlertCircle,
  RotateCcw,
  FileText,
  Download,
  ZoomIn,
  Play,
  Pause,
  Mic,
  PlusCircle,
  Loader2,
  Reply,
  X,
  Paperclip,
  Square,
  Smile,
  Sticker,
  Bookmark,
  BookmarkCheck,
  Tag,
  Filter,
  Trash2,
  Zap,
  Bot,
  Check,
  ArrowRightLeft,
  StickyNote,
  Wifi,
  WifiOff,
  Radio,
  User,
  Lock,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWhatsappSettings } from "@/hooks/use-whatsapp";
import { BOT_SHORTCUT_ICONS, parseBotShortcuts } from "@/lib/bot-shortcut-icons";

interface Channel {
  id: number;
  name: string;
  displayPhone: string | null;
  connectionStatus: string | null;
  provider: string;
}

export interface ChatClientTag {
  id: string;
  name: string;
  color: string | null;
  type: string;
}

export interface WhatsappClientTag {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

export interface ChatClient {
  conversationId: string;
  clientId: string | null;
  phone: string;
  clientName: string | null;
  lastMessageAt?: string | null;
  lastMessageContent?: string | null;
  lastMessageDirection?: "inbound" | "outbound" | null;
  lastMessageType?: string | null;
  unreadCount?: number | null;
  channelId?: number | null;
  channelName?: string | null;
  channelDisplayPhone?: string | null;
  tags?: ChatClientTag[];
  whatsappTags?: WhatsappClientTag[];
  status?: "open" | "closed" | null;
}

interface WaMedia {
  id: string;
  whatsappMediaId: string | null;
  storageKey: string | null;
  mimeType: string | null;
  filename: string | null;
  size: number | null;
}

interface WaMessage {
  id: string;
  conversationId: string;
  waMessageId: string | null;
  direction: "inbound" | "outbound";
  type: string;
  content: string | null;
  caption: string | null;
  status: string | null;
  replyToMessageId: string | null;
  replyToContent: string | null;
  replyToType: string | null;
  replyToDirection: "inbound" | "outbound" | null;
  sentByUserId: string | null;
  campaignMessageId: string | null;
  sentAt: string | null;
  createdAt: string;
  channelId: number | null;
  channelName: string | null;
  channelProvider: string | null;
  rawPayload?: {
    kind?: string;
    templateName?: string;
    language?: string;
    components?: Array<{
      type: string;
      parameters?: Array<{
        type: string;
        image?: { link?: string };
        video?: { link?: string };
        document?: { link?: string };
        text?: string;
      }>;
    }>;
    buttons?: Array<{ type: string; text: string }>;
  } | null;
  media: WaMedia | null;
  reactions?: { emoji: string; direction: "inbound" | "outbound" }[];
}

interface LocalMessage {
  localId: string;
  content: string;
  createdAt: string;
  isNote?: boolean;
  media?: {
    url: string;
    kind: "image" | "video" | "document" | "sticker";
    fileName: string;
  };
}

interface ConversationNote {
  id: string;
  content: string | null;
  createdAt: string;
  authorName: string | null;
}

const REACTION_EMOJIS = ["❤️", "😂", "👍", "😮", "😢", "🙏"];

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "😅",
      "🤣",
      "😂",
      "🙂",
      "😉",
      "😊",
      "😇",
      "🥰",
      "😍",
      "🤩",
      "😘",
      "😗",
      "😚",
      "😙",
      "🥲",
      "😋",
      "😛",
      "😜",
      "🤪",
      "😝",
      "🤑",
      "🤗",
      "🤭",
      "🤫",
      "🤔",
      "🤐",
      "🤨",
      "😐",
      "😑",
      "😶",
      "😏",
      "😒",
      "🙄",
      "😬",
      "🤥",
      "😌",
      "😔",
      "😪",
      "🤤",
      "😴",
      "😷",
      "🤒",
      "🤕",
      "🤢",
      "🤧",
      "🥵",
      "🥶",
      "🥴",
      "😵",
      "🤯",
      "🤠",
      "🥳",
      "🥸",
      "😎",
      "🤓",
      "🧐",
      "😕",
      "😟",
      "🙁",
      "☹️",
      "😮",
      "😯",
      "😲",
      "😳",
      "🥺",
      "😦",
      "😧",
      "😨",
      "😰",
      "😥",
      "😢",
      "😭",
      "😱",
      "😖",
      "😣",
      "😞",
      "😓",
      "😩",
      "😫",
      "🥱",
      "😤",
      "😡",
      "😠",
      "🤬",
      "😈",
      "👿",
    ],
  },
  {
    label: "Gestos",
    emojis: [
      "👋",
      "🤚",
      "🖐️",
      "✋",
      "🖖",
      "👌",
      "🤌",
      "🤏",
      "✌️",
      "🤞",
      "🤟",
      "🤘",
      "🤙",
      "👈",
      "👉",
      "👆",
      "🖕",
      "👇",
      "☝️",
      "👍",
      "👎",
      "✊",
      "👊",
      "🤛",
      "🤜",
      "👏",
      "🙌",
      "👐",
      "🤲",
      "🤝",
      "🙏",
      "✍️",
      "💅",
      "🤳",
      "💪",
      "🦾",
      "🦿",
      "🦵",
      "🦶",
      "👂",
      "🦻",
      "👃",
      "🫀",
      "🫁",
      "🧠",
      "🦷",
      "🦴",
      "👀",
      "👁️",
      "👅",
      "👄",
    ],
  },
  {
    label: "Pessoas",
    emojis: [
      "🧑",
      "👱",
      "🧔",
      "🧑‍🦰",
      "🧑‍🦱",
      "🧑‍🦳",
      "🧑‍🦲",
      "👶",
      "🧒",
      "👦",
      "👧",
      "🧑",
      "👨",
      "👩",
      "🧓",
      "👴",
      "👵",
      "🙍",
      "🙎",
      "🙅",
      "🙆",
      "💁",
      "🙋",
      "🧏",
      "🙇",
      "🤦",
      "🤷",
      "👮",
      "🕵️",
      "💂",
      "🥷",
      "👷",
      "🫅",
      "🤴",
      "👸",
      "👳",
      "👲",
      "🧕",
      "🤵",
      "👰",
      "🤰",
      "🤱",
      "👼",
      "🎅",
      "🤶",
      "🧑‍🎄",
      "🦸",
      "🦹",
      "🧙",
      "🧝",
      "🧛",
      "🧟",
      "🧞",
      "🧜",
      "🧚",
      "🧑‍🤝‍🧑",
      "💏",
      "💑",
      "👪",
    ],
  },
  {
    label: "Natureza",
    emojis: [
      "🐶",
      "🐱",
      "🐭",
      "🐹",
      "🐰",
      "🦊",
      "🐻",
      "🐼",
      "🐻‍❄️",
      "🐨",
      "🐯",
      "🦁",
      "🐮",
      "🐷",
      "🐸",
      "🐵",
      "🙈",
      "🙉",
      "🙊",
      "🐒",
      "🐔",
      "🐧",
      "🐦",
      "🐤",
      "🦆",
      "🦅",
      "🦉",
      "🦇",
      "🐺",
      "🐗",
      "🐴",
      "🦄",
      "🐝",
      "🪱",
      "🐛",
      "🦋",
      "🐌",
      "🐞",
      "🐜",
      "🪲",
      "🦟",
      "🦗",
      "🪳",
      "🕷️",
      "🦂",
      "🐢",
      "🐍",
      "🦎",
      "🦖",
      "🦕",
      "🐙",
      "🦑",
      "🦐",
      "🦞",
      "🦀",
      "🐡",
      "🐠",
      "🐟",
      "🐬",
      "🐳",
      "🐋",
      "🦈",
      "🦭",
      "🐊",
      "🐅",
      "🐆",
      "🦓",
      "🦍",
      "🦧",
      "🦣",
      "🐘",
      "🦛",
      "🦏",
      "🐪",
      "🐫",
      "🦒",
      "🦘",
      "🦬",
      "🐃",
      "🐂",
      "🐄",
      "🐎",
      "🐖",
      "🐏",
      "🐑",
      "🦙",
      "🐐",
      "🦌",
      "🐕",
      "🐩",
      "🦮",
      "🐕‍🦺",
      "🐈",
      "🐈‍⬛",
      "🪶",
      "🐓",
      "🦃",
      "🦤",
      "🦚",
      "🦜",
      "🦢",
      "🦩",
      "🕊️",
      "🐇",
      "🦝",
      "🦨",
      "🦡",
      "🦫",
      "🦦",
      "🦥",
      "🐁",
      "🐀",
      "🐿️",
      "🦔",
      "🌵",
      "🎄",
      "🌲",
      "🌳",
      "🌴",
      "🪵",
      "🌱",
      "🌿",
      "☘️",
      "🍀",
      "🎍",
      "🪴",
      "🎋",
      "🍃",
      "🍂",
      "🍁",
      "🪺",
      "🪹",
      "🍄",
      "🌾",
      "💐",
      "🌷",
      "🌹",
      "🥀",
      "🌺",
      "🌸",
      "🌼",
      "🌻",
      "🌞",
      "🌝",
      "🌛",
      "🌜",
      "🌚",
      "🌕",
      "🌖",
      "🌗",
      "🌘",
      "🌑",
      "🌒",
      "🌓",
      "🌔",
      "🌙",
      "🌟",
      "⭐",
      "🌠",
      "🌌",
      "☁️",
      "⛅",
      "🌤️",
      "🌈",
      "🌂",
      "☂️",
      "☔",
      "⛱️",
      "⚡",
      "❄️",
      "🔥",
      "💧",
      "🌊",
    ],
  },
  {
    label: "Comida",
    emojis: [
      "🍏",
      "🍎",
      "🍐",
      "🍊",
      "🍋",
      "🍌",
      "🍉",
      "🍇",
      "🍓",
      "🫐",
      "🍈",
      "🍒",
      "🍑",
      "🥭",
      "🍍",
      "🥥",
      "🥝",
      "🍅",
      "🍆",
      "🥑",
      "🥦",
      "🥬",
      "🥒",
      "🌶️",
      "🫑",
      "🥕",
      "🧄",
      "🧅",
      "🥔",
      "🍠",
      "🥐",
      "🥯",
      "🍞",
      "🥖",
      "🥨",
      "🧀",
      "🥚",
      "🍳",
      "🧈",
      "🥞",
      "🧇",
      "🥓",
      "🥩",
      "🍗",
      "🍖",
      "🌭",
      "🍔",
      "🍟",
      "🍕",
      "🫓",
      "🥪",
      "🥙",
      "🧆",
      "🌮",
      "🌯",
      "🫔",
      "🥗",
      "🥘",
      "🫕",
      "🥫",
      "🍝",
      "🍜",
      "🍲",
      "🍛",
      "🍣",
      "🍱",
      "🥟",
      "🦪",
      "🍤",
      "🍙",
      "🍚",
      "🍘",
      "🍥",
      "🥮",
      "🍢",
      "🧁",
      "🍰",
      "🎂",
      "🍮",
      "🍭",
      "🍬",
      "🍫",
      "🍿",
      "🍩",
      "🍪",
      "🌰",
      "🥜",
      "🍯",
      "🧃",
      "🥤",
      "🧋",
      "🍵",
      "☕",
      "🫖",
      "🍺",
      "🍻",
      "🥂",
      "🍷",
      "🫗",
      "🥃",
      "🍸",
      "🍹",
      "🧉",
      "🍾",
      "🧊",
      "🥄",
      "🍴",
      "🍽️",
    ],
  },
  {
    label: "Símbolos",
    emojis: [
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🖤",
      "🤍",
      "🤎",
      "💔",
      "❤️‍🔥",
      "❤️‍🩹",
      "❣️",
      "💕",
      "💞",
      "💓",
      "💗",
      "💖",
      "💘",
      "💝",
      "💟",
      "☮️",
      "✝️",
      "☪️",
      "🕉️",
      "☸️",
      "✡️",
      "🔯",
      "🕎",
      "☯️",
      "☦️",
      "🛐",
      "⛎",
      "♈",
      "♉",
      "♊",
      "♋",
      "♌",
      "♍",
      "♎",
      "♏",
      "♐",
      "♑",
      "♒",
      "♓",
      "🆔",
      "⚛️",
      "🉑",
      "☢️",
      "☣️",
      "📴",
      "📳",
      "🈶",
      "🈚",
      "🈸",
      "🈺",
      "🈷️",
      "✴️",
      "🆚",
      "💮",
      "🉐",
      "㊙️",
      "㊗️",
      "🈴",
      "🈵",
      "🈹",
      "🈲",
      "🅰️",
      "🅱️",
      "🆎",
      "🆑",
      "🅾️",
      "🆘",
      "❌",
      "⭕",
      "🛑",
      "⛔",
      "📛",
      "🚫",
      "💯",
      "💢",
      "♨️",
      "🚷",
      "🚯",
      "🚳",
      "🚱",
      "🔞",
      "📵",
      "🔕",
      "🔇",
      "🔉",
      "🔊",
      "📢",
      "📣",
      "📯",
      "🔔",
      "🔔",
      "🛎️",
      "🎵",
      "🎶",
      "✅",
      "🔰",
      "♻️",
      "🔱",
      "📛",
      "🔰",
      "⚜️",
      "🔲",
      "🔳",
      "▪️",
      "▫️",
      "◾",
      "◽",
      "◼️",
      "◻️",
      "⬛",
      "⬜",
      "🟥",
      "🟧",
      "🟨",
      "🟩",
      "🟦",
      "🟪",
      "🟫",
    ],
  },
];

function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [tab, setTab] = useState(0);
  return (
    <div className="w-[min(288px,calc(100vw-2rem))]">
      <div className="flex gap-1 px-2 pt-2 pb-1 border-b border-slate-100 dark:border-slate-800 overflow-x-auto scrollbar-none">
        {EMOJI_GROUPS.map((g, i) => (
          <button
            key={g.label}
            onClick={() => setTab(i)}
            className={cn(
              "shrink-0 text-xs px-2 py-1 rounded-full transition-colors",
              tab === i
                ? "bg-primary text-primary-foreground"
                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-0.5 p-2 max-h-44 overflow-y-auto">
        {EMOJI_GROUPS[tab].emojis.map((e) => (
          <button
            key={e}
            onClick={() => onPick(e)}
            className="text-xl p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors leading-none"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

const MEDIA_TYPE_LABELS: Record<string, string> = {
  image: "🖼 Imagem",
  video: "🎥 Vídeo",
  audio: "🎤 Áudio",
  sticker: "🖼 Figurinha",
  document: "📄 Documento",
};

function replySnippet(content: string | null, type: string | null) {
  if (content) return content;
  if (type && MEDIA_TYPE_LABELS[type]) return MEDIA_TYPE_LABELS[type];
  return "Mensagem";
}

// Classifica um arquivo de documento para decidir qual prévia mostrar antes
// do envio: PDF renderiza via iframe nativo do navegador, planilhas (xlsx/xls/csv)
// são parseadas com a lib "xlsx" e mostradas como tabela; os demais (docx, pptx…)
// não têm renderização suportada no navegador, só o card com ícone + nome.
function classifyDocumentPreview(file: File): "pdf" | "spreadsheet" | "other" {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".csv") ||
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
    return "spreadsheet";
  return "other";
}

export function getInitials(name: string | null, phone: string) {
  if (!name) return phone.replace(/\D/g, "").slice(-2);
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// Os timestamps são armazenados em UTC. As funções format/isToday do date-fns
// usam o fuso horário local do runtime, que nem sempre é o de São Paulo (em
// alguns ambientes o navegador roda em UTC, exibindo +3h). Convertemos o
// instante para um Date cujos campos locais já refletem o relógio de
// São Paulo, garantindo a exibição correta independente do fuso do host.
const SP_TZ = "America/Sao_Paulo";

function toSP(dateStr: string | Date) {
  let d: Date;
  if (dateStr instanceof Date) {
    d = dateStr;
  } else {
    // Strings sem indicador de fuso (ex.: "2026-07-02 23:16:00" vindas de SQL
    // cru) seriam interpretadas como hora local pelo new Date(). Como o banco
    // armazena UTC, tratamos timestamps "naive" explicitamente como UTC.
    const hasTz = /(?:Z|[+-]\d{2}:?\d{2})$/.test(dateStr);
    d = new Date(hasTz ? dateStr : dateStr.replace(" ", "T") + "Z");
  }
  return new Date(d.toLocaleString("en-US", { timeZone: SP_TZ }));
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatMessageDate(dateStr: string) {
  const d = toSP(dateStr);
  const today = toSP(new Date());
  const yesterday = toSP(new Date(Date.now() - 86_400_000));
  if (isSameDay(d, today)) return format(d, "HH:mm");
  if (isSameDay(d, yesterday)) return "Ontem";
  return format(d, "dd/MM");
}

function formatSectionDate(dateStr: string) {
  const d = toSP(dateStr);
  const today = toSP(new Date());
  const yesterday = toSP(new Date(Date.now() - 86_400_000));
  if (isSameDay(d, today)) return "Hoje";
  if (isSameDay(d, yesterday)) return "Ontem";
  return format(d, "d 'de' MMMM", { locale: ptBR });
}

const UMBLER_COLOR_MAP: Record<string, string> = {
  Aquamarine: "#14b8a6",
  Chocolate: "#92400e",
  Cyan: "#06b6d4",
  Gold: "#d97706",
  Grape: "#7c3aed",
  Gray: "#6b7280",
  Green: "#16a34a",
  Kiwi: "#84cc16",
  Magenta: "#ec4899",
  Pink: "#f472b6",
  Rose: "#e11d48",
  Salmon: "#f87171",
  Skyblue: "#38bdf8",
  Tangerine: "#f97316",
  Tomato: "#ef4444",
  Umblerito: "#5046e5",
};

const TAG_PALETTE = [
  "#e74c3c",
  "#e67e22",
  "#f1c40f",
  "#2ecc71",
  "#1abc9c",
  "#3498db",
  "#9b59b6",
  "#e91e63",
  "#00bcd4",
  "#8bc34a",
  "#ff5722",
  "#795548",
  "#607d8b",
  "#009688",
  "#673ab7",
];

function resolveTagColor(color: string | null, id: string): string {
  if (color) {
    const mapped = UMBLER_COLOR_MAP[color];
    if (mapped) return mapped;
  }
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

// 🐨 é o emoji padrão do Umbler quando nenhum emoji foi definido — tratamos como ausente
function resolveTagEmoji(emoji: string | null): string | null {
  if (!emoji || emoji === "🐨") return null;
  return emoji;
}

function getTagColor(id: string): string {
  return resolveTagColor(null, id);
}

export function WhatsappTagBadge({ tag }: { tag: WhatsappClientTag }) {
  const bg = resolveTagColor(tag.color, tag.id);
  const emoji = resolveTagEmoji(tag.emoji);
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold text-white max-w-[120px]"
      style={{ backgroundColor: bg }}
      title={tag.name}
    >
      {emoji && <span className="shrink-0 leading-none">{emoji}</span>}
      <span className="truncate">{tag.name}</span>
    </span>
  );
}

export function WhatsappTagsEditPopover({
  clientId,
  currentTags,
  availableTags,
  onTagsChange,
  triggerClassName,
}: {
  clientId: string;
  currentTags: WhatsappClientTag[];
  availableTags: WhatsappClientTag[];
  onTagsChange: (clientId: string, tagIds: string[]) => void;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const closedTriggerClassName = triggerClassName ?? "opacity-100";
  const [tagSearch, setTagSearch] = useState("");
  const [localTagIds, setLocalTagIds] = useState<Set<string>>(
    () => new Set(currentTags.map((t) => t.id)),
  );

  // Sincroniza com dados do servidor quando a query refaz o fetch
  useEffect(() => {
    setLocalTagIds(new Set(currentTags.map((t) => t.id)));
  }, [currentTags]);

  function toggleTag(tagId: string) {
    const next = new Set(localTagIds);
    if (next.has(tagId)) {
      next.delete(tagId);
    } else {
      next.add(tagId);
    }
    setLocalTagIds(next);
    onTagsChange(clientId, Array.from(next));
  }

  if (availableTags.length === 0) return null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTagSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "shrink-0 p-1 rounded transition-opacity text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700",
            open ? "opacity-100" : closedTriggerClassName,
          )}
          title="Editar etiquetas"
        >
          <Tag className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-60 p-2"
        side="right"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 px-1">
          Etiquetas WhatsApp
        </p>
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar etiqueta..."
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="w-full pl-7 pr-2 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto">
          {availableTags.filter((t) =>
            t.name.toLowerCase().includes(tagSearch.toLowerCase()),
          ).length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-3">
              Nenhuma etiqueta encontrada
            </p>
          ) : (
            availableTags
              .filter((t) =>
                t.name.toLowerCase().includes(tagSearch.toLowerCase()),
              )
              .map((tag) => {
                const checked = localTagIds.has(tag.id);
                const bg = resolveTagColor(tag.color, tag.id);
                const emoji = resolveTagEmoji(tag.emoji);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-left w-full transition-colors"
                  >
                    <span
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                        checked
                          ? "bg-primary border-primary"
                          : "border-slate-300 dark:border-slate-600",
                      )}
                    >
                      {checked && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full font-medium truncate"
                      style={{ backgroundColor: bg, color: "#fff" }}
                    >
                      {emoji && <span>{emoji}</span>}
                      <span>{tag.name}</span>
                    </span>
                  </button>
                );
              })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ClientListItem({
  client,
  selected,
  onClick,
  availableTags,
  onTagsChange,
}: {
  client: ChatClient;
  selected: boolean;
  onClick: () => void;
  availableTags: WhatsappClientTag[];
  onTagsChange: (clientId: string, tagIds: string[]) => void;
}) {
  const hasUnread = (client.unreadCount ?? 0) > 0;
  const displayName = client.clientName ?? client.phone;

  return (
    <div
      className={cn(
        "w-full flex items-center gap-3 px-3.5 py-3 text-left transition-all duration-150 relative group",
        "border-b border-slate-300/80 dark:border-slate-800",
        selected
          ? "bg-primary/10 dark:bg-primary/20 shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
          : hasUnread
            ? "bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            : "hover:bg-slate-100/70 dark:hover:bg-slate-800/50",
      )}
    >
      <button
        className="flex items-start gap-3 min-w-0 flex-1 text-left"
        onClick={onClick}
      >
        {/* Avatar — mt-0.5 alinha visualmente com o nome */}
        <div className="relative shrink-0 mt-0.5">
          <div
            className={cn(
              "h-11 w-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-semibold text-white shadow-sm ring-2 transition-shadow",
              selected ? "ring-primary/40" : "ring-white dark:ring-slate-900",
            )}
          >
            {getInitials(client.clientName, client.phone)}
          </div>
          {hasUnread && !selected && (
            <span className="absolute -top-1 -right-1 min-w-[19px] h-[19px] rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 flex items-center justify-center text-[10px] font-bold text-white px-1 shadow-sm">
              {(client.unreadCount ?? 0) > 99 ? "99+" : client.unreadCount}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Linha 1: nome + horário */}
          <div className="flex items-baseline justify-between gap-2">
            <p
              className={cn(
                "text-sm leading-5 truncate",
                hasUnread && !selected
                  ? "font-bold text-slate-900 dark:text-white"
                  : "font-semibold text-slate-800 dark:text-slate-100",
              )}
            >
              {displayName}
            </p>
            {client.lastMessageAt && (
              <span
                className={cn(
                  "text-[11px] shrink-0 leading-5 tabular-nums",
                  hasUnread && !selected
                    ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                    : "text-slate-500 dark:text-slate-400",
                )}
              >
                {formatMessageDate(client.lastMessageAt)}
              </span>
            )}
          </div>

          {/* Linha 2: última mensagem */}
          {client.lastMessageContent ? (
            <p
              className={cn(
                "text-xs leading-5 truncate mt-0.5",
                hasUnread && !selected
                  ? "text-slate-700 dark:text-slate-200 font-medium"
                  : "text-slate-600 dark:text-slate-400",
              )}
              title={client.lastMessageContent}
            >
              {client.lastMessageDirection === "outbound" &&
                client.lastMessageType !== "system" && (
                  <span className="text-slate-500 dark:text-slate-500 font-medium mr-0.5">
                    Você:
                  </span>
                )}{" "}
              {client.lastMessageContent}
            </p>
          ) : (
            <p className="text-xs leading-5 mt-0.5 text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
              <Phone className="h-3 w-3 shrink-0" />
              {client.phone}
            </p>
          )}

          {/* Linha 3: tags (seção separada) */}
          {((client.tags && client.tags.length > 0) ||
            (client.whatsappTags && client.whatsappTags.length > 0)) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {client.tags?.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 truncate max-w-[80px]"
                >
                  {tag.name}
                </span>
              ))}
              {(client.tags?.length ?? 0) > 3 && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  +{(client.tags?.length ?? 0) - 3}
                </span>
              )}
              {client.whatsappTags?.slice(0, 3).map((tag) => (
                <WhatsappTagBadge key={tag.id} tag={tag} />
              ))}
              {(client.whatsappTags?.length ?? 0) > 3 && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  +{(client.whatsappTags?.length ?? 0) - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </button>

      {client.clientId && (
        <WhatsappTagsEditPopover
          clientId={client.clientId}
          currentTags={client.whatsappTags ?? []}
          availableTags={availableTags}
          onTagsChange={onTagsChange}
          triggerClassName="opacity-0 group-hover:opacity-100"
        />
      )}
    </div>
  );
}

function AudioPlayer({
  src,
  isOutbound,
}: {
  src: string;
  isOutbound: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play();
    }
  };

  const formatTime = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2.5 w-full min-w-[220px] max-w-[280px]">
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        preload="metadata"
      />

      <button
        onClick={toggle}
        className={cn(
          "shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition-colors",
          isOutbound
            ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
            : "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200",
        )}
      >
        {playing ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 fill-current translate-x-0.5" />
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1">
        <div
          className={cn(
            "relative h-1.5 rounded-full overflow-hidden cursor-pointer",
            isOutbound
              ? "bg-primary-foreground/30"
              : "bg-slate-200 dark:bg-slate-600",
          )}
          onClick={(e) => {
            const el = audioRef.current;
            if (!el || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            el.currentTime = ratio * duration;
          }}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isOutbound ? "bg-primary-foreground" : "bg-primary",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span
          className={cn(
            "text-[10px] tabular-nums",
            isOutbound
              ? "text-primary-foreground/70"
              : "text-slate-400 dark:text-slate-500",
          )}
        >
          {formatTime(current || duration)}
        </span>
      </div>

      <Mic
        className={cn(
          "h-4 w-4 shrink-0",
          isOutbound
            ? "text-primary-foreground/50"
            : "text-slate-400 dark:text-slate-500",
        )}
      />
    </div>
  );
}

function TemplateBubble({
  msg,
  isOutbound,
}: {
  msg: WaMessage;
  isOutbound: boolean;
}) {
  const payload = msg.rawPayload;
  const headerComp = payload?.components?.find((c) => c.type === "header");
  const headerParam = headerComp?.parameters?.[0];
  const imageUrl =
    headerParam?.image?.link ??
    headerParam?.video?.link ??
    headerParam?.document?.link ??
    null;
  const buttons = payload?.buttons ?? [];

  return (
    <div className="overflow-hidden rounded-2xl" style={{ minWidth: 220, maxWidth: 320 }}>
      {imageUrl && (
        <img
          src={imageUrl}
          alt="header"
          className="w-full object-cover"
          style={{ maxHeight: 200 }}
        />
      )}
      <div className="px-3.5 pt-2.5 pb-1.5">
        <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
          {msg.content}
        </p>
      </div>
      {buttons.length > 0 && (
        <>
          <div
            className={cn(
              "mx-3 border-t",
              isOutbound
                ? "border-white/20"
                : "border-slate-200 dark:border-slate-700",
            )}
          />
          <div className="flex flex-col">
            {buttons.map((btn, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-medium",
                  i < buttons.length - 1 &&
                    (isOutbound
                      ? "border-b border-white/20"
                      : "border-b border-slate-200 dark:border-slate-700"),
                  isOutbound
                    ? "text-primary-foreground/90"
                    : "text-blue-600 dark:text-blue-400",
                )}
              >
                <Reply className="h-3.5 w-3.5 shrink-0" />
                {btn.text}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MessageContent({
  msg,
  isOutbound,
}: {
  msg: WaMessage;
  isOutbound: boolean;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const mediaUrl = msg.media?.id ? `/api/whatsapp/media/${msg.media.id}` : null;

  if (msg.type === "template") {
    return <TemplateBubble msg={msg} isOutbound={isOutbound} />;
  }

  if (msg.type === "sticker") {
    if (!mediaUrl)
      return (
        <p className="px-3.5 py-2.5 text-sm italic opacity-60">
          🎭 Figurinha não disponível
        </p>
      );
    return (
      <div className="p-1.5">
        <img
          src={mediaUrl}
          alt="figurinha"
          className="object-contain"
          style={{ width: 120, height: 120 }}
        />
      </div>
    );
  }

  if (msg.type === "image") {
    return (
      <>
        <div>
          {mediaUrl ? (
            <div
              className="relative group cursor-zoom-in"
              onClick={() => setLightboxOpen(true)}
            >
              <img
                src={mediaUrl}
                alt={msg.caption ?? "imagem"}
                className="max-w-full rounded-t-2xl object-cover"
                style={{ maxHeight: 300 }}
              />
              <div className="absolute inset-0 rounded-t-2xl bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <ZoomIn className="h-7 w-7 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
              </div>
            </div>
          ) : (
            <div className="px-3.5 py-2.5 text-sm italic opacity-60">
              [imagem]
            </div>
          )}
          {msg.caption && (
            <p className="text-sm px-3.5 pt-1 pb-0.5 whitespace-pre-wrap break-words">
              {msg.caption}
            </p>
          )}
        </div>

        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 flex items-center justify-center bg-black/90 border-none">
            <img
              src={mediaUrl ?? ""}
              alt={msg.caption ?? "imagem"}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            {msg.caption && (
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white bg-black/60 px-3 py-1 rounded-full max-w-[80%] truncate">
                {msg.caption}
              </p>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (msg.type === "video") {
    return (
      <div>
        {mediaUrl ? (
          <video
            controls
            src={mediaUrl}
            className="max-w-full rounded-t-2xl"
            style={{ maxHeight: 300 }}
          />
        ) : (
          <div className="px-3.5 py-2.5 text-sm italic opacity-60">[vídeo]</div>
        )}
        {msg.caption && (
          <p className="text-sm px-3.5 pt-1 pb-0.5 whitespace-pre-wrap break-words">
            {msg.caption}
          </p>
        )}
      </div>
    );
  }

  if (msg.type === "audio") {
    return mediaUrl ? (
      <AudioPlayer src={mediaUrl} isOutbound={isOutbound} />
    ) : (
      <p className="text-sm italic opacity-60">[áudio]</p>
    );
  }

  if (msg.type === "document") {
    return (
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 shrink-0 opacity-70" />
        <span className="text-sm truncate flex-1">
          {msg.media?.filename ?? msg.caption ?? "documento"}
        </span>
        {mediaUrl && (
          <a
            href={mediaUrl}
            download={msg.media?.filename ?? true}
            className={cn(
              "shrink-0 p-1 rounded hover:opacity-70 transition-opacity",
              isOutbound
                ? "text-primary-foreground"
                : "text-slate-500 dark:text-slate-400",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-4 w-4" />
          </a>
        )}
      </div>
    );
  }

  if (msg.content) {
    return (
      <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
        {msg.content}
      </p>
    );
  }

  // Fallback para mensagens salvas como "unsupported" que têm mídia — infere o tipo pelo mimeType.
  if (msg.media?.mimeType) {
    const mime = msg.media.mimeType;
    const inferredMsg = {
      ...msg,
      type: mime.startsWith("video/")
        ? "video"
        : mime.startsWith("audio/")
          ? "audio"
          : "sticker",
    };
    return <MessageContent msg={inferredMsg} isOutbound={isOutbound} />;
  }

  if (msg.type === "unsupported") {
    return (
      <p className="px-3.5 py-2.5 text-sm italic opacity-60">
        🎭 Figurinha animada não suportada
      </p>
    );
  }

  return <p className="text-sm italic opacity-60">[{msg.type}]</p>;
}

interface SavedSticker {
  id: string;
  mediaId: string;
  createdAt: string;
}

function StickerPicker({
  onPickFromDevice,
  onPickSaved,
}: {
  onPickFromDevice: () => void;
  onPickSaved: (mediaId: string) => void;
}) {
  const {
    data: stickers = [],
    isLoading,
    refetch,
  } = useQuery<SavedSticker[]>({
    queryKey: ["/api/whatsapp/stickers"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/stickers");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/whatsapp/stickers/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/stickers"] });
    } catch {
      toast({ title: "Erro ao remover figurinha", variant: "destructive" });
    }
  };

  return (
    <div className="w-[min(288px,calc(100vw-2rem))] flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
        <Sticker className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Figurinhas salvas
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : stickers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-2">
          <Sticker className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Nenhuma figurinha salva ainda.
            <br />
            Salve figurinhas recebidas no chat.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 p-2 max-h-56 overflow-y-auto">
          {stickers.map((s) => (
            <div
              key={s.id}
              className="relative group cursor-pointer rounded-lg overflow-hidden border border-transparent hover:border-primary/40 transition-colors bg-slate-50 dark:bg-slate-800/50 aspect-square"
              onClick={() => onPickSaved(s.mediaId)}
            >
              <img
                src={`/api/whatsapp/media/${s.mediaId}`}
                alt="figurinha"
                className="w-full h-full object-contain p-1"
              />
              <button
                onClick={(e) => handleDelete(e, s.id)}
                className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                title="Remover"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-slate-100 dark:border-slate-800 p-2">
        <button
          onClick={onPickFromDevice}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Paperclip className="h-3.5 w-3.5 shrink-0" />
          Enviar do dispositivo (.webp)
        </button>
      </div>
    </div>
  );
}

interface QuickReply {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

interface WhatsappBot {
  id: string;
  name: string;
  isActive: boolean;
  triggerType: string;
}

function QuickReplyPicker({ onPick }: { onPick: (content: string) => void }) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: replies = [], isLoading } = useQuery<QuickReply[]>({
    queryKey: ["/api/whatsapp/quick-replies"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/quick-replies");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    try {
      const res = await fetch("/api/whatsapp/quick-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          content: newContent.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({
          title: err.message ?? "Erro ao criar resposta",
          variant: "destructive",
        });
        return;
      }
      setNewTitle("");
      setNewContent("");
      setIsCreating(false);
      queryClient.invalidateQueries({
        queryKey: ["/api/whatsapp/quick-replies"],
      });
    } catch {
      toast({ title: "Erro ao criar resposta rápida", variant: "destructive" });
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/whatsapp/quick-replies/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({
        queryKey: ["/api/whatsapp/quick-replies"],
      });
    } catch {
      toast({ title: "Erro ao remover resposta", variant: "destructive" });
    }
  };

  return (
    <div className="w-[min(320px,calc(100vw-2rem))] flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Respostas rápidas
          </span>
        </div>
        <button
          onClick={() => setIsCreating((v) => !v)}
          className="h-5 w-5 rounded flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
          title="Nova resposta"
        >
          <PlusCircle className="h-3.5 w-3.5" />
        </button>
      </div>

      {isCreating && (
        <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-1.5">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Título (ex: Saudação)"
            className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Texto da resposta…"
            rows={3}
            className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          <div className="flex gap-1.5 justify-end">
            <button
              onClick={() => {
                setIsCreating(false);
                setNewTitle("");
                setNewContent("");
              }}
              className="px-2 py-1 text-xs rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim() || !newContent.trim()}
              className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : replies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-2">
          <Zap className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Nenhuma resposta rápida criada.
            <br />
            Clique em + para adicionar.
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
          {replies.map((r) => (
            <div
              key={r.id}
              className="group flex items-start gap-2 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
              onClick={() => onPick(r.content)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                  {r.title}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-2 mt-0.5">
                  {r.content}
                </p>
              </div>
              <button
                onClick={(e) => handleDelete(e, r.id)}
                className="h-5 w-5 rounded flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5"
                title="Remover"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface MetaTemplateComponent {
  type: string;
  format?: string;
  text?: string;
  buttons?: { type: string; text?: string }[];
}

interface MetaTemplateItem {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  parameter_format?: "NAMED" | "POSITIONAL";
  components: MetaTemplateComponent[];
  headerMedia?: { mediaType: "image" | "video" | "document"; storageKey: string; url: string } | null;
}

function readTemplateComponents(components: MetaTemplateComponent[] | undefined) {
  const list = components ?? [];
  const header = list.find((c) => c.type?.toUpperCase() === "HEADER");
  const body = list.find((c) => c.type?.toUpperCase() === "BODY");
  const footer = list.find((c) => c.type?.toUpperCase() === "FOOTER");
  return { header, body, footer };
}

// Extrai os nomes das variáveis ({{1}}, {{nome}}…) do corpo, na ordem e sem
// duplicatas. Suporta tanto posicional quanto nomeado.
function extractTemplateVars(text: string | undefined): string[] {
  if (!text) return [];
  const matches = text.match(/\{\{\s*([^}]+?)\s*\}\}/g) ?? [];
  const vars = matches.map((m) => m.replace(/^\{\{\s*|\s*\}\}$/g, "").trim());
  return vars.filter((v, i) => vars.indexOf(v) === i);
}

// Substitui {{var}} pelos valores fornecidos (mapeados por nome da variável).
function applyTemplateVars(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, name: string) => {
    const key = name.trim();
    const value = values[key];
    return value && value.length > 0 ? value : `{{${key}}}`;
  });
}

interface TemplateClient {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  city: string | null;
  state: string | null;
}

function TemplatePicker({
  onSend,
  clientId,
}: {
  onSend: (data: {
    templateName: string;
    languageCode: string;
    parameterFormat?: "NAMED" | "POSITIONAL";
    bodyParams: { name?: string; value: string }[];
    previewText: string;
    headerMedia?: { storageKey: string; mediaType: MediaType };
    templateButtons?: { type: string; text: string }[];
  }) => void;
  clientId: string | null;
}) {
  const [selected, setSelected] = useState<MetaTemplateItem | null>(null);
  // Valores das variáveis, mapeados pelo nome do placeholder ({{nome}} ou {{1}}).
  const [values, setValues] = useState<Record<string, string>>({});
  // Mídia de cabeçalho escolhida no envio (biblioteca de mídia).
  const [headerMedia, setHeaderMedia] = useState<{
    storageKey: string;
    mediaType: MediaType;
    url: string;
    name: string;
  } | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);

  const { data: templates = [], isLoading } = useQuery<MetaTemplateItem[]>({
    queryKey: ["/api/whatsapp/templates/meta"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/templates/meta");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Cliente vinculado à conversa — usado para preencher variáveis com seus dados.
  const { data: clientData } = useQuery<TemplateClient>({
    queryKey: ["/api/clients", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}`);
      if (!res.ok) throw new Error("Falha ao buscar cliente");
      return res.json();
    },
    enabled: !!clientId,
  });

  // Conjunto curado de campos do cliente disponíveis (apenas os preenchidos).
  const firstName = clientData?.name?.trim().split(/\s+/)[0] ?? "";
  const clientFields = (
    [
      { label: "Nome", value: clientData?.name },
      { label: "Primeiro nome", value: firstName },
      { label: "Telefone", value: clientData?.phone },
      { label: "E-mail", value: clientData?.email },
      { label: "CPF/CNPJ", value: clientData?.cpf },
      { label: "Cidade", value: clientData?.city },
      { label: "Estado", value: clientData?.state },
    ] as { label: string; value: string | null | undefined }[]
  ).filter((f): f is { label: string; value: string } => !!f.value && f.value.trim().length > 0);

  const approved = templates.filter(
    (t) => t.status?.toUpperCase() === "APPROVED",
  );

  const selectTemplate = (t: MetaTemplateItem) => {
    setSelected(t);
    setValues({});
    setHeaderMedia(null);
  };

  // Define se o template usa parâmetros nomeados. Usa parameter_format quando a
  // Meta o informa; senão infere (algum placeholder não-numérico → nomeado).
  const isNamedFormat = (t: MetaTemplateItem, vars: string[]) =>
    t.parameter_format
      ? t.parameter_format === "NAMED"
      : vars.some((v) => !/^\d+$/.test(v));

  const submit = () => {
    if (!selected) return;
    const { body } = readTemplateComponents(selected.components);
    const vars = extractTemplateVars(body?.text);
    const named = isNamedFormat(selected, vars);
    const bodyParams = vars.map((v) => ({
      name: named ? v : undefined,
      value: values[v] ?? "",
    }));
    const previewText = applyTemplateVars(body?.text ?? selected.name, values);
    const buttonsComp = (selected.components as Array<{ type: string; buttons?: { type: string; text?: string }[] }>).find(
      (c) => c.type?.toUpperCase() === "BUTTONS",
    );
    const templateButtons = (buttonsComp?.buttons ?? [])
      .filter((b) => b.text)
      .map((b) => ({ type: b.type, text: b.text! }));

    onSend({
      templateName: selected.name,
      languageCode: selected.language,
      parameterFormat: selected.parameter_format,
      bodyParams,
      previewText,
      headerMedia: headerMedia
        ? { storageKey: headerMedia.storageKey, mediaType: headerMedia.mediaType }
        : undefined,
      templateButtons,
    });
  };

  // ── Tela de detalhe (template selecionado): preview + variáveis ──
  if (selected) {
    const { header, body, footer } = readTemplateComponents(
      selected.components,
    );
    const hasMediaHeader =
      !!header && !header.text && !!header.format && header.format !== "TEXT";
    // Tipo de mídia exigido pelo cabeçalho (IMAGE/VIDEO/DOCUMENT → image/video/document).
    const headerType = (header?.format?.toLowerCase() ?? "image") as MediaType;
    const headerAccept =
      headerType === "image"
        ? "image/*"
        : headerType === "video"
          ? "video/*"
          : "application/pdf";
    // Pode enviar se houver mídia escolhida agora OU uma mídia padrão configurada.
    const mediaMissing = hasMediaHeader && !headerMedia && !selected.headerMedia;
    const vars = extractTemplateVars(body?.text);
    const allFilled = vars.every((v) => (values[v] ?? "").trim().length > 0);
    const canSubmit = allFilled && !mediaMissing;
    const preview = applyTemplateVars(body?.text ?? "", values);

    return (
      <div className="w-[min(340px,calc(100vw-2rem))] flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setSelected(null)}
            className="h-5 w-5 rounded flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
            title="Voltar"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate flex-1">
            {selected.name}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
            {selected.language}
          </span>
        </div>

        <div className="p-3 flex flex-col gap-3 max-h-72 overflow-y-auto">
          {/* Preview do corpo */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-2.5 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
            {hasMediaHeader && (
              <p className="text-[10px] italic text-slate-400 dark:text-slate-500 mb-1.5">
                [Cabeçalho: {header?.format}]
              </p>
            )}
            {preview || (
              <span className="italic text-slate-400">Sem corpo</span>
            )}
            {footer?.text && (
              <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                {footer.text}
              </p>
            )}
          </div>

          {/* Seletor de mídia de cabeçalho (biblioteca de mídia) */}
          {hasMediaHeader && (() => {
            // Mídia ativa: override do usuário tem prioridade; fallback = padrão do template.
            const activeName = headerMedia?.name ?? "Mídia padrão";
            const activeUrl = headerMedia?.url ?? selected.headerMedia?.url;
            const activeType = headerMedia?.mediaType ?? selected.headerMedia?.mediaType;
            const hasActive = !!headerMedia || !!selected.headerMedia;
            return (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Mídia do cabeçalho ({header?.format})
                </label>
                {hasActive ? (
                  <div className="flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 p-1.5">
                    {activeType === "image" && activeUrl ? (
                      <img
                        src={activeUrl}
                        alt={activeName}
                        className="h-9 w-9 rounded object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate block">
                        {activeName}
                      </span>
                      {!headerMedia && selected.headerMedia && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          Mídia padrão do template
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachOpen(true)}
                      className="text-[10px] text-primary hover:underline shrink-0"
                    >
                      Trocar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAttachOpen(true)}
                    className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 dark:border-slate-600 px-2.5 py-2 text-[11px] text-slate-500 dark:text-slate-400 hover:border-primary hover:text-primary transition-colors"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    Anexar mídia
                  </button>
                )}
                {mediaMissing && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Anexe a mídia do cabeçalho antes de enviar.
                  </span>
                )}
                <AttachFileDialog
                  open={attachOpen}
                  onOpenChange={setAttachOpen}
                  lockedType={headerType}
                  accept={headerAccept}
                  onAttach={(item) =>
                    setHeaderMedia({
                      storageKey: item.storageKey,
                      mediaType: item.mediaType,
                      url: item.url,
                      name: item.name,
                    })
                  }
                />
              </div>
            );
          })()}

          {/* Inputs de variáveis */}
          {vars.length > 0 && (
            <div className="flex flex-col gap-2">
              {vars.map((v) => (
                <div key={v}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-mono">
                      {`{{${v}}}`}
                    </label>
                    {clientFields.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                          >
                            <User className="h-3 w-3" />
                            Inserir dado
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="max-h-60 overflow-y-auto">
                          {clientFields.map((f) => (
                            <DropdownMenuItem
                              key={f.label}
                              onClick={() =>
                                setValues((prev) => ({ ...prev, [v]: f.value }))
                              }
                            >
                              <span className="text-xs">{f.label}</span>
                              <span className="ml-2 text-[10px] text-muted-foreground truncate max-w-[130px]">
                                {f.value}
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <input
                    type="text"
                    value={values[v] ?? ""}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [v]: e.target.value }))
                    }
                    placeholder={`Valor de {{${v}}}`}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 p-2">
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            Enviar template
          </button>
        </div>
      </div>
    );
  }

  // ── Lista de templates aprovados ──
  return (
    <div className="w-[min(320px,calc(100vw-2rem))] flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
        <FileText className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Templates aprovados
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : approved.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-2">
          <FileText className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Nenhum template aprovado disponível.
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
          {approved.map((t) => {
            const { body } = readTemplateComponents(t.components);
            const varCount = extractTemplateVars(body?.text).length;
            return (
              <button
                key={t.id}
                className="flex flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                onClick={() => selectTemplate(t)}
              >
                <div className="flex items-center gap-1.5 w-full">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex-1">
                    {t.name}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                    {t.language}
                  </span>
                </div>
                {body?.text && (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-2">
                    {body.text}
                  </span>
                )}
                {varCount > 0 && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                    {varCount} variáve{varCount > 1 ? "is" : "l"} a preencher
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateClientFromConversationDialog({
  open,
  onOpenChange,
  client,
  userRole,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: ChatClient;
  userRole: string;
  onSuccess: (clientId: string) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    cpf: "",
    birthday: "",
    categoria: "",
    origem: "WhatsApp",
    responsavelId: "",
  });
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAdminOrGerente = userRole === "admin" || userRole === "gerente";

  const { data: categories = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/tags/categories"],
    queryFn: async () => {
      const res = await fetch("/api/tags/categories");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const { data: origins = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/tags/origins"],
    queryFn: async () => {
      const res = await fetch("/api/tags/origins");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const { data: users = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && isAdminOrGerente,
  });

  const set =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setIsPending(true);
    try {
      const body: Record<string, string> = {
        action: "create",
        name: form.name.trim(),
      };
      if (form.email.trim()) body.email = form.email.trim();
      if (form.cpf.trim()) body.cpf = form.cpf.trim();
      if (form.birthday) body.birthday = form.birthday;
      if (form.categoria) body.categoria = form.categoria;
      if (form.origem) body.origem = form.origem;
      if (form.responsavelId) body.responsavelId = form.responsavelId;

      const res = await fetch(
        `/api/whatsapp/conversations/${client.conversationId}/link-client`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: data?.message ?? "Erro ao criar cliente",
          variant: "destructive",
        });
        return;
      }
      queryClient.invalidateQueries({
        queryKey: ["/api/whatsapp/conversations-list"],
      });
      onOpenChange(false);
      setForm({
        name: "",
        email: "",
        cpf: "",
        birthday: "",
        categoria: "",
        origem: "WhatsApp",
        responsavelId: "",
      });
      onSuccess(data.clientId);
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const Field = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <div>
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
        {label}
      </label>
      {children}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome *">
              <Input
                value={form.name}
                onChange={set("name")}
                placeholder="Nome completo"
                autoFocus
              />
            </Field>
            <Field label="Telefone">
              <Input
                value={client.phone}
                readOnly
                className="bg-slate-50 dark:bg-slate-800/50 text-slate-500"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="E-mail">
              <Input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="email@exemplo.com"
              />
            </Field>
            <Field label="CPF">
              <Input
                value={form.cpf}
                onChange={set("cpf")}
                placeholder="000.000.000-00"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Data de nascimento">
              <Input
                type="date"
                value={form.birthday}
                onChange={set("birthday")}
              />
            </Field>
            <Field label="Categoria">
              <Select
                value={form.categoria}
                onValueChange={(v) => setForm((p) => ({ ...p, categoria: v }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecionar…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Geral">Geral</SelectItem>
                  {(categories as { id: string; name: string }[]).map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Origem">
              <Select
                value={form.origem}
                onValueChange={(v) => setForm((p) => ({ ...p, origem: v }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecionar…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  {(origins as { id: string; name: string }[])
                    .filter((o) => o.name !== "WhatsApp")
                    .map((o) => (
                      <SelectItem key={o.id} value={o.name}>
                        {o.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            {isAdminOrGerente && (
              <Field label="Responsável">
                <Select
                  value={form.responsavelId}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, responsavelId: v }))
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(users as { id: string; name: string }[]).map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleCreate}
              disabled={isPending || !form.name.trim()}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Criar cliente
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConversationMessages({
  conversationKey,
  onBack,
  client,
  channels,
  userRole,
  onClientLinked,
  availableWhatsappTags,
  onWhatsappTagsChange,
}: {
  conversationKey: string;
  onBack: () => void;
  client: ChatClient;
  channels: Channel[];
  userRole: string;
  onClientLinked: (clientId: string) => void;
  availableWhatsappTags: WhatsappClientTag[];
  onWhatsappTagsChange: (clientId: string, tagIds: string[]) => void;
}) {
  const [message, setMessage] = useState("");
  const [composerMode, setComposerMode] = useState<"message" | "note">("message");
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<WaMessage | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<
    number | undefined
  >(client.channelId ?? undefined);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [pendingAudio, setPendingAudio] = useState<{
    blob: Blob;
    url: string;
    file: File;
  } | null>(null);
  const [pendingMedia, setPendingMedia] = useState<{
    file: File;
    url: string;
    kind: "image" | "video" | "document" | "sticker";
  } | null>(null);
  const [pendingMediaCaption, setPendingMediaCaption] = useState("");
  const [spreadsheetPreview, setSpreadsheetPreview] = useState<{
    rows: string[][];
    truncated: boolean;
  } | null>(null);
  const [spreadsheetPreviewLoading, setSpreadsheetPreviewLoading] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reactingToId, setReactingToId] = useState<string | null>(null);
  const cursorPosRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { toast } = useToast();

  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [quickReplyOpen, setQuickReplyOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [botPickerOpen, setBotPickerOpen] = useState(false);
  const [triggeringBotId, setTriggeringBotId] = useState<string | null>(null);
  const [savingStickers, setSavingStickers] = useState<Set<string>>(new Set());
  const [transferOpen, setTransferOpen] = useState(false);
  const [contactDetailsOpen, setContactDetailsOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const isUnknownContact = !client.clientId;

  const transferMutation = useMutation({
    mutationFn: async (channelId: number) => {
      const res = await fetch(
        `/api/whatsapp/conversations/${client.conversationId}/transfer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Erro ao transferir conversa");
      }
      return res.json();
    },
    onSuccess: () => {
      setTransferOpen(false);
      queryClient.invalidateQueries({
        queryKey: ["/api/whatsapp/conversations-list"],
      });
      toast({ title: "Conversa transferida com sucesso" });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const closeConversationMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/whatsapp/conversations/${client.conversationId}/close`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Erro ao encerrar conversa");
      }
      return res.json();
    },
    onSuccess: () => {
      setCloseConfirmOpen(false);
      queryClient.invalidateQueries({
        queryKey: ["/api/whatsapp/conversations-list"],
      });
      toast({ title: "Conversa encerrada" });
      onBack();
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const reopenConversationMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/whatsapp/conversations/${client.conversationId}/reopen`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Erro ao reabrir conversa");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/whatsapp/conversations-list"],
      });
      toast({ title: "Conversa reaberta" });
      onBack();
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const { data: bots = [] } = useQuery<WhatsappBot[]>({
    queryKey: ["/api/whatsapp/bots"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/bots");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: waSettings } = useWhatsappSettings();

  const activeBots = bots.filter((b) => b.isActive);

  const botShortcuts = parseBotShortcuts(waSettings?.wa_bot_shortcut_ids);
  const shortcutBots = botShortcuts
    .map((s) => {
      const bot = activeBots.find((b) => b.id === s.botId);
      return bot ? { ...bot, icon: s.icon } : null;
    })
    .filter((b): b is WhatsappBot & { icon: keyof typeof BOT_SHORTCUT_ICONS } => !!b);

  const handleTriggerBot = async (botId: string) => {
    if (!canSendMessages) {
      toast({
        title: "Selecione um canal conectado para disparar bots",
        variant: "destructive",
      });
      return;
    }
    setTriggeringBotId(botId);
    setBotPickerOpen(false);
    try {
      const body: { botId: string; channelId?: number } = { botId };
      if (
        (userRole === "admin" || userRole === "gerente") &&
        selectedChannelId != null
      ) {
        body.channelId = selectedChannelId;
      }
      const res = await fetch(
        `/api/whatsapp/conversations/${conversationKey}/trigger-bot`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title:
            (err as { message?: string }).message ?? "Erro ao disparar bot",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Bot disparado com sucesso" });
    } catch {
      toast({
        title: "Erro de conexão ao disparar bot",
        variant: "destructive",
      });
    } finally {
      setTriggeringBotId(null);
    }
  };

  const handleSaveSticker = async (mediaId: string) => {
    if (savingStickers.has(mediaId)) return;
    setSavingStickers((prev) => new Set(prev).add(mediaId));
    try {
      await fetch("/api/whatsapp/stickers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/stickers"] });
      toast({ title: "Figurinha salva!" });
    } catch {
      toast({ title: "Erro ao salvar figurinha", variant: "destructive" });
    } finally {
      setSavingStickers((prev) => {
        const s = new Set(prev);
        s.delete(mediaId);
        return s;
      });
    }
  };

  const sendSavedSticker = async (mediaId: string) => {
    setStickerPickerOpen(false);
    setIsUploading(true);
    try {
      const res = await fetch(`/api/whatsapp/media/${mediaId}`);
      if (!res.ok) throw new Error("Falha ao buscar figurinha");
      const blob = await res.blob();
      const file = new File([blob], `sticker-${Date.now()}.webp`, {
        type: blob.type || "image/webp",
      });
      await sendMedia(file);
    } catch {
      toast({ title: "Erro ao enviar figurinha", variant: "destructive" });
      setIsUploading(false);
    }
  };

  const { data: rawMessages = [], isLoading } = useQuery<WaMessage[]>({
    queryKey: ["/api/whatsapp/conversations", conversationKey],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/conversations/${conversationKey}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data?.messages ?? (Array.isArray(data) ? data : []);
    },
    refetchInterval: 30_000,
  });

  const messages = [...rawMessages].sort(
    (a, b) =>
      new Date(a.sentAt ?? a.createdAt).getTime() -
      new Date(b.sentAt ?? b.createdAt).getTime(),
  );

  const { data: conversationNotes = [] } = useQuery<ConversationNote[]>({
    queryKey: ["/api/whatsapp/conversations", conversationKey, "notes"],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/conversations/${conversationKey}/notes`);
      if (!res.ok) return [];
      return res.json();
    },
  });
  const [notesBannerDismissed, setNotesBannerDismissed] = useState(false);
  const [notesListOpen, setNotesListOpen] = useState(false);
  const latestNote = conversationNotes[0] ?? null;

  // Ao abrir a conversa, pula direto para a última mensagem (sem animação);
  // mensagens que chegam depois (novas ou enviadas) rolam suavemente.
  const hasScrolledInitiallyRef = useRef(false);
  useEffect(() => {
    if (isLoading) return;
    messagesEndRef.current?.scrollIntoView({
      behavior: hasScrolledInitiallyRef.current ? "smooth" : "auto",
    });
    hasScrolledInitiallyRef.current = true;
  }, [isLoading, messages.length, localMessages.length]);

  // Some localIds cuja troca (bolha local -> mensagem real) já foi disparada,
  // pra não repetir o pré-carregamento se este efeito rodar de novo antes dele
  // terminar (ex.: outro refetch/poll chegando enquanto a imagem real ainda
  // está sendo buscada).
  const swappingLocalIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (localMessages.length === 0) return;
    for (const lm of localMessages) {
      if (swappingLocalIdsRef.current.has(lm.localId)) continue;
      const match = rawMessages.find((m) => {
        if (m.direction !== "outbound") return false;
        const withinWindow =
          new Date(m.sentAt ?? m.createdAt).getTime() >=
          new Date(lm.createdAt).getTime() - 5_000;
        if (!withinWindow) return false;
        return lm.media
          ? m.type === lm.media.kind && (m.caption ?? "") === lm.content
          : m.content === lm.content;
      });
      if (!match) continue;

      swappingLocalIdsRef.current.add(lm.localId);
      const remove = () => {
        swappingLocalIdsRef.current.delete(lm.localId);
        setLocalMessages((prev) => {
          const target = prev.find((x) => x.localId === lm.localId);
          if (!target) return prev;
          if (target.media) URL.revokeObjectURL(target.media.url);
          return prev.filter((x) => x.localId !== lm.localId);
        });
      };

      // Trocar a bolha local (já carregada, é um blob local) pela real na
      // hora que a mensagem é persistida faz a mídia "sumir" por um instante,
      // pois <img>/<video> da bolha real ainda precisa buscar
      // /api/whatsapp/media/:id pela primeira vez. Pré-carregamos essa mídia
      // em segundo plano e só então removemos a bolha local — a troca fica
      // instantânea e sem flash. Documentos (sem preview visual) e mensagens
      // de texto trocam na hora, sem necessidade disso.
      const mediaUrl = match.media?.id
        ? `/api/whatsapp/media/${match.media.id}`
        : null;
      if (lm.media?.kind === "image" || lm.media?.kind === "sticker") {
        if (!mediaUrl) {
          remove();
          continue;
        }
        const img = new Image();
        img.onload = remove;
        img.onerror = remove;
        img.src = mediaUrl;
      } else if (lm.media?.kind === "video" && mediaUrl) {
        fetch(mediaUrl).then(remove, remove);
      } else {
        remove();
      }
    }
  }, [rawMessages]);

  useEffect(() => {
    const es = new EventSource(
      `/api/whatsapp/conversations/${conversationKey}/stream`,
    );
    es.addEventListener("new_message", () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/whatsapp/conversations", conversationKey],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/whatsapp/conversations-list"],
      });
    });
    return () => es.close();
  }, [conversationKey, queryClient]);

  const attemptSend = useCallback(
    async (
      text: string,
      localId: string,
      channelId?: number,
      replyToMessageId?: string,
    ) => {
      try {
        const body: {
          message: string;
          channelId?: number;
          replyToMessageId?: string;
        } = { message: text };
        if (
          (userRole === "admin" || userRole === "gerente") &&
          channelId != null
        ) {
          body.channelId = channelId;
        }
        if (replyToMessageId) {
          body.replyToMessageId = replyToMessageId;
        }
        const res = await fetch(
          `/api/whatsapp/conversations/${conversationKey}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        if (!res.ok) throw new Error();
      } catch (err) {
        if (err instanceof TypeError) {
          // TypeError = network error: request never reached the backend, no DB record created
          setLocalMessages((prev) => prev.filter((m) => m.localId !== localId));
          toast({
            title: "Erro de conexão. Verifique sua internet e tente novamente.",
            variant: "destructive",
          });
        }
        // Non-network errors: backend persisted the message as "failed" — retry button will appear
        // rawMessages effect will remove the local message once the server data arrives
      } finally {
        queryClient.invalidateQueries({
          queryKey: ["/api/whatsapp/conversations", conversationKey],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/whatsapp/conversations-list"],
        });
      }
    },
    [conversationKey, queryClient, toast, userRole],
  );

  const attemptSendNote = useCallback(
    async (text: string, localId: string) => {
      try {
        const res = await fetch(
          `/api/whatsapp/conversations/${conversationKey}/notes`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: text }),
          },
        );
        if (!res.ok) throw new Error();
        setNotesBannerDismissed(false);
      } catch {
        setLocalMessages((prev) => prev.filter((m) => m.localId !== localId));
        toast({
          title: "Erro ao salvar a nota. Tente novamente.",
          variant: "destructive",
        });
      } finally {
        queryClient.invalidateQueries({
          queryKey: ["/api/whatsapp/conversations", conversationKey],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/whatsapp/conversations-list"],
        });
      }
    },
    [conversationKey, queryClient, toast],
  );

  const handleRetry = useCallback(
    async (messageId: string) => {
      setRetryingIds((prev) => {
        const s = new Set(prev);
        s.add(messageId);
        return s;
      });
      try {
        await fetch(
          `/api/whatsapp/conversations/${conversationKey}/messages/${messageId}/retry`,
          {
            method: "POST",
          },
        );
      } finally {
        setRetryingIds((prev) => {
          const s = new Set(prev);
          s.delete(messageId);
          return s;
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/whatsapp/conversations", conversationKey],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/whatsapp/conversations-list"],
        });
      }
    },
    [conversationKey, queryClient],
  );

  const sendMedia = useCallback(
    async (file: File, caption?: string) => {
      setIsUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        if (caption) form.append("caption", caption);
        if (
          (userRole === "admin" || userRole === "gerente") &&
          selectedChannelId != null
        ) {
          form.append("channelId", String(selectedChannelId));
        }
        if (replyingTo) {
          form.append("replyToMessageId", replyingTo.id);
          setReplyingTo(null);
        }
        const res = await fetch(
          `/api/whatsapp/conversations/${conversationKey}/messages/media`,
          {
            method: "POST",
            body: form,
          },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast({
            title:
              (err as { message?: string }).message ?? "Erro ao enviar arquivo",
            variant: "destructive",
          });
          return false;
        }
        return true;
      } catch {
        toast({
          title: "Erro de conexão ao enviar arquivo",
          variant: "destructive",
        });
        return false;
      } finally {
        setIsUploading(false);
        queryClient.invalidateQueries({
          queryKey: ["/api/whatsapp/conversations", conversationKey],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/whatsapp/conversations-list"],
        });
      }
    },
    [
      conversationKey,
      queryClient,
      replyingTo,
      selectedChannelId,
      toast,
      userRole,
    ],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      const kind: "image" | "video" | "document" = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : "document";
      setPendingMedia({ file, url: URL.createObjectURL(file), kind });
      setPendingMediaCaption("");
    },
    [],
  );

  const handleStickerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      setPendingMedia({ file, url: URL.createObjectURL(file), kind: "sticker" });
      setPendingMediaCaption("");
    },
    [],
  );

  const cancelPendingMedia = useCallback(() => {
    if (pendingMedia) URL.revokeObjectURL(pendingMedia.url);
    setPendingMedia(null);
    setPendingMediaCaption("");
  }, [pendingMedia]);

  const confirmPendingMedia = useCallback(() => {
    if (!pendingMedia) return;
    const { file, url, kind } = pendingMedia;
    const caption =
      kind !== "sticker" && pendingMediaCaption.trim()
        ? pendingMediaCaption.trim()
        : undefined;
    // Mostra a mídia (já disponível localmente como blob) e a legenda juntas,
    // na hora — em vez de esperar o upload + refetch para a bolha aparecer,
    // o que fazia a legenda surgir bem antes da imagem/vídeo.
    const localId = crypto.randomUUID();
    setLocalMessages((prev) => [
      ...prev,
      {
        localId,
        content: caption ?? "",
        createdAt: new Date().toISOString(),
        media: { url, kind, fileName: file.name },
      },
    ]);
    setPendingMedia(null);
    setPendingMediaCaption("");
    void sendMedia(file, caption).then((ok) => {
      if (ok) return;
      // Falhou: remove a bolha "enviando…" e libera o blob local (o real
      // nunca vai chegar para acionar a limpeza automática via rawMessages).
      setLocalMessages((prev) => {
        const target = prev.find((lm) => lm.localId === localId);
        if (target?.media) URL.revokeObjectURL(target.media.url);
        return prev.filter((lm) => lm.localId !== localId);
      });
    });
  }, [pendingMedia, pendingMediaCaption, sendMedia]);

  // Prévia de planilha (xlsx/xls/csv): parseia o arquivo localmente (nada é
  // enviado à API) e mostra as primeiras linhas como tabela.
  useEffect(() => {
    if (
      !pendingMedia ||
      pendingMedia.kind !== "document" ||
      classifyDocumentPreview(pendingMedia.file) !== "spreadsheet"
    ) {
      setSpreadsheetPreview(null);
      setSpreadsheetPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setSpreadsheetPreviewLoading(true);
    (async () => {
      try {
        const XLSX = await import("xlsx");
        const buffer = new Uint8Array(await pendingMedia.file.arrayBuffer());
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          blankrows: false,
          defval: "",
        });
        if (cancelled) return;
        const MAX_ROWS = 20;
        setSpreadsheetPreview({
          rows: allRows
            .slice(0, MAX_ROWS)
            .map((row) => row.map((cell) => String(cell))),
          truncated: allRows.length > MAX_ROWS,
        });
      } catch {
        if (!cancelled) setSpreadsheetPreview(null);
      } finally {
        if (!cancelled) setSpreadsheetPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingMedia]);

  const handleReact = useCallback(
    async (messageId: string, emoji: string) => {
      setReactingToId(null);
      try {
        const body: { emoji: string; channelId?: number } = { emoji };
        if (
          (userRole === "admin" || userRole === "gerente") &&
          selectedChannelId != null
        ) {
          body.channelId = selectedChannelId;
        }
        await fetch(
          `/api/whatsapp/conversations/${conversationKey}/messages/${messageId}/reaction`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        queryClient.invalidateQueries({
          queryKey: ["/api/whatsapp/conversations", conversationKey],
        });
      } catch {
        toast({ title: "Erro ao reagir à mensagem", variant: "destructive" });
      }
    },
    [conversationKey, queryClient, selectedChannelId, toast, userRole],
  );

  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    recordingChunksRef.current = [];
    stopRecording();
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
    }
  }, [stopRecording]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Firefox supports ogg/opus natively; Chrome always produces webm/opus
      // (audio/mp4 on Chrome Windows reports as supported but produces invalid output)
      // The server remuxes webm/opus → ogg/opus transparently.
      const mimeType = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recordingChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordingChunksRef.current.length === 0) return;
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        const ext = mimeType.includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `audio-${Date.now()}.${ext}`, {
          type: mimeType,
        });
        const url = URL.createObjectURL(blob);
        setPendingAudio({ blob, url, file });
        recordingChunksRef.current = [];
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(
        () => setRecordingSeconds((s) => s + 1),
        1000,
      );
    } catch {
      toast({
        title: "Não foi possível acessar o microfone",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Canal atualmente em uso na conversa. Só é possível enviar mensagens/disparar
  // bots quando há um canal selecionado E ele está conectado (cloud_api é sempre
  // considerado conectado; evolution depende de connectionStatus).
  const activeChannel = channels.find((c) => c.id === selectedChannelId) ?? null;
  const canSendMessages =
    activeChannel != null &&
    (activeChannel.provider === "cloud_api" ||
      activeChannel.connectionStatus === "connected");

  // Janela de atendimento de 24h da Meta: só vale para o canal oficial (cloud_api).
  // A janela abre na última mensagem RECEBIDA do contato; fora dela, a Meta só
  // aceita templates aprovados. O Evolution (não oficial) não tem essa restrição.
  const isCloudApi = activeChannel?.provider === "cloud_api";
  const lastInboundAt =
    [...messages].reverse().find((m) => m.direction === "inbound")?.sentAt ??
    null;
  const windowOpen = lastInboundAt
    ? Date.now() - new Date(lastInboundAt).getTime() < 24 * 60 * 60 * 1000
    : false;
  const windowClosed = isCloudApi && !windowOpen;

  const sendTemplate = useCallback(
    async (data: {
      templateName: string;
      languageCode: string;
      parameterFormat?: "NAMED" | "POSITIONAL";
      bodyParams: { name?: string; value: string }[];
      previewText: string;
      headerMedia?: { storageKey: string; mediaType: MediaType };
      templateButtons?: { type: string; text: string }[];
    }) => {
      const localId = crypto.randomUUID();
      setLocalMessages((prev) => [
        ...prev,
        {
          localId,
          content: data.previewText,
          createdAt: new Date().toISOString(),
        },
      ]);
      try {
        const body: {
          templateName: string;
          languageCode: string;
          parameterFormat?: "NAMED" | "POSITIONAL";
          bodyParams: { name?: string; value: string }[];
          previewText: string;
          channelId?: number;
          headerMedia?: { storageKey: string; mediaType: MediaType };
          templateButtons?: { type: string; text: string }[];
        } = {
          templateName: data.templateName,
          languageCode: data.languageCode,
          parameterFormat: data.parameterFormat,
          bodyParams: data.bodyParams,
          previewText: data.previewText,
          headerMedia: data.headerMedia,
          templateButtons: data.templateButtons,
        };
        if (
          (userRole === "admin" || userRole === "gerente") &&
          selectedChannelId != null
        ) {
          body.channelId = selectedChannelId;
        }
        const res = await fetch(
          `/api/whatsapp/conversations/${conversationKey}/messages/template`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setLocalMessages((prev) => prev.filter((m) => m.localId !== localId));
          toast({
            title: "Falha ao enviar template",
            description:
              (err as { message?: string }).message ??
              "Erro desconhecido ao enviar template",
            variant: "destructive",
          });
        }
      } catch {
        setLocalMessages((prev) => prev.filter((m) => m.localId !== localId));
        toast({
          title: "Erro de conexão ao enviar template",
          variant: "destructive",
        });
      } finally {
        queryClient.invalidateQueries({
          queryKey: ["/api/whatsapp/conversations", conversationKey],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/whatsapp/conversations-list"],
        });
      }
    },
    [conversationKey, queryClient, selectedChannelId, toast, userRole],
  );

  const handleSend = () => {
    const text = message.trim();
    if (!text) return;
    if (composerMode === "note") {
      const localId = crypto.randomUUID();
      setLocalMessages((prev) => [
        ...prev,
        { localId, content: text, createdAt: new Date().toISOString(), isNote: true },
      ]);
      setMessage("");
      textareaRef.current?.focus();
      attemptSendNote(text, localId);
      return;
    }
    if (!canSendMessages) return;
    if (windowClosed) return;
    const localId = crypto.randomUUID();
    const replyId = replyingTo?.id;
    setLocalMessages((prev) => [
      ...prev,
      { localId, content: text, createdAt: new Date().toISOString() },
    ]);
    setMessage("");
    setReplyingTo(null);
    textareaRef.current?.focus();
    attemptSend(text, localId, selectedChannelId, replyId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const grouped: { date: string; msgs: WaMessage[] }[] = [];
  for (const msg of messages) {
    const day = format(toSP(msg.sentAt ?? msg.createdAt), "yyyy-MM-dd");
    const last = grouped[grouped.length - 1];
    if (last?.date === day) {
      last.msgs.push(msg);
    } else {
      grouped.push({ date: day, msgs: [msg] });
    }
  }

  const displayName = client.clientName ?? client.phone;

  const isAdminOrGerente = userRole === "admin" || userRole === "gerente";
  const showChannelSelect = isAdminOrGerente && channels.length > 0;

  const ChannelSelect = () => (
    <Select
      value={selectedChannelId != null ? String(selectedChannelId) : ""}
      onValueChange={(v) => {
        if (!v) return;
        const ch = channels.find((c) => c.id === Number(v));
        if (!ch) return;
        if (ch.provider === "evolution" && ch.connectionStatus !== "connected")
          return;
        setSelectedChannelId(Number(v));
      }}
    >
      <SelectTrigger className="h-8 text-xs w-full border-slate-200 dark:border-slate-700">
        <SelectValue placeholder="Selecionar canal…">
          {selectedChannelId != null &&
            (() => {
              const ch = channels.find((c) => c.id === selectedChannelId);
              if (!ch) return "Selecionar canal…";
              const isConnected =
                ch.provider === "cloud_api" ||
                ch.connectionStatus === "connected";
              return (
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={cn(
                      "shrink-0 h-2 w-2 rounded-full",
                      isConnected
                        ? "bg-green-500"
                        : ch.connectionStatus === "connecting"
                          ? "bg-amber-400 animate-pulse"
                          : "bg-slate-300 dark:bg-slate-600",
                    )}
                  />
                  <span className="truncate">
                    {ch.name}
                    {ch.displayPhone ? ` · ${ch.displayPhone}` : ""}
                  </span>
                </span>
              );
            })()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {channels.map((ch) => {
          const isConnected =
            ch.provider === "cloud_api" || ch.connectionStatus === "connected";
          const isConnecting =
            ch.provider === "evolution" && ch.connectionStatus === "connecting";
          const isDisabled =
            ch.provider === "evolution" && ch.connectionStatus !== "connected";
          return (
            <SelectItem
              key={ch.id}
              value={String(ch.id)}
              disabled={isDisabled}
              className={cn(isDisabled && "opacity-50 cursor-not-allowed")}
            >
              <span className="flex items-center gap-2 w-full min-w-0">
                <span
                  className={cn(
                    "shrink-0 h-2 w-2 rounded-full",
                    isConnected
                      ? "bg-green-500"
                      : isConnecting
                        ? "bg-amber-400 animate-pulse"
                        : "bg-slate-300 dark:bg-slate-600",
                  )}
                />
                <span className="flex flex-col min-w-0">
                  <span className="truncate font-medium text-xs leading-tight">
                    {ch.name}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] leading-tight",
                      isConnected
                        ? "text-green-600 dark:text-green-400"
                        : isConnecting
                          ? "text-amber-500"
                          : "text-slate-400 dark:text-slate-500",
                    )}
                  >
                    {isConnected
                      ? (ch.displayPhone ?? "Conectado")
                      : isConnecting
                        ? "Conectando…"
                        : "Desconectado"}
                  </span>
                </span>
                {isConnected ? (
                  <Wifi className="h-3 w-3 text-green-500 shrink-0 ml-auto" />
                ) : isConnecting ? (
                  <Radio className="h-3 w-3 text-amber-400 shrink-0 ml-auto" />
                ) : (
                  <WifiOff className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0 ml-auto" />
                )}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        {/* Linha principal */}
        <div className="px-2 sm:px-4 py-2.5 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9 shrink-0 text-slate-500"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0">
            {getInitials(client.clientName, client.phone)}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">
              {displayName}
            </p>
            {client.clientName && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                <Phone className="h-3 w-3 shrink-0" />
                <span className="truncate">{client.phone}</span>
              </p>
            )}
            {((client.tags && client.tags.length > 0) ||
              (client.whatsappTags && client.whatsappTags.length > 0)) && (
              <div className="flex flex-wrap gap-1 mt-0.5 hidden sm:flex">
                {client.tags?.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                  >
                    {tag.name}
                  </span>
                ))}
                {client.whatsappTags?.map((tag) => (
                  <WhatsappTagBadge key={tag.id} tag={tag} />
                ))}
              </div>
            )}
          </div>

          {/* Canal select — visível apenas em sm+ no header principal */}
          {showChannelSelect && (
            <div className="hidden sm:flex items-center gap-2 shrink-0 min-w-0 max-w-[200px]">
              <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                Canal:
              </span>
              <div className="min-w-0 flex-1">
                <ChannelSelect />
              </div>
            </div>
          )}

          {/* Detalhes do contato */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            title="Ver detalhes do contato"
            onClick={() => setContactDetailsOpen(true)}
          >
            <User className="h-3.5 w-3.5" />
          </Button>

          {/* Editar etiquetas */}
          {client.clientId && (
            <WhatsappTagsEditPopover
              clientId={client.clientId}
              currentTags={client.whatsappTags ?? []}
              availableTags={availableWhatsappTags}
              onTagsChange={onWhatsappTagsChange}
              triggerClassName="h-8 w-8 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 opacity-100"
            />
          )}

          {/* Transferir */}
          {channels.length > 0 && (
            <Popover open={transferOpen} onOpenChange={setTransferOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 sm:h-7 sm:w-auto sm:px-2.5 sm:gap-1.5 text-xs"
                  title="Transferir conversa para outro canal"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-xs">Transferir</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 px-2 py-1.5 font-medium">
                  Transferir para canal:
                </p>
                {channels
                  .filter((ch) => ch.id !== client.channelId)
                  .map((ch) => (
                    <button
                      key={ch.id}
                      className="w-full text-left px-2 py-2 text-sm rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 flex flex-col"
                      disabled={transferMutation.isPending}
                      onClick={() => transferMutation.mutate(ch.id)}
                    >
                      <span className="font-medium">{ch.name}</span>
                      {ch.displayPhone && (
                        <span className="text-xs text-slate-400">
                          {ch.displayPhone}
                        </span>
                      )}
                    </button>
                  ))}
                {channels.filter((ch) => ch.id !== client.channelId).length ===
                  0 && (
                  <p className="text-xs text-slate-400 px-2 py-1.5">
                    Nenhum outro canal disponível.
                  </p>
                )}
              </PopoverContent>
            </Popover>
          )}

          {/* Encerrar / reabrir conversa */}
          {client.status === "closed" ? (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 sm:h-7 sm:w-auto sm:px-2.5 sm:gap-1.5 text-xs"
              title="Reabrir conversa"
              disabled={reopenConversationMutation.isPending}
              onClick={() => reopenConversationMutation.mutate()}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Reabrir</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 sm:h-7 sm:w-auto sm:px-2.5 sm:gap-1.5 text-xs"
              title="Encerrar conversa"
              onClick={() => setCloseConfirmOpen(true)}
            >
              <Lock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Encerrar</span>
            </Button>
          )}
        </div>

        {/* Linha secundária: canal select em mobile */}
        {showChannelSelect && (
          <div className="sm:hidden px-2 pb-2 flex items-center gap-2">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
              Canal:
            </span>
            <div className="flex-1 min-w-0">
              <ChannelSelect />
            </div>
          </div>
        )}
      </div>

      {/* Banner de nota interna fixada */}
      {latestNote && !notesBannerDismissed && (
        <div className="relative px-3 sm:px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/50 shrink-0">
          <button
            onClick={() => setNotesBannerDismissed(true)}
            className="absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center text-amber-500/70 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            title="Ocultar nota"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-1.5 pr-6">
            <StickyNote className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Nota interna
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 pr-6">
            <p className="text-xs text-amber-700/80 dark:text-amber-300/80 truncate flex-1 min-w-0">
              {latestNote.content}
            </p>
            <button
              onClick={() => setNotesListOpen(true)}
              className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 underline underline-offset-2"
            >
              Ver mais
            </button>
            {conversationNotes.length > 1 && (
              <span className="shrink-0 flex items-center gap-1 text-[11px] text-amber-600/70 dark:text-amber-500/70">
                <StickyNote className="h-3 w-3" />({conversationNotes.length})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Banner de contato desconhecido */}
      {isUnknownContact && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/50 shrink-0">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400 flex-1 leading-tight">
            <span className="hidden sm:inline">
              Contato desconhecido — crie um cliente para registrar esta
              conversa.
            </span>
            <span className="sm:hidden">Contato desconhecido.</span>
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 shrink-0 whitespace-nowrap"
            onClick={() => setCreateClientOpen(true)}
          >
            Criar cliente
          </Button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 space-y-1 bg-slate-50 dark:bg-slate-950/30">
        {isLoading ? (
          <div className="space-y-4 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  i % 2 === 0 ? "justify-end" : "justify-start",
                )}
              >
                <Skeleton
                  className={cn(
                    "h-14 rounded-2xl",
                    i % 2 === 0 ? "w-2/5" : "w-3/5",
                  )}
                />
              </div>
            ))}
          </div>
        ) : messages.length === 0 && localMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm border border-slate-200 dark:border-slate-700/50 mb-4">
              <MessageSquare className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            </div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nenhuma mensagem ainda
            </h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[200px]">
              Envie a primeira mensagem para iniciar a conversa.
            </p>
          </div>
        ) : (
          <>
            {grouped.map(({ date, msgs }) => (
              <div key={date} className="space-y-1.5">
                <div className="flex items-center gap-3 py-2">
                  <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50">
                    {formatSectionDate(msgs[0].sentAt ?? msgs[0].createdAt)}
                  </span>
                  <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
                </div>

                {msgs.map((msg, msgIndex) => {
                  const isOutbound = msg.direction === "outbound";
                  const isFailed = isOutbound && msg.status === "failed";
                  const isRetrying = retryingIds.has(msg.id);
                  const isMedia =
                    msg.type === "image" ||
                    msg.type === "video" ||
                    msg.type === "sticker";
                  const time = format(
                    toSP(msg.sentAt ?? msg.createdAt),
                    "HH:mm",
                  );
                  // Canal por mensagem (não mais por conversa) — deixa claro
                  // por qual número cada resposta saiu numa conversa unificada.
                  const channelName = msg.channelName ?? "";
                  const prevMsg = msgIndex > 0 ? msgs[msgIndex - 1] : null;
                  const showChannelBadge =
                    isOutbound &&
                    !isFailed &&
                    msg.type !== "system" &&
                    msg.type !== "note" &&
                    channelName.length > 0 &&
                    (!prevMsg ||
                      prevMsg.direction !== "outbound" ||
                      prevMsg.channelId !== msg.channelId);

                  // Mensagens de sistema (ex: bot iniciado) — banner centralizado
                  if (msg.type === "system") {
                    return (
                      <div key={msg.id} className="flex justify-center py-1">
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 italic bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                          {msg.content}
                        </span>
                      </div>
                    );
                  }

                  // Nota interna — visível apenas para atendentes
                  if (msg.type === "note") {
                    return (
                      <div key={msg.id} className="flex justify-center py-1">
                        <div className="max-w-[80%] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-900/20">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <StickyNote className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                              Nota interna
                            </span>
                            <span className="text-[10px] text-amber-600/70 dark:text-amber-500/70">
                              {time}
                            </span>
                          </div>
                          <p className="text-xs text-amber-900 dark:text-amber-100 whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "group flex w-full items-end gap-2",
                        isOutbound ? "justify-end" : "justify-start",
                      )}
                    >
                      {/* Badge do canal — primeiro outbound de cada sequência */}
                      {showChannelBadge && (
                        <div className="shrink-0 flex flex-col items-center gap-1 self-end">
                          <div
                            title={`Canal: ${channelName}`}
                            className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center shadow-sm"
                          >
                            <span className="text-[11px] font-bold text-white uppercase leading-none text-center">
                              {channelName
                                .split(" ")
                                .slice(0, 2)
                                .map((w) => w[0])
                                .join("")
                                .toUpperCase()}
                            </span>
                          </div>
                          <span className="text-[9px] font-semibold text-green-600 dark:text-green-500 text-center leading-tight w-14 break-words">
                            {channelName}
                          </span>
                        </div>
                      )}

                      {/* Botão de reenvio à esquerda da bolha (só para falhas) */}
                      {isFailed && (
                        <button
                          onClick={() => handleRetry(msg.id)}
                          disabled={isRetrying}
                          className="shrink-0 mb-1 flex items-center gap-1 text-[11px] text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors disabled:opacity-50"
                        >
                          {isRetrying ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          <span className="whitespace-nowrap">
                            {isRetrying ? "Reenviando…" : "Reenviar"}
                          </span>
                        </button>
                      )}

                      {/* Botões hover: reply + reação + salvar figurinha */}
                      {!isFailed && (
                        <div
                          className={cn(
                            "shrink-0 mb-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                            isOutbound ? "order-first" : "order-last",
                          )}
                        >
                          <button
                            onClick={() => setReplyingTo(msg)}
                            className={cn(
                              "h-7 w-7 rounded-full flex items-center justify-center",
                              "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600",
                              "text-slate-500 dark:text-slate-400",
                            )}
                            title="Responder"
                          >
                            <Reply className="h-3.5 w-3.5" />
                          </button>
                          {msg.type === "sticker" && msg.media?.id && (
                            <button
                              onClick={() => handleSaveSticker(msg.media!.id)}
                              disabled={savingStickers.has(msg.media!.id)}
                              className={cn(
                                "h-7 w-7 rounded-full flex items-center justify-center",
                                "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600",
                                "text-slate-500 dark:text-slate-400 disabled:opacity-50",
                              )}
                              title="Salvar figurinha"
                            >
                              {savingStickers.has(msg.media!.id) ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Bookmark className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                          <Popover
                            open={reactingToId === msg.id}
                            onOpenChange={(o) =>
                              setReactingToId(o ? msg.id : null)
                            }
                          >
                            <PopoverTrigger asChild>
                              <button
                                className={cn(
                                  "h-7 w-7 rounded-full flex items-center justify-center",
                                  "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600",
                                  "text-slate-500 dark:text-slate-400",
                                )}
                                title="Reagir"
                              >
                                <Smile className="h-3.5 w-3.5" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              side="top"
                              className="w-auto p-1.5"
                              align={isOutbound ? "start" : "end"}
                            >
                              <div className="flex gap-1">
                                {REACTION_EMOJIS.map((e) => {
                                  const currentOutbound = msg.reactions?.find(
                                    (r) => r.direction === "outbound",
                                  )?.emoji;
                                  const isActive = currentOutbound === e;
                                  return (
                                    <button
                                      key={e}
                                      onClick={() =>
                                        handleReact(msg.id, isActive ? "" : e)
                                      }
                                      className={cn(
                                        "text-xl p-1 rounded-lg transition-colors",
                                        isActive
                                          ? "bg-primary/20 ring-1 ring-primary"
                                          : "hover:bg-slate-100 dark:hover:bg-slate-800",
                                      )}
                                    >
                                      {e}
                                    </button>
                                  );
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}

                      {/* Bolha + reações */}
                      <div className="flex flex-col gap-1 max-w-[85%] sm:max-w-[72%] lg:max-w-[65%] min-w-0">
                        <div
                          className={cn(
                            "rounded-2xl shadow-sm overflow-hidden w-full",
                            isMedia ? "p-0" : "px-3.5 py-2.5",
                            isFailed
                              ? "bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-200 rounded-tr-[4px]"
                              : isOutbound
                                ? "bg-primary text-primary-foreground rounded-tr-[4px]"
                                : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 rounded-tl-[4px]",
                          )}
                        >
                          {/* Citação da mensagem respondida */}
                          {msg.replyToContent !== null &&
                          msg.replyToContent !== undefined ? (
                            <div
                              className={cn(
                                "rounded-lg px-2.5 py-1.5 mb-2 border-l-[3px]",
                                isMedia ? "mx-3.5 mt-2.5" : "",
                                isOutbound
                                  ? "bg-primary-foreground/10 border-primary-foreground/50"
                                  : "bg-slate-100 dark:bg-slate-700/50 border-slate-400 dark:border-slate-500",
                              )}
                            >
                              <p
                                className={cn(
                                  "text-[11px] font-semibold mb-0.5",
                                  isOutbound
                                    ? "text-primary-foreground/80"
                                    : "text-slate-600 dark:text-slate-300",
                                )}
                              >
                                {msg.replyToDirection === "outbound"
                                  ? "Você"
                                  : (client.clientName ?? client.phone)}
                              </p>
                              <p
                                className={cn(
                                  "text-xs truncate",
                                  isOutbound
                                    ? "text-primary-foreground/70"
                                    : "text-slate-500 dark:text-slate-400",
                                )}
                              >
                                {replySnippet(
                                  msg.replyToContent,
                                  msg.replyToType,
                                )}
                              </p>
                            </div>
                          ) : msg.replyToMessageId ? (
                            <div
                              className={cn(
                                "rounded-lg px-2.5 py-1.5 mb-2 border-l-[3px]",
                                isMedia ? "mx-3.5 mt-2.5" : "",
                                isOutbound
                                  ? "bg-primary-foreground/10 border-primary-foreground/50"
                                  : "bg-slate-100 dark:bg-slate-700/50 border-slate-400 dark:border-slate-500",
                              )}
                            >
                              <p
                                className={cn(
                                  "text-xs italic",
                                  isOutbound
                                    ? "text-primary-foreground/60"
                                    : "text-slate-400 dark:text-slate-500",
                                )}
                              >
                                Mensagem não disponível
                              </p>
                            </div>
                          ) : null}

                          {msg.campaignMessageId && (
                            <div className="text-[10px] font-medium mb-1 opacity-70 flex items-center gap-0.5">
                              <span>📢</span>
                              <span>Campanha</span>
                            </div>
                          )}
                          <MessageContent msg={msg} isOutbound={isOutbound} />
                          <div
                            className={cn(
                              "flex items-center gap-1 mt-1",
                              isMedia ? "px-3 pb-2 justify-end" : "justify-end",
                            )}
                          >
                            <span
                              className={cn(
                                "text-[10px]",
                                isFailed
                                  ? "text-red-400 dark:text-red-500"
                                  : isOutbound
                                    ? "text-primary-foreground/70"
                                    : "text-slate-400 dark:text-slate-500",
                              )}
                            >
                              {time}
                            </span>
                            {isFailed ? (
                              <AlertCircle className="h-3 w-3 text-red-400 dark:text-red-500" />
                            ) : isOutbound ? (
                              <CheckCheck
                                className={cn(
                                  "h-3 w-3",
                                  msg.status === "delivered" ||
                                    msg.status === "read"
                                    ? "text-blue-300"
                                    : "text-primary-foreground/60",
                                )}
                              />
                            ) : null}
                          </div>
                        </div>
                        {/* Pills de reação */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div
                            className={cn(
                              "flex gap-1 flex-wrap",
                              isOutbound ? "justify-end" : "justify-start",
                            )}
                          >
                            {msg.reactions.map((r) => (
                              <button
                                key={r.direction}
                                onClick={() =>
                                  r.direction === "outbound"
                                    ? handleReact(msg.id, "")
                                    : undefined
                                }
                                title={
                                  r.direction === "outbound"
                                    ? "Clique para remover sua reação"
                                    : "Reação do contato"
                                }
                                className={cn(
                                  "text-sm px-2 py-0.5 rounded-full border transition-colors",
                                  r.direction === "outbound"
                                    ? "bg-primary/10 border-primary/30 hover:bg-primary/20 cursor-pointer"
                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-default",
                                )}
                              >
                                {r.emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Mensagens locais em trânsito (pending) */}
            {localMessages.map((lm) =>
              lm.isNote ? (
                <div key={lm.localId} className="flex justify-center py-1">
                  <div className="max-w-[80%] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-900/20">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <StickyNote className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                        Nota interna
                      </span>
                      <span className="text-[10px] text-amber-600/70 dark:text-amber-500/70">
                        {format(toSP(lm.createdAt), "HH:mm")}
                      </span>
                      <Loader2 className="h-3 w-3 text-amber-500 animate-spin" />
                    </div>
                    <p className="text-xs text-amber-900 dark:text-amber-100 whitespace-pre-wrap">
                      {lm.content}
                    </p>
                  </div>
                </div>
              ) : lm.media ? (
                <div key={lm.localId} className="flex w-full justify-end">
                  <div className="max-w-[82%] sm:max-w-[70%] rounded-2xl shadow-sm overflow-hidden rounded-tr-[4px] bg-primary/60 text-primary-foreground">
                    {lm.media.kind === "image" && (
                      <img
                        src={lm.media.url}
                        alt={lm.content || "imagem"}
                        className="max-w-full object-cover"
                        style={{ maxHeight: 300 }}
                      />
                    )}
                    {lm.media.kind === "video" && (
                      <video
                        src={lm.media.url}
                        muted
                        className="max-w-full"
                        style={{ maxHeight: 300 }}
                      />
                    )}
                    {lm.media.kind === "sticker" && (
                      <div className="p-1.5">
                        <img
                          src={lm.media.url}
                          alt="figurinha"
                          className="object-contain"
                          style={{ width: 120, height: 120 }}
                        />
                      </div>
                    )}
                    {lm.media.kind === "document" && (
                      <div className="flex items-center gap-2 px-3.5 py-2.5">
                        <FileText className="h-5 w-5 shrink-0 opacity-70" />
                        <span className="text-sm truncate flex-1">
                          {lm.media.fileName}
                        </span>
                      </div>
                    )}
                    {lm.content && lm.media.kind !== "document" && (
                      <p className="text-sm px-3.5 pt-1 pb-0.5 whitespace-pre-wrap break-words">
                        {lm.content}
                      </p>
                    )}
                    <div className="flex items-center justify-end gap-1 px-3 pb-2 pt-1">
                      <span className="text-[10px] text-primary-foreground/70">
                        {format(toSP(lm.createdAt), "HH:mm")}
                      </span>
                      <Loader2 className="h-3 w-3 text-primary-foreground/60 animate-spin" />
                    </div>
                  </div>
                </div>
              ) : (
                <div key={lm.localId} className="flex w-full justify-end">
                  <div className="max-w-[82%] sm:max-w-[70%] rounded-2xl shadow-sm px-3.5 py-2.5 rounded-tr-[4px] bg-primary/60 text-primary-foreground">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
                      {lm.content}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] text-primary-foreground/70">
                        {format(toSP(lm.createdAt), "HH:mm")}
                      </span>
                      <Loader2 className="h-3 w-3 text-primary-foreground/60 animate-spin" />
                    </div>
                  </div>
                </div>
              ),
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        {!canSendMessages && composerMode === "message" ? (
          /* Sem canal selecionado ou canal desconectado: bloqueia envio/bots */
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center bg-amber-100 dark:bg-amber-900/30">
              <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {selectedChannelId == null
                  ? "Nenhum canal selecionado"
                  : `Canal "${activeChannel?.name ?? "selecionado"}" desconectado`}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedChannelId == null
                  ? "Selecione um canal conectado para enviar mensagens ou disparar bots."
                  : "Reconecte o canal para voltar a enviar mensagens ou disparar bots."}
              </p>
            </div>
          </div>
        ) : (
        <>
        {/* Toggle Mensagem / Notas */}
        <div className="flex items-center justify-end px-3 sm:px-4 pt-2">
          <div className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-0.5">
            <button
              onClick={() => setComposerMode("message")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors",
                composerMode === "message"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Mensagem
            </button>
            <button
              onClick={() => setComposerMode("note")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors",
                composerMode === "note"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
              )}
            >
              <StickyNote className="h-3.5 w-3.5" />
              Notas
            </button>
          </div>
        </div>

        {/* Preview da mensagem sendo respondida */}
        {replyingTo && composerMode === "message" && (
          <div className="flex items-start gap-2 px-3 sm:px-4 pt-2.5 pb-1">
            <div className="flex-1 border-l-[3px] border-primary pl-2.5 py-0.5 min-w-0">
              <p className="text-[11px] font-semibold text-primary mb-0.5">
                {replyingTo.direction === "outbound"
                  ? "Você"
                  : (client.clientName ?? client.phone)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {replySnippet(replyingTo.content, replyingTo.type)}
              </p>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {pendingAudio ? (
          <div className="px-3 py-2.5 flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Mic className="h-4 w-4 text-green-500 shrink-0" />
              <audio
                src={pendingAudio.url}
                controls
                className="flex-1 h-9 min-w-0"
                style={{ maxWidth: "100%" }}
              />
            </div>
            <button
              onClick={() => {
                URL.revokeObjectURL(pendingAudio.url);
                setPendingAudio(null);
              }}
              className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors bg-slate-100 dark:bg-slate-800"
              title="Descartar áudio"
            >
              <X className="h-4 w-4" />
            </button>
            <Button
              onClick={() => {
                sendMedia(pendingAudio.file);
                URL.revokeObjectURL(pendingAudio.url);
                setPendingAudio(null);
              }}
              disabled={isUploading}
              size="icon"
              className="shrink-0 h-10 w-10 bg-green-500 hover:bg-green-600"
              title="Enviar áudio"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
          </div>
        ) : isRecording ? (
          <div className="px-3 py-2.5 flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-sm font-medium text-red-500 tabular-nums shrink-0">
                {Math.floor(recordingSeconds / 60)
                  .toString()
                  .padStart(2, "0")}
                :{(recordingSeconds % 60).toString().padStart(2, "0")}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 truncate">
                Gravando…
              </span>
            </div>
            <button
              onClick={cancelRecording}
              className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-slate-100 dark:bg-slate-800"
              title="Cancelar gravação"
            >
              <X className="h-4 w-4" />
            </button>
            <Button
              onClick={stopRecording}
              size="icon"
              className="shrink-0 h-10 w-10 bg-red-500 hover:bg-red-600"
              title="Parar gravação"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          </div>
        ) : (
          <div className="px-2 sm:px-3 pt-2 pb-1.5">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,video/mp4,video/3gpp,audio/mpeg,audio/ogg,audio/aac,audio/mp4,application/pdf,.docx,.xlsx,.xls,.csv,.pptx,text/plain"
              onChange={handleFileChange}
            />
            <input
              ref={stickerInputRef}
              type="file"
              className="hidden"
              accept="image/webp"
              onChange={handleStickerChange}
            />

            {/* Aviso da janela de 24h fechada (somente canal oficial) */}
            {windowClosed && composerMode === "message" && (
              <div className="flex items-start gap-2 px-2.5 py-2 mb-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug">
                  A janela de 24h desta conversa foi encerrada. Para falar com o
                  contato, envie um{" "}
                  <button
                    onClick={() => setTemplatePickerOpen(true)}
                    className="font-semibold underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-300"
                  >
                    template aprovado
                  </button>
                  .
                </p>
              </div>
            )}

            {/* Textarea + botão enviar */}
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  composerMode === "note"
                    ? "Digite uma nota que só os atendentes podem ver…"
                    : "Digite uma mensagem…"
                }
                className={cn(
                  "flex-1 resize-none min-h-[52px] sm:min-h-[80px] max-h-[160px] text-sm leading-relaxed",
                  composerMode === "note" &&
                    "border-amber-300 focus-visible:ring-amber-400 dark:border-amber-800",
                )}
                rows={2}
                disabled={isUploading || pendingMedia != null}
              />
              {message.trim() ? (
                <Button
                  onClick={handleSend}
                  disabled={
                    isUploading ||
                    (windowClosed && composerMode === "message") ||
                    pendingMedia != null
                  }
                  size="icon"
                  className={cn(
                    "shrink-0 h-10 w-10 mb-0.5 rounded-full",
                    composerMode === "note" && "bg-amber-500 hover:bg-amber-600",
                  )}
                >
                  <Send className="h-4 w-4" />
                </Button>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={
                    isUploading ||
                    windowClosed ||
                    composerMode === "note" ||
                    pendingMedia != null
                  }
                  className="shrink-0 h-10 w-10 mb-0.5 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  title="Gravar áudio"
                >
                  <Mic className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Toolbar inferior: anexo, figurinha, emoji + dica */}
            <div className="flex items-center gap-0.5 mt-1">
              {composerMode === "message" && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || windowClosed || pendingMedia != null}
                    className="h-9 w-9 rounded-full flex items-center justify-center text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
                    title="Enviar arquivo"
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Paperclip className="h-4 w-4" />
                    )}
                  </button>
                  <Popover
                    open={stickerPickerOpen}
                    onOpenChange={setStickerPickerOpen}
                  >
                    <PopoverTrigger asChild>
                      <button
                        disabled={isUploading || windowClosed || pendingMedia != null}
                        className="h-9 w-9 rounded-full flex items-center justify-center text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
                        title="Figurinhas"
                      >
                        <Sticker className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="start" className="p-0 w-auto">
                      <StickerPicker
                        onPickFromDevice={() => {
                          setStickerPickerOpen(false);
                          stickerInputRef.current?.click();
                        }}
                        onPickSaved={sendSavedSticker}
                      />
                    </PopoverContent>
                  </Popover>
                </>
              )}
              <Popover
                open={emojiOpen}
                onOpenChange={(o) => {
                  if (o)
                    cursorPosRef.current =
                      textareaRef.current?.selectionStart ?? message.length;
                  setEmojiOpen(o);
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    className="h-9 w-9 rounded-full flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
                    title="Emoji"
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="start"
                  className="p-0 w-auto max-w-[calc(100vw-1rem)]"
                >
                  <EmojiPicker
                    onPick={(e) => {
                      const pos = cursorPosRef.current;
                      setMessage(
                        (prev) => prev.slice(0, pos) + e + prev.slice(pos),
                      );
                      cursorPosRef.current = pos + e.length;
                      setEmojiOpen(false);
                      setTimeout(() => {
                        const ta = textareaRef.current;
                        if (ta) {
                          ta.focus();
                          ta.setSelectionRange(
                            cursorPosRef.current,
                            cursorPosRef.current,
                          );
                        }
                      }, 0);
                    }}
                  />
                </PopoverContent>
              </Popover>
              <Popover open={quickReplyOpen} onOpenChange={setQuickReplyOpen}>
                <PopoverTrigger asChild>
                  <button
                    disabled={isUploading || windowClosed}
                    className="h-9 w-9 rounded-full flex items-center justify-center text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
                    title="Respostas rápidas"
                  >
                    <Zap className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="p-0 w-auto">
                  <QuickReplyPicker
                    onPick={(content) => {
                      setMessage((prev) =>
                        prev ? prev + "\n" + content : content,
                      );
                      setQuickReplyOpen(false);
                      setTimeout(() => textareaRef.current?.focus(), 0);
                    }}
                  />
                </PopoverContent>
              </Popover>
              {composerMode === "message" && isCloudApi && (
                <Popover
                  open={templatePickerOpen}
                  onOpenChange={setTemplatePickerOpen}
                >
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "h-9 w-9 rounded-full flex items-center justify-center transition-colors",
                        windowClosed
                          ? "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                          : "text-slate-400 hover:text-primary",
                      )}
                      title="Enviar template"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="p-0 w-auto">
                    <TemplatePicker
                      clientId={client.clientId}
                      onSend={(data) => {
                        setTemplatePickerOpen(false);
                        sendTemplate(data);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              )}
              {composerMode === "message" && shortcutBots.length > 0 && (
                <>
                  <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />
                  <TooltipProvider delayDuration={300}>
                    {shortcutBots.map((bot) => {
                      const ShortcutIcon = BOT_SHORTCUT_ICONS[bot.icon] ?? Bot;
                      return (
                        <Tooltip key={bot.id}>
                          <TooltipTrigger asChild>
                            <button
                              disabled={triggeringBotId !== null}
                              onClick={() => handleTriggerBot(bot.id)}
                              className="h-9 w-9 rounded-full flex items-center justify-center text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
                            >
                              {triggeringBotId === bot.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ShortcutIcon className="h-4 w-4" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs">{bot.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </TooltipProvider>
                </>
              )}
              {composerMode === "message" && activeBots.length > 0 && (
                <Popover open={botPickerOpen} onOpenChange={setBotPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      disabled={triggeringBotId !== null}
                      className="h-9 w-9 rounded-full flex items-center justify-center text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
                      title="Disparar bot"
                    >
                      {triggeringBotId !== null ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="p-0 w-56">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                      <Bot className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Disparar bot
                      </span>
                    </div>
                    <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
                      {activeBots.map((bot) => (
                        <button
                          key={bot.id}
                          className="flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                          onClick={() => handleTriggerBot(bot.id)}
                        >
                          <Bot className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-xs text-slate-700 dark:text-slate-200 truncate">
                            {bot.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <p className="text-[10px] text-slate-400 dark:text-slate-600 ml-auto hidden sm:block">
                {composerMode === "note"
                  ? "Visível apenas para atendentes"
                  : "Enter para enviar · Shift+Enter para nova linha"}
              </p>
            </div>
          </div>
        )}
        </>
        )}
      </div>

      <Dialog
        open={pendingMedia != null}
        onOpenChange={(open) => {
          if (!open) cancelPendingMedia();
        }}
      >
        <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {pendingMedia?.kind === "image" && "Enviar imagem"}
              {pendingMedia?.kind === "video" && "Enviar vídeo"}
              {pendingMedia?.kind === "document" && "Enviar arquivo"}
              {pendingMedia?.kind === "sticker" && "Enviar figurinha"}
            </DialogTitle>
          </DialogHeader>

          {pendingMedia?.kind === "image" && (
            <img
              src={pendingMedia.url}
              alt="Prévia"
              className="max-h-[70vh] w-full object-contain rounded-lg bg-black/5"
            />
          )}
          {pendingMedia?.kind === "video" && (
            <video
              src={pendingMedia.url}
              controls
              className="max-h-[70vh] w-full rounded-lg bg-black/5"
            />
          )}
          {pendingMedia?.kind === "document" && (
            <div className="flex flex-col gap-3">
              {classifyDocumentPreview(pendingMedia.file) === "pdf" && (
                <iframe
                  src={pendingMedia.url}
                  title="Prévia do PDF"
                  className="w-full h-[65vh] rounded-lg border border-slate-200 dark:border-slate-700"
                />
              )}

              {classifyDocumentPreview(pendingMedia.file) === "spreadsheet" && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 max-h-[65vh] overflow-auto">
                  {spreadsheetPreviewLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                  ) : spreadsheetPreview && spreadsheetPreview.rows.length > 0 ? (
                    <>
                      <table className="text-xs w-full border-collapse">
                        <tbody>
                          {spreadsheetPreview.rows.map((row, i) => (
                            <tr
                              key={i}
                              className={
                                i === 0
                                  ? "bg-slate-50 dark:bg-slate-800 font-semibold"
                                  : ""
                              }
                            >
                              {row.map((cell, j) => (
                                <td
                                  key={j}
                                  className="border border-slate-200 dark:border-slate-700 px-2 py-1 whitespace-nowrap"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {spreadsheetPreview.truncated && (
                        <p className="text-[10px] text-slate-400 text-center py-1 border-t border-slate-100 dark:border-slate-800">
                          Mostrando as primeiras {spreadsheetPreview.rows.length} linhas
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-6">
                      Não foi possível gerar a prévia da planilha
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <FileText className="h-8 w-8 text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words">
                    {pendingMedia.file.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {(pendingMedia.file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
            </div>
          )}
          {pendingMedia?.kind === "sticker" && (
            <img
              src={pendingMedia.url}
              alt="Prévia da figurinha"
              className="h-32 w-32 object-contain mx-auto"
            />
          )}

          {pendingMedia && pendingMedia.kind !== "sticker" && (
            <Input
              placeholder="Adicionar legenda (opcional)"
              value={pendingMediaCaption}
              onChange={(e) => setPendingMediaCaption(e.target.value)}
              disabled={isUploading}
            />
          )}

          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="outline"
              onClick={cancelPendingMedia}
              disabled={isUploading}
            >
              Cancelar
            </Button>
            <Button onClick={confirmPendingMedia} disabled={isUploading}>
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1.5" />
                  Enviar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CreateClientFromConversationDialog
        open={createClientOpen}
        onOpenChange={setCreateClientOpen}
        client={client}
        userRole={userRole}
        onSuccess={onClientLinked}
      />

      <ContactDetailsSheet
        client={client}
        open={contactDetailsOpen}
        onOpenChange={setContactDetailsOpen}
      />

      <Dialog open={notesListOpen} onOpenChange={setNotesListOpen}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] sm:w-full max-h-[80dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-500" />
              Notas internas
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
            {conversationNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma nota registrada nesta conversa.
              </p>
            ) : (
              <div className="flex flex-col gap-2 py-1">
                {conversationNotes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-900/20"
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                        {note.authorName ?? "Atendente"}
                      </span>
                      <span className="text-[10px] text-amber-600/70 dark:text-amber-500/70 shrink-0">
                        {format(toSP(note.createdAt), "dd/MM/yyyy HH:mm")}
                      </span>
                    </div>
                    <p className="text-xs text-amber-900 dark:text-amber-100 whitespace-pre-wrap">
                      {note.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              A conversa sairá da lista de conversas abertas. Ela reabre
              automaticamente se o cliente (ou você) enviar uma nova
              mensagem, ou pode ser reaberta manualmente na aba "Encerradas".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={closeConversationMutation.isPending}
              onClick={() => closeConversationMutation.mutate()}
            >
              Encerrar conversa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface CrmTag {
  id: string;
  name: string;
  color: string | null;
  type: string;
}

function NewConversationDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (clientId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const debouncedSearch = useDebounce(search, 300);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: availableTags = [] } = useQuery<WhatsappClientTag[]>({
    queryKey: ["/api/whatsapp/tags"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/tags");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["/api/clients", "wa-new-conv", debouncedSearch, selectedTagIds],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "20" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      for (const id of selectedTagIds) params.append("whatsappTagIds", id);
      const res = await fetch(`/api/clients?${params}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json?.data ?? json) as Array<{
        id: string;
        name: string;
        phone: string | null;
        crmTags?: CrmTag[];
        tags?: WhatsappClientTag[];
      }>;
    },
    enabled: open,
  });

  const clientResults = Array.isArray(data) ? data : [];

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  const startMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const res = await fetch("/api/whatsapp/conversations/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Erro ao iniciar conversa");
      }
      return res.json() as Promise<{ clientId: string }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/whatsapp/conversations-list"],
      });
      onOpenChange(false);
      onSelect(result.clientId);
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:w-full p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente…"
            className="pl-9 text-sm h-10"
            autoFocus
          />
        </div>

        {availableTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
            {availableTags.map((tag) => {
              const active = selectedTagIds.includes(tag.id);
              const bg = resolveTagColor(tag.color, tag.id);
              const emoji = resolveTagEmoji(tag.emoji);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors",
                    active
                      ? "text-white"
                      : "bg-transparent text-slate-600 dark:text-slate-400 hover:opacity-80",
                  )}
                  style={
                    active
                      ? { backgroundColor: bg, borderColor: bg }
                      : { borderColor: bg, color: bg }
                  }
                >
                  {emoji && <span>{emoji}</span>}
                  {tag.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="max-h-[50vh] sm:max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : clientResults.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {debouncedSearch || selectedTagIds.length > 0
                  ? "Nenhum cliente encontrado"
                  : "Digite para buscar ou filtre por tag"}
              </p>
            </div>
          ) : (
            clientResults.map((c) => (
              <button
                key={c.id}
                disabled={startMutation.isPending}
                onClick={() => startMutation.mutate(c.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-left disabled:opacity-50"
              >
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {getInitials(c.name, c.phone ?? "")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                    {c.name}
                  </p>
                  {c.phone && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <Phone className="h-3 w-3 shrink-0" />
                      {c.phone}
                    </p>
                  )}
                  {((c.crmTags && c.crmTags.length > 0) ||
                    (c.tags && c.tags.length > 0)) && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.crmTags?.map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                        >
                          {tag.name}
                        </span>
                      ))}
                      {c.tags?.map((tag) => (
                        <WhatsappTagBadge key={tag.id} tag={tag} />
                      ))}
                    </div>
                  )}
                </div>
                {startMutation.isPending &&
                  startMutation.variables === c.id && (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />
                  )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function WhatsAppConversationsPage() {
  const { user } = useAuth();
  // Deep-link vindo de outras telas (ex.: detalhes de campanha), abre direto
  // a conversa daquele telefone: /whatsapp/conversas?phone=5511999999999
  // Normaliza para só dígitos — o telefone salvo em whatsapp_conversations
  // também é só dígitos (normalizePhone), e o "+" vindo de outras telas
  // (ex.: formatPhoneToDigits) quebraria o ILIKE no backend.
  const rawPhoneParam = new URLSearchParams(useSearch()).get("phone");
  const phoneParam = rawPhoneParam ? rawPhoneParam.replace(/\D/g, "") : null;
  const autoSelectedPhoneRef = useRef(false);
  // selectedId holds either a clientId or a conversationId (for unknown contacts)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState(phoneParam ?? "");
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"open" | "closed">("open");
  const debouncedSearch = useDebounce(search, 300);
  const queryClient = useQueryClient();

  const isAdminOrGerente = user?.role === "admin" || user?.role === "gerente";

  const setTagsMutation = useMutation({
    mutationFn: async ({
      clientId,
      tagIds,
    }: {
      clientId: string;
      tagIds: string[];
    }) => {
      const res = await fetch(
        `/api/whatsapp/conversations/${clientId}/whatsapp-tags`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagIds }),
        },
      );
      if (!res.ok) throw new Error("Erro ao atualizar etiquetas");
    },
    onMutate: ({ clientId, tagIds }) => {
      queryClient.setQueriesData<{
        pages: { items: ChatClient[]; nextCursor: string | null }[];
        pageParams: unknown[];
      }>({ queryKey: ["/api/whatsapp/conversations-list"] }, (prev) => {
        if (!prev) return prev;
        const newTags = availableWaTags.filter((t) => tagIds.includes(t.id));
        return {
          ...prev,
          pages: prev.pages.map((page) => ({
            ...page,
            items: page.items.map((c) =>
              c.clientId === clientId ? { ...c, whatsappTags: newTags } : c,
            ),
          })),
        };
      });
    },
    onError: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/whatsapp/conversations-list"],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/whatsapp/conversations-list"],
      });
    },
  });

  const { data: availableWaTags = [] } = useQuery<WhatsappClientTag[]>({
    queryKey: ["/api/whatsapp/tags"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/tags");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: availableChannels = [] } = useQuery<Channel[]>({
    queryKey: ["/api/whatsapp/channels/mine"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/channels/mine");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30_000,
  });

  interface ConversationsListPage {
    items: ChatClient[];
    nextCursor: string | null;
  }

  const conversationsListQueryKey = [
    "/api/whatsapp/conversations-list",
    debouncedSearch,
    selectedTagIds,
    statusFilter,
    user?.id,
  ];

  async function fetchConversationsListPage(
    cursor: string | null,
  ): Promise<ConversationsListPage> {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    for (const id of selectedTagIds) params.append("tagIds", id);
    // Com busca ativa, ignora a aba Abertas/Encerradas — busca em todas.
    if (!debouncedSearch) params.set("status", statusFilter);
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`/api/whatsapp/conversations?${params}`);
    if (!res.ok) return { items: [], nextCursor: null };
    return res.json();
  }

  const {
    data: clientListData,
    isLoading: isLoadingClients,
    fetchNextPage: fetchNextClientsPage,
    hasNextPage: hasNextClientsPage,
    isFetchingNextPage: isFetchingNextClientsPage,
    isFetchNextPageError: isClientsNextPageError,
  } = useInfiniteQuery({
    queryKey: conversationsListQueryKey,
    queryFn: ({ pageParam }) => fetchConversationsListPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const clientList = clientListData?.pages.flatMap((p) => p.items) ?? [];

  // Refs para o polling e o SSE global (não devem reabrir a conexão SSE nem
  // recriar o efeito a cada troca de busca/tag — só precisam ler o valor
  // mais recente no momento em que disparam).
  const fetchConversationsListPageRef = useRef(fetchConversationsListPage);
  fetchConversationsListPageRef.current = fetchConversationsListPage;
  const conversationsListQueryKeyRef = useRef(conversationsListQueryKey);
  conversationsListQueryKeyRef.current = conversationsListQueryKey;

  // Reforço periódico: re-busca só a página mais recente, sem tocar nas
  // páginas antigas já carregadas via scroll.
  useEffect(() => {
    const interval = setInterval(() => {
      refreshFirstPage(queryClient, conversationsListQueryKey, () =>
        fetchConversationsListPage(null),
      );
    }, 15_000);
    return () => clearInterval(interval);
  }, [queryClient, debouncedSearch, selectedTagIds, statusFilter, user?.id]);

  // Assim que a busca por telefone (vinda do parâmetro ?phone=) retornar,
  // seleciona automaticamente a conversa correspondente — uma única vez.
  useEffect(() => {
    if (!phoneParam || autoSelectedPhoneRef.current || clientList.length === 0) return;
    const target = phoneParam.replace(/\D/g, "");
    const match = clientList.find((c) => {
      const digits = c.phone?.replace(/\D/g, "") ?? "";
      return digits && (digits.endsWith(target) || target.endsWith(digits));
    });
    if (match) {
      setSelectedId(match.clientId ?? match.conversationId);
      autoSelectedPhoneRef.current = true;
    }
  }, [clientList, phoneParam]);

  const markRead = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/whatsapp/conversations/${id}/read`, {
          method: "POST",
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/whatsapp/conversations-list"],
        });
      } catch {
        // silently ignore
      }
    },
    [queryClient],
  );

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    const es = new EventSource("/api/whatsapp/notifications/stream");
    es.addEventListener("new_whatsapp_inbound", (e) => {
      const data = JSON.parse(e.data) as {
        clientId: string | null;
        conversationId?: string | null;
      };
      refreshFirstPage(queryClient, conversationsListQueryKeyRef.current, () =>
        fetchConversationsListPageRef.current(null),
      );
      const isSelected =
        (data.clientId && data.clientId === selectedIdRef.current) ||
        (data.conversationId && data.conversationId === selectedIdRef.current);
      // Não precisa re-buscar as mensagens aqui: se a conversa está
      // selecionada, o próprio ConversationMessages já tem seu stream SSE por
      // conversa (/conversations/:id/stream) que atualiza a 1ª página.
      if (isSelected) {
        markRead(selectedIdRef.current!);
      }
    });
    return () => es.close();
  }, [queryClient, markRead]);

  const handleSelectConversation = (id: string) => {
    queryClient.invalidateQueries({
      queryKey: ["/api/whatsapp/conversations", id],
    });
    setSelectedId(id);
    markRead(id);
  };

  // After creating a client from an unknown conversation, switch to clientId-based selection
  const handleClientLinked = (clientId: string) => {
    setSelectedId(clientId);
    queryClient.invalidateQueries({
      queryKey: ["/api/whatsapp/conversations", clientId],
    });
    queryClient.invalidateQueries({
      queryKey: ["/api/whatsapp/conversations-list"],
    });
  };

  const handleBack = () => setSelectedId(null);

  const selectedClient =
    selectedId != null
      ? (clientList.find(
          (c) => c.clientId === selectedId || c.conversationId === selectedId,
        ) ?? null)
      : null;

  // Registra a conversa aberta para o hook de notificações globais suprimir
  // toast/som de mensagens desta conversa. Limpa ao desmontar a página.
  useEffect(() => {
    setActiveWaConversation(
      selectedClient
        ? {
            clientId: selectedClient.clientId,
            conversationId: selectedClient.conversationId,
          }
        : null,
    );
    return () => setActiveWaConversation(null);
  }, [selectedClient]);

  const showList = !selectedId;

  const sidebarContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreConversations = useCallback(() => {
    if (!hasNextClientsPage || isFetchingNextClientsPage) return;
    fetchNextClientsPage();
  }, [hasNextClientsPage, isFetchingNextClientsPage, fetchNextClientsPage]);
  const sidebarSentinelRef = useInfiniteScrollSentinel(
    sidebarContainerRef,
    loadMoreConversations,
    hasNextClientsPage === true,
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel — contact list */}
      <div
        className={cn(
          "flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900",
          showList
            ? "flex w-full md:w-72 lg:w-80 md:flex"
            : "hidden md:flex md:w-72 lg:w-80",
        )}
      >
        {/* Search header */}
        <div className="px-3 py-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Conversas
            </h2>
            <div className="flex items-center gap-0.5">
              {availableWaTags.length > 0 && (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8",
                      selectedTagIds.length > 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-slate-500 hover:text-primary",
                    )}
                    onClick={() => {
                      setShowTagFilter((v) => !v);
                      setTagSearch("");
                    }}
                    title="Filtrar por etiqueta"
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
                  {selectedTagIds.length > 0 && (
                    <span className="pointer-events-none absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-500 text-[9px] font-bold text-white flex items-center justify-center">
                      {selectedTagIds.length}
                    </span>
                  )}
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-primary"
                onClick={() => setNewConvOpen(true)}
                title="Nova conversa"
              >
                <PlusCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversa..."
              className="pl-9 text-sm h-10"
            />
          </div>

          {debouncedSearch ? (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 px-0.5">
              Buscando em todas as conversas, inclusive encerradas.
            </p>
          ) : (
            <div className="flex gap-1 mt-2 rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
              <button
                onClick={() => setStatusFilter("open")}
                className={cn(
                  "flex-1 text-xs font-medium py-1.5 rounded-md transition-colors",
                  statusFilter === "open"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                )}
              >
                Abertas
              </button>
              <button
                onClick={() => setStatusFilter("closed")}
                className={cn(
                  "flex-1 text-xs font-medium py-1.5 rounded-md transition-colors",
                  statusFilter === "closed"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                )}
              >
                Encerradas
              </button>
            </div>
          )}
        </div>

        {/* Channel status strip — visible only for vendedores */}
        {!isAdminOrGerente &&
          availableChannels.length > 0 &&
          availableChannels.map((ch) => {
            const isConnected =
              ch.provider === "cloud_api" ||
              ch.connectionStatus === "connected";
            const isConnecting = ch.connectionStatus === "connecting";
            return (
              <div
                key={ch.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 border-b shrink-0",
                  isConnected
                    ? "border-slate-200 dark:border-slate-800 bg-green-50 dark:bg-green-950/20"
                    : "border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20",
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    isConnected
                      ? "bg-green-500"
                      : isConnecting
                        ? "bg-amber-400 animate-pulse"
                        : "bg-red-400",
                  )}
                />
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate flex-1 min-w-0">
                  {ch.displayPhone || ch.name}
                </span>
                {isConnected ? (
                  <span className="text-[11px] text-green-600 dark:text-green-400 shrink-0 flex items-center gap-1">
                    <Wifi className="h-3 w-3" /> Conectado
                  </span>
                ) : (
                  <a
                    href="/whatsapp/configuracoes"
                    className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline shrink-0 flex items-center gap-1"
                  >
                    <WifiOff className="h-3 w-3" />
                    {isConnecting ? "Conectando..." : "Reconectar"}
                  </a>
                )}
              </div>
            );
          })}

        {/* Channel status placeholder when loading — vendedor only */}
        {!isAdminOrGerente && availableChannels.length === 0 && (
          <div className="h-9 border-b border-slate-200 dark:border-slate-800 bg-muted/40 animate-pulse shrink-0" />
        )}

        {/* Client list — relative so the tag panel can overlay it */}
        <div className="flex-1 overflow-y-auto relative" ref={sidebarContainerRef}>
          {/* Tag filter overlay panel */}
          {showTagFilter && (
            <div className="absolute inset-0 z-10 flex flex-col bg-white dark:bg-slate-900">
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Etiquetas
                </h3>
                <button
                  onClick={() => setShowTagFilter(false)}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Tag search */}
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder="Pesquisar"
                    className="pl-9 text-sm h-9"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
                  {tagSearch
                    ? `${availableWaTags.filter((t) => t.name.toLowerCase().includes(tagSearch.toLowerCase())).length} resultado(s)`
                    : "Exibindo todos os itens"}
                </p>
              </div>

              {/* Tag list */}
              <div className="flex-1 overflow-y-auto py-2">
                {/* "Sem etiquetas" option */}
                <div className="px-4 py-1.5">
                  <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                    Sem etiquetas
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedTagIds((prev) =>
                        prev.includes("__none__")
                          ? prev.filter((id) => id !== "__none__")
                          : [...prev, "__none__"],
                      )
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                      selectedTagIds.includes("__none__")
                        ? "bg-slate-700 border-slate-700 text-white dark:bg-slate-200 dark:border-slate-200 dark:text-slate-900"
                        : "bg-slate-100 dark:bg-slate-800 border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700",
                    )}
                  >
                    Sem etiquetas
                  </button>
                </div>

                <div className="h-px bg-slate-100 dark:bg-slate-800 mx-4 my-2" />

                {/* All tags */}
                <div className="px-4 flex flex-col gap-2">
                  {availableWaTags
                    .filter(
                      (t) =>
                        !tagSearch ||
                        t.name.toLowerCase().includes(tagSearch.toLowerCase()),
                    )
                    .map((tag) => {
                      const active = selectedTagIds.includes(tag.id);
                      const tagColor = resolveTagColor(tag.color, tag.id);
                      const tagEmoji = resolveTagEmoji(tag.emoji);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() =>
                            setSelectedTagIds((prev) =>
                              prev.includes(tag.id)
                                ? prev.filter((id) => id !== tag.id)
                                : [...prev, tag.id],
                            )
                          }
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white transition-all self-start max-w-full",
                            active
                              ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900"
                              : "opacity-90 hover:opacity-100",
                          )}
                          style={{ backgroundColor: tagColor }}
                        >
                          {tagEmoji && (
                            <span className="shrink-0 leading-none">
                              {tagEmoji}
                            </span>
                          )}
                          <span className="truncate">{tag.name}</span>
                          {active && (
                            <Check className="h-3 w-3 shrink-0 ml-auto" />
                          )}
                        </button>
                      );
                    })}
                  {availableWaTags.filter(
                    (t) =>
                      !tagSearch ||
                      t.name.toLowerCase().includes(tagSearch.toLowerCase()),
                  ).length === 0 && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                      Nenhuma etiqueta encontrada
                    </p>
                  )}
                </div>
              </div>

              {/* Footer */}
              {selectedTagIds.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedTagIds.length} selecionada(s)
                  </span>
                  <button
                    onClick={() => setSelectedTagIds([])}
                    className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>
          )}

          {isLoadingClients ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : clientList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center h-full">
              <MessageSquare className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Nenhuma conversa
              </p>
              {search || selectedTagIds.length > 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Tente outro nome, número ou filtro
                </p>
              ) : (
                <button
                  onClick={() => setNewConvOpen(true)}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Iniciar nova conversa
                </button>
              )}
            </div>
          ) : (
            clientList.map((client) => (
              <ClientListItem
                key={client.conversationId}
                client={client}
                selected={
                  selectedId != null &&
                  (client.clientId === selectedId ||
                    client.conversationId === selectedId)
                }
                onClick={() =>
                  handleSelectConversation(
                    client.clientId ?? client.conversationId,
                  )
                }
                availableTags={availableWaTags}
                onTagsChange={(clientId, tagIds) =>
                  setTagsMutation.mutate({ clientId, tagIds })
                }
              />
            ))
          )}
          {isClientsNextPageError && (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-red-500">
              Erro ao carregar mais conversas.
              <button
                onClick={() => fetchNextClientsPage()}
                className="font-semibold underline underline-offset-2"
              >
                Tentar novamente
              </button>
            </div>
          )}
          {hasNextClientsPage && <div ref={sidebarSentinelRef} className="h-4" />}
        </div>
      </div>

      {/* Right panel — conversation */}
      <div
        className={cn(
          "flex-1 flex-col overflow-hidden",
          selectedId ? "flex" : "hidden md:flex",
        )}
      >
        {selectedClient ? (
          <ConversationMessages
            key={selectedClient.conversationId}
            conversationKey={
              selectedClient.clientId ?? selectedClient.conversationId
            }
            client={selectedClient}
            onBack={handleBack}
            channels={availableChannels}
            userRole={user?.role ?? "vendedor"}
            onClientLinked={handleClientLinked}
            availableWhatsappTags={availableWaTags}
            onWhatsappTagsChange={(clientId, tagIds) =>
              setTagsMutation.mutate({ clientId, tagIds })
            }
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center shadow-sm border border-slate-200 dark:border-slate-700/50 mb-5">
              <MessageSquare className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">
              Selecione uma conversa
            </h3>
            <p className="text-sm text-slate-400 dark:text-slate-500 max-w-[240px]">
              Escolha um cliente na lista para ver o histórico de mensagens.
            </p>
          </div>
        )}
      </div>

      <NewConversationDialog
        open={newConvOpen}
        onOpenChange={setNewConvOpen}
        onSelect={handleSelectConversation}
      />
    </div>
  );
}
