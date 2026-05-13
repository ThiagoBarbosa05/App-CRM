import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { Mail, Lock, LogIn, Loader2, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: { email: "", password: "" },
  });

  const watchedEmail = watch("email");
  const watchedPassword = watch("password");

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

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
        title: "Login realizado com sucesso",
        description: `Bem-vindo(a), ${data.user.name}!`,
        duration: 3000,
      });
      onLogin(data.user);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no login",
        description: error.message || "Credenciais inválidas. Tente novamente.",
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  const isLoading = loginMutation.isPending;
  const isFormValid = isDirty && isValid;

  const getFieldStatus = (fieldName: keyof LoginFormData, value: string) => {
    const hasError = !!errors[fieldName];
    const isValidField = !hasError && value && value.length > 0;
    if (hasError) return "error";
    if (isValidField) return "success";
    return "default";
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex">
      {/* Left panel — decorative */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col items-center justify-center overflow-hidden bg-[#1a0a0e]">
        {/* Layered radial gradients */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,_#6b1428_0%,_transparent_70%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_80%_80%,_#3d0a14_0%,_transparent_70%)]" />
          {/* Subtle noise texture overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundSize: "200px 200px",
            }}
          />
        </div>

        {/* Decorative ring */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute w-[520px] h-[520px] rounded-full border border-[#7a1e30]/20"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: "easeOut", delay: 0.1 }}
          className="absolute w-[680px] h-[680px] rounded-full border border-[#7a1e30]/10"
        />

        {/* Center content */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-center gap-10 px-16 text-center"
        >
          <img
            src="/logo-grand-cru-red (1).webp"
            alt="Grand Cru"
            className="w-72 drop-shadow-[0_4px_32px_rgba(180,30,60,0.35)]"
          />

          <div className="space-y-3">
            <div className="h-px w-16 bg-gradient-to-r from-transparent via-[#c04060]/60 to-transparent mx-auto" />
            <p className="text-[#c9a0a8] text-sm font-light tracking-[0.25em] uppercase">
              Sistema de Gestão & Relacionamento
            </p>
            <div className="h-px w-16 bg-gradient-to-r from-transparent via-[#c04060]/60 to-transparent mx-auto" />
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex gap-3 items-center"
          >
            {["Clientes", "Vendas", "CRM"].map((tag, i) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-[10px] tracking-widest uppercase font-medium border border-[#7a1e30]/40 text-[#c9a0a8]/70 bg-[#3d0a14]/30"
              >
                {tag}
              </span>
            ))}
          </motion.div>
        </motion.div>

        {/* Bottom copyright */}
        <p className="absolute bottom-6 text-[10px] text-[#7a3040]/60 tracking-widest uppercase font-light">
          © 2026 Grand Cru — Todos os direitos reservados
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-[#faf7f5] relative overflow-hidden p-6">
        {/* Subtle warm background accents */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[radial-gradient(ellipse_at_top_right,_#f5e6e9_0%,_transparent_65%)]" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[radial-gradient(ellipse_at_bottom_left,_#f0dfe3_0%,_transparent_65%)]" />

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 w-full max-w-[400px]"
        >
          {/* Mobile logo */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:hidden flex justify-center mb-10"
          >
            <img
              src="/logo-grand-cru-red (1).webp"
              alt="Grand Cru"
              className="w-44"
            />
          </motion.div>

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h1 className="text-2xl font-semibold text-[#2a0e14] tracking-tight mb-1">
              Bem-vindo de volta
            </h1>
            <p className="text-sm text-[#9e6370]">
              Acesse sua conta para continuar
            </p>
          </motion.div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
            {/* E-mail */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-1.5"
            >
              <Label
                htmlFor="email"
                className="text-xs font-semibold text-[#5a2030] uppercase tracking-widest flex items-center gap-1.5"
              >
                <Mail className="h-3 w-3" />
                E-mail
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  placeholder="seu@email.com"
                  disabled={isLoading}
                  className={`h-12 bg-white border rounded-xl px-4 text-sm text-[#2a0e14] placeholder:text-[#c9a0a8] transition-all duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1a2c]/30 focus-visible:border-[#8b1a2c] ${
                    getFieldStatus("email", watchedEmail) === "error"
                      ? "border-red-400 focus-visible:ring-red-400/20 focus-visible:border-red-400"
                      : getFieldStatus("email", watchedEmail) === "success"
                        ? "border-emerald-400 focus-visible:ring-emerald-400/20 focus-visible:border-emerald-400"
                        : "border-[#e8d5d9]"
                  }`}
                />
                {getFieldStatus("email", watchedEmail) === "success" && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-2 h-2 bg-emerald-500 rounded-full"
                  />
                )}
              </div>
              <AnimatePresence>
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-red-500 text-xs mt-1"
                  >
                    {errors.email.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Senha */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-1.5"
            >
              <Label
                htmlFor="password"
                className="text-xs font-semibold text-[#5a2030] uppercase tracking-widest flex items-center gap-1.5"
              >
                <Lock className="h-3 w-3" />
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  placeholder="••••••••"
                  disabled={isLoading}
                  className={`h-12 bg-white border rounded-xl px-4 pr-12 text-sm text-[#2a0e14] placeholder:text-[#c9a0a8] transition-all duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1a2c]/30 focus-visible:border-[#8b1a2c] ${
                    getFieldStatus("password", watchedPassword) === "error"
                      ? "border-red-400 focus-visible:ring-red-400/20 focus-visible:border-red-400"
                      : getFieldStatus("password", watchedPassword) ===
                          "success"
                        ? "border-emerald-400 focus-visible:ring-emerald-400/20 focus-visible:border-emerald-400"
                        : "border-[#e8d5d9]"
                  }`}
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  disabled={isLoading}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#c9a0a8] hover:text-[#8b1a2c] transition-colors"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <AnimatePresence>
                {errors.password && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-red-500 text-xs mt-1"
                  >
                    {errors.password.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Submit */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="pt-2"
            >
              <Button
                type="submit"
                disabled={!isFormValid || isLoading}
                className="w-full h-12 bg-[#8b1a2c] hover:bg-[#a02035] active:bg-[#6e1422] text-white text-sm font-semibold tracking-widest uppercase rounded-xl transition-all duration-300 shadow-[0_4px_20px_rgba(139,26,44,0.35)] hover:shadow-[0_6px_28px_rgba(139,26,44,0.5)] disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Autenticando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Entrar
                  </span>
                )}
              </Button>
            </motion.div>
          </form>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-8 text-center text-[10px] text-[#c9a0a8] tracking-wider uppercase"
          >
            Acesso restrito a usuários autorizados
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
