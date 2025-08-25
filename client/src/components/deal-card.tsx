
import React from "react";
import { DealWithClient } from "@shared/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  TrendingUp
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

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

  return (
    <Card className={cn("hover:shadow-lg transition-shadow duration-200", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-gray-900 mb-1">
              {deal.title || "Negócio sem título"}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-green-600">
                {formatCurrency(parseFloat(deal.value))}
              </span>
              <Badge variant="outline" className="text-xs">
                {deal.funnel?.name || "Funil não definido"}
              </Badge>
            </div>
          </div>
          
          <div className="flex gap-1">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(deal);
                }}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(deal);
                }}
                className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Cliente/Empresa Info */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-white text-sm">
              {deal.client ? getInitials(deal.client.name) : 
               deal.companyId ? <Building2 className="h-4 w-4" /> : "?"}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
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
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                {deal.client.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    <span>{formatPhone(deal.client.phone)}</span>
                  </div>
                )}
                {deal.client.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{deal.client.email}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Estágio atual */}
        {deal.stage && (
          <div className="flex items-center justify-between p-2 border rounded">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: deal.stage.color || '#6B7280' }}
              />
              <span className="text-sm font-medium">{deal.stage.name}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              <span>{getDaysInStage(deal.createdAt)} dias</span>
            </div>
          </div>
        )}

        {/* Informações adicionais */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="h-4 w-4" />
            <span>Criado: {formatDate(deal.createdAt)}</span>
          </div>
          
          <div className="flex items-center gap-2 text-gray-600">
            <User className="h-4 w-4" />
            <span>Responsável: {deal.assignedUser?.name || "Não definido"}</span>
          </div>
        </div>

        {/* Observações */}
        {deal.notes && (
          <div className="p-2 bg-blue-50 border-l-4 border-blue-200 rounded">
            <p className="text-sm text-gray-700 line-clamp-2">{deal.notes}</p>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2 pt-2 border-t">
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
          
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-gray-500"
          >
            <TrendingUp className="h-3 w-3 mr-1" />
            85%
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
