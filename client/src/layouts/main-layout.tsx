import { Menu, Wine } from "lucide-react";
import { AppSidebar } from "./sidebar";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { BlingStatusBanner } from "@/components/bling-status-banner";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-950 shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <AppSidebar onCloseSidebar={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Bling connection status banner (admin/gerente only) */}
        <BlingStatusBanner />

        {/* Mobile header */}
        <header className="lg:hidden flex items-center p-4 bg-white dark:bg-slate-950 shadow-sm border-b border-slate-200 dark:border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6 text-slate-700 dark:text-slate-300" />
          </Button>
          <div className="flex text-xl font-semibold items-center gap-2 text-slate-900 dark:text-slate-100">
            <Wine className="text-[#7c3aed] dark:text-purple-400" />
            CRM - Grand Cru
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 bg-slate-100 dark:bg-slate-900 overflow-y-auto p-5 lg:p-6 relative">
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
  // return (
  //   <div className="w-full min-h-screen relative flex flex-col sm:flex-row  items-start">
  //     <header className="py-5 sm:hidden w-full pl-10 border-b border-gray-300">
  //       <div className="flex pl-10 text-xl font-semibold  items-center gap-2">
  //         <Wine className="text-[#7c3aed]" />
  //         CRM - Grand Cru
  //       </div>
  //     </header>
  //     <AppSidebar />
  //     <main className="p-5 overflow-auto">{children}</main>
  //   </div>
  // );
}
