
import { useState, Suspense } from "react";
import Sidebar from "@/components/sidebar";
import { FilesManagement } from "@/components/files-management";
import { useAuth } from "@/hooks/useAuth";

function FilesContent() {
  const { user } = useAuth();
  
  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Carregando usuário...</div>
      </div>
    );
  }

  return <FilesManagement currentUser={user} />;
}

export default function Files() {
  const [activeTab, setActiveTab] = useState("files");

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <Suspense 
            fallback={
              <div className="flex items-center justify-center h-96">
                <div className="text-lg">Carregando arquivos...</div>
              </div>
            }
          >
            <FilesContent />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
