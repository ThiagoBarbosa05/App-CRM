import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Wine } from "lucide-react";

export function AppSidebar() {
    return (
        <aside className="fixed border-r left-0 p-5 top-0 bottom-0 w-64 bg-white">
            <div className="flex text-xl font-semibold  items-center gap-2">
                <Wine className="text-[#7c3aed]" />
                CRM - Grand Cru
            </div>
            <div className="mt-5 flex bg-purple-100 items-start p-2 rounded-md gap-2">
                <div className="bg-purple-50 rounded-full p-1 flex items-center justify-center">
                    <User />
                </div>
                <div className="flex flex-col text-sm items-start gap-2">
                    <span className="leading-none font-semibold">
                        Thiago Barbosa
                    </span>
                    <span className="leading-none text-gray-700">
                        estoque@email.com
                    </span>
                    <Badge>Administrador</Badge>
                </div>
            </div>
        </aside>
    );
}
