import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ClientRegistrationQuality } from "@shared/client-registration-quality";

interface RegistrationQualityBarProps {
  quality: ClientRegistrationQuality;
  className?: string;
}

export function RegistrationQualityBar({
  quality,
  className,
}: RegistrationQualityBarProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn("flex items-center gap-2 cursor-default", className)}
        >
          <div className="flex items-center gap-0.5">
            {quality.fields.map((field) => (
              <span
                key={field.key}
                className={cn(
                  "h-2 w-4 rounded-sm",
                  field.filled
                    ? "bg-emerald-500 dark:bg-emerald-400"
                    : "bg-slate-200 dark:bg-slate-700",
                )}
              />
            ))}
          </div>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
            {quality.score}/{quality.total}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs font-semibold mb-1">
          Qualidade do cadastro: {quality.percent}%
        </p>
        <ul className="text-xs space-y-0.5">
          {quality.fields.map((field) => (
            <li
              key={field.key}
              className={cn(
                field.filled
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-500 dark:text-red-400",
              )}
            >
              {field.filled ? "✓" : "✗"} {field.label}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
