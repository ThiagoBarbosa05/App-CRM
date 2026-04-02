import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

interface ConnectSalesHeaderProps {
  onImport: () => void;
}

export function ConnectSalesHeader({ onImport }: ConnectSalesHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vendas Connect</h1>
        <p className="text-sm text-slate-500 mt-1">
          Histórico de vendas importado da plataforma Connect
        </p>
      </div>
      <Button
        onClick={onImport}
        className="bg-violet-600 hover:bg-violet-700 gap-2"
      >
        <Upload className="h-4 w-4" />
        Importar CSV
      </Button>
    </div>
  );
}
