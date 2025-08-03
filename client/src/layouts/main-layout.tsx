import { AppSidebar } from "./sidebar"

export function MainLayout({ children }: { children: React.ReactNode }) {

    return (
        <div className="w-full min-h-screen relative">
            <AppSidebar />
            <main>{children}</main>
        </div>
    )
}