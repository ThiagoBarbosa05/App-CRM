import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Wine } from "lucide-react";

interface LoginProps {
  onLogin: (user: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("admin@vinocrm.com");
  const [password, setPassword] = useState("admin123");
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      console.log("Tentando fazer login com:", { email, password: password ? "***" : "vazio" });
      
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      
      console.log("Resposta do servidor:", response.status, response.statusText);
      
      if (!response.ok) {
        const error = await response.json();
        console.error("Erro na resposta:", error);
        throw new Error(error.message || "Erro no login");
      }
      
      const data = await response.json();
      console.log("Login bem-sucedido:", data);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Login realizado com sucesso",
        description: `Bem-vindo, ${data.user.name}!`,
      });
      onLogin(data.user);
    },
    onError: (error: any) => {
      console.error("Erro no login:", error);
      toast({
        title: "Erro no login",
        description: error.message || "Credenciais inválidas",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha email e senha",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bordeaux-50 to-bordeaux-100 dark:from-bordeaux-950 dark:to-bordeaux-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Wine className="h-12 w-12 text-bordeaux-600 dark:text-bordeaux-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-bordeaux-800 dark:text-bordeaux-200">
            Grand Cru
          </CardTitle>
          <CardDescription>
            Sistema de gestão premium
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Entrando..." : "Entrar"}
            </Button>
          </form>
          <div className="mt-6 p-4 bg-bordeaux-50 dark:bg-bordeaux-900/20 rounded-lg">
            <p className="text-sm text-bordeaux-600 dark:text-bordeaux-400 font-medium mb-2">
              Credenciais padrão:
            </p>
            <p className="text-xs text-bordeaux-500 dark:text-bordeaux-500">
              Email: admin@vinocrm.com<br />
              Senha: admin123
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}