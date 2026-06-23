import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Channel {
  id: number;
  name: string;
  displayPhone: string | null;
}

interface ChatClientTag {
  id: string;
  name: string;
  color: string | null;
  type: string;
}

interface WhatsappClientTag {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

interface ChatClient {
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
  media: WaMedia | null;
  reactions?: { emoji: string; direction: "inbound" | "outbound" }[];
}

interface LocalMessage {
  localId: string;
  content: string;
  createdAt: string;
}

const REACTION_EMOJIS = ["❤️", "😂", "👍", "😮", "😢", "🙏"];

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: "Smileys", emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐","😕","😟","🙁","☹️","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿"] },
  { label: "Gestos", emojis: ["👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🫀","🫁","🧠","🦷","🦴","👀","👁️","👅","👄"] },
  { label: "Pessoas", emojis: ["🧑","👱","🧔","🧑‍🦰","🧑‍🦱","🧑‍🦳","🧑‍🦲","👶","🧒","👦","👧","🧑","👨","👩","🧓","👴","👵","🙍","🙎","🙅","🙆","💁","🙋","🧏","🙇","🤦","🤷","👮","🕵️","💂","🥷","👷","🫅","🤴","👸","👳","👲","🧕","🤵","👰","🤰","🤱","👼","🎅","🤶","🧑‍🎄","🦸","🦹","🧙","🧝","🧛","🧟","🧞","🧜","🧚","🧑‍🤝‍🧑","💏","💑","👪"] },
  { label: "Natureza", emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🪱","🐛","🦋","🐌","🐞","🐜","🪲","🦟","🦗","🪳","🕷️","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🦭","🐊","🐅","🐆","🦓","🦍","🦧","🦣","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🦬","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐕‍🦺","🐈","🐈‍⬛","🪶","🐓","🦃","🦤","🦚","🦜","🦢","🦩","🕊️","🐇","🦝","🦨","🦡","🦫","🦦","🦥","🐁","🐀","🐿️","🦔","🌵","🎄","🌲","🌳","🌴","🪵","🌱","🌿","☘️","🍀","🎍","🪴","🎋","🍃","🍂","🍁","🪺","🪹","🍄","🌾","💐","🌷","🌹","🥀","🌺","🌸","🌼","🌻","🌞","🌝","🌛","🌜","🌚","🌕","🌖","🌗","🌘","🌑","🌒","🌓","🌔","🌙","🌟","⭐","🌠","🌌","☁️","⛅","🌤️","🌈","🌂","☂️","☔","⛱️","⚡","❄️","🔥","💧","🌊"] },
  { label: "Comida", emojis: ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🥕","🧄","🧅","🥔","🍠","🥐","🥯","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🫓","🥪","🥙","🧆","🌮","🌯","🫔","🥗","🥘","🫕","🥫","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥮","🍢","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯","🧃","🥤","🧋","🍵","☕","🫖","🍺","🍻","🥂","🍷","🫗","🥃","🍸","🍹","🧉","🍾","🧊","🥄","🍴","🍽️"] },
  { label: "Símbolos", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","☦️","🛐","⛎","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","🆔","⚛️","🉑","☢️","☣️","📴","📳","🈶","🈚","🈸","🈺","🈷️","✴️","🆚","💮","🉐","㊙️","㊗️","🈴","🈵","🈹","🈲","🅰️","🅱️","🆎","🆑","🅾️","🆘","❌","⭕","🛑","⛔","📛","🚫","💯","💢","♨️","🚷","🚯","🚳","🚱","🔞","📵","🔕","🔇","🔉","🔊","📢","📣","📯","🔔","🔔","🛎️","🎵","🎶","✅","🔰","♻️","🔱","📛","🔰","⚜️","🔲","🔳","▪️","▫️","◾","◽","◼️","◻️","⬛","⬜","🟥","🟧","🟨","🟩","🟦","🟪","🟫"] },
];

function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [tab, setTab] = useState(0);
  return (
    <div className="w-72">
      <div className="flex gap-1 px-2 pt-2 pb-1 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
        {EMOJI_GROUPS.map((g, i) => (
          <button
            key={g.label}
            onClick={() => setTab(i)}
            className={cn(
              "shrink-0 text-xs px-2 py-0.5 rounded-full transition-colors",
              tab === i
                ? "bg-primary text-primary-foreground"
                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-0.5 p-2 max-h-48 overflow-y-auto">
        {EMOJI_GROUPS[tab].emojis.map((e) => (
          <button
            key={e}
            onClick={() => onPick(e)}
            className="text-xl p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors leading-none"
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

function getInitials(name: string | null, phone: string) {
  if (!name) return phone.replace(/\D/g, "").slice(-2);
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatMessageDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM");
}

function formatSectionDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "d 'de' MMMM", { locale: ptBR });
}

const UMBLER_COLOR_MAP: Record<string, string> = {
  Aquamarine: "#14b8a6",
  Chocolate:  "#92400e",
  Cyan:       "#06b6d4",
  Gold:       "#d97706",
  Grape:      "#7c3aed",
  Gray:       "#6b7280",
  Green:      "#16a34a",
  Kiwi:       "#84cc16",
  Magenta:    "#ec4899",
  Pink:       "#f472b6",
  Rose:       "#e11d48",
  Salmon:     "#f87171",
  Skyblue:    "#38bdf8",
  Tangerine:  "#f97316",
  Tomato:     "#ef4444",
  Umblerito:  "#5046e5",
};

const TAG_PALETTE = [
  "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c",
  "#3498db", "#9b59b6", "#e91e63", "#00bcd4", "#8bc34a",
  "#ff5722", "#795548", "#607d8b", "#009688", "#673ab7",
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

function WhatsappTagBadge({ tag }: { tag: WhatsappClientTag }) {
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

function ClientListItem({
  client,
  selected,
  onClick,
}: {
  client: ChatClient;
  selected: boolean;
  onClick: () => void;
}) {
  const hasUnread = (client.unreadCount ?? 0) > 0;
  const displayName = client.clientName ?? client.phone;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
        "border-b border-slate-100 dark:border-slate-800/60",
        selected
          ? "bg-primary/10 dark:bg-primary/15 border-l-2 border-l-primary"
          : hasUnread
            ? "hover:bg-slate-50 dark:hover:bg-slate-800/40 bg-green-50/50 dark:bg-green-950/20"
            : "hover:bg-slate-50 dark:hover:bg-slate-800/40",
      )}
    >
      <div className="relative shrink-0">
        <div className="h-11 w-11 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-sm font-bold text-white shadow-sm">
          {getInitials(client.clientName, client.phone)}
        </div>
        {hasUnread && !selected && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-green-500 flex items-center justify-center text-[10px] font-bold text-white px-1 shadow-sm">
            {(client.unreadCount ?? 0) > 99 ? "99+" : client.unreadCount}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <p className={cn(
            "text-sm truncate",
            hasUnread && !selected ? "font-bold text-slate-900 dark:text-white" : "font-medium text-slate-800 dark:text-slate-100",
          )}>
            {displayName}
          </p>
          {client.lastMessageAt && (
            <span className={cn(
              "text-[11px] shrink-0",
              hasUnread && !selected
                ? "text-green-600 dark:text-green-400 font-semibold"
                : "text-slate-400 dark:text-slate-500",
            )}>
              {formatMessageDate(client.lastMessageAt)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {client.lastMessageContent ? (
            <p className={cn(
              "text-xs truncate flex-1",
              hasUnread && !selected
                ? "text-slate-700 dark:text-slate-200 font-medium"
                : "text-slate-400 dark:text-slate-500",
            )}>
              {client.lastMessageDirection === "outbound" && client.lastMessageType !== "system" && (
                <span className="text-slate-400 dark:text-slate-500 mr-0.5">Você: </span>
              )}
              {client.lastMessageContent}
            </p>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 truncate flex-1">
              <Phone className="h-3 w-3 shrink-0" />
              {client.phone}
            </p>
          )}
        </div>

        {client.tags && client.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {client.tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="inline-flex text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 truncate max-w-[80px]"
              >
                {tag.name}
              </span>
            ))}
            {client.tags.length > 3 && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                +{client.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {client.whatsappTags && client.whatsappTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {client.whatsappTags.slice(0, 3).map((tag) => (
              <WhatsappTagBadge key={tag.id} tag={tag} />
            ))}
            {client.whatsappTags.length > 3 && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                +{client.whatsappTags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

function AudioPlayer({ src, isOutbound }: { src: string; isOutbound: boolean }) {
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
        onEnded={() => { setPlaying(false); setCurrent(0); }}
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
        {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current translate-x-0.5" />}
      </button>

      <div className="flex-1 flex flex-col gap-1">
        <div
          className={cn(
            "relative h-1.5 rounded-full overflow-hidden cursor-pointer",
            isOutbound ? "bg-primary-foreground/30" : "bg-slate-200 dark:bg-slate-600",
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
        <span className={cn(
          "text-[10px] tabular-nums",
          isOutbound ? "text-primary-foreground/70" : "text-slate-400 dark:text-slate-500",
        )}>
          {formatTime(current || duration)}
        </span>
      </div>

      <Mic className={cn(
        "h-4 w-4 shrink-0",
        isOutbound ? "text-primary-foreground/50" : "text-slate-400 dark:text-slate-500",
      )} />
    </div>
  );
}

function MessageContent({ msg, isOutbound }: { msg: WaMessage; isOutbound: boolean }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const mediaUrl = msg.media?.id
    ? `/api/whatsapp/media/${msg.media.id}`
    : null;

  if (msg.type === "sticker") {
    if (!mediaUrl) return <p className="px-3.5 py-2.5 text-sm italic opacity-60">🎭 Figurinha não disponível</p>;
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
            <div className="relative group cursor-zoom-in" onClick={() => setLightboxOpen(true)}>
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
            <div className="px-3.5 py-2.5 text-sm italic opacity-60">[imagem]</div>
          )}
          {msg.caption && (
            <p className="text-sm px-3.5 pt-1 pb-0.5 whitespace-pre-wrap break-words">{msg.caption}</p>
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
          <p className="text-sm px-3.5 pt-1 pb-0.5 whitespace-pre-wrap break-words">{msg.caption}</p>
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
              isOutbound ? "text-primary-foreground" : "text-slate-500 dark:text-slate-400",
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
      <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">{msg.content}</p>
    );
  }

  // Fallback para mensagens salvas como "unsupported" que têm mídia — infere o tipo pelo mimeType.
  if (msg.media?.mimeType) {
    const mime = msg.media.mimeType;
    const inferredMsg = { ...msg, type: mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio" : "sticker" };
    return <MessageContent msg={inferredMsg} isOutbound={isOutbound} />;
  }

  if (msg.type === "unsupported") {
    return <p className="px-3.5 py-2.5 text-sm italic opacity-60">🎭 Figurinha animada não suportada</p>;
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
  const { data: stickers = [], isLoading, refetch } = useQuery<SavedSticker[]>({
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
    <div className="w-72 flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
        <Sticker className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Figurinhas salvas</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : stickers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-2">
          <Sticker className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Nenhuma figurinha salva ainda.<br />Salve figurinhas recebidas no chat.
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
        body: JSON.stringify({ title: newTitle.trim(), content: newContent.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.message ?? "Erro ao criar resposta", variant: "destructive" });
        return;
      }
      setNewTitle("");
      setNewContent("");
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/quick-replies"] });
    } catch {
      toast({ title: "Erro ao criar resposta rápida", variant: "destructive" });
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/whatsapp/quick-replies/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/quick-replies"] });
    } catch {
      toast({ title: "Erro ao remover resposta", variant: "destructive" });
    }
  };

  return (
    <div className="w-80 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Respostas rápidas</span>
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
              onClick={() => { setIsCreating(false); setNewTitle(""); setNewContent(""); }}
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
            Nenhuma resposta rápida criada.<br />Clique em + para adicionar.
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
                <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{r.title}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-2 mt-0.5">{r.content}</p>
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

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setIsPending(true);
    try {
      const body: Record<string, string> = { action: "create", name: form.name.trim() };
      if (form.email.trim()) body.email = form.email.trim();
      if (form.cpf.trim()) body.cpf = form.cpf.trim();
      if (form.birthday) body.birthday = form.birthday;
      if (form.categoria) body.categoria = form.categoria;
      if (form.origem) body.origem = form.origem;
      if (form.responsavelId) body.responsavelId = form.responsavelId;

      const res = await fetch(`/api/whatsapp/conversations/${client.conversationId}/link-client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data?.message ?? "Erro ao criar cliente", variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations-list"] });
      onOpenChange(false);
      setForm({ name: "", email: "", cpf: "", birthday: "", categoria: "", origem: "WhatsApp", responsavelId: "" });
      onSuccess(data.clientId);
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">{label}</label>
      {children}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome *">
              <Input
                value={form.name}
                onChange={set("name")}
                placeholder="Nome completo"
                autoFocus
              />
            </Field>
            <Field label="Telefone">
              <Input value={client.phone} readOnly className="bg-slate-50 dark:bg-slate-800/50 text-slate-500" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data de nascimento">
              <Input
                type="date"
                value={form.birthday}
                onChange={set("birthday")}
              />
            </Field>
            <Field label="Categoria">
              <Select value={form.categoria} onValueChange={(v) => setForm((p) => ({ ...p, categoria: v }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecionar…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Geral">Geral</SelectItem>
                  {(categories as { id: string; name: string }[]).map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Origem">
              <Select value={form.origem} onValueChange={(v) => setForm((p) => ({ ...p, origem: v }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecionar…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  {(origins as { id: string; name: string }[]).filter((o) => o.name !== "WhatsApp").map((o) => (
                    <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {isAdminOrGerente && (
              <Field label="Responsável">
                <Select value={form.responsavelId} onValueChange={(v) => setForm((p) => ({ ...p, responsavelId: v }))}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(users as { id: string; name: string }[]).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleCreate} disabled={isPending || !form.name.trim()}>
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
}: {
  conversationKey: string;
  onBack: () => void;
  client: ChatClient;
  channels: Channel[];
  userRole: string;
  onClientLinked: (clientId: string) => void;
}) {
  const [message, setMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<WaMessage | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<number | undefined>(
    client.channelId ?? undefined,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [pendingAudio, setPendingAudio] = useState<{ blob: Blob; url: string; file: File } | null>(null);
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
  const [botPickerOpen, setBotPickerOpen] = useState(false);
  const [isTriggeringBot, setIsTriggeringBot] = useState(false);
  const [savingStickers, setSavingStickers] = useState<Set<string>>(new Set());
  const [transferOpen, setTransferOpen] = useState(false);
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
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations-list"] });
      toast({ title: "Conversa transferida com sucesso" });
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

  const activeBots = bots.filter((b) => b.isActive);

  const handleTriggerBot = async (botId: string) => {
    setIsTriggeringBot(true);
    setBotPickerOpen(false);
    try {
      const res = await fetch(`/api/whatsapp/conversations/${conversationKey}/trigger-bot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: (err as { message?: string }).message ?? "Erro ao disparar bot", variant: "destructive" });
        return;
      }
      toast({ title: "Bot disparado com sucesso" });
    } catch {
      toast({ title: "Erro de conexão ao disparar bot", variant: "destructive" });
    } finally {
      setIsTriggeringBot(false);
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
      setSavingStickers((prev) => { const s = new Set(prev); s.delete(mediaId); return s; });
    }
  };

  const sendSavedSticker = async (mediaId: string) => {
    setStickerPickerOpen(false);
    setIsUploading(true);
    try {
      const res = await fetch(`/api/whatsapp/media/${mediaId}`);
      if (!res.ok) throw new Error("Falha ao buscar figurinha");
      const blob = await res.blob();
      const file = new File([blob], `sticker-${Date.now()}.webp`, { type: blob.type || "image/webp" });
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, localMessages.length]);

  useEffect(() => {
    if (localMessages.length === 0) return;
    setLocalMessages((prev) =>
      prev.filter(
        (lm) =>
          !rawMessages.some(
            (m) =>
              m.direction === "outbound" &&
              m.content === lm.content &&
              new Date(m.sentAt ?? m.createdAt).getTime() >=
                new Date(lm.createdAt).getTime() - 5_000,
          ),
      ),
    );
  }, [rawMessages]);

  useEffect(() => {
    const es = new EventSource(`/api/whatsapp/conversations/${conversationKey}/stream`);
    es.addEventListener("new_message", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations", conversationKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations-list"] });
    });
    return () => es.close();
  }, [conversationKey, queryClient]);

  const attemptSend = useCallback(async (text: string, localId: string, channelId?: number, replyToMessageId?: string) => {
    try {
      const body: { message: string; channelId?: number; replyToMessageId?: string } = { message: text };
      if ((userRole === "admin" || userRole === "gerente") && channelId != null) {
        body.channelId = channelId;
      }
      if (replyToMessageId) {
        body.replyToMessageId = replyToMessageId;
      }
      const res = await fetch(`/api/whatsapp/conversations/${conversationKey}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
    } catch (err) {
      if (err instanceof TypeError) {
        // TypeError = network error: request never reached the backend, no DB record created
        setLocalMessages((prev) => prev.filter((m) => m.localId !== localId));
        toast({ title: "Erro de conexão. Verifique sua internet e tente novamente.", variant: "destructive" });
      }
      // Non-network errors: backend persisted the message as "failed" — retry button will appear
      // rawMessages effect will remove the local message once the server data arrives
    } finally {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations", conversationKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations-list"] });
    }
  }, [conversationKey, queryClient, toast, userRole]);

  const handleRetry = useCallback(async (messageId: string) => {
    setRetryingIds((prev) => { const s = new Set(prev); s.add(messageId); return s; });
    try {
      await fetch(`/api/whatsapp/conversations/${conversationKey}/messages/${messageId}/retry`, {
        method: "POST",
      });
    } finally {
      setRetryingIds((prev) => {
        const s = new Set(prev);
        s.delete(messageId);
        return s;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations", conversationKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations-list"] });
    }
  }, [conversationKey, queryClient]);

  const sendMedia = useCallback(async (file: File, caption?: string) => {
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (caption) form.append("caption", caption);
      if ((userRole === "admin" || userRole === "gerente") && selectedChannelId != null) {
        form.append("channelId", String(selectedChannelId));
      }
      if (replyingTo) {
        form.append("replyToMessageId", replyingTo.id);
        setReplyingTo(null);
      }
      const res = await fetch(`/api/whatsapp/conversations/${conversationKey}/messages/media`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: (err as { message?: string }).message ?? "Erro ao enviar arquivo", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão ao enviar arquivo", variant: "destructive" });
    } finally {
      setIsUploading(false);
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations", conversationKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations-list"] });
    }
  }, [conversationKey, queryClient, replyingTo, selectedChannelId, toast, userRole]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    sendMedia(file);
  }, [sendMedia]);

  const handleStickerChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    sendMedia(file);
  }, [sendMedia]);

  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    setReactingToId(null);
    try {
      const body: { emoji: string; channelId?: number } = { emoji };
      if ((userRole === "admin" || userRole === "gerente") && selectedChannelId != null) {
        body.channelId = selectedChannelId;
      }
      await fetch(`/api/whatsapp/conversations/${conversationKey}/messages/${messageId}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations", conversationKey] });
    } catch {
      toast({ title: "Erro ao reagir à mensagem", variant: "destructive" });
    }
  }, [conversationKey, queryClient, selectedChannelId, toast, userRole]);

  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
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
        const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setPendingAudio({ blob, url, file });
        recordingChunksRef.current = [];
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      toast({ title: "Não foi possível acessar o microfone", variant: "destructive" });
    }
  }, [toast]);

  const handleSend = () => {
    const text = message.trim();
    if (!text) return;
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
    const day = format(new Date(msg.sentAt ?? msg.createdAt), "yyyy-MM-dd");
    const last = grouped[grouped.length - 1];
    if (last?.date === day) {
      last.msgs.push(msg);
    } else {
      grouped.push({ date: day, msgs: [msg] });
    }
  }

  const displayName = client.clientName ?? client.phone;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8 shrink-0 text-slate-500"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0">
          {getInitials(client.clientName, client.phone)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
            {displayName}
          </p>
          {client.clientName && (
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {client.phone}
            </p>
          )}
          {((client.tags && client.tags.length > 0) ||
            (client.whatsappTags && client.whatsappTags.length > 0)) && (
            <div className="flex flex-wrap gap-1 mt-1">
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

        {(userRole === "admin" || userRole === "gerente") && channels.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap hidden sm:inline">
              Canal:
            </span>
            <Select
              value={selectedChannelId != null ? String(selectedChannelId) : ""}
              onValueChange={(v) => setSelectedChannelId(v ? Number(v) : undefined)}
            >
              <SelectTrigger className="h-7 text-xs w-44">
                <SelectValue placeholder="Selecionar canal…" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((ch) => (
                  <SelectItem key={ch.id} value={String(ch.id)}>
                    {ch.name}{ch.displayPhone ? ` · ${ch.displayPhone}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {channels.length > 0 && (
          <Popover open={transferOpen} onOpenChange={setTransferOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 shrink-0"
                title="Transferir conversa para outro canal"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Transferir</span>
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
                    className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 flex flex-col"
                    disabled={transferMutation.isPending}
                    onClick={() => transferMutation.mutate(ch.id)}
                  >
                    <span className="font-medium">{ch.name}</span>
                    {ch.displayPhone && (
                      <span className="text-xs text-slate-400">{ch.displayPhone}</span>
                    )}
                  </button>
                ))}
              {channels.filter((ch) => ch.id !== client.channelId).length === 0 && (
                <p className="text-xs text-slate-400 px-2 py-1.5">
                  Nenhum outro canal disponível.
                </p>
              )}
            </PopoverContent>
          </Popover>
        )}

      </div>

      {/* Banner de contato desconhecido */}
      {isUnknownContact && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/50 shrink-0">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400 flex-1">
            Contato desconhecido — crie um cliente para registrar esta conversa.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 shrink-0"
            onClick={() => setCreateClientOpen(true)}
          >
            Criar cliente
          </Button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-1 bg-slate-50 dark:bg-slate-950/30">
        {isLoading ? (
          <div className="space-y-4 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                <Skeleton className={cn("h-14 rounded-2xl", i % 2 === 0 ? "w-2/5" : "w-3/5")} />
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
                  const isMedia = msg.type === "image" || msg.type === "video" || msg.type === "sticker";
                  const time = format(new Date(msg.sentAt ?? msg.createdAt), "HH:mm");
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
                    (!prevMsg || prevMsg.direction !== "outbound" || prevMsg.channelId !== msg.channelId);

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
                          {isRetrying
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <RotateCcw className="h-3.5 w-3.5" />
                          }
                          <span className="whitespace-nowrap">
                            {isRetrying ? "Reenviando…" : "Reenviar"}
                          </span>
                        </button>
                      )}

                      {/* Botões hover: reply + reação + salvar figurinha */}
                      {!isFailed && (
                        <div className={cn(
                          "shrink-0 mb-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                          isOutbound ? "order-first" : "order-last",
                        )}>
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
                              {savingStickers.has(msg.media!.id)
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Bookmark className="h-3.5 w-3.5" />
                              }
                            </button>
                          )}
                          <Popover open={reactingToId === msg.id} onOpenChange={(o) => setReactingToId(o ? msg.id : null)}>
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
                            <PopoverContent side="top" className="w-auto p-1.5" align={isOutbound ? "start" : "end"}>
                              <div className="flex gap-1">
                                {REACTION_EMOJIS.map((e) => {
                                  const currentOutbound = msg.reactions?.find((r) => r.direction === "outbound")?.emoji;
                                  const isActive = currentOutbound === e;
                                  return (
                                    <button
                                      key={e}
                                      onClick={() => handleReact(msg.id, isActive ? "" : e)}
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
                      <div className="flex flex-col gap-1 max-w-[72%] sm:max-w-[65%] min-w-0">
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
                        {msg.replyToContent !== null && msg.replyToContent !== undefined ? (
                          <div className={cn(
                            "rounded-lg px-2.5 py-1.5 mb-2 border-l-[3px]",
                            isMedia ? "mx-3.5 mt-2.5" : "",
                            isOutbound
                              ? "bg-primary-foreground/10 border-primary-foreground/50"
                              : "bg-slate-100 dark:bg-slate-700/50 border-slate-400 dark:border-slate-500",
                          )}>
                            <p className={cn(
                              "text-[11px] font-semibold mb-0.5",
                              isOutbound ? "text-primary-foreground/80" : "text-slate-600 dark:text-slate-300",
                            )}>
                              {msg.replyToDirection === "outbound" ? "Você" : client.clientName ?? client.phone}
                            </p>
                            <p className={cn(
                              "text-xs truncate",
                              isOutbound ? "text-primary-foreground/70" : "text-slate-500 dark:text-slate-400",
                            )}>
                              {replySnippet(msg.replyToContent, msg.replyToType)}
                            </p>
                          </div>
                        ) : msg.replyToMessageId ? (
                          <div className={cn(
                            "rounded-lg px-2.5 py-1.5 mb-2 border-l-[3px]",
                            isMedia ? "mx-3.5 mt-2.5" : "",
                            isOutbound
                              ? "bg-primary-foreground/10 border-primary-foreground/50"
                              : "bg-slate-100 dark:bg-slate-700/50 border-slate-400 dark:border-slate-500",
                          )}>
                            <p className={cn(
                              "text-xs italic",
                              isOutbound ? "text-primary-foreground/60" : "text-slate-400 dark:text-slate-500",
                            )}>
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
                        <div className={cn(
                          "flex items-center gap-1 mt-1",
                          isMedia ? "px-3 pb-2 justify-end" : "justify-end",
                        )}>
                          <span className={cn(
                            "text-[10px]",
                            isFailed
                              ? "text-red-400 dark:text-red-500"
                              : isOutbound
                                ? "text-primary-foreground/70"
                                : "text-slate-400 dark:text-slate-500",
                          )}>
                            {time}
                          </span>
                          {isFailed ? (
                            <AlertCircle className="h-3 w-3 text-red-400 dark:text-red-500" />
                          ) : isOutbound ? (
                            <CheckCheck className={cn(
                              "h-3 w-3",
                              msg.status === "delivered" || msg.status === "read"
                                ? "text-blue-300"
                                : "text-primary-foreground/60",
                            )} />
                          ) : null}
                        </div>
                      </div>
                      {/* Pills de reação */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className={cn("flex gap-1 flex-wrap", isOutbound ? "justify-end" : "justify-start")}>
                          {msg.reactions.map((r) => (
                            <button
                              key={r.direction}
                              onClick={() => r.direction === "outbound" ? handleReact(msg.id, "") : undefined}
                              title={r.direction === "outbound" ? "Clique para remover sua reação" : "Reação do contato"}
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
            {localMessages.map((lm) => (
              <div key={lm.localId} className="flex w-full justify-end">
                <div className="max-w-[82%] sm:max-w-[70%] rounded-2xl shadow-sm px-3.5 py-2.5 rounded-tr-[4px] bg-primary/60 text-primary-foreground">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
                    {lm.content}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[10px] text-primary-foreground/70">
                      {format(new Date(lm.createdAt), "HH:mm")}
                    </span>
                    <Loader2 className="h-3 w-3 text-primary-foreground/60 animate-spin" />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        {/* Preview da mensagem sendo respondida */}
        {replyingTo && (
          <div className="flex items-start gap-2 px-3 sm:px-4 pt-2.5 pb-1">
            <div className="flex-1 border-l-[3px] border-primary pl-2.5 py-0.5 min-w-0">
              <p className="text-[11px] font-semibold text-primary mb-0.5">
                {replyingTo.direction === "outbound" ? "Você" : client.clientName ?? client.phone}
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
          <div className="p-3 sm:p-4 flex items-center gap-3">
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
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
          </div>
        ) : isRecording ? (
          <div className="p-3 sm:p-4 flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-sm font-medium text-red-500 tabular-nums">
                {Math.floor(recordingSeconds / 60).toString().padStart(2, "0")}:{(recordingSeconds % 60).toString().padStart(2, "0")}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">Gravando áudio…</span>
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
          <div className="px-3 sm:px-4 pt-3 pb-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,video/mp4,video/3gpp,audio/mpeg,audio/ogg,audio/aac,audio/mp4,application/pdf,.docx,.xlsx,.pptx,text/plain"
              onChange={handleFileChange}
            />
            <input
              ref={stickerInputRef}
              type="file"
              className="hidden"
              accept="image/webp"
              onChange={handleStickerChange}
            />

            {/* Textarea + botão enviar */}
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite uma mensagem…"
                className="flex-1 resize-none min-h-[90px] max-h-[200px] text-sm"
                rows={3}
                disabled={isUploading}
              />
              {message.trim() ? (
                <Button
                  onClick={handleSend}
                  disabled={isUploading}
                  size="icon"
                  className="shrink-0 h-10 w-10 mb-0.5"
                >
                  <Send className="h-4 w-4" />
                </Button>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={isUploading}
                  className="shrink-0 h-10 w-10 mb-0.5 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  title="Gravar áudio"
                >
                  <Mic className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Toolbar inferior: anexo, figurinha, emoji + dica */}
            <div className="flex items-center gap-1 mt-1.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
                title="Enviar arquivo"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </button>
              <Popover open={stickerPickerOpen} onOpenChange={setStickerPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    disabled={isUploading}
                    className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
                    title="Figurinhas"
                  >
                    <Sticker className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="p-0 w-auto">
                  <StickerPicker
                    onPickFromDevice={() => { setStickerPickerOpen(false); stickerInputRef.current?.click(); }}
                    onPickSaved={sendSavedSticker}
                  />
                </PopoverContent>
              </Popover>
              <Popover
                open={emojiOpen}
                onOpenChange={(o) => {
                  if (o) cursorPosRef.current = textareaRef.current?.selectionStart ?? message.length;
                  setEmojiOpen(o);
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
                    title="Emoji"
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="p-0 w-auto">
                  <EmojiPicker
                    onPick={(e) => {
                      const pos = cursorPosRef.current;
                      setMessage((prev) => prev.slice(0, pos) + e + prev.slice(pos));
                      cursorPosRef.current = pos + e.length;
                      setEmojiOpen(false);
                      setTimeout(() => {
                        const ta = textareaRef.current;
                        if (ta) {
                          ta.focus();
                          ta.setSelectionRange(cursorPosRef.current, cursorPosRef.current);
                        }
                      }, 0);
                    }}
                  />
                </PopoverContent>
              </Popover>
              <Popover open={quickReplyOpen} onOpenChange={setQuickReplyOpen}>
                <PopoverTrigger asChild>
                  <button
                    disabled={isUploading}
                    className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
                    title="Respostas rápidas"
                  >
                    <Zap className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="p-0 w-auto">
                  <QuickReplyPicker
                    onPick={(content) => {
                      setMessage((prev) => prev ? prev + "\n" + content : content);
                      setQuickReplyOpen(false);
                      setTimeout(() => textareaRef.current?.focus(), 0);
                    }}
                  />
                </PopoverContent>
              </Popover>
              {activeBots.length > 0 && (
                <Popover open={botPickerOpen} onOpenChange={setBotPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      disabled={isTriggeringBot}
                      className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
                      title="Disparar bot"
                    >
                      {isTriggeringBot ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="p-0 w-56">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                      <Bot className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Disparar bot</span>
                    </div>
                    <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
                      {activeBots.map((bot) => (
                        <button
                          key={bot.id}
                          className="flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                          onClick={() => handleTriggerBot(bot.id)}
                        >
                          <Bot className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-xs text-slate-700 dark:text-slate-200 truncate">{bot.name}</span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <p className="text-[10px] text-slate-400 dark:text-slate-600 ml-auto hidden sm:block">
                Enter para enviar · Shift+Enter para nova linha
              </p>
            </div>
          </div>
        )}
      </div>

      <CreateClientFromConversationDialog
        open={createClientOpen}
        onOpenChange={setCreateClientOpen}
        client={client}
        userRole={userRole}
        onSuccess={onClientLinked}
      />
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

  const { data: availableTags = [] } = useQuery<CrmTag[]>({
    queryKey: ["/api/tags", "wa-new-conv"],
    queryFn: async () => {
      const res = await fetch("/api/tags");
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
      for (const id of selectedTagIds) params.append("tagIds", id);
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
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
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
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations-list"] });
      onOpenChange(false);
      onSelect(result.clientId);
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente por nome ou telefone..."
            className="pl-9 text-sm"
            autoFocus
          />
        </div>

        {availableTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {availableTags.map((tag) => {
              const active = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    "inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                    active
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-transparent border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400",
                  )}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
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
                {startMutation.isPending && startMutation.variables === c.id && (
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
  // selectedId holds either a clientId or a conversationId (for unknown contacts)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const queryClient = useQueryClient();

  const isAdminOrGerente = user?.role === "admin" || user?.role === "gerente";

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
    enabled: isAdminOrGerente,
  });

  const { data: clientList = [], isLoading: isLoadingClients } = useQuery<ChatClient[]>({
    queryKey: ["/api/whatsapp/conversations-list", debouncedSearch, selectedTagIds, user?.id],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      for (const id of selectedTagIds) params.append("tagIds", id);
      const res = await fetch(`/api/whatsapp/conversations?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15_000,
  });

  const markRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/whatsapp/conversations/${id}/read`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations-list"] });
    } catch {
      // silently ignore
    }
  }, [queryClient]);

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    const es = new EventSource("/api/whatsapp/notifications/stream");
    es.addEventListener("new_whatsapp_inbound", (e) => {
      const data = JSON.parse(e.data) as { clientId: string | null; conversationId?: string | null };
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations-list"] });
      const isSelected =
        (data.clientId && data.clientId === selectedIdRef.current) ||
        (data.conversationId && data.conversationId === selectedIdRef.current);
      if (isSelected) {
        markRead(selectedIdRef.current!);
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations", selectedIdRef.current] });
      }
    });
    return () => es.close();
  }, [queryClient, markRead]);

  const handleSelectConversation = (id: string) => {
    queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations", id] });
    setSelectedId(id);
    markRead(id);
  };

  // After creating a client from an unknown conversation, switch to clientId-based selection
  const handleClientLinked = (clientId: string) => {
    setSelectedId(clientId);
    queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations", clientId] });
    queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations-list"] });
  };

  const handleBack = () => setSelectedId(null);

  const selectedClient = clientList.find(
    (c) => c.clientId === selectedId || c.conversationId === selectedId,
  ) ?? null;

  const showList = !selectedId;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel — contact list */}
      <div className={cn(
        "flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900",
        showList ? "flex w-full md:w-72 lg:w-80 md:flex" : "hidden md:flex md:w-72 lg:w-80",
      )}>
        {/* Search header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Conversas
            </h2>
            <div className="flex items-center gap-1">
              {availableWaTags.length > 0 && (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-7 w-7",
                      selectedTagIds.length > 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-slate-500 hover:text-primary",
                    )}
                    onClick={() => { setShowTagFilter((v) => !v); setTagSearch(""); }}
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
                className="h-7 w-7 text-slate-500 hover:text-primary"
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
              className="pl-9 text-sm h-9"
            />
          </div>
        </div>

        {/* Client list — relative so the tag panel can overlay it */}
        <div className="flex-1 overflow-y-auto relative">
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
                    .filter((t) =>
                      !tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase()),
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
                            active ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900" : "opacity-90 hover:opacity-100",
                          )}
                          style={{ backgroundColor: tagColor }}
                        >
                          {tagEmoji && <span className="shrink-0 leading-none">{tagEmoji}</span>}
                          <span className="truncate">{tag.name}</span>
                          {active && <Check className="h-3 w-3 shrink-0 ml-auto" />}
                        </button>
                      );
                    })}
                  {availableWaTags.filter((t) =>
                    !tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase()),
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
                selected={client.clientId === selectedId || client.conversationId === selectedId}
                onClick={() => handleSelectConversation(client.clientId ?? client.conversationId)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right panel — conversation */}
      <div className={cn(
        "flex-1 flex-col overflow-hidden",
        selectedId ? "flex" : "hidden md:flex",
      )}>
        {selectedClient ? (
          <ConversationMessages
            key={selectedClient.conversationId}
            conversationKey={selectedClient.clientId ?? selectedClient.conversationId}
            client={selectedClient}
            onBack={handleBack}
            channels={availableChannels}
            userRole={user?.role ?? "vendedor"}
            onClientLinked={handleClientLinked}
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
