import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag, MessageSquare } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

// Import extracted components
import { UmblerContactProfileHeader } from "@/components/umbler/umbler-contact-profile-header";
import { UmblerContactTagsTab } from "@/components/umbler/umbler-contact-tags-tab";
import { UmblerContactConversationsTab } from "@/components/umbler/umbler-contact-conversations-tab";

interface UmblerContactDetailsProps {
  contact: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UmblerContactDetails({
  contact,
  open,
  onOpenChange,
}: UmblerContactDetailsProps) {
  const [activeTab, setActiveTab] = useState("details");

  if (!contact) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[540px] lg:w-[640px] p-0 overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950">
        <SheetHeader className="px-6 py-5 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl z-20">
          <SheetTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Detalhes do Contato
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-6 space-y-6">
            {/* Header Profile Card */}
            <UmblerContactProfileHeader contact={contact} />

            <Tabs 
              value={activeTab} 
              onValueChange={setActiveTab} 
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 bg-slate-200/50 dark:bg-slate-800/50 p-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-inner mb-6">
                <TabsTrigger
                  value="details"
                  className="data-[state=active]:bg-white dark:text-slate-300 dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm rounded-lg transition-all py-2 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 font-medium"
                >
                  <Tag className="h-4 w-4 mr-2" />
                  Etiquetas
                </TabsTrigger>
                <TabsTrigger
                  value="conversations"
                  className="data-[state=active]:bg-white dark:text-slate-300 dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm rounded-lg transition-all py-2 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 font-medium"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Histórico
                </TabsTrigger>
              </TabsList>

              <div className="relative min-h-[400px]">
                <AnimatePresence mode="wait">
                  {activeTab === "details" ? (
                    <motion.div
                      key="details-tab"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute inset-0"
                    >
                       <UmblerContactTagsTab contactId={contact.id} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="conversations-tab"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute inset-0"
                    >
                       <UmblerContactConversationsTab contactPhoneNumber={contact.phoneNumber} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Tabs>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
