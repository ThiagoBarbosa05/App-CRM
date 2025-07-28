import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wine, Users, TrendingUp, Shield } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-wine-50 to-wine-100 dark:from-wine-950 dark:to-wine-900">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <Wine className="h-12 w-12 text-wine-600 mr-3" />
            <h1 className="text-4xl font-bold text-wine-900 dark:text-wine-100">
              VinoCRM
            </h1>
          </div>
          <p className="text-xl text-wine-700 dark:text-wine-300 max-w-2xl mx-auto">
            Sistema completo de gestão de relacionamento com clientes 
            especializado para lojas de vinhos
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <Card className="border-wine-200 dark:border-wine-800">
            <CardHeader>
              <Users className="h-8 w-8 text-wine-600 mb-2" />
              <CardTitle className="text-wine-900 dark:text-wine-100">
                Gestão de Clientes
              </CardTitle>
              <CardDescription>
                Cadastro completo com CPF, endereço, aniversário e categorização
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-wine-200 dark:border-wine-800">
            <CardHeader>
              <TrendingUp className="h-8 w-8 text-wine-600 mb-2" />
              <CardTitle className="text-wine-900 dark:text-wine-100">
                Funil de Vendas
              </CardTitle>
              <CardDescription>
                Acompanhe negociações com sistema Kanban personalizado
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-wine-200 dark:border-wine-800">
            <CardHeader>
              <Shield className="h-8 w-8 text-wine-600 mb-2" />
              <CardTitle className="text-wine-900 dark:text-wine-100">
                Controle de Acesso
              </CardTitle>
              <CardDescription>
                Sistema multi-usuário com diferentes níveis de permissão
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Login Section */}
        <Card className="max-w-md mx-auto border-wine-200 dark:border-wine-800">
          <CardHeader className="text-center">
            <CardTitle className="text-wine-900 dark:text-wine-100">
              Acesse sua conta
            </CardTitle>
            <CardDescription>
              Entre com sua conta para começar a usar o VinoCRM
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              onClick={handleLogin}
              className="w-full bg-wine-600 hover:bg-wine-700 text-white"
              size="lg"
            >
              Entrar
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-16 text-wine-600 dark:text-wine-400">
          <p>© 2024 VinoCRM - Sistema de CRM para Lojas de Vinhos</p>
        </div>
      </div>
    </div>
  );
}