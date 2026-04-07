import { AlertTriangle, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface DuplicateMatch {
  id: string;
  name: string;
  phone: string;
  cpf: string | null;
  email: string | null;
  categoria: string;
  responsavelName: string | null;
  createdAt: string;
  matchReasons: string[];
  score: number;
}

interface DuplicateWarningProps {
  matches: DuplicateMatch[];
}

export function DuplicateWarning({ matches }: DuplicateWarningProps) {
  const [expanded, setExpanded] = useState(false);
  const [, navigate] = useLocation();

  if (matches.length === 0) return null;

  const shown = expanded ? matches : matches.slice(0, 2);

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {matches.length === 1
              ? "Possível cliente duplicado encontrado"
              : `${matches.length} possíveis clientes duplicados encontrados`}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            Verifique os registros abaixo antes de salvar.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {shown.map((match) => (
          <div
            key={match.id}
            className="rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 p-3 flex items-start justify-between gap-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {match.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {match.phone}
                {match.email && ` · ${match.email}`}
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {match.matchReasons.map((reason) => (
                  <Badge
                    key={reason}
                    className="text-[10px] px-2 py-0 bg-amber-100 text-amber-800 hover:bg-amber-100 border-none dark:bg-amber-900/40 dark:text-amber-300"
                  >
                    {reason}
                  </Badge>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Cadastrado em{" "}
                {format(new Date(match.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                {match.responsavelName && ` · ${match.responsavelName}`}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-amber-700 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/30 shrink-0"
              onClick={() => window.open(`/clientes/${match.id}`, "_blank")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      {matches.length > 2 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1"
        >
          {expanded ? (
            <><ChevronUp className="h-3 w-3" /> Mostrar menos</>
          ) : (
            <><ChevronDown className="h-3 w-3" /> Ver mais {matches.length - 2} registro(s)</>
          )}
        </button>
      )}
    </div>
  );
}
