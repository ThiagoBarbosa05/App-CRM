import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Target, TrendingUp, Calendar, Phone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatPhone, formatDate } from "@/lib/utils";
import { useState, useEffect } from "react";
import BirthdayCakeAnimation from "@/components/birthday-cake-animation";

export default function VendorDashboard() {
  const { user } = useAuth();
  const [showBirthdayAnimation, setShowBirthdayAnimation] = useState(false);
  const [birthdayClient, setBirthdayClient] = useState<string>("");

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients", user?.id, user?.role],
    queryFn: async () => {
      const response = await fetch(
        `/api/clients?userId=${user?.id}&userRole=${user?.role}`
      );
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
    enabled: !!user,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ["/api/deals", user?.id, user?.role],
    queryFn: async () => {
      const response = await fetch(
        `/api/deals?userId=${user?.id}&userRole=${user?.role}`
      );
      if (!response.ok) throw new Error("Failed to fetch deals");
      return response.json();
    },
    enabled: !!user,
  });

  const { data: upcomingBirthdays = [] } = useQuery({
    queryKey: ["/api/birthdays/upcoming", user?.id, user?.role],
    queryFn: async () => {
      const response = await fetch("/api/birthdays/upcoming", {
        headers: {
        },
      });
      if (!response.ok) throw new Error("Failed to fetch birthdays");
      return response.json();
    },
    enabled: !!user,
  });

  // Filtrar aniversários apenas dos clientes do vendedor
  const myClientsBirthdays = (upcomingBirthdays as any[]).filter(
    (client: any) => client.responsavelId === user?.id
  );

  // Verificar se há aniversários hoje
  const todaysBirthdays = myClientsBirthdays.filter((client: any) => {
    if (!client.birthday) return false;

    const today = new Date();
    let birthday: Date;

    // Parse different date formats
    if (client.birthday.match(/^\d{4}-\d{2}-\d{2}$/)) {
      birthday = new Date(client.birthday);
    } else if (client.birthday.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [day, month, year] = client.birthday.split("/");
      birthday = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      return false;
    }

    return (
      today.getDate() === birthday.getDate() &&
      today.getMonth() === birthday.getMonth()
    );
  });

  // Mostrar animação para aniversários de hoje
  useEffect(() => {
    if (todaysBirthdays.length > 0 && !showBirthdayAnimation) {
      // Mostrar animação após 2 segundos do carregamento da página
      const timer = setTimeout(() => {
        setBirthdayClient(todaysBirthdays[0].name);
        setShowBirthdayAnimation(true);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [todaysBirthdays, showBirthdayAnimation]);

  // Calcular estatísticas
  const totalClients = (clients as any[]).length;
  const totalDealsValue = (deals as any[]).reduce(
    (sum: number, deal: any) => sum + parseFloat(deal.value || 0),
    0
  );
  const activeDeals = (deals as any[]).filter(
    (deal: any) => deal.stage !== "fechamento"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <User className="h-6 w-6 text-wine-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Olá, {user?.name}!
          </h1>
          <p className="text-gray-600">
            Aqui está um resumo das suas atividades
          </p>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meus Clientes</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClients}</div>
            <p className="text-xs text-muted-foreground">
              Clientes sob sua responsabilidade
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Negócios Ativos
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeDeals}</div>
            <p className="text-xs text-muted-foreground">
              Negócios em andamento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Valor Total em Negócios
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalDealsValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Valor total dos seus negócios
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Aniversários Próximos */}
      {myClientsBirthdays.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-wine-600" />
              Aniversários Próximos dos Seus Clientes
            </CardTitle>
            <CardDescription>
              Clientes que fazem aniversário nos próximos dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {myClientsBirthdays.slice(0, 5).map((client: any) => {
                const isToday = todaysBirthdays.some((b) => b.id === client.id);
                return (
                  <div
                    key={client.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      isToday
                        ? "bg-wine-50 border-2 border-wine-200 animate-pulse"
                        : "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {client.name}
                          {isToday && <span className="text-xl">🎂</span>}
                        </p>
                        <p className="text-sm text-gray-600">
                          {client.birthday && formatDate(client.birthday)}
                          {isToday && (
                            <span className="ml-2 text-wine-600 font-semibold">
                              Hoje é o grande dia!
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://wa.me/${client.phone.replace(
                          /\D/g,
                          ""
                        )}?text=Parabéns, ${
                          client.name
                        }! Feliz aniversário! 🎉🎂`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-green-600 hover:text-green-800 text-sm"
                      >
                        <Phone className="h-4 w-4" />
                        WhatsApp
                      </a>
                      {isToday && (
                        <button
                          onClick={() => {
                            setBirthdayClient(client.name);
                            setShowBirthdayAnimation(true);
                          }}
                          className="text-wine-600 hover:text-wine-800 text-sm font-medium"
                        >
                          🎉 Ver Animação
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Birthday Cake Animation */}
      <BirthdayCakeAnimation
        clientName={birthdayClient}
        show={showBirthdayAnimation}
        onClose={() => setShowBirthdayAnimation(false)}
      />
    </div>
  );
}
