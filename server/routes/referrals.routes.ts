import { Router } from "express";
import { sendReferralMessageController } from "../controllers/referrals/send-referral-message.controller";
import { deleteReferralController } from "../controllers/referrals/delete-referral.controller";

export const referralsRouter = Router();

referralsRouter.post("/:referralId/send-message", sendReferralMessageController);
referralsRouter.delete("/:referralId", deleteReferralController);
