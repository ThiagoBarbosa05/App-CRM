import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    // Redirecionar automaticamente para a página de dashboard
    window.location.href = "/dashboard";
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-lg">Redirecionando...</div>
    </div>
  );
}