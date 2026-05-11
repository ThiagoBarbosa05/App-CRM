import { CompaniesManagement } from "@/components/companies-management";
import { useAuth } from "@/hooks/useAuth";

export default function Companies() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 pb-10">
      <CompaniesManagement currentUser={user} />
    </div>
  );
}
