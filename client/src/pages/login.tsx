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
import { Wine, Mail, Lock, LogIn, Loader2, Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
    <div className="min-h-screen relative overflow-hidden bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      {/* Dynamic Background Layer */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] bg-indigo-500/5 blur-[100px] rounded-full animate-pulse" style={{ animationDelay: '4s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[440px]"
      >
        <Card className="border-0 shadow-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl rounded-[2.5rem] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-white/10 dark:from-slate-800/50 dark:to-slate-900/10 pointer-events-none" />
          
          <CardHeader className="relative text-center pb-6 pt-12 px-10">
            {/* Logo Section */}
            <motion.div 
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
              className="flex justify-center mb-8"
            >
              <div className="relative group">
                <div className="absolute inset-0 bg-blue-600 rounded-[2rem] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
                <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-[2rem] shadow-xl transform transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                  <Wine className="h-10 w-10 text-white" />
                </div>
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 p-1.5 rounded-full shadow-lg border border-slate-100 dark:border-slate-700"
                >
                  <Sparkles className="h-4 w-4 text-amber-500" />
                </motion.div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <CardTitle className="text-4xl font-black text-slate-900 dark:text-white mb-3 tracking-tighter uppercase italic">
                Grand<span className="text-blue-600 not-italic">Cru</span>
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400 font-medium text-base">
                Sistema de Gestão & Relacionamento
              </CardDescription>
            </motion.div>
          </CardHeader>

          <CardContent className="relative pt-2 pb-12 px-10">
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-6"
              noValidate
            >
              {/* E-mail Field */}
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-2.5"
              >
                <Label
                  htmlFor="email"
                  className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1 flex items-center gap-2 uppercase tracking-wider"
                >
                  <Mail className="h-3.5 w-3.5 text-blue-500" />
                  E-mail
                </Label>
                <div className="relative group">
                  <Input
                    id="email"
                    type="email"
                    {...register("email")}
                    placeholder="seu@email.com"
                    className={`pl-5 pr-5 h-14 bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 rounded-2xl transition-all duration-300 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-medium ${
                      getFieldStatus("email", watchedEmail) === "error"
                        ? "border-red-400/50 focus:border-red-500 focus:ring-red-500/5"
                        : getFieldStatus("email", watchedEmail) === "success"
                          ? "border-emerald-400/50 focus:border-emerald-500 focus:ring-emerald-500/5"
                          : ""
                    }`}
                    disabled={isLoading}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                    {getFieldStatus("email", watchedEmail) === "success" && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    )}
                  </div>
                </div>
                <AnimatePresence>
                  {errors.email && (
                    <motion.p 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-red-500 text-xs font-bold ml-1"
                    >
                      {errors.email.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Password Field */}
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-2.5"
              >
                <Label
                  htmlFor="password"
                  className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1 flex items-center gap-2 uppercase tracking-wider"
                >
                  <Lock className="h-3.5 w-3.5 text-blue-500" />
                  Senha de acesso
                </Label>
                <div className="relative group">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    {...register("password")}
                    placeholder="••••••••"
                    className={`pl-5 pr-14 h-14 bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 rounded-2xl transition-all duration-300 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-medium ${
                      getFieldStatus("password", watchedPassword) === "error"
                        ? "border-red-400/50 focus:border-red-500 focus:ring-red-500/5"
                        : getFieldStatus("password", watchedPassword) === "success"
                          ? "border-emerald-400/50 focus:border-emerald-500 focus:ring-emerald-500/5"
                          : ""
                    }`}
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={togglePasswordVisibility}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-slate-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-slate-400" />
                    )}
                  </Button>
                </div>
                <AnimatePresence>
                  {errors.password && (
                    <motion.p 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-red-500 text-xs font-bold ml-1"
                    >
                      {errors.password.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Action Section */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="pt-4"
              >
                <Button
                  type="submit"
                  disabled={!isFormValid || isLoading}
                  className="w-full h-14 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-lg font-black uppercase tracking-wider rounded-2xl transition-all duration-500 shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 transform hover:-translate-y-1 active:scale-[0.98] disabled:transform-none disabled:opacity-40 disabled:shadow-none"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Autenticando...
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <LogIn className="h-5 w-5" />
                      Entrar no sistema
                    </div>
                  )}
                </Button>
              </motion.div>
            </form>

            {/* Premium Footer */}
            {/* <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-10 flex flex-col items-center gap-4 py-4 border-t border-slate-100 dark:border-slate-800/50"
            >
             
              <p className="text-[10px] text-slate-300 dark:text-slate-600 font-medium max-w-[240px] text-center leading-relaxed">
                © 2026 CRM Grand Cru. Todos os direitos reservados. 
                Ambiente monitorado para sua segurança.
              </p>
            </motion.div> */}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
