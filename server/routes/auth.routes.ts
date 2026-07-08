import bcrypt from "bcrypt";
import { Router } from "express";
import { z } from "zod";

import { storage } from "../storage";
import { signToken } from "../lib/jwt";
import { validateBody, requireAuth } from "../middleware/validation";
import { rateLimit } from "../middleware/rate-limit";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

const loginRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  keyFn: (req) => `login:${req.ip}`,
  message: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.",
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias em ms
};

authRouter.post("/login", loginRateLimit, validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await storage.getUserByEmail(email.toLowerCase());

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    if (user.isActive !== "true") {
      return res.status(403).json({ message: "Usuário inativo" });
    }

    const token = signToken({ userId: user.id, role: user.role, email: user.email });

    res.cookie("auth_token", token, COOKIE_OPTIONS);

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        serviceChannelId: user.serviceChannel?.id ?? null,
      },
      message: "Login realizado com sucesso",
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("auth_token", COOKIE_OPTIONS);
  return res.json({ message: "Logout realizado com sucesso" });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await storage.getUser(req.user!.userId);

    if (!user || user.isActive !== "true") {
      res.clearCookie("auth_token", COOKIE_OPTIONS);
      return res.status(401).json({ message: "Sessão inválida", code: "UNAUTHORIZED" });
    }

    const { password: _, ...userWithoutPassword } = user;

    return res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error("Erro ao buscar usuário autenticado:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

export default authRouter;
