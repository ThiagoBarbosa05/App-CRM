import {
  Bot,
  Zap,
  MessageSquare,
  Briefcase,
  Tag,
  ArrowUpRight,
  Lightbulb,
  DollarSign,
  Gem,
  UtensilsCrossed,
  Star,
  Heart,
  Gift,
  Calendar,
  ShoppingCart,
  Package,
  Clock,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

export const BOT_SHORTCUT_ICONS = {
  bot: Bot,
  zap: Zap,
  message: MessageSquare,
  briefcase: Briefcase,
  tag: Tag,
  arrowUpRight: ArrowUpRight,
  lightbulb: Lightbulb,
  dollar: DollarSign,
  gem: Gem,
  utensils: UtensilsCrossed,
  star: Star,
  heart: Heart,
  gift: Gift,
  calendar: Calendar,
  cart: ShoppingCart,
  package: Package,
  clock: Clock,
  help: HelpCircle,
} satisfies Record<string, LucideIcon>;

export type BotShortcutIconKey = keyof typeof BOT_SHORTCUT_ICONS;

export const DEFAULT_BOT_SHORTCUT_ICON: BotShortcutIconKey = "bot";

export interface BotShortcut {
  botId: string;
  icon: BotShortcutIconKey;
}

function isIconKey(value: unknown): value is BotShortcutIconKey {
  return typeof value === "string" && value in BOT_SHORTCUT_ICONS;
}

// Aceita tanto o formato legado (array de ids em string) quanto o novo
// formato { botId, icon }, para não quebrar configurações já salvas.
export function parseBotShortcuts(raw: string | undefined): BotShortcut[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): BotShortcut | null => {
        if (typeof item === "string") {
          return { botId: item, icon: DEFAULT_BOT_SHORTCUT_ICON };
        }
        if (item && typeof item === "object" && typeof item.botId === "string") {
          return {
            botId: item.botId,
            icon: isIconKey(item.icon) ? item.icon : DEFAULT_BOT_SHORTCUT_ICON,
          };
        }
        return null;
      })
      .filter((s): s is BotShortcut => s !== null);
  } catch {
    return [];
  }
}
