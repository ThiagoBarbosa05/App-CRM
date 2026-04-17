import { Request, Response } from "express";
import { mergeClients } from "../../services/merge-clients.service";

export async function mergeClientsController(req: Request, res: Response) {
  const { keepId, mergeId } = req.params;

  if (!keepId || !mergeId) {
    return res.status(400).json({ message: "IDs dos clientes são obrigatórios." });
  }

  try {
    const client = await mergeClients(keepId, mergeId);
    return res.json({ message: "Clientes unificados com sucesso.", client });
  } catch (error) {
    console.error("[mergeClients]", error);
    const message = error instanceof Error ? error.message : "Erro ao unificar clientes.";
    return res.status(400).json({ message });
  }
}
