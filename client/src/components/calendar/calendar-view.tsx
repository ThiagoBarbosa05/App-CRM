import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  CalendarIcon, 
  Gift, 
  Phone, 
  Mail, 
  User, 
  MessageSquare, 
  Bell 
} from "lucide-react";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import type { Client } from "@shared/schema";
import { formatDate } from "@/lib/utils";

interface CalendarViewProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  clientsForSelectedDate: Client[];
  birthdayMap: Map<string, Client[]>;
  users: any[];
  onStartBot: (client: Client) => void;
  onCreateReminder: (client: Client) => void;
}

export function CalendarView({
  selectedDate,
  onSelectDate,
  clientsForSelectedDate,
  birthdayMap,
  users,
  onStartBot,
  onCreateReminder,
}: CalendarViewProps) {
  const dayModifiers = {
    birthday: (date: Date) => {
      const key = format(date, "yyyy-MM-dd");
      return (birthdayMap.get(key) || []).length > 0;
    },
  };

  const dayModifiersClassNames = {
    birthday: "bg-accent/60 text-primary font-bold relative after:content-['🎂'] after:absolute after:bottom-0 after:right-0 after:text-[10px]",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
      {/* Calendar Card */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-slate-900">
        <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                Calendário
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 font-normal">
                Navegue pelos aniversários
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center p-4 bg-slate-50/50 dark:bg-slate-800/20">
          <UICalendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && onSelectDate(date)}
            locale={ptBR}
            modifiers={dayModifiers}
            modifiersClassNames={dayModifiersClassNames}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm w-full"
            classNames={{
              months: "flex flex-col w-full",
              month: "w-full",
              caption: "flex justify-center pt-1 relative items-center mb-4",
              caption_label: "text-base font-semibold",
              nav: "space-x-1 flex items-center",
              nav_button: "h-9 w-9 bg-transparent p-0 opacity-70 hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center justify-center",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse",
              head_row: "flex w-full",
              head_cell: "text-slate-500 dark:text-slate-400 font-medium text-sm text-center flex-1",
              row: "flex w-full mt-1",
              cell: "flex-1 h-10 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
              day: "h-10 w-full p-0 font-normal aria-selected:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center justify-center",
              day_selected: "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-lg",
              day_today: "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold",
              day_outside: "text-slate-400 dark:text-slate-600 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
              day_disabled: "text-slate-300 dark:text-slate-700 opacity-50",
              day_hidden: "invisible",
            }}
          />
        </CardContent>
      </Card>

      {/* Selected Date Details Card */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-slate-900 flex flex-col lg:max-h-[560px]">
        <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
              <Gift className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold text-slate-900 dark:text-white break-words">
                {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 font-normal">
                {format(selectedDate, "yyyy", { locale: ptBR })}
              </div>
            </div>
            <Badge variant="secondary" className="bg-accent text-primary border border-border">
              {clientsForSelectedDate.length} {clientsForSelectedDate.length === 1 ? 'Aniversariante' : 'Aniversariantes'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-0">
          <AnimatePresence mode="wait">
            {clientsForSelectedDate.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 px-6 text-center h-full"
              >
                <div className="h-16 w-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <Gift className="h-8 w-8 text-slate-200 dark:text-slate-700" />
                </div>
                <h3 className="text-slate-900 dark:text-white font-bold text-lg">Nenhum aniversário</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-[200px]">Não há aniversariantes registrados para esta data.</p>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 space-y-4"
              >
                {clientsForSelectedDate.map((client) => (
                  <ClientBirthdayCard
                    key={client.id}
                    client={client}
                    users={users}
                    onStartBot={onStartBot}
                    onCreateReminder={onCreateReminder}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}

function ClientBirthdayCard({ 
  client, 
  users, 
  onStartBot, 
  onCreateReminder 
}: { 
  client: Client; 
  users: any[]; 
  onStartBot: (client: Client) => void;
  onCreateReminder: (client: Client) => void;
}) {
  const birthdayDate = parseISO(client.birthday!);
  const age = new Date().getFullYear() - birthdayDate.getFullYear();
  const responsible = users.find(u => u.id === client.responsavelId)?.name || 'Não atribuído';

  return (
    <div className="group relative p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:shadow-lg hover:border-primary/30 transition-all duration-300">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
          <Gift className="h-6 w-6" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 dark:text-white text-lg break-words max-w-full mb-1">
            {client.name}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-none px-2 py-0 h-5 text-[10px] uppercase font-bold tracking-wider">
              {age} ANOS
            </Badge>
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <User className="h-3 w-3" />
              {responsible}
            </span>
          </div>
          
          <div className="space-y-2">
            {client.phone && (
              <a href={`tel:${client.phone}`} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-primary transition-colors break-all">
                <Phone className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {client.phone}
              </a>
            )}
            {client.email && (
              <a href={`mailto:${client.email}`} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-primary transition-colors break-all">
                <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {client.email}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1 min-w-[110px] rounded-xl h-9 text-xs border-slate-200 dark:border-slate-800 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 dark:hover:text-green-400 gap-2"
          onClick={() => onStartBot(client)}
        >
          <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1 min-w-[110px] rounded-xl h-9 text-xs border-slate-200 dark:border-slate-800 hover:bg-accent hover:text-primary gap-2"
          onClick={() => window.open(`tel:${client.phone}`, '_self')}
        >
          <Phone className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Ligar
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1 min-w-[110px] rounded-xl h-9 text-xs border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 gap-2"
          onClick={() => window.open(`mailto:${client.email}`, '_blank')}
        >
          <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Email
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1 min-w-[110px] rounded-xl h-9 text-xs border-slate-200 dark:border-slate-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400 gap-2"
          onClick={() => onCreateReminder(client)}
        >
          <Bell className="h-3.5 w-3.5" /> Lembrete
        </Button>
      </div>
    </div>
  );
}
