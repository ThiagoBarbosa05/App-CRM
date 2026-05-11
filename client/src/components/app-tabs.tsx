import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

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
      "flex items-center gap-2 border-b border-border bg-transparent h-auto p-0 overflow-x-auto no-scrollbar",
      className,
    )}
    {...props}
  />
));
UnderlineTabsList.displayName = "UnderlineTabsList";

const UnderlineTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Layout
      "inline-flex items-center gap-1.5 whitespace-nowrap px-1 pb-3 pt-1",
      // Typography
      "text-sm font-medium text-muted-foreground",
      // Border indicator (sits on top of the parent border-b)
      "border-b-2 border-transparent -mb-px",
      // Transitions
      "transition-colors duration-200",
      // States
      "hover:text-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=active]:border-primary data-[state=active]:text-primary",
      className,
    )}
    {...props}
  />
));
UnderlineTabsTrigger.displayName = "UnderlineTabsTrigger";

// ---------------------------------------------------------------------------
// Variant: Pill
// Use in pages/components where tabs act as mode/segment switchers
// (e.g. Vendas / Ligações / Cadastros / Marcadores / Interações)
// ---------------------------------------------------------------------------

const PillTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl h-auto overflow-x-auto no-scrollbar",
      className,
    )}
    {...props}
  />
));
PillTabsList.displayName = "PillTabsList";

const PillTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Layout
      "inline-flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-lg",
      // Typography
      "text-sm font-medium text-muted-foreground",
      // Transitions
      "transition-all duration-200",
      // States
      "hover:text-foreground hover:bg-white/60 dark:hover:bg-white/5",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900",
      "data-[state=active]:text-foreground data-[state=active]:font-semibold",
      "data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/80 dark:data-[state=active]:border-slate-700/60",
      className,
    )}
    {...props}
  />
));
PillTabsTrigger.displayName = "PillTabsTrigger";

// ---------------------------------------------------------------------------
// Shared content wrapper — adds standard top spacing and focus ring
// ---------------------------------------------------------------------------

const AppTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
AppTabsContent.displayName = "AppTabsContent";

export {
  AppTabs,
  // Underline variant
  UnderlineTabsList,
  UnderlineTabsTrigger,
  // Pill variant
  PillTabsList,
  PillTabsTrigger,
  // Shared
  AppTabsContent,
};
