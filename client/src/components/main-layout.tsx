import Sidebar from "./sidebar";

export function MainLayout({ children }: { children: React.ReactNode }) {

  return (
    <div className="flex flex-col min-h-screen">
      <Sidebar/>
      <main className="flex-1 bg-gray-50">{children}</main>
    </div>
  )
}