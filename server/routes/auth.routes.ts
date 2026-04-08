import bcrypt from "bcrypt";
import { Router } from "express";

import { storage } from "../storage";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("Tentativa de login:", {
      email,
      password: password ? "***" : "não fornecida",
    });

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email e senha são obrigatórios" });
    }

    const user = await storage.getUserByEmail(email.toLowerCase());
    console.log("Usuário encontrado:", user ? "Sim" : "Não");

    if (!user) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    console.log("Verificando senha...");
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log("Senha válida:", isValidPassword);

    if (!isValidPassword) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    const userWithoutPassword = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      serviceChannelId: user.serviceChannel?.id,
    };

    console.log("Login bem-sucedido para:", userWithoutPassword);

    return res.json({
      user: userWithoutPassword,
      message: "Login realizado com sucesso",
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

export default authRouter;
