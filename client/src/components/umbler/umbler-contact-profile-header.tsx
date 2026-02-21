import { CheckCircle2, User, Phone, Mail } from "lucide-react";

interface UmblerContactProfileHeaderProps {
  contact: any;
}

export function UmblerContactProfileHeader({
  contact,
}: UmblerContactProfileHeaderProps) {
  if (!contact) return null;

  return (
    <div className="bg-gradient-to-br from-blue-50 via-indigo-50/50 to-slate-50 dark:from-slate-800 dark:via-slate-800/80 dark:to-slate-900 rounded-xl p-6 shadow-sm border border-blue-100/50 dark:border-slate-700/50 relative overflow-hidden">
      {/* Decorative background blur */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 dark:bg-blue-400/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      
      <div className="flex flex-col sm:flex-row items-center sm:items-start space-x-0 sm:space-x-5 space-y-4 sm:space-y-0 relative z-10">
        {contact.profilePictureUrl ? (
          <div className="relative shrink-0">
            <img
              src={contact.profilePictureUrl}
              alt={contact.name || "Avatar"}
              className="h-24 w-24 sm:h-20 sm:w-20 rounded-full object-cover ring-4 ring-white dark:ring-slate-800 shadow-lg"
            />
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-slate-800 flex items-center justify-center shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
        ) : (
          <div className="h-24 w-24 sm:h-20 sm:w-20 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 flex items-center justify-center ring-4 ring-white dark:ring-slate-800 shadow-lg">
            <User className="h-10 w-10 text-white opacity-90" />
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-slate-800 flex items-center justify-center shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
        )}
        
        <div className="flex-1 min-w-0 text-center sm:text-left flex flex-col justify-center h-full">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2 truncate">
            {contact.name || "Contato Sem Nome"}
          </h2>
          <div className="space-y-2 inline-flex flex-col items-center sm:items-start">
            <div className="inline-flex items-center gap-2.5 bg-white/60 dark:bg-slate-900/40 px-3 py-1.5 rounded-md border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm">
              <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded">
                <Phone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 font-mono tracking-tight">
                {contact.phoneNumber}
              </span>
            </div>
            {contact.email && (
              <div className="inline-flex items-center gap-2.5 bg-white/60 dark:bg-slate-900/40 px-3 py-1.5 rounded-md border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm max-w-full">
                <div className="p-1 bg-indigo-100 dark:bg-indigo-900/30 rounded shrink-0">
                  <Mail className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-400 truncate">
                  {contact.email}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
