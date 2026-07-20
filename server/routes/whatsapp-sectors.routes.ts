import { Router, Request, Response } from "express";
import {
  listSectors,
  getSectorById,
  createSector,
  updateSector,
  deleteSector,
  listSectorMembers,
  setSectorMembers,
} from "../services/whatsapp-sectors.service";
import { isAdminOrGerente } from "../middleware/validation";

const router = Router();

router.get("/sectors", async (req: Request, res: Response) => {
  const includeInactive = req.query.includeInactive === "true" && isAdminOrGerente(req);
  const sectors = await listSectors(includeInactive);
  res.json(sectors);
});

router.post("/sectors", async (req: Request, res: Response) => {
  if (!isAdminOrGerente(req)) {
    res.status(403).json({ message: "Acesso restrito a administradores e gerentes" });
    return;
  }
  const { name, color } = req.body as { name?: string; color?: string };
  if (!name) {
    res.status(400).json({ message: "name é obrigatório" });
    return;
  }
  const sector = await createSector({ name, color });
  res.status(201).json(sector);
});

router.put("/sectors/:id", async (req: Request, res: Response) => {
  if (!isAdminOrGerente(req)) {
    res.status(403).json({ message: "Acesso restrito a administradores e gerentes" });
    return;
  }
  const { name, color, isActive } = req.body as { name?: string; color?: string; isActive?: boolean };
  const updated = await updateSector(req.params.id, { name, color, isActive });
  if (!updated) {
    res.sendStatus(404);
    return;
  }
  res.json(updated);
});

router.delete("/sectors/:id", async (req: Request, res: Response) => {
  if (!isAdminOrGerente(req)) {
    res.status(403).json({ message: "Acesso restrito a administradores e gerentes" });
    return;
  }
  const sector = await getSectorById(req.params.id);
  if (!sector) {
    res.sendStatus(404);
    return;
  }
  await deleteSector(req.params.id);
  res.sendStatus(204);
});

// Expõe nome/e-mail/role dos membros de um setor — restrito a admin/gerente
// para não vazar dados de colegas de outros setores a qualquer vendedor.
router.get("/sectors/:id/members", async (req: Request, res: Response) => {
  if (!isAdminOrGerente(req)) {
    res.status(403).json({ message: "Acesso restrito a administradores e gerentes" });
    return;
  }
  const sector = await getSectorById(req.params.id);
  if (!sector) {
    res.sendStatus(404);
    return;
  }
  const members = await listSectorMembers(req.params.id);
  res.json(members);
});

router.put("/sectors/:id/members", async (req: Request, res: Response) => {
  if (!isAdminOrGerente(req)) {
    res.status(403).json({ message: "Acesso restrito a administradores e gerentes" });
    return;
  }
  const sector = await getSectorById(req.params.id);
  if (!sector) {
    res.sendStatus(404);
    return;
  }
  const { userIds } = req.body as { userIds?: string[] };
  if (!Array.isArray(userIds)) {
    res.status(400).json({ message: "userIds deve ser um array" });
    return;
  }
  await setSectorMembers(req.params.id, userIds);
  const members = await listSectorMembers(req.params.id);
  res.json(members);
});

export default router;
