import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    // Redirecionar automaticamente para a página de clientes
    window.location.href = "/clientes";
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-lg">Redirecionando...</div>
    </div>
  );
}