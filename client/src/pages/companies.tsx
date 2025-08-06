import { CompaniesManagement } from "@/components/companies-management";
import { useAuth } from "@/hooks/useAuth";

export default function Companies() {
  const { user } = useAuth();

  return (
    <div className="flex ">
      <CompaniesManagement currentUser={user} />
    </div>
  );
}
