
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
  MoreVertical
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
  onAddInteraction?: (deal: DealWithClient) => void;
  onMoveToNextStage?: (deal: DealWithClient) => void;
  className?: string;
}

export default function DealCard({
  deal,
  onEdit,
  onDelete,
  onClientClick,
  onAddInteraction,
  onMoveToNextStage,
  className
}: DealCardProps) {
  const formatPhone = (phone: string) => {
    if (!phone) return "";
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length === 11) {
      return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 7)}-${cleanPhone.slice(7)}`;
    }
    return phone;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
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
    <Card className={cn("hover:shadow-lg transition-all duration-200 border-l-4", className)} 
          style={{ borderLeftColor: deal.stage?.color || '#6B7280' }}>
      
      {/* Header do Card */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg text-gray-900 line-clamp-2">
                {deal.title || "Negócio sem título"}
              </h3>
              <Badge 
                variant="outline" 
                className="text-xs whitespace-nowrap"
                style={{ 
                  borderColor: deal.stage?.color || '#6B7280',
                  color: deal.stage?.color || '#6B7280'
                }}
              >
                {deal.stage?.name || "Sem estágio"}
              </Badge>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-green-600">
                {formatCurrency(parseFloat(deal.value))}
              </span>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Target className="h-4 w-4" />
                <span>{Math.round(getClosingProbability())}% chance</span>
              </div>
            </div>
            
            {/* Responsável pelo negócio */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="h-4 w-4" />
              <span className="font-medium">Responsável:</span>
              <span>{deal.assignedUser?.name || "Não definido"}</span>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(deal)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
              )}
              {onAddInteraction && (
                <DropdownMenuItem onClick={() => onAddInteraction(deal)}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Adicionar Interação
                </DropdownMenuItem>
              )}
              {onMoveToNextStage && (
                <DropdownMenuItem onClick={() => onMoveToNextStage(deal)}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Avançar Estágio
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem 
                  onClick={() => onDelete(deal)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Progresso Visual */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Progresso no funil</span>
            <span className="font-medium">{Math.round(getProgressByStage())}%</span>
          </div>
          <Progress value={getProgressByStage()} className="h-2" />
        </div>

        {/* Botão Registrar Interação */}
        {onAddInteraction && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddInteraction(deal)}
              className="w-full bg-black hover:bg-gray-800 text-white border-black"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Registrar Interação
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Informações do Cliente/Empresa */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary text-white text-sm">
              {deal.client ? getInitials(deal.client.name) : 
               deal.companyId ? <Building2 className="h-5 w-5" /> : "?"}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              {deal.client ? <User className="h-4 w-4 text-gray-500" /> : <Building2 className="h-4 w-4 text-gray-500" />}
              <button
                onClick={() => deal.client && onClientClick?.(deal.client)}
                className="font-medium text-gray-900 hover:text-primary underline truncate"
              >
                {deal.client?.name || `Empresa ID: ${deal.companyId}` || "Sem cliente"}
              </button>
            </div>
            
            {deal.client && (
              <div className="space-y-1">
                {deal.client.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-3 w-3" />
                    <span>{formatPhone(deal.client.phone)}</span>
                  </div>
                )}
                {deal.client.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{deal.client.email}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Detalhes do Negócio */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="h-4 w-4" />
              <div>
                <div className="font-medium">Criado</div>
                <div>{formatDate(deal.createdAt)}</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-gray-600">
              <User className="h-4 w-4" />
              <div>
                <div className="font-medium">Responsável</div>
                <div className="truncate">{deal.assignedUser?.name || "Não definido"}</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="h-4 w-4" />
              <div>
                <div className="font-medium">Tempo no estágio</div>
                <div>{getDaysInStage(deal.createdAt)} dias</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-gray-600">
              <TrendingUp className="h-4 w-4" />
              <div>
                <div className="font-medium">Funil</div>
                <div className="truncate">{deal.funnel?.name || "Não definido"}</div>
              </div>
            </div>
            
            {/* Telefone da empresa ou cliente */}
            {(deal.client?.phone || deal.company?.phone) && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="h-4 w-4" />
                <div>
                  <div className="font-medium">Telefone</div>
                  <div className="truncate">
                    {formatPhone(deal.client?.phone || deal.company?.phone || "")}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Informações Adicionais */}
        {deal.notes && (
          <div className="p-3 bg-blue-50 border-l-4 border-blue-200 rounded">
            <div className="text-sm font-medium text-blue-900 mb-1">Observações</div>
            <p className="text-sm text-blue-800 line-clamp-3">{deal.notes}</p>
          </div>
        )}

        {/* Última Interação */}
        <div className="p-2 border rounded-lg bg-gray-50">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Última interação</span>
            <span className="text-gray-500">Há 2 dias</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">Ligação realizada - Cliente interessado</p>
        </div>

        {/* Ações Rápidas */}
        <div className="flex gap-2 pt-2 border-t">
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(deal)}
              className="flex-1 text-xs"
            >
              <Edit className="h-3 w-3 mr-1" />
              Editar
            </Button>
          )}
          
          {onAddInteraction && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddInteraction(deal)}
              className="flex-1 text-xs"
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              Interação
            </Button>
          )}
          
          {onMoveToNextStage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onMoveToNextStage(deal)}
              className="flex-1 text-xs"
            >
              <ArrowRight className="h-3 w-3 mr-1" />
              Avançar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
