import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Color system — maps semantic intent to active-state classes
// ---------------------------------------------------------------------------

export type TabColor =
  | "blue"
  | "green"
  | "orange"
  | "red"
  | "purple"
  | "amber"
  | "indigo"
  | "teal"
  | "wine";

const underlineActiveColor: Record<TabColor, string> = {
  blue: "data-[state=active]:border-blue-600   data-[state=active]:text-blue-600   dark:data-[state=active]:border-blue-400   dark:data-[state=active]:text-blue-400",
  green:
    "data-[state=active]:border-green-600  data-[state=active]:text-green-600  dark:data-[state=active]:border-green-400  dark:data-[state=active]:text-green-400",
  orange:
    "data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 dark:data-[state=active]:border-orange-400 dark:data-[state=active]:text-orange-400",
  red: "data-[state=active]:border-red-600    data-[state=active]:text-red-600    dark:data-[state=active]:border-red-400    dark:data-[state=active]:text-red-400",
  purple:
    "data-[state=active]:border-purple-600 data-[state=active]:text-purple-600 dark:data-[state=active]:border-purple-400 dark:data-[state=active]:text-purple-400",
  amber:
    "data-[state=active]:border-amber-500  data-[state=active]:text-amber-600  dark:data-[state=active]:border-amber-400  dark:data-[state=active]:text-amber-400",
  indigo:
    "data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:border-indigo-400 dark:data-[state=active]:text-indigo-400",
  teal: "data-[state=active]:border-teal-600   data-[state=active]:text-teal-600   dark:data-[state=active]:border-teal-400   dark:data-[state=active]:text-teal-400",
  wine: "data-[state=active]:border-primary      data-[state=active]:text-primary",
};

const pillActiveColor: Record<TabColor, string> = {
  blue: "data-[state=active]:text-blue-600   dark:data-[state=active]:text-blue-400   data-[state=active]:bg-blue-50   dark:data-[state=active]:bg-blue-500/10   data-[state=active]:border-blue-200   dark:data-[state=active]:border-blue-500/20",
  green:
    "data-[state=active]:text-green-600  dark:data-[state=active]:text-green-400  data-[state=active]:bg-green-50  dark:data-[state=active]:bg-green-500/10  data-[state=active]:border-green-200  dark:data-[state=active]:border-green-500/20",
  orange:
    "data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400 data-[state=active]:bg-orange-50 dark:data-[state=active]:bg-orange-500/10 data-[state=active]:border-orange-200 dark:data-[state=active]:border-orange-500/20",
  red: "data-[state=active]:text-red-600    dark:data-[state=active]:text-red-400    data-[state=active]:bg-red-50    dark:data-[state=active]:bg-red-500/10    data-[state=active]:border-red-200    dark:data-[state=active]:border-red-500/20",
  purple:
    "data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:bg-purple-50 dark:data-[state=active]:bg-purple-500/10 data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-500/20",
  amber:
    "data-[state=active]:text-amber-600  dark:data-[state=active]:text-amber-400  data-[state=active]:bg-amber-50  dark:data-[state=active]:bg-amber-500/10  data-[state=active]:border-amber-200  dark:data-[state=active]:border-amber-500/20",
  indigo:
    "data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:bg-indigo-50 dark:data-[state=active]:bg-indigo-500/10 data-[state=active]:border-indigo-200 dark:data-[state=active]:border-indigo-500/20",
  teal: "data-[state=active]:text-teal-600   dark:data-[state=active]:text-teal-400   data-[state=active]:bg-teal-50   dark:data-[state=active]:bg-teal-500/10   data-[state=active]:border-teal-200   dark:data-[state=active]:border-teal-500/20",
  wine: "data-[state=active]:text-primary       data-[state=active]:bg-accent          data-[state=active]:border-border",
};

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

const AppTabs = TabsPrimitive.Root;

// ---------------------------------------------------------------------------
// Variant: Underline
// Use in pages where tabs act as secondary navigation (e.g. Vendas / Cohort / Pedidos)
// ---------------------------------------------------------------------------

const UnderlineTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex items-center gap-1 border-b border-slate-200 dark:border-slate-700",
      "bg-transparent h-auto p-0",
      className,
    )}
    {...props}
  />
));
UnderlineTabsList.displayName = "UnderlineTabsList";

type UnderlineTriggerProps = React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.Trigger
> & { color?: TabColor };

const UnderlineTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  UnderlineTriggerProps
>(({ className, color = "blue", ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center gap-2 whitespace-nowrap px-3 pb-3 pt-2",
      "text-sm font-medium text-slate-500 dark:text-slate-400",
      "border-b-2 border-transparent -mb-px",
      "transition-colors duration-200",
      "hover:text-slate-900 dark:hover:text-slate-100",
      // outline-none suprime o ring padrão (--ring quase preto neste tema)
      "outline-none",
      "disabled:pointer-events-none disabled:opacity-40",
      underlineActiveColor[color],
      className,
    )}
    {...props}
  />
));
UnderlineTabsTrigger.displayName = "UnderlineTabsTrigger";

// ---------------------------------------------------------------------------
// Variant: Pill
// Use in pages/components where tabs act as mode/segment switchers
// ---------------------------------------------------------------------------

const PillTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex items-center gap-1 h-auto p-1 rounded-xl",
      "bg-white dark:bg-slate-950",
      "border border-slate-200 dark:border-slate-800",
      "shadow-sm",
      className,
    )}
    {...props}
  />
));
PillTabsList.displayName = "PillTabsList";

type PillTriggerProps = React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.Trigger
> & { color?: TabColor };

const PillTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  PillTriggerProps
>(({ className, color = "blue", ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center gap-2 whitespace-nowrap px-3.5 py-2 rounded-lg",
      "text-sm font-medium text-slate-500 dark:text-slate-400",
      "transition-all duration-200",
      "hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60",
      "outline-none",
      "disabled:pointer-events-none disabled:opacity-40",
      // Borda sempre presente para evitar layout shift
      "border border-transparent",
      "data-[state=active]:font-semibold",
      pillActiveColor[color],
      className,
    )}
    {...props}
  />
));
PillTabsTrigger.displayName = "PillTabsTrigger";

// ---------------------------------------------------------------------------
// Shared content wrapper
// ---------------------------------------------------------------------------

const AppTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
AppTabsContent.displayName = "AppTabsContent";

export {
  AppTabs,
  UnderlineTabsList,
  UnderlineTabsTrigger,
  PillTabsList,
  PillTabsTrigger,
  AppTabsContent,
};
