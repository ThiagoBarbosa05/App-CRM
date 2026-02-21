import { CompaniesManagement } from "@/components/companies-management";
import { useAuth } from "@/hooks/useAuth";

export default function Companies() {
  const { user } = useAuth();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen">
      <CompaniesManagement currentUser={user} />
    </div>
  );
}
