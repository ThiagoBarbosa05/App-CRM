import { Router } from "express";
import { sendReferralMessageController } from "../controllers/referrals/send-referral-message.controller";

export const referralsRouter = Router();

referralsRouter.post("/:referralId/send-message", sendReferralMessageController);
