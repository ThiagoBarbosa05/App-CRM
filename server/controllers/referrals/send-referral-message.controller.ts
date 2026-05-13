import { Request, Response } from "express";
import { db } from "../../db";
import { referrals, users, serviceChannels, userServiceChannel } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { syncContact, createChat, sendMessage } from "../../integrations/umbler";
import { referralsService } from "../../services/referrals.service";

export const sendReferralMessageController = async (
  req: Request,
  res: Response,
) => {
  try {
    const { referralId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const [referral] = await db
      .select()
      .from(referrals)
      .where(eq(referrals.id, referralId))
      .limit(1);

    if (!referral) {
      return res.status(404).json({ message: "Indicação não encontrada" });
    }

    const [userRow] = await db
      .select({ id: users.id, name: users.name, channelId: serviceChannels.id })
      .from(users)
      .where(eq(users.id, userId))
      .leftJoin(userServiceChannel, eq(users.id, userServiceChannel.userId))
      .leftJoin(serviceChannels, eq(userServiceChannel.serviceChannelId, serviceChannels.id))
      .limit(1);

    if (!userRow) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const organizationId = process.env.UMBLER_ORGANIZATION_ID ?? "";

    const contact = await syncContact({
      phoneNumber: referral.referredPhone,
      name: referral.referredName,
      organizationId,
    });

    if (!contact) {
      return res.status(502).json({ message: "Erro ao sincronizar contato no Umbler" });
    }

    if (!userRow.channelId) {
      return res.status(400).json({ message: "Usuário sem canal de atendimento configurado" });
    }

    const chat = await createChat({
      contactId: contact.contact.id,
      channelId: userRow.channelId,
    });

    if (!chat) {
      return res.status(502).json({ message: "Erro ao criar chat no Umbler" });
    }

    const message =
      `Olá ${referral.referredName}! Você foi indicado por um de nossos clientes. ` +
      `Aproveite e entre em contato para conhecer nossos produtos! 😊`;

    await sendMessage({ chatId: chat.id, message });

    await referralsService.markMessageSent(referralId);

    return res.json({ message: "Mensagem enviada com sucesso" });
  } catch (error) {
    console.error("Erro ao enviar mensagem de indicação:", error);
    return res.status(500).json({ message: "Erro ao enviar mensagem" });
  }
};
