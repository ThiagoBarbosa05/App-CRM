export interface ClientDebt {
  id: string;
  clientId: string;
  client: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    responsibleName?: string;
  };
  amount: string;
  description: string;
  dueDate: string;
  status: "pending" | "overdue" | "paid";
  createdAt: string;
}

export interface DashboardStats {
  totalClients: number;
  activeDeals: number;
  monthlyGoal: number;
  monthlyProgress: number;
  upcomingBirthdays: number;
  pendingDebts: number;
  overdueDebts: number;
}
