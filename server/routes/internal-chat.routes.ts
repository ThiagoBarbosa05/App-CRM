import { Router, Request, Response } from "express";
import {
  findOrCreateDmConversation,
  createGroup,
  renameGroup,
  addGroupMembers,
  removeGroupMember,
  promoteToAdmin,
  listGroupMembers,
  sendMessage,
  listMessages,
  markAsRead,
  listConversationsForUser,
  isInternalConversationAccessibleToUser,
  type ChatTab,
} from "../services/internal-chat.service";
import { addConversationSseClient, addSseClient } from "../lib/sse-hub";
import { getPublicR2Url } from "../lib/r2";

const router = Router();

function currentUserId(req: Request): string {
  return req.user!.userId;
}

router.get("/conversations", async (req: Request, res: Response) => {
  const tab = (req.query.tab as ChatTab | undefined) ?? "all";
  if (!["all", "attendants", "groups"].includes(tab)) {
    res.status(400).json({ message: "tab inválido" });
    return;
  }
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const conversations = await listConversationsForUser(currentUserId(req), tab, search);
  res.json(conversations);
});

router.post("/conversations/dm", async (req: Request, res: Response) => {
  const { userId } = req.body as { userId?: string };
  if (!userId) {
    res.status(400).json({ message: "userId é obrigatório" });
    return;
  }
  try {
    const conversation = await findOrCreateDmConversation(currentUserId(req), userId);
    res.status(201).json(conversation);
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Erro ao iniciar conversa" });
  }
});

router.post("/conversations/groups", async (req: Request, res: Response) => {
  const { name, memberUserIds } = req.body as { name?: string; memberUserIds?: string[] };
  if (!name?.trim() || !Array.isArray(memberUserIds)) {
    res.status(400).json({ message: "name e memberUserIds são obrigatórios" });
    return;
  }
  try {
    const group = await createGroup({ name, createdByUserId: currentUserId(req), memberUserIds });
    res.status(201).json(group);
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Erro ao criar grupo" });
  }
});

router.put("/conversations/:id", async (req: Request, res: Response) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ message: "name é obrigatório" });
    return;
  }
  try {
    const updated = await renameGroup(req.params.id, name, currentUserId(req));
    res.json(updated);
  } catch (err) {
    res.status(403).json({ message: err instanceof Error ? err.message : "Erro ao renomear grupo" });
  }
});

router.get("/conversations/:id/members", async (req: Request, res: Response) => {
  if (!(await isInternalConversationAccessibleToUser(req.params.id, currentUserId(req)))) {
    res.status(403).json({ message: "Você não tem acesso a esta conversa" });
    return;
  }
  const members = await listGroupMembers(req.params.id);
  res.json(members);
});

router.post("/conversations/:id/members", async (req: Request, res: Response) => {
  const { userIds } = req.body as { userIds?: string[] };
  if (!Array.isArray(userIds) || userIds.length === 0) {
    res.status(400).json({ message: "userIds deve ser um array não vazio" });
    return;
  }
  try {
    await addGroupMembers(req.params.id, userIds, currentUserId(req));
    res.status(204).end();
  } catch (err) {
    res.status(403).json({ message: err instanceof Error ? err.message : "Erro ao adicionar membros" });
  }
});

router.delete("/conversations/:id/members/:userId", async (req: Request, res: Response) => {
  try {
    await removeGroupMember(req.params.id, req.params.userId, currentUserId(req));
    res.status(204).end();
  } catch (err) {
    res.status(403).json({ message: err instanceof Error ? err.message : "Erro ao remover membro" });
  }
});

router.post("/conversations/:id/members/:userId/promote", async (req: Request, res: Response) => {
  try {
    await promoteToAdmin(req.params.id, req.params.userId, currentUserId(req));
    res.status(204).end();
  } catch (err) {
    res.status(403).json({ message: err instanceof Error ? err.message : "Erro ao promover membro" });
  }
});

router.get("/conversations/:id/messages", async (req: Request, res: Response) => {
  try {
    const messages = await listMessages(req.params.id, currentUserId(req), {
      before: typeof req.query.before === "string" ? req.query.before : undefined,
      limit: req.query.limit,
    });
    res.json(messages);
  } catch (err) {
    res.status(403).json({ message: err instanceof Error ? err.message : "Erro ao buscar mensagens" });
  }
});

router.post("/conversations/:id/messages", async (req: Request, res: Response) => {
  const { content, replyToMessageId, mediaKey, mimeType, fileName, sizeBytes } = req.body as {
    content?: string;
    replyToMessageId?: string;
    mediaKey?: string;
    mimeType?: string;
    fileName?: string;
    sizeBytes?: number;
  };
  try {
    const message = await sendMessage(req.params.id, currentUserId(req), {
      content,
      replyToMessageId,
      media: mediaKey && mimeType ? { url: getPublicR2Url(mediaKey), mimeType, fileName, sizeBytes } : undefined,
    });
    res.status(201).json(message);
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Erro ao enviar mensagem" });
  }
});

router.post("/conversations/:id/read", async (req: Request, res: Response) => {
  await markAsRead(req.params.id, currentUserId(req));
  res.status(204).end();
});

router.get("/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const cleanup = addSseClient(currentUserId(req), res);
  req.on("close", cleanup);
});

router.get("/conversations/:id/stream", async (req: Request, res: Response) => {
  const accessible = await isInternalConversationAccessibleToUser(req.params.id, currentUserId(req));
  if (!accessible) {
    res.status(403).end();
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const cleanup = addConversationSseClient(req.params.id, currentUserId(req), req.user!.role, res);
  req.on("close", cleanup);
});

export default router;
