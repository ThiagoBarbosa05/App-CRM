import React from "react";
import { DealWithClient } from "@shared/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Edit,
  Trash2,
  Phone,
  Mail,
  Calendar,
  User,
  Building2,
  Clock,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  Target,
  MoreVertical,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DealCardProps {
  deal: DealWithClient;
  onEdit?: (deal: DealWithClient) => void;
  onDelete?: (deal: DealWithClient) => void;
  onClientClick?: (client: any) => void;
  onCompanyClick?: (company: any) => void;
  onAddInteraction?: (deal: DealWithClient) => void;
  onMoveToNextStage?: (deal: DealWithClient) => void;
  className?: string;
}

export default function DealCard({
  deal,
  onEdit,
  onDelete,
  onClientClick,
  onCompanyClick,
  onAddInteraction,
  onMoveToNextStage,
  className,
}: DealCardProps) {
  const formatPhone = (phone: string) => {
    if (!phone) return "";
    let d = phone.replace(/\D/g, "");
    if ((d.length === 13 || d.length === 12) && d.startsWith("55")) d = d.slice(2);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return phone;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getDaysInStage = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getClosingProbability = () => {
    // Simular probabilidade baseada no estágio
    const stageOrder = deal.stage?.order || 1;
    const totalStages = 5; // Assumindo 5 estágios típicos
    return Math.min(85, Math.max(15, (stageOrder / totalStages) * 100));
  };

  const getProgressByStage = () => {
    const stageOrder = deal.stage?.order || 1;
    const totalStages = 5;
    return (stageOrder / totalStages) * 100;
  };

  return (
    <Card
      className={cn(
        "hover:shadow-lg transition-all dark:bg-slate-800/25 duration-200 border-l-4 border border-gray-200 dark:border-slate-700 dark:hover:border-slate-600 hover:border-gray-300",
        className,
      )}
      style={{ borderLeftColor: deal.stage?.color || "#6B7280" }}
    >
      {/* Header do Card */}
      <CardHeader className="pb-3 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
          <div className="flex-1 space-y-2 w-full sm:w-auto min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <h3 className="font-semibold text-base sm:text-lg text-gray-900 dark:text-slate-100 line-clamp-2 min-w-0 flex-1">
                {deal.title || "Negócio sem título"}
              </h3>
              <Badge
                variant="outline"
                className="text-xs whitespace-nowrap self-start dark:text-slate-200 sm:self-center"
                style={{
                  borderColor:
                    deal.stage?.color || "#6B7280 dark:border-slate-600",
                  color: deal.stage?.color || "#6B7280 dark:text-slate-200",
                }}
              >
                {deal.stage?.name || "Sem estágio"}
              </Badge>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <span className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(parseFloat(deal.value))}
              </span>
              <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-500 dark:text-slate-400">
                <div className="flex h-4 w-4 items-center justify-center rounded bg-green-100 dark:bg-green-900">
                  <Target className="h-3 w-3 text-green-600 dark:text-green-400" />
                </div>
                <span>{Math.round(getClosingProbability())}% chance</span>
              </div>
            </div>

            {/* Responsável pelo negócio */}
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-slate-400">
              <div className="flex h-4 w-4 items-center justify-center rounded bg-gray-100 dark:bg-slate-700">
                <User className="h-3 w-3 text-gray-600 dark:text-slate-400" />
              </div>
              <span className="font-medium">Responsável:</span>
              <span className="truncate">
                {deal.assignedUser?.name || "Não definido"}
              </span>
            </div>
          </div>

          <div className="flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {onEdit && (
                  <DropdownMenuItem
                    onClick={() => onEdit(deal)}
                    className="cursor-pointer"
                  >
                    <div className="flex h-4 w-4 items-center justify-center rounded bg-blue-100 dark:bg-slate-800 mr-2">
                      <Edit className="h-3 w-3 text-blue-600" />
                    </div>
                    Editar
                  </DropdownMenuItem>
                )}
                {onAddInteraction && (
                  <DropdownMenuItem
                    onClick={() => onAddInteraction(deal)}
                    className="cursor-pointer"
                  >
                    <div className="flex h-4 w-4 items-center justify-center rounded bg-green-100 mr-2">
                      <MessageSquare className="h-3 w-3 text-green-600" />
                    </div>
                    Adicionar Interação
                  </DropdownMenuItem>
                )}
                {onMoveToNextStage && (
                  <DropdownMenuItem
                    onClick={() => onMoveToNextStage(deal)}
                    className="cursor-pointer"
                  >
                    <div className="flex h-4 w-4 items-center justify-center rounded bg-orange-100 mr-2">
                      <ArrowRight className="h-3 w-3 text-orange-600" />
                    </div>
                    Avançar Estágio
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(deal)}
                    className="text-red-600 focus:text-red-600 cursor-pointer"
                  >
                    <div className="flex h-4 w-4 items-center justify-center rounded bg-red-100 dark:bg-slate-800 mr-2">
                      <Trash2 className="h-3 w-3 text-red-600" />
                    </div>
                    Excluir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Progresso Visual */}
        <div className="space-y-2 mt-4">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-4 w-4 items-center justify-center rounded bg-blue-100 dark:bg-blue-900">
                <TrendingUp className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-gray-600 dark:text-slate-400">
                Progresso no funil
              </span>
            </div>
            <span className="font-medium text-gray-900 dark:text-slate-100">
              {Math.round(getProgressByStage())}%
            </span>
          </div>
          <Progress value={getProgressByStage()} className="h-2" />
        </div>

        {/* Botão Registrar Interação */}
        {onAddInteraction && (
          <div className="pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddInteraction(deal)}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700 transition-colors"
            >
              <div className="flex h-4 w-4 items-center justify-center rounded bg-blue-500 dark:bg-blue-900 mr-2">
                <MessageSquare className="h-3 w-3 text-white" />
              </div>
              <span className="hidden sm:inline">Registrar Interação</span>
              <span className="sm:hidden">Interação</span>
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-6">
        {/* Informações do Cliente/Empresa */}
        <div className="flex items-center gap-3 p-3 sm:p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700">
          <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
            <AvatarFallback className="bg-primary text-white text-xs sm:text-sm">
              {deal.client ? (
                getInitials(deal.client.name)
              ) : deal.companyId ? (
                <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                "?"
              )}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-4 w-4 items-center justify-center rounded bg-gray-100 dark:bg-slate-700 flex-shrink-0">
                {deal.client ? (
                  <User className="h-3 w-3 text-gray-600 dark:text-slate-400" />
                ) : (
                  <Building2 className="h-3 w-3 text-gray-600 dark:text-slate-400" />
                )}
              </div>
              {deal.client ? (
                <button
                  onClick={() => onClientClick?.(deal.client)}
                  className="font-medium text-sm sm:text-base text-gray-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline truncate transition-colors"
                >
                  {deal.client.name}
                </button>
              ) : deal.company ? (
                <button
                  onClick={() => onCompanyClick?.(deal.company)}
                  className="font-medium text-sm sm:text-base text-gray-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline truncate transition-colors"
                >
                  {deal.company.nomeFantasia}
                </button>
              ) : (
                <span className="font-medium text-sm sm:text-base text-gray-500 dark:text-slate-400 truncate">
                  Sem cliente/empresa
                </span>
              )}
            </div>

            {deal.client && (
              <div className="space-y-1">
                {deal.client.phone && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-slate-400">
                    <div className="flex h-3 w-3 items-center justify-center rounded bg-green-100 dark:bg-green-900 flex-shrink-0">
                      <Phone className="h-2 w-2 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="truncate">
                      {formatPhone(deal.client.phone)}
                    </span>
                  </div>
                )}
                {deal.client.email && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-slate-400">
                    <div className="flex h-3 w-3 items-center justify-center rounded bg-blue-100 dark:bg-blue-900 flex-shrink-0">
                      <Mail className="h-2 w-2 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="truncate">{deal.client.email}</span>
                  </div>
                )}
              </div>
            )}

            {deal.company && (
              <div className="space-y-1">
                {deal.company.phone && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-slate-200">
                    <div className="flex h-3 w-3 items-center justify-center rounded bg-green-100 dark:bg-green-900 flex-shrink-0">
                      <Phone className="h-2 w-2 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="truncate">
                      {formatPhone(deal.company.phone)}
                    </span>
                  </div>
                )}
                {deal.company.email && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-slate-200">
                    <div className="flex h-3 w-3 items-center justify-center rounded bg-blue-100 dark:bg-blue-900 flex-shrink-0">
                      <Mail className="h-2 w-2 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="truncate">{deal.company.email}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Detalhes do Negócio */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-gray-600 dark:text-slate-200">
              <div className="flex h-4 w-4 items-center justify-center rounded bg-blue-100 dark:bg-blue-900 flex-shrink-0 mt-0.5">
                <Calendar className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 dark:text-slate-200">
                  Criado
                </div>
                <div className="truncate">
                  {formatDate(deal.createdAt.toString())}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 text-gray-600 dark:text-slate-200">
              <div className="flex h-4 w-4 items-center justify-center rounded bg-gray-100 dark:bg-gray-800 flex-shrink-0 mt-0.5">
                <User className="h-3 w-3 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 dark:text-slate-200">
                  Responsável
                </div>
                <div className="truncate">
                  {deal.assignedUser?.name || "Não definido"}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2 text-gray-600 dark:text-slate-200">
              <div className="flex h-4 w-4 items-center justify-center rounded bg-orange-100 dark:bg-orange-900 flex-shrink-0 mt-0.5">
                <Clock className="h-3 w-3 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 dark:text-slate-200">
                  Tempo no estágio
                </div>
                <div className="truncate">
                  {getDaysInStage(deal.createdAt.toString())} dias
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 text-gray-600 dark:text-slate-200">
              <div className="flex h-4 w-4 items-center justify-center rounded bg-purple-100 dark:bg-purple-900 flex-shrink-0 mt-0.5">
                <TrendingUp className="h-3 w-3 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 dark:text-slate-200">
                  Funil
                </div>
                <div className="truncate">
                  {deal.funnel?.name || "Não definido"}
                </div>
              </div>
            </div>

            {/* Telefone da empresa ou cliente */}
            {(deal.client?.phone || deal.company?.phone) && (
              <div className="flex items-start gap-2 text-gray-600 dark:text-slate-200">
                <div className="flex h-4 w-4 items-center justify-center rounded bg-green-100 dark:bg-green-900 flex-shrink-0 mt-0.5">
                  <Phone className="h-3 w-3 text-green-600 dark:text-green-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900 dark:text-slate-200">
                    Celular
                  </div>
                  <div className="truncate">
                    {formatPhone(
                      deal.client?.phone || deal.company?.phone || "",
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Informações Adicionais */}
        {deal.notes && (
          <div className="p-3 sm:p-4 bg-blue-50  dark:bg-blue-900/50 dark:border-l-blue-700 dark:border-slate-800 border-l-4 border-l-blue-200 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-4 w-4 items-center justify-center rounded bg-blue-100 dark:bg-blue-900">
                <MessageSquare className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-100">
                Observações
              </div>
            </div>
            <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-100 line-clamp-3 pl-6">
              {deal.notes}
            </p>
          </div>
        )}

        {/* Última Interação */}
        <div className="p-3 sm:p-4 border rounded-lg bg-gray-50 dark:bg-gray-900/50 dark:border-gray-700 border-gray-200">
          <div className="flex items-center justify-between text-xs sm:text-sm mb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-4 w-4 items-center justify-center rounded bg-green-100 dark:bg-green-900">
                <Clock className="h-3 w-3 text-green-600 dark:text-green-400" />
              </div>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                Última interação
              </span>
            </div>
            <span className="text-gray-500 text-xs dark:text-gray-400">
              Há 2 dias
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 pl-6">
            Ligação realizada - Cliente interessado
          </p>
        </div>

        {/* Ações Rápidas */}
        <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-gray-100">
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(deal)}
              className="flex-1 text-xs sm:text-sm border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors"
            >
              <div className="flex h-3 w-3 items-center justify-center rounded bg-blue-100 dark:bg-slate-900 mr-1.5">
                <Edit className="h-2 w-2 text-blue-600 dark:text-blue-400" />
              </div>
              Editar
            </Button>
          )}

          {onAddInteraction && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddInteraction(deal)}
              className="flex-1 text-xs sm:text-sm border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors"
            >
              <div className="flex h-3 w-3 items-center justify-center rounded bg-green-100 mr-1.5">
                <MessageSquare className="h-2 w-2 text-green-600" />
              </div>
              <span className="hidden sm:inline">Interação</span>
              <span className="sm:hidden">Interação</span>
            </Button>
          )}

          {onMoveToNextStage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onMoveToNextStage(deal)}
              className="flex-1 text-xs sm:text-sm border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors"
            >
              <div className="flex h-3 w-3 items-center justify-center rounded bg-orange-100 mr-1.5">
                <ArrowRight className="h-2 w-2 text-orange-600" />
              </div>
              Avançar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
