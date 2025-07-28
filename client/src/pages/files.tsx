
import Sidebar from "@/components/sidebar";
import { FilesManagement } from "@/components/files-management";
import { useAuth } from "@/hooks/useAuth";

export default function Files() {
  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <FilesManagement currentUser={user} />
        </div>
      </main>
    </div>
  );
}
