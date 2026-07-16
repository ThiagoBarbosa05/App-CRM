import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterX } from "lucide-react";

export interface OrdersHistoryFiltersValue {
  status: string;
  from: string;
  to: string;
}

interface OrdersHistoryFiltersProps {
  value: OrdersHistoryFiltersValue;
  onChange: (value: OrdersHistoryFiltersValue) => void;
}

const EMPTY_FILTERS: OrdersHistoryFiltersValue = { status: "todas", from: "", to: "" };

export function OrdersHistoryFilters({ value, onChange }: OrdersHistoryFiltersProps) {
  const hasActiveFilters = value.status !== "todas" || value.from || value.to;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-4 pt-6">
        <div className="min-w-[160px] space-y-2">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={value.status}
            onValueChange={(status) => onChange({ ...value, status })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="aberta">Aberta</SelectItem>
              <SelectItem value="fechada">Fechada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">De</Label>
          <Input
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Até</Label>
          <Input
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
            <FilterX className="mr-1.5 h-3.5 w-3.5" />
            Limpar filtros
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export { EMPTY_FILTERS };
