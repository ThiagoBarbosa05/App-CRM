import { Menu } from "lucide-react";
import { AppSidebar } from "./sidebar";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BlingStatusBanner } from "@/components/bling-status-banner";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar-collapsed") === "true",
  );

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 bg-white dark:bg-slate-950 shadow-lg
          transform transition-all duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:inset-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          ${collapsed ? "w-16" : "w-64"}
        `}
      >
        <AppSidebar
          onCloseSidebar={() => setSidebarOpen(false)}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Bling connection status banner (admin/gerente only) */}
        <BlingStatusBanner />

        {/* Mobile header */}
        <header className="lg:hidden flex items-center p-4 bg-white dark:bg-slate-950 shadow-sm border-b border-slate-200 dark:border-slate-800 gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5 text-slate-700 dark:text-slate-300" />
          </Button>
          <img
            src="/logo-grand-cru-red%20(1).webp"
            alt="Grand Cru"
            className="h-7 object-contain"
          />
        </header>

        {/* Page content */}
        <main className="flex-1 bg-slate-50 dark:bg-slate-900 overflow-y-auto overflow-x-hidden p-5 lg:p-6 relative">
          <AnimatePresence mode="popLayout">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
