import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RegistrationQualityList } from "@/components/clients/registration-quality-list";
import { useAuth } from "@/hooks/useAuth";

interface UserOption {
  id: string;
  name: string;
  isActive: string;
}

export default function ClientsRegistrationQualityPage() {
  const { user } = useAuth();
  const isAdminOrManager = user?.role === "admin" || user?.role === "gerente";

  const [selectedSellerId, setSelectedSellerId] = useState<string>("all");

  const { data: usersList = [] } = useQuery<UserOption[]>({
    queryKey: ["/api/users"],
    enabled: isAdminOrManager,
    select: (users) =>
      users
        .filter((u) => u.isActive === "true")
        .sort((a, b) => a.name.localeCompare(b.name)),
  });

  const responsavelId = isAdminOrManager
    ? selectedSellerId === "all"
      ? undefined
      : selectedSellerId
    : undefined;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon icon={ClipboardList} color="text-amber-600" bgColor="bg-amber-50 dark:bg-amber-900/20" />
          <PageHeader.Text>
            <PageHeader.Title>Clientes para atualizar cadastro</PageHeader.Title>
            <PageHeader.Description>
              Compram bem ou com frequência, mas o cadastro está incompleto
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>

        {isAdminOrManager && (
          <PageHeader.Actions>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" />
              <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                <SelectTrigger className="w-52 rounded-lg text-sm font-medium">
                  <SelectValue placeholder="Selecionar vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-semibold">
                    Todos os vendedores
                  </SelectItem>
                  {usersList.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </PageHeader.Actions>
        )}
      </PageHeader>

      <RegistrationQualityList responsavelId={responsavelId} />
    </div>
  );
}
