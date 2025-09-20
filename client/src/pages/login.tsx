import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { Wine, Mail, Lock, LogIn, Loader2, Eye, EyeOff } from "lucide-react";

// Schema de validação com Zod
const loginSchema = z.object({
  email: z
    .string()
    .min(1, "E-mail é obrigatório")
    .email("Formato de e-mail inválido")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(1, "Senha é obrigatória")
    .min(3, "Senha deve ter pelo menos 3 caracteres")
    .max(100, "Senha muito longa"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginProps {
  onLogin: (user: any) => void;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface LoginResponse {
  user: User;
  token?: string;
}

export default function Login({ onLogin }: LoginProps) {
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  // Configuração do React Hook Form com Zod
  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    watch,
    trigger,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onChange", // Validação em tempo real
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Observar valores dos campos para feedback visual
  const watchedEmail = watch("email");
  const watchedPassword = watch("password");

  // Toggle para mostrar/ocultar senha
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  // Mutation para login
  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData): Promise<LoginResponse> => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro no login");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Login realizado com sucesso",
        description: `Bem-vindo(a), ${data.user.name}!`,
        duration: 3000,
      });
      onLogin(data.user);
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Erro no login",
        description: error.message || "Credenciais inválidas. Tente novamente.",
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  // Handler para submissão do formulário
  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  // Estados computados
  const isLoading = loginMutation.isPending;
  const isFormValid = isDirty && isValid;

  // Helpers para feedback visual
  const getFieldStatus = (fieldName: keyof LoginFormData, value: string) => {
    const hasError = !!errors[fieldName];
    const isValidField = !hasError && value && value.length > 0;

    if (hasError) return "error";
    if (isValidField) return "success";
    return "default";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-800 via-purple-600 to-purple-400 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Background decorativo */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        {/* <div
          className="absolute inset-0 bg-white/5 bg-no-repeat bg-center bg-cover"
          style={{
            backgroundImage: `url("https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJF0h23O88neEqY2l1ldOQNSwdfwB8E1FM1w&s")`,
          }}
        /> */}
      </div>

      <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm border-0 shadow-2xl ring-1 ring-white/20 transform transition-all duration-300 hover:shadow-3xl">
        <CardHeader className="text-center pb-2 pt-8">
          {/* Logo com animação */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-purple-600 rounded-full blur-lg opacity-30 animate-pulse" />
              <div className="relative bg-gradient-to-r from-primary to-purple-600 p-4 rounded-full shadow-lg">
                <Wine className="h-8 w-8 " />
              </div>
            </div>
          </div>

          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text mb-2">
            CRM Grand Cru
          </CardTitle>
          <CardDescription className="text-gray-600 text-sm leading-relaxed px-2">
            Sistema de gestão e relacionamento com clientes
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-2 pb-8 px-8">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
            {/* Campo de E-mail */}
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-sm font-medium text-gray-700 flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                E-mail
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  placeholder="seu@email.com"
                  className={`pl-4 pr-4 py-3 h-12 transition-all duration-200 ${
                    getFieldStatus("email", watchedEmail) === "error"
                      ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                      : getFieldStatus("email", watchedEmail) === "success"
                        ? "border-green-300 focus:border-green-500 focus:ring-green-200"
                        : "focus:border-primary focus:ring-primary/20"
                  }`}
                  autoComplete="email"
                  disabled={isLoading}
                  onChange={async (e) => {
                    register("email").onChange(e);
                    if (e.target.value) {
                      await trigger("email");
                    }
                  }}
                />
                {watchedEmail && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {getFieldStatus("email", watchedEmail) === "success" ? (
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                    ) : getFieldStatus("email", watchedEmail) === "error" ? (
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                    ) : null}
                  </div>
                )}
              </div>
              {errors.email && (
                <p className="text-red-500 text-xs mt-1 animate-in slide-in-from-top-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Campo de Senha */}
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm font-medium text-gray-700 flex items-center gap-2"
              >
                <Lock className="h-4 w-4" />
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  placeholder="Sua senha"
                  className={`pl-4 pr-12 py-3 h-12 transition-all duration-200 ${
                    getFieldStatus("password", watchedPassword) === "error"
                      ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                      : getFieldStatus("password", watchedPassword) ===
                          "success"
                        ? "border-green-300 focus:border-green-500 focus:ring-green-200"
                        : "focus:border-primary focus:ring-primary/20"
                  }`}
                  autoComplete="current-password"
                  disabled={isLoading}
                  onChange={async (e) => {
                    register("password").onChange(e);
                    if (e.target.value) {
                      await trigger("password");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={togglePasswordVisibility}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 p-0 hover:bg-gray-100"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-500" />
                  )}
                </Button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1 animate-in slide-in-from-top-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Botão de Login */}
            <Button
              type="submit"
              disabled={!isFormValid || isLoading}
              className="w-full h-12 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg disabled:transform-none disabled:hover:scale-100 disabled:opacity-50 mt-6"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrando...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Entrar
                </div>
              )}
            </Button>
          </form>

          {/* Footer informativo */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Acesso seguro e protegido | Validação em tempo real
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
