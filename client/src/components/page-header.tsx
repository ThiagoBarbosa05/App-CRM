import { type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

function PageHeaderRoot({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 sm:px-6 py-5 rounded-2xl shadow-sm relative",
        className,
      )}
    >
      {/* Decorative blur isolado para não clipar o conteúdo no mobile */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 dark:bg-blue-400/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      </div>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
        {children}
      </div>
    </div>
  );
}

function PageHeaderIcon({
  icon: Icon,
  color = "text-blue-600 dark:text-blue-400",
  bgColor = "bg-blue-50 dark:bg-blue-900/30",
  className,
}: {
  icon: LucideIcon;
  color?: string;
  bgColor?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-2xl flex-shrink-0 shadow-inner",
        bgColor,
        color,
        className,
      )}
    >
      <Icon className="h-6 w-6" />
    </div>
  );
}

function PageHeaderInfo({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4 min-w-0 flex-1", className)}>
      {children}
    </div>
  );
}

function PageHeaderText({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}

function PageHeaderTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h1
      className={cn(
        "text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate",
        className,
      )}
    >
      {children}
    </h1>
  );
}

function PageHeaderDescription({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-slate-500 dark:text-slate-400 text-sm mt-1 line-clamp-2",
        className,
      )}
    >
      {children}
    </p>
  );
}

function PageHeaderActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn("flex items-center gap-3 w-full md:w-auto", className)}
    >
      {children}
    </motion.div>
  );
}

export const PageHeader = Object.assign(PageHeaderRoot, {
  Icon: PageHeaderIcon,
  Info: PageHeaderInfo,
  Text: PageHeaderText,
  Title: PageHeaderTitle,
  Description: PageHeaderDescription,
  Actions: PageHeaderActions,
});
